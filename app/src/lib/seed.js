// The structured seed. To add an intake field, add an entry to SEED_FIELDS: it appears in the form,
// is composed into the seed text Claude reads, and is saved with the module. Nothing else needs to change.
export const SEED_FIELDS = [
  { id: 'audience', label: 'Audience and sector', rows: 2, required: false,
    help: 'Who the learners are, their roles, and the setting they work in.',
    placeholder: 'Line cooks and prep staff at a casual cafe. They build sandwiches to order during a busy lunch rush, and most have never worked with focaccia before.' },
  { id: 'objectives', label: 'Learning objectives', rows: 4, required: true,
    help: 'One per line, written as what the learner can do.',
    placeholder: 'The learner can explain why focaccia is cooled and sliced a certain way before it is used for a sandwich.\nThe learner can name the order of layers that keeps the bread from going soggy.' },
  { id: 'claims', label: 'Content claims', rows: 8, required: true,
    help: 'The facts, steps and rules the script may state, one per line. Add the source in brackets (slide, SOP, reference) when you have it. The claims ledger is built from this, and the script can only say what is listed here.',
    placeholder: 'Focaccia is cooled completely before it is sliced. [Cafe prep SOP, section 1]\nSlicing warm focaccia squashes the crumb and tears the crust. [Cafe prep SOP, section 1.3]\nTomato goes in last and is patted dry first, because it is the wettest ingredient. [Cafe prep SOP, section 3.2]' },
  { id: 'skip', label: 'Skip rules', rows: 2, required: false,
    help: 'Topics that are out of scope or can be skipped.',
    placeholder: 'Skip how to bake the focaccia, sourcing ingredients, and allergen labeling.' },
  { id: 'constraints', label: 'Versions and constraints', rows: 2, required: false,
    help: 'Anything the script must not say, product versions, regulations, or a target length.',
    placeholder: 'Do not name specific brands or cheeses. Do not give times or temperatures. About 6 minutes total.' },
  { id: 'notes', label: 'Anything else', rows: 3, required: false,
    help: 'Other context for the writer.', placeholder: 'This module is fictional and exists to test the pipeline.' },
];

export const EXAMPLE_NAME = 'Example: Making an Italian Focaccia Sandwich';
export const EXAMPLE_FIELDS = {
  audience: 'Line cooks and prep staff at a casual cafe. They build sandwiches to order during a busy lunch rush, and most have never worked with focaccia before.',
  objectives: 'The learner can explain why focaccia is cooled and sliced a certain way before it is used for a sandwich.\nThe learner can name the order of layers that keeps the bread from going soggy.\nThe learner can recognize why a sandwich that looks fine at the pass can fail by the time the customer eats it.\nThe learner can build a focaccia sandwich in the correct order, start to finish.',
  claims: [
    'Focaccia is cooled completely before it is sliced. [Cafe prep SOP, section 1]',
    'Focaccia is sliced horizontally with a serrated knife, using a gentle sawing motion rather than pressing down. [Cafe prep SOP, section 1.2]',
    'Slicing warm focaccia squashes the crumb and tears the crust. [Cafe prep SOP, section 1.3]',
    'A thin layer of olive oil is brushed on both cut sides before any filling goes on. [Cafe prep SOP, section 2]',
    'The oil layer works as a barrier between the bread and wet fillings. [Cafe prep SOP, section 2]',
    'Layers go on in this order: cheese first, then cured meat, then greens, then tomato last. [Cafe prep SOP, section 3]',
    'Tomato goes in last and is patted dry first, because it is the wettest ingredient. [Cafe prep SOP, section 3.2]',
    'A sandwich built in the wrong order can look fine at the pass and be soggy within minutes. [Cafe prep SOP, section 3.4]',
    'The sandwich is pressed lightly with the palm, never flattened. [Cafe prep SOP, section 4]',
    'Each sandwich is cut in half on a slight diagonal and wrapped in paper. [Cafe prep SOP, section 5]',
  ].join('\n'),
  skip: 'Skip how to bake the focaccia, sourcing ingredients, and allergen labeling.',
  constraints: 'Do not name specific brands or cheeses. Do not give times or temperatures. About 6 minutes total.',
  notes: 'This module is fictional and exists to test the pipeline.',
};

export const EXAMPLE_OBJECTIVES = [
  { id: 'K1', objective: 'Explain why focaccia is cooled and sliced a certain way.', type: 'Know', subscale: 'Remember', policy: 'Gate', lock: 'open', audio: true },
  { id: 'K2', objective: 'Name the order of layers that keeps the bread from going soggy.', type: 'Know', subscale: 'Observe', policy: 'Remediate', lock: 'locked', audio: true },
  { id: 'F1', objective: 'Recognize why a sandwich that looks fine at the pass can fail.', type: 'Feel', subscale: 'Believe', policy: 'Remediate', lock: 'open', audio: true },
  { id: 'D1', objective: 'Build a focaccia sandwich in the correct order.', type: 'Do', subscale: 'Apply', policy: 'Never skipped', lock: 'open', audio: false },
];

export function composeSeed(fields) {
  return SEED_FIELDS
    .filter(f => (fields[f.id] || '').trim())
    .map(f => `### ${f.label}\n\n${fields[f.id].trim()}`)
    .join('\n\n');
}

export function missingRequired(fields) {
  return SEED_FIELDS.filter(f => f.required && !(fields[f.id] || '').trim()).map(f => f.label);
}

// Modules made before the structured form keep their free text in "Anything else".
export function seedFieldsOf(m) {
  return m.seedFields || (m.seed ? { notes: m.seed } : {});
}
