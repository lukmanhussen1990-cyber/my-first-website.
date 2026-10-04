// Shared helpers. Every API call that might not exist on an older/newer runtime is wrapped so one
// missing feature never breaks the whole add-on.
import { world, system, ItemStack, EquipmentSlot, Player } from "@minecraft/server";

export const TICK = () => system.currentTick;

export function safeSubscribe(signal, fn, label) {
  try {
    if (!signal || typeof signal.subscribe !== "function") throw new Error("missing");
    signal.subscribe((ev) => { try { fn(ev); } catch (e) { log(`${label}: ${e}`); } });
    return true;
  } catch (e) { log(`event ${label} unavailable (${e})`); return false; }
}
export function log(msg) { try { console.warn(`[BunkerArsenal] ${msg}`); } catch (_) {} }

// ---- vectors -------------------------------------------------------------------------------------
export const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
  norm: (a) => { const l = V.len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; },
  cross: (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }),
  floor: (a) => ({ x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) }),
  dist: (a, b) => V.len(V.sub(a, b)),
};
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// ---- inventory -----------------------------------------------------------------------------------
export function container(player) { try { return player.getComponent("minecraft:inventory")?.container; } catch (_) { return undefined; } }
export function selectedSlot(player) { return player.selectedSlotIndex ?? player.selectedSlot ?? 0; }
export function getMainhand(player) {
  try { const eq = player.getComponent("minecraft:equippable"); if (eq) return eq.getEquipment(EquipmentSlot.Mainhand); } catch (_) {}
  try { return container(player)?.getItem(selectedSlot(player)); } catch (_) { return undefined; }
}
export function setMainhand(player, item) {
  try { const eq = player.getComponent("minecraft:equippable"); if (eq) { eq.setEquipment(EquipmentSlot.Mainhand, item); return true; } } catch (_) {}
  try { container(player)?.setItem(selectedSlot(player), item); return true; } catch (_) { return false; }
}
export function countItem(player, typeId) {
  const c = container(player); if (!c) return 0; let n = 0;
  for (let i = 0; i < c.size; i++) { const it = c.getItem(i); if (it && it.typeId === typeId) n += it.amount; }
  return n;
}
export function removeItems(player, typeId, amount) {
  const c = container(player); if (!c) return 0; let left = amount;
  for (let i = 0; i < c.size && left > 0; i++) {
    const it = c.getItem(i); if (!it || it.typeId !== typeId) continue;
    if (it.amount <= left) { left -= it.amount; c.setItem(i, undefined); }
    else { it.amount -= left; left = 0; c.setItem(i, it); }
  }
  return amount - left;
}
export function giveItem(player, item) {
  try { const c = container(player); if (c && c.emptySlotsCount > 0) { c.addItem(item); return; } } catch (_) {}
  try { player.dimension.spawnItem(item, player.location); } catch (_) {}
}
export function give(player, typeId, amount = 1) {
  let left = amount;
  while (left > 0) { const n = Math.min(left, 64); giveItem(player, new ItemStack(typeId, n)); left -= n; }
}
export function isPlayer(e) { try { return e instanceof Player || e?.typeId === "minecraft:player"; } catch (_) { return false; } }

// ---- feedback ------------------------------------------------------------------------------------
export function sound(id, location, dimension, volume = 1, pitch = 1) {
  try { (dimension ?? world.getDimension("overworld")).playSound(id, location, { volume, pitch }); return; } catch (_) {}
  try { world.playSound(id, location, { volume, pitch }); } catch (_) {}
}
export function soundTo(player, id, volume = 1, pitch = 1) {
  try { player.playSound(id, { volume, pitch }); } catch (_) { sound(id, player.location, player.dimension, volume, pitch); }
}
export function particle(dimension, id, location) {
  try { dimension.spawnParticle(id, location); } catch (_) {}
}
const msgUntil = new Map();
export function actionBar(player, text, holdTicks = 40) {
  try { player.onScreenDisplay.setActionBar(text); } catch (_) {}
  msgUntil.set(player.id, TICK() + holdTicks);
}
export function hudFree(player) { return (msgUntil.get(player.id) ?? 0) <= TICK(); }
export function title(player, main, sub = "") {
  try { player.onScreenDisplay.setTitle(main, { fadeInDuration: 5, stayDuration: 30, fadeOutDuration: 10, subtitle: sub }); } catch (_) { actionBar(player, main); }
}
export function tell(player, text) { try { player.sendMessage(text); } catch (_) {} }

// Forms fail with "UserBusy" while the player is still in a touch/UI interaction; retry a few times.
export async function showForm(form, player, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const res = await form.show(player);
    if (res.cancelationReason !== "UserBusy" && res.cancelationReason !== "userBusy") return res;
    await sleep(5);
  }
  return { canceled: true };
}
export function sleep(ticks) { return new Promise((r) => system.runTimeout(r, ticks)); }

const debounceMap = new Map();
export function debounce(key, ticks = 4) {
  const now = TICK(); const last = debounceMap.get(key) ?? -999;
  if (now - last < ticks) return false;
  debounceMap.set(key, now); return true;
}
// item dynamic properties with a graceful fallback (older runtimes: keep state in lore)
export function getProp(item, key, fallback) {
  try { const v = item.getDynamicProperty(key); return v === undefined ? fallback : v; } catch (_) { return fallback; }
}
export function setProp(item, key, value) { try { item.setDynamicProperty(key, value); return true; } catch (_) { return false; } }
