// Shared, cached materials and geometries (built once, reused by every mesh).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type MatOpts = {
	rough?: number;
	metal?: number;
	emissive?: string;
	emissiveIntensity?: number;
	transparent?: boolean;
	opacity?: number;
	side?: THREE.Side;
	map?: THREE.Texture | null;
	toneMapped?: boolean;
	envInt?: number;
	flatShading?: boolean;
	depthWrite?: boolean;
};

const matCache = new Map<string, THREE.Material>();

const keyOf = (prefix: string, color: string, o: MatOpts) => {
	const {map, ...rest} = o;
	return `${prefix}|${color}|${JSON.stringify(rest)}|${map ? map.uuid : ''}`;
};

/** Smooth, slightly shiny plastic (the Roblox look). */
export function plastic(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
	const key = keyOf('plastic', color, o);
	let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
	if (!m) {
		m = new THREE.MeshStandardMaterial({
			color: new THREE.Color(color),
			roughness: o.rough ?? 0.4,
			metalness: o.metal ?? 0,
			emissive: new THREE.Color(o.emissive ?? '#000000'),
			emissiveIntensity: o.emissiveIntensity ?? 1,
			transparent: o.transparent ?? false,
			opacity: o.opacity ?? 1,
			side: o.side ?? THREE.FrontSide,
			map: o.map ?? null,
			flatShading: o.flatShading ?? false,
			depthWrite: o.depthWrite ?? true,
		});
		if (o.envInt !== undefined) m.envMapIntensity = o.envInt;
		if (o.toneMapped === false) m.toneMapped = false;
		matCache.set(key, m);
	}
	return m;
}

/** Shiny gold (Golden Throne, crown). */
export function goldMat(glow = 0.18): THREE.MeshStandardMaterial {
	return plastic('#ffc531', {metal: 1, rough: 0.2, emissive: '#ff9d00', emissiveIntensity: glow, envInt: 1.6});
}

/** Grey metal (buckets). */
export function metalMat(color = '#9aa3ad', rough = 0.32): THREE.MeshStandardMaterial {
	return plastic(color, {metal: 0.75, rough, envInt: 1.2});
}

/** Unlit glowing color for lights, windows, bulbs. intensity > 1 makes it bloom. */
export function glowMat(color: string, intensity = 2, opts: {transparent?: boolean; opacity?: number; side?: THREE.Side; depthWrite?: boolean; additive?: boolean} = {}): THREE.MeshBasicMaterial {
	const key = `glow|${color}|${intensity}|${JSON.stringify(opts)}`;
	let m = matCache.get(key) as THREE.MeshBasicMaterial | undefined;
	if (!m) {
		m = new THREE.MeshBasicMaterial({
			color: new THREE.Color(color).multiplyScalar(intensity),
			transparent: opts.transparent ?? false,
			opacity: opts.opacity ?? 1,
			side: opts.side ?? THREE.FrontSide,
			depthWrite: opts.depthWrite ?? true,
			blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
		});
		m.toneMapped = false;
		matCache.set(key, m);
	}
	return m;
}

export function basicMat(color: string, opts: {transparent?: boolean; opacity?: number; side?: THREE.Side; map?: THREE.Texture | null; depthWrite?: boolean; toneMapped?: boolean; fog?: boolean} = {}) {
	const {map, ...rest} = opts;
	const key = `basic|${color}|${JSON.stringify(rest)}|${map ? map.uuid : ''}`;
	let m = matCache.get(key) as THREE.MeshBasicMaterial | undefined;
	if (!m) {
		m = new THREE.MeshBasicMaterial({
			color: new THREE.Color(color),
			transparent: opts.transparent ?? false,
			opacity: opts.opacity ?? 1,
			side: opts.side ?? THREE.FrontSide,
			map: map ?? null,
			depthWrite: opts.depthWrite ?? true,
			fog: opts.fog ?? true,
		});
		if (opts.toneMapped === false) m.toneMapped = false;
		matCache.set(key, m);
	}
	return m;
}

// ---------------------------------------------------------------- geometries
const geoCache = new Map<string, THREE.BufferGeometry>();
const g = <T extends THREE.BufferGeometry>(key: string, make: () => T): T => {
	let geo = geoCache.get(key) as T | undefined;
	if (!geo) {
		geo = make();
		geoCache.set(key, geo);
	}
	return geo;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Rounded box (soft-edged block). */
export const rbox = (w: number, h: number, d: number, r = 0.08, seg = 3) =>
	g(`rbox|${r3(w)}|${r3(h)}|${r3(d)}|${r3(r)}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
export const box = (w: number, h: number, d: number) => g(`box|${r3(w)}|${r3(h)}|${r3(d)}`, () => new THREE.BoxGeometry(w, h, d));
export const sphere = (r: number, ws = 24, hs = 16) => g(`sph|${r3(r)}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const cyl = (rt: number, rb: number, h: number, seg = 24, open = false) =>
	g(`cyl|${r3(rt)}|${r3(rb)}|${r3(h)}|${seg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
export const torus = (r: number, tube: number, rs = 12, ts = 36, arc = Math.PI * 2) =>
	g(`tor|${r3(r)}|${r3(tube)}|${rs}|${ts}|${r3(arc)}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
export const cone = (r: number, h: number, seg = 24) => g(`cone|${r3(r)}|${r3(h)}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const plane = (w: number, h: number) => g(`plane|${r3(w)}|${r3(h)}`, () => new THREE.PlaneGeometry(w, h));
export const circle = (r: number, seg = 32) => g(`circle|${r3(r)}|${seg}`, () => new THREE.CircleGeometry(r, seg));
export const lathe = (key: string, pts: [number, number][], seg = 32) =>
	g(`lathe|${key}|${seg}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));
export const custom = <T extends THREE.BufferGeometry>(key: string, make: () => T) => g(`custom|${key}`, make);

/** Rounded box whose 6 faces can take different materials (front = index 4). */
export const faceBox = rbox;
