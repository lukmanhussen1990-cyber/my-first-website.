const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const out = process.argv[2], t = parseFloat(process.argv[3] || '1.37');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, 'cover.html'));
  await p.evaluate(async () => { await document.fonts.load('40px "Anton"'); await document.fonts.load('40px "Luckiest Guy"'); await document.fonts.ready; });
  const b64 = await p.evaluate(t => { renderCover(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  if (errs.length) console.error(errs.join('\n'));
  await b.close();
})();
