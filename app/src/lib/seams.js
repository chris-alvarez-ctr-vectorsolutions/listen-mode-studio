// Bridges between topics and the closer. Parts stay standalone; a bridge is its own small part that plays between two
// topic parts only when both are in the learner's listen. Bridges are keyed by topic, not version, so one bridge
// serves every Base, Test-up and Reinforced combination. The app lists the pairs so the model never decides them.
import { inAudio, topicKey } from './pathways.js';

export const bridgeId = (from, to) => `bridge-${from}-${to}`;
export const closerId = after => `closer-${after}`;
export const isSeam = p => !!p?.seam;

const topicOf = partId => String(partId || '').split('-')[1] || '';

export function seamPlan(objectives) {
  const topics = (objectives || []).filter(inAudio).map(o => ({ key: topicKey(o.id), id: o.id, objective: o.objective }));
  const pairs = [];
  topics.forEach((a, i) => topics.slice(i + 1).forEach(b => pairs.push([a, b])));
  return { topics, pairs };
}

export function seamBlock(objectives) {
  const { topics, pairs } = seamPlan(objectives);
  if (!topics.length) return '';
  const name = t => `${t.key} (${t.id}: ${t.objective})`;
  return [
    '## Seams to write (computed from the pathway table)',
    '',
    `Topics in listen order: ${topics.map(name).join('; ')}.`,
    '',
    `Bridges, "from" then "to" (${pairs.length}):`,
    ...pairs.map(([a, b]) => `- ${a.key} then ${b.key}`),
    '',
    `Closers, "after" (any topic can be the last one a learner hears): ${topics.map(t => t.key).join(', ')}.`,
  ].join('\n');
}

// Seams reply -> { bridges, closers }. Tolerates a ```json fence or stray prose.
export function parseSeams(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const data = JSON.parse(raw);
  const ok = l => Array.isArray(l?.lines) && l.lines.length && l.lines.every(x => x.speaker && x.text);
  const bridges = (data.bridges || []).filter(b => b.from && b.to && ok(b));
  const closers = (data.closers || []).filter(c => c.after && ok(c));
  if (!bridges.length && !closers.length) throw new Error('The seams reply has no bridges or closers.');
  return { bridges, closers };
}

const seamPart = (id, title, kind, lines) => ({ id, title, seam: kind, claims: [], segments: [{ id: `${id}-a`, flag: null, pauseAfter: 0, lines }] });

// Adds the seam parts to the performance data and threads them into every listen. The original listens are kept
// (baseAssembly) so applying seams again, or after a new run, always starts from them.
export function applySeams(data, seams) {
  if (!data?.parts) return data;
  const base = data.baseAssembly || data.assembly || [];
  const parts = data.parts.filter(p => !isSeam(p));
  const have = new Set();
  for (const b of seams.bridges) { parts.push(seamPart(bridgeId(b.from, b.to), `Bridge ${b.from} to ${b.to}`, 'bridge', b.lines)); have.add(bridgeId(b.from, b.to)); }
  for (const c of seams.closers) { parts.push(seamPart(closerId(c.after), `Closer after ${c.after}`, 'closer', c.lines)); have.add(closerId(c.after)); }
  const assembly = base.map(l => ({ ...l, parts: threadSeams(l.parts || [], have) }));
  return { ...data, parts, assembly, baseAssembly: base };
}

// Ids in listen order -> the same with bridges between consecutive topics and the closer swapped in.
export function threadSeams(ids, have) {
  const out = [];
  let prev = null;
  for (const id of ids) {
    if (/(^|-)close$/.test(id) && prev && have.has(closerId(prev))) { out.push(closerId(prev)); continue; }
    if (/(^|-)open$/.test(id) || /(^|-)close$/.test(id)) { out.push(id); continue; }
    const t = topicOf(id);
    if (prev && have.has(bridgeId(prev, t))) out.push(bridgeId(prev, t));
    out.push(id);
    prev = t;
  }
  return out;
}
