// Urban Legends Horror add-on - entry point.
import * as mc from "@minecraft/server";
import { initGrinningMan } from "./grinningMan.js";
import { initItems } from "./items.js";
import { initParasite } from "./parasite.js";
import { on } from "./util.js";

const WELCOMED = "horror:welcomed";

initParasite();
initGrinningMan();
initItems();

on(mc.world.afterEvents, "playerSpawn", (event) => {
  const player = event.player;
  if (!event.initialSpawn || player.hasTag(WELCOMED)) return;
  player.addTag(WELCOMED);
  player.sendMessage(
    "§8[§4Urban Legends§8] §7Horror add-on loaded! Open the creative inventory:\n" +
      "§7- §fSpawn Eggs§7: §fThe Grinning Man §7and the §4Parasite §c(it kills you instantly!)\n" +
      "§7- §fEquipment§7: Flashlight, EMF Ghost Reader, Holy Talisman, Soul Scythe, Haunted Mirror",
  );
});
