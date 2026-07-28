/**
 * Natural Disasters - sound ids.
 *
 * `custom` ids are defined by the resource pack in
 * `sounds/sound_definitions.json`. `vanilla` ids always exist in the game, so
 * something is always audible even before custom .ogg files are dropped in.
 */

export const SOUNDS = {
  wandOpen: { custom: "nd.wand.open", vanilla: "random.orb" },
  wandCast: { custom: "nd.wand.cast", vanilla: "mob.evocation_illager.cast_spell" },
  detectorTick: { custom: "nd.detector.tick", vanilla: "random.click" },
  detectorAlarm: { custom: "nd.detector.alarm", vanilla: "note.pling" },
  warning: { custom: "nd.warning", vanilla: "mob.wither.spawn" },

  tornadoLoop: { custom: "nd.tornado.loop", vanilla: "mob.enderdragon.flap" },
  tornadoDebris: { custom: "nd.tornado.debris", vanilla: "dig.gravel" },

  earthquakeRumble: { custom: "nd.earthquake.rumble", vanilla: "ambient.cave" },
  earthquakeCrack: { custom: "nd.earthquake.crack", vanilla: "dig.stone" },

  meteorFly: { custom: "nd.meteor.fly", vanilla: "mob.ghast.fireball" },
  meteorImpact: { custom: "nd.meteor.impact", vanilla: "random.explode" },

  tsunamiRoar: { custom: "nd.tsunami.roar", vanilla: "ambient.weather.rain" },
  tsunamiSplash: { custom: "nd.tsunami.splash", vanilla: "random.splash" },

  wildfireBurn: { custom: "nd.wildfire.burn", vanilla: "fire.fire" },
  wildfireIgnite: { custom: "nd.wildfire.ignite", vanilla: "fire.ignite" },

  stormThunder: { custom: "nd.storm.thunder", vanilla: "ambient.weather.thunder" },
  stormCharge: { custom: "nd.storm.charge", vanilla: "ambient.weather.lightning.impact" }
};
