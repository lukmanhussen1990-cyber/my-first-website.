// Headless end-to-end simulation of the add-on against tools/sim/mock_server.js.
// Run: node --import ./sim/register.mjs ./sim/run.mjs   (from natural-disasters/tools)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sim, S, H, overworld } from './mock_server.js';
import { uiScript } from './mock_ui.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BP = path.resolve(HERE, '../../NaturalDisasters_BP/scripts');
const RP = path.resolve(HERE, '../../NaturalDisasters_RP');
const ONLY = process.argv.slice(2);

// ---- known ids from the resource pack ------------------------------------------------------------------------------
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
S.knownParticles = new Set(fs.readdirSync(path.join(RP, 'particles')).map((f) => readJson(path.join(RP, 'particles', f)).particle_effect.description.identifier));
S.knownSounds = new Set(Object.keys(readJson(path.join(RP, 'sounds/sound_definitions.json')).sound_definitions));
S.knownFogs = new Set(fs.readdirSync(path.join(RP, 'fogs')).map((f) => readJson(path.join(RP, 'fogs', f))['minecraft:fog_settings'].description.identifier));

const warnings = [];
const realWarn = console.warn.bind(console);
console.warn = (...a) => { const s = a.join(' '); if (s.startsWith('[ND]')) warnings.push(s); else realWarn(...a); };
console.log = (...a) => { const s = a.join(' '); if (!s.startsWith('[ND]')) process.stdout.write(s + '\n'); };

let gen = 0;
async function boot() {
  gen++;
  sim.resetTimers();
  const g = '?gen=' + gen;
  const u = (p) => pathToFileURL(path.join(BP, p)).href + g;
  const M = {
    main: await import(u('main.js')),
    manager: await import(u('lib/manager.js')),
    settings: await import(u('lib/settings.js')),
    blocks: await import(u('lib/blocks.js')),
    entities: await import(u('lib/entities.js')),
    stats: await import(u('lib/stats.js')),
    config: await import(u('config.js')),
    fx: await import(u('lib/fx.js')),
  };
  sim.step(70);
  return M;
}

// ---- helpers ----------------------------------------------------------------------------------------------------------------
let failures = 0;
const fails = [];
function check(cond, msg) {
  if (!cond) { failures++; fails.push(msg); console.log('  FAIL: ' + msg); }
  return cond;
}
const sameMap = (a, b) => {
  let diff = 0;
  for (const [k, v] of a) if (b.get(k) !== v) diff++;
  for (const k of b.keys()) if (!a.has(k)) diff++;
  return diff;
};

function resetWorld() {
  for (const e of [...S.entities.values()]) if (e.typeId !== 'minecraft:player') { e.removed = true; S.entities.delete(e.id); }
  S.players.forEach((p) => { p.health = 20; p.vel = { x: 0, y: 0, z: 0 }; p.effects.clear(); p.fire = 0; });
}
function populate() {
  resetWorld();
  const [steve, alex] = S.players;
  const fs0 = sim.freeSpot(0, 0), fa0 = sim.freeSpot(25, 10);
  steve.teleport({ x: fs0.x, y: H(fs0.x, fs0.z) + 1, z: fs0.z }); alex.teleport({ x: fa0.x, y: H(fa0.x, fa0.z) + 1, z: fa0.z });
  steve.yaw = 0; steve.pitch = -0.15;
  const mobs = [];
  for (let i = 0; i < 8; i++) mobs.push(sim.spawnMob('minecraft:zombie', 8 + i * 4, -6 + (i % 3) * 6));
  for (let i = 0; i < 5; i++) mobs.push(sim.spawnMob('minecraft:cow', 12 + i * 5, 8 - (i % 2) * 14));
  for (let i = 0; i < 4; i++) sim.spawnMob('minecraft:item', 14 + i * 3, 3);
  return { steve, alex, mobs };
}
const tempEntities = () => [...S.entities.values()].filter((e) => !e.removed && (e.tags.has('nd_temp') || e.typeId.startsWith('nd:'))).length;
const fogLeft = () => [...S.fog.values()].reduce((n, s) => n + s.size, 0);

function useItem(player, item) {
  sim.emit('itemUse', { source: player, itemStack: { typeId: item } });
}

// ---- scenario matrix -------------------------------------------------------------------------------------------------------
const rows = [];
async function astep(n) { for (let i = 0; i < n; i++) { sim.step(1); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); } }
async function scenario(M, tag, itemId, def, patch) {
  const { steve } = populate();
  M.settings.resetSettings();
  M.settings.updateSettings(patch);
  const q = M.config.QUALITY[patch.quality ?? 1];
  const base = new Map(S.overrides);
  const p0 = { total: S.particles.total, unknown: S.particles.unknown.size, bad: S.particles.badVars.size };
  const w0 = warnings.length, e0 = S.errors.length;
  S.particles.peakTick = 0; S.particles.cur = 0; S.blockOps.peakTick = 0; S.blockOps.cur = 0; S.damage.player = 0; S.damage.mob = 0; S.deaths = 0; S.entombed = 0;
  S.maxKnock = 0; S.maxImpulse = 0; S.damage.byCause.clear(); S.lightning = 0; S.explosions.length = 0; S.sounds.unknown.clear();
  const t0 = performance.now();
  if (process.env.DEBUG_FALL) S.debugFall = [];
  useItem(steve, itemId);
  const started = M.manager.activeCount();
  if (!check(started === 1, `${tag} ${itemId}: expected 1 active disaster after use, got ${started} (${steve.messages.slice(-1)})`)) return;
  let ticks = 0, peakTemp = 0, peakAlive = 0;
  const maxTicks = 5200;
  while (M.manager.activeCount() > 0 && ticks < maxTicks) {
    sim.step(1); ticks++;
    if (ticks % 5 === 0) { peakTemp = Math.max(peakTemp, tempEntities()); }
  }
  if (process.env.DEBUG_FALL && S.debugFall && S.debugFall.length && patch.mobDamage === false) console.log(tag, itemId, 'first falls:', JSON.stringify(S.debugFall.slice(0, 6)));
  const ended = M.manager.activeCount() === 0;
  check(ended, `${tag} ${itemId}: did not end within ${maxTicks} ticks`);
  const mid = performance.now();
  let rest = 0;
  while ((M.blocks.pendingRestore() > 0 || rest < 200) && rest < 3000) { sim.step(1); rest++; }
  const ms = performance.now() - t0;
  const pPeak = Math.max(S.particles.peakTick, S.particles.cur), bPeak = Math.max(S.blockOps.peakTick, S.blockOps.cur);
  const leaks = sameMap(S.overrides, base);
  const r = {
    tag, item: itemId.replace('nd:', ''), ticks, pPeak, temp: peakTemp, bPeak, leaks, dmgP: +S.damage.player.toFixed(1), dmgM: +S.damage.mob.toFixed(1),
    deaths: S.deaths, entomb: S.entombed, ms: Math.round(ms), perTick: +((mid - t0) / Math.max(1, ticks)).toFixed(2), light: S.lightning, expl: S.explosions.length,
  };
  rows.push(r);
  const label = `${tag} ${r.item}`;
  check(pPeak <= q.particlesPerTick + 6, `${label}: particle peak ${pPeak} > budget ${q.particlesPerTick}`);
  check(peakTemp <= q.maxTempEntities, `${label}: temp entities ${peakTemp} > cap ${q.maxTempEntities}`);
  check(bPeak <= q.blockOpsPerTick * 2, `${label}: block ops/tick ${bPeak} > ${q.blockOpsPerTick * 2}`);
  check(tempEntities() === 0, `${label}: ${tempEntities()} temp entities left after end`);
  check(fogLeft() === 0, `${label}: ${fogLeft()} fog stacks left`);
  check(S.shakeOn.size === 0, `${label}: camera shake left on`);
  check(S.weather === 'Clear', `${label}: weather left as ${S.weather}`);
  check(S.particles.unknown.size === p0.unknown, `${label}: unknown particles ${[...S.particles.unknown.keys()]}`);
  check(S.particles.badVars.size === p0.bad, `${label}: unexpected molang vars ${[...S.particles.badVars]}`);
  check(S.sounds.unknown.size === 0, `${label}: unknown sounds ${[...S.sounds.unknown.keys()]}`);
  check(warnings.length === w0, `${label}: ${warnings.length - w0} warnings: ${warnings.slice(w0, w0 + 3).join(' | ')}`);
  check(S.errors.length === e0, `${label}: timer errors: ${S.errors.slice(e0, e0 + 2).join(' | ')}`);
  check(S.maxKnock <= 4.001, `${label}: knockback ${S.maxKnock} exceeds cap`);
  check(S.maxImpulse <= 3.001, `${label}: impulse ${S.maxImpulse} exceeds cap`);
  check(S.particles.total > p0.total + 20, `${label}: produced almost no particles`);
  if (!patch.blockDestruction) {
    check(leaks === 0, `${label}: ${leaks} block(s) NOT restored with destruction OFF`);
    check(S.lightning === 0 && S.explosions.filter((x) => x.breaks).length === 0, `${label}: real lightning/explosion with destruction OFF`);
  }
  if (patch.playerDamage === false) check(S.damage.player === 0, `${label}: player damage ${S.damage.player} with player damage OFF`);
  if (patch.mobDamage === false) check(S.damage.mob === 0, `${label}: mob damage ${S.damage.mob} with mob damage OFF (${[...S.damage.byCause].map(([k, v]) => k + ':' + Math.round(v)).join(',')})`);
  if (patch.playerDamage === false && patch.mobDamage === false) check(S.deaths === 0, `${label}: deaths with damage OFF`);
  check(S.entombed === 0, `${label}: ${S.entombed} entity-ticks inside solid blocks`);
  if (patch.blockDestruction) { S.overrides.clear(); }
  M.manager.stopAll('test');
}

async function main() {
  sim.spawnPlayer('Steve', 0, 0, 0);
  sim.spawnPlayer('Alex', 25, 10, Math.PI);
  let M = await boot();
  const spawnItems = Object.entries(M.config.ITEM_MAP).filter(([, d]) => d.kind === 'spawn').map(([id, d]) => [id, d]);
  const wanted = ONLY.length ? spawnItems.filter(([id]) => ONLY.some((o) => id.includes(o))) : spawnItems;

  const T0 = performance.now();
  for (const [id, d] of wanted) {
    await scenario(M, 'A-default', id, d, { strength: 3, durationPct: 100, blockDestruction: false, mobDamage: true, playerDamage: true, quality: 1 });
    await scenario(M, 'B-destroy', id, d, { strength: 5, durationPct: 50, blockDestruction: true, mobDamage: true, playerDamage: true, quality: 2 });
    await scenario(M, 'C-nodmg', id, d, { strength: 5, durationPct: 50, blockDestruction: false, mobDamage: false, playerDamage: false, quality: 0 });
  }
  console.log(`\nscenario matrix: ${rows.length} runs in ${Math.round((performance.now() - T0) / 1000)}s`);
  const hdr = ['tag', 'item', 'ticks', 'pPeak', 'temp', 'bPeak', 'leaks', 'dmgP', 'dmgM', 'deaths', 'entomb', 'light', 'expl', 'perTick'];
  console.log(hdr.join('\t'));
  for (const r of rows) console.log(hdr.map((h) => r[h]).join('\t'));

  if (!ONLY.length) await extraTests(M);
  console.log('\n' + (failures ? `SIMULATION FAILED: ${failures} failing check(s)` : 'SIMULATION PASSED: all checks green'));
  if (failures) { console.log(fails.slice(0, 40).join('\n')); process.exit(1); }
}

// ---- interaction / lifecycle tests -------------------------------------------------------------------------------------------
async function extraTests(M) {
  console.log('\n-- extra tests --');
  const { steve } = populate();
  const okSet = (patch) => { M.settings.resetSettings(); M.settings.updateSettings(patch); };

  // touch fires itemUse and itemUseOn in the same tick: one disaster only
  okSet({ durationPct: 100 });
  useItem(steve, 'nd:spawn_tornado');
  sim.emit('itemUseOn', { source: steve, itemStack: { typeId: 'nd:spawn_tornado' }, block: null });
  check(M.manager.activeCount() === 1, `debounce: expected 1 active, got ${M.manager.activeCount()}`);
  sim.step(30);
  // concurrency cap (Balanced = 3)
  useItem(steve, 'nd:supercell'); sim.step(12);
  useItem(steve, 'nd:earthquake_m6'); sim.step(12);
  useItem(steve, 'nd:wildfire'); sim.step(12);
  check(M.manager.activeCount() === 3, `concurrency cap: expected 3 active, got ${M.manager.activeCount()}`);
  sim.step(400);
  // STOP ALL item: immediate cleanup
  useItem(steve, 'nd:stop_all_disasters');
  check(M.manager.activeCount() === 0, 'stop item: disasters still active');
  check(tempEntities() === 0, 'stop item: temp entities left');
  check(fogLeft() === 0 && S.shakeOn.size === 0, 'stop item: fog/shake left');
  sim.step(400);
  check(M.blocks.journalSize() === 0, `stop item: journal not empty (${M.blocks.journalSize()})`);
  check(S.weather === 'Clear', 'stop item: weather not cleared');
  console.log('  debounce, concurrency cap and STOP ALL ok');

  // controller UI: UserBusy retry, confirmation for destruction, persistence
  await astep(15);
  M.settings.resetSettings();
  uiScript.queue.length = 0; uiScript.shown.length = 0;
  uiScript.queue.push(() => ({ canceled: true, cancelationReason: 'UserBusy' }));
  uiScript.queue.push((form) => {
    const kinds = form.calls.filter((c) => c[0] !== 'title').map((c) => c[0]);
    check(kinds.join() === 'slider,slider,toggle,toggle,toggle,toggle,slider,dropdown,toggle,toggle', `controller form layout: ${kinds}`);
    return { canceled: false, formValues: [4, 150, true, false, true, true, 12, 2, false, false] };
  });
  uiScript.queue.push(() => ({ canceled: false, selection: 1 }));
  useItem(steve, 'nd:disaster_controller');
  await astep(60);
  const s = M.settings.getSettings();
  check(s.strength === 4 && s.durationPct === 150 && s.blockDestruction === true && s.mobDamage === false && s.playerDamage === true && s.autoDisasters === true && s.autoIntervalMin === 12 && s.quality === 2,
    `controller settings not applied: ${JSON.stringify(s)}`);
  check(S.dyn.has('nd:settings'), 'settings not persisted to a world dynamic property');
  // decline destruction
  M.settings.resetSettings(); await astep(15);
  uiScript.queue.push(() => ({ canceled: false, formValues: [3, 100, true, true, true, false, 8, 1, false, false] }));
  uiScript.queue.push(() => ({ canceled: false, selection: 0 }));
  useItem(steve, 'nd:disaster_controller'); await astep(30);
  check(M.settings.getSettings().blockDestruction === false, 'destruction enabled although the confirmation was declined');
  // reset switch
  M.settings.updateSettings({ strength: 5 }); await astep(15);
  uiScript.queue.push(() => ({ canceled: false, formValues: [5, 100, false, true, true, false, 8, 1, false, true] }));
  useItem(steve, 'nd:disaster_controller'); await astep(30);
  check(M.settings.getSettings().strength === 3, 'reset switch did not restore defaults');
  console.log('  controller UI (retry, confirm, decline, reset) ok');

  // scriptevents
  sim.step(15);
  const ev = (id, message) => sim.emit('scriptEventReceive', { id, message, sourceEntity: steve, sourceType: 'Entity' });
  ev('nd:spawn', 'tornado ef5');
  check(M.manager.activeCount() === 1, 'scriptevent nd:spawn did not start a disaster');
  ev('nd:status', ''); ev('nd:set', 'strength 5');
  check(M.settings.getSettings().strength === 5, 'scriptevent nd:set failed');
  ev('nd:stop', '');
  check(M.manager.activeCount() === 0, 'scriptevent nd:stop failed');
  ev('nd:reset', '');
  console.log('  scriptevents ok');

  // welcome message
  sim.emit('playerSpawn', { player: steve, initialSpawn: true });
  check(steve.messages.some((m) => m.includes('Block destruction is OFF by default')), 'welcome message missing');

  // auto disasters
  populate(); M.settings.resetSettings(); M.settings.updateSettings({ autoDisasters: true, autoIntervalMin: 2 });
  const before = M.stats.stats.disastersStarted;
  sim.step(3600);
  check(M.stats.stats.disastersStarted > before, 'auto scheduler never started a disaster');
  M.manager.stopAll('test'); M.settings.resetSettings(); sim.step(300);
  console.log('  auto scheduler ok');

  // crash recovery: quit mid-tsunami (destruction OFF) and reload the world
  populate();
  const base = new Map(S.overrides);
  M.settings.resetSettings();
  useItem(steve, 'nd:spawn_tsunami');
  sim.step(450);
  check(S.overrides.size > 0, 'tsunami placed no temporary water before the crash');
  check(S.dyn.has('nd:journal_count') && Number(S.dyn.get('nd:journal_count')) > 0, 'journal was not persisted');
  const before2 = S.overrides.size;
  for (const e of [...S.entities.values()]) if (e.typeId !== 'minecraft:player') { /* entities persist across reload */ }
  const M2 = await boot();                        // fresh module graph = script reload
  sim.step(600);
  const left = sameMap(S.overrides, base);
  console.log(`  crash recovery: ${before2} edited blocks before reload, ${left} left after recovery`);
  check(left === 0, `crash recovery left ${left} blocks unrestored`);
  check(tempEntities() === 0, 'crash recovery left temp entities');
  M = M2;
}

main().catch((e) => { console.log('HARNESS CRASH: ' + (e && e.stack || e)); process.exit(2); });
