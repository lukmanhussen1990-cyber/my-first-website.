// Per-shot camera path, cast, poses, faces, bubbles and mood. One function per shot id in story/script.json.
// Each function gets (S, {t, p, d, gt}): t = seconds into the shot, p = 0..1 progress.
const HY = (c) => 4.72 * c.root.scale.x; // head-centre height of a character
const head = (c, pos) => [pos[0], pos[1] + HY(c), pos[2]];
const PI = Math.PI;
const walk = (t, rate = 1.6) => t * rate * PI * 2;

/* ---------- reusable staging ---------- */
const K = [-100, 0, 300]; // kitchen
const LEO_K = [K[0], 0, 295.6];
const kitchen = (S, t, leoExpr = 'happy', o = {}) => {
	S.show('kitchen');
	S.shadow([K[0], 0, 299], 16);
	S.put(S.C.leo, LEO_K, 0, o.leoPose ?? {lean: 0.06}, leoExpr, false);
	S.put(S.C.mom, [K[0] - 3.6, 0, 304.4], PI + 0.25, {cheer: o.cheer}, o.momExpr ?? 'big-smile', false, {focus: false});
	S.put(S.C.dad, [K[0] + 3.6, 0, 304.4], PI - 0.25, {cheer: o.cheer}, o.dadExpr ?? 'happy', false, {focus: false});
	if (!o.noCake) S.prop('smallCake', [K[0], 2.2, 298.8]);
};

const HALL = [0, 0, 300];
const hallKids = (S, t, expr = 'neutral', walkers = true) => {
	S.show('hall');
	S.shadow([0, 0, 300], 30);
	const list = [S.C.kid1, S.C.kid2, S.C.kid3, S.C.mia, S.crowd[0], S.crowd[4], S.crowd[8], S.crowd[12], S.crowd[16], S.crowd[1], S.crowd[5]];
	const spots = [[-6, 293.6, 0.2], [6, 293.6, -0.2], [14, 294, 0.3], [20, 297, -0.6], [-14, 294, 0.1], [-22, 296, 0.6], [26, 302, PI + 0.3], [-30, 303, PI - 0.2], [10, 305, PI], [-2, 306.5, PI + 0.4], [30, 294.5, -0.3]];
	list.forEach((c, i) => {
		const [x, z, yaw] = spots[i];
		const moving = walkers && i >= 6;
		S.put(c, [x + (moving ? Math.sin(t * 0.6 + i) * 1.5 : 0), 0, z], yaw, moving ? {walk: walk(t + i, 1.4)} : {}, typeof expr === 'function' ? expr(i) : expr, false, {focus: false, tOff: i});
	});
	return list;
};
const HALL_THOUGHTS = ['test today?!', 'is my hair ok?', 'lunch...', "I'm late!", 'does she like me?', 'homework!!', 'so tired...', 'pizza?', 'my shoes...', 'too loud', 'what if...', 'nobody sees me'];

const STREET_LEO_HOME = [-21.5, 0, -7.2];
const WIN = [21.5, 3.6, -15.6];
const WALTER_SEAT = [21.5, 0, -19.9];
const walterAtWindow = (S, t, expr = 'sad', o = {}) => {
	S.show('street', 'walterRoom', 'walterWindow', 'hills');
	S.walterLamp(o.lamp ?? true);
	S.put(S.C.walter, WALTER_SEAT, 0, {sit: true, headYaw: o.headYaw ?? 0, headPitch: o.headPitch ?? 0.05, armL: [-1.0, 0, 0.15], armR: [-1.0, 0, -0.15]}, expr, false);
};

const SQ = [150, 0, 0];
const WALTER_SQ = [150, 0, 16.4];
const LEO_SQ = [147.4, 0, 16.6];
const squareCrowd = (S, t, mode = 'stand', o = {}) => {
	S.show('square', 'street', 'hills');
	S.shadow([150, 0, 8], 36);
	const list = [S.C.mia, S.C.baker, S.C.lamp, S.C.kid1, S.C.kid2, S.C.kid3, S.C.mom, S.C.dad, S.C.teacher, ...S.crowd.slice(0, 12)];
	list.forEach((c, i) => {
		const a = -PI * 0.95 + (i / (list.length - 1)) * PI * 0.9 + (S.rnd(`sqa${i}`) - 0.5) * 0.12;
		const r = 6.5 + (i % 3) * 3.2 + S.rnd(`sqr${i}`) * 1.5;
		let pos = [150 + Math.cos(a) * r, 0, 2 + Math.sin(a) * r];
		const yaw = Math.atan2(WALTER_SQ[0] - pos[0], WALTER_SQ[2] - pos[2]);
		let pose = {};
		let expr = o.expr ?? 'happy';
		if (mode === 'arrive') {
			const k = S.clamp(1 - (t + S.rnd(`ar${i}`) * 0.6) / 1.6);
			pos = [pos[0] + Math.cos(a) * 14 * k, 0, pos[2] + Math.sin(a) * 14 * k];
			pose = k > 0 ? {walk: walk(t + i, 1.6)} : {};
		} else if (mode === 'hide') {
			pose = {kneel: 0.6, lean: 0.25};
			expr = 'squint';
		} else if (mode === 'cheer') {
			pose = {cheer: true};
			expr = i % 3 === 0 ? 'squint' : 'big-smile';
		} else if (mode === 'talk') {
			pose = {headTilt: Math.sin(t + i) * 0.1};
		}
		S.put(c, pos, mode === 'arrive' ? Math.atan2(-Math.cos(a), -Math.sin(a)) : yaw, pose, expr, mode === 'talk' && i % 2 === 0, {focus: false, tOff: i * 0.37});
	});
	return list;
};

/* ---------- shots ---------- */
export const SHOTS = {
	/* HOOK */
	hook_town(S, {t}) {
		S.show('street', 'square', 'school', 'hills');
		S.shadow([30, 0, 0], 120);
		S.put(S.C.leo, [-21.5, 0, -9], 0, {walk: walk(t)}, 'happy', false, {focus: false});
		S.cam({from: [40, 120, 95], to: [38, 105, 78], look: [30, 0, -6], fov: 42});
	},
	hook_cake(S, {t}) {
		kitchen(S, t, 'shocked', {leoPose: {lean: 0.32, headPitch: 0.15}});
		S.cam({from: [K[0] + 5.2, 5.6, 304.5], to: [K[0] + 4.4, 5.2, 303.4], look: [K[0] - 0.2, 3.3, 297.6], fov: 40, frameY: 0.45});
	},
	hook_ecu(S, {t}) {
		const shocked = t > 0.5;
		kitchen(S, t, shocked ? 'shocked' : 'big-smile', {noCake: true});
		if (shocked) S.shake(0.12 * S.clamp(1 - (t - 0.5) * 3));
		const h = head(S.C.leo, LEO_K);
		S.bubble('?', [h[0] - 2.1, h[1] + 1.9, h[2] + 0.5], 1.5, 0.55);
		S.bubble('...', [h[0] + 2.2, h[1] + 2.2, h[2] + 0.4], 1.4, 0.75);
		S.cam({from: [h[0] + 1.0, h[1] + 0.5, h[2] + 4.6], to: [h[0] + 0.8, h[1] + 0.4, h[2] + 3.9], look: h, fov: 36, frameY: 0.42});
	},
	hook_party(S, {t}) {
		kitchen(S, t, 'shocked');
		S.bubble('So proud of him!', [K[0] - 3.4, 7.7, 304.4], 2.0, 0.12);
		S.bubble('Did I lock the car?', [K[0] + 3.6, 7.9, 304.4], 2.0, 0.4);
		S.cam({from: [K[0] - 2.0, 6.3, 290.9], to: [K[0] - 1.8, 6.1, 291.4], look: [K[0], 5.0, 304], fov: 54, frameY: 0.5});
	},
	hook_clock(S, {t}) {
		S.show('square', 'street', 'hills');
		S.shadow([150, 0, -30], 40);
		const tick = Math.floor(t * 2);
		S.clock(9, 58 + tick * 0.5 + Math.min(1, ((t * 2) % 1) * 6) * 0.5 - 0.5);
		S.cam({from: [150, 9, -12], to: [150, 11, -18], look: [150, 20, -40], fov: 40, frameY: 0.42});
	},

	/* ACT 1 - funny */
	a1_walkout(S, {t, p}) {
		S.show('street', 'hills');
		S.shadow([-21.5, 0, -10], 20);
		const z = S.lerp(-14.6, -9.4, p);
		S.put(S.C.leo, [-21.5, 0, z], 0, {walk: walk(t)}, 'happy');
		S.put(S.C.dog, [-25.5, 0, -11.5], 0.6, {wag: 18, tongue: true}, undefined, false, {focus: false});
		S.cam({from: [-17.5, 3.6, -1.5], to: [-18.5, 3.9, -2.5], look: [-21.5, 3.4, z], fov: 40, frameY: 0.42});
	},
	a1_laugh(S, {t}) {
		S.show('street', 'hills');
		S.shadow([-21.5, 0, -8], 16);
		const pos = [-21.5, 0, -8.2];
		S.put(S.C.leo, pos, 0.15, {lean: -0.1 + Math.sin(t * 14) * 0.05, bob: Math.abs(Math.sin(t * 9)) * 0.15, armL: [-0.6, 0, 0.6], armR: [-0.6, 0, -0.6]}, 'squint');
		const h = head(S.C.leo, pos);
		S.cam({from: [h[0] + 0.8, h[1] + 0.2, h[2] + 5.2], to: [h[0] + 0.6, h[1] + 0.1, h[2] + 4.4], look: h, fov: 38, frameY: 0.4});
	},
	a1_chicken(S, {t}) {
		S.show('street', 'hills');
		S.shadow([0, 0, -12], 14);
		S.put(S.C.chicken, [-2.0, 0, -13.6], 0.8, {peck: true});
		S.cam({from: [2.6, 1.0, -9.9], to: [2.2, 1.1, -10.0], look: [-2.0, 1.7, -13.6], fov: 50, frameY: 0.5});
	},
	a1_chicken_q(S, {t}) {
		S.show('street', 'hills');
		S.shadow([0, 0, -12], 14);
		S.put(S.C.chicken, [-1.5, 0, -12], 0.25, {tilt: S.clamp((t - 0.4) * 3) * 0.4});
		S.bubble('?', [-0.9, 3.95, -11.4], 1.3, 0.62);
		S.cam({from: [-0.4, 2.9, -6.2], to: [-0.6, 2.8, -6.9], look: [-1.5, 2.6, -12], fov: 40, frameY: 0.62});
	},
	a1_class(S, {t}) {
		S.show('classroom');
		S.shadow([100, 0, 300], 24);
		S.put(S.C.teacher, [97.5, 0, 291.6], 0.15, {armR: [-2.2, 0, -0.3 + Math.sin(t * 3) * 0.1]}, 'happy', true, {focus: false});
		const kids = [S.C.leo, S.C.mia, S.C.kid1, S.C.kid2, S.C.kid3, S.crowd[0]];
		[[100, 304], [92, 304], [108, 304], [92, 310], [100, 310], [108, 310]].forEach(([x, z], i) => S.put(kids[i], [x, 0, z], PI, {sit: true, headTilt: Math.sin(t + i) * 0.06}, i === 0 ? 'neutral' : 'sleepy', false, {focus: false}));
		S.cam({from: [113, 11, 321], to: [111, 10, 318], look: [98, 4, 293], fov: 42});
	},
	a1_pizza(S, {t}) {
		S.show('classroom');
		S.shadow([100, 0, 296], 16);
		const pos = [97.5, 0, 291.6];
		S.put(S.C.teacher, pos, 0.1, {headTilt: 0.15 + Math.sin(t * 1.4) * 0.05, armL: [-0.8, 0, 0.6], armR: [-0.8, 0, -0.6], headPitch: -0.1}, 'dreamy');
		S.bubble('pizza', [99.0, 6.6, 292.6], 1.8, 0.08);
		const h = head(S.C.teacher, pos);
		S.cam({from: [h[0] + 1.2, h[1] + 0.6, h[2] + 7.6], to: [h[0] + 1.0, h[1] + 0.5, h[2] + 6.6], look: [h[0] + 0.5, h[1] + 1.0, h[2]], fov: 40, frameY: 0.5});
	},
	a1_wallclock(S, {t}) {
		S.show('classroom');
		S.shadow([95, 0, 292], 16);
		const mins = t * 520;
		S.wallClock(10 + mins / 60, mins % 60);
		S.put(S.C.teacher, [97.5, 0, 291.6], 0.6, {headTilt: 0.2}, 'dreamy', false, {focus: false});
		S.bubble('pizza', [95.5, 7.6, 292.2], 2.0, 0.0);
		S.cam({from: [91.5, 9.6, 300], to: [91.0, 9.8, 298.5], look: [89, 10.4, 288.3], fov: 40, frameY: 0.42});
	},
	a1_dog(S, {t}) {
		S.show('street', 'hills');
		S.shadow([-27, 0, -12], 14);
		S.put(S.C.dog, [-28.4, 0, -14.6], 0.55, {wag: 22, tongue: true, bob: true});
		S.cam({from: [-24.0, 1.1, -10.1], to: [-24.3, 1.2, -10.3], look: [-28.2, 2.3, -14.4], fov: 48, frameY: 0.5});
	},
	a1_ball(S, {t, gt}) {
		S.show('street', 'hills');
		S.shadow([-27, 0, -12], 14);
		S.put(S.C.dog, [-27, 0, -12.5], 0.15, {wag: 26, tongue: true, bob: true, tilt: Math.sin(t * 4) * 0.12});
		const n = gt < 15.0 ? 1 : 2;
		S.bubble(n === 1 ? 'ball' : 'ball ball', [-25.4, 5.6, -12], 2.0 + n * 0.4, n === 1 ? 0.05 : 0.0);
		S.cam({from: [-25.9, 3.0, -6.6], to: [-26.2, 2.9, -7.4], look: [-27, 2.9, -12.3], fov: 38, frameY: 0.52});
	},
	a1_ball2(S, {t, p, gt}) {
		S.show('street', 'hills');
		S.shadow([-14, 0, -6], 22);
		const thr = S.clamp(t / 0.45);
		S.put(S.C.leo, [-24, 0, -7], PI / 2, {throw: thr}, 'big-smile', false, {focus: false});
		const run = S.clamp((t - 0.35) / 1.2);
		const dx = S.lerp(-21.5, -4, S.ease(run));
		S.put(S.C.dog, [dx, 0, -6.4], PI / 2, {run: run > 0 && run < 1, wag: 24, tongue: true}, undefined, false, {focus: false});
		const bu = S.clamp((t - 0.38) / 0.9);
		if (bu > 0 && bu < 1) S.prop('ball', [S.lerp(-23, -2, bu), 4 + 6 * bu * (1 - bu) * 4 - bu * 3.6, S.lerp(-7, -5.6, bu)]);
		S.bubble(gt < 16.2 ? 'ball ball ball' : 'ball ball ball ball!', [dx + 1, 5.6, -6.2], 3.0, 0.0);
		S.cam({from: [-16, 4.6, 12], to: [-12.5, 4.8, 12], look: [S.lerp(-18, -9, p), 2.4, -6], fov: 42, frameY: 0.5});
	},

	/* ACT 2 - overwhelming */
	a2_school(S, {t}) {
		S.show('school', 'hills');
		S.shadow([-150, 0, -6], 34);
		const ks = [S.C.leo, S.C.kid1, S.C.kid2, S.C.kid3, S.C.mia, S.crowd[0], S.crowd[4], S.crowd[8]];
		ks.forEach((c, i) => {
			const x = -158 + i * 2.4 + (i % 2) * 0.8;
			const z = 6 + (i % 3) * 3 - t * 3.2;
			S.put(c, [x, 0, z], PI + (S.rnd(`sk${i}`) - 0.5) * 0.3, {walk: walk(t + i * 0.3, 1.7)}, 'happy', false, {focus: false});
		});
		S.cam({from: [-138, 9, 30], to: [-140, 10, 26], look: [-150, 7, -12], fov: 44});
	},
	a2_hall(S, {t, p}) {
		hallKids(S, t, 'neutral');
		S.put(S.C.leo, [S.lerp(-14, -9, p), 0, 300.5], PI / 2, {walk: walk(t)}, 'neutral');
		S.cam({from: [-34, 7.5, 301], to: [-31, 7.0, 301], look: [6, 4.5, 299.5], fov: 42, frameY: 0.5});
	},
	a2_bubbles(S, {t}) {
		const list = hallKids(S, t, 'neutral');
		S.put(S.C.leo, [-6, 0, 300.5], PI / 2, {}, 'worried');
		list.forEach((c, i) => {
			const pz = c.root.position;
			S.bubble(HALL_THOUGHTS[i % HALL_THOUGHTS.length], [pz.x + 0.8, HY(c) + 3.0, pz.z], 2.4, 0.05 + i * 0.11);
		});
		S.cam({from: [-22, 9, 303.5], to: [-12, 8, 302], look: [6, 5.8, 299.5], fov: 42, frameY: 0.5});
	},
	a2_flood(S, {t}) {
		hallKids(S, t, 'worried');
		S.put(S.C.leo, [0, 0, 300.5], 0, {}, 'worried');
		for (let i = 0; i < 36; i++) {
			const x = (S.rnd(`fx${i}`) - 0.5) * 34;
			const z = 300 + (S.rnd(`fz${i}`) - 0.5) * 14;
			S.bubble(HALL_THOUGHTS[i % HALL_THOUGHTS.length], [x, 4.5 + S.rnd(`fy${i}`) * 3, z], 2.0 + S.rnd(`fs${i}`) * 0.8, i * 0.035, {rot: (S.rnd(`fr${i}`) - 0.5) * 0.4});
		}
		S.cam({from: [0, 13.2, 307], to: [0, 13.0, 306], look: [0, 0, 300.4], fov: 60});
	},
	a2_kid1(S, {t}) {
		hallKids(S, t, 'neutral', false);
		const pos = [-6, 0, 293.6];
		S.put(S.C.kid1, pos, 0.1, {headPitch: 0.15, armL: [-0.3, 0, 0.1], armR: [-0.3, 0, -0.1]}, 'sad');
		const h = head(S.C.kid1, pos);
		S.bubble("I'm not good enough.", [h[0] + 0.9, h[1] + 1.5, h[2] + 0.4], 1.6, 0.05);
		S.cam({from: [h[0] + 0.8, h[1] + 0.6, h[2] + 7.2], to: [h[0] + 0.6, h[1] + 0.5, h[2] + 6.2], look: [h[0], h[1] + 0.9, h[2]], fov: 38, frameY: 0.45});
	},
	a2_kid2(S, {t}) {
		hallKids(S, t, 'neutral', false);
		const pos = [6, 0, 293.6];
		S.put(S.C.kid2, pos, -0.15, {headPitch: 0.1, headTilt: 0.12}, 'worried');
		const h = head(S.C.kid2, pos);
		S.bubble('Nobody likes me.', [h[0] - 0.9, h[1] + 1.5, h[2] + 0.4], 1.6, 0.05);
		S.cam({from: [h[0] - 0.9, h[1] + 0.5, h[2] + 7.0], to: [h[0] - 0.7, h[1] + 0.4, h[2] + 6.0], look: [h[0], h[1] + 0.9, h[2]], fov: 38, frameY: 0.45});
	},
	a2_kid3(S, {t}) {
		hallKids(S, t, 'neutral', false);
		const pos = [14, 0, 294];
		S.put(S.C.kid3, pos, 0.1, {headYaw: 0.55, headPitch: 0.05}, 'blush');
		S.put(S.C.mia, [20, 0, 297.5], -0.4, {}, 'happy', true, {focus: false});
		const h = head(S.C.kid3, pos);
		S.bubble("I hope she doesn't see me.", [h[0] - 0.5, h[1] + 1.6, h[2] + 0.4], 1.8, 0.05);
		S.cam({from: [h[0] - 1.2, h[1] + 0.6, h[2] + 7.6], to: [h[0] - 0.9, h[1] + 0.5, h[2] + 6.6], look: [h[0] + 1.0, h[1] + 0.9, h[2]], fov: 38, frameY: 0.45});
	},
	a2_loud(S, {t}) {
		hallKids(S, t, 'worried');
		const pos = [0, 0, 300.5];
		S.put(S.C.leo, pos, 0, {headTilt: Math.sin(t * 8) * 0.03}, 'worried');
		const h = head(S.C.leo, pos);
		for (let i = 0; i < 9; i++) {
			const a = (i / 9) * PI * 2 + 0.3;
			S.bubble(['!!', '?!', '...', 'loud', 'ugh', 'hey!', 'what?', 'shh', '!!!'][i], [h[0] + Math.cos(a) * 2.6, h[1] + Math.sin(a) * 2.0 + 0.6, h[2] - 1.0], 1.1, i * 0.09);
		}
		S.shake(0.06);
		S.cam({from: [h[0] + 0.3, h[1] + 0.2, h[2] + 5.4], to: [h[0] + 0.2, h[1] + 0.15, h[2] + 4.6], look: h, fov: 40, frameY: 0.4});
	},
	a2_ears(S, {t}) {
		hallKids(S, t, 'worried');
		const pos = [0, 0, 300.5];
		S.put(S.C.leo, pos, 0, {coverEars: true, headPitch: 0.12, lean: 0.06}, 'squint');
		const h = head(S.C.leo, pos);
		for (let i = 0; i < 7; i++) {
			const a = (i / 7) * PI * 2;
			S.bubble(HALL_THOUGHTS[(i + 3) % HALL_THOUGHTS.length], [h[0] + Math.cos(a + t) * 3.6, h[1] + 1.2 + Math.sin(a + t) * 2.2, h[2] - 1.5], 1.6, 0.0);
		}
		S.shake(0.22);
		S.cam({from: [h[0] + 0.4, h[1] + 0.7, h[2] + 8.6], to: [h[0] + 0.2, h[1] + 0.3, h[2] + 6.2], look: [h[0], h[1] - 0.3, h[2]], fov: 40, frameY: 0.42});
	},
	a2_orbit(S, {t}) {
		hallKids(S, t, 'worried');
		const pos = [0, 0, 300.5];
		S.put(S.C.leo, pos, 0, {coverEars: true, headPitch: 0.2}, 'crying');
		for (let i = 0; i < 14; i++) {
			const a = (i / 14) * PI * 2 + t * 0.8;
			const r = 5 + (i % 3) * 1.6;
			S.bubble(HALL_THOUGHTS[i % HALL_THOUGHTS.length], [Math.cos(a) * r * 0.8, 4.0 + (i % 3) * 1.6, 300.5 + Math.sin(a) * r * 0.8], 1.5, 0.0);
		}
		const a = 1.2 + t * 0.7;
		S.cam({from: [Math.sin(a) * 8.5, 7.5, 300.5 + Math.cos(a) * 8.5], look: [0, 3.4, 300.5], fov: 46});
	},

	/* ACT 3 - turning point */
	a3_sunset(S) {
		S.show('street', 'square', 'hills');
		S.shadow([-40, 0, 0], 60);
		S.cam({from: [-55, 7, 2], to: [-58, 7.6, 2], look: [-141, 32, 47], fov: 44});
	},
	a3_walk(S, {t}) {
		S.show('street', 'hills');
		const x = -8 + t * 3.2;
		S.shadow([x, 0, -7], 18);
		S.put(S.C.leo, [x, 0, -7.4], PI / 2, {walk: walk(t, 1.3), headPitch: 0.25, walkAmp: 0.35}, 'sad');
		S.cam({from: [x + 1.4, 3.9, 2.8], to: [x + 1.0, 4.0, 2.0], look: [x, 3.5, -7.4], fov: 40, frameY: 0.42});
	},
	a3_sun(S) {
		S.show('street', 'hills');
		S.shadow([0, 0, 0], 60);
		S.cam({from: [40, 2.4, 1], to: [40, 3.0, 1], look: [-46, 27, 46], fov: 40});
	},
	a3_street(S, {t}) {
		S.show('street', 'hills');
		S.shadow([20, 0, 0], 50);
		const flick = t > 0.6 ? (Math.sin(t * 40) > -0.2 || t > 1.3 ? 1.6 : 0.2) : 0.0;
		S.glow({lamp: flick});
		S.cam({from: [64, 7, 3], to: [60, 6.6, 2.6], look: [0, 3, -2], fov: 40});
	},
	a3_fence(S, {t, p}) {
		S.show('street', 'walterRoom', 'walterWindow', 'hills');
		const x = S.lerp(11, 16.5, p);
		S.shadow([x, 0, -8], 16);
		S.put(S.C.leo, [x, 0, -7.6], PI / 2, {walk: walk(t, 1.3), walkAmp: 0.35, headPitch: 0.2}, 'sad', false, {focus: false});
		S.cam({from: [x + 7.5, 2.6, -1.8], to: [x + 6.0, 2.6, -2.0], look: [x, 2.6, -8.0], fov: 42, frameY: 0.5});
	},
	a3_house(S) {
		walterAtWindow(S, 0, 'sad');
		S.shadow([24, 0, -16], 20);
		S.cam({from: [27, 6.2, 10], to: [26, 5.9, 7], look: [24, 5.0, -18], fov: 40});
	},
	a3_window(S, {t}) {
		walterAtWindow(S, t, 'sad');
		S.shadow([21.5, 0, -16], 14);
		S.cam({from: [21.6, 4.4, -9.0], to: [21.6, 4.3, -10.6], look: [21.5, 4.0, -19.5], fov: 40, frameY: 0.5});
	},
	a3_window2(S, {t}) {
		walterAtWindow(S, t, 'sad', {headYaw: 0.1});
		S.shadow([21.5, 0, -16], 14);
		S.cam({from: [22.2, 4.7, -12.4], to: [22.0, 4.7, -13.1], look: [21.5, 4.55, -19.9], fov: 36, frameY: 0.42});
	},
	a3_ots(S, {t}) {
		walterAtWindow(S, t, 'sad');
		S.shadow([21, 0, -12], 16);
		S.put(S.C.leo, [20.4, 0, -8.6], PI, {headPitch: -0.05}, 'thinking', false, {focus: false});
		S.cam({from: [18.8, 5.0, -2.6], to: [19.0, 4.8, -3.6], look: [21.5, 3.9, -17], fov: 40, frameY: 0.5});
	},
	a3_heard(S, {t}) {
		walterAtWindow(S, t, 'sad');
		S.shadow([20.4, 0, -9], 12);
		const pos = [20.4, 0, -8.6];
		S.put(S.C.leo, pos, PI, {thinking: t < 0.45}, t < 0.45 ? 'thinking' : 'shocked');
		if (t > 0.45) S.shake(0.08 * S.clamp(1 - (t - 0.45) * 3));
		const h = head(S.C.leo, pos);
		S.cam({from: [h[0] - 0.4, h[1] + 0.25, h[2] - 4.6], to: [h[0] - 0.3, h[1] + 0.2, h[2] - 3.8], look: h, fov: 38, frameY: 0.4});
	},
	a3_bubble(S, {t}) {
		walterAtWindow(S, t, 'sad', {headPitch: 0.12});
		S.shadow([21.5, 0, -16], 14);
		S.bubble('Nobody remembers my birthday anymore.', [23.0, 6.2, -14.8], 2.5, 0.05);
		S.cam({from: [22.4, 5.4, -7.4], to: [22.3, 5.4, -8.4], look: [22.2, 5.2, -18], fov: 40, frameY: 0.5});
	},
	a3_bubble2(S, {t}) {
		walterAtWindow(S, t, 'sad', {headPitch: 0.15});
		S.shadow([21.5, 0, -16], 14);
		S.bubble('Nobody remembers my birthday anymore.', [23.0, 6.2, -14.8], 2.5, -1);
		S.cam({from: [22.3, 5.3, -9.4], to: [22.1, 5.2, -11.0], look: [22.0, 5.1, -18], fov: 38, frameY: 0.5, push: 0.08});
	},
	a3_stop(S, {t}) {
		S.show('street', 'walterRoom', 'walterWindow', 'hills');
		S.shadow([20.4, 0, -8], 14);
		const k = S.clamp(t / 0.55);
		const x = S.lerp(18.4, 20.4, S.ease(k));
		S.put(S.C.leo, [x, 0, -7.6], PI / 2, k < 1 ? {walk: walk(t, 1.4), walkAmp: 0.4 * (1 - k)} : {headPitch: 0.1}, 'sad');
		S.cam({from: [24.5, 0.8, -3.2], to: [24.2, 0.9, -3.6], look: [x, 2.6, -7.6], fov: 42, frameY: 0.5});
	},
	a3_bikes(S, {t}) {
		S.mood('memory');
		S.show('street', 'hills');
		S.shadow([28, 0, -11], 16);
		S.put(S.C.walter, [28.6, 0, -11.2], 0.6, {kneel: 1, lean: 0.3, armR: [-1.0 + Math.sin(t * 8) * 0.25, 0, -0.1], armL: [-0.8, 0, 0.2]}, 'happy', true);
		S.prop('bike', [26.4, 0, -10.6], [0, 0.5, 0]);
		S.put(S.C.kid1, [24.5, 0, -7.6], 0.6, {}, 'happy', false, {focus: false});
		S.put(S.C.leo, [27.0, 0, -6.8], 0.2, {}, 'big-smile', false, {focus: false});
		S.cam({from: [31.8, 5.2, -3.2], to: [31.2, 5.0, -4.0], look: [27.8, 3.2, -10.6], fov: 40});
	},
	a3_bikes2(S, {t}) {
		S.mood('memory');
		S.show('street', 'hills');
		S.shadow([27, 0, -9], 14);
		S.put(S.C.walter, [28.4, 0, -10.6], -0.9, {reach: true}, 'big-smile', true);
		S.prop('bike', [25.6, 0, -9.2], [0, 1.2, 0]);
		S.put(S.C.kid1, [24.0, 0, -8.0], 2.0, {cheer: t > 0.4}, 'big-smile', false, {focus: false});
		S.cam({from: [26.5, 4.8, -1.8], to: [26.6, 4.9, -2.8], look: [26.6, 3.6, -10], fov: 40, frameY: 0.48});
	},
	a3_candy(S, {t}) {
		S.mood('memoryNight');
		S.show('street', 'hills');
		S.shadow([28.5, 0, -12], 14);
		S.put(S.C.walter, [28.5, 0, -13.6], 0, {hold: true}, 'big-smile', true);
		S.prop('candyBowl', [28.5, 2.9, -12.3]);
		S.prop('pumpkins', [30.5, 0, -12.5]);
		[S.C.kid2, S.C.kid3, S.C.mia].forEach((c, i) => S.put(c, [26.0 + i * 2.2, 0, S.lerp(-5, -9.6, S.ease(S.clamp(t / 0.9)))], PI, {walk: t < 0.9 ? walk(t + i, 1.6) : undefined}, 'happy', false, {focus: false}));
		S.cam({from: [33.5, 4.2, -4], to: [32.5, 4.4, -5], look: [28.5, 3.6, -12.4], fov: 40, frameY: 0.48});
	},
	a3_candy2(S, {t}) {
		S.mood('memoryNight');
		S.show('street', 'hills');
		S.shadow([28.5, 0, -11], 14);
		S.put(S.C.walter, [28.5, 0, -13.6], 0, {hold: true}, 'big-smile', true, {focus: false});
		S.prop('candyBowl', [28.5, 2.9, -12.3]);
		S.prop('pumpkins', [30.5, 0, -12.5]);
		[S.C.kid2, S.C.kid3, S.C.mia, S.C.leo].forEach((c, i) => S.put(c, [25.4 + i * 2.0, 0, -9.4 - (i % 2) * 0.6], PI + (i - 1.5) * 0.15, {cheer: true}, i % 2 ? 'squint' : 'big-smile', false, {focus: false, tOff: i * 0.4}));
		S.cam({from: [25.6, 4.4, -13.6], to: [25.8, 4.5, -13.2], look: [27.4, 3.4, -9.4], fov: 44, frameY: 0.48});
	},
	a3_alone(S, {t}) {
		walterAtWindow(S, t, 'sad', {headPitch: 0.15, lamp: false});
		S.shadow([21.5, 0, -14], 18);
		S.cam({from: [21.6, 4.6, -9.6], to: [21.6, 5.6, -1.5], look: [21.5, 4.2, -18], fov: 40, frameY: 0.48});
	},
	a3_alone2(S, {t}) {
		walterAtWindow(S, t, 'sad', {headPitch: 0.18, lamp: false});
		S.shadow([21.5, 0, -16], 14);
		S.cam({from: [22.0, 4.8, -12.6], to: [21.9, 4.75, -13.2], look: [21.5, 4.6, -19.9], fov: 36, frameY: 0.42});
	},
	a3_determined(S, {t}) {
		S.show('street', 'hills');
		S.shadow([20.4, 0, -7], 12);
		const pos = [20.4, 0, -7.6];
		S.put(S.C.leo, pos, 0, {headPitch: t < 0.95 ? 0.15 : -0.05}, t < 0.95 ? 'sad' : 'determined');
		const h = head(S.C.leo, pos);
		S.cam({from: [h[0] + 0.5, h[1] + 0.3, h[2] + 5.4], to: [h[0] + 0.25, h[1] + 0.15, h[2] + 3.6], look: h, fov: 38, frameY: 0.4, push: 0.08});
	},

	/* ACT 4 - action */
	a4_ran(S, {t}) {
		S.show('street', 'hills');
		const x = 20.4 + t * 9;
		S.shadow([x, 0, -7], 12);
		S.put(S.C.leo, [x, 0, -7.4], PI / 2, {walk: walk(t, 2.6), run: true, lean: 0.2}, 'determined');
		S.cam({from: [x + 6.5, 0.9, -4.5], to: [x + 6.0, 0.9, -4.8], look: [x, 2.6, -7.4], fov: 42, frameY: 0.5});
	},
	a4_run(S, {t}) {
		S.show('street', 'hills');
		const x = 8 - t * 10;
		S.shadow([x, 0, 6], 16);
		S.put(S.C.leo, [x, 0, 6.6], -PI / 2, {walk: walk(t, 2.6), run: true, lean: 0.2}, 'determined');
		S.cam({from: [x - 1.5, 3.4, 15], to: [x - 1.0, 3.6, 14.4], look: [x, 2.8, 6.6], fov: 42, frameY: 0.5});
	},
	a4_mia(S, {t}) {
		S.show('street', 'hills');
		S.shadow([-43.5, 0, 13], 12);
		const door = [-43.5, 0, 14.9];
		S.put(S.C.leo, [-43.3, 0, 11.8], 0, t < 0.55 ? {knock: t} : {wave: true}, 'determined', true, {focus: false});
		if (t > 0.45) S.put(S.C.mia, door, PI, {headTilt: 0.15}, t > 0.7 ? 'big-smile' : 'shocked', t > 0.7);
		S.cam({from: [-38.8, 4.5, 10.2], to: [-39.4, 4.5, 10.6], look: [-43.5, 3.8, 14.6], fov: 40, frameY: 0.48});
	},
	a4_bakery(S, {t}) {
		S.show('square', 'street', 'hills');
		S.shadow([131, 0, -22], 14);
		S.put(S.C.baker, [131.5, 0, -17.6], 0.2, {thumbs: t > 0.4}, t > 0.4 ? 'big-smile' : 'happy', true);
		S.put(S.C.leo, [130.6, 0, -12.8], PI - 0.2, {armL: [-0.6, 0, 0.3]}, 'determined', true, {focus: false});
		S.cam({from: [125.8, 5.0, -10.6], to: [126.4, 4.9, -11.2], look: [131.5, 4.7, -17.4], fov: 40, frameY: 0.45});
	},
	a4_lamp(S, {t}) {
		S.show('square', 'street', 'hills');
		S.shadow([174, 0, -22], 14);
		S.glow({win: 2.2});
		S.put(S.C.lamp, [175.5, 0, -17.4], -0.2, {headPitch: Math.max(0, Math.sin(t * 9)) * 0.25, armR: [-1.2, 0, -0.3]}, 'happy', true);
		S.put(S.C.leo, [174.6, 0, -12.4], PI + 0.25, {}, 'determined', true, {focus: false});
		S.cam({from: [181, 4.5, -11.2], to: [180.4, 4.5, -11.8], look: [175.4, 5.2, -17.4], fov: 40, frameY: 0.45});
	},
	a4_doors(S, {t}) {
		S.show('street', 'hills');
		S.shadow([6.5, 0, 13], 12);
		S.put(S.C.leo, [6.6, 0, 11.6], 0, t < 0.45 ? {knock: t} : {}, 'determined', true, {focus: false});
		if (t > 0.35) {
			S.put(S.crowd[4], [5.2, 0, 14.8], PI, {cheer: t > 0.6}, 'big-smile', false, {focus: false});
			S.put(S.crowd[2], [7.8, 0, 14.8], PI, {headPitch: Math.max(0, Math.sin(t * 9)) * 0.2}, 'happy', false, {focus: false});
		}
		S.cam({from: [11.0, 4.4, 9.6], to: [10.5, 4.4, 10.0], look: [6.4, 3.8, 14.6], fov: 42, frameY: 0.48});
	},
	a4_topdown(S, {t, p}) {
		S.show('street', 'hills');
		S.shadow([0, 0, 0], 50);
		const x = S.lerp(-30, 30, p);
		S.put(S.C.leo, [x, 0, Math.sin(p * PI * 3) * 6], PI / 2 + Math.cos(p * PI * 3) * 0.8, {walk: walk(t, 2.6), run: true}, 'determined', false, {focus: false});
		[[-40, 15], [-15, 15], [10, 15], [35, 15], [-50, -15], [0, -15], [50, -15]].forEach(([dx, dz], i) => {
			const out = S.clamp((t - i * 0.12) / 0.4);
			S.put(S.crowd[i + 5], [dx + (dz > 0 ? -3.5 : 3.5), 0, dz + (dz > 0 ? -1 : 1) * (0.6 + out * 2)], dz > 0 ? PI : 0, {wave: out > 0.6}, 'happy', false, {focus: false});
		});
		S.cam({from: [x * 0.5, 62, 40], to: [x * 0.5 + 4, 58, 36], look: [x * 0.6, 0, 0], fov: 44});
	},
	a4_calendar(S, {t}) {
		S.mood('day');
		S.show('calendar');
		S.shadow([0, 8, 500], 12);
		S.calendar(S.ease(S.clamp((t - 0.15) / 0.6)));
		S.cam({from: [0.4, 9.6, 513.5], to: [0.2, 9.4, 511.5], look: [0, 9.2, 500], fov: 40, frameY: 0.45});
	},
	a4_square(S, {t}) {
		squareCrowd(S, t, 'arrive');
		S.cam({from: [150, 9, 52], to: [150, 34, 62], look: [150, 3, 0], fov: 44});
	},
	a4_square2(S, {t}) {
		squareCrowd(S, t, 'talk');
		S.cam({from: [178, 6.5, 22], to: [175, 7.0, 20], look: [150, 4, 2], fov: 42});
	},
	a4_lights(S, {t}) {
		S.show('square', 'street', 'hills');
		S.shadow([150, 0, 0], 30);
		S.stringLights(() => false);
		const [p0, p1] = [S.town.dyn.poles[2], S.town.dyn.poles[3]];
		S.prop('ladder', [p0[0] - 0.9, 0, p0[1]], [0, 0, 0.08]);
		S.prop('ladder2', [p1[0] - 0.9, 0, p1[1]], [0, 0, -0.06]);
		S.put(S.C.dad, [p0[0] - 0.9, 4.6, p0[1] + 0.9], PI, {hang: true}, 'happy', false, {focus: false});
		S.put(S.C.baker, [p1[0] - 0.9, 4.0, p1[1] + 0.9], PI, {hang: true}, 'happy', false, {focus: false});
		S.put(S.C.mia, [p0[0] + 3.5, 0, p0[1] - 3.5], 2.6, {hold: true}, 'big-smile', true, {focus: false});
		S.put(S.C.leo, [p0[0] + 1.5, 0, p0[1] - 5.0], 2.2, {reach: true}, 'happy', false, {focus: false});
		S.prop('lightCoil', [p0[0] + 2.6, 3.0, p0[1] - 4.3], [0.3, 0, 0]);
		S.cam({from: [p0[0] + 13, 4, p0[1] - 13], to: [p0[0] + 11, 4.6, p0[1] - 11], look: [p0[0] + 1, 6.5, p0[1] - 1], fov: 44});
	},
	a4_bulbs(S, {t}) {
		S.show('square', 'street', 'hills');
		S.shadow([150, 0, 0], 30);
		S.stringLights(() => false);
		const p0 = S.town.dyn.poles[0];
		S.prop('ladder', [p0[0] - 1.0, 0, p0[1] + 0.2], [0, 0.6, 0]);
		S.put(S.C.leo, [p0[0] - 1.0, 4.6, p0[1] + 1.2], PI + 0.6, {hang: true, headPitch: -0.3}, 'happy');
		S.cam({from: [p0[0] - 8.5, 7.4, p0[1] + 7.5], to: [p0[0] - 7.8, 7.8, p0[1] + 6.8], look: [p0[0] - 0.6, 8.2, p0[1] + 0.4], fov: 40, frameY: 0.45});
	},
	a4_cake(S, {t}) {
		S.show('square', 'street', 'hills');
		S.shadow([150, 0, 12], 14);
		const up = S.easeOut ? 0 : 0;
		S.prop('bigCake', [150, 2.85, 12]);
		S.put(S.C.baker, [153.6, 0, 9.4], -0.5, {cheer: t > 0.5, hold: t <= 0.5}, 'big-smile', true, {focus: false});
		S.cam({from: [150.6, 1.6, 23], to: [150.4, 1.9, 21.8], look: [150, 6.0, 12], fov: 44, frameY: 0.45});
		void up;
	},
	a4_cake2(S, {t}) {
		S.show('square', 'street', 'hills');
		S.shadow([150, 0, 14], 14);
		S.prop('bigCake', [150, 2.85, 12]);
		[S.C.mia, S.C.kid1, S.C.kid2, S.C.kid3].forEach((c, i) => S.put(c, [146.6 + i * 2.3, 0, 18.6 + (i % 2) * 0.6], PI + (i - 1.5) * 0.12, t > 0.6 ? {cheer: true} : {}, t > 0.6 ? 'big-smile' : 'shocked', false, {focus: false, tOff: i * 0.3}));
		S.cam({from: [143.0, 5.6, 8.6], to: [143.5, 5.4, 9.2], look: [149.6, 3.8, 18.8], fov: 42, frameY: 0.5});
	},

	/* ACT 5 - ending */
	a5_door(S, {t}) {
		S.show('street', 'hills');
		S.shadow([28.5, 0, -12], 12);
		S.put(S.C.leo, [28.5, 0, -11.6], PI, {knock: t}, 'determined', false, {focus: false});
		S.cam({from: [33.5, 4.2, -7.6], to: [32.6, 4.3, -8.2], look: [28.5, 3.4, -14], fov: 40, frameY: 0.48});
	},
	a5_door2(S, {t}) {
		S.show('street', 'hills');
		S.shadow([28.5, 0, -12], 12);
		S.put(S.C.leo, [28.3, 0, -10.4], PI, {}, 'happy', false, {focus: false});
		S.put(S.C.walter, [28.5, 0, -14.0], 0, {headTilt: S.clamp(t) * 0.15}, t < 0.5 ? 'shocked' : 'thinking');
		S.cam({from: [27.0, 4.6, -4.8], to: [27.2, 4.7, -5.8], look: [28.5, 4.4, -14], fov: 38, frameY: 0.45});
	},
	a5_ask(S, {t}) {
		S.show('street', 'hills');
		S.shadow([28.5, 0, -11], 12);
		S.put(S.C.walter, [28.6, 0, -13.2], 0, {}, 'thinking', false, {focus: false});
		const pos = [28.2, 0, -9.6];
		S.put(S.C.leo, pos, PI, {reach: true}, 'happy', true);
		S.cam({from: [30.6, 5.4, -14.6], to: [30.4, 5.3, -14.2], look: head(S.C.leo, pos), fov: 38, frameY: 0.45});
	},
	a5_minute(S, {t}) {
		S.show('street', 'hills');
		S.shadow([28.5, 0, -12], 12);
		const pos = [28.6, 0, -13.2];
		const nod = t > 0.7 ? Math.max(0, Math.sin((t - 0.7) * 10)) * 0.22 : 0;
		S.put(S.C.walter, pos, 0, {headPitch: nod, thinking: t < 0.7}, t < 0.7 ? 'thinking' : 'happy');
		const h = head(S.C.walter, pos);
		S.cam({from: [h[0] + 0.5, h[1] + 0.25, h[2] + 4.9], to: [h[0] + 0.35, h[1] + 0.2, h[2] + 4.2], look: h, fov: 36, frameY: 0.4});
	},
	a5_walk(S, {t}) {
		S.show('street', 'hills');
		const x = 40 + t * 3.0;
		S.shadow([x, 0, -7], 14);
		S.put(S.C.leo, [x, 0, -6.6], PI / 2, {walk: walk(t, 1.5), armL: [-0.5, 0, 0.3]}, 'happy', false, {focus: false});
		S.put(S.C.walter, [x - 0.4, 0, -9.0], PI / 2, {walk: walk(t, 1.2), walkAmp: 0.35, armR: [-0.4, 0, -0.3]}, 'neutral', false, {focus: false});
		S.cam({from: [x - 8.5, 4.6, -4.5], to: [x - 7.5, 4.4, -4.8], look: [x + 6, 3.0, -7.8], fov: 42});
	},
	a5_dark(S, {t}) {
		S.mood('dark');
		squareCrowd(S, t, 'hide');
		S.stringLights(() => false);
		S.glow({water: 0});
		S.cam({from: [150, 9, 46], to: [150, 8.5, 42], look: [150, 4, 0], fov: 42});
	},
	a5_dark2(S, {t, p}) {
		S.mood('dark');
		S.show('square', 'street', 'hills');
		S.shadow([130, 0, 4], 18);
		S.stringLights(() => false);
		S.glow({water: 0});
		const x = S.lerp(118, 126, p);
		S.put(S.C.leo, [x, 0, 3.2], PI / 2, {walk: walk(t, 1.4), armL: [-0.5, 0, 0.3]}, 'happy', false, {focus: false});
		S.put(S.C.walter, [x - 0.6, 0, 0.8], PI / 2, {walk: walk(t, 1.1), walkAmp: 0.3}, 'thinking', false, {focus: false});
		S.cam({from: [x - 9, 4.6, 6.5], to: [x - 8, 4.4, 6.0], look: [x + 6, 3.2, 1.6], fov: 42});
	},
	a5_on(S, {t, gt}) {
		const lit = gt < 86.45 ? 0 : 1 + Math.floor((gt - 86.45) * 9);
		S.mood(lit > 0 ? 'night' : 'dark');
		squareCrowd(S, t, 'hide');
		S.stringLights((i) => i < lit);
		S.glow({lamp: 0, win: lit > 0 ? 0.3 : 0, water: 0});
		S.cam({from: [140, 2.6, 15], to: [141, 3.0, 14], look: [150, 10.5, 0], fov: 42});
	},
	a5_onebyone(S, {t, gt}) {
		S.mood('night');
		squareCrowd(S, t, 'hide');
		const lit = 1 + Math.floor((gt - 86.45) * 9);
		S.stringLights((i) => i < lit);
		S.glow({lamp: 0.4, win: 0.8, water: 0.4});
		S.cam({from: [150, 56, 26], to: [150, 52, 22], look: [150, 0, 1], fov: 44});
	},
	a5_onebyone2(S, {t, gt}) {
		S.mood('night');
		squareCrowd(S, t, 'hide');
		const lit = 1 + Math.floor((gt - 86.45) * 9);
		S.stringLights((i) => i < lit);
		S.glow({water: 0.4 + S.clamp(t / 1.2) * 2.2});
		S.cam({from: [150, 5.5, 32], to: [150, 6.5, 29], look: [150, 9, -20], fov: 42});
	},
	a5_surprise(S, {t}) {
		const list = squareCrowd(S, t, 'cheer');
		S.stringLights(() => true);
		S.glow({water: 2.4});
		S.confetti([150, 0, 6], 30, 22, 0);
		S.shake(0.3 * S.clamp(1 - t * 1.4));
		list.slice(0, 5).forEach((c, i) => {
			const pz = c.root.position;
			S.bubble('SURPRISE!', [pz.x, HY(c) + 3.2, pz.z], 2.6, 0.04 + i * 0.07, {kind: 'speech', color: '#ffe95a'});
		});
		S.cam({from: [150, 5.5, 30], to: [150, 5.4, 28.8], look: [150, 4.6, 8], fov: 44});
	},
	a5_surprise2(S, {t}) {
		const list = squareCrowd(S, t + 1, 'cheer');
		S.stringLights(() => true);
		S.glow({water: 2.4});
		S.confetti([150, 0, 8], 30, 22, -0.8);
		[S.C.mia, S.C.kid1, S.C.baker].forEach((c, i) => {
			const pz = c.root.position;
			S.bubble('SURPRISE!', [pz.x + 0.6, HY(c) + 3.0, pz.z], 2.4, i * 0.12, {kind: 'speech', color: '#ffe95a'});
		});
		void list;
		S.cam({from: [147, 5.4, 22], to: [147.6, 5.2, 21], look: [150, 4.2, 6], fov: 42});
	},
	a5_shock(S, {t}) {
		squareCrowd(S, t + 2, 'cheer');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.confetti([150, 0, 10], 30, 22, -1.6);
		S.put(S.C.walter, WALTER_SQ, PI, {armL: [-0.3, 0, 0.5], armR: [-0.3, 0, -0.5]}, 'shocked');
		S.shake(0.06);
		const h = head(S.C.walter, WALTER_SQ);
		S.cam({from: [h[0] + 0.3, h[1] + 0.3, h[2] - 5.4], to: [h[0] + 0.2, h[1] + 0.2, h[2] - 4.2], look: h, fov: 38, frameY: 0.4});
	},
	a5_shock2(S, {t}) {
		squareCrowd(S, t + 3, 'cheer');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.confetti([150, 0, 10], 30, 22, -2.8);
		S.put(S.C.walter, WALTER_SQ, PI, {headYaw: Math.sin(t * 2.6) * 0.6}, 'shocked', false, {focus: false});
		S.put(S.C.leo, LEO_SQ, PI, {}, 'big-smile', false, {focus: false});
		S.cam({from: [151.8, 6.4, 24], to: [151.4, 6.2, 23], look: [150, 4.2, 6], fov: 42});
	},
	a5_tears(S, {t}) {
		squareCrowd(S, t + 4, 'happy');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.put(S.C.walter, WALTER_SQ, PI, {headPitch: 0.05}, 'teary');
		const h = head(S.C.walter, WALTER_SQ);
		S.cam({from: [h[0] - 0.6, h[1] + 0.2, h[2] - 4.8], to: [h[0] - 0.4, h[1] + 0.15, h[2] - 3.9], look: h, fov: 36, frameY: 0.4});
	},
	a5_tears2(S, {t}) {
		squareCrowd(S, t + 5, 'happy');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.put(S.C.walter, WALTER_SQ, PI, {headPitch: 0.08}, 'teary');
		const h = head(S.C.walter, WALTER_SQ);
		S.cam({from: [h[0] + 0.2, h[1] + 0.1, h[2] - 3.4], to: [h[0] + 0.15, h[1] + 0.08, h[2] - 2.9], look: h, fov: 34, frameY: 0.38, push: 0.08});
	},
	a5_smile(S, {t}) {
		squareCrowd(S, t + 6, 'happy');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.put(S.C.walter, WALTER_SQ, PI, {headPitch: -0.05}, 'teary-smile');
		const h = head(S.C.walter, WALTER_SQ);
		S.cam({from: [h[0] + 0.7, h[1] + 0.3, h[2] - 5.2], to: [h[0] + 0.5, h[1] + 0.2, h[2] - 4.2], look: h, fov: 38, frameY: 0.4});
	},
	a5_bigsmile(S, {t}) {
		squareCrowd(S, t + 7, 'cheer');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.prop('bigCake', [150, 2.85, 12]);
		S.put(S.C.walter, WALTER_SQ, PI, {headPitch: -0.08, armL: [-0.4, 0, 0.7], armR: [-0.4, 0, -0.7]}, 'big-smile');
		S.put(S.C.leo, LEO_SQ, PI - 0.3, {cheer: true}, 'big-smile', false, {focus: false});
		S.cam({from: [145.4, 6.2, 8.4], to: [145.8, 6.0, 9.2], look: [150.4, 4.9, 16.4], fov: 40, frameY: 0.42});
	},
	a5_bigsmile2(S, {t}) {
		squareCrowd(S, t + 8, 'cheer');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.prop('bigCake', [150, 2.85, 12]);
		S.confetti([150, 0, 12], 26, 22, -0.5);
		S.put(S.C.walter, WALTER_SQ, PI, {cheer: true}, 'big-smile', false, {focus: false});
		S.put(S.C.leo, LEO_SQ, PI, {cheer: true}, 'squint', false, {focus: false});
		S.cam({from: [162, 9, -4], to: [160, 8.4, -2], look: [150, 4, 14], fov: 44});
	},
	a5_listen(S, {t}) {
		squareCrowd(S, t + 9, 'happy');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.put(S.C.walter, WALTER_SQ, PI, {}, 'teary-smile', false, {focus: false});
		S.put(S.C.leo, LEO_SQ, PI, {thinking: true, headYaw: -0.3}, 'thinking');
		const h = head(S.C.leo, LEO_SQ);
		S.cam({from: [h[0] - 0.5, h[1] + 0.3, h[2] - 5.0], to: [h[0] - 0.35, h[1] + 0.2, h[2] - 4.0], look: h, fov: 38, frameY: 0.4});
	},
	a5_thanks(S, {t}) {
		squareCrowd(S, t + 10, 'happy');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.put(S.C.walter, WALTER_SQ, PI, {headYaw: 0.35, headPitch: 0.12}, 'teary-smile');
		S.put(S.C.leo, LEO_SQ, PI, {headPitch: -0.3}, 'happy', false, {focus: false});
		S.bubble('Thank you.', [149.5, 6.9, 16.9], 1.45, 0.05, {color: '#fff3c0'});
		S.cam({from: [150.6, 5.8, 7.8], to: [150.5, 5.7, 8.6], look: [149.9, 5.6, 16.4], fov: 40, frameY: 0.5});
	},
	a5_together(S, {t}) {
		squareCrowd(S, t + 11, 'cheer');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.put(S.C.walter, WALTER_SQ, PI, {armR: [-0.35, 0, -0.95]}, 'teary-smile', false, {focus: false});
		S.put(S.C.leo, [148.2, 0, 16.4], PI, {}, 'big-smile', false, {focus: false});
		S.cam({from: [148.4, 5.0, 7.0], to: [148.6, 4.9, 8.0], look: [149, 4.0, 16.2], fov: 42, frameY: 0.45});
	},
	a5_together2(S, {t}) {
		squareCrowd(S, t + 12, 'cheer');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.put(S.C.walter, WALTER_SQ, PI - 0.4, {armR: [-0.35, 0, -0.95], headPitch: 0.15}, 'big-smile', false, {focus: false});
		S.put(S.C.leo, [148.2, 0, 16.4], PI + 0.6, {headPitch: -0.4}, 'big-smile', false, {focus: false});
		S.cam({from: [145.4, 3.4, 8.4], to: [145.7, 3.5, 8.9], look: [149.2, 4.4, 16.3], fov: 40, frameY: 0.48});
	},
	end_pullup(S, {t, d}) {
		squareCrowd(S, t + 13, 'cheer');
		S.show('school');
		S.stringLights(() => true);
		S.glow({water: 2.0});
		S.confetti([150, 0, 10], 30, 22, -2);
		S.put(S.C.walter, WALTER_SQ, PI, {cheer: true}, 'big-smile', false, {focus: false});
		S.put(S.C.leo, [148.2, 0, 16.4], PI, {cheer: true}, 'big-smile', false, {focus: false});
		S.shadow([150, 0, 0], 60);
		const k = S.ease(S.clamp(t / (d - 0.6)));
		S.cam({from: [150, 9, 34], to: [96, 150, 150], look: [150, 3, 8], lookTo: [110, 0, -10], fov: 44, push: 0});
		S.fade(S.clamp((t - (d - 1.7)) / 1.5));
		void k;
	},
};
