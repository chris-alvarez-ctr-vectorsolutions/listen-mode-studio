import { buildImpact } from './claims.js';
import { combineCues, toVtt } from './captions.js';
import { FEEL_LOW_MAX, MIN_CHAPTERS, inAudio, planParts, routeOf, topicKey, versionsFor } from './pathways.js';

// Turns a module's rendered parts and recorded timings into the manifest the listen prototype plays from.
const VARIANTS = ['base', 'testup', 'reinforced'];
const LEGACY = ['normal', 'harder', 'addon'];   // names from before the pathway rules

// Part id -> { kind: 'part', pos, topic, variant } | { kind: 'quickTake', topic } | null.
// Tolerates a DRAFT- prefix and export-index prefixes like "01_01-k1-normal".
export function classifyPart(rawId) {
  let id = rawId.replace(/^DRAFT-/i, '');
  let pos = null;
  for (let m; (m = id.match(/^(\d+)[-_](.+)$/)); ) { pos = Number(m[1]); id = m[2]; }
  const qt = id.match(/^qt[-_](.+)$/i);
  if (qt) return { kind: 'quickTake', topic: qt[1].toLowerCase() };
  if (pos === null) return null;
  const words = id.toLowerCase().split(/[-_]/);
  const last = words[words.length - 1];
  const explicit = words.length > 1 && [...VARIANTS, ...LEGACY].includes(last);
  const variant = explicit ? last : 'universal';
  const topic = (explicit ? words.slice(0, -1) : words).join('-');
  return { kind: 'part', pos, topic, variant };
}

export const fileNameFor = (m, partId) => `${m.ledgerSigned ? '' : 'DRAFT-'}${partId}.wav`;

// rendered: Set of part IDs that have audio. Returns { manifest, files, warnings }.
export function buildManifest(m, settings, rendered) {
  const parts = m.parts?.parts || [];
  const timings = m.timings || {};
  const warnings = [];
  const topics = {};
  const files = [];
  const captions = [];   // [{ path, vtt }] written into the package next to the audio
  const impact = buildImpact(m);
  for (const p of impact.partRows) if (p.stale.length) warnings.push(`"${p.id}" was rendered before ${p.stale.join(', ')} changed. Render it again.`);

  for (const p of parts) {
    const c = classifyPart(p.id);
    if (!c) { warnings.push(`"${p.id}" doesn't look like a topic part, so it was left out.`); continue; }
    if (c.kind === 'quickTake') { warnings.push(`"${p.id}" is a quick take. Remedial content isn't part of the audio, so it was left out.`); continue; }
    if (!rendered.has(p.id)) { warnings.push(`"${p.id}" isn't rendered yet.`); continue; }
    const t = timings[p.id];
    if (!t) warnings.push(`"${p.id}" was rendered before timings were recorded. Render it again.`);
    const entry = {
      file: `audio/${fileNameFor(m, p.id)}`,
      duration: t ? round(t.duration) : null,
      claims: p.claims || [],
      segments: p.segments.map(s => ({
        start: round(t?.segments.find(x => x.id === s.id)?.start),
        lines: s.lines,
        ...(s.pauseAfter ? { pauseAfter: s.pauseAfter } : {}),
      })),
    };
    files.push({ partId: p.id, name: fileNameFor(m, p.id) });
    if (t?.cues?.length) {
      const path = `audio/${fileNameFor(m, p.id).replace(/\.wav$/, '.vtt')}`;
      captions.push({ path, vtt: toVtt(t.cues) });
      entry.captions = path;
    }
    const topic = (topics[c.topic] ||= { position: c.pos });
    topic.position = Math.min(topic.position, c.pos);
    topic[c.variant] = entry;
    if (LEGACY.includes(c.variant)) warnings.push(`"${p.id}" uses an old version name (${c.variant}). Use base, testup or reinforced, and run the Performance pass again.`);
  }

  // Each audio objective must have exactly the versions the pathway rules call for, and the topic carries its routing.
  const objectives = (m.objectives || []).filter(inAudio);
  for (const o of objectives) {
    const key = topicKey(o.id);
    const topic = topics[key];
    const need = versionsFor(o);
    if (!topic) { warnings.push(`Objective ${o.id} has no rendered parts yet.`); continue; }
    for (const v of need) if (!topic[v]) warnings.push(`Topic "${key}" has no ${v === 'universal' ? 'rendered' : v} version.`);
    for (const v of VARIANTS) if (topic[v] && !need.includes(v)) warnings.push(`Topic "${key}" has a ${v} version that its pathway doesn't call for.`);
    topic.objective = o.id;
    topic.kfd = `${o.type} / ${o.subscale}`;
    topic.policy = o.policy;
    topic.lock = o.type === 'Know' ? o.lock : null;
    topic.routing = routeOf(o).kind;
  }
  for (const name of Object.keys(topics)) {
    if (name !== 'open' && name !== 'close' && !objectives.some(o => topicKey(o.id) === name)) {
      warnings.push(`Topic "${name}" isn't an objective in the pathway table.`);
    }
  }
  const required = planParts(objectives).map(p => p.id);
  for (const id of required) if (!parts.some(p => p.id === id)) warnings.push(`The pathway table calls for "${id}", but the render data has no such part.`);

  const order = Object.keys(topics).sort((a, b) => topics[a].position - topics[b].position);
  const manifest = {
    module: m.name,
    draft: !m.ledgerSigned,
    ledgerVersion: impact.version,
    sampleRate: 44100,
    gapBetweenPartsSec: settings.gapBetweenParts,
    spliceFadeMs: 25,
    order,
    topics,
    pathways: { feelLowMax: FEEL_LOW_MAX, minChapters: MIN_CHAPTERS, remedial: 'external' },
    listens: (m.parts?.assembly || []).map(l => {
      const out = { name: l.name, parts: l.parts };
      const ts = l.parts.map(pid => timings[pid]);
      if (ts.every(t => t?.cues?.length && t.duration != null)) {
        const path = `captions/${m.ledgerSigned ? '' : 'DRAFT-'}${l.name.replace(/[^\w .-]+/g, '').trim() || 'listen'}.vtt`;
        captions.push({ path, vtt: toVtt(combineCues(ts, settings.gapBetweenParts)) });
        out.captions = path;
      } else if (l.parts.some(pid => rendered.has(pid))) {
        warnings.push(`"${l.name}" has no combined captions because some of its parts have none. Render them again.`);
      }
      return out;
    }),
  };
  return { manifest, files, captions, warnings };
}

const round = n => (n == null ? null : Math.round(n * 1000) / 1000);
