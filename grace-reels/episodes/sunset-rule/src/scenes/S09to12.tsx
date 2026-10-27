import React from 'react';
import * as THREE from 'three';
import {Figure} from '../../../../src/shared/three/Figure';
import {Coins, Table} from '../../../../src/shared/three/props';
import {Dust} from '../../../../src/shared/three/fx';
import {Sky, Clouds} from '../../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {clamp, ease, lerp, smoothstep} from '../../../../src/shared/math';
import {useShot, type Cam} from '../../../../src/shared/three/shot';
import {Street} from '../sets/Street';
import {HILL, HILL_GROUND, Land, landH} from '../sets/Land';
import {TempleCourt} from '../sets/Temple';
import {CROWD, JESUS, P} from '../cast';
import {coinBurst, flipAngle} from '../action';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import {blinkAt} from './S02to05Synagogue';

// ---------- S9: mocked, and calm (golden hour) ----------
const S9_SUN = 202;
const JX = 1.05;
const crowdPose = (i: number, t: number) => {
	const bob = Math.sin(t * 7 + i * 1.7);
	const base = [P.point, {...P.point, near: {sh: 0.5, el: 1.7, hand: 'relaxed' as const}}, {...P.armsFolded, eyes: 'happy' as const, headTilt: -0.12, brow: {inner: -4, outer: 2}}, {...P.point, near: {sh: 2.3, el: 1.2, hand: 'flat' as const}, eyes: 'open' as const}, {...P.point, near: {sh: 1.2, el: 0.6, hand: 'point' as const}, lean: 0.14}, {...P.point, near: {sh: 0.6, el: 1.9, hand: 'relaxed' as const}, far: {sh: 0.7, el: 1.8}}][i];
	return {...base, headTilt: (base.headTilt ?? 0) - 0.06 * Math.max(0, bob), shoulderLift: Math.max(0, bob), stride: 0};
};
const CROWD_AT: [number, number, number][] = [
	[-0.6, 0, 0.5],
	[-1.2, 0, -0.7],
	[-1.7, 0, 0.9],
	[-0.2, 0, -1.4],
	[-2.2, 0, -0.3],
	[-1.0, 0, 1.6],
];
const camS9 = (t: number, d: number): Cam => {
	const k = ease.inOut(clamp((t - 0.3) / (d - 0.6)));
	return {pos: [lerp(-1.0, 0.25, k), lerp(1.7, 1.72, k), lerp(8.2, 7.0, k)], target: [lerp(-1.1, 0.35, k), lerp(1.25, 1.45, k), 0], fov: lerp(40, 34, k)};
};
const S9Content: React.FC<{t: number; d: number}> = ({t}) => (
	<>
		<Sky />
		<Clouds clouds={[{az: 195, el: 7, size: 160, seed: 21}, {az: 215, el: 11, size: 120, seed: 4}, {az: 175, el: 5, size: 220, seed: 31}]} />
		<SunLight target={[0, 0, -2]} extent={16} dist={60} mapSize={2048} />
		<Atmosphere near={14} far={80} />
		<Street />
		{CROWD_AT.map((p, i) => (
			<Figure key={i} look={CROWD[i]} pose={crowdPose(i, t)} at={p} res={900} />
		))}
		<Figure look={JESUS} pose={{...P.calm, yaw: 0.8, blink: blinkAt(t + 0.5, 3.6), gaze: [0, 0.35]}} at={[JX, 0, 0]} facing={-1} res={1800} />
		<Dust box={[[-4, 0.2, -4], [4, 3, 3]]} count={120} size={0.04} opacity={0.5} />
	</>
);
export const S09: SceneDef = {
	id: 'S9',
	sunAz: S9_SUN,
	camera: camS9,
	post: (t, d, sun) => {
		const c = camS9(t, d);
		const focus = Math.hypot(c.pos[0] - c.target[0], c.pos[2] - c.target[2]);
		return {bloom: {intensity: 0.75, threshold: 0.8}, dof: {focusDistance: focus, focusRange: 2.6, bokehScale: 2.6}, vignette: {offset: 0.28, darkness: 0.55}, grade: gradeFromSun(sun, {contrast: 1.05})};
	},
	Content: S9Content,
	anchors: () => ({jesus: [JX, 2.15, 0]}),
};

// ---------- S10: the cross on a far hill, the sun low behind it ----------
export const LAND_SUN = 181;
const camS10 = (t: number, d: number): Cam => {
	const k = ease.inOut(t / d);
	const x = lerp(3.2, 2.2, k);
	const z = lerp(78, 70, k);
	const y = landH(x, z) + 1.8;
	return {pos: [x, y, z], target: [HILL[0] + 0.4, HILL_GROUND + 3.6 + lerp(1.2, 0.6, k), HILL[2]], fov: 21, far: 4000};
};
const LandBase: React.FC<{cross?: boolean}> = ({cross = true}) => (
	<>
		<Sky />
		<Clouds clouds={[{az: 172, el: 6, size: 420, seed: 7, dist: 1500}, {az: 196, el: 9, size: 300, seed: 13, dist: 1500}, {az: 160, el: 13, size: 260, seed: 24, dist: 1500}, {az: 205, el: 4, size: 500, seed: 3, dist: 1500}]} />
		<SunLight target={[0, 0, -60]} extent={120} dist={300} mapSize={2048} />
		<Atmosphere near={140} far={2600} />
		<Land cross={cross} />
	</>
);
export const S10: SceneDef = {
	id: 'S10',
	sunAz: LAND_SUN,
	camera: camS10,
	post: (t, d, sun) => ({bloom: {intensity: 1.0, threshold: 0.75}, vignette: {offset: 0.28, darkness: 0.5}, grade: gradeFromSun(sun, {contrast: 1.04})}),
	Content: () => <LandBase />,
};

// ---------- S11: split screen ----------
// left: the table going over again (warm red), right: the far cross (gold)
const S11LContent: React.FC<{t: number; d: number}> = ({t}) => {
	const shot = useShot();
	const tau = 0.25 + t * 0.32;
	const flip = flipAngle(tau, 0.1);
	const coins = coinBurst(tau, 11, [0.95, 0.84, 1.25], 50, 0.32);
	const glint = shot.sunDir.clone().add(new THREE.Vector3(0, 0.4, 1)).normalize();
	return (
		<>
			<Sky />
			<SunLight target={[0, 0, -2]} extent={16} dist={60} />
			<Atmosphere near={18} far={110} />
			<TempleCourt />
			<group position={[0.95, 0, 1.67]} rotation={[0, -0.75, 0]}>
				<group rotation={[flip, 0, 0]}>
					<Table seed={4} position={[0, 0, -0.42]} />
				</group>
			</group>
			<Coins coins={coins} glint={glint} />
			<Figure look={JESUS} pose={{...P.whipLow, yaw: 0.6}} at={[0, 0, 0]} res={1400} />
			<Dust box={[[-3, 0.2, -3], [3, 3, 3]]} count={90} size={0.035} opacity={0.5} />
		</>
	);
};
export const S11L: SceneDef = {
	id: 'S11L',
	sunAz: 232,
	camera: (t, d) => ({pos: [lerp(0.35, 0.3, t / d), 1.25, lerp(5.6, 5.1, t / d)], target: [0.55, 0.95, 0.7], fov: 56}),
	post: (t, d, sun) => ({bloom: {intensity: 0.7, threshold: 0.8}, dof: {focusDistance: 5, focusRange: 2.5, bokehScale: 2.5}, vignette: {offset: 0.3, darkness: 0.6}, grade: gradeFromSun(sun, {tint: '#E0563C', tintAmt: 0.55, saturation: 0.9, contrast: 1.1})}),
	Content: S11LContent,
};
export const S11R: SceneDef = {
	id: 'S11R',
	sunAz: LAND_SUN,
	camera: (t, d) => {
		const c = camS10(5.4, 5.42);
		return {...c, fov: 30, target: [c.target[0], c.target[1] + 1.2, c.target[2]]};
	},
	post: (t, d, sun) => ({bloom: {intensity: 1.0, threshold: 0.75}, vignette: {offset: 0.3, darkness: 0.55}, grade: gradeFromSun(sun, {tint: '#F2B544', tintAmt: 0.45, contrast: 1.05})}),
	Content: () => <LandBase />,
};

// ---------- S12: the deadline, a giant pull-back over the land at sunset ----------
const camS12 = (t: number, d: number): Cam => {
	const k = ease.inOut(clamp(t / (d - 0.2)));
	const z = lerp(40, 560, k);
	const y = lerp(22, 175, Math.pow(k, 0.85));
	// keep the far horizon low in frame (under the full-screen card), sun sitting on it
	const tz = lerp(-60, -900, k);
	const ty = lerp(14, y + Math.tan(THREE.MathUtils.degToRad(5.6)) * (z - tz), smoothstep(0.1, 0.6, k));
	return {pos: [lerp(4, 0, k), y, z], target: [lerp(1, 0, k), ty, tz], fov: lerp(34, 40, k), far: 5000};
};
export const S12: SceneDef = {
	id: 'S12',
	sunAz: LAND_SUN,
	camera: camS12,
	post: (t, d, sun) => ({bloom: {intensity: 1.1, threshold: 0.72}, vignette: {offset: 0.28, darkness: 0.55}, grade: gradeFromSun(sun, {contrast: 1.05})}),
	Content: () => <LandBase />,
};

void smoothstep;
void Dust;
