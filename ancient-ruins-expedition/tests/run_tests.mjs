// Scenario tests for the Ancient Ruins Expedition scripts.
//   node --import ./tests/register.mjs tests/run_tests.mjs
// Places the real generated ruins (some rotated) into a mock world and drives
// the scripts through discovery, puzzles, traps, bosses, vaults and relics.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { advance, BlockPermutation, fire, Player, sim, world } from "@minecraft/server";
import { ui } from "@minecraft/server-ui";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
await import("../packs/AncientRuins_BP/scripts/main.js");
const registry = await import("../packs/AncientRuins_BP/scripts/registry.js");

// ---------------------------------------------------------------------------
let passed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) passed++;
  else failures.push(`${name}${detail ? ` -> ${detail}` : ""}`);
}

const structDir = mkdtempSync(join(tmpdir(), "ruins-"));
execFileSync("python3", [join(ROOT, "tools/export_structures.py"),
  join(ROOT, "packs/AncientRuins_BP/structures/ancient_ruins"), structDir]);
const STRUCTS = Object.fromEntries(readdirSync(structDir).map((f) =>
  [f.replace(".json", ""), JSON.parse(readFileSync(join(structDir, f), "utf8"))]));

const overworld = world.getDimension("overworld");
const DIRS = ["north", "east", "south", "west"];
const FD = { 2: "north", 3: "south", 4: "west", 5: "east" };
const FDR = { north: 2, south: 3, west: 4, east: 5 };
const rotDir = (d, r) => (DIRS.includes(d) ? DIRS[(DIRS.indexOf(d) + r) % 4] : d);

/** Place a structure with `rot` clockwise quarter turns; returns lookup helpers. */
function place(name, origin, rot = 0) {
  const data = STRUCTS[name];
  const [sx, , sz] = data.size;
  const cells = [];
  for (const [x0, y, z0, id, states0] of data.blocks) {
    let x = x0;
    let z = z0;
    let w = sx;
    let d = sz;
    for (let i = 0; i < rot; i++) {
      [x, z] = [d - 1 - z, x];
      [w, d] = [d, w];
    }
    const states = { ...states0 };
    if (typeof states.lever_direction === "string") states.lever_direction = rotDir(states.lever_direction, rot);
    if (typeof states.facing_direction === "number" && FD[states.facing_direction] && id !== "minecraft:ladder") {
      states.facing_direction = FDR[rotDir(FD[states.facing_direction], rot)];
    }
    if (states["minecraft:cardinal_direction"]) states["minecraft:cardinal_direction"] = rotDir(states["minecraft:cardinal_direction"], rot);
    const wx = origin.x + x;
    const wy = origin.y + y;
    const wz = origin.z + z;
    overworld.setPerm(wx, wy, wz, new BlockPermutation(id, states));
    cells.push({ x: wx, y: wy, z: wz, id });
  }
  return {
    cells,
    find: (id) => cells.filter((c) => c.id === id),
    findRe: (re) => cells.filter((c) => re.test(c.id)),
  };
}

const idAt = (p) => overworld.permAt(p.x, p.y, p.z).id;
const stateAt = (p, k) => overworld.permAt(p.x, p.y, p.z).states[k];
const nearRuin = (p) => registry.nearestRuin("minecraft:overworld", p, undefined, 45);

function newPlayer(name, loc) {
  const p = new Player(name, overworld, { ...loc });
  sim.players.push(p);
  return p;
}
function standOn(player, block) {
  player.location = { x: block.x + 0.5, y: block.y + 1, z: block.z + 0.5 };
}
function fireCore(ruin) {
  const [core] = ruin.find("minecraft:command_block");
  overworld.spawnEntity("ancient_ruins:ruin_marker", { x: core.x + 0.5, y: core.y + 1.5, z: core.z + 0.5 });
  advance(3);
  return core;
}
function glyphNumberNextTo(cell) {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
    const m = /_glyph_(\d)$/.exec(idAt({ x: cell.x + dx, y: cell.y + dy, z: cell.z + dz }));
    if (m) return Number(m[1]);
  }
  return 0;
}
function pullLever(player, lever) {
  overworld.setPerm(lever.x, lever.y, lever.z, overworld.permAt(lever.x, lever.y, lever.z).withState("open_bit", true));
  fire(world.afterEvents.leverAction, { block: overworld.getBlock(lever), dimension: overworld, isPowered: true, player });
}
function pushPlate(player, plate) {
  standOn(player, { x: plate.x, y: plate.y - 1, z: plate.z });
  fire(world.afterEvents.pressurePlatePush, { block: overworld.getBlock(plate), dimension: overworld, source: player, previousRedstonePower: 0, redstonePower: 15 });
}
function bossNear(p, type) {
  return overworld.getEntities({ type, location: p, maxDistance: 6 })[0];
}

// ---------------------------------------------------------------------------
// Lever ruin scenario (temple / ship), optionally rotated.
function leverRuinScenario(label, name, origin, rot, bossType) {
  const ruin = place(name, origin, rot);
  const core = fireCore(ruin);
  const r = nearRuin(core);
  check(`${label}: ruin registered from core`, r && r.pr === 1 && r.x === core.x && r.z === core.z, JSON.stringify(r));
  check(`${label}: core command block swapped for vault seal`, idAt(core) === "ancient_ruins:vault_seal", idAt(core));
  check(`${label}: marker removed`, overworld.getEntities({ type: "ancient_ruins:ruin_marker" }).length === 0);

  const player = newPlayer(`${label}-player`, { x: core.x + 12, y: core.y + 1, z: core.z });
  advance(45);
  const guardians = overworld.getEntities({ location: core, maxDistance: 6 }).filter((e) => e.typeId.endsWith("guardian") || e.typeId.endsWith("captain"));
  check(`${label}: guardians awakened near player`, guardians.length >= 2 && registry.getRuin(r.id).p === 1, `${guardians.length}`);

  const levers = ruin.find("minecraft:lever").map((l) => ({ ...l, n: glyphNumberNextTo(l) })).sort((a, b) => a.n - b.n);
  check(`${label}: four glyph levers`, levers.length === 4 && levers.map((l) => l.n).join("") === "1234", levers.map((l) => l.n).join(""));

  // Wrong order first: glyph 2 before glyph 1.
  const hpBefore = player.hp;
  pullLever(player, levers[1]);
  advance(12);
  check(`${label}: wrong lever resets`, stateAt(levers[1], "open_bit") === false && player.hp === hpBefore - 2,
    `open=${stateAt(levers[1], "open_bit")} hp=${player.hp}`);

  const altar = ruin.findRe(/_altar$/)[0];
  for (const l of levers) {
    pullLever(player, l);
    advance(2);
  }
  advance(2);
  const boss = bossNear(altar, bossType);
  check(`${label}: boss awakened on altar`, !!boss && idAt(altar) === "ancient_ruins:dormant_altar", `${idAt(altar)}`);
  check(`${label}: boss title shown`, player.titles.length > 0);
  if (!boss) return { ruin, player, core };
  const rr = registry.getRuin(r.id);
  check(`${label}: ruin tracks boss`, rr.a === 1 && rr.b === boss.id);

  // Special attack with the player in range.
  player.location = { x: boss.location.x + 3, y: boss.location.y, z: boss.location.z };
  const dmg = player.damage.length;
  const kb = player.knockbacks.length;
  fire(world.afterEvents.dataDrivenEntityTrigger, { entity: boss, eventId: "ancient_ruins:special_attack" },
    { entity: boss, eventId: "ancient_ruins:special_attack" });
  advance(22);
  check(`${label}: special attack hits`, player.damage.length > dmg || player.knockbacks.length > kb || player.effects.has("slowness"));
  check(`${label}: cast finished`, boss.events.includes("ancient_ruins:cast_done"));

  // Enrage once at half health.
  boss.hp = 70;
  fire(world.afterEvents.entityHurt, { hurtEntity: boss, damage: 5 }, { entity: boss });
  fire(world.afterEvents.entityHurt, { hurtEntity: boss, damage: 5 }, { entity: boss });
  check(`${label}: enraged exactly once`, boss.events.filter((e) => e === "ancient_ruins:enrage").length === 1);

  // Defeat: vault opens.
  boss.valid = false;
  fire(world.afterEvents.entityDie, { deadEntity: boss }, { entity: boss });
  const hatch = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) hatch.push(idAt({ x: core.x + dx, y: core.y, z: core.z + dz }));
  const fill = name === "sunken_ship" ? "minecraft:water" : "minecraft:air";
  check(`${label}: vault hatch opened`, hatch.every((id) => id === fill) && idAt(altar) === fill, hatch.join(","));
  check(`${label}: ruin conquered`, registry.getRuin(r.id).c === 1 && registry.getRuin(r.id).v === 1);
  const vaultChests = ruin.find("minecraft:chest").filter((c) => c.y < core.y && Math.abs(c.x - core.x) <= 3 && Math.abs(c.z - core.z) <= 3);
  check(`${label}: vault chests below hatch`, vaultChests.length === 2, `${vaultChests.length}`);
  return { ruin, player, core };
}

// ---------------------------------------------------------------------------
function arrowTrapScenario(label, ruin, player) {
  const traps = ruin.find("ancient_ruins:trap_mechanism");
  check(`${label}: has arrow traps`, traps.length >= 1);
  for (const t of traps) {
    const plate = { x: t.x, y: t.y + 1, z: t.z };
    const nearby = ruin.find("minecraft:dispenser").filter((d) => Math.abs(d.x - t.x) <= 5 && Math.abs(d.z - t.z) <= 5 && d.y - plate.y >= -1 && d.y - plate.y <= 2);
    const before = overworld.history.length;
    pushPlate(player, plate);
    advance(1);
    const pulses = overworld.history.slice(before).filter((h) => h.id === "minecraft:redstone_block");
    check(`${label}: trap at ${t.x},${t.z} powers ${nearby.length} dispensers`, nearby.length >= 2 && pulses.length === nearby.length,
      `pulses=${pulses.length} dispensers=${nearby.length}`);
    advance(20);
    const restored = pulses.every((p) => idAt(p) !== "minecraft:redstone_block");
    check(`${label}: trap blocks restored`, restored);
    const second = overworld.history.slice(before).filter((h) => h.id === "minecraft:redstone_block").length;
    check(`${label}: second volley`, second === 2 * nearby.length, `${second}`);
    // each dispenser really faces away from the block that was powered
    for (const p of pulses) {
      const disp = nearby.find((d) => Math.abs(d.x - p.x) + Math.abs(d.y - p.y) + Math.abs(d.z - p.z) === 1);
      const f = disp && stateAt(disp, "facing_direction");
      const v = { 2: [0, 0, -1], 3: [0, 0, 1], 4: [-1, 0, 0], 5: [1, 0, 0] }[f];
      const facesAway = v && disp.x - p.x === v[0] && disp.z - p.z === v[2];
      check(`${label}: pulse behind dispenser`, !!facesAway);
      // the dispenser should face into open space (the trap corridor/room)
      const front = disp && idAt({ x: disp.x + v[0], y: disp.y, z: disp.z + v[2] });
      check(`${label}: dispenser at ${disp?.x},${disp?.y},${disp?.z} faces open space`, ["minecraft:air", "minecraft:water"].includes(front), front);
    }
  }
}

function crumbleScenario(label, ruin, player, expectId) {
  const tiles = ruin.findRe(/crumbling|rotten_planks/);
  check(`${label}: has crumbling floor`, tiles.length > 0);
  standOn(player, tiles[0]);
  advance(20);
  const after = tiles.map(idAt);
  check(`${label}: floor collapsed`, after.every((id) => expectId.includes(id)), [...new Set(after)].join(","));
  player.location = { x: player.location.x, y: player.location.y + 50, z: player.location.z };
  advance(5);
}

function gasScenario(label, ruin, player) {
  const vents = ruin.find("ancient_ruins:miasma_vent");
  check(`${label}: has gas vents`, vents.length > 0);
  player.effects.clear();
  standOn(player, vents[Math.floor(vents.length / 2)]);
  advance(10);
  check(`${label}: poisoned on vents`, player.effects.has("poison"));
  const gas = overworld.particles.filter((p) => p.id === "ancient_ruins:poison_gas");
  check(`${label}: few gas particles`, gas.length > 0 && gas.length <= 4, `${gas.length}`);
  player.location = { x: player.location.x, y: player.location.y + 50, z: player.location.z };
  advance(5);
}

// ---------------------------------------------------------------------------
// 1. Jungle Temple (unrotated) - full run
const t = leverRuinScenario("temple", "jungle_temple", { x: 0, y: 60, z: 0 }, 0, "ancient_ruins:jade_idol");
arrowTrapScenario("temple", t.ruin, t.player);
crumbleScenario("temple", t.ruin, t.player, ["minecraft:sand"]);
gasScenario("temple", t.ruin, t.player);

// 2. Jungle Temple rotated 270 degrees - puzzle and traps are rotation independent
const t2 = leverRuinScenario("temple-rot270", "jungle_temple", { x: 0, y: 60, z: 600 }, 3, "ancient_ruins:jade_idol");
arrowTrapScenario("temple-rot270", t2.ruin, t2.player);

// 3. Sunken Ship rotated 180 degrees
const s = leverRuinScenario("ship-rot180", "sunken_ship", { x: 1200, y: 40, z: 0 }, 2, "ancient_ruins:abyssal_admiral");
arrowTrapScenario("ship-rot180", s.ruin, s.player);
crumbleScenario("ship-rot180", s.ruin, s.player, ["minecraft:air", "minecraft:water"]);

// 4. Desert Crypt rotated 90 degrees - pressure plate sequence
{
  const label = "crypt-rot90";
  const ruin = place("desert_crypt", { x: 600, y: 50, z: 0 }, 1);
  const core = fireCore(ruin);
  const r = nearRuin(core);
  check(`${label}: ruin registered`, r && r.pr === 1 && r.t === "desert_crypt");
  const player = newPlayer("crypt-player", { x: core.x + 10, y: core.y + 1, z: core.z });
  advance(45);
  const plates = ruin.find("minecraft:stone_pressure_plate")
    .map((p) => ({ ...p, n: Number((/_glyph_(\d)$/.exec(idAt({ x: p.x, y: p.y - 1, z: p.z })) || [])[1] || 0) }))
    .filter((p) => p.n).sort((a, b) => a.n - b.n);
  check(`${label}: four glyph plates`, plates.map((p) => p.n).join("") === "1234");
  pushPlate(player, plates[2]); // wrong
  advance(3);
  check(`${label}: wrong plate punished`, player.damage.length === 1);
  for (const p of plates) {
    pushPlate(player, p);
    advance(2);
  }
  advance(2);
  const altar = ruin.find("ancient_ruins:crypt_altar")[0];
  const boss = bossNear(altar, "ancient_ruins:sand_pharaoh");
  check(`${label}: pharaoh awakened`, !!boss && idAt(altar) === "ancient_ruins:dormant_altar");
  if (boss) {
    player.location = { x: boss.location.x + 4, y: boss.location.y, z: boss.location.z };
    fire(world.afterEvents.dataDrivenEntityTrigger, { entity: boss, eventId: "ancient_ruins:special_attack" },
      { entity: boss, eventId: "ancient_ruins:special_attack" });
    advance(22);
    const mummies = overworld.getEntities({ type: "ancient_ruins:crypt_mummy", location: boss.location, maxDistance: 16 });
    check(`${label}: pharaoh raises mummies (capped)`, mummies.length >= 1 && mummies.length <= 4, `${mummies.length}`);
    check(`${label}: sandstorm blinds`, player.effects.has("blindness"));
    boss.valid = false;
    fire(world.afterEvents.entityDie, { deadEntity: boss }, { entity: boss });
    check(`${label}: crypt vault opened`, idAt(core) === "minecraft:air" && registry.getRuin(r.id).c === 1);
  }
  arrowTrapScenario(label, ruin, player);
  crumbleScenario(label, ruin, player, ["minecraft:sand"]);
  gasScenario(label, ruin, player);
}

// 5. Backup discovery: marker entity stored in the structure (cause Loaded)
{
  const ruin = place("jungle_temple", { x: 0, y: 60, z: 1200 }, 0);
  const ent = STRUCTS.jungle_temple.entities[0];
  const e = overworld.spawnEntity(ent.identifier, { x: ent.pos[0], y: 60 + ent.pos[1], z: 1200 + ent.pos[2] });
  sim.queue.length = 0;
  fire(world.afterEvents.entityLoad, { entity: e }, { entity: e });
  advance(3);
  const [core] = ruin.find("minecraft:command_block");
  const r = nearRuin(core);
  check("structure marker registers ruin", r && r.pr === 1 && r.x === core.x && r.z === core.z);
}

// 6. Fallback discovery: command blocks disabled, the player walks in
{
  const ruin = place("jungle_temple", { x: 0, y: 60, z: 1800 }, 0);
  const floor = ruin.find("ancient_ruins:temple_floor")[40];
  const p = newPlayer("walker", { x: 0, y: 0, z: 0 });
  standOn(p, floor);
  advance(10);
  const r = nearRuin(floor);
  check("walking on ruin floor charts it (approx)", r && r.pr === 0 && p.chat.some((m) => m.includes("charted")));
  const levers = ruin.find("minecraft:lever").map((l) => ({ ...l, n: glyphNumberNextTo(l) })).sort((a, b) => a.n - b.n);
  for (const l of levers) {
    pullLever(p, l);
    advance(2);
  }
  advance(3);
  const [core] = ruin.find("minecraft:command_block");
  const rr = nearRuin(core);
  check("solving puzzle upgrades approx ruin to exact", rr && rr.id === r.id && rr.pr === 1 && rr.x === core.x);
  check("boss spawned without core", !!bossNear(ruin.find("ancient_ruins:temple_altar")[0] ?? core, "ancient_ruins:jade_idol") ||
    overworld.getEntities({ type: "ancient_ruins:jade_idol", location: core, maxDistance: 6 }).length === 1);
  p.valid = false;
}

// 7. Relics: compass direction, cursed ring, ancient map
{
  const target = nearRuin({ x: 0, y: 60, z: 0 });
  const p = newPlayer("explorer", { x: target.x + 60, y: target.y + 1, z: target.z });
  p.rotation = { x: 0, y: 90 }; // facing west, towards the ruin
  p.equipment.Mainhand = "ancient_ruins:ruin_compass";
  p.setDynamicProperty("ancient_ruins:track", target.id);
  advance(12);
  const bar = p.actionbar.at(-1) ?? "";
  check("compass shows tracked ruin ahead", bar.includes("Jungle Temple") && bar.includes("ahead") && bar.includes("60m"), bar);
  p.rotation = { x: 0, y: -90 }; // facing east, ruin behind
  advance(10);
  check("compass says behind", (p.actionbar.at(-1) ?? "").includes("behind"), p.actionbar.at(-1));
  fire(world.afterEvents.itemUse, { source: p, itemStack: { typeId: "ancient_ruins:ruin_compass" } });
  advance(1);
  check("compass ping trail", overworld.particles.some((x) => x.id === "ancient_ruins:compass_trail"));

  p.equipment.Mainhand = undefined;
  p.equipment.Offhand = "ancient_ruins:cursed_ring";
  p.hp = 20;
  advance(10);
  check("cursed ring caps health at 12", p.hp === 12, `${p.hp}`);
  check("cursed ring gives Speed II", p.effects.get("speed")?.amplifier === 1);

  p.equipment.Offhand = undefined;
  p.equipment.Mainhand = "ancient_ruins:ancient_map";
  p.isSneaking = true;
  let chosen;
  ui.respond = (form) => {
    chosen = form;
    return { canceled: false, selection: 0 };
  };
  advance(12);
  await new Promise((res) => setTimeout(res, 10));
  check("map lists charted ruins", chosen && chosen.buttons.length >= 3 && chosen.buttons[0].includes("Temple"), chosen?.buttons?.[0]);
  check("map selection tracks ruin", typeof p.getDynamicProperty("ancient_ruins:track") === "number");
  p.isSneaking = false;
}

// 8. Registry survives save / load
{
  const before = JSON.stringify(registry.allRuins());
  registry.saveRegistry(true);
  registry.loadRegistry();
  check("registry save/load round trip", JSON.stringify(registry.allRuins()) === before && registry.allRuins().length >= 6,
    `${registry.allRuins().length}`);
  check("registry stored in shards", [...sim.props.keys()].some((k) => k.startsWith("ancient_ruins:ruins_")));
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} checks passed, ${failures.length} failed`);
for (const f of failures) console.log("  FAIL:", f);
process.exit(failures.length ? 1 : 0);
