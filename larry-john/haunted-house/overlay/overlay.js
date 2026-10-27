// "Larry's Haunted House" text overlay: one-word subtitles + labels, rendered with a transparent background.
// Times come from build/timing.json (the voice) and build/cues.json (the labels placed by the shots).
import { Captions } from '../../engine/overlay/captions.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1920, FPS = +q.get('fps') || 30;
const timingUrl = q.get('timing') || '/haunted-house/build/timing.json';
const cuesUrl = q.get('cues') || '/haunted-house/build/cues.json';

async function loadFonts() {
  for (const [fam, url, weight] of [
    ['Fredoka', '/assets/fonts/fredoka-latin-700-normal.woff2', '700'],
    ['Titan One', '/assets/fonts/titan-one-latin-400-normal.woff2', '400'],
  ]) document.fonts.add(await new FontFace(fam, `url(${url})`, { weight }).load());
}

async function main() {
  await loadFonts();
  const timing = await (await fetch(timingUrl)).json();
  const cues = await (await fetch(cuesUrl)).json();
  const script = await (await fetch('/haunted-house/script/script.json')).json();
  const echoBeats = new Set(script.beats.filter((b) => b.echo).map((b) => b.n));
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cap = new Captions(ctx, W, H);
  // face positions from the 3D shots (tools/build_reel.py makes build/faces.json) keep subtitles off faces
  let faces = null;
  try { const r = await fetch(q.get('faces') || '/haunted-house/build/faces.json'); if (r.ok) faces = await r.json(); } catch (e) { faces = null; }
  cap.setWords(timing.words.map((w) => ({ ...w, echo: w.shout && echoBeats.has(w.beat) })), faces);
  cap.setLabels(cues.labels);
  const frames = Math.round(timing.duration * FPS);
  window.APP = {
    ready: true,
    info: () => ({ frames, duration: timing.duration, fps: FPS, flipY: false }),
    async renderFrame(f) { cap.draw(f / FPS); },
    async renderTime(t) { cap.draw(t); },
    stateAt: (t) => cap.stateAt(t),
    async sendPixels(f) {
      const px = ctx.getImageData(0, 0, W, H).data;
      await fetch(`/sink?kind=frame&f=${f}`, { method: 'POST', body: px });
    },
    // the cover title (render.cjs --mode sheet)
    async renderSheet() {
      const c2 = new Captions(ctx, W, H, { labelSize: 300, labelY: 0.115, labelMaxW: 0.6 });
      c2.setLabels([{ text: '$1', color: 'yellow', at: 0, dur: 9, tilt: -4 }]);
      const c3 = new Captions(ctx, W, H, { labelSize: 170, labelY: 0.225, labelMaxW: 0.92 });
      c3.setLabels([{ text: 'HAUNTED HOUSE', color: 'white', at: 0, dur: 9, tilt: -4 }]);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      c2.drawLabel(c2.labels[0], 3); c3.drawLabel(c3.labels[0], 3);
    },
    async sendPNG(rel) {
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      await fetch(`/sink?kind=file&path=${encodeURIComponent(rel)}`, { method: 'POST', body: blob });
    },
  };
}

main().catch((e) => { console.error('overlay failed', e.stack || e); window.APP = { ready: false, error: String(e) }; });
