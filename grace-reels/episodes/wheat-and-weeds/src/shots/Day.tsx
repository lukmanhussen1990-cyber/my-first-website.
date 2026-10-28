// The field by day. S3 the farmer sows glowing seed at sunrise; S5 the time-lapse (tares look like wheat,
// then turn dark) and the puzzled servants; S6 "An enemy hath done this"; S7 (above ground) a servant
// grabs a weed and the farmer's gentle "Nay"; S8 both grow together; S9 the push into a single stalk with
// its dark spot; S10 the hourglass of light; S12 the harvest; S13 the warm background for the question.
import {useMemo} from 'react';
import * as THREE from 'three';
import {blend, carry, grabPull, happy, idle, noHand, pointAt, puzzled, reap, sow, SOW_RELEASE, talk, walk} from '../characters/acting';
import {CharId, Person, Pose, View} from '../characters/Puppet';
import {Particles, ParticleSpec} from '../fx/Particles';
import {Glow} from '../fx/Flame';
import {clamp, easeInOut, easeOut, keys, lerp, seg, smooth} from '../lib/ease';
import {hash} from '../lib/random';
import {B, WALK} from '../lib/timeline';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {Dust, LightBeam} from '../world/atmosphere';
import {BARN_AT, FarmWorld, FieldPatch, MAIN, onPath, Wheat, WheatState} from '../world/Field';
import {FIELD_DAY, FIELD_GOLDEN, FIELD_SUNRISE, Mood} from '../world/mood';
import {DAY_GRADE, faceCam, Fireflies, fogOf, GOLDEN_GRADE, landPuffs, lookIn, Seeds, SUNRISE_GRADE, throwSeeds} from './common';

const dirOf = (azDeg: number, elDeg: number): Vec3 => {
	const a = (azDeg * Math.PI) / 180;
	const e = (elDeg * Math.PI) / 180;
	return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
};
const far = (cam: CamState, dir: Vec3, d = 600): Vec3 => [cam.pos[0] + dir[0] * d, cam.pos[1] + dir[1] * d, cam.pos[2] + dir[2] * d];

// A person who faces this camera, lit by this mood.
const Who: React.FC<{id: CharId; view: View; at: Vec3; pose: Pose; t: number; cam: CamState; mood: Mood; facing?: number; seed?: number; order?: number; lookExtra?: object}> = ({id, view, at, pose, t, cam, mood, facing = 1, seed = 1, order = 30, lookExtra}) => {
	const fc = faceCam(cam, at);
	return <Person id={id} view={view} position={at} pose={pose} t={t} facing={facing} yaw={fc.yaw} lean={fc.lean * 0.6} look={lookIn(mood, cam, lookExtra)} blinkSeed={seed} renderOrder={order} shadow={{w: 0.75, d: 0.3, opacity: 0.25}} />;
};

// ------------------------------------------------------------------------------------------------
// S3 SOW: sunrise, bare furrows, the farmer flings arcs of glowing golden seed
// ------------------------------------------------------------------------------------------------
const SOW_MOOD: Mood = {...FIELD_SUNRISE, sunDir: dirOf(7, 6)};
const SOW_T = B.sow2 - B.sow1;
const farmerX = (t: number) => -3.6 + 1.08 * (t - 6.6);
const FZ = 0.2;
const sowCam = (t: number): CamState => {
	const x = farmerX(t);
	return {pos: [x + 0.9, 0.62, FZ + 5.4], target: [x + 0.55, 1.15, FZ], fov: 38, drift: 0.8};
};
// the hand at the moment of each release (forward and up from the shoulder)
const sowSeeds = [B.sow1, B.sow2].flatMap((r, i) => {
	const x = farmerX(r);
	return throwSeeds({t0: r, from: [x + 0.62, 1.62, FZ + 0.05], dir: [0.55, -0.83], n: 30, speed: 2.4, spread: 1.1, up: 1.3, g: 9.8, ground: 0.05, seed: 120 + i, dur: 0.09});
});

const SowContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const cam = sowCam(t);
	const x = farmerX(t);
	const p = (t - (B.sow1 - SOW_RELEASE * SOW_T)) / SOW_T;
	const w = walk((t - 6.6) / WALK.farmer.period, {stride: 22, knee: 32, arms: 14, lean: 2});
	delete w.angles!.arm_upper_near;
	delete w.angles!.forearm_near;
	const pose = blend(w, sow(p), {angles: {head: 4}, variants: {mouth: 'smile'}}, idle(t, 2, {sway: 0.3}));
	const puffs = useMemo(() => landPuffs(sowSeeds, 9.8, 3), []);
	return (
		<>
			<FarmWorld t={t} mood={SOW_MOOD} lite={lite} center={[x, 0, FZ]} span={8} eye={cam.pos} />
			<Who id="farmer" view="side" at={[x, 0, FZ]} pose={pose} t={t} cam={cam} mood={SOW_MOOD} seed={3} lookExtra={{rimLight: 0.6, rimColor: '#ffd38a', rimDir: [0.7, 0.4]}} />
			<Seeds specs={sowSeeds} t={t} g={9.8} size={0.011} color="#f2c35a" emissive="#ffc95a" glow={1.6} trail={{len: 0.2, color: '#ffcf6a', px: 30, opacity: 0.9}} hideAfter={0.5} />
			<Particles specs={puffs} t={t} gravity={-0.5} drag={1.4} additive={false} colors={['#c9a67c', '#a88760', '#8a6c4c']} opacity={0.5} px={16} swirl={0.02} />
			<Dust count={140} center={[x + 1, 1.2, FZ - 1]} size={[8, 2.4, 6]} t={t} color="#ffd9a0" opacity={0.7} px={6} />
		</>
	);
};

export const SOW: ShotDef = {
	id: 'SOW',
	start: B.s3 - 0.3,
	end: B.s4 + 0.3,
	Content: SowContent,
	camera: sowCam,
	grade: () => ({...SUNRISE_GRADE, bloom: 0.6, bloomThreshold: 0.75}),
	fog: () => fogOf(SOW_MOOD),
	rays: (t) => ({at: far(sowCam(t), SOW_MOOD.sunDir), strength: 0.5, color: [1, 0.82, 0.5]}),
	dof: (t) => {
		const c = sowCam(t);
		return {focus: Math.hypot(c.pos[0] - farmerX(t), c.pos[2] - FZ), range: 1.2, aperture: 9, max: 14};
	},
};

// ------------------------------------------------------------------------------------------------
// S5 GROW: the time-lapse. Green blades, all alike; then the tares turn dark. The servants come, puzzled.
// ------------------------------------------------------------------------------------------------
const growCam = (t: number): CamState => ({pos: [5.6, 1.55, 5.4], target: [3.0, 0.85, -2.6], fov: 40, drift: 0.25 + 0.6 * seg(t, B.servantsIn - 0.5, B.servantsIn + 1)});
const growMood = (t: number): Mood => {
	// the sun swings over the field while the plants grow (shadows sweep in the time-lapse)
	const k = seg(t, B.growStart, B.weedsStart + 0.6, (x) => x);
	return {...FIELD_DAY, sunDir: dirOf(lerp(-80, -35, k), lerp(16, 34, Math.sin(Math.PI * k) * 0.7 + k * 0.3))};
};
const growTime = (t: number) => {
	// the wind races while the time-lapse runs, then settles to real time
	const a = B.growStart;
	const b = B.weedsStart + 0.6;
	return t < a ? t : t < b ? a + 4 * (t - a) : a + 4 * (b - a) + (t - b);
};
export const growWheat = (t: number): WheatState => ({
	time: growTime(t),
	wind: 0.9,
	grow: seg(t, B.growStart, B.growStart + 1.9, (x) => 1 - Math.pow(1 - x, 1.6)),
	ripe: 0.55 * seg(t, B.growStart + 1.2, B.s6),
	tareDark: seg(t, B.tareTurn, B.tareDark),
	tareShow: 1,
	spots: 0,
	glow: 0,
});
// the servants walk down the path and stop, looking at the dark weeds
const SERVANTS: {id: CharId; stop: Vec3; delay: number; seed: number}[] = [
	{id: 'servantA', stop: [3.55, 0, 0.9], delay: 0, seed: 11},
	{id: 'servantB', stop: [2.55, 0, -0.25], delay: 0.25, seed: 12},
	{id: 'servantC', stop: [3.85, 0, -1.2], delay: 0.45, seed: 13},
];
const servantAt = (s: (typeof SERVANTS)[number], t: number) => {
	const walkIn = 1.5;
	const k = easeOut(seg(t, B.servantsIn + s.delay, B.servantsIn + s.delay + walkIn, (x) => x));
	const from: Vec3 = [s.stop[0] - 0.9, 0, s.stop[2] - 3.2];
	return {pos: [lerp(from[0], s.stop[0], k), 0, lerp(from[2], s.stop[2], k)] as Vec3, moving: k > 0 && k < 0.98, k};
};

const GrowContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const cam = growCam(t);
	const mood = growMood(t);
	const ws = growWheat(t);
	return (
		<>
			<FarmWorld t={t} mood={mood} lite={lite} center={[3, 0, -1]} span={10} wheat={ws} eye={cam.pos} cloudDrift={0.004 + 0.03 * seg(t, B.growStart, B.weedsStart, (x) => Math.sin(Math.PI * x))} />
			{SERVANTS.map((s, i) => {
				if (t < B.servantsIn + s.delay - 0.1) return null;
				const a = servantAt(s, t);
				const ph = (t - B.servantsIn - s.delay) / WALK.servant.period;
				const pz = puzzled(t + i, smooth((t - (B.servantsIn + s.delay + 1.3)) / 0.5));
				const pose = blend(a.moving ? walk(ph, {amount: 1 - smooth((a.k - 0.8) / 0.2)}) : idle(t, s.seed), pz, i === 0 && t > B.sir - 0.2 ? pointAt(smooth((t - (B.sir - 0.2)) / 0.4), {down: 22}) : null, i === 0 && t > B.sir ? talk(t, {amount: 0.35, seed: 3}) : null);
				return <Who key={s.id} id={s.id} view="tq" at={a.pos} pose={pose} t={t} cam={cam} mood={mood} facing={i === 1 ? 1 : -1} seed={s.seed} />;
			})}
		</>
	);
};

export const GROW: ShotDef = {
	id: 'GROW',
	start: B.s5 - 0.3,
	end: B.s6 + 0.4,
	Content: GrowContent,
	camera: growCam,
	grade: () => DAY_GRADE,
	fog: () => fogOf(FIELD_DAY),
	anchors: () => ({tare: [3.9, 1.05, -2.6]}),
	dof: () => ({focus: 7, range: 5, aperture: 5, max: 10}),
};

// ------------------------------------------------------------------------------------------------
// S6 TALK: the servants and the farmer at the edge of the field
// ------------------------------------------------------------------------------------------------
const TALK_MOOD: Mood = {...FIELD_GOLDEN, sunDir: dirOf(-48, 22)};
const FARMER_AT: Vec3 = [3.75, 0, -0.9];
const SV_AT: Vec3[] = [
	[2.75, 0, -2.4],
	[2.5, 0, -3.2],
	[3.15, 0, -3.5],
];
const talkCam = (t: number): CamState => {
	const k = seg(t, B.s6, B.s7, (x) => x);
	return {pos: [lerp(3.45, 3.35, k), 1.6, lerp(4.8, 4.4, k)], target: [3.25, 1.25, -2.0], fov: 34, drift: 1};
};
const talkWheat = (t: number): WheatState => ({time: t, wind: 0.9, grow: 1, ripe: 0.6, tareDark: 1, tareShow: 1, spots: 0, glow: 0});

const TalkContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const cam = talkCam(t);
	const answer = t > B.andHeSaid - 0.1 && t < B.godDidnt - 0.2;
	const farmer = blend(
		idle(t, 2),
		answer ? talk(t, {amount: 0.55, seed: 2}) : null,
		pointAt(smooth((t - B.farmerPoint) / 0.4) * (1 - smooth((t - (B.godDidnt + 0.3)) / 0.5)), {down: 18}),
		{variants: {mouth: answer ? (Math.sin(t * 13) > 0 ? 'talk' : 'rest') : 'rest'}, angles: {head: -3}},
	);
	return (
		<>
			<FarmWorld t={t} mood={TALK_MOOD} lite={lite} center={[3.2, 0, -2.3]} span={7} wheat={talkWheat(t)} eye={cam.pos} />
			<Who id="farmer" view="tq" at={FARMER_AT} pose={farmer} t={t} cam={cam} mood={TALK_MOOD} facing={-1} seed={3} />
			{(['servantA', 'servantB', 'servantC'] as CharId[]).map((id, i) => {
				const surprised = smooth((t - (B.enemy2 + 0.1 + i * 0.12)) / 0.3);
				const pose = blend(idle(t, 20 + i), puzzled(t + i, 1 - surprised), {offsets: {brow_near: [0, -10 * surprised], brow_far: [0, -8 * surprised]}, variants: {mouth: surprised > 0.5 ? 'open' : 'rest'}, angles: {head: 3 * surprised}});
				return <Who key={id} id={id} view="tq" at={SV_AT[i]} pose={pose} t={t} cam={cam} mood={TALK_MOOD} facing={1} seed={30 + i} />;
			})}
		</>
	);
};

export const TALK: ShotDef = {
	id: 'TALK',
	start: B.s6 - 0.4,
	end: B.s7 + 0.4,
	Content: TalkContent,
	camera: talkCam,
	grade: () => GOLDEN_GRADE,
	fog: () => fogOf(TALK_MOOD),
	anchors: () => ({tare: [2.15, 1.02, -0.6]}),
	dof: () => ({focus: 6.8, range: 1.8, aperture: 9, max: 14}),
};

// ------------------------------------------------------------------------------------------------
// S7 PULL (above ground): a servant reaches for a weed; the farmer's gentle hand: "Nay"
// ------------------------------------------------------------------------------------------------
export const TARE_AT: Vec3 = [2.95, 0, -1.2];
const PULL_SV: Vec3 = [2.32, 0, -1.15];
const PULL_FARMER: Vec3 = [3.5, 0, -0.6];
export const pullCam = (t: number): CamState => {
	const dive = easeInOut(seg(t, B.diveStart, B.underground + 0.05, (x) => x));
	const settle = seg(t, B.s7, B.diveStart, (x) => x);
	const p0: Vec3 = [lerp(3.05, 3.0, settle), 1.7, lerp(6.2, 5.6, settle)];
	const p1: Vec3 = [TARE_AT[0] + 0.05, 0.25, TARE_AT[2] + 0.7];
	return {
		pos: [lerp(p0[0], p1[0], dive), lerp(p0[1], p1[1], dive), lerp(p0[2], p1[2], dive)],
		target: [lerp(3.0, TARE_AT[0], dive), lerp(0.95, -0.2, dive), lerp(-1.0, TARE_AT[2], dive)],
		fov: lerp(38, 50, dive),
		drift: 1 - dive,
	};
};
const pullWheat = (t: number): WheatState => ({time: t, wind: 0.85, grow: 1, ripe: 0.65, tareDark: 1, tareShow: 1, spots: 0, glow: 0, part: 1, partAt: [TARE_AT[0], TARE_AT[2]]});
// a clear spot in the field where the weed stands, so the servant's hands can be seen on it
const PULL_PATCH: FieldPatch = {...MAIN, clear: [TARE_AT[0], TARE_AT[2], 0.32]};
const ONE_TARE: FieldPatch = {x0: TARE_AT[0], x1: TARE_AT[0], z0: TARE_AT[2], z1: TARE_AT[2], row: 0.001, step: 0.001, tare: 1, seed: 3, detail: 'hero', path: false, rot: 0.4};

const PullContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const cam = pullCam(t);
	const sv = blend(idle(t, 40), t < B.servantLean ? talk(t, {amount: 0.35, seed: 5, mouth: t > B.shouldWe - 0.3 && t < B.pullUp + 0.4}) : null, grabPull(t, {lean: B.servantLean, grab: B.grab, pull: 99}));
	const nay = blend(idle(t, 2), noHand(t, B.noHand), {angles: {head: -2}});
	const ws = pullWheat(t);
	return (
		<>
			<FarmWorld t={t} mood={TALK_MOOD} lite={lite} center={[3, 0, -1.4]} span={6} wheat={ws} patch={PULL_PATCH} hero={ONE_TARE} eye={cam.pos} />
			<Who id="servantA" view="side" at={PULL_SV} pose={sv} t={t} cam={cam} mood={TALK_MOOD} facing={1} seed={11} />
			<Who id="farmer" view="tq" at={PULL_FARMER} pose={nay} t={t} cam={cam} mood={TALK_MOOD} facing={-1} seed={3} />
		</>
	);
};

export const PULL: ShotDef = {
	id: 'PULL',
	start: B.s7 - 0.4,
	end: B.underground + 0.4,
	Content: PullContent,
	camera: pullCam,
	grade: (t) => ({...GOLDEN_GRADE, exposure: 1.02 - 0.5 * seg(t, B.underground - 0.35, B.underground + 0.1)}),
	fog: () => fogOf(TALK_MOOD),
	dof: (t) => (t < B.diveStart ? {focus: 6.6, range: 1.4, aperture: 8, max: 12} : null),
};

// ------------------------------------------------------------------------------------------------
// S8 TOGETHER: golden hour, the mixed field swaying as one
// ------------------------------------------------------------------------------------------------
const GOLD_MOOD: Mood = {...FIELD_GOLDEN, sunDir: dirOf(-12, 9)};
const togetherCam = (t: number): CamState => {
	const k = seg(t, B.s8 - 0.3, B.s9 + 0.3, (x) => x);
	return {pos: [lerp(-4.5, -2.6, k), 2.3, lerp(10.5, 10.2, k)], target: [lerp(-2.5, -1.0, k), 1.2, -10], fov: 42, drift: 1};
};
const ripeWheat = (t: number, spots = 0): WheatState => ({time: t, wind: 1.05, grow: 1, ripe: 1, tareDark: 1, tareShow: 1, spots, glow: 0.04});

export const TOGETHER: ShotDef = {
	id: 'TOGETHER',
	start: B.s8 - 0.4,
	end: B.s9 + 0.4,
	Content: ({t, lite}) => {
		const cam = togetherCam(t);
		return (
			<>
				<FarmWorld t={t} mood={GOLD_MOOD} lite={lite} center={[-2, 0, 0]} span={14} wheat={ripeWheat(t)} eye={cam.pos} />
				<Dust count={220} center={[-2, 1.6, 4]} size={[10, 3, 8]} t={t} color="#ffd9a0" opacity={0.6} px={5} />
			</>
		);
	},
	camera: togetherCam,
	grade: () => GOLDEN_GRADE,
	fog: () => fogOf(GOLD_MOOD),
	rays: (t) => ({at: far(togetherCam(t), GOLD_MOOD.sunDir), strength: 0.45}),
};

// ------------------------------------------------------------------------------------------------
// S9 SPOTS: the push into the golden wheat; every stalk has a small dark spot
// ------------------------------------------------------------------------------------------------
const STALK: Vec3 = [0.4, 0, 2.6];
const SPOT_HOLE: [number, number, number, number] = [-2.6, 2.6, 0.2, 6.5];
const SPOT_PATCH: FieldPatch = {...MAIN, hole: SPOT_HOLE};
const SPOT_HERO: FieldPatch = {x0: SPOT_HOLE[0], x1: SPOT_HOLE[1], z0: SPOT_HOLE[2], z1: SPOT_HOLE[3], row: 0.3, step: 0.17, tare: 0.12, seed: 21, detail: 'hero', path: false, chunk: 2, clear: [STALK[0], STALK[2] + 0.55, 0.5]};
const spotsCam = (t: number): CamState => {
	const k = easeInOut(seg(t, B.pushIn - 0.4, B.counterAll + 0.6, (x) => x));
	const head: Vec3 = [STALK[0], 0.98, STALK[2]];
	const p0: Vec3 = [0.9, 1.9, 9.5];
	const p1: Vec3 = [head[0] + 0.05, head[1] + 0.04, head[2] + 0.42];
	return {pos: [lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k)], target: [lerp(0.2, head[0], k), lerp(0.9, head[1], k), lerp(-2, head[2], k)], fov: lerp(40, 34, k), drift: 1 - 0.6 * k};
};

export const SPOTS: ShotDef = {
	id: 'SPOTS',
	start: B.s9 - 0.4,
	end: B.s10 + 0.4,
	Content: ({t, lite}) => {
		const cam = spotsCam(t);
		const spots = seg(t, B.spotsStart, B.spotsEnd, (x) => x);
		// the one stalk we push into: alone in a little clearing, its spot turned to the camera
		const hero: FieldPatch = {x0: STALK[0], x1: STALK[0], z0: STALK[2], z1: STALK[2], row: 0.001, step: 0.001, tare: 0, seed: 77, detail: 'hero', path: false, rot: -Math.PI / 2};
		return (
			<>
				<FarmWorld t={t} mood={GOLD_MOOD} lite={lite} center={[0.4, 0, 1]} span={9} wheat={ripeWheat(t, spots)} patch={SPOT_PATCH} hero={SPOT_HERO} eye={cam.pos} />
				<HeroStalk patch={hero} t={t} spots={seg(t, B.whoWouldBeLeft - 1.0, B.whoWouldBeLeft)} mood={GOLD_MOOD} />
				<Dust count={160} center={[0.4, 1.3, 3.5]} size={[4, 1.8, 6]} t={t} color="#ffd9a0" opacity={0.55} px={4} />
			</>
		);
	},
	camera: spotsCam,
	grade: () => ({...GOLDEN_GRADE, vignette: 0.55}),
	fog: () => fogOf(GOLD_MOOD),
	rays: (t) => ({at: far(spotsCam(t), GOLD_MOOD.sunDir), strength: 0.4}),
	dof: (t) => {
		const c = spotsCam(t);
		const d = Math.hypot(c.pos[0] - STALK[0], c.pos[1] - 0.98, c.pos[2] - STALK[2]);
		return {focus: d, range: 0.15 + 0.3 * (1 - seg(t, B.pushIn, B.counterAll)), aperture: lerp(8, 26, seg(t, B.pushIn, B.counterAll)), max: 24};
	},
};

// A single detailed stalk (the one the camera pushes into); its spot can appear on its own schedule.
const HeroStalk: React.FC<{patch: FieldPatch; t: number; spots: number; mood: Mood}> = ({patch, t, spots, mood}) => (
	<Wheat patch={patch} state={{time: t, wind: 0.6, grow: 1, ripe: 1, tareDark: 1, tareShow: 1, spots: spots > 0 ? 1.01 : 0, glow: 0.06}} light={{dir: mood.sunDir, color: mood.sunColor, back: 0.9}} />
);

// ------------------------------------------------------------------------------------------------
// S10 HOURGLASS: a great hourglass of light over the field; glowing sand falls slowly
// ------------------------------------------------------------------------------------------------
const HG_AT: Vec3 = [0, 9.5, -6];
const HG_H = 4.2;
const hgCam = (t: number): CamState => {
	const k = easeInOut(seg(t, B.craneUp, B.craneUp + 4.2, (x) => x));
	return {pos: [lerp(0.6, 0.4, k), lerp(1.3, 6.4, k), lerp(9.5, 7.2, k)], target: [lerp(0.4, 0, k), lerp(1.4, HG_AT[1] - 0.3, k), lerp(-4, HG_AT[2], k)], fov: lerp(42, 46, k), drift: 0.8};
};
const SUNSET: Mood = {...FIELD_GOLDEN, sunDir: dirOf(28, 4), skyTop: '#6c7fb0', skyMid: '#d9a68e', skyHorizon: '#ffbe78', light: '#ffc98a', lightI: 2.0};

export const HOURGLASS: ShotDef = {
	id: 'HOURGLASS',
	start: B.s10 - 0.4,
	end: B.s11 + 0.4,
	Content: ({t, lite}) => {
		const cam = hgCam(t);
		const on = smooth((t - B.hourglassIn) / 0.9);
		return (
			<>
				<FarmWorld t={t} mood={SUNSET} lite={lite} center={[0, 0, -2]} span={12} wheat={ripeWheat(t)} eye={cam.pos} />
				<Hourglass at={HG_AT} h={HG_H} t={t} on={on} />
				<Dust count={200} center={[0, 3, -3]} size={[12, 6, 10]} t={t} color="#ffe0a0" opacity={0.5 * on} px={5} rise={0.05} />
			</>
		);
	},
	camera: hgCam,
	grade: () => ({...GOLDEN_GRADE, bloom: 0.42, bloomThreshold: 0.9}),
	fog: () => fogOf(SUNSET),
	rays: (t) => ({at: HG_AT, strength: 0.28 * smooth((t - B.hourglassIn) / 1.2), color: [1, 0.86, 0.55]}),
};

// The hourglass: two glowing glass bulbs (bright at their edges), a thin frame, gold sand in the top bulb
// that slowly empties through the neck into a growing pile below.
const Hourglass: React.FC<{at: Vec3; h: number; t: number; on: number}> = ({at, h, t, on}) => {
	const glass = useMemo(() => {
		const pts: THREE.Vector2[] = [];
		for (let i = 0; i <= 32; i++) {
			const v = i / 32;
			const y = (v - 0.5) * h;
			const b = Math.abs(v - 0.5) * 2;
			const r = 0.06 * h + 0.36 * h * Math.pow(Math.sin(Math.PI * Math.min(1, b * 0.98)), 0.9) * (b > 0.9 ? 1 - (b - 0.9) * 3 : 1);
			pts.push(new THREE.Vector2(Math.max(0.03 * h, r), y));
		}
		return new THREE.LatheGeometry(pts, 48);
	}, [h]);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uOn: {value: 0}, uColor: {value: new THREE.Color('#ffe2a6')}},
				vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
				fragmentShader: `uniform float uOn; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
					void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uColor * (pow(f, 3.0) * 0.55 + 0.01) * uOn, 1.); }`,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide,
				fog: false,
			}),
		[],
	);
	mat.uniforms.uOn.value = on;
	const frame = useMemo(() => new THREE.MeshLambertMaterial({color: '#e8c27a', emissive: '#ffcf80', transparent: true, fog: false}), []);
	frame.emissiveIntensity = 0.35;
	frame.opacity = on;
	frame.visible = on > 0.01;
	// sand: the top cone shrinks, the bottom pile grows; a thin falling stream of glowing grains
	const k = clamp((t - B.hourglassIn) / 14 + 0.25);
	const sandMat = useMemo(() => new THREE.MeshBasicMaterial({color: '#ffcf70', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}), []);
	sandMat.opacity = 0.38 * on;
	const topH = 0.42 * h * (1 - k);
	const botH = 0.3 * h * (0.2 + 0.8 * k);
	const stream = useMemo(
		() =>
			Array.from({length: 260}, (_, i): ParticleSpec => ({
				birth: B.hourglassIn - 3 + i * 0.045,
				pos: [(hash(5, i) - 0.5) * 0.04 * h, 0.02 * h, (hash(6, i) - 0.5) * 0.04 * h],
				vel: [(hash(7, i) - 0.5) * 0.01, -0.02, (hash(8, i) - 0.5) * 0.01],
				life: 2.2,
				size: 0.6 + hash(9, i) * 0.6,
				seed: hash(10, i),
			})),
		[h],
	);
	return (
		<group position={at}>
			<mesh geometry={glass} material={mat} renderOrder={900} />
			{/* the frame: two golden discs and four posts, softly lit from inside */}
			{[-1, 1].map((s) => (
				<mesh key={s} position={[0, (s * h) / 2, 0]} material={frame} renderOrder={901}>
					<cylinderGeometry args={[0.45 * h, 0.45 * h, 0.05 * h, 48, 1, false]} />
				</mesh>
			))}
			{[0, 1, 2, 3].map((i) => (
				<mesh key={i} position={[Math.cos((i * Math.PI) / 2 + 0.6) * 0.42 * h, 0, Math.sin((i * Math.PI) / 2 + 0.6) * 0.42 * h]} material={frame} renderOrder={901}>
					<cylinderGeometry args={[0.014 * h, 0.014 * h, h, 8, 1, true]} />
				</mesh>
			))}
			<mesh position={[0, 0.06 * h + topH / 2, 0]} rotation-x={Math.PI} material={sandMat} renderOrder={902} visible={topH > 0.01}>
				<coneGeometry args={[0.3 * h * (1 - k * 0.5), topH, 40, 1]} />
			</mesh>
			<mesh position={[0, -0.47 * h + botH / 2, 0]} material={sandMat} renderOrder={902}>
				<coneGeometry args={[0.34 * h, botH, 40, 1]} />
			</mesh>
			<Particles specs={stream} t={t} gravity={-0.42 * h} drag={0} colors={['#fff2c0', '#ffd27a', '#ffb44a']} opacity={on} px={14} swirl={0.002} />
			<Glow position={[0, 0, 0]} size={h * 1.3} color="#ffd890" intensity={0.18 * on} />
		</group>
	);
};

// ------------------------------------------------------------------------------------------------
// S12 HARVEST: sunrise; reapers cut the wheat, golden sheaves go into the glowing barn
// ------------------------------------------------------------------------------------------------
const HARVEST_MOOD: Mood = {...FIELD_SUNRISE, sunDir: dirOf(-30, 8), lightI: 2.4};
const harvestCam = (t: number): CamState => {
	const k = easeInOut(seg(t, B.harvestCrane, B.s13 + 0.3, (x) => x));
	return {pos: [lerp(5.2, 4.5, k), lerp(1.4, 7.5, k), lerp(-12.5, -6.0, k)], target: [lerp(7.0, 8.2, k), lerp(1.4, 1.2, k), lerp(-22, -24, k)], fov: lerp(40, 46, k), drift: 1};
};
// the field near the barn is half cut: stubble where the reapers have been
const HARVEST_PATCH: FieldPatch = {...MAIN, hole: [3, 16, -21, -15.5]};
const REAPERS: {at: Vec3; ph: number; facing: number}[] = [
	{at: [4.6, 0, -16.6], ph: 0.0, facing: 1},
	{at: [6.4, 0, -16.2], ph: 0.35, facing: 1},
	{at: [8.6, 0, -16.9], ph: 0.7, facing: -1},
];

export const HARVEST: ShotDef = {
	id: 'HARVEST',
	start: B.s12 - 0.4,
	end: B.s13 + 0.4,
	Content: ({t, lite}) => {
		const cam = harvestCam(t);
		const glow = smooth((t - B.barnGlow + 0.3) / 0.8);
		return (
			<>
				<FarmWorld t={t} mood={HARVEST_MOOD} lite={lite} center={[7, 0, -20]} span={14} wheat={ripeWheat(t)} patch={HARVEST_PATCH} barn eye={cam.pos} backlight={1.1} />
				<Stubble />
				<Sheaves />
				{REAPERS.map((r, i) => (
					<Who key={i} id="reaper" view="side" at={r.at} facing={r.facing} pose={blend(reap(t / 1.3 + r.ph), happy(t, i))} t={t} cam={cam} mood={HARVEST_MOOD} seed={50 + i} lookExtra={{}} order={30 + i} />
				))}
				{/* two carry sheaves along the path to the barn */}
				{[0, 1].map((i) => {
					const x = lerp(5.5, 8.6, ((t * 0.32 + i * 0.5) % 1));
					const z = lerp(-19, -26.5, ((t * 0.32 + i * 0.5) % 1));
					const pose = blend(walk(t / WALK.reaper.period + i * 0.5, {arms: 0}), carry(1), {props: [{part: 'forearm_near', sprite: 'props/sheaf', at: [120, 470], angle: -10, scale: 1.1}]});
					return <Who key={`c${i}`} id="reaper" view="side" at={[x, 0, z]} facing={1} pose={pose} t={t} cam={cam} mood={HARVEST_MOOD} seed={60 + i} order={34 + i} />;
				})}
				<BarnGlow t={t} on={glow} />
				<Dust count={220} center={[7, 1.5, -20]} size={[10, 3, 8]} t={t} color="#ffdca0" opacity={0.6} px={5} />
			</>
		);
	},
	camera: harvestCam,
	grade: () => ({...SUNRISE_GRADE, bloom: 0.62, saturation: 1.1}),
	fog: () => fogOf(HARVEST_MOOD),
	rays: (t) => ({at: far(harvestCam(t), HARVEST_MOOD.sunDir), strength: 0.45}),
};

// cut stalks where the wheat has been reaped (short pale stubble)
const STUBBLE: FieldPatch = {x0: 3.2, x1: 15.8, z0: -20.8, z1: -15.7, row: 0.33, step: 0.19, tare: 0, seed: 31, path: false};
const Stubble: React.FC = () => <Wheat patch={STUBBLE} state={{time: 0, wind: 0, grow: 0.22, ripe: 1, tareDark: 1, tareShow: 0, spots: 0, glow: 0}} />;

// sheaves standing in stooks on the stubble: bundles of golden stalks tied in the middle
const Sheaves: React.FC = () => {
	const geo = useMemo(() => {
		const parts: THREE.BufferGeometry[] = [];
		const spots: [number, number][] = [];
		for (let i = 0; i < 14; i++) spots.push([3.8 + (i % 7) * 1.7 + hash(3, i) * 0.4, -16.4 - Math.floor(i / 7) * 2.2 - hash(4, i) * 0.5]);
		spots.forEach(([x, z], i) => {
			for (let k = 0; k < 3; k++) {
				const g = new THREE.CylinderGeometry(0.16, 0.12, 0.95, 7, 3);
				const pos = g.attributes.position as THREE.BufferAttribute;
				for (let v = 0; v < pos.count; v++) {
					const y = pos.getY(v);
					const pinch = 1 - 0.45 * Math.exp(-Math.pow((y + 0.05) / 0.12, 2));
					const flare = 1 + Math.max(0, y - 0.15) * 1.6;
					pos.setX(v, pos.getX(v) * pinch * flare);
					pos.setZ(v, pos.getZ(v) * pinch * flare);
				}
				const a = (k / 3) * Math.PI * 2 + hash(5, i);
				g.rotateZ(0.22 * Math.cos(a));
				g.rotateX(0.22 * Math.sin(a));
				g.translate(x + Math.cos(a) * 0.18, 0.47, z + Math.sin(a) * 0.18);
				const col = new THREE.Color('#e3b456').multiplyScalar(0.85 + 0.25 * hash(6, i * 3 + k));
				const ng = g.toNonIndexed();
				const c = new Float32Array(ng.attributes.position.count * 3);
				for (let v = 0; v < ng.attributes.position.count; v++) c.set([col.r, col.g, col.b], v * 3);
				ng.setAttribute('color', new THREE.BufferAttribute(c, 3));
				ng.deleteAttribute('uv');
				parts.push(ng);
			}
		});
		const all = new THREE.BufferGeometry();
		const P: number[] = [];
		const C: number[] = [];
		for (const p of parts) {
			P.push(...(p.attributes.position.array as Float32Array));
			C.push(...(p.attributes.color.array as Float32Array));
		}
		all.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		all.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
		all.computeVertexNormals();
		return all;
	}, []);
	const mat = useMemo(() => new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}), []);
	return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
};

// warm light pouring out of the barn doors, glowing sheaves stacked inside
const BarnGlow: React.FC<{t: number; on: number}> = ({t, on}) => {
	const door: Vec3 = [BARN_AT[0], 0, BARN_AT[2] + 3.3];
	return (
		<>
			<Glow position={[door[0], 1.9, door[2] - 0.6]} size={9} color="#ffcf7a" intensity={0.35 + 0.65 * on} />
			<LightBeam position={[door[0], 0, door[2] + 0.8]} height={4.5} rTop={1.4} rBottom={2.6} intensity={0.25 * on} t={t} color="#ffd690" core={0.5} />
			<pointLight position={[door[0], 2.2, door[2] - 1.0]} color="#ffbf6a" intensity={(4 + 16 * on) * 1} distance={14} decay={1.6} />
		</>
	);
};

// ------------------------------------------------------------------------------------------------
// S13 CTA background: dusk, the barn glowing warm, fireflies; slow and dark so the question reads
// ------------------------------------------------------------------------------------------------
const DUSK: Mood = {...FIELD_GOLDEN, sunDir: dirOf(-30, -2), skyTop: '#1d1c33', skyMid: '#4a3346', skyHorizon: '#a3594a', skyBottom: '#3a2a2a', sunGlow: 0.05, light: '#ff9a62', lightI: 0.5, hemiSky: '#5a4a66', hemiGround: '#2a1a14', hemiI: 0.55, fog: '#3a2a30', fogNear: 20, fogFar: 160, cloud: '#5a3a44', tint: '#d8b8a8'};
const ctaCam = (t: number): CamState => {
	const k = seg(t, B.s13 - 0.5, B.total, (x) => x);
	return {pos: [lerp(4.0, 5.2, k), 1.6, lerp(-13.0, -15.2, k)], target: [BARN_AT[0] - 0.2, 1.8, BARN_AT[2] + 2], fov: 40, drift: 0.8};
};

export const CTA: ShotDef = {
	id: 'CTA',
	start: B.s13 - 0.5,
	end: B.total + 1,
	Content: ({t, lite}) => {
		const cam = ctaCam(t);
		return (
			<>
				<FarmWorld t={t} mood={DUSK} lite={lite} center={[8, 0, -24]} span={10} wheat={{...ripeWheat(t), glow: 0.03}} patch={HARVEST_PATCH} barn eye={cam.pos} backlight={0.4} />
				<Stubble />
				<Sheaves />
				<BarnGlow t={t} on={1} />
				<Fireflies t={t} center={[7, 1.2, -18]} size={[12, 1.6, 10]} count={90} px={8} seed={21} />
			</>
		);
	},
	camera: ctaCam,
	grade: () => ({...GOLDEN_GRADE, exposure: 0.92, vignette: 0.75, bloom: 0.6, saturation: 1.0}),
	fog: () => fogOf(DUSK),
	dof: () => ({focus: 14, range: 3, aperture: 7, max: 12}),
};

void onPath;
void keys;
