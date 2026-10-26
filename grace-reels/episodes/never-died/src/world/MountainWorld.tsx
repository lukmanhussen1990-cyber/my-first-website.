// The high mountain top (Matthew 17): a rocky summit plateau above a sea of cloud, distant peaks below
// in the haze, and a bright sky. Only light from above, never a figure.
import * as THREE from 'three';
import {fbm2, hash} from '../lib/random';
import {Sky} from './atmosphere';
import {cached} from './cache';
import {MoodLights} from './Lights';
import {bush, cloud, gridLine, mergePlaced, rock, terrainGrid} from './lowpoly';
import {Mood, skyFromMood} from './mood';

const peak = (x: number, z: number, px: number, pz: number, h: number, w: number) => h * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (w * w));

export const mountainHeight = (x: number, z: number) => {
	const r = Math.hypot(x * 0.75, z + 1.5);
	const top = fbm2(x * 0.12, z * 0.12, 51) * 0.35;
	const drop = r > 9 ? -Math.pow(r - 9, 1.32) * 0.95 : 0;
	const lumps = fbm2(x * 0.05, z * 0.05, 53) * 2.5 * Math.min(1, Math.max(0, (r - 9) / 10));
	// far peaks rising out of the cloud sea (their tops stay below the summit)
	const far =
		z < -60
			? Math.max(
					peak(x, z, -70, -150, 70, 45),
					peak(x, z, 40, -190, 85, 55),
					peak(x, z, 150, -260, 95, 70),
					peak(x, z, -180, -280, 90, 70),
					peak(x, z, 10, -340, 100, 80),
				)
			: 0;
	// a low rock ledge where Jesus, Moses and Elijah stand, above the disciples
	const ledge = 0.75 / (1 + Math.exp(((Math.hypot(x / 2.9, (z + 0.6) / 1.5) - 1) * 9)));
	const base = top + drop + lumps + ledge;
	return z < -60 ? Math.max(base, -120 + far) : base;
};

const build = () => {
	const cRock = new THREE.Color('#b9a58a');
	const cRock2 = new THREE.Color('#9d8a74');
	const cGrass = new THREE.Color('#b5ad78');
	const cSnow = new THREE.Color('#efe6da');
	const ground = terrainGrid({
		xs: gridLine(-420, 420, 0, 0.8, 16, 50),
		zs: gridLine(-520, 40, -2, 0.8, 18, 60),
		height: mountainHeight,
		seed: 61,
		jitter: 0.03,
		color: (x, y, z, ny) => {
			const n = fbm2(x * 0.08, z * 0.08, 9) + 0.5;
			const g = cRock.clone().lerp(cRock2, Math.min(1, Math.max(0, n)));
			if (y > -1.2 && ny > 0.85) g.lerp(cGrass, 0.45);
			if (y > -70 && y < -40 && ny > 0.7) g.lerp(cSnow, 0.15);
			if (y > -40 && z < -100) g.lerp(cSnow, Math.min(1, (y + 40) / 25));
			return g;
		},
	});
	const stones: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 40; i++) {
		const a = hash(71, i) * Math.PI * 2;
		const r = 3.5 + hash(72, i) * 9;
		const x = Math.cos(a) * r * 1.3;
		const z = Math.sin(a) * r - 1.5;
		if (Math.abs(x) < 3 && z > -3 && z < 5) continue;
		const s = 0.35 + hash(73, i) ** 2 * 1.6;
		stones.push({geo: rock(1100 + i, hash(74, i) > 0.5 ? '#a8957c' : '#8f7d68'), pos: [x, mountainHeight(x, z) - 0.1 * s, z], rot: hash(75, i) * 6, scale: s});
	}
	for (let i = 0; i < 14; i++) {
		const x = (hash(76, i) - 0.5) * 18;
		const z = -4 - hash(77, i) * 5;
		stones.push({geo: bush(1150 + i, {a: '#8d9150', b: '#a2a560'}), pos: [x, mountainHeight(x, z) - 0.05, z], rot: hash(78, i) * 6, scale: 0.6 + hash(79, i) * 0.5});
	}
	const sea: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 70; i++) {
		const a = -1.6 + hash(81, i) * 3.2;
		const r = 40 + hash(82, i) * 260;
		sea.push({geo: cloud(1200 + (i % 20), '#fffaf0', '#e9dccb'), pos: [Math.sin(a) * r, -26 - hash(83, i) * 18, -Math.cos(a) * r], rot: hash(84, i) * 6, scale: 6 + hash(85, i) * 9});
	}
	const high: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 10; i++) {
		const a = -1.1 + (i / 9) * 2.2;
		high.push({geo: cloud(1300 + i, '#fff6ea', '#efd6bc'), pos: [Math.sin(a) * 300, 80 + hash(86, i) * 60, -Math.cos(a) * 300], rot: hash(87, i), scale: 3.5 + hash(88, i) * 3});
	}
	return {ground, stones: mergePlaced(stones), sea: mergePlaced(sea), high: mergePlaced(high)};
};

const mats = () =>
	cached('mountainMats', () => ({
		lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
		cloud: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true, emissive: new THREE.Color('#5a5048')}),
		sky: new THREE.MeshBasicMaterial({vertexColors: true, fog: false, transparent: true, opacity: 0.85}),
	}));

export const MountainWorld: React.FC<{t: number; mood: Mood; lite: boolean}> = ({t, mood, lite}) => {
	const g = cached('mountainGeo', build);
	const m = mats();
	return (
		<>
			<Sky {...skyFromMood(mood, t, [0.0, 0.8, -0.6])} curve={1.3} />
			<MoodLights mood={mood} center={[0, 0, -1]} span={16} lite={lite} />
			<mesh geometry={g.ground} material={m.lambert} receiveShadow />
			<mesh geometry={g.stones} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.sea} material={m.cloud} position-x={t * 0.4} />
			<mesh geometry={g.high} material={m.sky} rotation-y={t * 0.002} />
		</>
	);
};
