// Shared helpers: cached materials/geometries, easing, seeded random, canvas textures.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOutCubic = (t) => {
	const x = clamp(t);
	return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeOutBack = (t, s = 2.2) => {
	const x = clamp(t) - 1;
	return 1 + (s + 1) * x * x * x + s * x * x;
};
export const seg = (x, a, b, ease = easeInOutCubic) => ease(clamp((x - a) / (b - a)));
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Deterministic random in [0,1) from any key. */
export const rnd = (key) => {
	let h = 2166136261;
	const s = String(key);
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	h ^= h >>> 13;
	h = Math.imul(h, 0x5bd1e995);
	h ^= h >>> 15;
	return (h >>> 0) / 4294967296;
};

const mats = new Map();
/** Smooth plastic look: MeshStandardMaterial, roughness 0.6. */
export const mat = (color, o = {}) => {
	const key = `${color}|${JSON.stringify(o)}`;
	let m = mats.get(key);
	if (!m) {
		m = new THREE.MeshStandardMaterial({
			color: new THREE.Color(color),
			roughness: o.rough ?? 0.6,
			metalness: o.metal ?? 0,
			emissive: new THREE.Color(o.emissive ?? '#000000'),
			emissiveIntensity: o.ei ?? 1,
			transparent: o.transparent ?? false,
			opacity: o.opacity ?? 1,
			side: o.side ?? THREE.FrontSide,
		});
		mats.set(key, m);
	}
	return m;
};
export const basic = (color, o = {}) => {
	const key = `basic|${color}|${JSON.stringify({...o, map: o.map ? o.map.uuid : null})}`;
	let m = mats.get(key);
	if (!m) {
		m = new THREE.MeshBasicMaterial({color: new THREE.Color(color), map: o.map ?? null, transparent: o.transparent ?? !!o.map, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true, fog: o.fog ?? true, toneMapped: o.toneMapped ?? true});
		mats.set(key, m);
	}
	return m;
};

const geos = new Map();
const g = (key, make) => {
	let v = geos.get(key);
	if (!v) {
		v = make();
		geos.set(key, v);
	}
	return v;
};
const r3 = (n) => Math.round(n * 1000) / 1000;
export const rbox = (w, h, d, r = 0.12, seg = 2) => {
	const rr = Math.max(0.001, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
	return g(`rb${r3(w)},${r3(h)},${r3(d)},${r3(rr)},${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, rr));
};
export const box = (w, h, d) => g(`b${r3(w)},${r3(h)},${r3(d)}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, s = 16) => g(`c${r3(rt)},${r3(rb)},${r3(h)},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const sph = (r, ws = 16, hs = 12) => g(`s${r3(r)},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const cone = (r, h, s = 12) => g(`k${r3(r)},${r3(h)},${s}`, () => new THREE.ConeGeometry(r, h, s));
export const plane = (w, h) => g(`p${r3(w)},${r3(h)}`, () => new THREE.PlaneGeometry(w, h));
export const torus = (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => g(`t${r3(r)},${r3(t)},${rs},${ts},${r3(arc)}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));

export const mesh = (geo, material, pos = [0, 0, 0], rot = [0, 0, 0], shadow = true) => {
	const m = new THREE.Mesh(geo, material);
	m.position.set(...pos);
	m.rotation.set(...rot);
	m.castShadow = shadow;
	m.receiveShadow = true;
	return m;
};

const texs = new Map();
/** Cached canvas texture drawn by fn(ctx, w, h). */
export const canvasTex = (key, w, h, fn) => {
	let t = texs.get(key);
	if (!t) {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		fn(c.getContext('2d'), w, h);
		t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 8;
		texs.set(key, t);
	}
	return t;
};

export const FONT = 'Poppins';
export const textTex = (text, o = {}) => {
	const w = o.w ?? 1024;
	const h = o.h ?? 256;
	return canvasTex(`txt|${text}|${JSON.stringify(o)}`, w, h, (ctx) => {
		if (o.bg) {
			ctx.fillStyle = o.bg;
			roundRect(ctx, 0, 0, w, h, o.radius ?? 0);
			ctx.fill();
		}
		const lines = text.split('\n');
		let size = o.size ?? Math.floor((h / lines.length) * 0.62);
		ctx.font = `800 ${size}px ${FONT}, sans-serif`;
		const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
		if (widest > w * 0.9) size = Math.floor((size * w * 0.9) / widest);
		ctx.font = `800 ${size}px ${FONT}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		lines.forEach((l, i) => {
			const y = h / 2 + (i - (lines.length - 1) / 2) * size * 1.1 + size * 0.04;
			if (o.stroke) {
				ctx.lineJoin = 'round';
				ctx.lineWidth = size * 0.16;
				ctx.strokeStyle = o.stroke;
				ctx.strokeText(l, w / 2, y);
			}
			ctx.fillStyle = o.color ?? '#ffffff';
			ctx.fillText(l, w / 2, y);
		});
	});
};

export function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

export const glowTex = () =>
	canvasTex('glow', 128, 128, (ctx, w) => {
		const gr = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
		gr.addColorStop(0, 'rgba(255,255,255,1)');
		gr.addColorStop(0.3, 'rgba(255,255,255,0.45)');
		gr.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = gr;
		ctx.fillRect(0, 0, w, w);
	});
