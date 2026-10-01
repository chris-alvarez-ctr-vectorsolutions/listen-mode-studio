import { loadSettings } from './store.js';
import { workerHeaders } from './claude.js';

const base = s => {
  if (!s.workerUrl) throw new Error('Add your Cloudflare Worker URL in Settings first.');
  return `${s.workerUrl.replace(/\/$/, '')}/elevenlabs`;
};

// One Text to Dialogue request: [{ text, voice_id }] -> { audio: mp3 ArrayBuffer, requestId, timings }.
// Uses the with-timestamps endpoint so captions can be built; falls back to the plain endpoint (no timings)
// only if the worker or API says that route doesn't exist.
export async function dialogue(inputs, { previousRequestIds = [] } = {}) {
  const s = loadSettings();
  const body = { inputs, model_id: s.elevenModel, settings: { stability: Number(s.stability) } };
  if (previousRequestIds.length) body.previous_request_ids = previousRequestIds.slice(-3);
  const send = path => fetch(`${base(s)}/v1/text-to-dialogue${path}?output_format=${encodeURIComponent(s.outputFormat)}`, {
    method: 'POST',
    headers: workerHeaders(s, { 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const rid = res => res.headers.get('request-id') || res.headers.get('x-request-id');
  let res = await send('/with-timestamps');
  if (res.ok) {
    const data = await res.json();
    const bin = atob(data.audio_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { audio: bytes.buffer, requestId: rid(res), timings: data };
  }
  if (![404, 405, 501].includes(res.status)) throw new Error(`ElevenLabs request failed (${res.status}): ${await res.text()}`);
  res = await send('');
  if (!res.ok) throw new Error(`ElevenLabs request failed (${res.status}): ${await res.text()}`);
  return { audio: await res.arrayBuffer(), requestId: rid(res), timings: null };
}

export async function listVoices() {
  const s = loadSettings();
  const res = await fetch(`${base(s)}/v1/voices`, { headers: workerHeaders(s) });
  if (!res.ok) throw new Error(`Couldn't load voices (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.voices || []).map(v => ({ id: v.voice_id, name: v.name }));
}

export async function listModels() {
  const s = loadSettings();
  const res = await fetch(`${base(s)}/v1/models`, { headers: workerHeaders(s) });
  if (!res.ok) throw new Error(`Couldn't load models (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : data.models || [])
    .filter(m => m.can_do_text_to_speech !== false)
    .map(m => ({ id: m.model_id, name: m.name }));
}
