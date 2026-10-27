import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {rng, fbm2} from '../math';

// Low-poly kit: flat-shaded geometry with a slightly different colour on every face, which
// is what gives the reference dioramas their hand-cut, faceted look.

const tmp = new THREE.Color();

export const facet = (geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0.06, seed = 1) => {
	const g = geo.index ? geo.toNonIndexed() : geo;
	g.computeVertexNormals();
	const n = g.attributes.position.count;
	const cols = new Float32Array(n * 3);
	const r = rng(seed);
	const base = new THREE.Color(color);
	const hsl = {h: 0, s: 0, l: 0};
	base.getHSL(hsl);
	for (let f = 0; f < n / 3; f++) {
		const dl = (r() - 0.5) * 2 * jitter;
		const dh = (r() - 0.5) * jitter * 0.12;
		tmp.setHSL(hsl.h + dh, hsl.s * (1 + (r() - 0.5) * jitter), Math.min(1, Math.max(0, hsl.l + dl)));
		for (let v = 0; v < 3; v++) cols.set([tmp.r, tmp.g, tmp.b], (f * 3 + v) * 3);
	}
	g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
	return g;
};

export const merge = (geos: THREE.BufferGeometry[]) => {
	const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
	return mergeGeometries(flat, false)!;
};

export const at = (geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s: number | [number, number, number] = 1) => {
	const m = new THREE.Matrix4().compose(
		new THREE.Vector3(x, y, z),
		new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
		Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s),
	);
	return geo.clone().applyMatrix4(m);
};

export const box = (w: number, h: number, d: number, bevel = 0) =>
	bevel > 0 ? new RoundedBoxGeometry(w, h, d, 1, bevel) : new THREE.BoxGeometry(w, h, d);

// jittered blob (rock, bush, canopy)
export const blob = (radius: number, seed: number, rough = 0.22, detail = 1, squash = 1) => {
	const g = new THREE.IcosahedronGeometry(radius, detail);
	const p = g.attributes.position;
	const r = rng(seed);
	const offs = new Map<string, number>();
	for (let i = 0; i < p.count; i++) {
		const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
		if (!offs.has(key)) offs.set(key, 1 + (r() - 0.5) * 2 * rough);
		const k = offs.get(key)!;
		p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k);
	}
	g.computeVertexNormals();
	return g;
};

export const column = (r: number, h: number, seg = 10) =>
	merge([
		at(new THREE.CylinderGeometry(r, r * 1.06, h, seg, 1), 0, h / 2, 0),
		at(new THREE.BoxGeometry(r * 2.7, r * 0.5, r * 2.7), 0, r * 0.25, 0),
		at(new THREE.CylinderGeometry(r * 1.25, r * 1.25, r * 0.3, seg), 0, r * 0.62, 0),
		at(new THREE.CylinderGeometry(r * 1.32, r * 1.05, r * 0.42, seg), 0, h - r * 0.2, 0),
		at(new THREE.BoxGeometry(r * 2.9, r * 0.42, r * 2.9), 0, h + r * 0.2, 0),
	]);

// heightfield terrain, flat shaded, coloured by a callback
export const terrain = (
	w: number,
	d: number,
	segX: number,
	segZ: number,
	height: (x: number, z: number) => number,
	color: (x: number, z: number, y: number) => THREE.ColorRepresentation,
	seed = 1,
	jitter = 0.05,
) => {
	const g = new THREE.PlaneGeometry(w, d, segX, segZ);
	g.rotateX(-Math.PI / 2);
	const p = g.attributes.position;
	const r = rng(seed);
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i) + (r() - 0.5) * (w / segX) * 0.35;
		const z = p.getZ(i) + (r() - 0.5) * (d / segZ) * 0.35;
		p.setXYZ(i, x, height(x, z), z);
	}
	const flat = g.toNonIndexed();
	flat.computeVertexNormals();
	const fp = flat.attributes.position;
	const cols = new Float32Array(fp.count * 3);
	const hsl = {h: 0, s: 0, l: 0};
	for (let f = 0; f < fp.count / 3; f++) {
		const cx = (fp.getX(f * 3) + fp.getX(f * 3 + 1) + fp.getX(f * 3 + 2)) / 3;
		const cy = (fp.getY(f * 3) + fp.getY(f * 3 + 1) + fp.getY(f * 3 + 2)) / 3;
		const cz = (fp.getZ(f * 3) + fp.getZ(f * 3 + 1) + fp.getZ(f * 3 + 2)) / 3;
		tmp.set(color(cx, cz, cy));
		tmp.getHSL(hsl);
		tmp.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + (r() - 0.5) * 2 * jitter)));
		for (let v = 0; v < 3; v++) cols.set([tmp.r, tmp.g, tmp.b], (f * 3 + v) * 3);
	}
	flat.setAttribute('color', new THREE.BufferAttribute(cols, 3));
	return flat;
};

export const hills = (x: number, z: number, seed: number, scale: number, amp: number) => fbm2(x / scale, z / scale, seed, 4) * amp;

const matCache = new Map<string, THREE.Material>();
export const lambert = (key = 'vc', opts: THREE.MeshLambertMaterialParameters = {}) => {
	const k = key + JSON.stringify(opts);
	if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true, ...opts}));
	return matCache.get(k)!;
};
