// Giant Spider Hunter - entry point (@minecraft/server 1.10.0, no experiments).
//
// Wiring only: event subscriptions and the throttled main loop.
//   every 2 ticks  : spider controllers (stalk / grow / hunt / strike / escape / terrain)
//   every 10 ticks : challenge-mode flight rule
//   every 20 ticks : auto spawner + population control, challenge kit, state flush
import { system, world } from '@minecraft/server';
import { CONFIG, VERSION } from './config.js';
import { ENTITY_ID, flush, loadAll } from './state.js';
import { controllers, updateAll } from './spider.js';
import { admit, onPeacefulDespawn, onPlayerDied, onPlayerLeft, onSecond, onSpiderDied } from './encounters.js';
import * as challenge from './challenge.js';
import { onScriptEvent } from './commands.js';
import { errorText, log, warn } from './effects.js';

let ready = false;

function guard(name, fn) {
  return (...a) => {
    try {
      fn(...a);
    } catch (e) {
      warn(`${name} failed: ${errorText(e)}`);
    }
  };
}

function start() {
  if (ready) return;
  ready = true;
  log(`Giant Spider Hunter ${VERSION} loaded: ${loadAll()}`);
  const now = system.currentTick;
  for (const id of ['overworld', 'nether', 'the_end']) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: ENTITY_ID })) admit(e, now);
    } catch (e) {
      // dimension not available yet
    }
  }
}

world.afterEvents.worldInitialize.subscribe(guard('worldInitialize', start));

system.runInterval(
  guard('main loop', () => {
    if (!ready) start();
    const now = system.currentTick;
    updateAll(now);
    if (now % 10 < 2) challenge.enforceFlight();
    if (now % 20 < 2) {
      onSecond(now);
      challenge.onSecond();
      if (now % 100 < 2) flush();
    }
  }),
  2
);

// ------------------------------------------------------------------ spider lifecycle
world.afterEvents.entitySpawn.subscribe(
  guard('entitySpawn', (ev) => {
    const e = ev.entity;
    if (!ready || !e || e.typeId !== ENTITY_ID) return;
    if (!controllers.has(e.id)) admit(e, system.currentTick);
  })
);

world.afterEvents.entityLoad.subscribe(
  guard('entityLoad', (ev) => {
    const e = ev.entity;
    if (!ready || !e || e.typeId !== ENTITY_ID) return;
    admit(e, system.currentTick);
  })
);

world.afterEvents.entityRemove.subscribe(
  guard('entityRemove', (ev) => {
    // unloaded or despawned: the encounter manager notices a missing auto spider by itself
    controllers.delete(ev.removedEntityId);
  }),
  { entityTypes: [ENTITY_ID] }
);

world.afterEvents.dataDrivenEntityTrigger.subscribe(
  guard('dataDrivenEntityTrigger', (ev) => {
    const e = ev.entity;
    const now = system.currentTick;
    switch (ev.eventId) {
      case 'horror:start_dying':
      case 'horror:to_dying': {
        let c = controllers.get(e.id);
        if (!c) {
          admit(e, now);
          c = controllers.get(e.id);
        }
        if (c) c.onStartDying(now);
        break;
      }
      case 'horror:peaceful_despawn':
        onPeacefulDespawn(e);
        break;
      default:
        break;
    }
  }),
  { entityTypes: [ENTITY_ID], eventTypes: ['horror:start_dying', 'horror:to_dying', 'horror:peaceful_despawn'] }
);

world.afterEvents.entityDie.subscribe(
  guard('entityDie', (ev) => {
    const e = ev.deadEntity;
    const now = system.currentTick;
    if (e.typeId === ENTITY_ID) {
      onSpiderDied(e.id, now);
    } else if (e.typeId === 'minecraft:player') {
      onPlayerDied(e, now);
      challenge.onPlayerDied(e);
    }
  })
);

world.afterEvents.entityHurt.subscribe(
  guard('entityHurt', (ev) => {
    const src = ev.damageSource && ev.damageSource.damagingEntity;
    if (!src || src.typeId !== 'minecraft:player') return;
    const c = controllers.get(ev.hurtEntity.id);
    if (c) c.onAttacked(src, system.currentTick);
  }),
  { entityTypes: [ENTITY_ID] }
);

// ------------------------------------------------------------------ players
world.afterEvents.playerLeave.subscribe(guard('playerLeave', (ev) => onPlayerLeft(ev.playerId, system.currentTick)));
world.afterEvents.playerSpawn.subscribe(guard('playerSpawn', (ev) => challenge.onPlayerSpawn(ev.player)));
world.beforeEvents.itemUse.subscribe((ev) => challenge.onBeforeItemUse(ev));

// ------------------------------------------------------------------ commands
system.afterEvents.scriptEventReceive.subscribe(
  guard('scriptEvent', (ev) => onScriptEvent(ev, system.currentTick))
);

if (CONFIG.debug) log('debug mode');
