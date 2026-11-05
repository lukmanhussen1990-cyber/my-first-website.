import {useThree} from '@react-three/fiber';
import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {V3, clamp, lerp, rnd} from '../lib/anim';
import {litTex, planeGeo, plastic, rboxGeo, unlit} from '../three/cache';
import {Box, Cyl, RBox, Sph} from '../three/prims';
import {bangTex, dropTex, heartTex, sparkleTex, textTex, zTex} from '../three/textures';
import {FACE, blushTex, browTex, getDogFace, happyEyeTex, lidTex, shockEyeTex, tongueTex} from './dogFace';

/* Biscuit: a Roblox-style blocky dog built from boxes, with the user's dog face image on the head. */

export type DogPose = 'stand' | 'sit' | 'walk' | 'run' | 'sniff' | 'roll' | 'jump' | 'lie' | 'sleep';
export type DogEmotion = 'normal' | 'proud' | 'happy' | 'sleepy' | 'shocked' | 'sad' | 'brave' | 'love';

export type DogProps = {
	t: number; // seconds (drives all motion)
	pose?: DogPose;
	emotion?: DogEmotion;
	position?: V3;
	yaw?: number;
	scale?: number;
	sash?: boolean;
	bowtie?: boolean;
	hat?: boolean;
	medal?: boolean;
	collar?: boolean;
	headPitch?: number; // extra head nod (+ = down)
	headYaw?: number;
	headTilt?: number;
	paw?: number; // 0..1 raise right front paw (stamping)
	lick?: number; // 0..1 tongue out
	speed?: number; // animation speed multiplier
	lid?: number; // override eyelid closing 0..1
	overlays?: boolean; // emotion overlays (sparkles, zzz, hearts…)
	fx?: number; // overlay intensity 0..1
	faceGlow?: number;
	bodyRoll?: number;
	wagBoost?: number;
	mouthItem?: React.ReactNode; // something held in the mouth (e.g. a tennis ball)
};

// Fur colours matched to the user's image (sampled values brightened for 3D lighting).
const bright = (hex: string, k: number) => {
	const c = new THREE.Color(hex);
	c.multiplyScalar(k);
	return '#' + c.getHexString();
};
export const FUR = bright(FACE.colors.fur, 1.08);
export const FUR_DARK = bright(FACE.colors.furDark, 1.05);
export const CREAM = '#efe1d3';

const furM = () => plastic(FUR, {rough: 0.75, clearcoat: 0.08});
const furDarkM = () => plastic(FUR_DARK, {rough: 0.75});
const creamM = () => plastic(CREAM, {rough: 0.8});

// Head geometry (head-local, origin = head centre).
const HW = 2.05;
const HH = 1.66;
const HD = 1.62;
const FACE_W = 1.97;
const FACE_H = FACE_W / FACE.aspect;
const FACE_Z = HD / 2 + 0.018;
/** Face image coords (u,v from top-left) → head-local position on the face plane. */
const fp = (u: number, v: number, dz = 0.006): V3 => [(u - 0.5) * FACE_W, (0.5 - v) * FACE_H, FACE_Z + dz];

type Rig = {
	y: number;
	pitch: number;
	pivotZ: number;
	pivotY: number;
	roll: number;
	fl: number;
	fr: number;
	bl: number;
	br: number;
	hp: number; // head pitch
	hy: number;
	ht: number;
	hdrop: number;
	earUp: number;
	earBack: number;
	tailUp: number;
	wag: number;
};

const EMO: Record<DogEmotion, {earUp: number; wagHz: number; wagAmp: number; hp: number; tailUp: number}> = {
	normal: {earUp: 0.5, wagHz: 2.2, wagAmp: 0.45, hp: 0, tailUp: 0.9},
	proud: {earUp: 0.6, wagHz: 2.4, wagAmp: 0.4, hp: -0.12, tailUp: 1.1},
	happy: {earUp: 0.65, wagHz: 4.6, wagAmp: 0.75, hp: -0.04, tailUp: 1.1},
	love: {earUp: 0.6, wagHz: 4.2, wagAmp: 0.7, hp: 0, tailUp: 1.0},
	sleepy: {earUp: 0.08, wagHz: 0.4, wagAmp: 0.05, hp: 0.1, tailUp: 0.3},
	shocked: {earUp: 1.0, wagHz: 0, wagAmp: 0, hp: -0.06, tailUp: 1.3},
	sad: {earUp: 0.0, wagHz: 0.5, wagAmp: 0.06, hp: 0.22, tailUp: 0.15},
	brave: {earUp: 0.55, wagHz: 1.4, wagAmp: 0.22, hp: -0.04, tailUp: 1.0},
};

const rigFor = (pose: DogPose, emo: DogEmotion, t: number, sp: number, paw: number): Rig => {
	const e = EMO[emo];
	const r: Rig = {y: 0, pitch: 0, pivotZ: 0, pivotY: 1.1, roll: 0, fl: 0, fr: 0, bl: 0, br: 0, hp: e.hp, hy: 0, ht: 0, hdrop: 0, earUp: e.earUp, earBack: 0, tailUp: e.tailUp, wag: Math.sin(t * e.wagHz * Math.PI * 2) * e.wagAmp};
	const breathe = Math.sin(t * 2.4) * 0.025;
	switch (pose) {
		case 'stand':
			r.y = breathe;
			r.hp += Math.sin(t * 1.3) * 0.03;
			break;
		case 'sit':
			r.pivotZ = -0.78;
			r.pitch = -0.6;
			r.y = -0.85 + breathe;
			r.fl = 0.6;
			r.fr = 0.6 - paw * 1.9;
			r.bl = -1.0;
			r.br = -1.0;
			r.hp += 0.48 + Math.sin(t * 1.3) * 0.03;
			break;
		case 'walk': {
			const ph = t * sp * Math.PI * 2 * 1.7;
			r.fl = Math.sin(ph) * 0.45;
			r.br = Math.sin(ph) * 0.45;
			r.fr = Math.sin(ph + Math.PI) * 0.45;
			r.bl = Math.sin(ph + Math.PI) * 0.45;
			r.y = Math.abs(Math.sin(ph)) * 0.08;
			r.hp += Math.sin(ph * 2) * 0.03;
			break;
		}
		case 'sniff': {
			const ph = t * sp * Math.PI * 2 * 1.2;
			r.fl = Math.sin(ph) * 0.35;
			r.br = Math.sin(ph) * 0.35;
			r.fr = Math.sin(ph + Math.PI) * 0.35;
			r.bl = Math.sin(ph + Math.PI) * 0.35;
			r.pivotZ = -0.78;
			r.pitch = 0.12;
			r.fl += 0.0;
			r.y = -0.05 + Math.abs(Math.sin(ph)) * 0.05;
			r.hp = 0.75 + Math.sin(t * Math.PI * 2 * 3.2) * 0.12;
			r.hdrop = 0.25;
			r.earBack = 0.15;
			break;
		}
		case 'run': {
			const ph = t * sp * Math.PI * 2 * 2.3;
			r.fl = Math.sin(ph) * 0.95;
			r.fr = Math.sin(ph + 0.55) * 0.95;
			r.bl = Math.sin(ph + Math.PI) * 0.95;
			r.br = Math.sin(ph + Math.PI + 0.55) * 0.95;
			r.y = 0.12 + Math.abs(Math.sin(ph)) * 0.32;
			r.pitch = Math.sin(ph + Math.PI / 2) * 0.12;
			r.pivotZ = 0;
			r.pivotY = 1.5;
			r.hp += -0.1 + Math.sin(ph * 2) * 0.05;
			r.earBack = 0.65 + Math.sin(ph * 2) * 0.25;
			r.earUp = Math.max(r.earUp, 0.75);
			r.tailUp = 1.45;
			r.wag = Math.sin(t * 9) * 0.25;
			break;
		}
		case 'jump': {
			const period = 0.9;
			const s = ((t * sp) % period) / period;
			r.y = 4 * s * (1 - s) * 1.7;
			const air = Math.sin(s * Math.PI);
			r.fl = -0.9 * air;
			r.fr = -0.9 * air;
			r.bl = 0.9 * air;
			r.br = 0.9 * air;
			r.pivotY = 1.5;
			r.pitch = lerp(-0.25, 0.2, s);
			r.earUp = 0.6 + 0.4 * air;
			r.hp += -0.1;
			break;
		}
		case 'lie':
		case 'sleep':
			r.y = -0.78 + breathe * (pose === 'sleep' ? 2 : 1);
			r.fl = -1.5;
			r.fr = -1.5;
			r.bl = 1.45;
			r.br = 1.45;
			if (pose === 'sleep') {
				r.hp += 0.42;
				r.hdrop = 0.55;
				r.ht = 0.18;
				r.earUp = 0.02;
				r.wag = Math.sin(t * 1.0) * 0.06;
				r.tailUp = 0.1;
			}
			break;
		case 'roll':
			r.roll = Math.PI + Math.sin(t * 5) * 0.12;
			r.fl = Math.sin(t * 11) * 0.5 - 0.3;
			r.fr = Math.sin(t * 11 + 1.6) * 0.5 - 0.3;
			r.bl = Math.sin(t * 10 + 0.8) * 0.45 + 0.3;
			r.br = Math.sin(t * 10 + 2.4) * 0.45 + 0.3;
			r.wag = Math.sin(t * 22) * 0.7;
			break;
	}
	if (emo === 'happy' || emo === 'love') {
		r.earUp += Math.sin(t * 8) * 0.12;
		r.ht += Math.sin(t * 2.1) * 0.12;
	}
	if (emo === 'shocked') {
		r.earUp += Math.sin(t * 40) * 0.04;
	}
	return r;
};

/* ---------- Emotion overlays ---------- */

const Sprite: React.FC<{tex: THREE.Texture; position: V3; size: number | [number, number]; opacity?: number; rotation?: number; additive?: boolean; color?: string}> = ({tex, position, size, opacity = 1, rotation = 0, additive, color = '#ffffff'}) => {
	const s = typeof size === 'number' ? [size, size] : size;
	return (
		<sprite position={position} scale={[s[0], s[1], 1]}>
			<spriteMaterial map={tex} transparent opacity={clamp(opacity)} rotation={rotation} depthWrite={false} color={color} blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending} />
		</sprite>
	);
};

const FacePlane: React.FC<{pos: V3; w: number; h: number; tex: THREE.Texture; rot?: number; opacity?: number; glow?: number}> = ({pos, w, h, tex, rot = 0, opacity = 1, glow = 0.4}) => (
	<mesh position={pos} rotation={[0, 0, rot]} geometry={planeGeo(w, h)} renderOrder={3}>
		<meshStandardMaterial map={tex} transparent opacity={opacity} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={glow} roughness={0.7} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
	</mesh>
);

const Overlays: React.FC<{emo: DogEmotion; t: number; k: number; lid: number}> = ({emo, t, k, lid}) => {
	const L = FACE.layout;
	const els: React.ReactNode[] = [];
	const eyeW = 0.62;
	const eyeH = 0.3;
	if (lid > 0.02) {
		[L.eyeL, L.eyeR].forEach((e, i) => {
			const p = fp(e[0], e[1] - 0.012, 0.01);
			els.push(<FacePlane key={`lid${i}`} pos={[p[0], p[1] + 0.02, p[2]]} w={eyeW * (i ? 0.9 : 1)} h={eyeH} tex={lidTex(lid)} glow={0.35} />);
		});
	}
	if (emo === 'brave' || emo === 'sad') {
		const sgn = emo === 'brave' ? 1 : -1;
		[L.browL, L.browR].forEach((b, i) => {
			const side = i === 0 ? -1 : 1;
			const p = fp(b[0] + side * -0.02, b[1] + 0.035, 0.012);
			els.push(<FacePlane key={`brow${i}`} pos={p} w={0.62} h={0.17} tex={browTex()} rot={side * sgn * 0.38} glow={0.1} />);
		});
	}
	if (emo === 'happy' || emo === 'love' || emo === 'proud') {
		[L.cheekL, L.cheekR].forEach((c, i) => {
			const p = fp(c[0] + (i ? -0.04 : 0.06), c[1] - 0.04, 0.012);
			els.push(<FacePlane key={`blush${i}`} pos={p} w={0.5} h={0.25} tex={blushTex()} opacity={0.85 * k} glow={0.6} />);
		});
	}
	if (emo === 'happy' || emo === 'love') {
		// Floating hearts rising from the head.
		for (let i = 0; i < 5; i++) {
			const ph = (t * 0.55 + i / 5) % 1;
			const x = (rnd(`hx${i}`) - 0.5) * 2.6 + Math.sin(t * 2 + i) * 0.15;
			const s = 0.32 + rnd(`hs${i}`) * 0.18;
			els.push(<Sprite key={`h${i}`} tex={heartTex()} position={[x, 0.9 + ph * 1.9, 0.4]} size={s * (0.6 + Math.min(1, ph * 4) * 0.4)} opacity={k * Math.min(1, (1 - ph) * 3) * Math.min(1, ph * 6)} />);
		}
	}
	if (emo === 'proud') {
		for (let i = 0; i < 6; i++) {
			const a = (i / 6) * Math.PI * 2 + 0.4;
			const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
			els.push(<Sprite key={`sp${i}`} tex={sparkleTex()} position={[Math.cos(a) * 1.55, 0.25 + Math.sin(a) * 1.25, 0.5]} size={0.28 + tw * 0.38} opacity={k * (0.45 + tw * 0.55)} rotation={t * 1.5 + i} additive />);
		}
	}
	if (emo === 'sleepy') {
		for (let i = 0; i < 3; i++) {
			const ph = (t * 0.42 + i / 3) % 1;
			els.push(<Sprite key={`z${i}`} tex={zTex()} position={[0.9 + ph * 0.8, 0.8 + ph * 1.6, 0.4]} size={0.25 + ph * 0.4} opacity={k * Math.min(1, ph * 5) * Math.min(1, (1 - ph) * 3)} rotation={-0.2 + Math.sin(t * 2 + i) * 0.2} />);
		}
	}
	if (emo === 'shocked') {
		[L.eyeL, L.eyeR].forEach((e, i) => {
			const p = fp(e[0] + (i ? -0.015 : 0.02), e[1] - 0.01, 0.014);
			els.push(<FacePlane key={`se${i}`} pos={p} w={0.42} h={0.42} tex={shockEyeTex()} opacity={k} glow={0.55} />);
		});
		const jolt = Math.sin(t * 30) * 0.03;
		els.push(<Sprite key="bang" tex={bangTex()} position={[1.15 + jolt, 1.35, 0.4]} size={[0.42, 0.52]} opacity={k} />);
		const drip = (t * 0.6) % 1;
		els.push(<Sprite key="sweat" tex={dropTex('#7fd6ff')} position={[-1.08, 0.55 - drip * 0.35, 0.75]} size={[0.24, 0.36]} opacity={k * Math.min(1, (1 - drip) * 4)} />);
	}
	if (emo === 'sad') {
		[L.eyeL, L.eyeR].forEach((e, i) => {
			for (let j = 0; j < 2; j++) {
				const ph = (t * 0.7 + j * 0.5 + i * 0.27) % 1;
				const p = fp(e[0] + (i ? -0.06 : 0.07), e[1] + 0.06 + ph * 0.32, 0.02);
				els.push(<FacePlane key={`tear${i}${j}`} pos={p} w={0.13} h={0.19} tex={dropTex('#8fdcff')} opacity={k * Math.min(1, ph * 6) * Math.min(1, (1 - ph) * 4)} glow={0.9} />);
			}
		});
	}
	if (emo === 'happy' && lid < 0.02) {
		// little happy squint arcs
		[L.eyeL, L.eyeR].forEach((e, i) => {
			const p = fp(e[0], e[1] - 0.01, 0.013);
			els.push(<FacePlane key={`he${i}`} pos={p} w={0.58} h={0.29} tex={happyEyeTex()} opacity={k} glow={0.4} />);
		});
	}
	return <>{els}</>;
};

/* ---------- Parts ---------- */

const Leg: React.FC<{pos: V3; rot: number; front?: boolean}> = ({pos, rot}) => (
	<group position={pos} rotation={[rot, 0, 0]}>
		<mesh geometry={rboxGeo(0.5, 1.0, 0.5, 0.1)} material={furM()} position={[0, -0.45, 0]} castShadow receiveShadow />
		<mesh geometry={rboxGeo(0.56, 0.3, 0.62, 0.1)} material={creamM()} position={[0, -0.97, 0.04]} castShadow receiveShadow />
	</group>
);

const Ear: React.FC<{side: -1 | 1; up: number; back: number}> = ({side, up, back}) => {
	const a = 0.12 + clamp(up, -0.2, 1.3) * 1.05;
	return (
		<group position={[side * (HW / 2 - 0.12), HH / 2 - 0.05, -0.15]} rotation={[-back, 0, side * a]}>
			<mesh geometry={rboxGeo(0.62, 1.0, 0.18, 0.07)} material={furDarkM()} position={[side * 0.12, -0.42, 0]} rotation={[0, 0, side * 0.12]} castShadow />
			<mesh geometry={rboxGeo(0.44, 0.7, 0.05, 0.02)} material={plastic(bright(FACE.colors.furDark, 0.85), {rough: 0.8})} position={[side * 0.12, -0.42, 0.09]} rotation={[0, 0, side * 0.12]} />
		</group>
	);
};

const TopHat: React.FC = () => {
	const black = plastic('#16161c', {rough: 0.3, clearcoat: 0.6});
	return (
		<group position={[0.15, HH / 2 + 0.02, -0.05]} rotation={[0, 0, -0.14]}>
			<Cyl r={0.66} h={0.07} mat={black} position={[0, 0.035, 0]} seg={32} />
			<Cyl r={0.43} r2={0.46} h={0.82} mat={black} position={[0, 0.45, 0]} seg={32} />
			<Cyl r={0.47} h={0.15} color="#d6202f" position={[0, 0.16, 0]} seg={32} />
		</group>
	);
};

/* QA: warn when the caption box (centre ~62% down the screen) would cover the dog's face. */
const CAP = {y0: 0.555, y1: 0.685, x0: 0.24, x1: 0.76};
const useCaptionCheck = (ref: React.RefObject<THREE.Mesh | null>) => {
	const camera = useThree((s) => s.camera);
	useLayoutEffect(() => {
		const m = ref.current;
		if ((window as unknown as {__dbg?: number}).__dbg === undefined) {
			(window as unknown as {__dbg?: number}).__dbg = 1;
			console.log('CAPTION_CHECK active', !!m);
		}
		if (!m) return;
		m.updateWorldMatrix(true, false);
		camera.updateMatrixWorld();
		let x0 = 1;
		let x1 = 0;
		let y0 = 1;
		let y1 = 0;
		let front = false;
		for (const [u, v] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42], [0, -0.45], [0, 0]]) {
			const q = new THREE.Vector3(u * FACE_W, v * FACE_H, 0).applyMatrix4(m.matrixWorld).project(camera);
			if (q.z < 1) front = true;
			const sx = (q.x + 1) / 2;
			const sy = (1 - q.y) / 2;
			x0 = Math.min(x0, sx);
			x1 = Math.max(x1, sx);
			y0 = Math.min(y0, sy);
			y1 = Math.max(y1, sy);
		}
		const onScreen = front && x1 > 0 && x0 < 1 && y1 > 0 && y0 < 1;
		const facing = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld).dot(new THREE.Vector3().subVectors(camera.position, new THREE.Vector3().setFromMatrixPosition(m.matrixWorld)).normalize());
		if (onScreen && facing > 0.2 && y1 > CAP.y0 && y0 < CAP.y1 && x1 > CAP.x0 && x0 < CAP.x1) {
			const g = (window as unknown as {__gt?: number}).__gt;
			console.log(`FACE_UNDER_CAPTION gt=${g?.toFixed(2)} face_y=${y0.toFixed(2)}-${y1.toFixed(2)} x=${x0.toFixed(2)}-${x1.toFixed(2)}`);
		}
	});
};

export const Dog: React.FC<DogProps> = (p) => {
	const faceRef = useRef<THREE.Mesh>(null);
	useCaptionCheck(faceRef);
	const t = p.t;
	const pose = p.pose ?? 'stand';
	const emo = p.emotion ?? 'normal';
	const sp = p.speed ?? 1;
	const r = rigFor(pose, emo, t, sp, p.paw ?? 0);
	const k = p.fx ?? 1;
	const lid = p.lid ?? (emo === 'sleepy' ? (pose === 'sleep' ? 1 : 0.62 + Math.sin(t * 1.3) * 0.12) : 0);
	const faceTex = getDogFace();
	const wag = r.wag * (p.wagBoost ?? 1);
	const sash = p.sash ?? true;
	const bowtie = p.bowtie ?? true;
	const hat = p.hat ?? true;
	const collar = p.collar ?? true;
	const rolled = pose === 'roll';

	const head = (
		<group>
			{/* Head: orange block with cream cheeks/jaw like the image */}
			<mesh geometry={rboxGeo(HW, HH, HD, 0.16)} material={furM()} castShadow receiveShadow />
			<mesh geometry={rboxGeo(HW + 0.01, HH * 0.42, HD * 0.62, 0.12)} material={creamM()} position={[0, -HH * 0.29, HD * 0.2]} castShadow receiveShadow />
			{faceTex ? (
				<mesh ref={faceRef} geometry={planeGeo(FACE_W, FACE_H)} position={[0, 0, FACE_Z]} renderOrder={2}>
					<meshStandardMaterial map={faceTex} transparent alphaTest={0.02} emissiveMap={faceTex} emissive="#ffffff" emissiveIntensity={p.faceGlow ?? 0.42} roughness={0.75} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
				</mesh>
			) : null}
			<Ear side={-1} up={r.earUp} back={r.earBack} />
			<Ear side={1} up={r.earUp} back={r.earBack} />
			{hat ? <TopHat /> : null}
			{(p.lick ?? 0) > 0.01 ? (
				<mesh position={fp(FACE.layout.mouth[0] + 0.12, FACE.layout.mouth[1] + 0.02 + (p.lick ?? 0) * 0.12, 0.05)} rotation={[-0.5 * (p.lick ?? 0), 0, 0]} geometry={planeGeo(0.32, 0.48 * (p.lick ?? 0) + 0.05)} material={litTex(tongueTex(), 0.5)} renderOrder={4} />
			) : null}
			{p.mouthItem ? <group position={fp(FACE.layout.mouth[0] + 0.1, FACE.layout.mouth[1] + 0.05, 0.25)}>{p.mouthItem}</group> : null}
			{p.overlays === false ? null : <Overlays emo={emo} t={t} k={k} lid={lid} />}
		</group>
	);

	// Head pivot sits at the neck (front-top of the body). Head centre is offset up/forward from it.
	const headPivot: V3 = [0, 2.02 - r.hdrop, 1.0];
	const headGroup = (
		<group position={headPivot} rotation={[r.hp + (p.headPitch ?? 0), r.hy + (p.headYaw ?? 0), r.ht + (p.headTilt ?? 0)]}>
			<group position={[0, 0.78, 0.42]}>{head}</group>
		</group>
	);

	const sashM = plastic('#d81e2c', {rough: 0.45, clearcoat: 0.3});
	const sashTex = textTex('MAYOR', {w: 512, h: 128, bg: '#d81e2c', color: '#ffe27a', weight: 800, stroke: '#7a0a12', strokeW: 10});

	const body = (
		<group>
			{/* torso */}
			<mesh geometry={rboxGeo(1.5, 1.15, 2.35, 0.16)} material={furM()} position={[0, 1.55, 0]} castShadow receiveShadow />
			<mesh geometry={rboxGeo(0.9, 0.75, 0.08, 0.03)} material={creamM()} position={[0, 1.45, 1.17]} />
			<mesh geometry={rboxGeo(1.2, 0.08, 1.9, 0.03)} material={creamM()} position={[0, 0.96, 0.05]} />
			{/* neck */}
			<mesh geometry={rboxGeo(1.05, 0.7, 0.9, 0.14)} material={furM()} position={[0, 1.95, 0.95]} castShadow />
			{collar ? (
				<>
					<mesh geometry={rboxGeo(1.16, 0.17, 1.0, 0.07)} material={plastic('#2952c8', {rough: 0.35, clearcoat: 0.4})} position={[0, 1.78, 0.97]} castShadow />
					<Cyl r={0.11} h={0.04} color="#ffcc33" mat={plastic('#ffcc33', {metal: 0.8, rough: 0.25})} position={[0, 1.62, 1.49]} rotation={[Math.PI / 2, 0, 0]} />
				</>
			) : null}
			{bowtie ? (
				<group position={[0, 1.83, 1.5]}>
					<mesh geometry={rboxGeo(0.34, 0.3, 0.12, 0.05)} material={plastic('#1a1a22', {rough: 0.3, clearcoat: 0.5})} position={[-0.2, 0, 0]} rotation={[0, 0, 0.25]} castShadow />
					<mesh geometry={rboxGeo(0.34, 0.3, 0.12, 0.05)} material={plastic('#1a1a22', {rough: 0.3, clearcoat: 0.5})} position={[0.2, 0, 0]} rotation={[0, 0, -0.25]} castShadow />
					<mesh geometry={rboxGeo(0.14, 0.16, 0.16, 0.04)} material={plastic('#2a2a34', {rough: 0.3})} />
				</group>
			) : null}
			{p.medal ? (
				<group position={[0, 1.42, 1.56]}>
					<Box s={[0.1, 0.32, 0.03]} color="#2a62d8" position={[-0.06, 0.18, -0.02]} rotation={[0, 0, 0.2]} />
					<Box s={[0.1, 0.32, 0.03]} color="#e8303a" position={[0.06, 0.18, -0.02]} rotation={[0, 0, -0.2]} />
					<mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
						<cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
						<meshStandardMaterial color="#ffc935" metalness={0.85} roughness={0.22} emissive="#6a4a00" emissiveIntensity={0.4} />
					</mesh>
					<mesh position={[0, 0, 0.03]} geometry={planeGeo(0.3, 0.3)} material={unlit('#ffffff', {map: sparkleTex(), transparent: true, opacity: 0.8})} />
				</group>
			) : null}
			{sash ? (
				<group position={[0, 1.55, 0.45]} rotation={[-0.42, 0, 0]}>
					<mesh geometry={rboxGeo(1.6, 0.06, 0.42, 0.02)} material={sashM} position={[0, 0.6, 0]} />
					<mesh geometry={rboxGeo(1.6, 0.06, 0.42, 0.02)} material={sashM} position={[0, -0.6, 0]} />
					<mesh geometry={rboxGeo(0.06, 1.25, 0.42, 0.02)} material={sashM} position={[0.79, 0, 0]} />
					<mesh geometry={rboxGeo(0.06, 1.25, 0.42, 0.02)} material={sashM} position={[-0.79, 0, 0]} />
					<mesh geometry={planeGeo(1.15, 0.29)} material={litTex(sashTex, 0.35)} position={[0.825, 0, 0]} rotation={[0, Math.PI / 2, Math.PI / 2]} />
					<mesh geometry={planeGeo(1.15, 0.29)} material={litTex(sashTex, 0.35)} position={[-0.825, 0, 0]} rotation={[0, -Math.PI / 2, -Math.PI / 2]} />
				</group>
			) : null}
			{/* legs */}
			<Leg pos={[-0.46, 1.1, 0.78]} rot={r.fl} front />
			<Leg pos={[0.46, 1.1, 0.78]} rot={r.fr} front />
			<Leg pos={[-0.46, 1.1, -0.78]} rot={r.bl} />
			<Leg pos={[0.46, 1.1, -0.78]} rot={r.br} />
			{/* tail */}
			<group position={[0, 1.95, -1.12]} rotation={[-r.tailUp, wag, 0]}>
				<mesh geometry={rboxGeo(0.26, 0.26, 0.6, 0.08)} material={furM()} position={[0, 0, -0.3]} castShadow />
				<group position={[0, 0, -0.55]} rotation={[0.25, wag * 0.6, 0]}>
					<mesh geometry={rboxGeo(0.24, 0.24, 0.42, 0.08)} material={creamM()} position={[0, 0, -0.2]} castShadow />
				</group>
			</group>
			{rolled ? null : headGroup}
		</group>
	);

	// Pose transform: rotate the body about a pivot (rear hip for sitting).
	const pz = r.pivotZ;
	const py = r.pivotY;
	return (
		<group position={p.position} rotation={[0, p.yaw ?? 0, 0]} scale={p.scale ?? 1}>
			{rolled ? (
				<>
					<group position={[0, 0.62, 0]} rotation={[0, 0, r.roll + (p.bodyRoll ?? 0)]}>
						<group position={[0, -1.55, 0]}>{body}</group>
					</group>
					<group position={[0, 0.98, 1.62]} rotation={[-1.05 + (p.headPitch ?? 0), p.headYaw ?? 0, 0.25 * Math.sin(t * 3) + (p.headTilt ?? 0)]}>
						{head}
					</group>
				</>
			) : (
				<group position={[0, r.y + py, pz]} rotation={[r.pitch, 0, r.roll + (p.bodyRoll ?? 0)]}>
					<group position={[0, -py, -pz]}>{body}</group>
				</group>
			)}
		</group>
	);
};
