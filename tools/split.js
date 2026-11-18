// split: two gameplay recordings → one 1080x1080 clip, top half vs bottom half, labelled (the format of the competitor's comparison)
// usage: node tools/split.js <top.mp4> "<TOP LABEL>" <bottom.mp4> "<BOTTOM LABEL>" <out.mp4> [seconds]
// each input is centre-cropped to 2:1 and scaled to 1080x540; audio comes from the top clip (swap the order for the other one)
const { spawnSync } = require('child_process');
const [top, tl, bot, bl, out, secs] = process.argv.slice(2);
if (!out) { console.error('usage: node tools/split.js top.mp4 "TOP" bottom.mp4 "BOTTOM" out.mp4 [seconds]'); process.exit(1); }
const F = 'C\:/Windows/Fonts/segoeuib.ttf';
const crop = '[I]scale=1080:-2,crop=1080:540:0:(ih-540)/2,setsar=1,fps=30[O]';
const lab = (l, y) => `drawtext=fontfile='${F}':text='${l.replace(/'/g, '')}':fontcolor=white:fontsize=46:borderw=4:bordercolor=black@0.85:x=(w-tw)/2:y=${y}`;
const fc = [crop.replace('[I]', '[0:v]').replace('[O]', '[a]'), crop.replace('[I]', '[1:v]').replace('[O]', '[b]'), `[a][b]vstack=2,${lab(tl, 22)},${lab(bl, 562)},drawbox=x=0:y=538:w=1080:h=4:color=white@0.9:t=fill[v]`].join(';');
const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', top, '-i', bot, '-filter_complex', fc, '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart'];
if (secs) args.push('-t', secs);
const r = spawnSync('ffmpeg', [...args, out], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log('ok', out);
