// sound: NN  →  out/sound.wav + out/showcase.mp4 with that sound track
// Everything is synthesized here from out/timeline.json (no samples, no outside audio).
// Idea: the town has its own little song. Every place that closes takes one instrument with it.
// Robots bring a cold pulse that only gets bigger. Rewind plays the whole week backwards.
// usage: node tools/timeline.js <NN-slug> && node tools/sound.js <NN-slug>
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: node tools/sound.js <NN-slug>'); process.exit(1); }
const OUT = path.join(ROOT, 'builds', slug, 'out');
const TL = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'));
const SR = 48000, DUR = TL.duration, TAIL = 3, N = Math.round((DUR + TAIL) * SR), TAU = Math.PI * 2;

let seed = 7;
const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function add(b, t0, len, pan, gain, fn) {
  const i0 = Math.round(t0 * SR), n = Math.round(len * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let k = 0; k < n; k++) { const i = i0 + k; if (i < 0 || i >= N) continue; const v = fn(k / SR, k); b.L[i] += v * gl; b.R[i] += v * gr; }
}
const lp = c => { let y = 0; const a = 1 - Math.exp(-TAU * c / SR); return x => (y += a * (x - y)); };

// ---------- instruments ----------
const musicBox = (f, det = 1) => t => (Math.sin(TAU * f * det * t) + .3 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 6) + .12 * Math.sin(TAU * 3.01 * f * t) * Math.exp(-t * 11)) * Math.exp(-t * 2.6) * (1 - Math.exp(-t * 900));
const marimba = f => t => (Math.sin(TAU * f * t) * Math.exp(-t * 7) + .25 * Math.sin(TAU * 3.93 * f * t) * Math.exp(-t * 28)) * (1 - Math.exp(-t * 1500));
const epiano = f => t => Math.sin(TAU * f * t + 1.6 * Math.exp(-t * 4) * Math.sin(TAU * f * t)) * Math.exp(-t * 1.7) * (1 - Math.exp(-t * 600));
function pluck(f, len) { // Karplus-Strong
  const n = Math.round(len * SR), d = Math.max(2, Math.round(SR / f)), y = new Float32Array(n), soft = lp(1800);
  for (let i = 0; i < d && i < n; i++) y[i] = soft(rnd() * 2 - 1);
  for (let i = d; i < n; i++) y[i] = .4985 * (y[i - d] + y[i - d - 1 < 0 ? 0 : i - d - 1]);
  return (t, k) => y[k] * (1 - Math.exp(-t * 400));
}
const shaker = () => { let p = 0; return t => { const w = rnd() * 2 - 1, v = w - p; p = w; return v * Math.exp(-t * 55) * (1 - Math.exp(-t * 700)); }; };
const kick = () => { let ph = 0; return t => { ph += TAU * (48 + 70 * Math.exp(-t * 32)) / SR; return Math.sin(ph) * Math.exp(-t * 8); }; };
const block = () => t => (Math.sin(TAU * 1180 * t) * Math.exp(-t * 45) + .3 * Math.sin(TAU * 2410 * t) * Math.exp(-t * 80));
const pulse = (f, cut) => { const fl = lp(cut), fl2 = lp(cut); return t => { const ph = (f * t) % 1, ph2 = (f * 1.004 * t) % 1; return fl2(fl((ph < .3 ? 1 : -1) * .5 + (ph2 < .3 ? 1 : -1) * .5)) * Math.min(1, t * 300) * (t < .11 ? 1 : Math.exp(-(t - .11) * 60)); }; };
const bleep = f => t => Math.sign(Math.sin(TAU * f * t)) * .5 * Math.exp(-t * 30) * Math.min(1, t * 2000);
const clank = (f0 = 520) => t => ([1, 2.76, 5.4, 8.93].reduce((s, r, j) => s + Math.sin(TAU * f0 * r * t) * Math.exp(-t * (30 + j * 25)) / (j + 1), 0) + (rnd() * 2 - 1) * Math.exp(-t * 300) * .4);
const servo = () => { const fl = lp(1400); let ph = 0; return t => { const f = 180 + 260 * Math.sin(Math.PI * Math.min(1, t / .16)); ph = (ph + f / SR) % 1; return fl(ph * 2 - 1) * Math.sin(Math.PI * Math.min(1, t / .18)); }; };
const tick = f => t => Math.sin(TAU * f * t) * Math.exp(-t * 110) * Math.min(1, t * 4000);
function shutter() { // metal shutter rolls down, then slams
  const fl = lp(2600), lo = lp(160); let ph = 0;
  return t => {
    const roll = t < .2 ? (fl(rnd() * 2 - 1) * (.55 + .45 * Math.sin(TAU * 34 * t)) * sm(0, .2, t) * .5) : 0;
    let slam = 0;
    if (t >= .2) { const u = t - .2; ph += TAU * (62 + 40 * Math.exp(-u * 25)) / SR; slam = Math.sin(ph) * Math.exp(-u * 7) * 1.2 + lo(rnd() * 2 - 1) * Math.exp(-u * 12) * 2.2 + fl(rnd() * 2 - 1) * Math.exp(-u * 30) * .7 + clank(310)(u) * .35; }
    return roll + slam;
  };
}
const ding = () => t => (Math.sin(TAU * 2637 * t) * Math.exp(-t * 5) + .5 * Math.sin(TAU * 3520 * t) * Math.exp(-t * 8)) * Math.min(1, t * 3000);
function boom() { const lo = lp(220); let ph = 0; return t => { ph += TAU * (44 + 30 * Math.exp(-t * 8)) / SR; return Math.sin(ph) * Math.exp(-t * 1.6) + lo(rnd() * 2 - 1) * Math.exp(-t * 4) * 1.5; }; }
const chirp = () => t => Math.sin(TAU * (3000 * t + 9000 * t * t)) * Math.sin(Math.PI * Math.min(1, t / .07));

// ---------- events from the video ----------
const F = TL.frames, dt = 1 / TL.fps, EV = { bots: [], jobs: [], shut: [], back: [] };
for (let i = 1; i < F.length; i++) {
  const a = F[i - 1], b = F[i];
  if (b.bots > a.bots) EV.bots.push([b.t, b.bots - a.bots]);
  if (b.jobs < a.jobs) EV.jobs.push([b.t, a.jobs - b.jobs, b.jobs]);
  if (b.jobs > a.jobs) EV.back.push([b.t, b.jobs - a.jobs, b.jobs]);
  if (b.shut > a.shut && b.t < 17.4) EV.shut.push(b.t);
}
const C = EV.shut; // places closing, in order
if (C.length < 6) console.warn('only ' + C.length + ' closings, some instruments never drop');
const KILL = C.length ? C : [99];
const kAt = j => KILL[Math.min(j, KILL.length - 1)];
const REW = 17.4, BOOM = 16.4, THEO = 14.75;

// ---------- the town song: 8 bars of 4 beats = one loop ----------
const BEATS = 32, BEAT = DUR / BEATS;
const CH = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]]; // C Am F G
const chordOf = beat => CH[Math.floor(beat / 4) % 4];
const MEL = [[0, 76], [1, 79], [1.5, 81], [2, 79], [3, 76], [4, 72], [5, 76], [6, 74], [6.5, 72], [7, 69], [8, 72], [9, 81], [10, 79], [10.5, 77], [11, 76],
  [12, 74], [13, 79], [14, 74], [15, 67], [16, 76], [17, 79], [17.5, 81], [18, 84], [19, 81], [20, 76], [21, 81], [22, 79], [22.5, 76], [23, 72],
  [24, 81], [25, 84], [26, 81], [26.5, 79], [27, 77], [28, 74], [29, 76], [30, 74], [31, 71]];
const L = { shaker: bus(), arp: bus(), drums: bus(), keys: bus(), bass: bus(), mel: bus(), robo: bus(), robo2: bus(), robo3: bus(), fx: bus(), solo: bus() };
const ORDER = ['shaker', 'arp', 'drums', 'keys', 'bass', 'mel']; // who leaves first

for (let s = 0; s < BEATS * 4; s++) { // 16ths
  const t = s * BEAT / 4, beat = s / 4, ch = chordOf(beat);
  add(L.shaker, t, .07, .35, s % 4 === 2 ? .07 : s % 2 ? .03 : .045, shaker());
  if (s % 2 === 0) { const pat = [0, 1, 2, 1, 2, 0, 1, 2], n = ch[pat[(s / 2) % 8]] + 24; add(L.arp, t, .6, -.3 + .15 * ((s / 2) % 3), .07, marimba(mf(n))); }
  if (s % 4 === 0) {
    const b = beat % 4;
    if (b === 0 || b === 2) add(L.drums, t, .35, 0, .5, kick());
    if (b === 1 || b === 3) add(L.drums, t, .1, .2, .12, block());
    if (b === 0 || b === 2) for (const n of ch) add(L.keys, t + (n - ch[0]) * .002, 1.5, -.2, .07, epiano(mf(n + 12)));
  }
}
for (let bar = 0; bar < 8; bar++) {
  const r = CH[bar % 4][0];
  for (const [b, n] of [[0, r], [1.5, r + 7], [2, r], [3.5, r + 12]]) add(L.bass, (bar * 4 + b) * BEAT, 1, 0, .42, pluck(mf(n - 12), 1));
}
for (const [b, n] of MEL) add(L.mel, b * BEAT, 1.8, .1, .2, musicBox(mf(n)));

// robots: a cold pulse from the first robot on, more of it with every closed shop
const R0 = EV.bots.length ? EV.bots[0][0] : 1;
for (let e = 0; e < BEATS * 2; e++) { // 8ths
  const t = e * BEAT / 2; if (t < R0 - .05) continue;
  add(L.robo, t, .2, 0, .16, pulse(mf(e % 4 === 3 ? 43 : 36), 900 + 1400 * sm(R0, 12, t)));
  if (e % 2 === 1) add(L.robo2, t + BEAT / 4, .1, .45 * (e % 4 === 1 ? 1 : -1), .05, bleep(mf(e % 8 === 3 ? 79 : 84)));
}
{ const fl = lp(300); add(L.robo3, 0, DUR, 0, .1, t => fl(Math.sin(TAU * 55 * t) + .5 * Math.sin(TAU * 110.4 * t) + .25 * Math.sin(TAU * 165 * t))); } // server hum

// arrivals and the counter
for (const [t, k] of EV.bots) for (let j = 0; j < Math.min(k, 3); j++) {
  const tt = t + j * dt / 3; add(L.fx, tt, .25, rnd() * .8 - .4, .12 / Math.sqrt(Math.min(k, 3)), clank(480 + rnd() * 120));
  if (j === 0 && rnd() < .5) add(L.fx, tt, .2, rnd() * .6 - .3, .035, servo());
}
for (const [t, k, jobs] of EV.jobs) for (let j = 0; j < Math.min(k, 5); j++) add(L.fx, t + j * dt / 5, .05, -.1, .1, tick(330 + jobs * 7));
for (const [t, k, jobs] of EV.back) for (let j = 0; j < Math.min(k, 4); j++) add(L.fx, t + j * dt / 4, .05, .1, .05, tick(330 + jobs * 7));
for (const t of C) add(L.fx, t - .2, 1.2, (rnd() - .5) * .5, .36, shutter());
// Monday vs Tuesday split: left side rings 31 times as often as the right side rings 12 (scaled to fit 3 s)
for (let i = 0; i < 9; i++) add(L.fx, 3.5 + i * .3 + rnd() * .08, .6, -.75, .035, ding());
for (let i = 0; i < 3; i++) add(L.fx, 3.7 + i * .9 + rnd() * .1, .6, .75, .035, ding());
// Thursday in the park: everyone's here, birds and nothing else from the town
for (let i = 0; i < 7; i++) { const t = 12.8 + rnd() * 1.4; add(L.fx, t, .08, rnd() * 1.2 - .6, .025, chirp()); add(L.fx, t + .1, .08, rnd() * 1.2 - .6, .02, chirp()); }
// Theo: the first notes of the town song, alone, a little out of tune
[[0, 76], [1, 79], [1.5, 81], [2, 79], [3, 76]].forEach(([b, n], i) => add(L.solo, THEO + b * .36, 2.2, .1, .2 * (1 - i * .08), musicBox(mf(n), .994)));
add(L.fx, BOOM, 2.6, 0, .55, boom());
for (const n of [36, 43, 48, 51]) add(L.solo, BOOM + (n - 36) * .004, 2.6, 0, .1, epiano(mf(n))); // one low, minor chord under the final number

// ---------- who's alive when ----------
const env = {
  shaker: t => 1 - sm(kAt(0), kAt(0) + .08, t), arp: t => 1 - sm(kAt(1), kAt(1) + .08, t), drums: t => 1 - sm(kAt(2), kAt(2) + .08, t),
  keys: t => 1 - sm(kAt(3), kAt(3) + .08, t), bass: t => 1 - sm(kAt(4), kAt(4) + .1, t), mel: t => 1 - sm(kAt(5), kAt(5) + .12, t),
  robo: t => (1 - .55 * sm(THEO - .2, THEO + .1, t)) * (1 - sm(BOOM - .03, BOOM, t)),
  robo2: t => sm(kAt(6) - .05, kAt(6), t) * (1 - .6 * sm(THEO - .2, THEO + .1, t)) * (1 - sm(BOOM - .03, BOOM, t)),
  robo3: t => sm(kAt(7), kAt(8) + .4, t) * (1 - sm(BOOM, BOOM + .6, t)),
  fx: () => 1, solo: () => 1
};
const dry = bus(), send = bus(), SEND = { mel: .35, solo: .7, keys: .25, arp: .2, bass: .08, drums: .1, shaker: .1, robo: .05, robo2: .15, robo3: 0, fx: .2 };
for (const k in L) for (let i = 0; i < N; i++) {
  const t = i / SR, g = t < REW ? env[k](t) * (1 - sm(REW - .05, REW, t)) : 0, l = L[k].L[i] * g, r = L[k].R[i] * g;
  dry.L[i] += l; dry.R[i] += r; send.L[i] += l * SEND[k]; send.R[i] += r * SEND[k];
}
// small room
function reverb(x, off) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ d: Math.round(d * SR / 44100) + off, buf: null, i: 0, z: 0 })), y = new Float32Array(N);
  for (const c of combs) c.buf = new Float32Array(c.d);
  const aps = [556, 441, 341].map(d => ({ d: Math.round(d * SR / 44100) + off, buf: null, i: 0 })); for (const a of aps) a.buf = new Float32Array(a.d);
  for (let i = 0; i < N; i++) {
    let s = 0; for (const c of combs) { const o = c.buf[c.i]; c.z = o * .72 + c.z * .28; c.buf[c.i] = x[i] * .015 + c.z * .82; c.i = (c.i + 1) % c.d; s += o; }
    for (const a of aps) { const b = a.buf[a.i], o = -s + b; a.buf[a.i] = s + b * .5; a.i = (a.i + 1) % a.d; s = o; }
    y[i] = s;
  }
  return y;
}
const rvL = reverb(send.L, 0), rvR = reverb(send.R, 23);
const mix = bus();
for (let i = 0; i < N; i++) { mix.L[i] = dry.L[i] + rvL[i] * .9; mix.R[i] = dry.R[i] + rvR[i] * .9; }

// ---------- rewind: the whole week backwards, tape-fast ----------
{
  const A = REW + .03, B = DUR - .1, src0 = BOOM - .1, src1 = .3, fl = [lp(4200), lp(4200)], fl2 = [lp(4200), lp(4200)];
  const i0 = Math.round(A * SR), i1 = Math.round(B * SR);
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / (i1 - i0), st = src0 + (src1 - src0) * (u * u * (3 - 2 * u)), p = st * SR, j = Math.floor(p), fr = p - j;
    const g = 1.5 * sm(0, .04, u) * (1 - sm(.93, 1, u)) * (1 + .15 * Math.sin(TAU * 11 * u));
    [mix.L, mix.R].forEach((ch, c) => { const v = ch[j] * (1 - fr) + ch[j + 1] * fr; ch[i] += fl2[c](fl[c](v)) * g; });
  }
  const wf = lp(3000); add(mix, A, B - A, 0, .05, t => wf(rnd() * 2 - 1) * Math.sin(Math.PI * t / (B - A)));
  const sw = lp(5000); add(mix, DUR - .55, .55, 0, .14, t => sw(rnd() * 2 - 1) * Math.pow(t / .55, 3)); // swell back into Monday's song
}
// the tail wraps to the start, so the loop has no seam
const tn = Math.round(DUR * SR);
for (let i = tn; i < N; i++) { mix.L[i - tn] += mix.L[i]; mix.R[i - tn] += mix.R[i]; }

// ---------- write ----------
let pk = 0; for (let i = 0; i < tn; i++) pk = Math.max(pk, Math.abs(mix.L[i]), Math.abs(mix.R[i]));
const G = .7 / pk, buf = Buffer.alloc(44 + tn * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + tn * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(tn * 4, 40);
for (let i = 0; i < tn; i++) { buf.writeInt16LE(Math.round(Math.tanh(mix.L[i] * G) * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(Math.tanh(mix.R[i] * G) * 32000), 46 + i * 4); }
const wav = path.join(OUT, 'sound.wav');
fs.writeFileSync(wav, buf);

// ---------- mux: loudness to -14 LUFS (two pass), video stream copied as is ----------
const run = a => spawnSync('ffmpeg', a, { encoding: 'utf8' });
const m = run(['-hide_banner', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
const J = JSON.parse(m.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
const af = `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${J.input_i}:measured_TP=${J.input_tp}:measured_LRA=${J.input_lra}:measured_thresh=${J.input_thresh}:offset=${J.target_offset},aresample=48000`;
const silent = path.join(OUT, 'showcase-silent.mp4'), show = path.join(OUT, 'showcase.mp4');
// a fresh render.js output has no audio: it becomes the new silent master
const hasAudio = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', show], { encoding: 'utf8' }).stdout.trim() !== '';
if (!hasAudio || !fs.existsSync(silent)) fs.copyFileSync(show, silent);
const tmp = path.join(OUT, 'showcase.tmp.mp4');
const r = run(['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', tmp]);
if (r.status !== 0) throw new Error(r.stderr);
fs.renameSync(tmp, show);
const info = { events: { robots: EV.bots.length, jobDrops: EV.jobs.length, closings: C.map(t => +t.toFixed(3)) }, drops: Object.fromEntries(ORDER.map((k, j) => [k, kAt(j)])), loudness_in: J.input_i, bytes: fs.statSync(show).size };
fs.writeFileSync(path.join(OUT, 'sound.json'), JSON.stringify(info, null, 1));
console.log(JSON.stringify(info));
