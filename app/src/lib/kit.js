// The kit is the advanced settings area: the core rules, the built-in conversation type's text, and the
// stage prompts. Most people never open it. What an LXD chooses per module (industry, learner role,
// conversation type) lives in definitions.js and is stored on the module as its setup.
//
// The prompt is the core rules with each slot filled from the module's chosen conversation type, and a
// "Show setup" block for the chosen industry and learner role.
import projectInstructions from '../kit/core/00_project_instructions.md?raw';
import guideIntro from '../kit/core/01_guide_intro.md?raw';
import guideRules from '../kit/core/01_guide_rules.md?raw';
import guideStudio from '../kit/core/01_guide_studio.md?raw';
import patternLibrary from '../kit/core/03_pattern_library.md?raw';
import lintFacts from '../kit/core/04_lint_facts_modular_learning.md?raw';
import lintLength from '../kit/core/04_lint_length.md?raw';
import interviewCast from '../kit/formats/interview-host-expert/01_guide_cast.md?raw';
import interviewCraft from '../kit/formats/interview-host-expert/01_guide_craft.md?raw';
import interviewVoice from '../kit/formats/interview-host-expert/02_voice_example.md?raw';
import interviewLint from '../kit/formats/interview-host-expert/04_lint_conversation.md?raw';
import mythCast from '../kit/formats/myth-vs-fact/01_guide_cast.md?raw';
import mythCraft from '../kit/formats/myth-vs-fact/01_guide_craft.md?raw';
import mythVoice from '../kit/formats/myth-vs-fact/02_voice_example.md?raw';
import mythLint from '../kit/formats/myth-vs-fact/04_lint_conversation.md?raw';
import mailCast from '../kit/formats/mailbag/01_guide_cast.md?raw';
import mailCraft from '../kit/formats/mailbag/01_guide_craft.md?raw';
import mailVoice from '../kit/formats/mailbag/02_voice_example.md?raw';
import mailLint from '../kit/formats/mailbag/04_lint_conversation.md?raw';
import scenCast from '../kit/formats/scenario-debrief/01_guide_cast.md?raw';
import scenCraft from '../kit/formats/scenario-debrief/01_guide_craft.md?raw';
import scenVoice from '../kit/formats/scenario-debrief/02_voice_example.md?raw';
import scenLint from '../kit/formats/scenario-debrief/04_lint_conversation.md?raw';
import expCast from '../kit/formats/host-with-experts/01_guide_cast.md?raw';
import expCraft from '../kit/formats/host-with-experts/01_guide_craft.md?raw';
import expVoice from '../kit/formats/host-with-experts/02_voice_example.md?raw';
import expLint from '../kit/formats/host-with-experts/04_lint_conversation.md?raw';
import coCast from '../kit/formats/co-hosts-learning/01_guide_cast.md?raw';
import coCraft from '../kit/formats/co-hosts-learning/01_guide_craft.md?raw';
import coVoice from '../kit/formats/co-hosts-learning/02_voice_example.md?raw';
import coLint from '../kit/formats/co-hosts-learning/04_lint_conversation.md?raw';
import soloCast from '../kit/formats/solo-narrator/01_guide_cast.md?raw';
import soloCraft from '../kit/formats/solo-narrator/01_guide_craft.md?raw';
import soloVoice from '../kit/formats/solo-narrator/02_voice_example.md?raw';
import soloLint from '../kit/formats/solo-narrator/04_lint_conversation.md?raw';
import { DEFAULT_STAGES } from '../kit/stages.js';
import { BUILTIN_CONVERSATIONS, applyBackgrounds, loadLibrary, resolveSetup, saveLibrary, setupBlock } from './definitions.js';

const KIT_KEY = 'mas.kit';

export const CORE = {
  projectInstructions: { name: 'Project instructions', text: projectInstructions },
  guideIntro: { name: 'Guide: intro', text: guideIntro },
  guideRules: { name: 'Guide: pathways and rules', text: guideRules },
  guideStudio: { name: 'Guide: studio editing', text: guideStudio },
  patternLibrary: { name: 'Pattern library', text: patternLibrary },
  lintFacts: { name: 'Lint: facts, modular, learning', text: lintFacts },
  lintLength: { name: 'Lint: length', text: lintLength },
  reviewExamples: { name: 'Lessons from review', text: '' },
};
// The built-in conversation type's text slots. A custom conversation type carries its own.
const BUILTIN_SLOTS = {
  'interview-host-expert': {
    cast: { name: 'Guide: format and cast', text: interviewCast },
    craft: { name: 'Guide: craft, length, render', text: interviewCraft },
    voice: { name: 'Voice example', text: interviewVoice },
    lint: { name: 'Lint: conversation', text: interviewLint },
  },
  'myth-vs-fact': {
    cast: { name: 'Guide: format and cast', text: mythCast },
    craft: { name: 'Guide: craft, length, render', text: mythCraft },
    voice: { name: 'Voice example', text: mythVoice },
    lint: { name: 'Lint: myth versus fact', text: mythLint },
  },
  mailbag: {
    cast: { name: 'Guide: format and cast', text: mailCast },
    craft: { name: 'Guide: craft, length, render', text: mailCraft },
    voice: { name: 'Voice example', text: mailVoice },
    lint: { name: 'Lint: mailbag', text: mailLint },
  },
  'scenario-debrief': {
    cast: { name: 'Guide: format and cast', text: scenCast },
    craft: { name: 'Guide: craft, length, render', text: scenCraft },
    voice: { name: 'Voice example', text: scenVoice },
    lint: { name: 'Lint: scenario and debrief', text: scenLint },
  },
  'host-with-experts': {
    cast: { name: 'Guide: format and cast', text: expCast },
    craft: { name: 'Guide: craft, length, render', text: expCraft },
    voice: { name: 'Voice example', text: expVoice },
    lint: { name: 'Lint: host with experts', text: expLint },
  },
  'co-hosts-learning': {
    cast: { name: 'Guide: format and co-hosts', text: coCast },
    craft: { name: 'Guide: craft, length, render', text: coCraft },
    voice: { name: 'Voice example', text: coVoice },
    lint: { name: 'Lint: co-hosts learning', text: coLint },
  },
  'solo-narrator': {
    cast: { name: 'Guide: format and narrator', text: soloCast },
    craft: { name: 'Guide: craft, length, render', text: soloCraft },
    voice: { name: 'Voice example', text: soloVoice },
    lint: { name: 'Lint: narration', text: soloLint },
  },
};
const fKey = (cid, slot) => `format.${cid}.${slot}`;

// Every editable file in the kit with its storage key and default text, in the order the Kit page lists them.
export function kitFiles() {
  const rows = [];
  const core = id => rows.push({ key: id, layer: 'Core', ...CORE[id] });
  for (const id of ['projectInstructions', 'guideIntro', 'guideRules', 'guideStudio', 'patternLibrary', 'lintFacts', 'lintLength', 'reviewExamples']) core(id);
  for (const c of BUILTIN_CONVERSATIONS) {
    for (const [slot, f] of Object.entries(BUILTIN_SLOTS[c.id])) rows.push({ key: fKey(c.id, slot), layer: `Conversation type: ${c.name}`, ...f });
  }
  return rows;
}

// Kits saved before the split held whole files; kits saved during it held the cast in two pieces. Bring
// both forward. Where a seam has been edited away, keep the whole text in the first piece so no edit is lost.
const cut = (t, marks) => {
  const idx = marks.map(m => t.indexOf(m));
  if (idx.some((i, n) => i < 0 || (n && i <= idx[n - 1]))) return null;
  const out = []; let prev = 0;
  for (const i of idx) { out.push(t.slice(prev, i)); prev = i; }
  out.push(t.slice(prev)); return out;
};
const CID = 'interview-host-expert';
function migrateLegacy(files) {
  const out = { ...files };
  const k = s => fKey(CID, s);
  if (files.voiceExample != null) { out[k('voice')] = files.voiceExample; delete out.voiceExample; }
  if (files.productionGuide != null) {
    const g = files.productionGuide;
    const parts = cut(g, ['## 1. The format', '## 3. Part types', '## 7. Craft rules', '## 10. Editing']);
    if (parts) Object.assign(out, { guideIntro: parts[0], [k('cast')]: parts[1], guideRules: parts[2], [k('craft')]: parts[3], guideStudio: parts[4] });
    else Object.assign(out, { guideIntro: g, [k('cast')]: '', guideRules: '', [k('craft')]: '', guideStudio: '' });
    delete out.productionGuide;
  }
  if (files.lintChecklist != null) {
    const parts = cut(files.lintChecklist, ['## D. Uncanny-valley lint', '## F. Length']);
    Object.assign(out, parts
      ? { lintFacts: parts[0], [k('lint')]: parts[1], lintLength: parts[2] }
      : { lintFacts: files.lintChecklist, [k('lint')]: '', lintLength: '' });
    delete out.lintChecklist;
  }
  // The split's two cast pieces and the domain bullet become one cast slot with the bullet in place.
  const c2 = k('cast2'), dom = 'domain.workplace-safety.expertBackground';
  if (files[c2] != null || files[dom] != null) {
    const bullet = files[dom] != null ? files[dom] : '- {{background:expert}}\n';
    out[k('cast')] = (files[k('cast')] ?? BUILTIN_SLOTS[CID].cast.text.split('- {{background:expert}}\n')[0]) + bullet + (files[c2] ?? BUILTIN_SLOTS[CID].cast.text.split('- {{background:expert}}\n')[1]);
    delete out[c2]; delete out[dom];
  }
  return out;
}

export function loadKit() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KIT_KEY) || '{}'); } catch { /* keep defaults */ }
  const savedFiles = migrateLegacy(saved.files || {});
  const files = Object.fromEntries(kitFiles().map(f => [f.key, savedFiles[f.key] ?? f.text]));
  const stages = DEFAULT_STAGES.map(s => ({ ...s, prompt: saved.stages?.[s.id] ?? s.prompt }));
  return { files, stages };
}
const stagePrompts = kit => Object.fromEntries(kit.stages.map(s => [s.id, s.prompt]));
export function saveKit(kit) {
  localStorage.setItem(KIT_KEY, JSON.stringify({ files: kit.files, stages: stagePrompts(kit) }));
}
export function resetKit() { localStorage.removeItem(KIT_KEY); }

export function exportKit(kit) {
  return JSON.stringify({ kind: 'module-audio-kit', exportedAt: new Date().toISOString(),
    files: kit.files, stages: stagePrompts(kit), library: loadLibrary() }, null, 2);
}
export function importKit(json) {
  const data = JSON.parse(json);
  if (data.kind !== 'module-audio-kit') throw new Error('That file is not a kit export.');
  localStorage.setItem(KIT_KEY, JSON.stringify({ files: data.files, stages: data.stages }));
  if (data.library) saveLibrary(data.library);
}

// Which parts of the kit each stage is sent. The production guide and the instructions go to every stage. A stage
// leaves out what it has no use for, so the rules that matter to it aren't buried: the ledger doesn't need the
// voice example or the lint list, and rendering doesn't need the pattern library.
//
// Within the guide and the voice example a stage can also leave out whole sections it has no use for, matched by their
// "## " heading: dropGuide for the guide (4 modular, 6a conversation feel, 7 craft, 8 length, 9 render conventions) and
// dropVoice for the voice example. A stage that writes no dialogue doesn't need the conversation rules; only the
// performance pass needs the ElevenLabs conventions.
const STAGE_NEEDS = {
  ledger: { setup: false, format: false, voice: false, patterns: false, lint: false, dropGuide: [/^4\./, /^6a\./] },
  plan: { setup: false, format: false, voice: false, patterns: false, lint: false, dropGuide: [/^6a\./] },
  beats: { lint: false, dropGuide: [/^9\./], dropVoice: [/^Register sample/, /^Register$/, /^Principles from review/] },
  draft: { dropGuide: [/^9\./] },
  validity: { patterns: false, dropGuide: [/^9\./] },
  editor: { dropGuide: [/^9\./] },
  performance: { setup: false, voice: false, patterns: false, lint: false, dropGuide: [/^4\./, /^6\./, /^6a\./, /^7\./, /^8\./] },
  seams: { setup: false, patterns: false, lint: false, dropGuide: [/^9\./] },
};

// Removes the "## " sections whose heading matches one of the patterns. Text before the first heading stays.
const dropSections = (text, patterns = []) => {
  if (!patterns.length || !text) return text;
  return text.split(/^(?=## )/m).filter(part => !(part.startsWith('## ') && patterns.some(p => p.test(part.slice(3).split('\n')[0].trim())))).join('');
};

// System prompt for a call: the instructions, the show setup, and the reference files, with the conversation
// type's slots filled in for the module's setup. With a stage ID, only the parts that stage needs.
export function systemPrompt(kit, setup = null, stageId = null, lib = loadLibrary()) {
  const need = { setup: true, format: true, voice: true, patterns: true, lint: true, ...(STAGE_NEEDS[stageId] || {}) };
  const r = resolveSetup(setup, lib);
  const c = r.conversation;
  const slot = name => (c.builtin ? kit.files[fKey(c.id, name)] : c.slots?.[name]) ?? '';
  const block = setupBlock(r);
  const cut = t => dropSections(t, need.dropGuide);
  const left = [!need.voice && 'the voice example', !need.patterns && 'the pattern library', !need.lint && 'the lint checklist'].filter(Boolean);
  const secs = [
    { pieces: [kit.files.projectInstructions + (left.length ? `\n\nFor this stage, ${left.join(', ')} ${left.length > 1 ? 'are' : 'is'} not included: not needed here.` : '')] },
    ...(block && need.setup ? [{ pieces: [block] }] : []),
    { heading: '# 01_production_guide.md', pieces: need.format
      ? [kit.files.guideIntro, applyBackgrounds(slot('cast'), c, r.backgrounds), cut(kit.files.guideRules), cut(slot('craft')), kit.files.guideStudio]
      : [kit.files.guideIntro, cut(kit.files.guideRules), kit.files.guideStudio] },   // the shared rules only: the ledger and the outline don't depend on a show format
    ...(need.voice ? [{ heading: '# 02_voice_example.md', pieces: [dropSections(slot('voice'), need.dropVoice), kit.files.reviewExamples || ''] }] : []),
    ...(need.patterns ? [{ heading: '# 03_pattern_library.md', pieces: [kit.files.patternLibrary] }] : []),
    ...(need.lint ? [{ heading: '# 04_lint_checklist.md', pieces: [kit.files.lintFacts, slot('lint'), kit.files.lintLength] }] : []),
  ];
  return secs.map(x => (x.heading ? x.heading + '\n\n' : '') + x.pieces.join('')).join('\n\n---\n\n');
}

// Fills a stage prompt's placeholders: the module name and the cast of its conversation type.
export function fillStagePrompt(text, moduleName, setup = null, lib = loadLibrary()) {
  const names = resolveSetup(setup, lib).conversation.speakers.map(s => s.name);
  return text.replaceAll('{module}', moduleName)
    .replaceAll('{speaker1}', names[0] || 'HOST').replaceAll('{speaker2}', names[1] || names[0] || 'GUEST')
    .replaceAll('{speakers}', names.join(', '));
}

// "Save as rule": a review note becomes part of the kit for every future module.
export function addRuleToKit(kit, { rule, bad, better }) {
  const date = new Date().toISOString().slice(0, 10);
  const next = { ...kit, files: { ...kit.files } };
  if (rule) {
    const header = '\n\n## Rules from review\n';
    const pg = next.files.guideStudio.includes('## Rules from review') ? next.files.guideStudio : next.files.guideStudio + header;
    next.files.guideStudio = `${pg}\n- (${date}) ${rule}`;
  }
  if (bad && better) {
    const header = '\n\n## From review: bad, then better\n\n| Bad | Better | Why |\n| --- | --- | --- |';
    const ve = next.files.reviewExamples.includes('## From review: bad, then better') ? next.files.reviewExamples : next.files.reviewExamples + header;
    const cell = s => s.replace(/\|/g, '/').replace(/\n/g, ' ');
    next.files.reviewExamples = `${ve}\n| ${cell(bad)} | ${cell(better)} | ${cell(rule || '')} |`;
  }
  saveKit(next);
  return next;
}

// A conversation type with its text slots filled in: the kit's files for the built-in one.
export function withSlots(kit, def) {
  if (def.slots) return def;
  return { ...def, slots: Object.fromEntries(['cast', 'craft', 'voice', 'lint'].map(s => [s, kit.files[fKey(def.id, s)] ?? ''])) };
}
