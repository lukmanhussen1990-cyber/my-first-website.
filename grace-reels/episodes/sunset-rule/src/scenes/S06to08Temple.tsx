import React from 'react';
import * as THREE from 'three';
import {Figure} from '../../../../src/shared/three/Figure';
import {Coins, Dove, Ox, Sheep, Table, Cage, Jar} from '../../../../src/shared/three/props';
import {Dust, LightShaft} from '../../../../src/shared/three/fx';
import {Sky, Clouds} from '../../../../src/shared/three/Sky';
import {Atmosphere, SunLight} from '../../../../src/shared/three/world';
import {clamp, ease, lerp, rng, smoothstep} from '../../../../src/shared/math';
import {useShot, type Cam, type Vec3} from '../../../../src/shared/three/shot';
import {TempleCourt} from '../sets/Temple';
import {JESUS, MERCHANTS, P} from '../cast';
import {coinBurst, doveBurst, flipAngle} from '../action';
import {gradeFromSun, type SceneDef} from '../sceneKit';
import {blinkAt} from './S02to05Synagogue';

// S6 the temple (afternoon): braiding cords, then the drive-out in one tracking shot.
// S7 the card over settling dust. S8 freeze frame of the same moment with tags.

const SUN_AZ = 214;
const BRAID_END = 1.15; // seconds of the hands close-up
const FLIP_T = 2.45; // "flipped" lands here
const CLOUDS = [
	{az: 190, el: 8, size: 170, seed: 5},
	{az: 225, el: 12, size: 130, seed: 9},
	{az: 160, el: 6, size: 210, seed: 14},
	{az: 250, el: 9, size: 150, seed: 2},
];

// where Jesus is during the drive (strides to the right)
const jesusX = (t: number) => lerp(-1.6, 1.7, ease.inOut(clamp((t - BRAID_END) / 3.4)));

// The market in uproar at scene time t (also frozen by S8).
export const TempleChaos: React.FC<{t: number; frozen?: boolean; settled?: boolean}> = ({t, settled = false}) => {
	const shot = useShot();
	const tau = t - FLIP_T + 0.55; // flip starts just before the word
	const flip = flipAngle(tau, 0);
	const flip2 = flipAngle(tau - 0.35, 0);
	const coins = [...coinBurst(tau, 21, [2.35, 0.84, 1.1], 60, 0.22, 1.2), ...coinBurst(tau - 0.35, 33, [4.6, 0.84, -0.6], 40, 0.22, 1.0)];
	const doves = doveBurst(t - 1.6, 9, [-0.4, 0.9, -2.6], 12, 0, 0.9);
	const jx = jesusX(t);
	const run = smoothstep(BRAID_END, BRAID_END + 0.6, t);
	const r = rng(4);
	const glintDir = shot.sunDir.clone().add(new THREE.Vector3(...shot.cam.pos).sub(new THREE.Vector3(2, 1, 0)).normalize()).normalize();
	const swing = Math.sin(t * 7.5) * 0.7;
	return (
		<>
			<Sky />
			<Clouds clouds={CLOUDS} />
			<SunLight target={[1.5, 0, -1]} extent={18} dist={60} mapSize={2048} />
			<Atmosphere near={16} far={95} />
			<TempleCourt animals="none" />
			{/* tables going over, toward +Z */}
			<group position={[2.35, 0, 1.5]} rotation={[0, 0.25, 0]}>
				<group rotation={[flip, 0, 0]}>
					<Table seed={7} position={[0, 0, -0.42]} />
				</group>
			</group>
			<group position={[4.6, 0, -0.2]} rotation={[0, -0.3, 0]}>
				<group rotation={[flip2, 0, 0]}>
					<Table seed={9} position={[0, 0, -0.42]} />
				</group>
			</group>
			<Coins coins={coins} glint={glintDir} />
			{/* cages, one door open; doves out */}
			<Cage seed={3} position={[-0.6, 0, -2.7]} rotation={[0, 0.3, 0]} open={t > 1.6 ? 1 : 0} />
			<Cage seed={5} position={[-0.1, 0, -3.2]} rotation={[0, -0.2, 0]} />
			<Cage seed={6} position={[-0.35, 0.47, -2.95]} rotation={[0, 0.5, 0]} open={t > 1.8 ? 1 : 0} />
			{doves.map((d, i) => (
				<Dove key={i} position={d.p} rotation={[0, d.yaw, 0]} flap={d.flap} bank={d.bank} scale={d.s} />
			))}
			{/* sheep and oxen driven out to the right */}
			{settled
				? null
				: Array.from({length: 8}, (_, i) => {
						const ph = r();
						const ahead = 0.9 + r() * 2.6;
						const z = -1.8 + r() * 3.2;
						const x = jx + ahead + run * (t - BRAID_END) * (0.55 + r() * 0.35);
						return <Sheep key={i} seed={i + 2} position={[x, 0, z]} rotation={[0, -0.12 + (r() - 0.5) * 0.4, 0]} run={run} phase={t * 2.2 + ph} />;
					})}
			{settled ? null : <Ox seed={5} position={[jx + 3.2 + run * (t - BRAID_END) * 0.6, 0, -2.4]} rotation={[0, -0.05, 0]} run={run} phase={t * 1.4} />}
			{settled ? null : <Ox seed={6} position={[jx + 4.4 + run * (t - BRAID_END) * 0.7, 0, -0.6]} rotation={[0, 0.08, 0]} run={run} phase={t * 1.4 + 0.4} />}
			{/* foreground parallax objects near the camera path */}
			<Jar seed={12} h={0.9} position={[-3.2, 0, 4.6]} />
			<Jar seed={13} h={0.7} position={[-2.6, 0, 5.1]} color="#A65A36" />
			<Cage seed={14} position={[5.8, 0, 4.4]} rotation={[0, 0.4, 0]} />
			<Figure
				look={JESUS}
				pose={
					settled
						? {...P.whipLow, brow: {inner: 3, outer: 0}, eyes: 'open', gaze: [0.2, 0.3], blink: blinkAt(t, 3.1)}
						: t < BRAID_END
							? {...P.stand, near: {sh: 0.42, el: 1.38 + 0.12 * Math.sin(t * 7), hand: 'fist'}, far: {sh: 0.36, el: 1.42 + 0.12 * Math.cos(t * 7), hand: 'fist'}, headTilt: 0.22, gaze: [0.25, 0.8], hold: {item: 'cords', swing: 0.15 * Math.sin(t * 5)}}
							: {...P.whipHigh, stride: Math.sin(t * 5.5) * 0.6, hold: {item: 'whip', swing}, blink: blinkAt(t, 2.9)}
				}
				at={[jx, 0, 0.2]}
				res={t < BRAID_END ? 2400 : 1400}
			/>
			{settled ? null : <Figure look={MERCHANTS[1]} pose={{...P.jumpBack, lean: -0.1 - 0.15 * smoothstep(FLIP_T - 0.4, FLIP_T + 0.4, t)}} at={[3.3, 0, 1.0]} facing={-1} res={900} />}
			{settled ? null : <Figure look={MERCHANTS[3]} pose={{...P.jumpBack, stride: 0.5}} at={[5.6, 0, -1.6]} facing={-1} res={800} />}
			<Figure look={MERCHANTS[4]} pose={settled ? {...P.stand, eyes: 'wide', near: {sh: 0.4, el: 1.2}} : {...P.jumpBack, near: {sh: 2.6, el: 0.5, hand: 'flat'}}} at={[-2.4, 0, -1.8]} res={800} />
			<Dust box={[[-4, 0.1, -3], [8, 2.6, 4]]} count={220} size={0.05} opacity={0.5 + 0.3 * smoothstep(FLIP_T, FLIP_T + 1, t)} />
			<LightShaft from={[-10, 13, -10]} to={[0.5, 0, -1]} r0={0.9} r1={1.8} opacity={0.08} />
		</>
	);
};

const camS6 = (t: number): Cam => {
	if (t < BRAID_END) {
		// close on Jesus braiding the cords, a slow push
		const jx = jesusX(0);
		return {pos: [jx + 0.75, 1.22, 0.2 + 2.9 - t * 0.3], target: [jx + 0.42, 1.08, 0.2], fov: 34};
	}
	const k = ease.inOut(clamp((t - BRAID_END) / 3.3));
	const x = lerp(-0.6, 3.0, k);
	return {pos: [x, lerp(2.5, 2.1, k), lerp(9.6, 8.8, k)], target: [x + 0.4, 1.0, -0.4], fov: 50};
};

const S6Content: React.FC<{t: number; d: number}> = ({t}) => <TempleChaos t={t} />;

export const S06: SceneDef = {
	id: 'S6',
	sunAz: SUN_AZ,
	camera: camS6,
	post: (t, d, sun) => ({
		bloom: {intensity: 0.7, threshold: 0.82},
		dof: t < BRAID_END ? {focusDistance: 2.95 - t * 0.3, focusRange: 1.1, bokehScale: 3.5} : {focusDistance: 8.6, focusRange: 5, bokehScale: 2.2},
		vignette: {offset: 0.3, darkness: 0.5},
		grade: gradeFromSun(sun, {contrast: 1.06}),
	}),
	Content: S6Content,
	anchors: (t) => ({jesus: [jesusX(t), 2.3, 0.2]}),
};

// ---------- S7: card over the settling dust ----------
const S7Content: React.FC<{t: number; d: number}> = ({t}) => <TempleChaos t={FLIP_T + 2.4 + t * 0.5} settled />;
export const S07: SceneDef = {
	id: 'S7',
	sunAz: SUN_AZ,
	camera: (t, d) => {
		const k = ease.inOut(t / d);
		return {pos: [lerp(4.2, 3.4, k), lerp(2.6, 2.3, k), lerp(8.2, 7.4, k)], target: [lerp(2.4, 2.1, k), 0.8, 0.2], fov: 44};
	},
	post: (t, d, sun) => ({
		bloom: {intensity: 0.65, threshold: 0.82},
		dof: {focusDistance: 6.5, focusRange: 3.5, bokehScale: 3},
		vignette: {offset: 0.26, darkness: 0.62},
		grade: gradeFromSun(sun, {contrast: 1.02, exposure: 0.9}),
	}),
	Content: S7Content,
};

// ---------- S8: freeze frame of the drive with tags ----------
const FREEZE = FLIP_T + 0.35;
const S8Content: React.FC<{t: number; d: number}> = () => <TempleChaos t={FREEZE} frozen />;
export const S08: SceneDef = {
	id: 'S8',
	sunAz: SUN_AZ,
	camera: (t, d) => {
		const k = ease.inOut(t / d);
		const jx = jesusX(FREEZE);
		return {pos: [jx + lerp(0.9, 0.8, k), lerp(1.8, 1.7, k), lerp(6.0, 5.2, k)], target: [jx + 0.62, 1.4, 0.2], fov: 42};
	},
	post: (t, d, sun) => ({
		bloom: {intensity: 0.5, threshold: 0.85},
		dof: {focusDistance: 5.2, focusRange: 2.2, bokehScale: 3},
		vignette: {offset: 0.25, darkness: 0.62},
		grade: gradeFromSun(sun, {saturation: 0.62, contrast: 1.08, lift: 0.04}),
	}),
	Content: S8Content,
	anchors: () => ({jesus: [jesusX(FREEZE), 2.2, 0.2]}),
};

void ({} as Vec3);
