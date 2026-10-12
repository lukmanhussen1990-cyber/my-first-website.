// /scriptevent commands (namespace "ceg"). The source must be a player, e.g.
//   /scriptevent ceg:mode attack
//   /execute as @p run scriptevent ceg:level 5

import { MODE_KEYS, SKINS } from './config.js';
import { dismiss, fire, recall, sendStatus, setLevel, setMode, setSkin, summon } from './actions.js';
import { openMainMenu } from './ui.js';
import { asPlayer, tell } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */
/** @typedef {import('@minecraft/server').ScriptEventCommandMessageAfterEvent} ScriptEventCommandMessageAfterEvent */

const USAGE =
  '§7Guardian commands: §fceg:menu, ceg:summon, ceg:recall, ceg:dismiss, ceg:mode <follow|attack|shield|destroy|passive>, ceg:level <1-5>, ceg:skin <0-3>, ceg:fire, ceg:status';

/**
 * Parses "attack" / "1" style arguments against a key list.
 * @param {string} arg @param {string[]} keys
 * @returns {number} index or -1
 */
function parseChoice(arg, keys) {
  const byName = keys.indexOf(arg);
  if (byName >= 0) return byName;
  if (/^\d+$/.test(arg)) {
    const n = Number(arg);
    if (n >= 0 && n < keys.length) return n;
  }
  return -1;
}

/** @param {ScriptEventCommandMessageAfterEvent} event */
export function handleScriptEvent(event) {
  const player = asPlayer(event.sourceEntity);
  if (!player) return;
  const arg = (event.message ?? '').trim().toLowerCase();
  switch (event.id) {
    case 'ceg:menu':
      openMainMenu(player);
      break;
    case 'ceg:summon':
      summon(player);
      break;
    case 'ceg:recall':
      recall(player);
      break;
    case 'ceg:dismiss':
      dismiss(player);
      break;
    case 'ceg:mode': {
      const mode = parseChoice(arg, MODE_KEYS);
      if (mode < 0) tell(player, '§7Usage: §f/scriptevent ceg:mode <follow|attack|shield|destroy|passive>');
      else setMode(player, mode);
      break;
    }
    case 'ceg:level': {
      const level = /^\d+$/.test(arg) ? Number(arg) : NaN;
      if (!(level >= 1 && level <= 5)) tell(player, '§7Usage: §f/scriptevent ceg:level <1-5>');
      else if (setLevel(player, level)) tell(player, `§6Guardian level set to §f${level}§6.`);
      break;
    }
    case 'ceg:skin': {
      const skin = parseChoice(arg, SKINS.map((s) => s.key));
      if (skin < 0) tell(player, '§7Usage: §f/scriptevent ceg:skin <0-3>§7 (crimson, void, frost, toxic)');
      else setSkin(player, skin);
      break;
    }
    case 'ceg:fire':
      fire(player);
      break;
    case 'ceg:status':
      sendStatus(player);
      break;
    default:
      tell(player, USAGE);
  }
}
