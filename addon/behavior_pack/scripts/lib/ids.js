// @ts-check
// Canonical identifiers shared by every script module, entity file and test.
// Changing a value here is a contract change: update docs/SPEC.md and the
// matching JSON definitions at the same time.

export const NS = "pas";

export const ITEMS = Object.freeze({
  TORCH_OFF: "pas:tactical_torchlight",
  TORCH_ON: "pas:tactical_torchlight_on",
  BASE_SPAWNER: "pas:luxury_base_spawner",
  OUTBREAK: "pas:parasite_outbreak",
  CONTROL: "pas:outbreak_control",
});

export const ENTITIES = Object.freeze({
  PARASITE: "pas:parasite",
  INFECTED_VILLAGER: "pas:infected_villager",
  INFECTED_COW: "pas:infected_cow",
  INFECTED_PIG: "pas:infected_pig",
  INFECTED_SHEEP: "pas:infected_sheep",
  INFECTED_CHICKEN: "pas:infected_chicken",
  INFECTED_HUMAN: "pas:infected_human",
});

/** Vanilla entity type -> infected entity type it converts into. */
export const CONVERSIONS = Object.freeze({
  "minecraft:villager_v2": ENTITIES.INFECTED_VILLAGER,
  "minecraft:villager": ENTITIES.INFECTED_VILLAGER,
  "minecraft:wandering_trader": ENTITIES.INFECTED_VILLAGER,
  "minecraft:cow": ENTITIES.INFECTED_COW,
  "minecraft:mooshroom": ENTITIES.INFECTED_COW,
  "minecraft:pig": ENTITIES.INFECTED_PIG,
  "minecraft:sheep": ENTITIES.INFECTED_SHEEP,
  "minecraft:chicken": ENTITIES.INFECTED_CHICKEN,
});

export const FAMILIES = Object.freeze({
  HORDE: "pas_horde", // every parasite-side entity
  PARASITE: "pas_parasite", // only pas:parasite
  INFECTED: "pas_infected", // every converted creature (incl. infected_human)
});

export const TAGS = Object.freeze({
  INCUBATING: "pas_incubating", // vanilla mob or player carrying an incubating infection
  INFECTED_PLAYER: "pas_infected_player", // player whose incubation finished (stage 2)
  DORMANT: "pas_dormant", // horde entity currently paused (mirrors the pas:dormant component group)
});

/** Dynamic property keys. */
export const PROPS = Object.freeze({
  // world
  CONFIG: "pas:config",
  OUTBREAK: "pas:outbreak",
  TORCH_CELLS: "pas:torch_cells",
  // any entity carrying an infection (vanilla mobs and players)
  INC_TICKS: "pas:inc_ticks", // remaining incubation ticks (number)
  INC_TOTAL: "pas:inc_total", // total incubation ticks at infection time (number)
  INC_EPOCH: "pas:inc_epoch", // outbreak epoch when infected (number)
  // players
  STAGE: "pas:stage", // 0 healthy, 1 incubating, 2 fully infected
  KIT: "pas:kit_v1", // true once the starting kit was given
  // horde entities
  EPOCH: "pas:epoch", // outbreak epoch the entity was created in (number)
  ORIGIN: "pas:origin", // vanilla type id an infected creature was converted from (string)
  ORIGIN_DATA: "pas:origin_data", // JSON string with variant/colour/baby/name data for cure
});

/** Entity events defined on every horde entity (BP). */
export const EVENTS = Object.freeze({
  DORMANT: "pas:become_dormant",
  ACTIVE: "pas:become_active",
  BORN: "pas:born", // pas:parasite only: offspring birth effects
  MAKE_BABY: "pas:make_baby", // infected creatures with a baby form
  SET_SHEARED: "pas:set_sheared", // infected sheep only
  // Indexed events (append the number): pas:set_variant_<n>, pas:set_mark_<n>, pas:set_skin_<n>, pas:set_color_<n>
  SET_VARIANT_PREFIX: "pas:set_variant_",
  SET_MARK_PREFIX: "pas:set_mark_",
  SET_SKIN_PREFIX: "pas:set_skin_",
  SET_COLOR_PREFIX: "pas:set_color_",
});

export const SOUNDS = Object.freeze({
  PARASITE_AMBIENT: "pas.parasite.ambient",
  PARASITE_HURT: "pas.parasite.hurt",
  PARASITE_DEATH: "pas.parasite.death",
  PARASITE_ATTACK: "pas.parasite.attack",
  PARASITE_STEP: "pas.parasite.step",
  PARASITE_BIRTH: "pas.parasite.birth",
  INFECTED_AMBIENT: "pas.infected.ambient",
  INFECTED_HURT: "pas.infected.hurt",
  INFECTED_DEATH: "pas.infected.death",
  INFECTION_START: "pas.infection.start",
  INFECTION_CONVERT: "pas.infection.convert",
  INFECTION_HEARTBEAT: "pas.infection.heartbeat",
  OUTBREAK_START: "pas.outbreak.start",
  TORCH_ON: "pas.torch.on",
  TORCH_OFF: "pas.torch.off",
  BASE_BUILD: "pas.base.build",
  BASE_DONE: "pas.base.done",
  UI_OPEN: "pas.ui.open",
});

export const PARTICLES = Object.freeze({
  SPORES: "pas:infection_spores",
  CONVERSION: "pas:conversion_burst",
  BIRTH: "pas:birth_splatter",
  BUILD: "pas:build_sparkle",
});
