import { useState } from 'react';
import Markdown from './Markdown.jsx';
import { splitSections } from '../lib/sections.js';

// A document reply as one card per section. Mark a section "Looks right" and it folds down to one line, so what is
// left to read is what has not been checked yet. A note on a section goes back to Claude with Revise.
// Falls back to plain Markdown when the reply has no sections.
export default function SectionReview({ text, state = {}, onChange, disabled, preface = false }) {
  const parts = splitSections(text);
  const [shown, setShown] = useState({});       // sections opened by hand after being marked fine
  const [noting, setNoting] = useState({});     // sections whose note box is open
  if (!parts) return <Markdown text={text} />;
  const set = (key, patch) => onChange(key, { ...state[key], ...patch });
  // A section that opens a stage's reply with a short remark rather than content (a beat sheet reply starts with one).
  const isPreface = (s, i) => preface && i === 0 && !/^\d/.test(s.title);
  const review = parts.sections.filter((s, i) => !isPreface(s, i));
  const done = review.filter(s => state[s.key]?.ok).length;
  const markAll = ok => review.forEach(s => { if (!!state[s.key]?.ok !== ok) set(s.key, { ok }); });

  return (
    <div className="space-y-3">
      {parts.intro && <Markdown text={parts.intro} />}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule bg-panel px-3 py-2 text-sm">
        <span><strong>{done} of {review.length}</strong> marked Looks right{done < review.length ? '. Add a note to anything that needs to change, then Revise.' : '.'}</span>
        <span className="flex gap-2">
          {done < review.length && <button className="btn" disabled={disabled} onClick={() => markAll(true)}>Mark the rest as Looks right</button>}
          {done > 0 && <button className="btn" disabled={disabled} onClick={() => { markAll(false); setShown({}); }}>Clear all</button>}
        </span>
      </div>
      {parts.sections.map((s, i) => {
        if (isPreface(s, i)) {
          return <div key={s.key} className="rounded-md border border-rule bg-paper px-4 py-2 text-sm text-muted"><Markdown text={s.body} className="prose-tight" /></div>;
        }
        const st = state[s.key] || {};
        const hasNote = !!st.note?.trim();
        const folded = st.ok && !hasNote && !shown[s.key];
        return (
          <section key={s.key} className={`rounded-md border ${hasNote ? 'border-amber-300 bg-amber-50' : st.ok ? 'border-rule bg-panel' : 'border-rule bg-paper'} ${folded ? 'px-4 py-2' : 'p-4'}`}>
            <div className="flex items-center justify-between gap-3">
              <h3 className={`font-ui font-semibold ${folded ? 'text-sm text-muted' : ''}`}>{s.title}</h3>
              <div className="flex shrink-0 items-center gap-3">
                {st.ok && !hasNote && <button className="text-xs underline" onClick={() => setShown(x => ({ ...x, [s.key]: !x[s.key] }))}>{shown[s.key] ? 'Hide' : 'Show'}</button>}
                <button type="button" role="checkbox" aria-checked={!!st.ok} disabled={disabled}
                  onClick={() => { set(s.key, { ok: !st.ok }); setShown(x => ({ ...x, [s.key]: false })); }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${st.ok ? 'border-dana bg-dana text-white' : 'border-rule bg-panel hover:border-ink'} disabled:opacity-40`}>
                  <span aria-hidden>{st.ok ? '✓' : '○'}</span>Looks right
                </button>
              </div>
            </div>
            {!folded && (
              <>
                {s.body && <Markdown text={s.body} className="prose-tight mt-2" />}
                {(hasNote || noting[s.key]) ? (
                  <input aria-label={`Note on ${s.title}`} autoFocus={!hasNote} className="field mt-3" placeholder="What should change? Sent with Revise." disabled={disabled}
                    value={st.note || ''} onChange={e => set(s.key, { note: e.target.value })} />
                ) : (
                  <button className="mt-3 text-sm underline" disabled={disabled} onClick={() => setNoting(x => ({ ...x, [s.key]: true }))}>Add a note</button>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
