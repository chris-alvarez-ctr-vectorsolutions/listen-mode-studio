// Applying the editor's fixes as exact edits instead of asking the model to write the whole script out again.
// The model returns { part, find, replace } edits. Code checks that `find` is really in the script, exactly once,
// and makes the change itself, so a wrong or invented quote is rejected instead of silently changing the script.

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `find` as a pattern that forgives what a model often changes when it copies: curly or straight quotes, dash
// styles, and runs of spaces or line breaks.
const loose = s => s.trim().split(/\s+/).map(w => [...w].map(c => (/['’‘]/.test(c) ? '[\'’‘]' : /["“”]/.test(c) ? '["“”]' : /[—–-]/.test(c) ? '[—–-]+' : escape(c))).join('')).join('\\s+');

// [start, end] of every place `find` occurs in `text`: exact first, then the forgiving match.
function locate(text, find) {
  const hits = [];
  for (let i = text.indexOf(find); i >= 0; i = text.indexOf(find, i + find.length)) hits.push([i, i + find.length]);
  if (hits.length) return hits;
  return [...text.matchAll(new RegExp(loose(find), 'g'))].map(m => [m.index, m.index + m[0].length]);
}

// The slice of the script that is one part (its heading to the next heading), or null if no heading names it.
function partRange(script, part) {
  if (!part) return null;
  const heads = [...script.matchAll(/^#{1,3}\s+.*$/gm)];
  const i = heads.findIndex(h => h[0].replace(/^#+\s+/, '').trim().startsWith(part.trim()));
  if (i < 0) return null;
  return [heads[i].index, heads[i + 1]?.index ?? script.length];
}

// The model's reply -> a list of edits. Tolerates a ```json fence or stray prose around the object.
export function parseEdits(reply = '') {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1);
  const data = JSON.parse(raw);
  if (!Array.isArray(data.edits)) throw new Error('The reply has no "edits" list.');
  return data.edits.filter(e => e && typeof e.find === 'string' && typeof e.replace === 'string');
}

// -> { script, applied: [edit], failed: [{ edit, reason }] }. Edits run in order against the script as it stands, so
// an edit that depends on an earlier one just fails and goes to the fallback. If the result has lost a large share
// of the script, nothing is applied at all.
export function applyEdits(script, edits) {
  let text = script;
  const applied = [], failed = [];
  for (const edit of edits) {
    const find = edit.find.trim() ? edit.find : '';
    if (!find) { failed.push({ edit, reason: 'empty find' }); continue; }
    if (find === edit.replace) { failed.push({ edit, reason: 'no change' }); continue; }
    const range = partRange(text, edit.part);
    const [lo, hi] = range || [0, text.length];
    let hits = locate(text.slice(lo, hi), find).map(([a, b]) => [a + lo, b + lo]);
    if (!hits.length && range) hits = locate(text, find);      // named the wrong part: fall back to the whole script
    if (hits.length === 0) { failed.push({ edit, reason: 'not found in the script' }); continue; }
    if (hits.length > 1) { failed.push({ edit, reason: `found ${hits.length} times, so the place is ambiguous` }); continue; }
    const [a, b] = hits[0];
    text = text.slice(0, a) + edit.replace + text.slice(b);
    if (!edit.replace.trim()) {                      // a deleted line leaves no blank line behind
      const start = text.lastIndexOf('\n', a - 1) + 1;
      const end = text.indexOf('\n', a);
      if (!text.slice(start, end < 0 ? text.length : end).trim()) text = text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
    }
    applied.push(edit);
  }
  if (applied.length && text.length < script.length * 0.7) {
    return { script, applied: [], failed: edits.map(edit => ({ edit, reason: 'the edits together removed too much of the script' })) };
  }
  return { script: text, applied, failed };
}

// What the model is asked to return. `script` is the exact text the edits are checked against.
export function patchRequest(script, fixText) {
  return `Here is the latest script, exactly as it stands:

${script}

---

Apply these fixes from the editor review to it. Change nothing else.

${fixText}

Don't write the script out again. Return ONLY a JSON object, with no prose before or after it, in exactly this shape:
{"edits":[{"part":"01-k1-base","find":"...","replace":"..."}]}
Rules:
- "part" is the part ID the edit is in (the start of its ## heading).
- "find" is copied character for character from the script above, and appears exactly once in that part. Quote the whole line you change, or enough of it to be unique.
- "replace" is the text that takes its place. To delete a line, make "replace" empty. To add a line, make "find" the existing line next to it and "replace" that line plus the new one, separated by a line break (\\n), each as "NAME: text".
- One edit per change. If two fixes touch the same line, combine them in one edit. An edit must not depend on another edit having been made first.
- Keep the voice and format of the script. Add no fact that the claims ledger doesn't hold.`;
}

// The fallback: the edits that couldn't be placed, handed back as a full rewrite of just those changes.
export function rewriteRequest(script, failed) {
  const list = failed.map(({ edit }, i) => edit.text ? edit.text : `${i + 1}. ${edit.part ? `In ${edit.part}: ` : ''}change\n"${edit.find}"\nto\n"${edit.replace || '(delete it)'}"`).join('\n\n');
  return `Here is the latest script:

${script}

---

These changes could not be placed automatically. Make them, matching what each one intends as closely as you can, and change nothing else. Then output the full revised script in the same format.

${list}`;
}
