import { useState } from 'react';
import { exportKit, importKit, KIT_FILES, loadKit, resetKit, saveKit } from '../lib/kit.js';
import { download, readFileText } from '../lib/download.js';

export default function Kit() {
  const [kit, setKit] = useState(loadKit);
  const [tab, setTab] = useState(KIT_FILES[1].id);
  const [saved, setSaved] = useState('');
  const isStage = tab.startsWith('stage:');
  const stage = isStage ? kit.stages.find(s => `stage:${s.id}` === tab) : null;

  function change(value) {
    setSaved('');
    if (stage) setKit({ ...kit, stages: kit.stages.map(s => (s.id === stage.id ? { ...s, prompt: value } : s)) });
    else setKit({ ...kit, files: { ...kit.files, [tab]: value } });
  }
  function save() { saveKit(kit); setSaved('Saved. Every stage uses this kit from now on.'); }

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Kit</h1>
          <p className="mt-1 text-sm text-muted">The rules and prompts behind every script. "Save as rule" in a review adds to these files.</p>
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">Files</div>
          {KIT_FILES.map(f => (
            <button key={f.id} className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${tab === f.id ? 'bg-ink text-white' : 'hover:bg-panel'}`} onClick={() => setTab(f.id)}>{f.name}</button>
          ))}
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">Stage prompts</div>
          {kit.stages.map(s => (
            <button key={s.id} className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${tab === `stage:${s.id}` ? 'bg-ink text-white' : 'hover:bg-panel'}`} onClick={() => setTab(`stage:${s.id}`)}>{s.n}. {s.title}</button>
          ))}
        </div>
        <div className="space-y-2">
          <button className="btn w-full justify-center" onClick={() => download('module-audio-kit.json', exportKit(kit))}>Export kit</button>
          <label className="btn w-full cursor-pointer justify-center">Import kit
            <input type="file" accept=".json" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { importKit(await readFileText(f)); setKit(loadKit()); setSaved('Kit imported.'); } catch (err) { setSaved(err.message); } }} />
          </label>
          <button className="btn w-full justify-center" onClick={() => { if (confirm('Reset the kit to the built-in version? Your edits and saved rules will be lost.')) { resetKit(); setKit(loadKit()); } }}>Reset to built-in</button>
        </div>
      </aside>
      <section className="rounded-lg border border-rule bg-panel p-6">
        <textarea className="field h-[65vh] font-mono text-xs leading-relaxed" value={stage ? stage.prompt : kit.files[tab]} onChange={e => change(e.target.value)} />
        <div className="mt-3 flex items-center gap-3">
          <button className="btn-primary" onClick={save}>Save kit</button>
          <span className="text-sm text-muted">{saved}</span>
        </div>
      </section>
    </div>
  );
}
