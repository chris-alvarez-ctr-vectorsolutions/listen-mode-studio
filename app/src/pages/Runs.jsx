import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getModule } from '../lib/store.js';
import { DEFAULT_STAGES } from '../kit/stages.js';
import { ACTION_LABEL, costOf, formatDuration, summarize } from '../lib/runLog.js';

const stageName = id => { const s = DEFAULT_STAGES.find(x => x.id === id); return s ? `${s.n}. ${s.title}` : id; };

const RATES_KEY = 'lms-token-rates';
const loadRates = () => { try { return JSON.parse(localStorage.getItem(RATES_KEY)) || { in: '', out: '' }; } catch { return { in: '', out: '' }; } };

// Every turn with Claude for this module, kept so the timings can be looked back on.
export default function Runs() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [rates, setRates] = useState(loadRates);
  const setRate = (k, v) => setRates(r => { const n = { ...r, [k]: v }; try { localStorage.setItem(RATES_KEY, JSON.stringify(n)); } catch { /* not saved */ } return n; });
  useEffect(() => { getModule(id).then(setM); }, [id]);
  if (!m) return <p className="text-muted">Loading…</p>;

  const log = m.runLog || [];
  const sum = summarize(log);
  const stages = DEFAULT_STAGES.filter(s => sum.byStage[s.id]);
  const total = sum.tokensIn + sum.tokensOut;
  const haveRates = Number(rates.in) > 0 || Number(rates.out) > 0;
  const cost = costOf(sum.tokensIn, sum.tokensOut, { in: Number(rates.in), out: Number(rates.out) });
  const models = [...new Set(log.map(r => r.model).filter(Boolean))];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to={`/m/${m.id}`} className="text-sm text-muted hover:text-ink">Back to {m.name}</Link>
        <h1 className="mt-1 text-2xl font-semibold">Run log</h1>
        <p className="max-w-prose text-sm text-muted">Every turn with Claude for this module: how long it took, how much was sent, and how much came back. It is saved with the module, so it goes with an export.</p>
      </div>

      {!log.length ? (
        <p className="rounded-lg border border-rule bg-panel p-6 text-muted">Nothing recorded yet. Runs are logged from now on.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[['Total tokens', total.toLocaleString(), `${sum.tokensIn.toLocaleString()} sent (est.) + ${sum.tokensOut.toLocaleString()} back`], ['Time with Claude', formatDuration(sum.ms)], ['Runs', `${sum.runs}${sum.failed ? ` (${sum.failed} failed or stopped)` : ''}`], ['Longest run', sum.longest ? `${formatDuration(sum.longest.ms)} · ${stageName(sum.longest.stage)}` : 'None finished']].map(([k, v, sub]) => (
              <div key={k} className="rounded-lg border border-rule bg-panel p-4"><div className="text-xs uppercase tracking-wide text-muted">{k}</div><div className="mt-1 text-lg font-semibold">{v}</div>{sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}</div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-rule bg-panel p-4 font-ui text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Estimated cost</div>
              <div className="mt-1 text-lg font-semibold">{haveRates ? `$${cost.toFixed(2)}` : 'Enter your rates'}</div>
            </div>
            {[['in', 'Input $ per million tokens'], ['out', 'Output $ per million tokens']].map(([k, label]) => (
              <label key={k} className="text-xs text-muted">{label}
                <input type="number" min="0" step="any" inputMode="decimal" className="field mt-1 block w-40" value={rates[k]} onChange={e => setRate(k, e.target.value)} />
              </label>
            ))}
            <p className="max-w-xs text-xs text-muted">Use the rates on your Anthropic plan. They are kept in this browser. Input is the "sent" estimate, so treat the total as approximate; cached input would cost less.</p>
          </div>

          <section>
            <h2 className="mb-1 font-semibold">By step</h2>
            <div className="overflow-x-auto rounded-lg border border-rule bg-panel">
              <table className="w-full border-collapse font-ui text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="px-3 py-2">Step</th><th className="px-3 py-2 text-right">Runs</th><th className="px-3 py-2 text-right">Total time</th><th className="px-3 py-2 text-right">Tokens</th><th className="px-3 py-2 text-right">Last run</th></tr></thead>
                <tbody>
                  {stages.map(s => { const x = sum.byStage[s.id]; return (
                    <tr key={s.id} className="border-t border-rule"><td className="px-3 py-2">{s.n}. {s.title}</td><td className="px-3 py-2 text-right">{x.runs}</td><td className="px-3 py-2 text-right">{formatDuration(x.ms)}</td><td className="px-3 py-2 text-right">{(x.tokens || 0).toLocaleString()}</td><td className="px-3 py-2 text-right">{formatDuration(x.last.ms)}</td></tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-1 font-semibold">Every turn</h2>
            <div className="overflow-x-auto rounded-lg border border-rule bg-panel">
              <table className="w-full border-collapse font-ui text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="px-3 py-2">When</th><th className="px-3 py-2">Step</th><th className="px-3 py-2">What</th><th className="px-3 py-2">Effort</th><th className="px-3 py-2 text-right">Time</th><th className="px-3 py-2 text-right">First word</th><th className="px-3 py-2 text-right">Sent</th><th className="px-3 py-2 text-right">Words back</th><th className="px-3 py-2 text-right">Tokens out</th><th className="px-3 py-2">Result</th></tr></thead>
                <tbody>
                  {[...log].reverse().map((r, i) => (
                    <tr key={i} className="border-t border-rule">
                      <td className="whitespace-nowrap px-3 py-2">{new Date(r.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="px-3 py-2">{stageName(r.stage)}</td>
                      <td className="px-3 py-2">{ACTION_LABEL[r.action] || r.action}</td>
                      <td className="px-3 py-2" title={r.model || ''}>{r.effort || ''}</td>
                      <td className="px-3 py-2 text-right">{formatDuration(r.ms)}</td>
                      <td className="px-3 py-2 text-right">{r.firstMs ? formatDuration(r.firstMs) : ''}</td>
                      <td className="px-3 py-2 text-right">{r.sent ? `~${r.sent.toLocaleString()}` : ''}</td>
                      <td className="px-3 py-2 text-right">{r.words ? r.words.toLocaleString() : ''}</td>
                      <td className="px-3 py-2 text-right">{r.outTokens ? r.outTokens.toLocaleString() : ''}</td>
                      <td className="px-3 py-2">{r.ok ? 'Finished' : <span className="text-amber-900">Failed or stopped</span>}{r.retries > 0 && <span className="ml-2 text-xs text-muted">{r.retries} retr{r.retries > 1 ? 'ies' : 'y'}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">"Sent" is an estimate of what went to Claude (about four characters to a token). Time runs from pressing the button to the result being saved. "First word" is how long Claude thought before it started writing, and "Tokens out" counts that thinking too.{models.length > 0 && ` Model${models.length > 1 ? 's' : ''} that answered: ${models.join(', ')}.`}</p>
          </section>
        </>
      )}
    </div>
  );
}
