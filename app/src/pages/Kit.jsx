import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { exportKit, importKit, kitFiles, loadKit, resetKit, saveKit, withSlots } from '../lib/kit.js';
import { KIND_LABEL, blankDefinition, deleteDefinition, duplicateOf, listDefinitions, loadLibrary, roleApplies, saveDefinition } from '../lib/definitions.js';
import { download, readFileText } from '../lib/download.js';
import DefinitionForm from '../components/DefinitionForm.jsx';

const SECTIONS = [['industries', 'Industries'], ['conversations', 'Conversation types'], ['files', 'Core files'], ['stages', 'Stage prompts']];
const CONV_LAYER = 'Conversation type: ';
const SLOT_TAB = { cast: 'Cast', craft: 'Craft', voice: 'Voice', lint: 'Lint' };   // short tab names: the full file names are long

// The advanced area: what the LXD's choices are made from (industries with their roles, conversation types),
// the core rules and the stage prompts. The sidebar holds one open section at a time.
export default function Kit() {
  const [kit, setKit] = useState(loadKit);
  const [lib, setLib] = useState(loadLibrary);
  const [params, setParams] = useSearchParams();   // the selected item is kept in the address, so a refresh keeps it
  const patchParams = patch => setParams(p => { const n = new URLSearchParams(p); for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k)); return n; });
  const [draft, setDraft] = useState(null);   // a new industry or conversation type not saved yet: { kind, def }
  const [roleDraft, setRoleDraft] = useState(null);   // a new role not saved yet
  const [openRole, setOpenRole] = useState(null);
  const [saved, setSaved] = useState('');

  const files = kitFiles();
  const convOfFile = f => (f?.layer.startsWith(CONV_LAYER) ? listDefinitions('conversation', lib).find(c => CONV_LAYER + c.name === f.layer) : null);

  const wanted = params.get('tab') || 'guideRules';
  const [wKind, wId] = wanted.startsWith('def:') ? wanted.split(':').slice(1) : [];
  const tab = (wanted.startsWith('stage:') ? kit.stages.some(s => `stage:${s.id}` === wanted)
    : wanted.startsWith('def:') ? (wKind !== 'role' && (wId === 'new' ? draft?.kind === wKind : !!listDefinitions(wKind, lib).find(d => d.id === wId)))
    : wanted in kit.files) ? wanted : 'guideRules';
  const isStage = tab.startsWith('stage:');
  const stage = isStage ? kit.stages.find(s => `stage:${s.id}` === tab) : null;
  const [, defKind, defId] = tab.startsWith('def:') ? tab.split(':') : [];
  const def = defKind ? (draft && defId === 'new' ? draft.def : listDefinitions(defKind, lib).find(d => d.id === defId)) : null;
  const file = !defKind && !isStage ? files.find(f => f.key === tab) : null;
  const conv = defKind === 'conversation' ? def : convOfFile(file);
  const section = defKind === 'industry' ? 'industries' : conv ? 'conversations' : isStage ? 'stages' : 'files';
  const sub = defKind === 'industry' && defId !== 'new' && params.get('sub') === 'roles' ? 'roles' : 'definition';

  const open = t => { setDraft(null); setRoleDraft(null); setOpenRole(null); setSaved(''); setParams({ tab: t }); };
  const firstOf = kind => `def:${kind}:${listDefinitions(kind, lib)[0].id}`;
  const goSection = id => open(id === 'industries' ? firstOf('industry') : id === 'conversations' ? firstOf('conversation') : id === 'stages' ? `stage:${kit.stages[0].id}` : 'guideRules');

  function change(value) {
    setSaved('');
    if (stage) setKit({ ...kit, stages: kit.stages.map(s => (s.id === stage.id ? { ...s, prompt: value } : s)) });
    else setKit({ ...kit, files: { ...kit.files, [tab]: value } });
  }
  function save() { saveKit(kit); setSaved('Saved. Every stage uses this kit from now on.'); }
  const startNew = (kind, from) => {
    const base = from ? (kind === 'conversation' ? withSlots(kit, from) : from) : null;
    setDraft({ kind, def: base ? duplicateOf(base) : blankDefinition(kind) });
    setRoleDraft(null); setSaved(''); setParams({ tab: `def:${kind}:new` });
  };
  const saveDef = d => {
    const r = saveDefinition(defKind, d, lib);
    setLib(r.lib); setDraft(null); setParams({ tab: `def:${defKind}:${r.def.id}` }); setSaved('Saved to this browser\'s library.');
  };
  const removeDef = () => {
    if (!confirm(`Delete "${def.name}"? Modules that use it will fall back to the built-in choice.`)) return;
    setLib(deleteDefinition(defKind, def.id, lib)); open(firstOf(defKind)); setSaved('Deleted.');
  };
  // Roles are edited inside their industry's panel.
  const saveRole = d => {
    const r = saveDefinition('role', d, lib);
    setLib(r.lib); setRoleDraft(null); setOpenRole(r.def.id); setSaved('Saved to this browser\'s library.');
  };
  const removeRole = r => {
    if (!confirm(`Delete "${r.name}"? Modules that use it will fall back to no learner role.`)) return;
    setLib(deleteDefinition('role', r.id, lib)); setOpenRole(null); setSaved('Deleted.');
  };
  const newRole = from => {
    const base = from ? duplicateOf(from) : blankDefinition('role');
    setRoleDraft({ ...base, industries: base.industries?.length ? base.industries : [defId] });
    setOpenRole(null); setSaved('');
  };

  const row = (active, onClick, label, tag) => (
    <button key={label} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm ${active ? 'bg-ink font-medium text-white' : 'text-muted hover:bg-paper hover:text-ink'}`} onClick={onClick} aria-current={active ? 'true' : undefined}>
      <span className="truncate">{label}</span>
      {tag && <span className={`shrink-0 text-xs ${active ? 'text-white/70' : 'text-muted'}`}>{tag}</span>}
    </button>
  );
  const subHeading = label => <div className="px-2 pb-1 text-[11px] font-bold uppercase leading-snug tracking-wider text-ink">{label}</div>;
  const defRow = (kind, d, label) => row(tab === `def:${kind}:${d.id}` || (kind === 'conversation' && conv?.id === d.id), () => open(`def:${kind}:${d.id}`), label, d.builtin ? null : 'custom');
  const draftRow = kind => row(tab === `def:${kind}:new`, () => setParams({ tab: `def:${kind}:new` }), `New ${KIND_LABEL[kind].toLowerCase()}…`, 'unsaved');
  const addBtn = (label, onClick) => <button className="mx-2 mt-1 rounded border border-rule px-1.5 py-0.5 text-xs font-medium text-muted hover:border-ink hover:text-ink" onClick={onClick}>{label}</button>;

  // Industries are grouped by the prefix in their name ("EDU: K-12 Faculty" sits under EDU); ones without a prefix go under General.
  const industryGroups = list => {
    const groups = [];
    for (const d of list) {
      const label = d.name.match(/^([^:]+):/)?.[1] || 'General';
      let g = groups.find(x => x.label === label);
      if (!g) { g = { label, items: [] }; groups.push(g); }
      g.items.push(d);
    }
    return groups;
  };

  const sectionBody = id => {
    if (id === 'industries') return (
      <div className="space-y-3 pb-2 pt-1">
        {industryGroups(listDefinitions('industry', lib)).map(g => (
          <div key={g.label}>
            {subHeading(g.label)}
            <div className="space-y-0.5">{g.items.map(d => defRow('industry', d, d.name.startsWith(`${g.label}:`) ? d.name.slice(g.label.length + 1).trim() : d.name))}</div>
          </div>))}
        {draft?.kind === 'industry' && draftRow('industry')}
        {addBtn('+ New industry', () => startNew('industry', null))}
      </div>);
    if (id === 'conversations') return (
      <div className="space-y-0.5 pb-2 pt-1">
        {listDefinitions('conversation', lib).map(d => defRow('conversation', d, d.name))}
        {draft?.kind === 'conversation' && draftRow('conversation')}
        {addBtn('+ Copy a type', () => startNew('conversation', listDefinitions('conversation', lib)[0]))}
      </div>);
    if (id === 'files') return <div className="space-y-0.5 pb-2 pt-1">{files.filter(f => f.layer === 'Core').map(f => row(tab === f.key, () => open(f.key), f.name))}</div>;
    return <div className="space-y-0.5 pb-2 pt-1">{kit.stages.map(s => row(tab === `stage:${s.id}`, () => open(`stage:${s.id}`), `${s.n}. ${s.title}`))}</div>;
  };

  const tabStrip = items => (
    <div role="tablist" className="mb-4 mt-3 flex gap-1 overflow-x-auto border-b border-rule">
      {items.map(([key, label, active, onClick, count]) => (
        <button key={key} role="tab" aria-selected={active} onClick={onClick}
          className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${active ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
          {label}{count != null && <span className="ml-1.5 text-xs font-normal text-muted">{count}</span>}
        </button>))}
    </div>
  );

  const roleCard = (r, shared) => {
    const isOpen = openRole === r.id;
    return (
      <div key={r.id} className="rounded-lg border border-rule">
        <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm" aria-expanded={isOpen} onClick={() => { setOpenRole(isOpen ? null : r.id); setSaved(''); }}>
          <span className="font-medium">{r.name}</span>
          <span className="flex items-center gap-2 text-xs text-muted">
            {shared && <span className="rounded bg-paper px-1.5 py-0.5">All industries</span>}
            {!r.builtin && <span>custom</span>}
            <span aria-hidden>{isOpen ? '▾' : '▸'}</span>
          </span>
        </button>
        {isOpen && (
          <div className="border-t border-rule p-4">
            <DefinitionForm key={r.id} kind="role" initial={r} onSave={saveRole}
              onDuplicate={() => newRole(r)} onDelete={r.builtin ? null : () => removeRole(r)} onCancel={() => setOpenRole(null)} />
            <p className="mt-3 text-sm text-muted">{saved}</p>
          </div>)}
      </div>);
  };

  const rolesPanel = () => {
    const all = listDefinitions('role', lib).filter(r => roleApplies(r, defId));
    const specific = all.filter(r => r.industries?.length);
    const shared = all.filter(r => !r.industries?.length);
    return (
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Roles for {def.name}</h3>
            <button className="btn" onClick={() => newRole(null)}>+ New role</button>
          </div>
          <div className="space-y-2">
            {roleDraft && (
              <div className="rounded-lg border border-ink p-4">
                <div className="mb-3 text-sm font-medium">New learner role <span className="text-xs font-normal text-muted">unsaved</span></div>
                <DefinitionForm key="new-role" kind="role" initial={roleDraft} onSave={saveRole} onCancel={() => setRoleDraft(null)} />
              </div>)}
            {specific.map(r => roleCard(r, false))}
            {!specific.length && !roleDraft && <p className="rounded-lg border border-rule bg-paper p-3 text-sm text-muted">No roles are specific to this industry yet. The shared roles below still apply.</p>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Also available here</h3>
          <p className="mb-2 text-xs text-muted">These apply to every industry. Editing one here changes it everywhere.</p>
          <div className="space-y-2">{shared.map(r => roleCard(r, true))}</div>
        </div>
      </div>);
  };

  const definitionPanel = () => (
    <>
      <p className="mb-4 text-sm text-muted">{def.builtin ? 'Built-in definitions are read-only. Duplicate one to make your own.' : 'Stored in this browser. Export the library to share it.'}</p>
      <DefinitionForm key={tab} kind={defKind} initial={def}
        onSave={saveDef}
        onDuplicate={def.builtin || defId !== 'new' ? () => startNew(defKind, def) : null}
        onDelete={!def.builtin && defId !== 'new' ? removeDef : null}
        onCancel={draft ? () => { setDraft(null); open(firstOf(defKind)); } : null} />
      <p className="mt-3 text-sm text-muted">{saved}</p>
    </>
  );

  const editor = (
    <>
      <textarea className="field h-[65vh] font-mono text-xs leading-relaxed" value={stage ? stage.prompt : kit.files[tab] ?? ''} onChange={e => change(e.target.value)} />
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" onClick={save}>Save kit</button>
        <span className="text-sm text-muted">{saved}</span>
      </div>
    </>
  );

  // A built-in conversation type keeps its text in kit files: they sit beside its summary as tabs.
  const convTabs = () => tabStrip([
    ['summary', 'Summary', !!defKind, () => open(`def:conversation:${conv.id}`)],
    ...files.filter(f => f.layer === CONV_LAYER + conv.name).map(f => [f.key, SLOT_TAB[f.key.split('.').pop()] || f.name, tab === f.key, () => open(f.key)]),
  ]);

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
          <div className="max-h-[75vh] overflow-y-auto">
            {SECTIONS.map(([id, label]) => (
              <div key={id} className="border-b border-rule last:border-b-0">
                <button className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-[11px] font-bold uppercase tracking-widest ${section === id ? 'text-ink' : 'text-muted hover:text-ink'}`}
                  aria-expanded={section === id} onClick={() => section !== id && goSection(id)}>
                  <span>{label}</span>
                  <span aria-hidden className="text-xs font-normal">{section === id ? '▾' : '▸'}</span>
                </button>
                {section === id && sectionBody(id)}
              </div>))}
          </div>
        </aside>
        <section className="min-w-0 rounded-lg border border-rule bg-panel p-6">
          {defKind === 'industry' && def && (
            <>
              <h2 className="text-lg font-semibold">{def.name || 'New industry'}{def.builtin ? <span className="ml-2 text-sm font-normal text-muted">built in</span> : null}</h2>
              {defId === 'new' ? <div className="mt-3" /> : tabStrip([
                ['definition', 'Definition', sub === 'definition', () => patchParams({ sub: null }), null],
                ['roles', 'Roles', sub === 'roles', () => { setOpenRole(null); setRoleDraft(null); setSaved(''); patchParams({ sub: 'roles' }); },
                  listDefinitions('role', lib).filter(r => roleApplies(r, defId)).length]])}
              {sub === 'roles' ? rolesPanel() : definitionPanel()}
            </>)}
          {defKind === 'conversation' && def && (
            <>
              <h2 className="text-lg font-semibold">{def.name || 'New conversation type'}{def.builtin ? <span className="ml-2 text-sm font-normal text-muted">built in</span> : null}</h2>
              {def.builtin ? convTabs() : <div className="mt-3" />}
              {definitionPanel()}
            </>)}
          {!defKind && conv && (
            <>
              <h2 className="text-lg font-semibold">{conv.name}<span className="ml-2 text-sm font-normal text-muted">built in</span></h2>
              {convTabs()}
              {editor}
            </>)}
          {!defKind && !conv && editor}
        </section>
      </div>
    </div>
  );
}
