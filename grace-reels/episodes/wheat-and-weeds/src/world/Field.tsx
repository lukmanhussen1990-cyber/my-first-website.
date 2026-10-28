// The farm: thousands of wheat stalks (InstancedMesh) with golden heads swaying in a wind shader driven
// by the frame time, tares mixed in (they look like wheat while young, then their heads turn dark),
// growth for the time-lapses, ripening from green to gold, and the small dark spots of S9. Around it the
// furrowed soil, a stone wall, the farmhouse, olive trees, the barn and the hills. Low-poly, built once.
import {useMemo} from 'react';
import * as THREE from 'three';
import {fbm2, hash} from '../lib/random';
import {Sky} from './atmosphere';
import {cached} from './cache';
import {MoodLights} from './Lights';
import {cloud, gridLine, mergePlaced, oliveTree, paintFaces, rock, terrainGrid} from './lowpoly';
import {Mood, skyFromMood} from './mood';

// ---------------------------------------------------------------------------------------------
// One stalk: stem, two leaves, the head (a bumpy spindle of grains) and, on wheat, the awns.
// aPart: 0 stem, 1 leaf, 2 head, 3 awn. About 1.05 m tall.
// ---------------------------------------------------------------------------------------------
const H_STEM = 0.84;
const H_TOP = 1.05;
// Every part stays indexed: the wheat is flat shaded (normals come from screen derivatives), so shared
// vertices are run once, which matters with tens of thousands of stalks on a CPU renderer.
type Part = {pos: number[]; idx: number[]; part: number};
const fromGeo = (g: THREE.BufferGeometry, part: number): Part => {
	const pos = Array.from(g.attributes.position.array as Float32Array);
	const idx = g.index ? Array.from(g.index.array as ArrayLike<number>) : Array.from({length: pos.length / 3}, (_, k) => k);
	return {pos, idx, part};
};

const blade = (y0: number, ang: number, len: number, droop: number, w: number): Part => {
	const pos: number[] = [];
	const idx: number[] = [];
	const seg = 3;
	const px = -Math.sin(ang);
	const pz = Math.cos(ang);
	for (let i = 0; i <= seg; i++) {
		const s = i / seg;
		const r = s * len;
		const c = [Math.cos(ang) * r, y0 + s * len * 0.75 - droop * s * s, Math.sin(ang) * r];
		const wi = w * (1 - s) + 0.0005;
		pos.push(c[0] - px * wi, c[1], c[2] - pz * wi, c[0] + px * wi, c[1], c[2] + pz * wi);
		if (i < seg) {
			const a = i * 2;
			idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
		}
	}
	return {pos, idx, part: 1};
};

export const stalkGeometry = (kind: 'wheat' | 'tare', detail: 'field' | 'hero' | 'far' = 'field') => {
	const hero = detail === 'hero';
	const far = detail === 'far';
	const parts: Part[] = [];
	const stem = new THREE.CylinderGeometry(far ? 0.007 : 0.0045, far ? 0.009 : 0.0075, H_STEM, hero ? 5 : 3, hero ? 4 : 1, true);
	stem.translate(0, H_STEM / 2, 0);
	parts.push(fromGeo(stem, 0));
	if (!far) parts.push(blade(0.18, 0.4, 0.26, 0.1, 0.012));
	if (hero) parts.push(blade(0.36, 0.4 + Math.PI, 0.24, 0.12, 0.011));
	// the head: a spindle of grains (alternating radii give the kernels in flat shading)
	const rings = hero ? 11 : far ? 2 : 4;
	const rMax = (kind === 'wheat' ? 0.021 : 0.018) * (far ? 1.45 : hero ? 1 : 1.08);
	const len = kind === 'wheat' ? 0.2 : 0.21;
	const prof: THREE.Vector2[] = [new THREE.Vector2(0.004, H_STEM - 0.01)];
	for (let i = 1; i <= rings; i++) {
		const s = i / (rings + 1);
		const env = Math.sin(Math.PI * Math.min(1, s * 1.15)) * rMax;
		// wheat: plump kernels; tares (darnel): a thin zig-zag of spikelets
		const bump = kind === 'wheat' ? (i % 2 ? 1 : 0.82) : i % 2 ? 1 : 0.4;
		prof.push(new THREE.Vector2(Math.max(0.003, env * bump), H_STEM + s * len));
	}
	prof.push(new THREE.Vector2(0.002, H_STEM + len + 0.012));
	parts.push(fromGeo(new THREE.LatheGeometry(prof, hero ? 7 : far ? 3 : 4), 2));
	if (kind === 'wheat' && hero) {
		// awns: fine bristles from the head, up and outward
		const pos: number[] = [];
		const n = 12;
		for (let i = 0; i < n; i++) {
			const s = 0.25 + (i / n) * 0.7;
			const y = H_STEM + s * len;
			const a = i * 2.39996;
			const r = rMax * 0.8;
			const x0 = Math.cos(a) * r;
			const z0 = Math.sin(a) * r;
			const L = 0.06 + 0.05 * s;
			const w = 0.0016;
			pos.push(x0 - w, y, z0, x0 + w, y, z0, x0 + Math.cos(a) * L * 0.35, y + L, z0 + Math.sin(a) * L * 0.35);
		}
		parts.push({pos, idx: Array.from({length: n * 3}, (_, k) => k), part: 3});
	}
	const P: number[] = [];
	const A: number[] = [];
	const I: number[] = [];
	for (const q of parts) {
		const base = P.length / 3;
		P.push(...q.pos);
		for (let k = 0; k < q.pos.length / 3; k++) A.push(q.part);
		for (const k of q.idx) I.push(base + k);
	}
	const merged = new THREE.BufferGeometry();
	merged.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	merged.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 1));
	merged.setIndex(I);
	return merged;
};

// ---------------------------------------------------------------------------------------------
// The wheat shader: three's Lambert material with the wind, growth and colour injected.
// ---------------------------------------------------------------------------------------------
export type WheatState = {
	time: number;
	wind: number; // 0 still .. 1 normal breeze .. 2 strong
	grow: number; // 0 bare soil .. 1 full height (the time-lapse)
	ripe: number; // 0 green .. 1 gold
	tareDark: number; // 0 tares look like wheat .. 1 dark heads
	tareShow: number; // 0 no tares yet (before the enemy sows) .. 1
	spots: number; // 0 none .. 1 a small dark spot on every stalk
	glow: number; // a soft glow on the heads (moonlight, the harvest sun)
	part?: number; // gather/part of the stalks around a point (the pull) — amount
	partAt?: [number, number];
	tareWave?: [number, number, number]; // the tares rise in a wave from (x, z): tareShow * speed = the front's radius (m)
};

const WIND_DIR = new THREE.Vector2(1, 0.35).normalize();

const injectWind = (shader: THREE.WebGLProgramParametersWithUniforms, u: Record<string, THREE.IUniform>, depth = false) => {
	Object.assign(shader.uniforms, u);
	shader.vertexShader = shader.vertexShader
		.replace(
			'#include <common>',
			`#include <common>
			attribute float aPart; attribute float aRand; attribute float aPhase; attribute float aTare;
			uniform float uTime, uWind, uGrow, uTareShow, uPart; uniform vec2 uWindDir, uPartAt; uniform vec3 uTareWave;
			varying float vPart; varying float vK; varying float vRand; varying float vTare; varying vec3 vLocal; varying vec3 vWPos;`,
		)
		.replace(
			'#include <begin_vertex>',
			`#include <begin_vertex>
			vPart = aPart; vRand = aRand; vTare = aTare; vLocal = position;
			vK = clamp(position.y / ${H_TOP.toFixed(3)}, 0.0, 1.0);
			#ifdef USE_INSTANCING
				vec3 origin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
				mat3 wIm = mat3(instanceMatrix);
			#else
				vec3 origin = vec3(0.0);
				mat3 wIm = mat3(1.0);
			#endif
			float g = clamp((uGrow - aRand * 0.3) / 0.7, 0.0, 1.0);
			g = g * g * (3.0 - 2.0 * g);
			if (aTare > 0.5) {
				float show = uTareWave.z > 0.0 ? clamp((uTareShow * uTareWave.z - length(origin.xz - uTareWave.xy)) / 2.5 - aRand * 0.25, 0.0, 1.0) : uTareShow;
				g *= show * show * (3.0 - 2.0 * show);
			}
			// young plants are short green blades: the head grows in last
			transformed.y *= max(0.001, g);
			transformed.xz *= mix(0.55, 1.0, g);
			float k = vK;
			// two waves rolling across the field, a slow swell and a quick flutter per stalk
			float ph = uTime * 1.55 + dot(origin.xz, vec2(0.33, 0.21)) + aPhase * 0.7;
			float w = sin(ph) * 0.62 + sin(uTime * 0.55 + origin.z * 0.13 + origin.x * 0.05) * 0.45 + sin(uTime * 3.1 + aPhase * 6.28) * 0.12;
			float bend = uWind * w * k * k * 0.26 * g;
			// the wind blows in world space: turn its direction into the stalk's own (rotated) frame
			vec3 ld = vec3(uWindDir.x, 0.0, uWindDir.y) * wIm;
			ld.y = 0.0;
			transformed += normalize(ld + 1e-5) * bend;
			transformed.y -= abs(bend) * 0.25 * k;
			if (uPart > 0.0) {
				vec2 d = origin.xz - uPartAt;
				float r = length(d);
				vec3 pd = vec3(d.x, 0.0, d.y) * wIm;
				pd.y = 0.0;
				transformed += normalize(pd + 1e-5) * uPart * 0.22 * k * exp(-r * r / 0.35);
			}
			#ifdef USE_INSTANCING
				vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
			#else
				vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
			#endif`,
		);
	if (depth) return;
	shader.fragmentShader = shader.fragmentShader
		.replace(
			'#include <common>',
			`#include <common>
			uniform float uRipe, uTareDark, uSpots, uGlow, uBack; uniform vec3 uGlowColor, uSunDir, uBackColor;
			uniform vec3 uStemGreen, uStemGold, uHeadGreen, uHeadGold, uTareHead;
			varying float vPart; varying float vK; varying float vRand; varying float vTare; varying vec3 vLocal; varying vec3 vWPos;`,
		)
		.replace(
			'#include <color_fragment>',
			`#include <color_fragment>
			vec3 stemC = mix(uStemGreen, uStemGold, uRipe * 0.9);
			vec3 headC = mix(uHeadGreen, uHeadGold, uRipe);
			vec3 c = vPart > 1.5 ? headC : stemC;
			if (vPart > 0.5 && vPart < 1.5) c = mix(uStemGreen * 0.95, uStemGold * 0.82, uRipe * 0.85);
			if (vPart > 2.5) c = mix(headC, vec3(1.0, 0.94, 0.75), 0.25);
			if (vTare > 0.5) {
				c = vPart > 1.5 ? mix(headC * 0.9, uTareHead, uTareDark) : mix(c, c * vec3(0.32, 0.34, 0.3), uTareDark * 0.9);
			}
			// S9: a small dark spot on one side of every golden head
			float spotOn = step(vRand, uSpots) * step(1.5, vPart) * step(vPart, 2.5) * step(vTare, 0.5);
			float sk = 0.865 + 0.07 * fract(vRand * 7.3);
			float spot = spotOn * smoothstep(0.03, 0.012, abs(vK - sk)) * smoothstep(-0.004, 0.006, vLocal.x + vLocal.z * 0.3);
			c = mix(c, vec3(0.09, 0.06, 0.06), spot * 0.92);
			// the dense field shades itself low down (a cheap ambient occlusion)
			c *= mix(0.42, 1.0, smoothstep(0.04, 0.78, vK));
			diffuseColor.rgb = c * (0.88 + 0.24 * vRand);`,
		)
		.replace(
			'#include <emissivemap_fragment>',
			`#include <emissivemap_fragment>
			totalEmissiveRadiance += (vPart > 1.5 && vTare < 0.5 ? mix(headC, uGlowColor, 0.6) : vec3(0.0)) * uGlow * (0.4 + 0.6 * vK);
			// looking toward the sun (or the moon) the heads and awns light up from behind, like real wheat
			vec3 V = normalize(vWPos - cameraPosition);
			float bl = pow(max(0.0, dot(V, uSunDir)), 3.0) * uBack;
			float isTare = vTare * uTareDark;
			// thin edges let the most light through; the kernels show as bands down the head
			float rim = 1.0 - abs(dot(normal, normalize(vViewPosition)));
			float kern = 0.68 + 0.32 * step(0.5, fract(vLocal.y / 0.0185 + vRand));
			vec3 tc = vPart > 2.5 ? headC * 1.6 : vPart > 1.5 ? headC * 1.15 * kern * (0.5 + 0.95 * rim) : (vPart > 0.5 ? stemC * 0.55 : stemC * 0.3) * (0.6 + 0.8 * rim);
			// the dark tares only pick up a cold violet edge
			tc = mix(tc, vec3(0.07, 0.06, 0.12) * (0.2 + 1.2 * rim * rim), isTare);
			totalEmissiveRadiance += tc * uBackColor * bl * (0.35 + 0.65 * vK) * (0.8 + 0.4 * vRand);`
		);
};

export type FieldPatch = {
	x0: number;
	x1: number;
	z0: number;
	z1: number;
	row: number;
	step: number;
	tare: number;
	seed: number;
	detail?: 'field' | 'hero';
	hole?: [number, number, number, number]; // x0, x1, z0, z1 left empty (a hero patch fills it)
	clear?: [number, number, number]; // x, z, radius left empty (where a camera stands in the wheat)
	path?: boolean; // leave the footpath across the field (default true)
	chunk?: number; // chunk size in metres (each chunk is culled on its own)
	rot?: number; // fixed turn of every stalk (a single hero stalk turned to the camera)
	flat?: boolean; // stand on y = 0 instead of the farm's ground (sets of their own, like the cutaway)
};

// the main field (in front of the farmhouse)
export const MAIN: FieldPatch = {x0: -16, x1: 16, z0: -21, z1: 7, row: 0.27, step: 0.16, tare: 0.18, seed: 5};
export const onPath = (x: number, z: number) => Math.abs(x - 3.2 - 0.1 * z) < 0.45;

type Inst = {x: number; z: number; y: number; rot: number; s: number; rand: number; phase: number; tare: number};
const instancesOf = (f: FieldPatch, height: (x: number, z: number) => number) => {
	const out: Inst[] = [];
	let i = 0;
	for (let z = f.z0; z <= f.z1; z += f.row) {
		for (let x = f.x0; x <= f.x1; x += f.step) {
			i++;
			const jx = (hash(f.seed, i, 1) - 0.5) * f.step * 0.9;
			const jz = (hash(f.seed, i, 2) - 0.5) * f.row * 0.45;
			const px = x + jx;
			const pz = z + jz;
			if (f.path !== false && onPath(px, pz)) continue;
			if (f.hole && px > f.hole[0] && px < f.hole[1] && pz > f.hole[2] && pz < f.hole[3]) continue;
			if (f.clear && Math.hypot(px - f.clear[0], pz - f.clear[1]) < f.clear[2]) continue;
			out.push({x: px, z: pz, y: height(px, pz), rot: f.rot ?? hash(f.seed, i, 3) * 6.283, s: 0.82 + hash(f.seed, i, 4) * 0.36, rand: hash(f.seed, i, 5), phase: hash(f.seed, i, 6), tare: hash(f.seed, i, 7) < f.tare ? 1 : 0});
		}
	}
	return out;
};

// The stalks are split into square chunks; each chunk and kind (wheat, tare) is one instanced draw that
// three culls against the camera, with a near and a far level of detail sharing the instance data.
type ChunkData = {center: THREE.Vector3; radius: number; kind: 'wheat' | 'tare'; near: THREE.BufferGeometry; far: THREE.BufferGeometry; matrix: THREE.InstancedBufferAttribute; count: number};

const shareInto = (base: THREE.BufferGeometry, inst: Record<string, THREE.InstancedBufferAttribute>) => {
	const g = new THREE.BufferGeometry();
	for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
	if (base.index) g.setIndex(base.index);
	for (const [k, a] of Object.entries(inst)) g.setAttribute(k, a);
	return g;
};

const buildChunks = (f: FieldPatch): ChunkData[] => {
	const list = instancesOf(f, f.flat ? () => 0 : farmHeight);
	const size = f.chunk ?? 4;
	const hero = f.detail === 'hero';
	const bases = {
		wheat: {near: stalkGeometry('wheat', hero ? 'hero' : 'field'), far: stalkGeometry('wheat', 'far')},
		tare: {near: stalkGeometry('tare', hero ? 'hero' : 'field'), far: stalkGeometry('tare', 'far')},
	};
	const groups = new Map<string, Inst[]>();
	for (const it of list) {
		const key = `${Math.floor((it.x - f.x0) / size)}:${Math.floor((it.z - f.z0) / size)}:${it.tare}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(it);
	}
	const out: ChunkData[] = [];
	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const up = new THREE.Vector3(0, 1, 0);
	for (const items of groups.values()) {
		const kind = items[0].tare ? 'tare' : 'wheat';
		const n = items.length;
		const mats = new Float32Array(n * 16);
		const rand = new Float32Array(n);
		const phase = new Float32Array(n);
		const tare = new Float32Array(n);
		const c = new THREE.Vector3();
		items.forEach((it, k) => {
			q.setFromAxisAngle(up, it.rot);
			// the tares stand a little taller, their dark heads show above the wheat once they turn
			m4.compose(new THREE.Vector3(it.x, it.y - 0.02, it.z), q, new THREE.Vector3(it.s, it.s * (kind === 'tare' ? 1.12 : 1), it.s));
			m4.toArray(mats, k * 16);
			rand[k] = it.rand;
			phase[k] = it.phase;
			tare[k] = it.tare;
			c.x += it.x / n;
			c.y += it.y / n;
			c.z += it.z / n;
		});
		let r = 0;
		for (const it of items) r = Math.max(r, Math.hypot(it.x - c.x, it.y - c.y, it.z - c.z));
		const inst = {aRand: new THREE.InstancedBufferAttribute(rand, 1), aPhase: new THREE.InstancedBufferAttribute(phase, 1), aTare: new THREE.InstancedBufferAttribute(tare, 1)};
		out.push({
			center: c.add(new THREE.Vector3(0, 0.55, 0)),
			radius: r + 1.4,
			kind,
			near: shareInto(bases[kind].near, inst),
			far: shareInto(bases[kind].far, inst),
			matrix: new THREE.InstancedBufferAttribute(mats, 16),
			count: n,
		});
	}
	return out;
};

const wheatUniforms = (): Record<string, THREE.IUniform> => ({
	uTime: {value: 0},
	uWind: {value: 1},
	uWindDir: {value: WIND_DIR.clone()},
	uGrow: {value: 1},
	uTareShow: {value: 1},
	uPart: {value: 0},
	uPartAt: {value: new THREE.Vector2()},
	uTareWave: {value: new THREE.Vector3()},
	uRipe: {value: 1},
	uTareDark: {value: 1},
	uSpots: {value: 0},
	uGlow: {value: 0},
	uGlowColor: {value: new THREE.Color('#ffe2a0')},
	uSunDir: {value: new THREE.Vector3(0, 1, 0)},
	uBack: {value: 0},
	uBackColor: {value: new THREE.Color('#ffffff')},
	uStemGreen: {value: new THREE.Color('#6f8f3a')},
	uStemGold: {value: new THREE.Color('#c99a4a')},
	uHeadGreen: {value: new THREE.Color('#8faa48')},
	uHeadGold: {value: new THREE.Color('#e3b24f')},
	uTareHead: {value: new THREE.Color('#231a24')},
});

// The under-canopy: a low wavy sheet the colour of shaded stalks, a little under the heads, so from above
// the field reads as dense as real wheat instead of showing the soil between the instanced stalks.
const CANOPY_H = 0.72;
const buildCanopy = (f: FieldPatch) => {
	const step = 0.32;
	const inset = 0.3;
	const x0 = f.x0 + inset;
	const x1 = f.x1 - inset;
	const z0 = f.z0 + inset;
	const z1 = f.z1 - inset;
	const nx = Math.max(2, Math.ceil((x1 - x0) / step));
	const nz = Math.max(2, Math.ceil((z1 - z0) / step));
	const pos: number[] = [];
	const rnd: number[] = [];
	const at = (i: number, j: number) => {
		const x = x0 + ((x1 - x0) * i) / nx + (i > 0 && i < nx ? (hash(f.seed + 9, i, j) - 0.5) * step * 0.5 : 0);
		const z = z0 + ((z1 - z0) * j) / nz + (j > 0 && j < nz ? (hash(f.seed + 10, i, j) - 0.5) * step * 0.5 : 0);
		return [x, farmHeight(x, z), z, (hash(f.seed + 11, i, j) - 0.5) * 0.16];
	};
	for (let j = 0; j < nz; j++) {
		for (let i = 0; i < nx; i++) {
			const a = at(i, j);
			const b = at(i + 1, j);
			const c = at(i + 1, j + 1);
			const d = at(i, j + 1);
			for (const tri of [[a, c, b], [a, d, c]]) {
				const r = hash(f.seed + 12, i * 2 + (tri[1] === d ? 1 : 0), j);
				for (const v of tri) {
					pos.push(v[0], v[1], v[2]);
					rnd.push(v[3], r);
				}
			}
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('aR', new THREE.Float32BufferAttribute(rnd, 2));
	g.computeVertexNormals();
	return g;
};
const canopyMaterial = (u: Record<string, THREE.IUniform>) => {
	const m = new THREE.MeshLambertMaterial();
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, u);
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', `#include <common>
				attribute vec2 aR; uniform float uGrow; varying vec2 vR; varying vec3 vCW;`)
			.replace('#include <begin_vertex>', `#include <begin_vertex>
				vR = aR;
				float g = clamp((uGrow - 0.15) / 0.85, 0.0, 1.0);
				transformed.y += (${CANOPY_H.toFixed(2)} + aR.x) * g * g - 0.06;
				vCW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', `#include <common>
				uniform float uRipe, uBack, uGrow; uniform vec3 uStemGreen, uStemGold, uHeadGreen, uHeadGold, uSunDir, uBackColor; varying vec2 vR; varying vec3 vCW;
				float ch(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
				float cvn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
					return mix(mix(ch(i), ch(i + vec2(1, 0)), u.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), u.x), u.y); }`)
			.replace('#include <color_fragment>', `#include <color_fragment>
				vec3 hc = mix(uHeadGreen, uHeadGold, uRipe);
				vec3 c = mix(mix(uStemGreen, uStemGold, uRipe * 0.9), hc, 0.55 + 0.3 * vR.y);
				// a busy texture of heads and shadows between them, so the sheet never reads as a floor
				vec2 q = vCW.xz;
				float n = cvn(q * vec2(7.0, 12.0)) * 0.6 + cvn(q * vec2(19.0, 31.0)) * 0.4;
				float heads = smoothstep(0.42, 0.72, n);
				diffuseColor.rgb = c * mix(0.12, 0.48, heads) * (0.85 + 0.3 * vR.y);`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				// the sea of heads lights up against the sun or moon like the stalks above it
				float bl = pow(max(0.0, dot(normalize(vCW - cameraPosition), normalize(uSunDir))), 3.0) * uBack;
				totalEmissiveRadiance += hc * uBackColor * bl * (0.08 + 0.4 * heads) * smoothstep(0.3, 0.8, uGrow);`);
	};
	m.customProgramCacheKey = () => 'wheatCanopy';
	return m;
};

// One mounted copy of a field: its own materials (so two shots in a blend can differ) over shared geometry.
const mountWheat = (f: FieldPatch) => {
	const chunks = cached(`wheat:${JSON.stringify(f)}`, () => buildChunks(f));
	const uniforms = wheatUniforms();
	const mat = new THREE.MeshLambertMaterial({flatShading: true, side: THREE.DoubleSide});
	mat.onBeforeCompile = (sh) => injectWind(sh, uniforms);
	mat.customProgramCacheKey = () => 'wheat';
	const depth = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking});
	depth.onBeforeCompile = (sh) => injectWind(sh, uniforms, true);
	depth.customProgramCacheKey = () => 'wheatDepth';
	const group = new THREE.Group();
	if (f.detail !== 'hero') {
		const canopy = new THREE.Mesh(
			cached(`canopy:${JSON.stringify(f)}`, () => buildCanopy(f)),
			canopyMaterial(uniforms),
		);
		canopy.receiveShadow = true;
		group.add(canopy);
	}
	const items = chunks.map((c) => {
		const make = (geo: THREE.BufferGeometry) => {
			const m = new THREE.InstancedMesh(geo, mat, c.count);
			m.instanceMatrix = c.matrix;
			m.customDepthMaterial = depth;
			m.boundingSphere = new THREE.Sphere(c.center, c.radius);
			m.frustumCulled = true;
			m.receiveShadow = false;
			group.add(m);
			return m;
		};
		return {c, near: make(c.near), far: make(c.far)};
	});
	return {group, items, uniforms};
};

export type WheatColors = Partial<Record<'stemGreen' | 'stemGold' | 'headGreen' | 'headGold' | 'tareHead' | 'glow', string>>;
export const Wheat: React.FC<{
	patch?: FieldPatch;
	state: WheatState;
	castShadow?: boolean;
	colors?: WheatColors;
	eye?: [number, number, number]; // the camera: chunks farther than `lod` metres use the light stalks
	lod?: number;
	only?: 'wheat' | 'tare';
	light?: {dir: [number, number, number]; color: string; back: number}; // the backlight glow
}> = ({patch = MAIN, state, castShadow = false, colors, eye, lod = 26, only, light}) => {
	const key = JSON.stringify(patch);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const w = useMemo(() => mountWheat(patch), [key]);
	const u = w.uniforms;
	u.uTime.value = state.time;
	u.uWind.value = state.wind;
	u.uGrow.value = state.grow;
	u.uRipe.value = state.ripe;
	u.uTareDark.value = state.tareDark;
	u.uTareShow.value = state.tareShow;
	u.uSpots.value = state.spots;
	u.uGlow.value = state.glow;
	u.uPart.value = state.part ?? 0;
	if (state.partAt) u.uPartAt.value.set(...state.partAt);
	u.uTareWave.value.set(...(state.tareWave ?? [0, 0, 0]));
	u.uStemGreen.value.set(colors?.stemGreen ?? '#6f8f3a');
	u.uStemGold.value.set(colors?.stemGold ?? '#c99a4a');
	u.uHeadGreen.value.set(colors?.headGreen ?? '#8faa48');
	u.uHeadGold.value.set(colors?.headGold ?? '#e3b24f');
	u.uTareHead.value.set(colors?.tareHead ?? '#231a24');
	u.uGlowColor.value.set(colors?.glow ?? '#ffe2a0');
	u.uSunDir.value.set(...(light?.dir ?? [0, 1, 0])).normalize();
	u.uBack.value = light?.back ?? 0;
	u.uBackColor.value.set(light?.color ?? '#ffffff');
	for (const it of w.items) {
		const far = eye ? Math.hypot(it.c.center.x - eye[0], it.c.center.z - eye[2]) - it.c.radius * 0.5 > lod : false;
		const on = !only || it.c.kind === only;
		it.near.visible = on && !far;
		it.far.visible = on && far;
		it.near.castShadow = castShadow;
		it.far.castShadow = false;
	}
	return <primitive object={w.group} />;
};

// ---------------------------------------------------------------------------------------------
// The farm around the field
// ---------------------------------------------------------------------------------------------
const sstep = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

// Ground height: furrows inside the field, a gentle roll, hills behind the farm.
export const farmHeight = (x: number, z: number) => {
	const roll = 0.35 * fbm2(x * 0.035, z * 0.035, 3);
	const inField = (1 - sstep(16.5, 17.5, Math.abs(x))) * (1 - sstep(7.5, 8.5, z)) * (1 - sstep(-21.5, -22.5, z) * 0) * sstep(-22.5, -21.5, z);
	const furrow = 0.035 * Math.sin((z * Math.PI * 2) / 0.3) * inField;
	const hills = sstep(-60, -150, z) * (6 + 12 * (fbm2(x * 0.01, z * 0.01, 7) + 0.5)) + sstep(-180, -320, z) * 26 * (fbm2(x * 0.005, 4, 8) + 0.6);
	const side = sstep(30, 60, Math.abs(x)) * 6 * (fbm2(x * 0.02, z * 0.02, 9) + 0.6);
	return roll + furrow + hills + side;
};

const SOIL = new THREE.Color('#6a4a30');
const SOIL_DK = new THREE.Color('#4e3522');
const GRASS = new THREE.Color('#8b8a48');
const GRASS2 = new THREE.Color('#a59a56');
const PATH = new THREE.Color('#bfa476');

const buildGround = () =>
	terrainGrid({
		xs: gridLine(-260, 260, 0, 0.16, 14, 50),
		zs: gridLine(-420, 90, -6, 0.15, 14, 60),
		height: farmHeight,
		seed: 41,
		jitter: 0.03,
		wobble: 0.2,
		color: (x, y, z, ny) => {
			const inField = Math.abs(x) < 16.6 && z < 7.6 && z > -21.6;
			if (inField) {
				const c = SOIL.clone().lerp(SOIL_DK, 0.5 + 0.5 * Math.sin((z * Math.PI * 2) / 0.3));
				if (Math.abs(x - 3.2 - 0.1 * z) < 0.45) return PATH.clone().lerp(SOIL, 0.35);
				return c;
			}
			const n = fbm2(x * 0.05, z * 0.05, 5) + 0.5;
			const g = GRASS.clone().lerp(GRASS2, Math.min(1, Math.max(0, n)));
			if (Math.abs(x + 9 + 0.2 * (z + 28)) < 1.1 && z < -20) g.lerp(PATH, 0.7);
			return ny < 0.85 ? g.multiplyScalar(0.85) : g;
		},
	});

// a flat-roofed farmhouse of plaster and timber, door to the field, an outdoor stair to the roof
const house = () => {
	const parts: THREE.BufferGeometry[] = [];
	const wall = '#d9c39b';
	const add = (g: THREE.BufferGeometry, c: string, j = 0.05, seed = 1) => parts.push(paintFaces(g, (x, y, z, ny) => new THREE.Color(c).multiplyScalar(0.92 + 0.08 * ny), j, seed));
	const body = new THREE.BoxGeometry(6, 3.2, 4.6);
	body.translate(0, 1.6, 0);
	add(body, wall, 0.04, 2);
	const roof = new THREE.BoxGeometry(6.5, 0.28, 5.1);
	roof.translate(0, 3.32, 0);
	add(roof, '#b79d74', 0.05, 3);
	const parapet = new THREE.BoxGeometry(6.5, 0.4, 0.18);
	parapet.translate(0, 3.6, 2.46);
	add(parapet, wall, 0.04, 4);
	const door = new THREE.BoxGeometry(1.0, 1.9, 0.08);
	door.translate(-0.8, 0.95, 2.32);
	add(door, '#5a3a24', 0.03, 5);
	for (const x of [1.2, 2.3]) {
		const win = new THREE.BoxGeometry(0.55, 0.55, 0.08);
		win.translate(x, 2.1, 2.32);
		add(win, '#2a1e18', 0.02, 6);
	}
	for (let k = 0; k < 7; k++) {
		const st = new THREE.BoxGeometry(0.9, 0.42, 0.42);
		st.translate(3.45, 0.21 + k * 0.45, 1.9 - k * 0.42);
		add(st, '#cdb58c', 0.05, 7 + k);
	}
	for (let k = 0; k < 6; k++) {
		const beam = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 5);
		beam.rotateX(Math.PI / 2);
		beam.translate(-2.6 + k * 1.05, 3.05, 2.55);
		add(beam, '#6b4a2e', 0.04, 20 + k);
	}
	return mergePlacedRaw(parts);
};
const mergePlacedRaw = (parts: THREE.BufferGeometry[]) => mergePlaced(parts.map((geo) => ({geo, pos: [0, 0, 0] as [number, number, number]})));

// the barn for the harvest: a gabled timber barn, big doors open on a warm inside (the glow is added by the shot)
const barn = () => {
	const parts: THREE.BufferGeometry[] = [];
	const add = (g: THREE.BufferGeometry, c: string, seed: number, j = 0.04) => parts.push(paintFaces(g, (x, y, z, ny) => new THREE.Color(c).multiplyScalar(0.88 + 0.12 * ny), j, seed));
	const W = 8;
	const D = 6.4;
	const HW = 3.6;
	const HR = 5.8;
	const wall = '#a07c55';
	const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: string, seed: number) => {
		const g = new THREE.BoxGeometry(w, h, d);
		g.translate(x, y, z);
		add(g, c, seed);
	};
	box(W, HW, 0.3, 0, HW / 2, -D / 2, wall, 1);
	box(0.3, HW, D, -W / 2, HW / 2, 0, wall, 2);
	box(0.3, HW, D, W / 2, HW / 2, 0, wall, 3);
	const door = 3.8;
	const side = (W - door) / 2;
	box(side, HW, 0.3, -(door / 2 + side / 2), HW / 2, D / 2, wall, 4);
	box(side, HW, 0.3, door / 2 + side / 2, HW / 2, D / 2, wall, 5);
	box(door + 0.2, 0.5, 0.34, 0, HW - 0.25, D / 2, '#7c5a3a', 6);
	// vertical boards on the front
	for (let k = 0; k < 9; k++) {
		const x = -W / 2 + 0.25 + k * 0.48;
		if (Math.abs(x) < door / 2 + 0.1) continue;
		box(0.05, HW - 0.1, 0.06, x, HW / 2, D / 2 + 0.17, '#8a6a46', 20 + k);
	}
	// the gables: a triangle at each end
	for (const z of [-D / 2, D / 2]) {
		const shape = new THREE.Shape();
		shape.moveTo(-W / 2, 0);
		shape.lineTo(W / 2, 0);
		shape.lineTo(0, HR - HW);
		shape.lineTo(-W / 2, 0);
		const g = new THREE.ExtrudeGeometry(shape, {depth: 0.3, bevelEnabled: false});
		g.translate(0, HW, z - 0.15);
		add(g, '#9a774f', 7 + (z > 0 ? 1 : 0));
	}
	// the roof: two sloping boards meeting at the ridge, with an overhang
	const over = 0.5;
	const run = W / 2 + over;
	const rise = (HR - HW) * (run / (W / 2));
	const L = Math.hypot(run, rise);
	const ang = Math.atan2(rise, run);
	for (const sx of [-1, 1]) {
		const g = new THREE.BoxGeometry(L, 0.22, D + 1.0);
		g.rotateZ(-sx * ang);
		g.translate((sx * run) / 2, HR - rise / 2 + 0.12, 0);
		add(g, '#6e4f33', 9 + sx, 0.06);
	}
	box(0.3, 0.3, D + 1.0, 0, HR + 0.1, 0, '#5e422a', 12);
	box(W, 0.1, D, 0, 0.05, 0, '#8a6a44', 13);
	return mergePlacedRaw(parts);
};

export const FARMHOUSE_AT: [number, number, number] = [-9, 0, -28];
export const BARN_AT: [number, number, number] = [9, 0, -30];

const buildFarm = () => {
	const ground = buildGround();
	const wall: Parameters<typeof mergePlaced>[0] = [];
	let k = 0;
	for (let x = -26; x <= 26; x += 0.62) {
		if (Math.abs(x - 3.2 + 2.2) < 1.2) continue; // the gate where the path crosses
		for (let layer = 0; layer < 2; layer++) {
			k++;
			const z = -23.2 + (hash(71, k) - 0.5) * 0.2;
			const s = 0.42 + hash(72, k) * 0.2;
			wall.push({geo: rock(1000 + (k % 40), hash(73, k) > 0.5 ? '#a89a86' : '#8f8474'), pos: [x + (hash(74, k) - 0.5) * 0.2, farmHeight(x, z) + layer * 0.34, z], rot: hash(75, k) * 6, scale: [s * 1.2, s * 0.8, s]});
		}
	}
	for (let z = -23; z <= 7; z += 0.62) {
		for (let layer = 0; layer < 2; layer++) {
			k++;
			const x = 18.4 + (hash(76, k) - 0.5) * 0.2;
			const s = 0.42 + hash(77, k) * 0.2;
			wall.push({geo: rock(1000 + (k % 40), hash(78, k) > 0.5 ? '#a89a86' : '#8f8474'), pos: [x, farmHeight(x, z) + layer * 0.34, z], rot: hash(79, k) * 6, scale: [s, s * 0.8, s * 1.2]});
		}
	}
	const trees: Parameters<typeof mergePlaced>[0] = [];
	const spots: [number, number, number][] = [
		[-15, -27, 1.3], [-4, -31, 1.2], [-17, -33, 1.4], [3, -27, 1.1], [15, -26, 1.3], [22, -18, 1.4], [23, -6, 1.2], [-21, -14, 1.3], [-22, -2, 1.2],
		[-28, -30, 1.5], [28, -34, 1.5], [-34, -12, 1.6], [34, -10, 1.6], [0, -42, 1.4], [-10, -46, 1.5], [14, -48, 1.5], [-24, 6, 1.3], [24, 8, 1.3],
	];
	spots.forEach(([x, z, s], i) => trees.push({geo: oliveTree(200 + i), pos: [x, farmHeight(x, z) - 0.05, z], rot: hash(81, i) * 6, scale: s}));
	const clouds: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 10; i++) {
		const a = -1.2 + (i / 9) * 2.4;
		const r = 380 + hash(91, i) * 120;
		clouds.push({geo: cloud(900 + i), pos: [Math.sin(a) * r, 60 + hash(92, i) * 70, -Math.cos(a) * r], rot: hash(93, i), scale: 3 + hash(94, i) * 3});
	}
	return {
		ground,
		wall: mergePlaced(wall),
		trees: mergePlaced(trees),
		house: house(),
		barn: barn(),
		clouds: mergePlaced(clouds),
	};
};

export type FarmProps = {
	t: number;
	mood: Mood;
	lite: boolean;
	center?: [number, number, number]; // the action area the sun's shadows cover
	span?: number;
	wheat?: WheatState;
	patch?: FieldPatch;
	hero?: FieldPatch; // a detailed patch near the camera (fills `patch.hole`)
	heroState?: WheatState;
	barn?: boolean;
	skyCurve?: number;
	wheatColors?: WheatColors;
	eye?: [number, number, number];
	lod?: number;
	cloudDrift?: number;
	wheatShadow?: boolean;
	backlight?: number; // how much the heads glow when seen against the sun or moon
};

export const FarmWorld: React.FC<FarmProps> = ({
	t,
	mood,
	lite,
	center = [0, 0, -4],
	span = 16,
	wheat,
	patch,
	hero,
	heroState,
	barn: showBarn = false,
	skyCurve = 0.55,
	wheatColors,
	eye,
	lod,
	cloudDrift = 0.002,
	wheatShadow = false,
	backlight = 0.9,
}) => {
	const g = cached('farmGeo', buildFarm);
	const m = useMemo(
		() => ({
			lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
			cloud: new THREE.MeshBasicMaterial({vertexColors: true, fog: false, transparent: true, opacity: 0.9}),
		}),
		[],
	);
	m.cloud.color.set(mood.cloud);
	return (
		<>
			<Sky {...skyFromMood(mood, t)} curve={skyCurve} />
			<MoodLights mood={mood} center={center} span={span} lite={lite} />
			<mesh geometry={g.ground} material={m.lambert} receiveShadow />
			<mesh geometry={g.wall} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.trees} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.house} material={m.lambert} position={FARMHOUSE_AT} castShadow receiveShadow />
			{showBarn && <mesh geometry={g.barn} material={m.lambert} position={BARN_AT} castShadow receiveShadow />}
			<mesh geometry={g.clouds} material={m.cloud} rotation-y={t * cloudDrift} />
			{wheat && <Wheat patch={patch} state={wheat} colors={wheatColors} eye={eye} lod={lod ?? (lite ? 0 : 26)} castShadow={wheatShadow} light={{dir: mood.sunDir, color: mood.sunColor, back: backlight}} />}
			{hero && <Wheat patch={hero} state={heroState ?? wheat!} colors={wheatColors} castShadow={wheatShadow} light={{dir: mood.sunDir, color: mood.sunColor, back: backlight}} />}
		</>
	);
};
