// S3–S4 · Elijah and Elisha walk and talk by the Jordan; "suddenly" they stop and look up,
// and the chariot of fire bursts in between them. The same action is reused by the S5 freeze
// and the S6 slow-motion replay (they pass their own story time τ).
import {CharacterRoot, PoseSprite, STANDING_PX} from '../characters/Character';
import {elijahWalk, elishaWalk, walkedX, walkPhase, walkSpeed} from '../characters/motion';
import {Rig} from '../characters/Rig';
import {RIGS, rigInfo} from '../characters/rig';
import {useMemo} from 'react';
import {dustRingSpecs, fireNear, recoil, sparkSpecs, TEAM_SCALE, teamState} from '../fx/chariot';
import {FireTeam} from '../fx/FireTeam';
import {Particles} from '../fx/Particles';
import {TEAM_CENTER} from '../fx/team';
import {easeInOut, keys, lerp, pulse, seg} from '../lib/ease';
import {B, SCENE} from '../lib/timeline';
import {orbit} from '../render/camera';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {jordanHeight, JordanWorld} from '../world/JordanWorld';
import {AFTERNOON, Mood} from '../world/mood';

export const EL_Z = -0.55;
export const ES_Z = 0.55;
const T3 = SCENE.S3.start;
const elPx = () => rigInfo('elijah').heightPx / RIGS.elijah.heightM;
const esPx = () => rigInfo('elisha').heightPx / RIGS.elisha.heightM;
const EL_LEG = 330;
const EL_STOP = B.steps.elijah[B.steps.elijah.length - 1] + 0.05;
const ES_STOP = B.steps.elisha[B.steps.elisha.length - 1] + 0.05;
const EL_END = 1.0;
const ES_END = -0.45;

const vEl = () => walkSpeed.elijah(elPx(), EL_LEG);
const vEs = () => walkSpeed.elisha(esPx());
const elWalk = (τ: number) => EL_END - walkedX(1e9, T3, EL_STOP, vEl()) + walkedX(τ, T3, EL_STOP, vEl());
const esWalk = (τ: number) => ES_END - walkedX(1e9, T3, ES_STOP, vEs()) + walkedX(τ, T3, ES_STOP, vEs());

export const elijahX = (τ: number) => elWalk(τ) + 0.55 * recoil(τ);
export const elishaX = (τ: number) => esWalk(τ) - 0.7 * recoil(τ);
export const elishaZ = (τ: number) => ES_Z + 0.3 * recoil(τ);
// On "suddenly" Elijah turns back to face Elisha (a quick card-flip turn).
const TURN = B.suddenly + 0.16;
export const elijahFacing = (τ: number) => {
	const f = Math.cos(Math.PI * seg(τ, TURN, TURN + 0.2, easeInOut));
	return Math.abs(f) < 0.03 ? Math.sign(f || 1) * 0.03 : f; // never a zero scale
};

const amountAfter = (τ: number, tStop: number) => (τ < tStop ? 1 : 1 - seg(τ, tStop, tStop + 0.45));
const shieldOf = (τ: number) => seg(τ, B.chariotBurst - 0.12, B.chariotBurst + 0.22) * (1 - 0.45 * seg(τ, B.chariotBurst + 1.4, B.chariotBurst + 2.4));

export type JordanState = {
	τ: number;
	t: number;
	lite: boolean;
	mood: Mood;
	camYaw: number;
	camPitch: number;
	extra?: React.ReactNode;
	hideElijah?: boolean;
	elishaPose?: string; // draw Elisha as this pose sprite instead of the rig
	holeDir?: [number, number, number];
	teamTau?: number; // the chariot can run on its own clock (S6 sends it away faster)
	teamOpacity?: number;
};

export const JordanAction: React.FC<JordanState> = ({τ, t, lite, mood, camYaw, camPitch, extra, hideElijah, elishaPose, holeDir, teamTau, teamOpacity = 1}) => {
	const xe = elijahX(τ);
	const xs = elishaX(τ);
	const zs = elishaZ(τ);
	const talkE = seg(τ, B.s3 + 4.4, B.s3 + 4.7) * (1 - seg(τ, B.suddenly - 0.5, B.suddenly));
	const talkS = seg(τ, B.s3 + 5.6, B.s3 + 5.9) * (1 - seg(τ, B.suddenly - 0.3, B.suddenly)) * 0.7;
	const look = seg(τ, B.lookUp, B.lookUp + 0.7, easeInOut);
	const shield = shieldOf(τ);
	const poseE = elijahWalk(walkPhase('elijah', τ, T3), {amount: amountAfter(τ, EL_STOP), t: τ, talk: talkE, lookUp: look * (1 - 0.6 * shield)});
	poseE.angles.arm_upper_near = lerp(poseE.angles.arm_upper_near, 108, shield);
	poseE.angles.forearm_near = lerp(poseE.angles.forearm_near, 72, shield);
	poseE.angles.torso += 7 * shield;
	const poseS = elishaWalk(walkPhase('elisha', τ, T3), {amount: amountAfter(τ, ES_STOP), t: τ, talk: talkS, lookUp: look * (1 - 0.5 * shield)});
	poseS.angles.arm = lerp(poseS.angles.arm, 112, shield);
	poseS.angles.body += 6 * shield;
	const team = teamState(teamTau ?? τ);
	team.opacity *= teamOpacity;
	team.active = team.active && team.opacity > 0.001;
	const near = fireNear(τ);
	const fireLook = {light: 0.22 * near, lightColor: '#ffa060', glow: 0.04 * near};
	const sparks = useMemo(() => sparkSpecs(lite ? 220 : 520), [lite]);
	const ring = useMemo(() => dustRingSpecs(lite ? 26 : 48, [0.1, jordanHeight(0.1, 0), 0], B.chariotBurst + 0.24), [lite]);
	const tc: [number, number, number] = [team.pos[0] + TEAM_CENTER[0] * TEAM_SCALE * team.facing, team.pos[1] + TEAM_CENTER[1] * TEAM_SCALE, team.pos[2]];
	return (
		<>
			<JordanWorld t={t} mood={mood} lite={lite} lightCenter={[(xe + xs) / 2, 0, -2]} holeDir={holeDir} />
			{!hideElijah && <CharacterRoot position={[xe, jordanHeight(xe, EL_Z), EL_Z]} pxPerM={elPx()} facing={elijahFacing(τ)} yaw={camYaw} lean={camPitch} shadow={{w: 1.0, d: 0.38, opacity: 0.32, offset: [0.12, 0.05]}} shadowOrder={8}>
				<Rig name="elijah" pose={poseE} renderOrder={100} look={{tint: mood.tint, ...fireLook}} />
			</CharacterRoot>}
			<CharacterRoot position={[xs, jordanHeight(xs, zs), zs]} pxPerM={elishaPose ? STANDING_PX['elisha/poses'] / RIGS.elisha.heightM : esPx()} yaw={camYaw} lean={camPitch} shadow={{w: 0.9, d: 0.34, opacity: 0.32, offset: [0.12, 0.05]}} shadowOrder={9}>
				{elishaPose ? (
					<PoseSprite sprite={elishaPose} renderOrder={300} look={{tint: mood.tint}} warp={{breath: 0.006 * Math.sin(t * 2.2)}} />
				) : (
					<Rig name="elisha" pose={poseS} renderOrder={300} look={{tint: mood.tint, ...fireLook}} />
				)}
			</CharacterRoot>
			{team.active && (
				<>
					<FireTeam pose={team.pose} position={team.pos} facing={team.facing} scale={TEAM_SCALE} yaw={camYaw} lean={camPitch} intensity={team.intensity} opacity={team.opacity} renderOrder={200} />
					<pointLight position={[tc[0], tc[1] + 0.4, tc[2] + 0.6]} color="#ff8f45" intensity={24 * team.opacity * (0.85 + 0.15 * Math.sin(τ * 23))} distance={0} decay={1.7} />
				</>
			)}
			<Particles specs={sparks} t={τ} gravity={1.4} drag={1.2} px={11} renderOrder={250} />
			<Particles specs={ring} t={τ} gravity={0.15} drag={2.2} px={34} additive={false} colors={['#d9c39a', '#c8ad82', '#b39a76']} opacity={0.5} swirl={0.05} renderOrder={150} fog />
			{extra}
		</>
	);
};

export const jordanAnchors = (τ: number): Record<string, Vec3> => {
	const xe = elijahX(τ);
	const xs = elishaX(τ);
	return {
		elijah: [xe + 0.05, jordanHeight(xe, EL_Z) + 1.95, EL_Z],
		elisha: [xs + 0.05, jordanHeight(xs, elishaZ(τ)) + 1.85, elishaZ(τ)],
		gap: [(xe + xs) / 2, 1.2, 0],
	};
};

// Pitch and yaw of a camera, so the cut-outs can face it.
export const camAngles = (c: CamState) => {
	const dx = c.pos[0] - c.target[0];
	const dy = c.pos[1] - c.target[1];
	const dz = c.pos[2] - c.target[2];
	return {pitch: Math.atan2(dy, Math.hypot(dx, dz)), yaw: Math.atan2(dx, dz)};
};

const S34_START = SCENE.S3.start - 0.5;

// Camera: tracking walk; on "suddenly" push in, then crane down and look up at the sky as the fire
// dives toward them; snap wide for the impact; drift up so the climbing chariot stays in frame.
export const camera34 = (t: number): CamState => {
	const mid = (elijahX(Math.min(t, B.chariotBurst)) + elishaX(Math.min(t, B.chariotBurst))) / 2 + 0.15;
	const midW = (elijahX(t) + elishaX(t)) / 2 + 0.1;
	const wide = seg(t, B.chariotBurst - 0.12, B.chariotBurst + 0.35, easeInOut);
	const tx = lerp(mid, midW, wide);
	const up = seg(t, B.lookUp + 0.2, B.chariotBurst - 0.35, easeInOut) * (1 - wide);
	const climb = seg(t, B.chariotBurst + 1.7, B.freeze, easeInOut);
	const dist = keys(t, [[S34_START, 13.5], [B.elijahLabel, 12.5], [B.wrong, 11.6], [B.suddenly, 11.2], [B.lookUp + 0.4, 10.4]]) * (1 - wide) + keys(t, [[B.chariotBurst, 14.2], [B.chariotBurst + 1.5, 14.8], [B.freeze, 15.6]]) * wide - 1.6 * up;
	const pitch = keys(t, [[S34_START, 8], [B.suddenly, 8], [B.lookUp + 0.4, 5]]) * (1 - up) * (1 - wide) - 12 * up + (6 - 10 * climb) * wide;
	const ty = 1.0 + 1.7 * up + (1.35 + 1.25 * climb) * wide * (1 - up);
	const shake = pulse(t, B.chariotBurst + 0.2, 0.04, 0.7) * 1.1 + 0.22 * teamState(t).hover;
	const fov = keys(t, [[S34_START, 28], [B.lookUp, 28], [B.chariotBurst - 0.3, 31], [B.chariotBurst + 0.4, 32]]);
	return orbit([tx, ty, 0], dist, pitch, keys(t, [[S34_START, 6], [B.freeze, 3]]), fov, {shake});
};

export const S34: ShotDef = {
	id: 'S34',
	start: S34_START,
	end: B.freeze,
	Content: ({t, lite}) => {
		const a = camAngles(camera34(t));
		return <JordanAction τ={t} t={t} lite={lite} mood={AFTERNOON} camYaw={a.yaw} camPitch={a.pitch} />;
	},
	camera: camera34,
	fog: () => ({color: AFTERNOON.fog, near: AFTERNOON.fogNear, far: AFTERNOON.fogFar}),
	grade: (t) => {
		const f = fireNear(t);
		return {
			exposure: 1.0 - 0.06 * seg(t, B.lookUp, B.chariotBurst),
			saturation: 1.04 + 0.08 * f,
			contrast: 1.04 + 0.05 * f,
			gain: [1.02 + 0.06 * f, 1.0, 0.97 - 0.08 * f],
			bloom: 0.35 + 0.2 * f,
			bloomThreshold: 0.85 + 0.1 * f,
			vignette: 0.38 + 0.1 * f,
			flash: pulse(t, B.chariotBurst + 0.22, 0.04, 0.3) * 0.28,
			flashColor: [1, 0.72, 0.42],
			shimmer: 0.9 * teamState(t).hover,
			shimmerRect: [0.05, 0.25, 0.95, 0.75],
		};
	},
	anchors: (t) => jordanAnchors(t),
};
