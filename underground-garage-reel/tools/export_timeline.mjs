// Dump src/timeline.js as JSON for the Python audio/caption tools.
import fs from 'node:fs';
import { FPS, DURATION, VO, SCENES, T } from '../src/timeline.js';
fs.mkdirSync('build', { recursive: true });
fs.writeFileSync('build/timeline.json', JSON.stringify({ FPS, DURATION, VO, SCENES, T }, null, 1));
console.log('wrote build/timeline.json');
