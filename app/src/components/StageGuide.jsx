// What a stage is for, what to look at before approving it, and what comes next. Shown above every stage's output.
export default function StageGuide({ stage }) {
  if (!stage.purpose) return null;
  return (
    <details open className="mt-4 rounded-md border border-rule bg-paper p-4 text-sm [&>*:not(summary)]:max-w-prose">
      <summary className="cursor-pointer font-medium">What this stage is for</summary>
      <p className="mt-2">{stage.purpose}</p>
      {stage.check?.length > 0 && (
        <>
          <div className="mt-3 font-medium">Before you approve, check</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">{stage.check.map(c => <li key={c}>{c}</li>)}</ul>
        </>
      )}
      {stage.next && <p className="mt-3 text-muted">Next: {stage.next}.</p>}
    </details>
  );
}
