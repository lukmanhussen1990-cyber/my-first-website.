// Session 2 of the outbreak reload test: a fresh process loads the saved world,
// starts the add-on and records when the next doubling, the villager's
// conversion and the player's stage 2 happen (ticks relative to the load).
// PAS_MODE=paused: checks the paused state first, waits, then resumes.

import { startOutbreakWorld } from "./common.mjs";

const { sc, mock, overworld, api, count, storedState, outbreakErrors } = await startOutbreakWorld();

const T0 = mock.currentTick;
const saved = storedState();
mock.tick(1); // first tick: state loaded, entityLoad/playerSpawn delivered
const steve = sc.server.world.getAllPlayers().find((p) => p.name === "Steve");
const first = {
  state: api.getState(),
  config: api.getConfig(),
  parasites: count("pas:parasite"),
  horde: api.hordeCount(),
  steveTags: steve.getTags(),
  steveStage: steve.getDynamicProperty("pas:stage"),
  dormantTags: overworld.getEntities({ type: "pas:parasite" }).filter((e) => e.hasTag("pas_dormant")).length,
};

let pausedCheck;
let resumeAt = T0;
if (process.env.PAS_MODE === "paused") {
  const villager = overworld.getEntities({ type: "minecraft:villager_v2" })[0];
  const inc0 = villager.getDynamicProperty("pas:inc_ticks");
  mock.tick(600);
  pausedCheck = {
    ticksToNext: api.getState().ticksToNext,
    parasites: count("pas:parasite"),
    villagerInc: villager.getDynamicProperty("pas:inc_ticks"),
    inc0,
  };
  api.resume();
  resumeAt = mock.currentTick;
}

const events = { doubled: undefined, villagerConverted: undefined, steveStage2: undefined, generationAfter: undefined };
for (let i = 0; i < 2000 && (events.doubled === undefined || events.villagerConverted === undefined || events.steveStage2 === undefined); i++) {
  mock.tick(1);
  const rel = mock.currentTick - resumeAt;
  if (events.doubled === undefined && count("pas:parasite") >= 8) {
    events.doubled = rel;
    events.generationAfter = api.getState().generation;
  }
  if (events.villagerConverted === undefined && count("pas:infected_villager") === 1) events.villagerConverted = rel;
  if (events.steveStage2 === undefined && steve.hasTag("pas_infected_player")) events.steveStage2 = rel;
}
const iv = overworld.getEntities({ type: "pas:infected_villager" })[0];

sc.end({
  T0,
  saved,
  first,
  pausedCheck,
  events,
  parasitesEnd: count("pas:parasite"),
  infectedVillager: iv ? { origin: iv.getDynamicProperty("pas:origin"), data: JSON.parse(iv.getDynamicProperty("pas:origin_data")) } : undefined,
  stats: api.getState().stats,
  errors: outbreakErrors(),
  mockErrors: mock.errors.length,
});
