// Writes the story beat times (from scene/beats.js) to cues.json for the sound design.
import fs from 'fs';
import { B, sfxCues, SCENES, DURATION, FPS } from '../scene/beats.js';
const out = { fps: FPS, duration: DURATION, scenes: SCENES, beats: B, sfx: sfxCues() };
fs.writeFileSync(new URL('../cues.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('wrote cues.json');
