// out/cover.jpg — the hook question, large, over the ark-on-dry-land shot.
// node scripts/cover.cjs [t=2.9] [out=out/cover.jpg]
const path = require('path');
const { chromium } = require('playwright');
const { start, ROOT } = require('./server.cjs');
(async () => {
  const t = parseFloat(process.argv[2] || '2.9');
  const out = path.resolve(ROOT, process.argv[3] || 'out/cover.jpg');
  const { srv, port } = await start();
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(`http://127.0.0.1:${port}/index.html`);
  await p.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
  await p.evaluate((tt) => {
    window.renderAt(tt);
    const ov = document.getElementById('overlay');
    for (const e of ov.children) if (!e.classList.contains('topbar')) e.style.display = 'none';
    const band = document.createElement('div');
    Object.assign(band.style, { position: 'absolute', left: '0', top: '250px', width: '1080px', height: '760px',
      background: 'linear-gradient(180deg, rgba(18,10,4,0) 0%, rgba(18,10,4,0.55) 22%, rgba(18,10,4,0.6) 70%, rgba(18,10,4,0) 100%)' });
    ov.appendChild(band);
    const h = document.createElement('div');
    Object.assign(h.style, { position: 'absolute', left: '64px', top: '330px', width: '900px', font: "500 italic 92px/1.12 'Cormorant Garamond', serif",
      color: '#f6f1e2', textShadow: '0 4px 24px rgba(20,10,4,0.6)' });
    h.innerHTML = "If God was going to <span style=\"font:600 84px/1 'Cinzel',serif;color:#e5534b;font-style:normal;text-shadow:0 0 26px rgba(229,83,75,0.45),0 3px 14px rgba(20,8,4,0.6)\">FLOOD</span> the earth anyway… why make Noah build an <span style=\"font:600 84px/1 'Cinzel',serif;color:#e5534b;font-style:normal;text-shadow:0 0 26px rgba(229,83,75,0.45),0 3px 14px rgba(20,8,4,0.6)\">ARK</span> for years?";
    ov.appendChild(h);
    const s = document.createElement('div');
    Object.assign(s.style, { position: 'absolute', left: '64px', top: '1330px', font: "600 26px/1 'Work Sans', sans-serif", letterSpacing: '0.32em', color: 'rgba(251,233,194,0.92)', textShadow: '0 2px 10px rgba(0,0,0,0.5)' });
    s.textContent = 'HONEST QUESTIONS · THE ARK';
    ov.appendChild(s);
  }, t);
  await p.screenshot({ path: out, type: 'jpeg', quality: 93 });
  console.log('wrote', out);
  await b.close(); srv.close();
})();
