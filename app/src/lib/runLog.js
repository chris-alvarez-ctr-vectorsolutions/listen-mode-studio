// A record of every turn with Claude, kept on the module (and so in its export): which step, what kind of turn, how long
// it took, how much was sent and how much came back. Entry: { at, stage, action, ms, sent, words, retries, ok, effort, model, outTokens, firstMs }.
// effort: the thinking level the call asked for. model: the model that answered. outTokens: tokens written, thinking included.
// firstMs: how long until the first word appeared, so the wait before writing (thinking) can be told from the writing itself.

export const ACTION_LABEL = { run: 'Run', 'run again': 'Run again', revision: 'Revision', 'apply fixes': 'Apply fixes' };

export function formatDuration(ms) {
  const s = Math.round((ms || 0) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function summarize(log = []) {
  const done = log.filter(r => r.ok);
  const byStage = {};
  for (const r of log) {
    const s = (byStage[r.stage] ||= { stage: r.stage, runs: 0, ms: 0, last: null });
    s.runs += 1; s.ms += r.ms || 0; s.last = r;
  }
  return {
    runs: log.length,
    failed: log.filter(r => !r.ok).length,
    ms: log.reduce((n, r) => n + (r.ms || 0), 0),
    longest: done.reduce((a, r) => (!a || r.ms > a.ms ? r : a), null),
    byStage,
  };
}
