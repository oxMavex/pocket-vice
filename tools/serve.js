// Tiny static server for the repo root (used by check/render tools).
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css', '.mp4': 'video/mp4' };
function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end('404'); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}
// GPU flags per platform; THREE_LOCAL=<path to three.min.js r128> serves the CDN file from disk when the network blocks cdnjs.
const GPU_ARGS = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
async function hook(target) {
  if (process.env.THREE_LOCAL) await target.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_LOCAL, contentType: 'text/javascript' }));
}
module.exports = { serve, ROOT, GPU_ARGS, hook };
