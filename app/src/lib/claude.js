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

// If nothing at all arrives for this long, the connection has died (the API sends a ping every few seconds).
const STALL_MS = 90000;
// If the connection is open but the model hasn't even started a response (no content block) for this long, start over.
// Once a block has started the model is working, and may think silently for minutes, so we wait.
const FIRST_MS = 150000;

// Streams a Messages API call through the worker. onText gets the growing reply.
async function streamOnce({ system, messages, onText, onStatus, effort, onMeta, onFirstText, signal: userSignal, stallMs = STALL_MS, firstMs = FIRST_MS }) {
  const settings = loadSettings();
  const ac = new AbortController();
  const onUserAbort = () => ac.abort();
  if (userSignal?.aborted) ac.abort(); else userSignal?.addEventListener('abort', onUserAbort);
  let stalled = false, timer;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => { stalled = true; ac.abort(); }, stallMs); };
  arm();
  let firstTimer = setTimeout(() => { stalled = 'first'; ac.abort(); }, firstMs);
  const gotContent = () => { clearTimeout(firstTimer); firstTimer = null; };
  try {
    return await readStream({ settings, system, messages, onText, onStatus, effort, onMeta, onFirstText, signal: ac.signal, arm, gotContent });
  } catch (e) {
    // A stall is a dead connection, which is safe to retry like any other dropped one.
    if (stalled && !userSignal?.aborted) {
      throw new TypeError(stalled === 'first'
        ? `The model hadn't started writing after ${Math.round(firstMs / 1000)} seconds.`
        : `The connection stalled with no data for ${Math.round(stallMs / 1000)} seconds.`);
    }
    throw e;
  } finally {
    clearTimeout(timer); clearTimeout(firstTimer);
    userSignal?.removeEventListener('abort', onUserAbort);
  }
}

async function readStream({ settings, system, messages, onText, onStatus, effort, onMeta, onFirstText, signal, arm, gotContent }) {
  const res = await fetch(`${workerBase(settings)}/anthropic/v1/messages`, {
    method: 'POST',
    signal,
    headers: workerHeaders(settings, { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }),
    body: JSON.stringify({ model: settings.claudeModel, max_tokens: Number(settings.maxTokens) || 16000, system, messages, stream: true, ...(effort ? { output_config: { effort } } : {}) }),
  });
  if (!res.ok) throw new Error(`Claude request failed (${res.status}): ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let stopReason = null;
  let model = null, outputTokens = 0, wrote = false;
  let thinking = 0;
  let silentThinking = false;
  let eventCount = 0;
  const counts = {};
  const report = last => onStatus?.({ connected: true, thinking, silentThinking, events: eventCount, last, counts: { ...counts } });
  report(null);
  for (;;) {
    const { value, done } = await reader.read();
    arm();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop();
    for (const ev of events) {
      const line = ev.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      let data;
      try { data = JSON.parse(line.slice(6)); } catch { continue; }
      eventCount++;
      const kind = data.type === 'content_block_delta' ? data.delta?.type
        : data.type === 'content_block_start' ? `content_block_start (${data.content_block?.type})` : data.type;
      counts[kind] = (counts[kind] || 0) + 1;
      if (data.type === 'content_block_start' || kind === 'text_delta' || kind === 'thinking_delta') gotContent();
      if (data.type === 'content_block_start' && data.content_block?.type === 'thinking') silentThinking = true;
      if (kind !== 'text_delta' && kind !== 'thinking_delta') report(kind);
      if (data.type === 'message_start') model = data.message?.model ?? model;
      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        if (!wrote) { wrote = true; onFirstText?.(); }
        text += data.delta.text;
        onText?.(text);
      } else if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
        thinking += (data.delta.thinking || '').length;
        if (counts.thinking_delta % 20 === 1) report('thinking_delta');
      } else if (data.type === 'message_delta') {
        stopReason = data.delta?.stop_reason ?? stopReason;
        outputTokens = data.usage?.output_tokens ?? outputTokens;
      } else if (data.type === 'error') {
        throw new Error(data.error?.message || 'Claude returned an error.');
      }
    }
  }
  onMeta?.({ model, outputTokens });
  if (stopReason === 'max_tokens') text += '\n\n⟨Output stopped at the token limit. Raise "Max output tokens" in Settings and run this stage again.⟩';
  return text;
}

// Cloudflare sometimes closes the connection mid-request (e.g. QUIC GOAWAY), which the browser
// reports as a TypeError ("network error" / "Load failed"). The request is safe to repeat, so retry.
// A rough count of what a call sends (about four characters to a token), so the app can show it.
export const estimateTokens = (system = '', messages = []) =>
  Math.round((system.length + messages.reduce((n, m) => n + (m.content || '').length, 0)) / 4);

export async function callClaude(args) {
  const { signal, onText } = args;
  args.onSize?.(estimateTokens(args.system, args.messages));
  for (let attempt = 0; ; attempt++) {
    try { return await streamOnce(args); }
    catch (e) {
      if (signal?.aborted || e.name === 'AbortError' || !(e instanceof TypeError)) throw e;
      if (attempt >= 2) {
        let host = 'the worker';
        try { host = new URL(loadSettings().workerUrl).host; } catch { /* keep the default */ }
        throw new Error(`Couldn't reach ${host} after 3 tries (${e.message}). That is almost always the network, not the app: a VPN, a security proxy, or Wi-Fi that interferes with workers.dev addresses. Try another connection or turn the VPN on or off, then run the stage again.`);
      }
      onText?.('');
      args.onRetry?.(attempt + 1, e.message);
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}
