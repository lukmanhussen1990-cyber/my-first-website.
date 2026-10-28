// S2 · Enoch walks with God on a golden hill path, steps into the light, and is taken. The footprints stop.
import {CharacterRoot} from '../characters/Character';
import {enochWalk, walkPhase, walkSpeed} from '../characters/motion';
import {Rig} from '../characters/Rig';
import {RIGS, rigInfo} from '../characters/rig';
import {easeInOut, keys, pulse, seg, smooth} from '../lib/ease';
import {B, SCENE} from '../lib/timeline';
import {orbit} from '../render/camera';
import type {CamState, ShotDef} from '../render/types';
import {Dust, Footprints, LightBeam, LightPool} from '../world/atmosphere';
import {HillWorld, hillHeight} from '../world/HillWorld';
import {GOLDEN} from '../world/mood';

const RIG = 'enoch' as const;
const info = () => rigInfo(RIG);
const pxPerM = () => info().heightPx / RIGS[RIG].heightM;
const LEG_PX = 417;
const BEAM_X = 2.6;
const T0 = SCENE.S2.start - 0.4; // already walking when the scene appears
const T_STOP = B.steps.enoch[B.steps.enoch.length - 1] + 0.05;
const STOP_DUR = 0.5;

const amount = (t: number) => (t < T_STOP ? 1 : 1 - smooth((t - T_STOP) / STOP_DUR));
const speed = () => walkSpeed.enoch(pxPerM(), LEG_PX);

// x position: integral of speed * amount (pure function of t).
export const enochX = (t: number) => {
	const v = speed();
	const end = T_STOP - T0;
	const x0 = BEAM_X - 0.3 - v * end - v * (STOP_DUR / 2);
	if (t <= T_STOP) return x0 + v * (t - T0);
	const s = Math.min(1, (t - T_STOP) / STOP_DUR);
	const integ = s - (s * s * s - 0.5 * s * s * s * s); // ∫(1 - smoothstep)
	return x0 + v * end + v * STOP_DUR * integ;
};

// God's light walks beside Enoch ("Enoch walked with God"), then stops; he steps into it.
const GAP = 1.1;
const smin = (a: number, b: number, k = 0.22) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
export const beamX = (t: number) => smin(enochX(Math.min(t, T_STOP)) + GAP, BEAM_X);

const prints = () =>
	B.steps.enoch.map((at, k) => {
		const x = enochX(at) + ((LEG_PX * Math.sin((13 * Math.PI) / 180)) / pxPerM()) * 0.9;
		const z = k % 2 === 0 ? 0.07 : -0.07;
		return {x, y: hillHeight(x, z), z, at, flip: k % 2 === 1};
	});

const look = (t: number) => {
	const lookUp = seg(t, B.enochIntoLight + 0.55, B.enochIntoLight + 1.2, easeInOut);
	const reach = seg(t, B.enochIntoLight + 0.75, B.enochVanish - 0.1, easeInOut) * 0.55;
	const light = seg(t, B.enochIntoLight + 0.3, B.enochVanish - 0.25) * 0.5;
	const dissolve = seg(t, B.enochVanish - 0.35, B.enochVanish + 0.55);
	return {lookUp, reach, light, dissolve};
};

const beamI = (t: number) =>
	keys(t, [
		[SCENE.S2.start, 0.14],
		[B.enochBeamBright, 0.17],
		[B.enochBeamBright + 1.2, 0.24],
		[B.enochIntoLight, 0.27],
		[B.enochVanish - 0.2, 0.46],
		[B.enochVanish + 0.4, 0.62],
		[B.enochVanish + 2.5, 0.3],
		[SCENE.S3.start, 0.22],
	]);

// Camera: low tracking walk with the hills and sky behind the captions, push in as he steps into the light,
// look down on the last footprints in the pool, then crane up the beam toward heaven.
const camera = (t: number): CamState => {
	const ex = enochX(Math.min(t, B.enochVanish));
	const mid = (ex + beamX(t)) / 2;
	const all = prints();
	const lastPrint = all[all.length - 1].x;
	const settle = seg(t, B.enochVanish - 0.1, B.enochVanish + 2.4, easeInOut);
	const crane = seg(t, B.cardHebrewsOut - 1.2, SCENE.S3.start + 0.5, easeInOut);
	const tx = mid * (1 - settle) + (lastPrint - 0.15) * settle + 0.55 * crane;
	const ty = 1.0 - 0.5 * settle + 3.2 * crane;
	const dist = keys(t, [[T0, 16.5], [B.enochLabel + 0.6, 14], [B.enochIntoLight, 12.5], [B.enochVanish, 10.5], [B.enochVanish + 2.4, 8.8], [B.cardHebrewsOut - 1.2, 8.3], [SCENE.S3.start + 0.5, 10]]);
	const pitch = keys(t, [[T0, 7], [B.enochVanish, 9], [B.enochVanish + 2.4, 24], [B.cardHebrewsOut - 1.2, 25], [SCENE.S3.start + 0.5, -1]]);
	const yaw = keys(t, [[T0, 7], [B.enochVanish + 2.4, 3], [SCENE.S3.start, 1]]);
	return orbit([tx, ty, 0], dist, pitch, yaw, keys(t, [[T0, 27], [B.enochVanish + 2.4, 26], [SCENE.S3.start, 29]]));
};

const camPitchYaw = (t: number) => {
	const c = camera(t);
	const dx = c.pos[0] - c.target[0];
	const dy = c.pos[1] - c.target[1];
	const dz = c.pos[2] - c.target[2];
	return {pitch: Math.atan2(dy, Math.hypot(dx, dz)), yaw: Math.atan2(dx, dz)};
};

const Content: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const x = enochX(t);
	const p = walkPhase('enoch', t, T0);
	const l = look(t);
	const pose = enochWalk(p, {amount: amount(t), t, lookUp: l.lookUp, point: l.reach});
	const gone = l.dissolve >= 1;
	const {pitch, yaw} = camPitchYaw(t);
	const bi = beamI(t);
	const bx = beamX(t);
	const by = hillHeight(bx, 0);
	return (
		<>
			<HillWorld t={t} mood={GOLDEN} lite={lite} lightCenter={[x, 0, -2]} />
			<Footprints prints={prints()} t={t} />
			{!gone && (
				<CharacterRoot
					position={[x, hillHeight(x, 0), 0]}
					pxPerM={pxPerM()}
					yaw={yaw}
					lean={pitch}
					shadow={{w: 0.95, d: 0.36, opacity: 0.3 * (1 - l.dissolve), offset: [0.12, 0.05]}}
					shadowOrder={8}
				>
					<Rig
						blinkTime={t}
						name={RIG}
						pose={pose}
						renderOrder={100}
						look={{tint: GOLDEN.tint, light: l.light, glow: l.light * 0.4, dissolve: l.dissolve, dissolveY: [hillHeight(x, 0), hillHeight(x, 0) + 1.8], seed: 3.1, lightColor: '#fff0c8'}}
					/>
				</CharacterRoot>
			)}
			<LightPool position={[bx, by, 0]} radius={1.45 + 0.4 * pulse(t, B.enochVanish, 0.2, 1.5)} intensity={bi * 1.5} t={t} />
			<LightBeam position={[bx, by - 0.2, 0]} height={46} rTop={1.9} rBottom={0.95} intensity={bi} core={0.6} t={t} color="#ffe2a6" />
			<Dust count={lite ? 60 : 160} center={[bx, 4.5, 0]} size={[2.8, 9, 2.8]} t={t} rise={0.06} px={7} opacity={0.75} seed={4} />
			<Dust
				count={lite ? 80 : 220}
				center={[BEAM_X - 0.3, 3.2, 0.1]}
				size={[1.2, 6.5, 1.0]}
				t={t}
				rise={0.22}
				px={9}
				opacity={pulse(t, B.enochVanish + 0.1, 0.35, 1.6) * 1.4}
				color="#ffd88a"
				seed={9}
			/>
			<Dust count={lite ? 40 : 120} center={[0, 3, -2]} size={[26, 6, 10]} t={t} rise={0.02} px={5} opacity={0.35} seed={12} color="#ffe9c0" />
		</>
	);
};

export const S2: ShotDef = {
	id: 'S2',
	start: SCENE.S2.start - 0.4,
	end: SCENE.S3.start + 0.5,
	Content,
	camera,
	fog: () => ({color: GOLDEN.fog, near: GOLDEN.fogNear, far: GOLDEN.fogFar}),
	grade: (t) => ({
		exposure: 1.02,
		saturation: 1.02,
		contrast: 1.03,
		gain: [1.03, 1.0, 0.95],
		bloom: 0.5,
		bloomThreshold: 0.8,
		vignette: 0.4,
		flash: pulse(t, B.enochVanish + 0.05, 0.25, 0.7) * 0.32,
	}),
	anchors: (t) => ({enoch: [enochX(t) + 0.05, hillHeight(enochX(t), 0) + 1.85, 0]}),
};
