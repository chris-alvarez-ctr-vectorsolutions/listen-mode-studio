import { parseSeams } from '../lib/seams.js';
import { speakerColor } from './speaker.js';

// The bridges and closers the Seams stage wrote, as a read-through. Nothing here runs anything.
export default function SeamsResult({ text, applied }) {
  let seams = null, error = '';
  try { seams = parseSeams(text); } catch (e) { error = e.message; }
  if (!seams) {
    return <div className="space-y-2"><p className="text-sm text-muted">The reply couldn't be read as seams ({error}). Run this step again. What came back is below.</p><pre className="max-h-96 overflow-auto rounded bg-paper p-3 text-xs">{text}</pre></div>;
  }
  const block = (title, lines) => (
    <div key={title} className="rounded-md border border-rule bg-panel p-3">
      <div className="mb-1 font-ui text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      {lines.map((l, i) => <p key={i} className="text-sm"><span className="mr-2 font-ui text-xs font-semibold" style={{ color: speakerColor?.(l.speaker) }}>{l.speaker}</span>{l.text}</p>)}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className={`rounded-md border p-4 ${applied ? 'border-dana bg-panel' : 'border-amber-300 bg-amber-50'}`}>
        <div className="font-medium">{applied ? '✓ Added to every listen' : 'Not yet added to the listens'}</div>
        <p className="mt-1 text-sm text-muted">{seams.bridges.length} bridges and {seams.closers.length} closers. Each plays only when its topics are in the learner's listen. Render them with the other parts.</p>
      </div>
      <section className="space-y-2"><h3 className="font-ui text-sm font-semibold">Bridges</h3>{seams.bridges.map(b => block(`${b.from} then ${b.to}`, b.lines))}</section>
      <section className="space-y-2"><h3 className="font-ui text-sm font-semibold">Closers</h3>{seams.closers.map(c => block(`After ${c.after}`, c.lines))}</section>
    </div>
  );
}
