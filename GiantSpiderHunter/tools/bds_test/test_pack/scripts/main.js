// GSH Test Harness pack (TEST ONLY - never shipped with the addon).
//
// * Registers the GameTest "gsh_harness:session" (very long maxTicks). While it runs, the
//   harness can spawn GameTest SimulatedPlayers, which are real server-side players that
//   world.getPlayers() returns in every behavior pack.
// * Receives commands as JSON from `/scriptevent gsht:cmd {"seq":N,"op":"...",...}` and
//   answers with one console line `GSHT {"t":"ack","seq":N,"ok":true|false,...}`.
// * Prints periodic world probes `GSHT {"t":"probe",...}` (players + horror:giant_spider
//   entities with their properties) and event lines `GSHT {"t":"ev",...}`.
// tools/bds_test/bds.py parses these lines into runs/<name>/timeline.jsonl.
import {
  world,
  system,
  ItemStack,
  EquipmentSlot,
  Direction,
} from "@minecraft/server";
import * as gt from "@minecraft/server-gametest";

const OUT_TAG = "GSHT ";
const SPIDER = "horror:giant_spider";
const SPIDER_PROPS = [
  "horror:state",
  "horror:giant",
  "horror:small_scale",
  "horror:giant_scale",
  "horror:grow_time",
  "horror:attack_id",
  "horror:attack_kind",
  "horror:foot_0",
  "horror:foot_1",
  "horror:foot_2",
  "horror:foot_3",
  "horror:foot_4",
  "horror:foot_5",
  "horror:foot_6",
  "horror:foot_7",
  "horror:difficulty",
];
const DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
const SESSION_MAX_TICKS = 20 * 60 * 60 * 12; // 12 h

const S = {
  test: null, // GameTest helper of the running session
  sessionId: 0,
  players: new Map(), // name -> SimulatedPlayer
  holds: new Map(), // name -> {loc, rot}
  probeEvery: 20,
  lastProbe: -1000,
  watchTypes: [SPIDER], // entity types included in probes ("spiders" array)
  probeSeq: 0,
  // Simulated players do not load chunks by themselves. Each one gets a ticking area that
  // follows it (radius in chunks, max 4 = the default simulation distance), so the world
  // around it loads and ticks like around a real player.
  areaRadius: 4,
  areas: new Map(), // player name -> {x, z, dim, slot, name}
  areaIndex: new Map(), // player name -> small int used in area names
  areaCleanupDone: false,
};
const AREA_PREFIX = "gsht_";
const AREA_MAX_INDEX = 8;

// ---------------------------------------------------------------- output helpers
function out(obj) {
  obj.tick = system.currentTick;
  console.warn(OUT_TAG + JSON.stringify(obj));
}
function r3(n) {
  return typeof n === "number" ? Math.round(n * 1000) / 1000 : n;
}
function v3(v) {
  return v ? [r3(v.x), r3(v.y), r3(v.z)] : null;
}
function safe(fn, fallback) {
  try {
    return fn();
  } catch (e) {
    return fallback;
  }
}
function errStr(e) {
  if (e === undefined || e === null) return "error";
  const msg = e.message !== undefined ? e.message : String(e);
  return String(msg).slice(0, 400);
}
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function distH(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
function sleep(ticks) {
  return new Promise((resolve) => system.runTimeout(resolve, Math.max(1, ticks | 0)));
}
function num(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`argument ${name} must be a number`);
  return n;
}
function loc(r, prefix = "") {
  return { x: num(r[prefix + "x"], "x"), y: num(r[prefix + "y"], "y"), z: num(r[prefix + "z"], "z") };
}
function dim(r) {
  return world.getDimension(r && r.dim ? r.dim : "minecraft:overworld");
}
function ref(e) {
  if (!e) return null;
  const o = { type: safe(() => e.typeId), id: safe(() => e.id) };
  if (o.type === "minecraft:player") o.name = safe(() => e.name);
  return o;
}
function health(e) {
  return safe(() => {
    const h = e.getComponent("minecraft:health");
    return h ? r3(h.currentValue) : undefined;
  });
}

// ---------------------------------------------------------------- lookups
function findPlayer(name) {
  const p = S.players.get(name);
  if (p && safe(() => p.isValid(), false)) return p;
  for (const q of world.getAllPlayers()) {
    if (q && safe(() => q.name) === name) return q;
  }
  return undefined;
}
function needPlayer(name) {
  const p = findPlayer(name);
  if (!p) throw new Error(`no player named ${name}`);
  return p;
}
function needSim(name) {
  const p = needPlayer(name);
  if (typeof p.lookAtLocation !== "function") throw new Error(`${name} is not a simulated player`);
  return p;
}
// target spec: {"id":"-123"} | {"player":"P1"} | {"type":"horror:giant_spider"} (nearest to `from`)
function resolveTarget(spec, from) {
  spec = spec || { type: SPIDER };
  if (spec.id !== undefined) {
    const e = world.getEntity(String(spec.id));
    if (!e) throw new Error(`no entity with id ${spec.id}`);
    return e;
  }
  if (spec.player !== undefined) return needPlayer(spec.player);
  const type = spec.type || SPIDER;
  const d = from ? from.dimension : dim(spec);
  const opts = { type };
  if (from) {
    opts.location = from.location;
    opts.closest = 1;
  }
  const list = d.getEntities(opts).filter((e) => !(from && e.id === from.id));
  if (!list.length) throw new Error(`no loaded entity of type ${type}`);
  return list[0];
}

// ---------------------------------------------------------------- terrain helpers
const NOT_GROUND = /(leaves|log|wood|stem|vine|mushroom_block|bamboo|hyphae)/;
function isPassable(b) {
  if (!b) return false;
  if (b.isAir) return true;
  if (b.isLiquid) return false;
  return !safe(() => b.isSolid, true);
}
function isGround(b) {
  if (!b || b.isAir || b.isLiquid) return false;
  if (!safe(() => b.isSolid, false)) return false;
  return !NOT_GROUND.test(b.typeId);
}
// y of the first standing position (feet) at x/z, or undefined when unloaded / unsuitable.
function standY(d, x, z) {
  x = Math.floor(x);
  z = Math.floor(z);
  const top = safe(() => d.getTopmostBlock({ x, z }));
  if (!top) return undefined;
  const minY = d.heightRange.min;
  for (let y = top.y; y > minY; y--) {
    const b = safe(() => d.getBlock({ x, y, z }));
    if (!b) return undefined;
    if (b.isLiquid) return undefined; // water/lava surface: not dry land
    if (isGround(b)) {
      if (isPassable(safe(() => d.getBlock({ x, y: y + 1, z }))) && isPassable(safe(() => d.getBlock({ x, y: y + 2, z }))))
        return y + 1;
      if (!NOT_GROUND.test(b.typeId)) return undefined; // buried under something solid
    }
  }
  return undefined;
}
// height of entity feet above the first solid non-passable block below (max 96 scanned)
function aboveGround(e) {
  const d = e.dimension;
  const l = e.location;
  const x = Math.floor(l.x), z = Math.floor(l.z);
  let y = Math.floor(l.y);
  for (let i = 0; i < 96; i++, y--) {
    const b = safe(() => d.getBlock({ x, y, z }));
    if (!b) return undefined;
    if (!b.isAir && (b.isLiquid || safe(() => b.isSolid, false))) return r3(l.y - (y + 1));
  }
  return 96;
}
function chunkLoaded(d, x, z) {
  return !!safe(() => d.getBlock({ x: Math.floor(x), y: d.heightRange.min, z: Math.floor(z) }));
}
// Spiral search for dry standing ground near (x, z) once the chunks are loaded.
function findStand(d, x, z, radius) {
  const R = Math.max(0, radius | 0);
  for (let r = 0; r <= R; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const y = standY(d, x + dx, z + dz);
        if (y !== undefined) return { x: Math.floor(x + dx) + 0.5, y, z: Math.floor(z + dz) + 0.5 };
      }
    }
  }
  return undefined;
}
// Teleports `p` above (x, z), holds it in the air until the chunk is loaded, then puts it on
// the ground. Resolves with the final location.
async function placeOnGround(p, r) {
  const d = dim(r);
  const x = num(r.x, "x"), z = num(r.z, "z");
  const name = p.name;
  const hover = { x: Math.floor(x) + 0.5, y: Math.min(d.heightRange.max - 4, 300), z: Math.floor(z) + 0.5 };
  p.teleport(hover, { dimension: d });
  S.holds.set(name, { loc: hover, dim: d.id });
  try {
    const maxWait = r.timeoutTicks || 400;
    for (let waited = 0; waited < maxWait; waited += 5) {
      await sleep(5);
      if (!chunkLoaded(d, x, z)) continue;
      const spot = findStand(d, x, z, r.search === undefined ? 8 : r.search);
      if (spot) {
        S.holds.delete(name);
        const opts = { dimension: d };
        if (r.yaw !== undefined) opts.rotation = { x: 0, y: num(r.yaw, "yaw") };
        p.teleport(spot, opts);
        if (typeof p.clearVelocity === "function") safe(() => p.clearVelocity());
        return v3(spot);
      }
      if (waited > 60) throw new Error(`no dry standing ground within ${r.search ?? 8} blocks of ${x},${z}`);
    }
    throw new Error(`chunk at ${x},${z} did not load in time`);
  } finally {
    S.holds.delete(name);
  }
}

// ---------------------------------------------------------------- probes
function playerInfo(p) {
  const o = { name: safe(() => p.name), id: safe(() => p.id), sim: S.players.has(safe(() => p.name)) };
  o.valid = safe(() => p.isValid(), false);
  o.dim = safe(() => p.dimension.id);
  o.loc = safe(() => v3(p.location));
  o.rot = safe(() => {
    const r = p.getRotation();
    return [r3(r.x), r3(r.y)];
  });
  o.head = safe(() => (p.headRotation ? [r3(p.headRotation.x), r3(p.headRotation.y)] : undefined));
  o.view = safe(() => v3(p.getViewDirection()));
  o.vel = safe(() => v3(p.getVelocity()));
  o.hp = health(p);
  o.hpMax = safe(() => p.getComponent("minecraft:health").effectiveMax);
  o.gm = safe(() => p.getGameMode());
  o.onGround = safe(() => p.isOnGround);
  o.gliding = safe(() => p.isGliding);
  o.flying = safe(() => p.isFlying);
  o.sprinting = safe(() => p.isSprinting);
  o.falling = safe(() => p.isFalling);
  o.inWater = safe(() => p.isInWater);
  o.agl = safe(() => aboveGround(p));
  o.tags = safe(() => p.getTags(), []);
  o.effects = safe(() => p.getEffects().map((e) => [e.typeId, e.amplifier, e.duration]), []);
  o.held = S.holds.has(o.name);
  return o;
}
function entityInfo(e, players) {
  const o = { id: safe(() => e.id), type: safe(() => e.typeId) };
  o.dim = safe(() => e.dimension.id);
  o.loc = safe(() => v3(e.location));
  o.rot = safe(() => {
    const r = e.getRotation();
    return [r3(r.x), r3(r.y)];
  });
  o.vel = safe(() => v3(e.getVelocity()));
  o.hp = health(e);
  o.hpMax = safe(() => e.getComponent("minecraft:health").effectiveMax);
  o.onGround = safe(() => e.isOnGround);
  o.nameTag = safe(() => e.nameTag);
  o.tags = safe(() => e.getTags(), []);
  o.props = {};
  if (o.type === SPIDER) {
    for (const pn of SPIDER_PROPS) {
      const v = safe(() => e.getProperty(pn));
      if (v !== undefined) o.props[pn] = typeof v === "number" ? r3(v) : v;
    }
  }
  o.target = safe(() => ref(e.target));
  o.dprops = safe(() => e.getDynamicPropertyIds(), []); // only this pack's own (dynamic props are pack-scoped)
  const near = {};
  if (o.loc) {
    for (const p of players) {
      if (!p.loc || p.dim !== o.dim) continue;
      const a = { x: o.loc[0], y: o.loc[1], z: o.loc[2] };
      const b = { x: p.loc[0], y: p.loc[1], z: p.loc[2] };
      near[p.name] = [r3(dist(a, b)), r3(distH(a, b)), r3(b.y - a.y)]; // [3d, horizontal, player dy]
    }
  }
  o.near = near;
  return o;
}
function snapshot() {
  const players = safe(() => world.getAllPlayers(), [])
    .filter((p) => p)
    .map(playerInfo);
  const ents = [];
  const counts = {};
  for (const did of DIMENSIONS) {
    const d = safe(() => world.getDimension(did));
    if (!d) continue;
    for (const type of S.watchTypes) {
      const list = safe(() => d.getEntities({ type }), []);
      counts[type] = (counts[type] || 0) + list.length;
      for (const e of list) ents.push(entityInfo(e, players));
    }
  }
  return {
    session: S.test ? S.sessionId : 0,
    time: safe(() => world.getTimeOfDay()),
    players,
    spiders: ents,
    counts,
  };
}

// ---------------------------------------------------------------- ops
function lookDuration(mode) {
  const m = String(mode || "continuous").toLowerCase();
  if (m === "instant") return gt.LookDuration.Instant;
  if (m === "untilmove") return gt.LookDuration.UntilMove;
  return gt.LookDuration.Continuous;
}
function equip(p, slot, item) {
  const eq = p.getComponent("minecraft:equippable");
  if (!eq) throw new Error("player has no equippable component");
  const s = EquipmentSlot[slot] || slot;
  eq.setEquipment(s, item ? new ItemStack(item, 1) : undefined);
}

const OPS = {
  ping: () => ({ session: S.test ? S.sessionId : 0, players: world.getAllPlayers().length }),
  snap: () => snapshot(),
  probe: (r) => {
    S.probeEvery = Math.max(0, num(r.every, "every") | 0);
    if (Array.isArray(r.watch)) S.watchTypes = Array.from(new Set([SPIDER, ...r.watch]));
    return { every: S.probeEvery, watch: S.watchTypes };
  },
  areas: (r) => {
    if (r.radius !== undefined) S.areaRadius = Math.max(0, Math.min(4, num(r.radius, "radius") | 0));
    return { radius: S.areaRadius, areas: Array.from(S.areas.entries()).map(([n, a]) => ({ player: n, name: a.name, x: a.x, z: a.z, dim: a.dim })) };
  },
  worldInfo: () => ({
    spawn: safe(() => world.getDefaultSpawnLocation()),
    time: safe(() => world.getTimeOfDay()),
    day: safe(() => world.getDay()),
    session: S.test ? S.sessionId : 0,
    origin: S.test ? safe(() => S.test.worldBlockLocation({ x: 0, y: 0, z: 0 })) : null,
  }),

  // ---- players
  spawn: (r) => {
    if (!S.test) throw new Error("no GameTest session running (bds.py starts gsh_harness:session)");
    const name = String(r.name);
    if (findPlayer(name)) throw new Error(`player ${name} already online`);
    const p = S.test.spawnSimulatedPlayer({ x: 0, y: 1, z: 0 }, name, r.gm || "survival");
    S.players.set(name, p);
    if (r.x !== undefined && r.z !== undefined) {
      if (r.y !== undefined) {
        p.teleport(loc(r), { dimension: dim(r), rotation: { x: 0, y: Number(r.yaw || 0) } });
        return { id: p.id, loc: v3(loc(r)) };
      }
      return placeOnGround(p, r).then((l) => ({ id: p.id, loc: l }));
    }
    return { id: p.id, loc: v3(p.location) };
  },
  place: (r) => placeOnGround(needPlayer(r.name), r).then((l) => ({ loc: l })),
  tp: (r) => {
    const p = needPlayer(r.name);
    const opts = { dimension: dim(r) };
    if (r.yaw !== undefined || r.pitch !== undefined) opts.rotation = { x: Number(r.pitch || 0), y: Number(r.yaw || 0) };
    if (r.facing) opts.facingLocation = loc(r.facing);
    p.teleport(loc(r), opts);
    if (S.holds.has(p.name)) S.holds.set(p.name, { loc: loc(r), dim: dim(r).id });
    return { loc: v3(p.location) };
  },
  hold: (r) => {
    const p = needPlayer(r.name);
    const l = r.x !== undefined ? loc(r) : p.location;
    S.holds.set(p.name, { loc: { x: l.x, y: l.y, z: l.z }, dim: r.dim || p.dimension.id });
    p.teleport(l, { dimension: world.getDimension(r.dim || p.dimension.id) });
    return { loc: v3(l) };
  },
  release: (r) => ({ released: S.holds.delete(String(r.name)) }),
  move: (r) => {
    // relative to facing: lr = left(+)/right(-), fb = forward(+)/back(-)
    needSim(r.name).moveRelative(num(r.lr || 0, "lr"), num(r.fb === undefined ? 1 : r.fb, "fb"), num(r.speed || 1, "speed"));
    return {};
  },
  moveDir: (r) => {
    // absolute: we = west(-)/east(+) x, ns = north(-)/south(+) z
    needSim(r.name).move(num(r.we || 0, "we"), num(r.ns || 0, "ns"), num(r.speed || 1, "speed"));
    return {};
  },
  moveTo: (r) => {
    needSim(r.name).moveToLocation(loc(r), { speed: num(r.speed || 1, "speed"), faceTarget: r.face !== false });
    return {};
  },
  navTo: (r) => {
    const res = needSim(r.name).navigateToLocation(loc(r), num(r.speed || 1, "speed"));
    return { fullPath: res.isFullPath, nodes: safe(() => res.getPath().length) };
  },
  navEntity: (r) => {
    const p = needSim(r.name);
    const res = p.navigateToEntity(resolveTarget(r.target, p), num(r.speed || 1, "speed"));
    return { fullPath: res.isFullPath, nodes: safe(() => res.getPath().length) };
  },
  stop: (r) => {
    needSim(r.name).stopMoving();
    return {};
  },
  sprint: (r) => {
    const p = needSim(r.name);
    p.isSprinting = r.on !== false;
    return { sprinting: p.isSprinting };
  },
  look: (r) => {
    const p = needSim(r.name);
    if (r.target) {
      const e = resolveTarget(r.target, p);
      p.lookAtEntity(e, lookDuration(r.mode));
      return { target: ref(e) };
    }
    p.lookAtLocation(loc(r), lookDuration(r.mode));
    return {};
  },
  rotate: (r) => {
    needSim(r.name).setBodyRotation(num(r.yaw, "yaw"));
    return {};
  },
  attack: (r) => {
    const p = needSim(r.name);
    const e = resolveTarget(r.target, p);
    return { hit: p.attackEntity(e), target: ref(e), dist: r3(dist(p.location, e.location)) };
  },
  swing: (r) => ({ hit: needSim(r.name).attack() }),
  jump: (r) => ({ ok: needSim(r.name).jump() }),
  glide: (r) => {
    const p = needSim(r.name);
    if (r.equip !== false) equip(p, "Chest", "minecraft:elytra");
    return { ok: p.glide() };
  },
  stopGlide: (r) => {
    needSim(r.name).stopGliding();
    return {};
  },
  fly: (r) => {
    needSim(r.name).fly();
    return {};
  },
  stopFly: (r) => {
    needSim(r.name).stopFlying();
    return {};
  },
  gamemode: (r) => {
    const p = needPlayer(r.name);
    p.setGameMode(r.gm);
    return { gm: p.getGameMode() };
  },
  kill: (r) => ({ killed: needPlayer(r.name).kill() }),
  damage: (r) => ({
    applied: needPlayer(r.name).applyDamage(num(r.amount, "amount"), { cause: r.cause || "override" }),
  }),
  heal: (r) => {
    const h = needPlayer(r.name).getComponent("minecraft:health");
    h.resetToMaxValue();
    return { hp: h.currentValue };
  },
  respawn: (r) => ({ ok: needSim(r.name).respawn() }),
  disconnect: (r) => {
    const p = needSim(r.name);
    S.holds.delete(p.name);
    p.disconnect();
    S.players.delete(String(r.name));
    return {};
  },
  remove: (r) => {
    const p = needSim(r.name);
    S.holds.delete(p.name);
    S.test.removeSimulatedPlayer(p);
    S.players.delete(String(r.name));
    return {};
  },
  effect: (r) => {
    const p = needPlayer(r.name);
    const ok = p.addEffect(r.effect, Math.max(1, Math.round(num(r.seconds || 30, "seconds") * 20)), {
      amplifier: Number(r.amp || 0),
      showParticles: r.particles !== false,
    });
    return { ok: !!ok };
  },
  clearEffects: (r) => {
    const p = needPlayer(r.name);
    for (const e of p.getEffects()) p.removeEffect(e.typeId);
    return {};
  },
  give: (r) => {
    const p = needSim(r.name);
    const st = new ItemStack(r.item, Number(r.count || 1));
    if (r.slot !== undefined) p.setItem(st, Number(r.slot), r.select !== false);
    else p.giveItem(st, r.select !== false);
    return {};
  },
  equip: (r) => {
    equip(needPlayer(r.name), r.slot || "Chest", r.item);
    return {};
  },
  inventory: (r) => {
    const c = needPlayer(r.name).getComponent("minecraft:inventory").container;
    const items = [];
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it) items.push([i, it.typeId, it.amount]);
    }
    return { items };
  },
  useOnBlock: (r) => {
    const p = needSim(r.name);
    const face = Direction[r.face || "Up"];
    return { ok: p.useItemInSlotOnBlock(Number(r.slot || 0), loc(r), face) };
  },
  useItem: (r) => ({ ok: needSim(r.name).useItemInSlot(Number(r.slot || 0)) }),
  interactEntity: (r) => {
    const p = needSim(r.name);
    return { ok: p.interactWithEntity(resolveTarget(r.target, p)) };
  },
  chat: (r) => {
    needSim(r.name).chat(String(r.message));
    return {};
  },
  cmd: (r) => {
    // runs a command as the player (r.name) or from the overworld; failure -> ok:false
    const src = r.name ? needPlayer(r.name) : dim(r);
    const res = src.runCommand(String(r.command));
    return { successCount: res.successCount };
  },

  // ---- world / entities
  findBiome: (r) => {
    const d = dim(r);
    const from = r.x !== undefined ? loc(r) : { x: 0, y: 64, z: 0 };
    const size = Number(r.size || 2048);
    const l = d.findClosestBiome(from, r.biome, { boundingSize: { x: size, y: 64, z: size } });
    return { loc: l ? v3(l) : null };
  },
  // Forest finder without findClosestBiome (which crashes BDS 1.21.0.26): counts surface leaves on a
  // grid around (x, z) inside loaded chunks and returns the centre of the densest 24x24 window.
  forestNear: (r) => {
    const d = dim(r);
    const cx = Math.floor(num(r.x, "x")), cz = Math.floor(num(r.z, "z"));
    const R = Number(r.radius || 56), step = 4;
    const cells = new Map();
    let scanned = 0;
    for (let x = cx - R; x <= cx + R; x += step) {
      for (let z = cz - R; z <= cz + R; z += step) {
        let top;
        try {
          top = d.getTopmostBlock({ x, z });
        } catch (e) {
          top = undefined;
        }
        if (!top) continue;
        scanned++;
        if (/leaves/.test(safe(() => top.typeId, ""))) {
          const k = `${Math.floor(x / 24)},${Math.floor(z / 24)}`;
          cells.set(k, (cells.get(k) || 0) + 1);
        }
      }
    }
    let best = null;
    for (const [k, n] of cells) if (!best || n > best.n) best = { k, n };
    if (!best) return { loc: null, scanned };
    const [gx, gz] = best.k.split(",").map(Number);
    return { loc: [gx * 24 + 12, 64, gz * 24 + 12], leaves: best.n, scanned };
  },
  ground: (r) => {
    const d = dim(r);
    if (!chunkLoaded(d, num(r.x, "x"), num(r.z, "z"))) return { loaded: false, y: null };
    const s = findStand(d, num(r.x, "x"), num(r.z, "z"), r.search || 0);
    return { loaded: true, y: s ? s.y : null, loc: s ? v3(s) : null };
  },
  block: (r) => {
    const b = dim(r).getBlock(loc(r));
    return b ? { type: b.typeId, air: b.isAir, liquid: b.isLiquid, solid: safe(() => b.isSolid) } : { loaded: false };
  },
  entities: (r) => {
    const players = world.getAllPlayers().map(playerInfo);
    const list = dim(r).getEntities(r.type ? { type: r.type } : {});
    return { entities: list.slice(0, Number(r.limit || 50)).map((e) => entityInfo(e, players)), total: list.length };
  },
  entityEvent: (r) => {
    const e = resolveTarget(r.target);
    e.triggerEvent(String(r.event));
    return { target: ref(e) };
  },
  entityProp: (r) => {
    const e = resolveTarget(r.target);
    e.setProperty(String(r.prop), r.value);
    return { value: e.getProperty(String(r.prop)) };
  },
  entityTp: (r) => {
    const e = resolveTarget(r.target);
    e.teleport(loc(r), { dimension: dim(r) });
    return { loc: v3(e.location) };
  },
  entityRemove: (r) => {
    const e = resolveTarget(r.target);
    e.remove();
    return {};
  },
  entityHurt: (r) => {
    const e = resolveTarget(r.target);
    const opts = { cause: r.cause || "entityAttack" };
    if (r.by) opts.damagingEntity = needPlayer(r.by);
    return { applied: e.applyDamage(num(r.amount, "amount"), opts) };
  },
  time: (r) => {
    world.setTimeOfDay(num(r.value, "value"));
    return {};
  },
};

// ---------------------------------------------------------------- command channel
function ack(seq, op, ok, err, data) {
  const o = { t: "ack", seq, op, ok };
  if (err) o.err = err;
  if (data !== undefined) o.data = data;
  out(o);
}
function handle(message) {
  let req;
  try {
    req = JSON.parse(message);
  } catch (e) {
    ack(-1, "?", false, "bad json: " + errStr(e));
    return;
  }
  const seq = req.seq === undefined ? -1 : req.seq;
  const op = String(req.op);
  const fn = OPS[op];
  if (!fn) {
    ack(seq, op, false, `unknown op ${op}`);
    return;
  }
  try {
    const res = fn(req);
    if (res && typeof res.then === "function") {
      res.then(
        (d) => ack(seq, op, true, null, d),
        (e) => ack(seq, op, false, errStr(e))
      );
    } else {
      ack(seq, op, true, null, res);
    }
  } catch (e) {
    ack(seq, op, false, errStr(e));
  }
}

system.afterEvents.scriptEventReceive.subscribe(
  (ev) => {
    if (ev.id === "gsht:cmd") {
      handle(ev.message);
      return;
    }
    // record addon commands (gsh:*) in the timeline
    out({
      t: "ev",
      ev: "scriptevent",
      id: ev.id,
      msg: ev.message,
      src: safe(() => (ev.sourceEntity ? ref(ev.sourceEntity) : ev.sourceType)),
    });
  },
  { namespaces: ["gsht", "gsh"] }
);

// ---------------------------------------------------------------- GameTest session
gt.register("gsh_harness", "session", (test) => {
  S.test = test;
  S.sessionId += 1;
  S.players.clear();
  S.holds.clear();
  out({ t: "session", state: "started", id: S.sessionId, origin: safe(() => test.worldBlockLocation({ x: 0, y: 0, z: 0 })) });
})
  .maxTicks(SESSION_MAX_TICKS)
  .structureName("gsh_harness:empty")
  .padding(0)
  .required(false);

// ---------------------------------------------------------------- follow ticking areas
function areaIdx(name) {
  if (!S.areaIndex.has(name)) {
    const used = new Set(S.areaIndex.values());
    for (let i = 0; i < AREA_MAX_INDEX; i++) {
      if (!used.has(i)) {
        S.areaIndex.set(name, i);
        break;
      }
    }
  }
  return S.areaIndex.get(name);
}
function removeArea(a) {
  safe(() => world.getDimension(a.dim).runCommand(`tickingarea remove ${a.name}`));
}
function cleanupAllAreas() {
  // ticking areas are saved with the world: drop stale ones from a previous boot
  const ow = world.getDimension("minecraft:overworld");
  for (let i = 0; i < AREA_MAX_INDEX; i++) {
    for (const slot of [0, 1]) {
      for (const did of DIMENSIONS) safe(() => world.getDimension(did).runCommand(`tickingarea remove ${AREA_PREFIX}${i}_${slot}`));
    }
  }
  S.areas.clear();
  return ow;
}
function updateAreas() {
  if (!S.areaCleanupDone) {
    S.areaCleanupDone = true;
    cleanupAllAreas();
  }
  for (const [name, a] of S.areas) {
    if (!findPlayer(name) || S.areaRadius <= 0) {
      removeArea(a);
      S.areas.delete(name);
      S.areaIndex.delete(name);
    }
  }
  if (S.areaRadius <= 0) return;
  for (const [name, p] of S.players) {
    if (!safe(() => p.isValid(), false)) continue;
    const l = safe(() => p.location);
    const d = safe(() => p.dimension);
    if (!l || !d) continue;
    const a = S.areas.get(name);
    if (a && a.dim === d.id && distH(a, l) <= 12 && a.r === S.areaRadius) continue;
    const idx = areaIdx(name);
    if (idx === undefined) continue;
    const slot = a ? a.slot ^ 1 : 0;
    const nm = `${AREA_PREFIX}${idx}_${slot}`;
    const x = Math.floor(l.x), z = Math.floor(l.z);
    const ok = safe(() => {
      d.runCommand(`tickingarea remove ${nm}`);
      return true;
    }, false);
    void ok;
    const added = safe(() => d.runCommand(`tickingarea add circle ${x} 0 ${z} ${S.areaRadius} ${nm}`).successCount > 0, false);
    if (!added) continue;
    if (a) removeArea(a);
    S.areas.set(name, { x, z, dim: d.id, slot, name: nm, r: S.areaRadius });
  }
}
system.runInterval(() => safe(updateAreas), 5);

// ---------------------------------------------------------------- per-tick work
system.runInterval(() => {
  // keep held players in place (airborne tests)
  for (const [name, h] of S.holds) {
    const p = findPlayer(name);
    if (!p) {
      S.holds.delete(name);
      continue;
    }
    safe(() => {
      p.teleport(h.loc, { dimension: world.getDimension(h.dim) });
      if (typeof p.clearVelocity === "function") p.clearVelocity();
    });
  }
  const now = system.currentTick;
  if (S.probeEvery > 0 && now - S.lastProbe >= S.probeEvery) {
    S.lastProbe = now;
    S.probeSeq += 1;
    const snap = safe(snapshot, null);
    if (snap) out(Object.assign({ t: "probe", n: S.probeSeq }, snap));
  }
}, 1);

// ---------------------------------------------------------------- events
function isWatched(e) {
  const t = safe(() => e.typeId);
  return t === "minecraft:player" || t === SPIDER;
}
function spiderBrief(e) {
  if (safe(() => e.typeId) !== SPIDER) return undefined;
  const o = {};
  for (const pn of ["horror:state", "horror:giant", "horror:giant_scale", "horror:attack_kind", "horror:attack_id"]) {
    const v = safe(() => e.getProperty(pn));
    if (v !== undefined) o[pn] = typeof v === "number" ? r3(v) : v;
  }
  return o;
}

world.afterEvents.entityHurt.subscribe((ev) => {
  const v = ev.hurtEntity;
  if (!isWatched(v)) return;
  const ds = ev.damageSource || {};
  const d = ds.damagingEntity;
  const o = { t: "ev", ev: "hurt", victim: ref(v), damage: r3(ev.damage), cause: ds.cause, damager: ref(d) };
  o.vloc = safe(() => v3(v.location));
  o.hpAfter = health(v);
  o.vagl = safe(() => aboveGround(v));
  o.vprops = spiderBrief(v);
  if (d) {
    safe(() => {
      o.dloc = v3(d.location);
      o.dist = r3(dist(v.location, d.location));
      o.distH = r3(distH(v.location, d.location));
      o.dy = r3(v.location.y - d.location.y);
    });
    o.dprops = spiderBrief(d);
  }
  out(o);
});

world.afterEvents.entityDie.subscribe((ev) => {
  const v = ev.deadEntity;
  if (!isWatched(v)) return;
  const ds = ev.damageSource || {};
  out({ t: "ev", ev: "die", victim: ref(v), cause: ds.cause, damager: ref(ds.damagingEntity), loc: safe(() => v3(v.location)) });
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  out({ t: "ev", ev: "playerSpawn", name: safe(() => ev.player.name), id: safe(() => ev.player.id), initial: ev.initialSpawn, loc: safe(() => v3(ev.player.location)) });
});
world.afterEvents.playerJoin.subscribe((ev) => {
  out({ t: "ev", ev: "playerJoin", name: ev.playerName, id: ev.playerId });
});
world.afterEvents.playerLeave.subscribe((ev) => {
  S.holds.delete(ev.playerName);
  out({ t: "ev", ev: "playerLeave", name: ev.playerName, id: ev.playerId });
});
world.afterEvents.playerGameModeChange.subscribe((ev) => {
  out({ t: "ev", ev: "gameMode", name: safe(() => ev.player.name), from: ev.fromGameMode, to: ev.toGameMode });
});
world.afterEvents.entitySpawn.subscribe((ev) => {
  if (safe(() => ev.entity.typeId) !== SPIDER) return;
  out({ t: "ev", ev: "spiderSpawn", id: safe(() => ev.entity.id), cause: ev.cause, loc: safe(() => v3(ev.entity.location)), tags: safe(() => ev.entity.getTags(), []) });
});
world.afterEvents.entityLoad.subscribe((ev) => {
  if (safe(() => ev.entity.typeId) !== SPIDER) return;
  out({ t: "ev", ev: "spiderLoad", id: safe(() => ev.entity.id), loc: safe(() => v3(ev.entity.location)), props: spiderBrief(ev.entity) });
});
world.afterEvents.entityRemove.subscribe((ev) => {
  if (ev.typeId !== SPIDER) return;
  out({ t: "ev", ev: "spiderRemove", id: ev.removedEntityId });
});
world.afterEvents.dataDrivenEntityTrigger.subscribe(
  (ev) => {
    out({ t: "ev", ev: "trigger", id: safe(() => ev.entity.id), event: ev.eventId, props: spiderBrief(ev.entity) });
  },
  { entityTypes: [SPIDER] }
);
world.afterEvents.effectAdd.subscribe((ev) => {
  if (safe(() => ev.entity.typeId) !== "minecraft:player") return;
  out({ t: "ev", ev: "effect", name: safe(() => ev.entity.name), effect: safe(() => ev.effect.typeId), amp: safe(() => ev.effect.amplifier), dur: safe(() => ev.effect.duration) });
});

out({ t: "ready", pack: "gsh_test_harness", version: 1 });
