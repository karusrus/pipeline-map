// Records the imported map flying through its camera slots: DevTools screencast → frames → mp4 + gif + stills.
//   node docs/record.mjs                (static server already on :8765, e.g. python3 -m http.server 8765)
//   URL=http://localhost:8765 BUNDLE=docs/transparency-kit.bundle.json node docs/record.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './cdp.mjs';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const FRAMES = path.join(DIR, 'frames');
fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765';
const BUNDLE = process.env.BUNDLE || 'docs/transparency-kit.bundle.json';
const OUT = process.env.OUT || 'transparency-kit-map';
// [slot, hold seconds, still name]
const SCRIPT = [[1, 2.5, 'map-all'], [2, 4, 'map-line'], [3, 3, 'map-kit'], [5, 4, 'map-auditor'], [4, 4, 'map-uncovered'], [1, 2.5, null]];

const b = await launch({ width: 1600, height: 900 });
const frames = [];
b.on(m => {
  if (m.method !== 'Page.screencastFrame') return;
  const { data, metadata, sessionId } = m.params;
  const file = path.join(FRAMES, `f${String(frames.length).padStart(5, '0')}.jpg`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp * 1000 });
  b.send('Page.screencastFrameAck', { sessionId });
});
await b.send('Page.navigate', { url: `${BASE}/?import=${BUNDLE}&pres=1` });
await sleep(2500);
await b.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1600, maxHeight: 900, everyNthFrame: 1 });
for (const [slot, hold, still] of SCRIPT) {
  await b.evaluate(`gotoSlot(${slot})`);
  await sleep(1200);
  if (still) {
    const shot = await b.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DIR, `${still}.png`), Buffer.from(shot.data, 'base64'));
  }
  await sleep(hold * 1000);
}
await b.send('Page.stopScreencast');
await b.close();
console.log(`frames ${frames.length} over ${((frames.at(-1).t - frames[0].t) / 1000).toFixed(1)} s`);
let list = '';
frames.forEach((f, i) => { const next = frames[i + 1]?.t ?? f.t + 1000 / 30; list += `file '${f.file}'\nduration ${((next - f.t) / 1000).toFixed(4)}\n`; });
list += `file '${frames.at(-1).file}'\n`;
fs.writeFileSync(path.join(DIR, 'frames.txt'), list);
const mp4 = path.join(DIR, `${OUT}.mp4`), gif = path.join(DIR, `${OUT}.gif`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(DIR, 'frames.txt'),
  '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '21', '-preset', 'medium', '-movflags', '+faststart', mp4]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4,
  '-vf', 'fps=12,scale=1100:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', gif]);
fs.rmSync(FRAMES, { recursive: true, force: true }); fs.rmSync(path.join(DIR, 'frames.txt'), { force: true });
for (const f of [mp4, gif]) console.log(f, (fs.statSync(f).size / 1e6).toFixed(1) + ' MB');
