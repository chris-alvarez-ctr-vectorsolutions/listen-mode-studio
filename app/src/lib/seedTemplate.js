// The "Template" route into the seed: a prompt an LXD pastes into any AI tool along with their source files,
// and the parser that reads the document it writes back. Built from SEED_FIELDS so the two never drift.
import { SEED_FIELDS } from './seed.js';
import { normalizeObjective } from './pathways.js';

export function templatePrompt() {
  const fields = SEED_FIELDS.map(f => `## ${f.label}\n(${f.help}${f.required ? ' Required.' : ' Write None if the sources say nothing.'})`).join('\n\n');
  return `You are helping a learning experience designer prepare the seed for a two-host training audio module. Read the attached source files (course script, slide deck, SOPs, objectives, reference material) and write one plain-text document in exactly the format below.

Rules:
- Output only the document. No commentary before or after it, and no code fence.
- Use only what the sources say. Do not invent objectives, claims, sources or numbers. If a section has nothing in the sources, write None.
- Keep every heading exactly as written, on its own line, starting with "## ".
- Content claims: one claim per line, as a plain sentence, with its source in square brackets at the end, for example [Cafe prep SOP, section 3.2]. No numbering or bullets.
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
- Lock (Know only; write n/a for the rest): locked if the sources say it is compliance-locked or can't be tested out of; fallback if they say testing out is allowed today but a lock may be confirmed; otherwise open.

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
  for (const line of body.split('\n')) {
    const h = line.match(/^#{1,3}\s*(.+?)\s*#*\s*$/);
    if (h) { cur = { name: norm(h[1].replace(/\*+/g, '')), lines: [] }; sections.push(cur); continue; }
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
