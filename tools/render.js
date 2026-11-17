// render: NN  →  showcase.mp4, process.mp4, poster.png (+ render.json with real timings)
// usage: node tools/render.js <NN-slug> [showcase|process|poster|preview|all] [--poster=T]
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { serve, ROOT } = require('./serve');

const slug = process.argv[2];
const what = process.argv[3] || 'all';
const argOf = (k, d) => { const a = process.argv.find(a => a.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const posterT = +((process.argv.find(a => a.startsWith('--poster=')) || '--poster=2.4').split('=')[1]);
if (!slug) { console.error('usage: node tools/render.js <NN-slug> [what]'); process.exit(1); }
const OUT = path.join(ROOT, 'builds', slug, 'out');
const FPS = 30, SHOW_S = 30, PROC_S = 12;
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

function encode(dir, file) {
  const t = Date.now();
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr);
  const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,r_frame_rate,codec_name,pix_fmt,nb_frames', '-of', 'json', file], { encoding: 'utf8' });
  return { encodeMs: Date.now() - t, bytes: fs.statSync(file).size, probe: JSON.parse(p.stdout) };
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const log = { slug, when: new Date().toISOString(), fps: FPS, errors };
  const prevPath = path.join(OUT, 'render.json');
  const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, 'utf8')) : {};

  if (['showcase', 'poster', 'preview', 'all'].includes(what)) {
    await page.goto(`${base}/builds/${slug}/index.html`);
    await page.waitForFunction(() => window.__ready && window.__fileBytes, null, { timeout: 20000 });
    if (what === 'preview') {
      const dir = path.join(OUT, 'preview'); fs.mkdirSync(dir, { recursive: true });
      for (const t of [0, 0.9, 1.4, 5, 8, 12.5, 15.5, 19, 22, 26, 29.9]) save(path.join(dir, `t${t}.png`), await page.evaluate(t => window.__frame(t), t));
      console.log('preview frames →', dir);
    }
    if (what === 'poster' || what === 'all') {
      save(path.join(OUT, 'poster.png'), await page.evaluate(t => window.__frame(t), posterT));
      log.poster = { t: posterT };
    }
    if (what === 'showcase' || what === 'all') {
      const dir = path.join(OUT, 'frames', 'showcase'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      const n = FPS * SHOW_S, t0 = Date.now();
      for (let i = 0; i < n; i++) save(path.join(dir, String(i).padStart(4, '0') + '.png'), await page.evaluate(t => window.__frame(t), i / FPS));
      const captureMs = Date.now() - t0;
      log.showcase = { frames: n, seconds: SHOW_S, captureMs, ...encode(dir, path.join(OUT, 'showcase.mp4')) };
      // seamless-loop check: mean abs pixel diff between last frame and frame 0, vs a normal neighbouring pair
      log.showcase.loopCheck = await page.evaluate(() => {
        const d = (a, b) => { const c = document.createElement('canvas'); c.width = c.height = 270; const x = c.getContext('2d');
          const img = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
          return Promise.all([img(a), img(b)]).then(([A, B]) => { x.drawImage(A, 0, 0, 270, 270); const p = x.getImageData(0, 0, 270, 270).data; x.drawImage(B, 0, 0, 270, 270); const q = x.getImageData(0, 0, 270, 270).data; let s = 0; for (let i = 0; i < p.length; i += 4) s += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]); return +(s / (p.length / 4 * 3)).toFixed(2); }); };
        const L = window.__duration;
        return Promise.all([d(window.__frame(L - 1 / 30), window.__frame(0)), d(window.__frame(5), window.__frame(5 + 1 / 30))]).then(([seam, normal]) => ({ seam, normal }));
      });
    }
  }
  if (what === 'process' || what === 'all') {
    await page.goto(`${base}/tools/process.html?b=${encodeURIComponent(slug)}&fn=${argOf('fn', 'evalP')}&cap=${encodeURIComponent(argOf('cap', 'Position is a function of time.'))}&type=9.5`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 20000 });
    const dir = path.join(OUT, 'frames', 'process'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const n = FPS * PROC_S, t0 = Date.now();
    for (let i = 0; i < n; i++) save(path.join(dir, String(i).padStart(4, '0') + '.png'), await page.evaluate(t => window.__proc(t), i / FPS));
    log.process = { frames: n, seconds: PROC_S, captureMs: Date.now() - t0, excerpt: await page.evaluate(() => window.__info), ...encode(dir, path.join(OUT, 'process.mp4')) };
  }
  await browser.close(); srv.close();
  const merged = { ...prev, ...log };
  if (what !== 'preview') fs.writeFileSync(prevPath, JSON.stringify(merged, null, 2));
  console.log(JSON.stringify(log, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
