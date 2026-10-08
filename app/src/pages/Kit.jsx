import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { exportKit, importKit, kitFiles, loadKit, resetKit, saveKit, withSlots } from '../lib/kit.js';
import { KIND_LABEL, blankDefinition, deleteDefinition, duplicateOf, listDefinitions, loadLibrary, saveDefinition } from '../lib/definitions.js';
import { download, readFileText } from '../lib/download.js';
import DefinitionForm from '../components/DefinitionForm.jsx';

const KINDS = ['industry', 'role', 'conversation'];
const GROUP = { industry: 'Industries', role: 'Learner roles', conversation: 'Conversation types' };
const tabBtn = active => `block w-full rounded-md px-3 py-1.5 text-left text-sm ${active ? 'bg-ink text-white' : 'hover:bg-panel'}`;

// The advanced area: what the LXD's choices are made from (definitions), the core rules and the stage prompts.
export default function Kit() {
  const [kit, setKit] = useState(loadKit);
  const [lib, setLib] = useState(loadLibrary);
  const [params, setParams] = useSearchParams();   // the selected item is kept in the address, so a refresh keeps it
  const setTab = t => setParams(p => { const n = new URLSearchParams(p); n.set('tab', t); return n; });
  const [draft, setDraft] = useState(null);   // a new definition not saved yet: { kind, def }
  const [saved, setSaved] = useState('');
  const wanted = params.get('tab') || 'guideRules';
  const [wKind, wId] = wanted.startsWith('def:') ? wanted.split(':').slice(1) : [];
  const tab = (wanted.startsWith('stage:') ? kit.stages.some(s => `stage:${s.id}` === wanted)
    : wanted.startsWith('def:') ? (wId === 'new' ? draft?.kind === wKind : !!listDefinitions(wKind, lib).find(d => d.id === wId))
    : wanted in kit.files) ? wanted : 'guideRules';
  const layers = kitFiles().reduce((acc, f) => { (acc[f.layer] ||= []).push(f); return acc; }, {});
  const isStage = tab.startsWith('stage:');
  const stage = isStage ? kit.stages.find(s => `stage:${s.id}` === tab) : null;
  const [, defKind, defId] = tab.startsWith('def:') ? tab.split(':') : [];
  const section = tab.startsWith('def:') ? 'defs' : isStage ? 'stages' : 'files';
  const goSection = id => open(id === 'defs' ? `def:${KINDS[0]}:${listDefinitions(KINDS[0], lib)[0].id}` : id === 'stages' ? `stage:${kit.stages[0].id}` : 'guideRules');
  const def = defKind ? (draft && defId === 'new' ? draft.def : listDefinitions(defKind, lib).find(d => d.id === defId)) : null;

  function change(value) {
    setSaved('');
    if (stage) setKit({ ...kit, stages: kit.stages.map(s => (s.id === stage.id ? { ...s, prompt: value } : s)) });
    else setKit({ ...kit, files: { ...kit.files, [tab]: value } });
  }
  function save() { saveKit(kit); setSaved('Saved. Every stage uses this kit from now on.'); }
  const open = (t) => { setDraft(null); setSaved(''); setTab(t); };
  const startNew = (kind, from) => {
    const base = from ? (kind === 'conversation' ? withSlots(kit, from) : from) : null;
    setDraft({ kind, def: base ? duplicateOf(base) : blankDefinition(kind) });
    setSaved(''); setTab(`def:${kind}:new`);
  };
  const saveDef = d => {
    const r = saveDefinition(defKind, d, lib);
    setLib(r.lib); setDraft(null); setTab(`def:${defKind}:${r.def.id}`); setSaved('Saved to this browser\'s library.');
  };
  const removeDef = () => {
    if (!confirm(`Delete "${def.name}"? Modules that use it will fall back to the built-in choice.`)) return;
    setLib(deleteDefinition(defKind, def.id, lib)); setTab(`def:${defKind}:${listDefinitions(defKind)[0].id}`); setSaved('Deleted.');
  };

  const row = (active, onClick, label, tag) => (
    <button key={label} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm ${active ? 'bg-ink font-medium text-white' : 'text-muted hover:bg-paper hover:text-ink'}`} onClick={onClick} aria-current={active ? 'true' : undefined}>
      <span className="truncate">{label}</span>
      {tag && <span className={`shrink-0 text-xs ${active ? 'text-white/70' : 'text-muted'}`}>{tag}</span>}
    </button>
  );
  // A group: a heading with an optional action, then its rows indented under a rule.
  const group = (key, title, action, rows) => (
    <div key={key} className="mt-3 border-t border-rule pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink">{title}</h3>
        {action}
      </div>
      <div className="ml-1 space-y-0.5 border-l-2 border-rule pl-1.5">{rows}</div>
    </div>
  );
  const addBtn = (label, onClick) => <button className="rounded border border-rule px-1.5 py-0.5 text-xs font-medium text-muted hover:border-ink hover:text-ink" onClick={onClick}>{label}</button>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold">Advanced</h1>
          <p className="mt-1 text-sm text-muted">For power users. Writers choose an industry, a learner role and a conversation type on each module, and add their own there. Manage those definitions here, along with the core rules and stage prompts behind every script. Edits here change every module.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => download('module-audio-kit.json', exportKit(kit))}>Export</button>
          <label className="btn cursor-pointer">Import
            <input type="file" accept=".json" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { importKit(await readFileText(f)); setKit(loadKit()); setLib(loadLibrary()); setSaved('Imported.'); } catch (err) { setSaved(err.message); } }} />
          </label>
          <button className="btn" onClick={() => { if (confirm('Reset the kit files and stage prompts to the built-in version? Your edits and saved rules will be lost. Your custom definitions are kept.')) { resetKit(); setKit(loadKit()); } }}>Reset kit</button>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[250px_1fr]">
        <aside className="rounded-lg border border-rule bg-panel p-2 lg:sticky lg:top-4">
          <div role="tablist" className="mb-2 grid grid-cols-3 gap-1 rounded-md bg-paper p-1 text-xs font-medium">
            {[['defs', 'Definitions'], ['files', 'Kit files'], ['stages', 'Stages']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={section === id} onClick={() => goSection(id)}
                className={`rounded px-1 py-1.5 ${section === id ? 'bg-panel shadow-sm' : 'text-muted hover:text-ink'}`}>{label}</button>
            ))}
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-1 pb-1">
            {section === 'defs' && KINDS.map(kind => group(kind, GROUP[kind],
              addBtn(kind === 'conversation' ? '+ Copy' : '+ New', () => startNew(kind, kind === 'conversation' ? listDefinitions(kind, lib)[0] : null)),
              <>
                {listDefinitions(kind, lib).map(d => row(tab === `def:${kind}:${d.id}`, () => open(`def:${kind}:${d.id}`), d.name, d.builtin ? null : 'custom'))}
                {draft?.kind === kind && row(tab === `def:${kind}:new`, () => setTab(`def:${kind}:new`), `New ${KIND_LABEL[kind].toLowerCase()}…`, 'unsaved')}
              </>))}
            {section === 'files' && Object.entries(layers).map(([layer, files]) => group(layer, layer.replace('Conversation type: ', ''), null,
              files.map(f => row(tab === f.key, () => open(f.key), f.name))))}
            {section === 'stages' && group('stages', 'Stage prompts', null, kit.stages.map(s => row(tab === `stage:${s.id}`, () => open(`stage:${s.id}`), `${s.n}. ${s.title}`)))}
          </div>
        </aside>
        <section className="min-w-0 rounded-lg border border-rule bg-panel p-6">
          {def ? (
            <>
              <h2 className="mb-1 text-lg font-semibold">{KIND_LABEL[defKind]}{def.builtin ? ' (built in)' : ''}</h2>
              <p className="mb-4 text-sm text-muted">{def.builtin ? 'Built-in definitions are read-only. Duplicate one to make your own.' : 'Stored in this browser. Export the library to share it.'}</p>
              <DefinitionForm key={tab} kind={defKind} initial={def}
                onSave={saveDef}
                onDuplicate={def.builtin || defId !== 'new' ? () => startNew(defKind, def) : null}
                onDelete={!def.builtin && defId !== 'new' ? removeDef : null}
                onCancel={draft ? () => { setDraft(null); setTab(`def:${defKind}:${listDefinitions(defKind, lib)[0].id}`); } : null} />
              <p className="mt-3 text-sm text-muted">{saved}</p>
            </>
          ) : (
            <>
              <textarea className="field h-[65vh] font-mono text-xs leading-relaxed" value={stage ? stage.prompt : kit.files[tab]} onChange={e => change(e.target.value)} />
              <div className="mt-3 flex items-center gap-3">
                <button className="btn-primary" onClick={save}>Save kit</button>
                <span className="text-sm text-muted">{saved}</span>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
