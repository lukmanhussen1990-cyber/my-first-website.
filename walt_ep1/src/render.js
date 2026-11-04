// Usage:
//   node render.js preview out_dir t1 t2 ...      -> PNG stills
//   node render.js sheet out.png cols t1 t2 ...   -> contact sheet (via ffmpeg later)
//   node render.js video out.mp4 startFrame endFrame
//   node render.js cues out.json
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--disable-web-security', '--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, process.env.PAGE || 'index.html'));
  await page.evaluate(async () => { await document.fonts.load('40px "Anton"'); await document.fonts.load('40px "Luckiest Guy"'); await document.fonts.ready; });
  await page.waitForFunction(() => window.READY === true, null, { timeout: 15000 }).catch(() => {});
  if (errs.length) { console.error('PAGE ERRORS:\n' + errs.join('\n')); }
  const grab = async t => {
    const fmt = process.env.FAST ? 'image/jpeg' : 'image/png';
    const b64 = await page.evaluate(([t, fmt]) => { renderFrame(t); return document.getElementById('c').toDataURL(fmt, 0.88).split(',')[1]; }, [t, fmt]);
    return Buffer.from(b64, 'base64');
  };
  if (mode === 'preview') {
    fs.mkdirSync(out, { recursive: true });
    for (const ts of rest) { const t = parseFloat(ts); fs.writeFileSync(path.join(out, `t_${t.toFixed(2).padStart(6, '0')}.png`), await grab(t)); }
  } else if (mode === 'cues') {
    const data = await page.evaluate(() => ({ cues: CUES, dur: DUR, music: window.MUSIC || null }));
    fs.writeFileSync(out, JSON.stringify(data, null, 1));
  } else if (mode === 'video') {
    const f0 = parseInt(rest[0]), f1 = parseInt(rest[1]);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', process.env.FAST ? 'mjpeg' : 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', process.env.FAST ? 'veryfast' : 'medium', '-crf', process.env.FAST ? '22' : '15', '-pix_fmt', 'yuv420p', '-r', '30', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = f0; f < f1; f++) {
      const buf = await grab(f / 30);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 150 === 0) console.log(`${out}: frame ${f}/${f1}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  if (errs.length) console.error('PAGE ERRORS:\n' + errs.join('\n'));
  await browser.close();
})();
