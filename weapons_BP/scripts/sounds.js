/**
 * Legendary Weapons - sound ids.
 *
 * Each entry plays a custom id from the resource pack plus a vanilla id, so the
 * pack is audible before any custom .ogg files are dropped in.
 */

export const SOUNDS = {
  thunderCast: { custom: "wm.thunder.cast", vanilla: "ambient.weather.lightning.impact" },
  thunderArc: { custom: "wm.thunder.arc", vanilla: "random.fizz" },
  frostCast: { custom: "wm.frost.cast", vanilla: "random.glass" },
  frostHit: { custom: "wm.frost.hit", vanilla: "block.itemframe.break" },
  infernoShot: { custom: "wm.inferno.shot", vanilla: "mob.ghast.fireball" },
  infernoBlast: { custom: "wm.inferno.blast", vanilla: "random.explode" },
  voidBlink: { custom: "wm.void.blink", vanilla: "mob.endermen.portal" },
  voidHit: { custom: "wm.void.hit", vanilla: "mob.enderdragon.hit" },
  quakeSlam: { custom: "wm.quake.slam", vanilla: "random.explode" },
  quakeRumble: { custom: "wm.quake.rumble", vanilla: "ambient.cave" },
  singularityOpen: { custom: "wm.singularity.open", vanilla: "mob.wither.shoot" },
  singularityPull: { custom: "wm.singularity.pull", vanilla: "mob.endermen.portal" },
  singularityBoom: { custom: "wm.singularity.implode", vanilla: "mob.wither.death" },
  denied: { custom: "wm.denied", vanilla: "note.bass" },
  codex: { custom: "wm.codex", vanilla: "random.orb" }
};
