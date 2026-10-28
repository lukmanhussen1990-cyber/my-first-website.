import React from 'react';
import * as THREE from 'three';
import {Figure} from '../../../../src/shared/three/Figure';
import {Dust, Glow} from '../../../../src/shared/three/fx';
import {Sky} from '../../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {clamp, ease, lerp, smoothstep} from '../../../../src/shared/math';
import {useShot, type Cam, type Vec3} from '../../../../src/shared/three/shot';
import {UpperRoom, WIN} from '../sets/UpperRoom';
import {Living} from '../sets/Living';
import {QuietRoom, TABLE_AT} from '../sets/QuietRoom';
import {MODERN, P} from '../cast';
import {evening, goldRoom, mixMood, mood, morning, night, noon, warmRoom} from '../moods';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import {tOf} from '../timeline';
import {Beam, Ceiling, DanielAtWindow, KNEEL_AT, MATCH, SUN_AZ, SUN_EL} from './S01Window';
import {FACE_AT, PHONE_AT, Scroller} from './S02Sofa';
import type {Pose} from '../../../../src/shared/rig/paperdoll';

// ---------- S8: split screen. Gold light on the left, blue on the right ----------
export const S08L: SceneDef = {
	id: 'S8L',
	sunAz: SUN_AZ,
	mood: () => ({...goldRoom(), elevationDeg: SUN_EL, hemiIntensity: 0.8}),
	camera: (t, d) => {
		const k = ease.inOut(clamp(t / d));
		return {pos: [lerp(-1.7, -1.5, k), 1.9, lerp(1.6, 1.3, k)], target: [KNEEL_AT[0], 1.35, KNEEL_AT[2] - 0.2], fov: 50};
	},
	post: (t, d, sun) => ({bloom: {intensity: 1.1, threshold: 0.72}, vignette: {offset: 0.24, darkness: 0.62}, grade: gradeFromSun(sun, {warmth: 0.36, exposure: 1.1})}),
	Content: ({t}) => (
		<>
			<Sky />
			<SunLight target={[KNEEL_AT[0], 0.8, KNEEL_AT[2]]} extent={6} dist={30} fill={0.75} />
			<Atmosphere near={6} far={60} color={new THREE.Color('#FFE6B8')} mix={0.7} />
			<UpperRoom open={1} season={1} />
			<Ceiling />
			<Beam />
			<DanielAtWindow t={t} res={1500} />
		</>
	),
};
export const S08R: SceneDef = {
	id: 'S8R',
	sunAz: 200,
	mood: () => night(),
	camera: (t, d) => {
		const k = ease.inOut(clamp(t / d));
		return {pos: [lerp(1.75, 1.55, k), 1.5, lerp(1.35, 1.15, k)], target: [FACE_AT[0] - 0.02, lerp(1.32, 1.36, k), FACE_AT[2] - 0.05], fov: 44};
	},
	post: (t, d, sun) => ({bloom: {intensity: 1.2, threshold: 0.6}, vignette: {offset: 0.24, darkness: 0.7}, grade: gradeFromSun(sun, {contrast: 1.08, warmth: -0.35, exposure: 1.08})}),
	Content: ({t}) => (
		<>
			<SunLight target={[0, 0, -1]} extent={6} dist={20} fill={0.8} />
			<Atmosphere near={12} far={70} />
			<Living />
			<Scroller t={t} res={1500} />
		</>
	),
	anchors: () => ({phone: [PHONE_AT[0] + 0.02, PHONE_AT[1] + 0.04, PHONE_AT[2]], eye: [FACE_AT[0] + 0.1, FACE_AT[1] + 0.04, FACE_AT[2]]}),
};

// ---------- S9: into the quiet room, the door shuts ----------
const WALK_IN = 1.5;
const SHUT0 = 1.55;
const SHUT1 = 2.35;
const person9 = (t: number): {at: Vec3; pose: Pose; facing: 1 | -1} => {
	const w = ease.out(clamp(t / WALK_IN));
	const at: Vec3 = [lerp(4.5, 2.65, w), 0, lerp(-0.25, -0.35, w)];
	const phone: Pose = {near: {sh: 0.55, el: 1.25, hand: 'fist'}, far: {sh: 0.45, el: 1.3, hand: 'fist'}, hold: {item: 'phone', lift: -0.2}, headTilt: 0.2};
	if (t < WALK_IN) return {at, facing: -1, pose: {...phone, stride: Math.sin(t * 7) * 0.5 * (1 - smoothstep(1.0, WALK_IN, t)), sway: Math.sin(t * 7) * 0.3}};
	if (t < SHUT1 + 0.2) {
		// turn back to the door and push it shut with the free hand
		const k = Math.sin(clamp((t - SHUT0) / (SHUT1 + 0.2 - SHUT0)) * Math.PI);
		return {at, facing: 1, pose: {...phone, far: {sh: lerp(0.4, 1.45, k), el: lerp(1.2, 0.15, k), hand: 'flat'}, lean: 0.06 * k}};
	}
	// a pause, a deep breath, eyes on the phone
	const breath = smoothstep(SHUT1 + 0.5, SHUT1 + 1.3, t) * (1 - smoothstep(SHUT1 + 1.6, SHUT1 + 2.3, t));
	return {at, facing: -1, pose: {...phone, shoulderLift: breath, headTilt: 0.2 - breath * 0.25, eyes: breath > 0.5 ? 'closed' : 'open'}};
};

const PhoneGlow: React.FC<{at: Vec3; k: number}> = ({at, k}) => (
	<>
		<pointLight position={[at[0], at[1] + 0.05, at[2] + 0.2]} color="#7FB0FF" intensity={1.4 * k} distance={2.2} decay={1.8} />
		<Glow at={at} size={0.18} color="#CFE2FF" opacity={0.6 * k} />
	</>
);

export const S09: SceneDef = {
	id: 'S9',
	sunAz: 200,
	mood: () => mood(night(), {hemiIntensity: 0.4}),
	camera: (t, d) => {
		const k = ease.inOut(clamp(t / d));
		return {pos: [lerp(-0.4, 0.1, k), 1.95, lerp(2.9, 2.6, k)], target: [lerp(3.0, 2.8, k), 1.75, -0.35], fov: 52};
	},
	post: (t, d, sun) => ({bloom: {intensity: 1.0, threshold: 0.65}, dof: {focusDistance: 3.6, focusRange: 2.2, bokehScale: 2.2}, vignette: {offset: 0.26, darkness: 0.66}, grade: gradeFromSun(sun, {warmth: -0.2, exposure: 1.1})}),
	Content: ({t}) => {
		const p = person9(t);
		const door = 1 - ease.inOut(clamp((t - SHUT0) / (SHUT1 - SHUT0)));
		return (
			<>
				<SunLight target={[1, 0, -1]} extent={7} dist={20} fill={0.8} />
				<Atmosphere near={12} far={70} />
				<QuietRoom door={door} />
				<pointLight position={[4.9, 2.0, -0.2]} color="#FFC890" intensity={5 * door} distance={6} decay={1.4} />
				<Glow at={[3.7, 1.2, -0.2]} size={[0.8, 2.0]} color="#FFC890" opacity={0.35 * door} />
				<Figure look={MODERN} pose={p.pose} at={p.at} facing={p.facing} res={1500} tint={new THREE.Color('#8C9CC4')} />
				<PhoneGlow at={[p.at[0] + p.facing * 0.3, 1.05, p.at[2] + 0.05]} k={1} />
			</>
		);
	},
};

// ---------- S10: phone down; the room warms; kneel; match cut to Daniel ----------
export const cutsS10 = () => ({wide: 1.25, match: 2.68});
const DOWN_T = 0.72; // the phone touches the table
const person10 = (t: number): Pose => {
	if (t < 1.25) {
		const reach = Math.sin(clamp(t / 1.15) * Math.PI);
		return {lean: 0.22 * reach, near: {sh: lerp(0.55, 1.05, reach), el: lerp(1.25, 0.35, reach), hand: t < DOWN_T ? 'fist' : 'flat'}, far: {sh: 0.3, el: 0.6}, hold: t < DOWN_T ? {item: 'phone', lift: -0.6} : undefined, headTilt: 0.32, gaze: [0.4, 0.8]};
	}
	const k = ease.inOut(clamp((t - 1.3) / 1.15));
	return {...P.pray, kneel: k, eyes: k > 0.6 ? 'closed' : 'open', near: {...P.pray.near!, sh: lerp(0.2, P.pray.near!.sh, k), el: lerp(0.4, P.pray.near!.el, k)}, far: {...P.pray.far!, sh: lerp(0.15, P.pray.far!.sh, k), el: lerp(0.4, P.pray.far!.el, k)}, breath: Math.sin(t * 1.4) * 0.5 + 0.5};
};

export const S10: SceneDef = {
	id: 'S10',
	sunAz: SUN_AZ,
	mood: (t) => {
		const c = cutsS10();
		if (t >= c.match) return {...goldRoom(), elevationDeg: SUN_EL, hemiIntensity: 0.8};
		return mixMood(night(), warmRoom(), smoothstep(DOWN_T + 0.1, DOWN_T + 0.7, t));
	},
	camera: (t) => {
		const c = cutsS10();
		if (t < c.wide) {
			const k = ease.out(clamp(t / c.wide));
			return {pos: [lerp(1.05, 1.15, k), lerp(1.05, 1.0, k), lerp(0.7, 0.55, k)], target: [TABLE_AT[0] - 0.15, 0.86, TABLE_AT[2]], fov: 44};
		}
		return MATCH(0);
	},
	post: (t, d, sun) => {
		const c = cutsS10();
		return {
			bloom: {intensity: 1.05, threshold: 0.7},
			dof: t < c.wide ? {focusDistance: 2.6, focusRange: 1.0, bokehScale: 2.8} : {focusDistance: 5.6, focusRange: 2.4, bokehScale: 2.6},
			vignette: {offset: 0.25, darkness: 0.62},
			grade: gradeFromSun(sun, {contrast: 1.06, exposure: 1.1, warmth: t >= c.match ? 0.34 : lerp(-0.25, 0.3, smoothstep(DOWN_T, DOWN_T + 0.8, t))}),
		};
	},
	Content: ({t}) => {
		const c = cutsS10();
		if (t >= c.match) {
			return (
				<>
					<Sky />
					<SunLight target={[KNEEL_AT[0], 0.8, KNEEL_AT[2]]} extent={6} dist={30} fill={0.75} />
					<Atmosphere near={6} far={60} color={new THREE.Color('#FFE6B8')} mix={0.7} />
					<UpperRoom open={1} season={1} />
					<Ceiling />
					<Beam />
					<DanielAtWindow t={t + 3} />
				</>
			);
		}
		const warm = smoothstep(DOWN_T + 0.1, DOWN_T + 0.7, t);
		const glow = 1 - smoothstep(DOWN_T, DOWN_T + 0.45, t);
		const standAt: Vec3 = [TABLE_AT[0] - 0.55, 0, TABLE_AT[2] + 0.25];
		const kneelAt: Vec3 = t < c.wide ? standAt : [lerp(standAt[0], KNEEL_AT[0], ease.inOut(clamp((t - c.wide) / 0.5))), 0, lerp(standAt[2], KNEEL_AT[2], ease.inOut(clamp((t - c.wide) / 0.5)))];
		return (
			<>
				<SunLight target={[1, 0, -1]} extent={7} dist={20} fill={0.8} />
				<Atmosphere near={12} far={70} />
				<QuietRoom lamp={warm} />
				<Figure look={MODERN} pose={person10(t)} at={kneelAt} facing={t < c.wide ? 1 : -1} res={1600} tint={new THREE.Color('#8C9CC4').lerp(new THREE.Color('#F0D2B0'), warm)} />
				{/* the phone, face down on the table once it is placed; its light dies */}
				{t >= DOWN_T ? (
					<mesh position={[TABLE_AT[0] - 0.05, 0.652, TABLE_AT[2] + 0.06]} rotation={[0, 0.3, 0]} castShadow>
						<boxGeometry args={[0.16, 0.012, 0.075]} />
						<meshLambertMaterial color="#26222E" />
					</mesh>
				) : null}
				<PhoneGlow at={t < DOWN_T ? [standAt[0] + 0.42, lerp(1.02, 0.7, ease.in(clamp(t / DOWN_T))), standAt[2]] : [TABLE_AT[0] - 0.05, 0.64, TABLE_AT[2] + 0.06]} k={glow} />
				<Glow at={[TABLE_AT[0] + 0.16, 1.0, TABLE_AT[2] - 0.2]} size={0.7} color="#FFC27A" opacity={0.75 * warm} />
			</>
		);
	},
};

// ---------- S11: evening, and morning, and at noon — the sun at three points ----------
const SUN_POINTS = [
	{az: 197, el: 3.5, at: 0.0},
	{az: 164, el: 4, at: 2.0},
	{az: 181, el: 17, at: 4.0},
];
const sunKey = (t: number) => {
	const i = t < SUN_POINTS[1].at ? 0 : t < SUN_POINTS[2].at ? 1 : 2;
	if (i === 0) return {i, k: 0};
	const k = ease.inOut(clamp((t - SUN_POINTS[i].at + 0.55) / 0.55));
	return {i, k};
};
const sunState11 = (t: number) => {
	const {i, k} = sunKey(t);
	// morning: rosy gold; noon: clear blue
	const m = [evening(), mood(morning(), {zenith: new THREE.Color('#7FA6D6'), horizon: new THREE.Color('#FFC890'), glow: new THREE.Color('#FFB878')}), mood(noon(), {zenith: new THREE.Color('#3F86D8'), horizon: new THREE.Color('#CFE0EE')})];
	return i === 0 ? m[0] : mixMood(m[i - 1], m[i], k);
};
export const S11: SceneDef = {
	id: 'S11',
	sunAz: (t) => {
		const {i, k} = sunKey(t);
		return i === 0 ? SUN_POINTS[0].az : lerp(SUN_POINTS[i - 1].az, SUN_POINTS[i].az, k);
	},
	mood: (t) => {
		const {i, k} = sunKey(t);
		const el = i === 0 ? SUN_POINTS[0].el : lerp(SUN_POINTS[i - 1].el, SUN_POINTS[i].el, k);
		return {...sunState11(t), elevationDeg: el};
	},
	camera: (t, d) => {
		const k = ease.inOut(clamp(t / d));
		return {pos: [WIN.x + lerp(0.15, -0.15, k), 5.6, WIN.z - 0.6], target: [WIN.x, lerp(5.6 + 14, 5.6 + 15, k), -100], fov: 70, far: 3000};
	},
	post: (t, d, sun) => ({bloom: {intensity: 1.0, threshold: 0.76}, vignette: {offset: 0.3, darkness: 0.5}, grade: gradeFromSun(sun, {contrast: 1.1, saturation: sun.saturation * 1.15, exposure: sun.exposure * 0.94})}),
	Content: () => (
		<>
			<Sky />
			<SunLight target={[0, -3.5, -40]} extent={60} dist={200} fill={0.9} />
			<Atmosphere near={60} far={1400} />
			<UpperRoom open={1} season={1} />
		</>
	),
};

// ---------- S12: the same gold beam now falls on the modern person ----------
export const S12: SceneDef = {
	id: 'S12',
	sunAz: SUN_AZ,
	mood: () => mood(night(), {elevationDeg: SUN_EL, light: new THREE.Color('#FFCF86'), lightIntensity: 2.4, hemiIntensity: 0.55, warmth: 0.25, exposure: 0.95}),
	camera: (t, d) => MATCH(lerp(1.35, 0.25, ease.out(clamp(t / d)))),
	post: (t, d, sun) => ({bloom: {intensity: 1.2, threshold: 0.7}, dof: {focusDistance: 5.2, focusRange: 2.4, bokehScale: 2.6}, vignette: {offset: 0.24, darkness: 0.66}, grade: gradeFromSun(sun, {contrast: 1.06, warmth: 0.3, exposure: 1.1})}),
	Content: ({t}) => (
		<>
			<SunLight target={[KNEEL_AT[0], 0.8, KNEEL_AT[2]]} extent={6} dist={30} fill={0.7} />
			<Atmosphere near={12} far={70} />
			<QuietRoom lamp={0.5} />
			<Ceiling />
			<Beam pulse={0.3 + 0.2 * Math.sin(t * 2)} />
			<Figure look={MODERN} pose={{...P.pray, breath: Math.sin(t * 1.4) * 0.5 + 0.5}} at={KNEEL_AT} facing={-1} res={1700} tint={new THREE.Color('#F4DCBC')} />
		</>
	),
};

void useShot;
