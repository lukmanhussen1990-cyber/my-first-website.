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
    SCOOP_T: WD.SCOOP_T,
    SPOON_T: WD.SPOON_T,
    CAVES: WD.CAVES,
    FRAMES_A: WD.FRAMES_A,
    FRAMES_B: WD.FRAMES_B,
    LANTERNS: WD.LANTERNS,
    SHAFT: WD.SHAFT,
    DOGHOUSE: WD.DOGHOUSE,
    KIT_UP: WD.KIT_UP,
    TILE: WD.TILE,
    ROCK: WD.ROCK,
    MOM_POS: WD.MOM_POS,
    PULLEY: WD.PULLEY,
    // when the dig face passes x (for sounds that follow the digging)
    tunX: Array.from({ length: Math.round(TL.DURATION * 10) + 1 }, (_, i) => +WD.tunX(i / 10).toFixed(3)),
  },
};
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'timeline.json'), JSON.stringify(out, null, 1));
console.log('wrote build/timeline.json');
