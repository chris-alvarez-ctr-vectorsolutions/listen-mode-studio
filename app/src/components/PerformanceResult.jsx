import { speakerColor } from './speaker.js';

const WPM = 140;                                   // the same pace the guide uses for runtimes
const stripTags = t => (t || '').replace(/\[[^\]]*\]/g, ' ');
const words = t => stripTags(t).trim().split(/\s+/).filter(Boolean).length;
const clock = secs => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`;
const isChapter = id => !/(^|[-_])(open|close)([-_]|$)/i.test(id) && !/^00[-_]/.test(id);

// What the performance pass produced, in terms an LXD uses: the parts, how long they run, the listens made from them,
// and the script with its delivery directions. Nothing here runs anything.
export default function PerformanceResult({ data, expectedIds = [], gap = 1.5 }) {
  const parts = data.parts.map(p => {
    const lines = p.segments.flatMap(s => s.lines);
    const w = lines.reduce((n, l) => n + words(l.text), 0);
    const pauses = p.segments.reduce((n, s) => n + (s.pauseAfter || 0), 0);
    return {
      id: p.id, title: p.title, segments: p.segments, lines: lines.length, words: w,
      directions: lines.reduce((n, l) => n + ((l.text || '').match(/\[[^\]]+\]/g) || []).length, 0),
      flagged: p.segments.filter(s => s.flag).length,
      secs: (w / WPM) * 60 + pauses,
    };
  });
  const byId = Object.fromEntries(parts.map(p => [p.id, p]));
  const listens = (data.assembly || []).map(l => {
    const ids = l.parts || [];
    return { name: l.name, count: ids.filter(isChapter).length, secs: ids.reduce((n, id) => n + (byId[id]?.secs || 0), 0) + Math.max(0, ids.length - 1) * gap, parts: ids.length };
  });
  const got = parts.map(p => p.id);
  const missing = expectedIds.filter(x => !got.includes(x));
  const extra = expectedIds.length ? got.filter(x => !expectedIds.includes(x)) : [];
  const full = listens.find(l => /full/i.test(l.name)) || listens[0];

  return (
    <div className="space-y-5">
      <div className={`rounded-md border p-4 ${missing.length || extra.length ? 'border-amber-300 bg-amber-50' : 'border-dana bg-panel'}`}>
        {missing.length || extra.length ? (
          <>
            <div className="font-medium">The script doesn't match your pathway table</div>
            <p className="mt-1 text-sm">{missing.length ? `Missing: ${missing.join(', ')}. ` : ''}{extra.length ? `Not in the table: ${extra.join(', ')}. ` : ''}Run this step again, or check the pathway table on the Seed step.</p>
          </>
        ) : (
          <>
            <div className="font-medium text-dana">✓ The script is ready to record</div>
            <p className="mt-1 text-sm text-muted">{parts.length} parts and {listens.length} listens{full ? `, about ${clock(full.secs)} for the ${full.name} listen` : ''}. Delivery directions and pauses were added to each line. No wording changed.</p>
          </>
        )}
      </div>

      <section>
        <h3 className="mb-1 font-ui text-sm font-semibold">Parts</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-ui text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="py-1 pr-3">Part</th><th className="py-1 pr-3">Title</th><th className="py-1 pr-3 text-right">Lines</th><th className="py-1 pr-3 text-right">Words</th><th className="py-1 pr-3 text-right">Directions</th><th className="py-1 text-right">About</th></tr></thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.id} className="border-t border-rule">
                  <td className="py-1.5 pr-3 font-mono text-xs">{p.id}</td>
                  <td className="py-1.5 pr-3">{p.title}{p.flagged > 0 && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-900">{p.flagged} flagged</span>}</td>
                  <td className="py-1.5 pr-3 text-right">{p.lines}</td>
                  <td className="py-1.5 pr-3 text-right">{p.words}</td>
                  <td className="py-1.5 pr-3 text-right">{p.directions}</td>
                  <td className="py-1.5 text-right">{clock(p.secs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-1 font-ui text-sm font-semibold">Listens</h3>
        <p className="mb-1 text-xs text-muted">Each listen is made from these parts, depending on a learner's quiz answers.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-ui text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="py-1 pr-3">Listen</th><th className="py-1 pr-3 text-right">Chapters</th><th className="py-1 pr-3 text-right">Parts</th><th className="py-1 text-right">About</th></tr></thead>
            <tbody>
              {listens.map(l => (
                <tr key={l.name} className="border-t border-rule">
                  <td className="py-1.5 pr-3">{l.name}</td>
                  <td className="py-1.5 pr-3 text-right">{l.count}{l.count < 3 && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-900">under 3</span>}</td>
                  <td className="py-1.5 pr-3 text-right">{l.parts}</td>
                  <td className="py-1.5 text-right">{clock(l.secs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="rounded-md border border-rule p-4">
        <summary className="cursor-pointer font-medium">Show the script with its delivery directions</summary>
        <p className="mb-3 mt-2 max-w-prose text-xs text-muted">Directions in [brackets] tell the voice how to say a line. Pauses are shown between lines.</p>
        <div className="space-y-5 font-script text-[15px] leading-relaxed">
          {parts.map(p => (
            <div key={p.id}>
              <h4 className="font-ui text-sm font-semibold">{p.id} · {p.title}</h4>
              {p.segments.map(s => (
                <div key={s.id}>
                  {s.lines.map((l, i) => (
                    <p key={i} className="my-1">
                      <span className={`mr-2 font-ui text-xs font-semibold ${speakerColor(l.speaker)}`}>{l.speaker}</span>
                      {(l.text || '').split(/(\[[^\]]+\])/).map((bit, j) => /^\[[^\]]+\]$/.test(bit)
                        ? <span key={j} className="mx-0.5 rounded bg-paper px-1 font-ui text-xs text-muted">{bit}</span>
                        : <span key={j}>{bit}</span>)}
                    </p>
                  ))}
                  {s.pauseAfter > 0 && <p className="my-1 font-ui text-xs text-muted">⟨ pause {s.pauseAfter}s ⟩</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
