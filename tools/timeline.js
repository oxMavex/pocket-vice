// timeline: NN  →  out/timeline.json — HUD state per video frame (jobs, robots, closed, day, clock)
// The sound track is built from this file, so every hit lands on a real event in the video.
// usage: node tools/timeline.js <NN-slug>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { serve, ROOT } = require('./serve');

const slug = process.argv[2];
if (!slug) { console.error('usage: node tools/timeline.js <NN-slug>'); process.exit(1); }
const FPS = 30;

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 540, height: 540 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${base}/builds/${slug}/index.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const dur = await page.evaluate(() => window.__duration || 30);
  const frames = await page.evaluate(({ dur, FPS }) => {
    const $ = id => document.getElementById(id), out = [];
    for (let i = 0; i < Math.round(dur * FPS); i++) {
      window.__seek(i / FPS);
      out.push({ i, t: +(i / FPS).toFixed(4), jobs: +$('sJobs').textContent, bots: +$('sBots').textContent, shut: +$('sShut').textContent,
        day: $('day').textContent.trim(), clock: $('time').textContent.trim() });
    }
    return out;
  }, { dur, FPS });
  const file = path.join(ROOT, 'builds', slug, 'out', 'timeline.json');
  fs.writeFileSync(file, JSON.stringify({ slug, fps: FPS, duration: dur, errors, frames }));
  console.log(`${frames.length} frames → ${file}, errors: ${errors.length}`);
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
