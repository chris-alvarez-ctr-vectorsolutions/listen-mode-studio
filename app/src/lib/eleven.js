import { loadSettings } from './store.js';
import { workerHeaders } from './claude.js';

const base = s => {
  if (!s.workerUrl) throw new Error('Add your Cloudflare Worker URL in Settings first.');
  return `${s.workerUrl.replace(/\/$/, '')}/elevenlabs`;
};

// One Text to Dialogue request: [{ text, voice_id }] -> mp3 ArrayBuffer.
export async function dialogue(inputs, { previousRequestIds = [] } = {}) {
  const s = loadSettings();
  const body = { inputs, model_id: s.elevenModel };
  if (previousRequestIds.length) body.previous_request_ids = previousRequestIds.slice(-3);
  const res = await fetch(`${base(s)}/v1/text-to-dialogue?output_format=${encodeURIComponent(s.outputFormat)}`, {
    method: 'POST',
    headers: workerHeaders(s, { 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ElevenLabs request failed (${res.status}): ${await res.text()}`);
  return { audio: await res.arrayBuffer(), requestId: res.headers.get('request-id') || res.headers.get('x-request-id') };
}

export async function listVoices() {
  const s = loadSettings();
  const res = await fetch(`${base(s)}/v1/voices`, { headers: workerHeaders(s) });
  if (!res.ok) throw new Error(`Couldn't load voices (${res.status}).`);
  const data = await res.json();
  return (data.voices || []).map(v => ({ id: v.voice_id, name: v.name }));
}

export async function listModels() {
  const s = loadSettings();
  const res = await fetch(`${base(s)}/v1/models`, { headers: workerHeaders(s) });
  if (!res.ok) throw new Error(`Couldn't load models (${res.status}).`);
  const data = await res.json();
  return (Array.isArray(data) ? data : data.models || [])
    .filter(m => m.can_do_text_to_speech !== false)
    .map(m => ({ id: m.model_id, name: m.name }));
}
