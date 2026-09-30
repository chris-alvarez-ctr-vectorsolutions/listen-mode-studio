import { loadSettings } from './store.js';

function workerBase(settings) {
  if (!settings.workerUrl) throw new Error('Add your Cloudflare Worker URL in Settings first.');
  return settings.workerUrl.replace(/\/$/, '');
}
export function workerHeaders(settings, extra = {}) {
  const h = { ...extra };
  if (settings.appToken) h['x-app-token'] = settings.appToken;
  return h;
}

// Streams a Messages API call through the worker. onText gets the growing reply.
export async function callClaude({ system, messages, onText, signal }) {
  const settings = loadSettings();
  const res = await fetch(`${workerBase(settings)}/anthropic/v1/messages`, {
    method: 'POST',
    signal,
    headers: workerHeaders(settings, { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }),
    body: JSON.stringify({ model: settings.claudeModel, max_tokens: Number(settings.maxTokens) || 16000, system, messages, stream: true }),
  });
  if (!res.ok) throw new Error(`Claude request failed (${res.status}): ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let stopReason = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop();
    for (const ev of events) {
      const line = ev.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      let data;
      try { data = JSON.parse(line.slice(6)); } catch { continue; }
      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        text += data.delta.text;
        onText?.(text);
      } else if (data.type === 'message_delta') {
        stopReason = data.delta?.stop_reason ?? stopReason;
      } else if (data.type === 'error') {
        throw new Error(data.error?.message || 'Claude returned an error.');
      }
    }
  }
  if (stopReason === 'max_tokens') text += '\n\n⟨Output stopped at the token limit. Raise "Max output tokens" in Settings and run this stage again.⟩';
  return text;
}
