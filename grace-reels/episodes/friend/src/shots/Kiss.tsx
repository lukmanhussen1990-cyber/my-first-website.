// The kiss in close-up: S1 (the hook, in slow motion, then the rewind), the slow-motion kiss of S10,
// S11 (freeze, darkness, a warm light on Jesus' calm face, gold dust) and the loop back into frame 0.
// Both men come from the GPT close-up, placed exactly as drawn; Judas's lean is a slide plus a top lean.
import spritesJson from '../../public/sprites/sprites.json';
import {CharacterRoot} from '../characters/Character';
import {PoseWithBlink} from '../characters/Actor';
import {Flame} from '../fx/Flame';
import {ParticleSpec, Particles} from '../fx/Particles';
import {clamp, easeInOut, lerp, seg, smooth} from '../lib/ease';
import {hash, noise1} from '../lib/random';
import {B, SCENE} from '../lib/timeline';
import type {CamState, ShotDef} from '../render/types';
import {emberSpecs, Embers, GardenLayers, TORCH_HEAD} from '../world/Garden';
import {Pool} from '../world/Layer';

const SHEET = spritesJson as unknown as Record<string, {sheetBox: [number, number, number, number]; foot: [number, number]}>;
const PX = 1500; // close-up pixels per metre
// Centre of a piece of the close-up sheet in world metres (sheet bottom centre = origin).
const centre = (name: string): [number, number] => {
	const [x0, y0, w, h] = SHEET[name].sheetBox;
	return [(x0 + w / 2 - 768) / PX, (1024 - (y0 + h / 2)) / PX];
};
const JUDAS = centre('kiss/judas');
const JESUS = centre('kiss/jesus');

// Judas's lean (metres to the right) against the story time of the kiss. Contact (his face behind
// Jesus' cheek) at tauTouch; before that he leans in slowly; earlier times keep him further away
// (the rewind and the loop run time backwards past 0).
// Halfway in he hesitates: the approach almost stops for a moment, then goes on.
const hesitate = (u: number) => u - 0.1 * Math.sin(Math.PI * clamp((u - 0.32) / 0.36)) ** 2;
const leanAt = (tau: number, tauTouch: number) => {
	if (tau < -0.6) return 0.022 + 0.03 * (tau + 0.6);
	if (tau < tauTouch) return lerp(0.022, 0.1, easeInOut(hesitate((tau + 0.6) / (tauTouch + 0.6))) ** 0.9);
	return 0.1 - 0.012 * seg(tau, tauTouch + 1.0, tauTouch + 2.8);
};

// S1 story time: real time until the rewind, then it runs backwards faster and faster.
export const s1Tau = (t: number) => (t < B.rewindStart ? t : B.rewindStart - 5.5 * (t - B.rewindStart) ** 1.6);

// The crowd behind them, out of focus: generic men, torches held high (no faces readable).
const CROWD = [
	{s: 'crowd/torch1', x: -2.3, z: -4.6, y: -1.55, seed: 1},
	{s: 'crowd/staff2', x: -1.55, z: -5.4, y: -1.6, seed: 2},
	{s: 'crowd/torch2', x: -0.75, z: -5.0, y: -1.5, seed: 3},
	{s: 'crowd/sword1', x: 0.25, z: -6.2, y: -1.7, seed: 4},
	{s: 'crowd/torch1', x: 1.25, z: -6.8, y: -1.75, seed: 5},
	{s: 'crowd/staff1', x: 2.1, z: -6.0, y: -1.6, seed: 6},
];
const CROWD_PX = 262;

export type KissState = {
	tau: number; // story time of the lean
	tauTouch: number;
	t: number; // real time (flames, embers, blinks)
	dark: number; // 0..1 the world falls into darkness (S11)
	spot: number; // 0..1 warm light on Jesus' face
	jesusShut?: number;
	lite: boolean;
	embers: ParticleSpec[];
};

export const KissScene: React.FC<KissState> = ({tau, tauTouch, t, dark, spot, jesusShut = 0, lite, embers}) => {
	const lean = leanAt(tau, tauTouch);
	const flick = 0.9 + 0.1 * noise1(t * 9, 3) + 0.06 * noise1(t * 23, 5);
	const bg = 1 - dark;
	const night = {tint: '#9aa6c4', opacity: bg};
	const breathJ = 0.004 * Math.sin(t * 2.3);
	const breathJu = 0.006 * Math.sin(t * 3.1 + 1);
	return (
		<>
			<GardenLayers
				// the moon stays just off the right edge (its light spills in): a bright disc behind a head would read as a halo
				place={{sky: {x: 4.5, y: -1.1, z: -60, width: 32}, mid: {x: 0.6, y: -3.2, z: -10, width: 14}}}
				look={{sky: {...night, tint: '#c4cce0', blur: 3}, mid: {...night, blur: 12, tint: '#7d88a8'}, haze: 0.55 * bg}}
			/>
			{/* the crowd: silhouettes rimmed by their own torchlight, deep out of focus */}
			{CROWD.map((c, i) => {
				const sway = 0.02 * Math.sin(t * 1.7 + i);
				const s = 1 / CROWD_PX;
				const foot = SHEET[c.s].foot;
				return (
					<group key={i}>
						<CharacterRoot position={[c.x + sway, c.y, c.z]} pxPerM={CROWD_PX} shadow={null}>
							<PoseWithBlink sprite={c.s} t={t} blinkSeed={null} look={{tint: '#6a5048', sil: 0.82, silColor: '#1c1418', rim: 1.2, rimColor: '#ff9a4a', rimDir: [-0.4, 1], blur: 7, opacity: bg}} renderOrder={-600 + i} />
						</CharacterRoot>
						{TORCH_HEAD[c.s] && (
							<Flame
								position={[c.x + sway + (TORCH_HEAD[c.s][0] - foot[0]) * s, c.y + (foot[1] - TORCH_HEAD[c.s][1]) * s, c.z + 0.02]}
								height={0.5}
								t={t}
								seed={c.seed * 7.1}
								intensity={1.25 * bg}
								glow={4}
								renderOrder={-590 + i}
							/>
						)}
					</group>
				);
			})}
			{/* cool moonlight from the right and a warm torch glow behind Judas (soft, out of focus) */}
			<Pool position={[1.25, 0.75, -1.5]} size={[2.6, 3.0]} color="#8fa6d8" intensity={0.32 * bg} renderOrder={-500} />
			<Pool position={[-0.7, 0.2, -1.8]} size={[2.8, 2.2]} color="#ff8a3a" intensity={0.3 * bg * flick} renderOrder={-499} />
			{/* the warm light that stays on Jesus' face when everything else goes dark */}
			<Pool position={[JESUS[0] + 0.02, JESUS[1] + 0.08, -0.3]} size={[0.62, 0.8]} color="#ffc878" intensity={0.22 * spot} falloff={1.8} renderOrder={-498} />
			{/* Judas: lit from behind by the torches, falls to a silhouette in the dark */}
			<CharacterRoot position={[JUDAS[0] + lean, JUDAS[1] - 0.004 * seg(tau, tauTouch - 0.6, tauTouch), -0.03]} pxPerM={PX} shadow={null}>
				<PoseWithBlink
					sprite="kiss/judas"
					t={t}
					blinkSeed={null}
					anchor={[499, 485.5]}
					look={{
						tint: '#b98b6c',
						rim: 0.9 * flick * (1 - 0.65 * dark),
						rimColor: '#ff9a4a',
						rimDir: [-1, 0.25],
						grad: {dir: [-1, 0.2], color: '#ffcf9a', amount: 0.3},
						// in the freeze he falls into shadow (a dark shape, never see-through)
						sil: 0.9 * dark,
						silColor: '#0d0a0b',
						opacity: 1,
					}}
					warp={{breath: breathJu, lean: 40 * seg(tau, tauTouch - 1.2, tauTouch) - 8 * seg(tau, tauTouch + 1, tauTouch + 2.8)}}
					renderOrder={10}
					segs={[6, 18]}
				/>
			</CharacterRoot>
			{/* Jesus: soft moonlight, a warm rim from the torches; calm and still */}
			<CharacterRoot position={[JESUS[0], JESUS[1], 0]} pxPerM={PX} shadow={null}>
				<PoseWithBlink
					sprite="kiss/jesus"
					t={t}
					blinkSeed={null}
					shut={jesusShut}
					anchor={[319, 508]}
					look={{
						tint: '#d0d7e8',
						rim: 0.75 * flick * bg + 0.2,
						rimColor: '#ffb878',
						rimDir: [-1, 0.3],
						grad: {dir: [0.6, 1], color: '#eef2ff', amount: 0.22},
						light: 0.07 * spot,
						lightColor: '#ffd9a0',
						glow: 0.04 * spot,
					}}
					warp={{breath: breathJ}}
					renderOrder={20}
					segs={[6, 18]}
				/>
			</CharacterRoot>
			<Embers specs={embers} t={t} px={lite ? 7 : 10} opacity={0.9 * bg + 0.1} />
		</>
	);
};

// ---------------- S1 · the hook ----------------
const S1_EMBERS = emberSpecs(140, -2, B.s2 + 1.2, {x: [-2.4, 2.2], y: [-1.2, 0.4], z: [-5.5, -0.12]}, 11, 0.42);

const cam1 = (tau: number): CamState => {
	// a slow push-in from the two-shot to Jesus' calm face
	const p = seg(tau, -0.6, 4.7, (x) => x);
	const pe = easeInOut(p);
	const x = lerp(0.07, 0.205, pe);
	const y = lerp(0.43, 0.47, pe);
	const z = lerp(1.85, 0.95, pe ** 0.85);
	return {pos: [x, y + 0.02, z], target: [x, y, 0], fov: 30, drift: 0.6};
};
const camera1 = (t: number): CamState => {
	const tau = s1Tau(t);
	const c = cam1(Math.max(-3, tau));
	// the rewind whips the camera back and rolls it against the swirl
	const r = seg(t, B.rewindStart, B.rewindLand);
	return {...c, roll: 0.5 * r * r, shake: 0.3 * Math.sin(Math.PI * r)};
};

export const S1: ShotDef = {
	id: 'S1',
	start: 0,
	end: SCENE.S2.start + 1.2,
	Content: ({t, lite}) => <KissScene tau={s1Tau(t)} tauTouch={B.kissTouch} t={t} dark={0} spot={0} jesusShut={slowBlink(t, 3.15)} lite={lite} embers={S1_EMBERS} />,
	camera: camera1,
	grade: (t) => ({
		exposure: 1.02,
		contrast: 1.08,
		saturation: 0.96,
		gain: [1.0, 0.98, 1.03],
		lift: [0.004, 0.006, 0.018],
		vignette: 0.55,
		bloom: 0.6,
		bloomThreshold: 0.72,
		rewind: seg(t, B.rewindStart, B.rewindStart + 0.25) * (1 - seg(t, B.rewindLand - 0.2, B.rewindLand)),
		grain: 0.022,
	}),
	anchors: () => ({}),
};

// A slow, calm blink (Jesus): closes over 0.12 s, holds a moment, opens over 0.2 s.
export const slowBlink = (t: number, at: number) => {
	const d = t - at;
	if (d < 0 || d > 0.42) return 0;
	return d < 0.12 ? smooth(d / 0.12) : d < 0.2 ? 1 : 1 - smooth((d - 0.2) / 0.22);
};

// ---------------- S10 (close-up) and S11 · the kiss, then "Friend" ----------------
const S11_EMBERS = emberSpecs(150, B.s10 - 1, B.s12 + 1, {x: [-2.4, 2.2], y: [-1.2, 0.4], z: [-5.5, -0.12]}, 23, 0.42);
// gold dust in the warm light around Jesus once everything else has gone dark
const DUST: ParticleSpec[] = Array.from({length: 90}, (_, i) => ({
	birth: B.freeze + 0.2 + (i / 90) * (B.s12 - B.freeze),
	pos: [JESUS[0] - 0.3 + hash(71, i) * 0.6, JESUS[1] - 0.3 + hash(72, i) * 0.5, -0.3 + hash(73, i) * 0.32] as [number, number, number],
	vel: [(hash(74, i) - 0.5) * 0.04, 0.03 + hash(75, i) * 0.05, (hash(76, i) - 0.5) * 0.03] as [number, number, number],
	life: 2.2 + hash(77, i) * 1.8,
	size: 0.3 + hash(78, i) * 0.6,
	seed: hash(79, i),
}));

export const CU_IN = B.kissLean + 0.45; // the cut from the medium shot to the slow-motion close-up
// Story time of the close-up: the lean plays slowed down to contact on "kissed", then time stops at the freeze.
const s11Tau = (t: number) => {
	const tt = Math.min(t, B.freeze);
	return B.kissTouch + (tt - B.kissTouch2) * 0.55;
};
const camera11 = (t: number): CamState => {
	const a = seg(t, CU_IN, B.freeze, (x) => x);
	const b = seg(t, B.freeze, B.s12, easeInOut);
	const x = lerp(lerp(0.09, 0.15, a), 0.19, b);
	const y = lerp(0.44, 0.45, b);
	const z = lerp(lerp(1.6, 1.38, a), 1.12, b);
	return {pos: [x, y + 0.02, z], target: [x, y, 0], fov: 30, drift: 0.5 * (1 - b) + 0.15};
};
export const S11: ShotDef = {
	id: 'S11',
	start: CU_IN,
	end: SCENE.S12.start + 0.4,
	Content: ({t, lite}) => {
		const dark = seg(t, B.freeze, B.freeze + 0.6, easeInOut);
		const spot = seg(t, B.freeze + 0.15, B.friendWord, easeInOut);
		const tt = t < B.freeze ? t : B.freeze + (t - B.freeze) * 0.12; // flames and embers nearly stop
		return (
			<>
				<KissScene tau={s11Tau(t)} tauTouch={B.kissTouch} t={tt} dark={dark} spot={spot} jesusShut={slowBlink(t, 45.05)} lite={lite} embers={S11_EMBERS} />
				<Particles specs={DUST} t={t} gravity={0.02} drag={0.3} colors={['#fff4cc', '#ffd27a', '#c98a2a']} opacity={0.75 * dark} px={lite ? 2.5 : 3.5} swirl={0.03} renderOrder={950} />
			</>
		);
	},
	camera: camera11,
	grade: (t) => {
		const dark = seg(t, B.freeze, B.freeze + 0.6, easeInOut);
		return {
			exposure: 1.02 - 0.05 * dark,
			contrast: 1.08 + 0.06 * dark,
			saturation: 0.96 - 0.1 * dark + 0.12 * seg(t, B.friendWord, B.friendWord + 1),
			gain: [1.0 + 0.04 * dark, 0.98, 1.03 - 0.08 * dark],
			lift: [0.004 * (1 - dark), 0.006 * (1 - dark), 0.018 * (1 - dark)],
			vignette: 0.55 + 0.35 * dark,
			bloom: 0.5 - 0.1 * dark,
			bloomThreshold: 0.78 + 0.06 * dark,
			desat: 0.25 * clamp((t - B.freeze) / 0.2) * (1 - seg(t, B.freeze + 0.3, B.friendWord)),
		};
	},
};

// ---------------- the loop: the end flows back into the first frame ----------------
export const LOOP: ShotDef = {
	id: 'LOOP',
	start: B.loopOut,
	end: B.total + 1,
	Content: ({t, lite}) => <KissScene tau={t - B.total} tauTouch={B.kissTouch} t={t - B.total} dark={0} spot={0} lite={lite} embers={S1_EMBERS} />,
	camera: (t) => cam1(t - B.total),
	grade: (t) => S1.grade!(t - B.total),
};
