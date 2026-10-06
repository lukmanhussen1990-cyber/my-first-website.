// a. packs load, b. starting kit
import { ItemStack } from "@minecraft/server";
import { defineTest, FEET } from "./harness.js";
import { ENTITIES, ITEMS, KIT, valid } from "./common.js";
import { bridgeAvailable } from "./bridge.js";

defineTest(
  {
    name: "packs_load",
    subsystem: "core",
    description: "all 7 pas entities spawn (pas_horde family), all 5 items construct; content log checked by the runner",
  },
  async (t) => {
    let x = 1;
    for (const id of ENTITIES) {
      let e;
      try {
        e = t.spawn(id, { x, y: FEET, z: 5 });
      } catch (err) {
        t.check(false, `spawnEntity(${id}) threw ${err}`);
        continue;
      }
      await t.wait(1);
      const fam = e.getComponent("minecraft:type_family");
      t.check(valid(e) && e.typeId === id && !!fam && fam.hasTypeFamily("pas_horde"), `${id} spawns with family pas_horde`);
      x += 1;
    }
    await t.wait(5);
    t.clearEntities();
    const stacks = {
      [ITEMS.TORCH_OFF]: 1,
      [ITEMS.TORCH_ON]: 1,
      [ITEMS.BASE_SPAWNER]: 16,
      [ITEMS.OUTBREAK]: 16,
      [ITEMS.CONTROL]: 1,
    };
    for (const [id, max] of Object.entries(stacks)) {
      try {
        const s = new ItemStack(id, 1);
        t.check(s.typeId === id && s.maxAmount === max, `new ItemStack(${id}) ok, maxAmount ${s.maxAmount} (want ${max})`);
      } catch (err) {
        t.check(false, `new ItemStack(${id}) threw ${err}`);
      }
    }
    t.info(`bridge available: ${await bridgeAvailable()}`);
  },
);

defineTest(
  {
    name: "starting_kit",
    subsystem: "kit",
    bridge: false,
    maxTicks: 400,
    description: "a new player gets exactly one of each of the 4 kit items, and nothing again after death + respawn",
  },
  async (t) => {
    const p = t.player("PasKit", { x: 6, y: FEET, z: 6 }, "survival");
    try {
      const w = t.w({ x: 6, y: FEET, z: 6 });
      p.setSpawnPoint({ dimension: t.dim, x: w.x + 0.5, y: w.y, z: w.z + 0.5 });
    } catch (e) {
      t.info(`setSpawnPoint failed: ${e}`);
    }
    const r = await t.waitUntil(() => KIT.every((id) => (t.items(p)[id] ?? 0) > 0), 60);
    const items = t.items(p);
    t.info(`inventory after ${r.ticks} ticks: ${JSON.stringify(items)}`);
    for (const id of KIT) t.check(items[id] === 1, `kit contains exactly one ${id} (got ${items[id] ?? 0})`);
    const total = Object.values(items).reduce((a, b) => a + b, 0);
    t.check(total === 4, `inventory holds exactly the 4 kit items (total ${total})`);
    try {
      const props = await t.bridge("entityProps", { entity: p.id });
      t.check(props.props["pas:kit_v1"] === true, `player property pas:kit_v1 = ${props.props["pas:kit_v1"]}`);
    } catch (e) {
      t.info(`kit property not checked: ${e.message}`);
    }
    await t.wait(10);
    t.check(Object.values(t.items(p)).reduce((a, b) => a + b, 0) === 4, "kit not given twice while alive");
    // death + respawn
    p.kill();
    await t.wait(30);
    let ok = false;
    try {
      ok = p.respawn();
    } catch (e) {
      t.info(`respawn threw ${e}`);
    }
    t.info(`respawn() -> ${ok}`);
    await t.waitUntil(() => {
      const h = p.getComponent("minecraft:health");
      return h && h.currentValue > 0;
    }, 60);
    await t.wait(60);
    const after = t.items(p);
    const kitAfter = KIT.reduce((n, id) => n + (after[id] ?? 0), 0);
    t.check(kitAfter === 0, `no kit items after respawn (keepInventory off): ${JSON.stringify(after)}`);
  },
);
