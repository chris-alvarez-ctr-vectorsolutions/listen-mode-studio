import { useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/store.js';
import { listModels, listVoices } from '../lib/eleven.js';

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

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={() => { saveSettings(s); setMsg('Settings saved.'); }}>Save settings</button>
        <button className="btn" onClick={() => { setS({ ...DEFAULT_SETTINGS }); setMsg('Defaults restored. Save to keep them.'); }}>Restore defaults</button>
        <span className="text-sm text-muted">{msg}</span>
      </div>
    </div>
  );
}
