// sound-trailer: score for a scripted trailer, built from out/timeline.json events (every hit lands on a frame)
// usage: node tools/sound-trailer.js [NN-slug]   → out/sound.wav + out/showcase.mp4 (video copied, audio -14 LUFS)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const slug = process.argv[2] || '07-npc-48';
const dir = path.join(__dirname, '..', 'builds', slug, 'out');
const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
const SR = 48000, DUR = tl.duration, n = Math.ceil((DUR + 1) * SR);
const L = new Float32Array(n), R = new Float32Array(n);
const ev = []; tl.frames.forEach(f => (f.ev || []).forEach(e => ev.push([f.t, e])));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
const add = (i, v, pan = 0) => { if (i >= 0 && i < n) { L[i] += v * Math.min(1, 1 - pan); R[i] += v * Math.min(1, 1 + pan); } };
const TAU = Math.PI * 2;

function thump(t, g, f = 70, dec = 0.18, pan = 0) {
  const i0 = Math.round(t * SR); let ph = 0, lp = 0;
  for (let k = 0; k < dec * 5 * SR; k++) { const s = k / SR, fr = f * (1 + 1.2 * Math.exp(-s / 0.02));
    ph += TAU * fr / SR; lp += 0.08 * (rnd() - lp);
    add(i0 + k, g * (Math.sin(ph) * Math.exp(-s / dec) + 0.5 * lp * Math.exp(-s / 0.012)), pan); }
}
function click(t, g, f = 2400, dec = 0.006, pan = 0) {
  const i0 = Math.round(t * SR); let hp = 0, prev = 0;
  for (let k = 0; k < dec * 6 * SR; k++) { const s = k / SR, x = rnd(); hp = x - prev; prev = x;
    add(i0 + k, g * (0.6 * hp + 0.4 * Math.sin(TAU * f * s)) * Math.exp(-s / dec), pan); }
}
function noise(t0, t1, env, cut, pan = () => 0, g = 1) {   // env(u) 0..1, cut(u) one-pole coefficient
  let lp = 0, lp2 = 0;
  for (let i = Math.round(t0 * SR); i < t1 * SR; i++) { const u = (i / SR - t0) / (t1 - t0), c = cut(u);
    lp += c * (rnd() - lp); lp2 += c * (lp - lp2); add(i, g * env(u) * lp2 * 3, pan(u)); }
}
function tone(t0, dur, freqs, g, att = 0.01, dec = 1, type = 'sin', pan = 0, cut = 1) {
  const i0 = Math.round(t0 * SR); let lp = 0;
  for (let k = 0; k < dur * SR; k++) { const s = k / SR; let v = 0;
    for (const f of freqs) { const p = (f * s) % 1; v += type === 'saw' ? 2 * p - 1 : type === 'sq' ? (p < .5 ? 1 : -1) : Math.sin(TAU * p); }
    lp += cut * (v - lp);
    add(i0 + k, g * lp / freqs.length * Math.min(1, s / att) * Math.exp(-s / dec), pan); }
}
function pad(t0, t1, freqs, g, gainAt = () => 1) {
  for (let i = Math.round(t0 * SR); i < t1 * SR; i++) { const s = i / SR, u = (s - t0) / (t1 - t0);
    const e = Math.min(1, u * 8, (1 - u) * 8) * gainAt(s); if (e <= 0) continue; let v = 0;
    for (const f of freqs) v += Math.sin(TAU * f * s) + Math.sin(TAU * f * 1.003 * s + 1) * 0.7;
    add(i, g * e * v / freqs.length * (0.8 + 0.2 * Math.sin(TAU * 0.3 * s)), 0); }
}

// underscore: a tense loop that stops dead when #48 looks up, then grows
pad(0, 18.4, [55, 110, 164.8, 261.6], 0.11, s => (s < 1 ? 1 : s < 2.2 ? 0 : Math.min(1, (s - 2.2) / 2)) * (0.7 + s / 30));
noise(11, 18.4, u => Math.sin(Math.PI * u) * 0.5, () => 0.02);                       // wind at the edge
pad(19.6, 25.2, [41.2, 82.4, 123.5, 196], 0.12);                                       // the code hum
const BEAT = 60 / 124;
for (let t = 25.25; t < 32.4; t += BEAT) {                                             // he runs: kick, hat, bass
  thump(t, 0.5, 52, 0.2); click(t + BEAT / 2, 0.12, 6000, 0.012);
  tone(t, BEAT * 0.9, [[55, 55, 65.4, 49][Math.floor((t - 25.25) / BEAT / 2) % 4]], 0.22, 0.005, 0.18, 'saw', 0, 0.05); }
pad(25.25, 32.6, [110, 164.8, 220, 329.6], 0.06);
pad(33, DUR + 0.8, [55, 110, 138.6, 164.8, 220, 277.2], 0.12, s => Math.exp(-(s - 33) / 5));

for (const [t, e] of ev) {
  if (e === 'crowd') { const g = t < 10 ? 0.28 : t < 15 ? 0.14 : 0.06;
    for (const [d, p] of [[0, -0.3], [0.007, 0.25], [0.013, 0], [0.019, 0.4]]) thump(t + d, g, 85, 0.06, p); }
  if (e === 'step') thump(t, 0.32, 110, 0.05, 0.1);
  if (e === 'run') thump(t, 0.4, 95, 0.06);
  if (e === 'stop') thump(t, 0.25, 70, 0.08);
  if (e === 'look') { noise(t - 0.6, t, u => u * u * u, u => 0.02 + u * 0.4, () => 0, 0.9);   // reverse swell
    thump(t, 1.1, 38, 0.9); tone(t, 2.5, [55, 55.4, 110.5], 0.4, 0.005, 0.7, 'saw', 0, 0.02); }
  if (e === 'car') { noise(t - 1, t + 1, u => Math.exp(-Math.pow((u - 0.5) * 6, 2)), () => 0.25, u => 0.8 - 1.6 * u, 0.7);
    tone(t - 0.8, 0.8, [104], 0.12, 0.3, 2, 'saw', 0.6, 0.05); tone(t, 0.9, [86], 0.12, 0.01, 0.35, 'saw', -0.6, 0.05); }
  if (e === 'edge') thump(t, 0.7, 42, 0.6);
  if (e === 'crane') { noise(t, t + 1.25, u => u * u, u => 0.01 + u * 0.3, () => 0, 0.8);
    tone(t, 1.25, [60], 0.1, 1.2, 9, 'sin'); }
  if (e === 'reveal') { thump(t, 1.2, 36, 1.2);
    tone(t, 4, [55, 55.3, 82.4, 110, 110.6], 0.55, 0.01, 1.4, 'saw', 0, 0.03);
    for (let k = 0; k < 12; k++) tone(t + 0.08 + k * 0.08 + Math.abs(rnd()) * 0.04, 0.05, [600 + Math.abs(rnd()) * 2400],
      0.06, 0.001, 0.02, 'sq', rnd() * 0.8, 0.5); }
  if (e === 'todo') tone(t, 2.5, [880, 1318.5, 1760], 0.22, 0.002, 0.7);
  if (e === 'type') click(t, 0.3, 2200 + Math.abs(rnd()) * 800, 0.007, rnd() * 0.3);
  if (e === 'rise') noise(t, t + 1.6, u => Math.sin(Math.PI * u * 0.9), u => 0.02 + u * 0.3, () => 0, 0.8);
  if (e === 'title') { thump(t, 1.1, 36, 1.4); tone(t, 5, [55, 82.4, 110, 164.8], 0.45, 0.01, 2, 'saw', 0, 0.03);
    tone(t + 0.05, 4, [659.3, 880, 1318.5], 0.12, 0.002, 1.4); }
}

let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
const len = Math.round(DUR * SR), buf = Buffer.alloc(44 + len * 4), sc = 0.89 / pk;
buf.write('RIFF', 0); buf.writeUInt32LE(36 + len * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(len * 4, 40);
for (let i = 0; i < len; i++) { const f = Math.min(1, (len - i) / (SR * 0.5));
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * sc * f)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * sc * f)) * 32767), 46 + i * 4); }
const wav = path.join(dir, 'sound.wav'); fs.writeFileSync(wav, buf);
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', path.join(dir, 'showcase-silent.mp4'), '-i', wav,
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
  '-movflags', '+faststart', path.join(dir, 'showcase.mp4')]);
console.log(`${ev.length} events, peak ${pk.toFixed(2)} → ${path.join(dir, 'showcase.mp4')}`);
