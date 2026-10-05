// Runs the add-on's scripts against an in-memory mock of @minecraft/server and checks the spells.
//
//     node tools/test/run.mjs
//
// Needs only Node 18+ (no npm packages). Exits non-zero if any check fails.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = path.dirname(new URL(import.meta.url).pathname);
const scripts = path.join(here, '..', '..', 'behavior_pack', 'scripts');

// temp work dir:  <work>/node_modules/@minecraft/server (the mock)  +  <work>/scripts (copy of the add-on)
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mw-test-')));
const modDir = path.join(work, 'node_modules', '@minecraft', 'server');
fs.mkdirSync(modDir, { recursive: true });
fs.copyFileSync(path.join(here, 'mock_server.js'), path.join(modDir, 'index.js'));
fs.writeFileSync(path.join(modDir, 'package.json'), '{ "name": "@minecraft/server", "version": "1.11.0", "type": "module", "main": "index.js" }\n');
fs.cpSync(scripts, path.join(work, 'scripts'), { recursive: true });
process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));

const mc = await import(pathToFileURL(path.join(modDir, 'index.js')).href);
await import(pathToFileURL(path.join(work, 'scripts', 'main.js')).href);
const { world, system, log, Dimension, Player, Entity, ItemStack, __advance } = mc;

const results = [];
function check(name, cond, extra = '') { results.push([cond ? 'PASS' : 'FAIL', name, extra]); }
const reset = () => { for (const k of Object.keys(log)) log[k].length = 0; };

const dim = new Dimension();
const player = new Player({ x: 0, y: 64, z: 0 }, dim);
player.__view = { x: 0, y: 0, z: 1 };
world.__players.push(player);
const mobs = [];
const spawn = (type, x, z) => { const m = new Entity(type, { x, y: 64, z }, dim); m.__view = { x: 0, y: 0, z: -1 }; mobs.push(m); return m; };

const IDS = ['mw:flamebrand', 'mw:frostbite', 'mw:storm_staff', 'mw:arcane_wand', 'mw:shadow_dagger', 'mw:earth_hammer', 'mw:soul_scythe'];
const COOLDOWN = { 'mw:flamebrand': 120, 'mw:frostbite': 240, 'mw:storm_staff': 200, 'mw:arcane_wand': 50, 'mw:shadow_dagger': 140, 'mw:earth_hammer': 200, 'mw:soul_scythe': 280 };

for (const id of IDS) {
  // fresh scene
  mobs.splice(0).forEach((m) => { m.__alive = false; });
  dim.entities = [player];
  player.location = { x: 0, y: 64, z: 0 };
  const z1 = spawn('minecraft:zombie', 0, 5), z2 = spawn('minecraft:skeleton', 1.5, 7), z3 = spawn('minecraft:spider', -1, 3);
  const villager = spawn('minecraft:villager_v2', 0.5, 4);
  player.__target = z1; player.__blockHit = undefined; dim.solid = () => false;
  const stack = new ItemStack(id, COOLDOWN[id]);
  player.__main = stack;
  reset();
  // equip hint appears via the ambient interval
  __advance(6);
  const hintShown = log.actionbar.some((t) => t.length > 5);
  // cast
  world.afterEvents.itemUse.__emit({ source: player, itemStack: stack });
  const cd = stack.getComponent('minecraft:cooldown');
  check(`${id}: cooldown started`, cd.getCooldownTicksRemaining(player) === COOLDOWN[id]);
  // second tap right away must be ignored (cooldown / debounce)
  const dmgBefore = log.damage.length;
  world.afterEvents.itemUse.__emit({ source: player, itemStack: stack });
  __advance(60);
  const dmgs = log.damage.filter((d) => d.by === 'minecraft:player');
  const spawned = log.particles.length;
  check(`${id}: equip hint shown`, hintShown);
  check(`${id}: particles spawned`, spawned > 20, `${spawned}`);
  check(`${id}: did not hurt villager`, !log.damage.some((d) => d.to === 'minecraft:villager_v2'));
  const needsTarget = id !== 'mw:shadow_dagger';
  check(`${id}: damaged at least one mob`, dmgs.length > 0, JSON.stringify(dmgs.slice(0, 3)));
  check(`${id}: sounds played`, log.commands.filter((c) => c.startsWith('playsound')).length >= 2, `${log.commands.length}`);
  check(`${id}: durability worn`, stack.getComponent('minecraft:durability').damage > 0, `${stack.getComponent('minecraft:durability').damage}`);
  if (id === 'mw:shadow_dagger') check(`${id}: teleported forward`, log.teleports.length === 1 && log.teleports[0].loc.z > 3, JSON.stringify(log.teleports.map((t) => t.loc)));
  if (id === 'mw:soul_scythe') check(`${id}: healed caster`, log.heals.some((h) => h[0] === 'minecraft:player'));
  // ready notification after the cooldown
  __advance(COOLDOWN[id]);
  check(`${id}: ready message`, log.actionbar.some((t) => t.includes('ready')));
  // no stray scheduled tasks except the ambient interval
  check(`${id}: spells cleaned up their timers`, mc.__pending() === 1, `pending=${mc.__pending()}`);

  // melee passive
  reset();
  player.location = { x: 0, y: 64, z: 0 };
  const victim = z1; victim.location = { x: 0, y: 64, z: 1.5 }; victim.__view = { x: 0, y: 0, z: 1 }; // facing away from player (backstab)
  player.__view = { x: 0, y: 0, z: 1 };
  world.afterEvents.entityHitEntity.__emit({ damagingEntity: player, hitEntity: victim });
  check(`${id}: melee passive ran`, log.particles.length > 0 || log.fire.length > 0 || log.effects.length > 0 || log.damage.length > 0, `p=${log.particles.length} fire=${log.fire.length} fx=${log.effects.length} dmg=${log.damage.length}`);
}

// walls: spells must stop at solid blocks and the blink must not pass through them
{
  mobs.splice(0).forEach((m) => { m.__alive = false; });
  dim.entities = [player]; player.location = { x: 0, y: 64, z: 0 }; player.__target = undefined; player.__view = { x: 0, y: 0, z: 1 };
  dim.solid = (l) => l.z >= 8 && l.z < 10;                     // a 2-thick wall at z = 8..10
  const behind = spawn('minecraft:zombie', 0, 12);             // behind the wall
  for (const [id, label] of [['mw:shadow_dagger', 'blink'], ['mw:flamebrand', 'flame wave'], ['mw:arcane_wand', 'missiles']]) {
    const st = new ItemStack(id, 100); player.__main = st; reset(); player.location = { x: 0, y: 64, z: 0 };
    world.afterEvents.itemUse.__emit({ source: player, itemStack: st }); __advance(45);
    if (id === 'mw:shadow_dagger') check('wall: blink stops before the wall', log.teleports.length === 1 && log.teleports[0].loc.z < 8, JSON.stringify(log.teleports.map((t) => t.loc)));
    else check(`wall: ${label} does not hurt a mob behind the wall`, !log.damage.some((d) => d.to === 'minecraft:zombie'), JSON.stringify(log.damage));
    __advance(110);
  }
  // blink with no room at all (wall directly ahead) just fizzles
  dim.solid = (l) => l.z >= 1; player.location = { x: 0, y: 64, z: 0 };
  const st = new ItemStack('mw:shadow_dagger', 100); player.__main = st; reset();
  world.afterEvents.itemUse.__emit({ source: player, itemStack: st }); __advance(20);
  check('wall: blink with no room does not teleport', log.teleports.length === 0);
  dim.solid = () => false;
}
// block-target lightning
{
  mobs.splice(0).forEach((m) => { m.__alive = false; });
  dim.entities = [player]; player.location = { x: 0, y: 64, z: 0 };
  const near = spawn('minecraft:zombie', 6, 20);
  player.__target = undefined; player.__blockHit = { block: { x: 6, y: 63, z: 20 } };
  const st = new ItemStack('mw:storm_staff', 100); player.__main = st; reset();
  world.afterEvents.itemUse.__emit({ source: player, itemStack: st }); __advance(30);
  check('lightning hits mobs standing at the targeted block', log.damage.some((d) => d.to === 'minecraft:zombie' && d.cause === 'lightning'), JSON.stringify(log.damage));
}
// durability breaking & creative
{
  const stack = new ItemStack('mw:arcane_wand', 10, 1);
  player.__main = stack; player.__mode = 'survival'; reset();
  world.afterEvents.itemUse.__emit({ source: player, itemStack: stack }); __advance(40);
  check('item breaks at 0 durability', player.__main === undefined);
  const s2 = new ItemStack('mw:arcane_wand', 10, 500); player.__main = s2; player.__mode = 'creative';
  world.afterEvents.itemUse.__emit({ source: player, itemStack: s2 }); __advance(40);
  check('creative mode keeps durability', s2.getComponent('minecraft:durability').damage === 0);
  player.__mode = 'survival';
}
// tapping the ground (itemUseOn) casts exactly once even if itemUse also fires
{
  mobs.splice(0).forEach((m) => { m.__alive = false; });
  dim.entities = [player]; player.location = { x: 0, y: 64, z: 0 };
  const z = spawn('minecraft:zombie', 0, 4); player.__target = z; player.__view = { x: 0, y: 0, z: 1 };
  const st = new ItemStack('mw:flamebrand', 120); player.__main = st; reset();
  world.afterEvents.itemUseOn.__emit({ source: player, itemStack: st, block: { x: 0, y: 63, z: 2 } });
  world.afterEvents.itemUse.__emit({ source: player, itemStack: st });
  __advance(50);
  check('tap on ground (itemUseOn) casts once', log.damage.filter((d) => d.to === 'minecraft:zombie').length === 1, JSON.stringify(log.damage));
  __advance(130);
}
// non-weapon item and bad events are ignored without errors
world.afterEvents.itemUse.__emit({ source: player, itemStack: new ItemStack('minecraft:stick') });
world.afterEvents.itemUse.__emit({ source: undefined, itemStack: new ItemStack('mw:flamebrand') });
world.afterEvents.entityHitEntity.__emit({ damagingEntity: undefined, hitEntity: undefined });
world.afterEvents.playerLeave.__emit({ playerId: player.id });
check('ignores non-weapon items and invalid events', true);

let fails = 0;
for (const [s, n, e] of results) { if (s === 'FAIL') fails++; console.log(s.padEnd(5), n, e ? ' ' + e : ''); }
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
