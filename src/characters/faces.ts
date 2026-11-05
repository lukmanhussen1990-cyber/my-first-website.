import {canvasTex} from '../three/textures';

/* Simple 2D cartoon faces drawn on a canvas (Roblox-style): eyes, brows, mouth, blush. */

export type Expr = 'neutral' | 'happy' | 'laugh' | 'bored' | 'sleep' | 'shocked' | 'angry' | 'worried' | 'cryHappy' | 'proud' | 'sad' | 'cool' | 'smile';
export type FaceStyle = 'owner' | 'mayor' | 'girl' | 'mom' | 'man' | 'woman' | 'kid';

const INK = '#1d1410';

const line = (ctx: CanvasRenderingContext2D, w: number, pts: [number, number][], width: number, color = INK) => {
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.beginPath();
	pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * w) : ctx.moveTo(x * w, y * w)));
	ctx.stroke();
};
const quad = (ctx: CanvasRenderingContext2D, w: number, a: [number, number], c: [number, number], b: [number, number], width: number, color = INK) => {
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(a[0] * w, a[1] * w);
	ctx.quadraticCurveTo(c[0] * w, c[1] * w, b[0] * w, b[1] * w);
	ctx.stroke();
};
const ell = (ctx: CanvasRenderingContext2D, w: number, x: number, y: number, rx: number, ry: number, color: string, rot = 0) => {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(x * w, y * w, rx * w, ry * w, rot, 0, Math.PI * 2);
	ctx.fill();
};
const star = (ctx: CanvasRenderingContext2D, w: number, x: number, y: number, R: number, color: string) => {
	ctx.fillStyle = color;
	ctx.strokeStyle = 'rgba(80,80,90,0.6)';
	ctx.lineWidth = w * 0.006;
	ctx.beginPath();
	for (let i = 0; i < 10; i++) {
		const a = (i * Math.PI) / 5 - Math.PI / 2;
		const r = i % 2 ? R * 0.45 : R;
		ctx.lineTo((x + Math.cos(a) * r) * w, (y + Math.sin(a) * r) * w);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
};

const EYE_Y = 0.44;
const EX = 0.17; // eye x offset from centre

export const faceTex = (style: FaceStyle, expr: Expr, blink: boolean, mouthOpen: boolean) =>
	canvasTex(`face|${style}|${expr}|${blink}|${mouthOpen}`, 512, 512, (ctx, w) => {
		const girlish = style === 'girl' || style === 'mom' || style === 'woman';
		const eyeR = style === 'girl' || style === 'kid' ? 0.058 : 0.05;
		const L = 0.5 - EX;
		const R = 0.5 + EX;
		let e = expr;
		if (style === 'owner' && e === 'neutral') e = 'cool';

		// Blush
		const blushy = ['happy', 'laugh', 'cryHappy', 'proud', 'smile'].includes(e) || style === 'girl';
		if (blushy) {
			ell(ctx, w, L - 0.06, 0.58, 0.075, 0.042, 'rgba(255,120,140,0.55)');
			ell(ctx, w, R + 0.06, 0.58, 0.075, 0.042, 'rgba(255,120,140,0.55)');
		}
		// Owner's star sticker on the cheek
		if (style === 'owner') star(ctx, w, 0.27, 0.57, 0.055, '#f4f6fb');

		// ---- Eyes ----
		const openEyes = (r = eyeR, dy = 0) => {
			[L, R].forEach((x) => {
				ell(ctx, w, x, EYE_Y + dy, r * 0.82, r * 1.15, INK);
				ell(ctx, w, x - r * 0.25, EYE_Y + dy - r * 0.4, r * 0.28, r * 0.3, '#ffffff');
			});
			if (girlish) {
				[L, R].forEach((x, i) => {
					const s = i ? 1 : -1;
					line(ctx, w, [[x + s * r * 0.6, EYE_Y - r * 0.9], [x + s * r * 1.25, EYE_Y - r * 1.5]], w * 0.014);
				});
			}
		};
		const closedDown = () => [L, R].forEach((x) => quad(ctx, w, [x - 0.055, EYE_Y], [x, EYE_Y + 0.04], [x + 0.055, EYE_Y], w * 0.022));
		const closedUp = () => [L, R].forEach((x) => quad(ctx, w, [x - 0.06, EYE_Y + 0.02], [x, EYE_Y - 0.06], [x + 0.06, EYE_Y + 0.02], w * 0.024));

		if (blink && !['sleep', 'laugh', 'cryHappy', 'proud'].includes(e)) {
			[L, R].forEach((x) => line(ctx, w, [[x - 0.045, EYE_Y + 0.005], [x + 0.045, EYE_Y + 0.005]], w * 0.02));
		} else {
			switch (e) {
				case 'sleep':
					closedDown();
					break;
				case 'laugh':
				case 'cryHappy':
				case 'proud':
					closedUp();
					break;
				case 'shocked':
					[L, R].forEach((x) => {
						ell(ctx, w, x, EYE_Y - 0.01, 0.075, 0.085, '#ffffff');
						ctx.strokeStyle = INK;
						ctx.lineWidth = w * 0.014;
						ctx.beginPath();
						ctx.ellipse(x * w, (EYE_Y - 0.01) * w, 0.075 * w, 0.085 * w, 0, 0, Math.PI * 2);
						ctx.stroke();
						ell(ctx, w, x, EYE_Y - 0.005, 0.024, 0.028, INK);
					});
					break;
				case 'bored':
				case 'cool':
					[L, R].forEach((x, i) => {
						// half-lidded: dark lower half-oval + flat lid line
						ctx.fillStyle = INK;
						ctx.beginPath();
						ctx.ellipse(x * w, EYE_Y * w, eyeR * 0.95 * w, eyeR * 1.05 * w, 0, 0, Math.PI);
						ctx.fill();
						ell(ctx, w, x - eyeR * 0.35, EYE_Y + eyeR * 0.35, eyeR * 0.2, eyeR * 0.18, '#ffffff');
						const s = i ? 1 : -1;
						line(ctx, w, [[x - 0.075, EYE_Y - 0.012 + (e === 'cool' ? s * -0.004 : 0)], [x + 0.075, EYE_Y - 0.012]], w * 0.017);
					});
					break;
				default:
					openEyes();
			}
		}
		// Tears
		if (e === 'cryHappy') {
			[L, R].forEach((x) => {
				ctx.fillStyle = 'rgba(110,200,255,0.9)';
				ctx.beginPath();
				ctx.moveTo((x - 0.02) * w, (EYE_Y + 0.03) * w);
				ctx.quadraticCurveTo((x - 0.06) * w, 0.62 * w, (x - 0.035) * w, 0.68 * w);
				ctx.quadraticCurveTo((x - 0.0) * w, 0.62 * w, (x + 0.01) * w, (EYE_Y + 0.03) * w);
				ctx.fill();
			});
		}
		if (e === 'sad') {
			ell(ctx, w, L + 0.03, 0.55, 0.012, 0.02, 'rgba(110,200,255,0.9)');
		}

		// ---- Brows ----
		const by = EYE_Y - 0.1;
		const brow = (kind: 'angry' | 'worried' | 'up' | 'flat' | 'raised') => {
			const bw = style === 'mayor' ? w * 0.03 : w * 0.02;
			[L, R].forEach((x, i) => {
				const s = i ? 1 : -1; // outer direction
				let inner = by;
				let outer = by;
				if (kind === 'angry') {
					inner = by + 0.035;
					outer = by - 0.02;
				} else if (kind === 'worried') {
					inner = by - 0.03;
					outer = by + 0.015;
				} else if (kind === 'up') {
					inner = by - 0.035;
					outer = by - 0.035;
				} else if (kind === 'raised') {
					inner = by - 0.01 - (i ? 0.025 : 0);
					outer = by - 0.02 - (i ? 0.025 : 0);
				}
				line(ctx, w, [[x - s * 0.02, inner], [x + s * 0.06, outer]], bw, style === 'mayor' ? '#6c6c6c' : INK);
			});
		};
		if (e === 'angry') brow('angry');
		else if (e === 'worried' || e === 'sad') brow('worried');
		else if (e === 'shocked') brow('up');
		else if (style === 'mayor') brow(e === 'happy' || e === 'smile' ? 'raised' : e === 'bored' || e === 'neutral' || e === 'sleep' ? 'angry' : 'flat');
		else if (style === 'mom' || style === 'woman' || style === 'girl') {
			if (e !== 'sleep') brow('flat');
		}

		// ---- Mayor's thin mustache ----
		const mustache = () => {
			ctx.fillStyle = '#5a5a5a';
			ctx.beginPath();
			ctx.moveTo(0.5 * w, 0.585 * w);
			ctx.quadraticCurveTo(0.42 * w, 0.56 * w, 0.33 * w, 0.6 * w);
			ctx.quadraticCurveTo(0.31 * w, 0.585 * w, 0.32 * w, 0.57 * w);
			ctx.quadraticCurveTo(0.42 * w, 0.535 * w, 0.5 * w, 0.56 * w);
			ctx.quadraticCurveTo(0.58 * w, 0.535 * w, 0.68 * w, 0.57 * w);
			ctx.quadraticCurveTo(0.69 * w, 0.585 * w, 0.67 * w, 0.6 * w);
			ctx.quadraticCurveTo(0.58 * w, 0.56 * w, 0.5 * w, 0.585 * w);
			ctx.fill();
		};

		// ---- Mouth ----
		const MY = style === 'mayor' ? 0.66 : 0.63;
		const openMouth = (wd: number, ht: number, y = MY) => {
			ctx.fillStyle = '#3a1010';
			ctx.beginPath();
			ctx.moveTo((0.5 - wd) * w, y * w);
			ctx.quadraticCurveTo(0.5 * w, (y + ht * 2) * w, (0.5 + wd) * w, y * w);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = '#ff7a8a';
			ctx.beginPath();
			ctx.ellipse(0.5 * w, (y + ht * 0.8) * w, wd * 0.55 * w, ht * 0.35 * w, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#ffffff';
			ctx.fillRect((0.5 - wd * 0.7) * w, y * w, wd * 1.4 * w, ht * 0.25 * w);
		};
		switch (e) {
			case 'laugh':
				openMouth(0.12, 0.08);
				break;
			case 'cryHappy':
				openMouth(0.1, 0.06);
				break;
			case 'shocked':
				ell(ctx, w, 0.5, MY + 0.03, 0.04, mouthOpen ? 0.06 : 0.05, '#3a1010');
				break;
			case 'sleep':
				ell(ctx, w, 0.52, MY + 0.02, 0.022, mouthOpen ? 0.03 : 0.018, '#3a1010');
				break;
			case 'angry':
				if (mouthOpen) {
					ctx.fillStyle = '#3a1010';
					ctx.beginPath();
					ctx.ellipse(0.5 * w, (MY + 0.025) * w, 0.09 * w, 0.045 * w, 0, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillStyle = '#ffffff';
					ctx.fillRect(0.43 * w, (MY - 0.005) * w, 0.14 * w, 0.02 * w);
				} else quad(ctx, w, [0.42, MY + 0.03], [0.5, MY - 0.03], [0.58, MY + 0.03], w * 0.02);
				break;
			case 'sad':
				quad(ctx, w, [0.43, MY + 0.03], [0.5, MY - 0.02], [0.57, MY + 0.03], w * 0.018);
				break;
			case 'worried':
				if (mouthOpen) ell(ctx, w, 0.5, MY + 0.02, 0.04, 0.035, '#3a1010');
				else line(ctx, w, [[0.42, MY + 0.02], [0.46, MY], [0.5, MY + 0.02], [0.54, MY], [0.58, MY + 0.02]], w * 0.016);
				break;
			case 'bored':
				if (mouthOpen) ell(ctx, w, 0.5, MY + 0.015, 0.05, 0.022, '#3a1010');
				else line(ctx, w, [[0.43, MY + 0.01], [0.57, MY + 0.005]], w * 0.018);
				break;
			case 'cool':
				if (mouthOpen) openMouth(0.06, 0.035);
				else quad(ctx, w, [0.46, MY], [0.53, MY + 0.035], [0.59, MY - 0.01], w * 0.017);
				break;
			case 'neutral':
				if (mouthOpen) openMouth(0.06, 0.04);
				else quad(ctx, w, [0.44, MY], [0.5, MY + 0.025], [0.56, MY], w * 0.018);
				break;
			default:
				// happy / smile / proud
				if (mouthOpen) openMouth(0.08, 0.055);
				else quad(ctx, w, [0.4, MY - 0.01], [0.5, MY + 0.07], [0.6, MY - 0.01], w * 0.02);
		}
		if (style === 'mayor') mustache();
	});
