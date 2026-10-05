#!/usr/bin/env node
// Behavioural tests for SCP096_BP/scripts/main.js, run under Node with a simulated
// "@minecraft/server" (world / dimensions / blocks / entities / system.runInterval).
//
//   node tools/test_script.mjs [--out DIR]
//
// Environment: MOJANG_SAMPLES (default /home/user/mojang/bedrock-samples) must contain the
// v1.21.0.3 metadata (script_modules, command_modules, vanilladata_modules).
//
// How the simulation is kept honest
//  * main.js is imported unmodified through a Node module-resolution hook that maps the bare
//    specifier "@minecraft/server" to the simulation.
//  * Every simulated object is wrapped in a strict Proxy: reading a member that does not exist
//    in @minecraft/server 1.11.0 (per Mojang's metadata), or one that is not on the reviewed
//    ALLOWED_USE list, is recorded as an API violation (and throws). Violations fail the test
//    even if main.js swallows the exception.
//  * Commands are parsed against mojang-commands.json (setblock overloads + SetBlockMode enum).
//  * `setType` ids are checked against mojang-blocks.json.
//  * console.warn is captured, console.log/info/error/debug must stay unused.
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyApi } from "./typecheck/verify_api.mjs";

const realLog = console.log.bind(console);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADDON = path.resolve(HERE, "..");
// SCP096_MAIN lets the mutation self-check point the suite at a deliberately broken copy.
const MAIN = process.env.SCP096_MAIN ? path.resolve(process.env.SCP096_MAIN) : path.join(ADDON, "SCP096_BP", "scripts", "main.js");
const SAMPLES = process.env.MOJANG_SAMPLES || "/home/user/mojang/bedrock-samples";
const outIdx = process.argv.indexOf("--out");
const OUT_DIR = outIdx >= 0 ? path.resolve(process.argv[outIdx + 1]) : null;

// ----------------------------------------------------------------------------------------
// Reference data
// ----------------------------------------------------------------------------------------
function readJson(rel) {
  const p = path.join(SAMPLES, rel);
  if (!fs.existsSync(p)) {
    realLog(`FATAL: reference file missing: ${p} (set MOJANG_SAMPLES)`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
const API = readJson("metadata/script_modules/@minecraft/server_1.11.0.json");
const BLOCK_FILE = readJson("metadata/vanilladata_modules/mojang-blocks.json");
const COMMANDS = readJson("metadata/command_modules/mojang-commands.json");
const BLOCK_IDS = BLOCK_FILE.data_items.map((b) => b.name);
const BLOCK_SET = new Set(BLOCK_IDS);

function membersOf(className) {
  const out = new Set();
  const visit = (name) => {
    const c = API.classes.find((x) => x.name === name);
    if (!c) return;
    for (const p of c.properties) out.add(p.name);
    for (const f of c.functions) out.add(f.name);
    for (const b of c.base_types || []) visit(b.name);
  };
  visit(className);
  return out;
}

/** What main.js is reviewed to touch (see tools/typecheck/verify_api.mjs for the evidence). */
const ALLOWED_USE = {
  World: ["gameRules", "getDimension"],
  System: ["runInterval"],
  GameRules: ["mobGriefing"],
  Dimension: ["getBlock", "getEntities", "runCommand"],
  Entity: ["isValid", "location", "getViewDirection", "getComponent"],
  EntityVariantComponent: ["value"],
  Block: ["typeId", "setType", "isAir", "isLiquid", "getItemStack"],
  ItemStack: ["typeId"],
  CommandResult: ["successCount"],
};

const violations = [];
const touched = new Set();

function strict(target, className) {
  const members = membersOf(className);
  if (members.size === 0) throw new Error(`unknown API class ${className}`);
  const reviewed = new Set(ALLOWED_USE[className] || []);
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "symbol" || prop === "then" || prop === "toJSON" || prop === "constructor") {
        return Reflect.get(t, prop, t);
      }
      if (!members.has(prop)) {
        const msg = `${className}.${String(prop)} does NOT exist in @minecraft/server 1.11.0`;
        violations.push(msg);
        throw new Error(msg);
      }
      if (!reviewed.has(prop)) {
        const msg = `${className}.${String(prop)} exists in 1.11.0 but is not on the reviewed ALLOWED_USE list`;
        violations.push(msg);
        throw new Error(msg);
      }
      touched.add(`${className}.${prop}`);
      const v = Reflect.get(t, prop, t);
      return typeof v === "function" ? v.bind(t) : v;
    },
    set(t, prop) {
      const msg = `${className}.${String(prop)} was WRITTEN by main.js (it must be read-only)`;
      violations.push(msg);
      throw new Error(msg);
    },
  });
}

// setblock grammar from mojang-commands.json --------------------------------------------
const SETBLOCK = COMMANDS.commands.find((c) => c.name === "setblock");
const SET_BLOCK_MODES = COMMANDS.command_enums.find((e) => e.name === "SetBlockMode").values.map((v) => v.value);
const SETBLOCK_OVERLOAD = SETBLOCK.overloads.find(
  (o) => o.params.map((p) => p.type.name).join() === "POSITION,BLOCK,SETBLOCKMODE" && o.params[2].is_optional
);

class SimError extends Error {
  constructor(name, message) {
    super(message);
    this.name = name;
  }
}

/** Parses `setblock x y z <block> [mode]` exactly as the metadata describes it. */
function parseSetblock(cmd) {
  const bad = (why) => new SimError("CommandError", `Syntax error: ${why} in "${cmd}"`);
  if (typeof cmd !== "string") throw bad("not a string");
  if (cmd.startsWith("/")) throw bad("command strings must not start with a slash");
  if (cmd !== cmd.trim() || /\s{2}/.test(cmd)) throw bad("stray whitespace");
  const t = cmd.split(" ");
  if (t[0] !== SETBLOCK.name) throw bad("unknown command");
  if (t.length !== 6) throw bad("expected: setblock <x> <y> <z> <block> <mode>");
  const pos = t.slice(1, 4);
  for (const p of pos) if (!/^-?\d+$/.test(p)) throw bad(`bad integer position "${p}"`);
  const block = t[4].startsWith("minecraft:") ? t[4] : "minecraft:" + t[4];
  if (!BLOCK_SET.has(block)) throw bad(`unknown block "${t[4]}"`);
  if (!SET_BLOCK_MODES.includes(t[5])) throw bad(`bad SetBlockMode "${t[5]}"`);
  return { x: Number(pos[0]), y: Number(pos[1]), z: Number(pos[2]), block, mode: t[5] };
}

// ----------------------------------------------------------------------------------------
// Simulation
// ----------------------------------------------------------------------------------------
const DIM_IDS = ["overworld", "nether", "the_end"];
const MIN_Y = -64;
const MAX_Y = 320;
const AIR = "minecraft:air";
const key = (x, y, z) => `${x},${y},${z}`;

class SimBlock {
  constructor(dim, x, y, z) {
    this.dim = dim;
    this.bx = x;
    this.by = y;
    this.bz = z;
    this.proxy = strict(this, "Block");
  }
  get isAir() {
    return this.dim.get(this.bx, this.by, this.bz) === AIR;
  }
  get isLiquid() {
    const id = this.dim.get(this.bx, this.by, this.bz);
    return id === "minecraft:water" || id === "minecraft:lava" || id === "minecraft:flowing_water" || id === "minecraft:flowing_lava";
  }
  // Stable-on-preview-26 way to identify a block: the item it picks. Equal to the block id except
  // for double slabs / signs (no same-named item), which come back as some other item id.
  getItemStack() {
    const d = this.dim;
    d.stats.itemStackReads = (d.stats.itemStackReads || 0) + 1;
    if (!d.loaded(this.bx, this.by, this.bz)) {
      throw new SimError("LocationInUnloadedChunkError", "Block is in an unloaded chunk");
    }
    const id = d.get(this.bx, this.by, this.bz);
    if (id === AIR) return undefined;
    const bare = id.slice("minecraft:".length);
    if (/_double_slab$|_standing_sign$|_wall_sign$|^standing_sign$|^wall_sign$/.test(bare)) {
      return strict({ typeId: "minecraft:oak_sign" }, "ItemStack");
    }
    return strict({ typeId: id }, "ItemStack");
  }
  get typeId() {
    if (this.dim.sim.hidesBetaApis) return undefined; // Beta-only member: absent on 1.21.0 preview 26
    this.dim.stats.typeIdReads++;
    if (!this.dim.loaded(this.bx, this.by, this.bz)) {
      throw new SimError("LocationInUnloadedChunkError", "Block is in an unloaded chunk");
    }
    if (this.dim.typeIdHook) this.dim.typeIdHook(this.bx, this.by, this.bz);
    return this.dim.get(this.bx, this.by, this.bz);
  }
  get setType() {
    return this.dim.sim.hidesBetaApis ? undefined : this._setType;
  }
  _setType(id) {
    const d = this.dim;
    d.stats.setType++;
    if (typeof id !== "string" || !BLOCK_SET.has(id.startsWith("minecraft:") ? id : "minecraft:" + id)) {
      throw new SimError("Error", `Unknown block type "${id}"`);
    }
    if (d.setTypeMode === "throw") throw new SimError("Error", "setType failed (simulated)");
    if (!d.loaded(this.bx, this.by, this.bz)) {
      throw new SimError("LocationInUnloadedChunkError", "Block is in an unloaded chunk");
    }
    d.applyBreak(this.bx, this.by, this.bz, "setType", id);
  }
}

class SimEntity {
  constructor(dim, o) {
    this.dim = dim;
    this.typeId = o.typeId || "scp:scp096";
    this.x = o.x;
    this.y = o.y;
    this.z = o.z;
    this.view = o.view === undefined && !("view" in o) ? { x: 1, y: 0, z: 0 } : o.view;
    this.variant = "variant" in o ? o.variant : 3;
    this.valid = true;
    this.invalidAfterLocationRead = false;
    this.viewThrows = null;
    this.componentThrows = null;
    this.reads = 0;
    this.proxy = strict(this, "Entity");
    this.component = strict({ typeId: "minecraft:variant", value: this.variant }, "EntityVariantComponent");
  }
  assertValid(what) {
    if (!this.valid) throw new SimError("Error", `Failed to get ${what}: entity is invalid`);
  }
  isValid() {
    return this.valid;
  }
  get location() {
    this.assertValid("property 'location'");
    this.reads++;
    const loc = { x: this.x, y: this.y, z: this.z };
    if (this.invalidAfterLocationRead) this.valid = false;
    return loc;
  }
  getViewDirection() {
    this.assertValid("view direction");
    if (this.viewThrows) throw this.viewThrows;
    return this.view === undefined ? undefined : { ...this.view };
  }
  getComponent(id) {
    this.assertValid("component");
    if (this.componentThrows) throw this.componentThrows;
    if (id !== "minecraft:variant") return undefined;
    if (this.variant === undefined) return undefined;
    this.component = strict({ typeId: id, value: this.variant }, "EntityVariantComponent");
    return this.component;
  }
}

class SimDimension {
  constructor(sim, id) {
    this.sim = sim;
    this.id = id;
    this.blocks = new Map();
    this.entities = [];
    this.loaded = () => true;
    this.unloadedStyle = "throw"; // "throw" | "undefined"
    this.getBlockHook = null; // may throw
    this.typeIdHook = null; // may throw
    this.commandMode = "ok"; // ok | throw | zero
    this.setTypeMode = "ok"; // ok | throw
    this.getEntitiesThrows = null;
    this.getEntitiesOverride = null; // () => anything (contract violations)
    this.ops = []; // { via, x, y, z, old }
    this.commands = [];
    this.stats = { getBlock: 0, getEntities: 0, typeIdReads: 0, setType: 0 };
    this.proxy = strict(this, "Dimension");
  }
  get(x, y, z) {
    return this.blocks.get(key(x, y, z)) || AIR;
  }
  set(x, y, z, id) {
    if (id === AIR) this.blocks.delete(key(x, y, z));
    else this.blocks.set(key(x, y, z), id);
  }
  /** Removes the block; doors also remove their other half (neighbour update, no drop). */
  applyBreak(x, y, z, via, newId) {
    const old = this.get(x, y, z);
    this.set(x, y, z, newId === undefined ? AIR : newId.startsWith("minecraft:") ? newId : "minecraft:" + newId);
    this.ops.push({ via, x, y, z, old });
    if (/(^minecraft:)(wooden|iron|[a-z_]*)_door$/.test(old)) {
      for (const dy of [1, -1]) {
        if (this.get(x, y + dy, z) === old) {
          this.set(x, y + dy, z, AIR);
          this.ops.push({ via: "cascade", x, y: y + dy, z, old });
        }
      }
    }
  }
  addEntity(o) {
    const e = new SimEntity(this, o);
    this.entities.push(e);
    return e;
  }
  getBlock(loc) {
    this.stats.getBlock++;
    if (!loc || ![loc.x, loc.y, loc.z].every((n) => typeof n === "number" && Number.isFinite(n))) {
      throw new SimError("TypeError", "Native type conversion failed (Vector3)");
    }
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);
    if (this.getBlockHook) this.getBlockHook(x, y, z);
    if (y < MIN_Y || y >= MAX_Y) {
      throw new SimError("LocationOutOfWorldBoundariesError", "Location is outside of the dimension height range");
    }
    if (!this.loaded(x, y, z)) {
      if (this.unloadedStyle === "throw") {
        throw new SimError("LocationInUnloadedChunkError", "Location is in an unloaded chunk");
      }
      return undefined;
    }
    return new SimBlock(this, x, y, z).proxy;
  }
  getEntities(options) {
    this.stats.getEntities++;
    if (this.getEntitiesThrows) throw this.getEntitiesThrows;
    if (this.getEntitiesOverride) return this.getEntitiesOverride();
    const known = new Set(["type"]);
    for (const k of Object.keys(options || {})) {
      if (!known.has(k)) throw new SimError("Error", `unexpected query option ${k}`);
    }
    return this.entities
      .filter((e) => (options && options.type ? e.typeId === options.type : true))
      .map((e) => e.proxy);
  }
  runCommand(cmd) {
    this.commands.push(cmd);
    const p = parseSetblock(cmd); // throws CommandError on bad grammar
    if (this.commandMode === "throw") throw new SimError("CommandError", "Commands are not permitted (simulated)");
    if (this.commandMode === "zero") return strict({ successCount: 0 }, "CommandResult");
    if (!this.loaded(p.x, p.y, p.z)) throw new SimError("CommandError", "Cannot place block outside of the world");
    this.applyBreak(p.x, p.y, p.z, "command", p.block);
    return strict({ successCount: 1 }, "CommandResult");
  }
}

class Sim {
  constructor(opts = {}) {
    this.dims = {};
    for (const id of DIM_IDS) this.dims[id] = new SimDimension(this, id);
    this.mobGriefing = "mobGriefing" in opts ? opts.mobGriefing : true;
    this.hidesBetaApis = !!opts.hidesBetaApis; // simulate 1.21.0 preview 26: typeId/setType/gameRules absent
    this.gameRulesObjectThrows = false;
    this.gameRulesPropThrows = false;
    this.getDimensionHook = null;
    this.dimensionCalls = [];
    this.intervals = [];
    this.tick = 0;
    this.uncaught = [];
    this.warns = [];
    this.badLogs = [];
    const self = this;
    this.gameRulesProxy = strict(
      {
        get mobGriefing() {
          if (self.gameRulesPropThrows) throw new SimError("Error", "gamerule read failed (simulated)");
          return self.mobGriefing;
        },
      },
      "GameRules"
    );
  }
  worldGetDimension(id) {
    this.dimensionCalls.push(id);
    const short = String(id).replace(/^minecraft:/, "");
    if (!DIM_IDS.includes(short)) throw new SimError("Error", `Invalid dimension id ${id}`);
    if (this.getDimensionHook) this.getDimensionHook(short);
    return this.dims[short].proxy;
  }
  runInterval(cb, n) {
    if (typeof cb !== "function") throw new SimError("TypeError", "callback must be a function");
    this.intervals.push({ cb, n });
    return this.intervals.length;
  }
  /** Fires every registered interval callback `n` times, like n elapsed intervals. */
  firePass(n = 1) {
    for (let i = 0; i < n; i++) {
      for (const iv of this.intervals) {
        try {
          iv.cb();
        } catch (e) {
          this.uncaught.push(e);
        }
      }
    }
  }
  /** Advances the game clock, firing intervals whose period divides the tick number. */
  advanceTicks(n) {
    for (let i = 0; i < n; i++) {
      this.tick++;
      for (const iv of this.intervals) {
        if (this.tick % iv.n === 0) {
          try {
            iv.cb();
          } catch (e) {
            this.uncaught.push(e);
          }
        }
      }
    }
  }
}

// Singletons that main.js sees as "@minecraft/server" ------------------------------------
let S = null; // scenario currently driven by the test
const worldTarget = {
  get gameRules() {
    if (S.hidesBetaApis) return undefined;
    if (S.gameRulesObjectThrows) throw new SimError("Error", "gameRules unavailable (simulated)");
    return S.gameRulesProxy;
  },
  getDimension(id) {
    return S.worldGetDimension(id);
  },
};
const systemTarget = {
  runInterval(cb, n) {
    return S.runInterval(cb, n);
  },
};
globalThis.__SCP096_MOCK__ = { world: strict(worldTarget, "World"), system: strict(systemTarget, "System") };

const MOCK_SOURCE = "const m = globalThis.__SCP096_MOCK__;\nexport const world = m.world;\nexport const system = m.system;\n";
const hookSource = `
let mockUrl;
export async function initialize(data) { mockUrl = data.mockUrl; }
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@minecraft/server") return { url: mockUrl, shortCircuit: true };
  return nextResolve(specifier, context);
}
`;
register("data:text/javascript," + encodeURIComponent(hookSource), {
  parentURL: import.meta.url,
  data: { mockUrl: "data:text/javascript," + encodeURIComponent(MOCK_SOURCE) },
});

// console capture: warn is recorded, everything else main.js might call is a failure ------
const orphanWarns = [];
console.warn = (...a) => (S ? S.warns : orphanWarns).push(a.join(" "));
for (const m of ["log", "info", "error", "debug"]) {
  console[m] = (...a) => {
    if (S && S.inMain) S.badLogs.push(`${m}: ${a.join(" ")}`);
    else realLog(...a);
  };
}

let importCounter = 0;
async function newSim(opts) {
  S = new Sim(opts);
  S.inMain = true;
  const mod = await import(pathToFileURL(MAIN).href + `?scenario=${++importCounter}`);
  S.mod = mod;
  return S;
}

// ----------------------------------------------------------------------------------------
// Test runner
// ----------------------------------------------------------------------------------------
const report = [];
const say = (line = "") => {
  report.push(line);
  realLog(line);
};
const results = [];
let cur = null;
const fmt = (v) => {
  try {
    return typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v);
  } catch (e) {
    return String(v);
  }
};
function check(cond, msg) {
  cur.asserts++;
  if (!cond) cur.failures.push(msg);
}
function eq(actual, expected, msg) {
  check(Object.is(actual, expected), `${msg}: expected ${fmt(expected)}, got ${fmt(actual)}`);
}
/** Common end-of-scenario hygiene: no uncaught exceptions, no API violations, no stray logs. */
function hygiene(sim, { maxWarns = 0 } = {}) {
  eq(sim.uncaught.length, 0, `uncaught exceptions out of the interval callback (${sim.uncaught.map((e) => e && e.message).join("; ")})`);
  eq(violations.length, 0, `API violations (${violations.join("; ")})`);
  eq(sim.badLogs.length, 0, `console.log/info/error/debug calls (${sim.badLogs.join("; ")})`);
  check(sim.warns.length <= maxWarns, `console.warn count ${sim.warns.length} > ${maxWarns}: ${sim.warns.join(" | ")}`);
  violations.length = 0;
}
async function test(name, fn) {
  cur = { name, failures: [], asserts: 0 };
  violations.length = 0;
  try {
    await fn();
  } catch (e) {
    cur.failures.push("EXCEPTION " + (e && e.stack ? e.stack : e));
  }
  S = null;
  results.push(cur);
  say(`${cur.failures.length ? "FAIL" : "PASS"}  ${name}  (${cur.asserts} checks)`);
  for (const f of cur.failures.slice(0, 8)) say(`        - ${f}`);
  if (cur.failures.length > 8) say(`        ... ${cur.failures.length - 8} more`);
}

// ----------------------------------------------------------------------------------------
// Helpers for world setup / oracles
// ----------------------------------------------------------------------------------------
const MIX = [
  "minecraft:wooden_door", "minecraft:glass", "minecraft:oak_leaves", "minecraft:oak_planks",
  "minecraft:oak_log", "minecraft:iron_door", "minecraft:trapdoor", "minecraft:glass_pane",
  "minecraft:birch_fence_gate", "minecraft:white_wool", "minecraft:ladder", "minecraft:standing_sign",
  "minecraft:oak_stairs", "minecraft:hay_block", "minecraft:web", "minecraft:iron_trapdoor",
  "minecraft:red_stained_glass", "minecraft:azalea_leaves", "minecraft:crimson_stem", "minecraft:tinted_glass",
];
for (const id of MIX) if (!BLOCK_SET.has(id)) throw new Error(`test bug: ${id} is not a 1.21.0 block`);

const HARD = [
  "minecraft:bedrock", "minecraft:obsidian", "minecraft:crying_obsidian", "minecraft:barrier",
  "minecraft:reinforced_deepslate", "minecraft:stone", "minecraft:dirt", "minecraft:chest",
  "minecraft:command_block", "minecraft:netherite_block", "minecraft:ancient_debris",
  "minecraft:ender_chest", "minecraft:barrel", "minecraft:furnace", "minecraft:mob_spawner",
  "minecraft:end_portal_frame", "minecraft:portal", "minecraft:light_block", "minecraft:allow",
  "minecraft:deny", "minecraft:border_block", "minecraft:respawn_anchor", "minecraft:structure_block",
  "minecraft:jigsaw", "minecraft:end_gateway", "minecraft:end_portal", "minecraft:trapped_chest",
  "minecraft:repeating_command_block", "minecraft:chain_command_block", "minecraft:trial_spawner",
  "minecraft:blast_furnace", "minecraft:smoker", "minecraft:white_shulker_box", "minecraft:cobblestone",
  "minecraft:iron_block",
];
for (const id of HARD) if (!BLOCK_SET.has(id)) throw new Error(`test bug: ${id} is not a 1.21.0 block`);

/** Fills the cube around (cx, cz) with ids from fn(x, y, z); returns a snapshot. */
function fillRegion(dim, cx, cz, radius, yLo, yHi, idFn) {
  const x0 = Math.floor(cx) - radius;
  const z0 = Math.floor(cz) - radius;
  for (let x = x0; x <= Math.floor(cx) + radius; x++) {
    for (let z = z0; z <= Math.floor(cz) + radius; z++) {
      for (let y = yLo; y <= yHi; y++) dim.set(x, y, z, idFn(x, y, z));
    }
  }
}
const mixAt = (x, y, z) => MIX[(((x * 7 + y * 3 + z * 5) % MIX.length) + MIX.length) % MIX.length];
const snapshot = (dim) => new Map(dim.blocks);

/** All HARD blocks currently in the 11x11x7 region around POS (for "still there" checks). */
function fullBoxHard(dim) {
  const out = [];
  for (let x = Math.floor(POS.x) - 5; x <= Math.floor(POS.x) + 5; x++)
    for (let z = Math.floor(POS.z) - 5; z <= Math.floor(POS.z) + 5; z++)
      for (let y = 62; y <= 68; y++) {
        const id = dim.get(x, y, z);
        if (HARD.includes(id)) out.push({ x, y, z, id });
      }
  return out;
}

function changedCells(dim, snap) {
  const out = [];
  const keys = new Set([...snap.keys(), ...dim.blocks.keys()]);
  for (const k of keys) {
    const before = snap.get(k) || AIR;
    const after = dim.blocks.get(k) || AIR;
    if (before !== after) {
      const [x, y, z] = k.split(",").map(Number);
      out.push({ x, y, z, before, after });
    }
  }
  return out;
}

/** Independent oracle: probe box via a rotation by atan2 (different arithmetic from main.js). */
function oracleBox(pos, view, P) {
  const set = new Set();
  const horiz = Math.hypot(view.x, view.z);
  if (!(horiz >= P.minHorizontalView)) return set;
  const th = Math.atan2(view.z, view.x);
  const c = Math.cos(th);
  const s = Math.sin(th);
  const fy = Math.floor(pos.y + (P.feetEpsilon || 0));
  for (let cx = Math.floor(pos.x) - 8; cx <= Math.floor(pos.x) + 8; cx++) {
    for (let cz = Math.floor(pos.z) - 8; cz <= Math.floor(pos.z) + 8; cz++) {
      const rx = cx + 0.5 - pos.x;
      const rz = cz + 0.5 - pos.z;
      const f = rx * c + rz * s;
      const l = -rx * s + rz * c;
      // lateral sign convention differs from main.js (perpendicular = (-uz, ux)); the half-open
      // side only matters on an exact boundary, which the random positions avoid.
      if (f > P.minForward && f <= P.maxForward && Math.abs(l) <= P.halfWidth) {
        for (let dy = 0; dy < P.height; dy++) set.add(key(cx, fy + dy, cz));
      }
    }
  }
  return set;
}
/** Task-spec envelope with hard-coded numbers (3 wide, 3 high, 2.5 deep, from the feet block). */
function inSpecEnvelope(pos, view, x, y, z) {
  const m = Math.hypot(view.x, view.z);
  const ux = view.x / m;
  const uz = view.z / m;
  const rx = x + 0.5 - pos.x;
  const rz = z + 0.5 - pos.z;
  const f = rx * ux + rz * uz;
  const l = -rx * uz + rz * ux;
  const fy = Math.floor(pos.y);
  const fyTop = Math.floor(pos.y + 0.01); // tolerance for float noise just below an integer
  return f > 0 && f <= 2.5 + 1e-9 && Math.abs(l) <= 1.5 + 1e-9 && y >= fy && y <= fyTop + 2;
}
function forwardOf(pos, view, cell) {
  const m = Math.hypot(view.x, view.z);
  return ((cell.x + 0.5 - pos.x) * view.x + (cell.z + 0.5 - pos.z) * view.z) / m;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------------------
say("== SCP-096 script tests (main.js under a simulated @minecraft/server 1.11.0) ==");
say(`node ${process.version}; main.js ${MAIN}`);
say(`reference data: ${SAMPLES} (blocks=${BLOCK_IDS.length}, setblock overload POSITION,BLOCK,SETBLOCKMODE found=${!!SETBLOCK_OVERLOAD}, modes=${SET_BLOCK_MODES.join("/")}, permission_level=${SETBLOCK.permission_level}, requires_cheats=${SETBLOCK.requires_cheats})`);
say("");

await test("reference data sanity (setblock <pos> <block> destroy is a documented overload)", async () => {
  check(!!SETBLOCK_OVERLOAD, "setblock overload POSITION,BLOCK,SETBLOCKMODE (optional mode) exists");
  check(SET_BLOCK_MODES.includes("destroy"), "SetBlockMode contains destroy");
  const ok = parseSetblock("setblock -12 64 7 air destroy");
  eq(ok.mode, "destroy", "parser accepts the canonical command");
  let threw = 0;
  for (const bad of ["/setblock 1 2 3 air destroy", "setblock 1 2 3 air smash", "setblock 1 2 3 nonsense destroy", "setblock 1.5 2 3 air destroy", "setblock  1 2 3 air destroy"]) {
    try {
      parseSetblock(bad);
    } catch (e) {
      threw++;
    }
  }
  eq(threw, 5, "parser rejects 5 malformed commands");
});

await test("registration: one runInterval, 3-4 ticks, nothing else touched at import", async () => {
  const sim = await newSim();
  eq(sim.intervals.length, 1, "runInterval registrations");
  check(sim.intervals[0].n >= 3 && sim.intervals[0].n <= 4 && Number.isInteger(sim.intervals[0].n), `interval ${sim.intervals[0].n} must be an integer 3..4`);
  eq(sim.intervals[0].cb, sim.mod.runPass, "registered callback is the exported runPass");
  eq(sim.dimensionCalls.length, 0, "getDimension is not called at import time");
  check([...touched].every((t) => t === "System.runInterval" || t.startsWith("World.") || t.startsWith("GameRules.") || t.startsWith("Dimension.") || t.startsWith("Entity.") || t.startsWith("Block.") || t.startsWith("EntityVariantComponent.") || t.startsWith("CommandResult.")), "only reviewed members touched");
  // real clock: with no entities nothing happens, and the callback fires on multiples of the interval
  let fired = 0;
  const cb = sim.intervals[0].cb;
  sim.intervals[0].cb = () => {
    fired++;
    cb();
  };
  sim.advanceTicks(30);
  eq(fired, Math.floor(30 / sim.intervals[0].n), "callback fires every interval");
  hygiene(sim);
});

// ---- headings ----------------------------------------------------------------------------
// Fractions are chosen so that no block centre lies exactly beside the entity for any tested
// heading (that tie is arbitrary by construction and would only test float noise).
const POS = { x: 100.3, y: 64, z: -50.6 };
const HEADINGS = [
  ["+X", { x: 1, y: 0, z: 0 }],
  ["-X", { x: -1, y: 0, z: 0 }],
  ["+Z", { x: 0, y: 0, z: 1 }],
  ["-Z", { x: 0, y: 0, z: -1 }],
  ["diagonal +X+Z", { x: 1, y: 0, z: 1 }],
  ["diagonal -X+Z", { x: -1, y: 0, z: 1 }],
  ["diagonal +X-Z", { x: 1, y: 0, z: -1 }],
  ["diagonal -X-Z", { x: -1, y: 0, z: -1 }],
  ["30 deg, looking slightly down", { x: Math.cos(0.5236) * 0.9, y: -0.4, z: Math.sin(0.5236) * 0.9 }],
  ["77 deg, non-unit length", { x: Math.cos(1.3439) * 3.7, y: 0.2, z: Math.sin(1.3439) * 3.7 }],
  ["steep down (horizontal 0.06)", { x: 0.06, y: -0.998, z: 0 }],
];

for (const [label, view] of HEADINGS) {
  await test(`raging entity facing ${label}: soft blocks in the probe box are all broken, nothing outside`, async () => {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    const e = dim.addEntity({ ...POS, view, variant: 3 });
    fillRegion(dim, POS.x, POS.z, 8, 62, 70, mixAt);
    const snap = snapshot(dim);
    const P = sim.mod.PROBE;
    const expected = oracleBox(POS, view, P);
    check(expected.size >= 12, `oracle box has ${expected.size} cells (need >= 12 to exercise the cap)`);

    sim.firePass(1);
    const first = changedCells(dim, snap);
    eq(first.length, Math.min(sim.mod.LIMITS.maxBreaksPerEntity, expected.size), "blocks removed in the first pass (cap 12)");
    check(first.every((c) => expected.has(key(c.x, c.y, c.z))), "first-pass removals are inside the box");
    const remaining = [...expected].filter((k) => dim.get(...k.split(",").map(Number)) !== AIR);
    const maxBroken = Math.max(...first.map((c) => forwardOf(POS, view, c)));
    const minLeft = Math.min(...remaining.map((k) => forwardOf(POS, view, { x: Number(k.split(",")[0]), z: Number(k.split(",")[2]) })));
    check(maxBroken <= minLeft + 1e-9, `nearest-first: furthest removed ${maxBroken.toFixed(3)} <= nearest remaining ${minLeft.toFixed(3)}`);

    sim.firePass(10);
    const all = changedCells(dim, snap);
    const keys = new Set(all.map((c) => key(c.x, c.y, c.z)));
    eq(keys.size, expected.size, "total cells removed after 11 passes");
    for (const k of expected) check(keys.has(k), `box cell ${k} was not removed`);
    for (const c of all) {
      check(expected.has(key(c.x, c.y, c.z)), `removed ${c.before} OUTSIDE the box at ${c.x},${c.y},${c.z}`);
      check(c.after === AIR, `${c.x},${c.y},${c.z} became ${c.after}`);
      check(inSpecEnvelope(POS, view, c.x, c.y, c.z), `removal at ${c.x},${c.y},${c.z} is outside the 3x3x2.5 spec envelope`);
    }
    // the floor (feet block - 1) and everything above the 3-high box is intact
    for (let x = Math.floor(POS.x) - 8; x <= Math.floor(POS.x) + 8; x++) {
      for (let z = Math.floor(POS.z) - 8; z <= Math.floor(POS.z) + 8; z++) {
        check(dim.get(x, 63, z) === snap.get(key(x, 63, z)), `floor block ${x},63,${z} was changed`);
        check(dim.get(x, 67, z) === snap.get(key(x, 67, z)), `block above the box ${x},67,${z} was changed`);
      }
    }
    // every issued command is canonical and targets exactly a removed cell; drops come from "destroy"
    for (const cmd of dim.commands) {
      const p = parseSetblock(cmd);
      check(p.mode === "destroy" && p.block === AIR, `command ${cmd} is setblock ... air destroy`);
      check(expected.has(key(p.x, p.y, p.z)), `command ${cmd} targets a cell outside the box`);
    }
    check(dim.ops.every((o) => o.via === "command" || o.via === "cascade"), "all removals went through the destroy command (no fallback needed)");
    eq(dim.stats.setType, 0, "setType fallback not used when the command works");
    // the other two dimensions were untouched
    eq(sim.dims.nether.ops.length + sim.dims.the_end.ops.length, 0, "no operations in other dimensions");
    void e;
    hygiene(sim);
  });
}

await test("axis-aligned shape is exactly 3 columns wide, 2-3 deep, 3 high from the feet block (random positions)", async () => {
  const sim = await newSim();
  const rnd = mulberry32(96);
  const axes = [
    ["+X", { x: 2, y: 0, z: 0 }, "x", 1],
    ["-X", { x: -2, y: 0, z: 0 }, "x", -1],
    ["+Z", { x: 0, y: 0, z: 3 }, "z", 1],
    ["-Z", { x: 0, y: 0, z: -3 }, "z", -1],
  ];
  const exact = [0, 0.5, 0.25, 0.75];
  for (const [label, view, axis] of axes) {
    for (let i = 0; i < 40; i++) {
      const f = () => (i < 4 ? exact[i] : rnd()); // first 4 iterations hit exact block boundaries / centres
      const pos = { x: Math.floor(rnd() * 4000 - 2000) + f(), y: Math.floor(rnd() * 100) + f(), z: Math.floor(rnd() * 4000 - 2000) + f() };
      const cells = sim.mod.computeProbeCells(pos, view);
      const fwdAxis = axis;
      const latAxis = axis === "x" ? "z" : "x";
      const fwd = new Set(cells.map((c) => c[fwdAxis]));
      const lat = new Set(cells.map((c) => c[latAxis]));
      const ys = new Set(cells.map((c) => c.y));
      check(lat.size === 3, `${label} pos=${fmt(pos)}: lateral columns ${lat.size} != 3`);
      check(fwd.size === 2 || fwd.size === 3, `${label} pos=${fmt(pos)}: forward layers ${fwd.size} not in {2,3}`);
      eq(ys.size, 3, `${label} height`);
      eq(Math.min(...ys), Math.floor(pos.y + 0.01), `${label} lowest y is the feet block`);
      eq(Math.max(...ys), Math.floor(pos.y + 0.01) + 2, `${label} highest y is feet + 2`);
      eq(cells.length, lat.size * fwd.size * 3, `${label} box is a full cuboid`);
    }
  }
  hygiene(sim);
});

await test("computeProbeCells == independent oracle on 3000 random poses; sorted nearest-first; bounded size", async () => {
  const sim = await newSim();
  const rnd = mulberry32(2024);
  let maxCells = 0;
  for (let i = 0; i < 3000; i++) {
    const pos = { x: rnd() * 6000 - 3000, y: rnd() * 200 - 30, z: rnd() * 6000 - 3000 };
    const th = rnd() * Math.PI * 2;
    const pitch = (rnd() - 0.5) * 2.4;
    const view = { x: Math.cos(th) * Math.cos(pitch), y: Math.sin(pitch), z: Math.sin(th) * Math.cos(pitch) };
    const cells = sim.mod.computeProbeCells(pos, view);
    const oracle = oracleBox(pos, view, sim.mod.PROBE);
    if (cells === null) {
      check(oracle.size === 0, "null result only when the oracle also has no heading");
      continue;
    }
    const got = new Set(cells.map((c) => key(c.x, c.y, c.z)));
    if (got.size !== oracle.size || [...got].some((k) => !oracle.has(k))) {
      check(false, `pose ${i}: pos=${fmt(pos)} view=${fmt(view)} differs from oracle (got ${got.size}, oracle ${oracle.size})`);
    }
    for (let j = 1; j < cells.length; j++) check(cells[j - 1].forward <= cells[j].forward, "sorted by forward distance");
    maxCells = Math.max(maxCells, cells.length);
  }
  say(`        (info) max probe cells for one entity over 3000 random poses: ${maxCells}`);
  check(maxCells <= 40, `probe cell count bounded (<= 40), got ${maxCells}`);
  cur.asserts++;
});

await test("view direction ~zero / vertical / NaN / missing -> entity skipped, no exception, no warning", async () => {
  const views = [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 1e-4, y: 0.99999, z: 0 },
    { x: 0.049, y: 0.9988, z: 0 },
    { x: NaN, y: 0, z: NaN },
    { x: Infinity, y: 0, z: 0 },
    undefined,
  ];
  for (const view of views) {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    dim.addEntity({ ...POS, view, variant: 3 });
    fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
    const snap = snapshot(dim);
    sim.firePass(6);
    eq(changedCells(dim, snap).length, 0, `nothing removed for view ${fmt(view)}`);
    eq(dim.commands.length + dim.stats.setType, 0, `no command / setType for view ${fmt(view)}`);
    hygiene(sim);
  }
  // just above the threshold the entity works
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.addEntity({ ...POS, view: { x: 0.0501, y: -0.9987, z: 0 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
  const snap = snapshot(dim);
  sim.firePass(1);
  check(changedCells(dim, snap).length > 0, "horizontal 0.0501 is still used");
  hygiene(sim);
});

await test("feet block: float noise below an integer (y=63.9995) does not pull the FLOOR into the box; a real partial-height offset does", async () => {
  for (const [y, lowest] of [[64, 64], [63.9995, 64], [63.99, 64], [63.98, 63], [64.0004, 64], [64.5, 64], [64.98, 64], [65 - 1e-7, 65]]) {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    const pos = { x: 10.3, y, z: 20.3 };
    dim.addEntity({ ...pos, view: { x: 1, y: 0, z: 0 }, variant: 3 });
    fillRegion(dim, pos.x, pos.z, 5, 60, 70, () => "minecraft:oak_planks");
    const snap = snapshot(dim);
    sim.firePass(12);
    const ch = changedCells(dim, snap);
    check(ch.length > 0, `y=${y}: something removed`);
    eq(Math.min(...ch.map((c) => c.y)), lowest, `y=${y}: lowest removed layer`);
    eq(Math.max(...ch.map((c) => c.y)), lowest + 2, `y=${y}: highest removed layer`);
    hygiene(sim);
  }
});

await test("rotation window: a raging entity at index 590 of 600 SCP-096s is served despite the examine cap (256)", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  for (let i = 0; i < 600; i++) {
    dim.addEntity({ x: 8000.5 + i * 3, y: 64, z: 0.5, view: { x: 1, y: 0, z: 0 }, variant: i === 590 ? 3 : 1 });
  }
  dim.set(8000 + 590 * 3 + 1, 64, 0, "minecraft:oak_planks");
  sim.firePass(1);
  const located = dim.entities.reduce((n, e) => n + (e.reads > 0 ? 1 : 0), 0);
  check(located <= 1, "only raging entities are ever located");
  sim.firePass(400);
  eq(dim.get(8000 + 590 * 3 + 1, 64, 0), AIR, "plank in front of entity 590 removed within 401 passes (20 s)");
  hygiene(sim);
});

// ---- hard blocks -------------------------------------------------------------------------
await test("bedrock/obsidian/crying obsidian/barrier/reinforced deepslate/stone/dirt/chest/command block (+ others) in the box are never touched", async () => {
  for (const [label, view] of HEADINGS.slice(0, 8)) {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    dim.addEntity({ ...POS, view, variant: 3 });
    fillRegion(dim, POS.x, POS.z, 6, 62, 69, (x, y, z) => HARD[(((x * 5 + y + z * 3) % HARD.length) + HARD.length) % HARD.length]);
    const snap = snapshot(dim);
    sim.firePass(12);
    eq(changedCells(dim, snap).length, 0, `hard blocks untouched facing ${label}`);
    eq(dim.commands.length + dim.stats.setType, 0, `no destroy attempt facing ${label}`);
    hygiene(sim);
  }
});

await test("soft blocks mixed with hard blocks: only the soft ones inside the box go, hard ones stay", async () => {
  const view = { x: 1, y: 0, z: 0 };
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.addEntity({ ...POS, view, variant: 3 });
  // checkerboard of oak_planks and obsidian-like blocks
  const hardAt = (x, y, z) => HARD[(((x * 3 + y * 7 + z) % HARD.length) + HARD.length) % HARD.length];
  fillRegion(dim, POS.x, POS.z, 6, 62, 69, (x, y, z) => (Math.abs(x + y + z) % 2 === 0 ? "minecraft:oak_planks" : hardAt(x, y, z)));
  const snap = snapshot(dim);
  const expected = oracleBox(POS, view, sim.mod.PROBE);
  sim.firePass(15);
  const all = changedCells(dim, snap);
  for (const c of all) {
    check(expected.has(key(c.x, c.y, c.z)), `removed outside box ${c.x},${c.y},${c.z}`);
    check(c.before === "minecraft:oak_planks", `removed a non-soft block ${c.before}`);
  }
  const softInBox = [...expected].filter((k) => snap.get(k) === "minecraft:oak_planks").length;
  eq(all.length, softInBox, "every soft block in the box removed");
  hygiene(sim);
});

// ---- variants ----------------------------------------------------------------------------
await test("variants 0,1,2,4,-1,3.5, missing component -> nothing; variant 3 -> works", async () => {
  for (const variant of [0, 1, 2, 4, -1, 3.5, 30, undefined]) {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant });
    fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
    const snap = snapshot(dim);
    sim.firePass(8);
    eq(changedCells(dim, snap).length, 0, `variant ${variant}: nothing broken`);
    eq(dim.commands.length + dim.stats.setType, 0, `variant ${variant}: no destroy attempt`);
    hygiene(sim);
  }
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
  const snap = snapshot(dim);
  sim.firePass(1);
  check(changedCells(dim, snap).length > 0, "variant 3 breaks blocks");
  hygiene(sim);
});

await test("a state change is picked up live (sit -> walk -> scream -> run -> calm)", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  const e = dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 0 });
  fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
  const snap = snapshot(dim);
  const seq = [[0, false], [1, false], [2, false], [3, true], [1, false], [0, false]];
  for (const [v, shouldBreak] of seq) {
    e.variant = v;
    const before = changedCells(dim, snap).length;
    sim.firePass(1);
    const after = changedCells(dim, snap).length;
    check((after > before) === shouldBreak, `variant ${v}: removed ${after - before} blocks, expected ${shouldBreak ? "some" : "none"}`);
  }
  hygiene(sim);
});

// ---- mobGriefing -------------------------------------------------------------------------
await test("mobGriefing=false -> nothing; read live every pass; undefined counts as not false", async () => {
  const sim = await newSim({ mobGriefing: false });
  const dim = sim.dims.overworld;
  dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
  const snap = snapshot(dim);
  sim.firePass(10);
  eq(changedCells(dim, snap).length, 0, "nothing broken while mobGriefing=false");
  eq(dim.stats.getBlock + dim.stats.getEntities, 0, "no world queries at all while mobGriefing=false");
  sim.mobGriefing = true;
  sim.firePass(1);
  check(changedCells(dim, snap).length > 0, "breaking starts as soon as mobGriefing=true");
  const n = changedCells(dim, snap).length;
  sim.mobGriefing = false;
  sim.firePass(5);
  eq(changedCells(dim, snap).length, n, "breaking stops again when mobGriefing=false");
  sim.mobGriefing = undefined;
  sim.firePass(1);
  check(changedCells(dim, snap).length > n, "undefined (rule not present) is treated as not false");
  hygiene(sim);
});

await test("gameRules unreadable -> fail OPEN (rule cannot be read, so clearing stays on), silent, no crash", async () => {
  for (const mode of ["object", "prop"]) {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
    fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
    const snap = snapshot(dim);
    if (mode === "object") sim.gameRulesObjectThrows = true;
    else sim.gameRulesPropThrows = true;
    sim.firePass(25);
    check(changedCells(dim, snap).length > 0, `${mode}: soft blocks still cleared when the rule is unreadable`);
    hygiene(sim);
  }
});

// ---- Minecraft 1.21.0 preview 26 surface: Block.typeId / Block.setType / World.gameRules are Beta-only ---------
await test("PREVIEW-26 SURFACE (no typeId, no setType, no gameRules): soft blocks break via ItemStack id + setblock; hard blocks untouched; silent", async () => {
  const sim = await newSim({ hidesBetaApis: true });
  const dim = sim.dims.overworld;
  dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
  const snap = snapshot(dim);
  sim.firePass(40);
  const changed = changedCells(dim, snap);
  check(changed.length > 0, "something was broken without any Beta member");
  eq(dim.stats.typeIdReads, 0, "Block.typeId never read when absent");
  check((dim.stats.itemStackReads || 0) > 0, "getItemStack fallback used");
  eq(dim.stats.setType, 0, "setType never called when absent");
  for (const c of changed) {
    check(sim.mod.isBreakableBlockId(c.before) && c.after === AIR, `only allow-listed ids removed (got ${c.before} -> ${c.after})`);
    check(!HARD.includes(c.before), `hard block ${c.before} untouched`);
  }
  for (const c of fullBoxHard(dim)) check(dim.get(c.x, c.y, c.z) === c.id, `hard block at ${c.x},${c.y},${c.z} still ${c.id}`);
  hygiene(sim);
});

// the same scenario but with the command failing: no setType exists -> nothing removed, one warning, no crash
await test("PREVIEW-26 SURFACE + setblock command failing: nothing removed, at most one warning, no crash", async () => {
  const sim = await newSim({ hidesBetaApis: true });
  const dim = sim.dims.overworld;
  dim.commandMode = "throw";
  dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
  const snap = snapshot(dim);
  sim.firePass(25);
  eq(changedCells(dim, snap).length, 0, "nothing removed");
  hygiene(sim, { maxWarns: 1 });
});

// ---- errors / unloaded chunks / invalid entities ----------------------------------------
await test("unloaded chunks: getBlock throwing LocationInUnloadedChunkError (or returning undefined) -> silent, no crash", async () => {
  for (const style of ["throw", "undefined"]) {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    dim.unloadedStyle = style;
    dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 1 }, variant: 3 });
    fillRegion(dim, POS.x, POS.z, 6, 62, 68, mixAt);
    const snap = snapshot(dim);
    dim.loaded = () => false;
    sim.firePass(20);
    eq(changedCells(dim, snap).length, 0, `${style}: nothing changed`);
    check(dim.stats.getBlock > 0, `${style}: getBlock was attempted`);
    eq(dim.commands.length + dim.stats.setType, 0, `${style}: no destroy attempts`);
    hygiene(sim); // zero warnings: expected condition
  }
});

await test("half-loaded area: loaded cells are processed, unloaded cells skipped silently", async () => {
  const view = { x: 1, y: 0, z: 0 };
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.addEntity({ ...POS, view, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 6, 62, 68, mixAt);
  const limitX = Math.floor(POS.x) + 2; // chunk boundary: x >= limitX is unloaded
  dim.loaded = (x) => x < limitX;
  const snap = snapshot(dim);
  const expected = oracleBox(POS, view, sim.mod.PROBE);
  sim.firePass(10);
  const keys = new Set(changedCells(dim, snap).map((c) => key(c.x, c.y, c.z)));
  for (const k of expected) {
    const x = Number(k.split(",")[0]);
    check(keys.has(k) === (x < limitX), `cell ${k}: removed=${keys.has(k)} but loaded=${x < limitX}`);
  }
  hygiene(sim);
});

await test("stale block: typeId throwing LocationInUnloadedChunkError mid-pass -> silent", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.addEntity({ ...POS, view: { x: 0, y: 0, z: 1 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 6, 62, 68, mixAt);
  dim.typeIdHook = () => {
    throw new SimError("LocationInUnloadedChunkError", "block went away");
  };
  sim.firePass(10);
  eq(dim.ops.length, 0, "nothing removed");
  hygiene(sim);
});

await test("out-of-world positions (entity at the world ceiling / floor) -> silent", async () => {
  for (const y of [MAX_Y - 1, MAX_Y + 5, MIN_Y - 3]) {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    dim.addEntity({ x: 0.5, y, z: 0.5, view: { x: 1, y: 0, z: 0 }, variant: 3 });
    sim.firePass(5);
    hygiene(sim);
  }
});

await test("unexpected getBlock failure -> exactly one console.warn for that kind, however many passes", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 6, 62, 68, mixAt);
  dim.getBlockHook = () => {
    throw new SimError("Error", "boom (simulated native failure)");
  };
  sim.firePass(200);
  eq(sim.warns.length, 1, "warnings after 200 passes");
  check(/get-block/.test(sim.warns[0] || ""), "the warning names the failure kind");
  hygiene(sim, { maxWarns: 1 });
});

await test("getEntities / getDimension / typeId failures: one warning per kind, other work continues", async () => {
  const sim = await newSim();
  const over = sim.dims.overworld;
  const nether = sim.dims.nether;
  over.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  nether.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(nether, POS.x, POS.z, 6, 62, 68, mixAt);
  over.getEntitiesThrows = new SimError("Error", "query failed (simulated)");
  sim.getDimensionHook = (id) => {
    if (id === "the_end") throw new SimError("Error", "no end (simulated)");
  };
  const snap = snapshot(nether);
  sim.firePass(50);
  check(changedCells(nether, snap).length > 0, "nether entity still processed");
  eq(sim.warns.length, 2, "one warning for the failed query + one for the failed dimension lookup");
  const kinds = new Set(sim.warns.map((w) => /\[SCP-096\] ([a-z-]+) failed/.exec(w)[1]));
  eq(kinds.size, 2, "two distinct kinds");
  hygiene(sim, { maxWarns: 2 });
});

await test("defence in depth: contract-violating results (null / non-array / null entries) never escape the callback", async () => {
  for (const [label, value, maxKinds] of [["null", null, 1], ["undefined", undefined, 1], ["number", 7, 0], ["[null, undefined]", [null, undefined], 1]]) {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    dim.getEntitiesOverride = () => value;
    sim.firePass(40);
    check(sim.warns.length <= maxKinds, `${label}: warnings ${sim.warns.length} > ${maxKinds}`);
    hygiene(sim, { maxWarns: maxKinds });
  }
});

await test("invalid entity: isValid()=false -> skipped; a valid second entity in the same pass is still processed", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  const dead = dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  dead.valid = false;
  const live = dim.addEntity({ x: 300.5, y: 70, z: 300.5, view: { x: 0, y: 0, z: 1 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
  fillRegion(dim, live.x, live.z, 5, 68, 74, mixAt);
  const snap = snapshot(dim);
  sim.firePass(8);
  const changed = changedCells(dim, snap);
  check(changed.length > 0, "live entity worked");
  check(changed.every((c) => Math.abs(c.x - 300) < 8 && Math.abs(c.z - 300) < 8), "nothing broken near the invalid entity");
  eq(dead.reads, 0, "invalid entity's position never read");
  hygiene(sim);
});

await test("entity becomes invalid mid-pass (property access throws, isValid() now false) -> silent", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  const e = dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  e.invalidAfterLocationRead = true; // location read works, getViewDirection then throws
  fillRegion(dim, POS.x, POS.z, 5, 62, 68, mixAt);
  sim.firePass(5);
  eq(dim.ops.length, 0, "nothing removed");
  hygiene(sim);
});

await test("entity API failure while still valid -> one warning per kind, others unaffected", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  const a = dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  a.viewThrows = new SimError("Error", "native hiccup (simulated)");
  const b = dim.addEntity({ x: 400.5, y: 64, z: 400.5, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  const c = dim.addEntity({ x: 500.5, y: 64, z: 500.5, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  c.componentThrows = new SimError("Error", "component hiccup (simulated)");
  fillRegion(dim, 400.5, 400.5, 5, 62, 68, mixAt);
  const snap = snapshot(dim);
  sim.firePass(60);
  check(changedCells(dim, snap).length > 0, "healthy entity processed");
  eq(sim.warns.length, 2, "two kinds (entity-heading, entity-state) -> two warnings in total");
  void b;
  hygiene(sim, { maxWarns: 2 });
});

// ---- breaking method ---------------------------------------------------------------------
await test("command unavailable (throws CommandError): silent fallback to Block.setType, one warning, still breaks", async () => {
  const view = { x: 0, y: 0, z: -1 };
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.commandMode = "throw";
  dim.addEntity({ ...POS, view, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 6, 62, 69, mixAt);
  const snap = snapshot(dim);
  const expected = oracleBox(POS, view, sim.mod.PROBE);
  sim.firePass(12);
  const keys = new Set(changedCells(dim, snap).map((c) => key(c.x, c.y, c.z)));
  eq(keys.size, expected.size, "box fully cleared through the fallback");
  check(dim.stats.setType > 0 && dim.ops.every((o) => o.via === "setType" || o.via === "cascade"), "fallback used");
  eq(sim.warns.length, 1, "one warning for the command failure");
  hygiene(sim, { maxWarns: 1 });
});

await test("command reports successCount 0: falls back to setType without a warning", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.commandMode = "zero";
  dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 6, 62, 69, mixAt);
  const snap = snapshot(dim);
  sim.firePass(12);
  check(changedCells(dim, snap).length > 0, "blocks removed");
  check(dim.stats.setType > 0, "fallback used");
  hygiene(sim);
});

await test("command AND setType both fail -> no crash, one warning per kind, nothing removed", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.commandMode = "throw";
  dim.setTypeMode = "throw";
  dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(dim, POS.x, POS.z, 6, 62, 69, mixAt);
  const snap = snapshot(dim);
  sim.firePass(60);
  eq(changedCells(dim, snap).length, 0, "nothing removed");
  eq(sim.warns.length, 2, "two warnings (command + setType)");
  hygiene(sim, { maxWarns: 2 });
});

await test("two-high door: lower half destroyed, upper half goes with it, counted once, no error", async () => {
  const view = { x: 1, y: 0, z: 0 };
  const sim = await newSim();
  const dim = sim.dims.overworld;
  dim.addEntity({ x: 10.5, y: 64, z: 20.5, view, variant: 3 });
  dim.set(12, 64, 20, "minecraft:wooden_door");
  dim.set(12, 65, 20, "minecraft:wooden_door");
  sim.firePass(1);
  eq(dim.get(12, 64, 20), AIR, "lower half gone");
  eq(dim.get(12, 65, 20), AIR, "upper half gone");
  eq(dim.commands.length, 1, "a single destroy command for the whole door");
  eq(dim.commands[0], "setblock 12 64 20 air destroy", "exact command text");
  hygiene(sim);
});

await test("command text for negative / zero coordinates is canonical (no -0, no decimals)", async () => {
  const sim = await newSim();
  const dim = sim.dims.overworld;
  for (const [x, z] of [[-0.2, 0.3], [-0.5, -0.5], [0.5, -0.0], [-1234.7, 5678.1], [-0.0, -0.0]]) {
    dim.addEntity({ x, y: -3.2, z, view: { x: 1, y: 0, z: 0.0001 }, variant: 3 });
    fillRegion(dim, x, z, 5, -8, 4, () => "minecraft:glass");
  }
  sim.firePass(40);
  check(dim.commands.length > 0, "commands were issued");
  for (const cmd of dim.commands) {
    check(/^setblock -?\d+ -?\d+ -?\d+ air destroy$/.test(cmd) && !/-0\b/.test(cmd), `bad command text: ${cmd}`);
    parseSetblock(cmd);
  }
  hygiene(sim);
});

// ---- caps --------------------------------------------------------------------------------
await test("caps: one entity breaks at most 12 per pass; many entities at most 36 per pass and 12 entities per pass", async () => {
  {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    dim.addEntity({ ...POS, view: { x: 1, y: 0, z: 0 }, variant: 3 });
    fillRegion(dim, POS.x, POS.z, 6, 62, 69, () => "minecraft:oak_planks");
    const snap = snapshot(dim);
    sim.firePass(1);
    eq(changedCells(dim, snap).length, 12, "single entity, full box: exactly 12 in the first pass");
    hygiene(sim);
  }
  {
    const sim = await newSim();
    const dim = sim.dims.overworld;
    for (let i = 0; i < 5; i++) {
      const pos = { x: 1000.3 + i * 100, y: 64, z: 1000.3 };
      dim.addEntity({ ...pos, view: { x: 1, y: 0, z: 0 }, variant: 3 });
      fillRegion(dim, pos.x, pos.z, 6, 62, 69, () => "minecraft:oak_planks");
    }
    const snap = snapshot(dim);
    sim.firePass(1);
    const n = changedCells(dim, snap).length;
    check(n <= 36 && n >= 30, `5 entities x 12 requested -> global cap 36 -> removed ${n}`);
    hygiene(sim);
  }
  {
    // 20 entities, one plank each: <= 12 entities served per pass, rotation serves all of them
    const sim = await newSim();
    const dim = sim.dims.overworld;
    for (let i = 0; i < 20; i++) {
      dim.addEntity({ x: 2000.5 + i * 50, y: 64, z: 0.5, view: { x: 1, y: 0, z: 0 }, variant: 3 });
      dim.set(2000 + i * 50 + 1, 64, 0, "minecraft:oak_planks");
    }
    sim.firePass(1);
    const gone = [...Array(20).keys()].filter((i) => dim.get(2000 + i * 50 + 1, 64, 0) === AIR).length;
    check(gone <= 12 && gone > 0, `20 raging entities: ${gone} served in pass 1 (cap 12)`);
    sim.firePass(25);
    const left = [...Array(20).keys()].filter((i) => dim.get(2000 + i * 50 + 1, 64, 0) !== AIR).length;
    eq(left, 0, "no entity starves: all 20 served within 26 passes");
    hygiene(sim);
  }
  {
    // 200 SCP-096 entities that are NOT raging cost almost nothing: examined cap
    const sim = await newSim();
    const dim = sim.dims.overworld;
    for (let i = 0; i < 200; i++) dim.addEntity({ x: i, y: 64, z: 0, view: { x: 1, y: 0, z: 0 }, variant: 1 });
    sim.firePass(3);
    check(dim.stats.getBlock === 0, "idle entities never trigger block reads");
    const reads = dim.entities.reduce((s, e) => s + e.reads, 0);
    eq(reads, 0, "idle entities are not even located");
    hygiene(sim);
  }
  {
    // bounded getBlock work: 12 raging entities, full boxes of hard blocks (nothing breaks -> max probing)
    const sim = await newSim();
    const dim = sim.dims.overworld;
    for (let i = 0; i < 40; i++) {
      const pos = { x: 5000.3 + i * 40, y: 64, z: 5000.3 };
      dim.addEntity({ ...pos, view: { x: 1, y: 0, z: 1 }, variant: 3 });
      fillRegion(dim, pos.x, pos.z, 5, 62, 68, () => "minecraft:stone");
    }
    sim.firePass(1);
    check(dim.stats.getBlock <= 12 * 40, `getBlock calls in one pass with 40 raging entities: ${dim.stats.getBlock} (<= 480)`);
    say(`        (info) 40 raging entities, 1 pass: getBlock=${dim.stats.getBlock}, typeId reads=${dim.stats.typeIdReads}`);
    hygiene(sim);
  }
});

// ---- dimensions --------------------------------------------------------------------------
await test("three dimensions at once with identical coordinates: each entity only changes its own dimension", async () => {
  const sim = await newSim();
  const heads = { overworld: { x: 1, y: 0, z: 0 }, nether: { x: 0, y: 0, z: 1 }, the_end: { x: -1, y: 0, z: -1 } };
  const snaps = {};
  const expected = {};
  for (const id of DIM_IDS) {
    const dim = sim.dims[id];
    dim.addEntity({ ...POS, view: heads[id], variant: 3 });
    fillRegion(dim, POS.x, POS.z, 7, 62, 69, mixAt);
    snaps[id] = snapshot(dim);
    expected[id] = oracleBox(POS, heads[id], sim.mod.PROBE);
  }
  // a look-alike in the overworld that is not an SCP-096 must be ignored even with variant 3
  sim.dims.overworld.addEntity({ typeId: "minecraft:zombie", x: 700.5, y: 64, z: 700.5, view: { x: 1, y: 0, z: 0 }, variant: 3 });
  fillRegion(sim.dims.overworld, 700.5, 700.5, 4, 62, 68, mixAt);
  const zombieSnap = snapshot(sim.dims.overworld);
  sim.firePass(12);
  for (const id of DIM_IDS) {
    const ch = changedCells(sim.dims[id], id === "overworld" ? zombieSnap : snaps[id]).filter((c) => id !== "overworld" || Math.abs(c.x - 700) > 20);
    const keys = new Set(ch.map((c) => key(c.x, c.y, c.z)));
    eq(keys.size, expected[id].size, `${id}: cells removed`);
    for (const k of keys) check(expected[id].has(k), `${id}: removed outside its own box: ${k}`);
  }
  const zombieChanges = changedCells(sim.dims.overworld, zombieSnap).filter((c) => Math.abs(c.x - 700) <= 8);
  eq(zombieChanges.length, 0, "variant-3 zombie ignored");
  check(["overworld", "nether", "the_end"].every((id) => sim.dimensionCalls.includes(id)), `all three dimensions queried (${sim.dimensionCalls.slice(0, 3)})`);
  check(sim.dimensionCalls.every((id) => DIM_IDS.includes(id)), "only short dimension ids are used");
  hygiene(sim);
});

// ---- (c) block classification -----------------------------------------------------------
// Independent intent oracle: written as regexes, NOT derived from main.js's lists.
const WOODS = "oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo|crimson|warped";
const TREES = "oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry";
const COLORS = "white|orange|magenta|light_blue|yellow|lime|pink|gray|light_gray|cyan|purple|blue|brown|green|red|black";
const ID = (re) => new RegExp(`^minecraft:(?:${re})$`);
const INTENT = [
  ["doors (wood, iron, copper)", ID(`wooden_door|iron_door|(?:spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo|crimson|warped)_door|(?:waxed_)?(?:exposed_|weathered_|oxidized_)?copper_door`)],
  ["trapdoors (wood, iron, copper)", ID(`trapdoor|iron_trapdoor|(?:spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo|crimson|warped)_trapdoor|(?:waxed_)?(?:exposed_|weathered_|oxidized_)?copper_trapdoor`)],
  ["fence gates", ID(`fence_gate|(?:spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo|crimson|warped)_fence_gate`)],
  ["wooden fences", ID(`(?:${WOODS})_fence`)],
  ["planks", ID(`(?:${WOODS})_planks`)],
  ["bamboo mosaic", ID(`bamboo_mosaic(?:_slab|_stairs|_double_slab)?`)],
  ["logs / wood (incl. stripped)", ID(`(?:stripped_)?(?:${TREES})_(?:log|wood)`)],
  ["stems / hyphae / bamboo block (incl. stripped)", ID(`(?:stripped_)?(?:crimson|warped)_(?:stem|hyphae)|(?:stripped_)?bamboo_block`)],
  ["wooden slabs (incl. double)", ID(`(?:${WOODS})_(?:double_)?slab`)],
  ["wooden stairs", ID(`(?:${WOODS})_stairs`)],
  ["leaves", ID(`(?:${TREES})_leaves|azalea_leaves(?:_flowered)?`)],
  ["glass / panes / tinted", ID(`glass|glass_pane|tinted_glass`)],
  ["stained glass (+panes)", ID(`(?:${COLORS})_stained_glass(?:_pane)?`)],
  ["wool", ID(`(?:${COLORS})_wool`)],
  ["carpets (dyed)", ID(`(?:${COLORS})_carpet`)],
  ["cobweb, ladder, scaffolding, bamboo, hay bale", ID(`web|ladder|scaffolding|bamboo|hay_block`)],
  ["signs (standing, wall, hanging)", ID(`(?:standing_sign|wall_sign)|(?:spruce|birch|jungle|acacia|mangrove|cherry|bamboo|crimson|warped)_(?:standing|wall)_sign|darkoak_(?:standing|wall)_sign|(?:${WOODS})_hanging_sign`)],
];
// Independent deny oracle, from the task text.
const DENY_ORACLE = [
  ID(`bedrock|invisible_bedrock|obsidian|crying_obsidian|glowingobsidian|netherreactor|reinforced_deepslate|barrier`),
  /^minecraft:(?:.*_)?command_block$/, // command_block, repeating_, chain_
  ID(`structure_block|structure_void|jigsaw|end_portal|end_portal_frame|end_gateway|portal|light_block|border_block|allow|deny|netherite_block|ancient_debris|respawn_anchor`),
  /^minecraft:(?:.*_)?chest$/, // chest, trapped_chest, ender_chest
  ID(`barrel|hopper|dropper|dispenser|crafter`),
  /^minecraft:(?:lit_)?(?:blast_)?furnace$/,
  /^minecraft:(?:lit_)?smoker$/,
  /^minecraft:(?:.*_)?shulker_box$/,
  /^minecraft:(?:mob_|trial_)?spawner$/,
];

let classificationText = "";
let apiText = "";
await test("(c) exhaustive classification of every block id in mojang-blocks.json", async () => {
  const sim = await newSim();
  const { isBreakableBlockId, isDeniedBlockId, ALLOWED_BLOCK_IDS, DENIED_BLOCK_IDS, DENIED_SUFFIXES } = sim.mod;
  const L = [];
  const p = (s = "") => L.push(s);

  const allowed = BLOCK_IDS.filter((id) => isBreakableBlockId(id));
  const denied = BLOCK_IDS.filter((id) => isDeniedBlockId(id));
  const neither = BLOCK_IDS.filter((id) => !isBreakableBlockId(id) && !isDeniedBlockId(id));
  const intentSet = new Set(BLOCK_IDS.filter((id) => INTENT.some(([, re]) => re.test(id))));
  const denyOracleSet = new Set(BLOCK_IDS.filter((id) => DENY_ORACLE.some((re) => re.test(id))));

  p(`== Block classification: mojang-blocks.json (${BLOCK_FILE.minecraft_version}), ${BLOCK_IDS.length} ids ==`);
  p(`allowed (breakable): ${allowed.length}`);
  p(`denied by rule     : ${denied.length}`);
  p(`neither (untouched): ${neither.length}`);
  p("");

  // structural guarantees
  eq(new Set(ALLOWED_BLOCK_IDS).size, ALLOWED_BLOCK_IDS.length, "ALLOWED_BLOCK_IDS has no duplicates");
  eq(new Set(DENIED_BLOCK_IDS).size, DENIED_BLOCK_IDS.length, "DENIED_BLOCK_IDS has no duplicates");
  const notInFile = ALLOWED_BLOCK_IDS.filter((id) => !BLOCK_SET.has(id));
  eq(notInFile.length, 0, `allowed ids missing from mojang-blocks.json: ${notInFile.join(", ")}`);
  const deniedNotInFile = DENIED_BLOCK_IDS.filter((id) => !BLOCK_SET.has(id));
  eq(deniedNotInFile.length, 0, `deny-list ids missing from mojang-blocks.json (typo?): ${deniedNotInFile.join(", ")}`);
  eq(allowed.length, ALLOWED_BLOCK_IDS.length, "every ALLOWED_BLOCK_IDS entry is classified as breakable");
  const overlap = ALLOWED_BLOCK_IDS.filter((id) => isDeniedBlockId(id));
  eq(overlap.length, 0, `ids that are on BOTH lists (deny wins, but this is a bug): ${overlap.join(", ")}`);

  // deny list always wins and nothing denied is allowed
  const denyLeak = [...denyOracleSet].filter((id) => isBreakableBlockId(id));
  eq(denyLeak.length, 0, `task deny-list ids that are ALLOWED: ${denyLeak.join(", ")}`);
  const denyOracleNotDenied = [...denyOracleSet].filter((id) => !isDeniedBlockId(id));
  eq(denyOracleNotDenied.length, 0, `task deny-list ids not covered by DENIED rules: ${denyOracleNotDenied.join(", ")}`);
  for (const id of DENIED_BLOCK_IDS) check(!isBreakableBlockId(id), `${id} is denied but breakable`);
  // the deny list must win even for an id that is (hypothetically) also allowed: probe predicate shape
  for (const id of ["minecraft:bedrock", "minecraft:obsidian", "minecraft:crying_obsidian", "minecraft:barrier", "minecraft:reinforced_deepslate", "minecraft:chest", "minecraft:command_block", "minecraft:stone", "minecraft:dirt"]) {
    check(!isBreakableBlockId(id), `${id} must not be breakable`);
  }
  // allowed == intent
  const extra = allowed.filter((id) => !intentSet.has(id));
  const missing = [...intentSet].filter((id) => !isBreakableBlockId(id));
  eq(extra.length, 0, `allowed but not matching any intent rule: ${extra.join(", ")}`);
  eq(missing.length, 0, `intended but not allowed: ${missing.join(", ")}`);
  // predicate hygiene
  for (const bad of [undefined, null, 0, {}, [], "", "minecraft:", "oak_planks", "MINECRAFT:OAK_PLANKS", "foo:oak_planks", "minecraft:oak_planks ", " minecraft:oak_planks", "minecraft:air", "minecraft:unknown", "minecraft:oak_planks\n"]) {
    check(!isBreakableBlockId(bad), `isBreakableBlockId(${fmt(bad)}) must be false`);
  }
  check(isBreakableBlockId("minecraft:oak_planks"), "sanity: oak planks breakable");

  p("-- ALLOWED set, grouped by intent rule --");
  for (const [name, re] of INTENT) {
    const ids = allowed.filter((id) => re.test(id));
    p(`[${name}] (${ids.length})`);
    p("    " + ids.map((i) => i.replace("minecraft:", "")).join(", "));
  }
  p("");
  p("-- DENIED BY RULE (exact ids in DENIED_BLOCK_IDS) --");
  const exactHit = denied.filter((id) => DENIED_BLOCK_IDS.includes(id));
  p(`(${exactHit.length}) ` + exactHit.map((i) => i.replace("minecraft:", "")).join(", "));
  const suffixOnly = denied.filter((id) => !DENIED_BLOCK_IDS.includes(id));
  p("");
  p(`-- DENIED BY SUFFIX RULE ONLY (${DENIED_SUFFIXES.join(" | ")}) --`);
  p(`(${suffixOnly.length}) ` + suffixOnly.map((i) => i.replace("minecraft:", "")).join(", "));
  const unintended = suffixOnly.filter((id) => !/_command_block$|_shulker_box$|_spawner$|_obsidian$|_bedrock$/.test(id));
  eq(unintended.length, 0, "suffix rules match only intended ids");
  for (const id of suffixOnly) {
    check(denyOracleSet.has(id) || /_obsidian$|_bedrock$/.test(id), `suffix-only deny match ${id} is not explained by the task deny-list`);
  }
  // each suffix rule must match something (otherwise it is dead weight)
  for (const suf of DENIED_SUFFIXES) check(BLOCK_IDS.some((id) => id.endsWith(suf)), `suffix rule ${suf} matches nothing`);
  p("");
  p("-- Review aid: ids whose name contains a keyword but which are NOT allowed (deliberate exclusions) --");
  const kw = /door|glass|leaves|wool|carpet|plank|log|wood|stem|hyphae|fence|gate|slab|stairs|sign|ladder|scaffold|bamboo|hay|web/;
  const near = neither.filter((id) => kw.test(id) && !isDeniedBlockId(id));
  const groups = {
    "hard_* (Education Edition hardened glass)": near.filter((i) => /^minecraft:hard_/.test(i)),
    "stone / brick / metal / mineral slabs and stairs": near.filter((i) => /(slab|stairs)$/.test(i) && !/^minecraft:hard_/.test(i)),
    "other": near.filter((i) => !/^minecraft:hard_/.test(i) && !/(slab|stairs)$/.test(i)),
  };
  for (const [g, ids] of Object.entries(groups)) {
    p(`[${g}] (${ids.length})`);
    p("    " + ids.map((i) => i.replace("minecraft:", "")).join(", "));
  }
  p("");
  p(`-- All other ids (${neither.length - near.length}) are unrelated blocks (stone, ores, dirt, redstone, ...) and are never touched --`);
  classificationText = L.join("\n");

  // black-box: place each of the 1100 ids in the nearest lane and see whether a pass removes it
  const mod = sim.mod;
  let blackBoxMismatch = [];
  for (const id of BLOCK_IDS) {
    const s = new Sim();
    S = s;
    const dim = s.dims.overworld;
    dim.addEntity({ x: 0.5, y: 64, z: 0.5, view: { x: 1, y: 0, z: 0 }, variant: 3 });
    dim.set(1, 64, 0, id);
    try {
      mod.runPass();
    } catch (e) {
      s.uncaught.push(e);
    }
    const removed = dim.get(1, 64, 0) !== id;
    if (removed !== isBreakableBlockId(id)) blackBoxMismatch.push(`${id}: removed=${removed} predicate=${isBreakableBlockId(id)}`);
    if (s.uncaught.length || s.warns.length || violations.length) blackBoxMismatch.push(`${id}: uncaught/warn/violation`);
  }
  S = sim;
  eq(blackBoxMismatch.length, 0, `black-box mismatches: ${blackBoxMismatch.slice(0, 5).join("; ")}`);
  p("");
  p(`black-box check: placed each of the ${BLOCK_IDS.length} ids 1 block ahead of a raging entity and ran a pass: removed iff allowed (mismatches: ${blackBoxMismatch.length})`);
  classificationText = L.join("\n");
  sim.warns.length = 0;
  hygiene(sim);
});
say("");
say(classificationText);

// ---- API verification (static) -----------------------------------------------------------
await test("(a2) static API verification of main.js against @minecraft/server 1.11.0 metadata", async () => {
  const { lines, failures } = await verifyApi();
  for (const f of failures) cur.failures.push(f);
  cur.asserts += 1;
  apiText = lines.join("\n");
});

say("");
say("API members touched at runtime by main.js during these tests (all exist in 1.11.0 and are on the reviewed list):");
say("  " + [...touched].sort().join(", "));

const failed = results.filter((r) => r.failures.length);
const totalChecks = results.reduce((s, r) => s + r.asserts, 0);
say("");
say(`SUMMARY: ${results.length - failed.length}/${results.length} scenarios passed, ${totalChecks} checks, ${failed.length} failed`);
if (orphanWarns.length) say(`stray console.warn outside any scenario: ${orphanWarns.join(" | ")}`);

if (OUT_DIR) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "test_script.txt"), report.join("\n") + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "block_classification.txt"), classificationText + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "api_verification.txt"), apiText + "\n");
}
process.exit(failed.length || orphanWarns.length ? 1 : 0);
