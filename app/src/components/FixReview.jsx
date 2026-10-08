import Markdown from './Markdown.jsx';
import { splitFixItems } from '../lib/sections.js';

// The editor pass as one card per problem: apply it, skip it, or apply it with your own change to the fix.
export default function FixReview({ text, state = {}, onChange, disabled, applyLabel, applyDisabled, onApply, locked = false }) {
  const parts = splitFixItems(text);
  if (!parts) return <Markdown text={text} />;
  const set = (n, patch) => onChange(n, { ...state[n], ...patch });
  // Fixes already applied to the script can't be changed here.
  const setAll = (list, decision) => list.filter(it => state[it.n]?.decision !== 'done').forEach(it => onChange(it.n, { ...state[it.n], decision }));
  const applying = parts.items.filter(it => state[it.n]?.decision === 'apply').length;
  const decided = parts.items.filter(it => state[it.n]?.decision).length;
  const undecided = parts.items.filter(it => !state[it.n]?.decision);
  const appliedBefore = parts.items.filter(it => state[it.n]?.decision === 'done').length;

  return (
    <div className="space-y-3">
      {parts.intro && <div className="text-muted"><Markdown text={parts.intro} className="prose-tight" /></div>}
      {!locked && <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule bg-panel px-3 py-2 text-sm">
        <span><strong>{decided} of {parts.items.length}</strong> decided{appliedBefore > 0 && `, ${appliedBefore} already applied`}, {applying} will be applied.{undecided.length > 0 && <span className="text-amber-900"> {undecided.length} undecided won't be.</span>}</span>
        <span className="flex gap-2">
          <button className="btn" disabled={disabled} onClick={() => setAll(parts.items, 'apply')}>Apply all</button>
          {undecided.length > 0 && decided > 0 && <button className="btn" disabled={disabled} onClick={() => setAll(undecided, 'skip')}>Skip the {undecided.length} undecided</button>}
          <button className="btn" disabled={disabled} onClick={() => setAll(parts.items, 'skip')}>Skip all</button>
          {onApply && <button className="btn-primary" disabled={applyDisabled} onClick={onApply}>{applyLabel}</button>}
        </span>
      </div>}
      {parts.items.map(it => {
        const st = state[it.n] || {};
        const inGroup = parts.items.filter(x => x.group === it.group);
        return (
          <div key={it.n}>
            {it.group && it.groupNote !== undefined && parts.items.find(x => x.group === it.group) === it && (
              <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-2 first:mt-0">
                <h3 className="font-ui text-sm font-semibold uppercase tracking-wide">{it.group} <span className="font-normal normal-case text-muted">({inGroup.length})</span></h3>
                {!locked && <span className="flex gap-2 text-sm">
                  <button className="underline" disabled={disabled} onClick={() => setAll(inGroup, 'apply')}>Apply all in this group</button>
                  <button className="underline" disabled={disabled} onClick={() => setAll(inGroup, 'skip')}>Skip all in this group</button>
                </span>}
              </div>
            )}
            {it.group && parts.items.find(x => x.group === it.group) === it && it.groupNote && <div className="mb-2 text-sm text-muted"><Markdown text={it.groupNote} className="prose-tight" /></div>}
            <section className={`rounded-md border p-4 ${st.decision === 'apply' || st.decision === 'done' ? 'border-dana bg-panel' : st.decision === 'skip' ? 'border-rule bg-paper' : decided > 0 && !locked ? 'border-amber-300 bg-amber-50' : 'border-rule bg-paper'}`}>
              <div className={`flex items-start gap-3 ${st.decision === 'skip' ? 'opacity-60' : ''}`}>
                <span className="mt-0.5 font-mono text-xs text-muted">{it.label}</span>
                <div className="min-w-0 flex-1"><Markdown text={it.text} className="prose-tight" /></div>
              </div>
              {/* Undecided: two choices. Decided: what was chosen, and a way to take it back. Applied: final. */}
              {locked ? (
                <div className="mt-3 text-sm font-medium text-muted">{st.decision === 'done' ? '✓ Applied' : st.decision === 'skip' ? 'Skipped' : 'Not decided'}</div>
              ) : st.decision === 'done' ? (
                <div className="mt-3 text-sm font-medium text-dana">✓ Applied to the script</div>
              ) : !st.decision ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button className="btn" disabled={disabled} onClick={() => set(it.n, { decision: 'apply' })}>Apply this fix</button>
                  <button className="btn" disabled={disabled} onClick={() => set(it.n, { decision: 'skip' })}>Skip</button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className={`font-medium ${st.decision === 'apply' ? 'text-dana' : 'text-muted'}`}>
                    {st.decision === 'apply' ? '✓ Will be applied' : 'Skipped'}
                  </span>
                  <button className="underline" disabled={disabled} onClick={() => set(it.n, { decision: null, edit: '' })}>Undo</button>
                </div>
              )}
              {st.decision === 'apply' && !locked && (
                <input aria-label={`Your change to fix ${it.label}`} className="field mt-2" placeholder="Optional: change the fix, in your words" disabled={disabled}
                  value={st.edit || ''} onChange={e => set(it.n, { edit: e.target.value })} />
              )}
            </section>
          </div>
        );
      })}
    </div>
  );
}
