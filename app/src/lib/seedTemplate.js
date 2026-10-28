// The "Template" route into the seed: a prompt an LXD pastes into any AI tool along with their source files,
// and the parser that reads the document it writes back. Built from SEED_FIELDS so the two never drift.
import { SEED_FIELDS } from './seed.js';
import { normalizeObjective } from './pathways.js';

// The inputs are shared by every variant of a module, so this prompt says nothing about industry, learner role or show
// format: those are chosen later, per variant.
export function templatePrompt() {
  const fields = SEED_FIELDS.map(f => `## ${f.label}\n(${f.help}${f.required ? ' Required.' : ' Write None if the sources say nothing.'})`).join('\n\n');
  return `You are helping a learning experience designer prepare the shared inputs for a training audio module. Read the attached source files (course script, slide deck, SOPs, objectives, reference material) and write one plain-text document in exactly the format below.

Rules:
- Put the whole document inside ONE fenced code block that starts with \`\`\`markdown and ends with \`\`\`. This keeps the "##" headings and the "|" characters as plain text when the document is copied. Write nothing outside the code block.
- Use only what the sources say. Do not invent objectives, claims, sources or numbers. If a section has nothing in the sources, write None.
- Keep every heading exactly as written, on its own line, starting with "## ".
- Content claims: one claim per line, as a plain sentence, ending with the ID of the objective it supports (from the pathway table) and its source in square brackets, for example [K2 · Cafe prep SOP, section 3.2]. No numbering or bullets.
- State each fact once, in its most specific form. Leave out a sentence that sums up or combines other claims (an outcome overview, an introduction), and a claim that repeats another in different words.
- The audio teaches the Know and Feel objectives. Do objectives are practiced outside it. Leave out a claim that serves only a Do objective, such as how to choose between options, the order to do things in, or a "when X, do Y" rule. If a Know or Feel objective names the same fact, keep the claim once, under that objective's ID.
- Write a claim or rule that holds only in some situations with its condition ("When someone ..., ..."). Never write "always", "first" or "never" without saying when.
- Versions and constraints: only what the script must not say, or how it must say something. Don't restate a content claim there.
- Anything else: only context a scriptwriter needs about the learners or the content. Leave out routing, permutation or assembly tables, chapter or item IDs, assessment formats and question counts, and notes about relabeling. The pathway table carries the routing, and the audio has no assessments. Include practice scenarios only for Know and Feel objectives, each ending with its objective ID in square brackets.
- Learning objectives: one per line, written as what the learner can do.

FORMAT

${fields}

## Pathway table
(One line per learning objective, in the order the course presents them, with the fields separated by " | ". Include every objective, including Do objectives. No header row.)
ID | Objective | Type | Subscale | Policy | Lock

- ID: the ID the course uses (K1, F2, D1). If it has none, number them K1, K2... for Know, F1... for Feel and D1... for Do.
- Type: Know, Feel or Do.
- Subscale: for Know, Remember or Observe. For Feel, Believe, Value or Perceive. For Do, Activate or Apply.
- Policy: Gate, Remediate, Ask or Never skipped, as the sources state it. If they don't, use Gate for Know and Do, and Remediate for Feel.
- Lock (Know only; write n/a for the rest): always if the sources say it has no pre-check item and every learner hears it; locked if they say it is compliance-locked (it has a pre-check item but can't be tested out of); fallback if they say testing out is allowed today but a lock may be confirmed; otherwise open.

Example lines:
K1 | The learner can explain why focaccia is cooled before it is sliced. | Know | Remember | Gate | open
F1 | The learner can recognize why a sandwich that looks fine can still fail. | Feel | Believe | Remediate | n/a`;
}

const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const EMPTY = /^(none|n\/a|na|nothing|-|—|–)\.?$/i;
const byLabel = Object.fromEntries(SEED_FIELDS.map(f => [norm(f.label), f.id]));

// Pasted document -> { fields, objectives, found, missing, notes }. Tolerates a code fence and heading variations.
export function parseSeedTemplate(text = '') {
  const body = text.replace(/^\s*```[a-z]*\s*\n/i, '').replace(/\n```\s*$/i, '');
  const sections = [];
  let cur = null;
  for (const raw of body.split('\n')) {
    const line = raw.includes('\t') && !raw.includes('|') ? raw.split('\t').map(c => c.trim()).join(' | ') : raw;   // rows pasted from a rendered table
    const h = line.match(/^#{1,3}\s*(.+?)\s*#*\s*$/);
    // A line that is only a known section name counts as a heading even without its "##" (a paste from rendered text).
    const bare = !h && (() => { const n = norm(line.replace(/\*+/g, '').replace(/:\s*$/, '')); return (byLabel[n] || /^pathway table$/.test(n)) ? n : null; })();
    if (h || bare) { cur = { name: h ? norm(h[1].replace(/\*+/g, '')) : bare, lines: [] }; sections.push(cur); continue; }
    if (cur) cur.lines.push(line);
  }
  const fields = {};
  const found = [];
  const notes = [];
  let objectives = [];
  for (const s of sections) {
    const value = s.lines.join('\n').trim();
    if (byLabel[s.name]) {
      fields[byLabel[s.name]] = EMPTY.test(value) ? '' : value;
      found.push(SEED_FIELDS.find(f => f.id === byLabel[s.name]).label);
    } else if (/pathway|objectives and pathways/.test(s.name)) {
      objectives = s.lines
        .filter(l => l.includes('|'))
        .map(l => l.replace(/^\s*[-*]\s*/, '').replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim()))
        .filter(c => c.length >= 3 && !/^-+$/.test(c[0]) && c[0].toLowerCase() !== 'id')
        .map(c => normalizeObjective({ id: c[0], objective: c[1], type: c[2], subscale: c[3], policy: c[4], lock: c[5] }))
        .filter(o => o.id);
      found.push('Pathway table');
    } else if (s.name) {
      notes.push(`Ignored a section it didn't recognize: "${s.name}".`);
    }
  }
  const missing = SEED_FIELDS.filter(f => f.required && !(fields[f.id] || '').trim()).map(f => f.label);
  if (!found.length) notes.unshift('No sections found. Check that the headings start with "## " and match the template.');
  return { fields, objectives, found, missing, notes };
}
