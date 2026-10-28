// S5 · "Most people think Elijah rode that chariot to heaven." The action freezes and fades to grey,
// an old framed painting of the popular picture slides in, a red X stamps it ("But read it again"),
// then the tape rewinds to just before the chariot came.
import {CharacterRoot, PoseSprite, STANDING_PX} from '../characters/Character';
import {RIGS} from '../characters/rig';
import {TEAM_SCALE} from '../fx/chariot';
import {FireTeam} from '../fx/FireTeam';
import {easeIn, easeInOut, easeOutBack, keys, lerp, pulse, seg} from '../lib/ease';
import {B} from '../lib/timeline';
import {cached} from '../world/cache';
import {LightBeam, Sky} from '../world/atmosphere';
import {cloud, mergePlaced} from '../world/lowpoly';
import {AFTERNOON, GLORY, skyFromMood} from '../world/mood';
import type {CamState, InsetRect, ShotDef} from '../render/types';
import {orbit} from '../render/camera';
import {hash} from '../lib/random';
import * as THREE from 'three';
import {camAngles, camera34, jordanAnchors, JordanAction} from './Jordan';

export const REPLAY_TAU = 24.02; // S6 replays from here (keeps the hooves in step with the sound)
const REW0 = B.rewind;
const REW1 = B.replay;

// Story time shown by S5: frozen, then a fast tape-rewind back to the replay start.
export const s5Tau = (t: number) => (t < REW0 ? B.freeze : lerp(B.freeze, REPLAY_TAU, easeInOut(seg(t, REW0, REW1))));

const pushed = (c: CamState, k: number): CamState => ({
	...c,
	pos: [c.target[0] + (c.pos[0] - c.target[0]) * k, c.target[1] + (c.pos[1] - c.target[1]) * k, c.target[2] + (c.pos[2] - c.target[2]) * k],
});

const camera5 = (t: number): CamState => {
	if (t < REW0) return {...pushed(camera34(B.freeze), 1 - 0.08 * seg(t, B.freeze, REW0, easeInOut)), drift: 0.4};
	const k = 1 - 0.08 * (1 - seg(t, REW0, REW0 + 0.12));
	return {...pushed(camera34(s5Tau(t)), k), drift: 0.4};
};

export const S5: ShotDef = {
	id: 'S5',
	start: B.freeze,
	end: REW1,
	Content: ({t, lite}) => {
		const a = camAngles(camera5(t));
		const τ = s5Tau(t);
		return <JordanAction τ={τ} t={τ} lite={lite} mood={AFTERNOON} camYaw={a.yaw} camPitch={a.pitch} />;
	},
	camera: camera5,
	fog: () => ({color: AFTERNOON.fog, near: AFTERNOON.fogNear, far: AFTERNOON.fogFar}),
	grade: (t) => {
		const grey = seg(t, B.freeze, B.freeze + 0.35) * (1 - seg(t, REW1 - 0.08, REW1));
		const rew = seg(t, REW0, REW0 + 0.06) * (1 - seg(t, REW1 - 0.05, REW1));
		return {
			exposure: 1 - 0.14 * grey,
			desat: 0.72 * grey,
			contrast: 1.04 - 0.06 * grey,
			vignette: 0.38 + 0.25 * grey,
			bloom: 0.3,
			flash: pulse(t, B.freeze + 0.02, 0.02, 0.18) * 0.35,
			flashColor: [1, 1, 1],
			rewind: rew,
		};
	},
	anchors: (t) => jordanAnchors(s5Tau(t)),
};

// ---------- the old painting (rendered as an inset) ----------

export const mythRect = (t: number): InsetRect | null => {
	if (t < B.mythIn - 0.05 || t > REW0 + 0.3) return null;
	const inP = seg(t, B.mythIn, B.mythIn + 0.5);
	const out = seg(t, REW0 - 0.08, REW0 + 0.2, easeIn);
	const hit = pulse(t, B.redX + 0.1, 0.01, 0.12);
	return {
		cx: 516 + 7 * Math.sin(t * 90) * hit,
		cy: 1080 + 950 * (1 - easeOutBack(inP, 1.2)) + 1150 * out,
		w: 690,
		h: 680,
		rot: lerp(-14, -2.5, easeOutBack(inP, 1.2)) + 9 * out + 1.4 * Math.sin(t * 70) * hit,
		opacity: seg(t, B.mythIn - 0.02, B.mythIn + 0.12),
		age: 1,
	};
};

// The popular picture: Elijah standing in the chariot of fire, climbing above the clouds into a golden sky.
const PAINT_SKY = {
	...GLORY,
	skyTop: '#34406e',
	skyHorizon: '#f0c27e',
	skyBottom: '#9a6a4c',
	sunDir: [0.55, 0.62, -0.56] as [number, number, number],
	sunColor: '#fff0c4',
	sunGlow: 1.1,
	sunSize: 5,
	storm: 0.45,
	stormA: '#4e4a72',
	stormB: '#c99a6a',
	hole: 1.2,
	holeColor: '#ffe3a0',
};
const mythCam = (t: number): CamState => orbit([0.35, 1.45, 0], keys(t, [[B.mythIn, 7.4], [REW0, 6.9]]), -7, 0, 40, {drift: 0.3});

const MythContent: React.FC<{t: number; lite: boolean}> = ({t}) => {
	const τ = B.chariotBurst + 3 + (t - B.mythIn) * 0.35;
	const pose = {phases: [τ / 0.45, (τ - 0.21) / 0.45] as [number, number], rear: 0.22, wheel: -τ * 9, t: τ};
	const rise = 0.06 * (t - B.mythIn);
	const clouds = cached('mythClouds', () => {
		const items: Parameters<typeof mergePlaced>[0] = [];
		for (let i = 0; i < 18; i++) {
			const x = -11 + (i % 9) * 2.8 + hash(301, i) * 1.4;
			const low = i < 9;
			const y = low ? -2.4 + hash(302, i) * 1.2 : 6.5 + hash(302, i) * 3.5;
			items.push({geo: cloud(320 + i, low ? '#f7dcaa' : '#efd2b0', low ? '#7c5a62' : '#8e7590'), pos: [x, y, -3 - hash(303, i) * 9], rot: hash(304, i), scale: 0.9 + hash(305, i) * 1.1});
		}
		return {geo: mergePlaced(items), mat: new THREE.MeshBasicMaterial({vertexColors: true, fog: false})};
	});
	const pxPerM = STANDING_PX['elijah/poses'] / RIGS.elijah.heightM;
	return (
		<>
			<Sky {...skyFromMood(PAINT_SKY, t, [0.5, 0.62, -0.6])} />
			<mesh geometry={clouds.geo} material={clouds.mat} position={[-0.3 * (t - B.mythIn), 0, 0]} />
			<LightBeam position={[6, -3, -10]} height={40} rTop={8} rBottom={2.2} intensity={0.22} t={t} tilt={[0.25, -0.42]} color="#ffe6b0" />
			<group position={[0, rise, 0]} rotation-z={0.22}>
				{/* Elijah stands in the car, drawn behind the team plane so the car hides his legs */}
				<CharacterRoot position={[-1.62 * TEAM_SCALE, 0.48 * TEAM_SCALE, -0.05]} pxPerM={pxPerM} shadow={null}>
					<PoseSprite sprite="elijah/pose_point" renderOrder={150} look={{tint: '#ffeedd', light: 0.16, lightColor: '#ffb070'}} />
				</CharacterRoot>
				<FireTeam pose={pose} position={[0, 0, 0]} facing={1} scale={TEAM_SCALE} yaw={0} lean={0} intensity={0.85} renderOrder={200} />
			</group>
		</>
	);
};

export const MYTH: ShotDef = {
	id: 'MYTH',
	start: -1,
	end: -1,
	Content: MythContent,
	camera: mythCam,
	fog: () => null,
};
