// Engine-harness bridge. NOT part of the add-on: tools/engine/run_engine.py copies
// this file into the *installed copy* of the behavior pack (scripts/__pastest_bridge.js)
// and loads it after main.js through scripts/__pastest_entry.js. It gives the
// test pack (a different script context) read access to the add-on's dynamic
// properties and calls into scripts/outbreak/api.js.
//
// Protocol (both directions are /scriptevent messages, delivered to every pack):
//   request  pastest:req {"id":7,"op":"api","fn":"setConfig","args":[{"replicationSeconds":10}]}
//   response pastest:res {"id":7,"ok":true,"value":...}      (or "ok":false,"error":"...")
// Ops: ping | api | entityProps | worldProp | torch
// Argument encoding for api calls: {"$entity":"<id>"} -> world.getEntity(id),
// {"$dim":"minecraft:overworld"} -> world.getDimension(id).
// Long responses are split: pastest:resp {"id":7,"part":0,"of":3,"data":"..."}.
import { world, system } from "@minecraft/server";

const MAX_CHUNK = 1500;
const modules = {};
const loading = {};

function load(name, path) {
  if (!loading[name]) {
    loading[name] = import(path).then(
      (m) => {
        modules[name] = m;
        return m;
      },
      (e) => {
        modules[name] = null;
        console.warn(`PASBRIDGE|import ${path} failed: ${e}`);
        return null;
      },
    );
  }
  return loading[name];
}

function decode(v) {
  if (Array.isArray(v)) return v.map(decode);
  if (v && typeof v === "object") {
    if (typeof v.$entity === "string") return world.getEntity(v.$entity);
    if (typeof v.$dim === "string") return world.getDimension(v.$dim);
    const o = {};
    for (const k of Object.keys(v)) o[k] = decode(v[k]);
    return o;
  }
  return v;
}

function encode(v, depth = 0) {
  if (depth > 6) return "<deep>";
  if (v === undefined) return null;
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => encode(x, depth + 1));
  try {
    if (typeof v.typeId === "string" && typeof v.id === "string") return { $entity: v.id, typeId: v.typeId };
  } catch {
    // not an entity
  }
  if (v instanceof Map) return encode(Object.fromEntries(v), depth);
  if (v instanceof Set) return encode([...v], depth);
  const o = {};
  for (const k of Object.keys(v)) o[k] = encode(v[k], depth + 1);
  return o;
}

function reply(obj) {
  let text = JSON.stringify(obj);
  const dim = world.getDimension("overworld");
  const send = (id, body) => {
    try {
      dim.runCommand(`scriptevent ${id} ${body}`);
    } catch (e) {
      console.warn(`PASBRIDGE|reply failed: ${e}`);
    }
  };
  if (text.length <= MAX_CHUNK) {
    send("pastest:res", text);
    return;
  }
  const parts = [];
  for (let i = 0; i < text.length; i += MAX_CHUNK) parts.push(text.slice(i, i + MAX_CHUNK));
  parts.forEach((data, part) => send("pastest:resp", JSON.stringify({ id: obj.id, part, of: parts.length, data })));
}

function allProps(holder) {
  const out = {};
  for (const k of holder.getDynamicPropertyIds()) out[k] = holder.getDynamicProperty(k);
  return out;
}

async function handle(req) {
  switch (req.op) {
    case "ping": {
      const [api, store, torch] = await Promise.all([
        load("api", "./outbreak/api.js"),
        load("store", "./lib/store.js"),
        load("torch", "./torchlight/index.js"),
      ]);
      return {
        api: api ? Object.keys(api).sort() : null,
        store: !!store,
        torch: torch ? Object.keys(torch).sort() : null,
        tick: system.currentTick,
      };
    }
    case "api": {
      const api = await load("api", "./outbreak/api.js");
      if (!api) throw new Error("outbreak/api.js not loadable");
      const fn = api[req.fn];
      if (typeof fn !== "function") throw new Error(`api.${req.fn} missing`);
      return encode(fn(...decode(req.args ?? [])));
    }
    case "entityProps": {
      const e = world.getEntity(req.entity);
      if (!e) return { missing: true };
      return { typeId: e.typeId, tags: e.getTags(), props: allProps(e) };
    }
    case "worldProp": {
      const store = await load("store", "./lib/store.js");
      const raw = world.getDynamicProperty(req.key);
      let json;
      if (store && typeof store.loadJSON === "function") json = store.loadJSON(req.key, null);
      return { raw: typeof raw === "string" && raw.length > 400 ? raw.slice(0, 400) + "..." : raw, json, ids: world.getDynamicPropertyIds().filter((k) => k.startsWith(req.key)) };
    }
    case "torch": {
      const torch = await load("torch", "./torchlight/index.js");
      const t = torch && torch.__torchInternals;
      if (!t) return { available: false };
      return {
        available: true,
        tracked: [...t.beams.keys()],
        cells: typeof t.serializeCells === "function" ? encode(t.serializeCells()) : null,
        pending: typeof t.pendingCount === "function" ? t.pendingCount() : null,
        releaseLog: encode(t.releaseLog.slice(-8)),
      };
    }
    default:
      throw new Error(`unknown op ${req.op}`);
  }
}

system.afterEvents.scriptEventReceive.subscribe(
  (ev) => {
    if (ev.id !== "pastest:req") return;
    let req;
    try {
      req = JSON.parse(ev.message);
    } catch (e) {
      console.warn(`PASBRIDGE|bad request: ${ev.message}`);
      return;
    }
    Promise.resolve()
      .then(() => handle(req))
      .then(
        (value) => reply({ id: req.id, ok: true, value }),
        (e) => reply({ id: req.id, ok: false, error: String(e && e.message ? e.message : e) }),
      );
  },
  { namespaces: ["pastest"] },
);

console.warn("PASBRIDGE|loaded");
