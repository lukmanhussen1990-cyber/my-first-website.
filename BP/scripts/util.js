// The Hollow Bride - defensive helpers.
// Nothing in this file is allowed to throw. One bad room must never brick a world.

import { world, system, BlockPermutation } from "@minecraft/server";
import { DIM_ID } from "./config.js";

export function log(msg) {
  try {
    console.warn("[hollow_bride] " + msg);
  } catch (e) {
    // console is not guaranteed on every build; swallow.
  }
}

// Wrap any callback so a throw becomes a log line instead of a dead handler.
export function safe(fn, label) {
  return function (...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {
      log((label || "handler") + " failed: " + (e && e.message ? e.message : e));
      return undefined;
    }
  };
}

// Subscribe only if the event actually exists on this runtime version.
export function subscribeIfPresent(bucket, name, cb, label) {
  try {
    if (bucket && bucket[name] && typeof bucket[name].subscribe === "function") {
      bucket[name].subscribe(safe(cb, label || name));
      return true;
    }
  } catch (e) {
    log("subscribe " + name + " failed: " + (e && e.message ? e.message : e));
  }
  log("event " + name + " not available on this runtime; feature degraded");
  return false;
}

export function dim() {
  try {
    return world.getDimension(DIM_ID);
  } catch (e) {
    return undefined;
  }
}

export function players() {
  try {
    return world.getAllPlayers();
  } catch (e) {
    return [];
  }
}

export function runCmd(entityOrDim, command) {
  try {
    entityOrDim.runCommand(command);
    return true;
  } catch (e) {
    return false;
  }
}

// Commands are illegal inside read-only contexts; defer one tick.
export function runCmdLater(entityOrDim, command) {
  try {
    system.run(() => {
      runCmd(entityOrDim, command);
    });
  } catch (e) {
    // ignore
  }
}

export function getBlockAt(loc) {
  try {
    const d = dim();
    if (!d) return undefined;
    return d.getBlock(loc);
  } catch (e) {
    return undefined;
  }
}

export function setBlockState(loc, typeId, states) {
  try {
    const b = getBlockAt(loc);
    if (!b) return false;
    b.setPermutation(BlockPermutation.resolve(typeId, states || {}));
    return true;
  } catch (e) {
    return false;
  }
}

export function getState(block, name) {
  try {
    return block.permutation.getState(name);
  } catch (e) {
    return undefined;
  }
}

export function withState(block, name, value) {
  try {
    block.setPermutation(block.permutation.withState(name, value));
    return true;
  } catch (e) {
    return false;
  }
}

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distFlat(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function norm(v) {
  const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (m < 0.00001) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function inBox(loc, min, max) {
  return (
    loc.x >= min.x &&
    loc.x <= max.x &&
    loc.y >= min.y &&
    loc.y <= max.y &&
    loc.z >= min.z &&
    loc.z <= max.z
  );
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Hints are capped at 45 characters so they stay readable at arm's length.
export function hint(player, text) {
  try {
    const t = String(text).slice(0, 45);
    player.onScreenDisplay.setActionBar(t);
  } catch (e) {
    // ignore
  }
}

export function titleCard(player, title, sub) {
  try {
    player.onScreenDisplay.setTitle(String(title).slice(0, 45), {
      subtitle: sub ? String(sub).slice(0, 45) : undefined,
      fadeInDuration: 20,
      stayDuration: 60,
      fadeOutDuration: 20
    });
  } catch (e) {
    // ignore
  }
}

export function sound(player, id, pitch, volume) {
  try {
    player.playSound(id, {
      location: player.location,
      pitch: pitch === undefined ? 1.0 : pitch,
      volume: volume === undefined ? 1.0 : volume
    });
  } catch (e) {
    // ignore
  }
}

export function worldSound(id, loc, pitch, volume) {
  try {
    world.playSound(id, loc, {
      pitch: pitch === undefined ? 1.0 : pitch,
      volume: volume === undefined ? 1.0 : volume
    });
  } catch (e) {
    // ignore
  }
}

export function particle(id, loc) {
  try {
    const d = dim();
    if (d) d.spawnParticle(id, loc);
  } catch (e) {
    // ignore
  }
}

export function effect(player, id, ticks, amplifier) {
  try {
    player.addEffect(id, ticks, {
      amplifier: amplifier || 0,
      showParticles: false
    });
  } catch (e) {
    // ignore
  }
}

export function entitiesOfType(typeId) {
  try {
    const d = dim();
    if (!d) return [];
    return d.getEntities({ type: typeId });
  } catch (e) {
    return [];
  }
}

export function despawnAll(typeId) {
  const list = entitiesOfType(typeId);
  for (const e of list) {
    try {
      e.triggerEvent("ag:despawn");
    } catch (err) {
      try {
        e.remove();
      } catch (err2) {
        // ignore
      }
    }
  }
}

export function spawn(typeId, loc) {
  try {
    const d = dim();
    if (!d) return undefined;
    return d.spawnEntity(typeId, loc);
  } catch (e) {
    return undefined;
  }
}
