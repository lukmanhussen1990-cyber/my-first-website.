// Armory / inventory interface (server-ui forms render with the standard Bedrock look on every device).
import { world, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { WEAPONS, AMMO, ATTACHMENTS } from "./data/weapons_data.js";
import { weaponInfo, reloadHeld, setAttachments, repairHeld, computeStats } from "./weapons.js";
import { container, getMainhand, countItem, removeItems, give, giveItem, soundTo, actionBar, tell, showForm } from "./util.js";

const icon = (id) => `textures/items/bunker/${id}`;
const AMMO_BOX = { light_magazine: 4, rifle_magazine: 3, shell_box: 2, energy_cell: 2, rail_slug: 3, rocket_ammo: 2 };

export async function openArmory(player) {
  soundTo(player, "bunker.ui_open");
  const held = getMainhand(player), info = weaponInfo(held);
  const lines = [];
  if (info) lines.push(`§eHeld: §f${info.def.name}  §7${info.ammo}/${info.stats.mag}  ·  ${AMMO[info.def.ammo].name}: ${countItem(player, "bunker:" + info.def.ammo)}`);
  else lines.push("§7Hold a weapon to reload, modify or repair it.");
  const form = new ActionFormData().title("§lARMORY TERMINAL").body(lines.join("\n"))
    .button("Loadout - weapons in your inventory", icon("ranger_rifle"))
    .button("Reload held weapon", icon("rifle_magazine"))
    .button("Attachments - modify held weapon", icon("reflex_sight"))
    .button("Repair held weapon (1 Steel Plate)", icon("steel_plate"))
    .button("Ammunition overview", icon("ammo_box"))
    .button("Weapon catalogue", icon("pulse_rifle"))
    .button("Field manual", icon("bunker_blueprint"));
  const res = await showForm(form, player);
  if (res.canceled) return;
  switch (res.selection) {
    case 0: return loadout(player);
    case 1: reloadHeld(player); return;
    case 2: return attachments(player);
    case 3: { const msg = repairHeld(player); actionBar(player, msg); return; }
    case 4: return ammoOverview(player);
    case 5: return catalogue(player);
    case 6: return openFieldManual(player);
  }
}

async function loadout(player) {
  const c = container(player); const found = [];
  if (c) for (let i = 0; i < c.size; i++) { const it = c.getItem(i); const inf = weaponInfo(it); if (inf) found.push({ slot: i, it, inf }); else if (it && WEAPONS[it.typeId.slice(7)]) found.push({ slot: i, it, inf: null }); }
  if (!found.length) { actionBar(player, "§7No weapons in your inventory."); return; }
  const form = new ActionFormData().title("§lLOADOUT").body(`§7${found.length} weapon(s). Select one to view details.`);
  for (const f of found) {
    const key = f.it.typeId.slice(7), def = WEAPONS[key];
    form.button(f.inf ? `${def.name}\n§7${f.inf.ammo}/${f.inf.stats.mag}  ·  slot ${f.slot + 1}` : `${def.name}\n§7melee  ·  slot ${f.slot + 1}`, icon(key));
  }
  const res = await showForm(form, player);
  if (res.canceled) return;
  const f = found[res.selection], key = f.it.typeId.slice(7), def = WEAPONS[key];
  const dur = f.it.getComponent("minecraft:durability");
  const cond = dur ? `${Math.round(((dur.maxDurability - dur.damage) / dur.maxDurability) * 100)}%` : "n/a";
  let body = `§e${def.name}\n§7${def.desc}\n\n§fCondition: ${cond}\n`;
  if (f.inf) body += `§fAmmo: ${f.inf.ammo}/${f.inf.stats.mag} (${AMMO[def.ammo].name})\n§fDamage: ${r1(f.inf.stats.damage)}${def.pellets > 1 ? " x" + def.pellets : ""}   Range: ${r1(f.inf.stats.range)} blocks\n§fFire rate: ${(20 / f.inf.stats.fire).toFixed(1)}/s ${def.auto ? "(automatic - hold to fire)" : "(semi-auto - tap to fire)"}\n§fReload: ${(f.inf.stats.reload / 20).toFixed(1)} s   Spread: ${r1(f.inf.stats.spread)}°\n§fMods: ${f.inf.atts.map((a) => ATTACHMENTS[a].name).join(", ") || "none"}`;
  else body += `§fAttack damage: ${def.damage}`;
  await showForm(new MessageFormData().title(def.name).body(body).button1("Back").button2("Close"), player).then((r) => { if (r.selection === 0) loadout(player); });
}

async function attachments(player) {
  const held = getMainhand(player), info = weaponInfo(held);
  if (!info) { actionBar(player, "§7Hold a gun to modify it."); return; }
  const owned = Object.keys(ATTACHMENTS).filter((a) => countItem(player, "bunker:" + a) > 0 || info.atts.includes(a));
  if (!owned.length) { actionBar(player, "§7You have no attachments. Craft a Reflex Sight, Suppressor, Foregrip..."); return; }
  const form = new ModalFormData().title(`§lMODIFY: ${info.def.name}`);
  for (const a of owned) form.toggle(`${ATTACHMENTS[a].name} §7[${ATTACHMENTS[a].slot}]\n§8${ATTACHMENTS[a].desc}`, info.atts.includes(a));
  const res = await showForm(form, player);
  if (res.canceled) return;
  const want = owned.filter((_, i) => res.formValues[i]);
  const slots = new Set();
  for (const a of want) { if (slots.has(ATTACHMENTS[a].slot)) { actionBar(player, `§cOnly one ${ATTACHMENTS[a].slot} attachment at a time.`); return; } slots.add(ATTACHMENTS[a].slot); }
  const cur = getMainhand(player); const curInfo = weaponInfo(cur); if (!curInfo || curInfo.uid !== info.uid && info.uid) { actionBar(player, "§cKeep holding the weapon while modifying it."); return; }
  for (const a of want) if (!curInfo.atts.includes(a)) removeItems(player, "bunker:" + a, 1);
  for (const a of curInfo.atts) if (!want.includes(a)) give(player, "bunker:" + a, 1);
  setAttachments(player, cur, want);
  const st = computeStats(curInfo.def, want);
  soundTo(player, "bunker.reload", 1, 1.2);
  actionBar(player, `§a${curInfo.def.name} modified: §f${want.map((a) => ATTACHMENTS[a].name).join(", ") || "stock"}  §7(mag ${st.mag}, spread ${r1(st.spread)}°)`);
}

async function ammoOverview(player) {
  const lines = Object.entries(AMMO).map(([k, a]) => `§e${a.name}: §f${countItem(player, "bunker:" + k)}  §8- ${a.desc}`);
  lines.push("", `§eFrag Grenades: §f${countItem(player, "bunker:frag_grenade")}   §eStun Grenades: §f${countItem(player, "bunker:stun_grenade")}`, `§eMedkits: §f${countItem(player, "bunker:medkit")}   §eSteel Plates: §f${countItem(player, "bunker:steel_plate")}`);
  await showForm(new MessageFormData().title("§lAMMUNITION").body(lines.join("\n")).button1("Back").button2("Close"), player).then((r) => { if (r.selection === 0) openArmory(player); });
}

async function catalogue(player) {
  const form = new ActionFormData().title("§lWEAPON CATALOGUE").body("§7Every weapon in the arsenal. Craft them at a crafting table or find them in weapon crates.");
  const keys = Object.keys(WEAPONS);
  for (const k of keys) { const w = WEAPONS[k]; form.button(`${w.name}\n§7${w.kind === "gun" ? AMMO[w.ammo].name : w.kind}`, icon(k)); }
  const res = await showForm(form, player);
  if (res.canceled) return;
  const k = keys[res.selection], w = WEAPONS[k];
  let body = `§e${w.name}\n§7${w.desc}\n\n`;
  if (w.kind === "gun") body += `§fDamage ${w.damage}${w.pellets > 1 ? " x" + w.pellets : ""}  ·  Magazine ${w.mag}  ·  Range ${w.range}\n§fFire rate ${(20 / w.fire).toFixed(1)}/s ${w.auto ? "automatic" : "semi-auto"}  ·  Reload ${(w.reload / 20).toFixed(1)} s\n§fAmmo: ${AMMO[w.ammo].name}  ·  Durability ${w.durability}`;
  else if (w.kind === "melee") body += `§fAttack damage ${w.damage}  ·  Durability ${w.durability}`;
  else body += "§fThrowable. Tap to throw.";
  await showForm(new MessageFormData().title(w.name).body(body).button1("Back").button2("Close"), player).then((r) => { if (r.selection === 0) catalogue(player); });
}

export async function openAmmoBox(player) {
  const form = new ActionFormData().title("§lAMMO BOX").body("§7Unpack the box into one type of magazine.");
  const keys = Object.keys(AMMO_BOX);
  for (const k of keys) form.button(`${AMMO_BOX[k]}x ${AMMO[k].name}\n§7${AMMO[k].desc}`, icon(k));
  const res = await showForm(form, player);
  if (res.canceled) return;
  const k = keys[res.selection];
  if (removeItems(player, "bunker:ammo_box", 1) < 1) return;
  give(player, "bunker:" + k, AMMO_BOX[k]);
  soundTo(player, "bunker.crate_open", 1, 1.3);
  actionBar(player, `§aUnpacked ${AMMO_BOX[k]}x ${AMMO[k].name}.`);
}

export async function openFieldManual(player) {
  const body = [
    "§e§lSHOOTING", "§fTap the screen (or right-click) with a gun to fire. Automatic weapons fire while you hold.", "§fWhen a magazine is empty the weapon reloads from a matching magazine in your inventory.",
    "", "§e§lRELOAD EARLY", "§fOpen the Armory (Field Terminal item or any Control Panel) and choose Reload.",
    "", "§e§lATTACHMENTS", "§fCraft sights, grips, barrels and magazines, then attach them in the Armory while holding the gun.",
    "", "§e§lTHE BUNKER", "§fUse a Bunker Blueprint to build a bunker below you. Tap blast doors to open them.", "§fTap a Control Panel for lights, lockdown, alarm and status. Keycards open sealed doors.",
    "§fSupply and weapon crates: tap to loot. Small outposts also generate naturally deep underground.",
    "", "§e§lREPAIR", "§fWorn weapons jam. Repair them with Steel Plates at an anvil or in the Armory.",
  ].join("\n");
  await showForm(new MessageFormData().title("§lFIELD MANUAL").body(body).button1("Close").button2("Armory"), player).then((r) => { if (r.selection === 1) openArmory(player); });
}
const r1 = (n) => Math.round(n * 10) / 10;
