// Shared helpers. Written against @minecraft/server 1.10.0 (stable in 1.20.80+,
// so it runs on 1.21.0 betas without the "Beta APIs" experiment).
import { EntityDamageCause, EquipmentSlot, GameMode } from "@minecraft/server";

/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {import("@minecraft/server").Block} Block */

export const V = {
  /** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  /** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  /** @param {Vector3} a @param {number} s @returns {Vector3} */
  scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  /** @param {Vector3} a @param {Vector3} b */
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  /** @param {Vector3} a @param {Vector3} b @returns {Vector3} */
  cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
  /** @param {Vector3} a */
  len: (a) => Math.hypot(a.x, a.y, a.z),
  /** @param {Vector3} a @param {Vector3} b */
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
  /** @param {Vector3} a @returns {Vector3} */
  norm: (a) => {
    const l = Math.hypot(a.x, a.y, a.z) || 1;
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  },
  /** Horizontal unit vector. @param {Vector3} a @returns {Vector3} */
  flat: (a) => {
    const l = Math.hypot(a.x, a.z);
    return l < 1e-6 ? { x: 0, y: 0, z: 1 } : { x: a.x / l, y: 0, z: a.z / l };
  },
  /** @param {Vector3} a @returns {Vector3} */
  floor: (a) => ({ x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) }),
  /** @param {Vector3} a @param {number} dy @returns {Vector3} */
  up: (a, dy) => ({ x: a.x, y: a.y + dy, z: a.z }),
  /** @param {Vector3} a @param {Vector3} b @param {number} t @returns {Vector3} */
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }),
};

/** Distance from point p to segment ab. @param {Vector3} p @param {Vector3} a @param {Vector3} b */
export function distToSegment(p, a, b) {
  const ab = V.sub(b, a);
  const l2 = V.dot(ab, ab);
  const t = l2 < 1e-6 ? 0 : Math.max(0, Math.min(1, V.dot(V.sub(p, a), ab) / l2));
  return V.dist(p, V.add(a, V.scale(ab, t)));
}

/** Works with both the 1.x method and the 2.x property form of isValid. @param {any} e */
export function alive(e) {
  try {
    return !!e && (typeof e.isValid === "function" ? e.isValid() : !!e.isValid);
  } catch {
    return false;
  }
}

/** @param {unknown} err */
export function logError(err) {
  try {
    console.warn("[Arcane Arsenal] " + (err instanceof Error ? err.stack || err.message : String(err)));
  } catch {
    // console unavailable
  }
}

// ---------------------------------------------------------------- blocks
// @minecraft/server 1.10.0 has no Block.typeId, so blocks are identified
// through their permutation (and isAir / isLiquid).
/** @param {Block | undefined} block @param {string} id */
export function blockIs(block, id) {
  try {
    return !!block && block.permutation.matches(id);
  } catch {
    return false;
  }
}

/** Item id of a block, e.g. "minecraft:chest" (undefined for blocks with no item). @param {Block} block */
export function blockItemId(block) {
  try {
    const stack = block.getItemStack(1, false);
    return stack ? stack.typeId : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- equipment
/** @param {Entity} entity @returns {import("@minecraft/server").EntityEquippableComponent | undefined} */
function equippable(entity) {
  try {
    return /** @type {any} */ (entity.getComponent("minecraft:equippable"));
  } catch {
    return undefined;
  }
}

/** @param {Entity} entity @returns {ItemStack | undefined} */
export function mainhand(entity) {
  try {
    return equippable(entity)?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

/** @param {Entity} entity @returns {ItemStack | undefined} */
export function offhand(entity) {
  try {
    return equippable(entity)?.getEquipment(EquipmentSlot.Offhand);
  } catch {
    return undefined;
  }
}

/** @param {Entity} entity @returns {import("@minecraft/server").Container | undefined} */
export function inventory(entity) {
  try {
    const inv = /** @type {import("@minecraft/server").EntityInventoryComponent | undefined} */ (
      /** @type {any} */ (entity.getComponent("minecraft:inventory"))
    );
    return inv?.container;
  } catch {
    return undefined;
  }
}

/** @param {Player} player */
export function isCreative(player) {
  try {
    return player.matches({ gameMode: GameMode.creative });
  } catch {
    return false;
  }
}

/** @param {Player} player */
export function isSpectator(player) {
  try {
    return player.matches({ gameMode: GameMode.spectator });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- health & effects
/** @param {Entity} entity @returns {import("@minecraft/server").EntityHealthComponent | undefined} */
export function health(entity) {
  try {
    return /** @type {any} */ (entity.getComponent("minecraft:health"));
  } catch {
    return undefined;
  }
}

/** @param {Entity} entity @param {number} amount */
export function heal(entity, amount) {
  const h = health(entity);
  if (!h) return;
  try {
    if (h.currentValue > 0 && h.currentValue < h.effectiveMax) {
      h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amount));
    }
  } catch {
    // entity died this tick
  }
}

/** @param {Entity} entity @param {string} effect @param {number} ticks @param {number} amplifier */
export function addEffect(entity, effect, ticks, amplifier = 0) {
  try {
    entity.addEffect(effect, ticks, { amplifier, showParticles: false });
  } catch {
    // immune / invalid target
  }
}

/**
 * Keep an effect topped up without resetting it every call (resetting a
 * short effect constantly stops regeneration-type effects from ticking).
 * @param {Entity} entity @param {string} effect @param {number} amplifier
 */
export function keepEffect(entity, effect, amplifier = 0) {
  try {
    const cur = entity.getEffect(effect);
    if (cur && cur.amplifier > amplifier && cur.duration > 20) return;
    if (!cur || cur.amplifier < amplifier || cur.duration < 30) {
      entity.addEffect(effect, 60, { amplifier, showParticles: false });
    }
  } catch {
    // ignore
  }
}

/**
 * @param {Entity} target @param {number} amount @param {Entity} [source]
 * @param {EntityDamageCause} [cause]
 */
export function hurt(target, amount, source, cause = EntityDamageCause.entityAttack) {
  try {
    return target.applyDamage(amount, source ? { cause, damagingEntity: source } : { cause });
  } catch {
    return false;
  }
}

/**
 * Push `target` away from `from`.
 * @param {Entity} target @param {Vector3} from @param {number} strength @param {number} lift
 */
export function knockAway(target, from, strength, lift) {
  const d = V.flat(V.sub(target.location, from));
  try {
    target.applyKnockback(d.x, d.z, strength, lift);
  } catch {
    // some entities can't be pushed
  }
}

// ---------------------------------------------------------------- targeting
/** @param {Entity} entity @param {string} family */
export function hasFamily(entity, family) {
  try {
    const comp = /** @type {import("@minecraft/server").EntityTypeFamilyComponent | undefined} */ (
      /** @type {any} */ (entity.getComponent("minecraft:type_family"))
    );
    return !!comp && comp.hasTypeFamily(family);
  } catch {
    return false;
  }
}

/** @param {Entity} entity */
export function isHostile(entity) {
  return entity.typeId === "minecraft:ender_dragon" || hasFamily(entity, "monster");
}

const FRIENDLY_TYPES = new Set([
  "minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader", "minecraft:iron_golem",
  "minecraft:snow_golem", "minecraft:allay", "minecraft:armor_stand",
]);

/** Villagers, golems, pets, players - things spells must never hurt by accident. @param {Entity} entity */
export function isFriendly(entity) {
  if (entity.typeId === "minecraft:player" || FRIENDLY_TYPES.has(entity.typeId)) return true;
  try {
    if (entity.getComponent("minecraft:is_tamed")) return true;
  } catch {
    // ignore
  }
  return false;
}

/** Any living mob (not items, arrows, boats...). @param {Entity} entity */
export function isLiving(entity) {
  return !!health(entity) && entity.typeId !== "minecraft:item" && entity.typeId !== "minecraft:xp_orb";
}

/**
 * Hostile mobs around a point (dedicated query so it stays cheap).
 * @param {Dimension} dim @param {Vector3} location @param {number} radius
 * @returns {Entity[]}
 */
export function hostilesNear(dim, location, radius) {
  /** @type {Entity[]} */
  const out = [];
  const seen = new Set();
  const queries = [{ families: ["monster"] }, { type: "minecraft:ender_dragon" }];
  for (const q of queries) {
    let list = [];
    try {
      list = dim.getEntities({ location, maxDistance: radius, ...q });
    } catch {
      list = [];
    }
    for (const e of list) {
      if (!seen.has(e.id) && alive(e) && !isFriendly(e)) {
        seen.add(e.id);
        out.push(e);
      }
    }
  }
  return out;
}

/**
 * True if a villager, pet, golem or other player is close to a point -
 * used to avoid real lightning bolts that would transform or hurt them.
 * @param {Dimension} dim @param {Vector3} location @param {number} radius @param {Entity} [ignore]
 */
export function bystanderNear(dim, location, radius, ignore) {
  let list = [];
  try {
    list = dim.getEntities({ location, maxDistance: radius, families: ["mob"] });
  } catch {
    list = [];
  }
  for (const e of list) {
    if (ignore && e.id === ignore.id) continue;
    if (!isHostile(e)) return true;
  }
  try {
    for (const p of dim.getPlayers({ location, maxDistance: radius })) {
      if (!ignore || p.id !== ignore.id) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Absolute hit point of a block raycast (handles both relative and
 * absolute faceLocation conventions seen across versions).
 * @param {import("@minecraft/server").BlockRaycastHit} hit
 * @returns {Vector3}
 */
export function hitPoint(hit) {
  const b = hit.block.location;
  const f = hit.faceLocation;
  const rel = f.x >= -0.01 && f.x <= 1.01 && f.y >= -0.01 && f.y <= 1.01 && f.z >= -0.01 && f.z <= 1.01;
  return rel ? { x: b.x + f.x, y: b.y + f.y, z: b.z + f.z } : { x: f.x, y: f.y, z: f.z };
}

/** @type {Record<string, Vector3>} */
export const FACE_NORMAL = {
  Up: { x: 0, y: 1, z: 0 },
  Down: { x: 0, y: -1, z: 0 },
  North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 },
  East: { x: 1, y: 0, z: 0 },
  West: { x: -1, y: 0, z: 0 },
};

/**
 * Camera basis of a player: forward, right and up unit vectors.
 * @param {Player} player
 */
export function viewBasis(player) {
  const f = player.getViewDirection();
  let r = { x: -f.z, y: 0, z: f.x };
  const rl = Math.hypot(r.x, r.z);
  if (rl < 1e-4) {
    const yaw = (player.getRotation().y * Math.PI) / 180;
    r = { x: -Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  } else {
    r = { x: r.x / rl, y: 0, z: r.z / rl };
  }
  return { f, r, u: V.cross(r, f) };
}

/**
 * World position that lines up with the item held in first person
 * (lower right of the screen; negative `right` = off-hand side).
 * Leads by the player's velocity so effects don't trail behind while running.
 * @param {Player} player @param {number} forward @param {number} right @param {number} down
 */
export function handPoint(player, forward = 0.8, right = 0.4, down = 0.3) {
  const { f, r, u } = viewBasis(player);
  const eye = player.getHeadLocation();
  let vel = { x: 0, y: 0, z: 0 };
  try {
    vel = player.getVelocity();
  } catch {
    // ignore
  }
  return {
    x: eye.x + f.x * forward + r.x * right - u.x * down + vel.x * 1.5,
    y: eye.y + f.y * forward + r.y * right - u.y * down + vel.y * 1.5,
    z: eye.z + f.z * forward + r.z * right - u.z * down + vel.z * 1.5,
  };
}
