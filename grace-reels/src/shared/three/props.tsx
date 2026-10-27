import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {at, blob, box, column, facet, lambert, merge} from './lowpoly';
import {rng} from '../math';
import type {Vec3} from './shot';

type GP = {position?: Vec3; rotation?: Vec3; scale?: number | Vec3; castShadow?: boolean; receiveShadow?: boolean};
const mesh = (geo: THREE.BufferGeometry, p: GP, mat: THREE.Material = lambert()) => (
	<mesh
		geometry={geo}
		material={mat}
		position={p.position}
		rotation={p.rotation}
		scale={p.scale}
		castShadow={p.castShadow ?? true}
		receiveShadow={p.receiveShadow ?? true}
	/>
);

const WOOD = '#A06C40';

// heavy money-changer's table; origin at the floor under its centre
export const tableGeo = (seed = 1, w = 1.7, d = 0.85, h = 0.82) =>
	merge([
		// top made of four planks so it reads as wood
		...[0, 1, 2, 3].map((k) => facet(at(box(w, 0.1, d / 4 - 0.012, 0.01), 0, h - 0.05, -d / 2 + (k + 0.5) * (d / 4)), k % 2 ? WOOD : '#94603A', 0.07, seed + k * 13)),
		facet(at(box(w - 0.1, 0.16, 0.05), 0, h - 0.18, d / 2 - 0.05), '#8C5B33', 0.06, seed + 1),
		...[-1, 1].flatMap((sx) =>
			[-1, 1].map((sz, i) => facet(at(box(0.1, h - 0.1, 0.1), (sx * (w - 0.2)) / 2, (h - 0.1) / 2, (sz * (d - 0.2)) / 2), '#7E5030', 0.06, seed + 3 + i)),
		),
	]);
export const Table: React.FC<GP & {seed?: number}> = ({seed = 1, ...p}) => {
	const geo = useMemo(() => tableGeo(seed), [seed]);
	return mesh(geo, p);
};

export const cageGeo = (seed = 1, open = 0) => {
	const parts: THREE.BufferGeometry[] = [];
	const w = 0.5;
	const h = 0.42;
	const c = '#C49A5C';
	parts.push(facet(at(box(w + 0.04, 0.04, w + 0.04), 0, 0.02, 0), '#A87E46', 0.06, seed));
	parts.push(facet(at(new THREE.ConeGeometry(w * 0.78, 0.16, 4, 1), 0, h + 0.08, 0, Math.PI / 4), '#B48A50', 0.06, seed + 1));
	const bars = 6;
	for (let s = 0; s < 4; s++) {
		for (let i = 0; i < bars; i++) {
			const u = -w / 2 + (i / (bars - 1)) * w;
			const isDoor = s === 0 && i > 1 && i < 4;
			if (isDoor && open > 0.5) continue;
			const [x, z] = s === 0 ? [u, w / 2] : s === 1 ? [w / 2, u] : s === 2 ? [u, -w / 2] : [-w / 2, u];
			parts.push(facet(at(box(0.02, h, 0.02), x, h / 2, z), c, 0.08, seed + 10 + s * 10 + i));
		}
	}
	parts.push(facet(at(box(w, 0.025, w), 0, h, 0), c, 0.05, seed + 2));
	return merge(parts);
};
export const Cage: React.FC<GP & {seed?: number; open?: number}> = ({seed = 1, open = 0, ...p}) => {
	const geo = useMemo(() => cageGeo(seed, open), [seed, open]);
	return mesh(geo, p);
};

export const jarGeo = (seed = 1, h = 0.7, color = '#B8643A') => {
	const pts = [
		[0.0, 0],
		[0.16, 0.0],
		[0.24, 0.12],
		[0.27, 0.32],
		[0.22, 0.52],
		[0.1, 0.62],
		[0.11, 0.7],
	].map(([x, y]) => new THREE.Vector2(x * (h / 0.7), y * (h / 0.7)));
	return facet(new THREE.LatheGeometry(pts, 9), color, 0.07, seed);
};
export const Jar: React.FC<GP & {seed?: number; h?: number; color?: string}> = ({seed = 1, h = 0.7, color, ...p}) => {
	const geo = useMemo(() => jarGeo(seed, h, color), [seed, h, color]);
	return mesh(geo, p);
};

export const sackGeo = (seed = 1) => facet(at(blob(0.3, seed, 0.18, 1, 0.8), 0, 0.22, 0), '#B49A6E', 0.07, seed);

export const awningGeo = (w: number, d: number, colA: string, colB: string, seed = 1) => {
	const parts: THREE.BufferGeometry[] = [];
	const stripes = 6;
	for (let i = 0; i < stripes; i++) {
		parts.push(facet(at(box(w / stripes, 0.03, d), -w / 2 + (i + 0.5) * (w / stripes), 0, 0), i % 2 ? colA : colB, 0.05, seed + i));
	}
	return merge(parts);
};

export const Column: React.FC<GP & {r?: number; h?: number; seed?: number; color?: string}> = ({r = 0.34, h = 4.6, seed = 1, color = '#E6D9BE', ...p}) => {
	const geo = useMemo(() => facet(column(r, h, 10), color, 0.05, seed), [r, h, seed, color]);
	return mesh(geo, p);
};

export const Rock: React.FC<GP & {r?: number; seed?: number; color?: string}> = ({r = 0.5, seed = 1, color = '#9C8A72', ...p}) => {
	const geo = useMemo(() => facet(at(blob(r, seed, 0.3, 0, 0.7), 0, r * 0.45, 0), color, 0.08, seed), [r, seed, color]);
	return mesh(geo, p);
};

export const oliveGeo = (seed = 1, s = 1) => {
	const r = rng(seed);
	const parts: THREE.BufferGeometry[] = [];
	parts.push(facet(at(new THREE.CylinderGeometry(0.09 * s, 0.16 * s, 1.4 * s, 6), 0, 0.7 * s, 0, 0, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3), '#6B5440', 0.08, seed));
	const n = 4;
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + r();
		const rad = (0.55 + r() * 0.3) * s;
		parts.push(facet(at(blob(rad, seed * 7 + i, 0.22, 1, 0.75), Math.cos(a) * 0.45 * s, (1.6 + r() * 0.4) * s, Math.sin(a) * 0.45 * s), i % 2 ? '#7E8B5A' : '#8C9763', 0.07, seed + i));
	}
	return merge(parts);
};
export const Olive: React.FC<GP & {seed?: number; s?: number}> = ({seed = 1, s = 1, ...p}) => {
	const geo = useMemo(() => oliveGeo(seed, s), [seed, s]);
	return mesh(geo, p);
};

export const palmGeo = (seed = 1, h = 4) => {
	const r = rng(seed);
	const parts: THREE.BufferGeometry[] = [];
	parts.push(facet(at(new THREE.CylinderGeometry(0.1, 0.16, h, 6), 0, h / 2, 0, 0, 0.05, 0.08), '#8A6A46', 0.08, seed));
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2 + r() * 0.3;
		const leaf = new THREE.ConeGeometry(0.22, 1.8, 3, 1);
		leaf.translate(0, 0.9, 0);
		parts.push(facet(at(leaf, 0.3 * Math.sin(a), h, 0.3 * Math.cos(a), a, 1.25 + r() * 0.2, 0, [1, 1, 0.25]), '#6F8A4A', 0.08, seed + i));
	}
	return merge(parts);
};

export const Cross: React.FC<GP & {h?: number}> = ({h = 3.2, ...p}) => {
	const geo = useMemo(() => merge([facet(at(box(0.2, h, 0.2), 0, h / 2, 0), '#4E3322', 0.05, 3), facet(at(box(1.7, 0.18, 0.2), 0, h * 0.74, 0), '#4E3322', 0.05, 4)]), [h]);
	return mesh(geo, p);
};

export const Bench: React.FC<GP & {w?: number; seed?: number; color?: string}> = ({w = 3, seed = 1, color = '#CBB38D', ...p}) => {
	const geo = useMemo(() => merge([facet(at(box(w, 0.1, 0.5, 0.02), 0, 0.42, 0), color, 0.05, seed), facet(at(box(w - 0.2, 0.37, 0.42), 0, 0.185, 0), '#B79D78', 0.05, seed + 1)]), [w, seed, color]);
	return mesh(geo, p);
};

// ---------- animals (3D low-poly, like the reference sheep) ----------
export const Sheep: React.FC<GP & {seed?: number; run?: number; phase?: number}> = ({seed = 1, run = 0, phase = 0, ...p}) => {
	const {body, head, leg} = useMemo(
		() => ({
			body: facet(at(blob(0.34, seed, 0.2, 1, 0.82), 0, 0.5, 0, 0, 0, 0, [1.25, 1, 0.95]), '#EEE6D3', 0.06, seed),
			head: facet(merge([at(box(0.2, 0.2, 0.17), 0, 0, 0), at(box(0.06, 0.04, 0.16), -0.02, 0.06, 0.12), at(box(0.06, 0.04, 0.16), -0.02, 0.06, -0.12)]), '#3B2B21', 0.06, seed + 1),
			leg: facet(new THREE.CylinderGeometry(0.035, 0.03, 0.34, 5), '#3B2B21', 0.05, seed + 2),
		}),
		[seed],
	);
	const sw = Math.sin(phase * Math.PI * 2) * 0.6 * run;
	const bob = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.05 * run;
	return (
		<group position={p.position} rotation={p.rotation} scale={p.scale}>
			<group position={[0, bob, 0]}>
				{mesh(body, {})}
				{mesh(head, {position: [0.46, 0.62 - run * 0.06, 0], rotation: [0, 0, -0.2 - run * 0.2]})}
			</group>
			{[
				[0.22, 0.12, 1],
				[0.22, -0.12, -1],
				[-0.22, 0.12, -1],
				[-0.22, -0.12, 1],
			].map(([x, z, s], i) => (
				<group key={i} position={[x, 0.36, z]} rotation={[0, 0, sw * s]}>
					{mesh(leg, {position: [0, -0.17, 0]})}
				</group>
			))}
		</group>
	);
};

export const Ox: React.FC<GP & {seed?: number; run?: number; phase?: number}> = ({seed = 1, run = 0, phase = 0, ...p}) => {
	const {body, head, horns, leg, tail} = useMemo(
		() => ({
			body: facet(merge([at(box(1.3, 0.72, 0.62, 0.12), 0, 0.98, 0), at(box(0.42, 0.3, 0.5, 0.08), 0.36, 1.32, 0)]), '#7A4B2C', 0.06, seed),
			head: facet(merge([at(box(0.36, 0.36, 0.34, 0.06), 0, 0, 0), at(box(0.2, 0.2, 0.26, 0.04), 0.2, -0.1, 0)]), '#6A3F25', 0.06, seed + 1),
			horns: facet(merge([at(new THREE.ConeGeometry(0.05, 0.3, 5), 0, 0.22, 0.2, 0, 0.7, 0), at(new THREE.ConeGeometry(0.05, 0.3, 5), 0, 0.22, -0.2, 0, -0.7, 0)]), '#E8DCC0', 0.05, seed + 2),
			leg: facet(new THREE.CylinderGeometry(0.075, 0.06, 0.66, 6), '#5E3820', 0.05, seed + 3),
			tail: facet(at(new THREE.CylinderGeometry(0.02, 0.03, 0.6, 4), 0, -0.3, 0), '#5E3820', 0.05, seed + 4),
		}),
		[seed],
	);
	const sw = Math.sin(phase * Math.PI * 2) * 0.5 * run;
	const bob = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.06 * run;
	return (
		<group position={p.position} rotation={p.rotation} scale={p.scale}>
			<group position={[0, bob, 0]}>
				{mesh(body, {})}
				<group position={[0.8, 1.05 - run * 0.1, 0]} rotation={[0, 0, -0.25 - run * 0.15]}>
					{mesh(head, {})}
					{mesh(horns, {})}
				</group>
				<group position={[-0.66, 1.2, 0]} rotation={[0, 0, 0.3 + sw * 0.4]}>
					{mesh(tail, {})}
				</group>
			</group>
			{[
				[0.45, 0.2, 1],
				[0.45, -0.2, -1],
				[-0.45, 0.2, -1],
				[-0.45, -0.2, 1],
			].map(([x, z, s], i) => (
				<group key={i} position={[x, 0.66, z]} rotation={[0, 0, sw * s]}>
					{mesh(leg, {position: [0, -0.33, 0]})}
				</group>
			))}
		</group>
	);
};

const wingShape = () => {
	const s = new THREE.Shape();
	s.moveTo(0, 0);
	s.lineTo(-0.06, 0.28);
	s.lineTo(-0.16, 0.34);
	s.lineTo(-0.2, 0.18);
	s.lineTo(-0.12, 0.0);
	s.closePath();
	return s;
};
// flap: 0..1 cycle position; bank: roll in radians
export const Dove: React.FC<GP & {flap?: number; bank?: number; sitting?: boolean}> = ({flap = 0, bank = 0, sitting = false, ...p}) => {
	const {body, head, beak, wing, tail} = useMemo(() => {
		const wing = new THREE.ShapeGeometry(wingShape());
		return {
			body: facet(at(blob(0.08, 3, 0.1, 1, 0.8), 0, 0, 0, 0, 0, 0, [1.7, 1, 1]), '#F5F2EA', 0.04, 5),
			head: facet(at(blob(0.05, 4, 0.08, 1), 0.13, 0.05, 0), '#F2EFE6', 0.04, 6),
			beak: facet(at(new THREE.ConeGeometry(0.015, 0.05, 4), 0.19, 0.045, 0, 0, 0, -Math.PI / 2), '#D98A3A', 0.04, 7),
			wing: facet(wing, '#ECE8DE', 0.05, 8),
			tail: facet(at(new THREE.ConeGeometry(0.05, 0.14, 3), -0.17, 0.0, 0, 0, 0, Math.PI / 2, [1, 1, 0.3]), '#DCD7CC', 0.05, 9),
		};
	}, []);
	const a = sitting ? 0.1 : Math.sin(flap * Math.PI * 2) * 1.05;
	const wmat = useMemo(() => lambert('wing', {side: THREE.DoubleSide}), []);
	return (
		<group position={p.position} rotation={p.rotation} scale={p.scale}>
			<group rotation={[bank, 0, 0]}>
				{mesh(body, {})}
				{mesh(head, {})}
				{mesh(beak, {})}
				{mesh(tail, {})}
				<group position={[0.02, 0.03, 0.04]} rotation={[-Math.PI / 2 + (sitting ? 1.35 : a), 0, 0]}>{mesh(wing, {}, wmat)}</group>
				<group position={[0.02, 0.03, -0.04]} rotation={[Math.PI / 2 - (sitting ? 1.35 : a), 0, 0]} scale={[1, -1, 1]}>
					{mesh(wing, {}, wmat)}
				</group>
			</group>
		</group>
	);
};

// ---------- coins: instanced, metallic Phong so the sun glints on them ----------
export type CoinXf = {p: Vec3; r: Vec3; s?: number; bronze?: boolean};
export const Coins: React.FC<{coins: CoinXf[]; size?: number; glint?: THREE.Vector3}> = ({coins, size = 1, glint}) => {
	const {geo, mat, inst} = useMemo(() => {
		const geo = new THREE.CylinderGeometry(0.024 * size, 0.024 * size, 0.005 * size, 12);
		const mat = new THREE.MeshPhongMaterial({color: '#ffffff', shininess: 140, specular: '#FFF4D6', emissive: '#3A2A10', flatShading: true});
		const inst = new THREE.InstancedMesh(geo, mat, Math.max(coins.length, 1));
		inst.castShadow = true;
		inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		return {geo, mat, inst};
	}, [coins.length, size]);
	useLayoutEffect(() => () => {
		geo.dispose();
		mat.dispose();
		inst.dispose();
	}, [geo, mat, inst]);
	useLayoutEffect(() => {
		const m = new THREE.Matrix4();
		const q = new THREE.Quaternion();
		const c = new THREE.Color();
		coins.forEach((k, i) => {
			q.setFromEuler(new THREE.Euler(...k.r));
			m.compose(new THREE.Vector3(...k.p), q, new THREE.Vector3(k.s ?? 1, k.s ?? 1, k.s ?? 1));
			inst.setMatrixAt(i, m);
			c.set(k.bronze ? '#D9934A' : '#E9E2D0');
			if (glint) {
				const n = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
				const g = Math.pow(Math.abs(n.dot(glint)), 24);
				c.multiplyScalar(1 + 5 * g);
			}
			inst.setColorAt(i, c);
		});
		inst.count = coins.length;
		inst.instanceMatrix.needsUpdate = true;
		if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
	});
	return <primitive object={inst} />;
};
