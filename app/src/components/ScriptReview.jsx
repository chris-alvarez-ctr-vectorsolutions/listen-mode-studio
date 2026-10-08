import { useMemo, useState } from 'react';
import { parseScript } from '../lib/script.js';
import { speakerColor } from './speaker.js';
import Markdown from './Markdown.jsx';

// Click any line to leave a note. Notes can go back to Claude as a revision, or become a kit rule.
// "01-k1-base · The blade at the bench" -> the part ID stays fixed and only the title is edited.
const splitHeading = t => {
  const m = t.match(/^(\d{2}-[a-z0-9-]+)\s*(?:[·—–:|]|\s-\s)\s*(.+)$/i);
  return m ? { id: m[1], title: m[2] } : { id: '', title: t };
};

function Heading({ text, onRename, disabled }) {
  const [editing, setEditing] = useState(false);
  const { id, title } = splitHeading(text);
  const [value, setValue] = useState(title);
  const save = () => {
    const t = value.trim();
    setEditing(false);
    if (t && t !== title) onRename(text, id ? `${id} · ${t}` : t);
  };
  if (editing) {
    return (
      <div className="mt-8 mb-2 flex items-center gap-2 font-ui first:mt-0">
        {id && <span className="font-mono text-xs text-muted">{id}</span>}
        <input autoFocus aria-label="Chapter title" className="field" value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
        <button className="btn-primary" onClick={save}>Save</button>
        <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }
  return (
    <h3 className="mt-8 mb-2 flex items-baseline gap-3 font-ui text-base font-semibold first:mt-0">
      <span>{text}</span>
      {onRename && <button className="text-xs font-normal text-muted underline hover:text-ink" disabled={disabled} onClick={() => { setValue(title); setEditing(true); }}>Rename</button>}
    </h3>
  );
}

// Everything before the first part heading ("## 00-open ...") is the writer's own preamble (a title and status notes),
// not script. It is shown as formatted notes. The parse still runs over the whole text, so line keys, and the notes
// attached to them, stay the same.
const PART_HEADING = /^#{1,3}\s+\d{2}[-_]/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const isRow = l => /^\s*\|/.test(l || '');
const isItem = l => /^\s*([-*+]|\d+[.)])\s/.test(l || '');
// The parser drops blank lines, so put back the ones Markdown needs: around tables, and between separate paragraphs.
const respace = lines => lines.reduce((out, l, i) => {
  const prev = lines[i - 1];
  if (i && !((isRow(l) && isRow(prev)) || (isItem(l) && isItem(prev)))) out.push('');
  out.push(l);
  return out;
}, []).join('\n');

export default function ScriptReview({ text, notes = [], onAddNote, onRemoveNote, onSaveRule, onRenameHeading, disabled, readOnly = false }) {
  const { items, preamble } = useMemo(() => {
    const lines = text.split('\n');
    const cut = lines.findIndex(l => PART_HEADING.test(l));
    const all = parseScript(text);
    if (cut <= 0) return { items: all, preamble: '' };
    const pre = lines.slice(0, cut).filter(l => !RULE.test(l));
    if (/^#{1,3}\s/.test(pre[0] || '') && pre.some((l, i) => i > 0 && l.trim())) pre.shift();   // a bare title line
    return { items: all.filter(it => Number(it.key.slice(1)) >= cut), preamble: pre.join('\n').trim() };
  }, [text]);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const [better, setBetter] = useState('');
  const noteFor = key => notes.find(n => n.key === key);
  const Line = readOnly ? 'div' : 'button';

  function submit(item) {
    if (!note.trim()) return;
    onAddNote({ key: item.key, asset: item.asset, speaker: item.speaker, text: item.text, note: note.trim(), better: better.trim() });
    setOpen(null); setNote(''); setBetter('');
  }

  return (
    <div className="font-script text-[15px] leading-relaxed">
      {preamble && (
        <details open className="mb-6 rounded-md border border-rule bg-paper p-4 font-ui text-sm">
          <summary className="cursor-pointer font-medium">Notes from the writer</summary>
          <div className="mt-2"><Markdown text={preamble} /></div>
        </details>
      )}
      {items.map((item, i) => {
        if (item.type === 'heading') return <Heading key={item.key} text={item.text} onRename={onRenameHeading} disabled={disabled} />;
        if (item.type === 'cue') return <p key={item.key} className="my-1 font-ui text-xs text-muted">⟨ {item.text} ⟩</p>;
        if (item.type === 'text') {
          if (items[i - 1]?.type === 'text') return null;   // rendered with the run it belongs to
          const run = [];
          for (let j = i; items[j]?.type === 'text'; j++) run.push(items[j].text);
          const md = respace(run.filter(l => !RULE.test(l)));
          return md.trim() ? <div key={item.key} className="my-3 text-muted"><Markdown text={md} /></div> : null;
        }
        const existing = noteFor(item.key);
        return (
          <div key={item.key} className={`group -mx-2 rounded px-2 py-1 ${existing ? 'bg-amber-50' : 'hover:bg-paper'}`}>
            <Line {...(readOnly ? {} : { type: 'button', onClick: () => { setOpen(open === item.key ? null : item.key); setNote(''); setBetter(''); } })} className="block w-full text-left">
              <span className={`mr-2 font-ui text-xs font-semibold ${speakerColor(item.speaker)}`}>{item.speaker}</span>
              {item.text}
            </Line>
            {existing && (
              <div className="mt-1 flex flex-wrap items-center gap-2 font-ui text-sm">
                <span className="text-ink">Note: {existing.note}</span>
                {existing.better && <span className="text-muted">Better: {existing.better}</span>}
                <button className="text-xs underline" onClick={() => onSaveRule(existing)}>Save as rule</button>
                <button className="text-xs underline" onClick={() => onRemoveNote(existing.key)}>Remove</button>
              </div>
            )}
            {open === item.key && !existing && (
              <div className="mt-2 space-y-2 font-ui">
                <input autoFocus className="field" placeholder="What's wrong with this line?" value={note} onChange={e => setNote(e.target.value)} />
                <input className="field" placeholder="Better version (optional)" value={better} onChange={e => setBetter(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => submit(item)}>Add note</button>
                  <button className="btn" onClick={() => setOpen(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
