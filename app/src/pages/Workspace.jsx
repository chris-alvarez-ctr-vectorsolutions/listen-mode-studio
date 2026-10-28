import { useEffect, useRef, useState, Fragment } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { deleteModule, deleteModuleAudio, getModule, listModules, loadSettings, moveModuleAudio, saveModule } from '../lib/store.js';
import { addRuleToKit, fillStagePrompt, loadKit, systemPrompt } from '../lib/kit.js';
import { callClaude } from '../lib/claude.js';
import { mechanicalReport } from '../lib/lint.js';
import { applyEdits, parseEdits, patchRequest, rewriteRequest } from '../lib/patches.js';
import { SEED_FIELDS, composeSeed, missingRequired, seedFieldsOf } from '../lib/seed.js';
import { parsePerformance, scriptOnly, stripBannedTags } from '../lib/script.js';
import { applySeams, parseSeams, seamBlock } from '../lib/seams.js';
import { canMakeVariant, hasOwnRun, makeVariant, moveRunToVersion, resyncVariant, variantBehind, versionLabel, versionName } from '../lib/variants.js';
import SeamsResult from '../components/SeamsResult.jsx';
import { inAudio, normalizeObjective, pathwayBlock, planParts } from '../lib/pathways.js';
import { parseSeedTemplate, templatePrompt } from '../lib/seedTemplate.js';
import { buildImpact, dropLedgerRow, editLedgerRow, parseLedger, parseLedgerRows } from '../lib/claims.js';
import { readFileText } from '../lib/download.js';
import Markdown from '../components/Markdown.jsx';
import ScriptReview from '../components/ScriptReview.jsx';
import PathwayEditor from '../components/PathwayEditor.jsx';
import SectionReview from '../components/SectionReview.jsx';
import FixReview from '../components/FixReview.jsx';
import EditorResult from '../components/EditorResult.jsx';
import PerformanceResult from '../components/PerformanceResult.jsx';
import { splitFixItems, splitReport } from '../lib/sections.js';
import LedgerReview from '../components/LedgerReview.jsx';
import SetupCard from '../components/SetupCard.jsx';
import { freshSeed, seedBlock, withSignedNote } from '../lib/seedMessage.js';
import { formatDuration } from '../lib/runLog.js';
import { notifyWhenAway } from '../lib/tabTitle.js';
import { audioStale, staleStages, stampFor } from '../lib/staleness.js';
import StageGuide from '../components/StageGuide.jsx';
import { resolveSetup } from '../lib/definitions.js';
const hostNames = setup => resolveSetup(setup).conversation.speakers.map(x => x.name);

// Elapsed time and words so far, so a long generation can be told apart from a dead one.
function Working({ since, live, note, status, sent, label = 'Working…' }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.round((Date.now() - since) / 1000));
  const words = live ? live.trim().split(/\s+/).length : 0;
  // The line itself stays short. What is going on, when it isn't obvious, goes in a small note beneath it.
  const aside = words ? ''
    : status?.thinking ? `The model is thinking before it writes (${status.thinking.toLocaleString()} characters so far). Nothing shows until it starts.`
    : status?.silentThinking ? 'The model is thinking before it writes. It doesn\'t show its thinking, so nothing appears until it starts. This can take a few minutes on a long draft.'
    : status?.connected ? `Connected, waiting for text${status.events ? ` (received ${Object.entries(status.counts).map(([k, n]) => `${k} x${n}`).join(', ')})` : ''}.` : '';
  return (
    <div className="mb-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-2"><Spinner />{label}</span>
        <span>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
        {sent > 0 && <span>sent about {sent.toLocaleString()} tokens</span>}
        <span>{words ? `${words.toLocaleString()} words so far` : 'no text yet'}</span>
      </p>
      {aside && <p className="mt-1 max-w-prose text-xs italic text-muted">{aside}</p>}
      {note && <p className="mt-1 max-w-prose text-xs text-amber-800">{note}</p>}
    </div>
  );
}

const Spinner = ({ light = false }) => <span aria-hidden="true" className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${light ? 'border-white' : 'border-ink'}`} />;


export default function Workspace() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [kit, setKit] = useState(loadKit);
  // Where you are lives in the address (#/m/<id>?stage=beats), so a refresh or a shared link keeps the spot.
  const [params, setParams] = useSearchParams();
  const setParam = (key, value, replace = false) => setParams(p => {
    const n = new URLSearchParams(p);
    if (value == null || value === false) n.delete(key); else n.set(key, value === true ? '1' : value);
    return n;
  }, { replace });
  const setActive = id => setParam('stage', id);
  const [busy, setBusy] = useState(null);
  const [live, setLive] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(null);
  const [sent, setSent] = useState(0);
  const [applying, setApplying] = useState(false);   // the editor's fixes are being written into the script
  const [moreOpen, setMoreOpen] = useState(false);     // reopened to apply fixes that were left over
  const busySince = useRef(0);
  const nameSaved = useRef('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [fixes, setFixes] = useState('');
  const [suggestingId, setSuggestingId] = useState(null);
  const [readingObjectives, setReadingObjectives] = useState(false);
  const [pasted, setPasted] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [imported, setImported] = useState(false);
  const [importing, setImporting] = useState(false);   // the short "filling in" pause between pressing the button and the details appearing
  const [importInfo, setImportInfo] = useState(null);
  // Step 2 of the seed stays folded away unless the details are entered by hand or reviewed.
  const detailsOpen = params.get('details') === '1';
  const setDetailsOpen = v => setParam('details', typeof v === 'function' ? v(detailsOpen) : v, true);
  const [reviseOpen, setReviseOpen] = useState(null);   // the stage whose revision notes are showing
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const abort = useRef(null);
  const mRef = useRef(null);
  const [family, setFamily] = useState([]);       // the base module and its variants, for the sidebar list
  const [nv, setNv] = useState(null);              // a new variant being set up: { name, setup }
  const [parent, setParent] = useState(null);   // a variant's base module: null while loading, false if it is gone
  const setBoth = next => { mRef.current = next; setM(next); };
  const cur = () => mRef.current;

  useEffect(() => { if (!m?.parentId) { setParent(null); return; } getModule(m.parentId).then(p => setParent(p || false)); }, [m?.parentId]);
  useEffect(() => { const base = m?.parentId || m?.id; if (!base) return; listModules().then(all => setFamily(all.filter(x => x.id === base || x.parentId === base))); }, [m?.id, m?.parentId, m?.updatedAt]);
  useEffect(() => { getModule(id).then(mod => { nameSaved.current = mod?.name || ''; setBoth(mod); }); }, [id]);
  const stageParam = params.get('stage');
  useEffect(() => { window.scrollTo({ top: 0 }); }, [stageParam]);   // a new step opens at its top
  if (!m) return <p className="text-muted">Loading…</p>;

  // The name can be edited freely while typing; on leaving the field it is trimmed, and a blank name goes back to the last good one.
  const commitName = () => {
    const name = (cur().name || '').trim() || nameSaved.current;
    nameSaved.current = name;
    const next = { ...cur(), name };
    setBoth(next); saveModule(next);
  };
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

  const seedFieldList = SEED_FIELDS;
  const filledLabels = seedFieldList.filter(f => (seedFieldsOf(m)[f.id] || '').trim()).map(f => f.label);
  const objectiveCount = (m.objectives || []).length;
  const missingNow = missingRequired(seedFieldsOf(m)).filter(() => !m.sources.length);
  const stages = kit.stages;
  // The module holds the inputs. A version (a child module) holds one listening experience. A module made before
  // versions existed keeps its own listening experience, so nothing it already did disappears.
  const isVersion = !!m.parentId;
  const ownRun = hasOwnRun(m);          // a module made before variants existed still holds its own script
  const showExperience = isVersion;     // the module itself is only the inputs
  const no = s => (isVersion ? s.n - 3 : s.n);      // a variant numbers its own steps from 1, at the beat sheets
  const progressOf = x => { const last = [...stages].reverse().find(t => t.id !== 'ledger' && t.id !== 'plan' && x.stages?.[t.id]?.output); return x.parts?.assembly?.length ? 'Script ready' : last ? `${last.title} done` : 'Not started'; };
  const update = async patch => { const next = { ...cur(), ...patch }; setBoth(next); await saveModule(next); return next; };
  const st = sid => cur().stages[sid] || { status: 'idle' };
  const unlocked = idx => idx === 0 || ['approved', 'skipped'].includes(st(stages[idx - 1].id).status);

  async function run(stage, userText, opts = {}) {
    // Each turn is timed and recorded on the module, and a finished one is flagged in the tab title if you are elsewhere.
    const startedAt = Date.now();
    const action = opts.applied ? 'apply fixes' : userText ? 'revision' : st(stage.id).output ? 'run again' : 'run';
    let sentTokens = 0, retries = 0, lastText = '', ok = false;
    const trackLive = t => { setLive(t); lastText = t; };
    const trackSent = v => { setSent(v); sentTokens = v; };
    const trackRetry = (n, why) => { retries = n; setNote(`The connection dropped (${why}) Retrying, attempt ${n + 1} of 3.`); };
    // What each call is told about its effort, and what comes back about it: the model that answered, the tokens it wrote
    // (thinking included) and how long it took to start writing, so effort can be tuned from the run log.
    const effort = loadSettings().effort?.[opts.patch ? 'patch' : stage.id];
    let model = null, outTokens = 0, firstAt = 0;
    const extras = { effort, onMeta: m => { model = m.model || model; outTokens += m.outputTokens || 0; }, onFirstText: () => { firstAt ||= Date.now(); } };
    setError(''); setBusy(stage.id); setLive(''); setNote(''); setStatus(null); setSent(0); busySince.current = Date.now();
    abort.current = new AbortController();
    try {
      const k = loadKit();
      setKit(k);
      const mod = cur();
      const system = systemPrompt(k, mod.setup, stage.id);
      // Source files are for building the ledger. If the ledger was skipped, the sources are all there is to read, so keep them.
      const withSources = stage.id === 'ledger' || st('ledger').status === 'skipped';
      const prompt = fillStagePrompt(userText || stage.prompt, mod.name, mod.setup);
      let reply;
      if (stage.kind === 'editor') {
        const ledger = mod.stages.ledger?.output;
        const ledgerBlock = ledger ? `## Claims ledger (decisions applied)\n\n${withSignedNote(ledger, mod.ledgerSigned)}\n\n` : '';
        const content = `${seedBlock(mod, withSources)}\n\n${pathwayBlock(mod.objectives)}\n\n${ledgerBlock}## Script to review\n\n${scriptOnly(mod.currentScript)}\n\n${prompt}`;
        reply = await callClaude({ system, messages: [{ role: 'user', content }], onText: trackLive, onStatus: setStatus, onSize: trackSent, signal: abort.current.signal, onRetry: trackRetry, ...extras });
        await update({ stages: { ...cur().stages, editor: { status: 'ready', output: reply, basedOn: stampFor(mod, 'editor') } }, itemState: { ...(cur().itemState || {}), editor: {} } });
        ok = true; return true;
      }
      if (opts.patch) {
        // Editor fixes as exact edits: the model returns small { part, find, replace } changes, and code checks and
        // makes them. Anything that can't be placed exactly goes back to the model as a rewrite of just those changes.
        const script = scriptOnly(mod.currentScript);
        let next = script, placed = 0, rewritten = 0, edits = null, failed;
        try { edits = parseEdits(await callClaude({ system, messages: [...mod.thread, { role: 'user', content: patchRequest(script, opts.patch) }], onText: trackLive, onStatus: setStatus, onSize: trackSent, signal: abort.current.signal, onRetry: trackRetry, ...extras })); }
        catch (e) { if (!(e instanceof SyntaxError || /"edits" list/.test(e.message))) throw e; }   // an unreadable reply falls back to a rewrite
        if (edits) { const r = applyEdits(script, edits); next = r.script; placed = r.applied.length; failed = r.failed; }
        else failed = [{ edit: { text: opts.patch }, reason: 'the reply could not be read' }];
        if (failed.length) {
          setLive(''); setNote(`${failed.length} edit${failed.length > 1 ? 's' : ''} couldn't be placed exactly. Writing ${failed.length > 1 ? 'those' : 'that one'} out in full.`);
          const redo = await callClaude({ system, messages: [...mod.thread, { role: 'user', content: rewriteRequest(next, failed) }], onText: trackLive, onStatus: setStatus, onSize: trackSent, signal: abort.current.signal, onRetry: trackRetry, ...extras });
          next = scriptOnly(redo); rewritten = failed.length;
        }
        await update({
          thread: [...mod.thread, { role: 'user', content: userText }, { role: 'assistant', content: next }],
          currentScript: next,
          stages: { ...cur().stages, editor: { ...st('editor'), status: 'approved', applied: { ...opts.applied(), script: next, placed, rewritten } } },
          itemState: { ...(cur().itemState || {}), editor: Object.fromEntries(Object.entries((cur().itemState || {}).editor || {}).map(([k, v]) => [k, v.decision === 'apply' ? { ...v, decision: 'done' } : v])) },
        });
        ok = true; return true;
      }
      // "Run again" replaces the stage's earlier exchange (and rebuilds the seed if it is the first one);
      // a revision (userText) continues the conversation.
      const start = userText ? mod.thread.length : (st(stage.id).threadStart ?? mod.thread.length);
      const base = mod.thread.slice(0, start);
      // The validity pass is handed the mechanical counts, done in code, so it doesn't tally them itself.
      const lintReport = stage.id === 'validity' && !userText ? mechanicalReport(scriptOnly(mod.stages.draft?.output || '')) : '';
      const withTable = stage.id === 'seams' && !userText ? `${seamBlock(mod.objectives)}\n\n---\n\n${prompt}` : stage.id === 'plan' && !userText ? `${pathwayBlock(mod.objectives) || '(No pathway table has been entered.)'}\n\n---\n\n${prompt}` : lintReport ? `${lintReport}\n\n---\n\n${prompt}` : prompt;
      const content = base.length === 0 ? `${seedBlock(mod, withSources)}\n\n---\n\n${withTable}` : withTable;
      const thread = [...base, { role: 'user', content }];
      let send = thread.length > 1 ? [{ ...thread[0], content: freshSeed(thread[0].content, mod, withSources) }, ...thread.slice(1)] : thread;
      // The ledger's own reply is the second message of the conversation. Later stages read it, so tell them it has been signed.
      if (stage.id !== 'ledger' && send[1]?.role === 'assistant') send = [send[0], { ...send[1], content: withSignedNote(send[1].content, mod.ledgerSigned) }, ...send.slice(2)];
      reply = await callClaude({ system, messages: send, onText: trackLive, onStatus: setStatus, onSize: trackSent, signal: abort.current.signal, onRetry: trackRetry, ...extras });
      const patch = opts.applied ? {
        // Fixes from the editor pass: the script changes, and the result is recorded on the editor stage. The validity
        // stage keeps what it produced. The fixes that went in are marked as applied.
        thread: [...thread, { role: 'assistant', content: reply }],
        stages: { ...cur().stages, editor: { ...st('editor'), status: 'approved', applied: { ...opts.applied(), script: reply } } },
        itemState: { ...(cur().itemState || {}), editor: Object.fromEntries(Object.entries((cur().itemState || {}).editor || {}).map(([k, v]) => [k, v.decision === 'apply' ? { ...v, decision: 'done' } : v])) },
      } : {
        thread: [...thread, { role: 'assistant', content: reply }],
        stages: { ...cur().stages, [stage.id]: { status: 'ready', output: reply, threadStart: start, basedOn: stampFor(mod, stage.id) } },
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
        try { const pf = parsePerformance(reply); patch.parts = { ...pf, parts: stripBannedTags(pf.parts, hostNames(mod.setup)) }; }
        catch (e) { setError(`Couldn't read the script with delivery directions: ${e.message}. Run the stage again.`); }
        // A new performance pass replaces the parts, so bridges written for the old ones are gone: run Seams again.
        const { seams: _gone, ...keep } = patch.stages;
        patch.stages = keep;
      }
      if (stage.kind === 'seams') {
        try { const sm = parseSeams(reply); const strip = list => list.map(x => ({ ...x, lines: stripBannedTags([{ segments: [{ lines: x.lines }] }], hostNames(mod.setup))[0].segments[0].lines })); patch.parts = applySeams(cur().parts, { bridges: strip(sm.bridges), closers: strip(sm.closers) }); }
        catch (e) { setError(`Couldn't read the seams: ${e.message}. Run the stage again.`); }
      }
      await update(patch);
      ok = true; return true;
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
      return false;
    } finally {
      setBusy(null); setLive(''); setNote(''); setStatus(null);
      const words = lastText.trim() ? lastText.trim().split(/\s+/).length : 0;
      await update({ runLog: [...(cur().runLog || []), { at: startedAt, stage: stage.id, action, ms: Date.now() - startedAt, sent: sentTokens, words, retries, ok, effort, model, outTokens, firstMs: firstAt ? firstAt - startedAt : 0 }] });
      const what = opts.applied ? 'Fixes applied' : `${stage.title}${action === 'revision' ? ' revised' : ' done'}`;
      notifyWhenAway(`${ok ? '✓' : '✕'} ${ok ? what : `${stage.title} failed`} · ${cur().name}`);
    }
  }

  const approve = stage => {
    if (stage.id === 'ledger') {
      const open = parseLedgerRows(st('ledger').output).filter(r => r.flag && !(cur().claimMeta || {})[r.id]?.decision).length;
      if (open && !confirm(`${open} flagged claim${open > 1 ? 's have' : ' has'} no decision yet. Approve anyway?`)) return;
    }
    return update({ stages: { ...cur().stages, [stage.id]: { ...st(stage.id), status: 'approved' } } });
  };
  const nextOf = stage => { const i = stages.findIndex(s => s.id === stage.id); return stages[i + 1]; };
  // On the module itself the outline is the last step. What follows it is making a variant, which is where the beat
  // sheets and everything after them happen.
  const endsInputs = stage => !isVersion && stage.id === 'plan';
  const runNext = stage => {
    if (endsInputs(stage)) { setActive('newversion'); return; }
    const nx = nextOf(stage); if (!nx) return; setActive(nx.id); if (!st(nx.id).output) run(nx);
  };
  // Approve this stage (if it isn't yet) and move on: to the next stage, running it if it has no output yet.
  const approveAndNext = async stage => {
    if (st(stage.id).status !== 'approved') { const done = approve(stage); if (!done) return; await done; }
    runNext(stage);
  };
  const moveRun = async () => {
    if (!confirm('Move this module\'s plan, script and audio into a new variant? The module keeps its seed and claims ledger.')) return;
    const { version, root } = moveRunToVersion(cur());
    await saveModule(version);
    await moveModuleAudio(cur().id, version.id);
    await update(root);
    navigate(`/m/${version.id}`);
  };
  const nextLabel = stage => { if (endsInputs(stage)) return 'Make a variant ›'; const nx = nextOf(stage); return nx ? `Next: ${no(nx)}. ${nx.title} ›` : ''; };
  const skip = stage => update({ stages: { ...cur().stages, [stage.id]: { status: 'skipped', output: '' } } });

  function revise(stage) {
    // Revising replaces this stage's output, and anything written after it was built from the old version.
    const later = stages.slice(stages.findIndex(x => x.id === stage.id) + 1).filter(x => st(x.id).output);
    const warn = later.length ? `\n\n${later.map(x => x.title).join(', ')} ${later.length > 1 ? 'were' : 'was'} built from the current version, so ${later.length > 1 ? 'they' : 'it'} will need to be run again afterward.` : '';
    if (!confirm(`Revise the ${stage.title.toLowerCase()} with your notes?\n\nThis replaces the current version with a new one.${warn}`)) return;
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
      const reply = (await callClaude({ system: systemPrompt(loadKit(), cur().setup), messages: [...thread, { role: 'user', content: ask }], effort: loadSettings().effort?.ledger })).trim().replace(/^["“]|["”]$/g, '');
      await update({ claimMeta: { ...(cur().claimMeta || {}), [id]: { ...(cur().claimMeta || {})[id], suggestion: reply } } });
    } catch (e) { setError(e.message); }
    finally { setSuggestingId(null); }
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(templatePrompt()); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setImportMsg('Could not copy automatically. Open "Show the prompt" and copy it by hand.'); }
  }
  // Pasting only puts the text in the box. Pressing the button reads it and fills in the details. The pause is
  // short and on purpose: the parse is instant, but with no pause the details seem to appear by themselves.
  async function fillFromPaste() {
    setImportMsg('');
    const r = parseSeedTemplate(pasted);
    if (!r.found.length) { setImportMsg(r.notes.join(' ') || 'That does not look like the document from step 1. Check that it has the headings, such as "## Audience and sector".'); return; }
    const hasText = Object.values(seedFieldsOf(cur())).some(v => v && v.trim()) || (cur().objectives || []).length;
    if (hasText && !confirm('Replace what is in the seed fields and the pathway table with this document?')) return;
    setImporting(true);
    await new Promise(res => setTimeout(res, 1400));
    const seedFields = { ...seedFieldsOf(cur()), ...r.fields };
    await update({ seedFields, seed: composeSeed(seedFields), ...(r.objectives.length ? { objectives: r.objectives } : {}) });
    setImportInfo({ sections: r.found, objectives: r.objectives.length, missing: r.missing, notes: r.notes });
    setImported(true); setImporting(false);
    setDetailsOpen(true);
    setTimeout(() => document.getElementById('seed-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }
  const pasteAnother = () => { setImported(false); setImportInfo(null); setImportMsg(''); setPasted(''); };

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
- "lock" (Know only): "always" if the source says it has no pre-check item and every learner hears it; "locked" if it says it is compliance-locked (it has a pre-check item but can't test out); "fallback" if it says test-out is allowed today but a lock may be confirmed; otherwise "open".
Don't invent objectives. Reply with the JSON array only.`;
      const reply = await callClaude({
        system: 'You read training course seeds and scripts and extract their learning objectives. You reply with JSON only.',
        messages: [{ role: 'user', content: `${c.seed || ''}\n\n${sources}\n\n---\n\n${ask}` }],
        effort: loadSettings().effort?.helper,
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
    const dec = n => cur().itemState?.editor?.[n]?.decision;
    const done = editorItems.filter(it => dec(it.n) === 'apply' || dec(it.n) === 'done').length;   // this run's fixes and any applied before
    const skipped = editorItems.filter(it => dec(it.n) === 'skip').length;
    const undecided = editorItems.length - done - skipped;
    setApplying(true);
    const ok = await run(draft, `Apply these fixes from the editor review to the latest script. Change nothing else. Then output the full revised script in the same format.\n\n${text}`,
      { patch: text, applied: () => ({ count: done, skipped, undecided, total: editorItems.length, at: Date.now() }) });
    setApplying(false);
    if (!ok) return;   // the run failed or was stopped: leave the stages and your choices as they were
    setFixes(''); setMoreOpen(false);
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

  // A stage that isn't open yet (or doesn't exist) in the address falls back to the seed.
  const requested = params.get('stage') || 'seed';
  const reqIdx = stages.findIndex(s => s.id === requested);
  const allowed = requested === 'seed' || (requested === 'newversion' && !isVersion)
    || (reqIdx >= 0 && unlocked(reqIdx) && !(isVersion && (requested === 'ledger' || requested === 'plan')) && !(!showExperience && reqIdx > 1));
  const active = allowed ? requested : 'seed';
  const stage = stages.find(s => s.id === active);
  const out = stage ? st(stage.id).output : '';
  const editorItems = stage?.kind === 'editor' && out ? splitFixItems(out)?.items || [] : [];
  const chosen = editorItems.filter(it => itemState.editor?.[it.n]?.decision === 'apply');
  const applyCount = chosen.length;
  // Once the editor's fixes are settled (applied, or moved past), step 7 shows the result and no longer asks to apply.
  const editorSettled = stage?.kind === 'editor' && st('editor').status === 'approved' && !moreOpen;
  const editorLeftover = editorItems.some(it => itemState.editor?.[it.n]?.decision !== 'done');
  const undecidedCount = editorItems.filter(it => !itemState.editor?.[it.n]?.decision).length;
  // Fixes you haven't decided on are left out. Say so before applying, so nothing is dropped by accident.
  const applyChosen = () => {
    if (undecidedCount && !confirm(`${undecidedCount} fix${undecidedCount > 1 ? 'es are' : ' is'} still undecided and will not be applied.\n\nApply the ${applyCount} you chose?`)) return;
    applyFixes(fixText);
  };
  const applyLabel = busy ? 'Applying…' : `Apply ${applyCount ? `${applyCount} fix${applyCount > 1 ? 'es' : ''}` : 'fixes'} to the script`;
  const fixText = [
    ...chosen.map(it => `${it.label}. ${it.group ? `(${it.group}) ` : ''}${it.text}${itemState.editor[it.n].edit?.trim() ? `\n   Change to the fix: ${itemState.editor[it.n].edit.trim()}` : ''}`),
    fixes.trim(),
  ].filter(Boolean).join('\n\n');
  const sectionNoteCount = stage ? Object.values(itemState[stage.id] || {}).filter(v => v.note?.trim()).length : 0;
  const ledgerRows = stage?.id === 'ledger' && out ? parseLedgerRows(out) : [];
  // Parts that were recorded before a claim they rest on changed. Only shown when there are some.
  const stale = staleStages(m);
  const audioOutdated = (m.parts?.parts || []).filter(p => m.timings?.[p.id] && audioStale(p, m.timings[p.id]) === true).length;
  const staleParts = m.parts?.parts?.length && m.stages.ledger?.output ? buildImpact(m).partRows.filter(p => p.stale.length) : [];

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside>
        {!isVersion && <Link to="/" className="text-sm text-muted hover:text-ink">All modules</Link>}
        {isVersion && parent && <p className="text-sm"><Link className="text-muted hover:text-ink" to={`/m/${parent.id}`}>← {parent.name}</Link></p>}
        {!isVersion && <h1 className="mt-1 text-xl font-semibold leading-snug">{m.name}</h1>}
        {!isVersion && m.description?.trim() && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{m.description}</p>}
        <ol className="mt-6 space-y-1">
          {!isVersion && (
            <>
              <li className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">Inputs and outline</li>
              <li><button className={`w-full rounded-md px-3 py-2 text-left text-sm ${active === 'seed' ? 'bg-ink text-white' : 'hover:bg-panel'}`} onClick={() => setActive('seed')}>1. Seed</button></li>
              {stages.slice(0, 2).map((s, i) => {
            const mark = applying && s.id === 'editor' ? 'applying…' : stale[s.id] ? '⟳ outdated' : status === 'approved' ? (s.id === 'validity' && st('editor').applied?.count ? '✓ edited' : '✓') : status === 'skipped' ? 'skipped' : status === 'ready' ? 'review' : '';
                return (
                  <li key={s.id}>
                    <button disabled={!unlocked(i)} className={`flex w-full justify-between rounded-md px-3 py-2 text-left text-sm disabled:opacity-40 ${active === s.id ? 'bg-ink text-white' : 'hover:bg-panel'}`} onClick={() => setActive(s.id)}>
                      <span>{no(s)}. {s.title}</span><span className="text-xs opacity-80">{mark}</span>
                    </button>
                  </li>
                );
              })}
              <li className="px-1 pb-1 pt-6 text-xs font-semibold uppercase tracking-wide text-muted">Variants</li>
              {family.filter(x => x.id !== m.id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(x => {
                const r = resolveSetup(x.setup);
                const behind = variantBehind(x, m);
                return (
                  <li key={x.id}>
                    <Link className="block rounded-md px-3 py-1.5 hover:bg-panel" to={`/m/${x.id}`}>
                      <span className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate">{r.industry?.name || 'Industry not chosen'}</span>
                        <span className={`shrink-0 text-xs ${behind ? 'text-amber-900' : 'text-muted'}`}>{behind ? '⚠ update' : progressOf(x)}</span></span>
                      <span className="block truncate text-xs text-muted">{[r.conversation?.name, r.role?.name].filter(Boolean).join(' · ')}</span>
                    </Link>
                  </li>
                );
              })}
              {ownRun && <li className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">This module still holds a script from before variants. <button className="underline" onClick={moveRun}>Move it into a variant</button></li>}
              <li>
                <button className={`w-full rounded-md px-3 py-1.5 text-left text-sm ${active === 'newversion' ? 'bg-ink text-white' : 'text-muted hover:bg-panel hover:text-ink'}`} onClick={() => { setNv(null); setActive('newversion'); }}>＋ New variant</button>
              </li>
            </>
          )}
          {isVersion && (
            <>
              <li className="pt-4"><button className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${active === 'seed' ? 'bg-ink text-white' : 'border border-rule bg-panel hover:border-onair'}`} onClick={() => setActive('seed')}>
                Basics
              </button></li>
            </>
          )}
          {showExperience && (
            <>
              <li className="px-1 pb-1 pt-8 text-xs font-semibold uppercase tracking-wide text-muted">Listening experience</li>
              {stages.map((s, i) => {
                if (isVersion && (s.id === 'ledger' || s.id === 'plan')) return null;   // borrowed from the module, not repeated here
                if (!isVersion && i === 0) return null;
                const mark = applying && s.id === 'editor' ? 'applying…' : stale[s.id] ? '⟳ outdated' : status === 'approved' ? (s.id === 'validity' && st('editor').applied?.count ? '✓ edited' : '✓') : status === 'skipped' ? 'skipped' : status === 'ready' ? 'review' : '';
                return (
                  <li key={s.id}>
                    <button disabled={!unlocked(i)} className={`flex w-full justify-between rounded-md px-3 py-2 text-left text-sm disabled:opacity-40 ${active === s.id ? 'bg-ink text-white' : 'hover:bg-panel'}`} onClick={() => setActive(s.id)}>
                      <span>{no(s)}. {s.title}</span><span className="text-xs opacity-80">{mark}</span>
                    </button>
                  </li>
                );
              })}
          {staleParts.length > 0 && (
            <li><Link to={`/m/${m.id}/impact`} className="mt-3 block rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              ⚠ {staleParts.length} recorded part{staleParts.length > 1 ? 's' : ''} out of date after a claim changed
            </Link></li>
          )}
          <li><Link to={`/m/${m.id}/render`} className={`mt-1 block rounded-md border px-3 py-2 text-sm ${m.parts ? 'border-onair text-onair' : 'border-rule text-muted hover:text-ink'}`}>{isVersion ? 7 : 10}. Render audio{audioOutdated > 0 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">⟳ outdated</span>}</Link></li>
            </>
          )}
          {(m.runLog || []).length > 0 && (
            <li><Link to={`/m/${m.id}/runs`} className="mt-3 block px-1 text-xs text-muted underline hover:text-ink">Run log · {formatDuration(m.runLog.reduce((n, r) => n + (r.ms || 0), 0))} over {m.runLog.length} run{m.runLog.length > 1 ? 's' : ''}</Link></li>
          )}
        </ol>
      </aside>

      <section className="min-w-0 rounded-lg border border-rule bg-panel p-6">
        {isVersion && parent === false && <p className="mb-4 rounded-md border border-rule bg-paper p-3 text-sm">The module this variant came from is gone. The inputs here are the copy it kept.</p>}
        {isVersion && parent && variantBehind(m, parent) && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <p><strong>The inputs changed.</strong> <Link className="underline" to={`/m/${parent.id}`}>{parent.name}</Link> has a different seed, pathway table or claims ledger than this variant was built from.</p>
            <p className="mt-2"><button className="btn" disabled={!!busy} onClick={async () => {
              if (!confirm('Take the current inputs? This clears this variant\'s plan, beats, script and audio, and keeps its name, note and show setup.')) return;
              await deleteModuleAudio(m.id);
              await update(resyncVariant(cur(), parent));
              setActive('seed');
            }}>Update this variant to the new inputs</button></p>
          </div>
        )}
        {error && <p role="alert" className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        {active === 'seed' && m.parentId && (
          <div className="space-y-6">
            <SetupCard title="Basics" hint="" setup={m.setup} onChange={setup => update({ setup, ...(parent ? { name: versionName(parent, setup) } : {}) })} />
            <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
              <button className="btn" disabled={!!busy} onClick={async () => {
                if (!confirm('Delete this variant and its audio? The module and its other variants are kept.')) return;
                await deleteModule(m.id);
                navigate(parent ? `/m/${parent.id}` : '/');
              }}>Delete this variant</button>
              <button className="btn-primary" onClick={() => setActive('plan')}>Next: {no(stages[1])}. {stages[1].title} ›</button>
            </div>
          </div>
        )}

        {active === 'newversion' && !isVersion && (() => {
          const v = nv || { setup: m.setup };
          const ready = canMakeVariant(m);
          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">New variant</h2>
                <p className="text-sm text-muted">Choose the show format and who it is for. The variant uses this module's seed, claims ledger and outline, and writes its own beat sheets for this audience.</p>
              </div>
              {!ready && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Approve the outline first (and settle the claims ledger before it), so a variant has solid inputs to build on.</p>}
              <SetupCard title="Basics" hint="" setup={v.setup} onChange={setup => setNv({ setup })} />
              <div className="flex justify-end border-t border-rule pt-4">
                <button className="btn-primary" disabled={!ready} onClick={async () => {
                  await saveModule(cur());
                  const created = await saveModule(makeVariant(cur(), v.setup));
                  setNv(null);
                  navigate(`/m/${created.id}?stage=beats`);
                }}>Create the variant ›</button>
              </div>
            </div>
          );
        })()}

        {active === 'seed' && !m.parentId && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Seed the module</h2>
              <p className="text-sm text-muted">Fill in what you know. Content claims matter most: the script can only say what is listed there or in an attached source file.</p>
            </div>
            <div>
              <label className="label" htmlFor="module-name">Module name</label>
              <input id="module-name" className="field" value={m.name}
                onChange={e => setBoth({ ...cur(), name: e.target.value })}
                onBlur={commitName}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
              <p className="mt-1 text-xs text-muted">Shown in the module list and used in the prompts. Stages you have already run keep the name they were written with.</p>
              <label className="label mt-4" htmlFor="module-note">Note</label>
              <textarea id="module-note" className="field" rows={2} placeholder="Where this module stands, who has it, what to pick up next…"
                value={m.description || ''}
                onChange={e => setBoth({ ...cur(), description: e.target.value })}
                onBlur={() => saveModule(cur())} />
              <p className="mt-1 text-xs text-muted">For you and anyone you hand the module to. It is saved with the module and its export, and is never sent to the AI.</p>
            </div>
            <section className="space-y-4 rounded-md border border-rule bg-paper p-4">
              <div>
                <h3 className="font-semibold">Step 1 · Fill in the details from your own AI chat</h3>
                <p className="text-sm text-muted">Optional. Use whichever AI tool you like, with your files attached there. It writes one document, and pasting that document here fills in the details in step 2. Or skip this and type the details yourself.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn-primary" onClick={copyPrompt}>{copied ? 'Copied' : 'Copy the prompt'}</button>
                <span className="text-xs text-muted">Paste it into your AI tool and attach your source files (course script, deck, SOPs) there. Do all the file work in that tool, not here.</span>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer">Show the prompt</summary>
                <textarea readOnly aria-label="Seed prompt" className="field mt-2 h-64 font-mono text-xs" value={templatePrompt()} onFocus={e => e.target.select()} />
              </details>
              {!imported ? (
                <div className="space-y-2">
                  <label className="label" htmlFor="pasted">Paste what your AI tool wrote</label>
                  <textarea id="pasted" className="field h-40 font-mono text-xs" readOnly={importing}
                    placeholder={'## Audience and sector\n...\n\n## Pathway table\nK1 | ... | Know | Remember | Gate | open'}
                    value={pasted} onChange={e => { setPasted(e.target.value); setImportMsg(''); }} />
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="btn-primary" disabled={!pasted.trim() || importing} onClick={fillFromPaste}>
                      {importing ? <><Spinner light />Filling in the details…</> : 'Fill in the details'}
                    </button>
                    {!pasted.trim() && !importing && <span className="text-xs text-muted">Paste the document, then press the button.</span>}
                    {importMsg && <span role="alert" className="max-w-prose text-sm text-amber-900">{importMsg}</span>}
                  </div>
                </div>
              ) : (
                <div role="status" className="rounded-md border border-dana bg-panel p-4">
                  <div className="font-medium text-dana">✓ The details are filled in</div>
                  <p className="mt-1 max-w-prose text-sm text-muted">
                    {(() => {
                      const named = (importInfo?.sections || []).filter(x => !(importInfo.objectives && /pathway/i.test(x)));
                      const table = importInfo?.objectives ? `the pathway table (${importInfo.objectives} objective${importInfo.objectives > 1 ? 's' : ''})` : '';
                      return [...named, table].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1') + '.';
                    })()}
                    {importInfo?.missing?.length > 0 && <span className="text-amber-900"> Still needed: {importInfo.missing.join(', ')}.</span>}
                    {importInfo?.notes?.length > 0 && <span> {importInfo.notes.join(' ')}</span>}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button className="btn" onClick={() => { setDetailsOpen(true); setTimeout(() => document.getElementById('seed-details')?.scrollIntoView({ behavior: 'smooth' }), 50); }}>Review the details</button>
                    <button className="text-sm underline" onClick={pasteAnother}>Paste a different document</button>
                  </div>
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer">Show what you pasted</summary>
                    <textarea readOnly aria-label="What you pasted" className="field mt-2 h-40 font-mono text-xs" value={pasted} />
                  </details>
                </div>
              )}
            </section>

            <section id="seed-details" className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Step 2 · {detailsOpen ? 'Check or enter the details' : 'The details'}</h3>
                  {!detailsOpen && (
                    <p className="text-sm text-muted">
                      {filledLabels.length || objectiveCount || m.sources.length
                        ? <>Filled in: {[...filledLabels, ...(objectiveCount ? [`Pathway table (${objectiveCount} objective${objectiveCount > 1 ? 's' : ''})`] : []), ...(m.sources.length ? [`${m.sources.length} source file${m.sources.length > 1 ? 's' : ''}`] : [])].join(', ')}.
                            {missingNow.length > 0 && <span className="text-amber-900"> Still needed: {missingNow.join(', ')}.</span>}</>
                        : 'Nothing is filled in yet. Use step 1, or enter the details yourself.'}
                    </p>
                  )}
                  {detailsOpen && <p className="text-sm text-muted">{imported ? 'Filled in from your AI chat. Check them and fix anything that is off.' : 'This is what the module is built from. Type it here, or fill it in with step 1.'}</p>}
                </div>
                <button className="btn" onClick={() => setDetailsOpen(o => !o)} aria-expanded={detailsOpen}>
                  {detailsOpen ? 'Hide the details' : filledLabels.length || objectiveCount ? 'Review and edit the details' : 'Enter the details myself'}
                </button>
              </div>
              {detailsOpen && (
                <div className="space-y-6">
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
                <div>
                  <label className="label" htmlFor="src">Source files (text, Markdown or PDF)</label>
                  <p className="mb-1 text-xs text-muted">Only needed if you want Claude to read files directly. If you used step 1, your files stayed in your AI tool.</p>
                  <input id="src" type="file" multiple accept=".txt,.md,.csv,.json,.pdf" onChange={addSources} className="text-sm" />
                  <ul className="mt-2 space-y-1 text-sm">
                    {m.sources.map((s, i) => (
                      <li key={i} className="flex justify-between"><span>{s.name}</span>
                        <button className="underline" onClick={() => update({ sources: m.sources.filter((_, j) => j !== i) })}>Remove</button></li>
                    ))}
                  </ul>
                </div>
                </div>
              )}
            </section>
            <div className="flex justify-end border-t border-rule pt-4">
              <button className="btn-primary" onClick={continueToLedger}>Next: {stages[0].n}. {stages[0].title} ›</button>
            </div>
          </div>
        )}

        {stage && (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{no(stage)}. {stage.title}</h2>
                <p className="text-sm text-muted">{stage.gate}</p>
                {(() => { const r = [...(m.runLog || [])].reverse().find(x => x.stage === stage.id && x.ok); return r ? <p className="mt-0.5 text-xs text-muted">Last run {formatDuration(r.ms)}{r.words ? ` · ${r.words.toLocaleString()} words back` : ''}{r.sent ? ` · sent about ${r.sent.toLocaleString()} tokens` : ''}</p> : null; })()}
                {['validity', 'editor', 'performance'].includes(stage.id) && <p className="mt-0.5 text-xs text-muted">Script now: {st('editor').applied?.count ? `after the editor's fixes (${st('editor').applied.count} applied)` : st('validity').output ? 'as the validity pass left it' : 'the first draft'}</p>}
              </div>
              <div className="flex gap-2">
                {busy === stage.id
                  ? <button className="btn" onClick={() => abort.current?.abort()}>Stop</button>
                  : <button className="btn-primary" disabled={!!busy} onClick={() => run(stage)}>{out ? 'Run again' : 'Run'}</button>}
                {stage.skippable && !out && <button className="btn" onClick={() => skip(stage)}>Skip, ledger is in the seed</button>}
              </div>
            </div>

            <StageGuide stage={stage} />
            <div className="mt-6">
              {busy !== stage.id && stale[stage.id] && (
                <div role="status" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>Out of date.</strong> {stale[stage.id].indirect
                    ? `${stale[stage.id].source} ${stale[stage.id].source.endsWith('s') ? 'were' : 'was'} re-run after this step was built, and the steps in between haven't been re-run yet. Re-run those first, then this one.`
                    : `${stale[stage.id].source} ${stale[stage.id].source.endsWith('s') ? 'were' : 'was'} re-run after this was written${stale[stage.id].changed ? ', and the text is different now' : ', so it may be different now'}. Run again to rebuild it from the new version.`}
                  {!stale[stage.id].indirect && <div className="mt-2"><button className="btn-primary" disabled={!!busy} onClick={() => run(stage)}>Run again</button></div>}
                </div>
              )}
              <StaleFold on={!!stale[stage.id] && busy !== stage.id}>
              {busy === stage.id && (
                <div role="status">
                  <Working since={busySince.current} live={live} note={note} status={status} sent={sent} />
                  <div className="whitespace-pre-wrap font-script text-[15px] leading-relaxed text-muted">{live}</div>
                </div>
              )}
              {busy && busy !== stage.id && (
                <div role="status" className="mb-4 rounded-md border border-rule bg-paper p-3">
                  <Working since={busySince.current} live={live} note={note} status={status} sent={sent} label={applying ? `Applying ${applyCount || 'your'} fix${applyCount === 1 ? '' : 'es'} to the script…` : `Working on the ${stages.find(s => s.id === busy)?.title.toLowerCase()}…`} />
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
                  ? <PerformanceResult data={m.parts} expectedIds={planParts(m.objectives || []).map(p => p.id)} gap={loadSettings().gapBetweenParts} />
                  : <div className="space-y-2"><p className="text-sm text-muted">The reply couldn't be read as a script with delivery directions. Run this step again. What came back is below.</p><pre className="max-h-96 overflow-auto rounded bg-paper p-3 text-xs">{out}</pre></div>
              )}
              {busy !== stage.id && out && stage.kind === 'seams' && <SeamsResult text={out} applied={!!m.parts?.parts?.some(p => p.seam)} />}
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
              {busy !== stage.id && out && stage.id === 'ledger' && m.parts?.parts?.length > 0 && (
                <p className="mt-3 text-sm"><Link className="underline" to={`/m/${m.id}/impact`}>Where each claim is used in the script</Link></p>
              )}
              {busy !== stage.id && out && stage.kind === 'editor' && (editorSettled
                ? <EditorResult applied={st('editor').applied} review={out} state={itemState.editor} script={st('editor').applied?.script} />
                : <FixReview text={out} state={itemState.editor} disabled={!!busy} onChange={(n, v) => setItem('editor', n, v)}
                    applyLabel={applyLabel} applyDisabled={!fixText.trim() || !!busy} onApply={applyChosen} />)}
              {busy !== stage.id && out && stage.kind === 'doc' && !(stage.id === 'ledger' && ledgerRows.length > 0) && (
                <SectionReview text={out} preface={stage.id === 'beats'} state={itemState[stage.id]} disabled={!!busy} onChange={(k, v) => setItem(stage.id, k, v)} />
              )}
              </StaleFold>
            </div>

            {busy !== stage.id && out && stage.kind === 'editor' && (editorSettled ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-4">
                {editorLeftover ? <button className="text-sm underline" onClick={() => setMoreOpen(true)}>Apply more fixes</button> : <span />}
                {nextOf(stage) && <button className="btn-primary" onClick={() => runNext(stage)}>{nextLabel(stage)}</button>}
              </div>
            ) : (
              <div className="mt-6 space-y-2 border-t border-rule pt-4">
                <label className="label" htmlFor="fixes">Extra notes (optional)</label>
                <textarea id="fixes" className="field h-20" placeholder="Anything else to change, or paste fixes from elsewhere." value={fixes} onChange={e => setFixes(e.target.value)} />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {st('editor').status === 'approved' && <button className="btn" disabled={!!busy} onClick={() => setMoreOpen(false)}>Cancel</button>}
                  {st('editor').status !== 'approved' && <button className="btn" disabled={!!busy} onClick={() => approveAndNext(stage)}>Skip the fixes · {nextLabel(stage)}</button>}
                  <button className="btn-primary" disabled={!fixText.trim() || !!busy} onClick={applyChosen}>{applyLabel}</button>
                </div>
              </div>
            ))}

            {busy !== stage.id && out && stage.kind !== 'editor' && stage.kind !== 'json' && (() => {
              const approved = st(stage.id).status === 'approved';
              const notesOpen = !approved || reviseOpen === stage.id;
              return (
                <div className="mt-6 space-y-3 border-t border-rule pt-4">
                  {notesOpen && <>
                    <label className="label" htmlFor="fb">Notes for a revision</label>
                    <textarea id="fb" className="field h-24" placeholder={stage.kind === 'script' ? 'General notes. Click any line above to note that line.' : 'What should change?'} value={feedback} onChange={e => setFeedback(e.target.value)} />
                  </>}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {approved && reviseOpen !== stage.id && <button className="mr-auto text-sm underline" onClick={() => setReviseOpen(stage.id)}>Make more changes to this stage</button>}
                    {notesOpen && (
                      <button className="btn" disabled={(!feedback.trim() && !m.notes.length && !claimNoteCount && !sectionNoteCount) || !!busy} onClick={() => { setReviseOpen(null); revise(stage); }}>
                        Revise{m.notes.length ? ` with ${m.notes.length} line note${m.notes.length > 1 ? 's' : ''}` : sectionNoteCount ? ` with ${sectionNoteCount} section note${sectionNoteCount > 1 ? 's' : ''}` : claimNoteCount ? ` with ${claimNoteCount} claim note${claimNoteCount > 1 ? 's' : ''}` : ''}
                      </button>
                    )}
                    {(nextOf(stage) || endsInputs(stage)) && (
                      <button className="btn-primary" disabled={!!busy} onClick={() => approveAndNext(stage)}>
                        {approved ? '' : 'Approve · '}{nextLabel(stage)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            {busy !== stage.id && out && stage.kind === 'json' && m.parts && (
              <div className="mt-4 flex justify-end border-t border-rule pt-4">
                <button className="btn-primary" disabled={!!busy} onClick={async () => { if (st(stage.id).status !== 'approved') await approve(stage); setActive('seams'); }}>
                  {st(stage.id).status === 'approved' ? '' : 'Approve · '}Next: {no(stages.find(t => t.id === 'seams'))}. Seams ›
                </button>
              </div>
            )}
            {busy !== stage.id && out && stage.kind === 'seams' && m.parts && (
              <div className="mt-4 flex justify-end border-t border-rule pt-4">
                <button className="btn-primary" disabled={!!busy} onClick={async () => { if (st(stage.id).status !== 'approved') await approve(stage); navigate(`/m/${m.id}/render`); }}>
                  {st(stage.id).status === 'approved' ? '' : 'Approve · '}Next: Render audio ›
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}


// Out-of-date output is folded away and dimmed so it isn't mistaken for the current version.
function StaleFold({ on, children }) {
  if (!on) return children;
  return (
    <details className="rounded-md border border-dashed border-rule">
      <summary className="cursor-pointer px-3 py-2 text-sm text-muted">Show the previous version (outdated)</summary>
      <div className="pointer-events-none select-none opacity-50 grayscale px-3 pb-3" aria-label="Previous version, out of date">{children}</div>
    </details>
  );
}
