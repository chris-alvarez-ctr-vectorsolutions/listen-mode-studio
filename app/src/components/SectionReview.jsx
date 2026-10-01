import Markdown from './Markdown.jsx';
import { splitSections } from '../lib/sections.js';

// A document reply as one card per section: mark it fine or leave a note on just that section.
// Notes go back to Claude with Revise. Falls back to plain Markdown when the reply has no sections.
export default function SectionReview({ text, state = {}, onChange, disabled }) {
  const parts = splitSections(text);
  if (!parts) return <Markdown text={text} />;
  const set = (key, patch) => onChange(key, { ...state[key], ...patch });
  const done = parts.sections.filter(s => state[s.key]?.ok).length;

  return (
    <div className="space-y-3">
      {parts.intro && <Markdown text={parts.intro} />}
      <p className="text-xs text-muted">{done} of {parts.sections.length} sections marked fine. Leave a note on any section that needs to change, then Revise.</p>
      {parts.sections.map(s => {
        const st = state[s.key] || {};
        return (
          <section key={s.key} className={`rounded-md border p-4 ${st.note?.trim() ? 'border-amber-300 bg-amber-50' : st.ok ? 'border-rule bg-paper opacity-80' : 'border-rule bg-paper'}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{s.title}</h3>
              <label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={!!st.ok} disabled={disabled} onChange={e => set(s.key, { ok: e.target.checked })} />Looks right</label>
            </div>
            {s.body && <Markdown text={s.body} />}
            <input aria-label={`Note on ${s.title}`} className="field mt-2" placeholder="Note on this section, sent with Revise" disabled={disabled}
              value={st.note || ''} onChange={e => set(s.key, { note: e.target.value })} />
          </section>
        );
      })}
    </div>
  );
}
