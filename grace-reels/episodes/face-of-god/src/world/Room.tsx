// The upper room by lamplight, reused from "Friend": the painted back wall, the long low table and the
// seated disciples as flat planes at their depths; code adds the flickering lamp glows and the dust.
import {Actor} from '../characters/Actor';
import {Flame, flicker, Glow} from '../fx/Flame';
import {ParticleSpec, Particles} from '../fx/Particles';
import {hash} from '../lib/random';
import {B} from '../lib/timeline';
import type {SpriteLook} from '../render/spriteMaterial';
import type {Vec3} from '../render/types';
import {Haze, Layer} from './Layer';

const BACK = {x: -1.3, yBottom: -2.2, z: -7.5, width: 13};
const BACK_S = BACK.width / 1536;
// a pixel of the back painting -> world position (just in front of it)
const roomPx = (px: number, py: number, dz = 0.05): Vec3 => [BACK.x + (px - 768) * BACK_S, BACK.yBottom + (1024 - py) * BACK_S, BACK.z + dz];
// the lamps painted in the niches and on the shelf (their flames get a code glow and flicker)
const PAINTED_LAMPS: [number, number][] = [[57, 352], [100, 537], [760, 393], [1025, 330], [1468, 416], [1313, 607]];

export const WARM: SpriteLook = {tint: '#ffe3c6', grad: {dir: [1, 0.3], color: '#ffd29a', amount: 0.18}};

// The near row (in front of the table, facing the head of the table on the right). Philip sits nearest
// to Jesus.
export const SEATS: {s: string; x: number; z: number}[] = [
	{s: 'disciples/d4', x: 1.5, z: -1.6}, // Philip
	{s: 'disciples/d7', x: 0.55, z: -1.62},
	{s: 'disciples/d5', x: -0.4, z: -1.58},
	{s: 'disciples/d8', x: -1.35, z: -1.61},
	{s: 'disciples/d9', x: -2.3, z: -1.59},
	{s: 'disciples/d3', x: -3.25, z: -1.6},
	{s: 'disciples/d6', x: -4.2, z: -1.62},
];
const FAR_ROW: {s: string; x: number}[] = [
	{s: 'disciples/d1', x: 1.05},
	{s: 'disciples/d2', x: -0.95},
	{s: 'disciples/d6', x: -2.85},
];
export const JESUS_SEAT: Vec3 = [2.55, 0, -1.75];

const ROOM_DUST: ParticleSpec[] = Array.from({length: 110}, (_, i) => ({
	birth: B.streak - 4 + (i / 110) * (B.s12 + 1 - (B.streak - 4)),
	pos: [-3 + hash(81, i) * 7, 0.2 + hash(82, i) * 2.2, -2.6 + hash(83, i) * 3.2] as Vec3,
	vel: [(hash(84, i) - 0.5) * 0.05, 0.02 + hash(85, i) * 0.04, (hash(86, i) - 0.5) * 0.03] as Vec3,
	life: 3 + hash(87, i) * 2.5,
	size: 0.3 + hash(88, i) * 0.6,
	seed: hash(89, i),
}));

// The back painting, plus a floor colour continued below its bottom edge so a high camera never sees past it.
const RoomBack: React.FC<{blur: number}> = ({blur}) => (
	<>
		<Layer sprite="bg/room_back" position={[BACK.x, BACK.yBottom, BACK.z]} width={BACK.width} look={{tint: '#fff1e2', blur}} renderOrder={-900} />
		<Haze position={[BACK.x, BACK.yBottom - 2.49, BACK.z]} size={[BACK.width, 5]} color="#5f3a24" bottom={1} top={1} soft={0} renderOrder={-899} />
		<Haze position={[BACK.x, BACK.yBottom - 2.49, BACK.z + 0.01]} size={[BACK.width, 5]} color="#140904" bottom={0.95} top={0} soft={0} renderOrder={-898} />
	</>
);

export const RoomWorld: React.FC<{t: number; lite: boolean; hide?: string[]; blurBack?: number; children?: React.ReactNode}> = ({t, lite, hide = [], blurBack = 0, children}) => (
	<>
		<RoomBack blur={blurBack} />
		{PAINTED_LAMPS.map(([px, py], i) => (
			<Glow key={i} position={roomPx(px, py - 6)} size={0.9} color="#ffb060" intensity={0.5 * flicker(t, 40 + i)} renderOrder={-890} />
		))}
		<Haze position={[BACK.x, 0.2, -6.5]} size={[16, 4]} color="#ff9a50" bottom={0.08} top={0} additive renderOrder={-880} />
		{/* the long low table, two pieces end to end, behind the near row */}
		<Layer sprite="props/table" position={[0.95, -0.02, -2.75]} width={3.45} look={{tint: '#ffe6cc', blur: blurBack * 0.5}} renderOrder={-700} />
		<Layer sprite="props/table" position={[-2.45, -0.02, -2.76]} width={3.45} flipX look={{tint: '#ffe6cc', blur: blurBack * 0.5}} renderOrder={-701} />
		{FAR_ROW.map((f, i) => (
			<Actor key={i} position={[f.x, 0.05, -3.35]} t={t} poses={[[0, f.s]]} look={{...WARM, tint: '#e9c9aa', blur: 1.5 + blurBack * 0.6}} warp={{breath: 0.006 * Math.sin(t * 2 + i)}} renderOrder={-760 + i} />
		))}
		{SEATS.map((seat, i) =>
			hide.includes(seat.s) ? null : (
				<Actor key={i} position={[seat.x, 0, seat.z]} t={t} poses={[[0, seat.s]]} look={WARM} warp={{breath: 0.007 * Math.sin(t * 2.1 + i * 1.3)}} renderOrder={-400 + i} />
			),
		)}
		{children}
		{/* lamps close to the lens and the pillar: foreground parallax, out of focus */}
		<Layer sprite="room/hanging_lamp" position={[1.95, 1.3, 0.6]} width={0.55} look={{tint: '#e8b88a', blur: 6}} renderOrder={600} />
		<Glow position={[1.81, 1.4, 0.62]} size={0.5} color="#ffb060" intensity={0.7 * flicker(t, 77)} renderOrder={601} />
		<Flame position={[1.81, 1.38, 0.63]} height={0.07} t={t} seed={77} glow={3} renderOrder={602} />
		<Layer sprite="room/pillar" position={[-6.4, -0.1, 0.4]} width={0.75} look={{tint: '#c99a74', blur: 8}} renderOrder={610} />
		<Layer sprite="room/jar" position={[3.45, -0.1, 0.5]} width={0.65} look={{tint: '#d7a37c', blur: 8}} renderOrder={611} />
		<Layer sprite="room/cushions" position={[-2.0, -0.25, 1.2]} width={0.9} look={{tint: '#c88f6c', blur: 10}} renderOrder={612} />
		<Particles specs={ROOM_DUST} t={t} gravity={0.006} drag={0.3} colors={['#fff2d6', '#ffd9a0', '#e3a868']} opacity={0.38} px={lite ? 4 : 6} swirl={0.04} renderOrder={590} />
	</>
);
