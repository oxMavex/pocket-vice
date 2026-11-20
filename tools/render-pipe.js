// render-pipe: long clips without PNG piles — frames go straight into ffmpeg (JPEG over a pipe)
// usage: node tools/render-pipe.js <NN-slug> [--w=1440] [--h=720] [--q=demo] [--from=0] [--to=duration] [--out=showcase.mp4]
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const { serve, ROOT } = require('./serve');
const slug = process.argv[2];
const arg = (k, d) => { const a = process.argv.find(a => a.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const W = +arg('w', 1440), H = +arg('h', 720), QS = arg('q', ''), FPS = 30;
(async () => {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/builds/${slug}/index.html${QS ? '?' + QS : ''}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(1500); // file size label
  const dur = await page.evaluate(() => window.__duration);
  const from = +arg('from', 0), to = +arg('to', dur), n = Math.round((to - from) * FPS);
  const out = path.join(ROOT, 'builds', slug, 'out', arg('out', 'showcase.mp4'));
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const b64 = await page.evaluate(async t => { await window.__seek(t); const c = document.createElement('canvas'); const a = document.getElementById('c'), h = document.getElementById('h'); c.width = a.width; c.height = a.height; const g = c.getContext('2d'); g.drawImage(a, 0, 0); g.drawImage(h, 0, 0); return c.toDataURL('image/jpeg', .93).split(',')[1]; }, from + i / FPS);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`${i}/${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(JSON.stringify({ out, frames: n, seconds: (Date.now() - t0) / 1000, errors, bytes: fs.statSync(out).size }));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
