// Shared animation helpers for the redrawn film. Frame numbers are 1-based like the
// reference (frame f is at t = (f - 1) / 30 s). Every scene defines
//   window.renderFrame = async (f) => { ... }
// which must fully set the stage for frame f (no reliance on previous frames).

const FPS = 30;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const invlerp = (a, b, x) => clamp((x - a) / (b - a));
const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutQuint: t => t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// Piecewise keyframes: kf(f, [[f0, v0], [f1, v1, 'inOutCubic'], ...]) -> value at frame f.
// The easing named on a key applies to the segment arriving at that key. Values may be numbers or arrays.
function kf(f, keys) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (f <= f1) {
      const t = (ease[e || 'linear'])((f - f0) / (f1 - f0));
      return Array.isArray(v0) ? v0.map((a, k) => lerp(a, v1[k], t)) : lerp(v0, v1, t);
    }
  }
  return keys[keys.length - 1][1];
}

const rgba = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const mixc = (c0, c1, t) => c0.map((v, i) => lerp(v, c1[i], t));

// Split an element's text into word spans (keeps spaces). Returns the spans.
function splitWords(el, text) {
  el.innerHTML = '';
  const spans = [];
  text.split(/(\s+)/).forEach(tok => {
    const s = document.createElement('span');
    s.className = 'word';
    s.textContent = tok;
    el.appendChild(s);
    if (tok.trim().length) spans.push(s);
  });
  return spans;
}

// Word-by-word reveal. starts[i] is the frame word i begins to appear, dur the frames each
// word takes to settle. While settling a word goes from blurred / transparent / accent-coloured
// to crisp / opaque / final colour (the reference's "later words briefly softer or more violet").
function wordReveal(spans, f, { starts, dur = 8, blur = 10, rise = 0, from = [150, 130, 255], to = [255, 255, 255], minOpacity = 0, e = 'outCubic', colorDur = null }) {
  spans.forEach((s, i) => {
    const p = ease[e](invlerp(starts[i], starts[i] + dur, f));
    const pc = colorDur ? ease[e](invlerp(starts[i], starts[i] + colorDur, f)) : p;
    s.style.opacity = lerp(minOpacity, 1, p);
    s.style.filter = p >= 1 ? 'none' : `blur(${(blur * (1 - p)).toFixed(2)}px)`;
    s.style.transform = rise ? `translateY(${(rise * (1 - p)).toFixed(2)}px)` : '';
    s.style.color = rgba(mixc(from, to, pc));
  });
}

// CSS matrix3d for a 2-D homography H (3x3 row-major, maps element-local px -> stage px).
// Put the element at left:0; top:0 with transform-origin 0 0.
function homographyCSS(H) {
  const h = H.flat ? H.flat() : H;
  const m = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];
  return `matrix3d(${m.map(v => v.toFixed(9)).join(',')})`;
}

// Image source swap that resolves once the new frame is decoded.
async function setImg(img, src) {
  if (img.getAttribute('data-src') === src) return;
  img.setAttribute('data-src', src);
  img.src = src;
  try { await img.decode(); } catch (e) { await new Promise(r => { img.onload = r; img.onerror = r; }); }
}

// Animated soft light field drawn on a canvas: a base colour plus large blurred colour blobs.
// blobs: [{x, y, rx, ry, rot, color:[r,g,b], a}] in stage px. Use mode 'screen' / 'source-over' / 'lighter'.
function drawGlow(canvas, base, blobs, { mode = 'source-over', blurPx = 0 } = {}) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = rgba(base);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = mode;
  if (blurPx) ctx.filter = `blur(${blurPx}px)`;
  for (const b of blobs) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate((b.rot || 0) * Math.PI / 180);
    ctx.scale(1, (b.ry || b.rx) / b.rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx);
    const a = b.a === undefined ? 1 : b.a;
    g.addColorStop(0, rgba(b.color, a));
    g.addColorStop(b.core || 0.0, rgba(b.color, a));
    g.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, b.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// Fetch JSON data shipped next to a scene (Chromium is launched with file access enabled).
async function loadJSON(url) { const r = await fetch(url); return r.json(); }

window.FPS = FPS; window.clamp = clamp; window.lerp = lerp; window.invlerp = invlerp; window.ease = ease;
window.kf = kf; window.rgba = rgba; window.mixc = mixc; window.splitWords = splitWords; window.wordReveal = wordReveal;
window.homographyCSS = homographyCSS; window.setImg = setImg; window.drawGlow = drawGlow; window.loadJSON = loadJSON;
