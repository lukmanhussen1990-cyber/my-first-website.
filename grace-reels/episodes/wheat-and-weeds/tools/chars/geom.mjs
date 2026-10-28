// Small SVG drawing kit for the code-drawn characters: smooth shapes through points, tapered tubes,
// strokes and colour helpers. Coordinates are SVG pixels (y down) on a figure canvas.

const f = (n) => (Math.round(n * 10) / 10).toString();

// A point list may mark sharp corners with a third value: [x, y, 'c'].
const isCorner = (p) => p[2] === 'c';

// Smooth path through points (Catmull-Rom turned into cubic Beziers). `tension` 0 = straight lines.
export const pathThrough = (pts, closed = true, tension = 1) => {
	const n = pts.length;
	if (n < 2) return '';
	const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
	let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
	const segs = closed ? n : n - 1;
	for (let i = 0; i < segs; i++) {
		const p0 = get(i - 1);
		const p1 = get(i);
		const p2 = get(i + 1);
		const p3 = get(i + 2);
		const k1 = isCorner(p1) ? 0 : tension / 6;
		const k2 = isCorner(p2) ? 0 : tension / 6;
		const c1 = [p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1];
		const c2 = [p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2];
		d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
	}
	return closed ? d + ' Z' : d;
};

export const OUTLINE = '#2b1d12';

// A filled shape (optionally with an inner outline stroke).
export const blob = (pts, fill, {stroke = null, sw = 0, tension = 1, opacity = 1, extra = ''} = {}) =>
	`<path d="${pathThrough(pts, true, tension)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${f(sw)}" stroke-linejoin="round"` : ''}${opacity < 1 ? ` opacity="${opacity}"` : ''}${extra}/>`;

// An open stroke (fold lines, strands, lids).
export const line = (pts, color, width, {tension = 1, opacity = 1, cap = 'round'} = {}) =>
	`<path d="${pathThrough(pts, false, tension)}" fill="none" stroke="${color}" stroke-width="${f(width)}" stroke-linecap="${cap}" stroke-linejoin="round"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;

export const ellipse = (cx, cy, rx, ry, fill, {rot = 0, stroke = null, sw = 0, opacity = 1} = {}) =>
	`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : ''} fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${f(sw)}"` : ''}${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;

// Points of a tapered tube from a to b (rounded ends), radius ra at a and rb at b. `bend` pushes the
// middle sideways (positive = to the left of the a->b direction).
export const tubePts = (a, b, ra, rb, {bend = 0, capA = 1, capB = 1, n = 5} = {}) => {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const L = Math.hypot(dx, dy) || 1;
	const ux = dx / L;
	const uy = dy / L;
	const nx = -uy;
	const ny = ux;
	const mid = (s) => bend * 4 * s * (1 - s);
	const at = (s, side) => {
		const r = ra + (rb - ra) * s;
		const c = [a[0] + dx * s + nx * mid(s), a[1] + dy * s + ny * mid(s)];
		return [c[0] + nx * r * side, c[1] + ny * r * side];
	};
	const pts = [];
	for (let i = 0; i <= n; i++) pts.push(at(i / n, 1));
	// rounded end at b
	for (let k = 1; k < 4; k++) {
		const ang = (k / 4) * Math.PI;
		pts.push([b[0] + (nx * Math.cos(ang) + ux * Math.sin(ang) * capB) * rb, b[1] + (ny * Math.cos(ang) + uy * Math.sin(ang) * capB) * rb]);
	}
	for (let i = n; i >= 0; i--) pts.push(at(i / n, -1));
	for (let k = 1; k < 4; k++) {
		const ang = (k / 4) * Math.PI;
		pts.push([a[0] + (-nx * Math.cos(ang) - ux * Math.sin(ang) * capA) * ra, a[1] + (-ny * Math.cos(ang) - uy * Math.sin(ang) * capA) * ra]);
	}
	return pts;
};

// ---- colour helpers ----
const hex = (c) => {
	const h = c.replace('#', '');
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => {
	const A = hex(a);
	const B = hex(b);
	return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};
export const shade = (c, k) => {
	const A = hex(c);
	return toHex(A[0] * k, A[1] * k, A[2] * k);
};
// darker and slightly warmer/redder: for fold lines and shadow shapes on cloth and skin
export const deep = (c, k = 0.72) => {
	const A = hex(c);
	return toHex(A[0] * k * 1.02, A[1] * k * 0.96, A[2] * k * 0.98);
};
export const light = (c, k = 0.25) => mix(c, '#fff8ec', k);

// Seeded random (mulberry32) for strand placement etc.
export const rng = (seed) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const rot = (p, c, deg) => {
	const r = (deg * Math.PI) / 180;
	const x = p[0] - c[0];
	const y = p[1] - c[1];
	return [c[0] + x * Math.cos(r) - y * Math.sin(r), c[1] + x * Math.sin(r) + y * Math.cos(r)];
};
