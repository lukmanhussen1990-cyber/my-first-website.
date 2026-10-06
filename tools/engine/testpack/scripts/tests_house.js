// d. Luxury base on a flat 24x24 grass platform (structure pastest:grass_platform,
// grass floor at test-relative y 1, air up to y 16).
//
// Expected geometry (SPEC §6 + docs/HOUSE.md): the house extends away from the
// player, entrance toward the player; canonical +z (south) is the entrance side,
// so a player facing north gets 0 clockwise quarter turns, east 1, south 2, west 3
// (clockwise seen from above).  The clicked ground column holds the terrace cell
// in front of the entrance (local entrance + 1 toward the entrance side) and the
// foundation (local y 0) sits on top of the ground.  The canonical layout comes
// from the add-on's own luxury_base.mcstructure (house_expect.js, generated at
// install time by tools/engine/house_expect.py).
import { defineTest, FEET } from "./harness.js";
import { ITEMS, freshPlayer, fmt } from "./common.js";

const DIRS = { north: { x: 0, z: -1 }, east: { x: 1, z: 0 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 } };
const Q = { north: 0, east: 1, south: 2, west: 3 };

/** canonical local (x,z) -> offset in the box rotated q quarter turns clockwise (from above). */
function rot(l, size, q) {
  const [sx, , sz] = size;
  switch (q) {
    case 1:
      return { x: sz - 1 - l.z, y: l.y, z: l.x };
    case 2:
      return { x: sx - 1 - l.x, y: l.y, z: sz - 1 - l.z };
    case 3:
      return { x: l.z, y: l.y, z: sx - 1 - l.x };
    default:
      return { x: l.x, y: l.y, z: l.z };
  }
}

/** Layout of one facing inside the 24x24 platform (test-relative coordinates). */
function layout(H, facing) {
  const q = Q[facing];
  const [sx, sy, sz] = H.size;
  const rs = q % 2 ? { x: sz, z: sx } : { x: sx, z: sz };
  const origin = { x: Math.floor((24 - rs.x) / 2), y: 2, z: Math.floor((24 - rs.z) / 2) };
  const anchor = { x: H.entrance.x, y: 0, z: Math.min(H.entrance.z + 1, sz - 1) };
  const ao = rot(anchor, H.size, q);
  const ground = { x: origin.x + ao.x, y: 1, z: origin.z + ao.z };
  const d = DIRS[facing];
  const stand = { x: ground.x - 3 * d.x, y: FEET, z: ground.z - 3 * d.z };
  return { q, rs, origin, ground, stand, height: sy };
}

let H;
async function expectData(t) {
  if (!H) {
    try {
      H = (await import("./house_expect.js")).HOUSE_EXPECT;
    } catch (e) {
      t.pending(`house_expect.js not generated (${e})`);
    }
  }
  return H;
}

const doorDir = (canonical, q) => (canonical + q) % 4; // door direction 0E 1S 2W 3N; clockwise = +1
const bedDir = (canonical, q) => (canonical + q) % 4; // bed direction 0S 1W 2N 3E; clockwise = +1

/** Fraction of non-void structure cells whose block type matches at `origin` (sampled every `step`). */
function matchScore(t, Hd, q, origin, step = 1) {
  const [sx, sy, sz] = Hd.size;
  let n = 0;
  let ok = 0;
  const bad = [];
  for (let x = 0; x < sx; x += step)
    for (let y = 0; y < sy; y++)
      for (let z = 0; z < sz; z += step) {
        const p = Hd.cells[(x * sy + y) * sz + z];
        if (p < 0) continue;
        const o = rot({ x, y, z }, Hd.size, q);
        const b = t.block({ x: origin.x + o.x, y: origin.y + o.y, z: origin.z + o.z });
        n++;
        if (b && b.typeId === Hd.palette[p]) ok++;
        else if (bad.length < 4) bad.push(`local ${x},${y},${z} want ${Hd.palette[p]} got ${b?.typeId}`);
      }
  return { score: n ? ok / n : 0, bad };
}

function houseTest(facing) {
  defineTest(
    {
      name: `house_${facing}`,
      structure: "pastest:grass_platform",
      subsystem: "house",
      maxTicks: 900,
      description: `spawner used on the ground by a player facing ${facing}: house built away from the player, door facing them, beds/chests/work blocks intact`,
    },
    async (t) => {
      const Hd = await expectData(t);
      const L = layout(Hd, facing);
      const p = await freshPlayer(t, `PasHouse${facing[0].toUpperCase()}`, L.stand);
      t.give(p, ITEMS.BASE_SPAWNER, 2, 0, true);
      p.lookAtBlock(L.ground);
      await t.wait(6);
      const rotY = p.getRotation().y;
      t.info(`player at ${fmt(t.rel(p.location))} yaw ${rotY.toFixed(1)} clicking ground ${fmt(L.ground)} (expected origin ${fmt(L.origin)} q=${L.q})`);
      const used = p.useItemInSlotOnBlock(0, L.ground, "Up", { x: 0.5, y: 1, z: 0.5 });
      t.info(`useItemInSlotOnBlock -> ${used}`);
      const secs = (Hd.buildSeconds ?? 7) + 2;
      await t.wait(secs * 20);
      let s = matchScore(t, Hd, L.q, L.origin);
      if (s.score < 0.99) {
        const late = await t.waitUntil(() => matchScore(t, Hd, L.q, L.origin, 3).score >= 0.99, 200, 20);
        t.info(`house complete ${late.ok ? `only ${late.ticks} ticks after buildSeconds+2s` : "never"}`);
        s = matchScore(t, Hd, L.q, L.origin);
      }
      t.check(s.score >= 0.99, `house blocks at the expected rotated place after buildSeconds+2 s: ${(s.score * 100).toFixed(1)}% match ${s.bad.join("; ")}`);
      if (s.score < 0.5) {
        // diagnose: is the house somewhere else / turned the wrong way?
        for (let q = 0; q < 4; q++)
          for (let dx = -4; dx <= 4; dx++)
            for (let dz = -4; dz <= 4; dz++) {
              const o = { x: L.origin.x + dx, y: L.origin.y, z: L.origin.z + dz };
              const r = matchScore(t, Hd, q, o, 3);
              if (r.score > 0.9) t.info(`house found with q=${q} at origin ${fmt(o)} (${(r.score * 100).toFixed(0)}%)`);
            }
      }
      // front door: the two lowest doors facing canonical north (direction 3) at the entrance
      const front = Hd.doors.filter((d) => d.y === Hd.entrance.y && d.direction === 3);
      t.check(front.length === 2, `structure has a double front door (${front.length})`);
      for (const d of [...front, ...Hd.doors.filter((x) => x.upper && x.y === Hd.entrance.y + 1 && x.direction === 3)]) {
        const o = rot(d, Hd.size, L.q);
        const b = t.block({ x: L.origin.x + o.x, y: L.origin.y + o.y, z: L.origin.z + o.z });
        const dir = b?.typeId === d.name ? b.permutation.getState("direction") : undefined;
        const upper = b?.typeId === d.name ? b.permutation.getState("upper_block_bit") : undefined;
        t.check(
          b?.typeId === d.name && dir === doorDir(3, L.q) && upper === d.upper,
          `front door ${d.upper ? "upper" : "lower"} at ${fmt({ x: L.origin.x + o.x, y: L.origin.y + o.y, z: L.origin.z + o.z })}: ${b?.typeId} direction ${dir} (want ${doorDir(3, L.q)} = faces ${facing}, into the house)`,
        );
      }
      // the entrance cell lies between the door and the player
      const ent = rot(Hd.entrance, Hd.size, L.q);
      const entRel = { x: L.origin.x + ent.x, z: L.origin.z + ent.z };
      const dEnt = Math.hypot(entRel.x - L.stand.x, entRel.z - L.stand.z);
      const doorRel = rot(front[0] ?? Hd.entrance, Hd.size, L.q);
      const dDoor = Math.hypot(L.origin.x + doorRel.x - L.stand.x, L.origin.z + doorRel.z - L.stand.z);
      t.check(dEnt < dDoor, `entrance (${fmt(entRel)}) is closer to the player than the door (${dEnt.toFixed(1)} < ${dDoor.toFixed(1)})`);
      // beds: head + foot pairs
      let bedsOk = 0;
      for (const bd of Hd.beds) {
        const o = rot(bd, Hd.size, L.q);
        const at = { x: L.origin.x + o.x, y: L.origin.y + o.y, z: L.origin.z + o.z };
        const b = t.block(at);
        if (b?.typeId !== "minecraft:bed") continue;
        const dir = b.permutation.getState("direction");
        const head = b.permutation.getState("head_piece_bit");
        const fwd = [{ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }, { x: 1, z: 0 }][dir]; // 0S 1W 2N 3E
        const other = head ? { x: at.x - fwd.x, y: at.y, z: at.z - fwd.z } : { x: at.x + fwd.x, y: at.y, z: at.z + fwd.z };
        const ob = t.block(other);
        if (dir === bedDir(bd.direction, L.q) && head === bd.head && ob?.typeId === "minecraft:bed" && ob.permutation.getState("head_piece_bit") === !head) bedsOk++;
      }
      t.check(bedsOk === Hd.beds.length, `beds intact as rotated head+foot pairs: ${bedsOk}/${Hd.beds.length} halves`);
      // chests with starter items
      let chestsOk = 0;
      const chestBad = [];
      for (const c of Hd.chests) {
        const o = rot(c, Hd.size, L.q);
        const b = t.block({ x: L.origin.x + o.x, y: L.origin.y + o.y, z: L.origin.z + o.z });
        const inv = b?.typeId === "minecraft:chest" ? b.getComponent("minecraft:inventory") : undefined;
        if (!inv) {
          chestBad.push(`${fmt(o)} ${b?.typeId} no inventory`);
          continue;
        }
        const got = {};
        for (let i = 0; i < inv.container.size; i++) {
          const it = inv.container.getItem(i);
          if (it) got[it.typeId] = (got[it.typeId] ?? 0) + it.amount;
        }
        const want = c.items;
        const same = Object.keys(want).every((k) => got[k] === want[k]) && Object.keys(got).every((k) => want[k] === got[k]);
        if (same) chestsOk++;
        else chestBad.push(`want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
      }
      t.check(chestsOk === Hd.chests.length, `chests have an inventory with the starter items: ${chestsOk}/${Hd.chests.length} ${chestBad.slice(0, 2).join("; ")}`);
      // work blocks
      const wb = Hd.workBlocks.filter((w) => ["minecraft:crafting_table", "minecraft:furnace"].includes(w.name));
      const wbOk = wb.filter((w) => {
        const o = rot(w, Hd.size, L.q);
        return t.block({ x: L.origin.x + o.x, y: L.origin.y + o.y, z: L.origin.z + o.z })?.typeId === w.name;
      }).length;
      t.check(wb.length > 0 && wbOk === wb.length, `crafting table / furnaces present: ${wbOk}/${wb.length}`);
      const left = t.items(p)[ITEMS.BASE_SPAWNER] ?? 0;
      t.check(left === 1, `one spawner consumed in survival (2 -> ${left})`);
    },
  );
}

for (const f of ["north", "east", "south", "west"]) houseTest(f);

defineTest(
  {
    name: "house_blocked",
    structure: "pastest:grass_platform",
    subsystem: "house",
    maxTicks: 600,
    description: "a stone pillar inside the footprint: no block changes and the spawner is not consumed",
  },
  async (t) => {
    const Hd = await expectData(t);
    const L = layout(Hd, "north");
    for (let y = 2; y <= 4; y++) t.set({ x: 12, y, z: 10 }, "minecraft:stone");
    await t.wait(2);
    const snap = new Map();
    for (let x = 0; x < 24; x++)
      for (let y = 1; y < 16; y++)
        for (let z = 0; z < 24; z++) {
          const b = t.block({ x, y, z });
          snap.set(`${x},${y},${z}`, b?.typeId);
        }
    const p = await freshPlayer(t, "PasHouseX", L.stand);
    t.give(p, ITEMS.BASE_SPAWNER, 2, 0, true);
    p.lookAtBlock(L.ground);
    await t.wait(6);
    p.useItemInSlotOnBlock(0, L.ground, "Up", { x: 0.5, y: 1, z: 0.5 });
    await t.wait(((Hd.buildSeconds ?? 7) + 2) * 20);
    const diff = [];
    for (const [k, v] of snap) {
      const [x, y, z] = k.split(",").map(Number);
      const now = t.block({ x, y, z })?.typeId;
      if (now !== v && !(v === "minecraft:air" && now === undefined)) diff.push(`${k}: ${v} -> ${now}`);
    }
    t.check(diff.length === 0, `no block changed (${diff.length} changed: ${diff.slice(0, 4).join("; ")})`);
    const left = t.items(p)[ITEMS.BASE_SPAWNER] ?? 0;
    t.check(left === 2, `spawner not consumed (2 -> ${left})`);
  },
);
