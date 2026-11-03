// Out in the wild: Stinky Hill + spooky castle, the bucket pile, the Swamp of Smells, the long road, the forest.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {plastic, rbox, box, cyl, cone, sphere, glowMat, plane, circle, torus} from '../lib/materials';
import {stoneTex, noiseTex} from '../lib/textures';
import {hash, mulberry32} from '../lib/random';
import {Bucket} from '../props/Bucket';
import {StinkCloud} from '../props/StinkCloud';
import {DeadTree, RoundTree, PineTree, Rock, Bush, Cloud} from './Nature';
import {PicketFence} from './Town';
import {V3} from '../lib/anim';

// ------------------------------------------------------------------ castle
export const Castle: React.FC<{position?: V3; scale?: number; rotation?: number; windows?: string}> = ({position, scale = 1, rotation = 0, windows = '#c8ff6a'}) => {
	const stone = plastic('#ffffff', {map: stoneTex('#7a7488', [2, 2], 7, 6), rough: 0.85});
	const stoneDark = plastic('#ffffff', {map: stoneTex('#5f5a6e', [1, 3], 9, 8), rough: 0.85});
	const roof = plastic('#3d2c5c', {rough: 0.6});
	const win = glowMat(windows, 1.6);
	const crenel = (w: number, d: number, y: number, n: number) =>
		Array.from({length: n}).map((_, i) => {
			const a = (i / n) * Math.PI * 2;
			return <mesh key={i} geometry={box(0.9, 0.9, 0.9)} material={stone} position={[Math.cos(a) * w, y, Math.sin(a) * d]} castShadow />;
		});
	const tower = (x: number, z: number, h: number, r: number, key: string) => (
		<group key={key} position={[x, 0, z]}>
			<mesh geometry={cyl(r, r * 1.08, h, 16)} material={stoneDark} position={[0, h / 2, 0]} castShadow receiveShadow />
			<mesh geometry={cyl(r + 0.35, r + 0.35, 0.8, 16)} material={stone} position={[0, h + 0.2, 0]} castShadow />
			{crenel(r + 0.15, r + 0.15, h + 0.95, 10)}
			<mesh geometry={cone(r + 0.6, r * 2.6, 16)} material={roof} position={[0, h + 0.6 + r * 1.3, 0]} castShadow />
			<mesh geometry={rbox(0.8, 1.6, 0.3, 0.2)} material={win} position={[0, h * 0.7, r + 0.05]} />
			<mesh geometry={rbox(0.8, 1.6, 0.3, 0.2)} material={win} position={[0, h * 0.4, r + 0.05]} />
		</group>
	);
	return (
		<group position={position} scale={scale} rotation={[0, rotation, 0]}>
			<mesh geometry={box(14, 10, 10)} material={stone} position={[0, 5, 0]} castShadow receiveShadow />
			{Array.from({length: 7}).map((_, i) => (
				<mesh key={'cf' + i} geometry={box(1.1, 1.0, 1.1)} material={stone} position={[-6 + i * 2, 10.5, 4.6]} castShadow />
			))}
			{/* gate */}
			<mesh geometry={rbox(3.4, 5.0, 0.6, 1.2)} material={plastic('#1b1424', {rough: 0.9})} position={[0, 2.4, 5.0]} />
			<mesh geometry={torus(1.9, 0.35, 8, 20, Math.PI)} material={stoneDark} position={[0, 4.0, 5.1]} castShadow />
			{[-4, 4].map((x) => (
				<mesh key={x} geometry={rbox(1.2, 2.0, 0.4, 0.3)} material={win} position={[x, 6.5, 5.05]} />
			))}
			{tower(-7.5, 4.5, 15, 2.4, 'a')}
			{tower(7.5, 4.5, 13, 2.2, 'b')}
			{tower(0, -3.5, 19, 2.8, 'c')}
			{tower(-6, -5, 11, 1.8, 'd')}
			{/* tattered flag */}
			<mesh geometry={cyl(0.08, 0.08, 4, 6)} material={plastic('#3a3a3a')} position={[0, 27.5, -3.5]} />
			<mesh geometry={rbox(2.6, 1.4, 0.05, 0.02)} material={plastic('#7ad14f', {rough: 0.8})} position={[1.35, 28.6, -3.5]} rotation={[0, 0, -0.08]} />
		</group>
	);
};

// ------------------------------------------------------------------ Stinky Hill
export const HILL = {r: 46, h: 30, rz: 40};
export const hillY = (x: number, z: number) => {
	const d = (x * x) / (HILL.r * HILL.r) + (z * z) / (HILL.rz * HILL.rz);
	return d >= 1 ? 0 : HILL.h * Math.sqrt(1 - d) - 1.5;
};

export const StinkyHill: React.FC<{frame: number; position?: V3; clouds?: boolean; pile?: boolean; sunset?: boolean}> = ({frame, position, clouds = true, pile = true, sunset = false}) => {
	const grass = plastic('#ffffff', {map: noiseTex(sunset ? '#7a9a4a' : '#6fae4a', 0.12, 5, [6, 6], 400), rough: 0.9});
	const path = useMemo(() => {
		const out: {p: V3; r: number}[] = [];
		for (let i = 0; i < 44; i++) {
			const t = i / 43;
			const ang = 1.6 + t * Math.PI * 2.1;
			const rr = (1 - t * 0.82) * 0.92;
			const x = Math.cos(ang) * HILL.r * rr;
			const z = Math.sin(ang) * HILL.rz * rr;
			out.push({p: [x, hillY(x, z) + 0.15, z], r: ang});
		}
		return out;
	}, []);
	return (
		<group position={position}>
			<mesh geometry={sphere(1, 48, 24)} material={grass} position={[0, -1.5, 0]} scale={[HILL.r, HILL.h, HILL.rz]} receiveShadow castShadow />
			{path.map((s, i) => (
				<mesh key={i} geometry={rbox(2.4, 0.3, 1.6, 0.12)} material={plastic('#a07a52', {rough: 0.9})} position={s.p} rotation={[0, -s.r, 0]} receiveShadow />
			))}
			<Castle position={[0, HILL.h - 2.5, -4]} scale={1.0} />
			{[[-30, 18], [26, 22], [-18, 30], [34, -6], [-38, 4], [12, 34]].map(([x, z], i) => (
				<DeadTree key={i} position={[x, hillY(x, z) - 0.3, z]} scale={1.3 + hash(i, 3) * 0.6} seed={i + 4} />
			))}
			{clouds
				? [[0, 42, -2], [-9, 38, 3], [10, 40, -6], [-4, 47, -10], [7, 46, 2]].map(([x, y, z], i) => (
						<StinkCloud key={i} frame={frame} position={[x, y, z]} scale={2.6 + hash(i, 9)} seed={i + 1} />
					))
				: null}
			{pile ? <BucketPile position={[6, 0, 47]} /> : null}
		</group>
	);
};

/** a sad pile of abandoned buckets */
export const BucketPile: React.FC<{position?: V3; n?: number}> = ({position, n = 26}) => {
	const items = useMemo(() => {
		const r = mulberry32(31);
		return Array.from({length: n}).map((_, i) => {
			const layer = i < 14 ? 0 : i < 22 ? 1 : 2;
			const ang = r() * Math.PI * 2;
			const rad = (layer === 0 ? 1.2 + r() * 3.2 : layer === 1 ? r() * 2.2 : r() * 1.0);
			const tipped = r() > 0.45;
			return {
				p: [Math.cos(ang) * rad, layer * 0.75 + (tipped ? 0.55 : 0), Math.sin(ang) * rad] as V3,
				rot: [tipped ? Math.PI / 2 + (r() - 0.5) * 0.6 : (r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.5] as V3,
				h: r() * 2 - 1,
			};
		});
	}, [n]);
	return (
		<group position={position}>
			{items.map((it, i) => (
				<Bucket key={i} position={it.p} rotation={it.rot} handle={it.h} />
			))}
			{/* warning sign */}
			<group position={[4.5, 0, 1.5]} rotation={[0, -0.4, 0.1]}>
				<mesh geometry={cyl(0.12, 0.14, 3.2, 8)} material={plastic('#7a5a3a')} position={[0, 1.6, 0]} castShadow />
				<mesh geometry={rbox(2.6, 1.1, 0.15, 0.06)} material={plastic('#c9a46a')} position={[0, 2.9, 0.1]} castShadow />
			</group>
		</group>
	);
};

// ------------------------------------------------------------------ the Swamp of Smells
export const Swamp: React.FC<{frame: number}> = ({frame}) => {
	const water = plastic('#ffffff', {map: noiseTex('#4b6a2c', 0.18, 12, [10, 10], 300), rough: 0.18, metal: 0.15, envInt: 0.8});
	const mud = plastic('#7a5a36', {rough: 0.9});
	const t = frame / 30;
	const stones = useMemo(() => {
		const r = mulberry32(5);
		return Array.from({length: 26}).map((_, i) => ({x: Math.sin(i * 0.35) * 2.2 + (r() - 0.5) * 0.8, z: 20 - i * 3.0, s: 1.4 + r() * 0.6, rot: r() * 3}));
	}, []);
	return (
		<group>
			<mesh geometry={plane(240, 240)} material={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -40]} receiveShadow />
			{/* muddy path */}
			{stones.map((s, i) => (
				<mesh key={i} geometry={rbox(s.s * 1.7, 0.35, s.s * 1.3, 0.25)} material={mud} position={[s.x, 0.05, s.z]} rotation={[0, s.rot, 0]} receiveShadow castShadow />
			))}
			<mesh geometry={box(5, 0.3, 70)} material={mud} position={[0, -0.02, -18]} receiveShadow />
			{/* lily pads, reeds, bubbles */}
			{Array.from({length: 40}).map((_, i) => {
				const x = (hash(i, 1) - 0.5) * 60;
				const z = 20 - hash(i, 2) * 90;
				if (Math.abs(x) < 4) return null;
				return <mesh key={'l' + i} geometry={circle(0.8 + hash(i, 3) * 0.6, 14)} material={plastic('#5fae3a', {rough: 0.6})} position={[x, 0.0, z]} rotation={[-Math.PI / 2, 0, hash(i, 4) * 6]} />;
			})}
			{Array.from({length: 30}).map((_, i) => {
				const x = (hash(i, 7) > 0.5 ? 1 : -1) * (4 + hash(i, 8) * 9);
				const z = 18 - hash(i, 9) * 80;
				return (
					<group key={'r' + i} position={[x, 0, z]}>
						{[0, 1, 2].map((k) => (
							<mesh key={k} geometry={cyl(0.06, 0.08, 2.2 + k * 0.4, 5)} material={plastic('#6f8f2f', {rough: 0.8})} position={[k * 0.25 - 0.25, 1.1 + k * 0.2, (k % 2) * 0.2]} rotation={[0, 0, (k - 1) * 0.15]} />
						))}
						<mesh geometry={cyl(0.13, 0.13, 0.7, 8)} material={plastic('#6b4a2a')} position={[0, 2.8, 0]} />
					</group>
				);
			})}
			{Array.from({length: 10}).map((_, i) => {
				const ph = (t * 0.7 + hash(i, 11)) % 1;
				const x = (hash(i, 12) - 0.5) * 30;
				const z = 10 - hash(i, 13) * 50;
				return <mesh key={'b' + i} geometry={sphere(0.18 + ph * 0.2, 10, 8)} material={plastic('#9bd46a', {rough: 0.2, transparent: true, opacity: 1 - ph})} position={[x, 0.05, z]} />;
			})}
			{[[-9, 6], [8, -2], [-11, -14], [12, -20], [-7, -30], [9, -42], [-14, 10], [15, 4]].map(([x, z], i) => (
				<DeadTree key={'d' + i} position={[x, -0.2, z]} scale={1.4 + hash(i, 15) * 0.5} seed={i + 20} color="#4a3f2a" />
			))}
			{[[-4.5, 2.5, 8], [5, 3.4, 2], [-5.5, 4.2, -6], [4.2, 2.8, -12], [-3.8, 3.6, -20], [6, 4.4, -26], [0, 6.4, -4], [-7, 5.5, 14]].map(([x, y, z], i) => (
				<StinkCloud key={'s' + i} frame={frame} position={[x, y, z]} scale={1.2 + hash(i, 17) * 0.7} seed={i + 30} />
			))}
		</group>
	);
};

// ------------------------------------------------------------------ the long road
export const CountryRoad: React.FC<{z0?: number; z1?: number}> = ({z0 = 60, z1 = -400}) => {
	const len = z0 - z1;
	const cz = (z0 + z1) / 2;
	const grass = plastic('#ffffff', {map: noiseTex('#7cc85a', 0.1, 33, [20, len / 10], 300), rough: 0.9});
	const dirt = plastic('#ffffff', {map: noiseTex('#c8a26a', 0.1, 34, [2, len / 6], 300), rough: 0.9});
	const items = useMemo(() => {
		const out: React.ReactNode[] = [];
		for (let z = z0; z > z1; z -= 9) {
			const i = Math.round(z);
			const k = hash(i, 3);
			const side = hash(i, 4) > 0.5 ? 1 : -1;
			if (k < 0.45) out.push(<RoundTree key={'t' + i} position={[side * (9 + hash(i, 5) * 14), 0, z]} seed={i} scale={0.9 + hash(i, 6) * 0.5} />);
			else if (k < 0.65) out.push(<PineTree key={'p' + i} position={[side * (10 + hash(i, 7) * 18), 0, z]} scale={1 + hash(i, 8) * 0.6} />);
			else if (k < 0.8) out.push(<Bush key={'b' + i} position={[side * (5.5 + hash(i, 9) * 3), 0, z]} />);
			else out.push(<Rock key={'r' + i} position={[side * (5 + hash(i, 10) * 3), 0.3, z]} scale={0.8 + hash(i, 11)} rot={hash(i, 12) * 6} />);
		}
		for (let z = z0; z > z1; z -= 12) out.push(<PicketFence key={'f' + z} from={[-4.6, 0, z]} length={10} rotation={Math.PI / 2} color="#e9e2d2" />);
		return out;
	}, [z0, z1]);
	return (
		<group>
			<mesh geometry={plane(400, len)} material={grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, cz]} receiveShadow />
			<mesh geometry={plane(7, len)} material={dirt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, cz]} receiveShadow />
			{items}
			{/* rolling hills far away */}
			{[[-80, -260, 50], [60, -300, 60], [-20, -360, 70], [120, -200, 45], [-140, -180, 55]].map(([x, z, r], i) => (
				<mesh key={'h' + i} geometry={sphere(1, 32, 16)} material={plastic('#6fbf55', {rough: 0.9})} position={[x, -r * 0.55, z]} scale={[r, r * 0.6, r]} />
			))}
		</group>
	);
};

export const Forest: React.FC = () => {
	const grass = plastic('#ffffff', {map: noiseTex('#5fb24a', 0.12, 44, [12, 12], 300), rough: 0.9});
	return (
		<group>
			<mesh geometry={plane(200, 200)} material={grass} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
			{Array.from({length: 46}).map((_, i) => {
				const a = hash(i, 1) * Math.PI * 2;
				const r = 9 + hash(i, 2) * 40;
				const x = Math.cos(a) * r;
				const z = Math.sin(a) * r - 6;
				// keep a clearing in front of the throne for the camera
				if (x > -10 && x < 10 && z > -3 && z < 16) return null;
				return hash(i, 3) > 0.45 ? <PineTree key={i} position={[x, 0, z]} scale={1.2 + hash(i, 4) * 0.9} /> : <RoundTree key={i} position={[x, 0, z]} scale={1.1 + hash(i, 5) * 0.6} seed={i} />;
			})}
			{Array.from({length: 18}).map((_, i) => (
				<mesh key={'fl' + i} geometry={sphere(0.18, 8, 6)} material={plastic(['#ff6fa8', '#ffe14a', '#ffffff'][i % 3], {rough: 0.6})} position={[(hash(i, 6) - 0.5) * 16, 0.15, (hash(i, 7) - 0.5) * 12]} />
			))}
			<Bush position={[-4.5, 0, -3]} />
			<Bush position={[5, 0, -4.5]} scale={1.2} />
		</group>
	);
};

export {Cloud};
