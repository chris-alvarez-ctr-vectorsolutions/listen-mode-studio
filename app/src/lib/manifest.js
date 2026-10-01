import { buildImpact } from './claims.js';

// Turns a module's rendered parts and recorded timings into the manifest the listen prototype plays from.
const VARIANTS = ['normal', 'harder', 'addon'];

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
  const explicit = words.length > 1 && VARIANTS.includes(last);
  const variant = explicit ? last : 'normal';
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
  const quickTakes = {};
  const normalIds = {};
  const files = [];
  const impact = buildImpact(m);
  for (const p of impact.partRows) if (p.stale.length) warnings.push(`"${p.id}" was rendered before ${p.stale.join(', ')} changed. Render it again.`);
  for (const s of impact.setRows) if (s.stale.length) warnings.push(`Review cards for "${s.topic}" were written before ${s.stale.join(', ')} changed. Run the Review cards stage again.`);

  for (const p of parts) {
    const c = classifyPart(p.id);
    if (!c) { warnings.push(`"${p.id}" doesn't look like a topic part or a quick take, so it was left out.`); continue; }
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
    if (c.kind === 'quickTake') { quickTakes[c.topic] = entry; continue; }
    const topic = (topics[c.topic] ||= { position: c.pos });
    topic.position = Math.min(topic.position, c.pos);
    topic[c.variant] = entry;
    if (c.variant === 'normal') normalIds[c.topic] = p.id;
  }

  for (const [name, topic] of Object.entries(topics)) {
    if (!topic.normal) warnings.push(`Topic "${name}" has no normal version.`);
    if (topic.addon) {
      const seam = timings[normalIds[name]]?.seamAt;
      if (seam == null) warnings.push(`Topic "${name}" has an add-on but no seam time. Render its normal part again, and check that its ending is its own segment.`);
      topic.seamAt = seam == null ? null : round(seam);
    }
  }

  // Topic keys follow the part-ID convention: k = Know, which needs a review set.
  for (const name of Object.keys(topics)) {
    if (name.startsWith('k') && !(m.reviewSets?.sets || []).some(s => s.topic === name)) warnings.push(`Know topic "${name}" has no review set. Run the Review cards stage.`);
  }

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
    quickTakes,
    reviewSets: Object.fromEntries((m.reviewSets?.sets || []).map(s => [s.topic, { title: s.title, cards: s.cards, retry: s.retry }])),
    listens: (m.parts?.assembly || []).map(l => ({ name: l.name, parts: l.parts })),
  };
  return { manifest, files, warnings };
}

const round = n => (n == null ? null : Math.round(n * 1000) / 1000);
