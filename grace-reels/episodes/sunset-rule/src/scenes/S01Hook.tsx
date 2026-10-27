import React from 'react';
import {Figure} from '../../../../src/shared/three/Figure';
import {Coins, Dove, Table} from '../../../../src/shared/three/props';
import {Dust} from '../../../../src/shared/three/fx';
import {Sky, Clouds} from '../../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {ease, lerp} from '../../../../src/shared/math';
import {TempleCourt} from '../sets/Temple';
import {JESUS, MERCHANTS, P} from '../cast';
import {coinBurst, doveBurst, flipAngle, timeWarp} from '../action';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import {useShot, type Cam} from '../../../../src/shared/three/shot';
import {LightShaft} from '../../../../src/shared/three/fx';
import * as THREE from 'three';

// S1 HOOK (noon): slow-motion table flip, coins and doves burst, Jesus stands strong with
// the cord. The camera rushes in and then slows into slow motion on His face.

const TABLE: [number, number, number] = [0.95, 0, 1.25];
export const hookTau = (t: number) => timeWarp(t, 0.28, 0.75, 0.3, 3.7, 4.4);

const camPath = (t: number): Cam => {
	// fast push that eases into a slow creep (speed ramp)
	const k = 1 - Math.exp(-t * 1.6);
	const s = lerp(k, ease.inOut(t / 4.6), 0.45);
	return {
		pos: [lerp(0.55, 0.18, s), lerp(0.8, 1.52, s), lerp(7.8, 2.3, s)],
		target: [lerp(0.45, 0.02, s), lerp(2.05, 1.66, s), lerp(0, -0.05, s)],
		fov: lerp(48, 30, s),
	};
};

const Content: React.FC<{t: number; d: number}> = ({t}) => {
	const shot = useShot();
	const tau = hookTau(t);
	// half-vector between sun and camera: coins facing it flash
	const glintDir = shot.sunDir.clone().add(new THREE.Vector3(...shot.cam.pos).sub(new THREE.Vector3(1.4, 1.2, 0.8)).normalize()).normalize();
	const flip = flipAngle(tau, 0.1, 0.64);
	const coins = coinBurst(tau, 11, [TABLE[0], 0.84, TABLE[2]], 70, 0.32);
	const doves = doveBurst(tau, 5, [-0.9, 1.1, -1.8], 11, 0.26, 0.5);
	const recoil = ease.out((tau - 0.2) / 0.5);
	return (
		<>
			<Sky />
			<Clouds clouds={[{az: 200, el: 9, size: 160, seed: 3}, {az: 160, el: 13, size: 120, seed: 8}, {az: 230, el: 6, size: 200, seed: 12}]} />
			<SunLight target={[0, 0, -2]} extent={16} dist={60} mapSize={2048} />
			<Atmosphere near={18} far={110} />
			<TempleCourt />
			{/* the flipping table: rotate about its front edge toward the camera */}
			<group position={[TABLE[0], 0, TABLE[2] + 0.42]} rotation={[0, -0.75, 0]}>
				<group rotation={[flip, 0, 0]}>
					<Table seed={4} position={[0, 0, -0.42]} />
				</group>
			</group>
			<Coins coins={coins} glint={glintDir} />
			{doves.map((d, i) => (
				<Dove key={i} position={d.p} rotation={[0, d.yaw, 0]} flap={d.flap} bank={d.bank} scale={d.s} />
			))}
			<Figure look={JESUS} pose={{...P.whipLow, yaw: 0.55, gaze: [0.3, 0.05], hold: {item: 'whip', swing: 0.15 * Math.sin(tau * 3)}}} at={[0, 0, 0]} res={2200} />
			<Figure look={MERCHANTS[0]} pose={{...P.jumpBack, lean: -0.15 - recoil * 0.12}} at={[2.7, 0, -1.6]} facing={-1} res={900} />
			<Figure look={MERCHANTS[2]} pose={{...P.jumpBack, near: {sh: 2.0 + recoil * 0.3, el: 0.4, hand: 'flat'}, far: {sh: 1.8, el: 0.4, hand: 'flat'}}} at={[-2.0, 0, -2.4]} res={800} />
			<Dust box={[[-4, 0.2, -4], [4, 3.5, 3]]} count={140} size={0.035} opacity={0.55} />
			<LightShaft from={[-9, 14, -12]} to={[-1.2, 0, -1.5]} r0={0.9} r1={1.6} opacity={0.1} />
			<LightShaft from={[-6, 14, -14]} to={[2.2, 0, -3.5]} r0={0.7} r1={1.3} opacity={0.08} />
		</>
	);
};

export const S01: SceneDef = {
	id: 'S1',
	sunAz: 232,
	camera: (t) => camPath(t),
	post: (t, d, sun) => {
		const c = camPath(t);
		const dist = Math.hypot(c.pos[0] - 0, c.pos[2] - 0);
		return {
			bloom: {intensity: 0.75, threshold: 0.82},
			dof: {focusDistance: dist, focusRange: 2.2, bokehScale: 3.2},
			vignette: {offset: 0.3, darkness: 0.5},
			grade: gradeFromSun(sun, {contrast: 1.06}),
		};
	},
	Content,
};
