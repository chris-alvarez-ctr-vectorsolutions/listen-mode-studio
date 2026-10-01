// Settings and the kit live in localStorage (small, text only).
// Modules and rendered audio live in IndexedDB (audio is far too big for localStorage).
import { get, set, del, keys } from 'idb-keyval';

const SETTINGS_KEY = 'mas.settings';
export const DEFAULT_SETTINGS = {
  workerUrl: '',
  appToken: '',
  claudeModel: 'claude-sonnet-5',
  maxTokens: 16000,
  elevenModel: 'eleven_v3',
  stability: 0,            // 0 Creative, 0.5 Natural, 1 Robust (sent with every dialogue request)
  outputFormat: 'mp3_44100_128',
  gapBetweenLines: 0.25,   // seconds, only between request chunks
  gapBetweenParts: 1.5,    // seconds of silence standing in for a sting
  voices: [
    { speaker: 'DANA', voiceId: '' },
    { speaker: 'RAY', voiceId: '' },
    { speaker: 'JACOB', voiceId: '' },
  ],
};

export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

const MOD = id => `mas.module:${id}`;
const AUDIO = (mid, pid) => `mas.audio:${mid}:${pid}`;

export async function listModules() {
  const ks = (await keys()).filter(k => String(k).startsWith('mas.module:'));
  const mods = await Promise.all(ks.map(k => get(k)));
  return mods.filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
export const getModule = id => get(MOD(id));
export async function saveModule(m) { m.updatedAt = Date.now(); await set(MOD(m.id), m); return m; }
export async function deleteModule(id) {
  await del(MOD(id));
  const ks = (await keys()).filter(k => String(k).startsWith(`mas.audio:${id}:`));
  await Promise.all(ks.map(k => del(k)));
}
export const getAudio = (mid, pid) => get(AUDIO(mid, pid));
export const saveAudio = (mid, pid, blob) => set(AUDIO(mid, pid), blob);

export function newModule(name) {
  return {
    id: crypto.randomUUID(),
    name,
    seed: '',
    sources: [],          // [{ name, text }]
    ledgerSigned: false,
    thread: [],           // the running conversation for stages 2-8
    stages: {},           // stageId -> { status, output, history: [] }
    currentScript: '',
    objectives: [],       // pathway table: [{ id, objective, type, subscale, policy, lock, audio }]
    parts: null,          // performance-pass JSON: { parts, assembly }
    notes: [],            // line comments waiting to be sent
    createdAt: Date.now(),
  };
}
