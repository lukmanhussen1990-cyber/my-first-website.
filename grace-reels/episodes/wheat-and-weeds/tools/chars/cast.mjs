// The cast of "Wheat and Weeds" and the assembly of each character view into rig parts.
// assemble(spec, view) -> [{name, svg, joint, parent, z, variants?}] in figure coordinates, where
// `joint` is the point that links a part to its parent (the rig pivot).
import {deep, light, line, blob, ellipse, OUTLINE} from './geom.mjs';
import {beard, BX, foot, GY, hair, hand, headBack, headSide, headTQ, limb, LW, metrics, neck, skirt, torso} from './parts.mjs';

export const CAST = {
	farmer: {
		id: 'farmer', height: 1960, build: 1.15, belly: 0.25, skin: '#b8743f', hair: 'wrap', wrapColor: '#e9ddc2', hairColor: '#1e1712',
		brow: '#1e1712', beard: 'short', beardColor: '#1e1712', nose: 1.1, jaw: 1.05, seed: 3,
		robe: {color: '#8a5634', length: 'calf', sleeves: 'elbow', belt: {color: '#4e3221', width: 1.8, tail: true}, hemBand: '#6b4128'},
		strap: '#c9b48a', bag: '#d9c59c',
	},
	jesus: {
		id: 'jesus', height: 1980, build: 1.0, skin: '#b07045', hair: 'shoulder', hairColor: '#3b2416', brow: '#2e1c12', beard: 'short', beardColor: '#3b2416',
		nose: 1.0, seed: 5, robe: {color: '#efe7d6', length: 'ankle', sleeves: 'long', belt: {color: '#8d9fb2', width: 2.2, tail: true}},
	},
	servantA: {
		id: 'servantA', height: 1840, build: 0.92, skin: '#c98b5a', hair: 'curly', hairColor: '#1a1410', brow: '#1a1410', beard: 'stubble', nose: 0.9, jaw: 0.95, seed: 11,
		robe: {color: '#7f8f55', length: 'knee', sleeves: 'short', belt: {color: '#5a4026', width: 1.6}},
	},
	servantB: {
		id: 'servantB', height: 1870, build: 1.25, belly: 0.65, skin: '#9c5c33', hair: 'fringe', hairColor: '#2a1d14', brow: '#2a1d14', beard: 'full', beardColor: '#3a2a1e', nose: 1.2, jaw: 1.1, seed: 13,
		robe: {color: '#b0583a', length: 'knee', sleeves: 'elbow', belt: {color: '#5a3a22', width: 1.8}},
	},
	servantC: {
		id: 'servantC', height: 1920, build: 0.9, skin: '#c48a5e', hair: 'cloth', wrapColor: '#7b93a8', bandColor: '#3a3a44', hairColor: '#a29d96', brow: '#8a857e', beard: 'short', beardColor: '#b0aaa2', nose: 1.15, seed: 17,
		robe: {color: '#cdb38a', length: 'calf', sleeves: 'long', belt: {color: '#6b4a2e', width: 1.6, tail: true}},
	},
	enemy: {
		id: 'enemy', height: 2080, build: 1.05, skin: '#2c2b33', splay: true, hair: 'hood', wrapColor: '#2b2e3d', seed: 19, faceless: true,
		robe: {color: '#2b2e3d', length: 'ankle', sleeves: 'long'},
	},
	saul: {
		id: 'saul', height: 1940, build: 1.0, skin: '#b8774a', hair: 'short', hairColor: '#1e1712', brow: '#1e1712', beard: 'short', beardColor: '#1e1712', nose: 1.05, seed: 23,
		robe: {color: '#3d4f7c', length: 'ankle', sleeves: 'long', belt: {color: '#c9a24a', width: 2.0, tail: true}, hemBand: '#c9a24a'},
		mantle: {color: '#7a2f3c', stripe: '#d8b45a'}, strap: '#6b4a2e', satchel: '#8a5a34',
	},
	paul: {
		id: 'paul', height: 1900, build: 1.02, belly: 0.25, skin: '#b8774a', hair: 'fringe', hairColor: '#bcb6ae', brow: '#9a948c', beard: 'full', beardColor: '#c8c2b8', nose: 1.15, seed: 29,
		robe: {color: '#8b7355', length: 'ankle', sleeves: 'long', belt: {color: '#5a4026', width: 1.8, tail: true}},
	},
	soldier: {
		id: 'soldier', height: 1940, build: 1.12, skin: '#a8673e', hair: 'helmet', wrapColor: '#a08c5e', brow: '#1e1712', beard: 'short', beardColor: '#2a1d14', nose: 1.1, seed: 31,
		robe: {color: '#9b3b2a', length: 'knee', sleeves: 'short', belt: {color: '#4e3221', width: 2.2}},
	},
	reaper: {
		id: 'reaper', height: 1880, build: 1.05, skin: '#a8673e', hair: 'cloth', wrapColor: '#d9c9a0', bandColor: '#8a5a34', hairColor: '#1e1712', brow: '#1e1712', beard: 'short', beardColor: '#1e1712', seed: 37,
		robe: {color: '#c08a4a', length: 'knee', sleeves: 'elbow', belt: {color: '#5a3a22', width: 1.6}},
	},
};

// Rest joints for a view: arms hang with a slight bend, hands a little forward.
const restJoints = (s, M, view, T) => {
	const u = M.u;
	const arm = (sh, tag) => {
		if (view === 'side') {
			const elbow = [sh[0] - 0.5 * u, M.elbow];
			return {sh, elbow, wrist: [elbow[0] + 1.9 * u, M.wrist], dir: 78};
		}
		if (view === 'tq') {
			const inX = tag === 'near' ? 0.5 : 0.4;
			const elbow = [sh[0] + inX * u, M.elbow];
			return {sh, elbow, wrist: [elbow[0] + (tag === 'near' ? 0.9 : 0.6) * u, M.wrist], dir: 86};
		}
		const out = tag === 'near' ? -1 : 1;
		const elbow = [sh[0] + out * 0.5 * u, M.elbow];
		return {sh, elbow, wrist: [elbow[0] + out * 0.2 * u, M.wrist], dir: 90};
	};
	const hipN = view === 'side' ? [BX + 1.2 * u, M.hip] : view === 'tq' ? [BX - 2.4 * u * M.B, M.hip] : [BX - 3.0 * u * M.B, M.hip];
	const hipF = view === 'side' ? [BX - 1.2 * u, M.hip] : view === 'tq' ? [BX + 3.0 * u * M.B, M.hip] : [BX + 3.0 * u * M.B, M.hip];
	const leg = (hip, dx) => ({hip, knee: [hip[0] + dx * u, M.knee], ankle: [hip[0] + dx * 0.5 * u, M.ankle - 1.6 * u]});
	return {
		armN: arm(T.shoulderNear, 'near'),
		armF: arm(T.shoulderFar, 'far'),
		legN: leg(hipN, view === 'side' ? 0.5 : 0),
		legF: leg(hipF, view === 'side' ? -0.3 : 0),
	};
};

const sleeveColor = (s) => s.robe.color;

export const assemble = (s, view) => {
	const M = metrics(s);
	const u = M.u;
	const lw = LW(M);
	const H = view === 'side' ? headSide(s, M) : view === 'tq' ? headTQ(s, M) : headBack(s, M);
	const N = neck(s, M, view, H);
	const T = torso(s, M, view);
	const K = skirt(s, M, view);
	const J = restJoints(s, M, view, T);
	const hr = hair(s, M, view, H);
	const parts = [];
	const add = (name, svg, joint, parent, z, extra = {}) => parts.push({name, svg, joint, parent, z, ...extra});
	const far = (c) => deep(c, 0.82);
	const skinF = far(s.skin);
	const sl = sleeveColor(s);
	const sleeves = s.robe.sleeves ?? 'long';
	const cuff = s.robe.hemBand ?? null;
	const faceless = !!s.faceless;

	// ---- arms ----
	const armParts = (A, tag, dark, z0) => {
		const c = dark ? far(sl) : sl;
		const sk = dark ? skinF : s.skin;
		const rU = 2.4 * u * (0.9 + 0.12 * M.B);
		const upperFill = sleeves === 'short' ? c : c;
		// upper arm: sleeve; a short sleeve shows skin below it
		let upper;
		if (sleeves === 'short') {
			const mid = [A.sh[0] + (A.elbow[0] - A.sh[0]) * 0.55, A.sh[1] + (A.elbow[1] - A.sh[1]) * 0.55];
			upper = limb(M, A.sh, A.elbow, rU * 0.82, rU * 0.68, sk, {fold: false}) + limb(M, A.sh, mid, rU * 1.02, rU * 1.08, upperFill, {fold: false});
		} else upper = limb(M, A.sh, A.elbow, rU, rU * (sleeves === 'long' ? 1.08 : 1.12), upperFill, {cuff: sleeves === 'elbow' ? deep(c, 0.7) : null});
		add(`arm_upper_${tag}`, upper, A.sh, 'torso', z0);
		const fore = sleeves === 'long' ? limb(M, A.elbow, A.wrist, rU * 0.98, rU * 1.0, c, {cuff: cuff ?? deep(c, 0.72)}) : limb(M, A.elbow, A.wrist, rU * 0.74, rU * 0.6, sk, {fold: false});
		add(`forearm_${tag}`, fore, A.elbow, `arm_upper_${tag}`, z0 - 0.1);
		const variants = {};
		for (const k of ['relaxed', 'open', 'fist', 'throw', 'hold', 'point', ...(s.splay ? ['splay'] : [])]) variants[k] = hand(M, sk, A.wrist, A.dir, k, view === 'side' ? 1 : tag === 'near' ? -1 : 1);
		add(`hand_${tag}`, variants.relaxed, A.wrist, `forearm_${tag}`, z0 - 0.2, {variants});
	};
	// ---- legs ----
	const legParts = (L, tag, dark, z0) => {
		const sk = dark ? skinF : s.skin;
		const rT = 3.0 * u * (0.9 + 0.14 * M.B);
		add(`thigh_${tag}`, limb(M, L.hip, L.knee, rT, rT * 0.78, sk, {fold: false}), L.hip, 'torso', z0);
		add(`shin_${tag}`, limb(M, L.knee, L.ankle, rT * 0.74, rT * 0.5, sk, {fold: false}), L.knee, `thigh_${tag}`, z0 + 0.05);
		add(`foot_${tag}`, foot(M, sk, L.ankle, 1, view), L.ankle, `shin_${tag}`, z0 + 0.1);
	};

	if (view === 'side') {
		armParts(J.armF, 'far', true, 10);
		legParts(J.legF, 'far', true, 20);
		legParts(J.legN, 'near', false, 25);
		add('skirt', K.svg, T.waist, 'torso', 30);
		add('neck', N.svg, N.joint, 'torso', 35);
		add('torso', T.svg, T.hip, null, 40);
		if (hr.back) add('hair_back', hr.back, H.neck, 'head', 44);
		add('head', faceless ? ellipse(H.center[0], H.center[1], 8.6 * H.u, 9.4 * H.u, '#0b0b12') : H.svg, N.headJoint, 'neck', 45);
		if (!faceless) add('beard', beard(s, M, view, H), H.neck, 'head', 46);
		add('hair', hr.front, H.neck, 'head', 47);
		if (!faceless) {
			add('brow_near', H.brow, H.browC, 'head', 48);
			add('mouth', H.mouth.rest, H.mouthC, 'head', 49, {variants: H.mouth});
		}
		armParts(J.armN, 'near', false, 60);
	} else if (view === 'tq') {
		armParts(J.armF, 'far', true, 10);
		legParts(J.legF, 'far', true, 20);
		legParts(J.legN, 'near', false, 25);
		add('skirt', K.svg, T.waist, 'torso', 30);
		add('neck', N.svg, N.joint, 'torso', 35);
		add('torso', T.svg, T.hip, null, 40);
		if (hr.back) add('hair_back', hr.back, H.neck, 'head', 44);
		add('head', faceless ? ellipse(H.center[0], H.center[1], 8.6 * H.u, 9.4 * H.u, '#0b0b12') : H.svg, N.headJoint, 'neck', 45);
		if (!faceless) add('beard', beard(s, M, view, H), H.neck, 'head', 46);
		add('hair', hr.front, H.neck, 'head', 47);
		if (!faceless) {
			add('brow_near', H.brows.near, H.browNearC, 'head', 48);
			add('brow_far', H.brows.far, H.browFarC, 'head', 48.5);
			add('mouth', H.mouth.rest, H.mouthC, 'head', 49, {variants: H.mouth});
		}
		armParts(J.armN, 'near', false, 60);
	} else {
		legParts(J.legF, 'far', false, 20);
		legParts(J.legN, 'near', false, 25);
		add('skirt', K.svg, T.waist, 'torso', 30);
		add('torso', T.svg, T.hip, null, 40);
		armParts(J.armF, 'far', false, 42);
		armParts(J.armN, 'near', false, 43);
		add('neck', N.svg, N.joint, 'torso', 44);
		add('head', H.svg, N.headJoint, 'neck', 45);
		add('hair', hr.front, H.neck, 'head', 47);
	}
	// props carried on the body
	if (s.bag && view !== 'back') {
		const bx = view === 'side' ? BX + 6.4 * u * M.B : BX - 7.4 * u * M.B;
		const by = M.waist + 1.0 * u;
		const bag = blob([[bx - 3.4 * u, by - 1.2 * u], [bx + 3.0 * u, by - 1.6 * u], [bx + 4.4 * u, by + 4.0 * u], [bx + 2.4 * u, by + 8.4 * u], [bx - 2.6 * u, by + 8.6 * u], [bx - 4.2 * u, by + 4.0 * u]], s.bag) +
			line([[bx - 3.2 * u, by + 0.6 * u], [bx + 3.2 * u, by + 0.2 * u]], deep(s.bag, 0.7), lw * 1.4) +
			line([[bx - 2.0 * u, by + 3.0 * u], [bx - 1.0 * u, by + 7.4 * u]], deep(s.bag, 0.8), lw) +
			line([[bx + 1.6 * u, by + 2.6 * u], [bx + 2.2 * u, by + 7.0 * u]], deep(s.bag, 0.8), lw);
		add('bag', bag, [bx, by], 'torso', view === 'side' ? 41 : 41);
	}
	if (s.satchel && view !== 'back') {
		const bx = view === 'side' ? BX + 5.6 * u : BX - 7.6 * u;
		const by = M.waist - 0.6 * u;
		const sc = s.satchel;
		const sat = blob([[bx - 3.6 * u, by], [bx + 3.6 * u, by - 0.4 * u], [bx + 3.9 * u, by + 6.4 * u], [bx - 3.8 * u, by + 6.6 * u]], sc, {tension: 0.5}) +
			blob([[bx - 3.6 * u, by], [bx + 3.6 * u, by - 0.4 * u], [bx + 3.2 * u, by + 2.8 * u], [bx - 3.2 * u, by + 3.0 * u]], deep(sc, 0.8), {tension: 0.5, stroke: OUTLINE, sw: lw * 0.8}) +
			// scrolls sticking out
			blob([[bx - 2.6 * u, by - 3.4 * u], [bx - 1.0 * u, by - 3.6 * u], [bx - 0.8 * u, by + 0.4 * u], [bx - 2.6 * u, by + 0.4 * u]], '#efe2c0', {tension: 0.3, stroke: OUTLINE, sw: lw * 0.8}) +
			blob([[bx + 0.2 * u, by - 2.6 * u], [bx + 1.8 * u, by - 2.8 * u], [bx + 2.0 * u, by + 0.2 * u], [bx + 0.2 * u, by + 0.2 * u]], '#e6d6ac', {tension: 0.3, stroke: OUTLINE, sw: lw * 0.8});
		add('satchel', sat, [bx, by], 'torso', 41);
	}
	return {parts: parts.sort((a, b) => a.z - b.z), M, H, sole: [BX, GY], height: M.Hf};
};

// Loose props drawn on their own canvas around (0,0) = the grip point (in the hand).
export const PROPS = {
	sickle: (u, lw) =>
		blob([[-0.6 * u, -1.0 * u], [0.6 * u, -1.0 * u], [0.7 * u, 5.4 * u], [-0.7 * u, 5.4 * u]], '#7a4e2c', {tension: 0.3}) +
		blob([[-0.4 * u, -1.0 * u], [-0.6 * u, -4.0 * u], [1.6 * u, -8.4 * u], [6.4 * u, -9.4 * u], [9.6 * u, -6.6 * u], [9.2 * u, -4.6 * u], [6.6 * u, -7.4 * u], [3.0 * u, -6.6 * u], [1.0 * u, -3.4 * u], [0.6 * u, -1.0 * u]], '#b9bcc0', {stroke: OUTLINE, sw: lw}) +
		line([[1.6 * u, -6.0 * u], [5.8 * u, -8.2 * u], [8.8 * u, -6.4 * u]], '#e8eaee', lw * 0.8),
	scroll: (u, lw) =>
		blob([[-3.6 * u, -1.0 * u], [3.6 * u, -1.0 * u], [3.6 * u, 1.0 * u], [-3.6 * u, 1.0 * u]], '#efe2c0', {tension: 0.2, stroke: OUTLINE, sw: lw}) +
		ellipse(-3.6 * u, 0, 0.8 * u, 1.3 * u, '#e2cf9e', {stroke: OUTLINE, sw: lw}) +
		ellipse(3.6 * u, 0, 0.8 * u, 1.3 * u, '#e2cf9e', {stroke: OUTLINE, sw: lw}) +
		line([[-1.2 * u, -1.0 * u], [-1.2 * u, 1.0 * u]], '#9b3b2a', lw * 2),
	quill: (u, lw) =>
		blob([[0, 0], [0.4 * u, -2.0 * u], [1.6 * u, -7.0 * u], [2.6 * u, -9.6 * u], [2.0 * u, -6.0 * u], [0.6 * u, -1.0 * u]], '#f4efe4', {stroke: OUTLINE, sw: lw * 0.8}) + line([[0.2 * u, -0.6 * u], [2.2 * u, -8.6 * u]], '#9a8f80', lw * 0.6),
	spear: (u, lw) =>
		blob([[-0.45 * u, -26 * u], [0.45 * u, -26 * u], [0.45 * u, 22 * u], [-0.45 * u, 22 * u]], '#7a5232', {tension: 0.1}) +
		blob([[0, -32 * u], [1.4 * u, -27.4 * u], [0.5 * u, -25.6 * u], [-0.5 * u, -25.6 * u], [-1.4 * u, -27.4 * u]], '#b9bcc0', {stroke: OUTLINE, sw: lw, tension: 0.3}),
	sheaf: (u, lw) => {
		let s = '';
		for (let i = 0; i < 9; i++) {
			const a = (i - 4) * 0.07;
			const x = Math.sin(a) * 12 * u;
			s += line([[0, 4 * u], [x * 0.5, -6 * u], [x, -12 * u]], i % 2 ? '#c9a24a' : '#b8913e', lw * 1.6);
			s += ellipse(x, -13.6 * u, 0.9 * u, 2.4 * u, i % 2 ? '#e6bf5c' : '#d8ae4a', {rot: (a * 180) / Math.PI, stroke: OUTLINE, sw: lw * 0.6});
		}
		s += blob([[-2.2 * u, -1.0 * u], [2.2 * u, -1.0 * u], [2.0 * u, 1.0 * u], [-2.0 * u, 1.0 * u]], '#8a5a34', {tension: 0.3, stroke: OUTLINE, sw: lw});
		return s;
	},
	basket: (u, lw) =>
		blob([[-6 * u, -3 * u], [6 * u, -3 * u], [5 * u, 4 * u], [-5 * u, 4 * u]], '#b5874f', {tension: 0.5}) +
		line([[-5.6 * u, -0.5 * u], [5.6 * u, -0.5 * u]], '#8a6034', lw * 1.2) + line([[-5.2 * u, 1.8 * u], [5.2 * u, 1.8 * u]], '#8a6034', lw * 1.2) +
		ellipse(0, -3 * u, 6 * u, 1.2 * u, '#9b6d3c', {stroke: OUTLINE, sw: lw}),
};

export {light};
