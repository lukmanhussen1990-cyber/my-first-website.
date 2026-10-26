// Low-poly geometry builders: flat-shaded faces with per-face vertex colors (the reference diorama look).
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {fbm2, hash, mulberry32} from '../lib/random';

const tmpC = new THREE.Color();

// Give every triangle one color (computed at its centroid) and flat normals.
export const paintFaces = (
	geo: THREE.BufferGeometry,
	color: (cx: number, cy: number, cz: number, ny: number, face: number) => THREE.ColorRepresentation,
	jitter = 0.04,
	seed = 1,
) => {
	const g = geo.index ? geo.toNonIndexed() : geo;
	if (g.attributes.uv) g.deleteAttribute('uv'); // flat colour only, and every part must share one layout to merge
	g.computeVertexNormals();
	const pos = g.attributes.position as THREE.BufferAttribute;
	const nor = g.attributes.normal as THREE.BufferAttribute;
	const col = new Float32Array(pos.count * 3);
	for (let i = 0, f = 0; i < pos.count; i += 3, f++) {
		const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
		const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
		const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
		tmpC.set(color(cx, cy, cz, nor.getY(i), f));
		const j = 1 + (hash(seed, f) - 0.5) * 2 * jitter;
		for (let k = 0; k < 3; k++) col.set([tmpC.r * j, tmpC.g * j, tmpC.b * j], (i + k) * 3);
	}
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	return g;
};

// Displace shared vertices consistently (before splitting into flat faces).
const jitterVertices = (geo: THREE.BufferGeometry, seed: number, amount: number, squashY = 1) => {
	const pos = geo.attributes.position as THREE.BufferAttribute;
	const key = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
	const seen = new Map<string, [number, number, number]>();
	const rnd = mulberry32(seed);
	for (let i = 0; i < pos.count; i++) {
		const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
		if (!seen.has(k)) seen.set(k, [(rnd() - 0.5) * amount, (rnd() - 0.5) * amount, (rnd() - 0.5) * amount]);
		const d = seen.get(k)!;
		pos.setXYZ(i, pos.getX(i) + d[0], (pos.getY(i) + d[1]) * squashY, pos.getZ(i) + d[2]);
	}
	return geo;
};

export type TerrainOpts = {
	width: number;
	depth: number;
	segX: number;
	segZ: number;
	center?: [number, number];
	height: (x: number, z: number) => number;
	color: (x: number, y: number, z: number, ny: number) => THREE.ColorRepresentation;
	seed?: number;
	jitter?: number;
};

export const terrain = (o: TerrainOpts) => {
	const g = new THREE.PlaneGeometry(o.width, o.depth, o.segX, o.segZ);
	g.rotateX(-Math.PI / 2);
	const [cx, cz] = o.center ?? [0, 0];
	g.translate(cx, 0, cz);
	const pos = g.attributes.position as THREE.BufferAttribute;
	const rnd = mulberry32(o.seed ?? 3);
	const dx = o.width / o.segX;
	for (let i = 0; i < pos.count; i++) {
		// small grid jitter breaks the regular look of the facets
		const x = pos.getX(i) + (rnd() - 0.5) * dx * 0.35;
		const z = pos.getZ(i) + (rnd() - 0.5) * dx * 0.35;
		pos.setXYZ(i, x, o.height(x, z), z);
	}
	return paintFaces(g, (x, y, z, ny) => o.color(x, y, z, ny), o.jitter ?? 0.035, o.seed ?? 3);
};

// Grid coordinates that are fine near `center` and grow coarser outward (more facets where the action is).
export const gridLine = (lo: number, hi: number, center: number, fine: number, coarse: number, ramp: number) => {
	const size = (x: number) => fine + (coarse - fine) * Math.min(1, Math.abs(x - center) / ramp) ** 1.5;
	const up: number[] = [];
	for (let x = center; x < hi; x += size(x)) up.push(x);
	const down: number[] = [];
	for (let x = center - size(center); x > lo; x -= size(x)) down.push(x);
	return [lo, ...down.reverse(), ...up, hi];
};

// Terrain on an explicit (non-uniform) grid. Vertices are jittered a little inside their cell.
export const terrainGrid = (o: {
	xs: number[];
	zs: number[];
	height: (x: number, z: number) => number;
	color: (x: number, y: number, z: number, ny: number) => THREE.ColorRepresentation;
	seed?: number;
	jitter?: number;
	wobble?: number;
}) => {
	const nx = o.xs.length;
	const nz = o.zs.length;
	const pos = new Float32Array(nx * nz * 3);
	const rnd = mulberry32(o.seed ?? 3);
	for (let j = 0; j < nz; j++) {
		for (let i = 0; i < nx; i++) {
			const dx = (o.xs[Math.min(nx - 1, i + 1)] - o.xs[Math.max(0, i - 1)]) / 2;
			const dz = (o.zs[Math.min(nz - 1, j + 1)] - o.zs[Math.max(0, j - 1)]) / 2;
			const edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
			const w = edge ? 0 : (o.wobble ?? 0.32);
			const x = o.xs[i] + (rnd() - 0.5) * dx * w;
			const z = o.zs[j] + (rnd() - 0.5) * dz * w;
			pos.set([x, o.height(x, z), z], (j * nx + i) * 3);
		}
	}
	const idx: number[] = [];
	for (let j = 0; j < nz - 1; j++) {
		for (let i = 0; i < nx - 1; i++) {
			const a = j * nx + i;
			const b = a + 1;
			const c = a + nx;
			const d = c + 1;
			// alternate the diagonal so facets don't line up into stripes
			if ((i + j) % 2 === 0) idx.push(a, c, b, b, c, d);
			else idx.push(a, c, d, a, d, b);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setIndex(idx);
	return paintFaces(g, (x, y, z, ny) => o.color(x, y, z, ny), o.jitter ?? 0.02, o.seed ?? 3);
};

type Placed = {geo: THREE.BufferGeometry; pos: [number, number, number]; rot?: number; scale?: number | [number, number, number]};

export const mergePlaced = (items: Placed[]) => {
	const out: THREE.BufferGeometry[] = [];
	const m = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	for (const it of items) {
		const s = it.scale ?? 1;
		const sv = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
		q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot ?? 0);
		m.compose(new THREE.Vector3(...it.pos), q, sv);
		out.push(it.geo.clone().applyMatrix4(m));
	}
	return out.length ? mergeGeometries(out, false)! : new THREE.BufferGeometry();
};

const shadeBy = (base: THREE.ColorRepresentation, ny: number, light = 0.18) => {
	const c = new THREE.Color(base);
	return c.multiplyScalar(1 - light + light * (0.5 + 0.5 * ny));
};

export const roundTree = (seed: number, colors = {leaf: '#6f7a36', leaf2: '#86903f', trunk: '#5b3b22'}) => {
	const r = 0.9 + hash(seed, 1) * 0.5;
	const canopy = jitterVertices(new THREE.IcosahedronGeometry(r, 1), seed, r * 0.22, 0.92);
	canopy.translate(0, 1.5 + r * 0.8, 0);
	const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.7, 5);
	trunk.translate(0, 0.85, 0);
	const c = paintFaces(canopy, (x, y, z, ny) => shadeBy(hash(seed, Math.floor(y * 7 + x * 3)) > 0.5 ? colors.leaf : colors.leaf2, ny), 0.06, seed);
	const t = paintFaces(trunk, (x, y, z, ny) => shadeBy(colors.trunk, ny), 0.05, seed + 1);
	return mergeGeometries([c, t])!;
};

export const oliveTree = (seed: number, colors = {leaf: '#7f8a5a', leaf2: '#97a06c', trunk: '#6a4a32'}) => {
	const parts: THREE.BufferGeometry[] = [];
	const n = 3;
	for (let k = 0; k < n; k++) {
		const r = 0.55 + hash(seed, 10 + k) * 0.35;
		const g = jitterVertices(new THREE.IcosahedronGeometry(r, 1), seed + k * 7, r * 0.25, 0.62);
		g.translate((k - 1) * 0.55 + (hash(seed, 20 + k) - 0.5) * 0.3, 1.55 + hash(seed, 30 + k) * 0.35, (hash(seed, 40 + k) - 0.5) * 0.4);
		parts.push(paintFaces(g, (x, y, z, ny) => shadeBy(hash(seed, k + Math.floor(y * 5)) > 0.45 ? colors.leaf : colors.leaf2, ny), 0.06, seed + k));
	}
	const trunk = new THREE.CylinderGeometry(0.09, 0.2, 1.5, 5);
	trunk.translate(0, 0.75, 0);
	const pos = trunk.attributes.position as THREE.BufferAttribute;
	for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + Math.sin(pos.getY(i) * 2.4 + seed) * 0.12);
	parts.push(paintFaces(trunk, (x, y, z, ny) => shadeBy(colors.trunk, ny), 0.05, seed + 9));
	return mergeGeometries(parts)!;
};

export const palm = (seed: number, colors = {leaf: '#5e7a38', leaf2: '#7a8f44', trunk: '#7a5838'}) => {
	const parts: THREE.BufferGeometry[] = [];
	const h = 3.2 + hash(seed, 1) * 1.6;
	const bend = (hash(seed, 2) - 0.5) * 0.7;
	const segs = 6;
	for (let k = 0; k < segs; k++) {
		const y0 = (k / segs) * h;
		const seg = new THREE.CylinderGeometry(0.13 - k * 0.008, 0.16 - k * 0.008, h / segs + 0.02, 6);
		seg.translate(bend * (y0 / h) ** 2 * 1.4, y0 + h / segs / 2, 0);
		parts.push(paintFaces(seg, (x, y, z, ny) => shadeBy(k % 2 ? colors.trunk : '#6a4a2e', ny), 0.04, seed + k));
	}
	const top = new THREE.Vector3(bend * 1.4, h, 0);
	const fronds = 7;
	for (let k = 0; k < fronds; k++) {
		const ang = (k / fronds) * Math.PI * 2 + hash(seed, 50 + k);
		const len = 1.6 + hash(seed, 60 + k) * 0.6;
		const g = new THREE.BufferGeometry();
		const droop = 0.9 + hash(seed, 70 + k) * 0.5;
		const verts = new Float32Array([
			0, 0, -0.12, len * 0.5, 0.25, 0, 0, 0, 0.12,
			0, 0, 0.12, len * 0.5, 0.25, 0, len, -droop, 0,
			0, 0, -0.12, len, -droop, 0, len * 0.5, 0.25, 0,
		]);
		g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
		g.rotateY(ang);
		g.translate(top.x, top.y, top.z);
		parts.push(paintFaces(g, (x, y, z, ny) => shadeBy(k % 2 ? colors.leaf : colors.leaf2, Math.abs(ny)), 0.05, seed + 80 + k));
	}
	return mergeGeometries(parts)!;
};

export const rock = (seed: number, color = '#9a8a72') => {
	const g = jitterVertices(new THREE.DodecahedronGeometry(0.5, 0), seed, 0.28, 0.7);
	g.translate(0, 0.18, 0);
	return paintFaces(g, (x, y, z, ny) => shadeBy(color, ny, 0.3), 0.07, seed);
};

export const bush = (seed: number, colors = {a: '#6d7a3a', b: '#7f8c46'}) => {
	const parts: THREE.BufferGeometry[] = [];
	for (let k = 0; k < 3; k++) {
		const r = 0.3 + hash(seed, k) * 0.2;
		const g = jitterVertices(new THREE.IcosahedronGeometry(r, 0), seed + k, r * 0.3, 0.8);
		g.translate((k - 1) * 0.3, r * 0.7, (hash(seed, 9 + k) - 0.5) * 0.3);
		parts.push(paintFaces(g, (x, y, z, ny) => shadeBy(k % 2 ? colors.a : colors.b, ny), 0.06, seed + k));
	}
	return mergeGeometries(parts)!;
};

export const reeds = (seed: number, color = '#7d8f45') => {
	const parts: THREE.BufferGeometry[] = [];
	for (let k = 0; k < 7; k++) {
		const h = 0.7 + hash(seed, k) * 0.7;
		const g = new THREE.ConeGeometry(0.035, h, 3);
		g.translate(0, h / 2, 0);
		g.rotateZ((hash(seed, 20 + k) - 0.5) * 0.4);
		g.translate((hash(seed, 30 + k) - 0.5) * 0.5, 0, (hash(seed, 40 + k) - 0.5) * 0.4);
		parts.push(paintFaces(g, (x, y, z, ny) => shadeBy(k % 3 ? color : '#97a556', ny), 0.06, seed + k));
	}
	return mergeGeometries(parts)!;
};

export const grassTuft = (seed: number, color = '#b59a52') => {
	const parts: THREE.BufferGeometry[] = [];
	for (let k = 0; k < 5; k++) {
		const h = 0.22 + hash(seed, k) * 0.25;
		const g = new THREE.ConeGeometry(0.05, h, 3);
		g.translate(0, h / 2, 0);
		g.rotateZ((hash(seed, 20 + k) - 0.5) * 0.9);
		g.translate((hash(seed, 30 + k) - 0.5) * 0.25, 0, (hash(seed, 40 + k) - 0.5) * 0.2);
		parts.push(paintFaces(g, (x, y, z, ny) => shadeBy(k % 2 ? color : '#c9ad62', ny), 0.06, seed + k));
	}
	return mergeGeometries(parts)!;
};

export const cloud = (seed: number, color: THREE.ColorRepresentation = '#fff4e6', shade: THREE.ColorRepresentation = '#e8cdb0') => {
	const parts: THREE.BufferGeometry[] = [];
	const n = 4 + Math.floor(hash(seed, 1) * 3);
	for (let k = 0; k < n; k++) {
		const r = 1 + hash(seed, 10 + k) * 1.2;
		const g = jitterVertices(new THREE.IcosahedronGeometry(r, 1), seed + k, r * 0.18, 0.55);
		g.translate((k - n / 2) * 1.4 + hash(seed, 20 + k), hash(seed, 30 + k) * 0.6, (hash(seed, 40 + k) - 0.5) * 1.2);
		const a = new THREE.Color(color);
		const b = new THREE.Color(shade);
		parts.push(paintFaces(g, (x, y, z, ny) => a.clone().lerp(b, 0.5 - 0.5 * ny), 0.03, seed + k));
	}
	return mergeGeometries(parts)!;
};

// Smooth ground helpers
export const ridge = (x: number, z: number, seed: number, scale: number) => fbm2(x * scale, z * scale, seed, 4);
