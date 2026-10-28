// Character parts drawn as SVG, in the style of the never-died cast: big almond eyes with a dark iris
// and a catch-light, thick brows, a soft nose, small mouth, flat hair and beards with lighter strand
// lines, A-line robes with fold lines, mitten hands with a thumb, bare feet in strapped sandals.
// Every function draws in figure coordinates (SVG px, y down) of one canvas per character view and
// returns the SVG plus the joint points the rig needs. Silhouette outlines come from the shader; the
// lines drawn here are the inner ones.
import {blob, deep, ellipse, light, line, mix, OUTLINE, pathThrough, rng, shade, tubePts} from './geom.mjs';

export const CW = 1600;
export const CH = 2240;
export const GY = 2160; // the soles
export const BX = 800; // the body's centre line

// Body measurements from the spec. `u` is 1% of the figure height.
export const metrics = (s) => {
	const Hf = s.height ?? 1960;
	const top = GY - Hf;
	const child = s.child ?? 0; // 0 adult .. 1 small child (bigger head, shorter limbs)
	const k = (a, c) => a + (c - a) * child;
	const y = (f) => top + f * Hf;
	const u = Hf / 100;
	return {
		Hf,
		u,
		top,
		B: s.build ?? 1,
		belly: s.belly ?? 0,
		child,
		headS: k(1.12, 1.38), // head scale
		handS: 1.25, // hand scale
		crown: y(0),
		headC: y(k(0.092, 0.12)),
		chin: y(k(0.178, 0.23)),
		neckTop: y(k(0.168, 0.22)),
		neckBase: y(k(0.207, 0.255)),
		shoulder: y(k(0.238, 0.29)),
		chest: y(k(0.3, 0.36)),
		waist: y(k(0.445, 0.5)),
		hip: y(k(0.5, 0.55)),
		knee: y(k(0.735, 0.76)),
		ankle: y(0.957),
		elbow: y(k(0.418, 0.47)),
		wrist: y(k(0.57, 0.62)),
		sole: GY,
	};
};

const LW = (M) => M.u * 0.3; // inner line width (about 6 px on a 2000 px figure)

// ---------------------------------------------------------------------------------------------
// Faces
// ---------------------------------------------------------------------------------------------
const SCLERA = '#fbf6ec';
const IRIS = '#3b2516';
const PUPIL = '#120b07';

// An almond eye at (x, y) of half-width w and half-height h, looking toward `look` (-1..1 along x).
// `tilt` lifts the outer corner. Returns svg; `id` makes the iris clip unique.
const eye = (id, x, y, w, h, look = 0.35, {tilt = 0, lw = 4, lash = 1} = {}) => {
	const outer = [x + w, y + 0.12 * h - tilt * h];
	const inner = [x - w, y + 0.18 * h];
	const top = [x + 0.05 * w, y - h];
	const bot = [x + 0.08 * w, y + 0.8 * h];
	const pts = [inner, [x - 0.55 * w, y - 0.72 * h], top, [x + 0.65 * w, y - 0.62 * h], [...outer, 'c'], [x + 0.55 * w, y + 0.62 * h], bot, [x - 0.6 * w, y + 0.55 * h]];
	const d = pathThrough(pts, true, 1);
	const ix = x + look * w * 0.55;
	const ir = h * 0.86;
	return [
		`<clipPath id="${id}"><path d="${d}"/></clipPath>`,
		`<path d="${d}" fill="${SCLERA}"/>`,
		`<g clip-path="url(#${id})">`,
		ellipse(ix, y + 0.05 * h, ir * 0.92, ir, IRIS),
		ellipse(ix, y + 0.05 * h, ir * 0.55, ir * 0.6, PUPIL),
		ellipse(ix + ir * 0.35, y - ir * 0.35, ir * 0.24, ir * 0.24, '#ffffff'),
		ellipse(ix - ir * 0.3, y + ir * 0.35, ir * 0.1, ir * 0.1, '#ffffff', {opacity: 0.8}),
		// the upper lid's shadow on the eyeball
		`<path d="${pathThrough([inner, [x - 0.55 * w, y - 0.72 * h], top, [x + 0.65 * w, y - 0.62 * h], outer, [x + 0.6 * w, y - 0.25 * h], [x, y - 0.55 * h], [x - 0.6 * w, y - 0.25 * h]], true)}" fill="${IRIS}" opacity="0.18"/>`,
		`</g>`,
		// upper lid line, thicker, with a little flick at the outer corner
		line([inner, [x - 0.55 * w, y - 0.74 * h], top, [x + 0.65 * w, y - 0.64 * h], outer, [outer[0] + 0.28 * w * lash, outer[1] - 0.32 * h * lash]], OUTLINE, lw * 1.5),
		line([[x - 0.45 * w, y + 0.6 * h], bot, [x + 0.55 * w, y + 0.62 * h]], OUTLINE, lw * 0.7, {opacity: 0.75}),
	].join('');
};

// A brow as a tapered lens between two points with a peak (separate part so it can move).
const browPts = (a, b, peak, thick) => {
	const mx = (a[0] + b[0]) / 2;
	const my = (a[1] + b[1]) / 2 - peak;
	return [
		[a[0], a[1], 'c'],
		[mx - (b[0] - a[0]) * 0.18, my - thick * 0.55],
		[b[0] - (b[0] - a[0]) * 0.12, b[1] - peak * 0.5 - thick * 0.35],
		[b[0], b[1], 'c'],
		[mx + (b[0] - a[0]) * 0.05, my + thick * 0.55],
		[a[0] + (b[0] - a[0]) * 0.2, a[1] - thick * 0.05],
	];
};

const SKIN_LINE = (skin) => deep(skin, 0.62);

// Side view head (facing right). Returns parts: head (with eye, ear, nose), brow, mouth variants,
// and the anchor points.
export const headSide = (s, M) => {
	const u = M.u * M.headS;
	const cx = BX + 1.6 * M.u;
	const cy = M.headC;
	const P = (x, y, c) => (c ? [cx + x * u, cy + y * u, c] : [cx + x * u, cy + y * u]);
	const skin = s.skin;
	const lw = LW(M);
	const nose = s.nose ?? 1; // nose size
	const jaw = s.jaw ?? 1; // jaw width
	const shape = [
		P(-4.2, 7.8), P(-8.1, 3.4), P(-9.1, -2.0), P(-6.9, -7.3), P(-1.0, -9.3), P(4.6, -7.9), P(7.7, -4.3),
		P(8.5, -1.5), P(8.1, 0.2), P(8.4 + 0.2 * nose, 1.5), P(9.0 + 0.6 * nose, 2.9), P(9.3 + 0.6 * nose, 3.7),
		P(8.9 + 0.3 * nose, 4.4), P(8.5, 4.75), P(9.0, 5.9), P(8.5, 6.5), P(8.8, 7.2), P(8.1 * jaw, 8.7), P(5.6 * jaw, 9.7),
		P(1.6, 9.2), P(-1.6, 7.2),
	];
	const eyeC = P(5.7, -0.3);
	const eyeW = 2.15 * u;
	const eyeH = 1.35 * u;
	const ear = [P(-0.6, -1.6), P(0.9, -1.0), P(1.3, 1.0), P(0.6, 3.0), P(-0.9, 2.6), P(-1.3, 0.6)];
	const svg = [
		blob(shape, skin),
		// soft shading: under the jaw and at the back of the head
		blob([P(-4.0, 7.6), P(-1.6, 7.0), P(1.8, 9.0), P(5.4, 9.5), P(2.0, 9.9), P(-2.4, 9.0)], deep(skin, 0.8), {opacity: 0.55}),
		ellipse(cx + 4.8 * u, cy + 3.5 * u, 2.3 * u, 1.5 * u, '#e07a5f', {opacity: 0.22}),
		// ear with an inner curl
		blob(ear, deep(skin, 0.93)),
		line([P(0.3, -0.7), P(0.7, 0.6), P(0.2, 1.8), P(-0.4, 1.4)], SKIN_LINE(skin), lw * 0.8),
		line([...ear, ear[0]], OUTLINE, lw * 0.9),
		// nostril and the line of the cheek
		line([P(8.5, 3.9), P(8.9, 4.25), P(8.5, 4.45)], SKIN_LINE(skin), lw * 0.8),
		line([P(6.8, 1.2), P(7.6, 2.4), P(7.9, 3.8)], SKIN_LINE(skin), lw * 0.6, {opacity: 0.35}),
		eye(`${s.id}_se`, eyeC[0], eyeC[1], eyeW, eyeH, 0.55, {lw}),
	].join('');
	const brow = blob(browPts(P(3.8, -2.7), P(7.9, -2.5), 1.0 * u, 0.62 * u * (s.browThick ?? 1)), s.brow ?? s.hairColor ?? '#2a1d14');
	const mouth = mouthSide(P(8.45, 6.45), u, skin, lw);
	return {svg, brow, mouth, neck: P(-1.4, 8.4), eye: {c: eyeC, w: eyeW, h: eyeH}, browC: P(5.8, -2.9), mouthC: P(8.45, 6.45), center: P(0, 0), u};
};

const mouthSide = (c, u, skin, lw) => {
	const [x, y] = c;
	const lip = deep(skin, 0.7);
	return {
		rest: line([[x - 1.6 * u, y + 0.2 * u], [x - 0.7 * u, y + 0.15 * u], [x + 0.25 * u, y - 0.05 * u]], lip, lw * 0.9),
		smile: line([[x - 1.8 * u, y - 0.35 * u], [x - 0.9 * u, y + 0.3 * u], [x + 0.25 * u, y + 0.05 * u]], lip, lw),
		talk: blob([[x - 1.5 * u, y - 0.1 * u], [x - 0.4 * u, y - 0.45 * u], [x + 0.35 * u, y - 0.1 * u], [x + 0.2 * u, y + 0.6 * u], [x - 0.8 * u, y + 0.75 * u]], '#5a2418', {stroke: OUTLINE, sw: lw * 0.8}),
		open: blob([[x - 1.4 * u, y - 0.3 * u], [x - 0.3 * u, y - 0.7 * u], [x + 0.4 * u, y - 0.2 * u], [x + 0.3 * u, y + 1.0 * u], [x - 0.9 * u, y + 1.1 * u]], '#4a1c12', {stroke: OUTLINE, sw: lw * 0.8}),
	};
};

// Three-quarter view head (facing right and toward us).
export const headTQ = (s, M) => {
	const u = M.u * M.headS;
	const cx = BX + 1.0 * M.u;
	const cy = M.headC;
	const P = (x, y, c) => (c ? [cx + x * u, cy + y * u, c] : [cx + x * u, cy + y * u]);
	const skin = s.skin;
	const lw = LW(M);
	const nose = s.nose ?? 1;
	const jaw = s.jaw ?? 1;
	const shape = [
		P(-4.6, 7.4), P(-8.4, 2.4), P(-8.8, -2.6), P(-6.2, -7.6), P(-0.6, -9.4), P(5.0, -8.0), P(7.8, -4.6),
		P(8.5, -1.3), P(8.6, 1.4), P(8.75 + 0.25 * nose, 3.2), P(8.45, 4.2), P(8.2 * jaw, 6.2), P(6.2 * jaw, 9.0), P(3.6, 9.9),
		P(-0.4, 8.9), P(-3.5, 6.4),
	];
	const nearEye = P(2.1, -0.2);
	const farEye = P(7.15, -0.35);
	const ear = [P(-6.7, -1.2), P(-5.2, -0.6), P(-4.9, 1.6), P(-5.6, 3.3), P(-7.0, 2.8), P(-7.4, 0.8)];
	const svg = [
		blob(shape, skin),
		blob([P(-4.4, 7.2), P(-1.4, 7.6), P(2.0, 9.3), P(5.6, 8.9), P(3.4, 10.0), P(-1.0, 9.3)], deep(skin, 0.8), {opacity: 0.55}),
		ellipse(cx + 2.6 * u, cy + 3.7 * u, 2.1 * u, 1.35 * u, '#e07a5f', {opacity: 0.22}),
		ellipse(cx + 7.6 * u, cy + 3.3 * u, 1.0 * u, 1.0 * u, '#e07a5f', {opacity: 0.16}),
		blob(ear, deep(skin, 0.93)),
		line([P(-6.4, -0.3), P(-5.8, 0.9), P(-6.1, 2.1)], SKIN_LINE(skin), lw * 0.8),
		line([...ear, ear[0]], OUTLINE, lw * 0.9),
		// nose: the bridge as a soft shadow on the near side, the tip and a nostril
		blob([P(4.9, 0.6), P(5.6, 1.8), P(6.2, 3.1), P(7.8 + 0.2 * nose, 3.5), P(6.6, 4.3), P(5.4, 3.9), P(4.7, 2.5)], deep(skin, 0.86), {opacity: 0.45}),
		line([P(5.1, 0.8), P(6.0, 2.5), P(7.9 + 0.2 * nose, 3.5), P(7.6, 4.2), P(6.8, 4.3)], SKIN_LINE(skin), lw * 0.85),
		line([P(6.0, 4.0), P(6.4, 4.35)], SKIN_LINE(skin), lw * 0.8),
		eye(`${s.id}_ne`, nearEye[0], nearEye[1], 2.0 * u, 1.38 * u, 0.42, {lw, lash: 0.5}),
		eye(`${s.id}_fe`, farEye[0], farEye[1], 1.3 * u, 1.2 * u, 0.5, {lw, tilt: 0.05, lash: 0.7}),
	].join('');
	const bc = s.brow ?? s.hairColor ?? '#2a1d14';
	const brows = {
		near: blob(browPts(P(0.1, -2.7), P(3.9, -3.0), 0.95 * u, 0.6 * u * (s.browThick ?? 1)), bc),
		far: blob(browPts(P(6.0, -2.9), P(8.1, -2.5), 0.6 * u, 0.5 * u * (s.browThick ?? 1)), bc),
	};
	const mouth = mouthTQ(P(5.6, 6.5), u, skin, lw);
	return {svg, brows, mouth, neck: P(-1.0, 8.4), eyes: {near: {c: nearEye, w: 2.0 * u, h: 1.38 * u}, far: {c: farEye, w: 1.3 * u, h: 1.2 * u}}, browNearC: P(2.0, -3.2), browFarC: P(7.0, -3.0), mouthC: P(5.6, 6.5), center: P(0, 0), u};
};

const mouthTQ = (c, u, skin, lw) => {
	const [x, y] = c;
	const lip = deep(skin, 0.68);
	return {
		rest: line([[x - 1.7 * u, y + 0.05 * u], [x - 0.2 * u, y + 0.3 * u], [x + 1.4 * u, y - 0.05 * u]], lip, lw * 0.9),
		smile: line([[x - 2.0 * u, y - 0.45 * u], [x - 0.3 * u, y + 0.6 * u], [x + 1.6 * u, y - 0.35 * u]], lip, lw),
		talk: blob([[x - 1.6 * u, y - 0.15 * u], [x, y - 0.35 * u], [x + 1.4 * u, y - 0.15 * u], [x + 0.4 * u, y + 0.9 * u], [x - 0.9 * u, y + 0.8 * u]], '#5a2418', {stroke: OUTLINE, sw: lw * 0.8}),
		open: blob([[x - 1.5 * u, y - 0.4 * u], [x, y - 0.7 * u], [x + 1.4 * u, y - 0.35 * u], [x + 0.5 * u, y + 1.3 * u], [x - 0.9 * u, y + 1.2 * u]], '#4a1c12', {stroke: OUTLINE, sw: lw * 0.8}),
	};
};

// Back view head: the skull and both ears (hair or a covering goes on top).
export const headBack = (s, M) => {
	const u = M.u * M.headS;
	const cx = BX;
	const cy = M.headC;
	const P = (x, y) => [cx + x * u, cy + y * u];
	const skin = s.skin;
	const lw = LW(M);
	const shape = [P(-4.8, 8.2), P(-7.6, 3.6), P(-8.2, -2.6), P(-5.4, -8.0), P(0, -9.4), P(5.4, -8.0), P(8.2, -2.6), P(7.6, 3.6), P(4.8, 8.2), P(0, 9.2)];
	const earL = [P(-8.9, -0.9), P(-7.2, -0.6), P(-7.0, 2.2), P(-8.4, 3.0), P(-9.4, 1.4)];
	const earR = earL.map(([x, y]) => [2 * cx - x, y]);
	const svg = [
		blob(earL, deep(skin, 0.9)),
		blob(earR, deep(skin, 0.9)),
		line([...earL, earL[0]], OUTLINE, lw * 0.9),
		line([...earR, earR[0]], OUTLINE, lw * 0.9),
		blob(shape, skin),
		blob([P(-4.6, 7.8), P(0, 8.6), P(4.6, 7.8), P(3.0, 9.0), P(0, 9.5), P(-3.0, 9.0)], deep(skin, 0.8), {opacity: 0.5}),
	].join('');
	return {svg, neck: P(0, 8.4), center: P(0, 0), u};
};

// ---------------------------------------------------------------------------------------------
// Hair, beards and head coverings (front layer drawn over the head, back layer behind it)
// ---------------------------------------------------------------------------------------------
const strands = (r, n, pts, col, w, opacity = 0.9) => {
	let out = '';
	for (let i = 0; i < n; i++) {
		const k = (i + 0.5) / n;
		const a = pts(k, r());
		out += line(a, col, w * (0.7 + 0.5 * r()), {opacity});
	}
	return out;
};

// Hair for a head made by headSide/headTQ/headBack. Styles: short, curly, shoulder, fringe (bald with a
// fringe), wrap (cloth wrap), cloth (head cloth with a band), scarf (a woman's head scarf), helmet,
// hood (the enemy), none.
export const hair = (s, M, view, H) => {
	const u = H.u;
	const [cx, cy] = H.center;
	const P = (x, y, c) => (c ? [cx + x * u, cy + y * u, c] : [cx + x * u, cy + y * u]);
	const col = s.hairColor ?? '#2a1d14';
	const hl = light(col, 0.28);
	const lw = LW(M);
	const r = rng(s.seed ?? 7);
	const st = s.hair;
	const mirror = view === 'back';
	let front = '';
	let back = '';
	if (st === 'short' || st === 'curly') {
		if (view === 'side') {
			const pts = [P(-4.6, 5.2), P(-8.6, 2.2), P(-9.5, -2.2), P(-7.3, -7.8), P(-1.0, -9.9), P(4.9, -8.5), P(7.5, -5.0), P(6.4, -4.4), P(4.4, -5.2), P(1.0, -4.8), P(-1.2, -2.6), P(-1.8, 1.0), P(-3.0, 3.6)];
			front = blob(pts, col) + strands(r, 6, (k, j) => [P(-8 + 9 * k, -7.5 + j), P(-6 + 10 * k, -6.5 + j), P(-5 + 11 * k, -4.2 + j * 0.6)], hl, lw * 0.9);
			if (st === 'curly') for (let i = 0; i < 16; i++) front += ellipse(cx + (-8.4 + 14 * r()) * u, cy + (-9 + 8 * r()) * u, 1.1 * u, 0.95 * u, i % 2 ? col : hl, {opacity: i % 2 ? 1 : 0.6});
		} else if (view === 'tq') {
			const pts = [P(-5.0, 5.0), P(-8.9, 1.6), P(-9.3, -3.4), P(-6.6, -8.4), P(-0.6, -10.1), P(5.4, -8.8), P(8.0, -5.6), P(8.0, -4.2), P(6.4, -4.8), P(3.0, -5.6), P(-0.6, -5.2), P(-3.6, -3.6), P(-5.0, 0.0), P(-4.8, 3.2)];
			front = blob(pts, col) + strands(r, 7, (k, j) => [P(-7 + 13 * k, -8.6 + j), P(-6 + 13 * k, -6.4 + j), P(-6.5 + 12.5 * k, -4.6 + j * 0.5)], hl, lw * 0.9);
			if (st === 'curly') for (let i = 0; i < 18; i++) front += ellipse(cx + (-8.6 + 16 * r()) * u, cy + (-9.6 + 7 * r()) * u, 1.1 * u, 0.95 * u, i % 2 ? col : hl, {opacity: i % 2 ? 1 : 0.6});
		} else {
			front = blob([P(-8.5, 3.2), P(-8.9, -2.4), P(-5.8, -8.5), P(0, -10.0), P(5.8, -8.5), P(8.9, -2.4), P(8.5, 3.2), P(4.4, 6.0), P(0, 6.4), P(-4.4, 6.0)], col) + strands(r, 8, (k, j) => [P(-7 + 14 * k, -8 + j), P(-7.4 + 14.8 * k, -1 + j), P(-6.8 + 13.6 * k, 5 + j)], hl, lw * 0.9);
			if (st === 'curly') for (let i = 0; i < 26; i++) front += ellipse(cx + (-8 + 16 * r()) * u, cy + (-9 + 15 * r()) * u, 1.2 * u, 1.0 * u, i % 2 ? col : hl, {opacity: i % 2 ? 1 : 0.6});
		}
	} else if (st === 'shoulder') {
		// shoulder-length hair parted in the middle, hugging the skull, falling in soft waves to the shoulders
		const dk = shade(col, 0.72);
		if (view === 'side') {
			back = blob([P(-4.6, 2.4), P(-9.6, 0.8), P(-10.4, 6.4), P(-9.8, 11.2), P(-8.8, 13.4), P(-7.4, 12.6), P(-6.0, 13.8), P(-4.4, 12.0), P(-3.6, 7.6)], col);
			back += line([P(-9.0, 2.4), P(-9.4, 7.6), P(-8.6, 12.4)], hl, lw) + line([P(-6.6, 3.4), P(-6.4, 8.6), P(-6.0, 12.8)], hl, lw) + line([P(-4.6, 6.4), P(-4.4, 11.0)], dk, lw * 0.9);
			front = blob([P(6.7, -5.2), P(5.0, -8.8), P(-0.9, -10.3), P(-7.5, -8.0), P(-9.9, -2.4), P(-9.7, 3.4), P(-7.9, 6.2), P(-5.6, 4.6), P(-3.7, 2.4), P(-2.4, -1.2), P(0.6, -3.8), P(4.0, -4.7)], col);
			front += line([P(5.6, -6.6), P(0.8, -8.6), P(-5.0, -7.2), P(-8.4, -2.4), P(-8.4, 3.4)], hl, lw) + line([P(4.0, -5.4), P(0.0, -6.4), P(-4.0, -4.6), P(-6.2, 0.4), P(-6.4, 4.4)], hl, lw * 0.9) + line([P(2.6, -9.4), P(-2.4, -9.2), P(-7.0, -6.2)], hl, lw * 0.8);
		} else if (view === 'tq') {
			back = blob([P(-4.6, 2.2), P(-9.8, 0.4), P(-10.6, 6.0), P(-9.8, 11.0), P(-8.6, 13.2), P(-7.0, 12.4), P(-5.4, 13.4), P(-4.2, 9.4)], col);
			back += blob([P(7.6, -4.6), P(9.4, -3.8), P(10.2, 1.6), P(10.0, 7.6), P(9.2, 11.2), P(8.0, 12.2), P(7.6, 8.0), P(8.2, 3.0)], col);
			back += line([P(-9.0, 2.0), P(-9.6, 7.8), P(-8.4, 12.4)], hl, lw) + line([P(-6.4, 3.6), P(-6.0, 11.8)], hl, lw) + line([P(8.8, 1.6), P(8.8, 9.0)], hl, lw);
			front = blob([P(8.2, -3.6), P(8.3, -5.4), P(6.8, -8.2), P(2.4, -10.2), P(-3.2, -9.8), P(-7.6, -7.0), P(-9.6, -2.0), P(-9.4, 3.8), P(-7.6, 6.6), P(-6.0, 3.8), P(-4.6, 0.0), P(-2.6, -3.4), P(0.6, -5.4), P(1.4, -6.8), P(2.4, -5.4), P(5.2, -5.0), P(7.2, -4.2)], col);
			front += line([P(1.4, -9.6), P(1.4, -7.2)], dk, lw * 1.2);
			front += line([P(0.6, -8.8), P(-3.6, -7.4), P(-7.0, -3.4), P(-7.8, 3.4)], hl, lw) + line([P(-0.6, -6.6), P(-3.8, -4.4), P(-5.8, 0.6)], hl, lw * 0.9) + line([P(2.4, -8.8), P(5.8, -7.2), P(7.6, -5.0)], hl, lw);
		} else {
			front = blob([P(-9.4, 1.0), P(-8.8, -5.0), P(-5.6, -9.2), P(0, -10.3), P(5.6, -9.2), P(8.8, -5.0), P(9.4, 1.0), P(10.0, 7.6), P(9.4, 11.6), P(8.0, 13.2), P(6.2, 12.0), P(3.8, 13.6), P(1.2, 12.4), P(-1.2, 12.4), P(-3.8, 13.6), P(-6.2, 12.0), P(-8.0, 13.2), P(-9.4, 11.6), P(-10.0, 7.6)], col);
			front += line([P(0, -10.0), P(0, -6.0)], dk, lw * 1.2);
			front += [-6.8, -4.0, -1.4, 1.4, 4.0, 6.8].map((x) => line([P(x * 0.45, -8.4), P(x * 0.95, -2.0), P(x * 1.08, 5.0), P(x, 11.4)], Math.abs(x) < 2 ? dk : hl, lw)).join('');
		}
	} else if (st === 'fringe') {
		// bald on top, a fringe of hair around the back of the head from ear to ear
		const fc = col;
		if (view === 'side') {
			front = blob([P(-1.6, -0.8), P(-4.6, -3.6), P(-8.4, -3.8), P(-9.8, -0.4), P(-9.0, 4.0), P(-6.2, 7.2), P(-4.4, 6.6), P(-6.4, 3.4), P(-6.8, 0.2), P(-4.6, -1.4)], fc);
			front += line([P(-8.6, -2.6), P(-8.6, 1.6), P(-6.8, 5.6)], hl, lw * 0.8) + line([P(-6.4, -2.6), P(-7.4, 0.4)], hl, lw * 0.7);
		} else if (view === 'tq') {
			front = blob([P(-4.0, -1.0), P(-7.2, -3.8), P(-9.6, -1.2), P(-9.4, 3.6), P(-7.2, 6.6), P(-5.4, 6.0), P(-7.0, 2.6), P(-6.8, -0.4)], fc);
			front += line([P(-8.6, -1.6), P(-8.4, 3.0)], hl, lw * 0.8);
		} else {
			front = blob([P(-9.2, -3.2), P(-6.4, -1.0), P(0, 0.4), P(6.4, -1.0), P(9.2, -3.2), P(9.4, 2.4), P(6.6, 6.6), P(0, 7.8), P(-6.6, 6.6), P(-9.4, 2.4)], fc);
			front += [-6, -3, 0, 3, 6].map((x) => line([P(x, 0.2 + Math.abs(x) * -0.25), P(x * 1.05, 6.4 - Math.abs(x) * 0.25)], hl, lw * 0.8)).join('');
		}
	} else if (st === 'wrap' || st === 'cloth' || st === 'scarf') {
		// a cloth over the head: wrap (bound turban-like), cloth (falls to the shoulders with a cord band),
		// scarf (a woman's veil framing the face and falling over the shoulders)
		const c = s.wrapColor ?? '#e6d8b8';
		const cd = deep(c, 0.78);
		const band = s.bandColor ?? deep(c, 0.6);
		if (view === 'side') {
			if (st === 'wrap') {
				front = blob([P(-5.2, 3.0), P(-9.6, 1.6), P(-10.1, -3.6), P(-7.4, -8.8), P(-0.8, -10.9), P(5.2, -9.4), P(7.9, -5.6), P(7.5, -3.9), P(4.2, -4.5), P(0.6, -3.6), P(-2.0, -1.6), P(-3.4, 1.2)], c);
				front += line([P(7.5, -4.4), P(3.0, -5.6), P(-2.2, -3.6), P(-5.4, 0.6)], cd, lw * 1.2) + line([P(6.6, -7.2), P(1.0, -8.4), P(-5.2, -6.4), P(-8.6, -1.8)], cd, lw * 1.1) + line([P(3.0, -10.2), P(-3.0, -9.6), P(-7.8, -5.8)], cd, lw);
				back = blob([P(-6.6, 1.6), P(-8.8, 2.4), P(-9.6, 7.8), P(-8.8, 10.8), P(-7.4, 10.4), P(-6.6, 6.4)], cd);
				back += line([P(-8.2, 3.6), P(-8.2, 9.4)], deep(c, 0.6), lw * 0.9);
			} else {
				const fall = st === 'scarf' ? 15.0 : 13.0;
				back = blob([P(-2.0, 1.0), P(-8.4, -7.0), P(-11.0, 0.6), P(-11.6, fall - 2), P(-6.6, fall + 1.2), P(-1.4, fall), P(1.6, 11.4), P(1.2, 7.4)], c);
				back += line([P(-9.6, 2.0), P(-9.0, fall - 2.2)], cd, lw) + line([P(-6.4, 3.4), P(-4.6, fall - 0.8)], cd, lw);
				front = blob([P(1.0, 7.0), P(-1.8, 1.4), P(-4.8, -4.6), P(-8.0, -9.0), P(-1.0, -11.6), P(5.6, -10.4), P(8.6, -6.4), P(7.6, -4.0), P(4.4, -5.4), P(2.0, -3.4), P(1.8, 0.6), P(2.6, 4.8)], c);
				front += line([P(7.6, -5.6), P(3.2, -7.2), P(-2.0, -6.0)], cd, lw);
				if (st === 'cloth') front += blob([P(8.4, -5.8), P(3.0, -7.6), P(-3.4, -7.4), P(-9.4, -4.6), P(-9.6, -3.2), P(-3.4, -5.8), P(3.0, -6.0), P(8.0, -4.4)], band);
			}
		} else if (view === 'tq') {
			if (st === 'wrap') {
				front = blob([P(-5.6, 2.6), P(-9.8, 0.6), P(-9.8, -4.6), P(-6.8, -9.4), P(-0.2, -11.0), P(6.0, -9.6), P(8.8, -5.6), P(8.5, -3.8), P(4.8, -4.8), P(0.8, -4.6), P(-2.8, -3.2), P(-4.6, 0.2)], c);
				front += line([P(8.5, -4.4), P(3.4, -5.8), P(-2.4, -4.4), P(-5.8, 0.2)], cd, lw * 1.2) + line([P(7.2, -7.6), P(1.0, -8.8), P(-5.6, -6.6), P(-8.6, -2.0)], cd, lw * 1.1);
				back = blob([P(-6.8, 1.4), P(-9.0, 2.4), P(-9.8, 7.8), P(-9.0, 10.8), P(-7.6, 10.4), P(-6.8, 6.4)], cd);
			} else {
				const fall = st === 'scarf' ? 15.0 : 13.0;
				back = blob([P(-3.0, 1.0), P(-9.0, -7.0), P(-11.6, 1.0), P(-11.8, fall - 1.6), P(-7.0, fall + 1.4), P(-2.4, fall), P(-3.4, 8.0)], c);
				back += blob([P(8.0, -4.0), P(10.4, -1.0), P(11.0, 6.0), P(10.0, fall - 1.0), P(7.6, fall - 2.4), P(8.0, 6.0), P(8.8, 1.0)], c);
				back += line([P(-9.8, 2.0), P(-9.2, fall - 2.0)], cd, lw) + line([P(9.8, 1.4), P(9.4, fall - 3)], cd, lw);
				front = blob([P(-3.4, 6.6), P(-6.0, 0.4), P(-8.0, -6.4), P(-4.0, -10.8), P(1.6, -11.8), P(7.0, -10.0), P(9.6, -5.6), P(9.4, -1.6), P(8.2, -3.8), P(5.4, -5.8), P(1.4, -6.2), P(-2.2, -5.0), P(-4.4, -1.6), P(-4.6, 2.6)], c);
				front += line([P(8.4, -6.6), P(3.0, -8.4), P(-3.6, -7.6)], cd, lw);
				if (st === 'cloth') front += blob([P(9.6, -6.0), P(3.0, -8.2), P(-3.6, -8.0), P(-8.6, -5.2), P(-8.6, -3.8), P(-3.6, -6.6), P(3.0, -6.6), P(9.2, -4.6)], band);
			}
		} else {
			const fall = st === 'wrap' ? 5.0 : st === 'scarf' ? 15.0 : 13.0;
			const fl = st === 'wrap' ? 9.6 : 10.6;
			front = blob([P(-9.4, 3.0), P(-9.6, -4.6), P(-5.8, -10.0), P(0, -11.2), P(5.8, -10.0), P(9.6, -4.6), P(9.4, 3.0), P(fl, fall - 2), P(7.0, fall + 1), P(0, fall + 1.6), P(-7.0, fall + 1), P(-fl, fall - 2)], c);
			front += line([P(-6.4, -6.0), P(-6.0, fall - 1)], cd, lw) + line([P(0, -9.0), P(0, fall)], cd, lw) + line([P(6.4, -6.0), P(6.0, fall - 1)], cd, lw);
			if (st === 'cloth') front += blob([P(-9.8, -4.6), P(-5.6, -7.6), P(0, -8.4), P(5.6, -7.6), P(9.8, -4.6), P(9.8, -3.0), P(5.6, -6.0), P(0, -6.8), P(-5.6, -6.0), P(-9.8, -3.0)], band);
		}
	} else if (st === 'helmet') {
		const c = s.wrapColor ?? '#8c7a5a';
		const cd = deep(c, 0.7);
		const sh = view === 'back' ? 0 : view === 'tq' ? 1 : 1.3;
		front = blob([P(-9.4, 1.0), P(-9.6, -4.6), P(-6.0, -10.2), P(0.4, -11.4), P(6.4, -9.6), P(8.4 + sh, -4.4), P(8.6 + sh, -2.4), P(-1.0, -2.0), P(-3.6, 0.8), P(-6.4, 4.4)], c, {stroke: OUTLINE, sw: lw});
		front += line([P(-9.0, -3.4), P(0.0, -4.0), P(8.4 + sh, -3.2)], cd, lw * 1.5) + line([P(-5.6, -9.2), P(0.4, -10.4), P(6.0, -8.8)], light(c, 0.35), lw * 1.2);
		front += blob([P(-1.2, -11.0), P(1.6, -14.8), P(4.0, -14.6), P(2.6, -10.8)], '#9b3b2a', {stroke: OUTLINE, sw: lw * 0.8});
	} else if (st === 'hood') {
		// the enemy's hood: no face at all, only a soft dark shadow inside
		const c = s.wrapColor ?? '#2a2a3a';
		const cd = deep(c, 0.7);
		if (view === 'side') {
			back = blob([P(-4.0, 12.0), P(-11.6, 6.0), P(-12.4, -4.0), P(-7.6, -12.6), P(1.0, -13.6), P(8.4, -10.0), P(11.6, -2.0), P(11.4, 8.0), P(8.4, 13.4), P(2.0, 14.6)], c);
			front = blob([P(5.0, -7.4), P(9.0, -4.0), P(10.0, 2.4), P(8.6, 8.6), P(5.0, 11.0), P(3.0, 6.0), P(3.0, -2.0)], '#0b0b12', {opacity: 0.94});
			front += line([P(-6.0, -9.6), P(-9.4, -2.0), P(-9.0, 8.0)], cd, lw * 1.2) + line([P(2.0, -12.4), P(9.2, -7.6), P(11.0, 2.0)], light(c, 0.15), lw);
		} else if (view === 'tq') {
			back = blob([P(-3.0, 12.4), P(-11.0, 6.4), P(-11.8, -4.0), P(-7.0, -12.8), P(1.6, -13.8), P(9.4, -10.0), P(12.0, -1.6), P(11.4, 8.4), P(7.8, 13.6)], c);
			front = blob([P(1.0, -7.6), P(7.4, -7.0), P(9.6, -1.0), P(8.6, 7.0), P(4.6, 10.4), P(0.6, 8.4), P(-1.0, 1.0)], '#0b0b12', {opacity: 0.94});
			front += line([P(-6.6, -9.8), P(-9.6, -1.6), P(-9.0, 8.4)], cd, lw * 1.2);
		} else {
			front = blob([P(-11.0, 10.0), P(-12.0, -2.0), P(-8.0, -12.0), P(0, -14.0), P(8.0, -12.0), P(12.0, -2.0), P(11.0, 10.0), P(6.0, 14.6), P(0, 15.4), P(-6.0, 14.6)], c);
			front += line([P(0, -12.6), P(0.4, 2.0), P(0, 14.0)], cd, lw * 1.2) + line([P(-6.4, -9.6), P(-8.8, 2.4)], cd, lw) + line([P(6.4, -9.6), P(8.8, 2.4)], cd, lw);
		}
	}
	if (mirror && back) back = '';
	return {front, back};
};

// Beards: none, stubble, short, full (longer, below the chin), long (to the chest).
export const beard = (s, M, view, H) => {
	const st = s.beard ?? 'none';
	if (st === 'none' || view === 'back') return '';
	const u = H.u;
	const [cx, cy] = H.center;
	const P = (x, y) => [cx + x * u, cy + y * u];
	const col = s.beardColor ?? s.hairColor ?? '#2a1d14';
	const hl = light(col, 0.3);
	const lw = LW(M);
	const r = rng((s.seed ?? 7) + 11);
	if (st === 'stubble') {
		return view === 'side'
			? blob([P(0.2, 3.0), P(3.6, 5.4), P(8.6, 7.2), P(8.0, 8.8), P(5.6, 9.8), P(1.4, 9.2), P(-1.4, 6.6)], col, {opacity: 0.22})
			: blob([P(-3.0, 5.6), P(1.8, 6.4), P(8.0, 6.0), P(7.6, 8.4), P(3.6, 9.9), P(-0.6, 9.0)], col, {opacity: 0.22});
	}
	const len = st === 'short' ? 0 : st === 'full' ? 2.6 : 6.0;
	if (view === 'side') {
		const pts = [P(-0.2, 1.2), P(1.6, 4.4), P(4.6, 5.0), P(8.5, 4.9), P(9.9, 5.8), P(9.2, 6.4), P(8.0, 6.2), P(7.6, 6.9), P(8.9, 7.3), P(9.0, 9.4 + len * 0.6), P(7.2, 11.6 + len), P(3.8, 12.4 + len * 0.9), P(0.6, 10.6 + len * 0.5), P(-1.8, 7.4), P(-1.4, 4.0)];
		let svg = blob(pts, col);
		svg += strands(r, 5 + Math.round(len * 0.6), (k, j) => [P(0.2 + 7 * k, 6.2 + j * 0.8), P(1.2 + 7 * k, 8.0 + len * 0.3 + j * 0.6), P(0.8 + 6.6 * k, 9.6 + len * 0.6 + j * 0.6), P(1.6 + 5.8 * k, 11.0 + len * 0.85 + j * 0.3)], hl, lw * 0.85);
		svg += line([P(8.6, 5.1), P(9.7, 5.8)], hl, lw * 0.7, {opacity: 0.8});
		return svg;
	}
	const pts = [P(-4.6, 2.6), P(-3.6, 6.0), P(-0.4, 6.4), P(2.6, 5.4), P(5.6, 5.0), P(8.4, 5.2), P(9.0, 6.0), P(7.0, 6.2), P(5.6, 6.0), P(3.6, 6.6), P(3.6, 7.6), P(5.8, 7.4), P(8.0, 7.0), P(8.6, 8.4 + len * 0.6), P(6.6, 11.4 + len), P(3.4, 12.6 + len), P(0.2, 11.6 + len * 0.7), P(-2.4, 9.6 + len * 0.3), P(-4.6, 6.4)];
	let svg = blob(pts, col);
	svg += strands(r, 6 + Math.round(len * 0.6), (k, j) => [P(-2.8 + 10 * k, 7.4 + j * 0.8), P(-1.8 + 10 * k, 9.0 + len * 0.3 + j * 0.6), P(-2.2 + 9.6 * k, 10.4 + len * 0.6 + j * 0.6), P(-1.0 + 8 * k, 11.6 + len * 0.9 + j * 0.3)], hl, lw * 0.85);
	svg += line([P(2.8, 5.6), P(5.6, 5.3), P(8.2, 5.5)], hl, lw * 0.7, {opacity: 0.8});
	return svg;
};

// ---------------------------------------------------------------------------------------------
// Body: neck, torso (robe top), skirt (robe bottom), limbs, hands and feet
// ---------------------------------------------------------------------------------------------
export const neck = (s, M, view, H) => {
	const u = M.u;
	const [nx, ny] = H.neck;
	const w = (view === 'side' ? 2.6 : 2.9) * u * (0.92 + 0.12 * M.B);
	const top = [nx + (view === 'side' ? 0.6 * u : 0.2 * u), ny - 3.2 * u];
	const bot = [BX + (view === 'side' ? -0.6 * u : 0), M.neckBase + 1.2 * u];
	const pts = tubePts(top, bot, w, w * 1.12, {n: 3});
	const svg = blob(pts, s.skin) + blob(tubePts([top[0] - 0.2 * w, top[1]], [bot[0] - 0.3 * w, bot[1]], w * 0.55, w * 0.6, {n: 3}), deep(s.skin, 0.8), {opacity: 0.45});
	return {svg, joint: [bot[0], bot[1] - 1.4 * u], headJoint: [nx, ny - 0.4 * u]};
};

const folds = (pts, col, w, opacity = 0.85) => pts.map((p) => line(p, col, w, {opacity})).join('');

// Robe top from the neck base to the waist, with neckline, belt or sash and optional strap.
export const torso = (s, M, view) => {
	const u = M.u;
	const B = M.B;
	const belly = M.belly;
	const robe = s.robe;
	const rc = robe.color;
	const rd = deep(rc, 0.78);
	const lw = LW(M);
	const sh = M.shoulder;
	const w = M.waist;
	const P = (x, y) => [BX + x * u, y];
	let out = '';
	let shoulderNear;
	let shoulderFar;
	let hip;
	if (view === 'side') {
		const pts = [P(-3.4 * B, M.neckBase - 0.6 * u), P(-6.6 * B, sh + 1.2 * u), P(-7.6 * B, M.chest), P(-7.0 * B, (M.chest + w) / 2), P(-6.4 * B, w + 1.5 * u), P(6.2 * B + 3.0 * belly, w + 1.5 * u), P(6.8 * B + 4.0 * belly, (M.chest + w) / 2 + 2 * u), P(7.0 * B + 1.0 * belly, M.chest), P(5.6 * B, sh + 1.6 * u), P(2.6, M.neckBase - 0.4 * u)];
		out += blob(pts, rc);
		// the far side of the robe a shade darker (two-tone)
		out += blob([P(-3.4 * B, M.neckBase - 0.6 * u), P(-6.6 * B, sh + 1.2 * u), P(-7.6 * B, M.chest), P(-7.0 * B, (M.chest + w) / 2), P(-6.4 * B, w + 1.5 * u), P(-3.6 * B, w + 1.5 * u), P(-4.4 * B, M.chest), P(-2.6, sh + 0.6 * u)], rd, {opacity: 0.55});
		// neckline: a V opening at the front
		out += blob([P(0.6, M.neckBase - 0.8 * u), P(3.4, M.neckBase - 0.2 * u), P(4.6, M.neckBase + 2.4 * u), P(2.4, M.neckBase + 1.4 * u)], deep(s.skin, 0.85));
		out += line([P(0.6, M.neckBase - 0.8 * u), P(2.4, M.neckBase + 1.6 * u), P(4.8, M.neckBase + 2.6 * u)], rd, lw);
		out += folds([[P(3.0 * B, M.chest), P(3.6 * B, (M.chest + w) / 2), P(3.2 * B, w)], [P(-2.0 * B, M.chest + 2 * u), P(-2.6 * B, w - 1 * u)], [P(5.4 * B, M.chest + 1 * u), P(5.8 * B + 2 * belly, w - 2 * u)]], rd, lw);
		shoulderNear = P(-0.6 * B, sh + 1.4 * u);
		shoulderFar = P(-1.6 * B, sh + 1.6 * u);
		hip = P(0, M.hip);
	} else if (view === 'tq') {
		const pts = [P(-3.6, M.neckBase - 0.8 * u), P(-8.4 * B, sh + 1.0 * u), P(-9.2 * B, M.chest), P(-8.0 * B, (M.chest + w) / 2), P(-7.6 * B, w + 1.5 * u), P(7.8 * B + 2.4 * belly, w + 1.5 * u), P(8.4 * B + 3.2 * belly, (M.chest + w) / 2 + 2 * u), P(8.2 * B + 0.6 * belly, M.chest), P(6.6 * B, sh + 1.2 * u), P(3.2, M.neckBase - 0.6 * u)];
		out += blob(pts, rc);
		out += blob([P(4.0 * B, sh + 1.4 * u), P(6.6 * B, sh + 1.2 * u), P(8.2 * B + 0.6 * belly, M.chest), P(8.4 * B + 3.2 * belly, (M.chest + w) / 2 + 2 * u), P(7.8 * B + 2.4 * belly, w + 1.5 * u), P(5.4 * B, w + 1.5 * u), P(5.8 * B, M.chest)], rd, {opacity: 0.5});
		out += blob([P(-1.6, M.neckBase - 0.8 * u), P(2.2, M.neckBase - 0.6 * u), P(1.4, M.neckBase + 3.4 * u), P(0.2, M.neckBase + 2.0 * u)], deep(s.skin, 0.85));
		out += line([P(-1.8, M.neckBase - 0.8 * u), P(0.4, M.neckBase + 2.4 * u), P(1.4, M.neckBase + 3.6 * u), P(2.4, M.neckBase - 0.4 * u)], rd, lw);
		out += folds([[P(-3.6 * B, M.chest + 1 * u), P(-4.2 * B, w - 1 * u)], [P(2.6 * B, M.chest + 2 * u), P(3.2 * B, w)], [P(-6.4 * B, M.chest), P(-6.0 * B, w - 3 * u)]], rd, lw);
		shoulderNear = P(-6.2 * B, sh + 1.6 * u);
		shoulderFar = P(5.6 * B, sh + 1.8 * u);
		hip = P(0.4, M.hip);
	} else {
		const pts = [P(-3.4, M.neckBase - 0.8 * u), P(-8.4 * B, sh + 1.0 * u), P(-9.0 * B, M.chest), P(-8.0 * B, (M.chest + w) / 2), P(-7.6 * B, w + 1.5 * u), P(7.6 * B, w + 1.5 * u), P(8.0 * B, (M.chest + w) / 2), P(9.0 * B, M.chest), P(8.4 * B, sh + 1.0 * u), P(3.4, M.neckBase - 0.8 * u)];
		out += blob(pts, rc);
		out += folds([[P(0, M.neckBase + 1 * u), P(0.4, w)], [P(-4.4 * B, M.chest), P(-4.8 * B, w)], [P(4.4 * B, M.chest), P(4.8 * B, w)]], rd, lw);
		shoulderNear = P(-6.4 * B, sh + 1.6 * u);
		shoulderFar = P(6.4 * B, sh + 1.6 * u);
		hip = P(0, M.hip);
	}
	// optional mantle (Saul's scholar robe: a striped shawl over the shoulders) or seed bag strap
	if (s.mantle) {
		const mc = s.mantle.color;
		const stripe = s.mantle.stripe;
		if (view === 'side') {
			out += blob([P(-3.6 * B, M.neckBase - 1.0 * u), P(-7.4 * B, sh + 1.0 * u), P(-8.2 * B, M.chest + 2 * u), P(-7.0 * B, w - 2 * u), P(-2.0, w - 6 * u), P(2.0, M.chest + 2 * u), P(3.4, M.neckBase + 0.6 * u)], mc);
			out += line([P(-7.6 * B, M.chest + 4 * u), P(-2.0, w - 4.6 * u)], stripe, lw * 2.2) + line([P(-7.2 * B, M.chest + 6 * u), P(-2.2, w - 2.6 * u)], stripe, lw * 1.2);
		} else if (view === 'tq') {
			out += blob([P(-3.8, M.neckBase - 1.0 * u), P(-9.0 * B, sh + 0.8 * u), P(-9.6 * B, M.chest + 2 * u), P(-7.8 * B, w - 1 * u), P(-3.0 * B, w - 4 * u), P(0.6, M.chest + 4 * u), P(2.6, M.neckBase + 0.4 * u)], mc);
			out += blob([P(3.2, M.neckBase - 0.4 * u), P(7.0 * B, sh + 1.0 * u), P(8.0 * B, M.chest + 4 * u), P(6.0 * B, M.chest + 6 * u), P(3.6, M.chest)], mc);
			out += line([P(-8.8 * B, M.chest + 3 * u), P(-3.2 * B, w - 6 * u)], stripe, lw * 2.2) + line([P(6.6 * B, M.chest + 4 * u), P(4.0, M.chest + 1 * u)], stripe, lw * 2.2);
		} else {
			out += blob([P(-8.6 * B, sh + 0.6 * u), P(0, M.neckBase - 1.2 * u), P(8.6 * B, sh + 0.6 * u), P(8.8 * B, M.chest + 6 * u), P(0, M.chest + 10 * u), P(-8.8 * B, M.chest + 6 * u)], mc);
			out += line([P(-8.4 * B, M.chest + 4.6 * u), P(0, M.chest + 8.6 * u), P(8.4 * B, M.chest + 4.6 * u)], stripe, lw * 2.2);
		}
	}
	if (s.strap) {
		const sc = s.strap;
		if (view === 'side') out += line([P(-3.4 * B, sh + 0.6 * u), P(1.0 * B, M.chest + 2 * u), P(5.8 * B, w - 0.4 * u)], sc, 1.6 * u);
		else if (view === 'tq') out += line([P(4.6 * B, sh + 0.6 * u), P(0.6, M.chest + 3 * u), P(-6.6 * B, w - 0.8 * u)], sc, 1.6 * u);
		else out += line([P(-4.6 * B, sh + 0.6 * u), P(0, M.chest + 3 * u), P(6.6 * B, w - 0.8 * u)], sc, 1.6 * u);
	}
	// belt or sash at the waist
	const belt = robe.belt;
	if (belt) {
		const bc = belt.color;
		const bw = (belt.width ?? 2.2) * u;
		const x0 = view === 'side' ? -6.6 * B : -7.8 * B;
		const x1 = view === 'side' ? 6.4 * B + 3 * belly : 8.0 * B + 2.4 * belly;
		out += blob([P(x0, w - bw / 2), P(x1, w - bw / 2 - 0.2 * u), P(x1 + 0.2, w + bw / 2), P(x0, w + bw / 2)], bc, {tension: 0.4});
		out += line([P(x0, w), P(x1, w - 0.2 * u)], deep(bc, 0.75), lw * 0.7, {opacity: 0.7});
		if (belt.tail && view !== 'back') {
			const tx = view === 'side' ? 3.6 * B + belly : -2.0 * B;
			out += blob([P(tx - 0.9, w), P(tx + 1.3, w), P(tx + 1.6, w + 9 * u), P(tx + 0.4, w + 9.6 * u), P(tx - 1.0, w + 9 * u)], bc, {stroke: OUTLINE, sw: lw * 0.8});
		}
	}
	return {svg: out, shoulderNear, shoulderFar, hip, waist: P(0, w)};
};

// Robe skirt from the waist down; length: ankle | calf | knee. Returns the svg and the hip point.
export const skirt = (s, M, view) => {
	const u = M.u;
	const B = M.B;
	const robe = s.robe;
	const rc = robe.color;
	const rd = deep(rc, 0.78);
	const lw = LW(M);
	const len = robe.length ?? 'ankle';
	const hemY = len === 'ankle' ? M.ankle - 1.6 * u : len === 'calf' ? M.ankle - 10 * u : M.knee + 1.0 * u;
	const w = M.waist;
	const P = (x, y) => [BX + x * u, y];
	const flare = len === 'knee' ? 1.0 : 1.18;
	let svg;
	if (view === 'side') {
		svg = blob([P(-6.4 * B, w), P(6.2 * B + 3 * M.belly, w), P(7.6 * B * flare + 1.5 * M.belly, (w + hemY) / 2), P(9.0 * B * flare, hemY - 1.2 * u), P(6.0 * B * flare, hemY + 0.6 * u), P(0, hemY + 1.0 * u), P(-7.0 * B * flare, hemY + 1.2 * u), P(-10.0 * B * flare, hemY - 0.6 * u), P(-8.4 * B * flare, (w + hemY) / 2)], rc);
		svg += blob([P(-6.4 * B, w), P(-2.6 * B, w), P(-4.0 * B, (w + hemY) / 2), P(-6.0 * B * flare, hemY + 1.2 * u), P(-10.0 * B * flare, hemY - 0.6 * u), P(-8.4 * B * flare, (w + hemY) / 2)], rd, {opacity: 0.5});
		svg += folds([[P(2.4 * B, w + 3 * u), P(3.2 * B * flare, (w + hemY) / 2), P(3.6 * B * flare, hemY - 0.4 * u)], [P(-1.6 * B, w + 5 * u), P(-2.6 * B * flare, hemY)], [P(5.6 * B, w + 8 * u), P(6.8 * B * flare, hemY - 1.4 * u)]], rd, lw);
	} else if (view === 'tq') {
		svg = blob([P(-7.6 * B, w), P(7.8 * B + 2.4 * M.belly, w), P(9.4 * B * flare, (w + hemY) / 2), P(10.6 * B * flare, hemY - 0.8 * u), P(5.0 * B, hemY + 1.0 * u), P(-2.0 * B, hemY + 1.4 * u), P(-9.6 * B * flare, hemY + 0.4 * u), P(-9.6 * B * flare, (w + hemY) / 2)], rc);
		svg += blob([P(4.2 * B, w), P(7.8 * B + 2.4 * M.belly, w), P(9.4 * B * flare, (w + hemY) / 2), P(10.6 * B * flare, hemY - 0.8 * u), P(5.0 * B, hemY + 1.0 * u), P(5.6 * B, (w + hemY) / 2)], rd, {opacity: 0.5});
		svg += folds([[P(-3.6 * B, w + 3 * u), P(-4.6 * B * flare, hemY + 0.6 * u)], [P(1.4 * B, w + 4 * u), P(1.8 * B * flare, hemY + 0.8 * u)], [P(5.4 * B, w + 6 * u), P(6.6 * B * flare, hemY - 0.2 * u)]], rd, lw);
	} else {
		svg = blob([P(-7.6 * B, w), P(7.6 * B, w), P(9.4 * B * flare, (w + hemY) / 2), P(10.4 * B * flare, hemY), P(0, hemY + 1.4 * u), P(-10.4 * B * flare, hemY), P(-9.4 * B * flare, (w + hemY) / 2)], rc);
		svg += folds([[P(-3.4 * B, w + 3 * u), P(-4.4 * B * flare, hemY + 0.8 * u)], [P(0, w + 4 * u), P(0, hemY + 1.2 * u)], [P(3.4 * B, w + 3 * u), P(4.4 * B * flare, hemY + 0.8 * u)]], rd, lw);
	}
	// a darker band at the hem
	if (robe.hemBand) {
		const hb = robe.hemBand;
		const x0 = view === 'side' ? -10.0 * B * flare : view === 'tq' ? -9.6 * B * flare : -10.4 * B * flare;
		const x1 = view === 'side' ? 9.0 * B * flare : view === 'tq' ? 10.6 * B * flare : 10.4 * B * flare;
		svg += line([P(x0 + 0.6, hemY - 0.4 * u), P(0, hemY + 0.2 * u), P(x1 - 0.6, hemY - 0.8 * u)], hb, 1.6 * u, {cap: 'butt'});
	}
	return {svg, hemY, waist: P(0, w)};
};

// A limb segment as a tapered tube between two joints, in cloth or skin. `cuff` adds a darker band.
export const limb = (M, a, b, ra, rb, fill, {cuff = null, fold = true, bend = 0} = {}) => {
	const lw = LW(M);
	let svg = blob(tubePts(a, b, ra, rb, {bend}), fill);
	if (fold) {
		const m1 = [a[0] + (b[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.35];
		const m2 = [a[0] + (b[0] - a[0]) * 0.7, a[1] + (b[1] - a[1]) * 0.7];
		const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		const nx = -(b[1] - a[1]) / L;
		const ny = (b[0] - a[0]) / L;
		svg += line([[m1[0] + nx * ra * 0.3, m1[1] + ny * ra * 0.3], [m2[0] + nx * ra * 0.45, m2[1] + ny * ra * 0.45]], deep(fill, 0.78), lw, {opacity: 0.7});
	}
	if (cuff) {
		const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		const ux = (b[0] - a[0]) / L;
		const uy = (b[1] - a[1]) / L;
		const c0 = [b[0] - ux * rb * 0.9, b[1] - uy * rb * 0.9];
		svg += line([[c0[0] - uy * rb * 1.02, c0[1] + ux * rb * 1.02], [c0[0] + uy * rb * 1.02, c0[1] - ux * rb * 1.02]], cuff, rb * 0.5, {cap: 'butt'});
	}
	return svg;
};

// Mitten hands with a thumb, drawn from the wrist point toward `dir` (degrees, 90 = down). Kinds:
// relaxed, open (palm out, fingers up: the "no" or welcome hand), fist, throw (spread), hold, point.
// `side` puts the thumb on one side or the other.
export const hand = (M, skin, wrist, dirDeg, kind = 'relaxed', side = 1) => {
	const u = M.u * (M.handS ?? 1);
	const lw = LW(M);
	const r = (dirDeg * Math.PI) / 180;
	const ux = Math.cos(r);
	const uy = Math.sin(r);
	const nx = -uy * side;
	const ny = ux * side;
	const at = (along, across) => [wrist[0] + ux * along * u + nx * across * u, wrist[1] + uy * along * u + ny * across * u];
	const dk = deep(skin, 0.8);
	let pts;
	let thumb;
	let extra = '';
	if (kind === 'fist' || kind === 'hold') {
		pts = [at(-0.3, -1.7), at(1.6, -2.3), at(3.9, -2.2), at(4.9, -0.6), at(4.6, 1.5), at(2.4, 2.2), at(0.0, 1.8)];
		thumb = [at(1.4, 1.6), at(3.2, 2.5), at(4.4, 1.6), at(3.2, 0.7)];
		extra = line([at(3.6, -1.9), at(4.4, -0.4), at(4.1, 1.2)], dk, lw * 0.8);
	} else if (kind === 'point') {
		pts = [at(-0.3, -1.7), at(1.6, -2.3), at(3.6, -2.2), at(4.3, -1.6), at(7.6, -1.4), at(8.0, -0.6), at(7.4, -0.1), at(4.4, -0.1), at(4.2, 1.5), at(2.2, 2.2), at(0.0, 1.8)];
		thumb = [at(1.4, 1.6), at(3.0, 2.4), at(4.0, 1.6), at(3.0, 0.8)];
	} else if (kind === 'open' || kind === 'throw') {
		const spread = kind === 'throw' ? 0.6 : 0;
		pts = [at(-0.3, -1.8), at(2.0, -2.6 - spread), at(4.8, -2.6 - spread), at(6.6, -1.4 - spread), at(6.9, 0.4), at(6.2, 1.8 + spread * 0.5), at(3.4, 2.3), at(0.0, 1.9)];
		thumb = [at(1.2, 1.7), at(2.0, 3.6 + spread), at(3.4, 4.4 + spread), at(3.9, 3.4 + spread), at(3.0, 1.8)];
		extra = line([at(3.9, -1.4 - spread * 0.6), at(6.0, -1.0 - spread)], dk, lw * 0.8) + line([at(3.9, -0.1), at(6.3, 0.2)], dk, lw * 0.8) + line([at(3.8, 1.2), at(5.6, 1.6 + spread * 0.4)], dk, lw * 0.8);
	} else {
		pts = [at(-0.3, -1.7), at(1.8, -2.3), at(4.5, -2.1), at(6.0, -0.8), at(6.0, 0.9), at(4.9, 2.0), at(2.4, 2.2), at(0.0, 1.8)];
		thumb = [at(1.3, 1.7), at(2.8, 3.1), at(4.2, 3.1), at(3.8, 1.8)];
		extra = line([at(4.4, -0.6), at(5.6, -0.2)], dk, lw * 0.7, {opacity: 0.8});
	}
	return blob(pts, skin) + extra + blob(thumb, skin, {stroke: OUTLINE, sw: lw * 0.85});
};

// A bare foot in a strapped sandal, side view; `dir` 1 = toes to the right. Ankle at `ankle`.
export const foot = (M, skin, ankle, dirX = 1, view = 'side') => {
	const u = M.u;
	const lw = LW(M);
	const sx = dirX;
	const X = (x) => ankle[0] + x * u * sx;
	const Y = (y) => ankle[1] + y * u;
	const sole = '#4b3020';
	if (view === 'back') {
		const pts = [[X(-1.6), Y(-1.5)], [X(1.6), Y(-1.5)], [X(1.9), Y(2.6)], [X(1.4), Y(3.6)], [X(-1.4), Y(3.6)], [X(-1.9), Y(2.6)]];
		return blob([[X(-2.0), Y(3.2)], [X(2.0), Y(3.2)], [X(2.0), Y(4.2)], [X(-2.0), Y(4.2)]], sole, {tension: 0.3}) + blob(pts, skin) + line([[X(-1.8), Y(1.4)], [X(1.8), Y(1.4)]], '#6b4428', lw * 1.6);
	}
	const len = view === 'tq' ? 7.0 : 8.4;
	const pts = [[X(-1.8), Y(-2.0)], [X(1.4), Y(-2.0)], [X(2.4), Y(0.6)], [X(len - 2.6), Y(1.6)], [X(len - 0.6), Y(2.2)], [X(len), Y(3.4)], [X(len - 0.8), Y(3.9)], [X(-1.9), Y(3.9)], [X(-2.6), Y(2.4)]];
	let svg = blob([[X(-2.7), Y(3.6)], [X(len + 0.3), Y(3.6)], [X(len + 0.2), Y(4.5)], [X(-2.7), Y(4.5)]], sole, {tension: 0.3});
	svg += blob(pts, skin);
	svg += line([[X(len - 2.0), Y(1.6)], [X(len - 1.2), Y(3.8)]], '#6b4428', lw * 1.7);
	svg += line([[X(0.2), Y(0.2)], [X(1.8), Y(1.0)], [X(2.6), Y(3.8)]], '#6b4428', lw * 1.7);
	svg += line([[X(len - 0.9), Y(2.6)], [X(len - 0.6), Y(3.6)]], deep(skin, 0.7), lw * 0.7);
	return svg;
};

export {LW, BX as CENTER_X, mix};
