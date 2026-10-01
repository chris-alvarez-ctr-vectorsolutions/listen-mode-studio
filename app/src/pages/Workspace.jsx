import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getModule, saveModule } from '../lib/store.js';
import { addRuleToKit, loadKit, systemPrompt } from '../lib/kit.js';
import { callClaude } from '../lib/claude.js';
import { EXAMPLE_FIELDS, SEED_FIELDS, composeSeed, missingRequired, seedFieldsOf } from '../lib/seed.js';
import { parsePerformance, parseReviewSets } from '../lib/script.js';
import { readFileText } from '../lib/download.js';
import Markdown from '../components/Markdown.jsx';
import ScriptReview from '../components/ScriptReview.jsx';
import ReviewSets from '../components/ReviewSets.jsx';

function seedBlock(m) {
  const sources = m.sources.map(s => `### ${s.name}\n\n${s.text}`).join('\n\n');
  return `# Module: ${m.name}\n\n## Seed\n\n${m.seed || '(none)'}\n\n## Source files\n\n${sources || '(none)'}\n\nClaims ledger signed by the SME: ${m.ledgerSigned ? 'yes' : 'no (treat this run as an internal draft)'}.`;
}

export default function Workspace() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [kit, setKit] = useState(loadKit);
  const [active, setActive] = useState('seed');
  const [busy, setBusy] = useState(null);
  const [live, setLive] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [fixes, setFixes] = useState('');
  const abort = useRef(null);
  const mRef = useRef(null);
  const setBoth = next => { mRef.current = next; setM(next); };
  const cur = () => mRef.current;

  useEffect(() => { getModule(id).then(setBoth); }, [id]);
  if (!m) return <p className="text-muted">Loading…</p>;

  const setSeedField = (fid, value) => {
    const seedFields = { ...seedFieldsOf(cur()), [fid]: value };
    setBoth({ ...cur(), seedFields, seed: composeSeed(seedFields) });
  };
  const continueToLedger = () => {
    const miss = missingRequired(seedFieldsOf(cur())).filter(() => !cur().sources.length);
    if (miss.length && !confirm(`Missing: ${miss.join(', ')}. The ledger will likely come back with nothing to work from. Continue anyway?`)) return;
    saveModule(cur()); setActive('ledger');
  };
  const loadExample = () => {
    const hasText = Object.values(seedFieldsOf(cur())).some(v => v && v.trim());
    if (hasText && !confirm('Replace what is in the seed fields with the example?')) return;
    update({ seedFields: { ...EXAMPLE_FIELDS }, seed: composeSeed(EXAMPLE_FIELDS) });
  };

  const stages = kit.stages;
  const update = async patch => { const next = { ...cur(), ...patch }; setBoth(next); await saveModule(next); return next; };
  const st = sid => cur().stages[sid] || { status: 'idle' };
  const unlocked = idx => idx === 0 || ['approved', 'skipped'].includes(st(stages[idx - 1].id).status);

  async function run(stage, userText) {
    setError(''); setBusy(stage.id); setLive('');
    abort.current = new AbortController();
    try {
      const k = loadKit();
      setKit(k);
      const system = systemPrompt(k);
      const mod = cur();
      const prompt = (userText || stage.prompt).replaceAll('{module}', mod.name);
      let reply;
      if (stage.kind === 'editor') {
        const content = `${seedBlock(mod)}\n\n## Script to review\n\n${mod.currentScript}\n\n${prompt}`;
        reply = await callClaude({ system, messages: [{ role: 'user', content }], onText: setLive, signal: abort.current.signal });
        await update({ stages: { ...cur().stages, editor: { status: 'ready', output: reply } } });
        return;
      }
      // "Run again" replaces the stage's earlier exchange (and rebuilds the seed if it is the first one);
      // a revision (userText) continues the conversation.
      const start = userText ? mod.thread.length : (st(stage.id).threadStart ?? mod.thread.length);
      const base = mod.thread.slice(0, start);
      const content = base.length === 0 ? `${seedBlock(mod)}\n\n---\n\n${prompt}` : prompt;
      const thread = [...base, { role: 'user', content }];
      reply = await callClaude({ system, messages: thread, onText: setLive, signal: abort.current.signal });
      const patch = {
        thread: [...thread, { role: 'assistant', content: reply }],
        stages: { ...cur().stages, [stage.id]: { status: 'ready', output: reply, threadStart: start } },
      };
      if (stage.kind === 'script') patch.currentScript = reply;
      if (stage.kind === 'json') {
        try { patch.parts = parsePerformance(reply); }
        catch (e) { setError(`Couldn't read the render data: ${e.message}. Run the stage again.`); }
      }
      if (stage.kind === 'cards') {
        try { patch.reviewSets = parseReviewSets(reply); }
        catch (e) { setError(`Couldn't read the review cards: ${e.message}. Run the stage again.`); }
      }
      await update(patch);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally { setBusy(null); setLive(''); }
  }

  const approve = stage => update({ stages: { ...cur().stages, [stage.id]: { ...st(stage.id), status: 'approved' } } });
  const skip = stage => update({ stages: { ...cur().stages, [stage.id]: { status: 'skipped', output: '' } } });

  function revise(stage) {
    const lines = m.notes.map((n, i) => `${i + 1}. In ${n.asset || 'the script'}, ${n.speaker}: "${n.text}"\n   Note: ${n.note}${n.better ? `\n   Better: ${n.better}` : ''}`).join('\n');
    const msg = `Revise the ${stage.title.toLowerCase()} with these notes. Apply each note wherever the same pattern appears, not only on the quoted line. Then output the full revised version in the same format.\n\n${feedback ? `General notes:\n${feedback}\n\n` : ''}${lines ? `Line notes:\n${lines}` : ''}`;
    setFeedback('');
    update({ notes: [] }).then(() => run(stage, msg));
  }

  async function applyFixes() {
    const draft = stages.find(s => s.id === 'validity');
    await run(draft, `Apply these fixes from the editor review to the latest script. Change nothing else. Then output the full revised script in the same format.\n\n${fixes}`);
    setFixes('');
    const s2 = cur().stages;
    await update({ stages: { ...s2, validity: { ...s2.validity, status: 'approved' }, editor: { ...s2.editor, status: 'approved' } } });
  }

  async function addSources(e) {
    const files = [...(e.target.files || [])];
    const added = await Promise.all(files.map(async f => ({ name: f.name, text: await readFileText(f) })));
    await update({ sources: [...cur().sources, ...added] });
    e.target.value = '';
  }

  function saveRule(n) {
    const rule = prompt('Rule to add to the kit (it applies to every future module):', n.note);
    if (!rule) return;
    setKit(addRuleToKit(loadKit(), { rule, bad: `${n.speaker}: ${n.text}`, better: n.better }));
  }

  const stage = stages.find(s => s.id === active);
  const out = stage ? st(stage.id).output : '';

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside>
        <Link to="/" className="text-sm text-muted hover:text-ink">All modules</Link>
        <h1 className="mt-2 text-xl font-semibold leading-snug">{m.name}</h1>
        <ol className="mt-6 space-y-1">
          <li><button className={`w-full rounded-md px-3 py-2 text-left text-sm ${active === 'seed' ? 'bg-ink text-white' : 'hover:bg-panel'}`} onClick={() => setActive('seed')}>1. Seed</button></li>
          {stages.map((s, i) => {
            const status = st(s.id).status;
            const mark = status === 'approved' ? '✓' : status === 'skipped' ? 'skipped' : status === 'ready' ? 'review' : '';
            return (
              <li key={s.id}>
                <button disabled={!unlocked(i)} className={`flex w-full justify-between rounded-md px-3 py-2 text-left text-sm disabled:opacity-40 ${active === s.id ? 'bg-ink text-white' : 'hover:bg-panel'}`} onClick={() => setActive(s.id)}>
                  <span>{s.n}. {s.title}</span><span className="text-xs opacity-80">{mark}</span>
                </button>
              </li>
            );
          })}
          <li><Link to={`/m/${m.id}/render`} className={`mt-3 block rounded-md border px-3 py-2 text-sm ${m.parts ? 'border-onair text-onair' : 'border-rule text-muted hover:text-ink'}`}>10. Render audio</Link></li>
        </ol>
      </aside>

      <section className="min-w-0 rounded-lg border border-rule bg-panel p-6">
        {error && <p role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        {active === 'seed' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Seed the module</h2>
              <p className="text-sm text-muted">Fill in what you know. Content claims matter most: the script can only say what is listed there or in an attached source file.</p>
            </div>
            {SEED_FIELDS.map(f => (
              <div key={f.id}>
                <label className="label" htmlFor={`seed-${f.id}`}>{f.label}{f.required && <span className="text-onair"> *</span>}</label>
                <p className="mb-1 text-xs text-muted">{f.help}</p>
                <textarea id={`seed-${f.id}`} className="field font-script" rows={f.rows} placeholder={f.placeholder}
                  value={seedFieldsOf(m)[f.id] || ''}
                  onChange={e => setSeedField(f.id, e.target.value)} onBlur={() => saveModule(cur())} />
              </div>
            ))}
            <div>
              <label className="label" htmlFor="src">Source files (text or Markdown)</label>
              <input id="src" type="file" multiple accept=".txt,.md,.csv,.json" onChange={addSources} className="text-sm" />
              <ul className="mt-2 space-y-1 text-sm">
                {m.sources.map((s, i) => (
                  <li key={i} className="flex justify-between"><span>{s.name}</span>
                    <button className="underline" onClick={() => update({ sources: m.sources.filter((_, j) => j !== i) })}>Remove</button></li>
                ))}
              </ul>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={m.ledgerSigned} onChange={e => update({ ledgerSigned: e.target.checked })} />
              The SME has signed the claims ledger. Until this is checked, audio files are marked DRAFT.
            </label>
            <div className="flex gap-3">
              <button className="btn-primary" onClick={continueToLedger}>Continue to the claims ledger</button>
              <button className="btn" onClick={loadExample}>Fill with an example</button>
            </div>
          </div>
        )}

        {stage && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{stage.n}. {stage.title}</h2>
                <p className="text-sm text-muted">{stage.gate}</p>
              </div>
              <div className="flex gap-2">
                {busy === stage.id
                  ? <button className="btn" onClick={() => abort.current?.abort()}>Stop</button>
                  : <button className="btn-primary" disabled={!!busy} onClick={() => run(stage)}>{out ? 'Run again' : 'Run'}</button>}
                {stage.skippable && !out && <button className="btn" onClick={() => skip(stage)}>Skip, ledger is in the seed</button>}
              </div>
            </div>

            <div className="mt-6">
              {busy === stage.id && <div className="whitespace-pre-wrap font-script text-[15px] leading-relaxed text-muted">{live || 'Working…'}</div>}
              {busy !== stage.id && out && stage.kind === 'script' && (
                <ScriptReview text={out} notes={m.notes}
                  onAddNote={n => update({ notes: [...m.notes, n] })}
                  onRemoveNote={key => update({ notes: m.notes.filter(n => n.key !== key) })}
                  onSaveRule={saveRule} />
              )}
              {busy !== stage.id && out && stage.kind === 'json' && (
                m.parts
                  ? <p className="text-sm">Render data is ready: {m.parts.parts.length} parts, {m.parts.assembly.length} listens. <Link className="underline" to={`/m/${m.id}/render`}>Go to rendering</Link>.</p>
                  : <pre className="max-h-96 overflow-auto rounded bg-paper p-3 text-xs">{out}</pre>
              )}
              {busy !== stage.id && out && stage.kind === 'cards' && (
                m.reviewSets ? <ReviewSets data={m.reviewSets} /> : <pre className="max-h-96 overflow-auto rounded bg-paper p-3 text-xs">{out}</pre>
              )}
              {busy !== stage.id && out && (stage.kind === 'doc' || stage.kind === 'editor') && <Markdown text={out} />}
            </div>

            {busy !== stage.id && out && stage.kind === 'editor' && (
              <div className="mt-6 space-y-2 border-t border-rule pt-4">
                <label className="label" htmlFor="fixes">Fixes to apply</label>
                <textarea id="fixes" className="field h-28" placeholder="Paste the fixes you agree with, or list their numbers, like 1, 3 and 4." value={fixes} onChange={e => setFixes(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={!fixes.trim() || !!busy} onClick={applyFixes}>Apply fixes to the script</button>
                  <button className="btn" disabled={!!busy || st('editor').status === 'approved'} onClick={() => approve(stage)}>Continue without changes</button>
                </div>
              </div>
            )}

            {busy !== stage.id && out && stage.kind !== 'editor' && stage.kind !== 'json' && (
              <div className="mt-6 space-y-3 border-t border-rule pt-4">
                <label className="label" htmlFor="fb">Notes for a revision</label>
                <textarea id="fb" className="field h-24" placeholder={stage.kind === 'script' ? 'General notes. Click any line above to note that line.' : 'What should change?'} value={feedback} onChange={e => setFeedback(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button className="btn" disabled={(!feedback.trim() && !m.notes.length) || !!busy} onClick={() => revise(stage)}>
                    Revise{m.notes.length ? ` with ${m.notes.length} line note${m.notes.length > 1 ? 's' : ''}` : ''}
                  </button>
                  <button className="btn-primary" disabled={!!busy || st(stage.id).status === 'approved'} onClick={() => approve(stage)}>
                    {st(stage.id).status === 'approved' ? 'Approved' : 'Approve and continue'}
                  </button>
                </div>
              </div>
            )}
            {busy !== stage.id && out && stage.kind === 'json' && m.parts && st(stage.id).status !== 'approved' && (
              <button className="btn-primary mt-4" onClick={() => approve(stage)}>Approve</button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
