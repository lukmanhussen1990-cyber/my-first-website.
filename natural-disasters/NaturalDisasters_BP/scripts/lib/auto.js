// Automatic random disasters: a low-frequency scheduler controlled by the Disaster Controller settings.
import { world, system } from '@minecraft/server';
import { DISASTER_IDS, DISASTER_META } from '../config.js';
import { getSettings } from './settings.js';
import { startDisaster, activeCount } from './manager.js';
import { warn, errMsg } from './util.js';

const TAU = Math.PI * 2;

/** [min, max] horizontal distance from the chosen player where each disaster is placed */
const NEAR = {
  earthquake: [0, 6], supercell: [0, 10], hurricane: [0, 10], blizzard: [0, 10], sinkhole: [12, 30],
  wildfire: [20, 45], tornado: [35, 55], meteor: [25, 50], volcano: [40, 55], tsunami: [10, 30],
};

let nextAt = 0;

/** Weighted random disaster id using DISASTER_META.autoWeight. @param {() => number} rand */
export function pickWeighted(rand) {
  let total = 0;
  for (let i = 0; i < DISASTER_IDS.length; i++) total += DISASTER_META[DISASTER_IDS[i]].autoWeight;
  let r = rand() * total;
  for (let i = 0; i < DISASTER_IDS.length; i++) {
    r -= DISASTER_META[DISASTER_IDS[i]].autoWeight;
    if (r < 0) return DISASTER_IDS[i];
  }
  return DISASTER_IDS[0];
}

/** @param {{autoIntervalMin: number}} s */
function interval(s) { return Math.round(s.autoIntervalMin * 1200 * (0.75 + Math.random() * 0.5)); }

function check() {
  try {
    const s = getSettings();
    const now = system.currentTick;
    if (!s.autoDisasters) { nextAt = 0; return; }
    if (nextAt === 0) { nextAt = now + interval(s); return; }
    if (now < nextAt) return;
    const players = world.getAllPlayers();
    if (players.length === 0 || activeCount() > 0) { nextAt = now + 600; return; }
    const p = players[Math.floor(Math.random() * players.length)];
    const id = pickWeighted(Math.random);
    const meta = DISASTER_META[id];
    const variant = meta.autoVariants[Math.floor(Math.random() * meta.autoVariants.length)] || 'default';
    const range = NEAR[id] || [20, 45];
    const a = Math.random() * TAU, r = range[0] + Math.random() * (range[1] - range[0]);
    const loc = p.location;
    const res = startDisaster(id, variant, p.dimension, { x: loc.x + Math.cos(a) * r, y: loc.y, z: loc.z + Math.sin(a) * r }, p);
    nextAt = now + (res.ok ? interval(s) : 600);
    if (res.ok) world.sendMessage('§e[Natural Disasters] ' + meta.label + ' is striking near ' + p.name + '!');
  } catch (e) {
    warn('auto scheduler error: ' + errMsg(e));
    nextAt = system.currentTick + 1200;
  }
}

/** Start the scheduler (checks every 5 seconds). */
export function initAuto() {
  system.runInterval(check, 100);
}
