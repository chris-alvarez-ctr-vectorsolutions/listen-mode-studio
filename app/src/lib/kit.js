// The kit is the tool's settings. Every LXD can edit it, and "save as rule" writes into it.
import projectInstructions from '../kit/00_project_instructions.md?raw';
import productionGuide from '../kit/01_production_guide.md?raw';
import voiceExample from '../kit/02_voice_example.md?raw';
import patternLibrary from '../kit/03_pattern_library.md?raw';
import lintChecklist from '../kit/04_lint_checklist.md?raw';
import { DEFAULT_STAGES } from '../kit/stages.js';

const KIT_KEY = 'mas.kit';
export const KIT_FILES = [
  { id: 'projectInstructions', name: 'Project instructions', text: projectInstructions },
  { id: 'productionGuide', name: 'Production guide', text: productionGuide },
  { id: 'voiceExample', name: 'Voice example', text: voiceExample },
  { id: 'patternLibrary', name: 'Pattern library', text: patternLibrary },
  { id: 'lintChecklist', name: 'Lint checklist', text: lintChecklist },
];

export function loadKit() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KIT_KEY) || '{}'); } catch { /* keep defaults */ }
  const files = Object.fromEntries(KIT_FILES.map(f => [f.id, saved.files?.[f.id] ?? f.text]));
  const stages = DEFAULT_STAGES.map(s => ({ ...s, prompt: saved.stages?.[s.id] ?? s.prompt }));
  return { files, stages };
}
export function saveKit(kit) {
  localStorage.setItem(KIT_KEY, JSON.stringify({
    files: kit.files,
    stages: Object.fromEntries(kit.stages.map(s => [s.id, s.prompt])),
  }));
}
export function resetKit() { localStorage.removeItem(KIT_KEY); }

export function exportKit(kit) {
  return JSON.stringify({ kind: 'module-audio-kit', exportedAt: new Date().toISOString(), ...{
    files: kit.files, stages: Object.fromEntries(kit.stages.map(s => [s.id, s.prompt])) } }, null, 2);
}
export function importKit(json) {
  const data = JSON.parse(json);
  if (data.kind !== 'module-audio-kit') throw new Error('That file is not a kit export.');
  localStorage.setItem(KIT_KEY, JSON.stringify({ files: data.files, stages: data.stages }));
}

// System prompt for every call: instructions plus the four reference files.
export function systemPrompt(kit) {
  return [
    kit.files.projectInstructions,
    '# 01_production_guide.md\n\n' + kit.files.productionGuide,
    '# 02_voice_example.md\n\n' + kit.files.voiceExample,
    '# 03_pattern_library.md\n\n' + kit.files.patternLibrary,
    '# 04_lint_checklist.md\n\n' + kit.files.lintChecklist,
  ].join('\n\n---\n\n');
}

// "Save as rule": a review note becomes part of the kit for every future module.
export function addRuleToKit(kit, { rule, bad, better }) {
  const date = new Date().toISOString().slice(0, 10);
  const next = { ...kit, files: { ...kit.files } };
  if (rule) {
    const header = '\n\n## Rules from review\n';
    const pg = next.files.productionGuide.includes('## Rules from review') ? next.files.productionGuide : next.files.productionGuide + header;
    next.files.productionGuide = `${pg}\n- (${date}) ${rule}`;
  }
  if (bad && better) {
    const header = '\n\n## From review: bad, then better\n\n| Bad | Better | Why |\n| --- | --- | --- |';
    const ve = next.files.voiceExample.includes('## From review: bad, then better') ? next.files.voiceExample : next.files.voiceExample + header;
    const cell = s => s.replace(/\|/g, '/').replace(/\n/g, ' ');
    next.files.voiceExample = `${ve}\n| ${cell(bad)} | ${cell(better)} | ${cell(rule || '')} |`;
  }
  saveKit(next);
  return next;
}
