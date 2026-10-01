import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/store.js';
import { listModels, listVoices } from '../lib/eleven.js';
import { clearTheme, hasCustomTheme, saveTheme, themeBlob } from '../lib/theme.js';

export default function Settings() {
  const [s, setS] = useState(loadSettings);
  const [voices, setVoices] = useState([]);
  const [models, setModels] = useState([]);
  const [msg, setMsg] = useState('');
  const set = (k, v) => { setMsg(''); setS({ ...s, [k]: v }); };
  const setVoice = (i, patch) => set('voices', s.voices.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  async function load() {
    saveSettings(s);
    const [v, m] = await Promise.allSettled([listVoices(), listModels()]);
    if (v.status === 'fulfilled') setVoices(v.value);
    if (m.status === 'fulfilled') setModels(m.value);
    const failed = [v, m].filter(r => r.status === 'rejected').map(r => r.reason.message);
    setMsg(failed.length
      ? `${failed.join(' ')} If your ElevenLabs key can't list voices or models, that's fine: type the model and paste voice IDs below.`
      : 'Loaded your voices and models.');
  }

  const [custom, setCustom] = useState({});
  const preview = useRef(null);
  const refreshCustom = async () => setCustom({ intro: await hasCustomTheme('intro'), outro: await hasCustomTheme('outro') });
  useEffect(() => { refreshCustom(); }, []);
  async function pickTheme(which, e) {
    const f = e.target.files?.[0];
    if (f) { await saveTheme(which, f); await refreshCustom(); setMsg(`Replaced the ${which} music. Render the ${which === 'intro' ? 'open' : 'close'} again to use it.`); }
    e.target.value = '';
  }
  async function playTheme(which) {
    preview.current?.pause();
    preview.current = new Audio(URL.createObjectURL(await themeBlob(which)));
    preview.current.volume = Math.max(0, Math.min(1, Number(s.musicLevel) || 0));
    preview.current.play();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="-mt-6 text-sm text-muted">Saved in this browser only. API keys stay in your Cloudflare Worker, never here.</p>

      <section className="space-y-4 rounded-lg border border-rule bg-panel p-5">
        <h2 className="font-semibold">Connection</h2>
        <div><label className="label" htmlFor="w">Worker URL</label>
          <input id="w" className="field" placeholder="https://module-audio-studio-proxy.your-account.workers.dev" value={s.workerUrl} onChange={e => set('workerUrl', e.target.value)} /></div>
        <div><label className="label" htmlFor="t">App token (only if your worker requires one)</label>
          <input id="t" type="password" className="field" value={s.appToken} onChange={e => set('appToken', e.target.value)} /></div>
      </section>

      <section className="space-y-4 rounded-lg border border-rule bg-panel p-5">
        <h2 className="font-semibold">Writing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="cm">Claude model</label>
            <input id="cm" className="field" value={s.claudeModel} onChange={e => set('claudeModel', e.target.value)} /></div>
          <div><label className="label" htmlFor="mt">Max output tokens</label>
            <input id="mt" type="number" className="field" value={s.maxTokens} onChange={e => set('maxTokens', e.target.value)} /></div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-rule bg-panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Voices</h2>
          <button className="btn" onClick={load}>Load voices and models (optional)</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="em">ElevenLabs model</label>
            {models.length
              ? <select id="em" className="field" value={s.elevenModel} onChange={e => set('elevenModel', e.target.value)}>{models.map(m => <option key={m.id} value={m.id}>{m.name} ({m.id})</option>)}</select>
              : <input id="em" className="field" value={s.elevenModel} onChange={e => set('elevenModel', e.target.value)} />}
          </div>
          <div><label className="label" htmlFor="st">Stability</label>
            <select id="st" className="field" value={s.stability} onChange={e => set('stability', Number(e.target.value))}>
              <option value={0}>Creative (0)</option><option value={0.5}>Natural (0.5)</option><option value={1}>Robust (1)</option></select></div>
          <div><label className="label" htmlFor="of">Output format</label>
            <input id="of" className="field" value={s.outputFormat} onChange={e => set('outputFormat', e.target.value)} /></div>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Speaker to voice</div>
          {s.voices.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label="Speaker" className="field w-32 uppercase" value={v.speaker} onChange={e => setVoice(i, { speaker: e.target.value.toUpperCase() })} />
              {voices.length
                ? <select aria-label={`Voice for ${v.speaker}`} className="field" value={v.voiceId} onChange={e => setVoice(i, { voiceId: e.target.value })}>
                    <option value="">Choose a voice</option>{voices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                : <input aria-label={`Voice ID for ${v.speaker}`} className="field" placeholder="Voice ID" value={v.voiceId} onChange={e => setVoice(i, { voiceId: e.target.value })} />}
              <button className="btn" onClick={() => set('voices', s.voices.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button className="btn" onClick={() => set('voices', [...s.voices, { speaker: '', voiceId: '' }])}>Add speaker</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="g1">Gap between request chunks (s)</label>
            <input id="g1" type="number" step="0.05" className="field" value={s.gapBetweenLines} onChange={e => set('gapBetweenLines', Number(e.target.value))} /></div>
          <div><label className="label" htmlFor="g2">Gap between parts in a listen (s)</label>
            <input id="g2" type="number" step="0.1" className="field" value={s.gapBetweenParts} onChange={e => set('gapBetweenParts', Number(e.target.value))} /></div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-rule bg-panel p-5">
        <h2 className="font-semibold">Theme music</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.themeMusic} onChange={e => set('themeMusic', e.target.checked)} />Mix theme music into the open and the close when they are rendered</label>
        <p className="text-xs text-muted">The music starts under the end of the dialogue and keeps playing after it ends, so it finishes the set number of seconds later. Render the open and close again after changing these.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="t1">Intro music after dialogue (s)</label>
            <input id="t1" type="number" step="0.5" min="0" className="field" value={s.introTailSec} onChange={e => set('introTailSec', Number(e.target.value))} /></div>
          <div><label className="label" htmlFor="t2">Outro music after dialogue (s)</label>
            <input id="t2" type="number" step="0.5" min="0" className="field" value={s.outroTailSec} onChange={e => set('outroTailSec', Number(e.target.value))} /></div>
          <div><label className="label" htmlFor="t3">Music level (0 to 1)</label>
            <input id="t3" type="number" step="0.05" min="0" max="1" className="field" value={s.musicLevel} onChange={e => set('musicLevel', Number(e.target.value))} /></div>
        </div>
        {['intro', 'outro'].map(w => (
          <div key={w} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-28 font-medium capitalize">{w} music</span>
            <span className="text-muted">{custom[w] ? 'Your file' : 'Built-in'}</span>
            <button className="btn" onClick={() => playTheme(w)}>Play</button>
            <label className="btn cursor-pointer">Replace<input type="file" accept="audio/*" className="sr-only" onChange={e => pickTheme(w, e)} /></label>
            {custom[w] && <button className="btn" onClick={async () => { await clearTheme(w); refreshCustom(); }}>Use built-in</button>}
          </div>
        ))}
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={() => { saveSettings(s); setMsg('Settings saved.'); }}>Save settings</button>
        <button className="btn" onClick={() => { setS({ ...DEFAULT_SETTINGS }); setMsg('Defaults restored. Save to keep them.'); }}>Restore defaults</button>
        <span className="text-sm text-muted">{msg}</span>
      </div>
    </div>
  );
}
