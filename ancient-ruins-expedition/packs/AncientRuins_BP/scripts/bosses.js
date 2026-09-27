import { EntityDamageCause, system, world } from "@minecraft/server";
import { BLOCK, BOSS_TO_TYPE, PARTICLE, PROP, RUIN_TYPES, THEME_TO_TYPE, TUNING } from "./config.js";
import { getRuin, markDirty, nearestRuin, registerRuin, ruinByBoss } from "./registry.js";
import { blockAt, isBlock, isCreativeLike, notify, particle, playNear, setBlock, tellNear, warn } from "./util.js";

/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./registry.js").Ruin} Ruin */
/** @typedef {typeof RUIN_TYPES[keyof typeof RUIN_TYPES]} RuinInfo */

/** @param {string} type */
function infoOf(type) {
  return RUIN_TYPES[/** @type {keyof typeof RUIN_TYPES} */ (type)];
}

/**
 * Spawn the ruin's boss on top of its altar (puzzle solved).
 * @param {Block} altar
 * @param {string} theme
 * @param {Player} player
 */
export function awakenBoss(altar, theme, player) {
  const type = THEME_TO_TYPE[/** @type {keyof typeof THEME_TO_TYPE} */ (theme)];
  const info = infoOf(type);
  const dim = altar.dimension;
  const loc = altar.location;
  const { ruin } = registerRuin(type, dim.id, { x: loc.x, y: loc.y - 1, z: loc.z }, true);
  const pos = { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 };
  let boss;
  try {
    setBlock(altar, BLOCK.dormantAltar);
    boss = dim.spawnEntity(info.boss, pos);
  } catch (e) {
    warn("awakenBoss", e);
    try {
      setBlock(altar, info.altar);
    } catch {
      // ignore
    }
    return;
  }
  ruin.a = 1;
  ruin.p = 1;
  ruin.b = boss.id;
  markDirty();
  try {
    boss.setDynamicProperty(PROP.bossRuin, ruin.id);
  } catch {
    // ignore
  }
  for (const p of dim.getPlayers({ location: pos, maxDistance: 40 })) {
    try {
      p.onScreenDisplay.setTitle(`${info.color}§l${info.bossName}`, {
        subtitle: "§7has awakened!",
        fadeInDuration: 10,
        stayDuration: 50,
        fadeOutDuration: 15,
      });
    } catch {
      // ignore
    }
  }
  playNear(dim, "mob.wither.spawn", pos, 48, 0.5, 1.2);
  particle(dim, PARTICLE.shockwave, pos, info.rgb);
  player.sendMessage(`${info.color}${info.bossName}§7 guards the vault beneath the altar. Defeat it to open the vault!`);
}

/**
 * Boss timer fired (data driven "special_attack"): telegraph, then strike.
 * @param {Entity} boss
 */
export function onBossSpecial(boss) {
  let dim;
  let loc;
  try {
    dim = boss.dimension;
    loc = boss.location;
  } catch {
    return;
  }
  const type = BOSS_TO_TYPE[/** @type {keyof typeof BOSS_TO_TYPE} */ (boss.typeId)];
  const info = infoOf(type);
  const targets = dim.getPlayers({ location: loc, maxDistance: TUNING.bossSpecialRange }).filter((p) => !isCreativeLike(p));
  if (!targets.length) {
    endCast(boss);
    return;
  }
  try {
    boss.addEffect("slowness", 25, { amplifier: 4, showParticles: false });
  } catch {
    // ignore
  }
  particle(dim, PARTICLE.spark, { x: loc.x, y: loc.y + 2.2, z: loc.z }, info.rgb);
  playNear(dim, type === "sunken_ship" ? "mob.elderguardian.curse" : "mob.evocation_illager.cast_spell", loc, 24, 0.9, 0.7);
  system.runTimeout(() => {
    try {
      if (!boss.isValid()) return;
      if (type === "jungle_temple") seismicSlam(boss, info);
      else if (type === "desert_crypt") curseOfSands(boss, info);
      else tidalPull(boss, info);
    } catch (e) {
      warn("special", e);
    } finally {
      endCast(boss);
    }
  }, 20);
}

/** @param {Entity} boss */
function endCast(boss) {
  try {
    if (boss.isValid()) boss.triggerEvent("ancient_ruins:cast_done");
  } catch {
    // ignore
  }
}

/**
 * Jade Idol: ground slam that damages and launches nearby players.
 * @param {Entity} boss
 * @param {RuinInfo} info
 */
function seismicSlam(boss, info) {
  const dim = boss.dimension;
  const loc = boss.location;
  particle(dim, PARTICLE.shockwave, { x: loc.x, y: loc.y + 0.2, z: loc.z }, info.rgb);
  playNear(dim, "mob.ravager.roar", loc, 32, 1, 0.8);
  playNear(dim, "random.explode", loc, 24, 0.4, 0.6);
  for (const p of dim.getPlayers({ location: loc, maxDistance: 6 })) {
    if (isCreativeLike(p)) continue;
    const dx = p.location.x - loc.x;
    const dz = p.location.z - loc.z;
    const len = Math.max(0.1, Math.hypot(dx, dz));
    p.applyDamage(Math.max(3, 7 - len * 0.6), { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
    p.applyKnockback(dx / len, dz / len, 1.4, 0.55);
    p.addEffect("slowness", 40, { amplifier: 1, showParticles: false });
  }
}

/**
 * Sand Pharaoh: raise mummies and blind nearby players with a sandstorm.
 * @param {Entity} boss
 * @param {RuinInfo} info
 */
function curseOfSands(boss, info) {
  const dim = boss.dimension;
  const loc = boss.location;
  playNear(dim, "mob.evocation_illager.prepare_summon", loc, 32, 1, 0.8);
  const existing = dim.getEntities({ type: info.guardian, location: loc, maxDistance: 16 }).length;
  let toSpawn = Math.min(2, TUNING.pharaohMummyCap - existing);
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
    if (toSpawn <= 0) break;
    const pos = { x: loc.x + dx, y: loc.y, z: loc.z + dz };
    const b = blockAt(dim, pos);
    const head = blockAt(dim, { x: pos.x, y: pos.y + 1, z: pos.z });
    if (!b || !head || !(b.isAir || b.isLiquid) || !(head.isAir || head.isLiquid)) continue;
    try {
      dim.spawnEntity(info.guardian, pos);
      particle(dim, PARTICLE.dust, pos, info.rgb);
      toSpawn--;
    } catch {
      // ignore
    }
  }
  for (const p of dim.getPlayers({ location: loc, maxDistance: 10 })) {
    if (isCreativeLike(p)) continue;
    p.addEffect("blindness", 60, { amplifier: 0, showParticles: false });
    notify(p, "§6A choking sandstorm swirls around the Pharaoh!");
  }
}

/**
 * Abyssal Admiral: an undertow that drags players in and slows them.
 * @param {Entity} boss
 * @param {RuinInfo} info
 */
function tidalPull(boss, info) {
  const dim = boss.dimension;
  const loc = boss.location;
  particle(dim, PARTICLE.shockwave, { x: loc.x, y: loc.y + 0.5, z: loc.z }, info.rgb);
  playNear(dim, "item.trident.riptide_1", loc, 32, 1, 0.7);
  for (const p of dim.getPlayers({ location: loc, maxDistance: 10 })) {
    if (isCreativeLike(p)) continue;
    const dx = loc.x - p.location.x;
    const dz = loc.z - p.location.z;
    const len = Math.hypot(dx, dz);
    if (len > 1.5) p.applyKnockback(dx / len, dz / len, Math.min(1.6, 0.25 * len), 0.15);
    p.applyDamage(3, { cause: EntityDamageCause.magic, damagingEntity: boss });
    p.addEffect("slowness", 50, { amplifier: 1, showParticles: false });
    notify(p, "§3The Admiral's undertow drags you in!");
  }
}

/**
 * Enrage at half health (one time) - faster and more frequent specials.
 * @param {Entity} boss
 */
export function onBossHurt(boss) {
  try {
    if (boss.getDynamicProperty(PROP.enraged)) return;
    const health = /** @type {import("@minecraft/server").EntityHealthComponent | undefined} */ (
      boss.getComponent("minecraft:health"));
    if (!health || health.currentValue > health.effectiveMax / 2) return;
    boss.setDynamicProperty(PROP.enraged, true);
    boss.triggerEvent("ancient_ruins:enrage");
    const info = infoOf(BOSS_TO_TYPE[/** @type {keyof typeof BOSS_TO_TYPE} */ (boss.typeId)]);
    tellNear(boss.dimension, boss.location, 40, `${info.color}${info.bossName}§c is enraged!`);
    particle(boss.dimension, PARTICLE.shockwave, boss.location, { red: 1, green: 0.2, blue: 0.2 });
  } catch (e) {
    warn("enrage", e);
  }
}

/**
 * Boss defeated: mark the ruin conquered and open its vault.
 * @param {Entity} boss
 */
export function onBossDeath(boss) {
  const id = boss.id;
  let ruin = ruinByBoss(id);
  let dimId = "minecraft:overworld";
  let loc;
  try {
    dimId = boss.dimension.id;
    loc = boss.location;
  } catch {
    // entity data may be gone already
  }
  if (!ruin) {
    try {
      const rid = boss.getDynamicProperty(PROP.bossRuin);
      if (typeof rid === "number") ruin = getRuin(rid);
    } catch {
      // ignore
    }
  }
  if (!ruin && loc) ruin = nearestRuin(dimId, loc, (r) => r.a === 1 && !r.c, 48);
  if (!ruin) return;
  ruin.c = 1;
  markDirty();
  const info = infoOf(ruin.t);
  const dim = world.getDimension(ruin.d);
  tellNear(dim, { x: ruin.x, y: ruin.y, z: ruin.z }, 64, `§6${info.bossName} has fallen! §7The vault beneath the altar is open.`);
  openVault(ruin);
}

/**
 * Remove the 3x3 vault hatch (and the altar on it). Water for flooded ruins.
 * @param {Ruin} ruin
 */
export function openVault(ruin) {
  if (ruin.v) return;
  let dim;
  try {
    dim = world.getDimension(ruin.d);
  } catch {
    return;
  }
  const info = infoOf(ruin.t);
  const centre = blockAt(dim, { x: ruin.x, y: ruin.y, z: ruin.z });
  if (!centre) return; // unloaded: proximityTick retries when a player is near
  const fill = info && info.flooded ? "minecraft:water" : "minecraft:air";
  const openable = [BLOCK.vaultSeal, BLOCK.commandBlock, BLOCK.dormantAltar, info ? info.altar : BLOCK.dormantAltar];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = 0; dy <= 1; dy++) {
        if (dy === 1 && (dx || dz)) continue; // only the altar above the centre
        const b = blockAt(dim, { x: ruin.x + dx, y: ruin.y + dy, z: ruin.z + dz });
        if (!b || !openable.some((id) => isBlock(b, id))) continue;
        try {
          setBlock(b, fill);
        } catch (e) {
          warn("openVault", e);
        }
      }
    }
  }
  ruin.v = 1;
  markDirty();
  const top = { x: ruin.x + 0.5, y: ruin.y + 1, z: ruin.z + 0.5 };
  particle(dim, PARTICLE.dust, top, info ? info.rgb : undefined);
  playNear(dim, "vault.open_shutter", top, 32, 1, 0.8);
  playNear(dim, "random.levelup", top, 32, 0.6, 0.8);
}
