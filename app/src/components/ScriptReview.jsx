import { useMemo, useState } from 'react';
import { parseScript } from '../lib/script.js';
import { speakerColor } from './speaker.js';

// Click any line to leave a note. Notes can go back to Claude as a revision, or become a kit rule.
export default function ScriptReview({ text, notes, onAddNote, onRemoveNote, onSaveRule }) {
  const items = useMemo(() => parseScript(text), [text]);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const [better, setBetter] = useState('');
  const noteFor = key => notes.find(n => n.key === key);

  function submit(item) {
    if (!note.trim()) return;
    onAddNote({ key: item.key, asset: item.asset, speaker: item.speaker, text: item.text, note: note.trim(), better: better.trim() });
    setOpen(null); setNote(''); setBetter('');
  }

  return (
    <div className="font-script text-[15px] leading-relaxed">
      {items.map(item => {
        if (item.type === 'heading') return <h3 key={item.key} className="mt-8 mb-2 font-ui text-base font-semibold first:mt-0">{item.text}</h3>;
        if (item.type === 'cue') return <p key={item.key} className="my-1 font-ui text-xs text-muted">⟨ {item.text} ⟩</p>;
        if (item.type === 'text') return <p key={item.key} className="my-1 text-muted">{item.text}</p>;
        const existing = noteFor(item.key);
        return (
          <div key={item.key} className={`group -mx-2 rounded px-2 py-1 ${existing ? 'bg-amber-50' : 'hover:bg-paper'}`}>
            <button type="button" className="w-full text-left" onClick={() => { setOpen(open === item.key ? null : item.key); setNote(''); setBetter(''); }}>
              <span className={`mr-2 font-ui text-xs font-semibold ${speakerColor(item.speaker)}`}>{item.speaker}</span>
              {item.text}
            </button>
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
