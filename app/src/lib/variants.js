// Variants: a child module that borrows its inputs (seed, sources, pathway table, the signed claims ledger and the approved
// outline) from a base module, and goes on to its own beat sheets, script and audio with its own industry, learner role
// and conversation type. Everything signed off up to the outline applies to every variant, so the child carries the base's
// sign-off. A child remembers a fingerprint of the base's inputs, so it can say when the base has moved on.
import { resolveSetup } from './definitions.js';
import { newModule } from './store.js';

const hash = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return String(h); };
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export const isVariant = m => !!m?.parentId;
// A variant is made from a base module that has finished its inputs: the ledger settled, and the outline approved.
const settled = s => ['approved', 'skipped'].includes(s?.status);
export const canMakeVariant = m => !!m && !m.parentId && settled(m.stages?.ledger) && settled(m.stages?.plan);

// What the child inherits is exactly what is fingerprinted: if one of these changes in the base, the child is behind.
const INPUT_KEYS = ['seed', 'seedFields', 'sources', 'objectives', 'claimMeta', 'ledgerSigned'];
// The outline counts once the base holds nothing built on it. A module that still carries its own later work keeps the
// fingerprint it had before the outline was an input, so variants made from it don't suddenly look out of date.
export const inputsStamp = p => hash(JSON.stringify([
  ...INPUT_KEYS.map(k => p[k] ?? null), p.stages?.ledger?.status || '', p.stages?.ledger?.output || '',
  ...(p.stages?.plan?.output && !p.stages?.beats?.output ? [p.stages.plan.status || '', p.stages.plan.output] : []),
]));

// The conversation up to the end of the outline exchange. Later stages of the base are not part of the inputs.
function inputsThread(p) {
  const end = p.stages?.beats?.threadStart ?? (p.thread || []).length;
  return clone((p.thread || []).slice(0, end));
}
const SHARED = ['ledger', 'plan'];   // the stages a variant borrows; its own work starts at the beat sheets
function inherited(p) {
  return {
    ...Object.fromEntries(INPUT_KEYS.filter(k => p[k] !== undefined).map(k => [k, clone(p[k])])),
    thread: inputsThread(p),
    stages: Object.fromEntries(SHARED.filter(k => p.stages?.[k]).map(k => [k, clone(p.stages[k])])),
    itemState: Object.fromEntries(SHARED.filter(k => p.itemState?.[k]).map(k => [k, clone(p.itemState[k])])),
    parentStamp: inputsStamp(p),
  };
}

// A version is named by what it is: the show format, the industry and the learner role. There is nothing to type.
export function versionLabel(setup) {
  const r = resolveSetup(setup);
  return [r.industry?.name, r.role?.name, r.conversation?.name].filter(Boolean).join(' · ');
}
export const versionName = (root, setup) => `${root.name} · ${versionLabel(setup)}`;

export function makeVariant(parent, setup = parent.setup) {
  return { ...newModule(versionName(parent, setup), clone(setup)), ...inherited(parent), parentId: parent.id };
}

// A module made before versions existed has its own plan, script and audio. Move all of that into a version, and leave
// the module with the inputs only. Returns { version, root }. The caller moves the audio.
export const hasOwnRun = m => !m.parentId && (Object.keys(m.stages || {}).some(k => !SHARED.includes(k) && m.stages[k]?.output) || !!m.parts);
export function moveRunToVersion(root) {
  const version = { ...clone(root), id: crypto.randomUUID(), parentId: root.id, parentStamp: inputsStamp(root), name: versionName(root, root.setup), createdAt: Date.now() };
  const kept = inherited(root);
  const stripped = {
    ...root, thread: kept.thread, stages: kept.stages, itemState: kept.itemState,
    currentScript: '', parts: null, notes: [], timings: {}, runLog: (root.runLog || []).filter(r => SHARED.includes(r.stage)),
  };
  return { version, root: stripped };
}

// Takes the base's current inputs and clears everything the child built on the old ones (beat sheets onward, audio is
// cleared by the caller). Keeps the child's own name, note and setup.
export function resyncVariant(child, parent) {
  return {
    ...child, ...inherited(parent),
    currentScript: '', parts: null, notes: [], timings: {}, itemState: inherited(parent).itemState, runLog: child.runLog || [],
  };
}

export const variantBehind = (child, parent) => !!parent && !!child.parentId && child.parentStamp !== inputsStamp(parent);
