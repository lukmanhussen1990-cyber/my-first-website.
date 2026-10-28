// S8 "But notice what happened next. When Moses came down, his face was shining. And he didn't even know
// it." S9 "Moses wist not that the skin of his face shone. The people were afraid to come near him." S10
// "That was just from being near God." Morning on the ridge path, the close-up of the shining face, the
// camp where Aaron and the people step back, and the veil; then the camera cranes up into the sky.
import {Actor} from '../characters/Actor';
import {Glow} from '../fx/Flame';
import {clamp, easeInOut, easeOut, lerp, pulse, seg, smooth, springStep} from '../lib/ease';
import {B} from '../lib/timeline';
import type {CamState, Grade, ShotDef, Vec3} from '../render/types';
import {Dust} from '../world/atmosphere';
import {CAMP_DAY, MORNING} from '../world/mood';
import {CampWorld, ridgeY, RidgeWorld} from '../world/Morning';

const mix3 = (a: Vec3, b: Vec3, m: number): Vec3 => [lerp(a[0], b[0], m), lerp(a[1], b[1], m), lerp(a[2], b[2], m)];
const morningGrade = (g: Partial<Grade> = {}): Partial<Grade> => ({
	exposure: 1.02,
	contrast: 1.06,
	saturation: 1.04,
	gain: [1.04, 1.0, 0.94],
	lift: [0.012, 0.008, 0.0],
	vignette: 0.42,
	bloom: 0.5,
	bloomThreshold: 0.8,
	grain: 0.018,
	...g,
});
const fogOf = (m: typeof MORNING) => () => ({color: m.fog, near: m.fogNear, far: m.fogFar});

// how brightly his face shines: softly all along, brighter as the voice says "shining"
const shineAt = (t: number) => 0.35 + 0.65 * smooth(seg(t, B.shining - 0.35, B.shining + 0.45));

// ---------------- S8: walking down the ridge path ----------------
const STEP = 0.58; // one footfall every 0.58 s (half of the 1.16 s walk cycle)
const SPEED = 1.0;
const X0 = -2.6;
const mosesX = (t: number) => {
	const d = t - B.walkStart;
	// ease into the walk over the first 0.3 s
	return X0 + SPEED * (d <= 0 ? 0 : d < 0.3 ? (d * d) / 0.6 : d - 0.15);
};
const bobAt = (t: number) => 0.024 * Math.abs(Math.sin((Math.PI * (t - B.steps.moses[0])) / STEP));
const stridePhase = (t: number) => Math.sin((2 * Math.PI * (t - B.steps.moses[0])) / (2 * STEP));
// the eye of moses/walk_glow sits 0.19 m in front of and 1.50 m above his foot point
const faceOf = (t: number): Vec3 => {
	const x = mosesX(t);
	return [x + 0.21, ridgeY(x) + 1.47 + bobAt(t), 0.06];
};
const downCam = (t: number): CamState => {
	const x = mosesX(t);
	const e = easeInOut(seg(t, B.dawn - 0.3, B.dawn + 1.8));
	const push = easeInOut(seg(t, B.shining - 0.4, B.faceCU + 0.3));
	const y = ridgeY(x);
	return {
		pos: [x - 0.2 + 1.8 * (1 - e) + 0.15 * push, y + 0.8 + 1.2 * (1 - e) + 0.45 * push, lerp(5.2 + 3.0 * (1 - e), 2.9, push)],
		target: [x + 0.3 + 0.05 * push, y + 1.3 + 0.18 * push, -0.6],
		fov: 34,
		drift: 0.5,
	};
};
const DownContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const x = mosesX(t);
	const shine = shineAt(t);
	const face = faceOf(t);
	const walking = clamp((t - B.walkStart) / 0.3);
	return (
		<>
			<RidgeWorld t={t} mood={MORNING} lite={lite} center={[x, ridgeY(x), 0]} />
			<Actor
				position={[x, ridgeY(x) + bobAt(t) * walking, 0]}
				t={t}
				poses={[[-10, 'moses/walk_glow']]}
				look={{tint: '#f4e6d4', grad: {dir: [-1, 0.5], color: '#ffd9a0', amount: 0.3, soft: 0.5}, rimLight: 0.55, rimColor: '#ffe2a8', rimDir: [-1, 0.5]}}
				warp={{hem: [5 * stridePhase(t) * walking, 0.62, 1], lean: 2 * walking, breath: 0.006 * Math.sin(t * 3)}}
				blinkSeed={17}
				shadow={{w: 0.8, d: 0.32, opacity: 0.28, offset: [0.25, -0.2]}}
				renderOrder={10}
			/>
			<Glow position={[face[0] + 0.02, face[1] - 0.04, face[2] + 0.05]} size={0.9} color="#fff1c2" intensity={0.03 + 0.13 * shine} renderOrder={20} />
			<Dust count={70} center={[x + 0.5, ridgeY(x) + 1.4, 0.4]} size={[5, 3, 3]} t={t} color="#fff0cf" px={lite ? 3 : 5} rise={0.04} seed={51} opacity={0.5} />
		</>
	);
};
export const DOWN: ShotDef = {
	id: 'DOWN',
	start: B.dawn - 0.3,
	end: B.faceCU + 0.3,
	Content: DownContent,
	camera: downCam,
	grade: (t) => morningGrade({bloom: 0.42 + 0.12 * shineAt(t), bloomThreshold: 0.86}),
	fog: fogOf(MORNING),
	rays: (t) => ({at: faceOf(t), strength: 0.04 + 0.22 * shineAt(t), color: [1.0, 0.92, 0.72]}),
};

// ---------------- S8 close-up: the shining face; he doesn't know ----------------
const CU_X = mosesX(B.faceCU);
const CU_EYE: Vec3 = [CU_X + 0.21, ridgeY(CU_X) + 1.5, 0.06];
// moses/bust_glow: eye 0.077 m in front of and 0.499 m above the bust's foot point
const BUST_POS: Vec3 = [CU_EYE[0] - 0.077, CU_EYE[1] - 0.499, CU_EYE[2]];
const cuFace = (): Vec3 => [CU_EYE[0] + 0.01, CU_EYE[1] - 0.06, CU_EYE[2] + 0.02];
const cuCam = (t: number): CamState => {
	const p = easeOut(seg(t, B.faceCU - 0.3, B.s9 + 0.3));
	return {pos: [CU_EYE[0] - 0.1 + 0.04 * p, CU_EYE[1] - 0.06, CU_EYE[2] + lerp(1.6, 1.38, p)], target: [CU_EYE[0] + 0.03, CU_EYE[1] + 0.01, CU_EYE[2]], fov: 32, drift: 0.4};
};
export const FACECU: ShotDef = {
	id: 'FACECU',
	start: B.faceCU - 0.3,
	end: B.s9 + 0.3,
	Content: ({t, lite}) => {
		const f = cuFace();
		const breathe = 0.5 + 0.5 * Math.sin(t * 2.4);
		return (
			<>
				<RidgeWorld t={t} mood={MORNING} lite={lite} center={[CU_X, ridgeY(CU_X), 0]} />
				<Actor
					position={BUST_POS}
					t={t}
					poses={[[-10, 'moses/bust_glow']]}
					look={{tint: '#f6e8d6', grad: {dir: [-1, 0.4], color: '#ffdca6', amount: 0.25, soft: 0.5}, rimLight: 0.5, rimColor: '#ffe6b0', rimDir: [-1, 0.4]}}
					warp={{breath: 0.004 * Math.sin(t * 2.4)}}
					blinkSeed={23}
					renderOrder={10}
				/>
				<Glow position={[f[0], f[1], f[2] + 0.04]} size={0.5} color="#fff3c8" intensity={0.1 + 0.03 * breathe} renderOrder={20} />
				<Dust count={40} center={[f[0], f[1], f[2] + 0.15]} size={[0.6, 0.6, 0.3]} t={t} color="#fff4d0" px={lite ? 3 : 4} rise={0.03} seed={53} opacity={0.7} />
			</>
		);
	},
	camera: cuCam,
	grade: () => morningGrade({bloom: 0.45, bloomThreshold: 0.88, vignette: 0.5}),
	fog: fogOf(MORNING),
	rays: () => ({at: cuFace(), strength: 0.22, color: [1.0, 0.93, 0.76]}),
	anchors: () => ({shiningFace: [CU_EYE[0] + 0.03, CU_EYE[1] - 0.1, CU_EYE[2]]}),
};

// ---------------- S9: the camp; Aaron and the people step back ----------------
// Everyone faces right, toward Moses walking in from the right (flipped walk pose).
type Person = {s: string; x: number; z: number; back: number; order: number; seed: number};
const PEOPLE: Person[] = [
	{s: 'people/old_man', x: -2.65, z: -0.9, back: 0.3, order: 1, seed: 1},
	{s: 'people/woman', x: -2.15, z: -0.05, back: 0.35, order: 2, seed: 2},
	{s: 'people/man', x: -1.7, z: -0.75, back: 0.45, order: 3, seed: 3},
	{s: 'people/boy', x: -1.3, z: 0.55, back: 0.3, order: 4, seed: 4},
	{s: 'people/mother_girl', x: -0.8, z: -0.35, back: 0.4, order: 5, seed: 5},
];
const AARON = {x: -0.15, z: 0.45};
const MOSES_CAMP = {from: 3.4, to: 1.25, z: 0.15};
const campMosesX = (t: number) => lerp(MOSES_CAMP.from, MOSES_CAMP.to, easeOut(seg(t, B.s9 - 0.2, B.gasp1 + 0.7)));
const campFace = (t: number): Vec3 => [campMosesX(t) - 0.21, 1.47, MOSES_CAMP.z + 0.06];
// a slow pan from Moses walking in to the people stepping back, ending on the child peeking out
const campCam = (t: number): CamState => {
	const pan = easeInOut(seg(t, B.s9 + 0.6, B.stepBack - 0.1));
	const peek = easeInOut(seg(t, B.childPeek - 0.6, B.s10 + 0.3));
	const x = lerp(0.75, -1.05, pan) + 0.2 * peek;
	return {pos: [x + 0.3, 1.3, lerp(6.9, 6.3, pan) - 0.8 * peek], target: [x, 2.3 - 0.1 * peek, 0], fov: 36, drift: 0.6};
};
const stepBackAt = (t: number) => seg(t, B.stepBack, B.stepBack + 0.45, easeOut);
const CampContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const mx = campMosesX(t);
	const walking = 1 - seg(t, B.gasp1 + 0.4, B.gasp1 + 0.8);
	const flinch = pulse(t, B.gasp1, 0.06, 0.5);
	const back = stepBackAt(t);
	const warm = 0.25 + 0.25 * smooth(seg(t, B.s9, B.gasp1 + 0.5));
	const peekLean = springStep(t, B.childPeek, 1.6, 0.5);
	const face = campFace(t);
	return (
		<>
			<CampWorld t={t} mood={CAMP_DAY} lite={lite} />
			{PEOPLE.map((p) => (
				<Actor
					key={p.s}
					position={[p.x - p.back * back, 0, p.z]}
					t={t}
					poses={[[-10, p.s]]}
					look={{tint: '#fff0e0', grad: {dir: [1, 0.25], color: '#ffe0a8', amount: warm, soft: 0.5}}}
					warp={{lean: -10 * flinch - 14 * back + (p.s === 'people/mother_girl' ? 5 * peekLean : 0), breath: 0.008 * Math.sin(t * 2.6 + p.seed)}}
					shadow={{w: 0.7, d: 0.28, opacity: 0.25, offset: [-0.25, -0.15]}}
					renderOrder={p.order}
				/>
			))}
			<Actor
				position={[AARON.x - 0.5 * back, 0, AARON.z]}
				t={t}
				poses={[
					[-10, 'aaron/side'],
					[B.stepBack, 'aaron/step_back'],
				]}
				look={{tint: '#fff0e0', grad: {dir: [1, 0.25], color: '#ffe0a8', amount: warm + 0.1, soft: 0.5}}}
				warp={{lean: -8 * flinch, breath: 0.008 * Math.sin(t * 2.4)}}
				blinkSeed={29}
				shadow={{w: 0.7, d: 0.28, opacity: 0.25, offset: [-0.25, -0.15]}}
				renderOrder={6}
			/>
			<Actor
				position={[mx, 0.02 * walking * Math.abs(Math.sin((Math.PI * t) / STEP)), MOSES_CAMP.z]}
				t={t}
				poses={[[-10, 'moses/walk_glow']]}
				facing={-1}
				look={{tint: '#f8ecdc', rimLight: 0.45, rimColor: '#ffe2a8', rimDir: [1, 0.5]}}
				warp={{hem: [5 * Math.sin((Math.PI * t) / STEP) * walking, 0.62, 1], breath: 0.006 * Math.sin(t * 3)}}
				blinkSeed={17}
				shadow={{w: 0.8, d: 0.3, opacity: 0.25, offset: [-0.25, -0.15]}}
				renderOrder={7}
			/>
			<Glow position={[face[0], face[1] - 0.04, face[2] + 0.05]} size={0.8} color="#fff1c2" intensity={0.55} renderOrder={20} />
			<pointLight position={[face[0] - 0.4, face[1], 0.8]} color="#ffe2a8" intensity={1.6} distance={6} decay={1.5} />
			<Dust count={60} center={[0, 1.4, 0.5]} size={[8, 3, 3]} t={t} color="#fff0cf" px={lite ? 3 : 5} rise={0.03} seed={57} opacity={0.4} />
		</>
	);
};
export const CAMP: ShotDef = {
	id: 'CAMP',
	start: B.s9 - 0.3,
	end: B.s10 + 0.3,
	Content: CampContent,
	camera: campCam,
	grade: () => morningGrade({bloom: 0.55}),
	fog: fogOf(CAMP_DAY),
	rays: (t) => ({at: campFace(t), strength: 0.4, color: [1.0, 0.93, 0.76]}),
};

// ---------------- S10: the veil; then the camera cranes up into the sky ----------------
const VEIL_POS: Vec3 = [2.2, 0, 2.0];
// his face in moses/walk_glow is 0.21 m in front of his foot point; moses/veil is drawn 0.22 m further
// forward and a little larger, so it is placed back and scaled to keep his head where it was
const VEIL_SHIFT = -0.2;
const VEIL_SCALE = 0.92;
const veilFace: Vec3 = [VEIL_POS[0] + 0.2, 1.45, VEIL_POS[2] + 0.06];
const veilCam = (t: number): CamState => {
	const settle = easeOut(seg(t, B.s10 - 0.3, B.s10 + 1.5));
	const up = easeInOut(seg(t, B.craneUp, B.streak + 0.3));
	return {
		pos: [VEIL_POS[0] + 0.55 - 0.1 * settle, lerp(1.4, 7.5, up), VEIL_POS[2] + lerp(3.6 - 0.4 * settle, 5.5, up)],
		// up past his head into the morning sky, toward the sun
		target: [VEIL_POS[0] + 0.25 - 50 * up ** 1.3, lerp(1.45, 34, up ** 1.3), VEIL_POS[2] - 80 * up ** 1.3],
		fov: 32,
		drift: 0.5,
	};
};
const veilGlow = (t: number) => 1 - 0.8 * smooth(seg(t, B.veilOn - 0.05, B.veilOn + 0.4));
export const VEIL: ShotDef = {
	id: 'VEIL',
	start: B.s10 - 0.3,
	end: B.streak + 0.6,
	Content: ({t, lite}) => {
		const g = veilGlow(t);
		// a two-frame cross-switch with a smear, as the Actor does between poses
		const m = clamp((t - (B.veilOn - 0.067)) / 0.067);
		const smear = 4 * Math.sin(Math.PI * m);
		const look = {tint: '#f8ecdc', grad: {dir: [-1, 0.4] as [number, number], color: '#ffd9a0', amount: 0.2, soft: 0.5}, rimLight: 0.4, rimColor: '#ffe2a8', rimDir: [-1, 0.5] as [number, number]};
		return (
			<>
				<CampWorld t={t} mood={CAMP_DAY} lite={lite} center={VEIL_POS} />
				{m < 1 && (
					<Actor
						position={VEIL_POS}
						t={t}
						poses={[[-10, 'moses/walk_glow']]}
						look={{...look, opacity: 1 - m, blur: smear}}
						warp={{breath: 0.007 * Math.sin(t * 2.6)}}
						blinkSeed={17}
						shadow={{w: 0.8, d: 0.3, opacity: 0.25, offset: [-0.25, -0.15]}}
						renderOrder={10}
					/>
				)}
				{m > 0 && (
					<Actor
						position={[VEIL_POS[0] + VEIL_SHIFT, 0, VEIL_POS[2]]}
						t={t}
						poses={[[-10, 'moses/veil']]}
						scale={VEIL_SCALE}
						look={{...look, opacity: m, blur: smear}}
						warp={{breath: 0.007 * Math.sin(t * 2.6)}}
						shadow={{w: 0.8, d: 0.3, opacity: 0.25 * m, offset: [-0.05, -0.15]}}
						renderOrder={10.1}
					/>
				)}
				<Glow position={[veilFace[0], veilFace[1], veilFace[2] + 0.05]} size={0.75} color="#fff1c2" intensity={0.5 * g + 0.04} renderOrder={20} />
			</>
		);
	},
	camera: veilCam,
	grade: (t) => morningGrade({bloom: 0.5 + 0.35 * seg(t, B.craneUp, B.streak), exposure: 1.02 + 0.12 * seg(t, B.craneUp + 0.8, B.streak + 0.3)}),
	fog: fogOf(CAMP_DAY),
	rays: (t) => (t < B.veilOn + 0.5 ? {at: veilFace, strength: 0.35 * veilGlow(t), color: [1.0, 0.93, 0.76]} : null),
	anchors: () => ({veil: [veilFace[0], veilFace[1] - 0.05, veilFace[2]]}),
};
