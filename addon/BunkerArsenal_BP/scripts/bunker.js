// Interactive bunker blocks: blast doors, control consoles, loot crates, lamps, lockdown + alarm.
import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { V, TICK, safeSubscribe, getMainhand, giveItem, sound, soundTo, particle, actionBar, tell, showForm, debounce, isPlayer, log } from "./util.js";
import { rollLoot } from "./loot.js";

const DOOR = "bunker:blast_door", LAMP = "bunker:lamp", CONSOLE = "bunker:control_panel", CRATES = { "bunker:supply_crate": "supply", "bunker:weapon_crate": "weapon" };
const INTERACTIVE = new Set([DOOR, CONSOLE, LAMP, ...Object.keys(CRATES)]);
let openArmoryHook = null;            // set by main.js (avoids a circular import)
export function setArmoryHook(fn) { openArmoryHook = fn; }
const key = (b) => `${b.dimension.id}|${b.x},${b.y},${b.z}`;

// ---- lock registry (persisted in a world dynamic property) -------------------------------------------
let locks = new Set();
function loadLocks() { try { const raw = world.getDynamicProperty("bunker:locks"); if (typeof raw === "string") locks = new Set(JSON.parse(raw)); } catch (_) {} }
function saveLocks() { try { world.setDynamicProperty("bunker:locks", JSON.stringify([...locks])); } catch (_) {} }

export function initBunkerBlocks() {
  loadLocks();
  const before = safeSubscribe(world.beforeEvents.playerInteractWithBlock, (ev) => {
    if (!INTERACTIVE.has(ev.block.typeId)) return;
    ev.cancel = true; const { player, block } = ev;
    system.run(() => interact(player, block));
  }, "playerInteractWithBlock");
  if (!before) safeSubscribe(world.beforeEvents.itemUseOn, (ev) => {
    if (!INTERACTIVE.has(ev.block.typeId)) return;
    ev.cancel = true; const { source, block } = ev; system.run(() => interact(source, block));
  }, "itemUseOn");
  safeSubscribe(world.afterEvents.playerPlaceBlock, onPlace, "playerPlaceBlock");
  safeSubscribe(world.afterEvents.playerBreakBlock, onBreak, "playerBreakBlock");
}
function interact(player, block) {
  if (!debounce(player.id + key(block), 5)) return;
  const id = block.typeId;
  if (id === DOOR) return toggleDoor(player, block);
  if (id === CONSOLE) return openConsole(player, block);
  if (CRATES[id]) return openCrate(player, block, CRATES[id]);
  if (id === LAMP) { const mode = block.permutation.getState("bunker:mode") === "off" ? "on" : "off"; try { block.setPermutation(block.permutation.withState("bunker:mode", mode)); } catch (_) {} soundTo(player, "bunker.console_beep", 0.5, mode === "on" ? 1.4 : 0.9); }
}

// ---- blast doors --------------------------------------------------------------------------------------
function otherHalf(block) {
  const half = block.permutation.getState("bunker:half");
  const o = half === "lower" ? block.above() : block.below();
  return o && o.typeId === DOOR ? o : undefined;
}
function setDoorOpen(block, open) {
  for (const b of [block, otherHalf(block)]) { if (b) try { b.setPermutation(b.permutation.withState("bunker:open", open)); } catch (e) { log("door " + e); } }
}
function lowerOf(block) { return block.permutation.getState("bunker:half") === "lower" ? block : (otherHalf(block) ?? block); }
export function toggleDoor(player, block) {
  const lower = lowerOf(block), isOpen = !!lower.permutation.getState("bunker:open");
  if (!isOpen && locks.has(key(lower))) {
    if (getMainhand(player)?.typeId !== "bunker:bunker_key") { soundTo(player, "bunker.empty_click", 1, 0.6); actionBar(player, "§cLOCKDOWN - door sealed. A Bunker Keycard opens it."); return; }
    actionBar(player, "§aKeycard accepted.");
  }
  setDoorOpen(lower, !isOpen);
  sound(isOpen ? "bunker.door_close" : "bunker.door_open", lower.center ? lower.center() : lower.location, lower.dimension, 1, 1);
  if (!isOpen) { const k = key(lower), dim = lower.dimension, loc = { x: lower.x, y: lower.y, z: lower.z };
    system.runTimeout(() => { try { const b = dim.getBlock(loc); if (b && b.typeId === DOOR && b.permutation.getState("bunker:open") && key(b) === k) { setDoorOpen(b, false); sound("bunker.door_close", b.location, dim, 0.8, 1); } } catch (_) {} }, 120); }
}
function onPlace(ev) {
  const { block, player } = ev;
  if (block.typeId !== DOOR) return;
  const above = block.above();
  if (!above || !above.isAir) {
    try { block.setType("minecraft:air"); } catch (_) {}
    giveItem(player, new ItemStack(DOOR, 1)); actionBar(player, "§cBlast doors need two blocks of space."); return;
  }
  try { above.setPermutation(block.permutation.withState("bunker:half", "upper").withState("bunker:open", false)); } catch (e) { log("door place " + e); }
  sound("bunker.door_close", block.location, block.dimension, 0.6, 1.2);
}
function onBreak(ev) {
  const { block, brokenBlockPermutation: perm, dimension } = ev;
  if (perm.type.id !== DOOR) return;
  const half = perm.getState("bunker:half");
  const other = half === "lower" ? block.above() : block.below();
  locks.delete(`${dimension.id}|${block.x},${half === "lower" ? block.y : block.y - 1},${block.z}`); saveLocks();
  if (other && other.typeId === DOOR) {
    try { other.setType("minecraft:air"); } catch (_) {}
    if (half === "upper") { try { dimension.spawnItem(new ItemStack(DOOR, 1), other.location); } catch (_) {} }
  }
}

// ---- crates ---------------------------------------------------------------------------------------------
function openCrate(player, block, kind) {
  if (block.permutation.getState("bunker:opened")) { actionBar(player, "§7This crate is empty. Break it to pick it up."); return; }
  try { block.setPermutation(block.permutation.withState("bunker:opened", true)); } catch (e) { log("crate " + e); }
  sound("bunker.crate_open", block.location, block.dimension, 1, kind === "weapon" ? 0.9 : 1.1);
  const items = rollLoot(kind); const names = [];
  for (const it of items) { giveItem(player, it); names.push(`${it.amount > 1 ? it.amount + "x " : ""}${prettyName(it.typeId)}`); }
  tell(player, `§6[${kind === "weapon" ? "Weapon Crate" : "Supply Crate"}] §fYou found: §e${names.join("§f, §e") || "nothing"}`);
  particle(block.dimension, "minecraft:villager_happy", { x: block.x + 0.5, y: block.y + 1.2, z: block.z + 0.5 });
}
export function prettyName(typeId) {
  return typeId.split(":")[1].split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// ---- control console -------------------------------------------------------------------------------------
const RADIUS = 26;
export async function openConsole(player, block) {
  soundTo(player, "bunker.console_beep", 0.7, 1);
  const center = { x: block.x, y: block.y, z: block.z };
  const form = new ActionFormData().title("§lBUNKER CONTROL CONSOLE").body(`§7Sector ${Math.floor(center.x / 16)},${Math.floor(center.z / 16)}  ·  Depth Y=${center.y}\nLockdown: ${anyLocked(block.dimension, center) ? "§cACTIVE" : "§aclear"}\n§7Range: ${RADIUS} blocks around this console.`)
    .button("Lights ON", "textures/blocks/bunker/lamp_on").button("Lights OFF", "textures/blocks/bunker/lamp_off")
    .button("LOCKDOWN - seal all doors", "textures/blocks/bunker/hazard_block").button("Lift lockdown - unseal doors", "textures/blocks/bunker/blast_door")
    .button("Sound alarm (10 s)", "textures/blocks/bunker/lamp_alarm").button("Armory terminal", "textures/items/bunker/field_terminal").button("Status report", "textures/blocks/bunker/monitor");
  const res = await showForm(form, player);
  if (res.canceled) return;
  const dim = block.dimension;
  switch (res.selection) {
    case 0: setLights(dim, center, "on", player); break;
    case 1: setLights(dim, center, "off", player); break;
    case 2: lockdown(dim, center, true, player); break;
    case 3: lockdown(dim, center, false, player); break;
    case 4: alarm(dim, center, player); break;
    case 5: if (openArmoryHook) openArmoryHook(player); break;
    case 6: statusReport(player, dim, center); break;
  }
}
function anyLocked(dim, c) { for (const k of locks) { if (!k.startsWith(dim.id + "|")) continue; const [x, y, z] = k.split("|")[1].split(",").map(Number); if (Math.abs(x - c.x) <= RADIUS && Math.abs(z - c.z) <= RADIUS && Math.abs(y - c.y) <= 8) return true; } return false; }

// Scans the area in slices so even a big bunker never stalls a mobile device for more than a tick.
function scan(dim, center, radius, types, onBlock, onDone) {
  const x0 = center.x - radius, x1 = center.x + radius, z0 = center.z - radius, z1 = center.z + radius, y0 = center.y - 4, y1 = center.y + 7;
  let x = x0, found = 0;
  const step = () => {
    const stop = Math.min(x1, x + 2);
    for (; x <= stop; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      try { const b = dim.getBlock({ x, y, z }); if (b && types.has(b.typeId)) { onBlock(b); found++; } } catch (_) {}
    }
    if (x <= x1) system.runTimeout(step, 1); else onDone(found);
  };
  step();
}
export function setLights(dim, center, mode, player) {
  const perm = BlockPermutation.resolve(LAMP, { "bunker:mode": mode });
  scan(dim, center, RADIUS, new Set([LAMP]), (b) => { try { b.setPermutation(perm); } catch (_) {} },
    (n) => { if (player) actionBar(player, `§e${n} lamps switched ${mode === "on" ? "on" : mode}.`); });
  sound("bunker.console_beep", center, dim, 1, mode === "on" ? 1.3 : 0.8);
}
export function lockdown(dim, center, lock, player) {
  scan(dim, center, RADIUS, new Set([DOOR]), (b) => {
    if (b.permutation.getState("bunker:half") !== "lower") return;
    if (lock) { locks.add(key(b)); if (b.permutation.getState("bunker:open")) setDoorOpen(b, false); } else locks.delete(key(b));
  }, (n) => { saveLocks(); if (player) actionBar(player, lock ? `§cLOCKDOWN ENGAGED - ${n} doors sealed.` : `§aLockdown lifted - ${n} doors released.`); });
  sound(lock ? "bunker.door_close" : "bunker.door_open", center, dim, 1, 0.7);
  if (lock) setLights(dim, center, "alarm"); else setLights(dim, center, "on");
}
export function alarm(dim, center, player) {
  setLights(dim, center, "alarm");
  let n = 0;
  const run = system.runInterval(() => { sound("bunker.alarm", center, dim, 1, 1); if (++n >= 10) { system.clearRun(run); setLights(dim, center, "on"); } }, 20);
  if (player) actionBar(player, "§cALARM! Emergency lighting engaged.");
}
function statusReport(player, dim, center) {
  let hostile = 0, players = 0;
  try { for (const e of dim.getEntities({ location: center, maxDistance: 40 })) { if (isPlayer(e)) players++; else if (/zombie|skeleton|creeper|spider|enderman|witch|pillager|vindicator|evoker|breeze|bogged|husk|drowned|phantom|slime|warden|blaze|piglin|hoglin|stray|silverfish|ravager/.test(e.typeId ?? "")) hostile++; } } catch (_) {}
  const time = world.getTimeOfDay ? world.getTimeOfDay() : 0; const h = Math.floor(((time + 6000) % 24000) / 1000), m = Math.floor((((time + 6000) % 1000) / 1000) * 60);
  const body = `§7Surface time: §f${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}\n§7Personnel in sector: §f${players}\n§7Hostile contacts within 40 m: ${hostile ? "§c" + hostile : "§a0"}\n§7Lockdown: ${anyLocked(dim, center) ? "§cACTIVE" : "§aclear"}\n§7Power: §aNOMINAL   §7Air filtration: §aONLINE`;
  showForm(new MessageFormData().title("§lSTATUS REPORT").body(body).button1("Close").button2("Ping hostiles"), player).then((r) => {
    if (r.selection === 1) { try { for (const e of dim.getEntities({ location: center, maxDistance: 40 })) if (!isPlayer(e) && e.typeId !== "minecraft:item") particle(dim, "minecraft:endrod", e.location); } catch (_) {} }
  });
}
