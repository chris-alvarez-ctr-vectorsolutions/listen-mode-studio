import Markdown from './Markdown.jsx';
import { splitFixItems } from '../lib/sections.js';

// The editor pass as one card per problem: apply it, skip it, or apply it with your own change to the fix.
export default function FixReview({ text, state = {}, onChange, disabled }) {
  const parts = splitFixItems(text);
  if (!parts) return <Markdown text={text} />;
  const set = (n, patch) => onChange(n, { ...state[n], ...patch });
  const setAll = decision => parts.items.forEach(it => onChange(it.n, { ...state[it.n], decision }));
  const applying = parts.items.filter(it => state[it.n]?.decision === 'apply').length;

  return (
    <div className="space-y-3">
      {parts.intro && <Markdown text={parts.intro} />}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{applying} of {parts.items.length} fixes will be applied.</span>
        <button className="btn" disabled={disabled} onClick={() => setAll('apply')}>Apply all</button>
        <button className="btn" disabled={disabled} onClick={() => setAll('skip')}>Skip all</button>
      </div>
      {parts.items.map(it => {
        const st = state[it.n] || {};
        return (
          <section key={it.n} className={`rounded-md border p-4 ${st.decision === 'apply' ? 'border-ink bg-paper' : st.decision === 'skip' ? 'border-rule bg-paper opacity-60' : 'border-rule bg-paper'}`}>
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs text-muted">{it.n}</span>
              <div className="min-w-0 flex-1"><Markdown text={it.text} /></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={st.decision === 'apply' ? 'btn-primary' : 'btn'} disabled={disabled} onClick={() => set(it.n, { decision: 'apply' })}>Apply</button>
              <button className={st.decision === 'skip' ? 'btn-primary' : 'btn'} disabled={disabled} onClick={() => set(it.n, { decision: 'skip' })}>Skip</button>
            </div>
            {st.decision === 'apply' && (
              <input aria-label={`Your change to fix ${it.n}`} className="field mt-2" placeholder="Optional: change the fix, in your words" disabled={disabled}
                value={st.edit || ''} onChange={e => set(it.n, { edit: e.target.value })} />
            )}
          </section>
        );
      })}
    </div>
  );
}
