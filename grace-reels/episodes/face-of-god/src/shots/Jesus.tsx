// S11 "Now here's the best part. Centuries later, Jesus said: He that hath seen me hath seen the Father."
// S12 "Moses had to hide in a rock to see God's back." S13 "You can see God's glory in the face of Jesus
// Christ." S14 the call to action and S15 the end card, then the loop back into the storm. The upper room
// by lamplight; the split screen (Moses hidden in the dark, Jesus on a sunlit Galilee hillside with the
// people and a child coming right up to Him); the slow push-in on His face at sunrise. No halo, ever.
import {Actor} from '../characters/Actor';
import {Glow} from '../fx/Flame';
import {ParticleSpec, Particles} from '../fx/Particles';
import {easeInOut, easeOut, lerp, pulse, seg, smooth} from '../lib/ease';
import {hash} from '../lib/random';
import {B} from '../lib/timeline';
import {ASPECT} from '../render/camera';
import type {CamState, Grade, ShotDef, Vec3} from '../render/types';
import {CLEFT_X, CleftWorld, CoveringShadow} from '../world/Cleft';
import {GalileeWorld} from '../world/Hill';
import {Haze, Pool} from '../world/Layer';
import {GALILEE} from '../world/mood';
import {JESUS_SEAT, RoomWorld, SEATS} from '../world/Room';
import {HOOK} from './Summit';
import {leftCentre, rightCentre, SPLIT_IN, SPLIT_OUT} from './split';

const DEG = Math.PI / 180;
// the target that puts `subject` at NDC x = u for a camera looking down -z from distance d
const aimX = (subjectX: number, u: number, d: number, fov: number) => subjectX - u * d * Math.tan((fov * DEG) / 2) * ASPECT;

const roomGrade = (g: Partial<Grade> = {}): Partial<Grade> => ({
	exposure: 1.02,
	contrast: 1.06,
	saturation: 1.02,
	gain: [1.04, 1.0, 0.92],
	lift: [0.01, 0.005, 0.0],
	vignette: 0.5,
	bloom: 0.5,
	bloomThreshold: 0.75,
	grain: 0.02,
	...g,
});
const sunriseGrade = (g: Partial<Grade> = {}): Partial<Grade> => ({
	exposure: 1.03,
	contrast: 1.05,
	saturation: 1.06,
	gain: [1.05, 1.0, 0.92],
	lift: [0.012, 0.008, 0.0],
	vignette: 0.42,
	bloom: 0.5,
	bloomThreshold: 0.82,
	grain: 0.018,
	...g,
});
const galFog = () => ({color: GALILEE.fog, near: GALILEE.fogNear, far: GALILEE.fogFar});
const SUN: Vec3 = [GALILEE.sunDir[0] * 600, GALILEE.sunDir[1] * 600, GALILEE.sunDir[2] * 600];

// ---------------- S11: the upper room ----------------
// Jesus at the head of the table, turned to Philip (the nearest of the near row), His open hand toward him.
const JESUS_HEAD: Vec3 = [JESUS_SEAT[0] - 0.02, 1.06, JESUS_SEAT[2]];
const roomCam = (t: number): CamState => {
	const land = easeOut(seg(t, B.streak - 0.4, B.cardJohnIn + 0.8));
	const push = easeInOut(seg(t, B.me - 1.4, B.s12 + 0.2));
	const z = lerp(lerp(6.6, 5.9, land), 3.5, push);
	const d = z - JESUS_SEAT[2];
	const x = lerp(2.1, 2.42, push);
	return {pos: [x, 1.12, z], target: [x - 0.02, JESUS_HEAD[1] - 0.054 * d, JESUS_SEAT[2]], fov: 32, drift: 0.6};
};
export const ROOM: ShotDef = {
	id: 'ROOM',
	start: B.streak - 0.6,
	end: B.s12 + 0.3,
	Content: ({t, lite}) => {
		const me = pulse(t, B.me, 0.15, 0.9);
		const philip = smooth(seg(t, B.me + 0.1, B.me + 0.6)) * (1 - smooth(seg(t, B.father + 0.5, B.s12)));
		return (
			<RoomWorld t={t} lite={lite} hide={[SEATS[0].s]}>
				<Actor
					position={JESUS_SEAT}
					t={t}
					poses={[[-10, 'jesus/laugh_sit']]}
					facing={-1}
					blinkSeed={5}
					look={{tint: '#fff0dc', grad: {dir: [-1, 0.3], color: '#ffd8a8', amount: 0.25}, rimLight: 0.3, rimColor: '#ffc078', rimDir: [-1, 0.4]}}
					warp={{breath: 0.006 * Math.sin(t * 2.0), lean: 7 * me, wave: [1.5, 5, t * 1.5, 0.65]}}
					renderOrder={-300}
				/>
				{/* Philip listens, leaning in a little as the words land */}
				<Actor position={[SEATS[0].x, 0, SEATS[0].z]} t={t} poses={[[0, SEATS[0].s]]} look={{tint: '#ffe3c6', grad: {dir: [1, 0.3], color: '#ffd29a', amount: 0.25}}} warp={{lean: 6 * philip, breath: 0.007 * Math.sin(t * 2.1)}} renderOrder={-400} />
				<Glow position={[JESUS_HEAD[0] - 0.4, JESUS_HEAD[1] - 0.1, JESUS_SEAT[2] + 0.4]} size={2.4} color="#ffb870" intensity={0.12} renderOrder={-290} />
			</RoomWorld>
		);
	},
	camera: roomCam,
	grade: () => roomGrade(),
};

// ---------------- S12 left: Moses small and hidden in the dark cleft ----------------
const HIDE_SUBJECT: Vec3 = [CLEFT_X, 1.0, -0.55];
const HIDE_D = 12;
const hideCam = (t: number): CamState => {
	const fov = 34;
	const x = aimX(HIDE_SUBJECT[0], leftCentre(t), HIDE_D, fov);
	return {pos: [x - 0.4, 1.9, HIDE_SUBJECT[2] + HIDE_D], target: [x, 1.25, HIDE_SUBJECT[2]], fov, drift: 0.5};
};
export const HIDE: ShotDef = {
	id: 'HIDE',
	start: SPLIT_IN - 0.3,
	end: SPLIT_OUT + 0.3,
	Content: ({t}) => (
		<>
			<CleftWorld t={t} look={{glow: 0.04, hole: 0.12, rain: 1, storm: 0.7}} rainBox={{center: [CLEFT_X, 2, 3], size: [10, 8, 8]}} />
			<Actor
				position={[CLEFT_X - 0.3, 0, -0.55]}
				t={t}
				poses={[[-10, 'moses/press']]}
				yaw={-0.05}
				look={{tint: '#8c96bc', rimLight: 0.15, rimColor: '#c8d4ff', rimDir: [1, 0.3]}}
				warp={{lean: 1.5 * Math.sin(t * 47), breath: 0.01 * Math.sin(t * 9)}}
				blinkSeed={11}
				renderOrder={10}
			/>
			<CoveringShadow position={[CLEFT_X, 1.4, 0.45]} size={[5, 5.5]} cover={0.7} leak={0.08} />
		</>
	),
	camera: hideCam,
	grade: () => ({exposure: 0.92, contrast: 1.16, saturation: 0.8, gain: [0.9, 0.96, 1.1], vignette: 0.7, bloom: 0.5, bloomThreshold: 0.85, grain: 0.024}),
	fog: () => ({color: '#1b2238', near: 30, far: 380}),
};

// ---------------- S12 right / S13 start: Jesus on the hillside, a child coming right up to Him ----------------
// Jesus sits on the grass facing right (toward the child), His open hand held out to her.
const JESUS_HILL: Vec3 = [0, 0, 0];
const HILL_SUBJECT: Vec3 = [0.12, 0.8, 0];
type Guest = {s: string; pos: Vec3; facing: number; order: number};
const GUESTS: Guest[] = [
	{s: 'guests/g1', pos: [-1.35, 0, -1.1], facing: 1, order: 1},
	{s: 'guests/g3', pos: [1.75, 0, -1.6], facing: -1, order: 2},
	{s: 'guests/g2', pos: [-0.45, 0, -2.3], facing: 1, order: 0},
	{s: 'guests/g6', pos: [2.55, 0, -0.5], facing: -1, order: 3},
	{s: 'guests/g4', pos: [-2.2, 0, 0.2], facing: 1, order: 4},
];
// the child walks up from the right and stops just in front of His open hand
const childX = (t: number) => lerp(2.3, 1.02, easeOut(seg(t, SPLIT_IN + 0.2, SPLIT_OUT + 0.1)));
const hillCam = (t: number): CamState => {
	const fov = 34;
	const push = easeInOut(seg(t, SPLIT_OUT - 0.6, B.s13 + 0.4));
	const d = lerp(6.4, 4.4, push);
	const x = aimX(HILL_SUBJECT[0], rightCentre(t), d, fov);
	return {pos: [x + 0.35, 0.95, d], target: [x, 0.95, 0], fov, drift: 0.5};
};
const HillContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const cx = childX(t);
	const walking = 1 - seg(t, SPLIT_OUT - 0.2, SPLIT_OUT + 0.2);
	return (
		<>
			<GalileeWorld t={t} mood={GALILEE} lite={lite} center={[0, 0, 0]} />
			{GUESTS.map((g) => (
				<Actor key={g.s} position={g.pos} t={t} poses={[[-10, g.s]]} facing={g.facing} look={{tint: '#fff3e4', grad: {dir: [-1, 0.4], color: '#ffd9a0', amount: 0.25, soft: 0.5}}} warp={{breath: 0.007 * Math.sin(t * 2.2 + g.order)}} shadow={{w: 0.9, d: 0.32, opacity: 0.22, offset: [0.25, 0.2]}} renderOrder={g.order} />
			))}
			<Actor
				position={JESUS_HILL}
				t={t}
				poses={[[-10, 'jesus/laugh_sit']]}
				blinkSeed={5}
				look={{tint: '#fff4e6', grad: {dir: [-1, 0.4], color: '#ffdca8', amount: 0.3, soft: 0.5}, rimLight: 0.35, rimColor: '#ffe2a8', rimDir: [-1, 0.5]}}
				warp={{breath: 0.006 * Math.sin(t * 2.0), wave: [1.5, 5, t * 1.5, 0.65]}}
				shadow={{w: 1.1, d: 0.4, opacity: 0.25, offset: [0.3, 0.2]}}
				renderOrder={6}
			/>
			<Actor
				position={[cx, 0.02 * walking * Math.abs(Math.sin(t * 7.5)), 0.35]}
				t={t}
				poses={[[-10, 'guests/g5']]}
				facing={-1}
				look={{tint: '#fff4e6', grad: {dir: [-1, 0.4], color: '#ffdca8', amount: 0.25, soft: 0.5}}}
				warp={{hem: [3 * Math.sin(t * 7.5) * walking, 0.65, 1], breath: 0.008 * Math.sin(t * 2.6)}}
				shadow={{w: 0.6, d: 0.25, opacity: 0.22, offset: [0.2, 0.15]}}
				renderOrder={8}
			/>
		</>
	);
};
export const HILL: ShotDef = {
	id: 'HILL',
	start: SPLIT_IN - 0.3,
	end: B.s13 + 0.3,
	Content: HillContent,
	camera: hillCam,
	grade: () => sunriseGrade({contrast: 1.08}),
	fog: galFog,
	rays: () => ({at: SUN, strength: 0.18, color: [1.0, 0.9, 0.7]}),
};

// ---------------- S13: the face of Jesus at sunrise, a slow push-in ----------------
// jesus/closeup faces left (toward the sunrise); his eye is 0.111 m behind and 0.508 m above its foot point
const CU_FOOT: Vec3 = [0, 0.55, 0];
const CU_EYE: Vec3 = [CU_FOOT[0] - 0.111, CU_FOOT[1] + 0.508, 0];
const faceCam = (t: number): CamState => {
	const p = easeInOut(seg(t, B.s13 - 0.5, B.s14 + 0.5));
	const d = lerp(1.75, 1.2, p);
	// his eyes about 140 px above the middle of the frame, clear of the card below
	return {pos: [CU_EYE[0] + 0.05, CU_EYE[1] - 0.02, d], target: [CU_EYE[0] + 0.04, CU_EYE[1] - 0.0418 * d, 0], fov: 32, drift: 0.4};
};
export const FACE: ShotDef = {
	id: 'FACE',
	start: B.s13 - 0.3,
	end: B.s14 + 0.5,
	Content: ({t, lite}) => (
		<>
			<GalileeWorld t={t} mood={GALILEE} lite={lite} center={[0, 0, 0]} />
			<Actor
				position={CU_FOOT}
				t={t}
				poses={[[-10, 'jesus/closeup']]}
				blinkSeed={7}
				look={{tint: '#fff2e2', grad: {dir: [-1, 0.35], color: '#ffd9a0', amount: 0.35, soft: 0.55}, rimLight: 0.45, rimColor: '#ffe2a8', rimDir: [-1, 0.45]}}
				warp={{breath: 0.004 * Math.sin(t * 2.0)}}
				renderOrder={10}
			/>
		</>
	),
	camera: faceCam,
	grade: (t) => sunriseGrade({exposure: 1.0 + 0.04 * smooth(seg(t, B.christ - 0.3, B.christ + 0.6)), contrast: 1.1, vignette: 0.5, bloom: 0.42, bloomThreshold: 0.86}),
	fog: galFog,
	rays: (t) => ({at: SUN, strength: 0.14 + 0.08 * smooth(seg(t, B.christ - 0.3, B.christ + 0.6)), color: [1.0, 0.9, 0.7]}),
};

// ---------------- S14–S15: a dark warm ground for the call to action and the end card ----------------
const MOTES: ParticleSpec[] = Array.from({length: 120}, (_, i) => ({
	birth: B.s14 - 4 + (i / 120) * (B.loopOut - B.s14 + 4),
	pos: [(hash(521, i) - 0.5) * 3.2, -1.6 + hash(522, i) * 1.4, (hash(523, i) - 0.5) * 1.5] as Vec3,
	vel: [(hash(524, i) - 0.5) * 0.05, 0.08 + hash(525, i) * 0.08, (hash(526, i) - 0.5) * 0.03] as Vec3,
	life: 4 + hash(527, i) * 3,
	size: 0.4 + hash(528, i) * 0.8,
	seed: hash(529, i),
}));
export const CTA: ShotDef = {
	id: 'CTA',
	start: B.s14 - 0.5,
	end: B.loopOut,
	Content: ({t, lite}) => {
		const glow = 0.6 + 0.15 * Math.sin(t * 1.4);
		return (
			<>
				<Haze position={[0, 0.2, -2]} size={[9, 7]} color="#1d130d" bottom={1} top={1} soft={0} renderOrder={-900} />
				<Pool position={[0.0, 0.55, -1.6]} size={[3.4, 2.6]} color="#ff9a4a" intensity={0.24 * glow} falloff={1.8} renderOrder={-880} />
				<Pool position={[-0.6, -0.4, -1.5]} size={[2.2, 1.8]} color="#c86a2a" intensity={0.12 * glow} falloff={2.2} renderOrder={-879} />
				<Particles specs={MOTES} t={t} gravity={0.01} drag={0.3} colors={['#fff2c8', '#ffd27a', '#c98a2a']} opacity={0.55} px={lite ? 4 : 6} swirl={0.04} renderOrder={600} />
			</>
		);
	},
	camera: (t) => {
		const u = seg(t, B.s14 - 0.5, B.loopOut, (x) => x);
		return {pos: [0, 0.3, 3.2 - 0.3 * u], target: [0, 0.2, 0], fov: 32, drift: 0.4};
	},
	grade: () => ({exposure: 1.0, contrast: 1.1, saturation: 0.98, gain: [1.06, 0.98, 0.88], lift: [0.01, 0.006, 0.0], vignette: 0.7, bloom: 0.55, bloomThreshold: 0.7, grain: 0.02}),
};

// ---------------- the loop: the last frames are the storm just before the reel starts ----------------
export const LOOP: ShotDef = {
	id: 'LOOP',
	start: B.loopOut,
	end: B.total + 1,
	Content: ({t, lite}) => <HOOK.Content t={t - B.total} lite={lite} />,
	camera: (t) => HOOK.camera(t - B.total),
	grade: (t) => HOOK.grade?.(t - B.total) ?? {},
	fog: (t) => HOOK.fog?.(t - B.total) ?? null,
	rays: (t) => HOOK.rays?.(t - B.total) ?? null,
};
