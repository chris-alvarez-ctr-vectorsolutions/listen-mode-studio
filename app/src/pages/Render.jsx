import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import JSZip from 'jszip';
import { getAudio, getModule, loadSettings, saveAudio, saveModule } from '../lib/store.js';
import { chunkLines, partFromText, speakersIn } from '../lib/script.js';
import { dialogue } from '../lib/eleven.js';
import { blobToSamples, decode, join, mixTheme, wavBlob } from '../lib/audio.js';
import { THEME_FOR, themeBuffer } from '../lib/theme.js';
import { download, readFileText } from '../lib/download.js';
import { speakerColor } from '../components/speaker.js';
import Composer from '../components/Composer.jsx';
import { planParts } from '../lib/pathways.js';
import { combineCues, cuesFromResponse, toVtt } from '../lib/captions.js';
import { buildManifest, classifyPart, fileNameFor } from '../lib/manifest.js';
import { buildImpact, parseLedger, snapshot } from '../lib/claims.js';
import { notifyWhenAway } from '../lib/tabTitle.js';
import { audioStale, partTextHash } from '../lib/staleness.js';

const Spinner = () => <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;

export default function Render() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [urls, setUrls] = useState({});
  const [status, setStatus] = useState({});
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [edit, setEdit] = useState(null);   // { part, seg, line, text } while a line is being edited
  // What is rendering now. The refs stop a second click in the same instant, before the screen has caught up.
  const [allProgress, setAllProgress] = useState(null);   // { i, total } while "Render all parts" is running
  const [busyParts, setBusyParts] = useState({});
  const allRunning = useRef(false);
  const partRunning = useRef(new Set());
  const [params, setParams] = useSearchParams();   // which view is showing is kept in the address, so a refresh keeps it
  const settings = loadSettings();

  async function loadUrls(mod) {
    if (!mod?.parts) return;
    const entries = await Promise.all(mod.parts.parts.map(async p => {
      const b = await getAudio(mod.id, p.id);
      return [p.id, b ? URL.createObjectURL(b) : null];
    }));
    setUrls(Object.fromEntries(entries));
  }
  useEffect(() => { getModule(id).then(mod => { setM(mod); loadUrls(mod); }); }, [id]);
  if (!m) return <p className="text-muted">Loading…</p>;

  const prefix = m.ledgerSigned ? '' : 'DRAFT-';
  const voiceFor = sp => settings.voices.find(v => v.speaker === sp)?.voiceId;
  const parts = m.parts?.parts || [];
  const impact = buildImpact(m);
  const missing = speakersIn(parts).filter(sp => !voiceFor(sp));

  async function importTxt(e) {
    const files = [...(e.target.files || [])];
    const newParts = await Promise.all(files.map(async f => {
      const pid = f.name.replace(/\.[^.]+$/, '');
      return partFromText(pid, pid, await readFileText(f));
    }));
    const all = [...parts.filter(p => !newParts.some(n => n.id === p.id)), ...newParts];
    const next = { ...m, parts: { parts: all, assembly: m.parts?.assembly?.length ? m.parts.assembly : [{ name: 'All parts', parts: all.map(p => p.id) }] } };
    await saveModule(next); setM(next);
    e.target.value = '';
  }

  // Saves one edited line into the stored script. The audio on file is now out of date, so say so.
  async function saveLine() {
    const { part, seg, line, text } = edit;
    const cur = await getModule(m.id);
    const next = { ...cur, parts: { ...cur.parts, parts: cur.parts.parts.map(p => p.id !== part ? p : { ...p, segments: p.segments.map(s => s.id !== seg ? s : { ...s, lines: s.lines.map((l, i) => i === line ? { ...l, text: text.trim() } : l) }) }) } };
    await saveModule(next); setM(next); setEdit(null);
    setStatus(s => ({ ...s, [part]: 'Text edited, re-render to hear it' }));
  }

  async function renderPart(part) {
    if (partRunning.current.has(part.id)) return false;
    partRunning.current.add(part.id); setBusyParts(b => ({ ...b, [part.id]: true }));
    setError('');
    const say = t => setStatus(s => ({ ...s, [part.id]: t }));
    try {
      const items = [];
      const prior = [];
      const cues = [];
      const marks = [];   // where each segment starts, in seconds, for transcript sync
      let t = 0;
      let speechEnd = 0;   // where the last spoken audio ends, before any trailing gap or hold
      const add = it => { items.push(it); t += it.buffer ? it.buffer.length / it.buffer.sampleRate : it.silence; if (it.buffer) speechEnd = t; };
      let n = 0;
      const total = part.segments.reduce((k, s) => k + chunkLines(s.lines).length, 0);
      const isOpen = classifyPart(part.id)?.topic === 'open';
      const introTail = Number(settings.introTailSec ?? 5);
      let musicAnchor = null;   // an open with a host intro: the theme music belongs to the first segment, and the host intro starts after its tail
      for (const [si, seg] of part.segments.entries()) {
        marks.push({ id: seg.id, start: t });
        for (const chunk of chunkLines(seg.lines)) {
          n += 1; say(`Rendering ${n} of ${total}`);
          const inputs = chunk.map(l => ({ text: l.text, voice_id: voiceFor(l.speaker) }));
          const { audio, requestId, timings } = await dialogue(inputs, { previousRequestIds: prior });
          if (requestId) prior.push(requestId);
          try { cues.push(...cuesFromResponse(inputs, chunk.map(l => l.speaker), timings, t)); } catch { /* captions are optional */ }
          add({ buffer: await decode(audio) });
          add({ silence: settings.gapBetweenLines });
        }
        if (isOpen && si === 0 && part.segments.length > 1 && settings.themeMusic) {
          musicAnchor = speechEnd;
          add({ silence: Math.max(introTail, Number(seg.pauseAfter) || 0) });
        } else if (seg.pauseAfter) add({ silence: Number(seg.pauseAfter) });
      }
      let samples = join(items);
      let duration = t;
      let theme = null;
      const which = THEME_FOR[classifyPart(part.id)?.topic];
      if (settings.themeMusic && which) {
        say('Adding theme music');
        const music = await themeBuffer(which);
        const tail = Number(settings[`${which}TailSec`] ?? 5);
        const mixed = mixTheme(samples, music, (musicAnchor ?? speechEnd) + tail - music.duration, Number(settings.musicLevel ?? 0.7));
        samples = mixed.samples; duration = samples.length / 44100;
        theme = { kind: which, start: mixed.start, end: mixed.end };
      }
      const blob = wavBlob(samples);
      await saveAudio(m.id, part.id, blob);
      // claims: the text of each cited claim as it reads now, so a later ledger change shows up as stale.
      const timing = { duration, theme, cues, segments: marks, textHash: partTextHash(part), claims: snapshot(part.claims, parseLedger(m.stages?.ledger?.output)) };
      const cur = await getModule(m.id);
      await saveModule({ ...cur, timings: { ...cur.timings, [part.id]: timing } });
      setM(prev => ({ ...prev, timings: { ...prev.timings, [part.id]: timing } }));
      setUrls(u => ({ ...u, [part.id]: URL.createObjectURL(blob) }));
      say(`${cues.length ? 'Rendered' : 'Rendered (no captions)'}${theme ? ', with theme music' : ''}`);
      return true;
    } catch (e) { say('Failed'); setError(e.message); return false; }
    finally { partRunning.current.delete(part.id); setBusyParts(b => { const n = { ...b }; delete n[part.id]; return n; }); }
  }

  async function renderAll() {
    if (allRunning.current) return;
    allRunning.current = true;
    let ok = true;
    try {
      for (const [i, p] of parts.entries()) {
        setAllProgress({ i: i + 1, total: parts.length });
        ok = (await renderPart(p)) && ok;
      }
      if (ok) await exportPackage(await getModule(m.id));
    } finally { allRunning.current = false; setAllProgress(null); }
    notifyWhenAway(`${ok ? '✓ Audio rendered' : '✕ Rendering had problems'} · ${m.name}`);
  }

  // manifest.json (with seam times) plus every rendered part, in one zip for the prototype.
  async function exportPackage(mod = m) {
    setError('');
    try {
      const rendered = new Set();
      for (const p of mod.parts?.parts || []) if (await getAudio(mod.id, p.id)) rendered.add(p.id);
      const { manifest, files, captions, warnings: warn } = buildManifest(mod, settings, rendered);
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      for (const f of files) zip.file(`audio/${f.name}`, await getAudio(mod.id, f.partId));
      for (const c of captions) zip.file(c.path, c.vtt);
      setWarnings(warn);
      download(`${prefix}${mod.name} prototype package.zip`, await zip.generateAsync({ type: 'blob' }));
    } catch (e) { setError(e.message); }
  }

  async function buildListen(listen) {
    setError('');
    try {
      const items = [];
      for (const pid of listen.parts) {
        const b = await getAudio(m.id, pid);
        if (!b) throw new Error(`Render "${pid}" before building "${listen.name}".`);
        items.push({ buffer: null, samples: await blobToSamples(b) });
      }
      const pieces = [];
      const noCaps = [];
      items.forEach((it, i) => {
        if (i) pieces.push(new Float32Array(Math.round(settings.gapBetweenParts * 44100)));
        pieces.push(it.samples);
        if (!m.timings?.[listen.parts[i]]?.cues?.length) noCaps.push(listen.parts[i]);
      });
      const cues = combineCues(items.map((it, i) => ({ cues: m.timings?.[listen.parts[i]]?.cues, duration: it.samples.length / 44100 })), settings.gapBetweenParts);
      const total = pieces.reduce((k, p) => k + p.length, 0);
      const outArr = new Float32Array(total);
      let off = 0; for (const p of pieces) { outArr.set(p, off); off += p.length; }
      download(`${prefix}${m.name} - ${listen.name}.wav`, wavBlob(outArr));
      if (cues.length) setTimeout(() => download(`${prefix}${m.name} - ${listen.name}.vtt`, toVtt(cues), 'text/vtt'), 300);
      setWarnings(noCaps.length ? [`No captions for ${noCaps.join(', ')} in "${listen.name}". Render ${noCaps.length > 1 ? 'them' : 'it'} again to add ${noCaps.length > 1 ? 'them' : 'it'}.`] : []);
    } catch (e) { setError(e.message); }
  }

  async function downloadAll() {
    const zip = new JSZip();
    for (const p of parts) {
      const b = await getAudio(m.id, p.id);
      if (b) zip.file(fileNameFor(m, p.id), b);
      const cues = m.timings?.[p.id]?.cues;
      if (b && cues?.length) zip.file(fileNameFor(m, p.id).replace(/\.wav$/, '.vtt'), toVtt(cues));
    }
    download(`${prefix}${m.name} parts.zip`, await zip.generateAsync({ type: 'blob' }));
  }

  // Two views of the same audio: a plain list of every file, and the module as a learner would meet it (in order,
  // with the test-out and test-up controls). With objectives and parts you can choose; the paths view is the default
  // once everything is rendered.
  const outdatedParts = parts.filter(p => urls[p.id] && audioStale(p, m.timings?.[p.id]) === true);
  const hasPaths = !!(m.objectives || []).length && parts.length > 0;
  const setView = k => setParams(p => { const n = new URLSearchParams(p); n.set('view', k); return n; }, { replace: true });
  const ready = !!(m.objectives || []).filter(o => o.id).length && planParts(m.objectives).every(p => urls[p.id]);
  const asked = params.get('view');
  const view = !hasPaths ? 'parts' : asked === 'parts' || asked === 'paths' ? asked : ready ? 'paths' : 'parts';

  // One row per part, used by the learner view and the plain list alike. st: { chip, dim, active } from the Composer.
  function partRow(p, st = {}) {
    const flags = [...new Set(p.segments.filter(s => s.flag).map(s => s.flag))];
    const waiting = flags.length > 4 ? `${flags.slice(0, 4).join(', ')} +${flags.length - 4} more` : flags.join(', ');
    const lines = p.segments.reduce((k, s) => k + s.lines.length, 0);
    const stale = impact.partRows.find(r => r.id === p.id)?.stale.length;
    const t = m.timings?.[p.id];
    const rendered = !!urls[p.id];
    const outdated = rendered && audioStale(p, t) === true;
    return (
      <div className={`px-3 py-2 ${st.dim ? 'opacity-50' : ''} ${st.active ? 'bg-orange-50' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button className="min-w-0 flex-1 basis-64 text-left" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
            <span aria-hidden className="mr-1 text-xs text-muted">{open === p.id ? '▾' : '▸'}</span><span className="text-sm font-medium">{p.title}</span>
            {st.chip && <span className="ml-2 rounded border border-rule px-1.5 py-0.5 text-xs text-muted">{st.chip}</span>}
            {outdated && <span className="ml-2 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900" title="The script changed after this was rendered.">⟳ Outdated</span>}
            <span className="block truncate text-xs text-muted" title={flags.length ? `Waiting on ${flags.join(', ')}` : undefined}>
              {p.id}{t?.duration ? ` · ${Math.floor(t.duration / 60)}:${String(Math.round(t.duration % 60)).padStart(2, '0')}` : ''}{flags.length ? ` · waiting on ${waiting}` : ''}{stale ? ' · claim changed, render again' : ''}{status[p.id] ? ` · ${status[p.id]}` : ''}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {rendered && <audio controls src={urls[p.id]} className="h-8 w-56 max-w-full" />}
            <button className={`btn !py-1 ${rendered ? '' : 'border-ink'}`} disabled={missing.length > 0 || !!allProgress || !!busyParts[p.id]} onClick={() => renderPart(p)} title={rendered ? 'Render this part again' : 'Render this part'}>
              {busyParts[p.id] ? <><Spinner />Rendering…</> : rendered ? (outdated ? '↻ Render again' : '↻ Re-render') : 'Render'}
            </button>
          </div>
        </div>
        {open === p.id && (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap gap-2">
              {rendered && <a className="btn !py-1" href={urls[p.id]} download={`${prefix}${p.id}.wav`}>Download</a>}
              {t?.cues?.length > 0 && <button className="btn !py-1" onClick={() => download(`${prefix}${p.id}.vtt`, toVtt(t.cues), 'text/vtt')}>Captions</button>}
              <span className="self-center text-xs text-muted">{lines} lines</span>
            </div>
            <div className="space-y-3 font-script text-[15px] leading-relaxed">
              {p.segments.map(s => (
                <div key={s.id} className={s.flag ? 'rounded border border-amber-300 bg-amber-50 p-2' : ''}>
                  {s.flag && <div className="font-ui text-xs text-muted">Waiting on {s.flag}</div>}
                  {s.lines.map((l, i) => edit && edit.part === p.id && edit.seg === s.id && edit.line === i ? (
                    <div key={i} className="space-y-1">
                      <span className={`font-ui text-xs font-semibold ${speakerColor(l.speaker)}`}>{l.speaker}</span>
                      <textarea autoFocus aria-label={`Edit ${l.speaker} line`} className="field font-script" rows={3} value={edit.text} onChange={e => setEdit({ ...edit, text: e.target.value })} />
                      <div className="flex gap-2 font-ui">
                        <button className="btn !py-1" disabled={!edit.text.trim()} onClick={saveLine}>Save line</button>
                        <button className="btn !py-1" onClick={() => setEdit(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p key={i} className="cursor-text rounded hover:bg-orange-50" title="Click to edit this line" onClick={() => setEdit({ part: p.id, seg: s.id, line: i, text: l.text })}><span className={`mr-2 font-ui text-xs font-semibold ${speakerColor(l.speaker)}`}>{l.speaker}</span>{l.text}</p>
                  ))}
                  {s.pauseAfter ? <p className="font-ui text-xs text-muted">⟨ hold {s.pauseAfter}s ⟩</p> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to={`/m/${m.id}`} className="text-sm text-muted hover:text-ink">Back to {m.name}</Link>
          <h1 className="mt-1 text-2xl font-semibold">Render audio</h1>
          {!m.ledgerSigned && <p className="text-sm text-onair">The claims ledger isn't signed yet, so every file is marked DRAFT.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <details className="relative">
            <summary className="btn cursor-pointer list-none">More</summary>
            <div className="absolute right-0 z-20 mt-1 flex w-48 flex-col gap-1 rounded-md border border-rule bg-panel p-2 shadow-md">
              <label className="btn cursor-pointer">Add .txt parts<input type="file" multiple accept=".txt" className="hidden" onChange={importTxt} /></label>
              <Link className="btn" to={`/m/${m.id}/impact`}>Where each claim is used</Link>
            </div>
          </details>
          <button className="btn" disabled={!parts.length} onClick={downloadAll}>Download all parts</button>
          <button className="btn" disabled={!parts.length || !!allProgress} onClick={() => exportPackage()}>Export for prototype</button>
          {/* One primary at a time: Render all until every part exists, then Play in the learner bar. */}
          <button className={ready && !allProgress ? 'btn' : 'btn-onair'} disabled={!parts.length || missing.length > 0 || !!allProgress} onClick={renderAll} aria-busy={!!allProgress}>
            {allProgress ? <><Spinner />Rendering {allProgress.i} of {allProgress.total}…</> : ready ? 'Render all again' : 'Render all parts'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium">Heads up:</p>
          <ul className="list-disc pl-5">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      {missing.length > 0 && (
        <p className="rounded-md border border-rule bg-panel p-3 text-sm">
          No voice set for {missing.join(', ')}. Add {missing.length > 1 ? 'them' : 'it'} in <Link className="underline" to="/settings">Settings</Link> before rendering.
        </p>
      )}
      {outdatedParts.length > 0 && (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>⟳ Outdated audio.</strong> The script changed after {outdatedParts.length === 1 ? 'this part was' : `these ${outdatedParts.length} parts were`} rendered: {outdatedParts.map(p => p.id).join(', ')}. What you hear is from the earlier script. Use Render all again, or re-render just {outdatedParts.length === 1 ? 'that part' : 'those parts'}.
        </div>
      )}
      {!parts.length && <p className="rounded-lg border border-rule bg-panel p-6 text-muted">Nothing to render yet. Run the performance pass, or add .txt parts with "NAME: text" lines.</p>}

      {hasPaths && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="View" className="inline-flex gap-1 rounded-md border border-rule bg-panel p-1 text-sm">
            {[['parts', 'All parts'], ['paths', 'Learner paths']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
                className={`rounded px-3 py-1.5 font-medium ${view === k ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{label}</button>
            ))}
          </div>
          <p className="text-sm text-muted">
            {view === 'parts'
              ? `Every audio file, in script order. ${parts.filter(p => urls[p.id]).length} of ${parts.length} rendered.`
              : 'Set how a learner does on each objective, then hear the listen they would get.'}
          </p>
        </div>
      )}

      {view === 'paths' ? (
        <Composer objectives={m.objectives} parts={parts} urls={urls} timings={m.timings} gap={settings.gapBetweenParts} rowFor={partRow} />
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-panel">
          {parts.map(p => <li key={p.id}>{partRow(p)}</li>)}
        </ul>
      )}

      {!!m.parts?.assembly?.length && (
        <details className="rounded-lg border border-rule bg-panel">
          <summary className="cursor-pointer px-4 py-3 font-semibold">Exported listens <span className="font-normal text-muted">({m.parts.assembly.length})</span></summary>
          <div className="border-t border-rule px-4 py-3">
            <p className="text-sm text-muted">Each listen joins its rendered parts in order, with {settings.gapBetweenParts}s between parts where a sting will go.</p>
            <ul className="mt-3 space-y-2">
              {m.parts.assembly.map(l => (
                <li key={l.name} className="flex flex-wrap items-center justify-between gap-3">
                  <div><span className="font-medium">{l.name}</span> <span className="text-sm text-muted">{l.parts.length} parts</span></div>
                  <button className="btn" onClick={() => buildListen(l)}>Build and download</button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
