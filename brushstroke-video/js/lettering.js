/* lettering.js - turns words into brush strokes with a natural hand:
   every letter gets its own small wobble, slant and baseline drift, and
   the strokes are timed so the word appears to be written live. */
(function () {
  'use strict';
  const BV = window.BV;
  const U = BV.util;
  const { G, SPACE } = BV.glyphs;

  const DEFAULT_STYLE = {
    xh: 23, // x-height in px
    tracking: 0.46, // gap between letters, in x-heights
    weight: 0.27, // stroke width, in x-heights
    jitter: 0.035, // per-point wobble, in x-heights
    color: '#131813',
    dry: 0.2,
  };

  // Build strokes for one word, horizontally centred on cx with baseline y.
  function word(text, cx, baseline, seed, style) {
    const st = Object.assign({}, DEFAULT_STYLE, style);
    const r = U.rng(seed);
    const xh = st.xh;
    const chars = Array.from(text.toLowerCase());
    let width = 0;
    const adv = chars.map((ch) => {
      const g = G[ch];
      const a = g ? g.w : ch === ' ' ? SPACE : 0.6;
      return a;
    });
    for (let i = 0; i < chars.length; i++) width += adv[i] + (i < chars.length - 1 ? st.tracking : 0);
    let pen = cx - (width * xh) / 2;
    const strokes = [];
    for (let i = 0; i < chars.length; i++) {
      const g = G[chars[i]];
      if (g) {
        const scale = xh * (1 + (r() - 0.5) * 0.08);
        const slant = (r() - 0.5) * 0.08;
        const rot = (r() - 0.5) * 0.06;
        const dy = (r() - 0.5) * 0.1 * xh;
        const cosr = Math.cos(rot), sinr = Math.sin(rot);
        const gcx = g.w / 2;
        for (const s of g.s) {
          const pts = s.map((p) => {
            let x = p[0] - gcx + (r() - 0.5) * st.jitter * 2;
            let y = p[1] + (r() - 0.5) * st.jitter * 2;
            x -= y * slant;
            const X = x * cosr - y * sinr;
            const Y = x * sinr + y * cosr;
            const q = [pen + (gcx + X) * xh * (scale / xh), baseline + Y * scale + dy];
            if (p[2]) q.push(p[2]);
            return q;
          });
          strokes.push(
            BV.brush.make(pts, {
              w: xh * st.weight * (0.92 + r() * 0.16),
              tin: xh * st.weight * 0.9,
              tout: xh * st.weight * 1.8,
              minTip: 0.35,
              swell: 0.08,
              wobble: 0.14,
              edge: 0.12,
              dry: st.dry,
              color: st.color,
              seed: (seed * 97 + strokes.length * 13) | 0,
            })
          );
        }
      }
      pen += (adv[i] + st.tracking) * xh;
    }
    // writing schedule: time share proportional to stroke length plus a pen lift
    const lift = xh * 0.7;
    let total = 0;
    for (const s of strokes) total += s.L + lift;
    let acc = 0;
    for (const s of strokes) {
      s.t0 = acc / total;
      acc += s.L;
      s.t1 = acc / total;
      acc += lift;
    }
    return { strokes, width: width * xh, chars: chars.length };
  }

  // How long a word takes to write, in seconds.
  function writeDuration(text) {
    return U.clamp(0.12 + Array.from(text).length * 0.045, 0.16, 0.5);
  }

  // Paint a word at writing progress p (0..1).
  function drawWord(ctx, w, p, alpha) {
    if (p <= 0) return;
    for (const s of w.strokes) {
      if (p <= s.t0) break;
      const sp = p >= s.t1 ? 1 : (p - s.t0) / (s.t1 - s.t0);
      BV.brush.draw(ctx, s, U.easeInOut(sp) * 0.15 + sp * 0.85, alpha);
    }
  }

  BV.lettering = { word, drawWord, writeDuration, DEFAULT_STYLE };
})();
