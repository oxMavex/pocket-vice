// Measures how far walkers jump between video frames:
// a linear "1 day = 24 s" clock vs the 30 s time warp used by __seek.
// usage: node tools/measure-warp.js <slug> [seed]
const { chromium } = require('playwright');
const { serve } = require('./serve');

(async () => {
  const slug = process.argv[2] || '01-clockwork-block';
  const seed = process.argv[3] || '7';
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/builds/${slug}/?seed=${seed}`;
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  // the build keeps its state inside an IIFE; expose it for this measurement only (served copy, file on disk untouched)
  await page.route('**/builds/' + slug + '/**', async route => {
    const res = await route.fetch();
    let body = await res.text();
    if (!body.includes('window.__ready=true;')) throw new Error('hook point not found');
    body = body.replace('window.__ready=true;', 'window.__dbg={people,evalP,warp,H,DAY};window.__ready=true;');
    route.fulfill({ response: res, body });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true);

  const r = await page.evaluate(() => {
    const { people, evalP, warp, H, DAY } = window.__dbg;
    const FPS = 30;
    // per-frame displacement of people who are walking the same street segment in both frames
    function run(clock, frames) {
      const d = [];
      let prev = people.map(p => { evalP(p, clock(0)); return { x: p.x, z: p.z, ei: p.ei, w: p.ev[p.ei].k === 1 }; });
      for (let f = 1; f < frames; f++) {
        const gm = clock(f / FPS);
        const cur = people.map(p => { evalP(p, gm); return { x: p.x, z: p.z, ei: p.ei, w: p.ev[p.ei].k === 1 }; });
        for (let i = 0; i < cur.length; i++) {
          const a = prev[i], b = cur[i];
          if (a.w && b.w && a.ei === b.ei) d.push({ t: f / FPS, v: Math.hypot(b.x - a.x, b.z - a.z) });
        }
        prev = cur;
      }
      return d;
    }
    const stat = arr => {
      const v = arr.map(o => o.v).sort((a, b) => a - b);
      if (!v.length) return { n: 0 };
      const q = k => v[Math.min(v.length - 1, Math.floor(k * v.length))];
      return { n: v.length, mean: +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(3), p95: +q(.95).toFixed(3), max: +v[v.length - 1].toFixed(3) };
    };
    const linear = run(t => H(7) + t * (DAY / 24), 24 * FPS);
    const warped = run(t => warp(t), __duration * FPS);
    // walkers on the street by game hour (sampled every 10 game-minutes)
    const byHour = [];
    for (let h = 0; h < 24; h++) {
      let s = 0;
      for (let m = 0; m < 60; m += 10) { const gm = H(h) + m; for (const p of people) { evalP(p, gm); if (p.ev[p.ei].k === 1) s++; } }
      byHour.push(+(s / 6).toFixed(1));
    }
    const bands = [['07:00-10:00', 0, 11], ['10:00-17:00', 11, 14], ['17:00-21:00', 14, 24], ['21:00-07:00', 24, 30]]
      .map(([name, a, b]) => ({ band: name, seconds: b - a, ...stat(warped.filter(o => o.t >= a && o.t < b)) }));
    return { people: people.length, linear: stat(linear), warped: stat(warped), bands, walkersByHour: byHour };
  });

  console.log(JSON.stringify(r, null, 1));
  await browser.close();
  srv.close();
})();
