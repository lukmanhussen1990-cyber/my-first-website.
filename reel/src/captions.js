// Word-by-word captions (1-3 words), chunky rounded font, thick outline + drop shadow, pop-in bounce. Plus watermark.
import { WORDS } from './times.js';
import { sat } from './util.js';

const CHUNKS = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17], [18, 19], [20], [21], [22, 23], [24, 25, 26], [27], [28], [29, 30], [31, 32, 33], [34, 35], [36], [37],
  [38, 39, 40], [41, 42], [43, 44], [45, 46], [47, 48, 49], [50], [51], [52, 53], [54], [55, 56], [57], [58, 59], [60], [61], [62], [63, 64], [65], [66, 67], [68, 69], [70, 71], [72], [73, 74], [75],
  [76, 77], [78], [79, 80], [81, 82], [83], [84, 85], [86, 87], [88, 89], [90]];
const TEXT = { 13: 'DID?', 15: 'TYPED', 16: '“YOUR', 21: 'HOT”', 30: 'CHAT.', 33: 'FRIEND.', 35: 'FAMILY.', 36: 'FUCKING.', 37: 'GROUP.', 42: 'IT…', 51: 'CHIHUAHUA', 54: 'DAD.', 57: 'UNCLE.', 61: 'GRANDMA.', 64: 'TYPING…', 67: 'TYPING…', 72: 'GROUP.', 75: 'REPLIES…', 76: '“THANK', 78: 'BETA.', 83: 'THAT.”', 89: 'AGAIN.', 90: 'GENIUS.' };
const KEY = new Set([13, 15, 17, 21, 23, 27, 29, 30, 33, 35, 37, 41, 45, 47, 51, 52, 54, 55, 57, 58, 61, 62, 64, 65, 67, 68, 69, 72, 74, 75, 78, 80, 81, 85, 88, 89, 90]);
const WHITE = '#ffffff', YELLOW = '#ffe22e', PINK = '#ff2e93';
const FONT = (s) => `${s}px "Luckiest Guy"`;

function popScale(x) {   // 0.8 -> 1.1 -> 1.0
  if (x <= 0) return 0.8; if (x < 0.09) return 0.8 + (x / 0.09) * 0.3; if (x < 0.19) return 1.1 - ((x - 0.09) / 0.10) * 0.1; return 1.0;
}

export function drawCaptions(c, t, W, H) {
  // watermark
  c.save(); c.font = '800 30px Nunito'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 8; c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillText('@garden_reels', W / 2, 1522); c.restore();

  let ci = -1; for (let i = 0; i < CHUNKS.length; i++) { if (t >= WORDS[CHUNKS[i][0]].s - 0.03) ci = i; }
  if (ci < 0) return;
  const ch = CHUNKS[ci]; const end = WORDS[ch[ch.length - 1]].e; const next = ci + 1 < CHUNKS.length ? WORDS[CHUNKS[ci + 1][0]].s - 0.03 : 1e9;
  const hold = Math.min(next, end + 0.5); if (t > hold) return;
  const outK = next - end > 0.5 ? sat((t - (hold - 0.1)) / 0.1) : 0;
  const words = ch.map((i) => ({ i, txt: TEXT[i] || WORDS[i].w.replace(/[.,?!]/g, '').toUpperCase(), s: WORDS[i].s - 0.03, col: /fuck/i.test(WORDS[i].w) ? PINK : (KEY.has(i) ? YELLOW : WHITE) }));
  let size = ch.length === 1 ? 128 : 108; c.font = FONT(size); const gap = size * 0.26;
  let total = words.reduce((a, w) => a + c.measureText(w.txt).width, 0) + gap * (words.length - 1);
  if (total > 950) { size *= 950 / total; c.font = FONT(size); total = words.reduce((a, w) => a + c.measureText(w.txt).width, 0) + size * 0.26 * (words.length - 1); }
  const g2 = size * 0.26; let x = W / 2 - total / 2; const y = 1398;
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
  for (const w of words) {
    const ww = c.measureText(w.txt).width; const cx = x + ww / 2; x += ww + g2;
    if (t < w.s) continue;
    const sc = popScale(t - w.s) * (1 - outK * 0.25); const rot = (t - w.s < 0.19 ? (0.19 - (t - w.s)) * -0.25 : 0) * (w.i % 2 ? 1 : -1);
    c.save(); c.translate(cx, y + size * 0.06); c.rotate(rot); c.scale(sc, sc); c.globalAlpha = (1 - outK) * sat((t - w.s) / 0.04 + 0.4);
    c.font = FONT(size);
    c.fillStyle = 'rgba(0,0,0,0.9)'; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.lineWidth = size * 0.2; c.strokeText(w.txt, 5, 11); c.fillText(w.txt, 5, 11);   // drop shadow
    c.strokeStyle = '#000'; c.lineWidth = size * 0.2; c.strokeText(w.txt, 0, 0);
    c.fillStyle = w.col; c.fillText(w.txt, 0, 0);
    // glossy top highlight
    c.globalCompositeOperation = 'source-atop';
    c.restore();
  }
  c.restore();
}
