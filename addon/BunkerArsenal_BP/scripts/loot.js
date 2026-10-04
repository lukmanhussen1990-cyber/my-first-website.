// Lightweight JS loot roller used when the /loot command is unavailable (crates opened by hand, script-built barrels).
import { ItemStack } from "@minecraft/server";
const MAGS = [["bunker:light_magazine", 10, 1, 3], ["bunker:rifle_magazine", 10, 1, 2], ["bunker:shell_box", 6, 1, 2], ["bunker:energy_cell", 6, 1, 2], ["bunker:rail_slug", 3, 1, 2], ["bunker:rocket_ammo", 3, 1, 1]];
const GUNS = [["bunker:service_pistol", 12], ["bunker:wasp_smg", 9], ["bunker:ranger_rifle", 8], ["bunker:breacher_shotgun", 7], ["bunker:longshot_dmr", 5], ["bunker:bulwark_lmg", 4],
  ["bunker:pulse_rifle", 4], ["bunker:plasma_pistol", 5], ["bunker:railgun", 2], ["bunker:thumper_launcher", 2], ["bunker:combat_knife", 8], ["bunker:stun_baton", 6]];
const ATTS = ["bunker:suppressor", "bunker:heavy_barrel", "bunker:extended_magazine", "bunker:reflex_sight", "bunker:foregrip", "bunker:laser_sight"].map((a) => [a, 1]);
const FOOD = [["minecraft:cooked_beef", 8, 2, 4], ["minecraft:bread", 8, 2, 5], ["minecraft:baked_potato", 6, 2, 4], ["minecraft:apple", 5, 1, 3], ["minecraft:cooked_chicken", 6, 1, 3], ["minecraft:pumpkin_pie", 3, 1, 2], ["minecraft:golden_carrot", 2, 1, 2]];
const SUPPLY = [...MAGS, ["bunker:medkit", 6], ["bunker:ammo_box", 4], ["bunker:steel_plate", 8, 1, 3], ["bunker:weapon_parts", 6, 1, 2], ["bunker:frag_grenade", 4, 1, 2]];
const TABLES = {
  supply: [[[2, 3], SUPPLY], [[0, 1], FOOD]],
  weapon: [[[1, 1], GUNS], [[1, 2], MAGS], [[0, 1], ATTS]],
  supply_barrel: [[[3, 5], [...MAGS, ["bunker:steel_plate", 8, 1, 4], ["bunker:weapon_parts", 6, 1, 3], ["minecraft:torch", 6, 2, 6], ["minecraft:coal", 5, 2, 6], ["minecraft:iron_ingot", 4, 1, 3], ["minecraft:copper_ingot", 4, 2, 5], ["bunker:medkit", 4], ["bunker:bunker_key", 1], ["minecraft:string", 3, 1, 4]]]],
  food_barrel: [[[3, 6], [...FOOD, ["minecraft:sugar", 3, 1, 3], ["minecraft:cake", 1]]]],
  medical_barrel: [[[2, 4], [["bunker:medkit", 10, 1, 2], ["minecraft:golden_apple", 2], ["minecraft:honey_bottle", 4, 1, 2], ["minecraft:milk_bucket", 3], ["minecraft:glass_bottle", 4, 1, 3], ["minecraft:paper", 4, 1, 4], ["bunker:stun_grenade", 2, 1, 2]]]],
  armory_barrel: [[[1, 1], GUNS], [[2, 4], MAGS], [[0, 2], [...ATTS, ["bunker:frag_grenade", 3, 1, 3], ["bunker:stun_grenade", 2, 1, 2], ["bunker:ammo_box", 2]]]],
};
const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
function pick(entries) {
  const total = entries.reduce((s, e) => s + e[1], 0); let r = Math.random() * total;
  for (const e of entries) { r -= e[1]; if (r <= 0) return e; }
  return entries[entries.length - 1];
}
export function rollLoot(kind) {
  const table = TABLES[kind] ?? TABLES.supply, out = [];
  for (const [[lo, hi], entries] of table) {
    const rolls = ri(lo, hi);
    for (let i = 0; i < rolls; i++) { const e = pick(entries); try { out.push(new ItemStack(e[0], ri(e[2] ?? 1, e[3] ?? 1))); } catch (_) {} }
  }
  return out;
}
