// @ts-check
// Mobile UI of the Outbreak Control (SPEC §7, @minecraft/server-ui 1.1.0).
//
// Main menu (ActionFormData): status body + Pause/Resume (when active),
// Settings, Cure everything, Clean up outbreak, Cure me (only when the user is
// infected), Close. Settings is a ModalFormData (sliders + toggles), the two
// destructive actions ask for confirmation with a MessageFormData.
// A form canceled with "UserBusy" (another screen was open) is re-shown up to
// BUSY_RETRIES times, BUSY_RETRY_TICKS apart; any other cancel does nothing.

import { system } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { SOUNDS } from "../lib/ids.js";
import { logError, playSoundTo, runSafe, safe, tell, isValidEntity } from "../lib/util.js";
import { CONFIG_RANGES } from "./config.js";
import * as api from "./api.js";
import { incubationSecondsLeft } from "./infection.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./config.js").NumericConfigKey} NumericConfigKey */

/** Retries of a form canceled with UserBusy. */
export const BUSY_RETRIES = 5;
/** Ticks between UserBusy retries. */
export const BUSY_RETRY_TICKS = 10;

/** Texts used by the forms (tests select buttons/controls by them). */
export const UI_TEXT = Object.freeze({
  menuTitle: "☣ Outbreak Control",
  pause: "Pause outbreak",
  resume: "Resume outbreak",
  settings: "Settings",
  cureAll: "Cure everything",
  cleanup: "Clean up outbreak",
  cureMe: "Cure me",
  close: "Close",
  settingsTitle: "Outbreak Settings",
  replication: "Replication interval (s)",
  incubation: "Mob incubation (s)",
  playerIncubation: "Player incubation (s)",
  cap: "Population cap",
  infectPlayers: "Infect players",
  showHud: "Show HUD while holding the control",
  confirmCureTitle: "Cure everything?",
  confirmCleanupTitle: "Clean up the outbreak?",
  cancel: "Cancel",
});

/**
 * @typedef {object} FormLikeResponse
 * @property {boolean} canceled
 * @property {string | undefined} [cancelationReason]
 */

/**
 * Show a form; retries on UserBusy. Resolves with the response, or undefined
 * when the form was canceled/closed or failed.
 * @template {FormLikeResponse} R
 * @param {Player} player
 * @param {{show(player: Player): Promise<R>}} form
 * @param {string} label
 * @returns {Promise<R | undefined>}
 */
export function showForm(player, form, label) {
  return new Promise((resolve) => {
    /** @param {number} attempt */
    const tryShow = (attempt) => {
      /** @type {Promise<R>} */
      let p;
      try {
        if (!isValidEntity(player)) return resolve(undefined);
        p = form.show(player);
      } catch (err) {
        logError(label, err);
        return resolve(undefined);
      }
      p.then(
        (res) => {
          if (res.canceled) {
            if (res.cancelationReason === FormCancelationReason.UserBusy && attempt < BUSY_RETRIES) {
              try {
                system.runTimeout(
                  safe(() => tryShow(attempt + 1), label),
                  BUSY_RETRY_TICKS,
                );
                return;
              } catch (err) {
                logError(label, err);
              }
            }
            resolve(undefined);
            return;
          }
          resolve(res);
        },
        (err) => {
          logError(label, err);
          resolve(undefined);
        },
      );
    };
    tryShow(0);
  });
}

/**
 * Attach an error logger to a promise so nothing escapes as an unhandled rejection.
 * @param {Promise<unknown>} p
 * @param {string} label
 */
export function guard(p, label) {
  p.catch((err) => logError(label, err));
}

/**
 * Status text of the main menu.
 * @param {Player} player
 * @returns {string}
 */
export function statusBody(player) {
  const st = api.getState();
  const cfg = api.getConfig();
  const s = api.getStatus();
  const lines = [];
  const mode = !st.active ? "§aINACTIVE" : st.paused ? "§ePAUSED" : "§cACTIVE";
  lines.push(`Status: ${mode}§r`);
  lines.push(`Generation: ${st.generation}`);
  lines.push(`Parasites: ${s.parasites}`);
  lines.push(`Infected creatures: ${s.infected}`);
  lines.push(`Incubating: ${s.incubating}${s.held > 0 ? ` (${s.held} held at the cap)` : ""}`);
  lines.push(`Infected players: ${s.infectedPlayers}`);
  lines.push(`Population: ${s.total} / ${cfg.populationCap}`);
  if (st.active) {
    const secs = Math.max(0, Math.ceil(st.ticksToNext / 20));
    lines.push(st.paused ? `Next generation: frozen (${secs}s left)` : `Next generation in: ${secs}s`);
  }
  lines.push(`Births ${st.stats.births} · Infections ${st.stats.infections} · Conversions ${st.stats.conversions} · Deaths ${st.stats.deaths}`);
  const stage = api.stageOf(player);
  lines.push(stage === 2 ? "You: §4INFECTED§r" : stage === 1 ? `You: §cincubating (${incubationSecondsLeft(player)}s)§r` : "You: healthy");
  return lines.join("\n");
}

/**
 * Open the main menu for `player`.
 * @param {Player} player
 * @returns {Promise<void>}
 */
export function openControlMenu(player) {
  playSoundTo(player, SOUNDS.UI_OPEN);
  const st = api.getState();
  /** @type {{text: string, run: () => void}[]} */
  const actions = [];
  if (st.active) {
    actions.push(st.paused ? { text: UI_TEXT.resume, run: () => doResume(player) } : { text: UI_TEXT.pause, run: () => doPause(player) });
  }
  actions.push({ text: UI_TEXT.settings, run: () => guard(openSettings(player), "outbreak.ui.settings") });
  actions.push({ text: UI_TEXT.cureAll, run: () => guard(confirmCure(player), "outbreak.ui.cure") });
  actions.push({ text: UI_TEXT.cleanup, run: () => guard(confirmCleanup(player), "outbreak.ui.cleanup") });
  if (api.stageOf(player) > 0) actions.push({ text: UI_TEXT.cureMe, run: () => void api.curePlayer(player) });
  actions.push({ text: UI_TEXT.close, run: () => {} });
  const form = new ActionFormData().title(UI_TEXT.menuTitle).body(statusBody(player));
  for (const a of actions) form.button(a.text);
  return showForm(player, form, "outbreak.ui.menu").then((res) => {
    if (!res || res.selection === undefined) return;
    const a = actions[res.selection];
    if (a) runSafe(a.run, "outbreak.ui.action");
  });
}

/** @param {Player} player */
function doPause(player) {
  if (api.pause()) tell(player, "§e☣ Outbreak paused - the horde is dormant, timers are frozen.");
  else tell(player, "§7☣ Nothing to pause.");
}

/** @param {Player} player */
function doResume(player) {
  if (api.resume()) tell(player, "§c☣ Outbreak resumed.");
  else tell(player, "§7☣ Nothing to resume.");
}

/**
 * Slider default: the value snapped onto the slider grid.
 * @param {NumericConfigKey} key
 * @param {number} value
 * @returns {number}
 */
function sliderDefault(key, value) {
  const r = CONFIG_RANGES[key];
  const snapped = r.min + Math.round((value - r.min) / r.step) * r.step;
  return Math.min(r.max, Math.max(r.min, snapped));
}

/**
 * Settings form; values are clamped and persisted by setConfig.
 * @param {Player} player
 * @returns {Promise<void>}
 */
export function openSettings(player) {
  const cfg = api.getConfig();
  const R = CONFIG_RANGES;
  const form = new ModalFormData()
    .title(UI_TEXT.settingsTitle)
    .slider(UI_TEXT.replication, R.replicationSeconds.min, R.replicationSeconds.max, R.replicationSeconds.step, sliderDefault("replicationSeconds", cfg.replicationSeconds))
    .slider(UI_TEXT.incubation, R.incubationSeconds.min, R.incubationSeconds.max, R.incubationSeconds.step, sliderDefault("incubationSeconds", cfg.incubationSeconds))
    .slider(
      UI_TEXT.playerIncubation,
      R.playerIncubationSeconds.min,
      R.playerIncubationSeconds.max,
      R.playerIncubationSeconds.step,
      sliderDefault("playerIncubationSeconds", cfg.playerIncubationSeconds),
    )
    .slider(UI_TEXT.cap, R.populationCap.min, R.populationCap.max, R.populationCap.step, sliderDefault("populationCap", cfg.populationCap))
    .toggle(UI_TEXT.infectPlayers, cfg.infectPlayers)
    .toggle(UI_TEXT.showHud, cfg.showHud);
  return showForm(player, form, "outbreak.ui.settings").then((res) => {
    const v = res?.formValues;
    if (!v) return;
    /** @param {unknown} x @param {number} d @returns {number} */
    const num = (x, d) => (typeof x === "number" ? x : d);
    /** @param {unknown} x @param {boolean} d @returns {boolean} */
    const bool = (x, d) => (typeof x === "boolean" ? x : d);
    const next = api.setConfig({
      replicationSeconds: num(v[0], cfg.replicationSeconds),
      incubationSeconds: num(v[1], cfg.incubationSeconds),
      playerIncubationSeconds: num(v[2], cfg.playerIncubationSeconds),
      populationCap: num(v[3], cfg.populationCap),
      infectPlayers: bool(v[4], cfg.infectPlayers),
      showHud: bool(v[5], cfg.showHud),
    });
    tell(
      player,
      `§a☣ Settings saved: replication ${next.replicationSeconds}s, incubation ${next.incubationSeconds}s, player incubation ${next.playerIncubationSeconds}s, cap ${next.populationCap}, infect players ${next.infectPlayers ? "on" : "off"}, HUD ${next.showHud ? "on" : "off"}.`,
    );
  });
}

/**
 * Yes/no confirmation; resolves true only for button1.
 * @param {Player} player
 * @param {string} titleText
 * @param {string} body
 * @param {string} yes
 * @returns {Promise<boolean>}
 */
function confirm(player, titleText, body, yes) {
  const form = new MessageFormData().title(titleText).body(body).button1(yes).button2(UI_TEXT.cancel);
  return showForm(player, form, "outbreak.ui.confirm").then((res) => !!res && res.selection === 0);
}

/** @param {Player} player @returns {Promise<void>} */
export function confirmCure(player) {
  return confirm(
    player,
    UI_TEXT.confirmCureTitle,
    "Parasites are destroyed, infected creatures turn back into what they were and every infection is cured. The outbreak ends.",
    UI_TEXT.cureAll,
  ).then((ok) => {
    if (!ok) return;
    const n = api.cure();
    tell(player, `§a☣ Cure released: ${n} loaded entities affected. The outbreak is over.`);
  });
}

/** @param {Player} player @returns {Promise<void>} */
export function confirmCleanup(player) {
  return confirm(
    player,
    UI_TEXT.confirmCleanupTitle,
    "Every horde entity is removed (infected creatures are NOT turned back) and every infection is cleared. The outbreak ends.",
    UI_TEXT.cleanup,
  ).then((ok) => {
    if (!ok) return;
    const n = api.cleanup();
    tell(player, `§a☣ Outbreak cleaned up: ${n} loaded entities affected.`);
  });
}
