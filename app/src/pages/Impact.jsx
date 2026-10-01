import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getModule } from '../lib/store.js';
import { buildImpact } from '../lib/claims.js';

export default function Impact() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  useEffect(() => { getModule(id).then(setM); }, [id]);
  if (!m) return <p className="text-muted">Loading…</p>;

  const r = buildImpact(m);
  const stale = r.partRows.filter(p => p.stale.length);
  const staleSets = r.setRows.filter(s => s.stale.length);
  const untracked = r.partRows.filter(p => p.rendered && !p.tracked);

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/m/${m.id}`} className="text-sm text-muted hover:text-ink">Back to {m.name}</Link>
        <h1 className="mt-1 text-2xl font-semibold">Claim impact</h1>
        <p className="text-sm text-muted">Which parts and review cards rest on which ledger claims, and which need redoing because a claim changed since they were made. Ledger version {r.version}.</p>
      </div>

      {!Object.keys(r.ledger).length && (
        <p className="rounded-lg border border-rule bg-panel p-6 text-muted">No claim IDs found. Run the Claims ledger stage, or use a ledger table with IDs like C01. If you skipped the ledger, claims in the seed have no IDs to track.</p>
      )}

      {(stale.length > 0 || staleSets.length > 0) && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold">Needs redoing</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {stale.map(p => <li key={p.id}><b>{p.id}</b> was rendered from {p.stale.join(', ')} before {p.stale.length > 1 ? 'they' : 'it'} changed. <Link className="underline" to={`/m/${m.id}/render`}>Render again</Link>.</li>)}
            {staleSets.map(s => <li key={s.topic}>Review cards for <b>{s.topic}</b> were written from {s.stale.join(', ')} before {s.stale.length > 1 ? 'they' : 'it'} changed. Run the Review cards stage again.</li>)}
          </ul>
        </section>
      )}
      {!!Object.keys(r.ledger).length && !stale.length && !staleSets.length && (
        <p className="rounded-lg border border-rule bg-panel p-4 text-sm">Nothing rendered or written is out of date with the ledger.</p>
      )}

      {untracked.length > 0 && (
        <p className="text-sm text-muted">Rendered before claim tracking, so changes can't be detected for: {untracked.map(p => p.id).join(', ')}. Render {untracked.length > 1 ? 'them' : 'it'} again to start tracking.</p>
      )}

      {r.issues.length > 0 && (
        <section className="rounded-lg border border-rule bg-panel p-5">
          <h2 className="font-semibold">Coverage</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">{r.issues.map(i => <li key={i}>{i}</li>)}</ul>
        </section>
      )}

      {r.claimRows.length > 0 && (
        <section className="overflow-x-auto rounded-lg border border-rule bg-panel">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rule text-xs text-muted">
              <tr><th className="p-3">Claim</th><th className="p-3">Used by parts</th><th className="p-3">Used by review cards</th></tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {r.claimRows.map(c => (
                <tr key={c.id} className="align-top">
                  <td className="p-3"><b>{c.id}</b> <span className="text-muted">{c.text}</span></td>
                  <td className="p-3">{c.parts.join(', ') || '—'}</td>
                  <td className="p-3">{c.sets.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
