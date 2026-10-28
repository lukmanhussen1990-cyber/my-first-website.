import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Figure} from '../../../../src/shared/three/Figure';
import {Dust, Glow, LightShaft} from '../../../../src/shared/three/fx';
import {Sky} from '../../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {clamp, ease, lerp, smoothstep} from '../../../../src/shared/math';
import {useShot, type Cam, type Vec3} from '../../../../src/shared/three/shot';
import {UpperRoom, WIN} from '../sets/UpperRoom';
import {DANIEL_OLD, P} from '../cast';
import {goldRoom} from '../moods';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import type {Look, Pose} from '../../../../src/shared/rig/paperdoll';

// S1: old Daniel kneels at his open window in a soft beam of gold light. 1 · 2 · 3.
// The camera framing here is the one the modern person matches in S10 (MATCH).

export const KNEEL_AT: Vec3 = [WIN.x + 0.25, 0, WIN.z + 0.95];
export const SUN_AZ = 193;
export const SUN_EL = 35;

// the shot S10 lands on: same window, same place, same pose
export const MATCH = (push = 0): Cam => ({
	pos: [lerp(-2.5, -2.1, push), lerp(2.3, 2.15, push), lerp(4.3, 3.65, push)],
	target: [KNEEL_AT[0] + 0.05, lerp(-0.42, -0.32, push), KNEEL_AT[2] - 0.3],
	fov: 48,
});

// the light: a shaft from the window onto him and a pool on the floor beyond
const travel = new THREE.Vector3(-Math.cos((SUN_EL * Math.PI) / 180) * Math.sin((SUN_AZ * Math.PI) / 180), -Math.sin((SUN_EL * Math.PI) / 180), -Math.cos((SUN_EL * Math.PI) / 180) * Math.cos((SUN_AZ * Math.PI) / 180));
const winC = new THREE.Vector3(WIN.x, (WIN.sill + WIN.rectTop) / 2, WIN.z - 0.2);
const sAt = winC.y / -travel.y;
export const POOL: Vec3 = [winC.x + travel.x * sAt, 0.01, winC.z + travel.z * sAt];
const FROM: Vec3 = [winC.x - travel.x * 2.2, winC.y - travel.y * 2.2, winC.z - travel.z * 2.2];

export const Beam: React.FC<{k?: number; pulse?: number}> = ({k = 1, pulse = 0}) => (
	<>
		<LightShaft from={FROM} to={POOL} r0={0.55} r1={0.95} opacity={(0.16 + pulse * 0.14) * k} color="#FFD58A" />
		<LightShaft from={[FROM[0], FROM[1] + 0.9, FROM[2]]} to={[POOL[0] - 0.05, 0.02, POOL[2] - 0.75]} r0={0.35} r1={0.6} opacity={(0.07 + pulse * 0.06) * k} color="#FFE2A8" />
		<Glow at={[POOL[0], 0.05, POOL[2]]} size={[2.4, 1.0]} color="#FFC870" opacity={(0.35 + pulse * 0.3) * k} />
		<Dust box={[[WIN.x - 0.7, 0.15, WIN.z + 0.2], [WIN.x + 1.2, 2.5, POOL[2] + 0.3]]} count={180} size={0.022} opacity={0.75 * k} color="#FFE7B0" speed={0.35} />
	</>
);

// a shadow-only ceiling, so the sun comes in through the window only
export const Ceiling: React.FC = () => {
	const mat = useMemo(() => new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false}), []);
	return (
		<mesh material={mat} position={[0.2, 3.45, 1.4]} castShadow>
			<boxGeometry args={[7.6, 0.1, 8.4]} />
		</mesh>
	);
};

// dark, soft shapes near the lens (a jar and a basket), like the reference's corner blobs
export const Foreground: React.FC = () => {
	const geo = useMemo(() => ({jar: jarGeoBig(), basket: new THREE.CylinderGeometry(0.36, 0.3, 0.42, 9)}), []);
	return (
		<>
			<mesh geometry={geo.jar} position={[-2.05, 0, 2.55]} scale={0.8}>
				<meshLambertMaterial color="#5A3622" flatShading />
			</mesh>
			<mesh geometry={geo.basket} position={[1.55, 0.21, 2.4]}>
				<meshLambertMaterial color="#6B4A2E" flatShading />
			</mesh>
		</>
	);
};
const jarGeoBig = () => {
	const pts = [0, 0.12, 0.3, 0.55, 0.8, 0.95, 1.05, 1.1].map((y, i) => new THREE.Vector2([0.18, 0.3, 0.38, 0.4, 0.34, 0.22, 0.15, 0.18][i], y));
	return new THREE.LatheGeometry(pts, 10);
};

export const DanielAtWindow: React.FC<{look?: Look; pose?: Pose; t: number; res?: number}> = ({look = DANIEL_OLD, pose, t, res = 1700}) => {
	const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
	const p: Pose = pose ?? {...P.pray, breath, near: {...P.pray.near!, sh: P.pray.near!.sh + Math.sin(t * 0.9) * 0.03}, far: {...P.pray.far!, sh: P.pray.far!.sh + Math.sin(t * 0.9 + 0.4) * 0.03}};
	return <Figure look={look} pose={p} at={KNEEL_AT} facing={-1} res={res} />;
};

// number landings (reel time == scene time in S1): 1 on "Daniel", 2 on "prayed", 3 on "three"
export const LANDS = [0.04, 0.4, 0.72];

const S1Content: React.FC<{t: number; d: number}> = ({t}) => {
	const pulse = LANDS.reduce((a, l) => a + (t >= l ? Math.exp(-(t - l) * 6) : 0), 0);
	return (
		<>
			<Sky />
			<SunLight target={[KNEEL_AT[0], 0.8, KNEEL_AT[2]]} extent={6} dist={30} mapSize={2048} fill={0.75} />
			<Atmosphere near={6} far={60} color={new THREE.Color('#FFE6B8')} mix={0.7} />
			<UpperRoom open={1} season={1} />
			<Ceiling />
			<Foreground />
			<Beam pulse={clamp(pulse)} />
			<DanielAtWindow t={t} />
		</>
	);
};

export const S01: SceneDef = {
	id: 'S1',
	sunAz: SUN_AZ,
	mood: () => ({...goldRoom(), elevationDeg: SUN_EL, hemiIntensity: 0.8}),
	camera: (t, d) => MATCH(ease.out(clamp(t / Math.max(d, 1)))),
	post: (t, d, sun) => ({
		bloom: {intensity: 1.15, threshold: 0.72},
		dof: {focusDistance: lerp(5.6, 4.9, clamp(t / d)), focusRange: 2.4, bokehScale: 2.6},
		vignette: {offset: 0.26, darkness: 0.6},
		grade: gradeFromSun(sun, {contrast: 1.06, warmth: 0.34, exposure: 1.1}),
	}),
	Content: S1Content,
	anchors: () => ({daniel: [KNEEL_AT[0], 1.45, KNEEL_AT[2]]}),
};
void smoothstep;
