import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE_URL = 'file://' + path.join(ROOT, 'index.html');
const OUT_DIR = process.env.SHOTS || path.join(ROOT, '.shots');
fs.mkdirSync(OUT_DIR, { recursive: true });
const LAUNCH = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};


const FILE = FILE_URL;
const OUT = OUT_DIR;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
}

const browser = await chromium.launch(LAUNCH);

async function session(label, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 3 : 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const t0 = Date.now();
  await page.goto(FILE);
  await page.waitForFunction(() => window.PCA !== undefined, null, { timeout: 20000 });
  const bootMs = Date.now() - t0;
  check(`[${label}] boots without error`, errors.length === 0, errors.join(' | '));
  check(`[${label}] boot time under 6s`, bootMs < 6000, bootMs + 'ms');

  // ---- title screen ----
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${label}-1-title.png`) });

  const art = await page.evaluate(() => {
    const A = window.PCA.ART;
    const count = (o) => Object.keys(o).length;
    return {
      heroFrames: A.hero.down.length, monsters: count(A.mon), tiles: count(A.tiles),
      props: count(A.props), boons: count(A.boons), weapons: A.weapons.sword.length,
      titleW: A.title.width,
      // sample the hero sprite to prove it isn't blank
      heroNonEmpty: (() => {
        const c = A.hero.down[0], g = c.getContext('2d');
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++;
        return n;
      })()
    };
  });
  check(`[${label}] art generated`, art.monsters === 11 && art.heroFrames === 4 && art.weapons === 5 && art.boons >= 18,
    JSON.stringify(art));
  check(`[${label}] hero sprite has pixels`, art.heroNonEmpty > 80, art.heroNonEmpty + ' opaque px');

  // ---- world ----
  const world = await page.evaluate(() => {
    const W = window.PCA.World;
    const counts = {};
    for (let i = 0; i < W.tile.length; i++) counts[W.tile[i]] = (counts[W.tile[i]] || 0) + 1;
    const kinds = {};
    for (const L of W.landmarks) kinds[L.kind] = (kinds[L.kind] || 0) + 1;
    return { distinctTiles: Object.keys(counts).length, landmarks: kinds, spawnWalkable: W.walkableTile(Math.floor(W.spawn.x / 16), Math.floor(W.spawn.y / 16)) };
  });
  check(`[${label}] world has varied biomes`, world.distinctTiles >= 7, world.distinctTiles + ' tile kinds');
  check(`[${label}] landmarks placed`, world.landmarks.shrine > 5 && world.landmarks.obelisk > 5 && world.landmarks.chest > 10,
    JSON.stringify(world.landmarks));
  check(`[${label}] spawn point is walkable`, world.spawnWalkable === true);

  // ---- start a run ----
  await page.click('#btnStart');
  await page.waitForTimeout(500);
  const mode = await page.evaluate(() => window.PCA.G.mode);
  check(`[${label}] run starts`, mode === 'play', 'mode=' + mode);

  // ---- movement ----
  const before = await page.evaluate(() => ({ x: window.PCA.G.P.x, y: window.PCA.G.P.y }));
  if (isMobile) {
    const box = await page.locator('#stick').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    // drag the stick
    await page.evaluate(() => { window.PCA.G._t = 1; });
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.dispatchEvent('#stick', 'touchstart', { touches: [{ identifier: 1, clientX: cx, clientY: cy }], changedTouches: [{ identifier: 1, clientX: cx, clientY: cy }] });
    await page.dispatchEvent('#stick', 'touchmove', { touches: [{ identifier: 1, clientX: cx + 50, clientY: cy }], changedTouches: [{ identifier: 1, clientX: cx + 50, clientY: cy }] });
    await page.waitForTimeout(700);
    await page.dispatchEvent('#stick', 'touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: cx + 50, clientY: cy }] });
  } else {
    await page.keyboard.down('d'); await page.waitForTimeout(500); await page.keyboard.up('d');
    await page.keyboard.down('s'); await page.waitForTimeout(300); await page.keyboard.up('s');
  }
  const after = await page.evaluate(() => ({ x: window.PCA.G.P.x, y: window.PCA.G.P.y }));
  const moved = Math.hypot(after.x - before.x, after.y - before.y);
  check(`[${label}] player moves`, moved > 8, moved.toFixed(1) + 'px');

  // ---- monsters populate ----
  await page.waitForTimeout(2500);
  const monCount = await page.evaluate(() => window.PCA.G.mons.length);
  check(`[${label}] monsters populate the world`, monCount >= 8, monCount + ' alive');

  // ---- combat: each weapon actually hurts things, driven by real input ----
  for (const w of ['sword', 'spear', 'wand']) {
    const dealt = await page.evaluate(async (weapon) => {
      const { G } = window.PCA;
      G.mons.length = 0;
      G.P.weapon = weapon; G.P.atk = null; G.P.atkCd = 0; G.P.sp = G.P.maxSp;
      const m = window.PCA.spawnMonster('gelmite', G.P.x + 20, G.P.y, false);
      m.hp = m.maxHp = 1e6; m.def = Object.assign({}, m.def, { speed: 0, passive: true });
      window.__dummy = m;
      // keep stamina topped up so the test measures reach, not resource drain
      window.__sp = setInterval(() => { G.P.sp = G.P.maxSp; }, 16);
      return m.hp;
    }, w);
    // hold the attack key/button for ~900ms
    if (isMobile) {
      await page.dispatchEvent('#bAtk', 'touchstart', { touches: [{ identifier: 5, clientX: 5, clientY: 5 }], changedTouches: [{ identifier: 5, clientX: 5, clientY: 5 }] });
      await page.waitForTimeout(900);
      await page.dispatchEvent('#bAtk', 'touchend', { touches: [], changedTouches: [{ identifier: 5, clientX: 5, clientY: 5 }] });
    } else {
      await page.keyboard.down(' '); await page.waitForTimeout(900); await page.keyboard.up(' ');
    }
    await page.waitForTimeout(250);
    const res = await page.evaluate(() => {
      clearInterval(window.__sp);
      const m = window.__dummy;
      const out = { dealt: m.maxHp - m.hp };
      m.dead = true;
      return out;
    });
    check(`[${label}] ${w} deals damage on real input`, res.dealt > 0, res.dealt + ' dmg over ~0.9s');
  }

  // combat via direct API (deterministic) as well
  const dmgApi = await page.evaluate(() => {
    const { G, spawnMonster, damageMonster } = window.PCA;
    const m = spawnMonster('rattleknight', G.P.x + 30, G.P.y, false);
    m.hp = m.maxHp = 5000;
    const b = m.hp;
    damageMonster(m, 50, { knock: 60 });
    const dealt = b - m.hp;
    const angered = spawnMonster('gelmite', G.P.x + 40, G.P.y, false);
    const wasPassive = angered.state;
    damageMonster(angered, 1, {});
    const nowState = angered.state;
    m.dead = true; angered.dead = true;
    return { dealt, wasPassive, nowState, angry: angered.angry };
  });
  check(`[${label}] damage applies`, dmgApi.dealt >= 50, dmgApi.dealt + ' dmg');
  check(`[${label}] passive monster retaliates when struck`, dmgApi.angry === true && dmgApi.nowState === 'chase',
    dmgApi.wasPassive + ' -> ' + dmgApi.nowState);

  // ---- aggressive AI actually engages ----
  const aggro = await page.evaluate(async () => {
    const { G, spawnMonster } = window.PCA;
    const m = spawnMonster('grimhound', G.P.x + 120, G.P.y, false);
    const d0 = Math.hypot(m.x - G.P.x, m.y - G.P.y);
    await new Promise(r => setTimeout(r, 1200));
    const d1 = Math.hypot(m.x - G.P.x, m.y - G.P.y);
    const st = m.state;
    m.dead = true;
    return { d0, d1, st };
  });
  check(`[${label}] aggressive monster closes distance`, aggro.d1 < aggro.d0 - 10,
    aggro.d0.toFixed(0) + ' -> ' + aggro.d1.toFixed(0) + ' (' + aggro.st + ')');

  // ---- regression: sustained attacking must never lock stamina out ----
  const stam = await page.evaluate(async () => {
    const { G } = window.PCA;
    G.P.weapon = 'sword'; G.P.sp = G.P.maxSp;
    const kd = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    const ku = k => window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
    let attacks = 0, lastAtk = null;
    const w = setInterval(() => { if (G.P.atk && G.P.atk !== lastAtk) { attacks++; lastAtk = G.P.atk; } if (!G.P.atk) lastAtk = null; }, 8);
    kd(' ');                                     // hold attack down, hard, for 4s
    await new Promise(r => setTimeout(r, 4000));
    const attacksHeld = attacks, spLow = G.P.sp;
    ku(' ');
    await new Promise(r => setTimeout(r, 2500));  // let go and breathe
    const spAfter = G.P.sp;
    const before = attacks;
    kd(' ');
    await new Promise(r => setTimeout(r, 700));
    ku(' ');
    clearInterval(w);
    return { attacksHeld, spLow: Math.round(spLow), spAfter: Math.round(spAfter), maxSp: G.P.maxSp, attacksAfterRest: attacks - before };
  });
  check(`[${label}] holding attack keeps producing swings`, stam.attacksHeld >= 6, stam.attacksHeld + ' swings in 4s');
  check(`[${label}] stamina recovers after releasing attack`, stam.spAfter > stam.spLow + 10,
    stam.spLow + ' -> ' + stam.spAfter + ' / ' + stam.maxSp);
  check(`[${label}] can attack again after resting`, stam.attacksAfterRest >= 1, stam.attacksAfterRest + ' swings');

  // ---- aggressive monsters come to a stationary player ----
  // Seeded deliberately so the check does not depend on which species the
  // random spawn table happens to roll nearby, while still exercising the
  // real prowl -> chase -> windup -> strike path and the spawner alongside it.
  const engage = await page.evaluate(async () => {
    const { G, spawnMonster, findSpawnPoint } = window.PCA;
    G.P.weapon = 'sword'; G.P.hp = G.P.maxHp;
    const kills0 = G.stats.kills;
    const seeded = [];
    for (const type of ['grimhound', 'nightwing', 'rattleknight']) {
      const a = Math.random() * Math.PI * 2;
      const m = spawnMonster(type, G.P.x + Math.cos(a) * 150, G.P.y + Math.sin(a) * 150, false);
      seeded.push(m);
    }
    let sawProwl = 0, sawChase = 0, sawAttack = 0;
    const kd = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    const ku = k => window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
    const bot = setInterval(() => {
      if (G.mode === 'levelup') { const c = document.querySelector('#cards .card'); if (c) c.click(); return; }
      let near = 1e9;
      for (const m of G.mons) {
        if (m.dead) continue;
        near = Math.min(near, Math.hypot(m.x - G.P.x, m.y - G.P.y));
        if (m.state === 'prowl') sawProwl++;
        if (m.state === 'chase') sawChase++;
        if (m.state === 'windup' || m.state === 'strike') sawAttack++;
      }
      if (near < 34) { kd(' '); setTimeout(() => ku(' '), 40); }
      G.P.hp = G.P.maxHp;      // measure engagement, not survival
    }, 50);
    await new Promise(r => setTimeout(r, 22000));
    clearInterval(bot); ku(' ');
    return {
      kills: G.stats.kills - kills0, sawProwl, sawChase, sawAttack,
      seededDead: seeded.filter(m => m.dead).length
    };
  });
  check(`[${label}] hostiles prowl in and lock on to a stationary player`,
    engage.sawProwl > 0 && engage.sawChase > 0, JSON.stringify(engage));
  check(`[${label}] hostiles reach the player and are fought off`,
    engage.kills >= 2 && engage.seededDead >= 1, JSON.stringify(engage));

  // ---- killing a monster grants XP, drops loot and records the codex ----
  const killed = await page.evaluate(async () => {
    const { G, spawnMonster, damageMonster } = window.PCA;
    G.drops.length = 0;
    const xp0 = G.P.totalXp, kills0 = G.stats.kills;
    const m = spawnMonster('sporling', G.P.x + 26, G.P.y, false);
    m.hp = 1;
    damageMonster(m, 9999, {});
    await new Promise(r => setTimeout(r, 60));
    const drops = G.drops.length;
    // let the magnet pull them in
    G.P.magnetR = 400;
    await new Promise(r => setTimeout(r, 900));
    return {
      kills: G.stats.kills - kills0,
      dropsSpawned: drops,
      dropsLeft: G.drops.length,
      xpGained: G.P.totalXp - xp0,
      codex: !!G.codex.sporling,
      combo: G.stats.bestCombo
    };
  });
  check(`[${label}] kills grant XP and loot`, killed.kills === 1 && killed.dropsSpawned > 0 && killed.xpGained > 0,
    JSON.stringify(killed));
  check(`[${label}] XP motes are collected`, killed.dropsLeft < killed.dropsSpawned, killed.dropsSpawned + ' -> ' + killed.dropsLeft);
  check(`[${label}] codex records the beast`, killed.codex === true);

  // ---- XP / level up ----
  await page.evaluate(() => window.PCA.gainXp(400));
  await page.waitForTimeout(400);
  const luVisible = await page.locator('#levelup').evaluate(el => el.classList.contains('on'));
  const cardCount = await page.locator('#cards .card').count();
  check(`[${label}] level-up presents choices`, luVisible && cardCount === 3, cardCount + ' cards');
  await page.screenshot({ path: path.join(OUT, `${label}-2-levelup.png`) });

  // take every pending level
  for (let i = 0; i < 40; i++) {
    const on = await page.locator('#levelup').evaluate(el => el.classList.contains('on'));
    if (!on) break;
    await page.locator('#cards .card').first().click();
    await page.waitForTimeout(120);
  }
  const lvl = await page.evaluate(() => ({ level: window.PCA.G.P.level, boons: window.PCA.G.P.boons.length, mode: window.PCA.G.mode }));
  check(`[${label}] boons applied and play resumes`, lvl.boons > 0 && lvl.mode === 'play', JSON.stringify(lvl));

  // ---- weapon upgrade path ----
  const upg = await page.evaluate(() => {
    const { G } = window.PCA;
    const t0 = G.P.tiers.spear;
    // walk onto an obelisk
    const ob = window.PCA.World.landmarks.find(l => l.kind === 'obelisk' && !l.used);
    G.P.x = ob.x; G.P.y = ob.y;
    return { t0, obeliskFound: !!ob };
  });
  await page.waitForTimeout(400);
  const upgAfter = await page.evaluate(() => ({ tiers: window.PCA.G.P.tiers, obelisks: window.PCA.G.stats.obelisks }));
  const tierSum = upgAfter.tiers.sword + upgAfter.tiers.spear + upgAfter.tiers.wand;
  check(`[${label}] obelisk tempers a weapon`, upgAfter.obelisks >= 1 && tierSum > 3, JSON.stringify(upgAfter));

  // ---- shrine heals ----
  const shrine = await page.evaluate(async () => {
    const { G, World } = window.PCA;
    G.P.hp = 5;
    const s = World.landmarks.find(l => l.kind === 'shrine' && !l.used);
    G.P.x = s.x; G.P.y = s.y;
    await new Promise(r => setTimeout(r, 350));
    return { hp: G.P.hp, shrines: G.stats.shrines };
  });
  check(`[${label}] shrine restores health`, shrine.hp > 5 && shrine.shrines >= 1, JSON.stringify(shrine));

  // ---- character sheet ----
  await page.evaluate(() => window.PCA.openSheet());
  await page.waitForTimeout(350);
  const sheet = await page.evaluate(() => ({
    stats: document.querySelectorAll('#sheetStats .stat').length,
    weapons: document.querySelectorAll('#sheetWeapons .wrow').length,
    codex: document.querySelectorAll('#sheetCodex .codexcell').length,
    unlocked: document.querySelectorAll('#sheetCodex .codexcell:not(.locked)').length,
    title: document.getElementById('buildTitle').textContent
  }));
  check(`[${label}] character sheet renders`, sheet.stats >= 12 && sheet.weapons === 3 && sheet.codex === 11,
    JSON.stringify(sheet));
  await page.screenshot({ path: path.join(OUT, `${label}-3-sheet.png`) });
  await page.click('#btnSheetBack');
  await page.waitForTimeout(200);

  // ---- gameplay screenshot with action ----
  await page.evaluate(async () => {
    const { G, spawnMonster } = window.PCA;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      spawnMonster(['gelmite', 'nightwing', 'rattleknight', 'grimhound', 'emberwisp', 'sporling', 'thornmaw'][i],
        G.P.x + Math.cos(a) * 48, G.P.y + Math.sin(a) * 40, i === 3);
    }
    G.P.weapon = 'sword'; G.P.atkCd = 0;
  });
  await page.waitForTimeout(150);
  if (!isMobile) { await page.keyboard.down(' '); await page.waitForTimeout(260); await page.keyboard.up(' '); }
  else { await page.dispatchEvent('#bAtk', 'touchstart', { touches: [{ identifier: 2, clientX: 10, clientY: 10 }], changedTouches: [{ identifier: 2, clientX: 10, clientY: 10 }] }); await page.waitForTimeout(300); await page.dispatchEvent('#bAtk', 'touchend', { touches: [], changedTouches: [{ identifier: 2, clientX: 10, clientY: 10 }] }); }
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, `${label}-4-play.png`) });

  // ---- perf ----
  const fps = await page.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); };
    requestAnimationFrame(tick);
  }));
  check(`[${label}] frame rate healthy`, fps > 40, fps.toFixed(1) + ' fps');

  // ---- death & run end ----
  await page.evaluate(() => {
    const { G } = window.PCA;
    G.mons.length = 0;                 // stop incidental hits granting i-frames
    G.P.iframes = 0; G.P.ward = 0; G.P.wardMax = 0; G.P.dashing = 0; G.P.armor = 0;
    G.P.hp = 1;
    window.PCA.damagePlayer(9999, G.P.x + 10, G.P.y, null);
  });
  await page.waitForTimeout(1600);
  const dead = await page.evaluate(() => ({
    mode: window.PCA.G.mode,
    lvl: document.getElementById('goLvl').textContent,
    xp: document.getElementById('goXp').textContent,
    visible: document.getElementById('gameover').classList.contains('on')
  }));
  const realStats = await page.evaluate(() => ({ level: window.PCA.G.P.level, xp: Math.round(window.PCA.G.P.totalXp) }));
  check(`[${label}] run ends and reports level + XP`,
    dead.visible && dead.mode === 'dead' && dead.lvl === String(realStats.level) && dead.xp !== '0',
    JSON.stringify(dead) + ' vs ' + JSON.stringify(realStats));
  await page.screenshot({ path: path.join(OUT, `${label}-5-gameover.png`) });

  // ---- leaderboard publish (local path, no endpoint) ----
  await page.fill('#goName', 'TestHero');
  await page.click('#btnPublish');
  await page.waitForTimeout(600);
  const pub = await page.evaluate(() => ({
    status: document.getElementById('pubStatus').textContent,
    local: window.PCA.Board.local.length,
    top: window.PCA.Board.local[0],
    code: window.PCA.Board.runCode(window.PCA.Board.local[0])
  }));
  check(`[${label}] publishes level + total XP locally`,
    pub.local >= 1 && pub.top && typeof pub.top.level === 'number' && typeof pub.top.xp === 'number' && pub.code.startsWith('PCA1.'),
    JSON.stringify({ level: pub.top && pub.top.level, xp: pub.top && pub.top.xp, code: pub.code.slice(0, 26) + '…' }));

  await page.click('#btnGoBoard');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${label}-6-board.png`) });
  await page.evaluate(() => window.PCA.setMode('board'));
  await page.click('.tab[data-tab="local"]');
  await page.waitForTimeout(200);
  const localRows = await page.locator('#localList .lbrow').count();
  check(`[${label}] leaderboard lists the run`, localRows >= 1, localRows + ' rows');
  await page.screenshot({ path: path.join(OUT, `${label}-7-board-local.png`) });

  // ---- setup tab shows the endpoint contract ----
  await page.click('.tab[data-tab="setup"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${label}-8-board-setup.png`) });

  check(`[${label}] no runtime errors during the whole session`, errors.length === 0, errors.slice(0, 4).join(' | '));
  await ctx.close();
  return errors;
}

await session('desktop', { width: 1280, height: 800 }, false);
await session('mobile', { width: 390, height: 844 }, true);

await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' checks passed ====');
if (failed.length) { console.log('FAILURES:'); failed.forEach(f => console.log(' - ' + f.name + ': ' + f.detail)); process.exit(1); }
