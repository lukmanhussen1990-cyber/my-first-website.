// Camera, pages and layers (spec §1.2). Loaded after timeline.json is available as window.T.
(function () {
  const { ease, remap, lerp } = L;

  // Vertical camera position in world space. Chat page = world y 0..1080, thought page = 1080..2160.
  function camY(t) {
    if (t < 3.60) return 0;
    if (t < 4.20) return 1080 * ease.inOutCubic(remap(t, 3.60, 4.20));
    if (t < 12.42) return 1080;
    if (t < 13.12) return 1080 * (1 - ease.inOutCubic(remap(t, 12.42, 13.12)));
    return 0;
  }
  function zoom(t) {
    if (t < 4.20) return 1;
    if (t < 8.21) return lerp(1, 1.035, ease.inOutSine(remap(t, 4.20, 8.21)));
    if (t < 8.90) return 1.035;
    if (t < 8.96) return lerp(1.035, 1.085, ease.outQuad(remap(t, 8.90, 8.96)));
    if (t < 9.40) return lerp(1.085, 1.0, ease.outCubic(remap(t, 8.96, 9.40)));
    if (t < 14.05) return 1;
    if (t < 14.65) return lerp(1, 1.18, ease.inOutCubic(remap(t, 14.05, 14.65)));
    if (t < 15.30) return lerp(1.18, 1.195, remap(t, 14.65, 15.30));
    return 1.195;
  }
  const pivot = (t) => (t < 12.27 ? [960, 555] : [960, 520]);
  // Seeded 2D value noise sampled at 30 Hz (shake steps once per frame).
  function shakeNoise(t, seed) {
    const k = Math.floor(t * 30 + 1e-6);
    return [L.hash(k * 1.37 + seed) * 2 - 1, L.hash(k * 2.71 + seed + 50) * 2 - 1];
  }
  function shake(t) {
    if (t >= 8.90 && t < 9.20) {
      const tau = t - 8.90, a = 10 * Math.exp(-tau / 0.09), n = shakeNoise(t, 11);
      return { x: n[0] * a, y: n[1] * a, rot: ((0.5 * Math.PI) / 180) * Math.exp(-tau / 0.09) * n[0] };
    }
    if (t >= 11.70 && t < 11.85) {
      const tau = t - 11.70, a = 4 * Math.exp(-tau / 0.06), n = shakeNoise(t, 23);
      return { x: n[0] * a, y: n[1] * a, rot: 0 };
    }
    return { x: 0, y: 0, rot: 0 };
  }
  // Apply the world camera to ctx, for a given page (0 = chat, 1080 = thought).
  function applyCamera(ctx, t, pageY = 0) {
    const [px, py] = pivot(t), Z = zoom(t), sh = shake(t);
    ctx.translate(px + sh.x, py + sh.y);
    if (sh.rot) ctx.rotate(sh.rot);
    ctx.scale(Z, Z);
    ctx.translate(-px, -py);
    ctx.translate(0, pageY - camY(t));
  }
  // Is a page (pageY) at least partly on screen at time t?
  function pageVisible(t, pageY) {
    const off = pageY - camY(t);
    const Z = zoom(t), [, py] = pivot(t);
    const top = (off - py) * Z + py, bottom = (off + 1080 - py) * Z + py;
    return bottom > -20 && top < 1100;
  }
  // World-page point -> screen point (for screen-space flyers that hand off to/from a page).
  function pageToScreen(t, pageY, x, y) {
    const [px, py] = pivot(t), Z = zoom(t), sh = shake(t);
    let wx = x, wy = y + pageY - camY(t);
    let sx = (wx - px) * Z, sy = (wy - py) * Z;
    if (sh.rot) { const c = Math.cos(sh.rot), s = Math.sin(sh.rot); [sx, sy] = [sx * c - sy * s, sx * s + sy * c]; }
    return [sx + px + sh.x, sy + py + sh.y];
  }

  window.CAM = { camY, zoom, pivot, shake, applyCamera, pageVisible, pageToScreen, PAGE: { chat: 0, thought: 1080 } };
})();
