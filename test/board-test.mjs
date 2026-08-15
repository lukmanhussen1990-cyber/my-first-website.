/* Stands up a reference leaderboard endpoint that implements the contract the
   game prints in its Setup tab, then drives a real run through publish + fetch. */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import http from 'http';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE_URL = 'file://' + path.join(ROOT, 'index.html');
const OUT_DIR = process.env.SHOTS || path.join(ROOT, '.shots');
fs.mkdirSync(OUT_DIR, { recursive: true });
const LAUNCH = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};


const boards = new Map();
const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let e; try { e = JSON.parse(body); } catch { res.writeHead(400); return res.end('bad json'); }
      const key = e.board || 'default';
      if (!boards.has(key)) boards.set(key, []);
      boards.get(key).push(e);
      console.log('  endpoint <- POST', JSON.stringify({ name: e.name, level: e.level, xp: e.xp, build: e.build }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  const key = url.searchParams.get('board') || 'default';
  const limit = parseInt(url.searchParams.get('limit') || '25', 10);
  const list = (boards.get(key) || []).slice().sort((a, b) => b.xp - a.xp).slice(0, limit);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ scores: list }));
});
await new Promise(r => server.listen(8731, '127.0.0.1', r));
const EP = 'http://127.0.0.1:8731/scores';
console.log('reference endpoint listening on ' + EP);

// seed a couple of rival runs so the board isn't a board of one
for (const rival of [
  { board: 'test-board', name: 'Selka', level: 21, xp: 9120, build: 'Veteran Stormcaller', time: 640 },
  { board: 'test-board', name: 'Orrin', level: 12, xp: 3480, build: 'Journeyman Spearmaster', time: 300 }
]) {
  await fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rival) });
}

const results = [];
const check = (n, ok, d) => { results.push({ n, ok, d }); console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (d ? '  — ' + d : '')); };

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(FILE_URL);
await page.waitForFunction(() => window.PCA !== undefined);

// configure the endpoint through the actual UI, as a player would
await page.click('#btnBoard');
await page.click('.tab[data-tab="setup"]');
await page.fill('#epUrl', EP);
await page.fill('#epRoom', 'test-board');
await page.click('#btnSaveEp');
await page.click('#btnTestEp');
await page.waitForTimeout(700);
const epStatus = await page.textContent('#epStatus');
check('endpoint test button reports a reachable board', /Shared board/.test(epStatus), epStatus.trim());

await page.click('.tab[data-tab="global"]');
await page.waitForTimeout(300);
const seeded = await page.locator('#globalList .lbrow').count();
check('shared board lists existing runs', seeded === 2, seeded + ' rows');
await page.screenshot({ path: path.join(OUT_DIR, 'board-shared.png') });

// play a run, level up a few times, then die
await page.click('#btnBoardBack');
await page.click('#btnStart');
await page.waitForTimeout(400);
await page.evaluate(() => window.PCA.gainXp(2200));
await page.waitForTimeout(300);
for (let i = 0; i < 40; i++) {
  const on = await page.locator('#levelup').evaluate(el => el.classList.contains('on'));
  if (!on) break;
  await page.locator('#cards .card').first().click();
  await page.waitForTimeout(90);
}
const runState = await page.evaluate(() => {
  const { G } = window.PCA;
  G.mons.length = 0; G.P.iframes = 0; G.P.ward = 0; G.P.wardMax = 0; G.P.armor = 0; G.P.hp = 1;
  window.PCA.damagePlayer(9999, G.P.x + 8, G.P.y, null);
  return { level: G.P.level, xp: Math.round(G.P.totalXp) };
});
await page.waitForTimeout(1500);

await page.fill('#goName', 'Aurel');
await page.click('#btnPublish');
await page.waitForTimeout(900);
const pubStatus = await page.textContent('#pubStatus');
check('publish reports success against the endpoint', /Published to the shared board/.test(pubStatus), pubStatus.trim());

// verify the server actually received the level + total XP for this run
const stored = boards.get('test-board').find(e => e.name === 'Aurel');
check('endpoint received this run\'s level and total XP',
  !!stored && stored.level === runState.level && stored.xp === runState.xp,
  JSON.stringify({ sent: stored && { level: stored.level, xp: stored.xp }, run: runState }));
check('endpoint received the build and seed too',
  !!stored && typeof stored.build === 'string' && stored.build.length > 0 && Number.isFinite(stored.seed),
  stored ? stored.build + ' / seed ' + stored.seed : 'missing');

await page.click('#btnGoBoard');
await page.waitForTimeout(800);
const rows = await page.locator('#globalList .lbrow').count();
const mine = await page.locator('#globalList .lbrow.me').count();
check('published run appears on the shared board', rows === 3, rows + ' rows');
check('own run is highlighted on the board', mine >= 1, mine + ' highlighted');
await page.screenshot({ path: path.join(OUT_DIR, 'board-published.png') });

// a dead endpoint must degrade gracefully, never break the game
await page.evaluate(() => { window.PCA.Board.cfg.url = 'http://127.0.0.1:8732/nope'; window.PCA.Board.saveCfg(); });
await page.click('#btnRefresh');
await page.waitForTimeout(1200);
const failStatus = await page.textContent('#globalStatus');
check('unreachable endpoint degrades gracefully', /Could not read/.test(failStatus), failStatus.trim());
const gameErrors = errors.filter(e => !/Failed to load resource/.test(e));
check('no runtime errors across the leaderboard flow', gameErrors.length === 0, gameErrors.slice(0, 3).join(' | '));

await browser.close();
server.close();
const failed = results.filter(r => !r.ok);
console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' leaderboard checks passed ====');
if (failed.length) process.exit(1);
