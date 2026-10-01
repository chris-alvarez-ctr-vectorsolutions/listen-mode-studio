// Claim-to-part impact: which parts rest on which ledger claims, and which of them
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

// Full ledger rows for the review cards: "ID | claim | source | flag | proposed fix" (the last column is optional).
const cellsOf = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
const idOf = cell => (cell || '').replace(/\*/g, '').trim();
const NO_FLAG = /^(|-|—|–|none|n\/a|no|no flag)\.?$/i;
const strip = c => (c || '').replace(/\*+/g, '').trim();

export function parseLedgerRows(text = '') {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.includes('|')) continue;
    const c = cellsOf(line);
    const id = idOf(c[0]);
    if (!/^C\d{2,3}$/.test(id) || c.length < 2) continue;
    const flag = strip(c[3]);
    rows.push({ id, claim: strip(c[1]), source: strip(c[2]), flag: NO_FLAG.test(flag) ? '' : flag, fix: strip(c[4]) });
  }
  return rows;
}

// Local edits to the ledger table. Each returns the new text; a row that isn't found leaves the text unchanged.
// cols: index -> new cell text (1 claim, 2 source, 3 flag, 4 proposed fix).
const clean = t => String(t).replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim();
export function editLedgerRow(text, id, cols) {
  return text.split('\n').map(line => {
    if (!line.includes('|')) return line;
    const c = cellsOf(line);
    if (idOf(c[0]) !== id) return line;
    while (c.length < 5) c.push('');
    for (const [i, v] of Object.entries(cols)) c[i] = clean(v);
    return `| ${c.join(' | ')} |`;
  }).join('\n');
}
export function dropLedgerRow(text, id) {
  return text.split('\n').filter(line => !(line.includes('|') && idOf(cellsOf(line)[0]) === id)).join('\n');
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
  const timings = m.timings || {};

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
  const claimRows = Object.keys(ledger).map(id => ({
    id, text: ledger[id],
    parts: partRows.filter(p => p.claims?.includes(id)).map(p => p.id),
  }));

  const issues = [];
  const known = new Set(Object.keys(ledger));
  const cited = new Set(partRows.flatMap(p => p.claims || []));
  for (const c of claimRows) if (!c.parts.length) issues.push(`${c.id} isn't used by any part.`);
  for (const id of cited) if (!known.has(id)) issues.push(`${id} is cited but isn't in the ledger.`);
  for (const p of partRows) {
    if (!p.claims) issues.push(`${p.id} has no claim data. Run the performance pass again.`);
    else if (!p.claims.length && !isOpenOrClose(p.id)) issues.push(`${p.id} cites no claims.`);
  }
  return { ledger, version: ledgerVersion(ledger), claimRows, partRows, issues };
}
