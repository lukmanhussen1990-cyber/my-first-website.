/**
 * Parasite - sound ids.
 *
 * `custom` ids come from the resource pack's sound_definitions.json, `vanilla`
 * ids always exist so the mod is audible before custom .ogg files are added.
 */

export const SOUNDS = {
  spawn: { custom: "pm.parasite.spawn", vanilla: "mob.silverfish.say" },
  screech: { custom: "pm.parasite.screech", vanilla: "mob.ravager.roar" },
  chew: { custom: "pm.parasite.chew", vanilla: "mob.zombie.wood" },
  bite: { custom: "pm.parasite.bite", vanilla: "mob.zombie.hurt" },
  grow: { custom: "pm.parasite.grow", vanilla: "mob.slime.big" },
  split: { custom: "pm.parasite.split", vanilla: "mob.slime.attack" },
  die: { custom: "pm.parasite.die", vanilla: "mob.silverfish.kill" },
  sampleUse: { custom: "pm.sample.use", vanilla: "bottle.dragonbreath" },
  purge: { custom: "pm.purge", vanilla: "random.fizz" }
};
