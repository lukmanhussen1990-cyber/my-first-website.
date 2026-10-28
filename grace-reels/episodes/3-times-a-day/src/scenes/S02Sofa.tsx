import React from 'react';
import * as THREE from 'three';
import {Figure} from '../../../../src/shared/three/Figure';
import {Dust, Glow} from '../../../../src/shared/three/fx';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {clamp, ease, lerp} from '../../../../src/shared/math';
import {useShot, type Cam, type Vec3} from '../../../../src/shared/three/shot';
import {Living, SOFA} from '../sets/Living';
import {MODERN, P} from '../cast';
import {night} from '../moods';
import {gradeFromSun, type SceneDef} from '../sceneKit';

// S2: a young person slouched on a sofa at night, thumb flicking, face lit cold blue.

export const SIT_AT: Vec3 = [SOFA.x - 0.05, 0, SOFA.z + 0.12];
export const PHONE_AT: Vec3 = [SIT_AT[0] + 0.36, 0.98, SIT_AT[2] + 0.02];
export const FACE_AT: Vec3 = [SIT_AT[0] + 0.1, 1.18, SIT_AT[2]];

// a quick thumb flick every ~0.45 s
export const flickAt = (t: number) => {
	const ph = (t / 0.45) % 1;
	return ph < 0.18 ? Math.sin((ph / 0.18) * Math.PI) : 0;
};

export const Scroller: React.FC<{t: number; res?: number; glow?: number}> = ({t, res = 1700, glow = 1}) => {
	const shot = useShot();
	const tint = shot.sun.figureTint.clone().lerp(new THREE.Color('#9CC2FF'), 0.55 * glow).multiplyScalar(1.05 + 0.25 * glow);
	return (
		<>
			<Figure look={MODERN} pose={{...P.scroll(flickAt(t)), breath: Math.sin(t * 1.3) * 0.5 + 0.5, blink: (t % 3.1) < 0.12 ? 1 : 0}} at={SIT_AT} res={res} tint={tint} />
			{/* the screen's cold light on the face and around the phone */}
			<pointLight position={[PHONE_AT[0] + 0.1, PHONE_AT[1] + 0.05, PHONE_AT[2] + 0.2]} color="#7FB0FF" intensity={1.6 * glow} distance={2.2} decay={1.8} />
			<Glow at={PHONE_AT} size={0.2} color="#CFE2FF" opacity={0.65 * glow} />
			<Glow at={[FACE_AT[0] + 0.14, FACE_AT[1] - 0.02, FACE_AT[2] + 0.18]} size={0.42} color="#5F8FE0" opacity={0.16 * glow} />
		</>
	);
};

const S2Content: React.FC<{t: number; d: number}> = ({t}) => (
	<>
		<SunLight target={[0, 0, -1]} extent={6} dist={20} fill={0.8} />
		<Atmosphere near={12} far={70} />
		<Living />
		<Scroller t={t} />
		<Dust box={[[-1, 0.3, -2], [2, 2.2, 0.5]]} count={40} size={0.018} opacity={0.25} color="#9CB8FF" speed={0.3} />
	</>
);

export const SOFA_CAM = (push: number): Cam => ({
	pos: [lerp(2.55, 1.85, push), lerp(1.62, 1.5, push), lerp(1.7, 1.05, push)],
	target: [FACE_AT[0] + 0.25, lerp(0.62, 0.78, push), FACE_AT[2] - 0.05],
	fov: lerp(46, 42, push),
});

export const S02: SceneDef = {
	id: 'S2',
	sunAz: 200,
	mood: () => night(),
	camera: (t, d) => SOFA_CAM(ease.out(clamp(t / d))),
	post: (t, d, sun) => ({
		bloom: {intensity: 1.2, threshold: 0.6},
		dof: {focusDistance: lerp(3.1, 2.2, ease.out(clamp(t / d))), focusRange: 1.4, bokehScale: 3},
		vignette: {offset: 0.24, darkness: 0.7},
		grade: gradeFromSun(sun, {contrast: 1.08, warmth: -0.35, saturation: 0.95, exposure: 1.05}),
	}),
	Content: S2Content,
};
