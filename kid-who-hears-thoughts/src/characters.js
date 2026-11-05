// makeCharacter({skin, shirt, pants, hair, accessory}) - blocky toy-style people built from boxes,
// a rounded-cube head and a flat canvas face. Also the chicken and the dog.
import * as THREE from 'three';
import {drawFace} from './faces.js';
import {box, canvasTex, cone, cyl, mat, mesh, plane, rbox, rnd, sph, torus, roundRect} from './lib.js';

const faceTex = (style, expr, blink, mouth) => {
	const t = canvasTex(`face|${style}|${expr}|${blink}|${mouth}`, 512, 512, (ctx) => drawFace(ctx, expr, {blink, mouthOpen: mouth, style}));
	return t;
};

const frontTex = (kind, color) =>
	canvasTex(`front|${kind}|${color}`, 256, 256, (ctx, w, h) => {
		ctx.clearRect(0, 0, w, h);
		if (kind === 'hoodie') {
			ctx.fillStyle = 'rgba(0,0,0,0.12)';
			roundRect(ctx, w * 0.2, h * 0.6, w * 0.6, h * 0.3, 18);
			ctx.fill();
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 7;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(w * 0.42, 0);
			ctx.lineTo(w * 0.4, h * 0.32);
			ctx.moveTo(w * 0.58, 0);
			ctx.lineTo(w * 0.6, h * 0.32);
			ctx.stroke();
		} else if (kind === 'sweater') {
			ctx.fillStyle = 'rgba(0,0,0,0.08)';
			for (let y = 10; y < h; y += 22) ctx.fillRect(0, y, w, 6);
			ctx.fillStyle = '#ffd36a';
			[0.25, 0.45, 0.65, 0.85].forEach((y) => {
				ctx.beginPath();
				ctx.arc(w * 0.5, h * y, 11, 0, Math.PI * 2);
				ctx.fill();
			});
			ctx.fillStyle = '#fff3e0';
			ctx.beginPath();
			ctx.moveTo(w * 0.36, 0);
			ctx.lineTo(w * 0.5, h * 0.16);
			ctx.lineTo(w * 0.64, 0);
			ctx.fill();
		} else if (kind === 'apron') {
			ctx.fillStyle = '#ffffff';
			roundRect(ctx, w * 0.16, h * 0.1, w * 0.68, h * 0.95, 26);
			ctx.fill();
			ctx.fillStyle = '#ff9db8';
			ctx.fillRect(w * 0.16, h * 0.55, w * 0.68, 10);
		} else if (kind === 'tie') {
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.moveTo(w * 0.36, 0);
			ctx.lineTo(w * 0.5, h * 0.28);
			ctx.lineTo(w * 0.64, 0);
			ctx.fill();
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(w * 0.46, h * 0.04);
			ctx.lineTo(w * 0.54, h * 0.04);
			ctx.lineTo(w * 0.57, h * 0.5);
			ctx.lineTo(w * 0.5, h * 0.6);
			ctx.lineTo(w * 0.43, h * 0.5);
			ctx.fill();
		} else if (kind === 'star') {
			ctx.fillStyle = color;
			ctx.beginPath();
			for (let i = 0; i < 10; i++) {
				const a = (i * Math.PI) / 5 - Math.PI / 2;
				const r = i % 2 ? w * 0.08 : w * 0.18;
				ctx.lineTo(w / 2 + Math.cos(a) * r, h * 0.45 + Math.sin(a) * r);
			}
			ctx.fill();
		} else if (kind === 'vest') {
			ctx.fillStyle = color;
			ctx.fillRect(0, 0, w * 0.32, h);
			ctx.fillRect(w * 0.68, 0, w * 0.32, h);
			ctx.fillStyle = '#ffd36a';
			[0.3, 0.55, 0.8].forEach((y) => {
				ctx.beginPath();
				ctx.arc(w * 0.28, h * y, 8, 0, Math.PI * 2);
				ctx.fill();
			});
		}
	});

function addHair(head, style, color, hs) {
	const m = mat(color, {rough: 0.55});
	const add = (geo, p, r = [0, 0, 0]) => head.add(mesh(geo, m, p, r));
	switch (style) {
		case 'messy': // Leo: stacked, slightly rotated boxes
			add(rbox(1.5, 0.55, 1.42, 0.2), [0, 0.5, -0.04]);
			add(rbox(1.46, 0.95, 0.45, 0.15), [0, 0.05, -0.5]);
			add(rbox(0.7, 0.35, 0.8, 0.1), [-0.35, 0.82, 0.15], [0.2, 0.3, 0.25]);
			add(rbox(0.65, 0.32, 0.75, 0.1), [0.38, 0.8, 0.05], [-0.15, -0.4, -0.3]);
			add(rbox(0.6, 0.3, 0.7, 0.1), [0.05, 0.9, -0.3], [0.3, 0.6, 0.1]);
			add(rbox(1.2, 0.28, 0.32, 0.1), [-0.1, 0.42, 0.62], [0.1, 0.05, -0.12]);
			add(rbox(0.45, 0.6, 0.3, 0.1), [-0.66, 0.2, 0.3], [0, 0, 0.2]);
			add(rbox(0.45, 0.6, 0.3, 0.1), [0.66, 0.2, 0.3], [0, 0, -0.2]);
			break;
		case 'pigtails':
			add(rbox(1.46, 0.55, 1.42, 0.2), [0, 0.48, -0.04]);
			add(rbox(1.46, 0.9, 0.45, 0.15), [0, 0.05, -0.5]);
			add(rbox(1.25, 0.26, 0.3, 0.1), [0, 0.58, 0.58], [0, 0, 0.06]);
			[-1, 1].forEach((s) => {
				add(rbox(0.42, 0.95, 0.42, 0.18), [s * 0.95, -0.15, -0.1], [0, 0, s * 0.3]);
				head.add(mesh(sph(0.13, 10, 8), mat('#ffd23a'), [s * 0.82, 0.32, -0.1]));
			});
			break;
		case 'bald':
			add(rbox(0.25, 0.5, 0.9, 0.08), [-0.66, -0.05, -0.15]);
			add(rbox(0.25, 0.5, 0.9, 0.08), [0.66, -0.05, -0.15]);
			add(rbox(1.3, 0.35, 0.3, 0.1), [0, -0.05, -0.6]);
			break;
		case 'bun':
			add(rbox(1.46, 0.55, 1.42, 0.2), [0, 0.48, -0.04]);
			head.add(mesh(sph(0.38, 14, 10), m, [0, 0.95, -0.35]));
			break;
		case 'spiky':
			add(rbox(1.46, 0.5, 1.42, 0.2), [0, 0.48, -0.04]);
			[-0.45, -0.15, 0.15, 0.45].forEach((x, i) => add(rbox(0.32, 0.45, 0.32, 0.08), [x, 0.85, 0.1 - (i % 2) * 0.25], [0.2, 0, (i - 1.5) * 0.25]));
			break;
		case 'long':
			add(rbox(1.46, 0.55, 1.42, 0.2), [0, 0.48, -0.04]);
			add(rbox(1.5, 1.8, 0.45, 0.15), [0, -0.4, -0.52]);
			add(rbox(0.28, 1.4, 1.0, 0.1), [-0.7, -0.2, -0.05]);
			add(rbox(0.28, 1.4, 1.0, 0.1), [0.7, -0.2, -0.05]);
			break;
		default: // short
			add(rbox(1.46, 0.5, 1.42, 0.2), [0, 0.5, -0.04]);
			add(rbox(1.46, 0.7, 0.4, 0.15), [0, 0.15, -0.52]);
	}
}

/**
 * @param {{skin:string, shirt:string, pants:string, shoes?:string, hair?:{style:string,color:string},
 *          accessory?:string[], face?:string, front?:string, frontColor?:string, scale?:number, sleeves?:string}} o
 */
export function makeCharacter(o) {
	const root = new THREE.Group();
	const body = new THREE.Group();
	root.add(body);
	const skin = mat(o.skin, {rough: 0.55});
	const shirt = mat(o.shirt);
	const pants = mat(o.pants);
	const shoes = mat(o.shoes ?? '#2a2a32', {rough: 0.5});
	const legs = [-1, 1].map((s) => {
		const gp = new THREE.Group();
		gp.position.set(s * 0.5, 2.0, 0);
		gp.add(mesh(rbox(0.96, 1.75, 0.96, 0.1), pants, [0, -0.9, 0]));
		gp.add(mesh(rbox(1.0, 0.32, 1.1, 0.1), shoes, [0, -1.85, 0.06]));
		body.add(gp);
		return gp;
	});
	const torso = new THREE.Group();
	torso.position.set(0, 2.0, 0);
	body.add(torso);
	torso.add(mesh(rbox(2.0, 2.0, 1.0, 0.14), shirt, [0, 1.0, 0]));
	if (o.front) {
		const ft = frontTex(o.front, o.frontColor ?? '#c0303a');
		const fm = new THREE.MeshStandardMaterial({map: ft, transparent: true, roughness: 0.6, alphaTest: 0.05, polygonOffset: true, polygonOffsetFactor: -2});
		torso.add(mesh(plane(1.94, 1.94), fm, [0, 1.0, 0.505], [0, 0, 0], false));
	}
	const acc = new Set(o.accessory ?? []);
	if (acc.has('hood')) torso.add(mesh(rbox(1.7, 0.6, 0.5, 0.2), shirt, [0, 2.0, -0.4]));
	if (acc.has('skirt')) torso.add(mesh(cyl(1.15, 1.5, 1.0, 8), shirt, [0, -0.35, 0]));
	const arms = [-1, 1].map((s) => {
		const gp = new THREE.Group();
		gp.position.set(s * 1.5, 1.85, 0);
		if (o.sleeves === 'short') {
			gp.add(mesh(rbox(0.94, 0.85, 0.94, 0.12), shirt, [0, -0.42, 0]));
			gp.add(mesh(rbox(0.88, 1.12, 0.88, 0.12), skin, [0, -1.4, 0]));
		} else {
			gp.add(mesh(rbox(0.94, 1.7, 0.94, 0.12), shirt, [0, -0.85, 0]));
			gp.add(mesh(rbox(0.86, 0.34, 0.86, 0.12), skin, [0, -1.82, 0]));
		}
		torso.add(gp);
		return gp;
	});
	const holdR = new THREE.Group();
	holdR.position.set(0, -2.0, 0.25);
	arms[1].add(holdR);
	const neck = new THREE.Group();
	neck.position.set(0, 2.0, 0);
	torso.add(neck);
	const head = new THREE.Group();
	head.position.set(0, 0.72, 0);
	neck.add(head);
	head.add(mesh(rbox(1.32, 1.3, 1.25, 0.4, 3), skin, [0, 0, 0]));
	const faceMat = new THREE.MeshStandardMaterial({transparent: true, alphaTest: 0.05, roughness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.22, polygonOffset: true, polygonOffsetFactor: -2});
	const face = mesh(plane(1.24, 1.24), faceMat, [0, -0.02, 0.63], [0, 0, 0], false);
	face.renderOrder = 2;
	head.add(face);
	if (o.hair) addHair(head, o.hair.style, o.hair.color, 1);
	if (acc.has('chefHat')) {
		head.add(mesh(cyl(0.62, 0.6, 0.4, 20), mat('#ffffff'), [0, 0.82, 0]));
		const puff = mesh(sph(0.75, 16, 12), mat('#ffffff'), [0, 1.3, 0]);
		puff.scale.set(1, 0.7, 1);
		head.add(puff);
	}
	if (acc.has('topHat')) {
		const black = mat('#141418', {rough: 0.35});
		head.add(mesh(cyl(0.95, 0.95, 0.08, 24), black, [0, 0.68, 0]));
		head.add(mesh(cyl(0.6, 0.62, 1.7, 24), black, [0, 1.55, 0]));
		head.add(mesh(cyl(0.63, 0.63, 0.28, 24), mat('#d6202f'), [0, 0.9, 0]));
	}
	if (acc.has('backpack')) torso.add(mesh(rbox(1.5, 1.6, 0.6, 0.2), mat(o.frontColor ?? '#3a6ad0'), [0, 1.0, -0.8]));
	root.scale.setScalar(o.scale ?? 1);

	const seed = rnd(o.shirt + o.skin + (o.hair?.color ?? '')) * 10;
	const style = o.face ?? 'kid';

	/** Pose + face for time t. */
	const update = (t, pose = {}, expr = 'neutral', talk = false) => {
		const wph = pose.walk;
		const walking = wph !== undefined;
		const amp = pose.walkAmp ?? (pose.run ? 1.0 : 0.55);
		const sw = walking ? Math.sin(wph) * amp : 0;
		const bob = walking ? Math.abs(Math.cos(wph)) * (pose.run ? 0.22 : 0.08) : Math.sin(t * 2.2 + seed) * 0.04;
		body.position.y = bob + (pose.bob ?? 0) - (pose.kneel ?? 0) * 1.0;
		body.rotation.set(pose.lean ?? 0, 0, pose.roll ?? 0);
		legs[0].rotation.set(...(pose.legL ?? (pose.sit ? [-1.5, 0, 0.05] : pose.kneel ? [-1.5 * pose.kneel, 0, 0] : [sw, 0, 0])));
		legs[1].rotation.set(...(pose.legR ?? (pose.sit ? [-1.5, 0, -0.05] : pose.kneel ? [0.2 * pose.kneel, 0, 0] : [-sw, 0, 0])));
		let aL = pose.armL ?? [-sw * 0.9, 0, 0.07 + Math.sin(t * 1.7 + seed) * 0.02];
		let aR = pose.armR ?? [sw * 0.9, 0, -0.07 - Math.sin(t * 1.7 + seed) * 0.02];
		if (pose.coverEars) {
			aL = [-0.2, 0, 2.55];
			aR = [-0.2, 0, -2.55];
		}
		if (pose.cheer) {
			aL = [0, 0, 2.7 + Math.sin(t * 9 + seed) * 0.25];
			aR = [0, 0, -2.7 - Math.sin(t * 9 + seed + 1) * 0.25];
			body.position.y += Math.abs(Math.sin(t * 7 + seed)) * 0.3;
		}
		if (pose.knock !== undefined) aR = [-1.75 + Math.max(0, Math.sin(pose.knock * Math.PI * 2 * 2.5)) * 0.35, 0, -0.15];
		if (pose.wave) aR = [0, 0, -2.5 + Math.sin(t * 10) * 0.35];
		if (pose.reach) aR = [-1.35, 0, -0.1];
		if (pose.hang) {
			aL = [-2.9, 0, 0.25];
			aR = [-2.9, 0, -0.25];
		}
		if (pose.throw !== undefined) aR = [-2.8 + pose.throw * 3.2, 0, -0.1];
		if (pose.thumbs) aR = [-1.3, 0, -0.3];
		if (pose.hold) {
			aL = [-1.1, 0, 0.35];
			aR = [-1.1, 0, -0.35];
		}
		if (pose.handOnShoulder) aL = [-0.5, 0, 0.95];
		arms[0].rotation.set(...aL);
		arms[1].rotation.set(...aR);
		neck.rotation.set(pose.headPitch ?? 0, pose.headYaw ?? 0, (pose.headTilt ?? 0) + (pose.thinking ? Math.sin(t * 1.5) * 0.06 + 0.18 : 0));
		const period = 2.8 + (seed % 1.7);
		const blink = !pose.noBlink && (t + seed) % period < 0.13;
		const mouth = talk && Math.sin(t * 15 + seed) + 0.6 * Math.sin(t * 23.7 + seed * 2) > 0.1;
		faceMat.map = faceTex(style, expr, blink, mouth);
		faceMat.needsUpdate = false;
	};
	return {root, head, holdR, update, faceMat, kind: 'person'};
}

/* ---------- animals ---------- */

export function makeChicken() {
	const root = new THREE.Group();
	const white = mat('#fbfbf6', {rough: 0.6});
	const bodyG = new THREE.Group();
	root.add(bodyG);
	bodyG.add(mesh(rbox(1.3, 1.1, 1.6, 0.3), white, [0, 1.3, 0]));
	bodyG.add(mesh(rbox(0.9, 0.7, 0.4, 0.15), white, [0, 1.55, -0.85], [-0.5, 0, 0]));
	const head = new THREE.Group();
	head.position.set(0, 2.0, 0.6);
	bodyG.add(head);
	head.add(mesh(rbox(0.8, 0.85, 0.8, 0.25), white, [0, 0.3, 0]));
	head.add(mesh(rbox(0.25, 0.4, 0.5, 0.08), mat('#e8252f'), [0, 0.85, 0.05]));
	head.add(mesh(cone(0.18, 0.4, 4), mat('#ffb21f'), [0, 0.28, 0.55], [Math.PI / 2, 0, 0]));
	head.add(mesh(rbox(0.16, 0.3, 0.12, 0.05), mat('#e8252f'), [0, 0.02, 0.42]));
	[-1, 1].forEach((s) => head.add(mesh(sph(0.07, 8, 6), mat('#111111'), [s * 0.41, 0.42, 0.18])));
	[-1, 1].forEach((s) => {
		bodyG.add(mesh(cyl(0.06, 0.06, 0.8, 6), mat('#ffb21f'), [s * 0.3, 0.4, 0]));
		bodyG.add(mesh(rbox(0.35, 0.08, 0.45, 0.03), mat('#ffb21f'), [s * 0.3, 0.04, 0.1]));
	});
	const update = (t, o = {}) => {
		const peck = o.peck ? Math.max(0, Math.sin(t * 7)) : 0;
		head.rotation.set(peck * 0.9, o.tilt ? Math.sin(t * 2) * 0.1 : 0, o.tilt ?? 0);
		head.position.y = 2.0 - peck * 0.4;
		bodyG.rotation.x = peck * 0.25;
	};
	return {root, head, update, kind: 'chicken'};
}

export function makeDog() {
	const root = new THREE.Group();
	const fur = mat('#c98a4a', {rough: 0.7});
	const cream = mat('#f4e2c6', {rough: 0.7});
	const bodyG = new THREE.Group();
	root.add(bodyG);
	bodyG.add(mesh(rbox(1.3, 1.1, 2.2, 0.2), fur, [0, 1.5, 0]));
	bodyG.add(mesh(rbox(0.9, 0.06, 1.6, 0.02), cream, [0, 0.95, 0]));
	const legs = [[-0.4, 0.75], [0.4, 0.75], [-0.4, -0.75], [0.4, -0.75]].map(([x, z]) => {
		const gp = new THREE.Group();
		gp.position.set(x, 1.05, z);
		gp.add(mesh(rbox(0.42, 1.0, 0.42, 0.08), fur, [0, -0.5, 0]));
		gp.add(mesh(rbox(0.46, 0.22, 0.5, 0.06), cream, [0, -0.95, 0.04]));
		bodyG.add(gp);
		return gp;
	});
	const head = new THREE.Group();
	head.position.set(0, 2.1, 1.0);
	bodyG.add(head);
	head.add(mesh(rbox(1.25, 1.15, 1.1, 0.3), fur, [0, 0.35, 0.2]));
	head.add(mesh(rbox(0.7, 0.5, 0.5, 0.15), cream, [0, 0.12, 0.9]));
	head.add(mesh(rbox(0.28, 0.2, 0.18, 0.08), mat('#1a1414'), [0, 0.3, 1.16]));
	[-1, 1].forEach((s) => head.add(mesh(sph(0.1, 10, 8), mat('#151010'), [s * 0.3, 0.6, 0.76])));
	const ears = [-1, 1].map((s) => {
		const gp = new THREE.Group();
		gp.position.set(s * 0.62, 0.85, 0.1);
		gp.add(mesh(rbox(0.3, 0.75, 0.16, 0.06), mat('#8a5a2a', {rough: 0.7}), [s * 0.05, -0.35, 0]));
		head.add(gp);
		return gp;
	});
	const tongue = mesh(rbox(0.22, 0.05, 0.3, 0.02), mat('#ff6f8e'), [0, -0.08, 1.05], [0.4, 0, 0]);
	head.add(tongue);
	const tail = new THREE.Group();
	tail.position.set(0, 1.9, -1.1);
	tail.add(mesh(rbox(0.22, 0.22, 0.8, 0.06), fur, [0, 0, -0.35]));
	bodyG.add(tail);
	const update = (t, o = {}) => {
		const run = o.run;
		const ph = t * (run ? 15 : 0);
		legs.forEach((l, i) => l.rotation.set(run ? Math.sin(ph + (i < 2 ? 0 : Math.PI)) * 0.9 : 0, 0, 0));
		bodyG.position.y = run ? Math.abs(Math.sin(ph)) * 0.25 : Math.sin(t * 2.4) * 0.03;
		tail.rotation.set(-0.8, Math.sin(t * (o.wag ?? 14)) * 0.6, 0);
		head.rotation.set(o.headPitch ?? 0, 0, (o.tilt ?? 0) + (o.bob ? Math.sin(t * 6) * 0.06 : 0));
		ears.forEach((e, i) => e.rotation.set(run ? -0.6 : 0, 0, (i ? -1 : 1) * (0.15 + (o.bob ? Math.sin(t * 6 + i) * 0.1 : 0))));
		tongue.visible = !!o.tongue;
	};
	return {root, head, update, kind: 'dog'};
}

export {torus};
