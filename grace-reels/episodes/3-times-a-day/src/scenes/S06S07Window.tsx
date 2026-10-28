import React from 'react';
import * as THREE from 'three';
import {Figure} from '../../../../src/shared/three/Figure';
import {Dust, Glow, LightShaft} from '../../../../src/shared/three/fx';
import {Sky} from '../../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {clamp, ease, lerp, smoothstep} from '../../../../src/shared/math';
import {useShot, type Cam, type Vec3} from '../../../../src/shared/three/shot';
import {STREET_Y, UpperRoom, WIN} from '../sets/UpperRoom';
import {DANIEL_MID, DANIEL_OLD, DANIEL_YOUNG, OFFICIALS, P} from '../cast';
import {goldRoom, mood} from '../moods';
import {sunAt} from '../../../../src/shared/sun';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import {tOf} from '../timeline';
import {Ceiling, KNEEL_AT, SUN_AZ, SUN_EL} from './S01Window';
import type {Look, Pose} from '../../../../src/shared/rig/paperdoll';

// A light shaft through the window that follows the live sun direction.
export const LiveBeam: React.FC<{k?: number}> = ({k = 1}) => {
	const shot = useShot();
	const tr = shot.sunDir.clone().multiplyScalar(-1);
	const c = new THREE.Vector3(WIN.x, (WIN.sill + WIN.rectTop) / 2, WIN.z - 0.2);
	const s = c.y / Math.max(-tr.y, 0.08);
	const pool: Vec3 = [c.x + tr.x * s, 0.01, c.z + tr.z * s];
	const from: Vec3 = [c.x - tr.x * 2.2, c.y - tr.y * 2.2, c.z - tr.z * 2.2];
	return (
		<>
			<LightShaft from={from} to={pool} r0={0.55} r1={0.95} opacity={0.16 * k} color="#FFD58A" />
			<Glow at={[pool[0], 0.05, pool[2]]} size={[2.2, 0.9]} color="#FFC870" opacity={0.32 * k} />
			<Dust box={[[WIN.x - 0.7, 0.15, WIN.z + 0.2], [WIN.x + 1.2, 2.5, 0.2]]} count={150} size={0.022} opacity={0.7 * k} color="#FFE7B0" speed={0.35} />
		</>
	);
};

// Jerusalem catching the light on the far horizon
const JerusalemGlow: React.FC<{k?: number}> = ({k = 1}) => <Glow at={[44, STREET_Y + 84, -690]} size={[260, 110]} color="#FFD28A" opacity={0.6 * k} />;

// ---------- S6: the window ----------
const cutsS6 = () => ({out: tOf('S6', 'times') - 0.25, street: tOf('S6', 'and', 1) + 0.15, back: tOf('S6', 'thanks') + 0.25});
const WALK_END = 1.05;
const OPEN0 = 1.0;
const OPEN1 = 1.55;
const KNEEL0 = 1.55;
const KNEEL1 = 2.6;

const danielS6 = (t: number): {at: Vec3; pose: Pose} => {
	const w = ease.inOut(clamp(t / WALK_END));
	const at: Vec3 = [lerp(2.4, KNEEL_AT[0] + 0.1, w), 0, lerp(-1.3, KNEEL_AT[2] - 0.12, w)];
	if (t < OPEN0) return {at, pose: {...P.walk(t * 7.5), stride: Math.sin(t * 7.5) * 0.55 * (1 - smoothstep(0.75, WALK_END, t))}};
	if (t < KNEEL0) {
		const reach = Math.sin(clamp((t - OPEN0) / (OPEN1 - OPEN0)) * Math.PI);
		return {at, pose: {...P.stand, lean: 0.06 * reach, near: {sh: lerp(0.2, 1.45, reach), el: lerp(0.2, 0.35, reach), hand: 'flat'}, far: {sh: lerp(0.1, 1.35, reach), el: 0.35, hand: 'flat'}, gaze: [0.4, -0.1]}};
	}
	const k = ease.inOut(clamp((t - KNEEL0) / (KNEEL1 - KNEEL0)));
	const pray = P.pray;
	return {
		at,
		pose: {...pray, kneel: k, eyes: k > 0.7 ? 'closed' : 'open', near: {...pray.near!, sh: lerp(0.15, pray.near!.sh, k), el: lerp(0.3, pray.near!.el, k)}, far: {...pray.far!, sh: lerp(0.1, pray.far!.sh, k), el: lerp(0.3, pray.far!.el, k)}, breath: Math.sin(t * 1.5) * 0.5 + 0.5},
	};
};

const S6Content: React.FC<{t: number; d: number}> = ({t}) => {
	const c = cutsS6();
	const open = ease.inOut(clamp((t - OPEN0) / (OPEN1 - OPEN0)));
	const dn = danielS6(t);
	if (t >= c.street && t < c.back) {
		// the street below: two spies look up at the open window
		const tt = t - c.street;
		return (
			<>
				<Sky />
				<SunLight target={[0.5, STREET_Y, -6]} extent={10} dist={40} fill={0.85} />
				<Atmosphere near={20} far={160} />
				<UpperRoom open={1} season={1} />
				<Glow at={[WIN.x, 1.3, WIN.z - 0.5]} size={1.7} color="#FFC870" opacity={0.55} />
				<Figure look={OFFICIALS[1]} pose={{...P.courtStand, eyes: 'narrow', headTilt: -0.32, gaze: [0.3, -0.8], brow: {inner: 6, outer: -2}}} at={[-0.1, STREET_Y, -7.0]} facing={1} res={1100} />
				<Figure look={OFFICIALS[2]} pose={{...P.whisper, headTilt: -0.24, near: {sh: 2.3, el: 0.25, hand: 'point'}, lean: 0.04 + 0.03 * Math.sin(tt * 3), gaze: [0.5, -0.7]}} at={[0.95, STREET_Y, -7.6]} facing={1} res={1100} />
			</>
		);
	}
	return (
		<>
			<Sky />
			<SunLight target={[KNEEL_AT[0], 0.8, KNEEL_AT[2]]} extent={6} dist={30} mapSize={2048} fill={0.75} />
			{t >= c.out ? <Atmosphere near={60} far={2600} color={new THREE.Color('#FFE6B8')} mix={0.25} /> : <Atmosphere near={6} far={60} color={new THREE.Color('#FFE6B8')} mix={0.7} />}
			<UpperRoom open={open} season={1} />
			<Ceiling />
			<LiveBeam k={open} />
			{/* before the shutters open: thin light through the slats */}
			{open < 0.95 ? [0.25, 0.65, 1.05].map((y, i) => <LightShaft key={i} from={[WIN.x - 0.4 + i * 0.4, WIN.sill + y, WIN.z - 1]} to={[WIN.x + 0.5 + i * 0.3, 0.02, WIN.z + 2.2]} r0={0.02} r1={0.06} opacity={0.18 * (1 - open)} color="#FFD58A" />) : null}
			<JerusalemGlow k={t >= c.out ? 0.5 : 0.4} />
			<Figure look={DANIEL_OLD} pose={dn.pose} at={dn.at} facing={-1} res={1800} />
		</>
	);
};

const camS6 = (t: number, d: number): Cam => {
	const c = cutsS6();
	if (t < c.out) {
		// track left with Daniel to the window, the action low in frame under the card
		const k = ease.inOut(clamp(t / 1.4));
		return {pos: [lerp(3.3, 1.35, k), lerp(2.6, 2.5, k), lerp(2.5, 2.7, k)], target: [lerp(2.1, 0.7, k), lerp(2.05, 1.65, k), lerp(-1.4, -2.0, k)], fov: 52};
	}
	if (t < c.street) {
		// behind him and low, out through the window: Jerusalem sits on the far hills just in
		// front of his face (a high eye would only see the street below the window)
		const k = (t - c.out) / (c.street - c.out);
		return {pos: [-0.05, lerp(0.95, 0.93, k), lerp(2.15, 1.9, k)], target: [1.42, 1.58, -10], fov: 40};
	}
	if (t < c.back) {
		const k = (t - c.street) / (c.back - c.street);
		return {pos: [lerp(-1.6, -1.4, k), STREET_Y + 1.3, lerp(-12.6, -12.1, k)], target: [0.6, STREET_Y + 4.4, -3.2], fov: 52};
	}
	const k = ease.out(clamp((t - c.back) / (d - c.back)));
	return {pos: [lerp(-1.75, -1.5, k), lerp(3.0, 2.85, k), lerp(2.0, 1.6, k)], target: [KNEEL_AT[0] - 0.05, lerp(1.95, 1.9, k), KNEEL_AT[2] - 0.35], fov: 48};
};

export const S06: SceneDef = {
	id: 'S6',
	sunAz: SUN_AZ,
	mood: () => ({...goldRoom(), elevationDeg: SUN_EL, hemiIntensity: 0.8}),
	camera: camS6,
	post: (t, d, sun) => {
		const c = cutsS6();
		const inStreet = t >= c.street && t < c.back;
		return {
			bloom: {intensity: 1.05, threshold: 0.74},
			dof: inStreet ? {focusDistance: 8.5, focusRange: 5, bokehScale: 2.2} : t >= c.out && t < c.street ? {focusDistance: 2.6, focusRange: 1.4, bokehScale: 0.8} : {focusDistance: 4.6, focusRange: 2.4, bokehScale: 2.4},
			vignette: {offset: 0.26, darkness: 0.6},
			grade: gradeFromSun(sun, {contrast: 1.06, warmth: inStreet ? 0.12 : 0.32, saturation: inStreet ? 0.9 : 1.1, exposure: inStreet ? 0.98 : 1.08}),
		};
	},
	Content: S6Content,
	anchors: (t) => ({daniel: [danielS6(t).at[0], 1.45, danielS6(t).at[2]]}),
};

// ---------- S7: as he did aforetime — a locked-off time-lapse at the same window ----------
const DAY = 0.62;
export const AGE_CUTS = [1.9, 3.8];
const ageLook = (t: number): Look => (t < AGE_CUTS[0] ? DANIEL_YOUNG : t < AGE_CUTS[1] ? DANIEL_MID : DANIEL_OLD);
const dayPhase = (t: number) => (t % DAY) / DAY;

const S7Content: React.FC<{t: number; d: number}> = ({t}) => {
	const season = (t / AGE_CUTS[0]) * 2 + 0.2;
	return (
		<>
			<Sky />
			<SunLight target={[KNEEL_AT[0], 0.8, KNEEL_AT[2]]} extent={6} dist={30} mapSize={2048} fill={0.75} />
			<Atmosphere near={6} far={60} color={new THREE.Color('#FFE6B8')} mix={0.55} />
			<UpperRoom open={1} season={season} />
			<Ceiling />
			<LiveBeam k={1} />
			<Figure look={ageLook(t)} pose={{...P.pray, breath: Math.sin(t * 3) * 0.5 + 0.5}} at={KNEEL_AT} facing={-1} res={1700} />
		</>
	);
};

export const S07: SceneDef = {
	id: 'S7',
	sunAz: (t) => lerp(150, 236, dayPhase(t)),
	mood: (t) => {
		const ph = dayPhase(t);
		const el = 8 + 44 * Math.sin(Math.PI * ph);
		// colour from the shared sun: high sun = midday, low = golden
		return mood(sunAt(lerp(0.75, 0.2, Math.sin(Math.PI * ph))), {elevationDeg: el, hemiIntensity: 0.8, lightIntensity: 2.4});
	},
	camera: () => ({pos: [2.75, 2.25, 1.75], target: [0.35, 1.45, -2.2], fov: 50}),
	post: (t, d, sun) => ({
		bloom: {intensity: 1.0, threshold: 0.74},
		dof: {focusDistance: 4.2, focusRange: 2.4, bokehScale: 2.2},
		vignette: {offset: 0.26, darkness: 0.6},
		grade: gradeFromSun(sun, {contrast: 1.05, exposure: 1.06}),
	}),
	Content: S7Content,
	anchors: () => ({daniel: [KNEEL_AT[0], 1.45, KNEEL_AT[2]]}),
};
