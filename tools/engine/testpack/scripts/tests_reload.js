// g. Save / reload. reload_pre (phase pre_reload) builds a mid-outbreak world, records
// it in the test pack's own world dynamic property and prints READY; the runner then
// stops the server cleanly ("stop"), restarts it on the same world and runs
// reload_after (phase after_reload), which checks the state against the record.
import { world, system } from "@minecraft/server";
import { defineTest, FEET, handoffGet, handoffSet } from "./harness.js";
import { ITEMS, TAGS, LIGHT, DEFAULT_CONFIG, freshPlayer, removePlayer, resetOutbreak, outbreakState, valid, fmt } from "./common.js";

const CONFIG = { replicationSeconds: 30, incubationSeconds: 30, playerIncubationSeconds: 120, populationCap: 40, infectPlayers: true, showHud: false };

defineTest(
  {
    name: "reload_pre",
    phase: "pre_reload",
    structure: "pastest:arena",
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 20000,
    description: "mid-outbreak world for the reload test: generation 1, a cow mid-incubation, changed config, a lit torch",
  },
  async (t) => {
    // reset without the automatic end-of-test cleanup (the state must survive)
    t.outbreakCmd("cleanup");
    await t.wait(4);
    await t.api("setConfig", CONFIG);
    const lo = t.w({ x: -2, y: 0, z: -2 });
    const hi = t.w({ x: 26, y: 7, z: 26 });
    t.cmd(`tickingarea add ${lo.x} ${lo.y} ${lo.z} ${hi.x} ${hi.y} ${hi.z} pastest_reload true`);
    // torch: creative player (the horde ignores it) lighting the west wall
    const tp = await freshPlayer(t, "PasReloadTorch", { x: 3, y: FEET, z: 3 }, "creative");
    t.give(tp, ITEMS.TORCH_OFF, 1, 0, true);
    await t.wait(8);
    tp.useItemInSlot(0);
    await t.waitUntil(() => t.inv(tp).getItem(0)?.typeId === ITEMS.TORCH_ON, 20);
    tp.lookAtBlock({ x: 0, y: 3, z: 3 });
    // outbreak: release with the item, force generation 1 through the debug API
    const p = await freshPlayer(t, "PasReloadOut", { x: 11, y: FEET, z: 19 });
    t.give(p, ITEMS.OUTBREAK, 1, 0, true);
    p.lookAtBlock({ x: 11, y: 1, z: 11 });
    await t.wait(4);
    p.useItemInSlotOnBlock(0, { x: 11, y: 1, z: 11 }, "Up", { x: 0.5, y: 1, z: 0.5 });
    await t.waitUntil(() => t.entities({ type: "pas:parasite" }).length >= 1, 20);
    removePlayer(t, p);
    await t.api("runGeneration");
    await t.waitUntil(() => t.entities({ type: "pas:parasite" }).length >= 2, 40);
    // a cow in a sealed glass cage, infected through the api (mid-incubation at the stop)
    for (let x = 18; x <= 22; x++) for (let y = 2; y <= 4; y++) for (let z = 18; z <= 22; z++) {
      const edge = x === 18 || x === 22 || z === 18 || z === 22 || y === 4;
      if (edge && x <= 22 && z <= 22) t.set({ x, y, z }, "minecraft:glass");
    }
    const cow = t.spawn("minecraft:cow", { x: 20, y: FEET, z: 20 });
    await t.wait(5);
    const inf = await t.api("infect", { $entity: cow.id });
    t.check(inf === true && cow.hasTag(TAGS.INCUBATING), `cow infected (${inf})`);
    await t.wait(120); // let timers run and the add-on save (state <= 100 ticks, torch cells <= 20 ticks)
    const lights = [];
    for (let x = 1; x <= 22; x++) for (let y = 2; y <= 5; y++) for (let z = 1; z <= 22; z++) {
      const b = t.block({ x, y, z });
      if (b && b.typeId === LIGHT) lights.push(t.w({ x, y, z }));
    }
    t.check(lights.length > 0, `torch light blocks present before the stop (${lights.length})`);
    const st = await outbreakState(t);
    const cfg = await t.api("getConfig");
    const props = (await t.bridge("entityProps", { entity: cow.id })).props;
    const torchProp = await t.bridge("worldProp", { key: "pas:torch_cells" });
    const parasites = t.entities({ type: "pas:parasite" });
    t.check(st.active && st.generation === 1 && parasites.length === 2, `generation 1 with 2 parasites (${st.generation}, ${parasites.length})`);
    t.check(typeof props["pas:inc_ticks"] === "number" && props["pas:inc_ticks"] > 0, `cow pas:inc_ticks = ${props["pas:inc_ticks"]}`);
    const record = {
      tick: system.currentTick,
      state: { active: st.active, paused: st.paused, generation: st.generation, ticksToNext: st.ticksToNext, epoch: st.epoch },
      config: cfg,
      cow: { id: cow.id, loc: cow.location, incTicks: props["pas:inc_ticks"], incTotal: props["pas:inc_total"] },
      parasites: parasites.map((e) => e.id),
      area: { lo, hi },
      lights,
      torchCells: torchProp.json,
    };
    handoffSet("reload", record);
    t.info(`record ${JSON.stringify(record)}`);
    if (t.failures.length) return; // FAIL is reported; the after-reload test will report the missing setup
    await t.readyForReload(`generation ${st.generation}, ticksToNext ${st.ticksToNext}, cow inc ${props["pas:inc_ticks"]}, ${lights.length} lights`);
  },
);

defineTest(
  {
    name: "reload_after",
    phase: "after_reload",
    structure: "pastest:flat",
    subsystem: "outbreak",
    bridge: true,
    maxTicks: 2400,
    description: "after stop + restart: config, outbreak state, incubation props persist; next generation on time; old torch lights cleaned up",
  },
  async (t) => {
    const h = handoffGet("reload");
    if (!h) t.assert(false, "no record from reload_pre (pre-reload phase did not complete)");
    const startTick = system.currentTick;
    const st = await outbreakState(t);
    const cfg = await t.api("getConfig");
    t.info(`after restart: tick ${startTick}, state ${JSON.stringify(st)}`);
    for (const [k, v] of Object.entries(h.config)) t.check(cfg[k] === v, `config ${k} persisted (${cfg[k]} vs ${v})`);
    t.check(st.active === true && st.paused === false && st.generation === h.state.generation && st.epoch === h.state.epoch,
      `outbreak state persisted (active ${st.active}, generation ${st.generation}/${h.state.generation}, epoch ${st.epoch}/${h.state.epoch})`);
    // the countdown resumed from the saved value (saved at least every 100 ticks), it was not reset
    t.check(st.ticksToNext <= h.state.ticksToNext + 100 && st.ticksToNext > 0,
      `ticksToNext resumed (${st.ticksToNext} now, ${h.state.ticksToNext} at the stop, reset would be ${h.config.replicationSeconds * 20})`);
    // old torch lights
    const leftLights = h.lights.filter((l) => t.dim.getBlock(l)?.typeId === LIGHT);
    t.check(leftLights.length === 0, `torch light blocks from before the restart are gone (${leftLights.length}/${h.lights.length} left: ${leftLights.map(fmt).join(" ")})`);
    try {
      const tp = await t.bridge("worldProp", { key: "pas:torch_cells" });
      t.check(!tp.json || (Array.isArray(tp.json) && tp.json.length === 0), `pas:torch_cells emptied (${JSON.stringify(tp.json)})`);
    } catch (e) {
      t.info(`torch_cells not read: ${e.message}`);
    }
    // cow mid-incubation
    const cow = world.getEntity(h.cow.id);
    t.check(valid(cow) && cow.typeId === "minecraft:cow" && cow.hasTag(TAGS.INCUBATING), `cow still incubating after restart (${cow ? cow.typeId : "not found"})`);
    let incNow;
    if (valid(cow)) {
      incNow = (await t.bridge("entityProps", { entity: cow.id })).props["pas:inc_ticks"];
      t.check(typeof incNow === "number" && incNow > 0 && incNow <= h.cow.incTicks + 20, `pas:inc_ticks persisted (${incNow} now, ${h.cow.incTicks} at the stop)`);
    }
    // next generation and the conversion, measured against the restored timers
    const t0 = system.currentTick;
    let genAt;
    let convAt;
    let cowLoc = valid(cow) ? cow.location : h.cow.loc;
    for (;;) {
      const s = await outbreakState(t);
      if (genAt === undefined && s.generation > h.state.generation) genAt = system.currentTick - t0;
      if (convAt === undefined && !valid(cow)) {
        const ic = t.dim.getEntities({ type: "pas:infected_cow", location: cowLoc, maxDistance: 3 });
        if (ic.length) convAt = system.currentTick - t0;
      } else if (valid(cow)) cowLoc = cow.location;
      if ((genAt !== undefined && (convAt !== undefined || incNow === undefined)) || system.currentTick - t0 > 1500) break;
      await t.wait(5);
    }
    t.check(genAt !== undefined && Math.abs(genAt - st.ticksToNext) <= 60, `next generation at the restored time (after ${genAt} ticks, expected ~${st.ticksToNext})`);
    const nPar = t.dim.getEntities({ type: "pas:parasite", location: h.cow.loc, maxDistance: 40 }).length;
    t.check(nPar === h.parasites.length * 2, `parasites doubled after the generation (${nPar}, want ${h.parasites.length * 2})`);
    if (incNow !== undefined) t.check(convAt !== undefined && Math.abs(convAt - incNow) <= 60, `cow converted when its restored incubation ran out (after ${convAt} ticks, expected ~${incNow})`);
    // leave a clean world
    t.outbreakCmd("cleanup");
    await t.api("setConfig", DEFAULT_CONFIG);
    t.cmd("tickingarea remove pastest_reload");
  },
);
