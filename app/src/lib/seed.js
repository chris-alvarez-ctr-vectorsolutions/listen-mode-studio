// The structured seed. To add an intake field, add an entry to SEED_FIELDS: it appears in the form,
// is composed into the seed text Claude reads, and is saved with the module. Nothing else needs to change.
export const SEED_FIELDS = [
  { id: 'audience', label: 'Audience and sector', rows: 2, required: false,
    help: 'Who the learners are, their roles, and the setting they work in.',
    placeholder: 'Instructional designers and LXDs at a training company, building audio modules.' },
  { id: 'objectives', label: 'Learning objectives', rows: 4, required: true,
    help: 'One per line, written as what the learner can do.',
    placeholder: 'The learner can describe the render, check, revise workflow.\nThe learner can explain why a part is checked before the full module is rendered.' },
  { id: 'claims', label: 'Content claims', rows: 8, required: true,
    help: 'The facts, steps and rules the script may state, one per line. Add the source in brackets (slide, SOP, reference) when you have it. The claims ledger is built from this, and the script can only say what is listed here.',
    placeholder: 'Rendering one part first catches voice and model problems cheaply. [Production guide, p.2]\nA fix to a line means rewriting the line and rendering that part again. [Production guide, p.4]' },
  { id: 'skip', label: 'Skip rules', rows: 2, required: false,
    help: 'Topics that are out of scope or can be skipped.',
    placeholder: 'Skip ElevenLabs account setup and billing.' },
  { id: 'constraints', label: 'Versions and constraints', rows: 2, required: false,
    help: 'Anything the script must not say, product versions, regulations, or a target length.',
    placeholder: 'Do not name specific voices. About 6 minutes total.' },
  { id: 'notes', label: 'Anything else', rows: 3, required: false,
    help: 'Other context for the writer.', placeholder: '' },
];

export const EXAMPLE_NAME = 'Example: Lockout/tagout basics';
export const EXAMPLE_FIELDS = {
  audience: 'Maintenance technicians at a food manufacturing plant. They service conveyors and mixers during scheduled downtime.',
  objectives: 'The learner can state when lockout/tagout is required.\nThe learner can list the steps to lock out a machine in order.\nThe learner can say what to do if the person who placed a lock is not available.',
  claims: 'Lockout/tagout is required before servicing a machine where unexpected startup or stored energy could cause injury. [Plant LOTO policy, section 1]\nThe lockout steps are: notify, shut down, isolate, lock and tag, release stored energy, verify. [Plant LOTO policy, section 3]\nEach person working on the machine places their own lock. [Plant LOTO policy, section 3.2]\nOnly the person who placed a lock may remove it, except through the supervisor removal procedure. [Plant LOTO policy, section 5]\nVerify means trying to start the machine and confirming it does not run. [Plant LOTO policy, section 3.6]',
  skip: 'Skip electrical panel specifics and contractor procedures.',
  constraints: 'Do not quote regulation numbers. About 5 minutes.',
  notes: 'This example is fictional. Use it to see how the stages respond to a well-formed seed.',
};

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
