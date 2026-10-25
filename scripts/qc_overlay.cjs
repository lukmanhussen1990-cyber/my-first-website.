// QC: every 0.1 s, check that all visible overlay boxes (captions, pills, cards, poll, bubble, outro)
// sit inside the Instagram safe zone x 60–960, y 220–1500. Writes build/qc_overlay.json.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { start, ROOT } = require('./server.cjs');
(async () => {
  const { srv, port } = await start();
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(`http://127.0.0.1:${port}/index.html`);
  await p.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
  const res = await p.evaluate(() => {
    const TL = window.TL, O = window.__overlay; const bad = []; let checks = 0;
    const sel = ['.cap', '.pill', '.card', '.end .icon', '.bubble', '.outro .mark', '.outro .name', '.outro .handle', '.topbar'];
    for (let t = 0; t < TL.duration; t += 0.1) {
      const act = TL.activeAt(t); const dom = act.list.length === 2 && act.k > 0.5 ? act.list[1].shot : act.list[0].shot;
      O.update(t, TL.overlayState(t, dom));
      for (const s of sel) for (const e of document.querySelectorAll(s)) {
        if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') continue;
        const cs = getComputedStyle(e); if (cs.display === 'none' || +cs.opacity < 0.05) continue;
        let el = e, hidden = false; while (el && el.id !== 'overlay') { const c = getComputedStyle(el); if (c.display === 'none' || +c.opacity < 0.05) { hidden = true; break; } el = el.parentElement; }
        if (hidden) continue;
        const r = e.getBoundingClientRect(); if (r.width < 2) continue;
        checks++;
        // captions: measure the inked text, not the 900px block
        let x0 = r.left, x1 = r.right, y0 = r.top, y1 = r.bottom;
        if (s === '.cap') { const rs = [...e.querySelectorAll('.w')].map((w) => w.getBoundingClientRect()); x1 = Math.max(...rs.map((q) => q.right)); }
        const top = s === '.topbar' ? 215 : 220;
        if (x0 < 59 || x1 > 961 || y0 < top || y1 > 1501) bad.push({ t: +t.toFixed(1), el: s, box: [x0, y0, x1, y1].map((v) => Math.round(v)) });
      }
    }
    return { checks, bad };
  });
  fs.writeFileSync(path.join(ROOT, 'build', 'qc_overlay.json'), JSON.stringify(res, null, 1));
  console.log(`overlay safe-zone checks: ${res.checks}, violations: ${res.bad.length}`);
  const seen = new Set();
  for (const v of res.bad) { const k = v.el + v.box.join(','); if (seen.has(k)) continue; seen.add(k); console.log('  ', JSON.stringify(v)); if (seen.size > 25) break; }
  await b.close(); srv.close();
})();
