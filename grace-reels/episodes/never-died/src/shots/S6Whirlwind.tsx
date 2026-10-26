// S6 · The truth: a slow-motion replay shows the chariot came BETWEEN them; then the storm gathers,
// a whirlwind lifts Elijah into heaven, his cloak slips off, and Elisha reaches after him.
import {CharacterRoot, PoseSprite, STANDING_PX} from '../characters/Character';
import {RIGS} from '../characters/rig';
import {Whirlwind} from '../fx/Whirlwind';
import {Particles, ParticleSpec} from '../fx/Particles';
import {easeInOut, keys, lerp, pulse, seg} from '../lib/ease';
import {hash} from '../lib/random';
import {B, SCENE} from '../lib/timeline';
import {orbit} from '../render/camera';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {LightBeam} from '../world/atmosphere';
import {jordanHeight} from '../world/JordanWorld';
import {AFTERNOON, mixMood, STORM} from '../world/mood';
import {camAngles, camera34, EL_Z, elijahX, elishaX, jordanAnchors, JordanAction} from './Jordan';
import {REPLAY_TAU} from './S5Myth';
import {useMemo} from 'react';

const RATE = 0.5; // the replay runs at half speed (the slowed hooves in the mix use the same rate)
export const s6Tau = (t: number) =>
	t < B.stormGather ? REPLAY_TAU + (t - B.replay) * RATE : REPLAY_TAU + (B.stormGather - B.replay) * RATE + (t - B.stormGather);

const S6_END = SCENE.S7.start + 0.6;
const stormAmt = (t: number) => seg(t, B.stormGather - 0.2, B.liftOff + 0.5, easeInOut);
export const windAmt = (t: number) => keys(t, [[B.stormGather + 0.1, 0], [B.liftOff, 0.5], [B.whirlwindFull, 1], [B.heaven + 0.5, 1], [S6_END, 0.55]]);
const HOLE: [number, number, number] = [0.05, 0.6, -0.8];

// Elijah's ride up: a gentle start that speeds up into the light.
const LIFT0 = B.liftOff - 0.05;
export const liftY = (t: number) => {
	const s = Math.max(0, t - LIFT0);
	return 2.6 * s * s + 0.4 * s;
};
const EX = () => elijahX(s6Tau(B.stormGather));
const SWAP = B.liftOff - 0.12; // rig -> rising pose (inside the dust)

const RISE_PX = STANDING_PX['elijah/poses'] / RIGS.elijah.heightM;
const RIG_PX = STANDING_PX['elijah/side'] / RIGS.elijah.heightM;
const NECK: [number, number] = [2, 482]; // neck in pose_rise pixels relative to its foot point (y up)
const COLLAR: [number, number] = [250, 40]; // collar in the cloak sprite

// World position of Elijah's neck while he rises (facing left, so pixel x is mirrored).
const neckWorld = (t: number): Vec3 => [EX() - NECK[0] / RISE_PX, jordanHeight(EX(), EL_Z) + liftY(t) + NECK[1] / RISE_PX, EL_Z];

// The cloak: on his back, then it slips off at cloakSlip, swirls once around the funnel and drifts out.
export const cloakS6 = (t: number): {pos: Vec3; rot: number; wave: number} => {
	if (t < B.cloakSlip) return {pos: neckWorld(t), rot: 0.05 * Math.sin(t * 6), wave: 10};
	const s = t - B.cloakSlip;
	const p0 = neckWorld(B.cloakSlip);
	const th = 0.3 + 2.4 * s;
	const r = 0.5 + 0.9 * Math.min(1, s / 1.2);
	const h = p0[1] + 1.8 * Math.min(s, 1.7) - 0.3 * Math.max(0, s - 1.7) ** 2;
	const drift = -1.3 * Math.max(0, s - 1.6);
	return {pos: [EX() + r * Math.cos(th) + drift, h, EL_Z + 0.6 * r * Math.sin(th)], rot: 0.5 * Math.sin(s * 3.2) + 0.6 * s, wave: 22};
};

const camera6 = (t: number): CamState => {
	const τ = s6Tau(t);
	const rep = camera34(Math.min(τ, s6Tau(B.stormGather)));
	const between = seg(t, B.between - 0.6, B.between + 0.3, easeInOut) * (1 - seg(t, B.stormGather, B.stormGather + 0.6));
	const k = 1 - 0.2 * between;
	const c: CamState = {...rep, pos: [rep.target[0] + (rep.pos[0] - rep.target[0]) * k, rep.target[1] + (rep.pos[1] - rep.target[1]) * k, rep.target[2] + (rep.pos[2] - rep.target[2]) * k]};
	const toStorm = seg(t, B.stormGather - 0.1, B.liftOff + 0.2, easeInOut);
	const follow = seg(t, B.liftOff, B.heaven + 0.4, easeInOut);
	const mid = (EX() + elishaX(s6Tau(B.stormGather))) / 2;
	const stormCam = orbit(
		[lerp(mid, EX(), 0.55 * follow), 1.7 + 0.62 * liftY(Math.min(t, B.heaven + 0.6)) * follow, 0],
		keys(t, [[B.stormGather, 15], [B.liftOff, 15.5], [B.heaven, 17.5], [S6_END, 18]]),
		keys(t, [[B.stormGather, 6], [B.liftOff, 3], [B.whirlwindFull, -10], [B.heaven, -26], [S6_END, -34]]),
		3,
		keys(t, [[B.stormGather, 32], [B.heaven, 36]]),
		{shake: 0.25 * windAmt(t)},
	);
	if (toStorm <= 0) return c;
	const L = (a: number, b: number) => lerp(a, b, toStorm);
	return {
		pos: [L(c.pos[0], stormCam.pos[0]), L(c.pos[1], stormCam.pos[1]), L(c.pos[2], stormCam.pos[2])],
		target: [L(c.target[0], stormCam.target[0]), L(c.target[1], stormCam.target[1]), L(c.target[2], stormCam.target[2])],
		fov: L(c.fov, stormCam.fov),
		shake: L(c.shake ?? 0, stormCam.shake ?? 0),
	};
};

const groundDust = (count: number, x: number, z: number): ParticleSpec[] =>
	Array.from({length: count}, (_, i) => {
		const a = hash(61, i) * Math.PI * 2;
		const r = 0.6 + hash(62, i) * 1.8;
		return {
			birth: B.stormGather + (i / count) * (S6_END - B.stormGather),
			pos: [x + Math.cos(a) * r, 0.05, z + Math.sin(a) * r] as Vec3,
			vel: [-Math.sin(a) * 2.6, 0.5 + hash(63, i) * 1.4, Math.cos(a) * 2.6] as Vec3,
			life: 1.0 + hash(64, i) * 1.0,
			size: 2.4 + hash(65, i) * 2.6,
			seed: hash(66, i),
		};
	});

const Content: React.FC<{t: number; lite: boolean; cam?: CamState}> = ({t, lite, cam}) => {
	const τ = s6Tau(t);
	const c = cam ?? camera6(t);
	const a = camAngles(c);
	const st = stormAmt(t);
	const mood = mixMood(AFTERNOON, STORM, st);
	const w = windAmt(t);
	const ex = EX();
	const ground = jordanHeight(ex, EL_Z);
	const rising = t >= SWAP;
	const ly = liftY(t);
	const gone = seg(t, B.heaven - 0.15, B.heaven + 0.5);
	const cloak = cloakS6(t);
	const dust = useMemo(() => groundDust(lite ? 60 : 140, ex, EL_Z), [lite, ex]);
	const reach = t > B.liftOff + 0.25;
	return (
		<JordanAction
			τ={τ}
			t={t}
			lite={lite}
			mood={mood}
			camYaw={a.yaw}
			camPitch={a.pitch}
			hideElijah={rising}
			elishaPose={reach ? 'elisha/pose_reach' : undefined}
			holeDir={HOLE}
			teamTau={τ + 1.6 * Math.max(0, t - B.stormGather)}
			teamOpacity={1 - seg(t, B.liftOff - 0.7, B.liftOff)}
			extra={
				<>
					<LightBeam position={[ex, ground - 0.2, EL_Z]} height={70} rTop={7} rBottom={0.9} intensity={0.04 * st + 0.1 * pulse(t, B.heaven, 0.3, 1.0)} core={0.4} t={t} color="#ffdc96" />
					<Whirlwind position={[ex, ground - 0.05, EL_Z]} strength={w} t={t} lite={lite} order={100} dust="#a8957c" light="#ffe2a0" />
					<Particles specs={dust} t={t} gravity={0.6} drag={0.8} px={30} additive={false} colors={['#c9b08a', '#b39a78', '#9a8468']} opacity={0.45 * Math.min(1, w * 1.5)} swirl={0.4} renderOrder={95} fog />
					{rising && gone < 1 && (
						<CharacterRoot position={[ex, ground + ly, EL_Z]} pxPerM={RISE_PX} facing={-1} yaw={a.yaw} lean={a.pitch} shadow={null}>
							<group rotation-z={0.07 * Math.sin(t * 2.7)}>
								<PoseSprite sprite="elijah/pose_rise" renderOrder={105} look={{tint: mood.tint, light: 0.05 + 0.6 * gone, lightColor: '#ffe6b0', glow: 0.5 * gone, dissolve: gone, dissolveY: [ground + ly, ground + ly + 1.8], seed: 5.2}} />
							</group>
						</CharacterRoot>
					)}
					{rising && (
						<CharacterRoot position={cloak.pos} pxPerM={RIG_PX} facing={-1} yaw={a.yaw} lean={a.pitch} shadow={null}>
							<group rotation-z={cloak.rot}>
								<PoseSprite sprite="elijah/cloak" anchor={COLLAR} renderOrder={t < B.cloakSlip ? 104 : 106} look={{tint: mood.tint}} warp={{wave: [cloak.wave, 7, t * 6, 0.15]}} segs={[8, 26]} />
							</group>
						</CharacterRoot>
					)}
				</>
			}
		/>
	);
};

export const S6: ShotDef = {
	id: 'S6',
	start: B.replay,
	end: S6_END,
	Content,
	camera: camera6,
	fog: (t) => {
		const m = mixMood(AFTERNOON, STORM, stormAmt(t));
		return {color: m.fog, near: m.fogNear, far: m.fogFar};
	},
	grade: (t) => {
		const replay = 1 - seg(t, B.stormGather - 0.2, B.stormGather + 0.4);
		const st = stormAmt(t);
		return {
			exposure: 1.0 - 0.05 * st + 0.08 * pulse(t, B.heaven, 0.3, 1.0),
			saturation: 1.0 - 0.12 * replay + 0.05 * st,
			contrast: 1.04 + 0.06 * st,
			gain: [1.0 - 0.02 * replay, 1.0, 1.02 + 0.02 * replay],
			bloom: 0.35 + 0.25 * st,
			bloomThreshold: 0.85,
			vignette: 0.42 + 0.12 * st,
			flash: pulse(t, B.heaven + 0.05, 0.15, 0.6) * 0.3,
			flashColor: [1, 0.88, 0.6],
		};
	},
	anchors: (t) => jordanAnchors(s6Tau(t)),
};


// The cover: the same moment framed closer, looking up at Elijah in the whirlwind with Elisha reaching
// from below (kept inside Instagram's 4:5 grid crop). Never active in the reel timeline.
const T_COVER = 39.1;
const coverCam = (): CamState => orbit([EX() - 0.85, 2.15, EL_Z + 0.2], 7.6, -12, 10, 46, {drift: 0});
export const COVER: ShotDef = {
	id: 'COVER',
	start: -10,
	end: -9,
	Content: ({lite}) => <Content t={T_COVER} lite={lite} cam={coverCam()} />,
	camera: coverCam,
	fog: S6.fog ? () => S6.fog!(T_COVER) : undefined,
	grade: () => ({...S6.grade!(T_COVER), vignette: 0.5}),
};
