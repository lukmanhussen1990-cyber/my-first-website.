// Shared helpers. Everything here sticks to @minecraft/server 1.10.0 stable APIs
// and swallows errors, so one failing call never stops the whole add-on.
import * as mc from "@minecraft/server";

const { world, system } = mc;

export const GRINNING_MAN = "horror:grinning_man";
export const PARASITE = "horror:parasite";
const DIMENSIONS = ["overworld", "nether", "the_end"];

export function now() {
  return system.currentTick;
}

export function valid(entity) {
  try {
    return !!entity && entity.isValid();
  } catch {
    return false;
  }
}

export function isAlive(entity) {
  try {
    const health = entity.getComponent("minecraft:health");
    return !health || health.currentValue > 0;
  } catch {
    return false;
  }
}

/** Subscribes to an event signal if it exists in this game version. */
export function on(signals, name, handler) {
  try {
    signals[name].subscribe((event) => {
      try {
        handler(event);
      } catch (error) {
        console.warn(`[Urban Legends] ${name}: ${error}`);
      }
    });
  } catch (error) {
    console.warn(`[Urban Legends] could not subscribe to ${name}: ${error}`);
  }
}

export function every(ticks, fn) {
  system.runInterval(() => {
    try {
      fn();
    } catch (error) {
      console.warn(`[Urban Legends] interval: ${error}`);
    }
  }, ticks);
}

export function later(ticks, fn) {
  system.runTimeout(() => {
    try {
      fn();
    } catch (error) {
      console.warn(`[Urban Legends] timeout: ${error}`);
    }
  }, ticks);
}

export function entitiesOfType(type) {
  const found = [];
  for (const id of DIMENSIONS) {
    try {
      found.push(...world.getDimension(id).getEntities({ type }));
    } catch {}
  }
  return found;
}

export function nearestPlayer(dimension, location, maxDistance) {
  try {
    return dimension.getPlayers({ location, maxDistance }).filter(isAlive)
      .sort((a, b) => dist(a.location, location) - dist(b.location, location))[0];
  } catch {
    return undefined;
  }
}

export function nearestOfTypes(player, types, maxDistance) {
  let best;
  let bestDist = Infinity;
  for (const type of types) {
    try {
      for (const e of player.dimension.getEntities({ type, location: player.location, maxDistance })) {
        const d = dist(e.location, player.location);
        if (d < bestDist) {
          best = e;
          bestDist = d;
        }
      }
    } catch {}
  }
  return best;
}

export function getHeldItem(player) {
  try {
    return player.getComponent("minecraft:equippable").getEquipment(mc.EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

// ---------- vectors ----------
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a) => Math.sqrt(dot(a, a));
export const dist = (a, b) => length(sub(a, b));
export const rand = (min, max) => min + Math.random() * (max - min);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ---------- blocks ----------
const SEE_THROUGH = /air|glass|pane|leaves|bars|flower|tulip|poppy|dandelion|daisy|orchid|allium|bluet|cornflower|lily|rose|peony|lilac|fern|sapling|torch|vine|web|carpet|rail|button|lever|pressure_plate|sign|ladder|chain|lantern|bush|mushroom|kelp|seagrass|coral|fire|light_block|snow_layer|water|tallgrass|short_grass|tall_grass|redstone_wire|tripwire|banner|candle|reeds|sugar_cane|wheat|carrots|potatoes|beetroot|scaffolding|fence/;
const PASSABLE = /^minecraft:(air|short_grass|tall_grass|tallgrass|fern|large_fern|deadbush|dead_bush|snow_layer|light_block.*|.*flower.*|.*tulip|poppy|dandelion|.*daisy|.*orchid|allium|azure_bluet|cornflower|.*torch|vine|.*sapling)$/;

export function getBlock(dimension, location) {
  try {
    return dimension.getBlock({ x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) });
  } catch {
    return undefined;
  }
}

export function blocksView(block) {
  return !!block && !SEE_THROUGH.test(block.typeId.replace("minecraft:", ""));
}

function isPassable(block) {
  return !!block && PASSABLE.test(block.typeId);
}

export function hasLineOfSight(dimension, from, to) {
  const d = sub(to, from);
  const total = length(d);
  if (total < 1) return true;
  const step = scale(d, 0.7 / total);
  let p = from;
  for (let t = 0.7; t < total - 0.6; t += 0.7) {
    p = add(p, step);
    if (blocksView(getBlock(dimension, p))) return false;
  }
  return true;
}

/** Finds a spot near (x, y, z) with solid ground and `height` free blocks above it. */
export function findStandingSpot(dimension, x, y, z, height = 2) {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  for (let dy = 4; dy >= -8; dy--) {
    const by = Math.floor(y) + dy;
    const below = getBlock(dimension, { x: bx, y: by - 1, z: bz });
    if (!below || isPassable(below) || below.typeId.includes("water") || below.typeId.includes("lava")) continue;
    let clear = true;
    for (let h = 0; h < height && clear; h++) clear = isPassable(getBlock(dimension, { x: bx, y: by + h, z: bz }));
    if (clear) return { x: bx + 0.5, y: by, z: bz + 0.5 };
  }
  return undefined;
}

/** A standing spot `distance` blocks behind where the player is looking. */
export function spotBehind(player, distance, spread = 0.8) {
  const view = player.getViewDirection();
  let hx = -view.x;
  let hz = -view.z;
  const h = Math.sqrt(hx * hx + hz * hz);
  if (h < 0.1) {
    const a = Math.random() * Math.PI * 2;
    hx = Math.cos(a);
    hz = Math.sin(a);
  } else {
    hx /= h;
    hz /= h;
  }
  const j = (Math.random() - 0.5) * spread;
  const cx = hx * Math.cos(j) - hz * Math.sin(j);
  const cz = hx * Math.sin(j) + hz * Math.cos(j);
  const loc = player.location;
  return findStandingSpot(player.dimension, loc.x + cx * distance, loc.y, loc.z + cz * distance);
}

/** Would this player see something standing at `base` (checks feet, chest and head)? */
export function canSee(player, base, maxDistance = 48, fovCos = 0.55) {
  const eye = player.getHeadLocation();
  const view = player.getViewDirection();
  for (const up of [0.4, 1.5, 2.6]) {
    const point = { x: base.x, y: base.y + up, z: base.z };
    const d = sub(point, eye);
    const range = length(d);
    if (range > maxDistance) return false;
    if (range < 1.5) return true;
    if (dot(d, view) / range >= fovCos && hasLineOfSight(player.dimension, eye, point)) return true;
  }
  return false;
}

// ---------- feedback ----------
export function sound(player, id, volume = 1, pitch = 1, location) {
  try {
    player.playSound(id, location ? { volume, pitch, location } : { volume, pitch });
  } catch {}
}

export function soundAround(dimension, location, id, radius = 24, volume = 1, pitch = 1) {
  try {
    for (const p of dimension.getPlayers({ location, maxDistance: radius })) sound(p, id, volume, pitch, location);
  } catch {}
}

export function particle(dimension, id, location) {
  try {
    dimension.spawnParticle(id, location);
  } catch {}
}

export function effect(entity, id, ticks, amplifier = 0) {
  try {
    entity.addEffect(id, ticks, { amplifier, showParticles: false });
  } catch {}
}

export function title(player, text, subtitle, stay = 40) {
  try {
    const options = { fadeInDuration: 0, stayDuration: stay, fadeOutDuration: 10 };
    if (subtitle) options.subtitle = subtitle;
    player.onScreenDisplay.setTitle(text, options);
  } catch {}
}

export function actionbar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {}
}

export function command(source, cmd) {
  try {
    source.runCommand(cmd);
  } catch {}
}

export function damage(target, amount, source, cause = "entityAttack") {
  try {
    const options = { cause };
    if (valid(source)) options.damagingEntity = source;
    return target.applyDamage(amount, options);
  } catch {
    return false;
  }
}

/** Tries to start a per-player cooldown. Returns 0 on success, else the ticks left. */
const cooldowns = new Map();
export function useCooldown(player, key, ticks) {
  const id = `${player.id}:${key}`;
  const left = (cooldowns.get(id) ?? 0) - now();
  if (left > 0) return left;
  cooldowns.set(id, now() + ticks);
  return 0;
}
