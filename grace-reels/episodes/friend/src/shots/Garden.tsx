// The garden shots: S9 (a line of torches winds through the olive trees toward us), S10 (Judas walks
// up to Jesus; the close-up of the kiss is in Kiss.tsx), the cold right half of the S12 split screen,
// and S13 (warm light rising behind the olive trees).
import spritesJson from '../../public/sprites/sprites.json';
import {Actor} from '../characters/Actor';
import {CharacterRoot, PoseSprite} from '../characters/Character';
import {Flame} from '../fx/Flame';
import {lerpHex} from '../lib/color';
import {clamp, easeInOut, easeOut, keys, lerp, seg} from '../lib/ease';
import {hash, noise1} from '../lib/random';
import {B, SCENE, WALK} from '../lib/timeline';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {emberSpecs, Embers, GardenLayers, TORCH_HEAD} from '../world/Garden';
import {Haze, Pool} from '../world/Layer';

const SHEET = spritesJson as unknown as Record<string, {foot: [number, number]}>;
const CROWD_PX = 262;

// ---------------- the procession ----------------
// The torch line walks the path painted in garden_mid: out from behind the rocks on the left, along the
// back of the clearing, then turning toward us. The walkers stand just in front of that layer on the
// painted path's pixels, scaled for depth, so their feet stay on the path whatever the camera does.
type MidPlace = {x: number; y: number; z: number; width: number};
// [px, py, figure scale] along the painted path
const PATH: [number, number, number][] = [
	[425, 879, 0.56], [510, 881, 0.6], [590, 886, 0.65], [670, 893, 0.71], [750, 902, 0.78], [820, 914, 0.87],
	[862, 932, 0.98], [884, 956, 1.12], [896, 986, 1.28], [903, 1024, 1.48], [906, 1070, 1.7],
];
// Walking metres along the path: a pixel is worth more far away (small figures) and a step toward us
// (down the picture) is foreshortened.
const PATH_M = PATH.map((_, i) => i).reduce<number[]>((acc, i) => {
	if (i === 0) return [0];
	const [x0, y0, s0] = PATH[i - 1];
	const [x1, y1, s1] = PATH[i];
	return [...acc, acc[i - 1] + (Math.hypot(x1 - x0, (y1 - y0) * 3) * 0.0124) / ((s0 + s1) / 2)];
}, []);
const PATH_END = PATH_M[PATH_M.length - 1];
const WALK_SPEED = 1.6; // m/s
const GAP = 0.95; // metres between walkers
// World position and figure scale at `d` walking metres along the path, on a given mid-layer placement.
const pathPoint = (mid: MidPlace, d: number) => {
	let i = 1;
	while (i < PATH_M.length - 1 && PATH_M[i] < d) i++;
	const u = clamp((d - PATH_M[i - 1]) / (PATH_M[i] - PATH_M[i - 1]), 0, 1.4);
	const [x0, y0, s0] = PATH[i - 1];
	const [x1, y1, s1] = PATH[i];
	const px = lerp(x0, x1, u);
	const py = lerp(y0, y1, u);
	const k = mid.width / 1536; // metres per painted pixel
	return {x: mid.x + (px - 768) * k, y: mid.y + (1024 - py) * k, z: mid.z + 0.15, s: lerp(s0, s1, u) * (mid.width / 19)};
};
const WALKERS = ['crowd/torch1', 'crowd/staff2', 'crowd/torch2', 'crowd/sword1', 'crowd/torch1', 'crowd/torch2', 'crowd/staff1', 'crowd/torch2', 'crowd/sword2', 'crowd/torch1', 'crowd/staff2', 'crowd/torch2', 'crowd/torch1', 'crowd/sword1'];
// Walking distance of walker k at time t (k = -1 is Judas, at the head of the line).
const walkerD = (k: number, t: number, t0: number) => (t - t0) * WALK_SPEED - (k + 1) * GAP + (k >= 0 ? 0.3 * (hash(301, k) - 0.5) : 0);

export const Procession: React.FC<{t: number; t0: number; mid: MidPlace; cool?: number; lite: boolean; withJudas?: boolean; dim?: number; blur?: number}> = ({
	t,
	t0,
	mid,
	cool = 0,
	withJudas = true,
	dim = 1,
	blur = 1,
}) => {
	const items: React.ReactNode[] = [];
	const tint = cool > 0 ? '#7f8fb8' : '#8f8090';
	WALKERS.forEach((spr, k) => {
		const d = walkerD(k, t, t0);
		if (d < 0 || d > PATH_END + 0.5) return;
		const p = pathPoint(mid, d);
		const s = p.s * (0.94 + 0.12 * hash(303, k));
		const side = (hash(304, k) - 0.5) * 0.18 * s; // a little to either side of the path
		const bob = Math.abs(Math.sin((t * 1.6 + hash(302, k)) * Math.PI)) * 0.03 * s;
		const fade = clamp(d / 0.6) * dim;
		const order = -748 + d * 0.05;
		const x = p.x + side;
		const y = p.y + bob;
		items.push(
			<group key={k}>
				<CharacterRoot position={[x, y, p.z]} pxPerM={CROWD_PX / s} shadow={null} tilt={0.025 * Math.sin(t * 6 + k)}>
					<PoseSprite sprite={spr} look={{tint, sil: 0.5, silColor: '#1d1826', rim: 1.1, rimColor: '#ff9a4a', rimDir: [0.3, 1], blur, opacity: fade}} renderOrder={order} />
				</CharacterRoot>
				{TORCH_HEAD[spr] && (
					<Flame
						position={[x + ((TORCH_HEAD[spr][0] - SHEET[spr].foot[0]) / CROWD_PX) * s, y + ((SHEET[spr].foot[1] - TORCH_HEAD[spr][1]) / CROWD_PX) * s, p.z + 0.02]}
						height={0.45 * s}
						t={t}
						seed={k * 3.7 + 1}
						intensity={1.2 * fade}
						glow={4}
						renderOrder={order + 0.01}
					/>
				)}
			</group>,
		);
	});
	if (withJudas) {
		const d = walkerD(-1, t, t0);
		if (d > 0 && d < PATH_END + 0.5) {
			const p = pathPoint(mid, d);
			const step = Math.abs(Math.sin((t - t0) * Math.PI * 1.7));
			items.push(
				<Actor
					key="judas"
					position={[p.x, p.y + 0.025 * p.s * step, p.z + 0.01]}
					t={t}
					poses={[[0, 'judas/walk']]}
					scale={p.s}
					look={{tint: '#b08a78', rim: 0.9, rimColor: '#ff9a4a', rimDir: [-0.6, 1], blur, opacity: clamp(d / 0.6) * dim}}
					warp={{wave: [5, 6, t * 6.5, 0.62]}}
					renderOrder={-748 + d * 0.05 + 0.02}
				/>,
			);
		}
	}
	return <>{items}</>;
};
// Judas's head on the path (for the label).
export const judasHead = (mid: MidPlace, t: number, t0: number): Vec3 => {
	const p = pathPoint(mid, walkerD(-1, t, t0));
	return [p.x + 0.05 * p.s, p.y + 1.72 * p.s, p.z];
};

const S9_EMBERS = emberSpecs(110, B.s9 - 1, B.s10 + 1, {x: [-7, 2], y: [-3.5, 1.5], z: [-13, -2]}, 41, 0.5);
// deep in the grove: the painted path sits in the lower middle of the frame, rocks close to the lens
// cover the bottom edge, the canopies fill the top
const PLACE_WIDE = {
	sky: {x: 1.5, y: 14, z: -110, width: 70},
	far: {x: -2, y: -9.5, z: -48, width: 46},
	mid: {x: -1.2, y: -4.1, z: -14, width: 19},
	near: {x: -1.5, y: -0.72, z: -1.5, width: 5.2},
};
const S9_T0 = B.s9 - 0.5;
const camera9 = (t: number): CamState => {
	// tracks the head of the torch line along the path (Judas a little left of centre, room ahead of him):
	// a pan with a little dolly, smoothed over half a second
	let c = 0;
	for (let k = -2; k <= 2; k++) c += judasHead(PLACE_WIDE.mid, t + 0.25 * k, S9_T0)[0] / 5;
	c += 0.42;
	return {pos: [c * 0.55, 0.9, 2.0], target: [c, -1.3, -14], fov: 33, drift: 0.7};
};
// the ground continues below the mid painting (dark, in shadow) so the lower frame is never empty
const GroundBelow: React.FC<{mid: MidPlace; color?: string}> = ({mid, color = '#2b2836'}) => (
	<Haze position={[mid.x, mid.y - 3, mid.z - 0.01]} size={[mid.width * 1.2, 6.02]} color={color} bottom={1} top={1} soft={0} renderOrder={-751} />
);
export const S9: ShotDef = {
	id: 'S9',
	start: SCENE.S9.start - 0.6,
	end: SCENE.S10.start + 0.4,
	Content: ({t, lite}) => (
		<>
			<GardenLayers place={PLACE_WIDE} look={{sky: {tint: '#d9dff0'}, far: {tint: '#c8cfe4'}, mid: {tint: '#c5cbe0'}, near: {tint: '#8d94b0', blur: 8}, haze: 0.6}} />
			<GroundBelow mid={PLACE_WIDE.mid} />
			<Procession t={t} t0={S9_T0} mid={PLACE_WIDE.mid} lite={lite} />
			<Embers specs={S9_EMBERS} t={t} px={lite ? 6 : 8} opacity={0.75} renderOrder={650} />
		</>
	),
	camera: camera9,
	grade: () => ({exposure: 1.05, contrast: 1.07, saturation: 0.98, gain: [0.99, 0.99, 1.04], lift: [0.004, 0.006, 0.02], vignette: 0.52, bloom: 0.55, bloomThreshold: 0.72, grain: 0.022}),
	anchors: (t) => ({judas9: judasHead(PLACE_WIDE.mid, t, S9_T0)}),
};

// ---------------- S10 · Judas walks up ("Hail, master") ----------------
const JESUS_X = 0.55;
const judasX10 = (t: number) =>
	keys(t, [[B.walkUp - 0.6, -2.6], [B.kissLean, -0.62], [B.kissLean + 0.55, -0.32]], (x) => x) +
	0.04 * seg(t, B.kissLean, B.kissLean + 0.5, easeOut);
const camera10 = (t: number): CamState => {
	const u = seg(t, B.s10 - 0.4, B.kissLean + 0.5, easeInOut);
	const x = lerp(-0.25, 0.12, u);
	const y = lerp(1.25, 1.45, u);
	const z = lerp(6.2, 4.3, u);
	return {pos: [x, y + 0.05, z], target: [x, y, 0], fov: 30, drift: 0.7};
};
const PLACE_10 = {sky: {x: 0.5, y: 5.2, z: -70, width: 44}, far: {x: -3, y: -6.5, z: -40, width: 40}, mid: {x: 0.6, y: -3.4, z: -12, width: 16}, near: {x: 0.1, y: -1.95, z: 2.4, width: 6.2}};
const S10_EMBERS = emberSpecs(70, B.s10 - 1, B.s10 + 3, {x: [-3.5, 1.5], y: [0.4, 2.4], z: [-6, 0.6]}, 52, 0.45);
export const S10: ShotDef = {
	id: 'S10',
	start: SCENE.S10.start - 0.5,
	end: B.kissLean + 0.6,
	Content: ({t, lite}) => {
		const jx = judasX10(t);
		// a foot lands (lowest point of the bob) on each footstep sound (src/beats.mjs: walkUp + 0.1 + 0.5 k)
		const stepPh = (t - B.walkUp - WALK.judas.phase * WALK.judas.period) / (0.5 * WALK.judas.period);
		const walking = t < B.kissLean;
		const bobY = walking ? 0.025 * Math.abs(Math.sin(stepPh * Math.PI)) : 0;
		return (
			<>
				<GardenLayers
					place={PLACE_10}
					look={{sky: {tint: '#d0d6ea', blur: 1}, far: {tint: '#b9c0d8', blur: 3}, mid: {tint: '#aeb5cc', blur: 5}, near: {tint: '#7d84a0', blur: 9}, haze: 0.6}}
				/>
				<Procession t={t} t0={B.s10 - 10.5} mid={PLACE_10.mid} lite={lite} withJudas={false} dim={0.85} blur={5} />
				{/* Jesus waits, calm, in the moonlight */}
				<Actor
					position={[JESUS_X, 0, -0.2]}
					t={t}
					poses={[[0, 'jesus/kiss_stand']]}
					facing={-1}
					blinkSeed={7}
					look={{tint: '#d3d9ea', rim: 0.6, rimColor: '#ffb878', rimDir: [1, 0.2], grad: {dir: [0.6, 1], color: '#eef2ff', amount: 0.2}}}
					warp={{breath: 0.004 * Math.sin(t * 2.2), wave: [2, 5, t * 1.4, 0.6]}}
					renderOrder={20}
				/>
				{/* Judas: walks in with the torches behind him, then leans in to greet him */}
				<Actor
					position={[jx, bobY, 0]}
					t={t}
					poses={[[0, 'judas/walk'], [B.kissLean, 'judas/lean']]}
					blinkSeed={13}
					look={{tint: '#bc8f74', rim: 0.95, rimColor: '#ff9a4a', rimDir: [-1, 0.3], grad: {dir: [-1, 0], color: '#ffcf9a', amount: 0.25}}}
					warp={(p) => (p === 'judas/walk' ? {wave: [6, 6, t * 7, 0.62], lean: -6 * Math.sin(stepPh * Math.PI * 2)} : {breath: 0.006 * Math.sin(t * 3), lean: 22 * seg(t, B.kissLean, B.kissLean + 0.5, easeOut)})}
					renderOrder={10}
				/>
				<Pool position={[-1.6, 1.0, -2.5]} size={[4.5, 3.5]} color="#ff8a3a" intensity={0.22} renderOrder={-500} />
				<Embers specs={S10_EMBERS} t={t} px={lite ? 6 : 8} opacity={0.8} renderOrder={650} />
			</>
		);
	},
	camera: camera10,
	grade: () => ({exposure: 1.03, contrast: 1.08, saturation: 0.97, gain: [1.0, 0.98, 1.03], lift: [0.004, 0.006, 0.018], vignette: 0.55, bloom: 0.55, bloomThreshold: 0.72, grain: 0.022}),
};

// ---------------- the cold half of the split screen, then S13's dawn ----------------
const camera12 = (t: number): CamState => {
	const u = seg(t, B.s12 - 0.5, B.s14, (x) => x);
	const crane = seg(t, B.s13 - 0.2, B.s14, easeInOut);
	const x = lerp(0.6, 1.4, u);
	return {pos: [x, 1.7 + 2.2 * crane, 9.5], target: [x - 0.9, 1.35 + 2.6 * crane, -12], fov: 33, drift: 0.6};
};
// the same grove from further back (the near frame of trunks and rocks sits close to this camera)
const PLACE_DAWN = {...PLACE_WIDE, near: {x: 0.4, y: -2.6, z: 3.2, width: 8.2}};
const S13_EMBERS = emberSpecs(60, B.s12 - 1, B.s13 + 1, {x: [-5, 3], y: [0.6, 2.6], z: [-22, -2]}, 61, 0.5);
export const GARDEN2: ShotDef = {
	id: 'GARDEN2',
	start: SCENE.S12.start - 0.5,
	end: SCENE.S14.start + 0.6,
	Content: ({t, lite}) => {
		const dawn = seg(t, B.s13 - 0.3, B.enemies + 2.2, easeInOut);
		const torches = 1 - seg(t, B.s13 - 0.6, B.s13 + 0.8);
		const cool = 1 - dawn;
		return (
			<>
				<GardenLayers
					place={PLACE_DAWN}
					look={{
						sky: {tint: lerpHex('#c9d2ec', '#ffd2b0', dawn), light: 0.12 * dawn, lightColor: '#ffcf9a'},
						far: {tint: lerpHex('#b6bfd9', '#e6b8a2', dawn), light: 0.08 * dawn, lightColor: '#ffcf9a'},
						mid: {tint: lerpHex('#b4bbd2', '#e9c3a8', dawn), rim: 0.8 * dawn, rimColor: '#ffcf8a', rimDir: [0, 1]},
						near: {tint: lerpHex('#7d84a0', '#a8846e', dawn), blur: 6},
						haze: 0.6 * (1 - 0.5 * dawn),
						hazeColor: dawn > 0.5 ? '#c98e7a' : '#22304f',
						dawn,
					}}
				/>
				<GroundBelow mid={PLACE_WIDE.mid} />
				{torches > 0.01 && <Procession t={t} t0={B.s12 - 7} mid={PLACE_WIDE.mid} cool={cool} lite={lite} withJudas={false} dim={torches} />}
				{dawn > 0.01 && <Rays t={t} amount={dawn} />}
				<Embers specs={S13_EMBERS} t={t} px={lite ? 6 : 8} opacity={0.7 * torches} renderOrder={650} />
			</>
		);
	},
	camera: camera12,
	grade: (t) => {
		const dawn = seg(t, B.s13 - 0.3, B.enemies + 2.2, easeInOut);
		return {
			exposure: 1.04 + 0.08 * dawn,
			contrast: 1.07 - 0.02 * dawn,
			saturation: 0.95 + 0.1 * dawn,
			gain: [lerp(0.97, 1.06, dawn), lerp(0.99, 1.0, dawn), lerp(1.06, 0.93, dawn)],
			lift: [0.004 + 0.01 * dawn, 0.006, 0.02 * (1 - dawn)],
			vignette: 0.52 - 0.12 * dawn,
			bloom: 0.55 + 0.25 * dawn,
			bloomThreshold: 0.72 - 0.1 * dawn,
			grain: 0.02,
		};
	},
};

// Soft beams of the rising light fanning up from behind the far hills.
const Rays: React.FC<{t: number; amount: number}> = ({t, amount}) => (
	<>
		{[-0.55, -0.25, 0.05, 0.32, 0.6].map((a, i) => (
			<group key={i} position={[-2.5, -1.5, -46]} rotation-z={a + 0.04 * Math.sin(t * 0.3 + i)}>
				<Pool position={[0, 18, 0]} size={[3.2 + i * 0.4, 38]} color="#ffd9a0" intensity={(0.16 + 0.06 * noise1(t * 0.4, i)) * amount} falloff={1.2} renderOrder={-845 + i * 0.1} />
			</group>
		))}
		<Haze position={[0, -1, -30]} size={[90, 30]} color="#ffb98a" bottom={0.22 * amount} top={0} additive renderOrder={-845} />
	</>
);
