// Cursed Floating Eyeball Guardian - script entry point.
// @minecraft/server 1.10.0 + @minecraft/server-ui 1.1.0 (stable in 1.21.0.26, no experiments).
// This is the only module with side effects: it subscribes to events and starts
// the single per-tick loop. Everything else lives in the imported modules.

import { system, world } from '@minecraft/server';
import { GUARDIAN_ID, PLAYER_TYPE_ID, TIMING } from './config.js';
import { getData, forgetData } from './store.js';
import {
  addKill,
  bootstrap,
  getState,
  guardians,
  handleDimensionChange,
  handleGuardianDeath,
  handlePlayerLeave,
  handlePlayerSpawn,
  maintainState,
  ownerOfEntity,
  registerGuardian,
  slowTick,
  sweep,
} from './registry.js';
import { tickGuardian } from './brain.js';
import { creditKill, onGuardianHurt, onOwnerHitEntity, onOwnerHurt, pruneCombat } from './combat.js';
import { onShieldedHit } from './abilities.js';
import { forgetItemUser, handleItemUse } from './items.js';
import { handleScriptEvent } from './commands.js';
import { forgetFormsOf } from './ui.js';
import { actionBar, isValid, warnOnce } from './util.js';

/**
 * Runs an event handler without letting an exception escape into the engine.
 * @param {string} name @param {() => void} fn
 */
function guarded(name, fn) {
  try {
    fn();
  } catch (error) {
    warnOnce(name, error);
  }
}

// ---------------------------------------------------------------------------
// Guardian discovery
// ---------------------------------------------------------------------------

world.afterEvents.entityLoad.subscribe((event) =>
  guarded('entityLoad', () => {
    if (event.entity.typeId === GUARDIAN_ID) registerGuardian(event.entity);
  }),
);

world.afterEvents.entitySpawn.subscribe((event) =>
  guarded('entitySpawn', () => {
    if (event.entity.typeId === GUARDIAN_ID) registerGuardian(event.entity);
  }),
);

// ---------------------------------------------------------------------------
// Protection, rage, assists, kills
// ---------------------------------------------------------------------------

world.afterEvents.entityHurt.subscribe((event) =>
  guarded('entityHurt', () => {
    const hurt = event.hurtEntity;
    const typeId = hurt.typeId;
    const tick = system.currentTick;
    if (typeId === PLAYER_TYPE_ID) {
      const state = getState(hurt.id);
      if (!state || !isValid(state.entity)) return;
      onShieldedHit(state, getData(state.owner), event.damage);
      onOwnerHurt(state, event.damageSource, tick);
    } else if (typeId === GUARDIAN_ID) {
      const ownerId = ownerOfEntity(hurt.id);
      const state = ownerId ? getState(ownerId) : undefined;
      if (state && state.entityId === hurt.id) onGuardianHurt(state, event.damageSource, tick);
    }
  }),
);

world.afterEvents.entityHitEntity.subscribe((event) =>
  guarded('entityHitEntity', () => {
    const attacker = event.damagingEntity;
    if (attacker.typeId !== PLAYER_TYPE_ID) return;
    const state = getState(attacker.id);
    if (!state || !isValid(state.entity)) return;
    onOwnerHitEntity(state, event.hitEntity, system.currentTick);
  }),
);

world.afterEvents.entityDie.subscribe((event) =>
  guarded('entityDie', () => {
    const dead = event.deadEntity;
    let id;
    let typeId;
    try {
      id = dead.id;
      typeId = dead.typeId;
    } catch {
      return;
    }
    if (typeId === GUARDIAN_ID) {
      handleGuardianDeath(id);
      return;
    }
    const ownerId = creditKill(id, system.currentTick);
    if (!ownerId) return;
    const kills = addKill(ownerId);
    const state = getState(ownerId);
    if (state && kills > 0) actionBar(state.owner, `§4Guardian kill §7- total §f${kills}`);
  }),
);

// ---------------------------------------------------------------------------
// Items & commands
// ---------------------------------------------------------------------------

world.afterEvents.itemUse.subscribe((event) => guarded('itemUse', () => handleItemUse(event.source, event.itemStack)));

world.afterEvents.itemUseOn.subscribe((event) =>
  guarded('itemUseOn', () => handleItemUse(event.source, event.itemStack)),
);

system.afterEvents.scriptEventReceive.subscribe((event) => guarded('scriptEvent', () => handleScriptEvent(event)), {
  namespaces: ['ceg'],
});

// ---------------------------------------------------------------------------
// Player lifecycle
// ---------------------------------------------------------------------------

world.afterEvents.playerSpawn.subscribe((event) =>
  guarded('playerSpawn', () => handlePlayerSpawn(event.player, event.initialSpawn)),
);

world.afterEvents.playerLeave.subscribe((event) =>
  guarded('playerLeave', () => {
    handlePlayerLeave(event.playerId);
    forgetData(event.playerId);
    forgetItemUser(event.playerId);
    forgetFormsOf(event.playerId);
  }),
);

world.afterEvents.playerDimensionChange.subscribe((event) =>
  guarded('playerDimensionChange', () => handleDimensionChange(event.player)),
);

// ---------------------------------------------------------------------------
// Main loop: one cheap pass over active guardians per tick
// ---------------------------------------------------------------------------

system.run(() => guarded('bootstrap', bootstrap));

system.runInterval(() => {
  const tick = system.currentTick;
  for (const state of guardians.values()) {
    try {
      if (maintainState(state, tick)) tickGuardian(state, tick);
    } catch (error) {
      warnOnce('tick', error);
    }
  }
  if (tick % TIMING.SLOW_INTERVAL === 0) {
    guarded('slowTick', () => slowTick(tick));
    guarded('pruneCombat', () => pruneCombat(tick));
  }
  if (tick % TIMING.SWEEP_INTERVAL === 0) guarded('sweep', sweep);
}, 1);
