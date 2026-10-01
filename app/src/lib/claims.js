// Claim-to-part impact: which parts and review cards rest on which ledger claims, and which of them
// were made from a claim that has since changed.

// Ledger table ("ID | claim | source | flag") -> { C01: 'claim text', ... }
export function parseLedger(text = '') {
  const claims = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*\|?\s*\**(C\d{2,3})\**\s*\|\s*([^|]+?)\s*\|/);
    if (m) claims[m[1]] = m[2].replace(/\*+/g, '').trim();
  }
  return claims;
}

// Short stable fingerprint of the ledger, recorded in the export so a package says which ledger it came from.
export function ledgerVersion(claims) {
  const s = Object.keys(claims).sort().map(k => `${k}:${claims[k]}`).join('\n');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// What a part or card set was built from: the text of each claim it cites, as the ledger read at that time.
export const snapshot = (ids, ledger) =>
  Object.fromEntries((ids || []).filter(id => ledger[id]).map(id => [id, ledger[id]]));

const staleIds = (seen, ledger) => Object.keys(seen).filter(id => seen[id] !== ledger[id]);
const isOpenOrClose = id => /(^|[-_])(open|close)$/i.test(id);

export function buildImpact(m) {
  const ledger = parseLedger(m.stages?.ledger?.output);
  const parts = m.parts?.parts || [];
  const sets = m.reviewSets?.sets || [];
  const timings = m.timings || {};
  const cardIds = s => [...(s.cards || []), ...(s.retry || [])].flatMap(x => x.claims || []);

  const partRows = parts.map(p => {
    const seen = timings[p.id]?.claims;
    return {
      id: p.id,
      claims: p.claims || null,
      rendered: !!timings[p.id],
      tracked: !!seen,
      stale: seen ? staleIds(seen, ledger) : [],
    };
  });
  const setRows = sets.map(s => ({
    topic: s.topic,
    claims: [...new Set(cardIds(s))],
    stale: m.reviewSets?.claimsSeen ? staleIds(snapshot(cardIds(s), m.reviewSets.claimsSeen), ledger) : [],
  }));

  const claimRows = Object.keys(ledger).map(id => ({
    id, text: ledger[id],
    parts: partRows.filter(p => p.claims?.includes(id)).map(p => p.id),
    sets: setRows.filter(s => s.claims.includes(id)).map(s => s.topic),
  }));

  const issues = [];
  const known = new Set(Object.keys(ledger));
  const cited = new Set([...partRows.flatMap(p => p.claims || []), ...setRows.flatMap(s => s.claims)]);
  for (const c of claimRows) if (!c.parts.length && !c.sets.length) issues.push(`${c.id} isn't used by any part or card.`);
  for (const id of cited) if (!known.has(id)) issues.push(`${id} is cited but isn't in the ledger.`);
  for (const p of partRows) {
    if (!p.claims) issues.push(`${p.id} has no claim data. Run the performance pass again.`);
    else if (!p.claims.length && !isOpenOrClose(p.id)) issues.push(`${p.id} cites no claims.`);
  }
  return { ledger, version: ledgerVersion(ledger), claimRows, partRows, setRows, issues };
}
