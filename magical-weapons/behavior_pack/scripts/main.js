// Magical Weapons - entry point.
// Tap/use a weapon to cast its spell (the resource pack plays the cast animation while the
// item's cooldown runs); melee hits trigger each weapon's passive.
import { system, world } from '@minecraft/server';
import { WEAPONS } from './abilities.js';
import {
  actionBar, add, aim, flat, head, heldItem, later, mul, rand, rightOf, safe, sfx, valid, wear,
} from './util.js';

const lastUse = new Map();    // player id -> tick of the last cast (debounces double taps)
const lastHeld = new Map();   // player id -> type id of the held item (for the equip hint)

// ---------------------------------------------------------------- casting
// Tapping the air fires itemUse; tapping while a block is under the crosshair (e.g. the ground) fires
// itemUseOn instead - on a touch screen that is the common case, so listen to both. The cooldown and a
// short debounce make sure a single tap never casts twice.
world.afterEvents.itemUse.subscribe((ev) => safe(() => onUse(ev), 'itemUse'));
world.afterEvents.itemUseOn.subscribe((ev) => safe(() => onUse(ev), 'itemUseOn'));

function onUse(ev) {
  const player = ev.source;
  const stack = ev.itemStack;
  const w = stack ? WEAPONS[stack.typeId] : undefined;
  if (!w || !valid(player)) return;

  const now = system.currentTick;
  if (now - (lastUse.get(player.id) ?? -100) < 6) return;
  const cd = stack.getComponent('minecraft:cooldown');
  if (cd && cd.getCooldownTicksRemaining(player) > 0) return;
  lastUse.set(player.id, now);

  const typeId = stack.typeId;
  const total = cd ? cd.cooldownTicks : 100;
  // The attachable reads this cooldown as the clock for the cast animation.
  if (cd) cd.startCooldown(player);
  actionBar(player, `${w.color}✦ ${w.name}`);
  safe(() => (w.begin ? w.begin(player) : undefined), 'begin ' + typeId);

  later(() => {
    if (!valid(player)) return;
    safe(() => w.fire(player), 'fire ' + typeId);
    wear(player, typeId, w.wear);
  }, w.delay);

  later(() => {
    const held = heldItem(player);
    if (valid(player) && held && held.typeId === typeId) {
      actionBar(player, `${w.color}${w.name} §aready`);
      sfx(player.dimension, 'random.orb', player.location, 0.35, 1.6);
    }
  }, total);
}

// ---------------------------------------------------------------- melee passives
world.afterEvents.entityHitEntity.subscribe((ev) => safe(() => {
  const attacker = ev.damagingEntity;
  const victim = ev.hitEntity;
  if (!valid(attacker) || !valid(victim) || attacker.typeId !== 'minecraft:player') return;
  const item = heldItem(attacker);
  const w = item ? WEAPONS[item.typeId] : undefined;
  if (w && w.onHit) w.onHit(attacker.dimension, attacker, victim);
}, 'entityHitEntity'));

// ---------------------------------------------------------------- ambient sparkle + equip hint
system.runInterval(() => safe(() => {
  for (const player of world.getAllPlayers()) {
    const item = heldItem(player);
    const id = item ? item.typeId : '';
    const w = WEAPONS[id];
    if (lastHeld.get(player.id) !== id) {
      lastHeld.set(player.id, id);
      if (w) actionBar(player, `${w.color}${w.name} §7— ${w.hint}`);
    }
    if (w && w.ambient) {
      const d = aim(player);
      const right = rightOf(flat(d));
      const base = add(add(head(player), mul(d, 0.9)), add(mul(right, 0.35), { x: 0, y: -0.15, z: 0 }));
      const loc = add(base, { x: rand(-0.25, 0.25), y: rand(-0.1, 0.4), z: rand(-0.25, 0.25) });
      w.ambient(player.dimension, loc);
    }
  }
}, 'ambient'), 6);

world.afterEvents.playerLeave.subscribe((ev) => {
  lastUse.delete(ev.playerId);
  lastHeld.delete(ev.playerId);
});
