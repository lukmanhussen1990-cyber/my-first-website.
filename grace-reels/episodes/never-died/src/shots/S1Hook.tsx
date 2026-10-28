// S1 · Opening mid-action: a storm over the Jordan, the whirlwind carrying Elijah up, Elisha reaching after
// him, and Elijah's cloak tumbling past the lens, then straight into it (the wipe into S2).
// Also used for the loop: the last 0.6 s of the reel plays S1 at negative time.
import {CharacterRoot, PoseSprite, STANDING_PX} from '../characters/Character';
import {RIGS} from '../characters/rig';
import {Whirlwind} from '../fx/Whirlwind';
import {easeInOut, keys, lerp, seg} from '../lib/ease';
import {B} from '../lib/timeline';
import {cameraBasis, orbit} from '../render/camera';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {jordanHeight, JordanWorld} from '../world/JordanWorld';
import {STORM} from '../world/mood';
import {camAngles} from './Jordan';
import {Dust} from '../world/atmosphere';

const WX = 1.3;
const WZ = -0.6;
const SX = -1.15;
const SZ = 0.8;
const HOLE: [number, number, number] = [0.08, 0.62, -0.78];

const camera1 = (t: number): CamState => orbit([0.4, 4.4 + 0.18 * t, WZ], 13.8 - 0.45 * t, -12 - 0.4 * t, 7, 34, {shake: 0.3});

// The cloak: swirling high in the funnel, then swooping past the camera, then into the lens at cloakWipe.
const cloakAt = (t: number) => {
	const th = 1.2 + t * 2.3;
	const world: Vec3 = [WX + 1.7 * Math.cos(th), 5.6 + 0.6 * Math.sin(t * 1.3) + 0.3 * t, WZ + 1.0 * Math.sin(th)];
	const cam = camera1(t);
	const b = cameraBasis(cam, t);
	const cx = keys(t, [[1.8, -2.6], [B.cloakPass, 0.2], [B.cloakPass + 0.45, 2.6], [B.cloakWipe, 0.0]]);
	const cy = keys(t, [[1.8, 0.6], [B.cloakPass, -0.25], [B.cloakPass + 0.45, 0.5], [B.cloakWipe, 0.0]]);
	const cd = keys(t, [[1.8, 5.0], [B.cloakPass, 1.9], [B.cloakPass + 0.45, 3.2], [B.cloakWipe, 0.3]]);
	const near = b.pos.clone().addScaledVector(b.fwd, cd).addScaledVector(b.right, cx).addScaledVector(b.up, cy);
	const w = seg(t, 1.55, 2.1, easeInOut);
	return {
		pos: [lerp(world[0], near.x, w), lerp(world[1], near.y, w), lerp(world[2], near.z, w)] as Vec3,
		rot: 0.6 * Math.sin(t * 3.1) + t * 1.4,
		wave: 26,
	};
};

const Content: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const c = camera1(t);
	const a = camAngles(c);
	const g = jordanHeight(WX, WZ);
	const cl = cloakAt(t);
	const risePx = STANDING_PX['elijah/poses'] / RIGS.elijah.heightM;
	const reachPx = STANDING_PX['elisha/poses'] / RIGS.elisha.heightM;
	const cloakPx = STANDING_PX['elijah/side'] / RIGS.elijah.heightM;
	return (
		<>
			<JordanWorld t={t + 40} mood={STORM} lite={lite} lightCenter={[0, 0, -2]} holeDir={HOLE} />
			<Whirlwind position={[WX, g - 0.05, WZ]} strength={1} t={t + 40} lite={lite} order={100} dust="#a8957c" light="#ffe2a0" />
			<CharacterRoot position={[WX, g + 6.2 + 0.45 * t, WZ]} pxPerM={risePx} facing={-1} yaw={a.yaw} lean={a.pitch} shadow={null}>
				<group rotation-z={0.07 * Math.sin(t * 2.7)}>
					<PoseSprite sprite="elijah/pose_rise" renderOrder={105} look={{tint: STORM.tint, light: 0.08, lightColor: '#ffe6b0'}} />
				</group>
			</CharacterRoot>
			<CharacterRoot position={[SX, jordanHeight(SX, SZ), SZ]} pxPerM={reachPx} yaw={a.yaw} lean={a.pitch} shadow={{w: 0.9, d: 0.34, opacity: 0.3}} shadowOrder={9}>
				<PoseSprite sprite="elisha/pose_reach" renderOrder={300} look={{tint: STORM.tint}} warp={{breath: 0.008 * Math.sin(t * 2.4)}} />
			</CharacterRoot>
			<CharacterRoot position={cl.pos} pxPerM={cloakPx} yaw={a.yaw} lean={a.pitch} shadow={null}>
				<group rotation-z={cl.rot}>
					<PoseSprite sprite="elijah/cloak" anchor={[220, 360]} renderOrder={500} look={{tint: STORM.tint}} warp={{wave: [cl.wave, 7, t * 7, 0.1]}} segs={[8, 26]} />
				</group>
			</CharacterRoot>
			<Dust count={lite ? 60 : 160} center={[WX, 3, WZ]} size={[9, 6, 6]} t={t + 40} rise={0.08} px={6} opacity={0.6} seed={51} color="#ffe2b0" swirl={1} />
		</>
	);
};

export const S1: ShotDef = {
	id: 'S1',
	start: -1,
	end: B.cloakWipe + 0.4,
	Content,
	camera: camera1,
	fog: () => ({color: STORM.fog, near: STORM.fogNear, far: STORM.fogFar}),
	grade: () => ({exposure: 1.02, saturation: 1.02, contrast: 1.08, gain: [1.02, 0.99, 1.0], bloom: 0.55, bloomThreshold: 0.85, vignette: 0.5}),
};

// The loop: the end card melts into the opening, played at negative time so frame 0 continues it.
export const LOOP: ShotDef = {
	id: 'LOOP',
	start: B.loopOut,
	end: B.total + 1,
	Content: ({t, lite}) => <Content t={t - B.total} lite={lite} />,
	camera: (t) => camera1(t - B.total),
	fog: () => ({color: STORM.fog, near: STORM.fogNear, far: STORM.fogFar}),
	grade: S1.grade,
};

// Nothing in 3D while the 2D call to action and end card cover the frame (keeps those frames cheap).
export const VOID: ShotDef = {
	id: 'VOID',
	start: B.s10 + 0.6,
	end: B.loopOut,
	Content: () => null,
	camera: () => ({pos: [0, 0, 10], target: [0, 0, 0], fov: 30}),
	fog: () => null,
};
