// Rig math shared by the renderer. Same convention as tools/rig_preview.py:
// sprite pixels are y-down; joint angles are degrees, positive = counter-clockwise on screen.
import rigsJson from './rigs.json';
import {meta} from '../lib/textures';

export type PartDef = {sprite: string; pivot: [number, number]; parent: string | null; at: [number, number]; shade?: number};
export type RigDef = {heightM: number; root: string; order: string[]; parts: Record<string, PartDef>};
export type RigName = 'elijah' | 'enoch' | 'elisha';
export const RIGS = rigsJson as unknown as Record<RigName, RigDef>;

type Mat = [number, number, number, number, number, number]; // x' = a*x + c*y + e ; y' = b*x + d*y + f
const mul = (m: Mat, n: Mat): Mat => [
	m[0] * n[0] + m[2] * n[1],
	m[1] * n[0] + m[3] * n[1],
	m[0] * n[2] + m[2] * n[3],
	m[1] * n[2] + m[3] * n[3],
	m[0] * n[4] + m[2] * n[5] + m[4],
	m[1] * n[4] + m[3] * n[5] + m[5],
];
const trs = (tx: number, ty: number, deg: number): Mat => {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	return [c, -s, s, c, tx, ty];
};
const apply = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export const partTransforms = (rig: RigDef, pose: Record<string, number> = {}) => {
	const out: Record<string, Mat> = {};
	const get = (name: string): Mat => {
		if (out[name]) return out[name];
		const p = rig.parts[name];
		const local = mul(trs(p.at[0], p.at[1], pose[name] ?? 0), trs(-p.pivot[0], -p.pivot[1], 0));
		out[name] = p.parent ? mul(get(p.parent), local) : local;
		return out[name];
	};
	Object.keys(rig.parts).forEach(get);
	return out;
};

export type RigInfo = {top: number; sole: number; soleX: number; heightPx: number};
const infoCache = new Map<string, RigInfo>();

// Rest-pose extents relative to the root pivot (y-down px).
export const rigInfo = (name: RigName): RigInfo => {
	const hit = infoCache.get(name);
	if (hit) return hit;
	const rig = RIGS[name];
	const T = partTransforms(rig);
	let top = Infinity;
	let sole = -Infinity;
	let soleX = 0;
	for (const [part, p] of Object.entries(rig.parts)) {
		const m = meta(p.sprite);
		const [x0, y0, x1, y1] = m.bbox;
		for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
			const [, wy] = apply(T[part], x, y);
			top = Math.min(top, wy);
		}
		if (part.startsWith('leg') || part.startsWith('foot') || part === 'body') {
			const [fx, fy] = apply(T[part], m.foot[0], m.foot[1]);
			if (fy > sole) {
				sole = fy;
				soleX = fx;
			}
		}
	}
	const info = {top, sole, soleX, heightPx: sole - top};
	infoCache.set(name, info);
	return info;
};

// Which children hang off each part (for building the scene graph).
export const childrenOf = (rig: RigDef) => {
	const out: Record<string, string[]> = {};
	for (const [n, p] of Object.entries(rig.parts)) {
		if (p.parent) (out[p.parent] ??= []).push(n);
	}
	return out;
};
