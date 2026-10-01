import { useState } from 'react';

const LABEL = {
  accept: 'Accepted as written',
  suggestion: 'Suggested fix used',
  own: 'Your wording, pending SME',
  sme: 'Sent to SME',
  confirmed: 'SME confirmed',
};
const needsSme = fix => /^needs sme/i.test(fix || '');

function Card({ row, meta = {}, suggesting, disabled, onAction, onSuggest, onNote }) {
  const [mode, setMode] = useState(null);       // null | 'own' | 'sme'
  const [text, setText] = useState('');
  const fix = row.fix || meta.suggestion || '';
  const decided = !!meta.decision;
  const pending = meta.decision === 'own' || meta.decision === 'sme';

  return (
    <li className="rounded-md border border-rule bg-paper p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p><span className="mr-2 font-mono text-xs text-muted">{row.id}</span>{row.claim}</p>
        {decided && <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${pending ? 'bg-amber-100 text-amber-900' : 'bg-panel text-muted'}`}>{LABEL[meta.decision]}</span>}
      </div>
      {row.source && <p className="mt-1 text-xs text-muted">{row.source}</p>}
      {row.flag && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900"><b>Flag:</b> {row.flag}</p>}

      {row.flag && !decided && (
        <div className="mt-2 space-y-2">
          {fix
            ? <p className="rounded border border-rule bg-panel p-2 text-xs"><b>Suggested:</b> {fix}</p>
            : <button className="btn" disabled={disabled || suggesting} onClick={onSuggest}>{suggesting ? 'Thinking…' : 'Ask for a suggestion'}</button>}

          {mode === 'own' && (
            <div>
              <label className="label" htmlFor={`own-${row.id}`}>Your wording for {row.id}</label>
              <textarea id={`own-${row.id}`} className="field h-20" value={text} onChange={e => setText(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Your wording is a new fact until an SME confirms it. The ledger can't be signed while it's pending.</p>
            </div>
          )}
          {mode === 'sme' && (
            <div>
              <label className="label" htmlFor={`sme-${row.id}`}>Question for the SME</label>
              <textarea id={`sme-${row.id}`} className="field h-20" value={text} onChange={e => setText(e.target.value)} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {fix && <button className="btn-primary" disabled={disabled || needsSme(fix)} title={needsSme(fix) ? 'This suggestion is a question for the SME' : ''}
              onClick={() => onAction('suggestion', fix)}>Use the suggestion</button>}
            {mode === 'own'
              ? <button className="btn-primary" disabled={disabled || !text.trim()} onClick={() => onAction('own', text)}>Apply my wording</button>
              : <button className="btn" disabled={disabled} onClick={() => { setMode('own'); setText(row.claim); }}>Write my own</button>}
            {mode === 'sme'
              ? <button className="btn-primary" disabled={disabled || !text.trim()} onClick={() => onAction('sme', text)}>Send to SME</button>
              : <button className="btn" disabled={disabled} onClick={() => { setMode('sme'); setText(needsSme(fix) ? fix.replace(/^needs sme:?\s*/i, '') : ''); }}>Send to SME</button>}
            <button className="btn" disabled={disabled} onClick={() => onAction('accept')}>Accept as is</button>
            <button className="btn" disabled={disabled} onClick={() => onAction('drop')}>Drop claim</button>
            {mode && <button className="btn" onClick={() => setMode(null)}>Cancel</button>}
          </div>
        </div>
      )}

      {decided && meta.note && <p className="mt-2 text-xs text-muted">{meta.decision === 'sme' ? 'Question: ' : ''}{meta.note}</p>}
      {pending && <button className="btn mt-2" disabled={disabled} onClick={() => onAction('confirmed')}>Mark SME confirmed</button>}
      {decided && <button className="ml-2 mt-2 text-xs underline" disabled={disabled} onClick={() => onAction('reopen')}>Decide again</button>}

      {!row.flag && !decided && (
        <div className="mt-2 flex items-center gap-2">
          <input aria-label={`Note on ${row.id}`} className="field" placeholder="Note on this claim, sent with Revise" value={meta.note || ''} onChange={e => onNote(e.target.value)} />
          <button className="btn" disabled={disabled} onClick={() => onAction('drop')}>Drop</button>
        </div>
      )}
      {row.flag && !decided && (
        <input aria-label={`Note on ${row.id}`} className="field mt-2" placeholder="Note on this claim, sent with Revise" value={meta.note || ''} onChange={e => onNote(e.target.value)} />
      )}
    </li>
  );
}

export default function LedgerReview({ rows, meta, suggestingId, disabled, onAction, onSuggest, onNote }) {
  const flagged = rows.filter(r => r.flag);
  const clear = rows.filter(r => !r.flag);
  const open = flagged.filter(r => !meta[r.id]?.decision).length;
  const dropped = Object.entries(meta).filter(([, v]) => v.decision === 'drop');
  const card = r => (
    <Card key={r.id} row={r} meta={meta[r.id]} suggesting={suggestingId === r.id} disabled={disabled}
      onAction={(a, v) => onAction(r.id, a, v)} onSuggest={() => onSuggest(r.id)} onNote={t => onNote(r.id, t)} />
  );
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold">Flagged claims <span className="text-sm font-normal text-muted">{flagged.length ? `${open} of ${flagged.length} still need a decision` : 'none'}</span></h3>
        <ul className="mt-2 space-y-2">{flagged.map(card)}</ul>
      </section>
      <section>
        <details>
          <summary className="cursor-pointer font-semibold">Claims with no flag <span className="text-sm font-normal text-muted">{clear.length}</span></summary>
          <ul className="mt-2 space-y-2">{clear.map(card)}</ul>
        </details>
      </section>
      {dropped.length > 0 && (
        <section>
          <h3 className="font-semibold">Dropped</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {dropped.map(([id, v]) => <li key={id}><span className="font-mono text-xs">{id}</span> {v.was}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
