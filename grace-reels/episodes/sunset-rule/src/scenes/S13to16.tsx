import React from 'react';
import * as THREE from 'three';
import {Figure} from '../../../../src/shared/three/Figure';
import {Dust, Glow} from '../../../../src/shared/three/fx';
import {Sky, Clouds} from '../../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {clamp, ease, lerp, smoothstep} from '../../../../src/shared/math';
import {useShot, type Cam} from '../../../../src/shared/three/shot';
import {Land} from '../sets/Land';
import {Room, WINDOW} from '../sets/Room';
import {MODERN} from '../cast';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import {LAND_SUN} from './S09to12';
import {blinkAt} from './S02to05Synagogue';

// ---------- S13 background: the land, sun on the horizon ----------
export const S13BG: SceneDef = {
	id: 'S13',
	sunAz: LAND_SUN,
	camera: (t, d) => ({pos: [0, 175 - t * 2, 560 + t * 4], target: [0, 60, -900], fov: 40, far: 5000}),
	post: (t, d, sun) => ({bloom: {intensity: 1.0, threshold: 0.72}, vignette: {offset: 0.2, darkness: 0.75}, grade: gradeFromSun(sun, {exposure: 0.72, saturation: 0.9})}),
	Content: () => (
		<>
			<Sky />
			<Clouds clouds={[{az: 172, el: 6, size: 420, seed: 7, dist: 1500}, {az: 196, el: 9, size: 300, seed: 13, dist: 1500}, {az: 205, el: 4, size: 500, seed: 3, dist: 1500}]} />
			<SunLight target={[0, 0, -60]} extent={120} dist={300} />
			<Atmosphere near={140} far={2600} />
			<Land />
		</>
	),
};

// ---------- S14: the room at dusk ----------
export const SEND_T = 2.15; // thumb presses send as the last sliver goes down
const PERSON: [number, number, number] = [-0.75, 0, -1.05];
const camS14 = (t: number, d: number): Cam => {
	const k = ease.inOut(t / d);
	return {pos: [lerp(1.35, 0.85, k), lerp(1.3, 1.22, k), lerp(3.3, 2.2, k)], target: [lerp(-0.12, -0.22, k), lerp(1.12, 1.05, k), -1.2], fov: lerp(48, 42, k)};
};
const S14Content: React.FC<{t: number; d: number}> = ({t}) => {
	const shot = useShot();
	const breath = smoothstep(0.9, 1.4, t) * (1 - smoothstep(1.7, 2.0, t));
	const press = smoothstep(SEND_T - 0.18, SEND_T, t);
	const warm = smoothstep(SEND_T, SEND_T + 0.7, t);
	// after "send" the phone drops to the lap: blend the arms, no pop
	const drop = smoothstep(SEND_T + 0.1, SEND_T + 0.65, t);
	const pose = {
		sit: true,
		near: {sh: lerp(0.95 - press * 0.06, 0.45, drop), el: lerp(1.3, 1.0, drop), hand: 'fist' as const},
		far: {sh: lerp(0.8, 0.4, drop), el: lerp(1.35, 1.0, drop), hand: 'fist' as const},
		hold: {item: 'phone' as const},
		headTilt: lerp(0.28 - breath * 0.12, -0.12 * warm, drop),
		gaze: [0.3, 0.6] as [number, number],
		eyes: breath > 0.5 || drop > 0.5 ? ('closed' as const) : ('open' as const),
		shoulderLift: breath,
		blink: drop > 0 ? 0 : blinkAt(t + 0.3, 2.7),
		brow: {inner: -4 * drop, outer: 0},
	};
	return (
		<>
			<Sky />
			<Clouds clouds={[{az: 176, el: 5, size: 200, seed: 6, dist: 700}, {az: 192, el: 8, size: 160, seed: 11, dist: 700}]} />
			<SunLight target={[0, 0, -1]} extent={7} dist={40} scale={1.4} fill={0.85} />
			<Atmosphere near={30} far={260} />
			<Room />
			<Figure look={MODERN} pose={pose} at={PERSON} res={1500} shadow tint={shot.sun.figureTint.clone().multiplyScalar(1.25).lerp(new THREE.Color(1.15, 0.98, 0.82), warm * 0.85)} />
			{/* warm light filling the room after "send" */}
			<pointLight position={[1.45, 1.05, -1.9]} color="#FFB467" intensity={14 * warm} distance={9} decay={1.2} />
			<pointLight position={[0.3, 1.9, 0.4]} color="#FFC890" intensity={2 + 8 * warm} distance={8} decay={1.2} />
			<Glow at={[1.45, 0.98, -2.0]} size={0.55} color="#FFC27A" opacity={0.85 * warm} />
			<Glow at={[PERSON[0] + 0.32, 1.02, PERSON[2] + 0.25]} size={0.28} color="#BFD8FF" opacity={0.5 * (1 - warm)} />
			<Dust box={[[-2.5, 0.3, -2.3], [1.5, 2.6, 1.2]]} count={70} size={0.025} opacity={0.35} speed={0.4} />
			<mesh position={[(WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2, WINDOW.z - 0.02]} visible={false}>
				<planeGeometry args={[1, 1]} />
			</mesh>
			{void shot}
		</>
	);
};
export const S14: SceneDef = {
	id: 'S14',
	sunAz: 180,
	camera: camS14,
	post: (t, d, sun) => ({
		bloom: {intensity: 0.9, threshold: 0.7},
		dof: {focusDistance: lerp(3.0, 1.75, ease.inOut(t / d)), focusRange: 1.2, bokehScale: 2.6},
		vignette: {offset: 0.25, darkness: 0.6},
		grade: gradeFromSun(sun, {exposure: 1.05 + 0.15 * smoothstep(SEND_T, SEND_T + 0.8, t), warmth: lerp(sun.warmth, 0.3, smoothstep(SEND_T, SEND_T + 0.8, t))}),
	}),
	Content: S14Content,
	anchors: () => ({phone: [PERSON[0] + 0.33, 1.02, PERSON[2]]}),
};

// ---------- S15: dusk, the first star ----------
export const STAR_T = 0.35;
const S15Content: React.FC<{t: number; d: number}> = ({t}) => {
	const star = smoothstep(STAR_T, STAR_T + 0.25, t);
	const tw = 1 + 0.15 * Math.sin(t * 9);
	const az = THREE.MathUtils.degToRad(174);
	const el = THREE.MathUtils.degToRad(12);
	const d = 800;
	const shot = useShot();
	const p: [number, number, number] = [shot.cam.pos[0] + d * Math.cos(el) * Math.sin(az), shot.cam.pos[1] + d * Math.sin(el), shot.cam.pos[2] + d * Math.cos(el) * Math.cos(az)];
	return (
		<>
			<Sky />
			<SunLight target={[0, 0, -60]} extent={120} dist={300} />
			<Atmosphere near={140} far={2600} />
			<Land />
			<Glow at={p} size={30 * star * tw} color="#FFF4D6" opacity={star} depthTest={false} />
			<Glow at={p} size={12 * star} color="#FFFFFF" opacity={star} depthTest={false} />
			<Glow at={p} size={90 * star} color="#9FB6FF" opacity={0.3 * star} depthTest={false} />
			<Clouds clouds={[{az: 170, el: 8, size: 420, seed: 5, dist: 1500}, {az: 200, el: 12, size: 320, seed: 19, dist: 1500}]} opacity={0.9} />
		</>
	);
};
export const S15: SceneDef = {
	id: 'S15',
	sunAz: LAND_SUN,
	camera: (t, d) => ({pos: [0, 30, 250 - t * 3], target: [0, 90, -400], fov: 44, far: 5000}),
	post: (t, d, sun) => ({bloom: {intensity: 1.2, threshold: 0.6}, vignette: {offset: 0.25, darkness: 0.65}, grade: gradeFromSun(sun, {exposure: 1.0})}),
	Content: S15Content,
};

// ---------- S16 tail: a fresh sunrise (used for the loop back to S1) ----------
export const SUNRISE_VIEW: SceneDef = {
	id: 'SUNRISE',
	sunAz: LAND_SUN,
	camera: (t) => ({pos: [0, 40, 300], target: [0, 60, -900], fov: 42, far: 5000}),
	post: (t, d, sun) => ({bloom: {intensity: 0.8, threshold: 0.8}, vignette: {offset: 0.3, darkness: 0.45}, grade: gradeFromSun(sun, {exposure: 0.82, contrast: 1.08})}),
	Content: () => (
		<>
			<Sky />
			<SunLight target={[0, 0, -60]} extent={120} dist={300} />
			<Atmosphere near={140} far={2600} />
			<Land />
		</>
	),
};

void clamp;
