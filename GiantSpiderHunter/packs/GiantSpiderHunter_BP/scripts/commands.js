// In-game commands (need cheats / operator), all via /scriptevent:
//   /scriptevent gsh:status                 encounter + spider status
//   /scriptevent gsh:spawn                  start an encounter near you now (ignores timers)
//   /scriptevent gsh:reset                  despawn auto spiders, clear encounter state
//   /scriptevent gsh:config                 list overridden settings
//   /scriptevent gsh:config <key>           show one setting (default, range, description)
//   /scriptevent gsh:config <key> <value>   change a setting (persisted in the world)
//   /scriptevent gsh:config reset [key]     back to defaults
//   /scriptevent gsh:challenge on|off       optional challenge mode
//   /scriptevent gsh:debug on|off           debug logging
//   /scriptevent gsh:grow                   make the nearest spider see you (testing)
import { world } from '@minecraft/server';
import { CONFIG, VERSION, configKeys, describeKey, getOverrides, resetConfig, setConfigValue } from './config.js';
import { log } from './effects.js';
import { forceSpawnSearch, resetEncounters, status } from './encounters.js';
import { resetPlayers } from './challenge.js';
import { refreshVisualConfig, controllers } from './spider.js';
import { resetState, saveConfig } from './state.js';
import { dist } from './util.js';

function reply(source, text) {
  try {
    if (source && source.typeId === 'minecraft:player') source.sendMessage(text);
    else world.sendMessage(text);
  } catch (e) {
    // ignore
  }
  log(text.replace(/§./g, ''));
}

const VISUAL_KEYS = new Set(['smallScale', 'giantScale', 'growTime', 'growthDurationSeconds']);

export function onScriptEvent(ev, now) {
  const id = ev.id;
  if (!id.startsWith('gsh:')) return;
  const src = ev.sourceEntity;
  const args = (ev.message || '').trim().split(/\s+/).filter(Boolean);
  switch (id) {
    case 'gsh:status':
      reply(src, `§6Giant Spider Hunter ${VERSION}§r\n${status()}`);
      break;
    case 'gsh:spawn':
      if (!src || src.typeId !== 'minecraft:player') reply(src, 'gsh:spawn must be run by a player');
      else reply(src, `§e${forceSpawnSearch(src)}`);
      break;
    case 'gsh:reset':
      resetEncounters(now);
      resetState();
      reply(src, '§eEncounters reset (settings kept).');
      break;
    case 'gsh:challenge': {
      const on = (args[0] || '').toLowerCase();
      if (on !== 'on' && on !== 'off') {
        reply(src, `challenge mode is ${CONFIG.challengeMode ? 'on' : 'off'} (use gsh:challenge on|off)`);
        break;
      }
      const wasOn = CONFIG.challengeMode;
      setConfigValue('challengeMode', on === 'on');
      saveConfig();
      if (on === 'on' && !wasOn) resetPlayers();
      reply(src, `§eChallenge mode ${on}.`);
      break;
    }
    case 'gsh:debug': {
      const on = (args[0] || 'on').toLowerCase() !== 'off';
      setConfigValue('debug', on);
      saveConfig();
      reply(src, `debug ${on ? 'on' : 'off'}`);
      break;
    }
    case 'gsh:grow': {
      if (!src || src.typeId !== 'minecraft:player') break;
      let best;
      let bd = Infinity;
      for (const c of controllers.values()) {
        try {
          const d = dist(c.entity.location, src.location);
          if (d < bd) {
            bd = d;
            best = c;
          }
        } catch (e) {
          // ignore
        }
      }
      if (best) {
        best.aggress(src, now, 'command');
        reply(src, '§cIt has seen you.');
      } else reply(src, 'no spider loaded');
      break;
    }
    case 'gsh:config': {
      if (args.length === 0) {
        const o = getOverrides();
        const keys = Object.keys(o);
        reply(src, keys.length ? `overrides: ${keys.map((k) => `${k}=${o[k]}`).join(', ')}` : `no overrides (keys: ${configKeys().join(', ')})`);
        break;
      }
      if (args[0].toLowerCase() === 'reset') {
        const r = resetConfig(args[1]);
        saveConfig();
        refreshVisualConfig();
        reply(src, r.ok ? `reset ${args[1] || 'all settings'}` : r.error);
        break;
      }
      if (args.length === 1) {
        const d = describeKey(args[0]) || describeKey(configKeys().find((k) => k.toLowerCase() === args[0].toLowerCase()));
        reply(src, d ? `${d.key} = ${CONFIG[d.key]} (default ${d.default}, ${d.type}${d.range}) - ${d.description}` : `unknown key ${args[0]}`);
        break;
      }
      const r = setConfigValue(args[0], args.slice(1).join(' '));
      if (!r.ok) {
        reply(src, `§c${r.error}`);
        break;
      }
      saveConfig();
      if (VISUAL_KEYS.has(r.key)) refreshVisualConfig();
      reply(src, `§e${r.key} = ${r.value}`);
      break;
    }
    default:
      reply(src, `unknown command ${id} (gsh:status, gsh:spawn, gsh:reset, gsh:config, gsh:challenge, gsh:debug, gsh:grow)`);
  }
}
