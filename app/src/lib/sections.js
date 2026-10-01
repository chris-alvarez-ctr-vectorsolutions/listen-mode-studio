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

// Numbered list ("1. ...", "2) ...") -> { intro, items: [{ n, text, fix }] }, or null when there is no list.
// fix is the text after "Fix:" when the item has one, so the LXD can change it.
export function splitFixItems(text = '') {
  const lines = text.split('\n');
  const intro = [];
  const items = [];
  for (const line of lines) {
    const m = line.match(/^\s{0,3}(\d+)[.)]\s+(.*)$/);
    if (m) { items.push({ n: m[1], lines: [m[2]] }); continue; }
    (items.length ? items[items.length - 1].lines : intro).push(line);
  }
  if (!items.length) return null;
  return {
    intro: intro.join('\n').trim(),
    items: items.map(it => {
      const body = it.lines.join('\n').trim();
      const f = body.match(/\*{0,2}Fix:?\*{0,2}:?\s*([\s\S]*)$/i);
      return { n: it.n, text: body, fix: f ? f[1].trim() : '' };
    }),
  };
}

// Validity reply: the pass/fail report comes first, then the corrected script, which starts at the first asset heading.
export function splitReport(text = '') {
  const m = text.match(/^#{1,3}\s+\d{2}-/m);
  if (!m) return { report: '', script: text };
  return { report: text.slice(0, m.index).trim(), script: text.slice(m.index) };
}
