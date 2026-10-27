// Export the timeline and the world's event lists to build/timeline.json for the
// Python tools (sound, subtitles): node tools/export_timeline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as TL from '../src/timeline.js';
import * as WD from '../src/world.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const samples = (f) => Array.from({ length: Math.round(TL.DURATION * 10) + 1 }, (_, i) => +f(i / 10).toFixed(4));
const out = {
  FPS: TL.FPS,
  DURATION: TL.DURATION,
  VO: TL.VO,
  SCENES: TL.SCENES,
  T: TL.T,
  CAM: TL.CAM,
  WORLD: {
    DIG_T: WD.DIG_T,
    ANCHORS: WD.ANCHORS,
    PILE: WD.PILE,
    // weather sampled every 0.1 s (for the wind, the roar, the music's build)
    storm: samples(WD.storm),
    wind: samples(WD.wind),
    engulf: samples(WD.engulf),
    clear: samples(WD.clearK),
    tornadoD: samples((t) => WD.tornado(t).d),
  },
};
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'timeline.json'), JSON.stringify(out, null, 1));
console.log('wrote build/timeline.json');
