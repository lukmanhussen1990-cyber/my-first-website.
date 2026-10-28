// S6 "So God hid him in a clift of the rock… and covered him while His glory passed by" and S7 "Moses
// only saw His back". Outside: Moses pressed into the cleft, trembling; a soft shadow covers the opening.
// Inside: the roaring river of light rushes past the opening. Then, over his shoulder, he peeks out at
// trails of light fading far away. God is never shown: only light and shade.
import {Actor} from '../characters/Actor';
import {easeInOut, easeOut, lerp, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {screenPoint} from '../render/camera';
import type {CamState, Grade, ShotDef, Vec3} from '../render/types';
import {Dust} from '../world/atmosphere';
import * as THREE from 'three';
import {cached} from '../world/cache';
import {CLEFT_X, CleftWorld, CoveringShadow, creviceGeometry, LightRiver, LightTrails} from '../world/Cleft';

const mix3 = (a: Vec3, b: Vec3, m: number): Vec3 => [lerp(a[0], b[0], m), lerp(a[1], b[1], m), lerp(a[2], b[2], m)];
const rainBox = (cam: CamState): {center: Vec3; size: Vec3} => ({center: mix3(cam.pos, cam.target, 0.4), size: [8, 8, 8]});
const stormGrade = (g: Partial<Grade> = {}): Partial<Grade> => ({
	exposure: 1.0,
	contrast: 1.14,
	saturation: 0.95,
	gain: [0.93, 0.97, 1.08],
	vignette: 0.6,
	bloom: 0.7,
	bloomThreshold: 0.82,
	grain: 0.022,
	...g,
});
const fog = () => ({color: '#1b2238', near: 30, far: 380});

// how close the glory is: it approaches during S6, rushes past, and is gone
const glowAt = (t: number) => 0.12 + 0.5 * smooth(seg(t, B.s6 + 0.5, B.gloryRush)) + 1.2 * smooth(seg(t, B.gloryRush, B.gloryPeak)) * (1 - smooth(seg(t, B.gloryPeak + 0.3, B.gloryGone + 0.6)));
const coverAt = (t: number) => smooth(seg(t, B.cover, B.cover + 0.45)) * (1 - smooth(seg(t, B.gloryGone - 0.1, B.gloryGone + 0.45)));

// ---------------- outside: pressed into the clift, trembling ----------------
// his back pressed into the crack, arms out, palms flat on the rock either side
const MOSES_IN: Vec3 = [CLEFT_X - 0.3, 0, -0.55];
const cliftCam = (t: number): CamState => {
	const p = easeInOut(seg(t, B.s6 - 0.2, B.inside + 0.2));
	return {pos: mix3([CLEFT_X - 1.5, 2.2, 6.8], [CLEFT_X - 0.7, 1.75, 4.9], p), target: [CLEFT_X - 0.05, 1.45, -0.5], fov: 34, drift: 0.7};
};
const CliftContent: React.FC<{t: number; lite: boolean}> = ({t}) => {
	const glow = glowAt(t);
	const tremble = 2.2 * Math.sin(t * 47) + 1.2 * Math.sin(t * 71 + 1);
	return (
		<>
			<CleftWorld t={t} look={{glow, hole: 0.35, rain: 1, storm: 1}} rainBox={rainBox(cliftCam(t))} />
			<Actor
				position={MOSES_IN}
				t={t}
				poses={[[-10, 'moses/press']]}
				yaw={-0.1}
				look={{tint: '#aab4d6', grad: {dir: [1, 0.2], color: '#ffd894', amount: 0.25 + 0.35 * glow, soft: 0.4}, rimLight: 0.3 + 0.4 * glow, rimColor: '#ffe7aa', rimDir: [1, 0.3]}}
				warp={{lean: tremble, breath: 0.012 * Math.sin(t * 9)}}
				blinkSeed={11}
				renderOrder={10}
			/>
			<CoveringShadow position={[CLEFT_X, 1.4, 0.45]} size={[5, 5.5]} cover={coverAt(t)} leak={0.3 + 0.7 * glow} />
		</>
	);
};
export const CLIFT: ShotDef = {
	id: 'CLIFT',
	start: B.s6 - 0.3,
	end: B.inside + 0.3,
	Content: CliftContent,
	camera: cliftCam,
	grade: (t) => stormGrade({exposure: 1.0 + 0.1 * glowAt(t), bloom: 0.7 + 0.3 * glowAt(t)}),
	fog,
	anchors: () => ({cleft: [CLEFT_X + 0.5, 1.25, -0.05]}),
};

// ---------------- inside: the river of light rushes past the opening ----------------
const insideCam = (t: number): CamState => {
	const p = seg(t, B.inside - 0.2, B.s7 + 0.2);
	return {
		pos: [CLEFT_X - 0.05, 1.15, lerp(-4.1, -3.7, p)],
		target: [CLEFT_X, 1.6, 3],
		fov: 48,
		drift: 0.9,
		shake: 0.5 * smooth(seg(t, B.gloryRush, B.gloryPeak)) * (1 - seg(t, B.gloryPeak, B.gloryGone)),
	};
};
const InsideContent: React.FC<{t: number; lite: boolean}> = ({t}) => {
	const river = smooth(seg(t, B.gloryRush - 0.1, B.gloryRush + 0.3)) * (1 - smooth(seg(t, B.gloryPeak + 0.2, B.gloryGone + 0.3)));
	return (
		<>
			<CleftWorld t={t} look={{glow: 0.3 + glowAt(t), hole: 0.2, rain: 0.4, storm: 0.8}} glowFrom={[CLEFT_X, 1.6, 6]} face={false} />
			<mesh geometry={creviceGeometry()} material={cached('creviceMat', () => new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true, side: THREE.DoubleSide}))} />
			<pointLight position={[CLEFT_X, 1.4, 0.3]} color="#ffdc9c" intensity={10 * river + 0.6} distance={7} decay={1.4} />
			<LightRiver position={[CLEFT_X, 1.6, 2.6]} size={[22, 7]} t={t} intensity={0.9 * river} />
			<LightRiver position={[CLEFT_X, 2.2, 4.5]} size={[30, 10]} t={t + 2} intensity={0.5 * river} />
			<Dust count={80} center={[CLEFT_X, 1.6, 0.4]} size={[3, 3, 2]} t={t * 3} color="#ffe2a8" px={4} rise={0.05} seed={41} swirl={6} opacity={river} />
			<CoveringShadow position={[CLEFT_X, 1.4, 0.2]} size={[2.2, 3.4]} cover={coverAt(t) * 0.85} leak={0.4 + 0.8 * river} />
			{/* Moses between us and the opening, his back to us: a dark shape with the light around his edges */}
			<Actor
				position={[CLEFT_X + 0.3, 0, -0.85]}
				t={t}
				poses={[[-10, 'moses/press']]}
				yaw={Math.PI}
				look={{sil: 1, silColor: '#120e0c', rim: 1.4 * river + 0.35, rimColor: '#ffe7aa', rimDir: [0.2, 1], depthTest: false}}
				warp={{lean: 1.6 * Math.sin(t * 47)}}
				renderOrder={920}
			/>
		</>
	);
};
export const INSIDE: ShotDef = {
	id: 'INSIDE',
	start: B.inside - 0.3,
	end: B.s7 + 0.3,
	Content: InsideContent,
	camera: insideCam,
	grade: (t) => {
		const r = smooth(seg(t, B.gloryRush, B.gloryPeak)) * (1 - smooth(seg(t, B.gloryPeak + 0.2, B.gloryGone)));
		return stormGrade({exposure: 1.0 + 0.1 * r, bloom: 0.65 + 0.3 * r, bloomThreshold: 0.85, vignette: 0.75, gain: [1.02, 0.98, 0.94]});
	},
	fog,
	anchors: () => ({cleft: [CLEFT_X, 2.2, 0.0]}),
};

// ---------------- over his shoulder: trails of light fading far away ----------------
// he leans out of the right edge of the crack; we look past him along the cliff to the open sky
const PEEK_POS: Vec3 = [CLEFT_X + 0.2, 0, -0.25];
const backCam = (t: number): CamState => {
	const p = easeOut(seg(t, B.s7 - 0.2, B.dawn + 0.3));
	return {pos: mix3([CLEFT_X - 1.75, 1.2, 1.25], [CLEFT_X - 1.5, 1.25, 1.05], p), target: [CLEFT_X + 4.5, 2.7, -0.6], fov: 50, drift: 0.6};
};
// laid out on screen (x, y in -1..1 and distance) from the shot's camera, so they sweep up the sky
// to the right of Moses and vanish into the clouds
const TRAIL_SCREEN: [number, number, number][][] = [
	[[1.05, -0.12, 6], [0.72, 0.22, 16], [0.5, 0.44, 40], [0.4, 0.57, 100], [0.42, 0.64, 260]],
	[[1.1, 0.06, 7], [0.86, 0.36, 18], [0.66, 0.55, 45], [0.52, 0.64, 110], [0.47, 0.68, 280]],
	[[1.0, -0.32, 5.5], [0.62, 0.04, 14], [0.4, 0.3, 36], [0.32, 0.48, 90], [0.37, 0.6, 240]],
];
const trails = () => cached('backTrails', () => TRAIL_SCREEN.map((pts) => pts.map(([x, y, d]) => screenPoint(backCam(B.s7 + 1), B.s7 + 1, x, y, d))));
const trailsEndDir = (): Vec3 => {
	const c = backCam(B.s7 + 1);
	const e = screenPoint(c, B.s7 + 1, 0.42, 0.66, 300);
	const d: Vec3 = [e[0] - c.pos[0], e[1] - c.pos[1], e[2] - c.pos[2]];
	const l = Math.hypot(...d);
	return [d[0] / l, d[1] / l, d[2] / l];
};
const BackContent: React.FC<{t: number; lite: boolean}> = ({t}) => {
	const fade = 1 - smooth(seg(t, B.s7 + 0.8, B.dawn + 0.4));
	const head = 0.35 + 0.65 * easeOut(seg(t, B.s7 - 0.4, B.dawn + 0.2));
	return (
		<>
			<CleftWorld t={t} look={{glow: 0.15 + 0.5 * fade, hole: 0.04 + 0.1 * fade, rain: 0.25, storm: 0.9}} rainBox={rainBox(backCam(t))} glowFrom={[30, 10, -20]} holeDir={trailsEndDir()} holeSize={0.7} />
			<LightTrails curves={trails()} head={head} intensity={1.5 * fade} len={0.5} width={0.011} />
			<Actor
				position={PEEK_POS}
				t={t}
				poses={[[-10, 'moses/peek']]}
				yaw={-0.92}
				look={{tint: '#b9c2e0', grad: {dir: [1, 0.3], color: '#ffd894', amount: 0.45 * fade + 0.1, soft: 0.4}, rimLight: 0.6 * fade, rimColor: '#ffe7aa', rimDir: [1, 0.4]}}
				warp={{breath: 0.008 * Math.sin(t * 3.2)}}
				blinkSeed={13}
				renderOrder={10}
			/>
		</>
	);
};
export const BACK: ShotDef = {
	id: 'BACK',
	start: B.s7 - 0.3,
	end: B.dawn + 0.6,
	Content: BackContent,
	camera: backCam,
	grade: () => stormGrade({bloom: 0.8}),
	fog,
	// the label points at the trails of light, what he saw
	anchors: () => ({peek: screenPoint(backCam(B.s7 + 1), B.s7 + 1, 0.62, 0.3, 30)}),
};
