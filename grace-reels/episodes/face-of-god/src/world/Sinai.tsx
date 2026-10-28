// The summit of Sinai at night in a storm: a jutting granite ledge where Moses stands, crags rising
// behind, a sheer drop to the right, jagged peaks far below in the rain, and the storm sky with its
// blazing opening. Low-poly, flat-shaded, built once and cached.
import * as THREE from 'three';
import {fbm2, hash} from '../lib/random';
import {cached} from './cache';
import {gridLine, mergePlaced, paintFaces, rock, terrainGrid} from './lowpoly';
import {Bolt, flashAt, GodRays, Rain, StormSky, Vec3} from './storm';

// Where Moses stands, and where the light comes from (a direction, shared by every summit shot).
export const LEDGE: Vec3 = [0.6, 0, 0.3];
export const HOLE_DIR: Vec3 = [0.62, 0.36, -0.7];
export const HOLE_POS: Vec3 = [LEDGE[0] + HOLE_DIR[0] * 170, LEDGE[1] + HOLE_DIR[1] * 170, LEDGE[2] + HOLE_DIR[2] * 170];

const sstep = (a: number, b: number, x: number) => {
	const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return u * u * (3 - 2 * u);
};

export const sinaiHeight = (x: number, z: number) => {
	const n = fbm2(x * 0.35, z * 0.35, 11);
	// crags rising behind and to the left of the ledge
	const back = Math.max(0, -(z + 1.4));
	const left = Math.max(0, -(x + 1.8));
	const rise = Math.min(9 + 3 * n, (back * 0.75 + left * 0.6) * (1 + 0.7 * fbm2(x * 0.18, z * 0.18, 13)));
	// a sheer drop to the right of the ledge and in front of it
	const outR = Math.max(0, x - 2.7 - 0.5 * fbm2(z * 0.4, 1, 17));
	const outF = Math.max(0, z - 2.5 - 0.4 * fbm2(x * 0.4, 2, 19));
	const drop = -(outR ** 1.3 * 5.5 + outF ** 1.25 * 4.2);
	// a lip of rock at the ledge's front edge, small lumps on the walkable top
	const top = 0.05 * n + 0.18 * sstep(1.6, 2.4, Math.hypot((x - 0.4) / 1.25, (z - 0.2) / 1.0)) * (1 - sstep(2.4, 3.2, Math.hypot((x - 0.4) / 1.25, (z - 0.2) / 1.0)));
	// far away everything falls into the abyss where the lower peaks stand
	const far = -sstep(18, 60, Math.hypot(x, z)) * 60;
	return Math.max(-70, top + rise + drop + far);
};

const peak = (seed: number, r: number, h: number) => {
	const g = new THREE.ConeGeometry(r, h, 6 + Math.floor(hash(seed, 1) * 3), 4);
	const pos = g.attributes.position as THREE.BufferAttribute;
	const key = (x: number, y: number, z: number) => `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
	const off = new Map<string, number[]>();
	for (let i = 0; i < pos.count; i++) {
		const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
		if (!off.has(k)) {
			const j = off.size;
			const top = pos.getY(i) > h / 2 - 0.01;
			off.set(k, top ? [0, 0, 0] : [(hash(seed, j, 3) - 0.5) * r * 0.35, (hash(seed, j, 4) - 0.5) * h * 0.12, (hash(seed, j, 5) - 0.5) * r * 0.35]);
		}
		const d = off.get(k)!;
		pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
	}
	g.translate(0, h / 2, 0);
	const lo = new THREE.Color('#1e2336');
	const hi = new THREE.Color('#4a5068');
	return paintFaces(g, (cx, cy, cz, ny) => lo.clone().lerp(hi, Math.min(1, Math.max(0, cy / h) * 0.9 + 0.25 * ny)), 0.06, seed);
};

const build = () => {
	const c1 = new THREE.Color('#4f4a4c');
	const c2 = new THREE.Color('#625a58');
	const c3 = new THREE.Color('#3a3842');
	const ground = terrainGrid({
		xs: gridLine(-120, 120, 0.5, 0.45, 9, 26),
		zs: gridLine(-160, 40, 0, 0.45, 9, 30),
		height: sinaiHeight,
		seed: 21,
		jitter: 0.05,
		wobble: 0.35,
		color: (x, y, z, ny) => {
			const n = fbm2(x * 0.2, z * 0.2, 5) + 0.5;
			const c = c1.clone().lerp(c2, Math.min(1, Math.max(0, n)));
			if (ny < 0.55) c.lerp(c3, 0.55);
			if (y < -8) c.lerp(new THREE.Color('#232838'), Math.min(1, (-8 - y) / 25));
			return c;
		},
	});
	const crags: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 46; i++) {
		const a = hash(31, i) * Math.PI * 2;
		const r = 3.2 + hash(32, i) * 16;
		const x = 0.5 + Math.cos(a) * r;
		const z = Math.sin(a) * r * 0.9 - 1;
		if (Math.hypot((x - 0.4) / 2.6, (z - 0.2) / 2.1) < 1.15) continue;
		const s = 0.4 + hash(33, i) ** 2 * 2.4;
		const tall = hash(34, i) > 0.6 ? 2.2 : 1;
		crags.push({geo: rock(400 + i, hash(35, i) > 0.5 ? '#5a5452' : '#45434c'), pos: [x, sinaiHeight(x, z) - 0.15 * s, z], rot: hash(36, i) * 6, scale: [s, s * tall, s]});
	}
	const peaks: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 26; i++) {
		const a = -1.25 + (i / 25) * 2.9 + (hash(41, i) - 0.5) * 0.12;
		const d = 70 + hash(42, i) * 260;
		const h = 30 + hash(43, i) * 55 + d * 0.08;
		peaks.push({geo: peak(500 + i, 18 + hash(44, i) * 30, h), pos: [Math.sin(a) * d, -70, -Math.cos(a) * d], rot: hash(45, i) * 6});
	}
	return {ground, crags: mergePlaced(crags), peaks: mergePlaced(peaks)};
};

// the far peaks, shared with the clift scenes
export const sinaiGeometry = () => cached('sinaiGeo', build);

const mats = () =>
	cached('sinaiMats', () => ({
		rock: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
		peaks: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
	}));

export type SinaiLook = {
	hole: number; // brightness of the opening
	glory: number; // god rays and the light on the rock
	flashes: [number, Vec3, Vec3][]; // lightning: time, bolt top, bolt bottom
	rain: number;
	storm: number; // ambient level (lower = darker night)
	rays3d?: number; // the long god-ray ribbons (fade them when the camera looks straight up into the light)
	swirl?: number;
};

// The light from the opening as a directional light, plus the storm's blue fill and the flashes.
const Lights: React.FC<{t: number; look: SinaiLook}> = ({t, look}) => {
	const flash = Math.min(1.5, look.flashes.reduce((m, [at]) => Math.max(m, flashAt(t, at)), 0));
	const target = cached('sinaiTarget', () => new THREE.Object3D());
	const [dx, dy, dz] = HOLE_DIR;
	return (
		<>
			<primitive object={target} position={LEDGE} />
			<hemisphereLight args={['#6c7cb4', '#1a1f33', 1.5 * look.storm + 1.2 * flash]} />
			<directionalLight position={[LEDGE[0] + dx * 60, LEDGE[1] + dy * 60, LEDGE[2] + dz * 60]} target={target} color="#ffe2a8" intensity={0.3 + 2.6 * look.glory} />
			{/* a cool fill from the camera side, so the backlit rock keeps its facets */}
			<directionalLight position={[-30, 25, 45]} target={target} color="#8ea2d8" intensity={0.55 * look.storm + 2.5 * flash} />
		</>
	);
};

export const SinaiWorld: React.FC<{t: number; look: SinaiLook; rainBox?: {center: Vec3; size: Vec3}; lite: boolean}> = ({t, look, rainBox}) => {
	const g = sinaiGeometry();
	const m = mats();
	const flash = look.flashes.reduce((mm, [at]) => Math.max(mm, flashAt(t, at)), 0);
	const lastFlash = look.flashes.filter(([at]) => t >= at).slice(-1)[0];
	return (
		<>
			<StormSky
				t={t}
				holeDir={HOLE_DIR}
				hole={look.hole}
				holeSize={1}
				flash={Math.min(1.2, flash)}
				flashDir={lastFlash ? (lastFlash[1].map((v, i) => v - LEDGE[i]) as Vec3) : [0, 1, 0]}
				swirl={look.swirl ?? 1}
			/>
			<Lights t={t} look={look} />
			<mesh geometry={g.ground} material={m.rock} />
			<mesh geometry={g.crags} material={m.rock} />
			<mesh geometry={g.peaks} material={m.peaks} />
			{look.flashes.map(([at, top, bottom], k) => (
				<Bolt key={k} from={top} to={bottom} t={t} at={at} seed={70 + k} width={1.4} />
			))}
			<GodRays from={HOLE_POS} to={[LEDGE[0] - 1, -2, LEDGE[2] + 1]} spread={9} count={14} t={t} intensity={0.16 * look.glory * (look.rays3d ?? 1)} width0={2.4} width1={1.8} seed={9} />
			<GodRays from={HOLE_POS} to={[LEDGE[0] + 4, -12, LEDGE[2] - 6]} spread={22} count={10} t={t + 3} intensity={0.1 * look.glory * (look.rays3d ?? 1)} width0={4} width1={5} seed={13} />
			{rainBox && <Rain count={1600} center={rainBox.center} size={rainBox.size} t={t} wind={[0.42, 0.08]} speed={15} length={0.6} opacity={0.42 * look.rain} />}
		</>
	);
};
