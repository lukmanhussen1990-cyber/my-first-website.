// Engine-test framework on top of @minecraft/server-gametest 1.0.0-beta.
//
// defineTest(meta, body) registers one GameTest "pas:<name>" and wraps it so
// that every outcome is printed on the server console (the runner parses these):
//   PASREG|<name>|<phase>|<maxTicks>|<subsystem>|<needsBridge>|<structure>|<description>
//   PASTEST|<name>|START|origin=x,y,z
//   PASCHECK|<name>|ok|<message>        (one per soft check)
//   PASCHECK|<name>|FAIL|<message>
//   PASINFO|<name>|<message>
//   PASTEST|<name>|PASS|<detail>   / FAIL / PENDING / READY (pre-reload tests)
// A test body is an async function receiving a Ctx (see below).
import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import * as gt from "@minecraft/server-gametest";
import { bridgeCall } from "./bridge.js";

export const REGISTRY = [];
const one = (s) => String(s).replace(/\r?\n/g, " | ").replace(/\|\s*\|/g, "|");
export const out = (s) => console.warn(one(s));

class Pending extends Error {}
class Assertion extends Error {}

/** Floor of the GameTest structures in test-relative coordinates (template y0 -> rel y1). */
export const FLOOR = 1;
/** Feet level of a player/mob standing on the floor. */
export const FEET = 2;

export class Ctx {
  constructor(test, meta) {
    this.test = test;
    this.meta = meta;
    this.name = meta.name;
    this.dim = test.getDimension();
    this.failures = [];
    this.checks = 0;
    this.cleanups = [];
    this.pendingReason = undefined;
    this.players = [];
  }
  // ---- coordinates
  w(rel) {
    return this.test.worldBlockLocation(rel);
  }
  wl(rel) {
    return this.test.worldLocation(rel);
  }
  rel(worldLoc) {
    return this.test.relativeBlockLocation(worldLoc);
  }
  block(rel) {
    return this.dim.getBlock(this.w(rel));
  }
  blockAt(worldLoc) {
    return this.dim.getBlock(worldLoc);
  }
  set(rel, typeId, states) {
    const perm = BlockPermutation.resolve(typeId, states ?? {});
    this.test.setBlockPermutation(perm, rel);
  }
  // ---- reporting
  info(msg) {
    out(`PASINFO|${this.name}|${msg}`);
  }
  check(cond, msg) {
    this.checks++;
    const ok = !!cond;
    out(`PASCHECK|${this.name}|${ok ? "ok" : "FAIL"}|${msg}`);
    if (!ok) this.failures.push(msg);
    return ok;
  }
  assert(cond, msg) {
    if (!this.check(cond, msg)) throw new Assertion(msg);
  }
  pending(reason) {
    throw new Pending(reason);
  }
  onCleanup(fn) {
    this.cleanups.push(fn);
  }
  // ---- time
  wait(ticks) {
    return new Promise((resolve) => system.runTimeout(resolve, Math.max(1, Math.floor(ticks))));
  }
  /** Poll `fn` every `step` ticks until it returns a truthy value or `timeout` ticks pass. */
  async waitUntil(fn, timeout, step = 2) {
    const t0 = system.currentTick;
    for (;;) {
      let v;
      try {
        v = fn();
      } catch (e) {
        v = undefined;
      }
      if (v) return { ok: true, ticks: system.currentTick - t0, value: v };
      if (system.currentTick - t0 >= timeout) return { ok: false, ticks: system.currentTick - t0, value: v };
      await this.wait(step);
    }
  }
  // ---- players
  player(name, rel, gameMode = "survival") {
    const p = this.test.spawnSimulatedPlayer(rel, name, gameMode);
    this.players.push(p);
    return p;
  }
  inv(p) {
    return p.getComponent("minecraft:inventory").container;
  }
  /** {typeId: count} of a player's inventory. */
  items(p) {
    const c = this.inv(p);
    const m = {};
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it) m[it.typeId] = (m[it.typeId] ?? 0) + it.amount;
    }
    return m;
  }
  give(p, typeId, amount = 1, slot = 0, select = true) {
    return p.setItem(new ItemStack(typeId, amount), slot, select);
  }
  // ---- entities
  /** Entities inside the test area's world box (plus `pad` blocks around it). */
  entities(filter = {}, size = this.meta.size, pad = 2) {
    const lo = this.w({ x: -pad, y: -pad, z: -pad });
    const hi = this.w({ x: size[0] + pad, y: size[1] + pad + 1, z: size[2] + pad });
    const min = { x: Math.min(lo.x, hi.x), y: Math.min(lo.y, hi.y), z: Math.min(lo.z, hi.z) };
    const vol = { x: Math.abs(hi.x - lo.x), y: Math.abs(hi.y - lo.y), z: Math.abs(hi.z - lo.z) };
    return this.dim.getEntities({ ...filter, location: min, volume: vol });
  }
  count(typeId) {
    return this.entities({ type: typeId }).length;
  }
  spawn(typeId, rel) {
    return this.dim.spawnEntity(typeId, this.wl({ x: rel.x + 0.5, y: rel.y, z: rel.z + 0.5 }));
  }
  /** Remove every non-player entity of the test area (no drops). */
  clearEntities() {
    for (const e of this.entities({ excludeTypes: ["minecraft:player"] })) {
      try {
        e.remove();
      } catch {
        // already gone
      }
    }
  }
  // ---- add-on access
  bridge(op, payload = {}) {
    return bridgeCall(op, payload);
  }
  api(fn, ...args) {
    return bridgeCall("api", { fn, args });
  }
  /** /scriptevent pas:outbreak <sub> (the add-on's own command interface). */
  outbreakCmd(sub) {
    try {
      this.dim.runCommand(`scriptevent pas:outbreak ${sub}`);
      return true;
    } catch (e) {
      this.info(`scriptevent pas:outbreak ${sub} failed: ${e}`);
      return false;
    }
  }
  cmd(c) {
    try {
      return this.dim.runCommand(c);
    } catch (e) {
      this.info(`command failed: ${c} -> ${e}`);
      return undefined;
    }
  }
  /** Mark the end of a pre-reload test: print READY and idle until the server stops. */
  async readyForReload(detail) {
    out(`PASTEST|${this.name}|READY|${detail ?? ""}`);
    for (;;) await this.wait(200);
  }
}

/** World dynamic properties of the test pack (they persist across a server restart). */
export function handoffSet(key, value) {
  world.setDynamicProperty(`pastest:${key}`, JSON.stringify(value));
}
export function handoffGet(key) {
  const v = world.getDynamicProperty(`pastest:${key}`);
  return typeof v === "string" ? JSON.parse(v) : undefined;
}

const SIZES = {
  "pastest:flat": [12, 6, 12],
  "pastest:dark_room": [15, 8, 15],
  "pastest:grass_platform": [24, 16, 24],
  "pastest:arena": [24, 8, 24],
};

/**
 * @param {{name:string, phase?:string, structure?:string, maxTicks?:number, subsystem?:string,
 *          bridge?:boolean, description?:string}} meta
 * @param {(ctx: Ctx) => Promise<void>} body
 */
export function defineTest(meta, body) {
  const m = {
    phase: "main",
    structure: "pastest:flat",
    maxTicks: 600,
    subsystem: "core",
    bridge: false,
    description: "",
    ...meta,
  };
  m.size = SIZES[m.structure] ?? [16, 8, 16];
  REGISTRY.push(m);
  gt.registerAsync("pas", m.name, async (test) => {
    const ctx = new Ctx(test, m);
    const o = test.worldBlockLocation({ x: 0, y: 0, z: 0 });
    out(`PASTEST|${m.name}|START|origin=${o.x},${o.y},${o.z} tick=${system.currentTick}`);
    let status = "PASS";
    let detail = "";
    let timer;
    try {
      const deadline = new Promise((_, reject) => {
        timer = system.runTimeout(() => reject(new Error(`test body exceeded ${m.maxTicks} ticks`)), m.maxTicks);
      });
      await Promise.race([body(ctx), deadline]);
      if (ctx.failures.length) {
        status = "FAIL";
        detail = `${ctx.failures.length}/${ctx.checks} checks failed: ${ctx.failures.join("; ")}`;
      } else detail = `${ctx.checks} checks`;
    } catch (e) {
      if (e instanceof Pending) {
        status = ctx.failures.length ? "FAIL" : "PENDING";
        detail = `${e.message}${ctx.failures.length ? ` (and ${ctx.failures.length} failed checks: ${ctx.failures.join("; ")})` : ""}`;
      } else {
        status = "FAIL";
        const msg = e instanceof Assertion ? e.message : `${e}${e && e.stack ? " @ " + e.stack : ""}`;
        const others = ctx.failures.filter((f) => f !== msg);
        detail = `${msg}${others.length ? ` (also: ${others.join("; ")})` : ""}`;
      }
    } finally {
      if (timer !== undefined) system.clearRun(timer);
      for (const fn of ctx.cleanups.reverse()) {
        try {
          await fn();
        } catch (e) {
          out(`PASINFO|${m.name}|cleanup error: ${e}`);
        }
      }
    }
    out(`PASTEST|${m.name}|${status}|${detail}`);
    try {
      if (status === "FAIL") test.fail(detail);
      else test.succeed();
    } catch {
      // fail() may throw a GameTestError by design
    }
  })
    .structureName(m.structure)
    .maxTicks(m.maxTicks + 200)
    .tag(`pas_${m.phase}`);
}

export function printRegistry() {
  for (const m of REGISTRY) {
    out(`PASREG|${m.name}|${m.phase}|${m.maxTicks}|${m.subsystem}|${m.bridge ? 1 : 0}|${m.structure}|${m.description}`);
  }
}
