// Session 1 of the outbreak reload test: start an outbreak, reach generation 2,
// infect a villager and a player (stage 1), change the config, save.
// PAS_MODE=paused additionally pauses the outbreak before saving.

import { startOutbreakWorld } from "./common.mjs";

const { sc, mock, overworld, api, count, storedState, outbreakErrors } = await startOutbreakWorld();
const OW = "minecraft:overworld";

mock.fill(OW, { x: -24, y: 63, z: -24 }, { x: 24, y: 63, z: 24 }, "minecraft:grass_block");
const steve = mock.addPlayer({ name: "Steve", location: { x: 0.5, y: 64, z: 12.5 } });
mock.tick();
api.setConfig({ populationCap: 48, incubationSeconds: 20, playerIncubationSeconds: 60 });

// release via the item
mock.setMainhand(steve, "pas:parasite_outbreak", 1);
mock.useItemOn(steve, { x: 0, y: 63, z: 0 }, "Up");
mock.tick();
mock.tick(1200); // two generations: 1 -> 2 -> 4

const [P] = overworld.getEntities({ type: "pas:parasite" });
const V = mock.spawn("minecraft:villager_v2", { x: 6.5, y: 64, z: 6.5 });
V.triggerEvent("minecraft:become_farmer");
V.applyDamage(1, { damagingEntity: P, cause: "entityAttack" });
steve.applyDamage(1, { damagingEntity: P, cause: "entityAttack" });
mock.flush();
mock.tick(150);
if (process.env.PAS_MODE === "paused") {
  api.pause();
  mock.tick(5);
}

const stored = storedState();
sc.end({
  tick: mock.currentTick,
  parasites: count("pas:parasite"),
  stored,
  live: api.getState(),
  villager: { id: V.id, inc: V.getDynamicProperty("pas:inc_ticks"), tags: V.getTags() },
  steve: { inc: steve.getDynamicProperty("pas:inc_ticks"), stage: steve.getDynamicProperty("pas:stage"), tags: steve.getTags() },
  config: api.getConfig(),
  storedConfig: JSON.parse(sc.server.world.getDynamicProperty("pas:config")),
  errors: outbreakErrors(),
  mockErrors: mock.errors.length,
});
