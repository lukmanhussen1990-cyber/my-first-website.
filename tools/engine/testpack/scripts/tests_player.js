// f. Player infection (SPEC §7): stage 1 on a horde hit, stage 2 after the player
// incubation, a stage-2 player's attack infects, death spawns "Infected <name>".
import { world } from "@minecraft/server";
import { defineTest, FEET } from "./harness.js";
import { ITEMS, TAGS, freshPlayer, resetOutbreak, hurtLog, valid, fmt } from "./common.js";

const stageOf = async (t, p) => {
  try {
    return (await t.bridge("entityProps", { entity: p.id })).props["pas:stage"];
  } catch (e) {
    return `? (${e.message})`;
  }
};

defineTest(
  {
    name: "player_infection",
    structure: "pastest:arena",
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 2400,
    description: "survival player hit by a parasite -> stage 1; after playerIncubationSeconds -> stage 2; its attack infects a sheep; death -> 'Infected <name>' pas:infected_human",
  },
  async (t) => {
    await resetOutbreak(t, { replicationSeconds: 300, incubationSeconds: 5, playerIncubationSeconds: 10, infectPlayers: true });
    const hurts = hurtLog(world);
    t.onCleanup(() => hurts.stop());
    const p = await freshPlayer(t, "PasInf", { x: 11, y: FEET, z: 11 });
    t.give(p, ITEMS.OUTBREAK, 1, 0, true);
    p.lookAtBlock({ x: 11, y: 1, z: 14 });
    await t.wait(4);
    p.useItemInSlotOnBlock(0, { x: 11, y: 1, z: 14 }, "Up", { x: 0.5, y: 1, z: 0.5 });
    const s1 = await t.waitUntil(() => p.hasTag(TAGS.INCUBATING), 600, 2);
    const by = hurts.log.filter((h) => h.victim === p.id).map((h) => `${h.attacker}:${h.damage}`);
    t.check(s1.ok, `player gets ${TAGS.INCUBATING} after a parasite hit (after ${s1.ticks} ticks; hits ${by.join(",") || "none"})`);
    // keep the player alive: remove the attackers and heal
    for (const e of t.entities({ families: ["pas_horde"] })) e.remove();
    try {
      p.addEffect("instant_health", 1, { amplifier: 2 });
    } catch {
      // effect id differs
    }
    if (!s1.ok) return;
    t.check((await stageOf(t, p)) === 1, `pas:stage = 1 (${await stageOf(t, p)})`);
    const s2 = await t.waitUntil(() => p.hasTag(TAGS.INFECTED_PLAYER), 300, 5);
    t.check(s2.ok && !p.hasTag(TAGS.INCUBATING), `stage 2 (${TAGS.INFECTED_PLAYER}, no ${TAGS.INCUBATING}) after ${s1.ticks + s2.ticks} ticks (playerIncubationSeconds 10)`);
    t.check((await stageOf(t, p)) === 2, `pas:stage = 2 (${await stageOf(t, p)})`);
    // the stage-2 player infects what it hits
    const sheepLoc = t.wl({ x: 11.5, y: FEET, z: 12.8 });
    const sheep = t.dim.spawnEntity("minecraft:sheep", sheepLoc);
    await t.wait(4);
    const hit = await t.waitUntil(() => {
      if (!valid(sheep)) return true;
      if (sheep.hasTag(TAGS.INCUBATING)) return true;
      p.lookAtEntity(sheep);
      p.attackEntity(sheep);
      return false;
    }, 200, 10);
    t.check(valid(sheep) && sheep.hasTag(TAGS.INCUBATING), `sheep hit by the stage-2 player gets ${TAGS.INCUBATING} (after ${hit.ticks} ticks)`);
    let at = valid(sheep) ? sheep.location : sheepLoc;
    const conv = await t.waitUntil(() => {
      if (valid(sheep)) {
        at = sheep.location;
        return false;
      }
      return t.entities({ type: "pas:infected_sheep" }).length > 0;
    }, 300, 5);
    t.check(conv.ok, `sheep converted to pas:infected_sheep (after ${conv.ticks} ticks)`);
    for (const e of t.entities({ families: ["pas_horde"] })) e.remove();
    // death of an infected player
    const deathAt = p.location;
    p.kill();
    const hum = await t.waitUntil(
      () => t.entities({ type: "pas:infected_human" }).find((e) => e.nameTag === "Infected PasInf"),
      60,
      2,
    );
    t.check(hum.ok, `'Infected PasInf' pas:infected_human appears (${t.entities({ type: "pas:infected_human" }).map((e) => `${e.nameTag}@${fmt(e.location)}`).join(",") || "none"})`);
    if (hum.ok) t.check(Math.hypot(hum.value.location.x - deathAt.x, hum.value.location.z - deathAt.z) < 2.5, `spawned at the death location (${fmt(hum.value.location)} vs ${fmt(deathAt)})`);
    for (const e of t.entities({ families: ["pas_horde"] })) e.remove();
    await t.wait(20);
    try {
      p.respawn();
    } catch (e) {
      t.info(`respawn: ${e}`);
    }
    await t.wait(30);
    t.check(!p.hasTag(TAGS.INCUBATING) && !p.hasTag(TAGS.INFECTED_PLAYER), `respawned player is healthy (tags ${p.getTags().join(",")})`);
    const st = await stageOf(t, p);
    t.check(st === undefined || st === 0, `pas:stage cleared after death (${st})`);
  },
);
