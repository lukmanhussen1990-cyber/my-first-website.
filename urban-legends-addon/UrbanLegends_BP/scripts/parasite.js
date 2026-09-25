// The Parasite: the moment it is spawned (spawn egg, spawner, dispenser...) it leaps
// into the nearest player and kills them instantly - even in Creative mode.
import * as mc from "@minecraft/server";
import {
  PARASITE, command, damage, effect, entitiesOfType, every, isAlive, later, nearestPlayer,
  on, particle, sound, title, valid,
} from "./util.js";

const { world } = mc;
const FED_TAG = "horror:fed";
const KILL_RANGE = 16;
const latching = new Set();

export function initParasite() {
  on(world.afterEvents, "entitySpawn", (event) => {
    if (valid(event.entity) && event.entity.typeId === PARASITE) tryLatch(event.entity);
  });
  // Backup scan: also catches parasites that spawned with nobody nearby and are lying in wait.
  every(5, () => {
    for (const parasite of entitiesOfType(PARASITE)) tryLatch(parasite);
  });
}

function tryLatch(parasite) {
  if (!valid(parasite) || latching.has(parasite.id) || parasite.hasTag(FED_TAG)) return;
  const victim = nearestPlayer(parasite.dimension, parasite.location, KILL_RANGE);
  if (!victim) return;
  const id = parasite.id;
  latching.add(id);
  parasite.addTag(FED_TAG);

  const head = victim.getHeadLocation();
  try {
    parasite.teleport(head, { dimension: victim.dimension });
  } catch {}
  title(victim, "§4§lIT'S INSIDE YOU", "§7§othe parasite burrowed into your skull", 60);
  sound(victim, "mob.silverfish.kill", 1, 0.5);
  sound(victim, "mob.warden.heartbeat", 1, 1.6);
  sound(victim, "mob.endermen.scream", 0.8, 0.5);
  effect(victim, "blindness", 60);
  effect(victim, "nausea", 100);
  command(victim, "camerashake add @s 1.5 0.5 positional");
  for (let i = 0; i < 6; i++) {
    particle(victim.dimension, "minecraft:redstone_ore_dust_particle", {
      x: head.x + (Math.random() - 0.5) * 0.8,
      y: head.y + (Math.random() - 0.5) * 0.6,
      z: head.z + (Math.random() - 0.5) * 0.8,
    });
  }

  // A few ticks later (so the jumpscare is visible) it eats you from the inside.
  later(6, () => {
    latching.delete(id);
    const name = valid(victim) ? victim.name : "Someone";
    if (valid(victim)) killPlayer(victim, parasite);
    if (valid(parasite)) {
      particle(parasite.dimension, "minecraft:silverfish_grief_emitter", parasite.location);
      try {
        parasite.remove();
      } catch {}
    }
    world.sendMessage(`§4[!] §c${name} §7was devoured from the inside by a §4Parasite§7.`);
  });
}

function killPlayer(player, parasite) {
  // Survival: lethal damage credited to the parasite. Creative / totems / armor: force it.
  if (isAlive(player)) damage(player, 100000, parasite);
  if (isAlive(player)) {
    try {
      player.kill();
    } catch {}
  }
  later(2, () => {
    if (valid(player) && isAlive(player)) command(player, "kill @s");
  });
}
