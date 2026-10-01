// Captions from ElevenLabs text-to-dialogue timestamps -> cues -> WebVTT.
// A cue is { start, end, speaker, text } in seconds from the start of the part.

const MAX_CHARS = 84;      // two lines of 42
const MAX_SECONDS = 6;
const MIN_SECONDS = 0.6;
const SENTENCE_END = /[.!?…]["')\]]*$/;

// Drops v3 audio tags like [laughs softly] from caption text. Works word by word because a tag can span words.
function visibleWords(words) {
  const out = [];
  let inTag = false;
  for (const w of words) {
    let text = w.text;
    if (inTag || text.includes('[')) {
      let kept = '';
      for (const ch of text) {
        if (ch === '[') inTag = true;
        else if (ch === ']') inTag = false;
        else if (!inTag) kept += ch;
      }
      text = kept;
    }
    if (text.trim()) out.push({ ...w, text });
  }
  return out;
}

function wordsFrom(alignment, from, to) {
  const chars = alignment.characters, st = alignment.character_start_times_seconds, en = alignment.character_end_times_seconds;
  const words = [];
  let cur = null;
  for (let i = from; i < to && i < chars.length; i++) {
    if (/\s/.test(chars[i])) { cur = null; continue; }
    if (!cur) { cur = { text: '', start: st[i], end: en[i] }; words.push(cur); }
    cur.text += chars[i]; cur.end = en[i];
  }
  return words;
}

function groupWords(words, speaker, offset) {
  const cues = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    cues.push({ start: offset + cur[0].start, end: offset + cur[cur.length - 1].end, speaker, text: cur.map(w => w.text).join(' ') });
    cur = [];
  };
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0);
    if (cur.length && (len + w.text.length > MAX_CHARS || w.end - cur[0].start > MAX_SECONDS)) flush();
    cur.push(w);
    if (SENTENCE_END.test(w.text) && cur.reduce((n, x) => n + x.text.length + 1, 0) > 30) flush();
  }
  flush();
  return cues;
}

// inputs: the [{ text, voice_id }] sent; speakers: parallel array of speaker names; result: the with-timestamps response;
// offset: where this request's audio starts in the part. Returns cues, or [] if the response had no usable timings.
export function cuesFromResponse(inputs, speakers, result, offset) {
  const { alignment, voice_segments: segs } = result || {};
  if (!Array.isArray(segs) || !segs.length) return [];
  const cues = [];
  inputs.forEach((inp, i) => {
    const mine = segs.filter(s => s.dialogue_input_index === i);
    if (!mine.length) return;
    const speaker = speakers[i];
    const t0 = Math.min(...mine.map(s => s.start_time_seconds));
    const t1 = Math.max(...mine.map(s => s.end_time_seconds));
    const from = Math.min(...mine.map(s => s.character_start_index));
    const to = Math.max(...mine.map(s => s.character_end_index));
    if (alignment?.characters && Number.isFinite(from) && Number.isFinite(to)) {
      const words = visibleWords(wordsFrom(alignment, from, to));
      if (words.length) { cues.push(...groupWords(words, speaker, offset)); return; }
    }
    const text = visibleWords(inp.text.split(/\s+/).map(text => ({ text }))).map(w => w.text).join(' ');
    if (text) cues.push({ start: offset + t0, end: offset + t1, speaker, text });
  });
  return cues;
}

// Cues must not overlap or run backwards, and should stay up long enough to read.
function tidy(cues) {
  const out = cues.filter(c => Number.isFinite(c.start) && Number.isFinite(c.end)).sort((a, b) => a.start - b.start);
  out.forEach((c, i) => {
    if (c.end - c.start < MIN_SECONDS) c.end = c.start + MIN_SECONDS;
    const next = out[i + 1];
    if (next && c.end > next.start) c.end = Math.max(c.start + 0.1, next.start);
  });
  return out;
}

const stamp = s => {
  const ms = Math.round(Math.max(0, s) * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function toVtt(cues) {
  const body = tidy(cues.map(c => ({ ...c }))).map((c, i) =>
    `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n<v ${c.speaker}>${esc(c.text)}`).join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}
