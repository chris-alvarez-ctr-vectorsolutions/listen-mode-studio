import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteModule, listModules, newModule, saveModule } from '../lib/store.js';
import { download, readFileText } from '../lib/download.js';
import { startingSetup } from '../lib/definitions.js';
import { canMakeVariant, versionLabel } from '../lib/variants.js';

export default function Modules() {
  const [mods, setMods] = useState([]);
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const refresh = () => listModules().then(setMods);
  useEffect(() => { refresh(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const m = await saveModule(newModule(name.trim(), startingSetup()));
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

  // Variants sit under their base module. A variant whose base has been deleted is listed on its own.
  const ids = new Set(mods.map(m => m.id));
  const rows = mods.filter(m => !m.parentId || !ids.has(m.parentId)).flatMap(m => [{ m, child: false }, ...mods.filter(x => x.parentId === m.id).map(x => ({ m: x, child: true }))]);
  const variantLabel = m => versionLabel(m.setup);

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_320px]">
      <section>
        <h1 className="text-2xl font-semibold">Modules</h1>
        <p className="mt-1 text-muted">Each module goes from source content to rendered audio. Its work stays in this browser.</p>
        <ul className="mt-6 divide-y divide-rule rounded-lg border border-rule bg-panel">
          {mods.length === 0 && <li className="p-5 text-muted">No modules yet. Start one on the right.</li>}
          {rows.map(({ m, child }) => (
            <li key={m.id} className={`flex items-center justify-between gap-4 p-4 ${child ? 'bg-paper pl-10' : ''}`}>
              <div>
                <Link to={`/m/${m.id}`} className="font-medium hover:underline">{child ? variantLabel(m) : m.name}</Link>
                {child && <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-xs text-muted ring-1 ring-rule">Version</span>}
                {m.description?.trim() && <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted">{m.description}</div>}
                <div className="text-sm text-muted">Updated {new Date(m.updatedAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                {!child && canMakeVariant(m) && <Link className="btn" to={`/m/${m.id}?stage=newversion`}>New version</Link>}
                <button className="btn" onClick={() => download(`${m.name}.module.json`, JSON.stringify(m, null, 2))}>Export</button>
                <button className="btn" onClick={async () => { if (confirm(`Delete "${m.name}" and its audio?${mods.some(x => x.parentId === m.id) ? ' Its variants are kept, but they will no longer be linked to it.' : ''}`)) { await deleteModule(m.id); refresh(); } }}>Delete</button>
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
