// One-word-at-a-time captions drawn into the 2D overlay canvas (baked into every frame).
// White fill, thick black stroke, soft drop shadow, pop-in 0.8 -> 1.05 -> 1.0 over 120 ms,
// key emotional words in yellow. If a face is under the default spot, the caption shifts.
import {FONT} from './lib.js';

const HOLD = 0.35;
const MAX_GAP = 0.6;

export function currentWord(words, t) {
	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		const next = words[i + 1];
		const until = next && next.start - w.end < MAX_GAP ? next.start : w.end + HOLD;
		if (t >= w.start && t < until) return w;
	}
	return null;
}

/**
 * @param {CanvasRenderingContext2D} ctx overlay context
 * @param {Array} words timeline words
 * @param {number} t seconds
 * @param {Array<{x0:number,x1:number,y0:number,y1:number}>} faces screen boxes (0..1) of faces to avoid
 */
export function drawCaption(ctx, words, t, faces = []) {
	const w = currentWord(words, t);
	if (!w) return null;
	const W = ctx.canvas.width;
	const H = ctx.canvas.height;
	const k = W / 1080;
	const dt = t - w.start;
	const scale = dt < 0.04 ? 0.8 : dt < 0.08 ? 1.05 : dt < 0.12 ? 1.02 : 1.0;
	let size = (w.text.length > 9 ? 104 : 120) * k;
	ctx.font = `800 ${size}px ${FONT}, sans-serif`;
	const tw = ctx.measureText(w.text).width;
	if (tw > W * 0.86) {
		size *= (W * 0.86) / tw;
		ctx.font = `800 ${size}px ${FONT}, sans-serif`;
	}
	// default spot ~53% down; shift up/down if a face sits there
	const capH = size * 1.1;
	const box = (cy) => ({x0: 0.5 - tw / W / 2 - 0.02, x1: 0.5 + tw / W / 2 + 0.02, y0: (cy - capH / 2) / H, y1: (cy + capH / 2) / H});
	const hits = (b) => faces.some((f) => f.x1 > b.x0 && f.x0 < b.x1 && f.y1 > b.y0 && f.y0 < b.y1);
	const candidates = [0.53, 0.6, 0.68, 0.76, 0.45, 0.36, 0.84, 0.26];
	let cyFrac = candidates[0];
	for (const c of candidates) {
		if (!hits(box(c * H))) {
			cyFrac = c;
			break;
		}
	}
	const cy = cyFrac * H;
	ctx.save();
	ctx.translate(W / 2, cy);
	ctx.scale(scale, scale);
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	ctx.shadowColor = 'rgba(0,0,0,0.55)';
	ctx.shadowBlur = 18 * k;
	ctx.shadowOffsetY = 8 * k;
	ctx.lineWidth = 16 * k; // 8 px visible outside the glyph
	ctx.strokeStyle = '#111111';
	ctx.strokeText(w.text, 0, 0);
	ctx.shadowColor = 'transparent';
	ctx.fillStyle = w.key ? '#ffd23a' : '#ffffff';
	ctx.fillText(w.text, 0, 0);
	ctx.restore();
	return {text: w.text, y: cyFrac};
}
