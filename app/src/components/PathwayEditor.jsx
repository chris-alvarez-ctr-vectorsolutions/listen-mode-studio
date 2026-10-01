import { LOCKS, POLICIES, SUBSCALES, blankObjective, pathwayWarnings, planListens, planParts, routeOf, versionsFor } from '../lib/pathways.js';

// The pathway table: one row per learning objective. The app turns it into the versions, part IDs and
// listens the stages work from, so the model never decides which versions exist.
export default function PathwayEditor({ objectives, onChange, onSuggest, suggesting }) {
  const set = (i, patch) => onChange(objectives.map((o, j) => {
    if (j !== i) return o;
    const next = { ...o, ...patch };
    if (patch.type) { next.subscale = SUBSCALES[patch.type][0]; next.audio = patch.type !== 'Do'; if (patch.type !== 'Know') next.lock = 'open'; }
    return next;
  }));
  const warnings = pathwayWarnings(objectives);
  const parts = planParts(objectives);
  const listens = planListens(objectives);

  return (
    <div className="space-y-3">
      <div>
        <div className="label">Objectives and pathways</div>
        <p className="mb-1 text-xs text-muted">One row per objective, with the ID the course uses (K1, F2, D1). The type, policy and lock decide which audio versions exist and how the pre-check routes to them. Feel scores of 3 or lower count as low. Remedial content and review cards are not audio and aren't written here.</p>
      </div>

      {objectives.map((o, i) => (
        <div key={i} className="rounded-md border border-rule bg-paper p-3">
          <div className="grid gap-2 sm:grid-cols-[80px_1fr]">
            <input aria-label="Objective ID" className="field font-mono" placeholder="K1" value={o.id} onChange={e => set(i, { id: e.target.value.trim() })} />
            <input aria-label="Objective" className="field" placeholder="The learner can…" value={o.objective} onChange={e => set(i, { objective: e.target.value })} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select aria-label="Type" className="field w-auto" value={o.type} onChange={e => set(i, { type: e.target.value })}>
              {Object.keys(SUBSCALES).map(t => <option key={t}>{t}</option>)}
            </select>
            <select aria-label="Subscale" className="field w-auto" value={o.subscale} onChange={e => set(i, { subscale: e.target.value })}>
              {SUBSCALES[o.type].map(t => <option key={t}>{t}</option>)}
            </select>
            <select aria-label="Policy" className="field w-auto" value={o.policy} onChange={e => set(i, { policy: e.target.value })}>
              {POLICIES.map(t => <option key={t}>{t}</option>)}
            </select>
            {o.type === 'Know' && (
              <select aria-label="Compliance lock" className="field w-auto" value={o.lock} onChange={e => set(i, { lock: e.target.value })}>
                {LOCKS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            )}
            {o.type !== 'Do' && (
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={o.audio !== false} onChange={e => set(i, { audio: e.target.checked })} />In the audio</label>
            )}
            <button className="btn ml-auto" onClick={() => onChange(objectives.filter((_, j) => j !== i))}>Remove</button>
          </div>
          <p className="mt-2 text-xs text-muted">{routeOf(o).text}{versionsFor(o).length ? ` Versions: ${versionsFor(o).join(', ')}.` : ''}</p>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => onChange([...objectives, blankObjective()])}>Add objective</button>
        <button className="btn" disabled={suggesting} onClick={onSuggest}>{suggesting ? 'Reading…' : 'Suggest from the seed and source files'}</button>
      </div>

      {warnings.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-900">{warnings.map(w => <li key={w}>{w}</li>)}</ul>}

      {parts.length > 2 && (
        <details className="text-sm">
          <summary className="cursor-pointer">Parts and listens this produces</summary>
          <p className="mt-2 text-xs text-muted">Parts: {parts.map(p => p.id).join(', ')}</p>
          <ul className="mt-1 space-y-1 text-xs text-muted">{listens.map(l => <li key={l.name}><b>{l.name}:</b> {l.parts.join(', ')}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
