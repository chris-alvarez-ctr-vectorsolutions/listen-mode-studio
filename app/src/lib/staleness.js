// Which stages were built from something that has since changed. Each stage records a fingerprint of its input when it
// runs (basedOn). Stages recorded before that existed fall back to comparing run times in the run log.
const INPUT = { plan: 'ledger', beats: 'plan', draft: 'beats', validity: 'draft', editor: 'draft', performance: 'script' };   // seams are rebuilt from the performance output; see the Seams stage
const TITLES = { ledger: 'The claims ledger', plan: 'The outline', beats: 'The beat sheets', draft: 'The draft', script: 'The script' };

// Heading lines are ignored so renaming a chapter title doesn't count as a change.
const textOf = (m, id) => (id === 'script' ? m.currentScript : m.stages?.[id]?.output) || '';
const hash = t => {
  let h = 5381;
  for (const l of t.split('\n')) if (!/^#{1,3}\s/.test(l)) for (let i = 0; i < l.length; i++) h = ((h * 33) ^ l.charCodeAt(i)) >>> 0;
  return String(h);
};
export const stampFor = (m, stageId) => (INPUT[stageId] ? hash(textOf(m, INPUT[stageId])) : undefined);

const lastRun = (m, ids) => Math.max(0, ...(m.runLog || []).filter(r => r.ok && ids.includes(r.stage)).map(r => r.at + (r.ms || 0)));

// stageId -> { source: 'The beat sheets', changed: true | null } for each stage with output that is out of date.
export function staleStages(m) {
  const out = {};
  for (const id of ['plan', 'beats', 'draft', 'validity', 'editor', 'performance']) {
    const s = m.stages?.[id];
    const src = INPUT[id];
    if (!s?.output && id !== 'performance') continue;
    if (id === 'performance' && !m.parts) continue;
    const srcText = textOf(m, src);
    if (!srcText) continue;
    const srcIds = src === 'script' ? ['draft', 'validity'] : [src];
    let entry = null;
    const stamp = id === 'performance' ? m.stages?.performance?.basedOn : s?.basedOn;
    if (stamp) { if (stamp !== hash(srcText)) entry = { source: TITLES[src], changed: true }; }
    else if (lastRun(m, srcIds) > lastRun(m, [id])) entry = { source: TITLES[src], changed: null };
    const upstream = src === 'script' ? out.validity || out.draft : out[src];
    if (!entry && upstream) entry = { source: upstream.source, changed: upstream.changed, indirect: true };
    if (entry) out[id] = entry;
  }
  return out;
}

// --- Rendered audio vs. the script it was rendered from ---
const hashAll = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return String(h); };
const spokenWords = t => t.replace(/\[[^\]]*\]/g, ' ').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean).join(' ');

// Fingerprint of everything that is sent to the voices for a part: lines, tags and pauses.
export const partTextHash = part => hashAll((part.segments || []).map(s => `${s.pauseAfter || 0}|${s.lines.map(l => `${l.speaker}:${l.text}`).join('\n')}`).join('\n--\n'));

// true: the audio no longer matches the script. false: it matches. null: can't tell (never rendered, or an older
// render with no captions). Renders made before fingerprints existed are compared by their caption text, which only
// catches wording changes, not tag changes.
export function audioStale(part, timing) {
  if (!timing) return null;
  if (timing.textHash) return timing.textHash !== partTextHash(part);
  if (!timing.cues?.length) return null;
  const current = spokenWords((part.segments || []).flatMap(s => s.lines.map(l => l.text)).join(' '));
  return spokenWords(timing.cues.map(c => c.text).join(' ')) !== current;
}
