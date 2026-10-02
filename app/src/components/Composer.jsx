import { useEffect, useMemo, useRef, useState } from 'react';
import { FEEL_LOW_MAX, planParts, topicKey } from '../lib/pathways.js';
import { MAX_FAILS, PRESETS, compose, defaultLearner, effectivePolicy, policyNote, takesFails } from '../lib/compose.js';

const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const wait = ms => new Promise(r => setTimeout(r, ms));
const STEP_HOLD_MS = 1400;   // how long playback rests on a non-audio step so it can be seen

const chip = 'rounded px-1.5 py-0.5 text-xs';

// The rendered parts, grouped by objective, with a simulated learner on each group. Changing an answer changes which
// part in the group is live, and Play assembles the live parts the way the player would.
// rowFor(part, { chip, dim, active }) draws one part, so this page and the plain list share one row.
export default function Composer({ objectives, parts, urls, timings, gap, rowFor }) {
  const [learners, setLearners] = useState({});
  const [now, setNow] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState({ t: 0, d: 0 });
  const pausedRef = useRef(false);
  const audio = useRef(null);
  const run = useRef({ id: 0, finish: null });

  const L = o => learners[o.id] || defaultLearner(o);
  const set = (o, patch) => setLearners(s => ({ ...s, [o.id]: { ...L(o), ...patch } }));
  const flow = useMemo(() => compose(objectives, learners), [objectives, learners]);
  const plan = useMemo(() => planParts(objectives), [objectives]);

  // The loop reads these refs, so a change made mid-playback takes effect at the next part.
  const flowRef = useRef(flow); flowRef.current = flow;
  const urlsRef = useRef(urls); urlsRef.current = urls;

  // If the part that's playing is no longer what the answers call for, drop it and move on.
  useEffect(() => {
    const it = flow.items.find(i => i.key === now);
    if (playing && run.current.playingPart && (!it || it.partId !== run.current.playingPart)) run.current.finish?.();
  }, [flow, now, playing]);
  useEffect(() => () => stop(), []);   // eslint-disable-line react-hooks/exhaustive-deps

  const playable = it => it.kind === 'audio' && !!urls[it.partId];
  const missing = flow.items.filter(i => i.kind === 'audio' && !urls[i.partId]);
  const live = flow.items.filter(playable);
  const total = live.reduce((n, i) => n + (timings?.[i.partId]?.duration || 0), 0) + Math.max(0, live.length - 1) * (gap || 0);

  function playUrl(url, partId) {
    return new Promise(res => {
      const a = audio.current;
      const done = () => { a.onended = a.onerror = null; run.current.finish = null; run.current.playingPart = null; res(); };
      run.current.finish = () => { a.pause(); done(); };
      run.current.playingPart = partId;
      a.onended = done; a.onerror = done;
      a.src = url;
      a.play().catch(done);
    });
  }

  // Waits that honour pause and Next. Audio itself is paused on the element.
  async function hold(ms, my) {
    run.current.skip = false;
    for (let left = ms; left > 0 && my === run.current.id && !run.current.skip; ) {
      await wait(100);
      if (!pausedRef.current) left -= 100;
    }
  }

  function setPause(v) { pausedRef.current = v; setPaused(v); }

  function togglePause() {
    const a = audio.current;
    if (pausedRef.current) { setPause(false); if (run.current.playingPart) a.play().catch(() => {}); }
    else { setPause(true); a.pause(); }
  }

  function next() {
    run.current.skip = true;
    setPause(false);
    run.current.finish?.();
  }

  function stop() {
    run.current.id += 1;
    run.current.skip = true;
    setPause(false);
    run.current.finish?.();
    setPlaying(false); setNow(null); setPos({ t: 0, d: 0 });
  }

  async function start(fromKey) {
    stop();
    const my = run.current.id;
    setPlaying(true);
    let key = fromKey ?? flowRef.current.items[0]?.key;
    while (my === run.current.id && key != null) {
      const it = flowRef.current.items.find(i => i.key === key);
      if (!it) break;
      setNow(it.key); setPos({ t: 0, d: 0 });
      if (it.kind === 'audio' && urlsRef.current[it.partId]) await playUrl(urlsRef.current[it.partId], it.partId);
      else if (it.kind === 'step') await hold(it.quiet ? STEP_HOLD_MS / 2 : STEP_HOLD_MS, my);
      if (my !== run.current.id) return;
      const items = flowRef.current.items;
      const following = items[items.findIndex(i => i.key === it.key) + 1];
      if (!following) break;
      if (it.kind === 'audio' && following.kind === 'audio' && gap) await hold(gap * 1000, my);
      key = following.key;
    }
    if (my === run.current.id) { setPlaying(false); setNow(null); }
  }

  const objs = (objectives || []).filter(o => topicKey(o.id));
  const planned = new Set(plan.map(p => p.id));
  const byId = Object.fromEntries((parts || []).map(p => [p.id, p]));
  const rows = list => list.map(p => byId[p.id] && <div key={p.id} className="border-t border-rule first:border-t-0">{rowFor(byId[p.id], p.st)}</div>);
  const slotFor = o => flow.items.find(i => i.key === o.id);

  const controls = o => {
    const l = L(o);
    const slot = slotFor(o);
    const outcome = slot?.kind === 'skip' ? 'out' : slot?.tag === 'tested up' ? 'testup' : 'plays';
    const canFail = takesFails(o, o.type === 'Do' ? 'plays' : outcome);
    const maxFails = effectivePolicy(o) === 'Gate' ? MAX_FAILS : 1;
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {o.type === 'Know' && (
          <div role="group" aria-label={`${o.id} pre-check`} className="flex items-center gap-1">
            <span className="mr-1 text-muted">Pre-check</span>
            {['correct', 'incorrect'].map(v => (
              <button key={v} aria-pressed={l.pre === v} className={`btn !px-2 !py-0.5 ${l.pre === v ? 'border-ink bg-ink text-white hover:bg-black' : ''}`} onClick={() => set(o, { pre: v })}>{v === 'correct' ? 'Correct' : 'Incorrect'}</button>
            ))}
          </div>
        )}
        {o.type === 'Feel' && (
          <label className="flex items-center gap-1"><span className="text-muted">Pre-check</span>
            <select className="select-sm" value={l.pre} onChange={e => set(o, { pre: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {n <= FEEL_LOW_MAX ? 'low' : 'high'}</option>)}
            </select>
          </label>
        )}
        <label className={`flex items-center gap-1 ${canFail ? '' : 'opacity-40'}`} title={canFail ? 'Missed attempts after the chapter' : 'No check after this chapter for this learner'}>
          <span className="text-muted">Misses</span>
          <select className="select-sm" disabled={!canFail} value={canFail ? Math.min(l.fails, maxFails) : 0} onChange={e => set(o, { fails: Number(e.target.value) })}>
            {Array.from({ length: maxFails + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    );
  }

  const group = o => {
    const slot = slotFor(o);
    const isDo = o.type === 'Do';
    const steps = flow.items.filter(i => i.kind === 'step' && i.objective === o.id && !i.label.startsWith('Do:'));
    const startKey = o.id;
    const canPlay = !isDo && slot && (slot.kind === 'skip' || playable(slot));
    const state = isDo ? 'outside the audio' : slot?.kind === 'skip' ? 'tested out' : slot?.tag || 'plays';
    const stateStyle = slot?.kind === 'skip' ? 'border border-dashed border-muted text-muted' : slot?.tag === 'tested up' ? 'bg-ink text-white' : 'border border-rule text-muted';
    const own = plan.filter(p => p.objective === o.id).map(p => ({ id: p.id, st: { chip: slot?.partId === p.id ? state : slot?.kind === 'skip' ? 'tested out' : 'not used', dim: slot?.partId !== p.id, active: now === o.id && slot?.partId === p.id } }));
    return (
      <section key={o.id} className={`overflow-hidden rounded-lg border ${isDo ? 'border-dashed bg-paper' : 'bg-panel'} ${now === `do-${o.id}` || now === o.id || steps.some(s => s.key === now) ? 'border-onair' : 'border-rule'}`}>
        <header className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3 py-2 ${isDo ? '' : 'border-b border-rule bg-paper'}`}>
          <div className="min-w-0" title={`${o.objective}\n\n${policyNote(o)}`}>
            <span className="font-semibold">{o.id}</span>
            <span className="ml-2 text-sm text-muted">{o.type} · {o.policy}{o.type === 'Know' && o.lock !== 'open' ? ` · ${o.lock}` : ''}</span>
            <span className={`ml-2 ${chip} ${stateStyle}`}>{state}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {controls(o)}
            {canPlay && <button className="btn !px-2 !py-0.5" onClick={() => start(startKey)} title="Play from here, then on through the rest of the listen">▶ From here</button>}
          </div>
        </header>
        {!isDo && rows(own)}
        {isDo && <p className="px-3 pb-2 text-sm text-muted">Practice and rubric run in the simulation, never as audio. A missed attempt remediates after the other Do objectives.</p>}
        {steps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-rule px-3 py-2">
            {steps.map(s => <span key={s.key} title={s.note} className={`${chip} ${s.quiet ? 'text-muted' : 'bg-paper'} border ${now === s.key ? 'border-onair text-onair' : 'border-rule'}`}>{s.label}</span>)}
          </div>
        )}
      </section>
    );
  }

  const edge = variant => {
    const p = plan.find(x => x.variant === variant);
    const slot = flow.items.find(i => i.partId === p?.id);
    return p && <section className={`overflow-hidden rounded-lg border bg-panel ${now === slot?.key ? 'border-onair' : 'border-rule'}`}>{rows([{ id: p.id, st: { active: now === slot?.key } }])}</section>;
  };
  const others = (parts || []).filter(p => !planned.has(p.id));

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 -mx-1 space-y-2 rounded-lg border border-rule bg-panel/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Try a learner</span>
            {PRESETS.map(p => <button key={p.id} className="btn !px-2.5 !py-1" onClick={() => setLearners(Object.fromEntries(objs.map(o => [o.id, p.learner(o)])))}>{p.label}</button>)}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm leading-tight">
              <div className="font-medium">{flow.matchesListen ? `${flow.matchesListen} listen` : 'Custom combination'}</div>
              <div className="text-muted">{flow.chapters} {flow.chapters === 1 ? 'chapter' : 'chapters'}{total ? ` · ${mmss(total)}` : ''}</div>
            </div>
            <button className="btn-onair" disabled={!live.length} onClick={() => (playing ? stop() : start())}>{playing ? 'Stop' : 'Play this listen'}</button>
          </div>
        </div>
        {now && (() => {
          const cur = flow.items.find(i => i.key === now);
          const idx = live.findIndex(i => i.key === now);
          const isAudio = cur?.kind === 'audio';
          const d = pos.d || timings?.[cur?.partId]?.duration || 0;
          return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-2" role="group" aria-label="Player">
              <div className="flex items-center gap-1">
                <button className="btn !px-2.5 !py-1" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
                <button className="btn !px-2.5 !py-1" onClick={next} aria-label="Next part">⏭ Next</button>
                <button className="btn !px-2.5 !py-1" onClick={stop} aria-label="Stop">⏹ Stop</button>
              </div>
              <div className="min-w-0 flex-1 basis-56">
                <div className="truncate text-sm"><span className="font-medium">{paused ? 'Paused' : isAudio ? 'Now playing' : 'Interactive step'}</span> · {isAudio ? `${cur.objective ? `${cur.objective} · ` : ''}${cur.partId}${idx >= 0 ? ` (part ${idx + 1} of ${live.length})` : ''}` : cur?.label}</div>
                {isAudio && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <input type="range" aria-label="Position" className="min-w-0 flex-1 accent-onair" min={0} max={d || 1} step={0.1} value={Math.min(pos.t, d || 1)} onChange={e => { audio.current.currentTime = Number(e.target.value); }} />
                    <span className="tabular-nums">{mmss(pos.t)} / {mmss(d)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {flow.routedToArticle && <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm">Fewer than 3 chapters, so the LMS sends this learner to the article instead of a listen.</p>}
        {missing.length > 0 && <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm">Not rendered: {[...new Set(missing.map(i => i.partId))].join(', ')}. Playback skips {missing.length > 1 ? 'them' : 'it'}.</p>}
      </div>

      {edge('open')}
      {objs.filter(o => o.type !== 'Do').map(o => group(o))}
      {objs.some(o => o.type === 'Do') && <h2 className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted">Practice, outside the audio</h2>}
      {objs.filter(o => o.type === 'Do').map(o => group(o))}
      {edge('close')}
      {others.length > 0 && <section className="overflow-hidden rounded-lg border border-rule bg-panel">{rows(others.map(p => ({ id: p.id })))}</section>}
      <audio ref={audio} className="hidden" onTimeUpdate={e => setPos({ t: e.target.currentTime, d: e.target.duration || 0 })} onLoadedMetadata={e => setPos({ t: 0, d: e.target.duration || 0 })} />
    </div>
  );
}
