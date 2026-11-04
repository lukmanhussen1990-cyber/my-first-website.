// Cakes and candles, all from simple shapes: the perfect tall white cake with 90 little candles,
// the burnt one, the flat one, the one that exploded, and the first slice.
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {plastic, rbox, cyl, sphere, torus, glowMat, custom} from '../../lib/materials';
import {GlowPoints} from '../../props/Effects';
import {hash, fbm1} from '../../lib/random';
import {V3, clamp, easeOut} from '../../lib/anim';

const FROST = '#fffaf3';
const CANDLE_COLS = ['#ffb3c7', '#a8d8ff', '#fff0a0', '#b8f0c8', '#d9c2ff', '#ffffff', '#ffc9a0'];

// ------------------------------------------------------------------ candles
export type CandleState = {
	/** frame each candle goes out (Infinity = stays lit) */
	outAt?: number[];
	/** frame each candle lights up (default: always lit) */
	litAt?: number[];
	/** wind pushing the flames: [x, z] lean in radians */
	wind?: [number, number];
};

/** a set of small candles with flickering flames and smoke curls when they go out */
export const Candles: React.FC<{positions: V3[]; frame: number; state?: CandleState; height?: number; radius?: number; seed?: number; light?: boolean; lightPos?: V3; flameSize?: number}> = ({
	positions,
	frame,
	state = {},
	height = 0.38,
	radius = 0.04,
	seed = 3,
	light = true,
	lightPos,
	flameSize = 1,
}) => {
	const n = positions.length;
	const bodyRef = useRef<THREE.InstancedMesh>(null);
	const flameRef = useRef<THREE.InstancedMesh>(null);
	const coreRef = useRef<THREE.InstancedMesh>(null);
	const wickRef = useRef<THREE.InstancedMesh>(null);
	const geo = useMemo(
		() => ({
			body: new THREE.CylinderGeometry(radius, radius, height, 10),
			wick: new THREE.CylinderGeometry(0.008, 0.008, 0.05, 4),
			flame: (() => {
				// tear-drop flame: sphere stretched upward, pointy top
				const g = new THREE.SphereGeometry(1, 14, 10);
				const p = g.attributes.position as THREE.BufferAttribute;
				for (let i = 0; i < p.count; i++) {
					const y = p.getY(i);
					const k = y > 0 ? 1 - y * 0.75 : 1;
					p.setXYZ(i, p.getX(i) * k, y > 0 ? y * 2.2 : y * 0.9, p.getZ(i) * k);
				}
				g.computeVertexNormals();
				return g;
			})(),
		}),
		[radius, height],
	);
	const mats = useMemo(
		() => ({
			body: new THREE.MeshStandardMaterial({roughness: 0.55}),
			wick: plastic('#2a2018', {rough: 0.9}),
			flame: glowMat('#ff9a2e', 3.2, {transparent: true, opacity: 0.92, depthWrite: false}),
			core: glowMat('#fff1c2', 4.5),
		}),
		[],
	);
	const dummy = useMemo(() => new THREE.Object3D(), []);
	const col = useMemo(() => new THREE.Color(), []);
	const t = frame / 30;
	const wind = state.wind ?? [0, 0];
	let litCount = 0;
	const smoke: {p: V3; age: number; i: number}[] = [];
	const flameScale: number[] = [];
	for (let i = 0; i < n; i++) {
		const out = state.outAt?.[i] ?? Infinity;
		const on = state.litAt?.[i] ?? -Infinity;
		let s = 1;
		if (frame < on) s = 0;
		else if (frame < on + 6) s = easeOut((frame - on) / 6);
		if (frame >= out) s = Math.max(0, 1 - (frame - out) / 3);
		const fl = 0.85 + 0.15 * fbm1(t * 6 + i * 1.7, seed + i);
		flameScale.push(s * fl);
		if (s > 0.05) litCount++;
		if (frame >= out && frame - out < 75) smoke.push({p: positions[i], age: frame - out, i});
	}
	useLayoutEffect(() => {
		for (let i = 0; i < n; i++) {
			const [x, y, z] = positions[i];
			dummy.position.set(x, y + height / 2, z);
			dummy.rotation.set(0, 0, 0);
			dummy.scale.set(1, 1, 1);
			dummy.updateMatrix();
			bodyRef.current?.setMatrixAt(i, dummy.matrix);
			bodyRef.current?.setColorAt(i, col.set(CANDLE_COLS[Math.floor(hash(i, seed) * CANDLE_COLS.length)]));
			dummy.position.set(x, y + height + 0.025, z);
			dummy.updateMatrix();
			wickRef.current?.setMatrixAt(i, dummy.matrix);
			const s = flameScale[i];
			const sway = fbm1(t * 2.3 + i, seed + 40) * 0.12;
			dummy.position.set(x, y + height + 0.06 * flameSize, z);
			dummy.rotation.set(wind[1] + sway * 0.5, 0, -wind[0] + sway);
			const r = 0.034 * s * flameSize;
			dummy.scale.set(Math.max(r, 1e-4), Math.max(r * (1 + Math.abs(wind[0]) * 0.3), 1e-4), Math.max(r, 1e-4));
			dummy.updateMatrix();
			flameRef.current?.setMatrixAt(i, dummy.matrix);
			dummy.scale.set(Math.max(r * 0.45, 1e-4), Math.max(r * 0.5, 1e-4), Math.max(r * 0.45, 1e-4));
			dummy.updateMatrix();
			coreRef.current?.setMatrixAt(i, dummy.matrix);
		}
		for (const m of [bodyRef, wickRef, flameRef, coreRef]) {
			if (!m.current) continue;
			m.current.instanceMatrix.needsUpdate = true;
			if (m.current.instanceColor) m.current.instanceColor.needsUpdate = true;
		}
	});
	const lp = lightPos ?? (() => {
		let cx = 0, cy = 0, cz = 0;
		for (const p of positions) { cx += p[0]; cy += p[1]; cz += p[2]; }
		return [cx / n, cy / n + height + 0.8, cz / n] as V3;
	})();
	const glow = litCount / Math.max(1, n);
	return (
		<group>
			<instancedMesh ref={bodyRef} args={[geo.body, mats.body, n]} castShadow={false} receiveShadow frustumCulled={false} />
			<instancedMesh ref={wickRef} args={[geo.wick, mats.wick, n]} frustumCulled={false} />
			<instancedMesh ref={flameRef} args={[geo.flame, mats.flame, n]} frustumCulled={false} renderOrder={12} />
			<instancedMesh ref={coreRef} args={[geo.flame, mats.core, n]} frustumCulled={false} renderOrder={13} />
			{light && glow > 0.01 ? (
				<pointLight position={lp} color="#ffb565" intensity={(2.5 + 8 * Math.sqrt(glow)) * (0.92 + 0.08 * fbm1(t * 5, 9))} distance={10} decay={1.6} />
			) : null}
			{smoke.length ? (
				<GlowPoints
					count={smoke.length * 10}
					additive={false}
					color="#d9d6d2"
					fn={(k) => {
						const s = smoke[Math.floor(k / 10)];
						const j = k % 10;
						const age = s.age - j * 2.2;
						if (age < 0) return [0, -99, 0, 0, 0];
						const a = age / 30;
						const [x, y, z] = s.p;
						const curl = Math.sin(a * 3.2 + s.i) * 0.08 * (1 + a);
						return [x + curl, y + height + 0.1 + a * 0.75, z + Math.cos(a * 2.6 + s.i) * 0.05 * (1 + a), 0.05 + a * 0.07, Math.max(0, 0.55 - a * 0.22) * (1 - j / 12)];
					}}
				/>
			) : null}
		</group>
	);
};

/** 90 candle spots on the perfect cake (cake space: y = 0 at the stand top) */
export const CAKE = {r1: 1.6, h1: 1.25, r2: 1.15, h2: 1.05};
export function ninetyCandles(): V3[] {
	const out: V3[] = [];
	const top = CAKE.h1 + CAKE.h2;
	const rings: [number, number][] = [
		[0.98, 25],
		[0.72, 19],
		[0.46, 12],
		[0.2, 5],
	];
	rings.forEach(([r, k], ri) => {
		for (let i = 0; i < k; i++) {
			const a = (i / k) * Math.PI * 2 + ri * 0.3;
			out.push([Math.cos(a) * r, top + 0.04, Math.sin(a) * r]);
		}
	});
	const ledge = 29;
	for (let i = 0; i < ledge; i++) {
		const a = (i / ledge) * Math.PI * 2 + 0.05;
		out.push([Math.cos(a) * 1.38, CAKE.h1 + 0.04, Math.sin(a) * 1.38]);
	}
	return out;
}
export const NINETY = ninetyCandles();

// ------------------------------------------------------------------ the perfect cake
const Piping: React.FC<{r: number; y: number; n: number; size?: number; color?: string}> = ({r, y, n, size = 0.085, color = FROST}) => {
	const ref = useRef<THREE.InstancedMesh>(null);
	const geo = useMemo(() => new THREE.SphereGeometry(size, 10, 8), [size]);
	const m = plastic(color, {rough: 0.6});
	useLayoutEffect(() => {
		const d = new THREE.Object3D();
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2;
			d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
			d.scale.set(1, 0.8, 1);
			d.updateMatrix();
			ref.current?.setMatrixAt(i, d.matrix);
		}
		if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
	}, [r, y, n]);
	return <instancedMesh ref={ref} args={[geo, m, n]} castShadow receiveShadow />;
};

const Drips: React.FC<{r: number; y: number; n: number; seed?: number}> = ({r, y, n, seed = 1}) => {
	const m = plastic(FROST, {rough: 0.55});
	return (
		<group>
			{Array.from({length: n}).map((_, i) => {
				const a = (i / n) * Math.PI * 2 + hash(i, seed) * 0.1;
				const len = 0.18 + hash(i, seed + 1) * 0.3;
				return (
					<group key={i} position={[Math.cos(a) * (r + 0.005), y - len / 2, Math.sin(a) * (r + 0.005)]}>
						<mesh geometry={cyl(0.06, 0.06, len, 8)} material={m} />
						<mesh geometry={sphere(0.06, 8, 6)} material={m} position={[0, -len / 2, 0]} />
					</group>
				);
			})}
		</group>
	);
};

export const CakeStand: React.FC<{r?: number; color?: string}> = ({r = 1.95, color = '#f4f1ee'}) => {
	const m = plastic(color, {rough: 0.25, envInt: 1.2});
	return (
		<group>
			<mesh geometry={cyl(r, r, 0.1, 40)} material={m} position={[0, -0.05, 0]} castShadow receiveShadow />
			<mesh geometry={torus(r, 0.05, 8, 48)} material={m} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} />
			<mesh geometry={cyl(0.22, 0.32, 0.55, 20)} material={m} position={[0, -0.37, 0]} castShadow />
			<mesh geometry={cyl(0.75, 0.85, 0.1, 30)} material={m} position={[0, -0.68, 0]} castShadow receiveShadow />
		</group>
	);
};
/** height of the cake stand (its plate top sits this far above the table) */
export const STAND_H = 0.73;

export const PerfectCake: React.FC<{frame: number; candles?: boolean; candleState?: CandleState; stand?: boolean; light?: boolean}> = ({frame, candles = true, candleState, stand = true, light = true}) => {
	const fm = plastic(FROST, {rough: 0.62});
	return (
		<group>
			{stand ? <CakeStand /> : null}
			<mesh geometry={cyl(CAKE.r1, CAKE.r1, CAKE.h1, 48)} material={fm} position={[0, CAKE.h1 / 2, 0]} castShadow receiveShadow />
			<mesh geometry={cyl(CAKE.r2, CAKE.r2, CAKE.h2, 44)} material={fm} position={[0, CAKE.h1 + CAKE.h2 / 2, 0]} castShadow receiveShadow />
			<Piping r={CAKE.r1} y={0.06} n={58} size={0.1} />
			<Piping r={CAKE.r1 - 0.04} y={CAKE.h1 - 0.02} n={54} size={0.08} />
			<Piping r={CAKE.r2} y={CAKE.h1 + 0.06} n={42} size={0.085} />
			<Piping r={CAKE.r2 - 0.03} y={CAKE.h1 + CAKE.h2 - 0.02} n={40} size={0.07} />
			<Drips r={CAKE.r1} y={CAKE.h1 - 0.02} n={26} seed={4} />
			<Drips r={CAKE.r2} y={CAKE.h1 + CAKE.h2 - 0.02} n={20} seed={8} />
			{/* tiny pink sugar pearls around the sides */}
			<Piping r={CAKE.r1 + 0.01} y={CAKE.h1 * 0.45} n={30} size={0.045} color="#ffb0c4" />
			<Piping r={CAKE.r2 + 0.01} y={CAKE.h1 + CAKE.h2 * 0.45} n={24} size={0.04} color="#ffb0c4" />
			{candles ? <Candles positions={NINETY} frame={frame} state={candleState} light={light} /> : null}
		</group>
	);
};

// ------------------------------------------------------------------ the failed cakes
export const BurntCake: React.FC<{frame: number; smoke?: boolean}> = ({frame, smoke = true}) => {
	const t = frame / 30;
	return (
		<group>
			<mesh geometry={cyl(1.25, 1.32, 0.82, 32)} material={plastic('#241812', {rough: 0.95})} position={[0, 0.41, 0]} castShadow receiveShadow />
			<mesh geometry={cyl(1.18, 1.25, 0.12, 32)} material={plastic('#120c09', {rough: 1})} position={[0, 0.86, 0]} />
			{[0, 1, 2, 3, 4].map((i) => (
				<mesh key={i} geometry={rbox(0.5 + hash(i, 3) * 0.4, 0.05, 0.06, 0.02)} material={glowMat('#ff5a1a', Math.round((0.8 + 0.6 * Math.max(0, Math.sin(t * 3 + i))) * 5) / 5)} position={[(hash(i, 4) - 0.5) * 1.4, 0.93, (hash(i, 5) - 0.5) * 1.4]} rotation={[0, hash(i, 6) * 3, 0]} />
			))}
			{smoke ? (
				<GlowPoints
					count={46}
					additive={false}
					color="#4a4440"
					fn={(i) => {
						const ph = (t * 0.32 + hash(i, 7)) % 1;
						const a = hash(i, 8) * Math.PI * 2;
						const r = 0.2 + hash(i, 9) * 0.8 + ph * 0.6;
						return [Math.cos(a) * r + Math.sin(ph * 5 + i) * 0.2, 0.95 + ph * 4.2, Math.sin(a) * r, 0.7 + ph * 1.6, Math.sin(ph * Math.PI) * 0.55];
					}}
				/>
			) : null}
		</group>
	);
};

export const FlatCake: React.FC = () => (
	<group>
		<mesh geometry={cyl(1.38, 1.42, 0.2, 32)} material={plastic('#e3c27e', {rough: 0.8})} position={[0, 0.1, 0]} castShadow receiveShadow />
		<mesh geometry={cyl(1.2, 1.36, 0.04, 32)} material={plastic('#c99e58', {rough: 0.85})} position={[0, 0.21, 0]} />
	</group>
);

/** the third cake: rises like a balloon (k 0..1) and then bursts (burst 0..1) */
export const ExplodingCake: React.FC<{rise: number; burst: number; seed?: number}> = ({rise, burst, seed = 5}) => {
	const dome = useMemo(
		() =>
			custom('cakeDome', () => {
				const pts: THREE.Vector2[] = [];
				for (let i = 0; i <= 16; i++) {
					const a = (i / 16) * (Math.PI / 2);
					pts.push(new THREE.Vector2(Math.cos(a) * 1.3, Math.sin(a) * 1.0));
				}
				return new THREE.LatheGeometry(pts, 32);
			}),
		[],
	);
	const m = plastic('#efcf88', {rough: 0.75});
	if (burst <= 0) {
		const s = 1 + rise * 0.9;
		const wob = Math.sin(rise * 40) * 0.03 * rise;
		return (
			<group>
				<mesh geometry={cyl(1.3, 1.32, 0.5, 32)} material={m} position={[0, 0.25, 0]} castShadow />
				<mesh geometry={dome} material={m} position={[0, 0.5, 0]} scale={[1 + rise * 0.25 + wob, 0.2 + rise * 1.6, 1 + rise * 0.25 - wob]} castShadow />
				{s > 1.6 ? <mesh geometry={sphere(0.1, 8, 6)} material={m} position={[0.3, 0.6 + rise * 1.9, 0.2]} /> : null}
			</group>
		);
	}
	// chunks flying out
	return (
		<group>
			<mesh geometry={cyl(1.3, 1.32, 0.3, 32)} material={plastic('#d8b06a', {rough: 0.8})} position={[0, 0.15, 0]} />
			{Array.from({length: 26}).map((_, i) => {
				const a = hash(i, seed) * Math.PI * 2;
				const up = 2 + hash(i, seed + 1) * 5;
				const out = 2 + hash(i, seed + 2) * 5;
				const tt = burst * 1.2;
				const y = 0.6 + up * tt - 6 * tt * tt;
				return (
					<mesh
						key={i}
						geometry={rbox(0.32, 0.24, 0.3, 0.08)}
						material={m}
						position={[Math.cos(a) * out * tt, Math.max(0.1, y), Math.sin(a) * out * tt]}
						rotation={[tt * 9 + i, tt * 5, tt * 7]}
						castShadow
					/>
				);
			})}
		</group>
	);
};

/** soft flour cloud (normal-blended white puffs). k = 0..1 age */
export const FlourCloud: React.FC<{k: number; position?: V3; size?: number; count?: number; seed?: number; opacity?: number}> = ({k, position, size = 6, count = 90, seed = 2, opacity = 0.85}) => {
	if (k <= 0) return null;
	return (
		<GlowPoints
			count={count}
			additive={false}
			color="#fffdf8"
			position={position}
			fn={(i) => {
				const a = hash(i, seed) * Math.PI * 2;
				const e = (hash(i, seed + 1) - 0.3) * 1.4;
				const sp = 0.4 + hash(i, seed + 2) * 0.8;
				const rr = size * sp * easeOut(clamp(k * 1.6));
				const fall = k * k * 1.2;
				return [Math.cos(a) * rr * Math.cos(e), Math.max(0.2, Math.sin(e) * rr * 0.7 + 1 - fall), Math.sin(a) * rr * Math.cos(e), (1.4 + hash(i, seed + 3) * 2.4) * (0.6 + k), opacity * Math.min(1, k * 8) * (1 - k * 0.55)];
			}}
		/>
	);
};

// ------------------------------------------------------------------ plate + first slice
export const Plate: React.FC<{r?: number}> = ({r = 0.8}) => {
	const m = plastic('#ffffff', {rough: 0.2, envInt: 1.2});
	return (
		<group>
			<mesh geometry={cyl(r * 0.7, r * 0.62, 0.05, 28)} material={m} position={[0, 0.025, 0]} castShadow receiveShadow />
			<mesh geometry={cyl(r, r * 0.72, 0.07, 32, true)} material={plastic('#ffffff', {rough: 0.2, side: THREE.DoubleSide})} position={[0, 0.07, 0]} />
		</group>
	);
};

function sector(key: string, r: number, ang: number, h: number) {
	return custom(`sector|${key}|${r}|${ang}|${h}`, () => {
		const s = new THREE.Shape();
		s.moveTo(0, 0);
		s.absarc(0, 0, r, -ang / 2, ang / 2, false);
		s.lineTo(0, 0);
		const g = new THREE.ExtrudeGeometry(s, {depth: h, bevelEnabled: false, curveSegments: 12});
		g.rotateX(-Math.PI / 2);
		return g;
	});
}

/** one slice of the white cake (sponge, jam, frosting) with a single candle */
export const CakeSlice: React.FC<{frame: number; candle?: boolean; r?: number}> = ({frame, candle = true, r = 0.9}) => {
	const ang = 0.62;
	const sponge = plastic('#f2d38c', {rough: 0.85});
	const jam = plastic('#e4566f', {rough: 0.5});
	const frost = plastic(FROST, {rough: 0.6});
	return (
		<group>
			<mesh geometry={sector('s1', r, ang, 0.3)} material={sponge} position={[0, 0, 0]} castShadow />
			<mesh geometry={sector('j', r, ang, 0.06)} material={jam} position={[0, 0.3, 0]} />
			<mesh geometry={sector('s2', r, ang, 0.28)} material={sponge} position={[0, 0.36, 0]} castShadow />
			<mesh geometry={sector('f', r + 0.02, ang, 0.1)} material={frost} position={[0, 0.64, 0]} castShadow />
			<mesh geometry={custom(`sliceArc|${r}|${ang}`, () => new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.74, 16, 1, true, Math.PI / 2 - ang / 2, ang))} material={frost} position={[0, 0.37, 0]} />
			{candle ? <Candles positions={[[r * 0.55, 0.74, 0]]} frame={frame} light={false} height={0.4} radius={0.045} seed={21} /> : null}
		</group>
	);
};
