// Perfect Disguises - disguise registry.
//
// `id` must match the "minecraft:variant" value set by the matching
// "pd:set_<key>" event in entities/player.json, and the resource pack
// renders the mob model for that variant.
//
// Fields:
//   effects       [effectId, amplifier] kept on the player while disguised
//   burnsInSun    catches fire in direct sunlight (helmet / water / rain / shade protect)
//   waterHurts    takes damage in water and rain
//   aquatic       breathes underwater (for future water mobs like cod or dolphins)
//   immuneTo      effect ids that are blocked while disguised
//   ability       active power, used with crouch + Disguise Wand (or the menu)
//   sounds        vanilla sound ids played for ambient / hurt / death

/**
 * @typedef {object} Disguise
 * @property {string} key
 * @property {number} id
 * @property {string} name
 * @property {string} color
 * @property {string} icon
 * @property {[string, number][]} effects
 * @property {boolean} [burnsInSun]
 * @property {boolean} [weakInSun]
 * @property {boolean} [waterHurts]
 * @property {boolean} [aquatic]
 * @property {boolean} [climbs]
 * @property {boolean} [flies]
 * @property {boolean} [stings]
 * @property {boolean} [slowArrows]
 * @property {boolean} [fearsCats]
 * @property {boolean} [lovesCarrots]
 * @property {string[]} [immuneTo]
 * @property {{ id: string, name: string, cooldown: number }} [ability]
 * @property {{ ambient?: string, hurt?: string, death?: string }} sounds
 * @property {string[]} perks
 * @property {string[]} weaknesses
 */

/** @type {Disguise[]} */
export const DISGUISES = [
  {
    key: "zombie",
    id: 1,
    name: "Zombie",
    color: "§2",
    icon: "textures/pd/ui/zombie",
    effects: [["strength", 0]],
    burnsInSun: true,
    immuneTo: ["poison", "hunger"],
    sounds: { ambient: "mob.zombie.say", hurt: "mob.zombie.hurt", death: "mob.zombie.death" },
    perks: [
      "Strength I: your punches hit harder",
      "Rotten flesh never makes you hungry",
      "Immune to poison (undead)",
      "Zombies and most monsters ignore you",
    ],
    weaknesses: [
      "You burn in sunlight (a helmet, water, rain or shade keep you safe)",
      "Iron golems and snow golems attack you",
      "Villagers run away from you",
    ],
  },
  {
    key: "skeleton",
    id: 2,
    name: "Skeleton",
    color: "§7",
    icon: "textures/pd/ui/skeleton",
    effects: [["water_breathing", 0]],
    burnsInSun: true,
    immuneTo: ["poison"],
    slowArrows: true,
    sounds: { ambient: "mob.skeleton.say", hurt: "mob.skeleton.hurt", death: "mob.skeleton.death" },
    perks: [
      "Bone archer: your arrows slow down what they hit",
      "You never drown (no air needed)",
      "Immune to poison (undead)",
      "Skeletons and most monsters ignore you",
    ],
    weaknesses: [
      "You burn in sunlight (a helmet, water, rain or shade keep you safe)",
      "Wolves hunt you - even tamed ones",
      "Iron golems and snow golems attack you",
    ],
  },
  {
    key: "creeper",
    id: 3,
    name: "Creeper",
    color: "§a",
    icon: "textures/pd/ui/creeper",
    effects: [],
    fearsCats: true,
    ability: { id: "explode", name: "Explode", cooldown: 200 },
    sounds: { hurt: "mob.creeper.say", death: "mob.creeper.death" },
    perks: [
      "Explode: crouch + use the wand to light your fuse (do it again to cancel)",
      "Your own explosion and other blasts cannot hurt you",
      "Get struck by lightning to become a CHARGED creeper (double blast)",
      "Creepers ignore you and iron golems leave you alone",
    ],
    weaknesses: [
      "Cats and ocelots terrify you: slowness and weakness near them",
      "Explosion recharge: 10 seconds",
      "Snow golems attack you",
    ],
  },
  {
    key: "spider",
    id: 4,
    name: "Spider",
    color: "§8",
    icon: "textures/pd/ui/spider",
    effects: [["speed", 0], ["night_vision", 0]],
    climbs: true,
    weakInSun: true,
    ability: { id: "web", name: "Web Shot", cooldown: 300 },
    sounds: { ambient: "mob.spider.say", hurt: "mob.spider.say", death: "mob.spider.death" },
    perks: [
      "Wall climbing: walk into a wall to climb it",
      "Crouch or look down while on a wall to hold on and slide down slowly",
      "Speed I and night vision",
      "Web Shot: crouch + use the wand to trap a spot in cobweb",
      "Spiders and most monsters ignore you",
    ],
    weaknesses: [
      "Weakness in bright daylight",
      "Iron golems and snow golems attack you",
    ],
  },
  {
    key: "enderman",
    id: 5,
    name: "Enderman",
    color: "§5",
    icon: "textures/pd/ui/enderman",
    effects: [],
    waterHurts: true,
    ability: { id: "teleport", name: "Teleport", cooldown: 60 },
    sounds: { ambient: "mob.endermen.idle", hurt: "mob.endermen.hit", death: "mob.endermen.death" },
    perks: [
      "Teleport: crouch + use the wand to blink where you look (up to 16 blocks)",
      "Endermen are never angry when you look at them",
      "Most monsters ignore you",
    ],
    weaknesses: [
      "Water and rain hurt you",
      "Teleport recharge: 3 seconds",
      "Iron golems and snow golems attack you",
    ],
  },
  {
    key: "villager",
    id: 6,
    name: "Villager",
    color: "§6",
    icon: "textures/pd/ui/villager",
    effects: [["village_hero", 0], ["weakness", 0]],
    sounds: { ambient: "mob.villager.idle", hurt: "mob.villager.hit", death: "mob.villager.death" },
    perks: [
      "Hero of the Village: villagers give you trade discounts",
      "Iron golems see you as a friend",
    ],
    weaknesses: [
      "Zombies, illagers and vexes hunt you",
      "Weakness I: villagers are not fighters",
    ],
  },
  {
    key: "pig",
    id: 7,
    name: "Pig",
    color: "§d",
    icon: "textures/pd/ui/pig",
    effects: [["weakness", 0]],
    lovesCarrots: true,
    sounds: { ambient: "mob.pig.say", hurt: "mob.pig.say", death: "mob.pig.death" },
    perks: [
      "Carrot lover: Speed II while holding a carrot, potato or beetroot",
      "Monsters ignore you - you are just a pig",
    ],
    weaknesses: [
      "Weakness I: pigs are not fighters",
    ],
  },
  {
    key: "cow",
    id: 8,
    name: "Cow",
    color: "§f",
    icon: "textures/pd/ui/cow",
    effects: [["resistance", 0], ["weakness", 0]],
    ability: { id: "milk", name: "Milk Cleanse", cooldown: 600 },
    sounds: { ambient: "mob.cow.say", hurt: "mob.cow.hurt", death: "mob.cow.hurt" },
    perks: [
      "Resistance I: tough hide",
      "Milk Cleanse: crouch + use the wand to remove bad effects",
      "Monsters ignore you - you are just a cow",
    ],
    weaknesses: [
      "Weakness I: cows are not fighters",
      "Milk Cleanse recharge: 30 seconds",
    ],
  },
  {
    key: "sheep",
    id: 9,
    name: "Sheep",
    color: "§f",
    icon: "textures/pd/ui/sheep",
    effects: [["weakness", 0]],
    ability: { id: "graze", name: "Graze", cooldown: 200 },
    sounds: { ambient: "mob.sheep.say", hurt: "mob.sheep.say", death: "mob.sheep.say" },
    perks: [
      "Soft wool: no fall damage",
      "Graze: crouch + use the wand on grass to eat it and heal",
      "Monsters ignore you - you are just a sheep",
    ],
    weaknesses: [
      "Wolves hunt you",
      "Wool burns: fire hurts you more",
      "Weakness I: sheep are not fighters",
    ],
  },
  {
    key: "wolf",
    id: 10,
    name: "Wolf",
    color: "§7",
    icon: "textures/pd/ui/wolf",
    effects: [["speed", 0], ["strength", 0], ["hunger", 0]],
    ability: { id: "howl", name: "Howl", cooldown: 900 },
    sounds: { ambient: "mob.wolf.bark", hurt: "mob.wolf.hurt", death: "mob.wolf.death" },
    perks: [
      "Speed I and Strength I: a true hunter",
      "Howl: crouch + use the wand to boost nearby players and scare skeletons",
      "Skeletons run away from you, most monsters ignore you",
    ],
    weaknesses: [
      "Always hungry (Hunger I)",
      "Llamas spit at you",
      "Howl recharge: 45 seconds",
    ],
  },
  {
    key: "chicken",
    id: 11,
    name: "Chicken",
    color: "§f",
    icon: "textures/pd/ui/chicken",
    effects: [["slow_falling", 0], ["weakness", 0]],
    ability: { id: "egg", name: "Lay Egg", cooldown: 1200 },
    sounds: { ambient: "mob.chicken.say", hurt: "mob.chicken.hurt", death: "mob.chicken.hurt" },
    perks: [
      "Flap your wings: slow falling and no fall damage",
      "Lay Egg: crouch + use the wand to lay an egg",
      "Monsters ignore you - you are just a chicken",
    ],
    weaknesses: [
      "Foxes, ocelots and cats hunt you",
      "Weakness I: chickens are not fighters",
      "Lay Egg recharge: 60 seconds",
    ],
  },
  {
    key: "bee",
    id: 12,
    name: "Bee",
    color: "§e",
    icon: "textures/pd/ui/bee",
    effects: [["slow_falling", 0]],
    flies: true,
    stings: true,
    sounds: { ambient: "mob.bee.pollinate", hurt: "mob.bee.hurt", death: "mob.bee.death" },
    perks: [
      "Limited flight: hold JUMP in the air to fly up (wing energy refills on the ground)",
      "Slow falling while your wings are tired",
      "Sting: your hits poison the target",
      "Bees and most monsters ignore you",
    ],
    weaknesses: [
      "Fragile: every hit deals 1 extra damage",
      "You cannot fly in water or rain",
    ],
  },
];

/** @type {Map<number, Disguise>} */
export const BY_ID = new Map(DISGUISES.map((d) => [d.id, d]));
/** @type {Map<string, Disguise>} */
export const BY_KEY = new Map(DISGUISES.map((d) => [d.key, d]));
