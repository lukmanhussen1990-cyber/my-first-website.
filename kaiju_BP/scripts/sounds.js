/**
 * Kaiju Rampage - sound ids.
 *
 * Each entry plays a custom id from the resource pack plus a vanilla id, so the
 * pack is audible before any custom .ogg files are dropped in.
 */

export const SOUNDS = {
  roar: { custom: "kj.kaiju.roar", vanilla: "mob.ravager.roar" },
  screech: { custom: "kj.kaiju.screech", vanilla: "mob.enderdragon.growl" },
  step: { custom: "kj.kaiju.step", vanilla: "mob.ravager.step" },
  stomp: { custom: "kj.kaiju.stomp", vanilla: "random.explode" },
  smash: { custom: "kj.kaiju.smash", vanilla: "dig.stone" },
  tail: { custom: "kj.kaiju.tail", vanilla: "mob.ravager.attack" },
  charge: { custom: "kj.atomic.charge", vanilla: "mob.wither.shoot" },
  beam: { custom: "kj.atomic.beam", vanilla: "mob.ghast.fireball" },
  beamHit: { custom: "kj.atomic.hit", vanilla: "random.explode" },
  hurt: { custom: "kj.kaiju.hurt", vanilla: "mob.ravager.hurt" },
  death: { custom: "kj.kaiju.death", vanilla: "mob.enderdragon.death" },
  summon: { custom: "kj.horn.summon", vanilla: "mob.wither.spawn" },
  hornOpen: { custom: "kj.horn.open", vanilla: "random.orb" }
};
