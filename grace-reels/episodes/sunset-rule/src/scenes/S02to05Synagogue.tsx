import React from 'react';
import * as THREE from 'three';
import {Figure, WINDOWS} from '../../../../src/shared/three/Figure';
import {Card2D} from '../../../../src/shared/three/Card2D';
import {Dust, Glow, Sparks} from '../../../../src/shared/three/fx';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {drawBigHand, type Pose} from '../../../../src/shared/rig/paperdoll';
import {clamp, ease, lerp, rng, smoothstep} from '../../../../src/shared/math';
import type {Cam, Vec3} from '../../../../src/shared/three/shot';
import {Synagogue} from '../sets/Synagogue';
import {JESUS, MAN, P, WATCHERS} from '../cast';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import {wordTime} from '../timeline';

// S2 synagogue wide · S3 anger close-up · S4 grief (same face) · S5 the hand opens

const SUN_AZ = 168;
const JESUS_AT: Vec3 = [2.5, 0, 1.7];
const MAN_AT: Vec3 = [-1.5, 0, 0.9];
const HEAD_Y = 1.57;

// watchers: three on the side bench, two on the back bench
const SEATS: {at: Vec3; look: number; gaze: number}[] = [
	{at: [-4.6, 0, -4.25], look: 0, gaze: 0.9},
	{at: [-3.4, 0, -4.25], look: 2, gaze: 1},
	{at: [-2.2, 0, -4.25], look: 4, gaze: 0.8},
	{at: [-1.0, 0, -4.25], look: 1, gaze: 0.9},
	{at: [-5.85, 0, -1.6], look: 3, gaze: 1},
];

const Watchers: React.FC<{t: number; narrow?: number}> = ({t, narrow = 0.35}) => (
	<>
		{SEATS.map((s, i) => (
			<Figure
				key={i}
				look={WATCHERS[s.look]}
				pose={{...P.armsFolded, sit: true, gaze: [s.gaze, 0.1], lid: narrow + 0.05 * Math.sin(t * 1.3 + i), headTilt: 0.05 * Math.sin(i * 2.1), blink: blinkAt(t + i * 0.7)}}
				at={s.at}
				res={700}
			/>
		))}
	</>
);

export const blinkAt = (t: number, every = 3.1) => {
	const x = t % every;
	return x < 0.12 ? Math.sin((x / 0.12) * Math.PI) : 0;
};

const Base: React.FC<{beams?: number}> = ({beams = 1}) => (
	<>
		<SunLight target={[0, 0, -1]} extent={11} dist={50} mapSize={2048} fill={0.62} />
		<Atmosphere near={14} far={60} />
		<Synagogue beams={beams} />
		<Dust box={[[-6.5, 0.3, -4.5], [6.5, 5.5, 4]]} count={260} size={0.04} opacity={0.6} speed={0.6} />
	</>
);

// ---------- S2 ----------
const camS2 = (t: number, d: number): Cam => {
	const k = ease.inOut(t / d);
	return {pos: [lerp(3.4, 2.6, k), lerp(4.6, 4.2, k), lerp(12.8, 11.6, k)], target: [lerp(-0.9, -0.6, k), 1.15, -1.4], fov: 40};
};
const S2Content: React.FC<{t: number; d: number}> = ({t, d}) => {
	const walk = clamp(t / (d * 0.7));
	const jx = lerp(4.6, JESUS_AT[0], ease.out(walk));
	const stride = walk < 1 ? Math.sin(t * 5.2) * 0.55 : 0;
	return (
		<>
			<Base />
			<Watchers t={t} />
			<Figure look={MAN} pose={{...P.withered, blink: blinkAt(t + 1.1)}} at={MAN_AT} res={900} />
			<Figure look={JESUS} pose={{...P.stand, stride, yaw: 0.85, sway: stride * 0.4}} at={[jx, 0, JESUS_AT[2]]} facing={-1} res={1000} />
		</>
	);
};
export const S02: SceneDef = {
	id: 'S2',
	sunAz: SUN_AZ,
	camera: camS2,
	post: (t, d, sun) => ({
		bloom: {intensity: 0.7, threshold: 0.78},
		dof: {focusDistance: 12.5, focusRange: 8, bokehScale: 1.4},
		vignette: {offset: 0.28, darkness: 0.55},
		grade: gradeFromSun(sun, {contrast: 1.06}),
	}),
	Content: S2Content,
	anchors: () => ({watchers: [-2.8, 1.75, -4.25], man: [MAN_AT[0], 1.9, MAN_AT[2]]}),
};

// ---------- S3 / S4: the same face ----------
const faceCam = (k: number): Cam => {
	const dist = lerp(1.75, 1.18, k);
	return {pos: [JESUS_AT[0] - 0.55 * dist, HEAD_Y + 0.06, JESUS_AT[2] + 0.83 * dist], target: [JESUS_AT[0] + 0.02, HEAD_Y - 0.02, JESUS_AT[2]], fov: 30};
};
const FaceShot: React.FC<{pose: Pose; red: number; blue: number; t: number}> = ({pose, red, blue, t}) => (
	<>
		<Base beams={0.8} />
		<Watchers t={t} narrow={0.45} />
		<Figure look={MAN} pose={P.withered} at={MAN_AT} res={600} />
		<Figure look={JESUS} pose={{...pose, noArms: true}} at={JESUS_AT} facing={-1} win={WINDOWS.bust} res={2300} />
		<Glow at={[JESUS_AT[0] + 0.08, HEAD_Y - 0.02, JESUS_AT[2] - 0.25]} size={0.95 + red * 0.15} color="#C0392B" opacity={0.42 * red} />
		<Glow at={[JESUS_AT[0] - 0.08, HEAD_Y - 0.06, JESUS_AT[2] - 0.22]} size={1.0} color="#3D6FB4" opacity={0.5 * blue} />
	</>
);
const facePost = (sun: Parameters<SceneDef['post']>[2], dist: number) => ({
	bloom: {intensity: 0.8, threshold: 0.75},
	dof: {focusDistance: dist, focusRange: 0.5, bokehScale: 4},
	vignette: {offset: 0.25, darkness: 0.6},
	grade: gradeFromSun(sun, {contrast: 1.08}),
});

const S3Content: React.FC<{t: number; d: number}> = ({t, d}) => {
	const k = t / d;
	const anger = smoothstep(0.1, 0.9, t);
	// eyes sweep round the room: right -> left -> settle
	const gx = t < 0.8 ? 0.6 : t < 2.2 ? lerp(0.6, -0.8, ease.inOut((t - 0.8) / 1.4)) : lerp(-0.8, -0.2, ease.inOut((t - 2.2) / 1.0));
	return (
		<FaceShot
			t={t}
			red={0.4 + 0.6 * anger}
			blue={0}
			pose={{yaw: lerp(-0.42, -0.3, k), brow: {inner: 12 * anger, outer: -4 * anger}, lid: 0.32 * anger, gaze: [gx, 0], blink: blinkAt(t + 0.4, 2.6)}}
		/>
	);
};
export const S03: SceneDef = {
	id: 'S3',
	sunAz: SUN_AZ,
	camera: (t, d) => faceCam(0.35 * ease.inOut(t / d)),
	post: (t, d, sun) => facePost(sun, lerp(1.75, 1.18, 0.35 * ease.inOut(t / d))),
	Content: S3Content,
	anchors: () => ({face: [JESUS_AT[0] - 0.25, HEAD_Y + 0.18, JESUS_AT[2]]}),
};

const S4Content: React.FC<{t: number; d: number}> = ({t}) => {
	const grieve = smoothstep(0.1, 1.5, t);
	const tear = smoothstep(1.6, 2.8, t);
	const blue = smoothstep(0.4, 3.0, t);
	return (
		<FaceShot
			t={t}
			red={1 - 0.35 * blue}
			blue={blue}
			pose={{
				yaw: -0.3,
				brow: {inner: lerp(12, -15, grieve), outer: lerp(-4, 6, grieve)},
				lid: lerp(0.32, 0.18, grieve),
				gaze: [lerp(-0.2, -0.05, grieve), lerp(0, 0.45, grieve)],
				tear,
				blink: blinkAt(t + 1.3, 3.4),
				headTilt: 0.06 * grieve,
			}}
		/>
	);
};
export const S04: SceneDef = {
	id: 'S4',
	sunAz: SUN_AZ,
	camera: (t, d) => faceCam(0.35 + 0.65 * ease.inOut(t / d)),
	post: (t, d, sun) => facePost(sun, lerp(1.75, 1.18, 0.35 + 0.65 * ease.inOut(t / d))),
	Content: S4Content,
	anchors: () => ({face: [JESUS_AT[0] - 0.25, HEAD_Y + 0.18, JESUS_AT[2]]}),
};

// ---------- S5: "Stretch forth thine hand" ----------
const HAND_AT: Vec3 = [MAN_AT[0] + 0.5, 1.28, MAN_AT[2] + 0.35];
const camS5 = (t: number, d: number): Cam => {
	const out = smoothstep(d - 1.1, d - 0.1, t); // pull back to his joy at the end
	return {
		pos: [lerp(HAND_AT[0] + 0.25, HAND_AT[0] + 0.9, out), lerp(HAND_AT[1] + 0.05, 1.5, out), lerp(HAND_AT[2] + 1.05, HAND_AT[2] + 3.6, out)],
		target: [lerp(HAND_AT[0], MAN_AT[0] + 0.2, out), lerp(HAND_AT[1], 1.3, out), lerp(HAND_AT[2], MAN_AT[2], out)],
		fov: 32,
	};
};
const S5Content: React.FC<{t: number; d: number}> = ({t, d}) => {
	const open = ease.inOut(clamp((t - 0.35) / 1.5));
	const curl = 1 - open;
	const out = smoothstep(d - 1.1, d - 0.1, t);
	const r = rng(7);
	const sparks: Vec3[] = [];
	for (let i = 0; i < 70; i++) {
		const ph = (r() + t * (0.5 + r() * 0.4)) % 1;
		const sx = 1.8 + r() * 0.8;
		const sy = (r() - 0.5) * 0.6;
		const p = 1 - ph;
		sparks.push([HAND_AT[0] + sx * p * p + 0.05, HAND_AT[1] + sy * p + Math.sin(ph * 6 + i) * 0.03 * p, HAND_AT[2] + (r() - 0.5) * 0.3 * p]);
	}
	const glow = smoothstep(0.1, 1.2, t);
	return (
		<>
			<Base beams={0.9} />
			<Watchers t={t} narrow={0.2} />
			<Figure
				look={MAN}
				pose={out > 0 ? {near: {sh: 1.5, el: 0.1, hand: 'open'}, far: {sh: 0.3, el: 0.5}, eyes: 'wide', brow: {inner: -10, outer: -8}, gaze: [0.4, -0.1], headTilt: -0.05} : P.withered}
				at={MAN_AT}
				res={1200}
			/>
			<Figure look={JESUS} pose={{...P.heal, yaw: 0.8}} at={[JESUS_AT[0] - 0.6, 0, JESUS_AT[2] - 0.2]} facing={-1} res={900} />
			{out < 0.95 ? (
				<Card2D
					at={HAND_AT}
					size={[0.62, 0.42]}
					res={1400}
					draw={(g, w, h, light, k) => {
						const s = w / 1300;
						g.setTransform(s, 0, 0, s, w * 0.52, h * 0.5);
						drawBigHand(g, MAN.skin, MAN.robe, curl, {ol: 5 / (k * s), light});
					}}
				/>
			) : null}
			<Glow at={[HAND_AT[0] + 0.12, HAND_AT[1], HAND_AT[2] - 0.05]} size={0.35 + glow * 0.3} color="#FFD27A" opacity={0.45 * glow * (1 - out)} />
			<Sparks points={sparks} size={0.022} opacity={0.9 * (1 - out)} />
		</>
	);
};
export const S05: SceneDef = {
	id: 'S5',
	sunAz: SUN_AZ,
	camera: camS5,
	post: (t, d, sun) => ({
		bloom: {intensity: 0.7, threshold: 0.86},
		dof: {focusDistance: lerp(1.05, 3.6, smoothstep(d - 1.1, d - 0.1, t)), focusRange: 0.45, bokehScale: 4.5},
		vignette: {offset: 0.25, darkness: 0.55},
		grade: gradeFromSun(sun, {contrast: 1.05}),
	}),
	Content: S5Content,
	anchors: () => ({hand: [HAND_AT[0] - 0.15, HAND_AT[1] + 0.2, HAND_AT[2]]}),
};

void THREE;
void wordTime;
