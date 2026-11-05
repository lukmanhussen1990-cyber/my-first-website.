// 2D overlay: narration captions, sound-effect words, watermark.
// Everything is a pure function of (time, frame) so frame-by-frame renders are deterministic.
import { CONFIG } from './config.js';
import { hash, lerp, clamp } from './anim.js';

const FONT = `"${CONFIG.font}", "Arial Black", sans-serif`;

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function outlinedText(ctx, lines, size, fill, lineHeight = 1) {
  const C = CONFIG.caption;
  const n = lines.length;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // pass 1: outline with drop shadow
  ctx.save();
  ctx.shadowColor = C.shadow;
  ctx.shadowOffsetY = C.shadowOffset;
  ctx.shadowBlur = C.shadowBlur;
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = C.outlineWidth * 2;
  lines.forEach((ln, i) => ctx.strokeText(ln, 0, (i - (n - 1) / 2) * size * lineHeight));
  ctx.restore();
  // pass 2: fill
  ctx.fillStyle = fill;
  lines.forEach((ln, i) => ctx.fillText(ln, 0, (i - (n - 1) / 2) * size * lineHeight));
}

// 0.8 -> 1.05 -> 1.0 over popFrames frames
export function popScale(f, frames = CONFIG.caption.popFrames) {
  const half = frames / 2;
  if (f >= frames) return 1;
  if (f <= half) return lerp(0.8, 1.05, Math.sin((f / half) * Math.PI * 0.5));
  return lerp(1.05, 1.0, (f - half) / half);
}

export function drawCaption(ctx, cap, frame, W, H) {
  const C = CONFIG.caption;
  const huge = cap.style === 'huge';
  const size = huge ? C.hugeSize : C.size;
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  ctx.letterSpacing = '1px';
  const lines = wrap(ctx, cap.text.toUpperCase(), huge ? W * 0.9 : C.maxWidth);
  const s = popScale(frame);
  ctx.translate(W / 2, H * (huge ? 0.6 : C.y));
  ctx.scale(s, s);
  outlinedText(ctx, lines, size, C.color, huge ? 0.98 : C.lineHeight);
  ctx.restore();
}

// Sound-effect word: pops in (overshoot), shakes the whole time, pops out.
export function drawSfx(ctx, ev, t, fps, x, y) {
  const S = CONFIG.sfxText;
  const age = t - ev.t0;
  const dur = ev.dur ?? S.dur;
  if (age < 0 || age > dur) return;
  const f = age * fps;
  let sc;
  if (f < 2) sc = lerp(0.2, 1.3, f / 2);
  else if (f < 4) sc = lerp(1.3, 0.92, (f - 2) / 2);
  else if (f < 6) sc = lerp(0.92, 1.0, (f - 4) / 2);
  else sc = 1;
  const outF = (dur - age) * fps;
  if (outF < 3) sc *= lerp(0.5, 1, clamp(outF / 3));
  const fi = Math.floor(f);
  const shake = S.shakePx * (ev.shake ?? 1) * (f < 8 ? 1.4 : 0.7);
  const jx = (hash(fi * 3.17 + ev.seed) - 0.5) * 2 * shake;
  const jy = (hash(fi * 5.31 + ev.seed + 9) - 0.5) * 2 * shake;
  const jr = (hash(fi * 7.77 + ev.seed + 3) - 0.5) * 3;
  const size = ev.size ?? S.size;
  ctx.save();
  ctx.translate(x + jx, y + jy);
  ctx.rotate(((ev.tilt ?? 0) + jr) * (Math.PI / 180));
  ctx.scale(sc, sc);
  ctx.font = `${size}px ${FONT}`;
  ctx.letterSpacing = '2px';
  const lines = ev.word.split('\n');
  outlinedText(ctx, lines, size, ev.color === 'lime' ? S.lime : ev.color === 'yellow' || !ev.color ? S.yellow : ev.color, 1.0);
  ctx.restore();
}

export function drawWatermark(ctx, W, H) {
  ctx.save();
  ctx.font = `600 30px "Helvetica Neue", Arial, sans-serif`;
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.fillText(CONFIG.watermark, W / 2, H / 2);
  ctx.restore();
}
