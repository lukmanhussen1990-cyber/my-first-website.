#!/usr/bin/env node
// Writes data/sfx_events.json: timing data the sound designer needs that is
// computed by the animation code itself (so picture and sound always agree):
// when each concrete ring thunks into place, and how fast the drill is moving
// through which layer at every moment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTipTrack } from '../render/director.js';
import { LAYOUT } from '../render/layout.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const E = TL.events;
const tip = makeTipTrack(E);

// Same ring schedule as render/fx.js
const W = 0.5, TAIL = LAYOUT.DRILL_LEN + 4.5;
const tAtTail = (s) => {
  let lo = E.drill_go, hi = 47;
  if (tip(hi) - TAIL < s) return Infinity;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (tip(m) - TAIL < s) lo = m; else hi = m; }
  return (lo + hi) / 2;
};
const rings = [];
const crumbleS0 = 1.0;
const tailAtStart = tip(E.rings_start) - TAIL;
for (let s = tailAtStart - 0.5; s >= crumbleS0 - 0.01; s -= W) rings.push({ s, t: E.rings_start + (tailAtStart - s) * 0.075 });
for (let s = tailAtStart; s < 49; s += W) rings.push({ s, t: Math.max(E.rings_start, tAtTail(s)) });
for (let s = 100; s < 128; s += W) rings.push({ s, t: tAtTail(s) });

// Drill state sampled at 100 Hz: path length of the tip and its speed.
const drill = [];
for (let t = E.drill_go; t <= E.burst + 0.2; t += 0.01) {
  const s = tip(t), v = (tip(t + 0.005) - tip(t - 0.005)) / 0.01;
  drill.push([+t.toFixed(3), +s.toFixed(3), +v.toFixed(3)]);
}
const out = { rings: rings.filter((r) => Number.isFinite(r.t)).map((r) => ({ t: +r.t.toFixed(4), s: +r.s.toFixed(3) })).sort((a, b) => a.t - b.t),
  drill, layers: { near: LAYOUT.NEAR, far: LAYOUT.FAR, coreTop: -LAYOUT.CORE_Y - LAYOUT.CORE_R, coreBottom: -LAYOUT.CORE_Y + LAYOUT.CORE_R,
    farDepth: -LAYOUT.FAR_Y } };
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data', 'sfx_events.json'), JSON.stringify(out));
console.log(`rings: ${out.rings.length}, drill samples: ${drill.length}`);
