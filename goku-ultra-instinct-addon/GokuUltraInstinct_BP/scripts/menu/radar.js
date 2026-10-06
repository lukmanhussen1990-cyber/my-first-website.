// Dragon Radar: get every Goku item, change settings, read how to play.
import { ItemStack, system } from '@minecraft/server';
import { ActionFormData, MessageFormData, ModalFormData } from '@minecraft/server-ui';
import { MAX_KI, getState, hasInfiniteKi, isCreative, setSetting, setting } from '../lib/state.js';

export const SHOP = [
  { id: 'goku:ultra_instinct', name: '§7Ultra Instinct', icon: 'ultra_instinct', cost: 20 },
  { id: 'goku:kamehameha', name: '§bKamehameha', icon: 'kamehameha', cost: 8 },
  { id: 'goku:ki_blast', name: '§eKi Blast', icon: 'ki_blast', cost: 2 },
  { id: 'goku:spirit_bomb', name: '§9Spirit Bomb', icon: 'spirit_bomb', cost: 15 },
  { id: 'goku:instant_transmission', name: '§dInstant Transmission', icon: 'instant_transmission', cost: 6 },
  { id: 'goku:dragon_fist', name: '§6Dragon Fist', icon: 'dragon_fist', cost: 5 },
  { id: 'goku:power_pole', name: '§cPower Pole', icon: 'power_pole', cost: 4 },
  { id: 'goku:flying_nimbus', name: '§eFlying Nimbus', icon: 'flying_nimbus', cost: 5 },
  { id: 'goku:senzu_bean', name: '§aSenzu Beans x3', icon: 'senzu_bean', cost: 1, amount: 3 },
  { id: 'goku:goku_hair', name: "§fGoku's Hair", icon: 'goku_hair', cost: 1 },
  { id: 'goku:ui_hair', name: '§7Ultra Instinct Hair', icon: 'ui_hair', cost: 5 },
  { id: 'goku:gi_top', name: "§6Goku's Gi", icon: 'gi_top', cost: 1 },
  { id: 'goku:gi_pants', name: "§6Goku's Gi Pants", icon: 'gi_pants', cost: 1 },
  { id: 'goku:gi_boots', name: "§9Goku's Boots", icon: 'gi_boots', cost: 1 },
];

const ICON = (name) => `textures/items/goku/${name}`;

function costOf(player, entry) {
  return setting('xpCost') && !isCreative(player) ? entry.cost : 0;
}

export function giveItem(player, id, amount = 1) {
  try {
    const container = player.getComponent('minecraft:inventory')?.container;
    const left = container ? container.addItem(new ItemStack(id, amount)) : new ItemStack(id, amount);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch (error) {
    console.warn(`[goku] could not give ${id}: ${error}`);
  }
}

export function giveEverything(player) {
  for (const entry of SHOP) giveItem(player, entry.id, entry.amount ?? 1);
}

function pay(player, cost) {
  if (cost <= 0) return true;
  if (player.level < cost) {
    player.sendMessage(`§cYou need ${cost} XP levels for that (you have ${player.level}).`);
    return false;
  }
  player.addLevels(-cost);
  return true;
}

function show(player, form, onResult, tries = 0) {
  form
    .show(player)
    .then((result) => {
      if (result.canceled) {
        // the radar was opened while another screen was still closing: try again
        if (result.cancelationReason === 'UserBusy' && tries < 10 && player.isValid()) {
          system.runTimeout(() => show(player, form, onResult, tries + 1), 5);
        }
        return;
      }
      onResult(result);
    })
    .catch((error) => console.warn(`[goku] radar form failed: ${error}`));
}

export function openRadar(player) {
  const state = getState(player);
  const ki = hasInfiniteKi(player) ? '§bINFINITE' : `§b${Math.floor(state.ki)}§7/${MAX_KI}`;
  const form = new ActionFormData()
    .title('§l§2DRAGON RADAR')
    .body(
      `§fKi: ${ki}\n§fUltra Instinct: ${state.ui ? '§aON' : '§7off'}\n` +
        `§fBlocks break: ${setting('griefing') ? '§aon' : '§7off'}\n\n§7Pick something, warrior!`
    )
    .button('§l§1Get Goku Items\n§r§8powers + outfit', ICON('kamehameha'))
    .button('§l§2Settings', ICON('dragon_radar'))
    .button('§l§5How to play', ICON('ultra_instinct'));
  show(player, form, (result) => {
    if (result.selection === 0) openShop(player);
    else if (result.selection === 1) openSettings(player);
    else if (result.selection === 2) openHelp(player);
  });
  return true;
}

function openShop(player) {
  const priced = setting('xpCost') && !isCreative(player);
  const total = SHOP.reduce((sum, e) => sum + e.cost, 0);
  const form = new ActionFormData()
    .title('§l§1Goku Items')
    .body(priced ? `§fItems cost XP levels. You have §a${player.level}§f levels.` : '§fAll items are free. Have fun!');
  form.button(`§l§4GET EVERYTHING${priced ? `\n§r§8${total} levels` : ''}`, ICON('dragon_radar'));
  for (const entry of SHOP) {
    form.button(`${entry.name}${priced ? `\n§r§8${entry.cost} levels` : ''}`, ICON(entry.icon));
  }
  show(player, form, (result) => {
    const pick = result.selection ?? -1;
    if (pick === 0) {
      if (!pay(player, priced ? total : 0)) return;
      giveEverything(player);
      player.sendMessage('§aYou received every Goku item! §7Check your inventory.');
    } else if (pick > 0 && pick <= SHOP.length) {
      const entry = SHOP[pick - 1];
      if (!pay(player, costOf(player, entry))) return;
      giveItem(player, entry.id, entry.amount ?? 1);
      player.sendMessage(`§aYou received ${entry.name}§a!`);
    }
    try {
      player.playSound('random.pop', { volume: 1, pitch: 1.2 });
    } catch {
      // ignore
    }
  });
}

function openSettings(player) {
  const form = new ModalFormData()
    .title('§l§2Settings')
    .toggle('Big attacks break blocks', setting('griefing'))
    .toggle('Infinite ki for everyone', setting('infiniteKi'))
    .toggle('Show the ki bar', setting('hud'))
    .toggle('Items cost XP levels in survival', setting('xpCost'));
  show(player, form, (result) => {
    const values = result.formValues ?? [];
    const keys = ['griefing', 'infiniteKi', 'hud', 'xpCost'];
    keys.forEach((key, i) => {
      if (typeof values[i] === 'boolean') setSetting(key, values[i]);
    });
    player.sendMessage('§aDragon Radar settings saved.');
  });
}

function openHelp(player) {
  const text = [
    '§l§7Ultra Instinct§r: use it to transform. Silver hair, super speed and strength, and you dodge attacks by yourself! Use again to turn it off.',
    '§l§bKamehameha§r: use it, hold still while you charge, then aim the wave with your camera.',
    '§l§eKi Blast§r: tap fast to throw energy balls.',
    '§l§9Spirit Bomb§r: arms up! After it grows, it flies where you look. Huge explosion.',
    '§l§dInstant Transmission§r: teleports where you look. Sneak + use: appear behind the nearest enemy.',
    '§l§6Dragon Fist§r: dash forward and punch everything in your way.',
    '§l§cPower Pole§r: hit things normally, or use it to EXTEND and hit far away. Sneak + use to pole-vault.',
    '§l§eFlying Nimbus§r: use it to ride the cloud. Look where you want to fly. Use again (or sneak) to land.',
    '§l§aSenzu Bean§r: eat it for full health, hunger and ki.',
    '§l§fOutfit§r: wear Goku\'s Gi, pants, boots and hair. Wear the black hair and it turns silver when you transform!',
    '§l§3Ki§r: attacks use ki (the blue bar). It refills by itself. Sneak while holding a power to charge it faster.',
  ].join('\n\n');
  show(
    player,
    new MessageFormData().title('§l§5How to play').body(text).button1('§lBack').button2('§lClose'),
    (result) => {
      if (result.selection === 0) system.run(() => openRadar(player));
    }
  );
}
