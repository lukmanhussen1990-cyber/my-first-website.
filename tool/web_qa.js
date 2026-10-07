// Visual QA for the Flutter web build of the game (same Dart code as the APK).
//
// Usage: node tool/web_qa.js <baseUrl> <outDir> [width height]
// Drives headless Chromium through splash screens, drag & drop, line
// clears, combos, game over and the settings popup, saving screenshots.
const path = require('path');
const fs = require('fs');

function requirePlaywright() {
  try {
    return require('playwright');
  } catch (_) {
    return require('/opt/node22/lib/node_modules/playwright');
  }
}

const { chromium } = requirePlaywright();

const base = process.argv[2] || 'http://localhost:8090/';
const out = process.argv[3] || 'qa';
const W = parseInt(process.argv[4] || '400', 10);
const H = parseInt(process.argv[5] || '866', 10);
fs.mkdirSync(out, { recursive: true });

// Mirror of GameLayout.compute (lib/src/game/layout.dart).
function layout(w, h) {
  const u = Math.min(w / 100, h / 182);
  const cx = w / 2;
  const boardSide = 90 * u;
  const boardTop = Math.max(44 * u, (h - 182 * u) * 0.1 + 44 * u);
  const boardLeft = cx - boardSide / 2;
  const gridLeft = boardLeft + u;
  const gridTop = boardTop + u;
  const cell = (boardSide - 2 * u) / 8;
  const trayY = boardTop + boardSide + 25 * u;
  const slotW = boardSide / 3;
  const slots = [0, 1, 2].map((i) => [boardLeft + slotW * (i + 0.5), trayY]);
  const gear = [cx + 40.5 * u, 12.5 * u];
  const hint = [cx + 27.5 * u, 12.5 * u];
  return { u, cell, gridLeft, gridTop, slots, gear, hint };
}

const L = layout(W, H);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file });
  console.log('saved', file);
}

// Drags the piece in [slot] (rows x cols) so its top-left lands on (row, col).
async function drag(page, slot, rows, cols, row, col, { holdShot, release = true } = {}) {
  const [sx, sy] = L.slots[slot];
  const cx = L.gridLeft + (col + cols / 2) * L.cell;
  const cy = L.gridTop + (row + rows / 2) * L.cell;
  const px = cx;
  const py = cy + (rows * L.cell) / 2 + 1.15 * L.cell;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await sleep(60);
  await page.mouse.move(px, py, { steps: 18 });
  await sleep(250);
  if (holdShot) await shot(page, holdShot);
  if (release) await page.mouse.up();
}

// Flutter renders to canvas, so locate buttons via the semantics tree.
async function findText(page, text) {
  await page.evaluate(() => {
    const b = document.querySelector('flt-semantics-placeholder');
    if (b) b.click();
  });
  await sleep(300);
  const box = await page.evaluate((t) => {
    // Exact label first, then prefix; the smallest node wins (containers
    // concatenate their children's text).
    const nodes = Array.from(document.querySelectorAll('flt-semantics, [role]'));
    let best = null;
    for (const n of nodes) {
      const label = (n.getAttribute('aria-label') || n.textContent || '').trim();
      const rank = label === t ? 0 : label.startsWith(t) ? 1 : -1;
      if (rank < 0) continue;
      const r = n.getBoundingClientRect();
      if (r.width <= 0) continue;
      const area = r.width * r.height;
      if (!best || rank < best.rank || (rank === best.rank && area < best.area)) {
        best = { rank, area, at: [r.x + r.width / 2, r.y + r.height / 2] };
      }
    }
    return best ? best.at : null;
  }, text);
  if (!box) throw new Error('text not found: ' + text);
  return box;
}

async function openPage(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: false });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (!t.includes('Download the') && !t.includes('DevTools')) console.log('  [console]', t.slice(0, 200));
  });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.goto(base + query, { waitUntil: 'load' });
  await page.waitForSelector('flutter-view, flt-glass-pane', { timeout: 30000 });
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const want = (k) => !only || only.includes(k);

  if (want('splash')) {
    const { ctx, page } = await openPage(browser, '');
    await sleep(900);
    await shot(page, '01_splash_icon');
    await sleep(1900);
    await shot(page, '02_splash_studio');
    await sleep(1900);
    await shot(page, '03_splash_logo');
    await sleep(3500);
    await shot(page, '04_game_new');
    await ctx.close();
  }

  if (want('demo')) {
    const { ctx, page } = await openPage(browser, '?game&scenario=demo');
    await sleep(1500);
    await shot(page, '05_game_demo');
    await drag(page, 2, 1, 2, 5, 5, { holdShot: '06_drag_ghost' });
    await sleep(500);
    await shot(page, '07_after_drop');
    // Invalid drop: try to put the L piece on occupied cells.
    await drag(page, 0, 2, 3, 0, 0, { holdShot: '08_drag_invalid' });
    await sleep(80);
    await shot(page, '09_returning');
    await sleep(400);
    await page.mouse.click(L.gear[0], L.gear[1]);
    await sleep(700);
    await shot(page, '10_settings');
    await ctx.close();
  }

  if (want('clear')) {
    const { ctx, page } = await openPage(browser, '?game&scenario=clear');
    await sleep(1500);
    await drag(page, 0, 2, 1, 6, 7, { holdShot: '11_clear_hover' });
    await sleep(70);
    await shot(page, '12_clear_flash');
    await sleep(200);
    await shot(page, '13_clear_burst');
    await sleep(350);
    await shot(page, '14_clear_texts');
    await ctx.close();
  }

  if (want('combo')) {
    const { ctx, page } = await openPage(browser, '?game&scenario=combo');
    await sleep(1500);
    await drag(page, 0, 1, 1, 5, 7);
    await sleep(700);
    await drag(page, 1, 1, 1, 6, 7);
    await sleep(380);
    await shot(page, '15_combo2');
    await sleep(900);
    await drag(page, 2, 1, 1, 7, 7);
    await sleep(380);
    await shot(page, '16_combo3');
    await sleep(1200);
    await shot(page, '17_after_combo_refill');
    await ctx.close();
  }

  if (want('over')) {
    const { ctx, page } = await openPage(browser, '?game&scenario=over');
    await sleep(1500);
    await shot(page, '18_over_before');
    await drag(page, 0, 1, 1, 0, 1);
    await sleep(1300);
    await shot(page, '19_over_gray');
    await sleep(4000);
    await shot(page, '20_over_popup');
    // Home button -> home screen -> how to play.
    const btn = await findText(page, 'Home');
    await page.mouse.click(btn[0], btn[1]);
    await sleep(1200);
    await shot(page, '21_home');
    const how = await findText(page, 'How to Play');
    await page.mouse.click(how[0], how[1]);
    await sleep(900);
    await shot(page, '22_howto');
    await ctx.close();
  }

  // --- 1.1: home, Premium, hints, skins, revive -----------------------------

  const tag = `${W}x${H}`;

  if (want('home')) {
    const { ctx, page } = await openPage(browser, '?screen=home');
    await sleep(400);
    await shot(page, `h00_home_intro_${tag}`);
    await sleep(1800);
    await shot(page, `h01_home_${tag}`);
    const about = await findText(page, 'About');
    await page.mouse.click(about[0], about[1]);
    await sleep(800);
    await shot(page, `h02_about_${tag}`);
    const close = await findText(page, 'Close');
    await page.mouse.click(close[0], close[1]);
    await sleep(500);
    const skins = await findText(page, 'Block Skins');
    await page.mouse.click(skins[0], skins[1]);
    await sleep(800);
    await shot(page, `h03_skins_${tag}`);
    await page.keyboard.press('Escape');
    await ctx.close();
    const second = await openPage(browser, '?screen=home');
    await sleep(2200);
    const prem = await findText(second.page, 'Premium');
    await second.page.mouse.click(prem[0], prem[1]);
    await sleep(250);
    await shot(second.page, `h04_premium_opening_${tag}`);
    await sleep(900);
    await shot(second.page, `h05_premium_from_home_${tag}`);
    await second.ctx.close();
  }

  if (want('premium')) {
    const { ctx, page } = await openPage(browser, '?screen=premium');
    await sleep(1600);
    await shot(page, `p01_premium_${tag}`);
    const monthly = await findText(page, 'Monthly plan');
    await page.mouse.click(monthly[0], monthly[1]);
    await sleep(500);
    await shot(page, `p02_monthly_selected_${tag}`);
    await page.mouse.move(W / 2, H * 0.45);
    await page.mouse.wheel(0, 2000);
    await sleep(700);
    await shot(page, `p03_premium_bottom_${tag}`);
    const start = await findText(page, 'Start Premium');
    await page.mouse.click(start[0], start[1]);
    await sleep(600);
    await shot(page, `p04_store_unavailable_${tag}`);
    await ctx.close();
  }

  if (want('premiumActive')) {
    const { ctx, page } = await openPage(browser, '?screen=premium&premium=1');
    await sleep(1600);
    await shot(page, `p05_premium_active_${tag}`);
    await ctx.close();
  }

  if (want('hint')) {
    const { ctx, page } = await openPage(browser, '?game&scenario=demo');
    await sleep(1500);
    await shot(page, `g01_hint_button_${tag}`);
    await page.mouse.click(L.hint[0], L.hint[1]);
    await sleep(500);
    await shot(page, `g02_hint_shown_${tag}`);
    await ctx.close();
  }

  if (want('upsell')) {
    const { ctx, page } = await openPage(browser, '?game&scenario=demo');
    await sleep(1500);
    await page.mouse.click(L.hint[0], L.hint[1]);
    await sleep(400);
    await drag(page, 2, 1, 2, 5, 5);
    await sleep(800);
    await page.mouse.click(L.hint[0], L.hint[1]);
    await sleep(800);
    await shot(page, `g03_hint_upsell_${tag}`);
    await ctx.close();
  }

  if (want('skins')) {
    for (const skin of ['candy', 'neon', 'gem']) {
      const { ctx, page } = await openPage(browser, `?game&scenario=demo&premium=1&skin=${skin}`);
      await sleep(1500);
      await drag(page, 2, 1, 2, 5, 5, { holdShot: `s_${skin}_drag_${tag}` });
      await sleep(600);
      await shot(page, `s_${skin}_${tag}`);
      await ctx.close();
    }
  }

  if (want('revive')) {
    const { ctx, page } = await openPage(browser, '?game&scenario=over&premium=1');
    await sleep(1500);
    await drag(page, 0, 1, 1, 0, 1);
    await sleep(1400);
    await shot(page, `r01_revive_offer_${tag}`);
    const revive = await findText(page, 'Revive');
    await page.mouse.click(revive[0], revive[1]);
    await sleep(160);
    await shot(page, `r02_reviving_${tag}`);
    await sleep(1200);
    await shot(page, `r03_revived_${tag}`);
    await ctx.close();
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
