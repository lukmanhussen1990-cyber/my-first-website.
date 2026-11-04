// Many Bobs at once, drawn with instancing: one InstancedMesh per body part (torso, head, hair, sleeves,
// arms, legs, shoes, sandwich). Each Bob gets its own position/yaw/scale and colours; the pose can be the
// same for everyone (perfect sync) or different per Bob (the ending).
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {useCurrentFrame} from 'remotion';
import {CharSpec, dims, faceStyleOf, isBlinking} from '../characters/Character';
import {Pose} from '../characters/poses';
import {faceMaterial, EXPRESSIONS, FaceParts, Expression} from '../characters/faceTexture';
import {rbox, plastic, custom} from '../lib/materials';
import {V3} from '../lib/anim';
import {BOB_HAIR, BOB_PANTS, BOB_SHIRT, BOB_SHOES} from './cast';

export type BobInst = {pos: V3; yaw: number; scale?: number; shirt?: string; pants?: string; hair?: string; shoes?: string};
export type SandwichState = 0 | 1 | 2; // none, whole, bitten

/** the Bob side-part hair as one merged geometry (base head space) */
function bobHairGeometry() {
	return custom('bobHairMerged', () => {
		const parts: THREE.BufferGeometry[] = [];
		const add = (g: THREE.BufferGeometry, p: V3, r: V3 = [0, 0, 0]) => {
			const c = g.clone();
			c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(1, 1, 1)));
			parts.push(c);
		};
		add(rbox(0.36, 0.3, 1.34, 0.1), [-0.52, 0.53, -0.03]);
		add(rbox(1.0, 0.36, 1.36, 0.12), [0.2, 0.56, -0.03]);
		add(rbox(1.38, 0.82, 0.3, 0.1), [0, 0.16, -0.56]);
		add(rbox(0.18, 0.46, 1.0, 0.08), [-0.67, 0.32, -0.1]);
		add(rbox(0.18, 0.46, 1.0, 0.08), [0.67, 0.32, -0.1]);
		add(rbox(1.02, 0.22, 0.28, 0.09), [0.18, 0.5, 0.55], [-0.18, 0, -0.1]);
		return mergeGeometries(parts)!;
	});
}

/** a triangle sandwich (whole or with a bite out of it), in hand space */
export function sandwichGeometries(bitten: boolean) {
	return custom(`sandwich|${bitten}`, () => {
		const tri = (r: number) => {
			const s = new THREE.Shape();
			s.moveTo(-r, -r * 0.55);
			s.lineTo(r, -r * 0.55);
			if (bitten) {
				s.lineTo(r * 0.28, r * 0.42);
				s.absarc(0, r * 0.62, r * 0.3, -0.6, Math.PI + 0.6, true);
				s.lineTo(-r * 0.28, r * 0.42);
			} else {
				s.lineTo(0, r * 0.95);
			}
			s.lineTo(-r, -r * 0.55);
			return s;
		};
		const slab = (r: number, depth: number, z: number) => {
			const g = new THREE.ExtrudeGeometry(tri(r), {depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8});
			g.translate(0, 0, z);
			const ng = g.toNonIndexed();
			ng.deleteAttribute('uv');
			return ng;
		};
		const bread = mergeGeometries([slab(0.55, 0.1, -0.2), slab(0.55, 0.1, 0.1)])!;
		const fill = slab(0.52, 0.12, -0.06);
		return {bread, fill} as unknown as THREE.BufferGeometry;
	}) as unknown as {bread: THREE.BufferGeometry; fill: THREE.BufferGeometry};
}

type Props = {
	spec: CharSpec;
	people: BobInst[];
	/** pose for Bob i (return the same object for everyone to keep them in perfect sync) */
	pose: (i: number) => Pose;
	/** face variants (max 4) and which one each Bob wears */
	faces?: (Expression | FaceParts)[];
	faceOf?: (i: number) => number;
	/** look direction of the pupils for variant faces */
	look?: [number, number];
	/** synced blinking for everyone */
	blink?: boolean;
	sandwich?: (i: number) => SandwichState;
	/** override the colours per Bob (colour spreading at the end) */
	colorsOf?: (i: number) => {shirt: string; pants: string; hair: string; shoes?: string};
	faceSize?: number;
};

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const col = new THREE.Color();
const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const R = (x: number, y: number, z: number) => new THREE.Matrix4().makeRotationFromEuler(tmpE.set(x, y, z));

export const BobCrowd: React.FC<Props> = ({spec, people, pose, faces = ['bob'], faceOf, look, blink = true, sandwich, colorsOf, faceSize = 512}) => {
	const frame = useCurrentFrame();
	const N = people.length;
	const D = dims(spec);
	const st = faceStyleOf(spec);
	const geo = useMemo(() => {
		const sl = D.armH * 0.34;
		const shoeH = 0.4;
		const pantsLen = D.legH - shoeH + 0.06;
		return {
			sl,
			shoeH,
			pantsLen,
			skinLen: D.armH - sl + 0.04,
			torso: rbox(D.torsoW, D.torsoH, D.torsoD, 0.12),
			neck: rbox(D.torsoW * 0.42, 0.1, D.torsoD * 0.7, 0.04),
			head: rbox(D.headW, D.headH, D.headD, D.headR, 4),
			hair: bobHairGeometry(),
			sleeve: rbox(D.armW + 0.04, sl, D.armD + 0.04, 0.1),
			arm: rbox(D.armW, D.armH - sl + 0.04, D.armD, 0.1),
			pants: rbox(D.legW, pantsLen, D.legD, 0.1),
			shoe: rbox(D.legW + 0.06, shoeH, D.legD + 0.2, 0.12),
			sandW: sandwichGeometries(false),
			sandB: sandwichGeometries(true),
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [spec.name]);
	const mats = useMemo(
		() => ({
			cloth: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.5}),
			pants: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.55}),
			shoe: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.42}),
			hair: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.55}),
			neck: new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.5}),
			skin: plastic(spec.skin, {rough: 0.45}),
			bread: plastic('#e8cf9a', {rough: 0.8}),
			fill: plastic('#c9cbb0', {rough: 0.7}),
		}),
		[spec.skin],
	);
	// face variants: one head mesh per variant
	const variants = faces.map((f) => (typeof f === 'string' ? EXPRESSIONS[f] : f));
	const blinking = blink && isBlinking(frame, 4242);
	const faceMats = variants.map((v) => {
		let parts: FaceParts = {...v};
		if (look) parts = {...parts, lookX: look[0], lookY: look[1]};
		if (blinking && ['dot', 'wide', 'sad', 'sparkle', 'half', 'side', 'angry', 'tired'].includes(parts.eyes)) parts = {...parts, eyes: 'blink'};
		return faceMaterial(st, parts, 0, faceSize);
	});
	const headMats = faceMats.map((fm) => [mats.skin, mats.skin, mats.skin, mats.skin, fm, mats.skin]);

	const refs = {
		torso: useRef<THREE.InstancedMesh>(null),
		neck: useRef<THREE.InstancedMesh>(null),
		hair: useRef<THREE.InstancedMesh>(null),
		sleeveL: useRef<THREE.InstancedMesh>(null),
		sleeveR: useRef<THREE.InstancedMesh>(null),
		armL: useRef<THREE.InstancedMesh>(null),
		armR: useRef<THREE.InstancedMesh>(null),
		pantsL: useRef<THREE.InstancedMesh>(null),
		pantsR: useRef<THREE.InstancedMesh>(null),
		shoeL: useRef<THREE.InstancedMesh>(null),
		shoeR: useRef<THREE.InstancedMesh>(null),
		breadW: useRef<THREE.InstancedMesh>(null),
		fillW: useRef<THREE.InstancedMesh>(null),
		breadB: useRef<THREE.InstancedMesh>(null),
		fillB: useRef<THREE.InstancedMesh>(null),
	};
	const headRefs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];

	useLayoutEffect(() => {
		const hy = D.headH / 2 + 0.03;
		const armX = D.torsoW / 2 + D.armW / 2 + 0.01;
		const armY = D.torsoH - D.armW / 2;
		const top = D.armW / 2;
		const len = D.armH;
		let lastPose: Pose | null = null;
		let L: Record<string, THREE.Matrix4> = {};
		const localsFor = (p: Pose) => {
			const hip = T(0, D.legH + p.y, p.fwd);
			const torsoR = hip.clone().multiply(R(p.lean, p.turn, p.tilt));
			const headBase = torsoR.clone().multiply(T(0, D.torsoH, 0)).multiply(R(p.head[0], p.head[1], p.head[2])).multiply(T(0, hy, 0));
			const arm = (side: number, rot: V3) => torsoR.clone().multiply(T(side * armX, armY, 0)).multiply(R(rot[0], rot[1], rot[2]));
			const leg = (side: number, rot: V3) => hip.clone().multiply(T(side * (D.legW / 2 + 0.005), 0, 0)).multiply(R(rot[0], rot[1], rot[2]));
			const aL = arm(1, p.armL);
			const aR = arm(-1, p.armR);
			const lL = leg(1, p.legL);
			const lR = leg(-1, p.legR);
			return {
				torso: torsoR.clone().multiply(T(0, D.torsoH / 2, 0)),
				neck: torsoR.clone().multiply(T(0, D.torsoH, 0.02)),
				head: headBase,
				hair: headBase.clone().multiply(new THREE.Matrix4().makeScale(D.hs, D.hs, D.hs)),
				sleeveL: aL.clone().multiply(T(0, top - geo.sl / 2, 0)),
				sleeveR: aR.clone().multiply(T(0, top - geo.sl / 2, 0)),
				armL: aL.clone().multiply(T(0, top - len + geo.skinLen / 2, 0)),
				armR: aR.clone().multiply(T(0, top - len + geo.skinLen / 2, 0)),
				pantsL: lL.clone().multiply(T(0, -geo.pantsLen / 2, 0)),
				pantsR: lR.clone().multiply(T(0, -geo.pantsLen / 2, 0)),
				shoeL: lL.clone().multiply(T(0, -D.legH + geo.shoeH / 2, 0.09)),
				shoeR: lR.clone().multiply(T(0, -D.legH + geo.shoeH / 2, 0.09)),
				// sandwich in the right hand, held flat in front of the fingers
				sand: aR.clone().multiply(T(0, top - len - 0.05, 0.32)).multiply(R(-Math.PI / 2 + 0.25, 0, 0)).multiply(new THREE.Matrix4().makeScale(1.25, 1.25, 1.25)),
			};
		};
		const W = new THREE.Matrix4();
		for (let i = 0; i < N; i++) {
			const b = people[i];
			const p = pose(i);
			if (p !== lastPose) {
				L = localsFor(p);
				lastPose = p;
			}
			const s = (b.scale ?? 1) * spec.scale;
			W.compose(tmpV.set(...b.pos), tmpQ.setFromEuler(tmpE.set(0, b.yaw, 0)), tmpS.set(s, s, s));
			const c = colorsOf ? colorsOf(i) : {shirt: b.shirt ?? BOB_SHIRT, pants: b.pants ?? BOB_PANTS, hair: b.hair ?? BOB_HAIR, shoes: b.shoes ?? BOB_SHOES};
			const set = (key: keyof typeof refs, local: THREE.Matrix4, color?: string) => {
				const m = refs[key].current;
				if (!m) return;
				m.setMatrixAt(i, tmpM.multiplyMatrices(W, local));
				if (color) m.setColorAt(i, col.set(color));
			};
			set('torso', L.torso, c.shirt);
			set('neck', L.neck, '#' + col.set(c.shirt).multiplyScalar(0.82).getHexString());
			set('hair', L.hair, c.hair);
			set('sleeveL', L.sleeveL, c.shirt);
			set('sleeveR', L.sleeveR, c.shirt);
			set('armL', L.armL);
			set('armR', L.armR);
			set('pantsL', L.pantsL, c.pants);
			set('pantsR', L.pantsR, c.pants);
			set('shoeL', L.shoeL, c.shoes ?? BOB_SHOES);
			set('shoeR', L.shoeR, c.shoes ?? BOB_SHOES);
			const fv = faceOf ? faceOf(i) : 0;
			headRefs.forEach((hr, k) => hr.current?.setMatrixAt(i, k === fv ? tmpM.multiplyMatrices(W, L.head) : ZERO));
			const sw = sandwich ? sandwich(i) : 0;
			const sm = tmpM.multiplyMatrices(W, L.sand);
			refs.breadW.current?.setMatrixAt(i, sw === 1 ? sm : ZERO);
			refs.fillW.current?.setMatrixAt(i, sw === 1 ? sm : ZERO);
			refs.breadB.current?.setMatrixAt(i, sw === 2 ? sm : ZERO);
			refs.fillB.current?.setMatrixAt(i, sw === 2 ? sm : ZERO);
		}
		for (const r of [...Object.values(refs), ...headRefs]) {
			const m = r.current;
			if (!m) continue;
			m.instanceMatrix.needsUpdate = true;
			if (m.instanceColor) m.instanceColor.needsUpdate = true;
		}
	});

	const im = (key: keyof typeof refs, g: THREE.BufferGeometry, m: THREE.Material) => (
		<instancedMesh key={key} ref={refs[key]} args={[g, m, N]} castShadow receiveShadow frustumCulled={false} />
	);
	return (
		<group>
			{im('torso', geo.torso, mats.cloth)}
			{im('neck', geo.neck, mats.neck)}
			{im('hair', geo.hair, mats.hair)}
			{im('sleeveL', geo.sleeve, mats.cloth)}
			{im('sleeveR', geo.sleeve, mats.cloth)}
			{im('armL', geo.arm, mats.skin)}
			{im('armR', geo.arm, mats.skin)}
			{im('pantsL', geo.pants, mats.pants)}
			{im('pantsR', geo.pants, mats.pants)}
			{im('shoeL', geo.shoe, mats.shoe)}
			{im('shoeR', geo.shoe, mats.shoe)}
			{sandwich ? (
				<>
					{im('breadW', geo.sandW.bread, mats.bread)}
					{im('fillW', geo.sandW.fill, mats.fill)}
					{im('breadB', geo.sandB.bread, mats.bread)}
					{im('fillB', geo.sandB.fill, mats.fill)}
				</>
			) : null}
			{headMats.map((hm, k) => (
				<instancedMesh key={'head' + k} ref={headRefs[k]} args={[geo.head, undefined, N]} material={hm} castShadow receiveShadow frustumCulled={false} />
			))}
		</group>
	);
};
