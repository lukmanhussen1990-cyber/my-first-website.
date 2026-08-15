/* Long automated session: random input, forced level-ups, long-distance travel.
   Watches for leaks, growing entity pools, and frame-rate decay. */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE_URL = 'file://' + path.join(ROOT, 'index.html');
const OUT_DIR = process.env.SHOTS || path.join(ROOT, '.shots');
fs.mkdirSync(OUT_DIR, { recursive: true });
const LAUNCH = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};


const results = [];
const check = (n, ok, d) => { results.push({ n, ok, d }); console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (d ? '  — ' + d : '')); };

const browser = await chromium.launch(Object.assign({ args: ['--js-flags=--expose-gc'] }, LAUNCH));
const ctx = await browser.newContext({ viewport: { width: 1024, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(FILE_URL);
await page.waitForFunction(() => window.PCA !== undefined);
await page.click('#btnStart');
await page.waitForTimeout(400);

// drive the game with a bot for ~75 seconds of wall clock
await page.evaluate(() => {
  const { G } = window.PCA;
  window.__samples = [];
  window.__bot = true;
  let dirT = 0, dir = { x: 1, y: 0 };
  let frames = 0, last = performance.now(), fpsAcc = [];

  const keydown = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  const keyup = (k) => window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));

  window.__botLoop = setInterval(() => {
    if (!window.__bot) return;
    // hunt: steer toward the nearest monster, like a player would
    let best = null, bd = 1e9;
    for (const m of G.mons) {
      if (m.dead) continue;
      const d = (m.x - G.P.x) ** 2 + (m.y - G.P.y) ** 2;
      if (d < bd) { bd = d; best = m; }
    }
    ['w', 'a', 's', 'd'].forEach(keyup);
    if (best && bd > 26 * 26) {
      const dx = best.x - G.P.x, dy = best.y - G.P.y;
      if (dx > 6) keydown('d'); else if (dx < -6) keydown('a');
      if (dy > 6) keydown('s'); else if (dy < -6) keydown('w');
    } else if (--dirT <= 0) {
      dirT = 8 + Math.floor(Math.random() * 22);
      [['w'], ['s'], ['a'], ['d']][Math.floor(Math.random() * 4)].forEach(keydown);
    }
    // attack constantly, swap weapons, dash sometimes
    keydown(' '); setTimeout(() => keyup(' '), 40);
    if (Math.random() < 0.05) { const k = ['1', '2', '3'][Math.floor(Math.random() * 3)]; keydown(k); setTimeout(() => keyup(k), 30); }
    if (Math.random() < 0.08) { keydown('k'); setTimeout(() => keyup('k'), 30); }
    // stay alive so the soak keeps running, and keep levelling
    G.P.hp = G.P.maxHp;
    if (Math.random() < 0.02) window.PCA.gainXp(120);
  }, 50);

  // auto-pick level-up cards so the bot never blocks
  window.__cardLoop = setInterval(() => {
    if (G.mode === 'levelup') {
      const c = document.querySelector('#cards .card');
      if (c) c.click();
    }
  }, 120);

  // sample every second
  window.__sampleLoop = setInterval(() => {
    window.__samples.push({
      t: Math.round(G.runT),
      mons: G.mons.length, fx: G.fx.length, nums: G.nums.length,
      drops: G.drops.length, bolts: G.bolts.length,
      chunks: window.PCA.World.chunks.size,
      level: G.P.level, kills: G.stats.kills,
      heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0
    });
  }, 1000);
});

await page.waitForTimeout(75000);

const mid = await page.evaluate(() => {
  // teleport far away to exercise worldgen + chunk cache at range
  const { G, World } = window.PCA;
  G.P.x = 40 * 16; G.P.y = 40 * 16;
  return { chunks: World.chunks.size };
});
await page.waitForTimeout(6000);
const far = await page.evaluate(() => {
  const { G, World } = window.PCA;
  G.P.x = 160 * 16; G.P.y = 160 * 16;
  return { chunks: World.chunks.size };
});
await page.waitForTimeout(6000);

const out = await page.evaluate(() => {
  window.__bot = false;
  clearInterval(window.__botLoop); clearInterval(window.__cardLoop); clearInterval(window.__sampleLoop);
  ['w', 'a', 's', 'd', ' '].forEach(k => window.dispatchEvent(new KeyboardEvent('keyup', { key: k })));
  return {
    samples: window.__samples,
    chunks: window.PCA.World.chunks.size,
    final: {
      level: window.PCA.G.P.level, kills: window.PCA.G.stats.kills,
      mons: window.PCA.G.mons.length, runT: Math.round(window.PCA.G.runT),
      codex: Object.keys(window.PCA.G.codex).length
    }
  };
});

const s = out.samples;
const first = s.slice(2, 8), last = s.slice(-8);
const avg = (a, k) => a.reduce((x, y) => x + y[k], 0) / a.length;

console.log('\nsamples (t, mons, fx, nums, drops, chunks, level, kills, heapMB):');
for (const x of s.filter((_, i) => i % 8 === 0)) console.log(' ', [x.t, x.mons, x.fx, x.nums, x.drops, x.chunks, x.level, x.kills, x.heap].join('\t'));
console.log('\nfinal:', JSON.stringify(out.final));

check('survives a 75s automated session with no errors', errors.length === 0, errors.slice(0, 4).join(' | '));
check('monsters keep populating throughout', avg(last, 'mons') >= 8, 'late avg ' + avg(last, 'mons').toFixed(1) + ' alive');
check('the bot actually fought', out.final.kills >= 5, out.final.kills + ' kills (bot has no pathfinding)');
check('progression advanced', out.final.level > 5, 'level ' + out.final.level);
check('codex records what was killed', out.final.codex >= 2, out.final.codex + ' species recorded');
check('particle pool stays bounded', Math.max(...s.map(x => x.fx)) <= 640, 'peak ' + Math.max(...s.map(x => x.fx)));
check('damage-number pool stays bounded', Math.max(...s.map(x => x.nums)) <= 95, 'peak ' + Math.max(...s.map(x => x.nums)));
check('drop pool stays bounded', Math.max(...s.map(x => x.drops)) < 400, 'peak ' + Math.max(...s.map(x => x.drops)));
check('chunk cache stays bounded after long travel', out.chunks <= 300, out.chunks + ' cached chunks');
if (s[0].heap) {
  const growth = avg(last, 'heap') - avg(first, 'heap');
  check('heap growth is modest over the session', growth < 120, '+' + growth.toFixed(0) + ' MB');
}

// still responsive at the end?
const fps = await page.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); };
  requestAnimationFrame(tick);
}));
check('frame rate still healthy after the soak', fps > 40, fps.toFixed(1) + ' fps');

await page.screenshot({ path: path.join(OUT_DIR, 'soak-end.png') });
await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' soak checks passed ====');
if (failed.length) process.exit(1);
