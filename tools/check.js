// Build check: screenshots via window.__seek(t), live FPS, scene stats.
// usage: node tools/check.js 01-clockwork-block [tag]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const slug = process.argv[2];
const tag = process.argv[3] || 'r1';
if (!slug) { console.error('usage: node tools/check.js <NN-slug> [tag]'); process.exit(1); }
const OUT = path.join(ROOT, 'builds', slug, 'out', 'check', tag);
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('404'); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/builds/${slug}/`;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const result = { slug, tag, url: base, when: new Date().toISOString(), runs: {} };

  const configs = {
    desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
    mobile: { ...devices['iPhone 13'] }, // 390x844 @3x, touch
    square: { viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 },
  };

  for (const [name, cfg] of Object.entries(configs)) {
    const ctx = await browser.newContext(cfg);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const t0 = Date.now();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
    const loadMs = Date.now() - t0;
    const run = { loadMs, errors };

    if (name !== 'square') {
      // live FPS: count rAF over 5 s after 1 s warm-up
      await page.waitForTimeout(1000);
      run.fps = await page.evaluate(() => new Promise(r => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 5000) requestAnimationFrame(f); else r(+(n / ((performance.now() - s) / 1000)).toFixed(1)); }; requestAnimationFrame(f); }));
      await page.screenshot({ path: path.join(OUT, `${name}-live.png`) });
      // tap test: real pointer taps on a grid around the centre until a person gets selected
      const vp = page.viewportSize();
      run.tap = null;
      outer: for (let gy = 0.3; gy <= 0.7; gy += 0.025) for (let gx = 0.25; gx <= 0.75; gx += 0.025) {
        const x = Math.round(vp.width * gx), y = Math.round(vp.height * gy);
        if (cfg.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
        await page.waitForTimeout(60);
        const open = await page.evaluate(() => window.__tapped ? !!window.__tapped() : !document.getElementById('card').classList.contains('hide'));
        if (open) { await page.waitForTimeout(1200); run.tap = await page.evaluate(([x, y]) => window.__tapped ? { x, y, name: window.__tapped(), tag: (document.getElementById('tag') || {}).textContent } : { x, y, name: document.getElementById('cName').textContent, now: document.getElementById('cNow').textContent, meet: document.getElementById('cMeet').textContent }, [x, y]); await page.screenshot({ path: path.join(OUT, name + '-tap.png') }); break outer; }
      }
    }
    const dur = await page.evaluate(() => window.__duration);
    const times = [0, 1.5, dur / 2, dur - 0.1];
    run.shots = [];
    for (const t of times) {
      await page.evaluate(t => window.__seek(t), t);
      const f = path.join(OUT, `${name}-t${String(t.toFixed(1)).replace('.', '_')}.png`);
      await page.screenshot({ path: f });
      run.shots.push(path.basename(f));
    }
    // seek timing: how long one __seek frame takes
    run.seekMs = await page.evaluate(() => { const s = performance.now(); for (let i = 0; i < 30; i++) window.__seek(i * 0.8); return +((performance.now() - s) / 30).toFixed(1); });
    run.info = await page.evaluate(() => window.__info());
    result.runs[name] = run;
    await ctx.close();
  }
  await browser.close();
  srv.close();
  fs.writeFileSync(path.join(OUT, 'check.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
