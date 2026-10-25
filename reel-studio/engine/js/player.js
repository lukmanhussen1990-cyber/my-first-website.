// Boots a project: fonts, images, voiceover timings, scenes -> window.renderFrame
import { W, H, FPS } from './util.js';
import { Assets, loadFonts } from './assets.js';
import { Reel } from './timeline.js';
import * as C from './components.js';
import * as D from './draw.js';
import * as U from './util.js';

async function getJSON(url, fallback = null) {
  try { const r = await fetch(url); if (!r.ok) return fallback; return await r.json(); } catch { return fallback; }
}

export async function boot() {
  const q = new URLSearchParams(location.search);
  const project = q.get('project') || 'snail-disco-eyes';
  const vo = q.get('vo') || 'vo';
  const P = `/projects/${project}`;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { willReadFrequently: q.get('readback') !== 'gpu' });
  try {
    await loadFonts('/engine');
    const cfg = await getJSON(`${P}/project.json`, {});
    const voIndex = await getJSON(`${P}/build/${vo}/index.json`, {});
    const manifest = await getJSON(`${P}/build/assets/manifest.json`, { images: {} });
    const assets = new Assets();
    for (const im of cfg.images || []) {
      const name = im.name;
      const m = manifest.images[name];
      await assets.load(name, [`${P}/build/assets/${name}.png`, `${P}/images/${name}.png`], im.placeholder || [1200, 800], m || {});
      if (m && m.xray) await assets.load(`xray_${name}`, [`${P}/build/assets/xray_${name}.png`], im.placeholder || [1200, 800], m);
      if (m && m.pulseFrames) await assets.loadSeq(`pulse_${name}`, (i) => `${P}/build/assets/pulse_${name}/${String(i).padStart(3, '0')}.png`, m.pulseFrames);
    }
    const reel = new Reel(cfg.reel || {}, assets, voIndex);
    reel.geometry = (await getJSON(`${P}/geometry.json`, {})) || {};
    reel.manifest = manifest;
    const mod = await import(`${P}/scenes.js?v=${Date.now()}`);
    mod.default(reel, { C, D, U, FPS, W, H });
    reel.finalize();
    window.TIMELINE = reel.timelineJSON();
    window.renderFrame = (i) => { reel.renderFrame(ctx, i); return true; };
    window.renderTime = (t) => { reel.renderFrame(ctx, Math.round(t * FPS)); return true; };
    window.REEL = reel;
    window.READY = true;
  } catch (e) {
    window.BOOT_ERROR = String(e && e.stack || e);
    console.error(e);
  }
}
