// Splits a stage's text reply into the pieces the review cards work on.

// Markdown headings -> { intro, sections: [{ key, title, body }] }, or null when there are fewer than two.
export function splitSections(text = '') {
  const lines = text.split('\n');
  const sections = [];
  const intro = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^#{1,4}\s+(.+?)\s*#*\s*$/);
    if (h) { cur = { title: h[1].replace(/\*+/g, '').trim(), body: [] }; sections.push(cur); continue; }
    (cur ? cur.body : intro).push(line);
  }
  if (sections.length < 2) return null;
  return {
    intro: intro.join('\n').trim(),
    sections: sections.map((s, i) => ({ key: `${i}:${s.title}`, title: s.title, body: s.body.join('\n').trim() })),
  };
}

// The editor's reply -> { intro, items: [{ n, label, group, groupNote, text, fix }] }, or null when there are no items.
// Items may be plain numbered lines ("1. ..."), or numbered headings ("### 1. Title" or "**1. Title**") with bullets under
// them. Unnumbered headings ("Blocking", "Should fix") are groups. n is a unique key; label is the number as written
// (numbering often restarts in each group). fix is the text after "Fix:" so the LXD can change it.
const ITEM = /^\s{0,3}(?:#{1,6}\s+)?(?:\*\*)?(\d+)[.)]\s+(.*?)(?:\*\*)?\s*$/;
const GROUP = /^#{1,6}\s+(.+?)\s*#*\s*$/;
export function splitFixItems(text = '') {
  const lines = text.split('\n');
  const items = [];
  const pre = [];                       // everything before the first item
  let group = null, cur = null;
  const startGroup = title => { group = { title: title.replace(/\*+/g, '').trim(), note: [] }; cur = null; };
  for (const line of lines) {
    const m = line.match(ITEM);
    if (m) {
      if (!items.length) {              // the last heading before the first item is its group; the rest is the intro
        const at = pre.map(l => GROUP.test(l)).lastIndexOf(true);
        if (at >= 0) { startGroup(pre[at].match(GROUP)[1]); group.note = pre.slice(at + 1); pre.length = at; }
      }
      const heading = /^\s{0,3}(#{1,6}\s+|\*\*)/.test(line);
      cur = { label: m[1], heading, title: m[2], lines: [], group: group?.title || '', groupNote: group && !group.shown ? group.note.join('\n').trim() : '' };
      if (group) group.shown = true;
      items.push(cur);
      continue;
    }
    const g = items.length ? line.match(GROUP) : null;
    if (g) { startGroup(g[1]); continue; }
    if (cur) cur.lines.push(line);
    else if (group && items.length) group.note.push(line);
    else pre.push(line);
  }
  if (!items.length) return null;
  return {
    intro: pre.join('\n').trim(),
    items: items.map((it, i) => {
      const rest = it.lines.join('\n').trim();
      const body = it.heading ? `**${it.title}**${rest ? `\n\n${rest}` : ''}` : [it.title, rest].filter(Boolean).join('\n').trim();
      const f = body.match(/\bFix\*{0,2}:\*{0,2}\s*([\s\S]*)$/i);
      return { n: String(i + 1), label: it.label, group: it.group, groupNote: it.groupNote, text: body, fix: f ? f[1].trim() : '' };
    }),
  };
}

// Validity reply: the pass/fail report comes first, then the corrected script, which starts at the first asset heading.
export function splitReport(text = '') {
  const m = text.match(/^#{1,3}\s+\d{2}-/m);
  if (!m) return { report: '', script: text };
  return { report: text.slice(0, m.index).trim(), script: text.slice(m.index) };
}
