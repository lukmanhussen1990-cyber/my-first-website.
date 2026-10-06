// Shared helpers for the outbreak tests (not a test file itself).
// Imports only the item dispatcher and the outbreak subsystem, so the tests do
// not depend on the other subsystems' state.

import { mock, ui } from "./mock/testkit.mjs";
import { world } from "@minecraft/server";
import { initItems, __itemsInternals } from "../addon/behavior_pack/scripts/lib/items.js";
import { getErrorCounts } from "../addon/behavior_pack/scripts/lib/util.js";
import { initOutbreak } from "../addon/behavior_pack/scripts/outbreak/index.js";
import * as api from "../addon/behavior_pack/scripts/outbreak/api.js";
import { resetMemory } from "../addon/behavior_pack/scripts/outbreak/state.js";
import { ENTITIES, PROPS, TAGS, ITEMS } from "../addon/behavior_pack/scripts/lib/ids.js";

initItems();
initOutbreak();

export { mock, ui, api, world, ENTITIES, PROPS, TAGS, ITEMS };
export const OW = "minecraft:overworld";

/** Fresh world + fresh outbreak memory. Optional config overrides. */
export function fresh({ config, ground = true } = {}) {
  mock.reset();
  mock.setOptions({ throwHandlerErrors: true, unloadedGetBlock: "undefined", runVanillaSpawnEvents: false });
  ui.reset();
  __itemsInternals.resetDebounce();
  resetMemory();
  if (ground) mock.fill(OW, { x: -48, y: 63, z: -48 }, { x: 48, y: 63, z: 48 }, "minecraft:grass_block");
  if (config) api.setConfig(config);
  mock.clearRecords();
  errorBaseline = snapshotErrors();
}

export function dim(id = OW) {
  return world.getDimension(id);
}

/** Count loaded entities of a type in the overworld. */
export function count(typeId, dimId = OW) {
  return dim(dimId).getEntities({ type: typeId }).length;
}

export function parasites() {
  return count(ENTITIES.PARASITE);
}

/** Damage `target` as `attacker` and deliver the after-events now. */
export function hit(target, attacker, damage = 1) {
  const ok = target.applyDamage(damage, attacker ? { damagingEntity: attacker, cause: "entityAttack" } : { cause: "entityAttack" });
  mock.flush();
  return ok;
}

/** Start an outbreak with a parasite at loc (API path). */
export function release(loc = { x: 0.5, y: 64, z: 0.5 }) {
  const e = api.startOutbreak(dim(), loc);
  mock.flush();
  return e;
}

let errorBaseline = new Map();
function snapshotErrors() {
  return new Map(getErrorCounts());
}

/** Labels of outbreak errors logged since fresh() (minus `allowed`). */
export function newOutbreakErrors(allowed = []) {
  const out = [];
  for (const [k, v] of getErrorCounts()) {
    if (!k.startsWith("outbreak")) continue;
    if (allowed.some((a) => (a instanceof RegExp ? a.test(k) : a === k))) continue;
    if (v > (errorBaseline.get(k) ?? 0)) out.push(k);
  }
  return out;
}

/** Number of errors logged under `label` since fresh(). */
export function errorsLogged(label) {
  return (getErrorCounts().get(label) ?? 0) - (errorBaseline.get(label) ?? 0);
}

/** Group records by tick: Map(tick -> n). */
export function perTick(records) {
  const m = new Map();
  for (const r of records) m.set(r.tick, (m.get(r.tick) ?? 0) + 1);
  return m;
}

export function maxPerTick(records) {
  let max = 0;
  for (const v of perTick(records).values()) max = Math.max(max, v);
  return max;
}

export function prop(e, id) {
  return e.getDynamicProperty(id);
}

/** Persisted outbreak state as stored in the world property. */
export function storedState() {
  const raw = world.getDynamicProperty(PROPS.OUTBREAK);
  return typeof raw === "string" ? JSON.parse(raw) : undefined;
}

export function storedConfig() {
  const raw = world.getDynamicProperty(PROPS.CONFIG);
  return typeof raw === "string" ? JSON.parse(raw) : undefined;
}
