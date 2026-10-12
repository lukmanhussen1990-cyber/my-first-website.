// Mobile-friendly ability menu (@minecraft/server-ui 1.1.0 ActionFormData):
// big icon buttons, two-line labels, the active mode marked. Forms that cannot
// open because the player is busy (chat/inventory open, item still in use) are
// retried a few times, 10 ticks apart.

import { system } from '@minecraft/server';
import { ActionFormData, FormCancelationReason } from '@minecraft/server-ui';
import { MODE, MODE_HINTS, MODE_ICONS, MODE_LABELS, SKINS, SOUNDS, TIMING, uiIcon } from './config.js';
import { getData } from './store.js';
import { liveState } from './registry.js';
import {
  deathCooldownSeconds,
  dismiss,
  fire,
  recall,
  setMode,
  setSkin,
  statusLines,
  summaryLines,
  summon,
  toggleHeal,
  toggleNightVision,
} from './actions.js';
import { isValid, playerSound, warnOnce } from './util.js';

/** @typedef {import('@minecraft/server').Player} Player */

const TITLE = '§4§lCursed Eyeball Guardian';

/** Players that currently have one of our forms open (or queued for a retry) -> tick opened. @type {Map<string, number>} */
const openForms = new Map();
/** A form that never answered (crashed client...) stops blocking new ones after this many ticks. */
const OPEN_FORM_TIMEOUT = 600;

/**
 * Shows a form built by `build`, retrying on "UserBusy". The builder is called
 * again for every attempt so the content is always fresh.
 * @param {Player} player
 * @param {() => ActionFormData} build
 * @param {(selection: number) => void} onSelect
 * @returns {boolean} false when another form is already open for this player
 */
function present(player, build, onSelect) {
  if (!isValid(player)) return false;
  const playerId = player.id;
  const tick = system.currentTick;
  const openedAt = openForms.get(playerId);
  if (openedAt !== undefined && tick - openedAt < OPEN_FORM_TIMEOUT) return false;
  openForms.set(playerId, tick);

  /** @param {number} attempt */
  const attemptShow = (attempt) => {
    if (!isValid(player)) {
      openForms.delete(playerId);
      return;
    }
    const retry = () => {
      if (attempt + 1 >= TIMING.UI_BUSY_RETRIES || !isValid(player)) {
        openForms.delete(playerId);
        return;
      }
      system.runTimeout(() => attemptShow(attempt + 1), TIMING.UI_RETRY_DELAY);
    };
    /** @type {ActionFormData} */
    let form;
    try {
      form = build();
    } catch (error) {
      openForms.delete(playerId);
      warnOnce('build form', error);
      return;
    }
    form
      .show(player)
      .then((response) => {
        if (response.canceled) {
          if (response.cancelationReason === FormCancelationReason.UserBusy) retry();
          else openForms.delete(playerId);
          return;
        }
        openForms.delete(playerId);
        const selection = response.selection;
        if (typeof selection !== 'number') return;
        try {
          onSelect(selection);
        } catch (error) {
          warnOnce('menu action', error);
        }
      })
      .catch((error) => {
        // Rejected (player quit, malformed response...). Retry while the player is still here.
        warnOnce('show form', error);
        retry();
      });
  };
  attemptShow(0);
  return true;
}

/** Forget form state of a player that left. @param {string} playerId */
export function forgetFormsOf(playerId) {
  openForms.delete(playerId);
}

/**
 * Two-line button label: bold title + grey hint.
 * @param {string} title @param {string} hint
 */
function label(title, hint) {
  return `§l${title}§r\n§8${hint}`;
}

/** @param {boolean} on */
function onOffLabel(on) {
  return on ? '§2ON' : '§4OFF';
}

/**
 * Main ability menu (controller tap, /scriptevent ceg:menu).
 * @param {Player} player
 */
export function openMainMenu(player) {
  /** @type {Array<() => void>} */
  let actions = [];
  const opened = present(
    player,
    () => {
      actions = [];
      const data = getData(player);
      const form = new ActionFormData().title(TITLE);
      const state = liveState(player);

      if (!state) {
        const wait = deathCooldownSeconds(player);
        const lines = [
          '§7You have no guardian at your side.',
          '',
          '§7Tap the §fCursed Summoning Eye§7 (or the button below) to awaken it.',
          '§7Craft it from redstone, spider eyes, an ender pearl and gold.',
        ];
        if (wait > 0) lines.push('', `§4Your guardian was destroyed. It re-forms in §f${wait}s§4.`);
        else if (data.active) lines.push('', '§eYour guardian is re-forming nearby...');
        form.body(lines.join('\n'));
        form.button(label('Summon Guardian', 'Awaken the cursed eye'), uiIcon('summon'));
        actions.push(() => summon(player));
        return form;
      }

      const body = [...summaryLines(player), '', '§8Crouch + tap the controller to fire at what you look at.'];
      form.body(body.join('\n'));

      for (let mode = /** @type {number} */ (MODE.FOLLOW); mode <= MODE.PASSIVE; mode++) {
        const active = data.mode === mode;
        const title = active ? `§2> ${MODE_LABELS[mode]} Mode <` : `${MODE_LABELS[mode]} Mode`;
        form.button(label(title, active ? 'Active now' : MODE_HINTS[mode]), uiIcon(MODE_ICONS[mode]));
        const chosen = mode;
        actions.push(() => setMode(player, chosen));
        if (mode === MODE.DESTROY && active) {
          form.button(label('§4Fire Destroy Laser', 'Blast the block you are looking at'), uiIcon('fire'));
          actions.push(() => fire(player));
        }
      }

      form.button(label('Teleport To Me', 'Recall the guardian to your side'), uiIcon('teleport'));
      actions.push(() => recall(player));

      form.button(label(`Night Vision: ${onOffLabel(data.nv)}`, 'Tap to toggle'), uiIcon('night_vision'));
      actions.push(() => {
        toggleNightVision(player);
        openMainMenu(player);
      });

      form.button(label(`Auto Heal: ${onOffLabel(data.heal)}`, 'Heals you when health is low'), uiIcon('heal'));
      actions.push(() => {
        toggleHeal(player);
        openMainMenu(player);
      });

      form.button(label('Change Look', `Current: ${SKINS[data.skin].label}`), uiIcon('look'));
      actions.push(() => openLookMenu(player));

      form.button(label('Status', 'Detailed guardian stats'), uiIcon('status'));
      actions.push(() => openStatusMenu(player));

      form.button(label('§4Dismiss Guardian', 'Send it back to the dark'), uiIcon('dismiss'));
      actions.push(() => openDismissMenu(player));
      return form;
    },
    (selection) => {
      const action = actions[selection];
      if (action) action();
    },
  );
  if (opened) playerSound(player, SOUNDS.MENU, 1, 1);
}

/** Change Look sub-menu (skin 0-3). @param {Player} player */
function openLookMenu(player) {
  present(
    player,
    () => {
      const current = getData(player).skin;
      const form = new ActionFormData().title(TITLE).body('§7Choose how your guardian looks:');
      for (let i = 0; i < SKINS.length; i++) {
        const skin = SKINS[i];
        const title = i === current ? `§2> ${skin.label} <` : `${skin.button}${skin.label}`;
        form.button(label(title, i === current ? 'Current look' : 'Tap to apply'), uiIcon('look'));
      }
      form.button(label('Back', 'Return to the main menu'), uiIcon('status'));
      return form;
    },
    (selection) => {
      if (selection < SKINS.length) setSkin(player, selection);
      else openMainMenu(player);
    },
  );
}

/** Status sub-menu with a Back button. @param {Player} player */
function openStatusMenu(player) {
  present(
    player,
    () =>
      new ActionFormData()
        .title(TITLE)
        .body(statusLines(player).join('\n'))
        .button(label('Back', 'Return to the main menu'), uiIcon('status')),
    () => openMainMenu(player),
  );
}

/** Confirmation before dismissing. @param {Player} player */
function openDismissMenu(player) {
  present(
    player,
    () =>
      new ActionFormData()
        .title(TITLE)
        .body('§7Dismiss your guardian?\n§8It fades away and can be summoned again at any time.')
        .button(label('§4Yes, dismiss', 'The eye closes'), uiIcon('dismiss'))
        .button(label('Cancel', 'Back to the main menu'), uiIcon('status')),
    (selection) => {
      if (selection === 0) dismiss(player);
      else openMainMenu(player);
    },
  );
}
