import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getModule, saveModule } from '../lib/store.js';
import { addRuleToKit, loadKit, systemPrompt } from '../lib/kit.js';
import { callClaude } from '../lib/claude.js';
import { EXAMPLE_FIELDS, EXAMPLE_OBJECTIVES, SEED_FIELDS, composeSeed, missingRequired, seedFieldsOf } from '../lib/seed.js';
import { parsePerformance } from '../lib/script.js';
import { inAudio, normalizeObjective, pathwayBlock, planParts } from '../lib/pathways.js';
import { parseSeedTemplate, templatePrompt } from '../lib/seedTemplate.js';
import { dropLedgerRow, editLedgerRow, parseLedger, parseLedgerRows } from '../lib/claims.js';
import { readFileText } from '../lib/download.js';
import Markdown from '../components/Markdown.jsx';
import ScriptReview from '../components/ScriptReview.jsx';
import PathwayEditor from '../components/PathwayEditor.jsx';
import SectionReview from '../components/SectionReview.jsx';
import FixReview from '../components/FixReview.jsx';
import { splitFixItems, splitReport } from '../lib/sections.js';
import LedgerReview from '../components/LedgerReview.jsx';

const Spinner = () => <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />;

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
  const [suggestingId, setSuggestingId] = useState(null);
  const [readingObjectives, setReadingObjectives] = useState(false);
  const [seedTab, setSeedTab] = useState('guided');
  const [pasted, setPasted] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [copied, setCopied] = useState(false);
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
    if (!(cur().objectives || []).some(inAudio) && !confirm('No objectives are in the pathway table yet, so the episode plan will have nothing to build from. Continue anyway?')) return;
    saveModule(cur()); setActive('ledger');
  };
  const loadExample = () => {
    const hasText = Object.values(seedFieldsOf(cur())).some(v => v && v.trim());
    if (hasText && !confirm('Replace what is in the seed fields with the example?')) return;
    update({ seedFields: { ...EXAMPLE_FIELDS }, seed: composeSeed(EXAMPLE_FIELDS), objectives: EXAMPLE_OBJECTIVES.map(o => ({ ...o })) });
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
        const content = `${seedBlock(mod)}\n\n${pathwayBlock(mod.objectives)}\n\n## Script to review\n\n${mod.currentScript}\n\n${prompt}`;
        reply = await callClaude({ system, messages: [{ role: 'user', content }], onText: setLive, signal: abort.current.signal });
        await update({ stages: { ...cur().stages, editor: { status: 'ready', output: reply } }, itemState: { ...(cur().itemState || {}), editor: {} } });
        return;
      }
      // "Run again" replaces the stage's earlier exchange (and rebuilds the seed if it is the first one);
      // a revision (userText) continues the conversation.
      const start = userText ? mod.thread.length : (st(stage.id).threadStart ?? mod.thread.length);
      const base = mod.thread.slice(0, start);
      const withTable = stage.id === 'plan' && !userText ? `${pathwayBlock(mod.objectives) || '(No pathway table has been entered.)'}\n\n---\n\n${prompt}` : prompt;
      const content = base.length === 0 ? `${seedBlock(mod)}\n\n---\n\n${withTable}` : withTable;
      const thread = [...base, { role: 'user', content }];
      reply = await callClaude({ system, messages: thread, onText: setLive, signal: abort.current.signal });
      const patch = {
        thread: [...thread, { role: 'assistant', content: reply }],
        stages: { ...cur().stages, [stage.id]: { status: 'ready', output: reply, threadStart: start } },
        itemState: { ...(cur().itemState || {}), [stage.id]: {} },
      };
      if (stage.id === 'ledger') {
        // A new ledger invalidates per-claim decisions, except ones still waiting on an SME.
        patch.claimMeta = Object.fromEntries(Object.entries(cur().claimMeta || {})
          .filter(([, v]) => userText && (v.decision === 'own' || v.decision === 'sme'))
          .map(([id, v]) => [id, { decision: v.decision, note: v.note }]));
      }
      if (stage.kind === 'script') patch.currentScript = reply;
      if (stage.kind === 'json') {
        try { patch.parts = parsePerformance(reply); }
        catch (e) { setError(`Couldn't read the render data: ${e.message}. Run the stage again.`); }
      }
      await update(patch);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally { setBusy(null); setLive(''); }
  }

  const approve = stage => {
    if (stage.id === 'ledger') {
      const open = parseLedgerRows(st('ledger').output).filter(r => r.flag && !(cur().claimMeta || {})[r.id]?.decision).length;
      if (open && !confirm(`${open} flagged claim${open > 1 ? 's have' : ' has'} no decision yet. Approve anyway?`)) return;
    }
    return update({ stages: { ...cur().stages, [stage.id]: { ...st(stage.id), status: 'approved' } } });
  };
  const nextOf = stage => { const i = stages.findIndex(s => s.id === stage.id); return stages[i + 1]; };
  const runNext = stage => { const nx = nextOf(stage); if (!nx) return; setActive(nx.id); if (!st(nx.id).output) run(nx); };
  const skip = stage => update({ stages: { ...cur().stages, [stage.id]: { status: 'skipped', output: '' } } });

  function revise(stage) {
    const claimNotes = stage.id === 'ledger'
      ? Object.entries(claimMeta).filter(([, v]) => v.note && v.decision !== 'sme' && v.decision !== 'drop').map(([id, v]) => `${id}: ${v.note}`).join('\n')
      : '';
    const secNotes = Object.entries(itemState[stage.id] || {}).filter(([, v]) => v.note?.trim()).map(([k, v]) => `${k.replace(/^\d+:/, '')}: ${v.note.trim()}`).join('\n');
    const lines = m.notes.map((n, i) => `${i + 1}. In ${n.asset || 'the script'}, ${n.speaker}: "${n.text}"\n   Note: ${n.note}${n.better ? `\n   Better: ${n.better}` : ''}`).join('\n');
    const msg = `Revise the ${stage.title.toLowerCase()} with these notes. Apply each note wherever the same pattern appears, not only on the quoted line. Then output the full revised version in the same format.\n\n${feedback ? `General notes:\n${feedback}\n\n` : ''}${secNotes ? `Section notes:\n${secNotes}\n\n` : ''}${lines ? `Line notes:\n${lines}\n\n` : ''}${claimNotes ? `Claim notes:\n${claimNotes}\n\nKeep the flag text of claims already resolved or sent to the SME exactly as it is.` : ''}`;
    setFeedback('');
    update({ notes: [] }).then(() => run(stage, msg));
  }

  const itemState = m.itemState || {};
  const setItem = (sid, key, patch) => update({ itemState: { ...(cur().itemState || {}), [sid]: { ...((cur().itemState || {})[sid] || {}), [key]: patch } } });
  const claimMeta = m.claimMeta || {};
  const pendingClaims = Object.values(claimMeta).filter(v => v.decision === 'own' || v.decision === 'sme').length;
  const claimNoteCount = Object.values(claimMeta).filter(v => v.note && v.decision !== 'sme' && v.decision !== 'drop').length;

  // Decisions on a single claim. Wording changes edit the ledger table directly (and the ledger reply in the
  // conversation, so later stages read the same text); nothing is sent to Claude.
  function decide(id, action, value) {
    const c = cur();
    const ledger = c.stages.ledger;
    const row = parseLedgerRows(ledger.output).find(r => r.id === id);
    if (!row && action !== 'reopen') return;
    const prev = (c.claimMeta || {})[id] || {};
    let text = ledger.output;
    let entry = { ...prev };
    if (action === 'accept') entry = { ...prev, decision: 'accept' };
    else if (action === 'suggestion') {
      text = editLedgerRow(text, id, { 1: value, 3: `Resolved with suggested fix (was: ${row.flag})` });
      entry = { ...prev, decision: 'suggestion' };
    } else if (action === 'own') {
      text = editLedgerRow(text, id, { 1: value, 3: `LXD wording, pending SME (was: ${row.flag})` });
      entry = { ...prev, decision: 'own' };
    } else if (action === 'sme') {
      text = editLedgerRow(text, id, { 3: `SME to confirm: ${value}` });
      entry = { ...prev, decision: 'sme', note: value };
    } else if (action === 'confirmed') {
      text = editLedgerRow(text, id, { 3: 'SME confirmed' });
      entry = { ...prev, decision: 'confirmed' };
    } else if (action === 'drop') {
      text = dropLedgerRow(text, id);
      entry = { decision: 'drop', was: row.claim };
    } else if (action === 'reopen') {
      const { decision, ...rest } = prev; entry = rest;
    }
    const claimMetaNext = { ...(c.claimMeta || {}), [id]: entry };
    const thread = [...c.thread];
    const i = (ledger.threadStart ?? -2) + 1;
    if (thread[i]?.role === 'assistant') thread[i] = { ...thread[i], content: text };
    const pending = Object.values(claimMetaNext).filter(v => v.decision === 'own' || v.decision === 'sme').length;
    return update({
      thread, claimMeta: claimMetaNext,
      stages: { ...c.stages, ledger: { ...ledger, output: text } },
      ...(pending ? { ledgerSigned: false } : {}),
    });
  }
  const noteClaim = (id, note) => update({ claimMeta: { ...(cur().claimMeta || {}), [id]: { ...(cur().claimMeta || {})[id], note } } });

  async function suggestFix(id) {
    setError(''); setSuggestingId(id);
    try {
      const c = cur();
      const ledger = c.stages.ledger;
      const thread = c.thread.slice(0, (ledger.threadStart ?? 0) + 2);
      const ask = `For ${id} only: propose a replacement claim in one plain sentence that the source content fully supports, or start with "needs SME: " and give the question an SME must answer. Never invent a fact. Reply with that one line and nothing else.`;
      const reply = (await callClaude({ system: systemPrompt(loadKit()), messages: [...thread, { role: 'user', content: ask }] })).trim().replace(/^["“]|["”]$/g, '');
      await update({ claimMeta: { ...(cur().claimMeta || {}), [id]: { ...(cur().claimMeta || {})[id], suggestion: reply } } });
    } catch (e) { setError(e.message); }
    finally { setSuggestingId(null); }
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(templatePrompt()); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setImportMsg('Could not copy automatically. Open "Show the prompt" and copy it by hand.'); }
  }
  function importTemplate() {
    const r = parseSeedTemplate(pasted);
    if (!r.found.length) { setImportMsg(r.notes.join(' ')); return; }
    const hasText = Object.values(seedFieldsOf(cur())).some(v => v && v.trim()) || (cur().objectives || []).length;
    if (hasText && !confirm('Replace what is in the seed fields and the pathway table with this document?')) return;
    const seedFields = { ...seedFieldsOf(cur()), ...r.fields };
    update({ seedFields, seed: composeSeed(seedFields), ...(r.objectives.length ? { objectives: r.objectives } : {}) });
    setImportMsg([
      `Imported ${r.found.length} section${r.found.length > 1 ? 's' : ''}${r.objectives.length ? `, including ${r.objectives.length} objective${r.objectives.length > 1 ? 's' : ''} in the pathway table` : ''}.`,
      r.missing.length ? `Still empty: ${r.missing.join(', ')}.` : '',
      ...r.notes,
      'Check them in the Guided tab.',
    ].filter(Boolean).join(' '));
    setPasted('');
  }

  async function suggestObjectives() {
    const c = cur();
    if ((c.objectives || []).length && !confirm('Replace the objectives in the table with the ones read from the seed and source files?')) return;
    setError(''); setReadingObjectives(true);
    try {
      const sources = c.sources.map(s => `### ${s.name}\n\n${s.text}`).join('\n\n');
      const ask = `Extract this course's learning objectives as a JSON array. Each item has:
- "id": the ID the source uses (K1, F2, D1...). If it has none, number them K1, K2... for Know, F1... for Feel and D1... for Do, in order.
- "objective": the objective in one sentence.
- "type": Know, Feel or Do.
- "subscale": Know is Remember or Observe; Feel is Believe, Value or Perceive; Do is Activate or Apply.
- "policy": Gate, Remediate, Ask or Never skipped, as the source states it. If it doesn't, use Gate for Know and Do, and Remediate for Feel.
- "lock" (Know only): "locked" if the source says it is compliance-locked or can't test out; "fallback" if it says test-out is allowed today but a lock may be confirmed; otherwise "open".
Don't invent objectives. Reply with the JSON array only.`;
      const reply = await callClaude({
        system: 'You read training course seeds and scripts and extract their learning objectives. You reply with JSON only.',
        messages: [{ role: 'user', content: `${c.seed || ''}\n\n${sources}\n\n---\n\n${ask}` }],
      });
      const list = JSON.parse(reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1));
      const objectives = list.map(normalizeObjective);
      await update({ objectives });
    } catch (e) { setError(`Couldn't read objectives: ${e.message}. Add them by hand, or try again.`); }
    finally { setReadingObjectives(false); }
  }

  // Chapter titles: edit the heading in the stage's reply, the conversation copy later stages read, and any notes on it.
  function renameHeading(stageId, oldText, newText) {
    const c = cur();
    const s = c.stages[stageId];
    if (!s?.output || !newText.trim() || newText === oldText) return;
    const lines = s.output.split('\n');
    const i = lines.findIndex(l => l.match(/^#{1,3}\s+(.+)/)?.[1].trim() === oldText);
    if (i < 0) return;
    lines[i] = lines[i].replace(/^(#{1,3}\s+).*/, `$1${newText.trim()}`);
    const output = lines.join('\n');
    const thread = [...c.thread];
    const ti = (s.threadStart ?? -2) + 1;
    if (thread[ti]?.role === 'assistant') thread[ti] = { ...thread[ti], content: output };
    return update({
      thread,
      stages: { ...c.stages, [stageId]: { ...s, output } },
      ...(c.currentScript === s.output ? { currentScript: output } : {}),
      notes: c.notes.map(n => (n.asset === oldText ? { ...n, asset: newText.trim() } : n)),
    });
  }

  async function applyFixes(text) {
    const draft = stages.find(s => s.id === 'validity');
    await run(draft, `Apply these fixes from the editor review to the latest script. Change nothing else. Then output the full revised script in the same format.\n\n${text}`);
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
  const editorItems = stage?.kind === 'editor' && out ? splitFixItems(out)?.items || [] : [];
  const chosen = editorItems.filter(it => itemState.editor?.[it.n]?.decision === 'apply');
  const applyCount = chosen.length;
  const fixText = [
    ...chosen.map(it => `${it.n}. ${it.text}${itemState.editor[it.n].edit?.trim() ? `\n   Change to the fix: ${itemState.editor[it.n].edit.trim()}` : ''}`),
    fixes.trim(),
  ].filter(Boolean).join('\n\n');
  const sectionNoteCount = stage ? Object.values(itemState[stage.id] || {}).filter(v => v.note?.trim()).length : 0;
  const ledgerRows = stage?.id === 'ledger' && out ? parseLedgerRows(out) : [];

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
          <li><Link to={`/m/${m.id}/impact`} className="mt-3 block rounded-md border border-rule px-3 py-2 text-sm text-muted hover:text-ink">Claim impact</Link></li>
          <li><Link to={`/m/${m.id}/render`} className={`mt-1 block rounded-md border px-3 py-2 text-sm ${m.parts ? 'border-onair text-onair' : 'border-rule text-muted hover:text-ink'}`}>9. Render audio</Link></li>
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
            <div role="tablist" className="flex gap-1 border-b border-rule">
              {[['guided', 'Guided'], ['template', 'Template']].map(([k, label]) => (
                <button key={k} role="tab" aria-selected={seedTab === k} onClick={() => setSeedTab(k)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${seedTab === k ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{label}</button>
              ))}
            </div>

            {seedTab === 'template' && (
              <div className="space-y-5">
                <p className="text-sm text-muted">Skip the form. Give an AI tool this prompt along with your source files, and it writes one document with every seed section. Paste that document here and the form fills itself in.</p>
                <div className="space-y-2">
                  <div className="label">1. Copy the prompt</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="btn-primary" onClick={copyPrompt}>{copied ? 'Copied' : 'Copy the prompt'}</button>
                    <span className="text-xs text-muted">Paste it into your AI tool and attach your source files (course script, deck, SOPs).</span>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer">Show the prompt</summary>
                    <textarea readOnly aria-label="Seed prompt" className="field mt-2 h-64 font-mono text-xs" value={templatePrompt()} onFocus={e => e.target.select()} />
                  </details>
                </div>
                <div className="space-y-2">
                  <label className="label" htmlFor="pasted">2. Paste what it writes</label>
                  <textarea id="pasted" className="field h-56 font-mono text-xs" placeholder={'## Audience and sector\n...\n\n## Pathway table\nK1 | ... | Know | Remember | Gate | open'} value={pasted} onChange={e => setPasted(e.target.value)} />
                  <div className="flex items-center gap-3">
                    <button className="btn-primary" disabled={!pasted.trim()} onClick={importTemplate}>Fill in the seed</button>
                    {importMsg && <span role="status" className="text-sm text-muted">{importMsg}</span>}
                  </div>
                </div>
              </div>
            )}

            {seedTab === 'guided' && <>
            {SEED_FIELDS.map(f => (
              <div key={f.id}>
                <label className="label" htmlFor={`seed-${f.id}`}>{f.label}{f.required && <span className="text-onair"> *</span>}</label>
                <p className="mb-1 text-xs text-muted">{f.help}</p>
                <textarea id={`seed-${f.id}`} className="field font-script" rows={f.rows} placeholder={f.placeholder}
                  value={seedFieldsOf(m)[f.id] || ''}
                  onChange={e => setSeedField(f.id, e.target.value)} onBlur={() => saveModule(cur())} />
              </div>
            ))}
            <PathwayEditor objectives={m.objectives || []} suggesting={readingObjectives}
              onChange={objectives => update({ objectives })} onSuggest={suggestObjectives} />
            </>}
            <div>
              <label className="label" htmlFor="src">Source files (text, Markdown or PDF)</label>
              <input id="src" type="file" multiple accept=".txt,.md,.csv,.json,.pdf" onChange={addSources} className="text-sm" />
              <ul className="mt-2 space-y-1 text-sm">
                {m.sources.map((s, i) => (
                  <li key={i} className="flex justify-between"><span>{s.name}</span>
                    <button className="underline" onClick={() => update({ sources: m.sources.filter((_, j) => j !== i) })}>Remove</button></li>
                ))}
              </ul>
            </div>
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
              {busy === stage.id && (
                <div role="status">
                  <p className="mb-2 flex items-center gap-2 text-sm text-muted"><Spinner />Working…</p>
                  <div className="whitespace-pre-wrap font-script text-[15px] leading-relaxed text-muted">{live}</div>
                </div>
              )}
              {busy && busy !== stage.id && (
                <div role="status" className="mb-4 rounded-md border border-rule bg-paper p-3">
                  <p className="flex items-center gap-2 text-sm"><Spinner />Working on the {stages.find(s => s.id === busy)?.title.toLowerCase()}… This can take a minute.</p>
                  {live && <div className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-script text-sm text-muted">{live}</div>}
                </div>
              )}
              {busy !== stage.id && out && stage.kind === 'script' && (() => {
                const { report, script } = stage.id === 'validity' ? splitReport(out) : { report: '', script: out };
                return (
                  <div className="space-y-6">
                    {report && <SectionReview text={report} state={itemState[stage.id]} disabled={!!busy} onChange={(k, v) => setItem(stage.id, k, v)} />}
                    <ScriptReview text={script} notes={m.notes} disabled={!!busy} onRenameHeading={(o, n) => renameHeading(stage.id, o, n)}
                      onAddNote={n => update({ notes: [...m.notes, n] })}
                      onRemoveNote={key => update({ notes: m.notes.filter(n => n.key !== key) })}
                      onSaveRule={saveRule} />
                  </div>
                );
              })()}
              {busy !== stage.id && out && stage.kind === 'json' && (
                m.parts
                  ? <div className="space-y-2 text-sm">
                      <p>Render data is ready: {m.parts.parts.length} parts, {m.parts.assembly.length} listens. <Link className="underline" to={`/m/${m.id}/render`}>Go to rendering</Link>.</p>
                      {(() => {
                        const want = planParts(m.objectives || []).map(p => p.id), got = m.parts.parts.map(p => p.id);
                        const missing = want.filter(x => !got.includes(x)), extra = want.length ? got.filter(x => !want.includes(x)) : [];
                        return (missing.length || extra.length) ? <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">Doesn't match the pathway table.{missing.length ? ` Missing: ${missing.join(', ')}.` : ''}{extra.length ? ` Not in the table: ${extra.join(', ')}.` : ''} Run the stage again.</p> : null;
                      })()}
                    </div>
                  : <pre className="max-h-96 overflow-auto rounded bg-paper p-3 text-xs">{out}</pre>
              )}
              {busy !== stage.id && out && stage.id === 'ledger' && ledgerRows.length > 0 && (
                <LedgerReview rows={ledgerRows} meta={claimMeta} suggestingId={suggestingId} disabled={!!busy || !!suggestingId}
                  onAction={decide} onSuggest={suggestFix} onNote={noteClaim} />
              )}
              {busy !== stage.id && out && stage.id === 'ledger' && (
                <label className="mt-6 flex items-start gap-2 rounded-md border border-rule bg-paper p-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={m.ledgerSigned} disabled={pendingClaims > 0} onChange={e => update({ ledgerSigned: e.target.checked })} />
                  <span>The SME has signed this claims ledger. Until this is checked, audio files are marked DRAFT.
                    {pendingClaims > 0 && <span className="text-amber-900"> {pendingClaims} claim{pendingClaims > 1 ? 's are' : ' is'} waiting on the SME.</span>}
                    {m.ledgerSigned && <span className="text-muted"> Editing the ledger after signing means it needs signing again.</span>}</span>
                </label>
              )}
              {busy !== stage.id && out && stage.kind === 'editor' && (
                <FixReview text={out} state={itemState.editor} disabled={!!busy} onChange={(n, v) => setItem('editor', n, v)} />
              )}
              {busy !== stage.id && out && stage.kind === 'doc' && !(stage.id === 'ledger' && ledgerRows.length > 0) && (
                <SectionReview text={out} state={itemState[stage.id]} disabled={!!busy} onChange={(k, v) => setItem(stage.id, k, v)} />
              )}
            </div>

            {busy !== stage.id && out && stage.kind === 'editor' && (
              <div className="mt-6 space-y-2 border-t border-rule pt-4">
                <label className="label" htmlFor="fixes">Extra notes (optional)</label>
                <textarea id="fixes" className="field h-20" placeholder="Anything else to change, or paste fixes from elsewhere." value={fixes} onChange={e => setFixes(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={!fixText.trim() || !!busy} onClick={() => applyFixes(fixText)}>{busy ? 'Applying…' : `Apply ${applyCount ? `${applyCount} fix${applyCount > 1 ? 'es' : ''}` : 'fixes'} to the script`}</button>
                  <button className="btn" disabled={!!busy || st('editor').status === 'approved'} onClick={() => approve(stage)}>Continue without changes</button>
                </div>
                {st('editor').status === 'approved' && !busy && <p className="text-sm text-muted">Done. <button className="underline" onClick={() => setActive('validity')}>See the corrected script in the Validity pass</button>.</p>}
                {st('editor').status === 'approved' && !busy && nextOf(stage) && <button className="btn-primary" onClick={() => runNext(stage)}>{st(nextOf(stage).id).output ? `Go to ${nextOf(stage).title}` : `Run ${nextOf(stage).title}`} →</button>}
              </div>
            )}

            {busy !== stage.id && out && stage.kind !== 'editor' && stage.kind !== 'json' && (
              <div className="mt-6 space-y-3 border-t border-rule pt-4">
                <label className="label" htmlFor="fb">Notes for a revision</label>
                <textarea id="fb" className="field h-24" placeholder={stage.kind === 'script' ? 'General notes. Click any line above to note that line.' : 'What should change?'} value={feedback} onChange={e => setFeedback(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button className="btn" disabled={(!feedback.trim() && !m.notes.length && !claimNoteCount && !sectionNoteCount) || !!busy} onClick={() => revise(stage)}>
                    Revise{m.notes.length ? ` with ${m.notes.length} line note${m.notes.length > 1 ? 's' : ''}` : sectionNoteCount ? ` with ${sectionNoteCount} section note${sectionNoteCount > 1 ? 's' : ''}` : claimNoteCount ? ` with ${claimNoteCount} claim note${claimNoteCount > 1 ? 's' : ''}` : ''}
                  </button>
                  {st(stage.id).status === 'approved' && nextOf(stage)
                    ? <button className="btn-primary" disabled={!!busy} onClick={() => runNext(stage)}>
                        {st(nextOf(stage).id).output ? `Go to ${nextOf(stage).title}` : `Run ${nextOf(stage).title}`} →
                      </button>
                    : <button className="btn-primary" disabled={!!busy || st(stage.id).status === 'approved'} onClick={() => approve(stage)}>
                        {st(stage.id).status === 'approved' ? 'Approved' : 'Approve and continue'}
                      </button>}
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
