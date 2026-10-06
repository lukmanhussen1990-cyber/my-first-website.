// c. Tactical Torchlight in a dark closed room (structure pastest:dark_room).
// Room interior (test-relative): x 1..13, y 2..7, z 1..13; walls at x/z 0 and 14,
// floor y 1, roof y 8.
import { ItemStack } from "@minecraft/server";
import { defineTest, FEET } from "./harness.js";
import { ITEMS, LIGHT, freshPlayer, removePlayer, fmt } from "./common.js";

const ROOM = { x0: 0, x1: 14, y0: 1, y1: 8, z0: 0, z1: 14 };

function lightLevel(b) {
  try {
    if (!b || b.typeId !== LIGHT) return undefined;
    return b.permutation.getState("block_light_level");
  } catch {
    return undefined;
  }
}

/** All light blocks inside the room: [{rel, level}]. */
function lights(t) {
  const out = [];
  for (let x = ROOM.x0 + 1; x < ROOM.x1; x++)
    for (let y = ROOM.y0 + 1; y < ROOM.y1; y++)
      for (let z = ROOM.z0 + 1; z < ROOM.z1; z++) {
        const b = t.block({ x, y, z });
        if (b && b.typeId === LIGHT) out.push({ rel: { x, y, z }, level: lightLevel(b) });
      }
  return out;
}

const near = (a, b, r) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z)) <= r;
const desc = (ls) => ls.map((l) => `${fmt(l.rel)}=${l.level}`).join(" ");

/** Snapshot of every non-air, non-light cell of the room box (walls included). */
function snapshot(t) {
  const m = new Map();
  for (let x = ROOM.x0; x <= ROOM.x1; x++)
    for (let y = ROOM.y0; y <= ROOM.y1; y++)
      for (let z = ROOM.z0; z <= ROOM.z1; z++) {
        const b = t.block({ x, y, z });
        if (b && b.typeId !== "minecraft:air" && b.typeId !== LIGHT) m.set(`${x},${y},${z}`, b.typeId);
      }
  return m;
}
function changed(t, snap) {
  const bad = [];
  for (const [k, typeId] of snap) {
    const [x, y, z] = k.split(",").map(Number);
    const now = t.block({ x, y, z })?.typeId;
    if (now !== typeId) bad.push(`${k}: ${typeId} -> ${now}`);
  }
  return bad;
}

async function torchOn(t, p) {
  t.give(p, ITEMS.TORCH_OFF, 1, 0, true);
  await t.wait(8);
  p.useItemInSlot(0);
  const r = await t.waitUntil(() => t.inv(p).getItem(0)?.typeId === ITEMS.TORCH_ON, 20);
  return r.ok;
}

defineTest(
  {
    name: "torch_toggle",
    structure: "pastest:dark_room",
    subsystem: "torch",
    maxTicks: 300,
    description: "use toggles off->on->off in the same slot, keeps name/lore; two uses 2 ticks apart toggle once (debounce)",
  },
  async (t) => {
    const p = await freshPlayer(t, "PasTorchA", { x: 7, y: FEET, z: 7 });
    const s = new ItemStack(ITEMS.TORCH_OFF, 1);
    s.nameTag = "Beam";
    s.setLore(["engine test"]);
    p.setItem(s, 0, true);
    await t.wait(8);
    p.useItemInSlot(0);
    const r1 = await t.waitUntil(() => t.inv(p).getItem(0)?.typeId === ITEMS.TORCH_ON, 20);
    t.check(r1.ok, `use -> slot 0 holds ${ITEMS.TORCH_ON} after ${r1.ticks} ticks (got ${t.inv(p).getItem(0)?.typeId})`);
    const on = t.inv(p).getItem(0);
    t.check(on?.nameTag === "Beam" && JSON.stringify(on?.getLore()) === '["engine test"]', `name/lore kept (${on?.nameTag}, ${JSON.stringify(on?.getLore())})`);
    await t.wait(10);
    p.useItemInSlot(0);
    const r2 = await t.waitUntil(() => t.inv(p).getItem(0)?.typeId === ITEMS.TORCH_OFF, 20);
    t.check(r2.ok, `second use -> back to ${ITEMS.TORCH_OFF} (got ${t.inv(p).getItem(0)?.typeId})`);
    await t.wait(10);
    p.useItemInSlot(0);
    await t.wait(2);
    p.useItemInSlot(0);
    await t.wait(12);
    t.check(t.inv(p).getItem(0)?.typeId === ITEMS.TORCH_ON, `two uses 2 ticks apart toggle exactly once (got ${t.inv(p).getItem(0)?.typeId})`);
    t.check(t.inv(p).getItem(0)?.amount === 1, "still exactly one torch");
  },
);

defineTest(
  {
    name: "torch_beam",
    structure: "pastest:dark_room",
    subsystem: "torch",
    maxTicks: 600,
    description:
      "lit torch: light_block 15 in the air cell in front of the wall within 1 s, lights follow the view, never replace grass/water/chest, slot switch removes all",
  },
  async (t) => {
    // props near the beam paths (set before the player arrives)
    t.set({ x: 7, y: 2, z: 8 }, "minecraft:short_grass");
    t.set({ x: 7, y: 0, z: 11 }, "minecraft:stone");
    t.set({ x: 7, y: 1, z: 11 }, "minecraft:water", { liquid_depth: 0 });
    t.set({ x: 12, y: 3, z: 3 }, "minecraft:chest", { "minecraft:cardinal_direction": "west" });
    await t.wait(2);
    const chestInv = t.block({ x: 12, y: 3, z: 3 }).getComponent("minecraft:inventory");
    chestInv.container.setItem(0, new ItemStack("minecraft:apple", 5));
    const snap = snapshot(t);
    t.info(`snapshot: ${snap.size} non-air cells`);
    const p = await freshPlayer(t, "PasTorchB", { x: 7, y: FEET, z: 3 });
    t.check(lights(t).length === 0, "no light blocks before the torch is on");
    t.assert(await torchOn(t, p), "torch switched on");

    // A: bare south wall
    p.lookAtBlock({ x: 7, y: 3, z: 14 });
    const spotA = { x: 7, y: 3, z: 13 };
    const a = await t.waitUntil(() => lightLevel(t.block(spotA)) === 15, 20, 1);
    t.info(`view dir ${fmt(p.getViewDirection())} head ${fmt(t.rel(p.getHeadLocation()))}; lights: ${desc(lights(t))}`);
    t.check(a.ok, `A: light_block level 15 in the air cell in front of the south wall ${fmt(spotA)} within 20 ticks (after ${a.ticks})`);
    t.check(lights(t).length <= 3 && lights(t).length >= 1, `A: 1..3 anchors (got ${lights(t).length})`);

    // B: floor cell holding short grass
    p.lookAtLocation({ x: 7.5, y: 2.0, z: 8.5 });
    await t.wait(10);
    const lb = lights(t);
    t.info(`B lights: ${desc(lb)}`);
    t.check(lightLevel(t.block(spotA)) === undefined, `B: old spot ${fmt(spotA)} cleared after turning`);
    t.check(t.block({ x: 7, y: 2, z: 8 }).typeId === "minecraft:short_grass", `B: grass at 7,2,8 intact (${t.block({ x: 7, y: 2, z: 8 }).typeId})`);
    t.check(lb.some((l) => l.level === 15 && near(l.rel, { x: 7, y: 2, z: 8 }, 2)), "B: a level-15 light within 2 cells of the grass spot");

    // C: water cell in the floor
    p.lookAtLocation({ x: 7.5, y: 2.0, z: 11.5 });
    await t.wait(10);
    const lc = lights(t);
    t.info(`C lights: ${desc(lc)}`);
    const wb = t.block({ x: 7, y: 1, z: 11 });
    t.check(wb.typeId === "minecraft:water", `C: water source intact (${wb.typeId})`);
    t.check(lc.some((l) => l.level === 15 && near(l.rel, { x: 7, y: 1, z: 11 }, 2)), "C: a level-15 light within 2 cells of the water spot");

    // D: chest at eye height
    p.lookAtBlock({ x: 12, y: 3, z: 3 });
    const spotD = { x: 11, y: 3, z: 3 };
    const d = await t.waitUntil(() => lightLevel(t.block(spotD)) === 15, 20, 1);
    t.info(`D lights: ${desc(lights(t))}`);
    t.check(d.ok, `D: level-15 light in front of the chest ${fmt(spotD)}`);
    const chest = t.block({ x: 12, y: 3, z: 3 });
    const apple = chest.getComponent("minecraft:inventory")?.container.getItem(0);
    t.check(chest.typeId === "minecraft:chest" && apple?.typeId === "minecraft:apple" && apple?.amount === 5, "D: chest and its content intact");
    t.check(lights(t).every((l) => !near(l.rel, { x: 7, y: 2, z: 8 }, 0)), "D: no light left at old spots");

    // E: hotbar switch
    p.selectedSlotIndex = 1;
    const e = await t.waitUntil(() => lights(t).length === 0, 20, 1);
    t.check(e.ok, `E: switching hotbar slot removes all light blocks (after ${e.ticks} ticks; left: ${desc(lights(t))})`);
    const bad = changed(t, snap);
    t.check(bad.length === 0, `no non-air block was replaced (${bad.slice(0, 5).join("; ")})`);
  },
);

defineTest(
  {
    name: "torch_cleanup_death",
    structure: "pastest:dark_room",
    subsystem: "torch",
    maxTicks: 300,
    description: "player death removes the player's light blocks",
  },
  async (t) => {
    const p = await freshPlayer(t, "PasTorchC", { x: 7, y: FEET, z: 3 });
    t.assert(await torchOn(t, p), "torch switched on");
    p.lookAtBlock({ x: 7, y: 3, z: 14 });
    const r = await t.waitUntil(() => lights(t).length > 0, 20, 1);
    t.assert(r.ok, `lights placed before death (${desc(lights(t))})`);
    p.kill();
    const g = await t.waitUntil(() => lights(t).length === 0, 20, 1);
    t.check(g.ok, `all lights removed within 20 ticks of death (after ${g.ticks}; left ${desc(lights(t))})`);
    try {
      const info = await t.bridge("torch");
      t.info(`torch internals: ${JSON.stringify(info)}`);
    } catch (e) {
      t.info(`no torch internals: ${e.message}`);
    }
  },
);

defineTest(
  {
    name: "torch_cleanup_leave",
    structure: "pastest:dark_room",
    subsystem: "torch",
    maxTicks: 300,
    description: "a player leaving the game removes the player's light blocks",
  },
  async (t) => {
    const p = await freshPlayer(t, "PasTorchD", { x: 7, y: FEET, z: 3 });
    t.assert(await torchOn(t, p), "torch switched on");
    p.lookAtBlock({ x: 7, y: 3, z: 14 });
    const r = await t.waitUntil(() => lights(t).length > 0, 20, 1);
    t.assert(r.ok, `lights placed before leaving (${desc(lights(t))})`);
    removePlayer(t, p);
    const g = await t.waitUntil(() => lights(t).length === 0, 20, 1);
    t.check(g.ok, `all lights removed within 20 ticks of leaving (after ${g.ticks}; left ${desc(lights(t))})`);
  },
);
