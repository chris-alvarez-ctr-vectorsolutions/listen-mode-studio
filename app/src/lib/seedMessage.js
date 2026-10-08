// The seed message that opens a module's conversation with Claude, and how it is kept current.
// The source files are only for building the claims ledger. After that, every fact comes from the ledger, so later
// stages don't see the raw sources (it keeps the context small, and the model from reaching past the ledger).
export function seedBlock(m, withSources = true) {
  const sources = withSources
    ? m.sources.map(s => `### ${s.name}\n\n${s.text}`).join('\n\n')
    : (m.sources.length ? '(The source files were used to build the claims ledger and are not repeated here. Every fact comes from the ledger.)' : '');
  return `# Module: ${m.name}\n\n## Seed\n\n${m.seed || '(none)'}\n\n## Source files\n\n${sources || '(none)'}\n\nClaims ledger signed by the SME: ${m.ledgerSigned ? 'yes' : 'no (treat this run as an internal draft)'}.`;
}
// The first message of a saved conversation holds the seed as it was when the ledger stage first ran, so it still says
// "unsigned" and carries the old name and seed text. Rebuild its seed part from the module as it is now, and keep
// the stage prompt that follows it.
const SIGNED_LINE = 'Claims ledger signed by the SME:';
export function freshSeed(first, m, withSources) {
  const i = first.lastIndexOf(SIGNED_LINE);
  if (i < 0) return first;
  const nl = first.indexOf('\n', i);
  return seedBlock(m, withSources) + (nl < 0 ? '' : first.slice(nl));
}

// The ledger reply was written before anyone could sign it, so it may say "internal draft" or "not signed". The text can't
// be rewritten safely, so once the SME has signed, say so right after it.
export const SIGNED_NOTE = '\n\n[Update: the SME has since signed this claims ledger. Disregard any earlier statement in it that the ledger is unsigned or an internal draft.]';
export function withSignedNote(text, signed) {
  return signed && text && !text.includes(SIGNED_NOTE) ? text + SIGNED_NOTE : text;
}
