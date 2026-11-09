// 2D drawings for the farmer / lion / goat / grass riddle short (our own art): side-view animals with faces, the grass
// bundle, thought bubbles, question marks, a pause icon and a x7 badge. Same rules as toon.ts: plum ink, painted
// shading, no blush, no catchlights.
import { Pen, INK, mix, shade } from "../slippery/toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const WHITE = "#ffffff";

// ---------------- lion (700 x 480, facing screen-left) ----------------
export type LionExpr = "neutral" | "hungry" | "chomp" | "bored" | "happy" | "yawn";
export const LION_CW = 700, LION_CH = 480;
export const drawLion = (p: Pen, expr: LionExpr = "neutral", step = 0) => {
  const TAN = "#e9b452", TAN_D = "#c98f34", MANE = "#c2652a", MANE_D = "#8f4519", MUZ = "#f7d792";
  const legs: [number, number][] = [[250, 1], [320, -1], [470, -1], [540, 1]];
  for (const [x, ph] of legs) {
    const sw = 18 * Math.sin(step * Math.PI * 2) * ph;
    p.line([[x, 300], [x + sw * 0.4, 380], [x + sw, 450]], ph > 0 ? TAN : TAN_D, 34);
    p.ell(x + sw - 6, 452, 26, 14, MANE_D, 6);
  }
  // tail with tuft
  p.line([[560, 250], [630, 220], [655, 150]], TAN, 16);
  p.ell(658, 138, 22, 28, MANE_D, 6);
  // body
  const body: P2[] = [];
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; body.push([400 + 175 * Math.cos(a), 265 + 92 * Math.sin(a) * (Math.sin(a) > 0 ? 1.0 : 0.92)]); }
  p.gradFill(body, TAN, mix(TAN, "#8a6aa0", 0.25), rad(-110));
  p.inkRing(body, 9, rad(70), 0.4);
  // mane
  const mane: P2[] = [];
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, r = i % 2 ? 112 : 136; mane.push([180 + r * Math.cos(a), 190 + r * 0.95 * Math.sin(a)]); }
  p.gradFill(mane, MANE, MANE_D, rad(-120));
  p.inkRing(mane, 8, rad(70), 0.35);
  p.ell(205, 92, 22, 20, TAN, 7); p.ell(140, 96, 20, 18, TAN, 7); // ears
  // head + muzzle
  p.ell(170, 200, 76, 70, TAN, 9);
  p.ell(122, 236, 46, 32, MUZ, 7);
  p.poly([[86, 214], [112, 210], [100, 230]], "#5a2e1a", 5); // nose
  // eye
  const ex = 160, ey = 180;
  switch (expr) {
    case "happy": p.arc(ex, ey + 6, 16, 12, 200, 340, 7); break;
    case "bored": case "yawn": p.stroke([[ex - 16, ey + 2], [ex + 16, ey + 2]], 7); break;
    case "hungry": case "chomp":
      p.ell(ex, ey, 17, 17, WHITE, 6); p.dot(ex - 4, ey + 3, 7);
      p.clip([[ex - 20, ey - 20], [ex + 20, ey - 20], [ex + 20, ey - 3], [ex - 20, ey - 3]], () => p.ell(ex, ey, 18, 18, TAN, 0));
      p.stroke([[ex - 17, ey - 3], [ex + 17, ey - 3]], 6); p.stroke([[ex - 20, ey - 26], [ex + 18, ey - 18]], 7);
      break;
    default: p.ell(ex, ey, 16, 16, WHITE, 6); p.dot(ex - 3, ey + 2, 7);
  }
  // mouth
  if (expr === "chomp" || expr === "yawn") {
    p.ell(112, 262, 34, expr === "yawn" ? 26 : 20, "#5a1e28", 6);
    for (const x of [92, 132]) p.poly([[x - 6, 246], [x + 6, 246], [x, 258]], WHITE, 3);
  } else {
    p.stroke([[100, 252], [124, 262], [148, 252]], 6);
    if (expr === "hungry") { p.ell(150, 262, 10, 13, "#e86e78", 4); p.ell(118, 282, 6, 10, "#9fd4ff", 3); }
    if (expr === "happy") p.arc(124, 250, 22, 12, 20, 160, 6);
  }
};

// ---------------- goat (600 x 460, facing screen-left) ----------------
export type GoatExpr = "neutral" | "shock" | "chew" | "happy" | "nervous" | "smug";
export const GOAT_CW = 600, GOAT_CH = 460;
export const drawGoat = (p: Pen, expr: GoatExpr = "neutral", step = 0) => {
  const W0 = "#f6f3ec", W1 = "#d9d3cc", HOOF = "#4a3a40", HORN = "#9a8f86";
  for (const [x, ph] of [[240, 1], [280, -1], [400, -1], [440, 1]] as [number, number][]) {
    const sw = 12 * Math.sin(step * Math.PI * 2) * ph;
    p.line([[x, 300], [x + sw, 420]], ph > 0 ? W0 : W1, 18);
    p.ell(x + sw, 426, 13, 9, HOOF, 4);
  }
  p.poly([[470, 205], [505, 175], [492, 215]], W0, 6); // tail
  const body: P2[] = [];
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; body.push([340 + 140 * Math.cos(a), 255 + 75 * Math.sin(a)]); }
  p.gradFill(body, W0, mix(W0, "#7a6a9a", 0.22), rad(-110));
  p.inkRing(body, 8, rad(70), 0.4);
  // neck + head
  p.poly([[205, 215], [255, 190], [270, 260], [215, 270]], W0, 0);
  p.arc(170, 120, 40, 34, 200, 330, 13, HORN); p.arc(170, 120, 40, 34, 200, 330, 3, INK); // horn
  p.ell(150, 180, 60, 46, W0, 8);
  p.ell(204, 176, 30, 13, W1, 6, 0, 360, 25); // ear
  p.poly([[96, 214], [124, 220], [104, 262]], W1, 5); // beard
  p.ell(102, 196, 26, 22, W0, 7); // snout
  p.dot(86, 190, 5);
  const ex = 140, ey = 166;
  switch (expr) {
    case "shock": p.ell(ex, ey, 20, 20, WHITE, 6); p.dot(ex - 3, ey + 2, 5); break;
    case "happy": p.arc(ex, ey + 6, 14, 10, 200, 340, 6); break;
    case "smug": p.ell(ex, ey, 14, 14, WHITE, 5); p.dot(ex - 3, ey + 4, 6); p.clip([[ex - 16, ey - 16], [ex + 16, ey - 16], [ex + 16, ey], [ex - 16, ey]], () => p.ell(ex, ey, 15, 15, W0, 0)); p.stroke([[ex - 14, ey], [ex + 14, ey]], 5); break;
    default: p.ell(ex, ey, 14, 14, WHITE, 5); p.dot(ex - 3, ey + 2, 6);
  }
  if (expr === "chew") { p.ell(92, 214, 14, 9, "#5a1e28", 4); for (const k of [-1, 0, 1]) p.stroke([[86, 216], [56 + k * 4, 236 + k * 14]], 5, "#58a83c"); }
  else if (expr === "shock") p.ell(92, 216, 9, 12, "#5a1e28", 4);
  else if (expr === "nervous") { const s: P2[] = []; for (let i = 0; i <= 6; i++) s.push([80 + i * 4, 214 + 2 * Math.sin(i * 1.6)]); p.stroke(s, 4); p.ell(190, 120, 8, 13, "#9fd4ff", 3); }
  else p.arc(98, 206, 14, 8, 20, 160, 5);
};

// ---------------- grass bundle (300 x 420) ----------------
export const GRASS_CW = 300, GRASS_CH = 420;
export const drawGrass = (p: Pen, left = 1) => {
  const greens = ["#58a83c", "#6cbf4a", "#4a9632", "#7ccc58"];
  const n = Math.max(3, Math.round(22 * left));
  for (let i = 0; i < n; i++) {
    const x0 = 120 + ((i * 37) % 60), lean = ((i * 53) % 40) - 20, top = 40 + ((i * 29) % 70) + (1 - left) * 180;
    p.line([[x0, 380], [x0 + lean * 0.3, 260], [x0 + lean, top]], greens[i % 4], 12, i % 3 === 0);
  }
  p.band([[104, 300], [196, 300]], "#c99a58", 20, 3);
  p.stroke([[110, 380], [190, 380]], 6, "#8a6a3a");
};

// ---------------- thought bubble (700 x 560), content drawn inside at scale ----------------
export const BUBBLE_CW = 700, BUBBLE_CH = 560;
export const drawBubble = (p: Pen, inner: (p: Pen) => void) => {
  const blobs: [number, number, number][] = [[200, 200, 130], [350, 150, 150], [500, 200, 130], [520, 310, 110], [350, 340, 140], [180, 310, 110]];
  for (const [x, y, r] of blobs) p.ell(x, y, r + 7, r * 0.85 + 7, INK, 0);
  for (const [x, y, r] of blobs) p.ell(x, y, r, r * 0.85, WHITE, 0);
  p.ell(150, 470, 34, 26, WHITE, 7); p.ell(90, 530, 18, 14, WHITE, 6);
  const g = p.g; g.save(); g.beginPath(); g.ellipse(350, 255, 290, 190, 0, 0, Math.PI * 2); g.clip(); inner(new Pen(g)); g.restore();
};

/** big yellow question mark (220 x 320) */
export const drawQuestion = (p: Pen) => {
  const g = p.g; g.font = "900 300px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 26; g.strokeStyle = INK; g.lineJoin = "round"; g.strokeText("?", 110, 170);
  g.fillStyle = "#ffd84a"; g.fillText("?", 110, 170);
};
/** pause icon (300 x 300) */
export const drawPause = (p: Pen) => {
  const g = p.g; g.fillStyle = "rgba(20,18,28,0.75)"; g.beginPath(); g.arc(150, 150, 140, 0, Math.PI * 2); g.fill();
  g.fillStyle = WHITE; g.fillRect(100, 85, 34, 130); g.fillRect(166, 85, 34, 130);
};
/** "x7" badge (300 x 300) */
export const drawBadge7 = (p: Pen) => {
  p.ell(150, 150, 130, 130, "#e2453c", 12);
  const g = p.g; g.font = "900 150px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = WHITE; g.fillText("×7", 150, 160);
};
export { shade };
