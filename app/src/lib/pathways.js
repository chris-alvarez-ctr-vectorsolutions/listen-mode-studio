// Pathway rules: which versions each objective needs in the audio, how the pre-check routes to them, and the
// part IDs and listens that follow. The app computes these so the model never decides which versions exist.
// Remedial content and review cards are not audio; they are delivered by a separate interactive step.
export const SUBSCALES = { Know: ['Remember', 'Observe'], Feel: ['Believe', 'Value', 'Perceive'], Do: ['Activate', 'Apply'] };
export const POLICIES = ['Gate', 'Remediate', 'Ask', 'Never skipped'];
export const LOCKS = [
  { id: 'open', label: 'Open: can test out' },
  { id: 'locked', label: 'Compliance-locked: tests up, never out' },
  { id: 'fallback', label: 'Open today, with a test-up in case it gets locked' },
];
export const FEEL_LOW_MAX = 3;   // 1-5 agreement: 3 or lower is low, 4 and 5 are high
export const MIN_CHAPTERS = 3;   // below this a listen is not worth it; the LMS routes the learner to the article

export const blankObjective = () => ({ id: '', objective: '', type: 'Know', subscale: 'Remember', policy: 'Gate', lock: 'open', audio: true });

// One objective from untrusted text (a model reply, a pasted table) -> a valid table row.
export function normalizeObjective(o) {
  const find = (list, v) => list.find(x => x.toLowerCase() === String(v || '').trim().toLowerCase());
  const type = find(Object.keys(SUBSCALES), o.type) || 'Know';
  const lock = String(o.lock || '').trim().toLowerCase();
  return {
    ...blankObjective(),
    id: String(o.id || '').trim(),
    objective: String(o.objective || '').trim(),
    type,
    subscale: find(SUBSCALES[type], o.subscale) || SUBSCALES[type][0],
    policy: find(POLICIES, o.policy) || (type === 'Feel' ? 'Remediate' : 'Gate'),
    lock: type === 'Know' && (lock === 'locked' || lock === 'fallback') ? lock : 'open',
    audio: type !== 'Do',
  };
}

export const topicKey = id => String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pad = n => String(n).padStart(2, '0');
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const inAudio = o => !!topicKey(o.id) && o.audio !== false && o.type !== 'Do';

export function versionsFor(o) {
  if (!inAudio(o)) return [];
  if (o.type === 'Know') return o.lock === 'open' || !o.lock ? ['base'] : ['base', 'testup'];
  if (o.type === 'Feel' && o.policy === 'Remediate') return ['base', 'reinforced'];
  return ['universal'];
}

// kind: how the pre-check routes this objective.
export function routeOf(o) {
  if (!inAudio(o)) return { kind: 'none', text: 'Not in the audio. The simulation runs for every learner.' };
  if (o.type === 'Know') {
    if (o.lock === 'locked') return { kind: 'testUp', text: 'Compliance-locked, so it never tests out. Pre-check correct: the test-up replaces the base. Otherwise the base plays.' };
    if (o.lock === 'fallback') return { kind: 'testOut', text: 'Tests out today: pre-check correct removes the base. If the compliance lock is confirmed, the test-up replaces the base instead.' };
    return { kind: 'testOut', text: 'Pre-check correct: the learner tests out and the base is removed. Otherwise the base plays.' };
  }
  if (o.type === 'Feel' && o.policy === 'Remediate') return { kind: 'reinforce', text: `Agreement of ${FEEL_LOW_MAX} or lower on the pre-check: the reinforced version replaces the base. 4 or 5: the base plays. Never removed.` };
  return { kind: 'always', text: 'One version. Always plays.' };
}

// Parts in listen order. Every version of a topic shares its position.
export function planParts(objectives) {
  const audio = (objectives || []).filter(inAudio);
  const parts = [{ id: '00-open', objective: null, variant: 'open', position: 0 }];
  audio.forEach((o, i) => {
    const vs = versionsFor(o);
    for (const v of vs) parts.push({ id: `${pad(i + 1)}-${topicKey(o.id)}${v === 'universal' ? '' : `-${v}`}`, objective: o.id, topic: topicKey(o.id), variant: v, position: i + 1 });
  });
  if (audio.length) parts.push({ id: `${pad(audio.length + 1)}-close`, objective: null, variant: 'close', position: audio.length + 1 });
  return parts;
}

// Every distinct listen the pre-check can assemble, one change at a time from the Full listen.
export function planListens(objectives) {
  const audio = (objectives || []).filter(inAudio);
  if (!audio.length) return [];
  const parts = planParts(objectives);
  const idOf = (o, v) => parts.find(p => p.topic === topicKey(o.id) && (p.variant === v || (v === 'base' && p.variant === 'universal')))?.id;
  const open = parts[0].id, close = parts[parts.length - 1].id;
  const build = swap => [open, ...audio.map(o => swap(o)).filter(Boolean), close];
  const listens = [{ name: 'Full', parts: build(o => idOf(o, 'base')) }];
  for (const o of audio) {
    const r = routeOf(o);
    if (r.kind === 'testOut') listens.push({ name: `${o.id} tested out`, parts: build(x => (x === o ? null : idOf(x, 'base'))) });
    if (o.type === 'Know' && o.lock !== 'open') listens.push({ name: `${o.id} tested up`, parts: build(x => idOf(x, x === o ? 'testup' : 'base')) });
    if (r.kind === 'reinforce') listens.push({ name: `${o.id} reinforced`, parts: build(x => idOf(x, x === o ? 'reinforced' : 'base')) });
  }
  return listens;
}

export function pathwayWarnings(objectives) {
  const w = [];
  const seen = new Set();
  for (const o of objectives || []) {
    const k = topicKey(o.id);
    if (!k) { w.push('An objective has no ID.'); continue; }
    if (seen.has(k)) w.push(`${o.id} appears twice.`);
    seen.add(k);
    if (o.type === 'Know' && o.policy === 'Ask') w.push(`${o.id}: a Know objective with the Ask policy is unusual. Check it.`);
  }
  const n = (objectives || []).filter(inAudio).length;
  if ((objectives || []).length && n < MIN_CHAPTERS) w.push(`Only ${n} objective${n === 1 ? '' : 's'} in the audio. Listens below ${MIN_CHAPTERS} chapters are routed to the article.`);
  return w;
}

// The fixed pathway table the stage prompts read.
export function pathwayBlock(objectives) {
  const objs = (objectives || []).filter(o => topicKey(o.id));
  if (!objs.length) return '';
  const rows = objs.map(o => {
    const vs = versionsFor(o);
    return `| ${o.id} | ${(o.objective || '').replace(/\|/g, '/')} | ${o.type} / ${o.subscale} | ${o.policy} | ${routeOf(o).text} | ${vs.length ? vs.join(', ') : 'none'} |`;
  });
  const parts = planParts(objs);
  const listens = planListens(objs);
  return [
    '## Pathway table (fixed)',
    '',
    'These come from the course design. Do not add, drop, rename or re-route any of it.',
    '',
    '| ID | Objective | KFD | Policy | Pre-check routing | Audio versions |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Feel items are agreement statements scored 1 to 5. ${FEEL_LOW_MAX} or lower is low; 4 and 5 are high. Feel versions never remove content.`,
    'Remedial content and review cards are not audio. A separate interactive step delivers them after the checks, so write none.',
    'Do objectives run in the simulation, outside the audio.',
    '',
    '### Required parts, in listen order',
    '',
    ...parts.map(p => `- ${p.id}${p.objective ? ` (${p.objective}, ${p.variant})` : ` (${p.variant})`}`),
    '',
    '### Listens',
    '',
    ...listens.map(l => `- ${l.name}: ${l.parts.join(', ')}`),
    `- A listen with fewer than ${MIN_CHAPTERS} chapters is not built; the learner is routed to the article instead.`,
  ].join('\n');
}
