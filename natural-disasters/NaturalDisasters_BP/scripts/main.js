// Natural Disaster Simulator - entry point. Hold a disaster item and tap/use it to spawn that disaster where you look.
import { world, system } from '@minecraft/server';
import { ITEM_MAP, ITEM_DEBOUNCE_TICKS, DISASTER_IDS, VERSION } from './config.js';
import { startDisaster, stopAll, initManager, recoverWorld, statusText } from './lib/manager.js';
import { openController } from './lib/ui.js';
import { initAuto } from './lib/auto.js';
import { updateSettings, resetSettings } from './lib/settings.js';
import { playSoundTo } from './lib/fx.js';
import { warn, errMsg } from './lib/util.js';

/** player id -> tick of the last accepted item use (a touch tap fires itemUse AND itemUseOn) @type {Map<string, number>} */
const lastUse = new Map();
const welcomed = new Set();
let recovered = false;

/** @param {import('@minecraft/server').Player} player @param {string} text */
function tell(player, text) {
  try { player.sendMessage(text); } catch (e) { /* player left */ }
}

/** Where the player is looking (block hit within 96 blocks), else 32 blocks ahead. @param {import('@minecraft/server').Player} player */
function targetOf(player) {
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 96 });
    if (hit && hit.block) return { x: hit.block.x + 0.5, y: hit.block.y + 1, z: hit.block.z + 0.5 };
  } catch (e) { /* unloaded or invalid */ }
  const p = player.location;
  const d = player.getViewDirection();
  const h = Math.sqrt(d.x * d.x + d.z * d.z);
  if (h < 0.1) return { x: p.x, y: p.y, z: p.z };
  return { x: p.x + (d.x / h) * 32, y: p.y, z: p.z + (d.z / h) * 32 };
}

/** @param {import('@minecraft/server').Player} player @param {string} disaster @param {string} variant @param {string} label */
function spawn(player, disaster, variant, label) {
  const res = startDisaster(disaster, variant, player.dimension, targetOf(player), player);
  if (res.ok) tell(player, '§a[Disasters] ' + label + ' spawned.');
  else tell(player, '§c[Disasters] ' + (res.reason || 'Could not start ' + label + '.'));
  return res.ok;
}

/** @param {import('@minecraft/server').Player} player */
function stop(player) {
  const r = stopAll('item');
  tell(player, '§a[Disasters] STOP ALL: ended ' + r.disasters + ' disaster(s), removed ' + r.entities + ' temporary entities, restoring ' + r.blocks + ' block(s).');
  playSoundTo(player, 'nd.stop_chime', { volume: 1 });
}

/** @param {import('@minecraft/server').Player} player @param {string} itemId */
function onItem(player, itemId) {
  const def = ITEM_MAP[itemId];
  if (!def) return;
  const now = system.currentTick;
  const last = lastUse.get(player.id);
  if (last !== undefined && now - last < ITEM_DEBOUNCE_TICKS) return;
  lastUse.set(player.id, now);
  try {
    if (def.kind === 'spawn' && def.disaster) spawn(player, def.disaster, def.variant || 'default', def.label);
    else if (def.kind === 'stop') stop(player);
    else if (def.kind === 'controller') openController(player);
  } catch (e) {
    warn('item ' + itemId + ' failed: ' + errMsg(e));
    tell(player, '§c[Disasters] Something went wrong (see content log).');
  }
}

function recoverOnce() {
  if (recovered) return;
  recovered = true;
  recoverWorld();
}

world.afterEvents.itemUse.subscribe((ev) => {
  try { onItem(ev.source, ev.itemStack.typeId); } catch (e) { warn('itemUse: ' + errMsg(e)); }
});
world.afterEvents.itemUseOn.subscribe((ev) => {
  try { onItem(ev.source, ev.itemStack.typeId); } catch (e) { warn('itemUseOn: ' + errMsg(e)); }
});
world.afterEvents.playerSpawn.subscribe((ev) => {
  try {
    recoverOnce();
    if (ev.initialSpawn && !welcomed.has(ev.player.id)) {
      welcomed.add(ev.player.id);
      tell(ev.player, '§e[Natural Disaster Simulator ' + VERSION + '] Find the disaster items in the creative inventory (search "nd" or "Spawn"), or use /give @s nd:spawn_tornado. Block destruction is OFF by default; change it in the Disaster Controller.');
    }
  } catch (e) { warn('playerSpawn: ' + errMsg(e)); }
});
world.afterEvents.playerLeave.subscribe((ev) => { lastUse.delete(ev.playerId); welcomed.delete(ev.playerId); });

// /scriptevent nd:stop | nd:status | nd:reset | nd:set <key> <value> | nd:spawn <disaster> [variant]
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  try {
    const src = ev.sourceEntity && ev.sourceEntity.typeId === 'minecraft:player' ? /** @type {import('@minecraft/server').Player} */ (ev.sourceEntity) : world.getAllPlayers()[0];
    const say = (/** @type {string} */ m) => { if (src) tell(src, m); else world.sendMessage(m); };
    const parts = ev.message.trim().split(/\s+/).filter((x) => x.length > 0);
    if (ev.id === 'nd:stop') {
      const r = stopAll('scriptevent');
      say('§a[Disasters] Stopped ' + r.disasters + ' disaster(s).');
    } else if (ev.id === 'nd:status') {
      say('§7[Disasters] ' + statusText());
    } else if (ev.id === 'nd:reset') {
      resetSettings();
      say('§a[Disasters] Settings reset to safe defaults.');
    } else if (ev.id === 'nd:set' && parts.length >= 2) {
      const raw = parts[1];
      const val = raw === 'true' || raw === 'on' ? true : raw === 'false' || raw === 'off' ? false : Number(raw);
      const next = updateSettings(/** @type {any} */ ({ [parts[0]]: val }));
      say('§a[Disasters] ' + parts[0] + ' = ' + JSON.stringify(/** @type {any} */ (next)[parts[0]]));
    } else if (ev.id === 'nd:spawn' && parts.length >= 1) {
      if (!src) return;
      if (DISASTER_IDS.indexOf(parts[0]) < 0) { say('§c[Disasters] Unknown disaster. Use: ' + DISASTER_IDS.join(', ')); return; }
      spawn(src, parts[0], parts[1] || 'default', parts[0]);
    }
  } catch (e) { warn('scriptevent: ' + errMsg(e)); }
}, { namespaces: ['nd'] });

initManager();
initAuto();
system.runTimeout(recoverOnce, 60);
