// S7 · Dusk after the storm. Elisha alone cries "My father, my father"; he sees him no more.
// Only the cloak comes floating down on a swinging arc; he kneels and picks it up as a light grows.
import {CharacterRoot, PoseSprite, STANDING_PX} from '../characters/Character';
import {elishaWalk} from '../characters/motion';
import {Rig} from '../characters/Rig';
import {RIGS, rigInfo} from '../characters/rig';
import {easeInOut, easeOut, keys, lerp, pulse, seg} from '../lib/ease';
import {B, SCENE} from '../lib/timeline';
import {orbit} from '../render/camera';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {Dust} from '../world/atmosphere';
import {jordanHeight, JordanWorld} from '../world/JordanWorld';
import {DUSK} from '../world/mood';
import {camAngles} from './Jordan';

const START = SCENE.S7.start - 0.5;
const END = SCENE.S8.start + 0.6;
const EX = 0.0;
const EZ = 0.3;
const ground = () => jordanHeight(EX, EZ);
const POSE_PX = STANDING_PX['elisha/poses'] / RIGS.elisha.heightM;
const RIG_PX = () => rigInfo('elisha').heightPx / RIGS.elisha.heightM;
const CLOAK_PX = STANDING_PX['elijah/side'] / RIGS.elijah.heightM;
const LAND: Vec3 = [EX + 0.8, 0, EZ + 0.25];

const T_CRY = B.myFather - 0.5;
const T_LOW = B.sawNoMore + 0.15;
const T_KNEEL = B.kneel;
const T_PICK = B.pickUp;

// The cloak's fall: a falling-leaf swing that narrows as it settles; it lies crumpled after landing.
export const cloakFall = (t: number) => {
	const t0 = B.cloakFloat;
	const t1 = B.cloakLand;
	const f = seg(t, t0, t1);
	const y = lerp(9.5, 0.2, 1 - Math.pow(1 - f, 1.35));
	// swing in front of and beside Elisha, never across his face (he stands at x = 0)
	const swing = Math.sin((t - t0) * 2.4) * (1 - f) * 1.1;
	const x = LAND[0] + 0.15 * (1 - f) + swing * (0.55 + 0.45 * (1 - f));
	const rot = -0.55 * Math.cos((t - t0) * 2.4) * (1 - f);
	const landed = seg(t, t1 - 0.12, t1 + 0.25, easeOut);
	const lift = seg(t, T_PICK + 0.45, T_PICK + 1.1, easeInOut);
	return {
		pos: [x, ground() + y + 0.45 * lift, LAND[2] + 0.2 * (1 - f)] as Vec3,
		rot: lerp(rot, -1.42, landed * (1 - lift)) + 0.3 * lift,
		squash: lerp(1, 0.4, landed * (1 - lift)),
		wave: 24 * (1 - landed) + 6 * lift,
		visible: t >= t0,
	};
};

const camera7 = (t: number): CamState => {
	const c = cloakFall(t);
	const follow = seg(t, B.cloakFloat - 0.3, B.cloakFloat + 0.4, easeInOut) * (1 - seg(t, B.cloakLand - 0.9, B.cloakLand + 0.2, easeInOut));
	const ty = keys(t, [[START, 6.5], [START + 1.6, 1.15], [B.cloakLand, 0.95], [END, 0.85]]) * (1 - follow) + (c.pos[1] * 0.75 + 0.6) * follow;
	const tx = lerp(EX + 0.3, c.pos[0], 0.5 * follow);
	const dist = keys(t, [[START, 12.5], [START + 1.6, 10], [B.sawNoMore, 8.8], [B.cloakFloat, 9.6], [B.cloakLand, 8.2], [END, 6.2]]);
	const pitch = keys(t, [[START, -22], [START + 1.6, 6], [B.cloakFloat - 0.3, 6]]) * (1 - follow) + -4 * follow;
	return orbit([tx, ty, 0.1], dist, pitch, keys(t, [[START, 4], [END, 9]]), 30, {drift: 0.8});
};

const Content: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const c = camera7(t);
	const a = camAngles(c);
	const mood = DUSK;
	const look = keys(t, [[T_LOW - 0.1, 0], [T_LOW + 0.5, -0.8], [B.cloakFloat - 0.2, -0.8], [B.cloakFloat + 0.4, 0.55], [B.cloakLand - 0.6, 0.2], [B.cloakLand, -0.5]]);
	const rig = elishaWalk(0, {amount: 0, t, lookUp: look});
	rig.angles.arm = -4 + 3 * Math.sin(t * 1.3);
	const pose = t < T_CRY ? 'elisha/pose_reach' : t < T_LOW ? 'elisha/pose_cry' : t < T_KNEEL ? null : t < T_PICK ? 'elisha/pose_kneel' : 'elisha/pose_pickup';
	const cl = cloakFall(t);
	const glow = seg(t, B.lightGrows - 0.4, END, easeInOut);
	const sob = t > B.myFather - 0.2 && t < T_LOW ? 0.012 * Math.sin(t * 9) : 0;
	return (
		<>
			<JordanWorld t={t} mood={mood} lite={lite} lightCenter={[EX, 0, -2]} holeDir={[0.1, 0.55, -0.83]} />
			<CharacterRoot position={[EX, ground(), EZ]} pxPerM={pose ? POSE_PX : RIG_PX()} yaw={a.yaw} lean={a.pitch} shadow={{w: 0.9, d: 0.34, opacity: 0.3, offset: [0.12, 0.05]}} shadowOrder={9}>
				{pose ? (
					<PoseSprite sprite={pose} renderOrder={300} look={{tint: mood.tint, light: 0.3 * glow, lightColor: '#ffe9c0'}} warp={{breath: 0.007 * Math.sin(t * 2.1) + sob}} />
				) : (
					<Rig blinkTime={t} name="elisha" pose={rig} renderOrder={300} look={{tint: mood.tint}} />
				)}
			</CharacterRoot>
			{cl.visible && (
				<CharacterRoot position={cl.pos} pxPerM={CLOAK_PX} yaw={a.yaw} lean={a.pitch} shadow={null}>
					<group rotation-z={cl.rot} scale={[cl.squash, 1, 1]}>
						<PoseSprite sprite="elijah/cloak" anchor={[220, 360]} renderOrder={t > T_PICK ? 320 : 310} look={{tint: mood.tint, light: 0.35 * glow, lightColor: '#ffe9c0'}} warp={{wave: [cl.wave, 7, t * 4.5, 0.1]}} segs={[8, 26]} />
					</group>
				</CharacterRoot>
			)}
			<Dust count={lite ? 40 : 110} center={[EX, 2.5, -1]} size={[14, 5, 8]} t={t} rise={0.03} px={5} opacity={0.4} seed={21} color="#ffd9b0" />
			<Dust count={lite ? 50 : 140} center={[LAND[0], 1.2, LAND[2]]} size={[1.6, 2.4, 1.2]} t={t} rise={0.18} px={8} opacity={1.2 * glow} seed={23} color="#ffe2a0" />
		</>
	);
};

export const S7: ShotDef = {
	id: 'S7',
	start: START,
	end: END,
	Content,
	camera: camera7,
	fog: () => ({color: DUSK.fog, near: DUSK.fogNear, far: DUSK.fogFar}),
	grade: (t) => {
		const g = seg(t, B.lightGrows - 0.4, END, easeInOut);
		return {
			exposure: 0.98 + 0.25 * g,
			saturation: 0.98,
			contrast: 1.03,
			gain: [1.03, 0.99, 0.98],
			bloom: 0.38 + 0.5 * g,
			bloomThreshold: 0.85 - 0.25 * g,
			vignette: 0.48 - 0.15 * g,
			flash: pulse(t, B.cloakLand, 0.05, 0.4) * 0.06,
		};
	},
	anchors: () => ({elisha: [EX, ground() + 1.85, EZ]}),
};
