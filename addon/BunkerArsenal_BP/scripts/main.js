// Bunker Arsenal - entry point. Wires item uses, grenades, medkits and the welcome kit to the gameplay modules.
import { world, system } from "@minecraft/server";
import { initWeapons, onItemUse } from "./weapons.js";
import { initBunkerBlocks, setArmoryHook } from "./bunker.js";
import { openBlueprint } from "./builder.js";
import { openArmory, openAmmoBox, openFieldManual } from "./ui.js";
import { safeSubscribe, isPlayer, soundTo, sound, particle, actionBar, tell, give, log } from "./util.js";

initWeapons();
initBunkerBlocks();
setArmoryHook(openArmory);

safeSubscribe(world.afterEvents.itemUse, (ev) => {
  const p = ev.source, item = ev.itemStack;
  if (!isPlayer(p) || !item) return;
  if (onItemUse(p, item)) return;
  switch (item.typeId) {
    case "bunker:field_terminal": openArmory(p); break;
    case "bunker:bunker_blueprint": openBlueprint(p); break;
    case "bunker:ammo_box": openAmmoBox(p); break;
    case "bunker:frag_grenade": case "bunker:stun_grenade": soundTo(p, "bunker.grenade_pin", 0.8, 1); break;
  }
}, "itemUse");

// Medkit: the food component finishes the 1.6 s "use", then we heal.
safeSubscribe(world.afterEvents.itemCompleteUse, (ev) => {
  if (ev.itemStack?.typeId !== "bunker:medkit" || !isPlayer(ev.source)) return;
  const p = ev.source;
  try { const h = p.getComponent("minecraft:health"); if (h) h.setCurrentValue(Math.min(h.effectiveMax ?? 20, h.currentValue + 8)); } catch (_) {}
  try { p.addEffect("regeneration", 100, { amplifier: 1, showParticles: false }); } catch (_) {}
  for (const eff of ["poison", "wither", "weakness"]) { try { p.removeEffect(eff); } catch (_) {} }
  soundTo(p, "bunker.reload", 1, 1.4); actionBar(p, "§aMedkit applied: +4 hearts and regeneration.");
}, "itemCompleteUse");

// Projectiles: stun grenade flash + rocket smoke trail.
const trackSpawn = (ent) => {
  if (!ent) return;
  if (ent.typeId === "bunker:stun_charge") system.runTimeout(() => stunFlash(ent), 36);
  else if (ent.typeId === "bunker:rocket") rocketTrail(ent);
};
if (!safeSubscribe(world.afterEvents.entitySpawn, (ev) => trackSpawn(ev.entity), "entitySpawn"))
  safeSubscribe(world.afterEvents.dataDrivenEntityTrigger, (ev) => { if (ev.eventId === "bunker:stun" && ev.entity?.typeId === "bunker:stun_charge") stunFlash(ev.entity); }, "dataDrivenEntityTrigger");

function stunFlash(ent) {
  let loc, dim; try { loc = ent.location; dim = ent.dimension; } catch (_) { return; }
  sound("bunker.stun_pop", loc, dim, 1, 1); particle(dim, "minecraft:large_explosion", loc);
  for (let i = 0; i < 6; i++) particle(dim, "minecraft:endrod", { x: loc.x + (Math.random() - 0.5) * 3, y: loc.y + Math.random() * 2, z: loc.z + (Math.random() - 0.5) * 3 });
  let targets = []; try { targets = dim.getEntities({ location: loc, maxDistance: 6 }); } catch (_) {}
  for (const e of targets) {
    if (e.typeId === "bunker:stun_charge" || e.typeId === "minecraft:item") continue;
    try { e.addEffect("blindness", 100, { amplifier: 0, showParticles: false }); e.addEffect("slowness", 100, { amplifier: 2, showParticles: true }); e.addEffect("weakness", 100, { amplifier: 1, showParticles: false }); }
    catch (_) { try { e.runCommandAsync("effect @s slowness 5 2 true"); } catch (_) {} }
    if (isPlayer(e)) { try { e.onScreenDisplay.setTitle("§f§l* FLASH *", { fadeInDuration: 0, stayDuration: 25, fadeOutDuration: 20 }); } catch (_) {} }
  }
}
function rocketTrail(ent) {
  let n = 0;
  const run = system.runInterval(() => {
    let loc; try { loc = ent.location; } catch (_) { system.clearRun(run); return; }
    particle(ent.dimension, "minecraft:basic_smoke_particle", loc); particle(ent.dimension, "minecraft:basic_flame_particle", loc);
    if (++n > 120) system.clearRun(run);
  }, 2);
}

// First visit: a short briefing and a starter kit so the add-on is usable in survival right away.
safeSubscribe(world.afterEvents.playerSpawn, (ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  system.runTimeout(() => {
    let given = false; try { given = !!p.getDynamicProperty("bunker:kit"); } catch (_) {}
    tell(p, "§6[Bunker Arsenal] §fLoaded. Tap with a gun to fire, hold for automatic fire. Use the §eField Terminal§f for the Armory, a §eBunker Blueprint§f to build a bunker.");
    if (!given) {
      give(p, "bunker:field_terminal", 1); give(p, "bunker:service_pistol", 1); give(p, "bunker:light_magazine", 2);
      try { p.setDynamicProperty("bunker:kit", true); } catch (_) {}
      tell(p, "§7Starter kit issued: Field Terminal, Service Pistol, 2 Light Magazines. Open the Field Manual from the terminal for help.");
    }
  }, 60);
}, "playerSpawn");

log("Bunker Arsenal scripts loaded");
