// Night on the field. S1: in slow motion a dark hooded hand flings black seed over the moonlit wheat, the
// weeds burst up in a spreading wave and the camera pulls back over the whole field. S4: the faceless
// hooded shadow creeps through the rows sowing, then goes his way into the dark. Also the loop back to the
// first frame and the cover picture.
import {useMemo} from 'react';
import * as THREE from 'three';
import {amount, blend, gait, idle, sow, SOW_RELEASE, walk} from '../characters/acting';
import {Person, Pose, Puppet, RIGS} from '../characters/Puppet';
import {CharacterRoot} from '../characters/Character';
import {Particles} from '../fx/Particles';
import {clamp, easeInOut, keys, lerp, seg, smooth} from '../lib/ease';
import {B, WALK} from '../lib/timeline';
import {cameraBasis} from '../render/camera';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {FarmWorld, FieldPatch, MAIN, WheatState} from '../world/Field';
import {FIELD_NIGHT, Mood} from '../world/mood';
import {faceCam, Fireflies, fogOf, landPuffs, lookIn, NIGHT_GRADE, Seeds, throwSeeds} from './common';

const dirOf = (azDeg: number, elDeg: number): Vec3 => {
	const a = (azDeg * Math.PI) / 180;
	const e = (elDeg * Math.PI) / 180;
	return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
};

// moonlit wheat: silver-gold heads with a faint glow
export const NIGHT_WHEAT = {headGold: '#cdb27a', stemGold: '#8d7a55', headGreen: '#7f8f5a', stemGreen: '#5c6e3c', glow: '#e8dcc0', tareHead: '#16121b'};

// ------------------------------------------------------------------------------------------------
// S1 OPEN
// ------------------------------------------------------------------------------------------------
// the moon low over the hills, right behind the hand at the moment of the throw
const OPEN_MOOD: Mood = {...FIELD_NIGHT, sunDir: dirOf(14.4, 9), fogNear: 22, fogFar: 190};
const CAM_MACRO: Vec3 = [-1.0, 1.25, 5.25];
const fwd = (yawDeg: number, pitchDeg: number, d: number, from: Vec3): Vec3 => {
	const y = (yawDeg * Math.PI) / 180;
	const p = (pitchDeg * Math.PI) / 180;
	return [from[0] + Math.sin(y) * Math.cos(p) * d, from[1] + Math.sin(p) * d, from[2] - Math.cos(y) * Math.cos(p) * d];
};
const T_MACRO = fwd(18.3, 1.2, 4, CAM_MACRO);
const CAM_WIDE: Vec3 = [-2.0, 3.2, 11.5];
const T_WIDE: Vec3 = [-1.5, 1.0, -14];

const openCam = (t: number): CamState => {
	const k = easeInOut(seg(t, B.pullBack, B.s2 + 0.1, (x) => x));
	const push = smooth((t + 0.6) / 2.6) * 0.12;
	const p0: Vec3 = [CAM_MACRO[0], CAM_MACRO[1] + 0.02 * push, CAM_MACRO[2] - push];
	// the pull back rises fast first, then glides out
	const kr = 1 - Math.pow(1 - k, 2.2);
	return {
		pos: [lerp(p0[0], CAM_WIDE[0], k), lerp(p0[1], CAM_WIDE[1], kr), lerp(p0[2], CAM_WIDE[2], k)],
		target: [lerp(T_MACRO[0], T_WIDE[0], k), lerp(T_MACRO[1], T_WIDE[1], k), lerp(T_MACRO[2], T_WIDE[2], k)],
		fov: lerp(45, 48, k),
		drift: 0.5 + k * 0.5,
	};
};

// The hand: anchored at the wrist, which travels a designed path across the frame (screen x, y in px and
// distance from the camera), so the throw is framed exactly; the arm hangs back up out of the frame.
const WRIST_PATH: [number, number, number, number][] = [
	// t, screen x, screen y, distance
	[-0.7, 110, 360, 0.66],
	[-0.25, 220, 520, 0.64],
	[B.throw1, 330, 640, 0.63],
	[0.55, 560, 770, 0.66],
	[0.95, 650, 810, 0.7],
	[1.45, -260, 300, 0.7],
];
const wristScreen = (t: number) => {
	const P = WRIST_PATH;
	if (t <= P[0][0]) return P[0];
	for (let i = 1; i < P.length; i++) {
		if (t <= P[i][0]) {
			const k = easeInOut((t - P[i - 1][0]) / (P[i][0] - P[i - 1][0]));
			return [t, lerp(P[i - 1][1], P[i][1], k), lerp(P[i - 1][2], P[i][2], k), lerp(P[i - 1][3], P[i][3], k)] as [number, number, number, number];
		}
	}
	return P[P.length - 1];
};
const worldAtScreen = (cam: CamState, t: number, x: number, y: number, d: number): Vec3 => {
	const b = cameraBasis(cam, t);
	const ty = Math.tan((cam.fov * Math.PI) / 360);
	const sx = (x - 540) / 540;
	const sy = (960 - y) / 960;
	const p = b.pos.clone().addScaledVector(b.fwd, d).addScaledVector(b.right, sx * ty * (1080 / 1920) * d).addScaledVector(b.up, sy * ty * d);
	return [p.x, p.y, p.z];
};

// absolute angles (deg, on screen, 0 = hanging down, counter-clockwise) of the upper arm, forearm, hand
const armAngles = (t: number) => {
	const fling = seg(t, -0.05, 0.75, (x) => 1 - Math.pow(1 - x, 2.4));
	const back = seg(t, 0.95, 1.45);
	const fore = lerp(lerp(-35, 95, fling), 150, back);
	const upper = lerp(lerp(28, 62, fling), 130, back);
	const hand = lerp(lerp(-50, 25, seg(t, 0.0, 0.3)), 10, back);
	return {upper, fore, hand};
};

// forward kinematics of the macro arm: the wrist relative to the shoulder pivot (px, y up)
const MACRO = RIGS.enemy.macro!;
const vecOf = (child: string) => {
	const d = MACRO.parts[child];
	const parent = MACRO.parts[d.parent!];
	return [d.at![0] - parent.pivot[0], -(d.at![1] - parent.pivot[1])];
};
const rot = (v: number[], deg: number) => {
	const a = (deg * Math.PI) / 180;
	return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
};
const macroPose = (t: number): {pose: Pose; wrist: number[]} => {
	const A = armAngles(t);
	const e = rot(vecOf('forearm_near'), A.upper);
	const w = rot(vecOf('hand_near'), A.fore);
	const wrist = [e[0] + w[0], e[1] + w[1]];
	const open = t >= B.throw1;
	return {
		pose: {
			angles: {arm_upper_near: A.upper, forearm_near: A.fore - A.upper, hand_near: A.hand},
			variants: {hand_near: open ? (t > 1.05 ? 'open' : 'splay') : 'fist'},
			lift: [-wrist[0], -wrist[1]],
		},
		wrist,
	};
};
const MACRO_PX_PER_M = 3300;

// the black seed leaves the palm at the release
const G_SLOW = 1.9;
const openSeeds = (() => {
	const cam = openCam(B.throw1);
	const w = wristScreen(B.throw1);
	const at = worldAtScreen(cam, B.throw1, w[1] + 40, w[2] + 50, w[3]);
	return throwSeeds({t0: B.throw1, from: at, dir: [0.62, -0.78], n: 46, speed: 0.95, spread: 1.0, up: 0.3, g: G_SLOW, ground: 0.8, seed: 41, dur: 0.12});
})();
// where the weeds start bursting from (the middle of the landing spots)
const BURST_AT: [number, number] = (() => {
	const xs = openSeeds.map((s) => s.p0[0] + s.v0[0] * s.land);
	const zs = openSeeds.map((s) => s.p0[2] + s.v0[2] * s.land);
	return [xs.reduce((a, b) => a + b) / xs.length, zs.reduce((a, b) => a + b) / zs.length];
})();

// the field with a detailed patch around the lens, a clearing where the camera stands
const HOLE: [number, number, number, number] = [-3.6, 1.6, -1.4, 7.0];
const OPEN_PATCH: FieldPatch = {...MAIN, hole: HOLE};
const OPEN_HERO: FieldPatch = {x0: HOLE[0], x1: HOLE[1], z0: HOLE[2], z1: HOLE[3], row: 0.3, step: 0.17, tare: 0.24, seed: 11, detail: 'hero', path: false, chunk: 2, clear: [CAM_MACRO[0], CAM_MACRO[2], 0.75]};

// slow motion until the weeds burst, a time-lapse rush while they grow, then real time
const openWindTime = (t: number) => (t < B.burst ? 0.22 * t : t < B.burstEnd ? 0.22 * B.burst + 2.2 * (t - B.burst) : 0.22 * B.burst + 2.2 * (B.burstEnd - B.burst) + (t - B.burstEnd));

export const openWheat = (t: number): WheatState => ({
	time: openWindTime(t),
	wind: 0.85,
	grow: 1,
	ripe: 1,
	tareDark: 1,
	tareShow: seg(t, B.burst, B.burstEnd + 1.4, (x) => x),
	tareWave: [BURST_AT[0], BURST_AT[1], 26],
	spots: 0,
	glow: 0.075,
});

// the enemy, small in the wide: walking away up the rows after the throw
const enemyAway = (t: number) => {
	const t0 = 1.2;
	const p0: Vec3 = [-2.55, 0, 3.9];
	const speed = 0.62;
	const d = Math.max(0, t - t0) * speed;
	return {pos: [p0[0] + d * 0.12, 0, p0[2] - d] as Vec3, phase: (t - t0) / WALK.enemy.period};
};

const OpenContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const cam = openCam(t);
	const w = wristScreen(t);
	const at = worldAtScreen(cam, t, w[1], w[2], w[3]);
	const mp = macroPose(t);
	const fc = faceCam(cam, at, 1);
	// the hand against the moon: nearly a silhouette, a thin cold edge of moonlight
	const look = lookIn(OPEN_MOOD, cam, {rimLight: 0.22, rimColor: '#8da4d8', rimDir: [-0.3, 0.9], celAmount: 0.5, tint: '#8f9ab8'});
	const puffs = useMemo(() => landPuffs(openSeeds, G_SLOW, 2), []);
	const ea = enemyAway(t);
	const efc = faceCam(cam, ea.pos);
	const ws = openWheat(t);
	return (
		<>
			<FarmWorld
				t={t}
				mood={OPEN_MOOD}
				lite={lite}
				center={[-1, 0, 2]}
				span={14}
				wheat={ws}
				patch={OPEN_PATCH}
				hero={OPEN_HERO}
				wheatColors={NIGHT_WHEAT}
				eye={cam.pos}
			/>
			{t < 1.5 && (
				<CharacterRoot position={at} pxPerM={MACRO_PX_PER_M} yaw={fc.yaw} lean={fc.lean} shadow={null}>
					<Puppet id="enemy" view="macro" pose={mp.pose} t={t} look={look} renderOrder={40} castShadow={false} />
				</CharacterRoot>
			)}
			<Seeds specs={openSeeds} t={t} g={G_SLOW} size={0.0068} color="#16141a" emissive="#000000" glow={0} rim={[0.55, 0.65, 0.95, 1.4]} />
			<Particles specs={puffs} t={t} gravity={-0.4} drag={1.5} additive={false} colors={['#4a4a5a', '#3a3a48', '#2a2a36']} opacity={0.5} px={9} swirl={0.02} />
			{t > 1.0 && (
				<Person
					id="enemy"
					view="back"
					position={ea.pos}
					pose={blend(walk(ea.phase, {stride: 20, knee: 26, arms: 8, lean: 6, bounce: 6}), idle(t, 4, {sway: 0.5}))}
					t={t}
					yaw={efc.yaw}
					lean={efc.lean}
					look={lookIn(OPEN_MOOD, cam, {rimLight: 0.45, rimColor: '#9fb6ea', rimDir: [0.4, 0.8], tint: '#7a84a4'})}
					shadow={{w: 0.7, d: 0.3, opacity: 0.35}}
					renderOrder={30}
				/>
			)}
			<Fireflies t={t} center={[-1.2, 1.25, 1.5]} size={[12, 1.2, 9]} count={70} px={7} />
		</>
	);
};

export const OPEN: ShotDef = {
	id: 'OPEN',
	start: 0,
	end: B.s2 + 0.3,
	Content: OpenContent,
	camera: openCam,
	grade: (t) => ({...NIGHT_GRADE, exposure: 1.06 + 0.04 * seg(t, B.burst, B.burstEnd)}),
	fog: () => fogOf(OPEN_MOOD),
	dof: (t) => {
		const ap = keys(t, [
			[0.85, 26],
			[2.0, 18],
			[3.0, 0],
		]);
		const focus = keys(t, [
			[0.9, 0.66],
			[1.5, 1.7],
			[2.2, 3.2],
			[3.0, 10],
		]);
		return ap > 0.1 ? {focus, aperture: ap, max: 24} : null;
	},
};

// The last moments loop back into the first frame: the same shot, with time running up to zero.
export const LOOP: ShotDef = {
	...OPEN,
	id: 'LOOP',
	start: B.loopOut - 0.6,
	end: B.total + 1,
	Content: ({t, lite}) => <OpenContent t={t - B.total} lite={lite} />,
	camera: (t) => openCam(t - B.total),
	grade: (t) => OPEN.grade!(t - B.total),
	dof: (t) => OPEN.dof!(t - B.total),
};

// The cover: the wide over the moonlit field, the weeds risen, the shadow walking away.
export const COVER: ShotDef = {
	...OPEN,
	id: 'COVER',
	start: -100,
	end: -99,
	Content: ({lite}) => <OpenContent t={4.1} lite={lite} />,
	camera: () => openCam(4.1),
	grade: () => ({...NIGHT_GRADE, exposure: 1.1, vignette: 0.7}),
	dof: () => null,
};

// ------------------------------------------------------------------------------------------------
// S4 ENEMY: while men slept
// ------------------------------------------------------------------------------------------------
// the moon off to the right: it rims the hooded figure and lights the wheat from the side
const ENEMY_MOOD: Mood = {...FIELD_NIGHT, sunDir: dirOf(14, 13), fogNear: 26, fogFar: 200};
const EN_P0: Vec3 = [0.0, 0, -2.2];
const EN_DIR: [number, number] = [-0.42, -0.91];
const EN_SPEED = 0.82; // m/s
const enemyPos = (t: number): Vec3 => {
	const d = Math.max(0, t - B.enemyIn) * EN_SPEED;
	return [EN_P0[0] + EN_DIR[0] * d, 0, EN_P0[2] + EN_DIR[1] * d];
};
const enemyCam = (t: number): CamState => {
	const k = seg(t, B.s4, B.wentHisWay + 0.3, (x) => x);
	const c0: Vec3 = [1.5, 1.85, 3.9];
	const c1: Vec3 = [0.6, 1.8, 1.9];
	const e = enemyPos(Math.min(t, B.wentHisWay + 0.4));
	return {
		pos: [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)],
		target: [lerp(-2.6, e[0], 0.75), 1.05, lerp(-12, e[2], 0.75)],
		fov: 38,
		drift: 1.2,
	};
};
// the three throws: each is one sow cycle ending at its release time
const THROWS = [B.blackSow1, B.blackSow2, B.blackSow3];
const SOW_T = 0.78;
const throwPhase = (t: number) => {
	for (const r of THROWS) {
		const a = r - SOW_RELEASE * SOW_T;
		if (t >= a && t < a + SOW_T) return (t - a) / SOW_T;
	}
	return -1;
};
// the release happens at the near hand: estimate it from the body and stride
const enemySeeds = THROWS.map((r, i) => {
	const p = enemyPos(r);
	const from: Vec3 = [p[0] + EN_DIR[0] * 0.45, 1.45, p[2] + EN_DIR[1] * 0.45];
	const a = Math.atan2(EN_DIR[1], EN_DIR[0]) + (i - 1) * 0.35;
	return throwSeeds({t0: r, from, dir: [Math.cos(a), Math.sin(a)], n: 22, speed: 2.2, spread: 0.9, up: 1.4, g: 9.8, ground: 0.05, seed: 70 + i, dur: 0.08});
}).flat();

const EnemyContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const cam = enemyCam(t);
	const p = enemyPos(t);
	const fc = faceCam(cam, p);
	const phase = (t - B.enemyIn) / WALK.enemy.period + WALK.enemy.phase;
	const sp = throwPhase(t);
	const sowK = sp >= 0 ? Math.sin(Math.PI * clamp(sp * 1.15)) : 0;
	const pose = blend(
		walk(phase, {stride: 24, knee: 30, arms: 9, lean: 8, bounce: 7}),
		sp >= 0 ? amount(sow(sp), 1) : null,
		{angles: {head: -6, torso: -3 * (1 - sowK)}},
		idle(t, 7, {sway: 0.4}),
	);
	// he goes his way: away into the dark
	const gone = seg(t, B.wentHisWay + 0.15, B.s5 - 0.05);
	const puffs = useMemo(() => landPuffs(enemySeeds, 9.8, 2), []);
	return (
		<>
			<FarmWorld t={t} mood={ENEMY_MOOD} lite={lite} center={[p[0], 0, p[2] - 2]} span={12} wheat={{time: t, wind: 0.8, grow: 1, ripe: 1, tareDark: 1, tareShow: 0, spots: 0, glow: 0.07}} wheatColors={NIGHT_WHEAT} eye={cam.pos} />
			<Person
				id="enemy"
				view="side"
				position={p}
				facing={-1}
				pose={pose}
				t={t}
				yaw={fc.yaw}
				lean={fc.lean * 0.5}
				look={lookIn(ENEMY_MOOD, cam, {rimLight: 0.3, rimColor: '#a9bdf0', rimDir: [0.7, 0.5], tint: '#8a93b2', opacity: 1 - gone})}
				shadow={{w: 0.8, d: 0.34, opacity: 0.35 * (1 - gone)}}
				renderOrder={30}
			/>
			<Seeds specs={enemySeeds} t={t} g={9.8} size={0.011} color="#16141a" hideAfter={0.2} rim={[0.55, 0.65, 0.95, 1.2]} />
			<Particles specs={puffs} t={t} gravity={-0.6} drag={1.4} additive={false} colors={['#454456', '#353545', '#262632']} opacity={0.55} px={14} swirl={0.02} />
			<Fireflies t={t} center={[0, 1.2, 0]} size={[16, 1.6, 14]} count={80} px={8} seed={9} />
		</>
	);
};

export const ENEMY: ShotDef = {
	id: 'ENEMY',
	start: B.s4 - 0.3,
	end: B.s5 + 0.4,
	Content: EnemyContent,
	camera: enemyCam,
	grade: () => ({...NIGHT_GRADE, vignette: 0.6}),
	fog: () => fogOf(ENEMY_MOOD),
	dof: (t) => {
		const e = enemyPos(t);
		const c = enemyCam(t).pos;
		return {focus: Math.hypot(e[0] - c[0], e[2] - c[2]), range: 2.5, aperture: 10, max: 16};
	},
};

void THREE;
void gait;
