// Simulates how the learning engine composes a module for one learner, so an LXD can hear any combination.
// Inputs are the objective table (pathways.js) and a simulated learner per objective. No audio logic lives here.
// Know: pre-check correct/incorrect. Feel: 1-5 agreement. Do: never asked upfront (a choice question can't measure it).
// Policies: Gate = must pass, remediation repeats. Remediate = one retry in a new modality, then advances.
// Ask = answer recorded, never blocking. Never skipped = always plays, no test-out, not quizzed.
import { FEEL_LOW_MAX, MIN_CHAPTERS, inAudio, planListens, planParts, routeOf, topicKey } from './pathways.js';

export const MAX_FAILS = 3;

export const defaultLearner = o => ({ pre: o.type === 'Feel' ? FEEL_LOW_MAX + 1 : o.type === 'Know' ? 'incorrect' : null, fails: 0 });

// Presets set every objective at once.
export const PRESETS = [
  { id: 'fresh', label: 'New to it', learner: o => ({ ...defaultLearner(o), pre: o.type === 'Feel' ? 2 : o.type === 'Know' ? 'incorrect' : null }) },
  { id: 'expert', label: 'Knows it all', learner: o => ({ ...defaultLearner(o), pre: o.type === 'Feel' ? 5 : o.type === 'Know' ? 'correct' : null }) },
  { id: 'struggle', label: 'Struggles', learner: o => ({ pre: o.type === 'Feel' ? 1 : o.type === 'Know' ? 'incorrect' : null, fails: 2 }) },
];

// What a policy does after the content, in plain words. Feel is never a gate, so a Feel gate acts as Remediate.
export function effectivePolicy(o) {
  if (o.type === 'Feel' && o.policy === 'Gate') return 'Remediate';
  return o.policy;
}

export function policyNote(o) {
  const p = effectivePolicy(o);
  const feel = o.type === 'Feel' && o.policy === 'Gate' ? 'Feel objectives are never gates, so this acts as Remediate. ' : '';
  if (p === 'Gate') return `${feel}Must be passed. A miss triggers remediation in a new modality, repeated until mastery.`;
  if (p === 'Remediate') return `${feel}A miss triggers one retry in a new modality. The learner advances either way.`;
  if (p === 'Ask') return 'The answer is recorded but never blocks or remediates.';
  return 'Always plays. Never tested out and never quizzed.';
}

// Does the learner's result for this objective matter to the flow at all?
export const takesFails = (o, outcome) => outcome === 'plays' && ['Gate', 'Remediate'].includes(effectivePolicy(o));

// -> { items, chapters, signature, matchesListen, routedToArticle }
// item: { key, kind: 'audio'|'skip'|'step', label, note, partId?, objective?, tag? }. A chapter's key is its objective ID
// in every state, so changing an answer swaps what sits in that slot instead of re-keying the flow.
export function compose(objectives, learners) {
  const objs = objectives || [];
  const plan = planParts(objs);
  const partFor = (o, variant) => plan.find(p => p.topic === topicKey(o.id) && p.variant === variant)?.id;
  const L = o => learners[o.id] || defaultLearner(o);
  const items = [{ key: '00-open', kind: 'audio', label: 'Open', partId: plan[0]?.id, tag: 'open' }];
  const remedial = [];
  let chapters = 0;

  for (const o of objs.filter(inAudio)) {
    const r = routeOf(o);
    const l = L(o);
    const never = o.policy === 'Never skipped';
    let outcome = 'plays', variant = o.type === 'Know' ? 'base' : 'universal', tag = null, note = '';
    if (o.type === 'Know' && l.pre === 'correct') {
      if (o.lock === 'locked') {
        outcome = 'testup'; variant = 'testup'; tag = 'tested up';
        note = 'Compliance-locked. The correct pre-check swaps in the more demanding version, which is not quizzed again.';
      } else if (never) {
        note = 'Never skipped, so a correct pre-check does not remove it.';
      } else if (r.kind === 'testOut') {
        outcome = 'out'; tag = 'tested out';
      }
    }
    if (o.type === 'Feel') note = l.pre <= FEEL_LOW_MAX ? 'Low pre-check score. The audio still plays, and the interactive step picks up the low score.' : 'High pre-check score. Plays, same as always.';

    if (outcome === 'out') {
      items.push({ key: o.id, kind: 'skip', objective: o.id, label: `${o.id} tested out`, note: 'The pre-check was correct, so the base is removed.' });
      continue;
    }
    chapters += 1;
    items.push({ key: o.id, kind: 'audio', objective: o.id, partId: partFor(o, variant), label: o.id, tag, note });

    if (!takesFails(o, outcome)) continue;
    const p = effectivePolicy(o);
    const n = p === 'Gate' ? l.fails : Math.min(l.fails, 1);
    for (let i = 1; i <= n; i++) {
      remedial.push({ key: `rem-${o.id}-${i}`, kind: 'step', objective: o.id, label: `Remediate ${o.id}${n > 1 ? `, attempt ${i}` : ''}`, note: 'Interactive step in a modality the learner has not seen for this objective. Not audio.' });
    }
    if (p === 'Remediate' && l.fails) remedial.push({ key: `adv-${o.id}`, kind: 'step', objective: o.id, label: `${o.id}: advances regardless`, note: 'Remediate allows one retry, then the learner moves on.', quiet: true });
    if (p === 'Gate' && l.fails) remedial.push({ key: `mas-${o.id}`, kind: 'step', objective: o.id, label: `${o.id}: mastery after ${n} ${n === 1 ? 'retry' : 'retries'}`, note: 'A gate holds the learner here until the objective is passed.', quiet: true });
  }
  items.push(...remedial);

  // Do objectives sit outside the audio. Missed Know and Feel remediate first, then Do, then Do's own misses.
  const doRem = [];
  for (const o of objs.filter(x => x.type === 'Do' && topicKey(x.id))) {
    const l = L(o);
    items.push({ key: `do-${o.id}`, kind: 'step', objective: o.id, label: `Do: ${o.id}`, note: 'Practice and rubric in the simulation. Outside the audio.' });
    if (!takesFails(o, 'plays')) continue;
    const n = o.policy === 'Gate' ? l.fails : Math.min(l.fails, 1);
    for (let i = 1; i <= n; i++) doRem.push({ key: `drem-${o.id}-${i}`, kind: 'step', objective: o.id, label: `Remediate ${o.id}${n > 1 ? `, attempt ${i}` : ''}`, note: 'Runs after the other Do objectives, in a new modality. Not audio.' });
  }
  items.push(...doRem);

  const close = plan[plan.length - 1];
  if (close?.variant === 'close') items.push({ key: close.id, kind: 'audio', label: 'Close', partId: close.id, tag: 'close' });

  const signature = items.filter(i => i.kind === 'audio').map(i => i.partId).join(',');
  const named = planListens(objs).find(x => x.parts.join(',') === signature);
  return { items, chapters, signature, matchesListen: named?.name || null, routedToArticle: !!objs.filter(inAudio).length && chapters < MIN_CHAPTERS };
}
