import { useState } from 'react';
import { FIELDS, KIND_LABEL, PERSONA_KEYS, listDefinitions } from '../lib/definitions.js';

const SLOT_FIELDS = [
  { id: 'cast', label: 'The format and the cast', rows: 14, help: 'What this show is and who is in it, one block per speaker. Write {{background:expert}} (or host, guest) on its own bullet line to place that speaker\'s background; without it, the background is added at the end.' },
  { id: 'craft', label: 'Craft, length and render rules', rows: 14, help: 'The open and close, line-by-line rules, word counts per part, and the ElevenLabs conventions for these voices.' },
  { id: 'voice', label: 'Register sample (optional)', rows: 8, help: 'A short sample of the tone to match. Keep it to register: it is a model for how the hosts sound, not a script to follow.' },
  { id: 'lint', label: 'Extra checks (optional)', rows: 6, help: 'Checks for the validity pass that only apply to this conversation type.' },
];

// One form for all three kinds. onSave gets the finished definition; a built-in shows read-only.
export default function DefinitionForm({ kind, initial, onSave, onCancel, onDuplicate, onDelete }) {
  const [d, setD] = useState(initial);
  const readOnly = !!initial.builtin;
  const set = patch => setD(x => ({ ...x, ...patch }));
  const setSlot = (id, v) => setD(x => ({ ...x, slots: { ...x.slots, [id]: v } }));
  const setPersona = (id, v) => setD(x => ({ ...x, personas: { ...x.personas, [id]: v } }));
  const setSpeaker = (i, patch) => setD(x => ({ ...x, speakers: x.speakers.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const valid = d.name.trim() && (kind !== 'conversation' || (d.speakers.length >= 1 && d.speakers.every(s => s.name.trim()) && d.slots.cast.trim() && d.slots.craft.trim()));

  const text = (id, label, help, rows, value, onChange) => (
    <div key={id}>
      <label className="label" htmlFor={`def-${id}`}>{label}</label>
      {help && <p className="mb-1 text-xs text-muted">{help}</p>}
      <textarea id={`def-${id}`} className="field font-script" rows={rows} readOnly={readOnly} value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  );

  return (
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); if (valid && !readOnly) onSave({ ...d, name: d.name.trim(), speakers: d.speakers?.map(s => ({ ...s, name: s.name.trim().toUpperCase() })) }); }}>
      <div>
        <label className="label" htmlFor="def-name">{KIND_LABEL[kind]} name</label>
        <input id="def-name" className="field" readOnly={readOnly} value={d.name} onChange={e => set({ name: e.target.value })} />
      </div>

      {kind === 'industry' && <>
        {FIELDS.industry.map(f => text(f.id, f.label, f.help, f.rows, d[f.id], v => set({ [f.id]: v })))}
        <div className="space-y-3">
          <div>
            <div className="label">Backgrounds for the hosts and guests</div>
            <p className="text-xs text-muted">Title and experience for each speaker who needs one, so a nurse educator sounds like one. Describe employers generically. Never name a real company. A background is characterization only and never carries a fact.</p>
          </div>
          {PERSONA_KEYS.map(p => text(`persona-${p.id}`, `${p.label} background`, '', 2, d.personas?.[p.id], v => setPersona(p.id, v)))}
        </div>
      </>}

      {kind === 'role' && <>
        {FIELDS.role.map(f => text(f.id, f.label, f.help, f.rows, d[f.id], v => set({ [f.id]: v })))}
        <fieldset>
          <legend className="label">Applies to</legend>
          <p className="mb-2 text-xs text-muted">Leave every box unchecked for a role that fits any industry, like a new hire. Check industries to offer this role only there.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {listDefinitions('industry').map(ind => (
              <label key={ind.id} className="flex items-center gap-1.5">
                <input type="checkbox" disabled={readOnly} checked={(d.industries || []).includes(ind.id)}
                  onChange={e => set({ industries: e.target.checked ? [...(d.industries || []), ind.id] : (d.industries || []).filter(x => x !== ind.id) })} />
                {ind.name}
              </label>
            ))}
          </div>
          {readOnly && !(d.industries || []).length && <p className="mt-2 text-xs text-muted">This role applies to every industry.</p>}
        </fieldset>
      </>}

      {kind === 'conversation' && <>
        {text('summary', 'Summary', 'One line on what this conversation is.', 2, d.summary, v => set({ summary: v }))}
        <div>
          <div className="label">Speakers</div>
          <p className="mb-2 text-xs text-muted">Names are in capitals and match the voices in Settings. A speaker marked with a background gets one written for them in each module.</p>
          <div className="space-y-2">
            {d.speakers.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input aria-label="Speaker name" className="field w-36 uppercase" readOnly={readOnly} value={s.name} onChange={e => setSpeaker(i, { name: e.target.value.toUpperCase() })} />
                <input aria-label="Job on the show" className="field w-44" placeholder="Job on the show" readOnly={readOnly} value={s.job || ''} onChange={e => setSpeaker(i, { job: e.target.value })} />
                <select aria-label={`Background for ${s.name || 'speaker'}`} className="select" disabled={readOnly} value={s.background || ''} onChange={e => setSpeaker(i, { background: e.target.value })}>
                  <option value="">No background</option>
                  {PERSONA_KEYS.map(p => <option key={p.id} value={p.id}>{p.label} background</option>)}
                </select>
                {!readOnly && d.speakers.length > 1 && <button type="button" className="btn" onClick={() => set({ speakers: d.speakers.filter((_, j) => j !== i) })}>Remove</button>}
              </div>
            ))}
          </div>
          {!readOnly && <button type="button" className="btn mt-2" onClick={() => set({ speakers: [...d.speakers, { name: '', job: '', background: '' }] })}>Add speaker</button>}
        </div>
        {readOnly
          ? <p className="rounded-md border border-rule bg-paper p-3 text-sm text-muted">This is the built-in conversation type. Its text lives in the kit's files (Advanced). To make your own version, duplicate it.</p>
          : SLOT_FIELDS.map(f => text(f.id, f.label, f.help, f.rows, d.slots?.[f.id], v => setSlot(f.id, v)))}
      </>}

      <div className="flex flex-wrap items-center gap-2">
        {!readOnly && <button className="btn-primary" type="submit" disabled={!valid}>Save</button>}
        {onDuplicate && <button type="button" className="btn" onClick={onDuplicate}>Duplicate as custom</button>}
        {onCancel && <button type="button" className="btn" onClick={onCancel}>{readOnly ? 'Close' : 'Cancel'}</button>}
        {onDelete && !readOnly && <button type="button" className="btn ml-auto" onClick={onDelete}>Delete</button>}
      </div>
    </form>
  );
}
