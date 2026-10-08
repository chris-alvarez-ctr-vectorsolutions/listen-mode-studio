import FixReview from './FixReview.jsx';
import ScriptReview from './ScriptReview.jsx';

// Step 7 after the fixes are settled: what happened, the script as it now stands, and what was decided.
// Nothing here runs anything, so there is nothing to prompt a second run.
export default function EditorResult({ applied, review, state, script }) {
  // Fixes applied before this step recorded its result: the count comes from the choices, and the script is in the validity pass.
  const legacy = !applied ? Object.values(state || {}).filter(v => v.decision === 'apply' || v.decision === 'done').length : 0;
  const n = applied ? applied.count || 0 : legacy;
  const time = applied?.at ? new Date(applied.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const rest = applied ? [applied.skipped ? `${applied.skipped} skipped` : '', applied.undecided ? `${applied.undecided} not decided` : '', time ? `applied at ${time}` : ''].filter(Boolean).join(' · ') : '';
  return (
    <div className="space-y-4">
      <div className={`rounded-md border p-4 ${n ? 'border-dana bg-panel' : 'border-rule bg-paper'}`}>
        <div className={`font-medium ${n ? 'text-dana' : ''}`}>{n ? `✓ ${n} fix${n > 1 ? 'es' : ''} applied to the script` : 'No fixes were applied'}</div>
        {rest && <p className="mt-1 text-sm text-muted">{rest.charAt(0).toUpperCase() + rest.slice(1)}.</p>}
        <p className="mt-1 max-w-prose text-sm text-muted">{n ? (applied ? 'The script is updated. Nothing more to run on this step. The next step reads this version.' : 'The script is updated (see it in the Validity pass). Nothing more to run on this step.') : 'You moved on without changing the script. The next step reads it as it was.'}</p>
      </div>
      {script && (
        <details className="rounded-md border border-rule p-4">
          <summary className="cursor-pointer font-medium">Show the updated script</summary>
          <div className="mt-3"><ScriptReview text={script} readOnly /></div>
        </details>
      )}
      <details className="rounded-md border border-rule p-4">
        <summary className="cursor-pointer font-medium">What was decided on each fix</summary>
        <div className="mt-3"><FixReview text={review} state={state} locked /></div>
      </details>
    </div>
  );
}
