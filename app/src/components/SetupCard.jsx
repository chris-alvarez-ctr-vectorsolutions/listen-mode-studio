import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KIND_LABEL, blankDefinition, duplicateOf, listDefinitions, loadLibrary, rememberSetup, resolveSetup, roleApplies, saveDefinition } from '../lib/definitions.js';
import { loadKit, withSlots } from '../lib/kit.js';
import { loadSettings } from '../lib/store.js';
import DefinitionForm from './DefinitionForm.jsx';

const ADD = '__add__';
const ROWS = [
  { kind: 'industry', key: 'industry', label: 'Industry' },
  { kind: 'role', key: 'role', label: 'Learner role' },
  { kind: 'conversation', key: 'conversation', label: 'Conversation type' },
];

// The three choices that shape a module's voice, plus the background for each speaker who needs one.
export default function SetupCard({ setup, onChange, title = 'Show setup', hint = 'Who this is for, where it is set, and how the show is built. Pick from the list or add your own.' }) {
  const [lib, setLib] = useState(loadLibrary);
  const [adding, setAdding] = useState(null);   // { kind, draft }
  const r = resolveSetup(setup, lib);
  const s = { ...(setup || {}), industry: setup?.industry ?? r.industry?.id, role: setup?.role ?? '', conversation: setup?.conversation ?? r.conversation.id };
  const pick = (row, id) => {
    if (id === ADD) {
      const current = r[row.kind];
      const base = current ? (row.kind === 'conversation' ? withSlots(loadKit(), current) : current) : null;
      // A conversation type is long, so it starts as a copy. An industry or a role starts blank.
      setAdding({ kind: row.kind, copy: base ? duplicateOf(base) : null, from: row.kind === 'conversation' ? 'copy' : 'blank', currentName: current?.name });
      return;
    }
    const next = { ...s, [row.key]: id, backgrounds: row.kind === 'role' ? s.backgrounds : {} };   // new industry or conversation: fresh backgrounds
    // A role specific to another industry doesn't carry over to a new one.
    if (row.kind === 'industry') {
      const role = listDefinitions('role', lib).find(x => x.id === s.role);
      if (role && !roleApplies(role, id)) next.role = 'frontline';
    }
    rememberSetup(next);
    onChange(next);
  };
  const saveCustom = def => {
    const { lib: next, def: saved } = saveDefinition(adding.kind, def, lib);
    setLib(next);
    const row = ROWS.find(x => x.kind === adding.kind);
    const nextSetup = { ...s, [row.key]: saved.id, backgrounds: row.kind === 'role' ? s.backgrounds : {} };
    rememberSetup(nextSetup);
    onChange(nextSetup);
    setAdding(null);
  };

  const speakers = (r.conversation.speakers || []).filter(x => x.background);
  const known = new Set(loadSettings().voices.filter(v => v.voiceId).map(v => v.speaker));
  const noVoice = (r.conversation.speakers || []).map(x => x.name).filter(n => !known.has(n));

  return (
    <div className="space-y-4 rounded-md border border-rule bg-paper p-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {ROWS.map(row => {
          const options = listDefinitions(row.kind, lib);
          return (
            <div key={row.key}>
              <label className="label" htmlFor={`setup-${row.key}`}>{row.label}</label>
              <select id={`setup-${row.key}`} className="select w-full" value={s[row.key] || ''} onChange={e => pick(row, e.target.value)}>
                {row.kind === 'role' && <option value="">None chosen</option>}
                {row.kind === 'role'
                  ? (() => {
                      const here = options.filter(o => roleApplies(o, s.industry));
                      const generic = here.filter(o => !o.industries?.length), specific = here.filter(o => o.industries?.length);
                      const current = options.find(o => o.id === s.role && !here.includes(o));   // keep an existing choice visible
                      const opt = o => <option key={o.id} value={o.id}>{o.name}{o.builtin ? '' : ' (custom)'}</option>;
                      return <>
                        <optgroup label="Any industry">{generic.map(opt)}</optgroup>
                        {specific.length > 0 && <optgroup label={r.industry?.name || 'This industry'}>{specific.map(opt)}</optgroup>}
                        {current && <optgroup label="Not for this industry">{opt(current)}</optgroup>}
                      </>;
                    })()
                  : options.map(o => <option key={o.id} value={o.id}>{o.name}{o.builtin ? '' : ' (custom)'}</option>)}
                <option value={ADD}>Add custom…</option>
              </select>
            </div>
          );
        })}
      </div>
      {r.conversation.summary && <p className="text-sm text-muted">{r.conversation.summary}</p>}
      {r.warnings.map(w => <p key={w} role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">{w}</p>)}

      {speakers.length > 0 && (
        <div className="space-y-3">
          {speakers.map(sp => {
            const fallback = (r.industry?.personas?.[sp.background] || '').trim();
            const overridden = s.backgrounds?.[sp.name] != null && s.backgrounds[sp.name] !== fallback;
            return (
              <div key={sp.name}>
                <label className="label" htmlFor={`bg-${sp.name}`}>{sp.name} ({sp.job || sp.background}): title and experience</label>
                <textarea id={`bg-${sp.name}`} className="field font-script" rows={2} value={r.backgrounds[sp.name] || ''}
                  placeholder="A short line on their career. Describe employers generically."
                  onChange={e => onChange({ ...s, backgrounds: { ...s.backgrounds, [sp.name]: e.target.value } })} />
                <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                  <span>{overridden ? 'Edited for this module.' : `From the ${r.industry?.name || 'industry'} definition.`} It is characterization only and never carries a fact.</span>
                  {overridden && <button type="button" className="underline" onClick={() => { const b = { ...s.backgrounds }; delete b[sp.name]; onChange({ ...s, backgrounds: b }); }}>Use the industry's</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {noVoice.length > 0 && <p className="text-sm text-muted">No voice is set yet for {noVoice.join(', ')}. Add {noVoice.length > 1 ? 'them' : 'it'} in <Link className="underline" to="/settings">Settings</Link> before you render.</p>}

      {adding && (
        <div role="dialog" aria-modal="true" aria-label={`Add a custom ${KIND_LABEL[adding.kind].toLowerCase()}`} className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/40 p-6">
          <div className="w-full max-w-2xl rounded-lg border border-rule bg-panel p-6">
            <h3 className="mb-1 text-lg font-semibold">Add a custom {KIND_LABEL[adding.kind].toLowerCase()}</h3>
            <p className="mb-3 text-sm text-muted">Saving adds it to this browser's library and selects it for this module.</p>
            {adding.copy && adding.kind !== 'conversation' && (
              <div role="radiogroup" aria-label="Start from" className="mb-4 inline-flex gap-1 rounded-md bg-paper p-1 text-sm">
                {[['blank', 'Start blank'], ['copy', `Copy of ${adding.currentName}`]].map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={adding.from === id} onClick={() => setAdding({ ...adding, from: id })}
                    className={`rounded px-3 py-1 ${adding.from === id ? 'bg-panel font-medium shadow-sm' : 'text-muted hover:text-ink'}`}>{label}</button>
                ))}
              </div>
            )}
            {adding.kind === 'conversation' && <p className="mb-4 text-sm text-muted">It starts as a copy of {adding.currentName}, since a conversation type has a lot of text.</p>}
            <DefinitionForm key={adding.from} kind={adding.kind} initial={adding.from === 'copy' && adding.copy ? adding.copy : { id: '', name: '', ...blankFor(adding.kind) }} onSave={saveCustom} onCancel={() => setAdding(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

const blankFor = kind => { const { id, name, ...rest } = blankDefinition(kind); return rest; };
