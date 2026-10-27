// Paper-cut figures drawn with the Canvas 2D API: flat matte shapes, an even dark-brown
// outline, and one shadow tone that sits on the side away from the sun. Everything is in
// figure units (FU): the figure stands on y = 0 and is ~1000 FU tall, x+ is the way it faces.
// The caller sets the canvas transform (scale, flip) before calling drawFigure.

export type V = [number, number];
export type HandState = 'relaxed' | 'fist' | 'open' | 'curled' | 'point' | 'flat' | 'hidden';
export type ArmPose = {sh: number; el: number; hand?: HandState; wrist?: number; fore?: number};
export type Eyes = 'open' | 'narrow' | 'wide' | 'happy' | 'closed';
export type Hold = {item: 'whip' | 'phone' | 'coin' | 'cage' | 'cords'; swing?: number; lift?: number};

export type Look = {
	skin: string;
	hair: string;
	hairStyle: 'shoulder' | 'short' | 'curly' | 'long' | 'bun' | 'bald';
	beard?: 'none' | 'short' | 'full';
	beardColor?: string;
	grey?: number;
	head?: 'none' | 'cloth' | 'wrap';
	headColor?: string;
	headBand?: string;
	outfit?: 'robe' | 'hoodie';
	robe: string;
	sleeves?: 'long' | 'elbow' | 'cap';
	sleeveColor?: string;
	sash?: string;
	rope?: string;
	pants?: string;
	shoes?: string;
	sandals?: string;
	build?: number;
	height?: number;
	headScale?: number;
	outline?: string;
	brow?: string;
};

export type Pose = {
	lean?: number;
	sit?: boolean;
	crouch?: number;
	headTilt?: number;
	yaw?: number;
	gaze?: V;
	eyes?: Eyes;
	blink?: number;
	lid?: number;
	brow?: {inner: number; outer: number};
	tear?: number;
	near?: ArmPose;
	far?: ArmPose;
	stride?: number;
	sway?: number;
	hold?: Hold;
	shoulderLift?: number;
	breath?: number;
	backHand?: boolean;
	noArms?: boolean;
};

export type DrawOpts = {ol: number; light: V; shade?: number};

const OUTLINE = '#2A1A10';

// ---------- small vector helpers ----------
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const rot = (p: V, a: number): V => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const dirOf = (a: number): V => [Math.sin(a), Math.cos(a)]; // 0 = straight down, +pi/2 = forward (+x)
const len = (a: V) => Math.hypot(a[0], a[1]);
const norm = (a: V): V => {
	const l = len(a) || 1;
	return [a[0] / l, a[1] / l];
};
const perp = (a: V): V => [-a[1], a[0]];
const clampA = (a: number) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, a));

// Darken / lighten a #rrggbb colour (multiplicative), used for the single shadow tone.
export const shadeOf = (hex: string, k = 0.8) => {
	const n = parseInt(hex.slice(1), 16);
	const r = Math.round(((n >> 16) & 255) * k);
	const g = Math.round(((n >> 8) & 255) * k);
	const b = Math.round((n & 255) * k);
	const cl = (v: number) => Math.max(0, Math.min(255, v));
	return '#' + ((1 << 24) | (cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).slice(1);
};
// shadow tone: darker and a touch cooler, like paper in shade
const shadowTone = (hex: string) => {
	const n = parseInt(hex.slice(1), 16);
	const r = ((n >> 16) & 255) * 0.78;
	const g = ((n >> 8) & 255) * 0.8;
	const b = (n & 255) * 0.86;
	return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
};

// Smooth closed/open path through points (Catmull-Rom converted to Bezier).
const spline = (p: Path2D, pts: V[], closed: boolean, tension = 0.5) => {
	const n = pts.length;
	const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
	p.moveTo(pts[0][0], pts[0][1]);
	const segs = closed ? n : n - 1;
	for (let i = 0; i < segs; i++) {
		const p0 = get(i - 1);
		const p1 = get(i);
		const p2 = get(i + 1);
		const p3 = get(i + 2);
		const c1: V = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
		const c2: V = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
		p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
	}
	if (closed) p.closePath();
	return p;
};
const shapeOf = (pts: V[], tension = 0.5) => spline(new Path2D(), pts, true, tension);
const ellipse = (c: V, rx: number, ry: number, a = 0) => {
	const p = new Path2D();
	p.ellipse(c[0], c[1], Math.max(rx, 0.01), Math.max(ry, 0.01), a, 0, Math.PI * 2);
	return p;
};

type Ctx = CanvasRenderingContext2D;

// Two-tone fill: whole shape in shadow tone, then the shape nudged toward the light in the
// base tone, clipped to itself -> a crescent of shadow on the far side. Then the outline.
const paint = (g: Ctx, o: DrawOpts, path: Path2D, base: string, size: number, line = true, shade?: string) => {
	const k = size * 0.16 * (o.shade ?? 1);
	g.save();
	g.fillStyle = shade ?? shadowTone(base);
	g.fill(path);
	g.clip(path);
	g.translate(o.light[0] * k, o.light[1] * k);
	g.fillStyle = base;
	g.fill(path);
	g.restore();
	if (line) {
		g.lineWidth = o.ol;
		g.strokeStyle = OUTLINE;
		g.lineJoin = 'round';
		g.stroke(path);
	}
};

const strokeLine = (g: Ctx, pts: V[], w: number, color: string, cap: CanvasLineCap = 'round') => {
	g.beginPath();
	g.moveTo(pts[0][0], pts[0][1]);
	for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
	g.lineWidth = w;
	g.strokeStyle = color;
	g.lineCap = cap;
	g.lineJoin = 'round';
	g.stroke();
};
const strokeCurve = (g: Ctx, pts: V[], w: number, color: string, alpha = 1) => {
	g.save();
	g.globalAlpha *= alpha;
	const p = spline(new Path2D(), pts, false);
	g.lineWidth = w;
	g.strokeStyle = color;
	g.lineCap = 'round';
	g.stroke(p);
	g.restore();
};

// Outlined tube with a lit band toward the light (arms, legs, cords).
const tube = (g: Ctx, o: DrawOpts, pts: V[], w: number, base: string, outline = true) => {
	if (outline) strokeLine(g, pts, w + 2 * o.ol, OUTLINE);
	strokeLine(g, pts, w, shadowTone(base));
	g.save();
	const s = 0.15 * w * (o.shade ?? 1);
	g.translate(o.light[0] * s, o.light[1] * s);
	strokeLine(g, pts, w * 0.7, base);
	g.restore();
};

// ---------- skeleton ----------
type Skel = {
	H: number;
	hip: V;
	shoulderC: V;
	neck: V;
	head: V;
	shN: V;
	shF: V;
	lean: number;
	footN: V;
	footF: V;
	kneeN?: V;
	kneeF?: V;
	sit: boolean;
	b: number;
};

const skeleton = (look: Look, pose: Pose): Skel => {
	const H = 1000 * (look.height ?? 1);
	const hs = look.headScale ?? 1;
	const b = look.build ?? 1;
	const lean = pose.lean ?? 0;
	const sit = Boolean(pose.sit);
	const crouch = pose.crouch ?? 0;
	const breath = pose.breath ?? 0;
	const lift = pose.shoulderLift ?? 0;
	const hip: V = sit ? [0, -0.262 * H] : [0, -0.47 * H * (1 - 0.22 * crouch)];
	const torso = 0.285 * H + breath * 4;
	const shoulderC = add(hip, rot([0, -torso - lift * 14], lean));
	const neck = add(shoulderC, rot([6, -0.03 * H], lean));
	const head = add(neck, rot([12, -0.112 * H * hs], lean + (pose.headTilt ?? 0)));
	const shN = add(shoulderC, rot([16 * b, 14], lean));
	const shF = add(shoulderC, rot([-24 * b, 8], lean));
	const st = pose.stride ?? 0;
	let footN: V;
	let footF: V;
	let kneeN: V | undefined;
	let kneeF: V | undefined;
	if (sit) {
		kneeN = [0.24 * H, -0.258 * H];
		kneeF = [0.215 * H, -0.262 * H];
		footN = [0.255 * H, 0];
		footF = [0.2 * H, -2];
	} else {
		footN = [22 + 92 * st, 0];
		footF = [-22 - 92 * st, 0];
		const kh = -0.24 * H * (1 - 0.3 * crouch);
		kneeN = [footN[0] * 0.55 + 10 + crouch * 40, kh];
		kneeF = [footF[0] * 0.55 - 6 + crouch * 30, kh];
	}
	return {H, hip, shoulderC, neck, head, shN, shF, lean, footN, footF, kneeN, kneeF, sit, b};
};

// ---------- feet, legs ----------
const drawFoot = (g: Ctx, o: DrawOpts, look: Look, at: V, far: boolean, lift = 0) => {
	const s = 1;
	const skin = far ? shadowTone(look.skin) : look.skin;
	if (look.outfit === 'hoodie') {
		const shoe = look.shoes ?? '#F1EEE6';
		const pts: V[] = [
			[at[0] - 30 * s, at[1] - 4],
			[at[0] - 34 * s, at[1] - 34],
			[at[0] + 4, at[1] - 44 - lift],
			[at[0] + 46, at[1] - 26],
			[at[0] + 66, at[1] - 8],
			[at[0] + 60, at[1] + 2],
			[at[0] + 10, at[1] + 3],
		];
		paint(g, o, shapeOf(pts, 0.4), far ? shadowTone(shoe) : shoe, 40);
		strokeLine(g, [[at[0] - 30, at[1] - 6], [at[0] + 62, at[1] - 6]], o.ol * 0.7, OUTLINE);
		return;
	}
	const pts: V[] = [
		[at[0] - 26, at[1] - 2],
		[at[0] - 22, at[1] - 30 - lift],
		[at[0] + 8, at[1] - 34 - lift],
		[at[0] + 40, at[1] - 18],
		[at[0] + 58, at[1] - 6],
		[at[0] + 54, at[1] + 2],
		[at[0] + 6, at[1] + 4],
	];
	paint(g, o, shapeOf(pts, 0.45), skin, 36);
	// sandal sole + straps
	const sole = look.sandals ?? '#6B4428';
	strokeLine(g, [[at[0] - 24, at[1] + 2], [at[0] + 56, at[1] + 2]], o.ol * 1.6, sole);
	strokeLine(g, [[at[0] + 18, at[1] - 26], [at[0] + 28, at[1] - 2]], o.ol * 0.9, sole);
	strokeLine(g, [[at[0] - 8, at[1] - 30], [at[0] - 2, at[1] - 4]], o.ol * 0.9, sole);
};

const drawLeg = (g: Ctx, o: DrawOpts, look: Look, hip: V, knee: V, foot: V, far: boolean) => {
	const color = far ? shadowTone(look.pants ?? '#2E4A6B') : look.pants ?? '#2E4A6B';
	tube(g, o, [hip, knee, add(foot, [0, -30])], 78, color);
};

// ---------- robe / body ----------
const robePoints = (k: Skel, pose: Pose) => {
	const {hip, shoulderC, lean, b, H} = k;
	const sw = (pose.sway ?? 0) * 18 + (pose.stride ?? 0) * 22;
	const R = (p: V, a = lean) => add(shoulderC, rot(p, a));
	const W = (p: V) => add(hip, rot(p, lean * 0.6));
	if (k.sit) {
		const knee = k.kneeN!;
		return [
			R([34, -8]),
			R([62 * b, 8]),
			R([78 * b, 80]),
			W([84 * b, -40]),
			[knee[0] - 10, knee[1] - 44] as V,
			[knee[0] + 30, knee[1] - 20] as V,
			[knee[0] + 34, knee[1] + 40] as V,
			[knee[0] + 26, -40] as V,
			[knee[0] - 80, -46] as V,
			[knee[0] - 120, knee[1] + 60] as V,
			W([-70 * b, 40]),
			W([-90 * b, -50]),
			R([-80 * b, 90]),
			R([-68 * b, 8]),
			R([-32, -10]),
		] as V[];
	}
	const hemY = -0.034 * H;
	return [
		R([32, -8]),
		R([60 * b, 8]),
		R([74 * b, 84]),
		W([84 * b, -40]),
		[148 * b + sw, hemY + 6] as V,
		[70 + sw * 0.8, hemY + 18] as V,
		[-60 + sw * 0.6, hemY + 16] as V,
		[-140 * b + sw * 0.5, hemY + 4] as V,
		W([-92 * b, -40]),
		R([-82 * b, 90]),
		R([-70 * b, 8]),
		R([-34, -10]),
	] as V[];
};

const drawRobe = (g: Ctx, o: DrawOpts, look: Look, k: Skel, pose: Pose) => {
	const pts = robePoints(k, pose);
	const path = shapeOf(pts, 0.42);
	paint(g, o, path, look.robe, 230);
	// a few simple fold lines
	g.save();
	g.clip(path);
	const fold = shadowTone(look.robe);
	const {hip, H} = k;
	const sw = (pose.sway ?? 0) * 18 + (pose.stride ?? 0) * 22;
	if (!k.sit) {
		const hemY = -0.034 * H;
		strokeCurve(g, [add(hip, [40, 10]), add(hip, [64 + sw * 0.3, 0.2 * H]), [96 + sw * 0.7, hemY + 4]], o.ol * 0.9, fold, 0.9);
		strokeCurve(g, [add(hip, [-10, 30]), add(hip, [-6 + sw * 0.3, 0.22 * H]), [4 + sw * 0.6, hemY + 14]], o.ol * 0.9, fold, 0.8);
		strokeCurve(g, [add(hip, [-60, 40]), add(hip, [-80 + sw * 0.2, 0.22 * H]), [-96 + sw * 0.5, hemY + 8]], o.ol * 0.8, fold, 0.6);
	} else {
		const kn = k.kneeN!;
		strokeCurve(g, [[kn[0] - 30, kn[1] + 10], [kn[0] - 10, kn[1] + 120], [kn[0] - 20, -50]], o.ol * 0.8, fold, 0.8);
		strokeCurve(g, [add(hip, [40, -30]), [kn[0] - 60, kn[1] - 20]], o.ol * 0.8, fold, 0.6);
	}
	g.restore();
	return pts;
};

const drawSash = (g: Ctx, o: DrawOpts, look: Look, k: Skel, pose: Pose) => {
	if (!look.sash && !look.rope) return;
	const {hip, lean, b} = k;
	const y0 = -0.075 * k.H;
	const W = (p: V) => add(hip, rot(p, lean * 0.6));
	const front = W([86 * b, y0 - 4]);
	const back = W([-92 * b, y0 + 6]);
	if (look.rope) {
		strokeLine(g, [back, W([0, y0 + 8]), front], 20 + 2 * o.ol, OUTLINE);
		strokeLine(g, [back, W([0, y0 + 8]), front], 20, look.rope);
		const knot = W([52 * b, y0 + 4]);
		const sw = (pose.sway ?? 0) * 10;
		tube(g, o, [knot, add(knot, [6 + sw, 70]), add(knot, [10 + sw * 1.5, 120])], 12, look.rope);
		return;
	}
	const sash = look.sash!;
	const band = shapeOf([
		add(back, [0, -24]),
		W([0, y0 - 18]),
		add(front, [6, -26]),
		add(front, [8, 20]),
		W([0, y0 + 30]),
		add(back, [0, 26]),
	], 0.3);
	paint(g, o, band, sash, 60);
	// knot at the centre front + two hanging ends
	const knot = W([46 * b, y0 + 2]);
	const sw = (pose.sway ?? 0) * 12 + (pose.stride ?? 0) * 8;
	const tail = (dx: number, l: number) =>
		shapeOf([
			add(knot, [dx - 10, 4]),
			add(knot, [dx + 12, 4]),
			add(knot, [dx + 16 + sw, l]),
			add(knot, [dx + 2 + sw * 1.2, l + 18]),
			add(knot, [dx - 12 + sw, l - 6]),
		], 0.4);
	paint(g, o, tail(-14, 120), sash, 30);
	paint(g, o, tail(10, 96), sash, 30);
	paint(g, o, ellipse(knot, 22, 20), sash, 24);
};

const drawHoodie = (g: Ctx, o: DrawOpts, look: Look, k: Skel) => {
	const {hip, shoulderC, lean, b} = k;
	const R = (p: V) => add(shoulderC, rot(p, lean));
	const W = (p: V) => add(hip, rot(p, lean * 0.8));
	const body = shapeOf([R([30, -6]), R([64 * b, 10]), R([78 * b, 110]), W([82 * b, 30]), W([72 * b, 62]), W([-70 * b, 64]), W([-80 * b, 30]), R([-82 * b, 100]), R([-70 * b, 8]), R([-30, -10])], 0.4);
	paint(g, o, body, look.robe, 200);
	// hood bunched behind the neck, pocket, cuff band
	paint(g, o, shapeOf([R([-70, -20]), R([-20, -50]), R([20, -30]), R([-10, 20]), R([-74, 40])], 0.5), look.robe, 60);
	strokeCurve(g, [W([10, 0]), W([56 * b, 4])], o.ol * 0.8, OUTLINE, 0.8);
	strokeLine(g, [W([78 * b, 50]), W([-76 * b, 52])], o.ol * 0.8, OUTLINE);
};

// ---------- arms & hands ----------
const drawHand = (g: Ctx, o: DrawOpts, look: Look, wrist: V, dir: V, state: HandState, far: boolean) => {
	if (state === 'hidden') return;
	const skin = far ? shadowTone(look.skin) : look.skin;
	const d = norm(dir);
	const n = perp(d); // thumb side
	const c = add(wrist, mul(d, 26));
	const ang = Math.atan2(d[1], d[0]);
	if (state === 'open' || state === 'flat') {
		const palm = ellipse(add(wrist, mul(d, 24)), 30, 26, ang);
		// fingers
		const spread = state === 'open' ? 0.32 : 0.12;
		for (let f = 0; f < 4; f++) {
			const a = (f - 1.5) * spread;
			const fd = norm(rot(d, a));
			const base = add(add(wrist, mul(d, 40)), mul(n, (f - 1.5) * 13));
			tube(g, o, [base, add(base, mul(fd, 34 + (f === 1 || f === 2 ? 8 : 0)))], 15, skin);
		}
		tube(g, o, [add(wrist, add(mul(d, 18), mul(n, 22))), add(wrist, add(mul(d, 34), mul(n, 46)))], 16, skin);
		paint(g, o, palm, skin, 26);
		return;
	}
	if (state === 'curled') {
		// withered: small, thin, fingers bent back into the palm (shown gently)
		const palm = ellipse(add(wrist, mul(d, 20)), 22, 20, ang);
		paint(g, o, palm, skin, 20);
		for (let f = 0; f < 4; f++) {
			const base = add(add(wrist, mul(d, 30)), mul(n, (f - 1.5) * 9));
			const tip = add(base, add(mul(d, 6), mul(n, -14)));
			const back = add(tip, add(mul(d, -12), mul(n, -6)));
			strokeLine(g, [base, tip, back], 10 + 2 * o.ol, OUTLINE);
			strokeLine(g, [base, tip, back], 10, skin);
		}
		tube(g, o, [add(wrist, add(mul(d, 12), mul(n, 14))), add(wrist, add(mul(d, 22), mul(n, 6)))], 11, skin);
		return;
	}
	if (state === 'point') {
		tube(g, o, [add(wrist, mul(d, 34)), add(wrist, mul(d, 84))], 15, skin);
		paint(g, o, ellipse(c, 26, 24, ang), skin, 24);
		return;
	}
	if (state === 'fist') {
		paint(g, o, ellipse(add(wrist, mul(d, 22)), 27, 25, ang), skin, 24);
		strokeCurve(g, [add(c, mul(n, -12)), add(add(c, mul(d, 10)), mul(n, 4)), add(c, mul(n, 16))], o.ol * 0.7, OUTLINE, 0.7);
		return;
	}
	// relaxed mitten with a small thumb
	paint(g, o, ellipse(add(c, mul(n, 16)), 10, 17, ang + 0.5), skin, 12);
	paint(g, o, ellipse(c, 25, 31, ang - Math.PI / 2), skin, 26);
};

const armGeo = (sh: V, pose: ArmPose, lean: number, H: number) => {
	const a1 = pose.sh + lean;
	const elbow = add(sh, mul(dirOf(a1), 0.205 * H));
	const a2 = a1 + pose.el;
	const wrist = add(elbow, mul(dirOf(a2), 0.18 * H * (pose.fore ?? 1)));
	return {elbow, wrist, a2};
};

const drawArm = (g: Ctx, o: DrawOpts, look: Look, k: Skel, sh: V, ap: ArmPose, far: boolean) => {
	const {elbow, wrist, a2} = armGeo(sh, ap, k.lean, k.H);
	const sleeveCol = look.sleeveColor ?? look.robe;
	const sleeve = far ? shadowTone(sleeveCol) : sleeveCol;
	const skin = far ? shadowTone(look.skin) : look.skin;
	const w = 60 * (look.build ?? 1) ** 0.5;
	const s = look.outfit === 'hoodie' ? 'long' : look.sleeves ?? 'long';
	if (s === 'long') {
		tube(g, o, [sh, elbow, wrist], w, sleeve);
		// cuff flare
		const d = dirOf(a2);
		const n = perp(d);
		if (look.outfit !== 'hoodie') {
			const cuff = shapeOf([add(wrist, mul(n, -w * 0.62)), add(add(wrist, mul(d, 14)), mul(n, -w * 0.7)), add(add(wrist, mul(d, 14)), mul(n, w * 0.7)), add(wrist, mul(n, w * 0.62)), add(wrist, mul(d, -30))], 0.3);
			paint(g, o, cuff, sleeve, 40);
		} else {
			strokeLine(g, [add(wrist, mul(n, -w * 0.5)), add(wrist, mul(n, w * 0.5))], o.ol, OUTLINE);
		}
	} else if (s === 'elbow') {
		tube(g, o, [elbow, wrist], 40, skin);
		tube(g, o, [sh, add(elbow, mul(norm(sub(elbow, sh)), 10))], w + 6, sleeve);
	} else {
		tube(g, o, [sh, elbow, wrist], 40, skin);
		tube(g, o, [sh, add(sh, mul(norm(sub(elbow, sh)), 70))], w + 4, sleeve);
	}
	drawHand(g, o, look, wrist, dirOf(a2 + (ap.wrist ?? 0)), ap.hand ?? 'relaxed', far);
	return {elbow, wrist, dir: dirOf(a2 + (ap.wrist ?? 0))};
};

// ---------- held items ----------
const drawHeld = (g: Ctx, o: DrawOpts, hold: Hold, wrist: V, dir: V, wristF?: V) => {
	const d = norm(dir);
	const n = perp(d);
	if (hold.item === 'whip' || hold.item === 'cords') {
		const grip = add(wrist, mul(d, 26));
		const handleEnd = add(grip, mul(d, hold.item === 'whip' ? 70 : 20));
		tube(g, o, [add(grip, mul(d, -30)), handleEnd], 16, '#7A4E2C');
		const sw = hold.swing ?? 0;
		for (let c = 0; c < 3; c++) {
			const off = (c - 1) * 8;
			const pts: V[] = [];
			for (let i = 0; i <= 6; i++) {
				const t = i / 6;
				// cords hang under gravity, bent back by the swing
				const along = mul(d, 40 * t * (1 - Math.abs(sw) * 0.3));
				const droop: V = [sw * 160 * t * t + off * t, 200 * t * t * (1 - Math.abs(sw) * 0.5) + off * 0.5 + Math.sin(t * 6 + c) * 6 * t];
				pts.push(add(add(handleEnd, along), droop));
			}
			strokeCurve(g, pts, 9 + 2 * o.ol, OUTLINE);
			strokeCurve(g, pts, 9, c === 1 ? '#9A6A40' : '#8A5A34');
		}
		return;
	}
	if (hold.item === 'phone') {
		const mid = wristF ? mul(add(wrist, wristF), 0.5) : wrist;
		const c = add(mid, mul(d, 30));
		const ang = Math.atan2(d[1], d[0]) + Math.PI / 2 + (hold.lift ?? 0);
		const p = new Path2D();
		const w = 46;
		const h = 86;
		const cos = Math.cos(ang);
		const sin = Math.sin(ang);
		const pt = (x: number, y: number): V => [c[0] + x * cos - y * sin, c[1] + x * sin + y * cos];
		const corners = [pt(-w / 2, -h / 2), pt(w / 2, -h / 2), pt(w / 2, h / 2), pt(-w / 2, h / 2)];
		p.moveTo(...corners[0]);
		for (let i = 1; i < 4; i++) p.lineTo(...corners[i]);
		p.closePath();
		paint(g, o, p, '#262230', 40);
		return;
	}
	if (hold.item === 'coin') {
		paint(g, o, ellipse(add(wrist, mul(d, 40)), 13, 13), '#E2B54A', 10);
		return;
	}
	if (hold.item === 'cage') {
		const top = add(wrist, mul(d, 20));
		const box = shapeOf([add(top, [-50, 30]), add(top, [50, 30]), add(top, [56, 120]), add(top, [-56, 120])], 0.15);
		paint(g, o, box, '#C49A5C', 80);
		for (let i = -2; i <= 2; i++) strokeLine(g, [add(top, [i * 20, 32]), add(top, [i * 22, 118])], o.ol * 0.8, OUTLINE);
		strokeLine(g, [top, add(top, [0, 30])], o.ol, OUTLINE);
	}
	void n;
};

// ---------- head ----------
type HeadGeo = {C: V; rx: number; ry: number; th: number};
const lonX = (h: HeadGeo, phi: number, r = 1) => h.C[0] + h.rx * r * Math.sin(clampA(h.th + phi));
const vis = (h: HeadGeo, phi: number) => Math.cos(h.th + phi);

const drawBackHair = (g: Ctx, o: DrawOpts, look: Look, h: HeadGeo, pose: Pose) => {
	const {C, rx, ry, th} = h;
	const back = -Math.sin(th); // which side is the back of the head
	const sw = (pose.sway ?? 0) * 10;
	if (look.head === 'cloth') {
		const col = look.headColor ?? '#CDB890';
		const pts: V[] = [
			[C[0] + back * rx * 0.2, C[1] - ry * 1.12],
			[C[0] + back * rx * 1.22, C[1] - ry * 0.2],
			[C[0] + back * rx * 1.36 + sw, C[1] + ry * 1.4],
			[C[0] + back * rx * 0.9 + sw, C[1] + ry * 2.0],
			[C[0] - back * rx * 0.4, C[1] + ry * 1.5],
			[C[0] - back * rx * 0.9, C[1] + ry * 0.2],
			[C[0] - back * rx * 0.7, C[1] - ry * 0.9],
		];
		paint(g, o, shapeOf(pts, 0.5), col, 140);
		return;
	}
	if (look.hairStyle === 'shoulder' || look.hairStyle === 'long') {
		const long = look.hairStyle === 'long' ? 1.25 : 1;
		const pts: V[] = [
			[C[0] + back * rx * 0.1, C[1] - ry * 1.06],
			[C[0] + back * rx * 1.12, C[1] - ry * 0.35],
			[C[0] + back * rx * 1.18 + sw * 0.6, C[1] + ry * 0.7],
			[C[0] + back * rx * 1.02 + sw, C[1] + ry * 1.62 * long],
			[C[0] + back * rx * 0.25 + sw, C[1] + ry * 1.72 * long],
			[C[0] - back * rx * 0.55, C[1] + ry * 1.1],
			[C[0] - back * rx * 0.85, C[1] - ry * 0.4],
		];
		const p = shapeOf(pts, 0.5);
		paint(g, o, p, look.hair, 150);
		g.save();
		g.clip(p);
		const tone = shadowTone(look.hair);
		for (let i = 0; i < 4; i++) {
			const x = C[0] + back * rx * (0.3 + i * 0.22);
			strokeCurve(g, [[x, C[1] + ry * 0.1], [x + back * 12 + sw * 0.5, C[1] + ry * 0.9], [x + back * 4 + sw, C[1] + ry * 1.5 * long]], o.ol * 0.7, tone, 0.9);
		}
		g.restore();
	}
	if (look.hairStyle === 'bun') {
		paint(g, o, ellipse([C[0] + back * rx * 0.95, C[1] - ry * 0.35], rx * 0.38, ry * 0.34), look.hair, 40);
	}
};

const drawHead = (g: Ctx, o: DrawOpts, look: Look, h: HeadGeo, pose: Pose) => {
	const {C, rx, ry, th} = h;
	const skin = look.skin;
	const headPath = ellipse(C, rx, ry);
	const hasHairCap = look.hairStyle !== 'bald' || look.head === 'cloth' || look.head === 'wrap';
	const capColor = look.head === 'cloth' ? look.headColor ?? '#CDB890' : look.hair;
	const longHair = (look.hairStyle === 'shoulder' || look.hairStyle === 'long') && look.head !== 'cloth' && look.head !== 'wrap';
	// a point on the head surface at longitude phi (0 = nose) and height yy (-1 top .. 1 chin)
	const surf = (phi: number, yy: number, push = 1): V => {
		const w = Math.sqrt(Math.max(0, 1 - Math.min(yy * yy, 1)));
		return [C[0] + rx * push * Math.max(w, 0.18) * Math.sin(clampA(th + phi)), C[1] + ry * yy];
	};
	if (longHair) {
		// hair volume = slightly larger ellipse; the face is a region bounded by the hairline
		// (with a centre part), the temples and the jaw, so the hair covers the ears and the back.
		const hairPath = ellipse([C[0], C[1] - ry * 0.03], rx * 1.05, ry * 1.04);
		paint(g, o, hairPath, look.hair, rx * 2);
		const face = shapeOf([
			surf(-1.04, -0.12),
			surf(-1.1, 0.5),
			surf(-1.1, 0.98),
			[C[0] + rx * 0.0 + rx * 0.4 * Math.sin(th), C[1] + ry * 1.4],
			surf(1.1, 0.98),
			surf(1.1, 0.5),
			surf(1.04, -0.12),
			surf(0.6, -0.5),
			surf(0.16, -0.64),
			surf(0.0, -0.56),
			surf(-0.16, -0.64),
			surf(-0.6, -0.5),
		], 0.35);
		g.save();
		g.clip(headPath);
		paint(g, o, face, skin, rx * 1.5, false);
		g.lineWidth = o.ol * 0.85;
		g.strokeStyle = OUTLINE;
		g.stroke(face);
		g.restore();
		// jaw outline below the temples
		g.save();
		const below = new Path2D();
		below.rect(C[0] - rx * 2, C[1] - ry * 0.1, rx * 4, ry * 3);
		g.clip(below);
		g.lineWidth = o.ol;
		g.strokeStyle = OUTLINE;
		g.stroke(headPath);
		g.restore();
		// strands on the crown
		const tone = shadowTone(look.hair);
		strokeCurve(g, [surf(-0.05, -0.6, 0.95), surf(-0.35, -0.86, 1.0), surf(-0.9, -0.7, 1.0)], o.ol * 0.7, tone, 0.9);
		strokeCurve(g, [surf(0.05, -0.6, 0.95), surf(0.4, -0.84, 1.0), surf(0.95, -0.66, 1.0)], o.ol * 0.7, tone, 0.9);
	} else if (hasHairCap) {
		// whole head in cap colour, then the face oval in skin (clipped) -> hair frames the face
		paint(g, o, headPath, capColor, rx * 2, false);
		const shortHair = look.hairStyle === 'short' || look.hairStyle === 'curly' || look.hairStyle === 'bun' || look.hairStyle === 'bald';
		const frontal = Math.cos(th); // 1 = facing us, 0 = profile
		const top = look.head === 'cloth' ? 0.5 : shortHair ? 0.74 : 0.72 + 0.06 * frontal;
		const fx = C[0] + rx * (shortHair ? 0.5 : 0.6) * Math.sin(th);
		const fw = rx * ((shortHair ? 0.78 : 0.6) + (shortHair ? 0.26 : 0.4) * frontal);
		const face = ellipse([fx, C[1] + ry * 0.2 + (0.82 - top) * ry * 0.3], fw, ry * (0.82 + (top - 0.62) * 0.6));
		g.save();
		g.clip(headPath);
		paint(g, o, face, skin, rx * 1.4, false);
		if (look.head !== 'cloth') {
			g.lineWidth = o.ol * 0.85;
			g.strokeStyle = OUTLINE;
			g.stroke(face);
		}
		g.restore();
		if (look.hairStyle === 'curly' && look.head !== 'cloth') {
			// bumpy curls along the cap edge
			for (let i = 0; i < 9; i++) {
				const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.95;
				const p: V = [C[0] + Math.cos(a) * rx * 0.98 - Math.sin(th) * 6, C[1] + Math.sin(a) * ry * 0.98];
				paint(g, o, ellipse(p, rx * 0.2, ry * 0.18), look.hair, 14, false);
			}
		}
	} else {
		paint(g, o, headPath, skin, rx * 2, false);
		if (look.grey) paint(g, o, ellipse([C[0] - Math.sin(th) * rx * 0.75, C[1] + ry * 0.1], rx * 0.35, ry * 0.4), '#9C958C', 20, false);
	}
	if (!longHair) {
		g.lineWidth = o.ol;
		g.strokeStyle = OUTLINE;
		g.stroke(headPath);
	}

	// ear (only when it is not covered by long hair or cloth)
	const earVis = vis(h, -1.5);
	if ((look.hairStyle === 'short' || look.hairStyle === 'curly' || look.hairStyle === 'bald' || look.hairStyle === 'bun') && look.head !== 'cloth' && earVis > -0.2) {
		const ex = lonX(h, -1.45, 0.9);
		paint(g, o, ellipse([ex, C[1] + ry * 0.06], 14 + 6 * Math.max(0, earVis), 22), skin, 16);
	}

	// centre part / strands for long hair, band for cloth, wrap for turban
	if (look.head === 'cloth') {
		const band = look.headBand ?? shadowTone(look.headColor ?? '#CDB890');
		strokeCurve(g, [[lonX(h, -1.4, 1.0), C[1] - ry * 0.28], [lonX(h, -0.4, 1.0), C[1] - ry * 0.52], [lonX(h, 0.6, 1.02), C[1] - ry * 0.4]], 14, band);
	} else if (look.head === 'wrap') {
		const col = look.headColor ?? '#D9C9A0';
		const wrap = shapeOf([[C[0] - rx * 1.02, C[1] - ry * 0.32], [C[0] - rx * 0.7, C[1] - ry * 1.18], [C[0] + rx * 0.4, C[1] - ry * 1.24], [C[0] + rx * 1.04, C[1] - ry * 0.4], [C[0] + rx * 0.2, C[1] - ry * 0.5]], 0.5);
		paint(g, o, wrap, col, rx * 1.6);
		strokeCurve(g, [[C[0] - rx * 0.8, C[1] - ry * 0.55], [C[0], C[1] - ry * 0.95], [C[0] + rx * 0.85, C[1] - ry * 0.62]], o.ol * 0.8, OUTLINE, 0.7);
	}

	// beard
	if (look.beard && look.beard !== 'none') {
		const full = look.beard === 'full' ? 1 : 0;
		const col = look.beardColor ?? look.hair;
		const pt = (phi: number, y: number, r = 1): V => [lonX(h, phi, r), C[1] + ry * y];
		const pts: V[] = [
			pt(-1.1, 0.12 - full * 0.1, 1.0),
			pt(-1.06, 0.62),
			pt(-0.55, 0.95 + full * 0.08),
			pt(0.0, 1.06 + full * 0.14, 1.0),
			pt(0.55, 0.95 + full * 0.08),
			pt(1.06, 0.62),
			pt(1.1, 0.12 - full * 0.1, 1.0),
			pt(0.86, 0.66 - full * 0.2),
			pt(0.42, 0.56),
			pt(0.16, 0.38),
			pt(0.0, 0.41),
			pt(-0.16, 0.38),
			pt(-0.42, 0.56),
			pt(-0.86, 0.66 - full * 0.2),
		];
		const bp = shapeOf(pts, 0.45);
		paint(g, o, bp, col, rx * 1.2);
		if (look.grey) {
			g.save();
			g.clip(bp);
			for (let i = 0; i < 4; i++) strokeCurve(g, [pt(-0.5 + i * 0.3, 0.55), pt(-0.45 + i * 0.3, 0.95)], o.ol * 0.9, '#B8B0A6', look.grey);
			g.restore();
		}
		const tone = shadowTone(col);
		g.save();
		g.clip(bp);
		strokeCurve(g, [pt(-0.3, 0.6), pt(-0.2, 0.95)], o.ol * 0.6, tone, 0.8);
		strokeCurve(g, [pt(0.2, 0.62), pt(0.25, 1.0)], o.ol * 0.6, tone, 0.8);
		g.restore();
	}

	// nose: a small wedge that pokes past the silhouette when the head is turned
	const s = Math.sin(th);
	const nb: V = [C[0] + rx * 0.97 * s, C[1] - ry * 0.04];
	const nt: V = [C[0] + rx * s * 1.16, C[1] + ry * 0.14];
	const nbase: V = [C[0] + rx * 0.95 * s, C[1] + ry * 0.22];
	const nose = new Path2D();
	nose.moveTo(...nb);
	nose.quadraticCurveTo(nt[0] - s * 2, nt[1] - 10, nt[0], nt[1]);
	nose.quadraticCurveTo(nt[0] - s * 6, nbase[1] + 4, nbase[0], nbase[1]);
	nose.closePath();
	g.fillStyle = Math.abs(s) > 0.8 ? skin : shadowTone(skin);
	g.fill(nose);
	const np = new Path2D();
	np.moveTo(...nb);
	np.quadraticCurveTo(nt[0] - s * 2, nt[1] - 10, nt[0], nt[1]);
	np.quadraticCurveTo(nt[0] - s * 6, nbase[1] + 4, nbase[0], nbase[1]);
	g.lineWidth = o.ol * 0.9;
	g.strokeStyle = OUTLINE;
	g.lineCap = 'round';
	g.stroke(np);

	// eyes + brows
	const eyes = pose.eyes ?? 'open';
	for (const phi of [-0.42, 0.42]) {
		const c = vis(h, phi);
		if (c < 0.2) continue;
		const ex = lonX(h, phi, 0.94);
		const ey = C[1] - ry * 0.05;
		const ew = 36 * (0.55 + 0.45 * c);
		const eh = 22;
		const inner = phi < 0 ? 1 : -1; // which way is toward the nose
		const innerSign = Math.sign(Math.sin(th)) === 0 ? 1 : 1;
		void innerSign;
		const towardNose = Math.sign(lonX(h, 0, 0.94) - ex) || inner;
		// brow
		const br = pose.brow ?? {inner: 0, outer: 0};
		const bIn: V = [ex + towardNose * ew * 0.55, ey - eh * 1.25 + br.inner];
		const bOut: V = [ex - towardNose * ew * 0.6, ey - eh * 1.3 + br.outer];
		const bMid: V = [(bIn[0] + bOut[0]) / 2, Math.min(bIn[1], bOut[1]) - 5 + (br.inner > 6 ? 4 : 0)];
		strokeCurve(g, [bOut, bMid, bIn], 11, look.brow ?? '#2C1B11');
		if (eyes === 'happy' || eyes === 'closed') {
			const up = eyes === 'happy' ? -1 : 1;
			strokeCurve(g, [[ex - ew / 2, ey], [ex, ey + up * eh * 0.55], [ex + ew / 2, ey]], o.ol * 1.1, OUTLINE);
			continue;
		}
		const almond = new Path2D();
		almond.moveTo(ex - ew / 2, ey);
		almond.quadraticCurveTo(ex, ey - eh * 1.0, ex + ew / 2, ey + 1);
		almond.quadraticCurveTo(ex, ey + eh * 0.78, ex - ew / 2, ey);
		almond.closePath();
		g.fillStyle = '#FBF6EA';
		g.fill(almond);
		g.save();
		g.clip(almond);
		const gz = pose.gaze ?? [0, 0];
		const facing = Math.sign(s) || 1;
		const pr = eyes === 'wide' ? 8 : 9.5;
		const pc: V = [ex + facing * ew * 0.16 + gz[0] * ew * 0.3, ey + 1 + gz[1] * 5];
		g.fillStyle = '#1C120C';
		g.beginPath();
		g.arc(pc[0], pc[1], pr, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = 'rgba(255,255,255,0.9)';
		g.beginPath();
		g.arc(pc[0] + 3, pc[1] - 3.5, 2.6, 0, Math.PI * 2);
		g.fill();
		// lids: narrow (anger), blink
		const lid = Math.max(pose.lid ?? (eyes === 'narrow' ? 0.36 : eyes === 'wide' ? -0.1 : 0), pose.blink ?? 0);
		if (lid > 0) {
			g.fillStyle = skin;
			g.fillRect(ex - ew, ey - eh * 1.2, ew * 2, eh * 1.9 * lid);
			strokeLine(g, [[ex - ew / 2, ey - eh * 1.0 + eh * 1.9 * lid * 0.82], [ex + ew / 2, ey - eh * 1.0 + eh * 1.9 * lid * 0.82]], o.ol * 1.1, OUTLINE);
		}
		g.restore();
		g.lineWidth = o.ol * 0.75;
		g.strokeStyle = OUTLINE;
		g.stroke(almond);
		// heavier upper lid line
		const ul = new Path2D();
		ul.moveTo(ex - ew / 2, ey);
		ul.quadraticCurveTo(ex, ey - eh * 1.0, ex + ew / 2, ey + 1);
		g.lineWidth = o.ol * 1.15;
		g.stroke(ul);
		// tear on the lower lid
		const tear = pose.tear ?? 0;
		if (tear > 0) {
			const tx = ex + towardNose * ew * 0.18;
			const ty = ey + eh * 0.62 + tear * 10;
			const drop = new Path2D();
			drop.moveTo(tx, ty - 9 * tear);
			drop.quadraticCurveTo(tx + 8 * tear, ty + 2, tx, ty + 8 * tear);
			drop.quadraticCurveTo(tx - 8 * tear, ty + 2, tx, ty - 9 * tear);
			g.fillStyle = 'rgba(205,232,255,0.95)';
			g.fill(drop);
			g.lineWidth = o.ol * 0.5;
			g.strokeStyle = 'rgba(42,26,16,0.7)';
			g.stroke(drop);
			g.fillStyle = 'rgba(255,255,255,1)';
			g.beginPath();
			g.arc(tx - 2, ty - 1, 2.2 * tear, 0, Math.PI * 2);
			g.fill();
			// wet shine along the lower lid
			strokeCurve(g, [[ex - ew * 0.4, ey + eh * 0.45], [ex, ey + eh * 0.6], [ex + ew * 0.4, ey + eh * 0.45]], 3, 'rgba(220,240,255,0.9)', tear);
		}
	}
};

// ---------- the whole figure ----------
export type FigureInfo = {head: V; headTop: V; handN: V; handF: V; chest: V; feet: V};

export const drawFigure = (g: Ctx, look: Look, pose: Pose, o: DrawOpts): FigureInfo => {
	const k = skeleton(look, pose);
	const hs = look.headScale ?? 1;
	const yaw = pose.yaw ?? 0.85;
	const h: HeadGeo = {C: k.head, rx: 98 * hs, ry: 108 * hs, th: yaw * 1.35};
	const nearA: ArmPose = pose.near ?? {sh: 0.12, el: 0.18};
	const farA: ArmPose = pose.far ?? {sh: -0.08, el: 0.2};
	const hoodie = look.outfit === 'hoodie';

	// far side first
	const farArm = () => drawArm(g, o, look, k, k.shF, farA, true);
	let farInfo: ReturnType<typeof drawArm> | null = null;
	if (!pose.backHand && !pose.noArms) farInfo = farArm();
	if (hoodie) {
		drawLeg(g, o, look, add(k.hip, [-20, 0]), k.kneeF!, k.footF, true);
		drawFoot(g, o, look, add(k.footF, [-30, 0]), true);
		drawLeg(g, o, look, add(k.hip, [20, 0]), k.kneeN!, k.footN, false);
		drawFoot(g, o, look, add(k.footN, [-26, 0]), false);
		drawHoodie(g, o, look, k);
	} else {
		drawFoot(g, o, look, k.footF, true, pose.stride && pose.stride < 0 ? 0 : 0);
		drawFoot(g, o, look, k.footN, false);
		drawRobe(g, o, look, k, pose);
		drawSash(g, o, look, k, pose);
	}
	if (pose.backHand && !pose.noArms) farInfo = farArm();

	// neck + head
	const neckPath = shapeOf([add(k.neck, [-26, -40]), add(k.neck, [30, -44]), add(k.neck, [34, 14]), add(k.neck, [-30, 16])], 0.3);
	paint(g, o, neckPath, look.skin, 40);
	drawBackHair(g, o, look, h, pose);
	drawHead(g, o, look, h, pose);

	// near side on top
	const nearInfo = pose.noArms ? {wrist: k.shN, dir: [0, 1] as V, elbow: k.shN} : drawArm(g, o, look, k, k.shN, nearA, false);
	if (pose.hold && !pose.noArms) {
		const useFar = pose.hold.item === 'phone';
		drawHeld(g, o, pose.hold, nearInfo.wrist, nearInfo.dir, useFar && farInfo ? farInfo.wrist : undefined);
	}
	return {
		head: k.head,
		headTop: [k.head[0], k.head[1] - h.ry],
		handN: nearInfo.wrist,
		handF: farInfo ? farInfo.wrist : k.shF,
		chest: add(k.shoulderC, [20, 80]),
		feet: [0, 0],
	};
};

// Big detailed hand for the macro shot (S5): curl 1 = withered, 0 = open and strong.
export const drawBigHand = (g: Ctx, skin: string, sleeve: string, curl: number, o: DrawOpts) => {
	const c = Math.max(0, Math.min(1, curl));
	// forearm + sleeve coming in from the left
	tube(g, o, [[-520, 40], [-150, 10]], 150, skin);
	paint(g, o, shapeOf([[-640, -120], [-330, -110], [-300, 150], [-640, 170]], 0.25), sleeve, 260);
	strokeCurve(g, [[-320, -100], [-300, 0], [-310, 140]], o.ol * 1.2, OUTLINE);
	// palm
	const palm = shapeOf([[-170, -70], [40, -92], [110, -40], [118, 60], [40, 104], [-160, 84]], 0.45);
	paint(g, o, palm, skin, 220);
	// fingers: each one bends at two joints by `c`
	const fingers = [
		{base: [96, -78] as V, len: [70, 56, 44], spread: -0.22},
		{base: [118, -26] as V, len: [78, 62, 48], spread: -0.06},
		{base: [118, 26] as V, len: [74, 58, 44], spread: 0.08},
		{base: [100, 70] as V, len: [60, 48, 38], spread: 0.22},
	];
	for (const f of fingers) {
		let a = f.spread * (1 - c);
		let p: V = f.base;
		const pts: V[] = [p];
		for (let j = 0; j < 3; j++) {
			a += c * (j === 0 ? 1.25 : 1.15);
			const d: V = [Math.cos(a), Math.sin(a)];
			p = add(p, mul(d, f.len[j] * (1 - c * 0.12)));
			pts.push(p);
		}
		const w = 46 * (1 - c * 0.22);
		tube(g, o, pts, w, skin);
		// knuckle creases
		strokeLine(g, [add(pts[1], [-w * 0.2, -w * 0.3]), add(pts[1], [w * 0.1, w * 0.3])], o.ol * 0.5, shadowTone(skin));
	}
	// thumb
	const ta = -1.0 + c * 0.8;
	const t1: V = [-40, -86];
	const t2 = add(t1, [Math.cos(ta) * 84, Math.sin(ta) * 84]);
	const t3 = add(t2, [Math.cos(ta + 0.5 + c * 0.6) * 60, Math.sin(ta + 0.5 + c * 0.6) * 60]);
	tube(g, o, [t1, t2, t3], 50 * (1 - c * 0.2), skin);
	// palm line
	strokeCurve(g, [[-120, -30], [-20, 10], [60, -10]], o.ol * 0.6, shadowTone(skin), 0.8);
};

// Close-up for S6: two hands braiding three small cords into a whip. phase animates the twist.
export const drawBraidHands = (g: Ctx, skin: string, sleeve: string, phase: number, o: DrawOpts) => {
	// cords: three strands twisting along x, from the left hand to the right hand
	const strand = (k: number) => {
		const pts: V[] = [];
		for (let i = 0; i <= 24; i++) {
			const x = -420 + i * 36;
			const a = i * 0.55 + phase * 4 + (k * Math.PI * 2) / 3;
			pts.push([x, 40 + Math.sin(a) * 16 + Math.sin(i * 0.4 + phase) * 8]);
		}
		return pts;
	};
	for (let k = 0; k < 3; k++) {
		const pts = strand(k);
		strokeCurve(g, pts, 26 + 2 * o.ol, OUTLINE);
		strokeCurve(g, pts, 26, k === 1 ? '#A0703F' : k === 2 ? '#8E5F36' : '#7E522E');
	}
	// loose cord ends hanging from the right
	strokeCurve(g, [[440, 40], [520, 120], [560, 260]], 22 + 2 * o.ol, OUTLINE);
	strokeCurve(g, [[440, 40], [520, 120], [560, 260]], 22, '#8E5F36');
	// two hands gripping, with sleeves coming in from the bottom corners
	const hand = (cx: number, flip: number, roll: number) => {
		tube(g, o, [[cx - flip * 260, 420], [cx - flip * 60, 120]], 180, sleeve);
		const palm = shapeOf([[cx - 80, -10], [cx + 70, -30], [cx + 110, 40], [cx + 70, 120], [cx - 90, 110]], 0.45);
		paint(g, o, palm, skin, 200);
		for (let f = 0; f < 4; f++) {
			const fx = cx - 60 + f * 42 + roll * 10;
			tube(g, o, [[fx, 0], [fx + 6, -46], [fx + 22, -70 - roll * 8]], 34, skin);
		}
		tube(g, o, [[cx + flip * 70, 70], [cx + flip * 120, 30], [cx + flip * 130, -10]], 38, skin);
	};
	hand(-190, -1, Math.sin(phase * 3) * 0.5);
	hand(220, 1, Math.cos(phase * 3) * 0.5);
};
