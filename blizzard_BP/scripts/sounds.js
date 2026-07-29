/**
 * Extreme Blizzard - sound ids.
 *
 * Each entry plays a custom id from the resource pack plus a vanilla id, so the
 * pack is audible before any custom .ogg files are dropped in.
 */

export const SOUNDS = {
  wind: { custom: "sw.blizzard.wind", vanilla: "ambient.weather.rain" },
  stormStart: { custom: "sw.blizzard.start", vanilla: "mob.wither.spawn" },
  stormEnd: { custom: "sw.blizzard.end", vanilla: "random.levelup" },
  freezing: { custom: "sw.freezing", vanilla: "random.glass" },
  heartbeat: { custom: "sw.heartbeat", vanilla: "note.bass" },
  cocoa: { custom: "sw.cocoa.drink", vanilla: "random.burp" },
  warmer: { custom: "sw.warmer.use", vanilla: "fire.ignite" },
  stone: { custom: "sw.stone.use", vanilla: "beacon.power" },
  menu: { custom: "sw.menu.open", vanilla: "random.orb" }
};
