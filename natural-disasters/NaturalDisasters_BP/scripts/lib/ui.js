// Disaster Controller: the settings form opened by the "Disaster Controller" item.
import { system } from '@minecraft/server';
import { ModalFormData, ActionFormData, FormCancelationReason } from '@minecraft/server-ui';
import { getSettings, updateSettings, resetSettings } from './settings.js';
import { QUALITY_NAMES, STRENGTH_NAMES } from '../config.js';
import { warn, errMsg } from './util.js';

/** player ids that already have a controller flow open @type {Set<string>} */
const busy = new Set();

/**
 * Show a form; if the player still has the chat/pause screen open (UserBusy) retry every half second.
 * @param {import('@minecraft/server').Player} player @param {any} form @param {number} tries
 * @returns {Promise<any>} the response, or undefined when the form could not be shown
 */
function showWithRetry(player, form, tries) {
  return new Promise((resolve) => {
    /** @param {number} n */
    const attempt = (n) => {
      try {
        form.show(player).then((res) => {
          if (res.canceled && res.cancelationReason === FormCancelationReason.UserBusy && n < tries) system.runTimeout(() => attempt(n + 1), 10);
          else resolve(res);
        }).catch((e) => { warn('form failed: ' + errMsg(e)); resolve(undefined); });
      } catch (e) {
        warn('form show threw: ' + errMsg(e));
        resolve(undefined);
      }
    };
    attempt(0);
  });
}

/** @param {import('@minecraft/server').Player} player @param {string} text */
function tell(player, text) {
  try { player.sendMessage(text); } catch (e) { /* player left */ }
}

/** @param {import('@minecraft/server').Player} player */
async function confirmDestruction(player) {
  const form = new ActionFormData()
    .title('§cEnable block destruction?')
    .body('With this ON, disasters PERMANENTLY destroy blocks: terrain, buildings, trees, water and lava changes are NOT restored.\n\nMake a backup of your world first. You can switch it OFF again at any time (already destroyed blocks stay destroyed).')
    .button('Keep it OFF (safe)')
    .button('§cEnable - I have a backup');
  const res = await showWithRetry(player, form, 12);
  return !!res && !res.canceled && res.selection === 1;
}

/** @param {import('@minecraft/server').Player} player */
async function run(player) {
  const s = getSettings();
  const form = new ModalFormData()
    .title('Disaster Controller')
    .slider('Strength (1 = weak ... 5 = catastrophic)', 1, 5, 1, s.strength)
    .slider('Duration (% of normal)', 25, 300, 25, s.durationPct)
    .toggle('§cBlock destruction ON (PERMANENT world damage!)', s.blockDestruction)
    .toggle('Disasters can damage mobs', s.mobDamage)
    .toggle('Disasters can damage players', s.playerDamage)
    .toggle('Automatic random disasters', s.autoDisasters)
    .slider('Automatic disaster interval (minutes)', 2, 30, 1, s.autoIntervalMin)
    .dropdown('Performance (Low is best for phones)', QUALITY_NAMES.slice(), s.quality)
    .toggle('Debug logging', s.debug)
    .toggle('Reset everything to safe defaults', false);
  const res = await showWithRetry(player, form, 12);
  if (!res || res.canceled || !res.formValues) return;
  const v = res.formValues;
  if (v[9] === true) {
    resetSettings();
    tell(player, '§a[Disasters] Settings reset to safe defaults (block destruction OFF).');
    return;
  }
  let destruction = v[2] === true;
  if (destruction && !s.blockDestruction) {
    if (!(await confirmDestruction(player))) {
      destruction = false;
      tell(player, '§e[Disasters] Block destruction stays OFF.');
    }
  }
  const next = updateSettings({
    strength: Number(v[0]),
    durationPct: Number(v[1]),
    blockDestruction: destruction,
    mobDamage: v[3] === true,
    playerDamage: v[4] === true,
    autoDisasters: v[5] === true,
    autoIntervalMin: Number(v[6]),
    quality: Number(v[7]),
    debug: v[8] === true,
  });
  tell(player, '§a[Disasters] Saved: strength ' + next.strength + ' (' + STRENGTH_NAMES[next.strength - 1] + '), duration ' + next.durationPct + '%, block destruction ' +
    (next.blockDestruction ? '§cON§a' : 'OFF') + ', mob damage ' + (next.mobDamage ? 'ON' : 'OFF') + ', player damage ' + (next.playerDamage ? 'ON' : 'OFF') +
    ', auto ' + (next.autoDisasters ? 'every ~' + next.autoIntervalMin + ' min' : 'OFF') + ', quality ' + QUALITY_NAMES[next.quality] + '.');
}

/** Open the controller for a player (ignored while one is already open for them). @param {import('@minecraft/server').Player} player */
export function openController(player) {
  const id = player.id;
  if (busy.has(id)) return;
  busy.add(id);
  run(player).catch((e) => warn('controller failed: ' + errMsg(e))).then(() => { busy.delete(id); });
}
