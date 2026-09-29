// @ts-check
// Menus: the Destruction Tablet and the per-weapon settings screen.
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { MODES, UI_ICON, WEAPONS, modeLabel } from "./config.js";
import { markerFlash } from "./effects.js";
import { showAction, showModal } from "./forms.js";
import { giveKit } from "./kit.js";
import { activeCount, startEffect, stopAll } from "./scheduler.js";
import { loadSettings, saveSettings, weaponPrefs } from "./settings.js";
import { isReady, launchStrike } from "./strike.js";
import { aimTarget, getMarker, resolveTarget, setMarker } from "./targeting.js";
import { clamp, fmt, notify, tell, wait } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./config.js").Weapon} Weapon */
/** @typedef {import("./config.js").ModeId} ModeId */

/** @param {boolean} b */
const onoff = (b) => (b ? "§aON" : "§cOFF");

/**
 * 3-2-1 on screen so the player can aim after closing a menu.
 * @param {Player} player @param {string} what
 */
async function aimCountdown(player, what) {
  for (let n = 3; n >= 1; n--) {
    if (!player.isValid()) return false;
    try {
      player.onScreenDisplay.setTitle(`§e${n}`, { subtitle: `§f${what}`, fadeInDuration: 0, stayDuration: 18, fadeOutDuration: 4 });
      player.playSound("random.click", { pitch: 0.8 + (3 - n) * 0.3 });
    } catch {
      // ignore
    }
    await wait(20);
  }
  return player.isValid();
}

// ---------------------------------------------------------------- tablet
/** @param {Player} player */
export async function openTablet(player) {
  const s = loadSettings(player);
  const m = getMarker(player);
  const body = [
    "§7Pick a weapon, choose §fWHERE§7 it lands, then watch the chaos.",
    "",
    `§fMarker: ${m ? `§e${fmt(m.pos)}` : "§8none"}`,
    `§fBlock damage: ${onoff(s.breakBlocks)}   §fFire: ${onoff(s.fire)}   §fProtect me: ${onoff(s.protect)}`,
    `§fRunning right now: §e${activeCount()}`,
  ].join("\n");
  const form = new ActionFormData()
    .title("§l§cDESTRUCTION TABLET")
    .body(body)
    .button("§l§4Launch a Strike\n§r§8Weapon, where, power", UI_ICON.launch)
    .button("§l§2Set Marker Here\n§r§8The block you aim at", UI_ICON.marker)
    .button("§l§1Weapon Settings\n§r§8Where each weapon hits + power", UI_ICON.gear)
    .button("§l§6Get All Weapons\n§r§8Missing items go to inventory", UI_ICON.kit)
    .button("§l§5Game Settings\n§r§8Block damage, fire, protection", UI_ICON.gear)
    .button("§l§cSTOP ALL\n§r§8Cancel everything running", UI_ICON.stop)
    .button("§lHow to use\n§r§8Quick guide", UI_ICON.help);
  const res = await showAction(player, form);
  if (!res || res.canceled || res.selection === undefined) return;
  switch (res.selection) {
    case 0:
      return launchFlow(player);
    case 1:
      return markHere(player, s.range, true);
    case 2: {
      const w = await pickWeapon(player, "§lWeapon Settings");
      if (w) await weaponSettings(player, w);
      return;
    }
    case 3:
      return kitButton(player);
    case 4:
      return gameSettings(player);
    case 5:
      return stopButton(player);
    case 6:
      return helpScreen(player);
  }
}

/** @param {Player} player @param {string} heading @returns {Promise<Weapon | undefined>} */
async function pickWeapon(player, heading) {
  const form = new ActionFormData().title(heading).body("§7Choose a weapon:");
  for (const w of WEAPONS) form.button(`§l${w.name}\n§r§8${w.blurb}`, w.icon);
  const res = await showAction(player, form);
  if (!res || res.canceled || res.selection === undefined) return undefined;
  return WEAPONS[res.selection];
}

/** @param {Player} player @param {ModeId} current @returns {Promise<ModeId | undefined>} */
async function pickWhere(player, current) {
  const form = new ActionFormData().title("§lWhere should it hit?").body(`§7Right now: §f${modeLabel(current)}`);
  for (const m of MODES) form.button(`§l${m.label}${m.id === current ? " §2*" : ""}\n§r§8${m.hint}`, m.icon);
  const res = await showAction(player, form);
  if (!res || res.canceled || res.selection === undefined) return undefined;
  return MODES[res.selection]?.id;
}

/** @param {Player} player @param {Weapon} w @param {number} power */
async function askPower(player, w, power) {
  const form = new ModalFormData()
    .title(`§l${w.name}`)
    .slider("§fPower §7(1 = small ... 5 = HUGE, may lag phones)", 1, 5, 1, power)
    .toggle("§fRemember for this weapon", true);
  const res = await showModal(player, form);
  if (!res || res.canceled || !res.formValues) return undefined;
  return { power: clamp(Math.round(Number(res.formValues[0])), 1, 5), remember: res.formValues[1] === true };
}

/** @param {Player} player */
async function launchFlow(player) {
  const w = await pickWeapon(player, "§lLaunch a Strike");
  if (!w) return;
  const s = loadSettings(player);
  const prefs = weaponPrefs(s, w.id);
  const mode = await pickWhere(player, prefs.mode);
  if (!mode) return;
  const choice = await askPower(player, w, prefs.power);
  if (!choice) return;
  if (choice.remember) {
    s.weapons[w.id] = { mode, power: choice.power };
    saveSettings(player, s);
  }
  if (!isReady(player, w)) return;
  if (mode === "look" && !(await aimCountdown(player, `Aim at the target for the ${w.name}`))) return;
  const target = await resolveTarget(player, mode, s.range);
  if (!target || !player.isValid()) return;
  launchStrike(player, w, target, choice.power, s);
}

// ---------------------------------------------------------------- settings
/** Sneak + tap with a weapon opens this. @param {Player} player @param {Weapon} w */
export async function weaponSettings(player, w) {
  const s = loadSettings(player);
  const prefs = weaponPrefs(s, w.id);
  const form = new ModalFormData()
    .title(`§l${w.name}`)
    .dropdown(
      "§fWhere should it hit?",
      MODES.map((m) => m.label),
      Math.max(0, MODES.findIndex((m) => m.id === prefs.mode)),
    )
    .slider("§fPower §7(1 = small ... 5 = HUGE, may lag phones)", 1, 5, 1, prefs.power);
  const res = await showModal(player, form);
  if (!res || res.canceled || !res.formValues) return;
  const mode = MODES[Number(res.formValues[0])]?.id ?? "look";
  const power = clamp(Math.round(Number(res.formValues[1])), 1, 5);
  s.weapons[w.id] = { mode, power };
  saveSettings(player, s);
  tell(player, `${w.color}${w.name}§r§7 now hits §f${modeLabel(mode)}§7 with power §f${power}§7.`);
  if (mode === "marker" && !getMarker(player)) {
    tell(player, "§7Tip: tap a block with the §2Target Marker§7 to set your marker.");
  }
}

/** @param {Player} player */
async function gameSettings(player) {
  const s = loadSettings(player);
  const form = new ModalFormData()
    .title("§lGame Settings")
    .toggle("§fBlock damage §7(OFF = just a show, no holes)", s.breakBlocks)
    .toggle("§fFire", s.fire)
    .toggle("§fProtect me §7(no self damage, never pulled in)", s.protect)
    .slider("§fAim range (blocks)", 32, 256, 16, clamp(Math.round(s.range / 16) * 16, 32, 256));
  const res = await showModal(player, form);
  if (!res || res.canceled || !res.formValues) return;
  const [breakBlocks, fire, prot, range] = res.formValues;
  s.breakBlocks = breakBlocks === true;
  s.fire = fire === true;
  s.protect = prot === true;
  s.range = clamp(Math.round(Number(range)) || 160, 32, 256);
  saveSettings(player, s);
  tell(player, `§aSaved. §fBlock damage ${onoff(s.breakBlocks)}§f, fire ${onoff(s.fire)}§f, protect me ${onoff(s.protect)}§f, range §e${s.range}`);
}

// ---------------------------------------------------------------- misc buttons
/**
 * Saves the block under the crosshair as the player's marker.
 * @param {Player} player @param {number} range @param {boolean} countdown
 */
export async function markHere(player, range, countdown) {
  if (countdown && !(await aimCountdown(player, "Aim at the spot to mark"))) return;
  const t = aimTarget(player, range, true);
  if (!t) return;
  setMarker(player, t.dim, t.pos);
  startEffect(markerFlash(t.dim, t.pos), "marker");
  try {
    player.playSound("random.orb", { pitch: 1.4 });
  } catch {
    // ignore
  }
  notify(player, `§2Marker set at §f${fmt(t.pos)}`);
  tell(player, `§2Marker set at §f${fmt(t.pos)}§7. To hit it: sneak + tap a weapon and pick §fMy Target Marker§7.`);
}

/** @param {Player} player */
function kitButton(player) {
  const { added, dropped } = giveKit(player);
  if (added === 0) tell(player, "§7You already have every Destruction Mod item.");
  else tell(player, `§aAdded §f${added}§a item(s).${dropped ? ` §e${dropped} didn't fit and were dropped at your feet.` : ""}`);
}

/** @param {Player} player */
function stopButton(player) {
  const n = stopAll();
  tell(player, n ? `§cStopped §f${n}§c running effect(s).` : "§7Nothing is running.");
}

/** @param {Player} player */
async function helpScreen(player) {
  const body = [
    "§l§6WEAPONS§r",
    "§f- Tap§7 with a weapon: it strikes where it is set to hit (default: where you look).",
    "§f- Sneak + tap§7 with a weapon: choose §fWHERE§7 it hits and its §fpower§7.",
    "",
    "§l§6WHERE CAN IT HIT?§r",
    "§f- Where I'm looking§7: the block under your crosshair.",
    "§f- My Target Marker§7: tap a block with the Target Marker to save a spot.",
    "§f- Type coordinates§7: enter X Y Z. §f~§7 means your position, §f~10§7 is 10 blocks away.",
    "§f- On a player§7: pick anyone who is online.",
    "§f- Random spot near me§7: pure chaos.",
    "",
    "§l§6TIPS§r",
    "§7- While you hold a weapon, the text above your hotbar shows where it will hit (green sparkles mark the spot).",
    "§7- Game Settings: turn §fBlock damage§7 off for a harmless show; keep §fProtect me§7 on to stay safe.",
    "§7- Power 5 can lag phones. §fSTOP ALL§7 cancels everything.",
    "§7- Lost your items? Tablet > Get All Weapons, or type §f/function destruct/kit§7 (cheats on).",
  ].join("\n");
  await showAction(player, new ActionFormData().title("§lHow to use").body(body).button("§lGot it!", UI_ICON.tablet));
}
