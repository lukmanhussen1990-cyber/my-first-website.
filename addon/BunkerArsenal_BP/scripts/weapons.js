// Gun handling: hit-scan firing, spread, ammo/magazines, reload, durability, attachments, melee effects.
import { world, system, ItemStack, EntityDamageCause } from "@minecraft/server";
import { WEAPONS, AMMO, ATTACHMENTS } from "./data/weapons_data.js";
import { V, rand, TICK, safeSubscribe, getMainhand, setMainhand, countItem, removeItems, sound, soundTo, particle, actionBar, hudFree, isPlayer, getProp, setProp, log } from "./util.js";

export const WEAPON_IDS = Object.keys(WEAPONS).map((k) => "bunker:" + k);
const PROP_AMMO = "bunker:ammo", PROP_ATTS = "bunker:atts", PROP_UID = "bunker:uid";
const holding = new Map();      // playerId -> { run, typeId }
const reloading = new Map();    // playerId -> { uid, until }
const BIG = { "minecraft:iron_golem": [1.4, 2.7], "minecraft:enderman": [0.6, 2.9], "minecraft:ravager": [1.95, 2.2], "minecraft:spider": [1.4, 0.9],
  "minecraft:cave_spider": [0.7, 0.5], "minecraft:ghast": [4, 4], "minecraft:wither": [0.9, 3.5], "minecraft:ender_dragon": [8, 8], "minecraft:horse": [1.4, 1.6],
  "minecraft:cow": [0.9, 1.4], "minecraft:sheep": [0.9, 1.3], "minecraft:pig": [0.9, 0.9], "minecraft:chicken": [0.4, 0.7], "minecraft:slime": [1, 1],
  "minecraft:warden": [0.9, 2.9], "minecraft:hoglin": [1.4, 1.4], "minecraft:polar_bear": [1.3, 1.4], "minecraft:breeze": [0.6, 1.77], "minecraft:bogged": [0.6, 1.99] };
const IGNORE = ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:snowball", "minecraft:egg", "minecraft:fishing_hook", "minecraft:painting",
  "minecraft:leash_knot", "minecraft:lightning_bolt", "minecraft:area_effect_cloud", "minecraft:evocation_fang", "bunker:grenade", "bunker:stun_charge", "bunker:rocket",
  "minecraft:ender_pearl", "minecraft:small_fireball", "minecraft:fireball", "minecraft:thrown_trident", "minecraft:boat", "minecraft:chest_boat", "minecraft:minecart"];

// ---- weapon state ----------------------------------------------------------------------------------
export function weaponDef(typeId) { return typeId && typeId.startsWith("bunker:") ? WEAPONS[typeId.slice(7)] : undefined; }
export function getAttachments(item) { try { return JSON.parse(getProp(item, PROP_ATTS, "[]")); } catch (_) { return []; } }
export function computeStats(def, atts) {
  const s = { damage: def.damage, range: def.range, spread: def.spread, mag: def.mag, reload: def.reload, fire: def.fire, knock: def.knock, volume: def.volume ?? 1, laser: false };
  for (const a of atts) {
    const att = ATTACHMENTS[a]; if (!att) continue;
    for (const [k, v] of Object.entries(att.mods)) if (k in s) s[k] *= v;
    if (att.laser) s.laser = true;
  }
  s.mag = Math.max(1, Math.round(s.mag)); s.reload = Math.max(5, Math.round(s.reload)); s.fire = Math.max(1, Math.round(s.fire));
  return s;
}
export function weaponInfo(item) {
  if (!item) return undefined;
  const key = item.typeId.slice(7), def = WEAPONS[key];
  if (!def || def.kind !== "gun") return undefined;
  const atts = getAttachments(item), stats = computeStats(def, atts);
  let ammo = getProp(item, PROP_AMMO, undefined);
  if (ammo === undefined) { // fresh weapon (or runtime without item properties): read lore or start full
    const m = (item.getLore() || []).join(" ").match(/Ammo: (\d+)\//); ammo = m ? +m[1] : stats.mag;
  }
  return { key, def, stats, atts, ammo: Math.min(ammo, stats.mag), uid: getProp(item, PROP_UID, 0) };
}
export function writeWeapon(player, item, info) {
  if (!info.uid) { info.uid = Math.floor(Math.random() * 2147483647) || 1; setProp(item, PROP_UID, info.uid); }
  setProp(item, PROP_AMMO, info.ammo); setProp(item, PROP_ATTS, JSON.stringify(info.atts));
  const dur = item.getComponent("minecraft:durability");
  const lore = [`§eAmmo: ${info.ammo}/${info.stats.mag}  §7(${AMMO[info.def.ammo].name})`,
    `§7Dmg §f${fmt(info.stats.damage)}${info.def.pellets > 1 ? "x" + info.def.pellets : ""} §7Range §f${fmt(info.stats.range)} §7Rate §f${(20 / info.stats.fire).toFixed(1)}/s`,
    `§bMods: §f${info.atts.length ? info.atts.map((a) => ATTACHMENTS[a]?.name ?? a).join(", ") : "none"}`];
  if (dur && dur.damage >= dur.maxDurability - 1) lore.push("§cJAMMED - repair with Steel Plate");
  item.setLore(lore);
  return setMainhand(player, item);
}
const fmt = (n) => (Math.round(n * 10) / 10).toString();

// ---- events ---------------------------------------------------------------------------------------
export function initWeapons() {
  safeSubscribe(world.afterEvents.itemStartUse, (ev) => { const p = ev.source; const def = weaponDef(ev.itemStack?.typeId); if (def?.kind === "gun" && def.auto) startAuto(p, ev.itemStack.typeId); }, "itemStartUse");
  safeSubscribe(world.afterEvents.itemStopUse, (ev) => stopAuto(ev.source), "itemStopUse");
  safeSubscribe(world.afterEvents.itemReleaseUse, (ev) => stopAuto(ev.source), "itemReleaseUse");
  safeSubscribe(world.afterEvents.playerLeave, (ev) => { stopAuto({ id: ev.playerId }); reloading.delete(ev.playerId); }, "playerLeave");
  safeSubscribe(world.afterEvents.entityHurt, onHurt, "entityHurt");
  system.runInterval(hudTick, 4);
}
// Called by main.js for every itemUse; returns true if the item was a gun.
export function onItemUse(player, item) {
  const def = weaponDef(item?.typeId);
  if (!def || def.kind !== "gun") return false;
  if (def.auto) { startAuto(player, item.typeId, true); return true; }
  tryFire(player); return true;
}
function startAuto(player, typeId, fireNow = false) {
  const cur = holding.get(player.id);
  if (cur) { if (cur.typeId === typeId) return; stopAuto(player); }
  const def = weaponDef(typeId); const stats = computeStats(def, getAttachments(getMainhand(player) ?? new ItemStack(typeId)));
  const run = system.runInterval(() => { try { if (!tryFire(player)) stopAuto(player); } catch (e) { log("auto " + e); stopAuto(player); } }, stats.fire);
  holding.set(player.id, { run, typeId });
  if (fireNow) tryFire(player);
}
function stopAuto(player) { const cur = holding.get(player.id); if (cur) { system.clearRun(cur.run); holding.delete(player.id); } }

// ---- firing ---------------------------------------------------------------------------------------
function tryFire(player) {
  const item = getMainhand(player); const info = weaponInfo(item);
  if (!info) return false;
  const rl = reloading.get(player.id);
  if (rl && rl.until > TICK()) return true;
  try { if (player.getItemCooldown("bunker_" + info.key) > 0 && !info.def.auto) return true; } catch (_) {}
  const dur = item.getComponent("minecraft:durability");
  if (dur && dur.damage >= dur.maxDurability - 1) { soundTo(player, "bunker.weapon_jam"); actionBar(player, "§cWeapon jammed! Repair it with a Steel Plate (anvil or Armory)."); return false; }
  if (info.ammo <= 0) { soundTo(player, "bunker.empty_click", 0.8, rand(0.9, 1.1)); reloadHeld(player, true); return false; }
  info.ammo -= 1; if (dur) dur.damage = Math.min(dur.maxDurability - 1, dur.damage + 1);
  writeWeapon(player, item, info);
  try { if (!info.def.auto) player.startItemCooldown("bunker_" + info.key, info.stats.fire); } catch (_) {}
  if (info.def.charge) {
    soundTo(player, "bunker.rail_charge", 0.9, 1); const uid = info.uid;
    system.runTimeout(() => { const it = getMainhand(player); const inf = weaponInfo(it); if (inf && inf.uid === uid) fireShots(player, inf); }, info.def.charge);
  } else fireShots(player, info);
  if (info.ammo === 0) system.runTimeout(() => reloadHeld(player, true), 4);
  return true;
}
function fireShots(player, info) {
  const dim = player.dimension, origin = player.getHeadLocation(), dir = V.norm(player.getViewDirection());
  sound("bunker." + info.def.sound, origin, dim, info.stats.volume, rand(0.94, 1.06));
  if (info.def.projectile) return launchProjectile(player, info, origin, dir);
  particle(dim, info.def.tracer === "bullet" ? "minecraft:basic_flame_particle" : "minecraft:endrod", V.add(origin, V.scale(dir, 0.9)));
  const hitSet = new Set(); let anyHit = false;
  for (let p = 0; p < info.def.pellets; p++) {
    const d = spreadDir(dir, info.stats.spread * (info.def.pellets > 1 ? 1 : 1));
    anyHit = castRay(player, info, origin, d, hitSet) || anyHit;
  }
  if (anyHit) soundTo(player, "bunker.hit_marker", 0.6, 1.2);
}
function spreadDir(dir, degrees) {
  if (degrees <= 0) return dir;
  const t = Math.tan((degrees * Math.PI) / 180);
  const up = Math.abs(dir.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const u = V.norm(V.cross(dir, up)), v = V.norm(V.cross(dir, u));
  const r = Math.sqrt(Math.random()) * t, a = Math.random() * Math.PI * 2;
  return V.norm(V.add(dir, V.add(V.scale(u, Math.cos(a) * r), V.scale(v, Math.sin(a) * r))));
}
function castRay(player, info, origin, dir, hitSet) {
  const dim = player.dimension, range = info.stats.range;
  let maxT = range, blockHit;
  try {
    blockHit = dim.getBlockFromRay(origin, dir, { maxDistance: range, includeLiquidBlocks: false, includePassableBlocks: false });
    if (blockHit) { const p = V.add(blockHit.block.location, blockHit.faceLocation ?? { x: 0.5, y: 0.5, z: 0.5 }); maxT = Math.min(range, V.dist(origin, p)); }
  } catch (_) { maxT = stepRay(dim, origin, dir, range); }
  const hits = [];
  let candidates = [];
  try { candidates = dim.getEntities({ location: origin, maxDistance: maxT + 3, excludeTypes: IGNORE }); }
  catch (_) { try { candidates = dim.getEntities({ location: origin, maxDistance: maxT + 3 }); } catch (_) {} }
  for (const e of candidates) {
    if (e.id === player.id || IGNORE.includes(e.typeId)) continue;
    let loc; try { loc = e.location; } catch (_) { continue; }
    const [w, h] = BIG[e.typeId] ?? [0.6, 1.9];
    const c = { x: loc.x, y: loc.y + h / 2, z: loc.z };
    const t = V.dot(V.sub(c, origin), dir);
    if (t < 0.3 || t > maxT) continue;
    const p = V.add(origin, V.scale(dir, t));
    const dx = p.x - c.x, dz = p.z - c.z, dy = Math.abs(p.y - c.y);
    if (Math.sqrt(dx * dx + dz * dz) <= w / 2 + 0.25 && dy <= h / 2 + 0.2) hits.push({ e, t });
  }
  hits.sort((a, b) => a.t - b.t);
  let hitAny = false, n = 0;
  for (const { e, t } of hits) {
    if (n > info.def.pierce) break;
    if (hitSet.has(e.id) && info.def.pellets === 1) continue;
    hitSet.add(e.id); n++; hitAny = true;
    let dmg = info.stats.damage; if (t > range * 0.6) dmg *= 0.7;
    dmg = Math.max(1, Math.round(dmg));
    try { e.applyDamage(dmg, { cause: EntityDamageCause.projectile, damagingEntity: player }); } catch (_) { try { e.applyDamage(dmg); } catch (_) {} }
    try { if (info.stats.knock > 0) e.applyKnockback(dir.x, dir.z, info.stats.knock, info.stats.knock * 0.25); } catch (_) {}
    if (info.def.fireSeconds) { try { e.setOnFire(info.def.fireSeconds, true); } catch (_) {} }
    particle(dim, "minecraft:critical_hit_emitter", V.add(origin, V.scale(dir, t)));
    if (info.def.pierce === 0) { maxT = t; break; }
  }
  tracer(dim, origin, dir, maxT, info.def.tracer);
  if (blockHit && (!hitAny || info.def.pierce > 0)) {
    particle(dim, info.def.tracer === "bullet" ? "minecraft:basic_smoke_particle" : "minecraft:endrod", V.add(origin, V.scale(dir, Math.max(0.5, maxT - 0.2))));
  }
  return hitAny;
}
function stepRay(dim, origin, dir, range) {
  for (let t = 1; t <= range; t += 1) {
    const p = V.add(origin, V.scale(dir, t));
    try { const b = dim.getBlock(p); if (b && !b.isAir && !b.isLiquid) return t; } catch (_) { return t; }
  }
  return range;
}
function tracer(dim, origin, dir, maxT, kind) {
  const id = kind === "bullet" ? "minecraft:basic_crit_particle" : kind === "plasma" ? "minecraft:mobflame_single" : "minecraft:endrod";
  const step = kind === "rail" ? 1.5 : 3, cap = kind === "rail" ? 24 : 8;
  let n = 0;
  for (let t = 2; t < maxT && n < cap; t += step, n++) particle(dim, id, V.add(origin, V.scale(dir, t)));
}
function launchProjectile(player, info, origin, dir) {
  try {
    const start = V.add(origin, V.scale(dir, 1.2)); const rocket = player.dimension.spawnEntity(info.def.projectile, start);
    let shot = false;
    try { const pc = rocket.getComponent("minecraft:projectile"); if (pc) { try { pc.owner = player; } catch (_) {} pc.shoot(V.scale(dir, 2.6)); shot = true; } } catch (_) {}
    if (!shot) rocket.applyImpulse(V.scale(dir, 2.0));
    particle(player.dimension, "minecraft:large_explosion", start);
  } catch (e) { log("rocket " + e); }
}

// ---- reload ---------------------------------------------------------------------------------------
export function reloadHeld(player, auto = false) {
  const item = getMainhand(player); const info = weaponInfo(item);
  if (!info) { if (!auto) actionBar(player, "§7Hold a weapon to reload."); return false; }
  const rl = reloading.get(player.id); if (rl && rl.until > TICK()) return false;
  if (info.ammo >= info.stats.mag) { if (!auto) actionBar(player, "§7Magazine already full."); return false; }
  const magId = "bunker:" + info.def.ammo;
  if (countItem(player, magId) <= 0) { actionBar(player, `§cNo ${AMMO[info.def.ammo].name} left!`); if (!auto) soundTo(player, "bunker.empty_click"); return false; }
  if (!info.uid) writeWeapon(player, item, info);
  removeItems(player, magId, 1);
  stopAuto(player);
  const ticks = info.stats.reload;
  reloading.set(player.id, { uid: info.uid, until: TICK() + ticks });
  try { player.startItemCooldown("bunker_" + info.key, ticks); } catch (_) {}
  soundTo(player, "bunker.reload", 0.8, Math.max(0.6, Math.min(1.4, 40 / ticks)));
  actionBar(player, `§eReloading ${info.def.name}...`, ticks);
  system.runTimeout(() => {
    reloading.delete(player.id);
    const it = getMainhand(player); const inf = weaponInfo(it);
    if (inf && inf.uid === info.uid) { inf.ammo = inf.stats.mag; writeWeapon(player, it, inf); actionBar(player, `§a${inf.def.name} ready  §f${inf.ammo}/${inf.stats.mag}`, 20); }
    else actionBar(player, "§cReload interrupted - magazine lost.", 30);
  }, ticks);
  return true;
}
export function setAttachments(player, item, atts) {
  const info = weaponInfo(item); if (!info) return false;
  info.atts = atts; const stats = computeStats(info.def, atts); info.stats = stats; info.ammo = Math.min(info.ammo, stats.mag);
  return writeWeapon(player, item, info);
}
export function repairHeld(player) {
  const item = getMainhand(player); if (!item) return "§7Hold a weapon to repair.";
  const dur = item.getComponent("minecraft:durability"); if (!dur) return "§7This item cannot be repaired here.";
  if (dur.damage === 0) return "§7Weapon is in perfect condition.";
  if (countItem(player, "bunker:steel_plate") <= 0) return "§cYou need a Steel Plate.";
  removeItems(player, "bunker:steel_plate", 1); dur.damage = Math.max(0, dur.damage - Math.max(100, Math.floor(dur.maxDurability / 3)));
  const info = weaponInfo(item); if (info) writeWeapon(player, item, info); else setMainhand(player, item);
  soundTo(player, "bunker.reload", 1, 0.7);
  return `§aRepaired. Condition ${Math.round(((dur.maxDurability - dur.damage) / dur.maxDurability) * 100)}%`;
}

// ---- melee effects + HUD ---------------------------------------------------------------------------
function onHurt(ev) {
  const src = ev.damageSource; if (!src || src.cause !== EntityDamageCause.entityAttack) return;
  const attacker = src.damagingEntity; if (!attacker || !isPlayer(attacker)) return;
  const held = getMainhand(attacker); if (held?.typeId !== "bunker:stun_baton") return;
  const t = ev.hurtEntity;
  try { t.addEffect("slowness", 80, { amplifier: 2, showParticles: true }); t.addEffect("weakness", 80, { amplifier: 1, showParticles: false }); } catch (_) {
    try { t.runCommandAsync("effect @s slowness 4 2 true"); } catch (_) {}
  }
  particle(t.dimension, "minecraft:endrod", t.getHeadLocation ? t.getHeadLocation() : t.location);
  sound("bunker.stun_pop", t.location, t.dimension, 0.5, 1.6);
}
function hudTick() {
  for (const player of world.getAllPlayers()) {
    const item = getMainhand(player); const info = weaponInfo(item);
    if (!info) continue;
    if (info.stats.laser) laserDot(player, info);
    if (!hudFree(player)) continue;
    const rl = reloading.get(player.id);
    const reserve = countItem(player, "bunker:" + info.def.ammo);
    const txt = rl && rl.until > TICK() ? `§e${info.def.name} §8| §eRELOADING` : `§6${info.def.name} §8| §f${info.ammo}§7/${info.stats.mag} §8| §b${AMMO[info.def.ammo].name}: ${reserve}`;
    try { player.onScreenDisplay.setActionBar(txt); } catch (_) {}
  }
}
function laserDot(player, info) {
  try {
    const o = player.getHeadLocation(), d = player.getViewDirection();
    const hit = player.dimension.getBlockFromRay(o, d, { maxDistance: Math.min(48, info.stats.range), includePassableBlocks: false });
    if (hit) particle(player.dimension, "minecraft:redstone_torch_dust_particle", V.add(V.add(hit.block.location, hit.faceLocation ?? { x: 0.5, y: 0.5, z: 0.5 }), V.scale(d, -0.05)));
  } catch (_) {}
}
