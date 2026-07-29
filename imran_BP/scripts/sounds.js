/**
 * Imran Security House - sound ids.
 *
 * Each entry plays a custom id from the resource pack plus a vanilla id, so the
 * pack is audible before any custom .ogg files are dropped in.
 */

export const SOUNDS = {
  build: { custom: "ih.house.build", vanilla: "dig.stone" },
  builtDone: { custom: "ih.house.done", vanilla: "random.levelup" },
  zap: { custom: "ih.house.zap", vanilla: "random.fizz" },
  hordeStart: { custom: "ih.horde.start", vanilla: "mob.wither.spawn" },
  hordeWave: { custom: "ih.horde.wave", vanilla: "mob.zombie.say" },
  hordeEnd: { custom: "ih.horde.end", vanilla: "random.levelup" },
  zombieSpawn: { custom: "ih.zombie.spawn", vanilla: "mob.zombie.say" },
  zombieBomb: { custom: "ih.zombie.bomb", vanilla: "random.explode" },
  menu: { custom: "ih.menu.open", vanilla: "random.orb" }
};
