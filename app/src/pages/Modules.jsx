import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteModule, listModules, newModule, saveModule } from '../lib/store.js';
import { download, readFileText } from '../lib/download.js';

export default function Modules() {
  const [mods, setMods] = useState([]);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const refresh = () => listModules().then(setMods);
  useEffect(() => { refresh(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const m = await saveModule(newModule(name.trim()));
    navigate(`/m/${m.id}`);
  }
  async function importModule(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const m = JSON.parse(await readFileText(file));
    m.id = crypto.randomUUID();
    await saveModule(m);
    refresh();
  }

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_320px]">
      <section>
        <h1 className="text-2xl font-semibold">Modules</h1>
        <p className="mt-1 text-muted">Each module goes from source content to rendered audio. Its work stays in this browser.</p>
        <ul className="mt-6 divide-y divide-rule rounded-lg border border-rule bg-panel">
          {mods.length === 0 && <li className="p-5 text-muted">No modules yet. Start one on the right.</li>}
          {mods.map(m => (
            <li key={m.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <Link to={`/m/${m.id}`} className="font-medium hover:underline">{m.name}</Link>
                <div className="text-sm text-muted">Updated {new Date(m.updatedAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn" onClick={() => download(`${m.name}.module.json`, JSON.stringify(m, null, 2))}>Export</button>
                <button className="btn" onClick={async () => { if (confirm(`Delete "${m.name}" and its audio?`)) { await deleteModule(m.id); refresh(); } }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <aside className="space-y-6">
        <form onSubmit={create} className="rounded-lg border border-rule bg-panel p-5">
          <label className="label" htmlFor="mname">New module</label>
          <input id="mname" className="field" placeholder="Contain the Sharp (Module 4, Manufacturing)" value={name} onChange={e => setName(e.target.value)} />
          <button className="btn-primary mt-3 w-full justify-center" type="submit">Start module</button>
        </form>
        <div className="rounded-lg border border-rule bg-panel p-5">
          <label className="label" htmlFor="mimport">Import a module</label>
          <input id="mimport" type="file" accept=".json" onChange={importModule} className="text-sm" />
        </div>
      </aside>
    </div>
  );
}
