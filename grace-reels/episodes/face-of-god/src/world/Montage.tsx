// The three quick memories of S3, all built in code: the burning bush in a desert valley at golden hour,
// a plague of frogs and hail, and the sea split into two walls of water. Pure functions of `t`.
import {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {Flame, FlameLight, Glow} from '../fx/Flame';
import {fbm2, hash, mulberry32} from '../lib/random';
import {canvasTexture} from '../lib/textures';
import {Sky} from './atmosphere';
import {cached} from './cache';
import {gridLine, mergePlaced, paintFaces, reeds, rock, terrainGrid} from './lowpoly';

const lambert = () => cached('montageLambert', () => new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}));

// ---------------- the burning bush ----------------
const duneHeight = (x: number, z: number) => {
	const mound = 0.32 * Math.exp(-(x * x + z * z) / 1.4);
	const dunes = 0.9 * fbm2(x * 0.06, z * 0.06, 7) + 0.25 * fbm2(x * 0.2, z * 0.2, 8);
	const back = z < -30 ? Math.pow((-30 - z) / 40, 1.6) * 14 : 0; // the valley rises toward the mountain
	return mound + dunes * Math.min(1, Math.hypot(x, z) / 6) + back;
};

const buildDesert = () => {
	const sand = new THREE.Color('#d9b27c');
	const ochre = new THREE.Color('#c98a4b');
	const ground = terrainGrid({
		xs: gridLine(-160, 160, 0, 0.5, 12, 30),
		zs: gridLine(-220, 30, 0, 0.5, 12, 34),
		height: duneHeight,
		seed: 41,
		jitter: 0.05,
		color: (x, y, z, ny) => sand.clone().lerp(ochre, Math.min(1, Math.max(0, 0.35 + 0.6 * fbm2(x * 0.1, z * 0.1, 3) + (1 - ny) * 1.2))),
	});
	// the mountain of God behind the valley
	const mtn = new THREE.ConeGeometry(70, 95, 9, 5);
	const pos = mtn.attributes.position as THREE.BufferAttribute;
	const r = mulberry32(5);
	for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 47) pos.setXYZ(i, pos.getX(i) * (0.85 + r() * 0.3), pos.getY(i) + (r() - 0.5) * 6, pos.getZ(i) * (0.85 + r() * 0.3));
	mtn.translate(10, 47.5 - 2, -170);
	const rock1 = new THREE.Color('#8a5a40');
	const rock2 = new THREE.Color('#a8714e');
	const mountain = paintFaces(mtn, (x, y, z, ny) => rock1.clone().lerp(rock2, Math.min(1, Math.max(0, 0.3 + ny * 0.6 + (y / 95) * 0.3))), 0.06, 9);
	const stones: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 26; i++) {
		const a = hash(51, i) * Math.PI * 2;
		const d = 3 + hash(52, i) * 30;
		const x = Math.cos(a) * d;
		const z = Math.sin(a) * d - 6;
		const s = 0.3 + hash(53, i) ** 2 * 1.6;
		stones.push({geo: rock(600 + i, hash(54, i) > 0.5 ? '#b08a62' : '#9a7454'), pos: [x, duneHeight(x, z) - 0.1 * s, z], rot: hash(55, i) * 6, scale: s});
	}
	return {ground, mountain, stones: mergePlaced(stones)};
};

// A low thorn bush: twisted brown branches with small clusters of dull green leaves.
const buildBush = () => {
	const parts: THREE.BufferGeometry[] = [];
	const wood = new THREE.Color('#6b4a2e');
	const leaf = new THREE.Color('#7a8a55');
	const leaf2 = new THREE.Color('#8d9a5e');
	const r = mulberry32(17);
	const tips: THREE.Vector3[] = [];
	const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
		const to = from.clone().add(dir.clone().multiplyScalar(len));
		const g = new THREE.CylinderGeometry(rad * 0.6, rad, len, 5, 1);
		g.translate(0, len / 2, 0);
		g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
		g.translate(from.x, from.y, from.z);
		parts.push(paintFaces(g, (x, y, z, ny) => wood.clone().multiplyScalar(0.8 + 0.25 * ny), 0.05, 100 + parts.length));
		if (depth === 0) {
			tips.push(to);
			return;
		}
		const n = 2 + Math.floor(r() * 2);
		for (let k = 0; k < n; k++) {
			const d = dir.clone().add(new THREE.Vector3((r() - 0.5) * 1.3, 0.25 + r() * 0.5, (r() - 0.5) * 1.3)).normalize();
			branch(to, d, len * (0.6 + r() * 0.25), rad * 0.62, depth - 1);
		}
	};
	for (let k = 0; k < 5; k++) {
		const a = (k / 5) * Math.PI * 2 + r();
		branch(new THREE.Vector3(Math.cos(a) * 0.08, 0.25, Math.sin(a) * 0.08), new THREE.Vector3(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).normalize(), 0.42, 0.045, 3);
	}
	tips.forEach((p, k) => {
		const g = new THREE.IcosahedronGeometry(0.1 + r() * 0.06, 0);
		g.translate(p.x, p.y, p.z);
		parts.push(paintFaces(g, (x, y, z, ny) => (k % 2 ? leaf : leaf2).clone().multiplyScalar(0.85 + 0.2 * ny), 0.06, 300 + k));
	});
	return {geo: mergeGeometries(parts)!, tips};
};

export const DesertBush: React.FC<{t: number; fire: number; flare: number; lite: boolean}> = ({t, fire, flare}) => {
	const d = cached('desertGeo', buildDesert);
	const bush = cached('bushGeo', buildBush);
	const m = lambert();
	// the flames dance over the bush and never consume it
	const flames = useMemo(() => bush.tips.filter((_, k) => k % 3 === 0).slice(0, 12), [bush]);
	const target = cached('bushTarget', () => new THREE.Object3D());
	return (
		<>
			<Sky top="#6f6f96" mid="#e3a173" horizon="#ffd29a" bottom="#c98e74" sunDir={[-0.55, 0.16, -0.82]} sunColor="#ffd9a0" sunGlow={0.9} sunSize={4} t={t} curve={1.1} />
			<primitive object={target} position={[0, 0.5, 0]} />
			<hemisphereLight args={['#f4c99a', '#7a5238', 1.05]} />
			<directionalLight position={[-60, 22, -80]} target={target} color="#ffcf98" intensity={2.1} />
			<mesh geometry={d.ground} material={m} />
			<mesh geometry={d.mountain} material={m} />
			<mesh geometry={d.stones} material={m} />
			<mesh geometry={bush.geo} material={m} position={[0, duneHeight(0, 0) - 0.25, 0]} />
			{flames.map((p, k) => (
				<Flame key={k} position={[p.x, p.y + duneHeight(0, 0) - 0.3, p.z]} height={(0.45 + 0.35 * hash(9, k)) * fire * (1 + 0.15 * flare)} t={t * 1.2} seed={k + 1} intensity={0.85 * fire} glow={0.8} />
			))}
			<Glow position={[0, 0.8, 0]} size={2.4 * (1 + 0.2 * flare)} color="#ff9a4a" intensity={0.3 * fire * (1 + 0.4 * flare)} />
			<FlameLight position={[0, 1.0, 0.6]} t={t} seed={3} intensity={1.6 * fire * (1 + 0.5 * flare)} distance={7} />
		</>
	);
};

// ---------------- the plagues: frogs and hail ----------------
// A cartoon frog in our flat style, drawn once on a canvas (two poses: sitting and leaping).
const frogTexture = (leap: boolean) =>
	canvasTexture(leap ? 'frogLeap' : 'frogSit', 256, 200, (ctx) => {
		const ol = '#2B1D12';
		ctx.lineWidth = 6;
		ctx.lineJoin = 'round';
		ctx.strokeStyle = ol;
		const body = '#6E9A3A';
		const belly = '#B8C878';
		const dark = '#557c2b';
		if (leap) {
			// back legs stretched out behind
			ctx.fillStyle = dark;
			ctx.beginPath();
			ctx.moveTo(70, 112);
			ctx.lineTo(18, 150);
			ctx.lineTo(8, 140);
			ctx.lineTo(56, 100);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.ellipse(128, 112, 74, 46, leap ? -0.2 : 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = belly;
		ctx.beginPath();
		ctx.ellipse(140, 132, 46, 20, leap ? -0.2 : 0, 0, Math.PI * 2);
		ctx.fill();
		if (!leap) {
			ctx.fillStyle = dark;
			ctx.beginPath();
			ctx.ellipse(86, 140, 34, 20, 0.3, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
		// front leg
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.ellipse(leap ? 196 : 168, leap ? 128 : 150, 14, 24, leap ? -0.9 : 0.2, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		// the eye: an almond white with a dark pupil, on a bump
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.arc(170, 74, 26, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.ellipse(172, 72, 15, 11, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#1b1410';
		ctx.beginPath();
		ctx.arc(177, 72, 6.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(196, 108);
		ctx.quadraticCurveTo(178, 116, 160, 110);
		ctx.stroke();
	});

const Frog: React.FC<{pos: [number, number, number]; leap: boolean; size: number; flip?: boolean; rot?: number}> = ({pos, leap, size, flip, rot = 0}) => {
	const mat = useMemo(() => new THREE.MeshBasicMaterial({transparent: true, depthWrite: false, alphaTest: 0.05, color: '#d8e0c8'}), []);
	mat.map = frogTexture(leap);
	return (
		<mesh position={pos} material={mat} scale={[size * (flip ? -1 : 1), size * 0.78, 1]} rotation-z={rot} renderOrder={20}>
			<planeGeometry args={[1, 1]} />
		</mesh>
	);
};

const hailGeo = () => cached('hailGeo', () => new THREE.IcosahedronGeometry(1, 0));
const hailMat = () => cached('hailMat', () => new THREE.MeshLambertMaterial({color: '#e8f1f8', emissive: '#6f8fb0', flatShading: true}));

const Hail: React.FC<{t: number; t0: number; count: number}> = ({t, t0, count}) => {
	const mesh = useMemo(() => {
		const me = new THREE.InstancedMesh(hailGeo(), hailMat(), count);
		me.frustumCulled = false;
		return me;
	}, [count]);
	const m = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const e = new THREE.Euler();
	for (let i = 0; i < count; i++) {
		const birth = t0 - 0.6 + hash(71, i) * 1.4;
		const age = t - birth;
		const x = (hash(72, i) - 0.5) * 7;
		const z = -0.5 - hash(73, i) * 9;
		const s = 0.035 + hash(74, i) * 0.05;
		let y = 4.5 - 11 * age;
		if (y < s) {
			// bounce once, then rest
			const ta = (4.5 - s) / 11;
			const b = age - ta;
			y = s + Math.max(0, 1.4 * b - 6 * b * b);
		}
		e.set(age * 7 + i, age * 5, 0);
		q.setFromEuler(e);
		m.compose(new THREE.Vector3(x + age * 0.6, age < 0 ? -50 : y, z), q, new THREE.Vector3(s, s * 0.85, s));
		mesh.setMatrixAt(i, m);
	}
	mesh.instanceMatrix.needsUpdate = true;
	return <primitive object={mesh} />;
};

const buildMarsh = () => {
	const mud = new THREE.Color('#5a4632');
	const grass = new THREE.Color('#6a6a3a');
	const ground = terrainGrid({
		xs: gridLine(-60, 60, 0, 0.4, 8, 20),
		zs: gridLine(-120, 12, 0, 0.4, 8, 24),
		height: (x, z) => 0.25 * fbm2(x * 0.15, z * 0.15, 4) + (z < -40 ? ((-40 - z) / 30) ** 1.4 * 3 : 0),
		seed: 33,
		jitter: 0.06,
		color: (x, y, z) => mud.clone().lerp(grass, Math.min(1, Math.max(0, 0.4 + fbm2(x * 0.3, z * 0.3, 5)))),
	});
	const rs: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 40; i++) {
		const x = (hash(81, i) - 0.5) * 30;
		const z = -1 - hash(82, i) * 30;
		rs.push({geo: reeds(700 + i, '#6d7a3a'), pos: [x, 0, z], rot: hash(83, i) * 6, scale: 0.8 + hash(84, i)});
	}
	return {ground, reeds: mergePlaced(rs)};
};

export const PlagueWorld: React.FC<{t: number; t0: number; frogs: number[]}> = ({t, t0, frogs}) => {
	const g = cached('marshGeo', buildMarsh);
	const m = lambert();
	const target = cached('marshTarget', () => new THREE.Object3D());
	// three frogs leap across in front of the camera, one after another
	const hops: {x0: number; x1: number; z: number; at: number; size: number}[] = [
		{x0: -2.2, x1: -0.2, z: 1.2, at: frogs[0], size: 0.42},
		{x0: 1.6, x1: 0.2, z: 0.4, at: frogs[1], size: 0.55},
		{x0: -0.8, x1: 1.3, z: -0.6, at: frogs[2], size: 0.38},
	];
	return (
		<>
			<Sky top="#2b1d2a" mid="#5a2e2a" horizon="#a8573a" bottom="#3b241c" sunDir={[0.2, 0.08, -0.98]} sunColor="#ff9a5a" sunGlow={0.5} sunSize={2} t={t} curve={1.2} />
			<primitive object={target} position={[0, 0, -2]} />
			<hemisphereLight args={['#c08a7a', '#2b1d12', 0.9]} />
			<directionalLight position={[10, 20, -40]} target={target} color="#ffb48a" intensity={1.5} />
			<mesh geometry={g.ground} material={m} />
			<mesh geometry={g.reeds} material={m} />
			{hops.map((h, k) => {
				const u = Math.min(1, Math.max(0, (t - h.at) / 0.34));
				const x = h.x0 + (h.x1 - h.x0) * u;
				const y = h.size * 0.39 + Math.sin(Math.PI * u) * 0.7;
				const leap = u > 0 && u < 1;
				return <Frog key={k} pos={[x, y, h.z]} leap={leap} size={h.size} flip={h.x1 < h.x0} rot={leap ? (h.x1 > h.x0 ? 1 : -1) * (0.45 - 0.9 * u) * 0.6 : 0} />;
			})}
			<Hail t={t} t0={t0} count={130} />
		</>
	);
};

// ---------------- the sea split in two ----------------
const wallMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uT: {value: 0}, uH: {value: 10}, uSide: {value: 1}, uOpen: {value: 1}},
		vertexShader: `uniform float uT, uH, uSide, uOpen; varying vec3 vP; varying float vTop;
			void main(){
				vec3 p = position;   // a vertical plane: x = 0, y up 0..1, z along the corridor
				float y = p.y * uH;
				// waves running along the wall, stronger near the top, and a lean outward at the crest
				float w = sin(p.z * 0.35 + uT * 2.2 + y * 0.3) * 0.25 + sin(p.z * 0.9 - uT * 3.1 + y * 0.7) * 0.12;
				p.x += uSide * (w * (0.3 + 0.7 * p.y) + 0.8 * pow(p.y, 3.0));
				p.y = y + sin(p.z * 0.4 - uT * 2.6) * 0.3 * p.y;
				vTop = position.y;
				vec4 wp = modelMatrix * vec4(p, 1.0);
				vP = wp.xyz;
				gl_Position = projectionMatrix * viewMatrix * wp;
			}`,
		fragmentShader: `uniform float uT; varying vec3 vP; varying float vTop;
			void main(){
				// facet shading from the screen-space derivatives (low-poly look)
				vec3 n = normalize(cross(dFdx(vP), dFdy(vP)));
				float lit = 0.55 + 0.45 * clamp(dot(n, normalize(vec3(0.2, 0.8, 0.5))), 0.0, 1.0);
				vec3 deep = vec3(0.07, 0.24, 0.3);
				vec3 mid = vec3(0.18, 0.5, 0.54);
				vec3 hi = vec3(0.37, 0.65, 0.69);
				vec3 c = mix(deep, mid, smoothstep(0.0, 0.7, vTop));
				c = mix(c, hi, smoothstep(0.65, 0.95, vTop));
				// light glowing through the water and drifting bands
				c += vec3(0.05, 0.16, 0.18) * (0.5 + 0.5 * sin(vP.z * 0.6 + vP.y * 0.9 - uT * 1.5)) * (0.4 + vTop);
				// foam at the crest
				c = mix(c, vec3(0.9, 0.96, 0.98), smoothstep(0.9, 0.985, vTop));
				gl_FragColor = vec4(c * lit * 1.15, 1.0);
			}`,
		side: THREE.DoubleSide,
	});

const buildSeaBed = () => {
	const sand = new THREE.Color('#6e5a44');
	const wet = new THREE.Color('#4a3e32');
	const bed = terrainGrid({
		xs: gridLine(-14, 14, 0, 0.35, 2, 10),
		zs: gridLine(-120, 12, 0, 0.4, 6, 40),
		height: (x, z) => 0.06 * fbm2(x * 0.6, z * 0.6, 12) + Math.abs(x) * 0.04,
		seed: 61,
		jitter: 0.06,
		color: (x, y, z) => wet.clone().lerp(sand, Math.min(1, Math.max(0, 0.45 + fbm2(x * 0.5, z * 0.2, 13)))),
	});
	const peb: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 40; i++) {
		const x = (hash(91, i) - 0.5) * 6;
		const z = 4 - hash(92, i) * 40;
		peb.push({geo: rock(800 + i, hash(93, i) > 0.5 ? '#cbbfa8' : '#8f8170'), pos: [x, 0, z], rot: hash(94, i) * 6, scale: 0.05 + hash(95, i) * 0.07});
	}
	return {bed, pebbles: mergePlaced(peb)};
};

export const SeaWorld: React.FC<{t: number; open: number; water: number}> = ({t, open, water}) => {
	const g = cached('seaGeo', buildSeaBed);
	const m = lambert();
	const walls = useMemo(() => {
		const geo = new THREE.PlaneGeometry(130, 1, 90, 18);
		geo.rotateY(Math.PI / 2); // plane in z (corridor) and y
		geo.translate(0, 0.5, -55);
		return [wallMaterial(), wallMaterial()].map((mat) => ({geo, mat}));
	}, []);
	const half = 0.25 + 3.4 * open; // half the width of the dry path
	const h = 5 + 9 * open;
	const target = cached('seaTarget', () => new THREE.Object3D());
	// before the split the water fills the path; it sinks away as the walls part
	const surf = useMemo(() => new THREE.MeshLambertMaterial({color: '#2e7f8a', emissive: '#103840', flatShading: true}), []);
	return (
		<>
			<Sky top="#1f2347" mid="#4b4a7a" horizon="#e3a173" bottom="#3b3150" sunDir={[0.0, 0.06, -1]} sunColor="#ffcf98" sunGlow={0.7} sunSize={3} t={t} curve={1.3} />
			<primitive object={target} position={[0, 0, -20]} />
			<hemisphereLight args={['#9fb4d8', '#2b2440', 1.0]} />
			<directionalLight position={[0, 30, -80]} target={target} color="#ffd2a0" intensity={1.2} />
			<mesh geometry={g.bed} material={m} />
			<mesh geometry={g.pebbles} material={m} />
			{walls.map((w, k) => {
				const side = k === 0 ? -1 : 1;
				w.mat.uniforms.uT.value = t;
				w.mat.uniforms.uH.value = h;
				w.mat.uniforms.uSide.value = side;
				return <mesh key={k} geometry={w.geo} material={w.mat} position={[side * half, -0.3, 0]} frustumCulled={false} />;
			})}
			{water > 0.01 && (
				<mesh material={surf} position={[0, -0.6 + 1.9 * water, -50]} rotation-x={-Math.PI / 2}>
					<planeGeometry args={[half * 2 + 1, 130, 8, 40]} />
				</mesh>
			)}
		</>
	);
};
