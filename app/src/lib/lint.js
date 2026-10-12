// The mechanical checks of the validity pass, done in code. A model counts casual markers and measures sentences
// unreliably and spends minutes writing the tally; code does both exactly. The validity pass is handed this report
// and keeps its time for the checks that need judgment.
import { parseScript } from './script.js';

const strip = t => t.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
const wordsOf = t => strip(t).match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu) || [];
const idOf = h => h.match(/^\d{2}[-_]\S+/)?.[0] ?? h;
const clip = (t, at = 0, len = 0) => {
  const s = strip(t);
  if (!len) return s.length > 90 ? `${s.slice(0, 87)}...` : s;
  const a = Math.max(0, at - 30), b = Math.min(s.length, at + len + 30);
  return `${a ? '...' : ''}${s.slice(a, b)}${b < s.length ? '...' : ''}`;
};

// The script reply -> [{ id, title, turns: [{ n, speaker, text }] }]. Headings with no spoken lines (the trace table) drop out.
export function partsOf(script) {
  const parts = [];
  let cur = null;
  for (const it of parseScript(script)) {
    if (it.type === 'heading') { cur = { id: idOf(it.text), title: it.text, turns: [] }; parts.push(cur); }
    else if (it.type === 'line' && cur) cur.turns.push({ n: cur.turns.length + 1, speaker: it.speaker, text: it.text });
  }
  return parts.filter(p => p.turns.length);
}

const CASUAL = [['honestly', /\bhonestly\b/gi], ['you know', /(?<!\b(?:do|did|if|as|that|what|how|so)\s)\byou know\b(?!\s+(?:what|how|why|that|which|where|who|when|if|whether)\b)/gi], ['look', /(?:^|[.!?]\s+)look,/gi], ['pretty much', /\bpretty much\b/gi]];
const OPENERS = /^(okay|got it|right|huh)\b/i;
const FILLER = /\buh{2,}\b/gi;
const STAGED = /\boff[- ]mic\b|\bbefore the show\b|\bthank(?:s| you)\b/i;
const BACK_REF = /\b(?:again|earlier|like we said|as we said|we covered|we talked about)\b/i;

export function lintScript(script) {
  const parts = partsOf(script);
  const exact = [], maybe = [];
  const at = (p, t) => `${p.id} turn ${t.n} (${t.speaker})`;
  const stats = [];

  for (const p of parts) {
    let words = 0, interruptions = 0, run = 0, prev = null;
    const openers = [], caps = new Set();
    for (const t of p.turns) {
      const text = strip(t.text);
      const w = wordsOf(t.text);
      words += w.length;

      for (const [name, re] of CASUAL) for (const m of text.matchAll(re)) exact.push({ check: 'Casual marker', key: name, where: at(p, t), quote: clip(t.text, m.index, m[0].length) });
      for (const m of text.matchAll(FILLER)) exact.push({ check: '"uhh"', key: 'uhh', where: at(p, t), quote: clip(t.text, m.index, m[0].length) });
      if (w.length === 1) exact.push({ check: 'Standalone one-word reaction turn', key: 'one-word', where: at(p, t), quote: clip(t.text) });

      // An interruption is a line cut off with a dash. Any other em dash is a failure.
      const body = text.replace(/\s*(?:[—–]|--)$/, '').replace(/^(?:[—–]|--)\s*/, '');
      if (/[—–]|\w--\w/.test(body)) exact.push({ check: 'Em dash', key: 'em dash', where: at(p, t), quote: clip(t.text, body.search(/[—–]|--/), 1) });
      if (/(?:[—–]|--)$/.test(text)) interruptions++;

      for (const s of text.split(/(?<=[.!?])\s+/)) {
        const n = wordsOf(s).length;
        if (n > 25) exact.push({ check: 'Sentence over 25 words', key: 'long sentence', where: at(p, t), quote: `${n} words: ${clip(s)}` });
      }

      if (t.speaker === prev) run++; else { run = 1; prev = t.speaker; }
      if (run === 3) exact.push({ check: 'More than two lines in a row by one speaker', key: 'run', where: at(p, t), quote: `${t.speaker} has a third line in a row` });

      const o = text.match(OPENERS);
      if (o) openers.push({ t, word: o[1].toLowerCase() });

      if ((text.match(/\?/g) || []).length > 1) maybe.push({ check: 'Possible stacked question', where: at(p, t), quote: clip(t.text) });
      if (STAGED.test(text)) maybe.push({ check: 'Possible staged or polite filler', where: at(p, t), quote: clip(t.text) });
      if (BACK_REF.test(text)) maybe.push({ check: 'Possible reference to another part', where: at(p, t), quote: clip(t.text) });
      for (const c of text.match(/\b[A-Z]{3,}\b/g) || []) caps.add(c);
    }
    if (interruptions > 1) exact.push({ check: 'More than one interruption in a part', key: 'interruptions', where: p.id, quote: `${interruptions} lines are cut off with a dash` });
    if (openers.length > 1) {
      // "Each is used at most once per part": a word used a second time in the same part.
      const seen = {};
      for (const { t, word } of openers) { if (seen[word]) exact.push({ check: 'Turn opener used more than once in a part', key: 'opener', where: at(p, t), quote: `"${word}" opens a turn again: ${clip(t.text)}` }); seen[word] = true; }
    }
    if (caps.size > 2) maybe.push({ check: 'Possible CAPS emphasis over two words (initialisms included)', where: p.id, quote: [...caps].join(', ') });
    stats.push({ id: p.id, turns: p.turns.length, words, minutes: words / 140 });
  }

  // The same first three words opening turns across the listen: a possible repeated frame, for the model to judge.
  const starts = new Map();
  for (const p of parts) for (const t of p.turns) {
    const k = wordsOf(t.text).slice(0, 3).join(' ').toLowerCase();
    if (k.split(' ').length === 3) (starts.get(k) || starts.set(k, []).get(k)).push(at(p, t));
  }
  for (const [k, list] of starts) if (list.length > 1) maybe.push({ check: 'Possible repeated frame', where: list.join('; '), quote: `turns that open "${k}..."` });

  // A figure said again within two turns.
  for (const p of parts) p.turns.forEach((t, i) => {
    const nums = new Set(strip(t.text).match(/\d[\d,.]*%?/g) || []);
    for (const u of p.turns.slice(i + 1, i + 3)) for (const n of strip(u.text).match(/\d[\d,.]*%?/g) || []) if (nums.has(n)) maybe.push({ check: 'Possible figure said twice within two turns', where: `${at(p, t)} and ${at(p, u)}`, quote: n });
  });

  return { exact, maybe, stats };
}

const group = list => {
  const by = new Map();
  for (const f of list) (by.get(f.check) || by.set(f.check, []).get(f.check)).push(f);
  return by;
};

// The report as prompt text for the validity pass. Tallies casual markers per word, as the checklist asks.
export function mechanicalReport(script) {
  const { exact, maybe, stats } = lintScript(script);
  if (!stats.length) return '';
  const out = ['## Mechanical checks (computed by the app from the script)', ''];
  out.push('Exact results. These are counted by code, so they are final: report each as a failure with its fix, and do not recount.', '');
  if (!exact.length) out.push('- None found: no casual markers, "uhh", one-word turns, stray em dashes, sentences over 25 words, three-in-a-row speakers, repeated openers or extra interruptions.');
  for (const [check, list] of group(exact)) {
    out.push(`- ${check} (${list.length}):`);
    if (check === 'Casual marker') {
      const per = {};
      for (const f of list) per[f.key] = (per[f.key] || 0) + 1;
      out.push(`  Totals for the listen: ${Object.entries(per).map(([k, n]) => `"${k}" x${n}`).join(', ')}`);
    }
    for (const f of list) out.push(`  - ${f.where}: ${f.quote}`);
  }
  out.push('', 'Candidates. These are patterns that are sometimes fine. Judge each, and report only the ones that are real problems.', '');
  if (!maybe.length) out.push('- None.');
  for (const [check, list] of group(maybe)) {
    out.push(`- ${check} (${list.length}):`);
    for (const f of list) out.push(`  - ${f.where}: ${f.quote}`);
  }
  const total = stats.reduce((n, s) => n + s.words, 0);
  out.push('', 'Spoken words and runtime (words / 140, not counting holds and stings). Use these figures for the length checks:', '');
  for (const s of stats) out.push(`- ${s.id}: ${s.words} words, ${s.turns} turns, ${s.minutes.toFixed(1)} min`);
  out.push(`- All parts together: ${total} words, ${(total / 140).toFixed(1)} min`);
  return out.join('\n');
}
