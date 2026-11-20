// autoclip: long 16:9 gameplay → N vertical shorts, with nothing but ffmpeg + node
// 1) loudness per 0.5 s (astats)  2) motion per frame (scene score)  3) best non-overlapping windows
// 4) 9:16 centre crop + burned title  5) export.  Writes out/clips.json with every number it used.
// usage: node tools/autoclip.js <src.mp4> <outDir> [n=3] [len=12] ["title 1|title 2|title 3"]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const [src, outDir, nArg, lenArg, titlesArg] = process.argv.slice(2);
const NCLIP = +(nArg || 3), LEN = +(lenArg || 12), BIN = 0.5;
const titles = (titlesArg || '').split('|');
fs.mkdirSync(outDir, { recursive: true });
const ff = a => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { maxBuffer: 1 << 28 });
const t0 = Date.now(), lap = {};
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height',
  '-of', 'json', src]).toString());
const DUR = +probe.format.duration, W = probe.streams[0].width, H = probe.streams[0].height;
const nb = Math.floor(DUR / BIN);

// 1) audio loudness, one RMS value per 0.5 s
const rmsFile = path.join(outDir, 'rms.txt');
ff(['-i', src, '-vn', '-af', `aresample=48000,asetnsamples=${48000 * BIN},astats=metadata=1:reset=1,` +
  `ametadata=print:key=lavfi.astats.Overall.RMS_level:file=${rmsFile.replace(/\\/g, '/').replace(':', '\\:')}`, '-f', 'null', '-']);
const rms = fs.readFileSync(rmsFile, 'utf8').split('\n').filter(l => l.includes('RMS_level'))
  .map(l => { const v = parseFloat(l.split('=')[1]); return isFinite(v) ? v : -90; });
lap.audio = Date.now() - t0;

// 2) motion: ffmpeg scene-change score per frame (same idea as PySceneDetect's content detector)
const scFile = path.join(outDir, 'scene.txt');
ff(['-i', src, '-an', '-vf', `scale=320:-2,select='gte(scene,0)',metadata=print:file=${scFile.replace(/\\/g, '/').replace(':', '\\:')}`,
  '-f', 'null', '-']);
const motion = new Float64Array(nb); let ptsT = 0;
for (const l of fs.readFileSync(scFile, 'utf8').split('\n')) {
  if (l.startsWith('frame:')) ptsT = parseFloat(l.split('pts_time:')[1]);
  else if (l.includes('scene_score')) { const b = Math.floor(ptsT / BIN); if (b < nb) motion[b] += parseFloat(l.split('=')[1]); }
}
lap.motion = Date.now() - t0;

// 3) score = z(loudness) + z(motion), best LEN-second windows that don't overlap
const z = a => { const m = a.reduce((s, x) => s + x, 0) / a.length, sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) || 1;
  return a.map(x => (x - m) / sd); };
const A = z(Array.from({ length: nb }, (_, i) => rms[i] ?? -90)), M = z(Array.from(motion));
const score = A.map((a, i) => a + M[i]), win = LEN / BIN, picks = [];
const ws = score.map((_, i) => i + win <= nb ? score.slice(i, i + win).reduce((s, x) => s + x, 0) / win : -1e9);
for (let k = 0; k < NCLIP; k++) {
  let best = -1;
  for (let i = 0; i < ws.length; i++) if (ws[i] > -1e8 && !picks.some(p => Math.abs(p.i - i) < win * 1.5) && (best < 0 || ws[i] > ws[best])) best = i;
  if (best < 0) break; picks.push({ i: best, start: best * BIN, end: best * BIN + LEN, score: +ws[best].toFixed(3) });
}
picks.sort((a, b) => a.start - b.start);
lap.score = Date.now() - t0;

// 4+5) reframe 16:9 → 9:16 (centre crop, the chase cam keeps the car centred), title on a bottom band, export
const cw = Math.round(H * 9 / 16 / 2) * 2, font = 'C\\:/Windows/Fonts/seguibl.ttf';
picks.forEach((p, k) => {
  const t = (titles[k] || `clip ${k + 1}`).replace(/'/g, '’').replace(/:/g, '\\:');
  p.file = path.join(outDir, `short-${k + 1}.mp4`);
  ff(['-ss', String(p.start), '-t', String(LEN), '-i', src, '-vf',
    `crop=${cw}:${H}:(iw-${cw})/2:0,scale=1080:1920,drawbox=y=ih*0.8:w=iw:h=ih*0.2:color=0x0f1012@1:t=fill,` +
    `drawtext=fontfile='${font}':text='${t}':fontsize=66:fontcolor=white:x=(w-tw)/2:y=h*0.865`, '-c:v', 'libx264', '-crf', '20', '-preset', 'fast',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', p.file]);
});
lap.export = Date.now() - t0;
const out = { src: path.basename(src), duration: +DUR.toFixed(2), size: [W, H], bin: BIN, len: LEN, picks, lap_ms: lap,
  total_s: +((Date.now() - t0) / 1000).toFixed(1), rms: rms.slice(0, nb).map(v => +v.toFixed(1)), motion: Array.from(motion).map(v => +v.toFixed(3)) };
fs.writeFileSync(path.join(outDir, 'clips.json'), JSON.stringify(out));
console.log(JSON.stringify({ duration: out.duration, picks, lap_ms: lap, total_s: out.total_s }));
