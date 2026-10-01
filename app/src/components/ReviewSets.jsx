// Readable preview of the review-cards stage: cards and retry questions, with the claims each rests on.
export default function ReviewSets({ data }) {
  return (
    <div className="space-y-6">
      {data.sets.map(set => (
        <section key={set.topic}>
          <h3 className="font-semibold">{set.topic.toUpperCase()}{set.title ? ` · ${set.title}` : ''}</h3>
          <ul className="mt-2 space-y-2">
            {set.cards?.map((c, i) => (
              <li key={i} className="rounded-md border border-rule bg-paper p-3 text-sm">
                <p className="font-medium">{c.front}</p>
                <p>{c.back}</p>
                <p className="mt-1 text-xs text-muted">{(c.claims || []).join(', ')}</p>
              </li>
            ))}
          </ul>
          {set.retry?.map((r, i) => (
            <div key={i} className="mt-3 rounded-md border border-rule p-3 text-sm">
              <p className="font-medium">Retry: {r.question}</p>
              <ol className="list-[upper-alpha] pl-6">
                {r.options.map((o, j) => <li key={j} className={j === r.answer ? 'font-medium' : ''}>{o}{j === r.answer ? ' ✓' : ''}</li>)}
              </ol>
              <p className="text-muted">{r.feedback} <span className="text-xs">{(r.claims || []).join(', ')}</span></p>
            </div>
          ))}
        </section>
      ))}
      {data.missing.length > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">Facts needed that the ledger doesn't hold: {data.missing.join('; ')}</p>
      )}
    </div>
  );
}
