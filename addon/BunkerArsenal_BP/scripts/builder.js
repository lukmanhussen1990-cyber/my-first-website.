// Bunker Blueprint: constructs a bunker below the player. Primary path is /structure load (fast, keeps
// loot tables and bed colours); fallback is a block-by-block builder fed by RLE data (tools/gen_structures.py).
import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";
import { ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { STRUCTURES } from "./data/structures.js";
import { V, soundTo, sound, actionBar, tell, title, showForm, removeItems, log } from "./util.js";
import { rollLoot } from "./loot.js";

const KINDS = [["command_complex", "Command Complex (47x47) - 8 rooms + command center"], ["outpost", "Outpost (27x13) - compact 3-room bunker"]];
// local anchor of the entrance for each kind: where the vertical shaft starts (x, z) and the lowest shaft Y (local)
const ENTRANCE = { command_complex: { x: 23, z: 1, yFrom: 6, ladder: 3 }, outpost: { x: 13, z: 13, yFrom: 1, ladder: 2 } };
const building = new Set();

export async function openBlueprint(player) {
  if (building.has(player.id)) { actionBar(player, "§cConstruction already in progress."); return; }
  soundTo(player, "bunker.ui_open");
  const form = new ModalFormData().title("§lBUNKER BLUEPRINT")
    .dropdown("Bunker type", KINDS.map((k) => k[1]), 0)
    .slider("Depth below your feet (blocks)", 6, 40, 1, 10)
    .toggle("Build entrance shaft + hatch", true);
  const res = await showForm(form, player);
  if (res.canceled) return;
  const [kindIdx, depth, shaft] = res.formValues;
  const kind = KINDS[kindIdx][0], S = STRUCTURES[kind];
  const confirm = await showForm(new MessageFormData().title("§lCONFIRM CONSTRUCTION")
    .body(`§fThis will carve out a §e${S.size[0]}x${S.size[1]}x${S.size[2]}§f volume ${depth} blocks below you, centred on your position.\n\n§7Anything already there is replaced. The blueprint is consumed.`)
    .button1("Build it").button2("Cancel"), player);
  if (confirm.canceled || confirm.selection !== 0) return;
  removeItems(player, "bunker:bunker_blueprint", 1);
  buildBunker(player, kind, depth, shaft);
}

export async function buildBunker(player, kind, depth, shaft = true) {
  const S = STRUCTURES[kind], dim = player.dimension, p = V.floor(player.location);
  let y0 = p.y - depth - S.size[1]; if (y0 < -60) y0 = -60;
  const origin = { x: p.x - Math.floor(S.size[0] / 2), y: y0, z: p.z - Math.floor(S.size[2] / 2) };
  building.add(player.id);
  title(player, "§6Constructing bunker", "§7stand still...");
  sound("bunker.alarm", player.location, dim, 0.6, 0.8);
  let ok = false;
  try {
    const r = await dim.runCommandAsync(`structure load bunker:${kind} ${origin.x} ${origin.y} ${origin.z} 0_degrees none false true`);
    ok = r && r.successCount > 0;
  } catch (e) { log("structure load failed, using fallback builder: " + e); }
  if (!ok) { try { await buildFromRle(player, dim, S, origin); ok = true; } catch (e) { log("fallback builder: " + e); } }
  if (!ok) { building.delete(player.id); tell(player, "§cConstruction failed - make sure the area below you is loaded and try again."); return; }
  if (shaft) await buildShaft(dim, kind, origin, p.y - 1, S.size);
  building.delete(player.id);
  title(player, "§aBunker complete", shaft ? "§7Open the hatch at your feet and climb down" : "§7Dig down to reach it");
  sound("bunker.door_open", player.location, dim, 1, 1);
  tell(player, `§6[Bunker Arsenal] §fBunker built at §e${origin.x}, ${origin.y}, ${origin.z}§f. Tap blast doors to open them, tap consoles for lights, lockdown and the Armory.`);
}

const permCache = new Map();
function permFor(entry) {
  const k = JSON.stringify(entry);
  if (permCache.has(k)) return permCache.get(k);
  let perm;
  try { perm = BlockPermutation.resolve(entry.name, entry.states); } catch (_) { try { perm = BlockPermutation.resolve(entry.name); } catch (_) { perm = null; } }
  permCache.set(k, perm); return perm;
}
function buildFromRle(player, dim, S, origin) {
  return new Promise((resolve, reject) => {
    const [X, Y, Z] = S.size, runs = S.runs, total = X * Y * Z;
    let ri = 0, left = runs.length ? runs[0][1] : 0, idx = 0, failures = 0;
    const step = () => {
      let budget = 700;
      try {
        while (budget-- > 0 && ri < runs.length) {
          const perm = permFor(S.palette[runs[ri][0]]);
          const x = Math.floor(idx / (Y * Z)), y = Math.floor(idx / Z) % Y, z = idx % Z;
          if (perm) { const b = dim.getBlock({ x: origin.x + x, y: origin.y + y, z: origin.z + z }); if (b) b.setPermutation(perm); else failures++; }
          idx++; if (--left <= 0) { ri++; left = ri < runs.length ? runs[ri][1] : 0; }
        }
      } catch (e) { failures++; log("build step: " + e); idx++; if (--left <= 0) { ri++; left = ri < runs.length ? runs[ri][1] : 0; } }
      if (ri < runs.length) { actionBar(player, `§6Building bunker §f${Math.floor((idx / total) * 100)}%`, 10); system.runTimeout(step, 1); }
      else { fillBarrels(dim, S, origin); if (failures > total / 4) reject(new Error("too many unloaded blocks")); else resolve(); }
    };
    step();
  });
}
function fillBarrels(dim, S, origin) {
  for (const [x, y, z, kind] of S.loot || []) {
    try {
      const b = dim.getBlock({ x: origin.x + x, y: origin.y + y, z: origin.z + z }); const c = b?.getComponent("minecraft:inventory")?.container;
      if (c) for (const it of rollLoot(kind + "_barrel")) c.addItem(it);
    } catch (_) {}
  }
}
async function buildShaft(dim, kind, origin, surfaceY, size) {
  const E = ENTRANCE[kind], sx = origin.x + E.x, sz = origin.z + E.z, from = origin.y + E.yFrom;
  const wall = BlockPermutation.resolve("bunker:reinforced_wall"), hazard = BlockPermutation.resolve("bunker:hazard_block"), air = BlockPermutation.resolve("minecraft:air");
  let ladder; try { ladder = BlockPermutation.resolve("minecraft:ladder", { facing_direction: E.ladder }); } catch (_) { ladder = BlockPermutation.resolve("minecraft:ladder"); }
  let hatch; try { hatch = BlockPermutation.resolve("minecraft:trapdoor", { direction: 0, open_bit: false, upside_down_bit: true }); } catch (_) { hatch = BlockPermutation.resolve("minecraft:trapdoor"); }
  const inside = (x, y, z) => x >= origin.x && x < origin.x + size[0] && z >= origin.z && z < origin.z + size[2] && y < origin.y + size[1];
  const set = (x, y, z, perm) => { if (inside(x, y, z)) return; try { dim.getBlock({ x, y, z })?.setPermutation(perm); } catch (_) {} };
  let count = 0;
  for (let y = from; y <= surfaceY; y++) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) set(sx + dx, y, sz + dz, y === surfaceY ? hazard : wall);
    set(sx, y, sz, y === surfaceY ? hatch : (y <= from + 1 && kind === "outpost" ? air : ladder));
    if (y <= from + 1 && kind === "outpost") set(sx, y, sz, air);
    if (++count % 6 === 0) await new Promise((r) => system.runTimeout(r, 1));
  }
  // the outpost shaft lands in a small pocket in front of its south blast door; put the ladder on the pocket's south wall
  if (kind === "outpost") for (let y = from; y <= surfaceY - 1; y++) if (y > from + 1) set(sx, y, sz, ladder);
}
