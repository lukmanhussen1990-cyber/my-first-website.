// Export the shared timeline (events + per-frame curves) to JSON for the audio generator.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as T from '../src/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = Math.round(T.DURATION * 100);
const curves = { t: [], run: [], rate: [], storm: [], night: [], wind: [], rain: [], flash: [], houseLight: [], genPower: [], battery: [], flow: [], dotDensity: [], genOmega: [] };
for (let i = 0; i <= N; i++) {
  const t = i / 100;
  curves.t.push(+t.toFixed(2));
  curves.run.push(+T.runSpeed(t).toFixed(4));
  curves.rate.push(+T.timeRate(t).toFixed(4));
  curves.storm.push(+T.storm(t).toFixed(4));
  curves.night.push(+T.night(t).toFixed(4));
  curves.wind.push(+T.wind(t).toFixed(4));
  curves.rain.push(+T.rain(t).toFixed(4));
  curves.flash.push(+T.flash(t).toFixed(4));
  curves.houseLight.push(+T.houseLight(t).toFixed(4));
  curves.genPower.push(+T.genPower(t).toFixed(4));
  curves.battery.push(+T.battery(t).toFixed(4));
  curves.flow.push(+T.flowSpeed(t).toFixed(4));
  curves.dotDensity.push(+T.dotDensity(t).toFixed(4));
  const om = T.runSpeed(t) * 1.6 * T.timeRate(t) * T.genRatio(t) * (t > T.E.genSpin ? 1 : 0);
  curves.genOmega.push(+om.toFixed(3));
}
const out = {
  fps: T.FPS, duration: T.DURATION, scenes: T.SCENES, events: T.E,
  flashes: T.FLASHES, footsteps: T.footstepTimes(), curves,
};
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build/timeline.json'), JSON.stringify(out));
console.log('events', Object.keys(T.E).length, 'footsteps', out.footsteps.length);
