// The town: colourful 2-storey houses, picket fences, lamp posts, string lights,
// a bucket at every front door, and a clock tower at the end of the street.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {plastic, rbox, box, cyl, sphere, cone, glowMat, custom, plane, circle} from '../lib/materials';
import {sidingTex, asphaltTex, noiseTex, clockTex} from '../lib/textures';
import {hash, pick} from '../lib/random';
import {Bucket} from '../props/Bucket';
import {RoundTree, Bush} from './Nature';
import {V3} from '../lib/anim';

export const WALLS = ['#ff9fb0', '#86ccff', '#ffd66e', '#a3e69a', '#c9adff', '#ffb98a', '#66d6c9', '#f5f2ea', '#ff8f7a', '#9fb4ff'];
export const ROOFS = ['#353a68', '#2c3648', '#b84848', '#356b8c', '#5b4a7e', '#3f5d3a', '#7a3b52'];
export const DOORS = ['#e63946', '#2a6fdb', '#1f9d8f', '#ffb703', '#8338ec', '#ff6b35'];

export type Lighting = 'day' | 'night' | 'gold';

export type HouseSpec = {wall: string; roof: string; door: string; shutters: string; seed: number; chimney?: boolean; wide?: boolean};

export const houseSpec = (seed: number): HouseSpec => ({
	wall: pick(WALLS, seed, 1),
	roof: pick(ROOFS, seed, 2),
	door: pick(DOORS, seed, 3),
	shutters: pick(['#2d3a5c', '#ffffff', '#3d5a3d', '#7a3b52', '#2b2b2b'], seed, 4),
	seed,
	chimney: hash(seed, 5) > 0.35,
	wide: hash(seed, 6) > 0.6,
});

// ------------------------------------------------------------------ geometry helpers
function prismGeometry(w: number, h: number, d: number) {
	return custom(`prism|${w}|${h}|${d}`, () => {
		const s = new THREE.Shape();
		s.moveTo(-w / 2, 0);
		s.lineTo(w / 2, 0);
		s.lineTo(0, h);
		s.lineTo(-w / 2, 0);
		const g = new THREE.ExtrudeGeometry(s, {depth: d, bevelEnabled: false});
		g.translate(0, 0, -d / 2);
		return g;
	});
}

/** pickets + rails merged into one geometry, along +x from 0..length */
export function fenceGeometry(length: number, height = 1.55) {
	return custom(`fence|${length}|${height}`, () => {
		const parts: THREE.BufferGeometry[] = [];
		const n = Math.max(2, Math.round(length / 0.55));
		for (let i = 0; i <= n; i++) {
			const x = (i / n) * length;
			const p = new THREE.BoxGeometry(0.3, height - 0.25, 0.1).toNonIndexed();
			p.translate(x, (height - 0.25) / 2, 0);
			parts.push(p);
			const tip = new THREE.ConeGeometry(0.21, 0.3, 4).toNonIndexed();
			tip.rotateY(Math.PI / 4);
			tip.scale(1, 1, 0.35);
			tip.translate(x, height - 0.1, 0);
			parts.push(tip);
		}
		for (const y of [0.45, 1.05]) {
			const r = new THREE.BoxGeometry(length, 0.16, 0.08).toNonIndexed();
			r.translate(length / 2, y, -0.08);
			parts.push(r);
		}
		const g = mergeGeometries(parts)!;
		g.computeVertexNormals();
		return g;
	});
}

export const PicketFence: React.FC<{from: V3; length: number; rotation?: number; color?: string}> = ({from, length, rotation = 0, color = '#fbfbfb'}) => (
	<mesh geometry={fenceGeometry(length)} material={plastic(color, {rough: 0.5})} position={from} rotation={[0, rotation, 0]} castShadow receiveShadow />
);

// ------------------------------------------------------------------ window & door
export const Window: React.FC<{p: V3; w?: number; h?: number; lit: Lighting; seed: number; shutters: string; gold?: number}> = ({p, w = 2.0, h = 2.5, lit, seed, shutters}) => {
	const trim = plastic('#ffffff', {rough: 0.45});
	const on = lit === 'gold' ? true : lit === 'night' ? hash(seed, 77) > 0.18 : false;
	const glass =
		lit === 'gold'
			? glowMat('#ffbf2e', 3.2)
			: on
				? glowMat(hash(seed, 78) > 0.5 ? '#ffd27a' : '#ffc061', 2.1)
				: lit === 'night'
					? plastic('#1a2350', {rough: 0.3})
					: plastic('#9fd6ff', {rough: 0.12, metal: 0.1, envInt: 1.4});
	return (
		<group position={p}>
			<mesh geometry={rbox(w + 0.36, h + 0.36, 0.3, 0.06)} material={trim} castShadow receiveShadow />
			<mesh geometry={plane(w, h)} material={glass} position={[0, 0, 0.16]} />
			<mesh geometry={box(0.12, h, 0.08)} material={trim} position={[0, 0, 0.2]} />
			<mesh geometry={box(w, 0.12, 0.08)} material={trim} position={[0, 0, 0.2]} />
			<mesh geometry={rbox(w + 0.6, 0.18, 0.5, 0.04)} material={trim} position={[0, -h / 2 - 0.2, 0.15]} castShadow />
			{shutters !== '#ffffff' ? (
				<>
					<mesh geometry={rbox(0.55, h + 0.2, 0.12, 0.04)} material={plastic(shutters, {rough: 0.5})} position={[-w / 2 - 0.55, 0, 0.05]} castShadow />
					<mesh geometry={rbox(0.55, h + 0.2, 0.12, 0.04)} material={plastic(shutters, {rough: 0.5})} position={[w / 2 + 0.55, 0, 0.05]} castShadow />
				</>
			) : null}
		</group>
	);
};

export const Door: React.FC<{color: string; open?: number; lit: Lighting}> = ({color, open = 0, lit}) => {
	const trim = plastic('#ffffff', {rough: 0.45});
	return (
		<group>
			<mesh geometry={rbox(2.7, 4.6, 0.3, 0.06)} material={trim} position={[0, 2.3, 0]} castShadow receiveShadow />
			{/* dark interior / warm light behind the door */}
			<mesh geometry={plane(2.1, 4.1)} material={lit === 'day' ? plastic('#3a2a2a', {rough: 0.9}) : glowMat('#ffb85a', 1.4)} position={[0, 2.1, 0.12]} />
			<group position={[-1.05, 0, 0.2]} rotation={[0, -open * 1.9, 0]}>
				<mesh geometry={rbox(2.1, 4.1, 0.18, 0.05)} material={plastic(color, {rough: 0.4})} position={[1.05, 2.1, 0]} castShadow receiveShadow />
				<mesh geometry={rbox(1.2, 0.8, 0.05, 0.03)} material={lit === 'day' ? plastic('#bfe6ff', {rough: 0.1}) : glowMat('#ffd27a', 1.6)} position={[1.05, 3.3, 0.1]} />
				<mesh geometry={rbox(1.4, 1.2, 0.05, 0.04)} material={plastic(new THREE.Color(color).multiplyScalar(0.85).getStyle(), {rough: 0.4})} position={[1.05, 1.4, 0.1]} />
				<mesh geometry={sphere(0.12, 10, 8)} material={plastic('#ffcf3a', {metal: 0.9, rough: 0.25})} position={[1.75, 2.1, 0.18]} />
			</group>
		</group>
	);
};

// ------------------------------------------------------------------ house
export const House: React.FC<{spec: HouseSpec; position?: V3; rotation?: number; lit?: Lighting; doorOpen?: number; bucket?: boolean; fence?: boolean; detail?: 'high' | 'low'}> = ({
	spec,
	position,
	rotation = 0,
	lit = 'day',
	doorOpen = 0,
	bucket = true,
	fence = true,
	detail = 'high',
}) => {
	const W = spec.wide ? 12 : 10;
	const D = 8;
	const H = 11;
	const roofH = 4.2;
	const over = 0.7;
	const wallTex = sidingTex(spec.wall, [1, 1], 18);
	const wallM = plastic('#ffffff', {map: wallTex, rough: 0.55});
	const trim = plastic('#ffffff', {rough: 0.45});
	const roofM = plastic(spec.roof, {rough: 0.6});
	const slope = Math.atan2(roofH, D / 2 + over);
	const slopeLen = Math.hypot(D / 2 + over, roofH);
	const winX = W / 2 - 2.2;
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			{/* walls */}
			<mesh geometry={box(W, H, D)} material={wallM} position={[0, H / 2, 0]} castShadow receiveShadow />
			<mesh geometry={prismGeometry(W, roofH, D)} material={plastic(spec.wall, {rough: 0.55})} position={[0, H, 0]} rotation={[0, Math.PI / 2, 0]} scale={[D / W, 1, W / D]} castShadow receiveShadow />
			{/* roof planes */}
			{[-1, 1].map((sd) => (
				<mesh
					key={sd}
					geometry={rbox(W + over * 2, 0.4, slopeLen, 0.08)}
					material={roofM}
					position={[0, H + roofH / 2 + 0.1, (sd * (D / 2 + over)) / 2]}
					rotation={[sd * slope, 0, 0]}
					castShadow
					receiveShadow
				/>
			))}
			<mesh geometry={rbox(W + over * 2 + 0.1, 0.35, 0.5, 0.1)} material={plastic(new THREE.Color(spec.roof).multiplyScalar(0.8).getStyle())} position={[0, H + roofH + 0.15, 0]} castShadow />
			{/* trim: corners, floor band, base */}
			{[-1, 1].map((sd) => (
				<mesh key={'c' + sd} geometry={box(0.5, H, 0.5)} material={trim} position={[sd * (W / 2), H / 2, D / 2]} castShadow />
			))}
			<mesh geometry={box(W + 0.3, 0.35, D + 0.3)} material={trim} position={[0, H / 2, 0]} />
			<mesh geometry={box(W + 0.3, 0.6, D + 0.3)} material={plastic('#d9d4cc', {rough: 0.8})} position={[0, 0.3, 0]} receiveShadow />
			{/* windows */}
			<Window p={[-winX, 8.4, D / 2 + 0.05]} lit={lit} seed={spec.seed * 10 + 1} shutters={spec.shutters} />
			<Window p={[winX, 8.4, D / 2 + 0.05]} lit={lit} seed={spec.seed * 10 + 2} shutters={spec.shutters} />
			<Window p={[-winX, 3.1, D / 2 + 0.05]} lit={lit} seed={spec.seed * 10 + 3} shutters={spec.shutters} />
			<Window p={[winX, 3.1, D / 2 + 0.05]} lit={lit} seed={spec.seed * 10 + 4} shutters={spec.shutters} />
			{detail === 'high' ? (
				<>
					<Window p={[0, 8.4, D / 2 + 0.05]} w={1.3} h={1.8} lit={lit} seed={spec.seed * 10 + 5} shutters={'#ffffff'} />
					<Window p={[W / 2 + 0.05, 8.4, 0]} w={1.8} h={2.2} lit={lit} seed={spec.seed * 10 + 6} shutters={'#ffffff'} />
				</>
			) : null}
			{/* door + porch */}
			<group position={[0, 0.5, D / 2 + 0.02]}>
				<Door color={spec.door} open={doorOpen} lit={lit} />
			</group>
			<mesh geometry={rbox(3.8, 0.5, 1.8, 0.08)} material={plastic('#d9d4cc', {rough: 0.8})} position={[0, 0.25, D / 2 + 0.9]} castShadow receiveShadow />
			<mesh geometry={rbox(4.6, 0.3, 2.6, 0.08)} material={roofM} position={[0, 5.55, D / 2 + 1.2]} rotation={[0.12, 0, 0]} castShadow />
			{[-1, 1].map((sd) => (
				<mesh key={'post' + sd} geometry={cyl(0.12, 0.12, 5.1, 10)} material={trim} position={[sd * 2.0, 2.95, D / 2 + 2.25]} castShadow />
			))}
			{spec.chimney ? <mesh geometry={rbox(1.3, 4.0, 1.3, 0.08)} material={plastic('#b5543c', {rough: 0.8})} position={[W / 2 - 2.0, H + roofH - 0.3, -1.4]} castShadow /> : null}
			{bucket ? <Bucket position={[2.6, 0.5, D / 2 + 1.1]} rotation={[0, hash(spec.seed, 9) * 2, 0]} handle={1.1} /> : null}
			{/* front lawn + fence */}
			{fence ? (
				<>
					<PicketFence from={[-W / 2 - 1.2, 0, D / 2 + 6.5]} length={W / 2 - 0.6} />
					<PicketFence from={[1.8, 0, D / 2 + 6.5]} length={W / 2 - 0.6} />
				</>
			) : null}
			<mesh geometry={box(2.6, 0.12, 6.4)} material={plastic('#e3ddd2', {rough: 0.85})} position={[0, 0.06, D / 2 + 3.4]} receiveShadow />
			{detail === 'high' ? <Bush position={[-W / 2 + 1.3, 0, D / 2 + 1.0]} scale={0.9} /> : null}
		</group>
	);
};

// ------------------------------------------------------------------ street furniture
export const LampPost: React.FC<{position?: V3; lit?: Lighting; light?: boolean}> = ({position, lit = 'day', light = false}) => {
	const pole = plastic('#2d3142', {rough: 0.4, metal: 0.3});
	const on = lit !== 'day';
	return (
		<group position={position}>
			<mesh geometry={cyl(0.35, 0.45, 0.6, 12)} material={pole} position={[0, 0.3, 0]} castShadow />
			<mesh geometry={cyl(0.11, 0.15, 6.2, 10)} material={pole} position={[0, 3.6, 0]} castShadow />
			<mesh geometry={rbox(0.9, 1.0, 0.9, 0.08)} material={on ? glowMat('#ffd88a', 2.6) : plastic('#fff6dc', {rough: 0.2, emissive: '#fff1c8', emissiveIntensity: 0.2})} position={[0, 7.1, 0]} />
			<mesh geometry={cone(0.75, 0.55, 4)} material={pole} position={[0, 7.85, 0]} rotation={[0, Math.PI / 4, 0]} castShadow />
			<mesh geometry={rbox(1.0, 0.14, 1.0, 0.04)} material={pole} position={[0, 6.55, 0]} />
			{on && light ? <pointLight position={[0, 6.6, 0]} color="#ffcf80" intensity={18} distance={16} decay={1.6} /> : null}
		</group>
	);
};

const BULB_COLS = ['#fff3c4', '#ff8fc7', '#ffd166', '#8fd3ff', '#fff3c4', '#ff9e6b'];
export const StringLights: React.FC<{a: V3; b: V3; sag?: number; n?: number; lit?: Lighting; seed?: number}> = ({a, b, sag = 1.4, n = 18, lit = 'night', seed = 0}) => {
	const key = `${a.join(',')}|${b.join(',')}|${sag}`;
	const {wire, pts} = useMemo(() => {
		const pts: THREE.Vector3[] = [];
		for (let i = 0; i <= 24; i++) {
			const t = i / 24;
			pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t));
		}
		const curve = new THREE.CatmullRomCurve3(pts);
		const wire = custom('wire|' + key, () => new THREE.TubeGeometry(curve, 32, 0.03, 4, false));
		const bulbs: V3[] = [];
		for (let i = 1; i < n; i++) {
			const p = curve.getPoint(i / n);
			bulbs.push([p.x, p.y - 0.18, p.z]);
		}
		return {wire, pts: bulbs};
	}, [key, n]);
	return (
		<group>
			<mesh geometry={wire} material={plastic('#1d1d24', {rough: 0.6})} />
			{pts.map((p, i) => (
				<mesh key={i} geometry={sphere(0.17, 10, 8)} material={lit === 'day' ? plastic(BULB_COLS[(i + seed) % BULB_COLS.length], {rough: 0.2}) : glowMat(BULB_COLS[(i + seed) % BULB_COLS.length], 3.2)} position={p} />
			))}
		</group>
	);
};

// ------------------------------------------------------------------ clock tower
export const ClockTower: React.FC<{position?: V3; rotation?: number; hour?: number; minute?: number; lit?: Lighting}> = ({position, rotation = 0, hour = 6, minute = 0, lit = 'day'}) => {
	const wall = plastic('#ece2cf', {rough: 0.7, map: noiseTex('#ece2cf', 0.06, 41, [2, 6])});
	const trim = plastic('#b9614a', {rough: 0.6});
	const roof = plastic('#c0392b', {rough: 0.5});
	const ha = -((hour % 12) + minute / 60) * (Math.PI / 6);
	const ma = -(minute / 60) * Math.PI * 2;
	const faceMat = useMemo(() => new THREE.MeshStandardMaterial({map: clockTex(), roughness: 0.5, emissive: new THREE.Color(lit === 'day' ? '#000000' : '#ffe9b0'), emissiveIntensity: lit === 'day' ? 0 : 0.6, emissiveMap: clockTex()}), [lit]);
	return (
		<group position={position} rotation={[0, rotation, 0]}>
			<mesh geometry={rbox(8, 26, 8, 0.2)} material={wall} position={[0, 13, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(9, 1.2, 9, 0.2)} material={trim} position={[0, 0.6, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(9, 0.8, 9, 0.2)} material={trim} position={[0, 18.5, 0]} castShadow />
			<mesh geometry={rbox(9.4, 9, 9.4, 0.3)} material={wall} position={[0, 23, 0]} castShadow receiveShadow />
			<mesh geometry={rbox(10, 0.9, 10, 0.2)} material={trim} position={[0, 27.8, 0]} castShadow />
			<mesh geometry={cone(7.8, 8, 4)} material={roof} position={[0, 32.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow />
			<mesh geometry={sphere(0.6, 12, 8)} material={plastic('#ffcf3a', {metal: 0.9, rough: 0.25})} position={[0, 36.4, 0]} />
			{/* clock face (front) */}
			<group position={[0, 23, 4.75]}>
				<mesh geometry={cyl(3.6, 3.6, 0.4, 40)} material={trim} rotation={[Math.PI / 2, 0, 0]} castShadow />
				<mesh geometry={circle(3.25, 48)} material={faceMat} position={[0, 0, 0.22]} />
				<group position={[0, 0, 0.32]} rotation={[0, 0, ha]}>
					<mesh geometry={rbox(0.32, 2.0, 0.1, 0.05)} material={plastic('#1d1d24')} position={[0, 0.85, 0]} />
				</group>
				<group position={[0, 0, 0.38]} rotation={[0, 0, ma]}>
					<mesh geometry={rbox(0.22, 2.9, 0.1, 0.05)} material={plastic('#1d1d24')} position={[0, 1.3, 0]} />
				</group>
				<mesh geometry={cyl(0.26, 0.26, 0.2, 16)} material={plastic('#e63946', {rough: 0.3})} position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]} />
			</group>
			{/* door + windows on the tower */}
			<mesh geometry={rbox(2.8, 4.6, 0.3, 0.1)} material={plastic('#7a4a2a')} position={[0, 2.3, 4.05]} />
			{[8, 13].map((y) => (
				<mesh key={y} geometry={rbox(1.4, 2.6, 0.3, 0.2)} material={lit === 'day' ? plastic('#7fb8e6', {rough: 0.15}) : glowMat('#ffd27a', 2)} position={[0, y, 4.05]} />
			))}
		</group>
	);
};

// ------------------------------------------------------------------ street
export const Street: React.FC<{from?: number; to?: number; lit?: Lighting}> = ({from = 60, to = -160, lit = 'day'}) => {
	const len = from - to;
	const cz = (from + to) / 2;
	const grass = plastic('#ffffff', {rough: 0.9, map: noiseTex(lit === 'day' ? '#79cf5f' : '#3f7a4a', 0.1, 3, [12, len / 8])});
	const road = plastic('#ffffff', {rough: 0.85, map: asphaltTex([3, len / 6])});
	const walk = plastic(lit === 'day' ? '#e7e3dc' : '#b9b8c9', {rough: 0.85});
	const dashes = useMemo(() => {
		const out: number[] = [];
		for (let z = from; z > to; z -= 6) out.push(z);
		return out;
	}, [from, to]);
	return (
		<group>
			<mesh geometry={plane(140, len)} material={grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, cz]} receiveShadow />
			<mesh geometry={plane(11, len)} material={road} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, cz]} receiveShadow />
			{[-1, 1].map((sd) => (
				<group key={sd}>
					<mesh geometry={box(3.4, 0.3, len)} material={walk} position={[sd * 7.2, 0.15, cz]} receiveShadow />
					<mesh geometry={box(0.3, 0.32, len)} material={plastic('#cfcac2')} position={[sd * 5.55, 0.16, cz]} receiveShadow />
				</group>
			))}
			{dashes.map((z) => (
				<mesh key={z} geometry={box(0.28, 0.02, 2.8)} material={plastic('#ffd23f', {rough: 0.6})} position={[0, 0.03, z]} receiveShadow />
			))}
		</group>
	);
};

/** A full street of houses on both sides (houses face the road). */
export const TownStreet: React.FC<{lit?: Lighting; zFrom?: number; zTo?: number; doorOpen?: (i: number) => number; skip?: number[]; lights?: boolean; seedBase?: number; trees?: boolean}> = ({
	lit = 'day',
	zFrom = 40,
	zTo = -120,
	doorOpen,
	skip = [],
	lights = false,
	seedBase = 0,
	trees = true,
}) => {
	const items: React.ReactNode[] = [];
	let i = 0;
	for (let z = zFrom; z > zTo; z -= 15) {
		for (const sd of [-1, 1]) {
			const idx = i++;
			if (skip.includes(idx)) continue;
			const spec = houseSpec(idx + 3 + seedBase);
			items.push(
				<House key={'h' + idx} spec={spec} position={[sd * 19, 0, z]} rotation={sd < 0 ? Math.PI / 2 : -Math.PI / 2} lit={lit} doorOpen={doorOpen ? doorOpen(idx) : 0} detail={Math.abs(z) > 70 ? 'low' : 'high'} />,
			);
			if (trees && hash(idx, 13) > 0.45) items.push(<RoundTree key={'t' + idx} position={[sd * 11.5, 0, z - 7.5]} seed={idx} scale={0.9 + hash(idx, 14) * 0.3} />);
		}
		items.push(<LampPost key={'l' + z} position={[-6.3, 0, z - 4]} lit={lit} />);
		items.push(<LampPost key={'r' + z} position={[6.3, 0, z - 11]} lit={lit} />);
		if (lights && lit !== 'day') items.push(<StringLights key={'s' + z} a={[-6.3, 7.5, z - 4]} b={[6.3, 7.5, z - 11]} lit={lit} seed={Math.abs(z) % 5} />);
	}
	return (
		<group>
			<Street from={zFrom + 20} to={zTo - 40} lit={lit} />
			{items}
		</group>
	);
};
