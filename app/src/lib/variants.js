// Variants: a child module that borrows its inputs (seed, sources, pathway table, the signed claims ledger) from a base
// module, and goes on to its own plan, script and audio with its own industry, learner role and conversation type.
// Everything signed off before the ledger applies to every variant, so the child carries the base's sign-off. A child
// remembers a fingerprint of the base's inputs, so it can say when the base has moved on.
import { newModule } from './store.js';

const hash = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return String(h); };
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export const isVariant = m => !!m?.parentId;
// A variant is made from a base module that has finished its inputs: the ledger approved, or deliberately skipped.
export const canMakeVariant = m => !!m && !m.parentId && ['approved', 'skipped'].includes(m.stages?.ledger?.status);

// What the child inherits is exactly what is fingerprinted: if one of these changes in the base, the child is behind.
const INPUT_KEYS = ['seed', 'seedFields', 'sources', 'objectives', 'claimMeta', 'ledgerSigned'];
export const inputsStamp = p => hash(JSON.stringify([...INPUT_KEYS.map(k => p[k] ?? null), p.stages?.ledger?.status || '', p.stages?.ledger?.output || '']));

// The conversation up to the end of the ledger exchange. Later stages of the base are not part of the inputs.
function ledgerThread(p) {
  const end = p.stages?.plan?.threadStart ?? (p.thread || []).length;
  return clone((p.thread || []).slice(0, end));
}
function inherited(p) {
  const ledger = p.stages?.ledger;
  return {
    ...Object.fromEntries(INPUT_KEYS.filter(k => p[k] !== undefined).map(k => [k, clone(p[k])])),
    thread: ledgerThread(p),
    stages: ledger ? { ledger: clone(ledger) } : {},
    itemState: p.itemState?.ledger ? { ledger: clone(p.itemState.ledger) } : {},
    parentStamp: inputsStamp(p),
  };
}

export function makeVariant(parent, name, setup = parent.setup) {
  return { ...newModule(name, clone(setup)), ...inherited(parent), parentId: parent.id };
}

// Takes the base's current inputs and clears everything the child built on the old ones (plan onward, audio is
// cleared by the caller). Keeps the child's own name, note and setup.
export function resyncVariant(child, parent) {
  return {
    ...child, ...inherited(parent),
    currentScript: '', parts: null, notes: [], timings: {}, itemState: inherited(parent).itemState, runLog: child.runLog || [],
  };
}

export const variantBehind = (child, parent) => !!parent && !!child.parentId && child.parentStamp !== inputsStamp(parent);
