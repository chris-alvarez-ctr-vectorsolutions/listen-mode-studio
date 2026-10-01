import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { getAudio, getModule, loadSettings, saveAudio, saveModule } from '../lib/store.js';
import { chunkLines, partFromText, speakersIn } from '../lib/script.js';
import { dialogue } from '../lib/eleven.js';
import { blobToSamples, decode, join, wavBlob } from '../lib/audio.js';
import { download, readFileText } from '../lib/download.js';
import { speakerColor } from '../components/speaker.js';
import { buildManifest, fileNameFor } from '../lib/manifest.js';

export default function Render() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [urls, setUrls] = useState({});
  const [status, setStatus] = useState({});
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [warnings, setWarnings] = useState([]);
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

  async function renderPart(part) {
    setError('');
    const say = t => setStatus(s => ({ ...s, [part.id]: t }));
    try {
      const items = [];
      const prior = [];
      const marks = [];   // where each segment starts, in seconds, for the seam and transcript sync
      let t = 0;
      const add = it => { items.push(it); t += it.buffer ? it.buffer.length / it.buffer.sampleRate : it.silence; };
      let n = 0;
      const total = part.segments.reduce((k, s) => k + chunkLines(s.lines).length, 0);
      for (const seg of part.segments) {
        marks.push({ id: seg.id, start: t });
        for (const chunk of chunkLines(seg.lines)) {
          n += 1; say(`Rendering ${n} of ${total}`);
          const inputs = chunk.map(l => ({ text: l.text, voice_id: voiceFor(l.speaker) }));
          const { audio, requestId } = await dialogue(inputs, { previousRequestIds: prior });
          if (requestId) prior.push(requestId);
          add({ buffer: await decode(audio) });
          add({ silence: settings.gapBetweenLines });
        }
        if (seg.pauseAfter) add({ silence: Number(seg.pauseAfter) });
      }
      const blob = wavBlob(join(items));
      await saveAudio(m.id, part.id, blob);
      // The ending is the last segment, so an add-on is spliced in where it starts.
      const timing = { duration: t, seamAt: marks.length > 1 ? marks[marks.length - 1].start : null, segments: marks };
      const cur = await getModule(m.id);
      await saveModule({ ...cur, timings: { ...cur.timings, [part.id]: timing } });
      setM(prev => ({ ...prev, timings: { ...prev.timings, [part.id]: timing } }));
      setUrls(u => ({ ...u, [part.id]: URL.createObjectURL(blob) }));
      say('Rendered');
      return true;
    } catch (e) { say('Failed'); setError(e.message); return false; }
  }

  async function renderAll() {
    let ok = true;
    for (const p of parts) ok = (await renderPart(p)) && ok;
    if (ok) await exportPackage(await getModule(m.id));
  }

  // manifest.json (with seam times) plus every rendered part, in one zip for the prototype.
  async function exportPackage(mod = m) {
    setError('');
    try {
      const rendered = new Set();
      for (const p of mod.parts?.parts || []) if (await getAudio(mod.id, p.id)) rendered.add(p.id);
      const { manifest, files, warnings: warn } = buildManifest(mod, settings, rendered);
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      for (const f of files) zip.file(`audio/${f.name}`, await getAudio(mod.id, f.partId));
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
      items.forEach((it, i) => { if (i) pieces.push(new Float32Array(Math.round(settings.gapBetweenParts * 44100))); pieces.push(it.samples); });
      const total = pieces.reduce((k, p) => k + p.length, 0);
      const outArr = new Float32Array(total);
      let off = 0; for (const p of pieces) { outArr.set(p, off); off += p.length; }
      download(`${prefix}${m.name} - ${listen.name}.wav`, wavBlob(outArr));
    } catch (e) { setError(e.message); }
  }

  async function downloadAll() {
    const zip = new JSZip();
    for (const p of parts) {
      const b = await getAudio(m.id, p.id);
      if (b) zip.file(fileNameFor(m, p.id), b);
    }
    download(`${prefix}${m.name} parts.zip`, await zip.generateAsync({ type: 'blob' }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to={`/m/${m.id}`} className="text-sm text-muted hover:text-ink">Back to {m.name}</Link>
          <h1 className="mt-1 text-2xl font-semibold">Render audio</h1>
          {!m.ledgerSigned && <p className="text-sm text-onair">The claims ledger isn't signed yet, so every file is marked DRAFT.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn cursor-pointer">Add .txt parts<input type="file" multiple accept=".txt" className="hidden" onChange={importTxt} /></label>
          <button className="btn" disabled={!parts.length} onClick={downloadAll}>Download all parts</button>
          <button className="btn" disabled={!parts.length} onClick={() => exportPackage()}>Export for prototype</button>
          <button className="btn-onair" disabled={!parts.length || missing.length > 0} onClick={renderAll}>Render all parts</button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium">The prototype package has gaps:</p>
          <ul className="list-disc pl-5">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      {missing.length > 0 && (
        <p className="rounded-md border border-rule bg-panel p-3 text-sm">
          No voice set for {missing.join(', ')}. Add {missing.length > 1 ? 'them' : 'it'} in <Link className="underline" to="/settings">Settings</Link> before rendering.
        </p>
      )}
      {!parts.length && <p className="rounded-lg border border-rule bg-panel p-6 text-muted">Nothing to render yet. Run the performance pass, or add .txt parts with "NAME: text" lines.</p>}

      <ul className="divide-y divide-rule rounded-lg border border-rule bg-panel">
        {parts.map(p => {
          const flags = p.segments.filter(s => s.flag).map(s => s.flag);
          const lines = p.segments.reduce((k, s) => k + s.lines.length, 0);
          return (
            <li key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button className="text-left" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-muted">{p.id} · {lines} lines{flags.length ? ` · waiting on ${flags.join(', ')}` : ''}{m.timings?.[p.id]?.seamAt != null ? ` · seam at ${m.timings[p.id].seamAt.toFixed(1)}s` : ''}</div>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted">{status[p.id] || ''}</span>
                  {urls[p.id] && <audio controls src={urls[p.id]} className="h-9" />}
                  <button className="btn" disabled={missing.length > 0} onClick={() => renderPart(p)}>{urls[p.id] ? 'Render again' : 'Render'}</button>
                  {urls[p.id] && <a className="btn" href={urls[p.id]} download={`${prefix}${p.id}.wav`}>Download</a>}
                </div>
              </div>
              {open === p.id && (
                <div className="mt-3 space-y-3 font-script text-[15px] leading-relaxed">
                  {p.segments.map(s => (
                    <div key={s.id} className={s.flag ? 'rounded border border-amber-300 bg-amber-50 p-2' : ''}>
                      {s.flag && <div className="font-ui text-xs text-muted">Waiting on {s.flag}</div>}
                      {s.lines.map((l, i) => <p key={i}><span className={`mr-2 font-ui text-xs font-semibold ${speakerColor(l.speaker)}`}>{l.speaker}</span>{l.text}</p>)}
                      {s.pauseAfter ? <p className="font-ui text-xs text-muted">⟨ hold {s.pauseAfter}s ⟩</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!!m.parts?.assembly?.length && (
        <section className="rounded-lg border border-rule bg-panel p-5">
          <h2 className="font-semibold">Listens</h2>
          <p className="text-sm text-muted">Each listen joins its rendered parts in order, with {settings.gapBetweenParts}s between parts where a sting will go.</p>
          <ul className="mt-3 space-y-2">
            {m.parts.assembly.map(l => (
              <li key={l.name} className="flex flex-wrap items-center justify-between gap-3">
                <div><span className="font-medium">{l.name}</span> <span className="text-sm text-muted">{l.parts.length} parts</span></div>
                <button className="btn" onClick={() => buildListen(l)}>Build and download</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
