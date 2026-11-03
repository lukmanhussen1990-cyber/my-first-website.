// Simple 2D cartoon faces drawn on a canvas, used as the front texture of the rounded head.
// Faces are built from parts (eyes / brows / mouth / extras) so expressions can be swapped,
// blinked and lip-synced. Every texture is cached by its exact parameters (deterministic).
import * as THREE from 'three';

export type EyeKind = 'dot' | 'wide' | 'happy' | 'closed' | 'blink' | 'squeeze' | 'half' | 'sad' | 'sparkle' | 'cry' | 'angry' | 'tired' | 'side';
export type BrowKind = 'normal' | 'raised' | 'sad' | 'angry' | 'smug' | 'worried' | 'none' | 'flat';
export type MouthKind =
	| 'smile' | 'bigSmile' | 'o' | 'shocked' | 'frown' | 'wail' | 'flat' | 'smirk' | 'wavy' | 'shout' | 'whisper' | 'sleep' | 'grin' | 'tiny'
	| 'talk1' | 'talk2' | 'happyTalk1' | 'happyTalk2';

export type FaceParts = {
	eyes: EyeKind;
	brows: BrowKind;
	mouth: MouthKind;
	blush?: number; // 0..1
	tears?: boolean;
	sweat?: boolean;
	green?: boolean; // disgusted green cheeks
	bags?: boolean; // tired eye bags
	lookX?: number; // -1..1 pupils
	lookY?: number;
};

export type FaceStyle = {
	skin: string;
	eye: string;
	brow: string;
	browWidth: number;
	lashes: boolean;
	lip: string; // mouth line / inside colour
	blush: string;
	mouthY: number; // offset (512 space)
	eyeY: number;
	eyeGap: number;
	eyeScale: number;
	featureScale: number; // scales all features about the face centre
	stubble?: boolean;
	freckles?: boolean;
	wrinkles?: boolean;
};

export const DEFAULT_STYLE: FaceStyle = {
	skin: '#ffcf9e', eye: '#1b1b22', brow: '#2a1f1a', browWidth: 9, lashes: false, lip: '#3a1414',
	blush: '#ff7d9a', mouthY: 6, eyeY: 6, eyeGap: 64, eyeScale: 1.08, featureScale: 1.25,
};

/** where a point of the 512 face layout ends up after feature scaling */
export function featureXY(st: FaceStyle, px: number, py: number): [number, number] {
	return [256 + (px - 256) * st.featureScale, 256 + (py - 256) * st.featureScale];
}

export type Expression =
	| 'neutral' | 'happy' | 'bigSmile' | 'shocked' | 'sad' | 'crying' | 'happyCry' | 'sleeping' | 'whisper'
	| 'smug' | 'disgusted' | 'tired' | 'excited' | 'shout' | 'determined' | 'worried' | 'proud' | 'awe' | 'laugh' | 'frown';

export const EXPRESSIONS: Record<Expression, FaceParts> = {
	neutral: {eyes: 'dot', brows: 'normal', mouth: 'smile', blush: 0.55},
	happy: {eyes: 'dot', brows: 'normal', mouth: 'smile', blush: 0.75},
	bigSmile: {eyes: 'happy', brows: 'raised', mouth: 'bigSmile', blush: 0.9},
	laugh: {eyes: 'squeeze', brows: 'raised', mouth: 'bigSmile', blush: 0.9},
	shocked: {eyes: 'wide', brows: 'raised', mouth: 'shocked', blush: 0.3},
	awe: {eyes: 'sparkle', brows: 'raised', mouth: 'o', blush: 0.8},
	excited: {eyes: 'sparkle', brows: 'raised', mouth: 'bigSmile', blush: 1},
	sad: {eyes: 'sad', brows: 'sad', mouth: 'frown', blush: 0.35},
	frown: {eyes: 'dot', brows: 'angry', mouth: 'frown', blush: 0.3},
	worried: {eyes: 'dot', brows: 'worried', mouth: 'wavy', blush: 0.3, sweat: true},
	crying: {eyes: 'cry', brows: 'sad', mouth: 'wail', blush: 0.6, tears: true},
	happyCry: {eyes: 'happy', brows: 'sad', mouth: 'bigSmile', blush: 0.9, tears: true},
	sleeping: {eyes: 'closed', brows: 'flat', mouth: 'sleep', blush: 0.6},
	whisper: {eyes: 'side', brows: 'raised', mouth: 'whisper', blush: 0.4, lookX: -1},
	smug: {eyes: 'half', brows: 'smug', mouth: 'smirk', blush: 0.6},
	proud: {eyes: 'happy', brows: 'raised', mouth: 'grin', blush: 0.8},
	disgusted: {eyes: 'squeeze', brows: 'angry', mouth: 'wavy', blush: 0, green: true},
	tired: {eyes: 'tired', brows: 'sad', mouth: 'flat', blush: 0.2, bags: true, sweat: true},
	shout: {eyes: 'angry', brows: 'angry', mouth: 'shout', blush: 0.5},
	determined: {eyes: 'dot', brows: 'angry', mouth: 'smirk', blush: 0.4},
};

const SIZE = 1024; // canvas px (drawn in a 512 space scaled x2)

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function drawEye(ctx: CanvasRenderingContext2D, kind: EyeKind, side: -1 | 1, cx: number, cy: number, st: FaceStyle, p: FaceParts) {
	const s = st.eyeScale;
	const lx = (p.lookX ?? 0) * 9 * s;
	const ly = (p.lookY ?? 0) * 7 * s;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	const black = st.eye;
	const highlight = (x: number, y: number, r1: number, r2: number) => {
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(x + 6 * s, y - 10 * s, r1 * s, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(x - 6 * s, y + 9 * s, r2 * s, 0, Math.PI * 2);
		ctx.fill();
	};
	const lashes = (x: number, y: number, ry: number) => {
		if (!st.lashes) return;
		ctx.strokeStyle = black;
		ctx.lineWidth = 5;
		const ox = side * 1;
		ctx.beginPath();
		ctx.moveTo(x + ox * 12 * s, y - ry * 0.75);
		ctx.lineTo(x + ox * 24 * s, y - ry * 1.05);
		ctx.moveTo(x + ox * 17 * s, y - ry * 0.45);
		ctx.lineTo(x + ox * 30 * s, y - ry * 0.65);
		ctx.stroke();
	};
	switch (kind) {
		case 'dot':
		case 'sad':
		case 'angry':
		case 'half':
		case 'tired':
		case 'side': {
			const rx = (kind === 'sad' ? 17 : 19) * s;
			const ry = (kind === 'sad' ? 25 : 29) * s;
			const y = cy + (kind === 'sad' ? 6 : 0);
			ctx.save();
			if (kind === 'half' || kind === 'tired' || kind === 'side') {
				// upper lid covers the top half
				ctx.beginPath();
				ctx.rect(cx - 40, y - 4 * s, 80, 80);
				ctx.clip();
			}
			ctx.fillStyle = black;
			ctx.beginPath();
			ctx.ellipse(cx + lx, y + ly, rx, ry, 0, 0, Math.PI * 2);
			ctx.fill();
			highlight(cx + lx, y + ly, 6.5, 3);
			ctx.restore();
			if (kind === 'angry') {
				// angled lid
				// cover the inner-top corner so the lid slopes down toward the nose
				ctx.fillStyle = st.skin;
				ctx.beginPath();
				ctx.moveTo(cx + side * 34, y - 60);
				ctx.lineTo(cx - side * 34, y - 60);
				ctx.lineTo(cx - side * 34, y - 2 * s);
				ctx.lineTo(cx + side * 34, y - 26 * s);
				ctx.closePath();
				ctx.fill();
				ctx.strokeStyle = black;
				ctx.lineWidth = 7;
				ctx.beginPath();
				ctx.moveTo(cx + side * 24 * s, y - 22 * s);
				ctx.lineTo(cx - side * 22 * s, y - 5 * s);
				ctx.stroke();
			}
			if (kind === 'half' || kind === 'tired' || kind === 'side') {
				ctx.strokeStyle = black;
				ctx.lineWidth = 7;
				ctx.beginPath();
				ctx.moveTo(cx - 24 * s, y - 3 * s + (kind === 'side' ? side * 2 : 0));
				ctx.quadraticCurveTo(cx, y - 8 * s, cx + 24 * s, y - 3 * s - (kind === 'side' ? side * 2 : 0));
				ctx.stroke();
			}
			if (kind === 'tired' || p.bags) {
				ctx.strokeStyle = 'rgba(120,80,140,0.55)';
				ctx.lineWidth = 5;
				ctx.beginPath();
				ctx.moveTo(cx - 20 * s, y + 34 * s);
				ctx.quadraticCurveTo(cx, y + 44 * s, cx + 20 * s, y + 34 * s);
				ctx.stroke();
			}
			lashes(cx + lx, y + ly, ry);
			break;
		}
		case 'wide': {
			ctx.fillStyle = '#ffffff';
			ctx.strokeStyle = black;
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.ellipse(cx, cy - 2, 33 * s, 40 * s, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = black;
			ctx.beginPath();
			ctx.ellipse(cx + lx * 1.4, cy + ly * 1.4, 12 * s, 14 * s, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(cx + lx * 1.4 + 4 * s, cy + ly * 1.4 - 5 * s, 4 * s, 0, Math.PI * 2);
			ctx.fill();
			break;
		}
		case 'sparkle': {
			ctx.fillStyle = black;
			ctx.beginPath();
			ctx.ellipse(cx + lx, cy + ly, 30 * s, 40 * s, 0, 0, Math.PI * 2);
			ctx.fill();
			// coloured iris glow
			const g = ctx.createRadialGradient(cx + lx, cy + ly + 14 * s, 2, cx + lx, cy + ly + 10 * s, 30 * s);
			g.addColorStop(0, 'rgba(110,170,255,0.95)');
			g.addColorStop(1, 'rgba(110,170,255,0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.ellipse(cx + lx, cy + ly + 8 * s, 26 * s, 30 * s, 0, 0, Math.PI * 2);
			ctx.fill();
			// star highlight
			const sx = cx + lx + 9 * s;
			const sy = cy + ly - 14 * s;
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			for (let i = 0; i < 8; i++) {
				const r = i % 2 === 0 ? 15 * s : 5 * s;
				const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
				ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
			}
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.arc(cx + lx - 10 * s, cy + ly + 14 * s, 6 * s, 0, Math.PI * 2);
			ctx.fill();
			lashes(cx + lx, cy + ly, 40 * s);
			break;
		}
		case 'happy': {
			ctx.strokeStyle = black;
			ctx.lineWidth = 11 * s;
			ctx.beginPath();
			ctx.moveTo(cx - 24 * s, cy + 8 * s);
			ctx.quadraticCurveTo(cx, cy - 28 * s, cx + 24 * s, cy + 8 * s);
			ctx.stroke();
			break;
		}
		case 'closed': {
			ctx.strokeStyle = black;
			ctx.lineWidth = 9 * s;
			ctx.beginPath();
			ctx.moveTo(cx - 24 * s, cy - 2 * s);
			ctx.quadraticCurveTo(cx, cy + 22 * s, cx + 24 * s, cy - 2 * s);
			ctx.stroke();
			if (st.lashes) {
				ctx.lineWidth = 5;
				ctx.beginPath();
				ctx.moveTo(cx + side * 22 * s, cy);
				ctx.lineTo(cx + side * 32 * s, cy - 6 * s);
				ctx.stroke();
			}
			break;
		}
		case 'blink': {
			ctx.strokeStyle = black;
			ctx.lineWidth = 9 * s;
			ctx.beginPath();
			ctx.moveTo(cx - 22 * s, cy + 4 * s);
			ctx.quadraticCurveTo(cx, cy + 12 * s, cx + 22 * s, cy + 4 * s);
			ctx.stroke();
			break;
		}
		case 'squeeze':
		case 'cry': {
			ctx.strokeStyle = black;
			ctx.lineWidth = 10 * s;
			ctx.beginPath();
			if (kind === 'squeeze') {
				// > <
				ctx.moveTo(cx - side * 20 * s, cy - 20 * s);
				ctx.lineTo(cx + side * 16 * s, cy);
				ctx.lineTo(cx - side * 20 * s, cy + 20 * s);
			} else {
				// squeezed shut, curving down (crying)
				ctx.moveTo(cx - 26 * s, cy + 6 * s);
				ctx.quadraticCurveTo(cx, cy - 16 * s, cx + 26 * s, cy + 6 * s);
				ctx.moveTo(cx - side * 6 * s, cy - 6 * s);
				ctx.lineTo(cx - side * 22 * s, cy - 18 * s);
			}
			ctx.stroke();
			break;
		}
	}
}

function drawBrow(ctx: CanvasRenderingContext2D, kind: BrowKind, side: -1 | 1, cx: number, cy: number, st: FaceStyle) {
	if (kind === 'none') return;
	ctx.strokeStyle = st.brow;
	ctx.lineWidth = st.browWidth;
	ctx.lineCap = 'round';
	// inner end is toward the face centre: for side=-1 (left eye) inner is +x
	const inner = cx - side * 22;
	const outer = cx + side * 22;
	let yi = cy;
	let yo = cy;
	let bend = -6;
	switch (kind) {
		case 'normal':
			yi = cy + 1; yo = cy + 1; break;
		case 'flat':
			yi = cy + 6; yo = cy + 6; bend = 0; break;
		case 'raised':
			yi = cy - 14; yo = cy - 10; bend = -9; break;
		case 'sad':
			yi = cy - 12; yo = cy + 8; bend = -2; break;
		case 'worried':
			yi = cy - 16; yo = cy + 2; bend = -4; break;
		case 'angry':
			yi = cy + 14; yo = cy - 8; bend = 2; break;
		case 'smug':
			if (side === 1) { yi = cy - 14; yo = cy - 18; bend = -10; } else { yi = cy + 6; yo = cy + 4; bend = 0; }
			break;
	}
	ctx.beginPath();
	ctx.moveTo(outer, yo);
	ctx.quadraticCurveTo(cx, Math.min(yi, yo) + bend, inner, yi);
	ctx.stroke();
}

function drawMouth(ctx: CanvasRenderingContext2D, kind: MouthKind, cx: number, cy: number, st: FaceStyle) {
	const dark = st.lip;
	const inside = '#5a1820';
	const tongue = '#ff6f86';
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	const openShape = (w: number, h: number, happy: boolean) => {
		ctx.save();
		ctx.beginPath();
		if (happy) {
			ctx.moveTo(cx - w, cy - h * 0.25);
			ctx.quadraticCurveTo(cx, cy - h * 0.38, cx + w, cy - h * 0.25);
			ctx.quadraticCurveTo(cx + w * 0.92, cy + h, cx, cy + h);
			ctx.quadraticCurveTo(cx - w * 0.92, cy + h, cx - w, cy - h * 0.25);
		} else {
			ctx.ellipse(cx, cy + h * 0.35, w, h * 0.7, 0, 0, Math.PI * 2);
		}
		ctx.closePath();
		ctx.fillStyle = inside;
		ctx.fill();
		ctx.clip();
		ctx.fillStyle = tongue;
		ctx.beginPath();
		ctx.ellipse(cx, cy + h * 1.0, w * 0.62, h * 0.42, 0, 0, Math.PI * 2);
		ctx.fill();
		if (happy) {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(cx - w, cy - h * 0.5, w * 2, h * 0.38);
		}
		ctx.restore();
		ctx.strokeStyle = dark;
		ctx.lineWidth = 6;
		ctx.stroke();
	};
	switch (kind) {
		case 'smile':
			ctx.strokeStyle = dark;
			ctx.lineWidth = 9;
			ctx.beginPath();
			ctx.moveTo(cx - 30, cy - 6);
			ctx.quadraticCurveTo(cx, cy + 22, cx + 30, cy - 6);
			ctx.stroke();
			break;
		case 'tiny':
			ctx.strokeStyle = dark;
			ctx.lineWidth = 8;
			ctx.beginPath();
			ctx.moveTo(cx - 14, cy);
			ctx.quadraticCurveTo(cx, cy + 9, cx + 14, cy);
			ctx.stroke();
			break;
		case 'frown':
			ctx.strokeStyle = dark;
			ctx.lineWidth = 9;
			ctx.beginPath();
			ctx.moveTo(cx - 26, cy + 14);
			ctx.quadraticCurveTo(cx, cy - 10, cx + 26, cy + 14);
			ctx.stroke();
			break;
		case 'flat':
			ctx.strokeStyle = dark;
			ctx.lineWidth = 9;
			ctx.beginPath();
			ctx.moveTo(cx - 22, cy + 4);
			ctx.lineTo(cx + 22, cy + 4);
			ctx.stroke();
			break;
		case 'smirk':
			ctx.strokeStyle = dark;
			ctx.lineWidth = 9;
			ctx.beginPath();
			ctx.moveTo(cx - 26, cy + 4);
			ctx.quadraticCurveTo(cx + 6, cy + 14, cx + 30, cy - 10);
			ctx.stroke();
			break;
		case 'wavy':
			ctx.strokeStyle = dark;
			ctx.lineWidth = 8;
			ctx.beginPath();
			ctx.moveTo(cx - 32, cy + 6);
			for (let i = 1; i <= 4; i++) ctx.quadraticCurveTo(cx - 32 + (i - 0.5) * 16, cy + (i % 2 ? -8 : 18), cx - 32 + i * 16, cy + 6);
			ctx.stroke();
			break;
		case 'grin': {
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(cx - 40, cy - 8);
			ctx.quadraticCurveTo(cx, cy - 2, cx + 40, cy - 8);
			ctx.quadraticCurveTo(cx + 34, cy + 30, cx, cy + 30);
			ctx.quadraticCurveTo(cx - 34, cy + 30, cx - 40, cy - 8);
			ctx.closePath();
			ctx.fillStyle = '#ffffff';
			ctx.fill();
			ctx.clip();
			ctx.strokeStyle = 'rgba(80,40,40,0.5)';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(cx - 40, cy + 10);
			ctx.lineTo(cx + 40, cy + 10);
			ctx.stroke();
			ctx.restore();
			ctx.strokeStyle = dark;
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.moveTo(cx - 40, cy - 8);
			ctx.quadraticCurveTo(cx, cy - 2, cx + 40, cy - 8);
			ctx.quadraticCurveTo(cx + 34, cy + 30, cx, cy + 30);
			ctx.quadraticCurveTo(cx - 34, cy + 30, cx - 40, cy - 8);
			ctx.stroke();
			break;
		}
		case 'bigSmile':
			openShape(44, 44, true);
			break;
		case 'happyTalk1':
			openShape(32, 22, true);
			break;
		case 'happyTalk2':
			openShape(38, 38, true);
			break;
		case 'talk1':
			openShape(17, 16, false);
			break;
		case 'talk2':
			openShape(22, 30, false);
			break;
		case 'o':
			openShape(17, 22, false);
			break;
		case 'shocked':
			openShape(25, 44, false);
			break;
		case 'sleep':
			openShape(12, 13, false);
			break;
		case 'whisper':
			ctx.save();
			ctx.translate(16, 2);
			openShape(14, 15, false);
			ctx.restore();
			break;
		case 'wail': {
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(cx - 40, cy + 24);
			ctx.quadraticCurveTo(cx - 34, cy - 12, cx, cy - 12);
			ctx.quadraticCurveTo(cx + 34, cy - 12, cx + 40, cy + 24);
			ctx.quadraticCurveTo(cx, cy + 36, cx - 40, cy + 24);
			ctx.closePath();
			ctx.fillStyle = inside;
			ctx.fill();
			ctx.clip();
			ctx.fillStyle = tongue;
			ctx.beginPath();
			ctx.ellipse(cx, cy + 32, 24, 14, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#fff';
			ctx.fillRect(cx - 30, cy - 14, 60, 9);
			ctx.restore();
			ctx.strokeStyle = dark;
			ctx.lineWidth = 6;
			ctx.stroke();
			break;
		}
		case 'shout': {
			const w = 58;
			const h = 62;
			ctx.save();
			rr(ctx, cx - w, cy - 18, w * 2, h, 26);
			ctx.fillStyle = inside;
			ctx.fill();
			ctx.clip();
			ctx.fillStyle = tongue;
			ctx.beginPath();
			ctx.ellipse(cx, cy + h - 10, 34, 18, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(cx - w, cy - 18, w * 2, 13);
			ctx.fillRect(cx - w, cy + h - 26, w * 2, 9);
			ctx.restore();
			rr(ctx, cx - w, cy - 18, w * 2, h, 26);
			ctx.strokeStyle = dark;
			ctx.lineWidth = 6;
			ctx.stroke();
			break;
		}
	}
}

function drawTears(ctx: CanvasRenderingContext2D, cx: number, cy: number, gap: number, phase: number) {
	for (const side of [-1, 1]) {
		const x0 = cx + side * (gap + 6);
		const y0 = cy + 22;
		ctx.save();
		// stream body
		const grad = ctx.createLinearGradient(x0 - 14, 0, x0 + 14, 0);
		grad.addColorStop(0, '#3aa0ff');
		grad.addColorStop(0.5, '#8fd3ff');
		grad.addColorStop(1, '#3aa0ff');
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.moveTo(x0 - 10, y0);
		for (let y = y0; y <= 520; y += 8) {
			const wob = Math.sin((y + phase * 26.18) * 0.06) * 4;
			ctx.lineTo(x0 - 12 - side * 6 * ((y - y0) / 300) + wob, y);
		}
		for (let y = 520; y >= y0; y -= 8) {
			const wob = Math.sin((y + phase * 26.18) * 0.06) * 4;
			ctx.lineTo(x0 + 12 - side * 6 * ((y - y0) / 300) + wob, y);
		}
		ctx.closePath();
		ctx.fill();
		// moving highlights
		ctx.fillStyle = 'rgba(255,255,255,0.8)';
		for (let k = 0; k < 4; k++) {
			const y = y0 + ((k * 70 + phase * 17.5) % 280) + 10;
			ctx.beginPath();
			ctx.ellipse(x0 - 3 - side * 6 * ((y - y0) / 300), y, 3.5, 9, 0, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}
}

function drawSweat(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.save();
	const g = ctx.createLinearGradient(x, y - 30, x, y + 20);
	g.addColorStop(0, '#bfe9ff');
	g.addColorStop(1, '#4fb2ff');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.moveTo(x, y - 30);
	ctx.quadraticCurveTo(x + 16, y, x + 14, y + 8);
	ctx.arc(x, y + 8, 14, 0, Math.PI);
	ctx.quadraticCurveTo(x - 16, y, x, y - 30);
	ctx.fill();
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.beginPath();
	ctx.ellipse(x - 5, y + 5, 3, 6, 0.3, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

export function drawFace(canvas: HTMLCanvasElement, st: FaceStyle, p: FaceParts, tearPhase = 0, size = SIZE) {
	const ctx = canvas.getContext('2d')!;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.fillStyle = st.skin;
	ctx.fillRect(0, 0, size, size);
	ctx.scale(size / 512, size / 512);
	ctx.translate(256, 256);
	ctx.scale(st.featureScale, st.featureScale);
	ctx.translate(-256, -256);
	const cx = 256;
	const eyeY = 236 + st.eyeY;
	const browY = 178 + st.eyeY;
	const mouthY = 322 + st.mouthY;
	const gap = st.eyeGap;

	// cheeks
	const blush = p.blush ?? 0.5;
	if (p.green) {
		// sickly green wash (fades out well before the texture edge) + gloom lines
		ctx.save();
		ctx.translate(cx, mouthY - 30);
		ctx.scale(1, 0.62);
		const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 165);
		g.addColorStop(0, 'rgba(120,205,90,0.5)');
		g.addColorStop(0.6, 'rgba(120,205,90,0.28)');
		g.addColorStop(1, 'rgba(120,205,90,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(0, 0, 165, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		ctx.strokeStyle = 'rgba(90,70,170,0.55)';
		ctx.lineWidth = 4;
		for (const side of [-1, 1]) {
			for (let k = 0; k < 3; k++) {
				const x = cx + side * (gap - 14 + k * 14);
				ctx.beginPath();
				ctx.moveTo(x, eyeY + 30);
				ctx.lineTo(x, eyeY + 50);
				ctx.stroke();
			}
		}
	}
	if (blush > 0) {
		for (const side of [-1, 1]) {
			const bx = cx + side * (gap + 58);
			const by = eyeY + 62;
			const g = ctx.createRadialGradient(bx, by, 2, bx, by, 40);
			g.addColorStop(0, hexA(st.blush, 0.75 * blush));
			g.addColorStop(0.6, hexA(st.blush, 0.45 * blush));
			g.addColorStop(1, hexA(st.blush, 0));
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.ellipse(bx, by, 40, 26, 0, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	if (st.freckles) {
		ctx.fillStyle = 'rgba(160,90,50,0.55)';
		for (const side of [-1, 1]) {
			for (const [dx, dy] of [[-10, -4], [6, -8], [0, 8], [14, 6]] as const) {
				ctx.beginPath();
				ctx.arc(cx + side * (gap + 50) + dx, eyeY + 56 + dy, 3.2, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
	if (st.stubble) {
		const g = ctx.createRadialGradient(cx, mouthY + 26, 20, cx, mouthY + 20, 150);
		g.addColorStop(0, 'rgba(90,70,60,0.22)');
		g.addColorStop(1, 'rgba(90,70,60,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(cx, mouthY + 30, 150, 90, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	if (st.wrinkles) {
		ctx.strokeStyle = 'rgba(150,90,60,0.45)';
		ctx.lineWidth = 3.5;
		for (const side of [-1, 1]) {
			for (let k = 0; k < 2; k++) {
				ctx.beginPath();
				const x = cx + side * (gap + 34 + k * 6);
				ctx.moveTo(x, eyeY - 8 + k * 14);
				ctx.lineTo(x + side * 12, eyeY - 12 + k * 16);
				ctx.stroke();
			}
		}
		ctx.beginPath();
		ctx.moveTo(cx - 30, browY - 42);
		ctx.quadraticCurveTo(cx, browY - 48, cx + 30, browY - 42);
		ctx.stroke();
	}

	for (const side of [-1, 1] as const) drawEye(ctx, p.eyes, side, cx + side * gap, eyeY, st, p);
	for (const side of [-1, 1] as const) drawBrow(ctx, p.brows, side, cx + side * gap, browY, st);
	drawMouth(ctx, p.mouth, cx, mouthY, st);
	if (p.tears) drawTears(ctx, cx, eyeY, gap, tearPhase);
	if (p.sweat) drawSweat(ctx, cx + gap + 70, browY - 20);
}

function hexA(hex: string, a: number) {
	const c = new THREE.Color(hex);
	return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// ------------------------------------------------------------- material cache (LRU)
type Entry = {tex: THREE.CanvasTexture; mat: THREE.MeshStandardMaterial; used: number};
const cache = new Map<string, Entry>();
let tick = 0;
const MAX = 260;

/** size: texture resolution (1024 for close characters, 256 for far crowd members) */
export function faceMaterial(st: FaceStyle, p: FaceParts, tearPhase = 0, size = SIZE): THREE.MeshStandardMaterial {
	const key = JSON.stringify([st, p, p.tears ? tearPhase : 0, size]);
	tick++;
	const hit = cache.get(key);
	if (hit) {
		hit.used = tick;
		return hit.mat;
	}
	if (cache.size >= MAX) {
		// evict least recently used
		let oldK = '';
		let oldU = Infinity;
		for (const [k, e] of cache) if (e.used < oldU) { oldU = e.used; oldK = k; }
		const e = cache.get(oldK)!;
		e.tex.dispose();
		e.mat.dispose();
		cache.delete(oldK);
	}
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	drawFace(canvas, st, p, tearPhase, size);
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	tex.needsUpdate = true;
	const mat = new THREE.MeshStandardMaterial({map: tex, roughness: 0.45, metalness: 0});
	cache.set(key, {tex, mat, used: tick});
	return mat;
}
