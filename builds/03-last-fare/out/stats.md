# 03 · Last Fare — real numbers

- One file: `index.html`, 51 975 bytes (50.8 KB) + three.js r128 from cdnjs. No textures from outside, no models, no audio files.
- City: same generator and seed as build 02 (seed 7 → Brindle Cove), plus countryside around it.
- Robot taxi: follows the right lane, top speed 2.05 cells/s, slows for every turn, never leaves the road (BFS on road cells only).
- My car in the clip (orange) is a scripted line: top speed 2.6 cells/s (+27%), ignores lanes, may cut through parks.
- Robot alone, 60-second shift, nobody in its way: seed 7 → 7 fares ($102). Seeds 1–5 → 5 / 8 / 6 / 6 / 6 fares.
- In the clip (20 s): fare 1 robot (my car was 2.75 car lengths from the passenger, after cutting through the park), fare 2 me, fare 3 me (robot 2.51 car lengths behind).
- Live: 60.2 FPS desktop and iPhone 13 emulation, load 1.4 s desktop / 0.6 s mobile emulation (local), 0 errors (check r3).
- Sound in the clip: synthesized in tools/sound-03.js from the per-frame rpm, throttle, slip and speed of both cars; −14.1 LUFS.
