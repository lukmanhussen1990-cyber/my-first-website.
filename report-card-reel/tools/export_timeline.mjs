// Export the timeline and the world's event lists to build/timeline.json for the
// Python tools (sound, subtitles): node tools/export_timeline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as TL from '../src/timeline.js';
import * as WD from '../src/world.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = {
  FPS: TL.FPS,
  DURATION: TL.DURATION,
  VO: TL.VO,
  SCENES: TL.SCENES,
  T: TL.T,
  CAM: TL.CAM,
  WORLD: {
    HOLE: WD.HOLE,
    SCOOPS: WD.SCOOPS,
    DEEP_T: WD.DEEP_T,
    PAW_T: WD.PAW_T,
    DAD_T: WD.DAD_T,
    BEEPS: WD.BEEPS,
    FLOWER_T: WD.FLOWERS.map((_, i) => WD.flowerT(i)),
    FLOWERS: WD.FLOWERS,
    KID_SPOT: WD.KID_SPOT,
    DOG_SPOT: WD.DOG_SPOT,
    DAD_SPOT: WD.DAD_SPOT,
    KID_WATCH: WD.KID_WATCH,
    PILE: WD.PILE,
    DOGHOUSE: WD.DOGHOUSE,
    BACKDOOR: WD.BACKDOOR,
    // the roller's x, and Dad's walk, sampled every 0.1 s (for sounds that follow them)
    rollerX: Array.from({ length: Math.round(TL.DURATION * 10) + 1 }, (_, i) => +WD.rollerX(i / 10).toFixed(3)),
    dadX: Array.from({ length: Math.round(TL.DURATION * 10) + 1 }, (_, i) => +WD.dadWalk(i / 10).x.toFixed(3)),
  },
};
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'timeline.json'), JSON.stringify(out, null, 1));
console.log('wrote build/timeline.json');
