// Horror gear found in the creative inventory (Equipment tab) or crafted in survival.
import * as mc from "@minecraft/server";
import {
  GRINNING_MAN, PARASITE, actionbar, add, blocksView, damage, dist, dot, effect, every, getBlock,
  getHeldItem, isAlive, length, nearestOfTypes, now, on, particle, rand, scale, sound, soundAround,
  sub, title, useCooldown, valid,
} from "./util.js";
import { banish, stun, summonBehind } from "./grinningMan.js";

const { world } = mc;
const FLASHLIGHT = "horror:flashlight";
const EMF = "horror:emf_reader";
const TALISMAN = "horror:holy_talisman";
const SCYTHE = "horror:soul_scythe";
const MIRROR = "horror:haunted_mirror";
const HORRORS = [GRINNING_MAN, PARASITE];

// ---------- Flashlight: night vision while held, tap to fire a burning beam ----------
function useFlashlight(player) {
  if (useCooldown(player, "flashlight", 30)) return;
  const dim = player.dimension;
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  sound(player, "random.click", 1, 1.6);

  let reach = 24;
  for (let t = 1; t <= 24; t++) {
    const p = add(eye, scale(dir, t));
    if (blocksView(getBlock(dim, p))) {
      reach = t;
      break;
    }
    if (t % 2 === 0) particle(dim, "minecraft:endrod", p);
  }
  for (const type of HORRORS) {
    for (const e of dim.getEntities({ type, location: eye, maxDistance: reach + 2 })) {
      const centre = { x: e.location.x, y: e.location.y + (type === GRINNING_MAN ? 1.5 : 0.2), z: e.location.z };
      const along = dot(sub(centre, eye), dir);
      if (along < 0 || along > reach + 1) continue;
      if (dist(add(eye, scale(dir, along)), centre) > (type === GRINNING_MAN ? 1.6 : 1.0)) continue;
      soundAround(dim, centre, "random.fizz", 16, 1, 0.6);
      particle(dim, "minecraft:basic_smoke_particle", centre);
      if (type === PARASITE) {
        damage(e, 100, player, "magic"); // parasites burn up in the light
      } else {
        damage(e, 8, player, "magic");
        stun(e, 60);
        actionbar(player, "§eThe light burns him! §7He can't move for a moment.");
      }
    }
  }
}

// ---------- EMF Ghost Reader: beeps faster the closer a horror is ----------
const emfTimers = new Map();

function emfPassive(player) {
  const target = nearestOfTypes(player, HORRORS, 96);
  if (!target) {
    actionbar(player, "§7EMF §8[||||||||||] §7no signal...");
    return;
  }
  const d = dist(target.location, player.location);
  const bars = Math.max(1, Math.min(10, Math.round((1 - d / 96) * 10)));
  const colour = bars >= 8 ? "§4" : bars >= 5 ? "§6" : "§a";
  const warn = bars >= 8 ? " §4§lDANGER" : "";
  actionbar(player, `§7EMF §8[${colour}${"|".repeat(bars)}§8${"|".repeat(10 - bars)}] §f${Math.round(d)}m${warn}`);
  const interval = d < 8 ? 1 : d < 16 ? 2 : d < 32 ? 4 : 6; // in half-second steps
  const n = (emfTimers.get(player.id) ?? 0) + 1;
  emfTimers.set(player.id, n);
  if (n % interval === 0) sound(player, "note.bit", 0.7, 0.6 + bars * 0.12);
}

function useEmf(player) {
  if (useCooldown(player, "emf", 20)) return;
  const target = nearestOfTypes(player, HORRORS, 96);
  sound(player, "note.pling", 1, 0.7);
  if (!target) {
    player.sendMessage("§a[EMF] §7Scan complete. Nothing paranormal within 96 blocks... §8§ofor now.");
    return;
  }
  const to = sub(target.location, player.location);
  const view = player.getViewDirection();
  const hv = Math.sqrt(view.x * view.x + view.z * view.z) || 1;
  const ht = Math.sqrt(to.x * to.x + to.z * to.z) || 1;
  const cos = (view.x * to.x + view.z * to.z) / (hv * ht);
  const cross = (view.x * to.z - view.z * to.x) / (hv * ht);
  const angle = (Math.atan2(cross, cos) * 180) / Math.PI;
  const where = Math.abs(angle) < 35 ? "§fstraight ahead" : Math.abs(angle) > 145 ? "§4§lBEHIND YOU"
    : angle > 0 ? "§fto your right" : "§fto your left";
  const what = target.typeId === GRINNING_MAN ? "§4The Grinning Man" : "§cA Parasite";
  player.sendMessage(`§a[EMF] ${what} §7is §f${Math.round(length(to))} blocks §7away, ${where}§7.`);
  const step = scale(to, 1 / (length(to) || 1));
  const eye = player.getHeadLocation();
  for (let t = 1; t <= 6; t++) particle(player.dimension, "minecraft:electric_spark_particle", add(eye, scale(step, t)));
}

// ---------- Holy Talisman: holy shockwave, banishes The Grinning Man ----------
function useTalisman(player) {
  const left = useCooldown(player, "talisman", 400);
  if (left) {
    actionbar(player, `§7The talisman is recharging... §f${Math.ceil(left / 20)}s`);
    return;
  }
  const dim = player.dimension;
  const loc = player.location;
  soundAround(dim, loc, "random.totem", 24, 0.8, 1.2);
  soundAround(dim, loc, "beacon.activate", 24, 1, 1.5);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    particle(dim, "minecraft:totem_particle", { x: loc.x + Math.cos(a) * 2.5, y: loc.y + 1, z: loc.z + Math.sin(a) * 2.5 });
  }
  const hit = new Set();
  for (const family of ["horror", "monster"]) {
    for (const e of dim.getEntities({ location: loc, maxDistance: 10, families: [family] })) {
      if (hit.has(e.id)) continue;
      hit.add(e.id);
      if (e.typeId === GRINNING_MAN) {
        damage(e, 12, player, "magic");
        banish(e, player);
        continue;
      }
      const d = sub(e.location, loc);
      const h = Math.sqrt(d.x * d.x + d.z * d.z) || 1;
      try {
        e.applyKnockback(d.x / h, d.z / h, 2.5, 0.5);
      } catch {}
      damage(e, e.typeId === PARASITE ? 100 : 6, player, "magic");
    }
  }
  effect(player, "regeneration", 100, 1);
  effect(player, "resistance", 200, 0);
  actionbar(player, "§eThe talisman flares with holy light!");
}

// ---------- Haunted Mirror: use it 3 times to summon The Grinning Man ----------
const mirrorCount = new Map();

function useMirror(player) {
  if (useCooldown(player, "mirror_tap", 10)) return;
  const quiet = useCooldown(player, "mirror_summon", 0);
  if (quiet) {
    actionbar(player, `§8The mirror is silent... §7(${Math.ceil(quiet / 20)}s)`);
    return;
  }
  const t = now();
  const s = mirrorCount.get(player.id) ?? { n: 0, last: 0 };
  if (t - s.last > 300) s.n = 0;
  s.n++;
  s.last = t;
  mirrorCount.set(player.id, s);
  if (s.n === 1) {
    actionbar(player, "§7§oYou whisper into the mirror: §f\"Grinning Man...\" §8(1/3)");
    sound(player, "ambient.cave", 1, 0.5);
  } else if (s.n === 2) {
    actionbar(player, "§7§oThe glass fogs up. Something smiles back... §8(2/3)");
    sound(player, "mob.endermen.stare", 0.8, 0.6);
    effect(player, "darkness", 60);
  } else {
    s.n = 0;
    useCooldown(player, "mirror_summon", 1200);
    sound(player, "random.glass", 1, 0.6);
    sound(player, "ambient.weather.thunder", 0.8, 0.5);
    effect(player, "darkness", 120);
    title(player, "§4§lHE HEARD YOU", "§8§odon't turn around...", 50);
    summonBehind(player);
  }
}

function handleUse(player, item) {
  if (!valid(player) || player.typeId !== "minecraft:player" || !item) return;
  if (useCooldown(player, "any_use", 4)) return; // itemUse + itemUseOn can both fire for one tap
  switch (item.typeId) {
    case FLASHLIGHT: return useFlashlight(player);
    case EMF: return useEmf(player);
    case TALISMAN: return useTalisman(player);
    case MIRROR: return useMirror(player);
  }
}

// ---------- Soul Scythe: heals you on every hit, extra damage to horrors ----------
function onHit(attacker, target) {
  if (!valid(attacker) || attacker.typeId !== "minecraft:player" || !valid(target)) return;
  if (getHeldItem(attacker)?.typeId !== SCYTHE) return;
  heal(attacker, 2);
  particle(target.dimension, "minecraft:sculk_soul_particle", add(target.location, { x: 0, y: 1, z: 0 }));
  sound(attacker, "mob.vex.hurt", 0.6, 0.6);
  if (target.typeId === GRINNING_MAN || target.typeId === PARASITE) {
    // Bonus damage straight to health: applyDamage would be eaten by the hit's immunity frames.
    try {
      const hp = target.getComponent("minecraft:health");
      if (hp.currentValue > 6) hp.setCurrentValue(hp.currentValue - 6);
    } catch {}
  }
}

function heal(entity, amount) {
  try {
    const hp = entity.getComponent("minecraft:health");
    hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + amount));
  } catch {}
}

export function initItems() {
  on(world.afterEvents, "itemUse", (e) => handleUse(e.source, e.itemStack));
  on(world.afterEvents, "itemUseOn", (e) => handleUse(e.source, e.itemStack));
  on(world.afterEvents, "entityHitEntity", (e) => onHit(e.damagingEntity, e.hitEntity));
  on(world.afterEvents, "entityDie", (e) => {
    const killer = e.damageSource.damagingEntity;
    if (!valid(killer) || killer.typeId !== "minecraft:player" || !isAlive(killer)) return;
    if (getHeldItem(killer)?.typeId !== SCYTHE) return;
    heal(killer, 4);
    effect(killer, "strength", 100, 0);
    actionbar(killer, "§bThe scythe drinks a soul. §7(+2 hearts, Strength)");
  });
  every(10, () => {
    for (const player of world.getAllPlayers()) {
      const held = getHeldItem(player)?.typeId;
      if (held === FLASHLIGHT) effect(player, "night_vision", 260);
      else if (held === EMF) emfPassive(player);
    }
  });
}
