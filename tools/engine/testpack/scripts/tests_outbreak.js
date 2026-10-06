// e. Parasite outbreak in a closed 24x24 arena (structure pastest:arena: grass floor at
// test-relative y 1, 4-high stone walls, glass roof at y 6; interior x/z 1..22).
// The outbreak is global, so every test starts with "/scriptevent pas:outbreak cleanup"
// and sets its config through the bridge (outbreak/api.js setConfig), and resets both at the end.
import { world } from "@minecraft/server";
import { defineTest, FEET } from "./harness.js";
import { ITEMS, TAGS, freshPlayer, removePlayer, resetOutbreak, outbreakState, hurtLog, valid, fmt } from "./common.js";

const ARENA = "pastest:arena";

/** Survival player releases a parasite with the item on the floor block `at`. */
async function release(t, at, name = "PasOut", stand = { x: 11, y: FEET, z: 19 }) {
  const p = await freshPlayer(t, name, stand);
  t.give(p, ITEMS.OUTBREAK, 2, 0, true);
  p.lookAtBlock(at);
  await t.wait(4);
  p.useItemInSlotOnBlock(0, at, "Up", { x: 0.5, y: 1, z: 0.5 });
  return p;
}

const parasites = (t) => t.entities({ type: "pas:parasite" });

/** Poll the outbreak state every `step` ticks until pred(state) or timeout. */
async function pollState(t, pred, timeout, step = 10) {
  let waited = 0;
  for (;;) {
    const st = await outbreakState(t);
    if (pred(st)) return { ok: true, ticks: waited, st };
    if (waited >= timeout) return { ok: false, ticks: waited, st };
    await t.wait(step);
    waited += step;
  }
}

defineTest(
  {
    name: "outbreak_start",
    structure: ARENA,
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 400,
    description: "using pas:parasite_outbreak on the ground spawns exactly 1 parasite, activates the outbreak, consumes 1 item; a second use adds one",
  },
  async (t) => {
    await resetOutbreak(t, { replicationSeconds: 300 });
    const p = await release(t, { x: 11, y: 1, z: 15 });
    const r = await t.waitUntil(() => parasites(t).length >= 1, 20);
    await t.wait(10);
    t.check(r.ok && parasites(t).length === 1, `exactly 1 pas:parasite after the first use (got ${parasites(t).length})`);
    const st = await outbreakState(t);
    t.check(st.active === true && st.paused === false && st.generation === 0, `outbreak active, generation 0 (${JSON.stringify({ active: st.active, paused: st.paused, generation: st.generation })})`);
    t.check(st.ticksToNext > 5000 && st.ticksToNext <= 6000, `ticksToNext = replicationSeconds*20 (${st.ticksToNext})`);
    t.check((t.items(p)[ITEMS.OUTBREAK] ?? 0) === 1, `one item consumed in survival (2 -> ${t.items(p)[ITEMS.OUTBREAK] ?? 0})`);
    await t.wait(10);
    p.useItemInSlotOnBlock(0, { x: 11, y: 1, z: 15 }, "Up", { x: 0.5, y: 1, z: 0.5 });
    const r2 = await t.waitUntil(() => parasites(t).length >= 2, 20);
    t.check(r2.ok && parasites(t).length === 2, `second use adds another parasite (got ${parasites(t).length})`);
    removePlayer(t, p);
  },
);

defineTest(
  {
    name: "outbreak_replication",
    structure: ARENA,
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 1400,
    description: "replicationSeconds=10: parasite count doubles 1 -> 2 -> 4 -> 8 over three generations, ~10 s apart",
  },
  async (t) => {
    await resetOutbreak(t, { replicationSeconds: 10, populationCap: 64 });
    const p = await release(t, { x: 11, y: 1, z: 11 });
    await t.waitUntil(() => parasites(t).length >= 1, 20);
    removePlayer(t, p);
    t.check(parasites(t).length === 1, `start with 1 parasite (${parasites(t).length})`);
    let last;
    for (let g = 1; g <= 3; g++) {
      const r = await pollState(t, (s) => s.generation >= g, 300, 5);
      await t.wait(20);
      const n = parasites(t).length;
      t.check(r.ok && n === 2 ** g, `generation ${g}: ${n} parasites (want ${2 ** g}), reached after ${r.ticks} ticks`);
      if (last !== undefined && g > 1) t.check(Math.abs(r.ticks + 20 - 200) <= 40, `generation interval ~200 ticks (${r.ticks + 20})`);
      last = r.ticks;
    }
    const hc = await t.api("hordeCount");
    t.info(`hordeCount=${hc}`);
  },
);

defineTest(
  {
    name: "outbreak_cap",
    structure: ARENA,
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 1500,
    description: "populationCap=6: 1 -> 2 -> 4 -> 6 and never more, also not via the item at the cap",
  },
  async (t) => {
    await resetOutbreak(t, { replicationSeconds: 10, populationCap: 6 });
    const p = await release(t, { x: 11, y: 1, z: 11 });
    await t.waitUntil(() => parasites(t).length >= 1, 20);
    let max = 0;
    let maxHc = 0;
    for (let i = 0; i < 52; i++) {
      await t.wait(20);
      max = Math.max(max, parasites(t).length);
      if (i % 5 === 0) maxHc = Math.max(maxHc, await t.api("hordeCount"));
    }
    const st = await outbreakState(t);
    t.check(st.generation >= 4, `at least 4 generations ran (${st.generation})`);
    t.check(max <= 6 && maxHc <= 6, `population never exceeded the cap (max seen ${max}, hordeCount max ${maxHc})`);
    t.check(parasites(t).length === 6, `population settles at the cap (${parasites(t).length})`);
    p.useItemInSlotOnBlock(0, { x: 11, y: 1, z: 11 }, "Up", { x: 0.5, y: 1, z: 0.5 });
    await t.wait(20);
    t.check(parasites(t).length === 6, `item at the cap releases nothing (${parasites(t).length})`);
    t.check((t.items(p)[ITEMS.OUTBREAK] ?? 0) === 1, `item not consumed at the cap (${t.items(p)[ITEMS.OUTBREAK] ?? 0})`);
    removePlayer(t, p);
  },
);

defineTest(
  {
    name: "outbreak_pause",
    structure: ARENA,
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 1500,
    description: "pause: pas_dormant on every horde entity and no growth for 25 s; resume: tags removed and growth continues",
  },
  async (t) => {
    await resetOutbreak(t, { replicationSeconds: 10, populationCap: 64 });
    const p = await release(t, { x: 11, y: 1, z: 11 });
    await t.waitUntil(() => parasites(t).length >= 1, 20);
    removePlayer(t, p);
    const g1 = await pollState(t, (s) => s.generation >= 1, 300, 5);
    await t.wait(20);
    t.check(g1.ok && parasites(t).length === 2, `generation 1 before pausing (${parasites(t).length} parasites)`);
    t.outbreakCmd("pause");
    const d = await t.waitUntil(() => parasites(t).length > 0 && parasites(t).every((e) => e.hasTag(TAGS.DORMANT)), 40);
    t.check(d.ok, `every parasite tagged ${TAGS.DORMANT} within 2 s of pause`);
    const st0 = await outbreakState(t);
    t.check(st0.paused === true, `state.paused (${st0.paused})`);
    const n0 = parasites(t).length;
    await t.wait(500);
    const st1 = await outbreakState(t);
    t.check(parasites(t).length === n0 && st1.generation === st0.generation, `no growth while paused for 25 s (${n0} -> ${parasites(t).length}, generation ${st0.generation} -> ${st1.generation})`);
    t.check(Math.abs(st1.ticksToNext - st0.ticksToNext) <= 20, `timer frozen (${st0.ticksToNext} -> ${st1.ticksToNext})`);
    t.outbreakCmd("resume");
    const a = await t.waitUntil(() => parasites(t).every((e) => !e.hasTag(TAGS.DORMANT)), 40);
    t.check(a.ok, "pas_dormant removed on resume");
    const g2 = await pollState(t, (s) => s.generation > st1.generation, 300, 5);
    await t.wait(20);
    t.check(g2.ok && parasites(t).length === 2 * n0, `growth continues after resume (${parasites(t).length}, want ${2 * n0})`);
  },
);

defineTest(
  {
    name: "outbreak_cleanup",
    structure: ARENA,
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 600,
    description: "cleanup removes every horde entity, clears incubations and makes the outbreak inactive",
  },
  async (t) => {
    await resetOutbreak(t, { replicationSeconds: 300, incubationSeconds: 60 });
    const p = await release(t, { x: 11, y: 1, z: 11 });
    await t.waitUntil(() => parasites(t).length >= 1, 20);
    removePlayer(t, p);
    const cow = t.spawn("minecraft:cow", { x: 4, y: FEET, z: 4 });
    const extra = t.spawn("pas:infected_pig", { x: 18, y: FEET, z: 4 });
    await t.wait(5);
    const inf = await t.api("infect", { $entity: cow.id });
    await t.wait(5);
    t.check(inf === true && cow.hasTag(TAGS.INCUBATING), `cow infected through api.infect (${inf}, tag ${cow.hasTag(TAGS.INCUBATING)})`);
    t.outbreakCmd("cleanup");
    const r = await t.waitUntil(() => t.dim.getEntities({ families: ["pas_horde"] }).length === 0, 60);
    t.check(r.ok, `no pas_horde entity left in the dimension (${t.dim.getEntities({ families: ["pas_horde"] }).map((e) => e.typeId).join(",")})`);
    t.check(!valid(extra), "a horde entity spawned outside the outbreak is removed too");
    t.check(valid(cow) && !cow.hasTag(TAGS.INCUBATING), `the incubating cow is healed, not removed (valid ${valid(cow)})`);
    const st = await outbreakState(t);
    t.check(st.active === false && st.generation === 0, `outbreak inactive, generation 0 (${st.active}, ${st.generation})`);
  },
);

defineTest(
  {
    name: "outbreak_cure",
    structure: ARENA,
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 1000,
    description: "an infected villager becomes minecraft:villager_v2 again on cure; parasites are removed",
  },
  async (t) => {
    await resetOutbreak(t, { replicationSeconds: 300, incubationSeconds: 5 });
    const p = await release(t, { x: 4, y: 1, z: 4 });
    await t.waitUntil(() => parasites(t).length >= 1, 20);
    removePlayer(t, p);
    const v = t.spawn("minecraft:villager_v2", { x: 18, y: FEET, z: 18 });
    await t.wait(5);
    await t.api("infect", { $entity: v.id });
    const conv = await t.waitUntil(() => t.entities({ type: "pas:infected_villager" }).length > 0, 300, 5);
    t.check(conv.ok, `villager converted to pas:infected_villager (after ${conv.ticks} ticks)`);
    const iv = t.entities({ type: "pas:infected_villager" })[0];
    const at = iv ? iv.location : undefined;
    t.outbreakCmd("cure");
    const r = await t.waitUntil(() => t.entities({ type: "pas:infected_villager" }).length === 0 && t.entities({ type: "minecraft:villager_v2" }).length > 0, 60);
    const vs = t.entities({ type: "minecraft:villager_v2" });
    t.check(r.ok, `infected villager reverted to minecraft:villager_v2 (${vs.length} villagers, ${t.entities({ type: "pas:infected_villager" }).length} infected left)`);
    if (at && vs[0]) t.check(Math.hypot(vs[0].location.x - at.x, vs[0].location.z - at.z) < 2, `cured villager at the same place (${fmt(vs[0].location)} vs ${fmt(at)})`);
    t.check(parasites(t).length === 0, `parasites removed by cure (${parasites(t).length})`);
    const st = await outbreakState(t);
    t.check(st.active === false, `outbreak inactive after cure (${st.active})`);
  },
);

/** Wait until `victim` carries pas_incubating; returns who hurt it. */
async function waitInfected(t, victim, hurts, timeout) {
  const r = await t.waitUntil(() => valid(victim) && victim.hasTag(TAGS.INCUBATING), timeout, 5);
  const by = hurts.log.filter((h) => h.victim === victim.id).map((h) => h.attacker);
  return { ...r, by: [...new Set(by)] };
}

/** Wait until the entity with id `id` is gone and an entity of `type` exists near `loc`. */
async function waitConverted(t, ent, type, timeout) {
  let at = ent.location;
  const r = await t.waitUntil(() => {
    if (valid(ent)) {
      at = ent.location;
      return false;
    }
    return t.entities({ type }).find((e) => Math.hypot(e.location.x - at.x, e.location.z - at.z) < 2);
  }, timeout, 5);
  return { ...r, entity: r.value || undefined };
}

defineTest(
  {
    name: "outbreak_chain",
    structure: ARENA,
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 4000,
    description: "natural AI: parasite -> villager_v2 -> infected villager -> cow -> infected cow -> pig (3 hops, 2+ generations of transmission)",
  },
  async (t) => {
    await resetOutbreak(t, { replicationSeconds: 300, incubationSeconds: 5, populationCap: 64 });
    const hurts = hurtLog(world);
    t.onCleanup(() => hurts.stop());
    const p = await release(t, { x: 4, y: 1, z: 11 });
    await t.waitUntil(() => parasites(t).length >= 1, 20);
    removePlayer(t, p);
    let host = t.spawn("minecraft:villager_v2", { x: 7, y: FEET, z: 11 });
    const hops = [
      ["minecraft:villager_v2", "pas:infected_villager", "pas:parasite"],
      ["minecraft:cow", "pas:infected_cow", "pas:infected_villager"],
      ["minecraft:pig", "pas:infected_pig", "pas:infected_cow"],
    ];
    let attacker;
    for (let i = 0; i < hops.length; i++) {
      const [vanilla, infected, by] = hops[i];
      if (i > 0) {
        const at = attacker.location;
        host = t.dim.spawnEntity(vanilla, { x: at.x + (at.x < t.wl({ x: 11, y: 0, z: 0 }).x ? 3 : -3), y: at.y, z: at.z });
      }
      const inf = await waitInfected(t, host, hurts, 700);
      t.check(inf.ok, `hop ${i + 1}: ${vanilla} gets ${TAGS.INCUBATING} (after ${inf.ticks} ticks, hurt by ${inf.by.join(",") || "nobody"})`);
      if (!inf.ok) return;
      t.check(inf.by.includes(by), `hop ${i + 1}: ${vanilla} was attacked by ${by} (${inf.by.join(",")})`);
      // only the newest host may spread further: remove the previous horde generation
      for (const e of t.entities({ families: ["pas_horde"] })) e.remove();
      const conv = await waitConverted(t, host, infected, 300);
      t.check(conv.ok, `hop ${i + 1}: ${vanilla} converted to ${infected} after ${conv.ticks} ticks (incubation 100)`);
      if (!conv.ok) return;
      t.check(conv.ticks <= 160, `hop ${i + 1}: conversion on time (${conv.ticks} ticks)`);
      attacker = conv.entity;
    }
  },
);
