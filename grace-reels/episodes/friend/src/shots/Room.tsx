// The upper room at night: S2's landing, S3 (Jesus rises, lays aside His robe, ties the towel, pours
// the water, kneels), S4 (twelve feet, one after another) and S5 (Judas, from low at his feet).
// The room is the GPT back layer, a long low table and the seated disciples, all flat planes at their
// depths; code adds the flickering lamp glows, warm pools of light, water and the camera moves.
import * as THREE from 'three';
import spritesJson from '../../public/sprites/sprites.json';
import {Actor} from '../characters/Actor';
import {Flame, flicker, Glow} from '../fx/Flame';
import {ParticleSpec, Particles} from '../fx/Particles';
import {PourStream, Splash, splashSpecs, WaterSurface} from '../fx/Water';
import {clamp, easeInOut, easeOut, keys, lerp, pulse, seg, springStep} from '../lib/ease';
import {hash} from '../lib/random';
import {B, SCENE} from '../lib/timeline';
import type {CamState, ShotDef, Vec3} from '../render/types';
import type {SpriteLook} from '../render/spriteMaterial';
import {Haze, Layer, Pool} from '../world/Layer';

const SHEET = spritesJson as unknown as Record<string, {foot: [number, number]; w?: number}>;

// ---------------- the room ----------------
const BACK = {x: -1.3, yBottom: -2.2, z: -7.5, width: 13};
const BACK_S = BACK.width / 1536;
// A pixel of the back painting -> world position (just in front of it).
const roomPx = (px: number, py: number, dz = 0.05): Vec3 => [BACK.x + (px - 768) * BACK_S, BACK.yBottom + (1024 - py) * BACK_S, BACK.z + dz];
// The lamps painted in the niches and on the shelf (their flames get a code glow and flicker).
const PAINTED_LAMPS: [number, number][] = [[57, 352], [100, 537], [760, 393], [1025, 330], [1468, 416], [1313, 607]];

const WARM: SpriteLook = {tint: '#ffe3c6', grad: {dir: [1, 0.3], color: '#ffd29a', amount: 0.18}};

// The near row (in front of the table, facing the head of the table on the right), from Jesus' end.
export const SEATS: {s: string; x: number; z: number}[] = [
	{s: 'disciples/d5', x: 1.5, z: -1.6}, // Peter
	{s: 'disciples/d7', x: 0.55, z: -1.62}, // John
	{s: 'disciples/d2', x: -0.4, z: -1.58},
	{s: 'disciples/d8', x: -1.35, z: -1.61},
	{s: 'disciples/d9', x: -2.3, z: -1.59},
	{s: 'disciples/d3', x: -3.25, z: -1.6},
	{s: 'disciples/d6', x: -4.2, z: -1.62},
	{s: 'judas/sit_stiff', x: -5.15, z: -1.6},
];
const FAR_ROW: {s: string; x: number}[] = [
	{s: 'disciples/d1', x: 1.05},
	{s: 'disciples/d4', x: -0.95},
	{s: 'disciples/d2', x: -2.85},
	{s: 'disciples/d6', x: -4.55},
];
const JESUS_SEAT: Vec3 = [2.55, 0, -1.75];
const JUDAS = SEATS[7];

const ROOM_DUST: ParticleSpec[] = Array.from({length: 150}, (_, i) => ({
	birth: B.s2 - 4 + (i / 150) * (B.s6 + 0.5 - (B.s2 - 4)),
	pos: [-6 + hash(81, i) * 10, 0.2 + hash(82, i) * 2.2, -2.6 + hash(83, i) * 3.2] as Vec3,
	vel: [(hash(84, i) - 0.5) * 0.05, 0.02 + hash(85, i) * 0.04, (hash(86, i) - 0.5) * 0.03] as Vec3,
	life: 3 + hash(87, i) * 2.5,
	size: 0.3 + hash(88, i) * 0.6,
	seed: hash(89, i),
}));

// The back painting, plus the floor continued below its bottom edge (a flat floor colour falling into
// shadow toward the lens) so a wide or high camera never sees past it.
const FLOOR_BASE = new THREE.Color('#603018');
const RoomBack: React.FC<{x: number; tint: string; blur: number}> = ({x, tint, blur}) => {
	const floor = `#${FLOOR_BASE.clone().multiply(new THREE.Color(tint)).getHexString()}`;
	return (
		<>
			<Layer sprite="bg/room_back" position={[x, BACK.yBottom, BACK.z]} width={BACK.width} look={{tint, blur}} renderOrder={-900} />
			<Haze position={[x, BACK.yBottom - 2.49, BACK.z]} size={[BACK.width, 5]} color={floor} bottom={1} top={1} soft={0} renderOrder={-899} />
			<Haze position={[x, BACK.yBottom - 2.49, BACK.z + 0.01]} size={[BACK.width, 5]} color="#140904" bottom={0.95} top={0} soft={0} renderOrder={-898} />
		</>
	);
};

export const RoomWorld: React.FC<{t: number; lite: boolean; hide?: string[]; blurBack?: number; dimRow?: number; children?: React.ReactNode}> = ({t, lite, hide = [], blurBack = 0, dimRow = 1, children}) => (
	<>
		<RoomBack x={BACK.x} tint="#fff1e2" blur={blurBack} />
		{PAINTED_LAMPS.map(([px, py], i) => (
			<Glow key={i} position={roomPx(px, py - 6)} size={0.9} color="#ffb060" intensity={0.5 * flicker(t, 40 + i)} renderOrder={-890} />
		))}
		<Haze position={[BACK.x, 0.2, -6.5]} size={[16, 4]} color="#ff9a50" bottom={0.08} top={0} additive renderOrder={-880} />
		{/* the long low table, two pieces end to end, behind the near row */}
		<Layer sprite="props/table" position={[0.95, -0.02, -2.75]} width={3.45} look={{tint: '#ffe6cc', blur: blurBack * 0.5}} renderOrder={-700} />
		<Layer sprite="props/table" position={[-2.45, -0.02, -2.76]} width={3.45} flipX look={{tint: '#ffe6cc', blur: blurBack * 0.5}} renderOrder={-701} />
		{FAR_ROW.map((f, i) =>
			hide.includes(`far${i}`) ? null : (
				<Actor key={i} position={[f.x, 0.05, -3.35]} t={t} poses={[[0, f.s]]} look={{...WARM, tint: '#e9c9aa', blur: 1.5 + blurBack * 0.6}} warp={{breath: 0.006 * Math.sin(t * 2 + i)}} renderOrder={-760 + i} />
			),
		)}
		{SEATS.map((seat, i) =>
			hide.includes(seat.s) || hide.includes(`seat${i}`) ? null : (
				<Actor
					key={i}
					position={[seat.x, 0, seat.z]}
					t={t}
					poses={[[0, seat.s]]}
					blinkSeed={seat.s.startsWith('judas') ? 31 : null}
					look={{...WARM, opacity: dimRow}}
					warp={{breath: 0.007 * Math.sin(t * 2.1 + i * 1.3)}}
					renderOrder={-400 + i}
				/>
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
		{/* dust drifting in the lamp light */}
		<Particles specs={ROOM_DUST} t={t} gravity={0.006} drag={0.3} colors={['#fff2d6', '#ffd9a0', '#e3a868']} opacity={0.38} px={lite ? 4 : 6} swirl={0.04} renderOrder={590} />
	</>
);

const roomGrade = (extra: Partial<{exposure: number; vignette: number}> = {}) => ({
	exposure: 1.02,
	contrast: 1.06,
	saturation: 1.02,
	gain: [1.04, 1.0, 0.92] as [number, number, number],
	lift: [0.01, 0.005, 0.0] as [number, number, number],
	vignette: 0.5,
	bloom: 0.5,
	bloomThreshold: 0.75,
	grain: 0.02,
	...extra,
});

// ---------------- S2 landing + S3: Jesus rises, lays aside His robe, ties the towel ----------------
const RISE = B.jesusRise + 0.18;
const jesusPoses: [number, string][] = [
	[0, 'jesus/laugh_sit'],
	[RISE, 'jesus/stand'],
	[B.robeOff + 0.12, 'jesus/robe_off'],
	[B.towelTie, 'jesus/towel_tie'],
];
const cameraRoom = (t: number): CamState => {
	// lands wide on the head of the table, then a slow push to Jesus as He stands
	const a = seg(t, B.rewindLand, B.s3 + 0.4, easeOut);
	const b = seg(t, B.s3 + 0.2, B.towelTie + 0.4, easeInOut);
	const x = lerp(lerp(1.0, 1.55, a), 2.25, b);
	const y = lerp(1.15, 1.3, b);
	const z = lerp(lerp(9.5, 8.4, a), 5.2, b);
	const ty = lerp(lerp(1.1, 1.0, a), 1.05, b);
	return {pos: [x, y, z], target: [x - 0.05, ty, -2], fov: 32, drift: 0.7};
};
export const ROOM: ShotDef = {
	id: 'ROOM',
	start: SCENE.S2.start,
	end: B.pourStart + 0.1,
	Content: ({t, lite}) => {
		const rising = seg(t, RISE - 0.05, RISE + 0.45, easeOut);
		const dip = t > RISE - 0.35 && t < RISE ? -0.035 * Math.sin(((t - (RISE - 0.35)) / 0.35) * Math.PI) : 0;
		const standY = t >= RISE ? -0.22 * (1 - rising) : 0;
		return (
			<RoomWorld t={t} lite={lite}>
				<Actor
					position={[JESUS_SEAT[0], dip + standY, JESUS_SEAT[2]]}
					t={t}
					poses={jesusPoses}
					facing={-1}
					blinkSeed={5}
					look={{tint: '#fff0dc', grad: {dir: [-1, 0.3], color: '#ffd8a8', amount: 0.25}, rim: 0.35, rimColor: '#ffc078', rimDir: [-1, 0.4]}}
					warp={(p) => ({breath: 0.006 * Math.sin(t * 2.0), wave: p === 'jesus/robe_off' ? [4, 5, t * 3, 0.5] : [1.5, 5, t * 1.5, 0.65]})}
					renderOrder={-300}
				/>
				<Pool position={[2.4, 0.9, -1.4]} size={[3.2, 3.2]} color="#ffb870" intensity={0.12} renderOrder={-290} />
			</RoomWorld>
		);
	},
	camera: cameraRoom,
	grade: () => roomGrade(),
	anchors: () => ({jesusRoom: [JESUS_SEAT[0] - 0.05, 1.7, JESUS_SEAT[2]] as Vec3}),
};

// ---------------- S3 close-up: water poured from the jug into the basin ----------------
const POUR_JESUS: Vec3 = [0, 0, -0.2];
const POUR_PX = 399;
const MOUTH: [number, number] = [404, 420]; // the jug's lower lip in jesus/pour
const BASIN_TOP_W = 0.62;
// the basin sits on the floor right under the lip, so the stream falls almost straight down
const BASIN: Vec3 = [(MOUTH[0] - 84.9) / POUR_PX - 0.04, 0, -0.05];
const BASIN_S = BASIN_TOP_W / 742;
const basinInner = (): Vec3 => [BASIN[0] + (370 - 371) * BASIN_S, BASIN[1] + (311 - 118) * BASIN_S, BASIN[2] + 0.01];
const POUR_HITS = Array.from({length: 14}, (_, i) => ({at: B.pourStart + 0.15 + i * 0.075, x: (hash(201, i) - 0.5) * 0.02, z: (hash(202, i) - 0.5) * 0.01, amp: 0.8}));
const POUR_SPLASH = splashSpecs(B.pourStart + 0.12, B.pourEnd, [basinInner()[0], basinInner()[1] - 0.01, 0.0], 70, 31);
const flowAt = (t: number) => seg(t, B.pourStart + 0.05, B.pourStart + 0.2) * (1 - seg(t, B.pourEnd - 0.15, B.pourEnd));
export const POUR: ShotDef = {
	id: 'POUR',
	start: B.pourStart - 0.1,
	end: B.pourEnd + 0.15,
	Content: ({t, lite}) => {
		const mx = POUR_JESUS[0] + (MOUTH[0] - SHEET['jesus/pour'].foot[0]) / POUR_PX;
		const my = POUR_JESUS[1] + (SHEET['jesus/pour'].foot[1] - MOUTH[1]) / POUR_PX;
		const [bx, by, bz] = basinInner();
		const fill = seg(t, B.pourStart + 0.15, B.pourEnd);
		const flow = flowAt(t);
		return (
			<>
				<RoomBack x={BACK.x + 1.5} tint="#e8c8a8" blur={14} />
				<Pool position={[0.35, 0.4, -1.5]} size={[2.4, 2.0]} color="#ffb060" intensity={0.25} renderOrder={-880} />
				<Actor position={POUR_JESUS} t={t} poses={[[0, 'jesus/pour']]} look={{tint: '#fff0dc', grad: {dir: [1, 0], color: '#ffd8a8', amount: 0.3}}} warp={{breath: 0.004 * Math.sin(t * 2)}} renderOrder={10} />
				<Layer sprite="props/basin_top" position={BASIN} width={BASIN_TOP_W} look={{tint: '#ffe0c0'}} renderOrder={20} />
				<WaterSurface position={[bx, by, bz]} radius={0.265} aspect={0.27} t={t} hits={POUR_HITS} fill={fill} renderOrder={21} />
				<PourStream from={[mx, my - 0.005, 0.0]} to={[bx + 0.01, by + 0.005, 0.0]} t={t} flow={flow} width={0.03} renderOrder={30} />
				<Splash specs={POUR_SPLASH} t={t} px={lite ? 4 : 5} renderOrder={31} />
				{/* the soft glow of the water catching the lamp light */}
				<Glow position={[bx, by + 0.02, 0.05]} size={0.34} color="#ffd9a0" intensity={0.08 * fill + 0.06 * flow} renderOrder={32} />
			</>
		);
	},
	camera: (t) => {
		// the jug at the top of the frame, the basin at the bottom; a slow push and tilt down with the water
		const u = seg(t, B.pourStart - 0.1, B.pourEnd + 0.15, (x) => x);
		const x = BASIN[0] - 0.06;
		return {pos: [x + 0.03 * u, 0.64 - 0.06 * u, 2.6 - 0.25 * u], target: [x, 0.56 - 0.06 * u, 0], fov: 30, drift: 0.5};
	},
	grade: () => roomGrade({vignette: 0.6}),
};

// ---------------- S3 end: Jesus kneels and washes the first feet (Peter's) ----------------
// Jesus kneeling faces left, His hands at the seated man's feet; the basin under them.
const KNEEL_PX = 462;
const kneelAt = (seatX: number, seatSprite: string): Vec3 => {
	// the seated man's toes are ~0.17 m right of his foot point; Jesus' hands reach ~0.55 m in front of His knee
	const toes = seatSprite.startsWith('judas') ? 0.17 : 0.16;
	return [seatX + toes + 0.62, 0, -1.25];
};
const basinFor = (seatX: number): Vec3 => [seatX + 0.42, 0, -1.15];
const BASIN_SIDE_W = 0.62;
const WashGroup: React.FC<{seat: {s: string; x: number}; t: number; from: number; scrub: number; lookUp?: number; look?: SpriteLook; order?: number}> = ({seat, t, from, scrub, lookUp, look, order = -280}) => {
	const k = kneelAt(seat.x, seat.s);
	const b = basinFor(seat.x);
	const s = Math.sin((t - from) * 9) * 0.012 * scrub;
	const poses: [number, string][] = lookUp !== undefined ? [[0, 'jesus/kneel_wash'], [lookUp, 'jesus/kneel_lookup']] : [[0, 'jesus/kneel_wash']];
	const hits = Array.from({length: 6}, (_, i) => ({at: from + 0.15 + i * 0.45, x: -0.05 + 0.1 * hash(211, i), z: 0, amp: 0.6}));
	return (
		<>
			<Layer sprite="props/basin_side" position={b} width={BASIN_SIDE_W} look={{tint: '#ffe0c0', ...look}} renderOrder={order - 10} />
			<WaterSurface position={[b[0], b[1] + 0.12, b[2] + 0.01]} radius={0.27} aspect={0.12} t={t} hits={hits} fill={1} renderOrder={order - 9} />
			<Actor position={[k[0] + s, k[1], k[2]]} t={t} poses={poses} facing={-1} blinkSeed={5} look={{tint: '#fff0dc', grad: {dir: [-1, 0.2], color: '#ffd8a8', amount: 0.22}, ...look}} warp={{breath: 0.006 * Math.sin(t * 2.2), lean: 6 * Math.sin((t - from) * 4.5) * scrub}} renderOrder={order} />
		</>
	);
};

export const WASH: ShotDef = {
	id: 'WASH',
	start: B.pourEnd - 0.1,
	end: SCENE.S4.start + 0.3,
	Content: ({t, lite}) => {
		const kneelIn = seg(t, B.kneel - 0.05, B.kneel + 0.35, easeOut);
		return (
			<RoomWorld t={t} lite={lite} blurBack={3}>
				<group position={[0, 0.12 * (1 - kneelIn), 0]}>
					<WashGroup seat={SEATS[0]} t={t} from={B.washStart} scrub={seg(t, B.washStart, B.washStart + 0.3)} />
				</group>
			</RoomWorld>
		);
	},
	camera: (t) => {
		const u = seg(t, B.pourEnd - 0.1, SCENE.S4.start + 0.3, easeInOut);
		const x = lerp(2.3, 2.05, u);
		return {pos: [x, 0.95 - 0.1 * u, 3.6 - 0.5 * u], target: [x - 0.1, 0.62, -1.4], fov: 32, drift: 0.6};
	},
	grade: () => roomGrade(),
};

// ---------------- S4: all twelve (a quick dolly along the row) ----------------
// Jesus kneels at one seat after another, in time with the dots of the tracker.
const STATIONS: {at: number; seat: number}[] = [
	{at: B.dots[0] - 0.05, seat: 0},
	{at: B.dots[2] - 0.03, seat: 1},
	{at: B.dots[4] - 0.03, seat: 2},
	{at: B.dots[6] - 0.03, seat: 3},
	{at: B.dots[8] - 0.03, seat: 4},
	{at: B.dots[9] - 0.03, seat: 5},
	{at: B.dots[10] - 0.03, seat: 6},
	{at: B.dots[11] - 0.12, seat: 7},
];
const stationAt = (t: number) => {
	let i = 0;
	while (i + 1 < STATIONS.length && t >= STATIONS[i + 1].at) i++;
	return i;
};
const dollyX = (t: number) => keys(t, [[SCENE.S4.start - 0.3, 2.0], [B.dots[1], 1.35], [B.dots[3], 0.35], [B.dots[10], -3.75], [B.dots[11], -4.6], [SCENE.S5.start, -4.75]], easeInOut);
export const TWELVE: ShotDef = {
	id: 'TWELVE',
	start: SCENE.S4.start - 0.3,
	end: SCENE.S5.start + 0.3,
	Content: ({t, lite}) => {
		const i = stationAt(t);
		const st = STATIONS[i];
		const seat = SEATS[st.seat];
		const pop = clamp((t - st.at) / 0.067);
		// Peter pulls back in surprise; John bows his head, moved
		const peter = springStep(t, B.dots[0] + 0.05, 2.2, 0.35) * (1 - seg(t, B.dots[3], B.dots[4]));
		const john = seg(t, B.dots[2] + 0.05, B.dots[2] + 0.4, easeOut);
		return (
			<RoomWorld t={t} lite={lite} hide={['disciples/d5', 'disciples/d7']}>
				<Actor position={[SEATS[0].x - 0.06 * peter, 0.015 * peter, SEATS[0].z]} t={t} poses={[[0, 'disciples/d5']]} look={WARM} warp={{lean: -34 * peter, breath: 0.01 * peter}} renderOrder={-400} />
				<Actor position={[SEATS[1].x, 0, SEATS[1].z]} t={t} poses={[[0, 'disciples/d7']]} look={WARM} warp={{tilt: [-0.22 * john, 0.62, 0.3, 0.33], breath: 0.006 * Math.sin(t * 2)}} renderOrder={-399} />
				<group visible={t >= STATIONS[0].at}>
					<group scale={[1, 1, 1]}>
						<WashGroup seat={seat} t={t} from={st.at} scrub={1} look={{opacity: 0.55 + 0.45 * pop, blur: 3 * (1 - pop)}} />
					</group>
				</group>
				{STATIONS.map((s, k) => (
					<Glow key={k} position={[basinFor(SEATS[s.seat].x)[0], 0.16, -1.1]} size={0.6} color="#ffe6b0" intensity={0.6 * pulse(t, s.at + 0.05, 0.03, 0.25)} renderOrder={-200} />
				))}
			</RoomWorld>
		);
	},
	camera: (t) => {
		const x = dollyX(t);
		return {pos: [x, 0.95, 4.1], target: [x - 0.25, 0.68, -1.5], fov: 32, drift: 0.5, shake: 0.08 * seg(t, B.dots[1], B.dots[10]) * (1 - seg(t, B.dots[10], B.dots[11]))};
	},
	grade: () => roomGrade(),
};

// ---------------- S5: Judas, from low at his feet ----------------
const POUCH: [number, number] = [75, 378]; // the pouch on Judas's belt in judas/sit_stiff
const JUDAS_PX = 398;
const pouchWorld = (): Vec3 => [JUDAS.x + (POUCH[0] - SHEET['judas/sit_stiff'].foot[0]) / JUDAS_PX, (SHEET['judas/sit_stiff'].foot[1] - POUCH[1]) / JUDAS_PX, JUDAS.z + 0.02];
export const JUDAS_SHOT: ShotDef = {
	id: 'JUDAS',
	start: SCENE.S5.start - 0.3,
	end: SCENE.S6.start + 0.3,
	Content: ({t, lite}) => {
		const flinch = springStep(t, B.touch + 0.04, 3.2, 0.32) * (1 - seg(t, B.touch + 0.6, B.touch + 1.2));
		const glint = pulse(t, B.pouchGlint + 0.08, 0.05, 0.45);
		const p = pouchWorld();
		return (
			<RoomWorld t={t} lite={lite} hide={['judas/sit_stiff', 'seat6', 'far3']} blurBack={4}>
				<Actor
					position={[JUDAS.x - 0.012 * flinch, 0.012 * flinch, JUDAS.z]}
					t={t}
					poses={[[0, 'judas/sit_stiff'], [B.lookAway, 'judas/sit_away']]}
					blinkSeed={31}
					look={{tint: '#f2c9a4', grad: {dir: [1, -0.3], color: '#ffc890', amount: 0.25}, rim: 0.3, rimColor: '#ffb070', rimDir: [1, 0.3]}}
					warp={(pose) => ({breath: 0.004 * Math.sin(t * 3.1), lean: -10 * flinch + (pose === 'judas/sit_away' ? -4 : 0)})}
					renderOrder={-300}
				/>
				<WashGroup seat={JUDAS} t={t} from={B.touch - 0.25} scrub={0.6} lookUp={B.lookUp} />
				<Glow position={p} size={0.28} color="#fff0c8" intensity={1.4 * glint} renderOrder={-150} />
				<Glow position={[p[0] + 0.02, p[1] + 0.03, p[2]]} size={0.08} color="#ffffff" intensity={2.0 * glint} renderOrder={-149} />
			</RoomWorld>
		);
	},
	camera: (t) => {
		// low, at his feet: Judas's face up in the frame, the pouch on his belt, Jesus' hands in the basin;
		// after the glint it pushes in a little so both faces hold the frame above the scripture card
		const a = seg(t, SCENE.S5.start - 0.3, B.lookUp, (x) => x);
		const b = seg(t, B.lookUp - 0.1, B.lookUp + 1.3, easeInOut);
		const z = lerp(lerp(1.78, 1.62, a), 1.45, b);
		const x = lerp(-5.08, -4.95, b) + 0.02 * a;
		return {pos: [x, lerp(0.2, 0.3, b), z], target: [x - 0.02, lerp(0.62, 0.66, b), -1.5], fov: 40, drift: 0.45};
	},
	grade: () => roomGrade({vignette: 0.58}),
	anchors: () => ({judasFace: [JUDAS.x + 0.0, 1.15, JUDAS.z] as Vec3, pouch: pouchWorld()}),
};

// The cover: Jesus kneeling with the basin at Judas's feet, the pouch glinting (a frame of S5).
export const COVER: ShotDef = {
	...JUDAS_SHOT,
	id: 'COVER',
	start: -10,
	end: -9,
	Content: ({lite}) => <JUDAS_SHOT.Content t={B.pouchGlint + 0.12} lite={lite} />,
	// the title sits over the top third, so the men sit lower: Judas's eyes ~42% down, the pouch ~70%
	camera: () => ({pos: [-5.1, 0.42, 1.65], target: [-5.12, 0.92, -1.5], fov: 40, drift: 0}),
	grade: () => roomGrade({vignette: 0.6}),
};

