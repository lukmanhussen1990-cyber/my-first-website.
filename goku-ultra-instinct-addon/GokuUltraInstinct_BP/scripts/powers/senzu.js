// Senzu Bean: full health, full hunger, full ki, bad effects gone.
import { system } from '@minecraft/server';
import { actionBar, fx, sound } from '../lib/fx.js';
import { MAX_KI } from '../lib/state.js';
import { bodyCenter, up } from '../lib/vec.js';

const BAD_EFFECTS = [
  'poison',
  'fatal_poison',
  'wither',
  'slowness',
  'weakness',
  'hunger',
  'nausea',
  'blindness',
  'mining_fatigue',
  'darkness',
  'levitation',
];

export function eatSenzu(player, state) {
  try {
    player.getComponent('minecraft:health')?.resetToMaxValue();
  } catch {
    // ignore
  }
  for (const effect of BAD_EFFECTS) {
    try {
      player.removeEffect(effect);
    } catch {
      // ignore
    }
  }
  try {
    player.addEffect('saturation', 2, { amplifier: 20, showParticles: false });
    player.extinguishFire(false);
  } catch {
    // ignore
  }
  state.ki = MAX_KI;
  state.hudUntil = system.currentTick + 40;
  const dim = player.dimension;
  fx(dim, 'ring', 'gold', up(player.location, 0.1), 3);
  fx(dim, 'spark', 'gold', bodyCenter(player), 1);
  sound(dim, 'random.burp', player.location, 1, 1);
  sound(dim, 'random.levelup', player.location, 0.8, 1.6);
  actionBar(player, '§a§lSenzu Bean! §r§fHealth, hunger and ki fully restored.');
}
