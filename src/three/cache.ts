import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* Shared, cached geometries and materials. Passed to meshes as props so R3F never disposes them. */

const geos = new Map<string, THREE.BufferGeometry>();
const g = <T extends THREE.BufferGeometry>(key: string, make: () => T): T => {
	let v = geos.get(key) as T | undefined;
	if (!v) {
		v = make();
		geos.set(key, v);
	}
	return v;
};

const r2 = (n: number) => Math.round(n * 1000) / 1000;

export const rboxGeo = (w: number, h: number, d: number, r = 0.12, seg = 3) => {
	const rr = Math.max(0.001, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
	return g(`rb${r2(w)},${r2(h)},${r2(d)},${r2(rr)},${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rr));
};
export const boxGeo = (w: number, h: number, d: number) => g(`b${r2(w)},${r2(h)},${r2(d)}`, () => new THREE.BoxGeometry(w, h, d));
export const cylGeo = (rt: number, rb: number, h: number, seg = 24, open = false) =>
	g(`c${r2(rt)},${r2(rb)},${r2(h)},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
export const sphGeo = (r: number, ws = 24, hs = 16) => g(`s${r2(r)},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const coneGeo = (r: number, h: number, seg = 16) => g(`k${r2(r)},${r2(h)},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const planeGeo = (w: number, h: number) => g(`p${r2(w)},${r2(h)}`, () => new THREE.PlaneGeometry(w, h));
export const torusGeo = (r: number, tube: number, rs = 12, ts = 32, arc = Math.PI * 2) =>
	g(`t${r2(r)},${r2(tube)},${rs},${ts},${r2(arc)}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
export const circleGeo = (r: number, seg = 32) => g(`ci${r2(r)},${seg}`, () => new THREE.CircleGeometry(r, seg));

const mats = new Map<string, THREE.Material>();
export type MatOpts = {
	rough?: number;
	metal?: number;
	emissive?: string;
	ei?: number;
	transparent?: boolean;
	opacity?: number;
	map?: THREE.Texture | null;
	side?: THREE.Side;
	clearcoat?: number;
	flat?: boolean;
	depthWrite?: boolean;
	fog?: boolean;
};

let texIds = new WeakMap<THREE.Texture, number>();
let texCounter = 0;
const texId = (t?: THREE.Texture | null) => {
	if (!t) return 0;
	let id = texIds.get(t);
	if (!id) {
		id = ++texCounter;
		texIds.set(t, id);
	}
	return id;
};

/** Smooth, slightly shiny plastic. */
export const plastic = (color: string, o: MatOpts = {}) => {
	const key = `pl|${color}|${JSON.stringify({...o, map: texId(o.map)})}`;
	let m = mats.get(key);
	if (!m) {
		const params: THREE.MeshPhysicalMaterialParameters = {
			color: new THREE.Color(color),
			roughness: o.rough ?? 0.42,
			metalness: o.metal ?? 0,
			emissive: new THREE.Color(o.emissive ?? '#000000'),
			emissiveIntensity: o.ei ?? 1,
			transparent: o.transparent ?? false,
			opacity: o.opacity ?? 1,
			map: o.map ?? null,
			side: o.side ?? THREE.FrontSide,
			flatShading: o.flat ?? false,
			depthWrite: o.depthWrite ?? true,
			fog: o.fog ?? true,
		};
		if (o.clearcoat) {
			m = new THREE.MeshPhysicalMaterial({...params, clearcoat: o.clearcoat, clearcoatRoughness: 0.25});
		} else {
			m = new THREE.MeshStandardMaterial(params);
		}
		mats.set(key, m);
	}
	return m;
};

/** Unlit material (signs, glows, faces). */
export const unlit = (color: string, o: {map?: THREE.Texture | null; transparent?: boolean; opacity?: number; additive?: boolean; side?: THREE.Side; depthWrite?: boolean; fog?: boolean; toneMapped?: boolean} = {}) => {
	const key = `ul|${color}|${JSON.stringify({...o, map: texId(o.map)})}`;
	let m = mats.get(key);
	if (!m) {
		m = new THREE.MeshBasicMaterial({
			color: new THREE.Color(color),
			map: o.map ?? null,
			transparent: o.transparent ?? !!o.map,
			opacity: o.opacity ?? 1,
			blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
			side: o.side ?? THREE.FrontSide,
			depthWrite: o.depthWrite ?? !o.additive,
			fog: o.fog ?? true,
		});
		mats.set(key, m);
	}
	return m;
};

/** Lit material for textured planes (keeps lighting but also self-illuminates a bit so it stays readable). */
export const litTex = (map: THREE.Texture, glow = 0.35, o: {transparent?: boolean; side?: THREE.Side; rough?: number} = {}) => {
	const key = `lt|${texId(map)}|${glow}|${JSON.stringify(o)}`;
	let m = mats.get(key);
	if (!m) {
		m = new THREE.MeshStandardMaterial({
			map,
			emissiveMap: map,
			emissive: new THREE.Color('#ffffff'),
			emissiveIntensity: glow,
			transparent: o.transparent ?? true,
			roughness: o.rough ?? 0.6,
			side: o.side ?? THREE.FrontSide,
			alphaTest: 0.02,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2,
		});
		mats.set(key, m);
	}
	return m;
};

export const spriteMat = (map: THREE.Texture, color = '#ffffff', additive = false) => {
	const key = `sp|${texId(map)}|${color}|${additive}`;
	let m = mats.get(key);
	if (!m) {
		m = new THREE.SpriteMaterial({map, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending});
		mats.set(key, m);
	}
	return m as THREE.SpriteMaterial;
};
