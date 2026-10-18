// Page bootstrap. URL params: entry=film|test, scene=<test scene module>, w, h, plus any scene params.
// Exposes window.APP for the headless renderer (render/*.mjs).
import { Stage } from './core/stage.js';

const qs = new URLSearchParams(location.search);
const params = Object.fromEntries(qs.entries());
const width = +(params.w || 1080), height = +(params.h || 1920);

const APP = (window.APP = { params, ready: false, error: null });
window.addEventListener('error', (e) => { APP.error = String(e.message || e); });
window.addEventListener('unhandledrejection', (e) => { APP.error = String(e.reason && (e.reason.stack || e.reason)); });

(async () => {
  try {
    const stage = new Stage({ width, height, msaa: +(params.msaa ?? 4), bloom: params.bloom !== '0' });
    APP.stage = stage;
    let mod;
    if ((params.entry || 'test') === 'film') mod = await import('./film.js');
    else mod = await import(`./test/${params.scene || 'studio'}.js`);
    const ctl = await mod.build(stage, params);
    APP.duration = ctl.duration || 10;
    APP.fps = ctl.fps || 30;
    APP.setParams = (p) => Object.assign(params, p);
    APP.renderAt = (t, frame = 0) => { ctl.update(t, frame); stage.render(frame); return true; };
    APP.readPixels = () => stage.readPixels();
    APP.ctl = ctl;
    APP.ready = true;
  } catch (e) {
    APP.error = String(e && (e.stack || e));
    console.error(APP.error);
  }
})();
