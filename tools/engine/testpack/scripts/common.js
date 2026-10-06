// Shared constants and helpers for the PAS engine tests.
import { system } from "@minecraft/server";

export const ITEMS = {
  TORCH_OFF: "pas:tactical_torchlight",
  TORCH_ON: "pas:tactical_torchlight_on",
  BASE_SPAWNER: "pas:luxury_base_spawner",
  OUTBREAK: "pas:parasite_outbreak",
  CONTROL: "pas:outbreak_control",
};
export const KIT = [ITEMS.TORCH_OFF, ITEMS.BASE_SPAWNER, ITEMS.OUTBREAK, ITEMS.CONTROL];
export const ENTITIES = [
  "pas:parasite",
  "pas:infected_villager",
  "pas:infected_cow",
  "pas:infected_pig",
  "pas:infected_sheep",
  "pas:infected_chicken",
  "pas:infected_human",
];
export const TAGS = { INCUBATING: "pas_incubating", INFECTED_PLAYER: "pas_infected_player", DORMANT: "pas_dormant" };
export const DEFAULT_CONFIG = {
  replicationSeconds: 30,
  incubationSeconds: 20,
  playerIncubationSeconds: 45,
  populationCap: 64,
  infectPlayers: true,
  showHud: true,
};
export const LIGHT = "minecraft:light_block";

export const fmt = (v) => (v && typeof v === "object" ? `${round(v.x)},${round(v.y)},${round(v.z)}` : String(v));
const round = (n) => Math.round(n * 100) / 100;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const valid = (e) => {
  try {
    return !!e && e.isValid();
  } catch {
    return false;
  }
};

/**
 * Spawn a simulated player, wait for the starting kit (which every new player gets),
 * then empty the inventory so the test controls every slot. The spawn point is set
 * to the spawn cell so a respawn stays inside the test area.
 */
export async function freshPlayer(ctx, name, rel, gameMode = "survival") {
  const p = ctx.player(name, rel, gameMode);
  await ctx.waitUntil(() => KIT.every((id) => (ctx.items(p)[id] ?? 0) > 0), 40);
  ctx.inv(p).clearAll();
  try {
    const w = ctx.w(rel);
    p.setSpawnPoint({ dimension: ctx.dim, x: w.x + 0.5, y: w.y, z: w.z + 0.5 });
  } catch (e) {
    ctx.info(`setSpawnPoint failed: ${e}`);
  }
  await ctx.wait(2);
  return p;
}

/** Remove a simulated player from its test (fires playerLeave). */
export function removePlayer(ctx, p) {
  try {
    ctx.test.removeSimulatedPlayer(p);
  } catch (e) {
    try {
      p.disconnect();
    } catch {
      ctx.info(`could not remove player: ${e}`);
    }
  }
}

/** Reset the outbreak to a known state through the add-on's own command + the bridge. */
export async function resetOutbreak(ctx, config) {
  ctx.outbreakCmd("cleanup");
  await ctx.wait(4);
  let cfg;
  try {
    cfg = await ctx.api("setConfig", { ...DEFAULT_CONFIG, ...config });
  } catch (e) {
    ctx.pending(`outbreak config not reachable (${e.message})`);
  }
  const st = await ctx.api("getState");
  ctx.check(st && st.active === false, `outbreak inactive after cleanup (active=${st && st.active})`);
  ctx.onCleanup(async () => {
    ctx.outbreakCmd("cleanup");
    await ctx.wait(2);
    ctx.clearEntities();
    try {
      await ctx.api("setConfig", DEFAULT_CONFIG);
    } catch {
      // bridge gone
    }
  });
  return cfg;
}

export async function outbreakState(ctx) {
  return ctx.api("getState");
}

/** Track who hurt which entity (entityHurt after-event), for the transmission tests. */
export function hurtLog(world) {
  const log = [];
  const sub = world.afterEvents.entityHurt.subscribe((ev) => {
    try {
      log.push({
        tick: system.currentTick,
        victim: ev.hurtEntity.id,
        victimType: ev.hurtEntity.typeId,
        attacker: ev.damageSource.damagingEntity?.typeId,
        damage: ev.damage,
      });
    } catch {
      // entity vanished
    }
  });
  return { log, stop: () => world.afterEvents.entityHurt.unsubscribe(sub) };
}
