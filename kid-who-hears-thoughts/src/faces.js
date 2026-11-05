// Flat 2D cartoon faces drawn on a canvas (toy-style): eyes, brows, mouth, blush, sweat, tears, sparkles.
// drawFace(ctx, expression, opts) draws on a transparent 512x512 canvas.
// Expressions: neutral, happy, big-smile, sad, crying, shocked, worried, squint, sleepy, thinking,
//              blush, teary-smile, determined, dreamy, angry, talk

const INK = '#1d1410';
export const EXPRESSIONS = ['teary', 'neutral', 'happy', 'big-smile', 'sad', 'crying', 'shocked', 'worried', 'squint', 'sleepy', 'thinking', 'blush', 'teary-smile', 'determined', 'dreamy', 'angry'];

function stroke(ctx, w, pts, width, color = INK) {
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.beginPath();
	pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * w) : ctx.moveTo(x * w, y * w)));
	ctx.stroke();
}
function curve(ctx, w, a, c, b, width, color = INK) {
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(a[0] * w, a[1] * w);
	ctx.quadraticCurveTo(c[0] * w, c[1] * w, b[0] * w, b[1] * w);
	ctx.stroke();
}
function oval(ctx, w, x, y, rx, ry, color, rot = 0) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.ellipse(x * w, y * w, rx * w, ry * w, rot, 0, Math.PI * 2);
	ctx.fill();
}
function tear(ctx, w, x, y, s = 1) {
	ctx.fillStyle = 'rgba(110,200,255,0.95)';
	ctx.beginPath();
	ctx.moveTo(x * w, (y - 0.035 * s) * w);
	ctx.quadraticCurveTo((x + 0.028 * s) * w, (y + 0.01 * s) * w, x * w, (y + 0.03 * s) * w);
	ctx.quadraticCurveTo((x - 0.028 * s) * w, (y + 0.01 * s) * w, x * w, (y - 0.035 * s) * w);
	ctx.fill();
}
function sweat(ctx, w, x, y) {
	ctx.fillStyle = '#7fd6ff';
	ctx.strokeStyle = '#2a7ab0';
	ctx.lineWidth = w * 0.008;
	ctx.beginPath();
	ctx.moveTo(x * w, (y - 0.07) * w);
	ctx.quadraticCurveTo((x + 0.05) * w, y * w, x * w, (y + 0.045) * w);
	ctx.quadraticCurveTo((x - 0.05) * w, y * w, x * w, (y - 0.07) * w);
	ctx.fill();
	ctx.stroke();
}
function sparkle(ctx, w, x, y, r) {
	ctx.fillStyle = '#fff6c0';
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = (i * Math.PI) / 4;
		const rr = i % 2 ? r * 0.3 : r;
		ctx.lineTo((x + Math.cos(a) * rr) * w, (y + Math.sin(a) * rr) * w);
	}
	ctx.closePath();
	ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} e expression
 * @param {{blink?: boolean, mouthOpen?: boolean, style?: string}} o
 *   style: 'kid' | 'man' | 'woman' | 'old' (round glasses + mustache-less) | 'lamp' (mustache) | 'girl'
 */
export function drawFace(ctx, e, o = {}) {
	const w = ctx.canvas.width;
	ctx.clearRect(0, 0, w, w);
	const style = o.style || 'kid';
	const EY = 0.45;
	const L = 0.33;
	const R = 0.67;
	const r = style === 'kid' || style === 'girl' ? 0.055 : 0.048;
	const blush = ['happy', 'big-smile', 'blush', 'teary-smile', 'squint', 'dreamy'].includes(e) || style === 'girl';
	if (blush) {
		oval(ctx, w, L - 0.05, 0.6, 0.075, 0.042, e === 'blush' || e === 'dreamy' ? 'rgba(255,90,130,0.7)' : 'rgba(255,120,140,0.55)');
		oval(ctx, w, R + 0.05, 0.6, 0.075, 0.042, e === 'blush' || e === 'dreamy' ? 'rgba(255,90,130,0.7)' : 'rgba(255,120,140,0.55)');
	}

	// ---- eyes ----
	const dots = (dy = 0, s = 1, look = 0) =>
		[L, R].forEach((x) => {
			oval(ctx, w, x + look, EY + dy, r * 0.8 * s, r * 1.15 * s, INK);
			oval(ctx, w, x + look - r * 0.25, EY + dy - r * 0.42, r * 0.28, r * 0.3, '#ffffff');
		});
	const closedHappy = () => [L, R].forEach((x) => curve(ctx, w, [x - 0.06, EY + 0.02], [x, EY - 0.07], [x + 0.06, EY + 0.02], w * 0.024));
	const closedDown = () => [L, R].forEach((x) => curve(ctx, w, [x - 0.06, EY], [x, EY + 0.05], [x + 0.06, EY], w * 0.022));
	if (o.blink && !['squint', 'sleepy', 'big-smile', 'crying'].includes(e)) {
		[L, R].forEach((x) => stroke(ctx, w, [[x - 0.05, EY + 0.005], [x + 0.05, EY + 0.005]], w * 0.02));
	} else {
		switch (e) {
			case 'big-smile':
			case 'teary-smile':
				closedHappy();
				break;
			case 'squint':
				// "> <"
				stroke(ctx, w, [[L - 0.06, EY - 0.05], [L + 0.04, EY], [L - 0.06, EY + 0.05]], w * 0.026);
				stroke(ctx, w, [[R + 0.06, EY - 0.05], [R - 0.04, EY], [R + 0.06, EY + 0.05]], w * 0.026);
				break;
			case 'sleepy':
				// "u u"
				closedDown();
				break;
			case 'shocked':
				[L, R].forEach((x) => {
					oval(ctx, w, x, EY - 0.01, 0.08, 0.09, '#ffffff');
					ctx.strokeStyle = INK;
					ctx.lineWidth = w * 0.014;
					ctx.beginPath();
					ctx.ellipse(x * w, (EY - 0.01) * w, 0.08 * w, 0.09 * w, 0, 0, Math.PI * 2);
					ctx.stroke();
					oval(ctx, w, x, EY, 0.024, 0.028, INK);
				});
				break;
			case 'crying':
				[L, R].forEach((x) => {
					curve(ctx, w, [x - 0.06, EY + 0.01], [x, EY - 0.05], [x + 0.06, EY + 0.01], w * 0.022);
					ctx.fillStyle = 'rgba(110,200,255,0.9)';
					ctx.fillRect((x - 0.03) * w, (EY + 0.02) * w, 0.06 * w, 0.22 * w);
				});
				break;
			case 'thinking':
				dots(-0.015, 1, 0.03);
				break;
			case 'dreamy':
				[L, R].forEach((x) => curve(ctx, w, [x - 0.055, EY], [x, EY - 0.05], [x + 0.055, EY], w * 0.022));
				break;
			default:
				dots();
		}
	}
	if (e === 'teary') {
		[L, R].forEach((x) => {
			oval(ctx, w, x, EY + 0.06, 0.07, 0.016, 'rgba(140,215,255,0.9)');
			oval(ctx, w, x + 0.02, EY - 0.02, 0.016, 0.016, '#ffffff');
		});
		tear(ctx, w, L + 0.03, EY + 0.12, 1.2);
		tear(ctx, w, R - 0.02, EY + 0.16, 1.0);
	}
	if (e === 'teary-smile' || e === 'sad') {
		[L, R].forEach((x, i) => {
			if (e === 'teary-smile' || i === 0) tear(ctx, w, x + 0.02, EY + 0.1, 1.1);
		});
		if (e === 'teary-smile') [L, R].forEach((x) => oval(ctx, w, x, EY + 0.055, 0.06, 0.012, 'rgba(140,215,255,0.85)'));
	}

	// ---- brows ----
	const by = EY - 0.11;
	const brows = (kind) =>
		[L, R].forEach((x, i) => {
			const s = i ? 1 : -1;
			let inner = by;
			let outer = by;
			if (kind === 'angry' || kind === 'determined') {
				inner = by + 0.035;
				outer = by - 0.02;
			} else if (kind === 'sad') {
				inner = by - 0.03;
				outer = by + 0.015;
			} else if (kind === 'up') {
				inner = by - 0.04;
				outer = by - 0.04;
			} else if (kind === 'thinking') {
				inner = by - (i ? 0.04 : 0.0);
				outer = by - (i ? 0.05 : 0.0);
			}
			stroke(ctx, w, [[x - s * 0.025, inner], [x + s * 0.065, outer]], style === 'old' || style === 'lamp' ? w * 0.028 : w * 0.02, style === 'old' ? '#8a7a6a' : INK);
		});
	if (['sad', 'crying', 'worried', 'teary'].includes(e)) brows('sad');
	else if (e === 'shocked') brows('up');
	else if (e === 'determined' || e === 'angry') brows('determined');
	else if (e === 'thinking') brows('thinking');
	else if (style === 'old' || style === 'lamp' || style === 'woman' || style === 'man') brows('flat');

	// ---- glasses (old man) ----
	if (style === 'old') {
		ctx.strokeStyle = '#5a3a20';
		ctx.lineWidth = w * 0.016;
		[L, R].forEach((x) => {
			ctx.beginPath();
			ctx.arc(x * w, EY * w, 0.105 * w, 0, Math.PI * 2);
			ctx.stroke();
		});
		stroke(ctx, w, [[L + 0.105, EY], [R - 0.105, EY]], w * 0.014, '#5a3a20');
	}

	// ---- mouth ----
	const MY = 0.66;
	const open = (wd, ht) => {
		ctx.fillStyle = '#3a1010';
		ctx.beginPath();
		ctx.moveTo((0.5 - wd) * w, MY * w);
		ctx.quadraticCurveTo(0.5 * w, (MY + ht * 2) * w, (0.5 + wd) * w, MY * w);
		ctx.closePath();
		ctx.fill();
		oval(ctx, w, 0.5, MY + ht * 0.85, wd * 0.5, ht * 0.35, '#ff7a8a');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect((0.5 - wd * 0.72) * w, MY * w, wd * 1.44 * w, ht * 0.25 * w);
	};
	const talking = o.mouthOpen;
	switch (e) {
		case 'big-smile':
			open(0.13, 0.085);
			break;
		case 'teary-smile':
			open(0.1, 0.06);
			break;
		case 'squint':
			open(0.1, 0.07);
			break;
		case 'shocked':
			oval(ctx, w, 0.5, MY + 0.04, 0.045, 0.065, '#3a1010');
			break;
		case 'crying':
			oval(ctx, w, 0.5, MY + 0.03, 0.075, 0.045, '#3a1010');
			oval(ctx, w, 0.5, MY + 0.05, 0.04, 0.018, '#ff7a8a');
			break;
		case 'sad':
		case 'teary':
			curve(ctx, w, [0.42, MY + 0.04], [0.5, MY - 0.02], [0.58, MY + 0.04], w * 0.02);
			break;
		case 'worried':
			if (talking) oval(ctx, w, 0.5, MY + 0.02, 0.04, 0.035, '#3a1010');
			else stroke(ctx, w, [[0.41, MY + 0.02], [0.455, MY], [0.5, MY + 0.02], [0.545, MY], [0.59, MY + 0.02]], w * 0.016);
			sweat(ctx, w, 0.86, 0.3);
			break;
		case 'sleepy':
			oval(ctx, w, 0.52, MY + 0.02, 0.025, 0.03, '#3a1010');
			break;
		case 'thinking':
			stroke(ctx, w, [[0.44, MY + 0.02], [0.56, MY]], w * 0.018);
			break;
		case 'determined':
			stroke(ctx, w, [[0.42, MY + 0.01], [0.58, MY + 0.01]], w * 0.022);
			break;
		case 'angry':
			curve(ctx, w, [0.42, MY + 0.04], [0.5, MY - 0.02], [0.58, MY + 0.04], w * 0.022);
			break;
		case 'neutral':
			if (talking) open(0.06, 0.04);
			else curve(ctx, w, [0.44, MY], [0.5, MY + 0.025], [0.56, MY], w * 0.018);
			break;
		case 'dreamy':
			curve(ctx, w, [0.42, MY - 0.005], [0.5, MY + 0.05], [0.58, MY - 0.005], w * 0.02);
			ctx.fillStyle = 'rgba(160,220,255,0.9)';
			ctx.beginPath();
			ctx.ellipse(0.56 * w, (MY + 0.06) * w, 0.012 * w, 0.025 * w, 0, 0, Math.PI * 2);
			ctx.fill();
			break;
		default:
			if (talking) open(0.08, 0.055);
			else curve(ctx, w, [0.4, MY - 0.01], [0.5, MY + 0.07], [0.6, MY - 0.01], w * 0.02);
	}
	if (style === 'lamp') {
		// curly mustache
		ctx.fillStyle = '#2a1a12';
		ctx.beginPath();
		ctx.moveTo(0.5 * w, 0.6 * w);
		ctx.bezierCurveTo(0.42 * w, 0.56 * w, 0.32 * w, 0.62 * w, 0.28 * w, 0.58 * w);
		ctx.bezierCurveTo(0.3 * w, 0.66 * w, 0.42 * w, 0.64 * w, 0.5 * w, 0.625 * w);
		ctx.bezierCurveTo(0.58 * w, 0.64 * w, 0.7 * w, 0.66 * w, 0.72 * w, 0.58 * w);
		ctx.bezierCurveTo(0.68 * w, 0.62 * w, 0.58 * w, 0.56 * w, 0.5 * w, 0.6 * w);
		ctx.fill();
	}
	if (e === 'big-smile' || e === 'teary-smile' || e === 'blush') {
		sparkle(ctx, w, 0.12, 0.2, 0.05);
		sparkle(ctx, w, 0.88, 0.24, 0.04);
	}
}
