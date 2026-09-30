// Decode mp3 chunks, join them with silences, and write a WAV file. All in the browser.
const RATE = 44100;
let ctx;
const audioCtx = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)({ sampleRate: RATE }));

export async function decode(arrayBuffer) {
  return audioCtx().decodeAudioData(arrayBuffer.slice(0));
}

// items: [{ buffer: AudioBuffer } | { silence: seconds }] -> mono Float32Array at 44.1 kHz
export function join(items) {
  const toMono = b => {
    if (b.numberOfChannels === 1) return b.getChannelData(0);
    const a = b.getChannelData(0), c = b.getChannelData(1), m = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) m[i] = (a[i] + c[i]) / 2;
    return m;
  };
  const pieces = items.map(it => (it.buffer ? toMono(it.buffer) : new Float32Array(Math.round((it.silence || 0) * RATE))));
  const total = pieces.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let off = 0;
  for (const p of pieces) { out.set(p, off); off += p.length; }
  return out;
}

export function wavBlob(samples, rate = RATE) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export async function blobToSamples(blob) {
  const b = await decode(await blob.arrayBuffer());
  return join([{ buffer: b }]);
}
