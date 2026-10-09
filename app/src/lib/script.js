// Parsing helpers shared by review and render.

// A script-stage reply -> just the scripts: from the first part heading ("## 01-k1-base ...") on.
// The validity pass puts its pass/fail report first, and the editor shouldn't start by reading that.
export function scriptOnly(reply = '') {
  const i = reply.search(/^#{2}\s+\d{2}[-_]/m);
  return i > 0 ? reply.slice(i) : reply;
}

const SPEAKER_LINE = /^\s*\**([A-Z][A-Z .'-]{0,24}?)\**\s*:\s*(.+)$/;
const CUE_LINE = /^\s*[⟨<]\s*(.+?)\s*[⟩>]\s*$/;
const HOLD = /HOLD\s*(\d+(?:\.\d+)?)\s*s?/i;

// Script text -> [{ type: 'heading'|'line'|'cue'|'text', ... }] for line-by-line review.
export function parseScript(text) {
  const out = [];
  let asset = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) return;
    const h = line.match(/^#{1,3}\s+(.+)/);
    if (h) { asset = h[1].trim(); out.push({ type: 'heading', text: asset, key: `h${i}` }); return; }
    const cue = line.match(CUE_LINE);
    if (cue) { out.push({ type: 'cue', text: cue[1], asset, key: `c${i}` }); return; }
    const m = line.match(SPEAKER_LINE);
    if (m && m[1].trim().length > 1) { out.push({ type: 'line', speaker: m[1].trim(), text: m[2].trim(), asset, key: `l${i}` }); return; }
    out.push({ type: 'text', text: line, asset, key: `t${i}` });
  });
  return out;
}

// A pasted or uploaded .txt part ("NAME: text" lines, optional ⟨HOLD 3s⟩ cues) -> render part.
export function partFromText(id, title, text) {
  const segments = [];
  let cur = { id: `${id}-a`, flag: null, pauseAfter: 0, lines: [] };
  const push = () => { if (cur.lines.length) segments.push(cur); };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const cue = line.match(CUE_LINE);
    if (cue) {
      const hold = cue[1].match(HOLD);
      if (hold) {
        cur.pauseAfter = Number(hold[1]);
        push();
        cur = { id: `${id}-${String.fromCharCode(97 + segments.length)}`, flag: null, pauseAfter: 0, lines: [] };
      }
      continue;
    }
    const m = line.match(SPEAKER_LINE);
    if (m) cur.lines.push({ speaker: m[1].trim(), text: m[2].trim() });
  }
  push();
  return { id, title, segments };
}

// Performance-pass reply -> { parts, assembly }. Tolerates a ```json fence or stray prose.
export function parsePerformance(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const data = JSON.parse(raw);
  if (!Array.isArray(data.parts)) throw new Error('The performance pass reply has no "parts" list.');
  return { parts: data.parts, assembly: data.assembly || [] };
}

// Split a segment's lines into requests of at most `limit` characters (ElevenLabs guidance: 2,000).
export function chunkLines(lines, limit = 1900) {
  const chunks = [];
  let cur = [];
  let size = 0;
  for (const l of lines) {
    const n = l.text.length;
    if (cur.length && size + n > limit && !/^[—–-]/.test(l.text.trim())) { chunks.push(cur); cur = []; size = 0; }
    cur.push(l);
    size += n;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export const speakersIn = parts =>
  [...new Set(parts.flatMap(p => p.segments.flatMap(s => s.lines.map(l => l.speaker))))];

// The hosts never get a quiet or soft delivery tag ([quietly], [laughs softly]). Strips them from the named speakers
// even if the model adds one. A character's tags are left alone.
const BANNED_TAG = /\[[^\]]*\b(?:quiet(?:ly)?|soft(?:ly)?)\b[^\]]*\]\s*/gi;
export function stripBannedTags(parts, hostNames = []) {
  const hosts = new Set(hostNames.map(n => n.toUpperCase()));
  const clean = lines => lines.map(l => (hosts.has(String(l.speaker).toUpperCase()) ? { ...l, text: l.text.replace(BANNED_TAG, '') } : l));
  return parts.map(p => ({ ...p, segments: (p.segments || []).map(s => ({ ...s, lines: clean(s.lines || []) })) }));
}
