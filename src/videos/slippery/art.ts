// 2D drawings for the slippery dick short (our own art): the fish (side view, two dark stripes, faces), the props
// people hold (plastic bag, receipt, crab, worm, urchin, flakes, sand bag, flashlight) and small effect sprites.
// Same construction rules as toon.ts: plum ink, painted crescents, no blush, no catchlights.
import { Pen, INK, mul, mix, shade } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const WHITE = "#ffffff";

// ---------------- the fish ----------------
export type FishExpr = "neutral" | "smug" | "shock" | "nervous" | "dead" | "angry" | "happy" | "chew";
/** design canvas 600 x 280, facing screen-left, snout tip at x ~ 40, body axis y = 140 */
export const FISH_CW = 600, FISH_CH = 280;
const BACK = "#a9d38a", BODY = "#f4efc8", BELLY = "#fffaf0", STRIPE = "#2c1f2b", STRIPE2 = "#6a5260", ORANGE = "#f08f3d", FIN = "#f3a7bb", FIN_D = "#e07f9a";
const X0 = 46, X1 = 452, AX = 140, M = 74;
const halfH = (t: number) => {
  const a = t < 0.32 ? Math.sin((t / 0.32) * Math.PI / 2) ** 0.7 : 1 - 0.7 * ((t - 0.32) / 0.68) ** 1.25;
  return M * Math.max(0.1, a);
};
const xs = (t: number) => X0 + t * (X1 - X0);
const topY = (t: number) => AX - halfH(t);
const botY = (t: number) => AX + 0.92 * halfH(t);

export type FishOpts = { expr?: FishExpr; blink?: number; tail?: number; sweat?: boolean; squish?: number };

export const drawFish = (p: Pen, o: FishOpts = {}) => {
  const { expr = "neutral", blink = 0, tail = 0, sweat = false } = o;
  const g = p.g, N = 40;
  // tail fin (wags with `tail` in -1..1)
  const tb: P2 = [X1 - 6, AX], w = tail * 26;
  const tailPts: P2[] = [[tb[0], AX - 26], [X1 + 108, AX - 92 + w], [X1 + 84, AX + w * 0.6], [X1 + 108, AX + 92 + w], [tb[0], AX + 26]];
  p.poly(tailPts, FIN, 8);
  for (const k of [-0.6, -0.25, 0.25, 0.6]) p.stroke([[tb[0] + 8, AX + k * 20], [X1 + 92, AX + k * 82 + w * 0.8]], 3, FIN_D);
  // dorsal + anal fins (behind the body)
  const dors: P2[] = [];
  for (let i = 0; i <= 14; i++) { const t = 0.28 + (0.66 * i) / 14; dors.push([xs(t), topY(t) + 4]); }
  for (let i = 14; i >= 0; i--) { const t = 0.28 + (0.66 * i) / 14; dors.push([xs(t) + 8, topY(t) - 24 - 6 * Math.sin(i * 1.3) * 0.5 - (i < 3 ? (3 - i) * 4 : 0)]); }
  p.poly(dors, FIN, 7);
  for (let i = 1; i < 14; i += 2) { const t = 0.28 + (0.66 * i) / 14; p.stroke([[xs(t), topY(t)], [xs(t) + 8, topY(t) - 20]], 2.5, FIN_D); }
  const anal: P2[] = [];
  for (let i = 0; i <= 8; i++) { const t = 0.55 + (0.36 * i) / 8; anal.push([xs(t), botY(t) - 4]); }
  for (let i = 8; i >= 0; i--) { const t = 0.55 + (0.36 * i) / 8; anal.push([xs(t) + 6, botY(t) + 18]); }
  p.poly(anal, FIN, 7);
  // body
  const body: P2[] = [];
  for (let i = 0; i <= N; i++) body.push([xs(i / N), topY(i / N)]);
  for (let i = N; i >= 0; i--) body.push([xs(i / N), botY(i / N)]);
  p.path(body, true);
  const gr = g.createLinearGradient(0, AX - M, 0, AX + M);
  gr.addColorStop(0, BACK); gr.addColorStop(0.36, mix(BACK, BODY, 0.75)); gr.addColorStop(0.55, BODY); gr.addColorStop(1, BELLY);
  g.fillStyle = gr; g.fill();
  p.clip(body, () => {
    // orange line, dark stripe (eye -> tail), fainter lower stripe
    const line = (y: (t: number) => number, t0: number, t1: number, w0: number, w1: number, col: string) => {
      for (let i = 0; i < 24; i++) {
        const a = t0 + ((t1 - t0) * i) / 24, b = t0 + ((t1 - t0) * (i + 1)) / 24;
        p.stroke([[xs(a), y(a)], [xs(b), y(b)]], w0 + (w1 - w0) * (i / 24), col);
      }
    };
    line((t) => AX - 0.46 * halfH(t), 0.16, 0.9, 6, 4, ORANGE);
    line((t) => AX - 0.08 * halfH(t), 0.12, 1.02, 22, 13, STRIPE);
    line((t) => AX + 0.42 * halfH(t), 0.3, 0.92, 10, 6, STRIPE2);
    // soft shade along the belly line
    const sg = g.createLinearGradient(0, AX + 0.3 * M, 0, AX + M);
    sg.addColorStop(0, "rgba(120,90,140,0)"); sg.addColorStop(1, "rgba(120,90,140,0.22)");
    g.fillStyle = sg; g.fillRect(0, 0, FISH_CW, FISH_CH);
  });
  p.inkRing(body, 9, rad(70), 0.4);
  // gill arc + pectoral fin
  p.arc(xs(0.22), AX + 6, 26, 52, -70, 70, 4, mix(INK, BODY, 0.35));
  p.poly([[xs(0.25), AX + 22], [xs(0.25) + 56, AX + 14], [xs(0.25) + 50, AX + 44]], FIN, 6);
  // eye
  const ex = 112, ey = 124;
  const big = expr === "shock";
  const r = big ? 27 : 21;
  if (blink >= 1 && expr !== "dead") { p.stroke([[ex - r, ey + 2], [ex + r, ey + 2]], 5); }
  else if (expr === "happy") p.arc(ex, ey + 8, 18, 14, 200, 340, 6);
  else if (expr === "dead") {
    p.ell(ex, ey, r, r, WHITE, 5);
    p.stroke([[ex - 11, ey - 11], [ex + 11, ey + 11]], 6); p.stroke([[ex + 11, ey - 11], [ex - 11, ey + 11]], 6);
  } else {
    p.ell(ex, ey, r, r, WHITE, 5);
    const pr = big || expr === "nervous" ? 6 : 9.5, look = expr === "smug" ? 4 : 0;
    p.dot(ex - 5, ey + 2 + look, pr);
    const lid = expr === "smug" || expr === "chew" ? Math.max(0.5, blink) : blink;
    if (lid > 0) { // upper lid in body colour + lid line
      const y = ey - r + 2 * r * lid;
      p.clip([[ex - r - 2, ey - r - 2], [ex + r + 2, ey - r - 2], [ex + r + 2, y], [ex - r - 2, y]], () => p.ell(ex, ey, r + 1, r + 1, mix(BACK, BODY, 0.6), 0));
      p.stroke([[ex - r, y], [ex + r, y]], 5);
    }
    if (expr === "angry") p.stroke([[ex - 26, ey - 34], [ex + 22, ey - 22]], 8);
    if (expr === "smug") p.stroke([[ex - 22, ey - 30], [ex + 20, ey - 34]], 6);
  }
  // mouth at the snout tip
  const mx = 58, my = AX + 8;
  switch (expr) {
    case "smug": p.arc(mx + 6, my - 10, 16, 12, 30, 150, 5); break;
    case "chew": p.ell(mx + 4, my, 9, 6, "#5a1e28", 4); break;
    case "shock": p.ell(mx + 4, my + 2, 9, 12, "#5a1e28", 4); break;
    case "nervous": { const s: P2[] = []; for (let i = 0; i <= 8; i++) s.push([mx - 4 + i * 3.2, my + 2 * Math.sin(i * 1.5)]); p.stroke(s, 4); break; }
    case "dead": p.stroke([[mx - 6, my], [mx + 16, my]], 5); p.ell(mx + 6, my + 9, 6, 8, "#e86e78", 3); break;
    case "angry": p.arc(mx + 6, my + 8, 14, 7, 200, 340, 5); break;
    case "happy": p.arc(mx + 6, my - 8, 16, 11, 20, 160, 5); break;
    default: p.stroke([[mx - 6, my], [mx + 14, my - 1]], 5);
  }
  if (sweat || expr === "nervous") p.ell(ex + 34, ey - 50, 8, 13, "#9fd4ff", 3);
};

// ---------------- props ----------------
/** clear plastic pet-shop bag with water and the fish, on a 420 x 600 canvas (knot at the top) */
export const drawBag = (p: Pen, fishExpr: FishExpr = "neutral") => {
  const g = p.g;
  const bag: P2[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, a = rad(180 * t);
    bag.push([210 - 170 * Math.cos(a) * (0.92 + 0.08 * Math.sin(a)), 300 + 250 * Math.sin(a)]);
  }
  const outline: P2[] = [[190, 70], [230, 70], [300, 170], [380, 300], ...bag.reverse().slice(1, -1), [40, 300], [120, 170]];
  p.poly(outline, "#eef8fb", 0);
  // water
  p.clip(outline, () => {
    p.poly([[0, 250], [420, 236], [420, 600], [0, 600]], "#9ddff0", 0);
    const gr = g.createLinearGradient(0, 240, 0, 560); gr.addColorStop(0, "rgba(255,255,255,0.0)"); gr.addColorStop(1, "rgba(40,120,170,0.25)");
    g.fillStyle = gr; g.fillRect(0, 240, 420, 360);
    g.save(); g.translate(78, 330); g.scale(0.44, 0.44); drawFish(new Pen(g), { expr: fishExpr }); g.restore();
    p.stroke([[0, 250], [420, 236]], 5, "#5bb8d8");
  });
  p.poly(outline, null, 8);
  p.stroke([[86, 300], [110, 470]], 10, "rgba(255,255,255,0.85)");
  p.stroke([[330, 330], [320, 380]], 7, "rgba(255,255,255,0.8)");
  // knot
  p.poly([[176, 40], [244, 40], [232, 78], [188, 78]], "#eef8fb", 7);
  p.ell(210, 30, 22, 16, "#eef8fb", 7);
};

/** long till receipt on a 220 x 1000 canvas (paper hangs from the top) */
export const drawReceipt = (p: Pen, len = 1) => {
  const L = 60 + 900 * len, pts: P2[] = [[20, 0], [200, 0], [200, L]];
  for (let i = 0; i <= 9; i++) pts.push([200 - (180 * i) / 9, L + (i % 2 ? 14 : 0)]);
  p.poly(pts, "#fbfaf4", 7);
  for (let y = 40; y < L - 20; y += 34) {
    const w = 60 + ((y * 37) % 70);
    p.stroke([[40, y], [40 + w, y]], 6, "#9a96a6");
    p.stroke([[150, y], [180, y]], 6, "#9a96a6");
  }
};

/** red crab (front view) on a 300 x 220 canvas */
export const drawCrab = (p: Pen) => {
  const C = "#e2483a";
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) p.stroke([[150 + s * 50, 140 + k * 14], [150 + s * (95 + k * 8), 150 + k * 20], [150 + s * (110 + k * 8), 196]], 9, INK);
  for (const s of [-1, 1]) {
    p.stroke([[150 + s * 60, 120], [150 + s * 98, 80]], 12, INK);
    p.poly([[150 + s * 80, 82], [150 + s * 128, 30], [150 + s * 140, 72], [150 + s * 112, 60], [150 + s * 110, 96]], C, 7);
  }
  p.ell(150, 140, 72, 48, C, 8);
  p.stroke([[128, 100], [124, 74]], 6); p.stroke([[172, 100], [176, 74]], 6);
  p.dot(124, 70, 10); p.dot(176, 70, 10);
  p.arc(150, 152, 18, 8, 20, 160, 5);
};

/** wiggly pink worm on a 300 x 160 canvas */
export const drawWorm = (p: Pen, t = 0) => {
  const pts: P2[] = [];
  for (let i = 0; i <= 20; i++) pts.push([30 + i * 12, 90 + 26 * Math.sin(i * 0.55 + t * 6)]);
  p.line(pts, "#f29aa6", 26);
  for (let i = 3; i < 19; i += 3) p.stroke([[pts[i][0], pts[i][1] - 10], [pts[i][0], pts[i][1] + 10]], 3, "#c9707e");
  p.dot(pts[20][0] - 4, pts[20][1] - 4, 4);
};

/** purple sea urchin on a 260 x 260 canvas */
export const drawUrchin = (p: Pen) => {
  for (let i = 0; i < 26; i++) {
    const a = rad(i * (360 / 26) + (i % 2) * 6), r = i % 2 ? 118 : 104;
    p.stroke([[130 + 50 * Math.cos(a), 130 + 50 * Math.sin(a)], [130 + r * Math.cos(a), 130 + r * Math.sin(a)]], 7, "#3a1f4a");
  }
  p.ell(130, 130, 62, 60, "#7a3f9a", 8);
  p.ell(112, 110, 18, 12, "#a56cc4", 0);
};

/** fish-food flakes tub on a 200 x 260 canvas */
export const drawFlakes = (p: Pen) => {
  p.poly([[40, 60], [160, 60], [150, 240], [50, 240]], "#f2c14e", 8);
  p.poly([[50, 120], [150, 120], [146, 190], [54, 190]], "#ffffff", 5);
  p.ell(100, 155, 26, 14, "#f39a6b", 4);
  p.ell(100, 58, 64, 16, "#e2453c", 8);
};

/** sand sack (held) on a 360 x 300 canvas */
export const drawSack = (p: Pen) => {
  p.poly([[40, 70], [320, 60], [340, 260], [24, 268]], "#d8b77c", 9);
  p.stroke([[60, 82], [300, 74]], 6, "#a9834b");
  p.poly([[110, 130], [250, 126], [254, 200], [106, 204]], "#f6efe0", 5);
  p.g.font = "bold 52px sans-serif"; p.g.fillStyle = "#6b4b2a"; p.g.textAlign = "center"; p.g.fillText("SAND", 180, 184);
};

/** flashlight (pointing screen-left) on a 260 x 120 canvas */
export const drawTorch = (p: Pen) => {
  p.poly([[70, 40], [230, 46], [230, 76], [70, 82]], "#8a909a", 7);
  p.poly([[20, 24], [74, 34], [74, 88], [20, 98]], "#c4c9d0", 7);
  p.ell(20, 61, 10, 36, "#fff6c2", 6);
};

// ---------------- effect sprites ----------------
/** sand cloud on a 300 x 300 canvas; t 0..1 */
export const fxSand = (p: Pen, t: number) => {
  for (let i = 0; i < 7; i++) {
    const a = rad(150 + i * 40), d = 30 + 90 * t, r = (30 + 14 * (i % 3)) * (1 - 0.5 * t);
    p.ell(150 + d * Math.cos(a), 200 + d * 0.5 * Math.sin(a) - 40 * t, r, r * 0.8, `rgba(226,204,160,${(0.95 * (1 - t)).toFixed(3)})`, 0);
  }
};
/** rising bubbles on a 200 x 400 canvas */
export const fxBubbles = (p: Pen, t: number, seed = 0) => {
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.7 + i / 6 + seed * 0.13) % 1, x = 60 + ((i * 53 + seed * 31) % 90) + 10 * Math.sin(ph * 9 + i), y = 380 - ph * 360, r = 7 + (i % 3) * 5;
    p.ell(x, y, r, r, "rgba(225,250,255,0.55)", 3);
  }
};
/** sweat drops / panic lines around a head, 300 x 300 */
export const fxPanic = (p: Pen) => {
  p.ell(60, 120, 14, 22, "#9fd4ff", 5);
  p.ell(250, 90, 12, 19, "#9fd4ff", 5);
  for (const [a, b] of [[[30, 40], [70, 80]], [[270, 30], [235, 70]]] as [P2, P2][]) p.stroke([a, b], 8);
};
/** sprinkled flakes, 200 x 300 */
export const fxFlakeFall = (p: Pen, t: number) => {
  for (let i = 0; i < 14; i++) {
    const ph = (t + i / 14) % 1, x = 40 + ((i * 47) % 120) + 8 * Math.sin(ph * 7 + i), y = 20 + ph * 260;
    p.poly([[x, y], [x + 10, y + 3], [x + 6, y + 10]], ["#f2c14e", "#e2453c", "#7bc46a"][i % 3], 2);
  }
};
/** soft light cone (flashlight beam), 600 x 300, beam goes screen-left */
export const fxBeam = (p: Pen) => {
  const g = p.g, gr = g.createLinearGradient(600, 150, 0, 150);
  gr.addColorStop(0, "rgba(255,246,190,0.55)"); gr.addColorStop(1, "rgba(255,246,190,0)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(600, 135); g.lineTo(0, 10); g.lineTo(0, 290); g.lineTo(600, 165); g.closePath(); g.fill();
};
/** underwater light ray, 200 x 1000, additive */
export const fxRay = (p: Pen) => {
  const g = p.g, gr = g.createLinearGradient(0, 0, 0, 1000);
  gr.addColorStop(0, "rgba(220,255,255,0.35)"); gr.addColorStop(1, "rgba(220,255,255,0)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(70, 0); g.lineTo(130, 0); g.lineTo(200, 1000); g.lineTo(0, 1000); g.closePath(); g.fill();
};
export { shade, mul };
