# POCKET VICE

Tiny living cities, one HTML file each. You don't play a criminal, you play the city's systems.

| # | Build | Play | Size |
|---|-------|------|------|
| 02 | Robot Vice: robots take every office job in a toy city. Watch who else loses theirs. Toy model, assumptions on screen. | [play](https://oxmavex.github.io/pocket-vice/builds/02-robot-vice/) | 52.7 KB + three.js r128 (CDN) |
| 01 | Clockwork Block: 210 people, each with their own daily schedule. Tap anyone to see their day. | [play](https://oxmavex.github.io/pocket-vice/builds/01-clockwork-block/) | 48.9 KB + three.js r128 (CDN) |

Add `?seed=<any number>` to a build URL to get your own city.

## How it's made
- Each build is a single `index.html` in `builds/NN-slug/`.
- `BUILDLOG.md` is the working diary. It records every prompt, bug, fix and measurement as it happened.
- Videos are rendered from the build itself. `window.__seek(t)` sets the frame, Playwright captures it with `canvas.toDataURL`, and FFmpeg encodes the result. See `tools/render.js`.
- `node tools/check.js <slug>` takes the test screenshots and measures FPS.

No downloaded assets: every building, person and tree is generated in code.
