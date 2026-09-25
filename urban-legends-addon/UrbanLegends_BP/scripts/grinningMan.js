// The Grinning Man: a tall shadow with a glowing, far-too-wide smile.
// He freezes while anyone is looking at him, creeps closer when nobody is,
// teleports behind you when you are far away, and jumpscares you up close.
import * as mc from "@minecraft/server";
import {
  GRINNING_MAN, actionbar, canSee, command, dist, effect, entitiesOfType, every, findStandingSpot,
  isAlive, later, nearestOfTypes, now, on, particle, pick, rand, sound, spotBehind, title, valid,
} from "./util.js";

const { world } = mc;
const ANNOUNCED = "horror:announced";
const OBSERVE_RANGE = 48;
const states = new Map();

const WHISPERS = [
  "§8§o...don't look away...",
  "§8§o...he's smiling at you...",
  "§8§o...it's right behind you...",
  "§8§o...you can't hide from him...",
  "§8§o...turn around...",
];
const HIT_LINES = ["§8§ohe was behind you the whole time", "§8§ofound you", "§8§osmile back"];

function state(man) {
  let s = states.get(man.id);
  if (!s) {
    s = { frozen: undefined, nextBlink: now() + 200, stunnedUntil: 0, lastScare: -1000, lastStare: -1000, lastHurt: -1000 };
    states.set(man.id, s);
  }
  return s;
}

function setFrozen(man, s, frozen) {
  if (s.frozen === frozen) return;
  s.frozen = frozen;
  try {
    man.triggerEvent(frozen ? "horror:freeze" : "horror:unfreeze");
  } catch {}
}

function teleportFacing(man, spot, target) {
  try {
    man.teleport(spot, { dimension: target.dimension, facingLocation: target.getHeadLocation() });
    return true;
  } catch {
    return false;
  }
}

/** Freezes him in place (flashlight / talisman). */
export function stun(man, ticks) {
  const s = state(man);
  s.stunnedUntil = Math.max(s.stunnedUntil, now() + ticks);
  setFrozen(man, s, true);
}

export function jumpscare(player, subtitle) {
  title(player, "§4§l:)", subtitle, 30);
  sound(player, "mob.endermen.scream", 1, 0.5);
  sound(player, "mob.ghast.scream", 0.8, 0.6);
  effect(player, "darkness", 100);
  effect(player, "nausea", 120);
  effect(player, "slowness", 40, 1);
  command(player, "camerashake add @s 0.8 0.6 positional");
}

/** Teleports him somewhere far away that the player cannot see. */
function vanish(man, player) {
  if (!valid(man) || !valid(player)) return;
  for (let i = 0; i < 8; i++) {
    const spot = spotBehind(player, rand(24, 36), 2.5);
    if (!spot || canSee(player, spot)) continue;
    for (let p = 0; p < 6; p++) {
      particle(man.dimension, "minecraft:basic_smoke_particle", {
        x: man.location.x + rand(-0.4, 0.4), y: man.location.y + rand(0.2, 2.8), z: man.location.z + rand(-0.4, 0.4),
      });
    }
    teleportFacing(man, spot, player);
    state(man).nextBlink = now() + 400;
    return;
  }
}

/** Holy Talisman: stun him, then send him far away. */
export function banish(man, player) {
  stun(man, 40);
  later(10, () => vanish(man, player));
}

/** Haunted Mirror: he appears right behind the player. */
export function summonBehind(player) {
  const loc = player.location;
  const spot = spotBehind(player, rand(5, 7))
    ?? findStandingSpot(player.dimension, loc.x + rand(-6, 6), loc.y, loc.z + rand(-6, 6))
    ?? loc;
  try {
    const man = player.dimension.spawnEntity(GRINNING_MAN, spot);
    man.addTag(ANNOUNCED);
    teleportFacing(man, spot, player);
    state(man).nextBlink = now() + 600;
    return man;
  } catch {
    return undefined;
  }
}

function announce(man) {
  man.addTag(ANNOUNCED);
  for (const p of man.dimension.getPlayers({ location: man.location, maxDistance: 64 })) {
    sound(p, "ambient.weather.thunder", 0.7, 0.6);
    sound(p, "mob.warden.emerge", 0.6, 0.8);
    effect(p, "darkness", 80);
    p.sendMessage("§8[§4Urban Legend§8] §7The Grinning Man is here. §8§oHe only moves when nobody is looking...");
  }
}

function blinkBehind(man, players) {
  const target = players.sort((a, b) => dist(a.location, man.location) - dist(b.location, man.location))[0];
  if (!target || dist(target.location, man.location) < 12) return;
  const spot = spotBehind(target, rand(5, 8));
  if (!spot || players.some((p) => canSee(p, spot))) return;
  if (teleportFacing(man, spot, target)) sound(target, "ambient.cave", 0.6, 0.7);
}

function tick(man) {
  if (!man.hasTag(ANNOUNCED)) announce(man);
  const s = state(man);
  const t = now();
  const players = man.dimension.getPlayers({ location: man.location, maxDistance: OBSERVE_RANGE }).filter(isAlive);
  const watcher = players.find((p) => canSee(p, man.location, OBSERVE_RANGE));
  const stunned = t < s.stunnedUntil;
  setFrozen(man, s, stunned || !!watcher);

  if (watcher) {
    const d = dist(watcher.location, man.location);
    if (d < 4 && t - s.lastScare > 200) {
      s.lastScare = t;
      jumpscare(watcher, "§8§oyou turned around");
      if (t - s.lastHurt > 200) later(10, () => vanish(man, watcher));
    } else if (d < 14 && t - s.lastStare > 240) {
      s.lastStare = t;
      sound(watcher, "mob.endermen.stare", 0.7, 0.5);
      effect(watcher, "darkness", 50);
    }
  } else if (!stunned && players.length && t >= s.nextBlink) {
    s.nextBlink = t + Math.floor(rand(300, 700));
    blinkBehind(man, players);
  }
}

function ambience() {
  for (const player of world.getAllPlayers()) {
    if (!isAlive(player)) continue;
    const man = nearestOfTypes(player, [GRINNING_MAN], 48);
    if (!man) continue;
    const d = dist(man.location, player.location);
    if (d < 20) sound(player, "mob.warden.heartbeat", Math.max(0.3, 1.3 - d / 20), 1);
    if (Math.random() < 0.05) actionbar(player, pick(WHISPERS));
    if (Math.random() < 0.04) sound(player, "ambient.cave", 0.8, 0.8);
  }
}

export function initGrinningMan() {
  on(world.afterEvents, "entitySpawn", (event) => {
    const e = event.entity;
    if (valid(e) && e.typeId === GRINNING_MAN && !e.hasTag(ANNOUNCED)) announce(e);
  });

  on(world.afterEvents, "entityHurt", (event) => {
    const hurt = event.hurtEntity;
    const attacker = event.damageSource.damagingEntity;
    if (!valid(hurt) || !valid(attacker)) return;
    if (hurt.typeId === "minecraft:player" && attacker.typeId === GRINNING_MAN) {
      const s = state(attacker);
      if (now() - s.lastScare > 120) {
        s.lastScare = now();
        jumpscare(hurt, pick(HIT_LINES));
      }
    } else if (hurt.typeId === GRINNING_MAN && attacker.typeId === "minecraft:player") {
      const s = state(hurt);
      s.lastHurt = now();
      // Hit him and he may blink behind you...
      if (now() >= s.stunnedUntil && Math.random() < 0.3) {
        later(1, () => {
          if (!valid(hurt) || !isAlive(hurt) || !valid(attacker)) return;
          const spot = spotBehind(attacker, rand(3, 5));
          if (spot && teleportFacing(hurt, spot, attacker)) sound(attacker, "mob.endermen.portal", 0.8, 0.5);
        });
      }
    }
  });

  on(world.afterEvents, "entityDie", (event) => {
    const dead = event.deadEntity;
    if (dead.typeId !== GRINNING_MAN) return;
    states.delete(dead.id);
    for (const p of dead.dimension.getPlayers({ location: dead.location, maxDistance: 48 })) {
      sound(p, "mob.endermen.death", 1, 0.4);
      p.sendMessage("§8The grin fades into the dark... §7§ofor now.");
    }
  });

  every(3, () => {
    const men = entitiesOfType(GRINNING_MAN);
    for (const man of men) {
      try {
        tick(man);
      } catch {}
    }
    if (states.size > men.length + 16) {
      const alive = new Set(men.map((m) => m.id));
      for (const id of states.keys()) if (!alive.has(id)) states.delete(id);
    }
  });
  every(20, ambience);
}
