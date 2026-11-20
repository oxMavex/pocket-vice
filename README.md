# POCKET VICE

Tiny living cities, one HTML file each. You don't play a criminal, you play the city's systems.

| # | Build | Play | Size |
|---|-------|------|------|
| 02 | Robot Vice: robots take every office job in a toy city. Watch who else loses theirs. Toy model, assumptions on screen. | [play](https://oxmavex.github.io/pocket-vice/builds/02-robot-vice/) | 52.7 KB + three.js r128 (CDN) |
| 03 | Last Fare: your taxi vs a robot taxi in the same toy city. First to the passenger gets paid. Engine sound made in code. | [play](https://oxmavex.github.io/pocket-vice/builds/03-last-fare/) | 50.8 KB + three.js r128 (CDN) |
| 04 | Curbside: a scripted street scene at eye level. Fast taxi, careful robot taxi, one passenger. No images, no models. | [watch](https://oxmavex.github.io/pocket-vice/builds/04-curbside/) | 27.4 KB + three.js r128 (CDN) |
| 05 | The Last Fare (mission): the Curbside street with a mission HUD of my own — title card, minimap, objective, marker, result. | [watch](https://oxmavex.github.io/pocket-vice/builds/05-mission/) | 29.1 KB + three.js r128 (CDN) |
| 06 | Port Calder (MODEL HEIST): a GTA-style coastal city from one shared prompt — driving, taxi fare, checkpoint sprint, paint shop, traffic, day to night. `?demo` plays itself. | [play](https://oxmavex.github.io/pocket-vice/builds/06-model-heist/) · [demo](https://oxmavex.github.io/pocket-vice/builds/06-model-heist/?demo) | 60.3 KB + three.js r128 (CDN) |
| 07 | NPC #48: a 36-second trailer. A background NPC breaks his loop, finds the edge of the map, and the city turns out to be built from its own source code (one building per word). | [watch](https://oxmavex.github.io/pocket-vice/builds/07-npc-48/) | 26.9 KB + three.js r128 (CDN) |
| 08 | Cutroom: tools/autoclip.js cuts Port Calder gameplay into 3 vertical shorts (loudness + motion score, 9:16 crop, titles) in 52.6 s; the page replays that run as a 30 s studio clip. | render page (needs local frames) | ffmpeg + node |
| 01 | Clockwork Block: 210 people, each with their own daily schedule. Tap anyone to see their day. | [play](https://oxmavex.github.io/pocket-vice/builds/01-clockwork-block/) | 48.9 KB + three.js r128 (CDN) |

Add `?seed=<any number>` to a build URL to get your own city.

## How it's made
- Each build is a single `index.html` in `builds/NN-slug/`.
- `BUILDLOG.md` is the working diary. It records every prompt, bug, fix and measurement as it happened.
- Videos are rendered from the build itself. `window.__seek(t)` sets the frame, Playwright captures it with `canvas.toDataURL`, and FFmpeg encodes the result. See `tools/render.js`.
- `node tools/check.js <slug>` takes the test screenshots and measures FPS.

No downloaded assets: every building, person and tree is generated in code.
