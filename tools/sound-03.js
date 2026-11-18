// sound for build 03 (Last Fare): out/timeline.json → out/sound.wav → out/showcase.mp4 with audio
// All synthesized here. My taxi: a 4-cylinder engine driven by the real rpm and throttle of each frame.
// Robot taxi: an electric whine from its real speed, and two beeps when it takes a fare.
// Under it, a small toy-funk groove (bass, drums, marimba) that ducks for the overhead replay.
// usage: node tools/timeline.js 03-last-fare && node tools/sound-03.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// usage: node tools/sound-03.js [slug] [duckFrom,duckTo]  (defaults: 03-last-fare, 4.75,6.6)
const OUT = path.join(__dirname, '..', 'builds', process.argv[2] || '03-last-fare', 'out');
const TL = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'));
const SR = 48000, DUR = TL.duration, TAIL = 2, N = Math.round((DUR + TAIL) * SR), TAU = Math.PI * 2, F = TL.frames, FPS = TL.fps;

let seed = 3;
const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lp = c => { let y = 0; const a = 1 - Math.exp(-TAU * c / SR); return x => (y += a * (x - y)); };
function add(b, t0, len, pan, gain, fn) {
  const i0 = Math.round(t0 * SR), n = Math.round(len * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let k = 0; k < n; k++) { const i = i0 + k; if (i < 0 || i >= N) continue; const v = fn(k / SR, k); b.L[i] += v * gl; b.R[i] += v * gr; }
}
// per-sample value of a timeline field, linearly interpolated between frames
const at = (key, t) => { const x = Math.min(F.length - 1.001, Math.max(0, t * FPS)), i = Math.floor(x), k = x - i, a = F[i][key], b = F[Math.min(F.length - 1, i + 1)][key]; return a + (b - a) * k; };
const events = []; for (const f of F) for (const e of f.ev) events.push([f.t, e]);

const B = { eng: bus(), bot: bus(), tyre: bus(), fx: bus(), mus: bus() };

// ---------- my engine ----------
{
  let ph = 0, cut = 600;
  for (let i = 0; i < Math.round(DUR * SR); i++) {
    const t = i / SR, rpm = at('meRpm', t), thr = at('meT', t), f = rpm / 30;
    ph += f / SR; if (ph > 1e6) ph -= 1e6;
    let s = 0; for (let h = 1; h <= 9; h++) s += Math.sin(TAU * ph * h + h * h * .7) * (h % 2 ? 1 : .55) / h;
    s += .5 * Math.sin(TAU * ph * .5); // firing order lump
    s = Math.tanh(s * (1.6 + 1.6 * thr)) * (1 + .18 * Math.sin(TAU * ph * .25));
    cut += ((350 + thr * 1100 + f * 5) - cut) * .002;
    const y = lp2(s, cut);
    const g = .05 + .12 * thr;
    B.eng.L[i] += y * g; B.eng.R[i] += y * g * .92;
  }
  function lp2(x, c) { const a = 1 - Math.exp(-TAU * c / SR); lp2.y1 = (lp2.y1 || 0) + a * (x - (lp2.y1 || 0)); lp2.y2 = (lp2.y2 || 0) + a * (lp2.y1 - (lp2.y2 || 0)); return lp2.y2; }
}
// gear changes: a short dip and a pop from the exhaust
for (const [t, e] of events) if (e === 'shift:me') {
  const i0 = Math.round(t * SR), n = Math.round(.07 * SR);
  for (let k = 0; k < n; k++) { const g = 1 - .7 * Math.sin(Math.PI * k / n); if (i0 + k < N) { B.eng.L[i0 + k] *= g; B.eng.R[i0 + k] *= g; } }
  const f = lp(1200); add(B.fx, t + .03, .08, 0, .12, u => f(rnd() * 2 - 1) * Math.exp(-u * 70));
}
// ---------- robot taxi: electric whine, louder when it is close ----------
{
  let p1 = 0, p2 = 0;
  for (let i = 0; i < Math.round(DUR * SR); i++) {
    const t = i / SR, v = Math.max(0, at('botV', t)), d = at('dist', t), f = 240 + v * 330;
    p1 += f / SR; p2 += f * 2.01 / SR; if (p1 > 1e6) { p1 -= 1e6; p2 -= 2.01e6; }
    const y = Math.sin(TAU * p1) + .35 * (2 * Math.abs(2 * (p2 % 1) - 1) - 1) + .12 * Math.sin(TAU * p1 * 3.02);
    const g = (.012 + .05 * v / 2) / (1 + d * .35);
    B.bot.L[i] += y * g * .8; B.bot.R[i] += y * g;
  }
}
// ---------- tyres ----------
{
  const bp1 = lp(2600), bp2 = lp(1100);
  for (let i = 0; i < Math.round(DUR * SR); i++) {
    const t = i / SR, s = Math.max(at('meSlip', t), at('botSlip', t) / (1 + at('dist', t) * .4)), g = Math.min(.3, Math.max(0, (s - .26) * .55));
    const w = rnd() * 2 - 1, y = bp1(w) - bp2(w), sq = Math.sin(TAU * (1900 + 300 * Math.sin(TAU * 7 * t)) * t) * .25;
    B.tyre.L[i] += (y + sq) * g; B.tyre.R[i] += (y + sq) * g;
  }
  // launch burnout at the start
  const f = lp(1800); add(B.tyre, 0, 1.3, 0, .16, u => f(rnd() * 2 - 1) * (1 - sm(.6, 1.3, u)));
}
// ---------- events ----------
const kaching = () => t => (Math.sin(TAU * 2637 * t) * Math.exp(-t * 5) + .6 * Math.sin(TAU * 3951 * t) * Math.exp(-t * 7) + (t < .03 ? (rnd() * 2 - 1) * .8 : 0)) * Math.min(1, t * 3000);
const beep = f => t => Math.sign(Math.sin(TAU * f * t)) * .5 * (t < .09 ? 1 : Math.exp(-(t - .09) * 80));
const thud = () => { let ph = 0; const f = lp(300); return t => { ph += TAU * (70 + 50 * Math.exp(-t * 30)) / SR; return Math.sin(ph) * Math.exp(-t * 14) + f(rnd() * 2 - 1) * Math.exp(-t * 25) * 1.5; }; };
for (const [t, e] of events) {
  if (e === 'fare:me') { add(B.fx, t, .9, .2, .3, kaching()); add(B.fx, t + .12, .9, -.2, .22, kaching()); }
  if (e === 'fare:bot') { add(B.fx, t, .2, -.3, .1, beep(1046)); add(B.fx, t + .14, .2, -.3, .1, beep(1396)); }
  if (e.startsWith('bump:')) add(B.fx, t, .4, 0, .35, thud());
}
// ---------- toy-funk groove, 112 BPM ----------
const BPM = 112, BEAT = 60 / BPM, BARS = Math.floor(DUR / (BEAT * 4));
const KS = (f, len) => { const n = Math.round(len * SR), d = Math.max(2, Math.round(SR / f)), y = new Float32Array(n), s = lp(1500); for (let i = 0; i < d && i < n; i++) y[i] = s(rnd() * 2 - 1); for (let i = d; i < n; i++) y[i] = .497 * (y[i - d] + (i > d ? y[i - d - 1] : 0)); return (t, k) => y[k]; };
const kick = () => { let ph = 0; return t => { ph += TAU * (50 + 80 * Math.exp(-t * 35)) / SR; return Math.sin(ph) * Math.exp(-t * 9); }; };
const snare = () => { const f = lp(5000); return t => (f(rnd() * 2 - 1) * Math.exp(-t * 18) + .4 * Math.sin(TAU * 190 * t) * Math.exp(-t * 25)); };
const hat = () => { let p = 0; return t => { const w = rnd() * 2 - 1, v = w - p; p = w; return v * Math.exp(-t * 90); }; };
const mar = f => t => (Math.sin(TAU * f * t) * Math.exp(-t * 8) + .2 * Math.sin(TAU * 3.93 * f * t) * Math.exp(-t * 30)) * Math.min(1, t * 1500);
const ROOT = [40, 40, 43, 45, 40, 40, 38, 43]; // E E G A E E D G
const BASS = [[0, 0], [.75, 0], [1.5, 12], [2, 10], [2.5, 7], [3.25, 0], [3.5, 3]];
for (let bar = 0; bar < BARS; bar++) {
  const t0 = bar * BEAT * 4, r = ROOT[bar % 8];
  for (const [b, n] of BASS) add(B.mus, t0 + b * BEAT, .5, 0, .34, KS(mf(r + n), .5));
  for (const b of [0, 1.5, 2.75]) add(B.mus, t0 + b * BEAT, .3, 0, .42, kick());
  for (const b of [1, 3]) add(B.mus, t0 + b * BEAT, .25, .1, .2, snare());
  for (let h = 0; h < 8; h++) add(B.mus, t0 + h * BEAT / 2, .05, .35, h % 2 ? .05 : .03, hat());
  for (const b of [.5, 1.75, 3.5]) for (const n of [r + 24 + 7, r + 24 + 12, r + 24 + 15]) add(B.mus, t0 + b * BEAT, .5, -.3, .03, mar(mf(n)));
}
// last hit and stop, so the cut back to the start line is clean
add(B.mus, BARS * BEAT * 4, 1.2, 0, .5, kick());
for (const n of [40, 52, 55, 59]) add(B.mus, BARS * BEAT * 4, 1.4, 0, .05, mar(mf(n + 12)));

// ---------- mix ----------
const OV = process.argv[3] ? process.argv[3].split(',').map(Number) : process.argv[2] ? [-9, -9] : [4.75, 6.6]; // overhead replay: music and engines step back
const mix = bus();
for (let i = 0; i < N; i++) {
  const t = i / SR, ov = sm(OV[0] - .3, OV[0], t) * (1 - sm(OV[1] - .2, OV[1] + .2, t)), end = 1 - sm(DUR - .25, DUR, t);
  const ge = (1 - .55 * ov) * end, gm = (.85 - .35 * ov) * (t > BARS * BEAT * 4 + 1.4 ? 0 : 1);
  for (const ch of ['L', 'R']) {
    const m = B.mus[ch][i] * gm;
    mix[ch][i] = B.eng[ch][i] * ge + B.bot[ch][i] * (1 + 1.5 * sm(3.0, 3.4, t) * (1 - sm(4.5, 4.9, t))) * end + B.tyre[ch][i] * ge + B.fx[ch][i] + m;
  }
}
const tn = Math.round(DUR * SR);
let pk = 0; for (let i = 0; i < tn; i++) pk = Math.max(pk, Math.abs(mix.L[i]), Math.abs(mix.R[i]));
const G = .8 / pk, buf = Buffer.alloc(44 + tn * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + tn * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(tn * 4, 40);
for (let i = 0; i < tn; i++) { buf.writeInt16LE(Math.round(Math.tanh(mix.L[i] * G) * 32000), 44 + i * 4); buf.writeInt16LE(Math.round(Math.tanh(mix.R[i] * G) * 32000), 46 + i * 4); }
const wav = path.join(OUT, 'sound.wav');
fs.writeFileSync(wav, buf);

// ---------- mux at -14 LUFS, video copied ----------
const run = a => spawnSync('ffmpeg', a, { encoding: 'utf8' });
const m = run(['-hide_banner', '-i', wav, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
const J = JSON.parse(m.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
const af = `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${J.input_i}:measured_TP=${J.input_tp}:measured_LRA=${J.input_lra}:measured_thresh=${J.input_thresh}:offset=${J.target_offset},aresample=48000`;
const silent = path.join(OUT, 'showcase-silent.mp4'), show = path.join(OUT, 'showcase.mp4');
const hasAudio = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', show], { encoding: 'utf8' }).stdout.trim() !== '';
if (!hasAudio || !fs.existsSync(silent)) fs.copyFileSync(show, silent);
const tmp = path.join(OUT, 'showcase.tmp.mp4');
const r = run(['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', tmp]);
if (r.status !== 0) throw new Error(r.stderr);
fs.renameSync(tmp, show);
const info = { events: events.filter(e => !e[1].startsWith('shift')).map(e => e[0] + ' ' + e[1]), shifts: events.filter(e => e[1] === 'shift:me').length, bars: BARS, loudness_in: J.input_i, bytes: fs.statSync(show).size };
fs.writeFileSync(path.join(OUT, 'sound.json'), JSON.stringify(info, null, 1));
console.log(JSON.stringify(info));
