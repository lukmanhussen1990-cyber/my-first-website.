// Export the timeline, the camera and the world's event lists to build/timeline.json for
// the Python tools (sound, subtitles): node tools/export_timeline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as TL from '../src/timeline.js';
import * as WD from '../src/world.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const n = Math.round(TL.DURATION * 10) + 1;
const samples = (f) => Array.from({ length: n }, (_, i) => +f(i / 10).toFixed(4));
const out = {
  FPS: TL.FPS,
  DURATION: TL.DURATION,
  VO: TL.VO,
  SCENES: TL.SCENES,
  T: TL.T,
  // the camera sampled every 0.1 s (x, distance in front of the cut, focal length): the
  // sound pans each source to where it sits across the frame
  CAMS: { cx: samples((t) => TL.camAt(t).cx), cz: samples((t) => TL.camAt(t).cz), f: samples((t) => TL.camAt(t).f), cy: samples((t) => TL.camAt(t).cy) },
  COUNTDOWN: samples((t) => TL.countdown(t) ?? -1),
  WORLD: {
    DIG_T: WD.DIG_T,
    PILE: WD.PILE,
    digX: WD.DIG_T.map((t) => WD.digX(t)),
    // how far the giant cloud's front has rolled (m), every 0.1 s
    cloudR: samples((t) => WD.bigCloud(t)?.R ?? 0),
  },
};
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'timeline.json'), JSON.stringify(out, null, 1));
console.log('wrote build/timeline.json');
