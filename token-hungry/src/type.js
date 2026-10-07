// Typography: all text is real, typeset with embedded fonts (no lettering
// is drawn by hand), so spelling is exact.
import { clamp, E, lerp } from './util.js';
import { C } from './style.js';

export const F = {
  display: '"Fraunces Display"',
  caption: '"Fraunces Caption"',
  italic: '"Fraunces Italic"',
  sans: '"DM Sans Medium"',
  sansBold: '"DM Sans SemiBold"',
};

export async function loadFonts() {
  const faces = [
    ['Fraunces Display', 'fonts/Fraunces-Display.ttf'],
    ['Fraunces Caption', 'fonts/Fraunces-Caption.ttf'],
    ['Fraunces Italic', 'fonts/Fraunces-Italic.ttf'],
    ['DM Sans Medium', 'fonts/DMSans-Medium.ttf'],
    ['DM Sans SemiBold', 'fonts/DMSans-SemiBold.ttf'],
  ];
  for (const [name, url] of faces) {
    const ff = new FontFace(name, `url(${url})`);
    await ff.load();
    document.fonts.add(ff);
  }
  await document.fonts.ready;
}

// Animated caption: words rise out of a mask line, staggered.
// c: {text, x (centre), y (baseline), size, font, color, tIn, tOut, stagger,
//     dur, rise, align, letterSpacing, revealDots: [t...] (for a trailing ellipsis)}
export function drawCaption(ctx, c, t) {
  if (t < c.tIn - 0.01) return;
  if (c.tOut != null && t > c.tOut + 0.6 + (c.text.split(' ').length * 0.04)) return;
  const size = c.size;
  ctx.save();
  ctx.font = `${size}px ${c.font || F.caption}`;
  ctx.letterSpacing = `${c.letterSpacing || 0}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const full = ctx.measureText(c.text).width;
  const x0 = c.align === 'left' ? c.x : c.x - full / 2;
  const words = c.text.split(' ');
  let idx = 0;
  const stagger = c.stagger ?? 0.07;
  const dur = c.dur ?? 0.55;
  const rise = c.rise ?? size * 0.62;
  // mask: text appears from below a line just under the baseline
  ctx.beginPath();
  ctx.rect(-4000, c.y - size * 1.4, 9000, size * 1.4 + size * 0.34);
  ctx.clip();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wx = x0 + ctx.measureText(c.text.slice(0, idx)).width;
    idx += w.length + 1;
    const pin = clamp((t - c.tIn - i * stagger) / dur);
    if (pin <= 0) continue;
    const e = E.outCubic(pin);
    let a = clamp(pin * 1.6);
    let dy = (1 - e) * rise;
    if (c.tOut != null) {
      const po = clamp((t - c.tOut - i * 0.035) / 0.32);
      a *= 1 - E.inCubic(po);
      dy -= E.inCubic(po) * size * 0.28;
    }
    if (a <= 0) continue;
    ctx.globalAlpha = a * (c.alpha ?? 1);
    ctx.fillStyle = c.color || C.ink;
    let txt = w;
    if (c.revealDots && i === words.length - 1 && w.endsWith('…')) {
      // ellipsis revealed one dot at a time
      const base = w.slice(0, -1);
      ctx.fillText(base, wx, c.y + dy);
      const bw = ctx.measureText(base).width;
      const ew = ctx.measureText('…').width;
      const n = c.revealDots.filter((d) => t >= d).length;
      if (n > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(wx + bw - 1, c.y - size, (ew * Math.min(n, 3)) / 3 + 1, size * 1.5);
        ctx.clip();
        ctx.fillText('…', wx + bw, c.y + dy);
        ctx.restore();
      }
      continue;
    }
    ctx.fillText(txt, wx, c.y + dy);
  }
  ctx.restore();
}

export function textWidth(ctx, text, size, font, spacing = 0) {
  ctx.save();
  ctx.font = `${size}px ${font}`;
  ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
