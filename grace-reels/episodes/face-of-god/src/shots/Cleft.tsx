// S6 "So God hid him in a clift of the rock… and covered him while His glory passed by" and S7 "Moses
// only saw His back". Outside: Moses pressed into the cleft, trembling; a soft shadow covers the opening.
// Inside: the roaring river of light rushes past the opening. Then he peeks out at trails of light
// fading far away. God is never shown: only light and shade.
import {Actor} from '../characters/Actor';
import {easeInOut, easeOut, lerp, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import type {CamState, Grade, ShotDef, Vec3} from '../render/types';
import {Dust} from '../world/atmosphere';
import * as THREE from 'three';
import {cached} from '../world/cache';
import {CLEFT_D, CLEFT_X, CleftWorld, CoveringShadow, creviceGeometry, LightRiver, LightTrails} from '../world/Cleft';

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
const MOSES_IN: Vec3 = [CLEFT_X, 0, -CLEFT_D + 0.42];
const cliftCam = (t: number): CamState => {
	const p = easeInOut(seg(t, B.s6 - 0.2, B.inside + 0.2));
	return {pos: mix3([CLEFT_X + 0.55, 1.75, 4.8], [CLEFT_X + 0.12, 1.6, 2.95], p), target: [CLEFT_X, 1.62, -0.6], fov: 40, drift: 0.7};
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
	anchors: () => ({cleft: [CLEFT_X, 2.35, 0.05]}),
};

// ---------------- inside: the river of light rushes past the opening ----------------
const insideCam = (t: number): CamState => {
	const p = seg(t, B.inside - 0.2, B.s7 + 0.2);
	return {pos: [CLEFT_X + 0.02, 1.35, lerp(-3.9, -3.5, p)], target: [CLEFT_X, 1.25, 3], fov: 50, drift: 0.9, shake: 0.5 * smooth(seg(t, B.gloryRush, B.gloryPeak)) * (1 - seg(t, B.gloryPeak, B.gloryGone))};
};
const InsideContent: React.FC<{t: number; lite: boolean}> = ({t}) => {
	const glow = glowAt(t);
	const river = smooth(seg(t, B.gloryRush - 0.1, B.gloryRush + 0.3)) * (1 - smooth(seg(t, B.gloryPeak + 0.2, B.gloryGone + 0.3)));
	return (
		<>
			<CleftWorld t={t} look={{glow: 0.3 + glow, hole: 0.2, rain: 0.4, storm: 0.8}} glowFrom={[CLEFT_X, 1.6, 6]} face={false} />
			<mesh geometry={creviceGeometry()} material={cached('creviceMat', () => new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true, side: THREE.DoubleSide}))} />
			<pointLight position={[CLEFT_X, 1.4, 0.6]} color="#ffdc9c" intensity={14 * river + 0.6} distance={7} decay={1.4} />
			<LightRiver position={[CLEFT_X, 1.6, 2.6]} size={[22, 7]} t={t} intensity={2.4 * river} />
			<LightRiver position={[CLEFT_X, 2.2, 4.5]} size={[30, 10]} t={t + 2} intensity={1.2 * river} />
			<Dust count={80} center={[CLEFT_X, 1.6, 1.4]} size={[3, 3, 2]} t={t * 3} color="#ffe2a8" px={4} rise={0.05} seed={41} swirl={6} opacity={river} />
			<CoveringShadow position={[CLEFT_X, 1.4, 0.2]} size={[2.2, 3.4]} cover={coverAt(t) * 0.85} leak={0.4 + 0.8 * river} />
			<Actor
				position={[CLEFT_X + 0.12, 0, -1.1]}
				t={t}
				poses={[[-10, 'moses/press']]}
				facing={-1}
				look={{sil: 1, silColor: '#120e0c', rim: 1.6 * river + 0.3, rimColor: '#ffe7aa', rimDir: [0.2, 1]}}
				warp={{lean: 1.6 * Math.sin(t * 47)}}
				renderOrder={20}
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
		return stormGrade({exposure: 1.0 + 0.25 * r, bloom: 0.8 + 0.6 * r, bloomThreshold: 0.75, vignette: 0.75, gain: [1.02, 0.98, 0.94]});
	},
	fog,
	anchors: () => ({cleft: [CLEFT_X, 2.2, 0.0]}),
};

// ---------------- he peeks out: trails of light fading far away ----------------
const TRAILS: Vec3[][] = [
	[[6, 2.5, -2], [16, 9, -14], [34, 26, -46], [60, 52, -110], [90, 80, -200]],
	[[7, 1.8, -1], [19, 7, -12], [40, 21, -42], [70, 44, -100], [110, 70, -190]],
	[[5, 3.2, -3], [14, 12, -16], [28, 32, -50], [48, 60, -120], [70, 95, -220]],
];
const PEEK_POS: Vec3 = [CLEFT_X + 0.12, 0, -0.32];
const backCam = (t: number): CamState => {
	const p = easeOut(seg(t, B.s7 - 0.2, B.dawn + 0.3));
	return {pos: mix3([CLEFT_X - 1.8, 1.35, 3.2], [CLEFT_X - 1.5, 1.4, 2.7], p), target: [CLEFT_X + 2.2, 2.0, -1.6], fov: 46, drift: 0.7};
};
const BackContent: React.FC<{t: number; lite: boolean}> = ({t}) => {
	const fade = 1 - smooth(seg(t, B.s7 + 0.6, B.dawn + 0.4));
	const head = 0.5 + 0.5 * easeOut(seg(t, B.s7 - 0.4, B.dawn + 0.4));
	return (
		<>
			<CleftWorld t={t} look={{glow: 0.15 + 0.6 * fade, hole: 0.06, rain: 0.25, storm: 0.9}} rainBox={rainBox(backCam(t))} glowFrom={[30, 10, -20]} />
			<LightTrails curves={TRAILS} head={head} intensity={1.6 * fade} />
			<Actor
				position={PEEK_POS}
				t={t}
				poses={[[-10, 'moses/peek']]}
				yaw={Math.atan2(-2.2, 3.7)}
				look={{tint: '#b9c2e0', grad: {dir: [1, 0.3], color: '#ffd894', amount: 0.5 * fade + 0.1, soft: 0.4}, rimLight: 0.6 * fade, rimColor: '#ffe7aa', rimDir: [1, 0.4]}}
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
	grade: () => stormGrade({bloom: 0.75}),
	fog,
	anchors: () => ({peek: [PEEK_POS[0] + 0.32, 1.62, PEEK_POS[2]]}),
};
