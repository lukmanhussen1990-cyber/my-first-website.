// Entry point. Exposes window.renderFrame(t) for the frame renderer and a
// real-time preview when opened normally in a browser.
import { loadFonts } from './type.js';
import { initArt } from './story.js';
import { renderFrame, DURATION, getEvents } from './story.js';
import { drawSheet } from './sheet.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);

(async () => {
  await loadFonts();
  initArt(ctx);
  window.renderFrame = (t) => renderFrame(ctx, t);
  window.getEvents = () => getEvents();
  window.drawSheet = (n) => drawSheet(ctx, n);
  window.DURATION = DURATION;
  if (params.has('t')) {
    renderFrame(ctx, parseFloat(params.get('t')));
  } else if (params.has('sheet')) {
    drawSheet(ctx, parseInt(params.get('sheet') || '0', 10));
  } else if (!params.has('render')) {
    // Live preview (loops, with the soundtrack if present).
    document.body.classList.add('fit');
    const audio = new Audio('build/audio.wav');
    let start = performance.now();
    let useAudio = false;
    document.body.addEventListener('click', () => {
      audio.currentTime = 0;
      audio.play().then(() => (useAudio = true)).catch(() => {});
      start = performance.now();
    });
    const loop = () => {
      let t = useAudio ? audio.currentTime : ((performance.now() - start) / 1000) % DURATION;
      if (useAudio && audio.ended) {
        audio.currentTime = 0;
        audio.play();
        t = 0;
      }
      renderFrame(ctx, Math.min(t, DURATION - 1e-3));
      requestAnimationFrame(loop);
    };
    loop();
  }
  window.ready = true;
})();
