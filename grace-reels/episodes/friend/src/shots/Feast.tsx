// The warm half of the S12 split (the basin and towel in the upper room), S14 (the bright feast:
// Jesus laughing with ordinary people) and S15 (the call to action: the basin and towel glowing softly
// in the dark).
import {Actor} from '../characters/Actor';
import {Glow} from '../fx/Flame';
import {ParticleSpec, Particles} from '../fx/Particles';
import {clamp, easeInOut, easeOut, lerp, seg} from '../lib/ease';
import {hash} from '../lib/random';
import {B, SCENE} from '../lib/timeline';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {Haze, Layer, Pool} from '../world/Layer';
import {RoomWorld, SEATS} from './Room';
import {WaterSurface} from '../fx/Water';
import {divider} from './split';

// ---------------- S12, left: the same night, in the warm room ----------------
export const SAMENIGHT: ShotDef = {
	id: 'SAMENIGHT',
	start: SCENE.S12.start - 0.5,
	end: SCENE.S13.start + 0.5,
	Content: ({t, lite}) => {
		const seat = SEATS[1];
		const kx = seat.x + 0.78;
		const scrub = Math.sin((t - B.s12) * 8) * 0.01;
		const hits = Array.from({length: 10}, (_, i) => ({at: B.s12 + 0.1 + i * 0.5, x: -0.05 + 0.1 * hash(221, i), z: 0, amp: 0.6}));
		return (
			<RoomWorld t={t} lite={lite} blurBack={3}>
				<Layer sprite="props/basin_side" position={[seat.x + 0.42, 0, -1.15]} width={0.62} look={{tint: '#ffe0c0'}} renderOrder={-290} />
				<WaterSurface position={[seat.x + 0.42, 0.12, -1.14]} radius={0.27} aspect={0.12} t={t} hits={hits} fill={1} renderOrder={-289} />
				<Actor position={[kx + scrub, 0, -1.25]} t={t} poses={[[0, 'jesus/kneel_wash']]} facing={-1} blinkSeed={5} look={{tint: '#fff0dc', grad: {dir: [-1, 0.2], color: '#ffd8a8', amount: 0.22}}} warp={{breath: 0.006 * Math.sin(t * 2.2), lean: 5 * Math.sin((t - B.s12) * 4.5)}} renderOrder={-280} />
				<Layer sprite="props/towel_fold" position={[seat.x + 1.05, 0, -0.95]} width={0.36} look={{tint: '#fff2e2'}} renderOrder={-270} />
				<Pool position={[seat.x + 0.5, 0.35, -1.0]} size={[1.6, 1.4]} color="#ffc070" intensity={0.25} renderOrder={-260} />
			</RoomWorld>
		);
	},
	camera: (t): CamState => {
		const u = seg(t, SCENE.S12.start - 0.5, SCENE.S13.start + 0.5, (x) => x);
		// keep Jesus' head, hands and the basin (around x = 1.0) centred in the part of the screen left of
		// the divider: half the frame, then more, then all of it
		const z = 3.4 - 0.3 * u;
		const w = 2 * (z + 1.25) * Math.tan((16 * Math.PI) / 180) * (1080 / 1920); // frame width at Jesus' depth
		const d = clamp(divider(t), 0.5, 1);
		const x = 1.0 + (0.5 - d / 2) * w;
		return {pos: [x, 0.95, z], target: [x, 0.6, -1.4], fov: 32, drift: 0.5};
	},
	grade: () => ({exposure: 1.04, contrast: 1.06, saturation: 1.04, gain: [1.06, 1.0, 0.9], lift: [0.012, 0.006, 0.0], vignette: 0.45, bloom: 0.55, bloomThreshold: 0.74, grain: 0.02}),
	anchors: () => ({sameNight: [SEATS[1].x + 0.78 - 0.42, 0.95, -1.25] as Vec3}),
};

// ---------------- S14 · a friend of publicans and sinners ----------------
const FEAST_TABLE_Z = -2.2;
const GUESTS: {s: string; x: number; z: number; facing: number; order: number}[] = [
	{s: 'guests/g3', x: -1.45, z: -2.55, facing: 1, order: -560}, // old man, clapping
	{s: 'guests/g1', x: -0.72, z: -1.75, facing: 1, order: -380}, // tax collector, laughing with a cup
	{s: 'guests/g2', x: 1.35, z: -2.6, facing: -1, order: -555}, // woman with a cup
	{s: 'guests/g6', x: 1.0, z: -1.7, facing: 1, order: -375}, // the poor man in a patched tunic (drawn facing left)
	{s: 'guests/g4', x: -0.15, z: -1.25, facing: 1, order: -300}, // young man reaching for bread
];
const DUST: ParticleSpec[] = Array.from({length: 60}, (_, i) => ({
	birth: B.s14 - 1 + (i / 60) * 6,
	pos: [-2 + hash(501, i) * 4, 0.3 + hash(502, i) * 2.5, -3 + hash(503, i) * 3] as Vec3,
	vel: [(hash(504, i) - 0.5) * 0.08, 0.04 + hash(505, i) * 0.06, 0] as Vec3,
	life: 3 + hash(506, i) * 2,
	size: 0.4 + hash(507, i) * 0.6,
	seed: hash(508, i),
}));
export const FEAST: ShotDef = {
	id: 'FEAST',
	start: SCENE.S14.start - 0.5,
	end: SCENE.S15.start + 0.5,
	Content: ({t, lite}) => {
		const laugh = (k: number) => 0.012 * Math.max(0, Math.sin((t + hash(511, k) * 3) * 11)) * (0.6 + 0.4 * Math.sin(t * 1.3 + k));
		const g5x = lerp(2.4, 1.85, seg(t, B.s14 - 0.5, B.s14 + 2.2, easeOut));
		return (
			<>
				<Layer sprite="bg/feast_back" position={[0.1, -2.6, -6]} width={6.6} look={{tint: '#fff6ea'}} renderOrder={-900} />
				{/* the rug continues below the painting for the crane-up */}
				<Haze position={[0.1, -2.6 - 2.49, -6]} size={[6.6, 5]} color="#9a4429" bottom={1} top={1} soft={0} renderOrder={-899} />
				<Haze position={[0.1, -2.6 - 2.49, -5.99]} size={[6.6, 5]} color="#3a1a0e" bottom={0.7} top={0} soft={0} renderOrder={-898} />
				<Haze position={[0, 1.2, -5.5]} size={[9, 5]} color="#fff0d0" bottom={0.12} top={0} additive renderOrder={-890} />
				{GUESTS.filter((g) => g.z < -2.3).map((g, k) => (
					<Actor key={g.s} position={[g.x, 0, g.z]} t={t} poses={[[0, g.s]]} facing={g.facing} look={{tint: '#fff2e2', blur: 1}} warp={{breath: laugh(k), tilt: [0.04 * Math.sin(t * 5 + k), 0.6, 0.35, 0.38]}} renderOrder={g.order} />
				))}
				<Layer sprite="props/table" position={[0.15, -0.02, FEAST_TABLE_Z]} width={3.0} look={{tint: '#fff0e0'}} renderOrder={-500} />
				<Layer sprite="feast/fruit_bowl" position={[-0.55, 0.42, FEAST_TABLE_Z + 0.05]} width={0.5} look={{tint: '#fff4e8'}} renderOrder={-495} />
				<Layer sprite="feast/bread_basket" position={[0.62, 0.42, FEAST_TABLE_Z + 0.05]} width={0.5} look={{tint: '#fff4e8'}} renderOrder={-494} />
				<Layer sprite="feast/pitcher" position={[0.08, 0.43, FEAST_TABLE_Z + 0.04]} width={0.24} look={{tint: '#fff4e8'}} renderOrder={-496} />
				{/* Jesus, laughing with them */}
				<Actor position={[0.25, 0, -1.6]} t={t} poses={[[0, 'jesus/laugh_sit']]} facing={-1} look={{tint: '#fff8ee', rim: 0.35, rimColor: '#fff0c0', rimDir: [-0.5, 1]}} warp={{breath: 0.014 * Math.max(0, Math.sin(t * 9.5)), tilt: [0.05 * Math.sin(t * 4.3), 0.5, 0.3, 0.36]}} renderOrder={-350} />
				{GUESTS.filter((g) => g.z >= -2.3).map((g, k) => (
					<Actor key={g.s} position={[g.x, 0, g.z]} t={t} poses={[[0, g.s]]} facing={g.facing} look={{tint: '#fff2e2'}} warp={{breath: laugh(k + 5), tilt: [0.035 * Math.sin(t * 5.5 + k), 0.6, 0.35, 0.38]}} renderOrder={g.order} />
				))}
				<Actor position={[g5x, 0, -2.0]} t={t} poses={[[0, 'guests/g5']]} facing={-1} look={{tint: '#fff2e2'}} warp={{wave: [3, 5, t * 4, 0.6]}} renderOrder={-370} />
				<Particles specs={DUST} t={t} gravity={0.01} drag={0.2} colors={['#fff6d8', '#ffe6a8', '#ffd890']} opacity={0.35} px={lite ? 4 : 6} swirl={0.05} renderOrder={600} />
				{/* the vine and the cushions close to the lens */}
				<Layer sprite="feast/vine" position={[0.4, 2.15, 0.6]} width={2.0} anchor="top" look={{tint: '#f6efe0', blur: 7}} renderOrder={700} />
				<Layer sprite="feast/cushions" position={[-0.95, -0.35, 0.9]} width={1.0} look={{tint: '#f6e6d6', blur: 9}} renderOrder={701} />
				<Layer sprite="feast/sapling" position={[1.55, -0.3, 0.7]} width={0.85} look={{tint: '#f0eadc', blur: 9}} renderOrder={702} />
			</>
		);
	},
	camera: (t): CamState => {
		// a warm crane-up over the feast
		const u = seg(t, SCENE.S14.start - 0.5, SCENE.S15.start + 0.5, easeInOut);
		return {pos: [0.15, lerp(0.85, 2.05, u), lerp(4.6, 5.1, u)], target: [0.15, lerp(0.95, 0.75, u), -2], fov: 32, drift: 0.6};
	},
	grade: () => ({exposure: 1.06, contrast: 1.04, saturation: 1.08, gain: [1.05, 1.01, 0.94], lift: [0.015, 0.01, 0.004], vignette: 0.32, bloom: 0.45, bloomThreshold: 0.82, grain: 0.015}),
	anchors: () => ({feastJesus: [0.18, 1.15, -1.6] as Vec3}),
};

// ---------------- S15 · call to action: the basin and the towel, glowing softly ----------------
const MOTES: ParticleSpec[] = Array.from({length: 70}, (_, i) => ({
	birth: B.s15 - 1 + (i / 70) * 7,
	pos: [-0.5 + hash(521, i) * 1.0, -0.05 + hash(522, i) * 0.4, -0.3 + hash(523, i) * 0.6] as Vec3,
	vel: [(hash(524, i) - 0.5) * 0.03, 0.05 + hash(525, i) * 0.06, 0] as Vec3,
	life: 2.5 + hash(526, i) * 2,
	size: 0.3 + hash(527, i) * 0.5,
	seed: hash(528, i),
}));
export const CTA: ShotDef = {
	id: 'CTA',
	start: SCENE.S15.start - 0.5,
	end: B.loopOut,
	Content: ({t, lite}) => {
		const glow = 0.6 + 0.15 * Math.sin(t * 1.4);
		return (
			<>
				<Haze position={[0, 0.2, -2]} size={[8, 6.4]} color="#1d130d" bottom={1} top={1} soft={0} renderOrder={-900} />
				<Pool position={[0.0, 0.18, -1.2]} size={[2.4, 1.6]} color="#ff9a4a" intensity={0.28 * glow} falloff={1.8} renderOrder={-880} />
				<Layer sprite="props/basin_side" position={[-0.05, 0, 0]} width={0.62} look={{tint: '#f2c8a0', rim: 0.9, rimColor: '#ffd08a', rimDir: [0, 1], glow: 0.04 * glow, lightColor: '#ffb870'}} renderOrder={10} />
				<WaterSurface position={[-0.05, 0.12, 0.01]} radius={0.27} aspect={0.12} t={t} hits={[{at: B.s15 + 0.4, x: 0, z: 0, amp: 0.5}, {at: B.yes, x: 0.05, z: 0, amp: 0.5}]} fill={1} renderOrder={11} />
				<Layer sprite="props/towel_fold" position={[0.43, 0, 0.08]} width={0.3} look={{tint: '#f6e2cc', rim: 0.8, rimColor: '#ffd8a0', rimDir: [-0.3, 1]}} renderOrder={12} />
				<Glow position={[-0.05, 0.14, 0.05]} size={0.9} color="#ffb870" intensity={0.22 * glow} renderOrder={13} />
				<Particles specs={MOTES} t={t} gravity={0.01} drag={0.3} colors={['#fff2c8', '#ffd27a', '#c98a2a']} opacity={0.55} px={lite ? 4 : 6} swirl={0.04} renderOrder={600} />
			</>
		);
	},
	camera: (t): CamState => {
		// the basin and the towel in the upper middle, room below for the answers and the comment
		const u = seg(t, SCENE.S15.start - 0.5, B.loopOut, (x) => x);
		return {pos: [0.14, 0.52 - 0.03 * u, 3.1 - 0.3 * u], target: [0.14, -0.09 - 0.01 * u, 0], fov: 32, drift: 0.4};
	},
	grade: () => ({exposure: 1.0, contrast: 1.1, saturation: 0.98, gain: [1.06, 0.98, 0.88], lift: [0.01, 0.006, 0.0], vignette: 0.7, bloom: 0.55, bloomThreshold: 0.7, grain: 0.02}),
};
