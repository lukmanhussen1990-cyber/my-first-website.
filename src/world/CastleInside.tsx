// Inside the castle: the dusty hall with cobwebs, and the basement with rows and rows of golden thrones.
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {plastic, box, plane, rbox, cyl, torus, sphere, lathe, goldMat, glowMat, cone} from '../lib/materials';
import {stoneTex, webTex} from '../lib/textures';
import {hash} from '../lib/random';
import {BeamCone} from '../props/Effects';
import {V3} from '../lib/anim';

const Web: React.FC<{position: V3; rotation?: V3; size?: number; seed?: number}> = ({position, rotation, size = 4, seed = 13}) => {
	const mat = useMemo(() => new THREE.MeshBasicMaterial({map: webTex(seed), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1.2, 1.2, 1.3)}), [seed]);
	return <mesh geometry={plane(size, size)} material={mat} position={position} rotation={rotation} renderOrder={6} />;
};

/** a visible light shaft from `from` toward `to` */
export const BeamTo: React.FC<{from: V3; to: V3; radius?: number; color?: string; opacity?: number}> = ({from, to, radius = 2, color = '#cfe0ff', opacity = 0.25}) => {
	const {q, len} = useMemo(() => {
		const a = new THREE.Vector3(...from);
		const b = new THREE.Vector3(...to);
		const dir = b.clone().sub(a);
		const len = dir.length();
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
		return {q, len};
	}, [from[0], from[1], from[2], to[0], to[1], to[2]]);
	return (
		<group position={from} quaternion={q}>
			<BeamCone length={len} radius={radius} color={color} opacity={opacity} />
		</group>
	);
};

export const CastleHall: React.FC<{webs?: boolean}> = ({webs = true}) => {
	const floor = plastic('#ffffff', {map: stoneTex('#5c6070', [6, 12], 3, 5), rough: 0.85});
	const wall = plastic('#ffffff', {map: stoneTex('#6a6478', [6, 2], 7, 7), rough: 0.9});
	const pillarM = plastic('#ffffff', {map: stoneTex('#757082', [1, 3], 11, 6), rough: 0.85});
	const L0 = 12;
	const L1 = -46;
	const len = L0 - L1;
	const cz = (L0 + L1) / 2;
	const pillars: number[] = [];
	for (let z = 6; z > -40; z -= 8) pillars.push(z);
	return (
		<group>
			<mesh geometry={plane(26, len)} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]} receiveShadow />
			<mesh geometry={plane(4.2, len - 8)} material={plastic('#7a1f2b', {rough: 0.9})} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, cz - 4]} receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={box(1, 22, len)} material={wall} position={[sd * 13, 11, cz]} receiveShadow />
			))}
			<mesh geometry={box(26, 22, 1)} material={wall} position={[0, 11, L1]} receiveShadow />
			<mesh geometry={box(26, 1, len)} material={plastic('#2b2733', {rough: 0.9})} position={[0, 22, cz]} />
			{pillars.map((z) => (
				<group key={z}>
					{[-1, 1].map((sd) => (
						<group key={sd} position={[sd * 7.5, 0, z]}>
							<mesh geometry={cyl(1.0, 1.15, 16, 12)} material={pillarM} position={[0, 8, 0]} castShadow receiveShadow />
							<mesh geometry={rbox(2.8, 1.0, 2.8, 0.1)} material={pillarM} position={[0, 0.5, 0]} castShadow />
							<mesh geometry={rbox(2.8, 1.0, 2.8, 0.1)} material={pillarM} position={[0, 16.3, 0]} castShadow />
						</group>
					))}
					{/* arch across the hall */}
					<mesh geometry={torus(7.5, 0.7, 8, 24, Math.PI)} material={pillarM} position={[0, 16.6, z]} castShadow />
				</group>
			))}
			{/* tall windows with moonlight shafts */}
			{[-2, -18, -34].map((z, i) => (
				<group key={z}>
					<mesh geometry={rbox(1.0, 6, 2.6, 0.3)} material={glowMat('#9fb6ff', 1.5)} position={[12.45, 14, z]} />
					<BeamTo from={[12.2, 14.5, z]} to={[2 - i, 0, z + 5]} radius={2.4} opacity={0.12} color="#b8c8ff" />
				</group>
			))}
			{/* cobwebs in corners and between pillars */}
			{webs
				? [
						[[-12.4, 18.5, 4], [0, Math.PI / 2, Math.PI], 7],
						[[12.4, 18.5, -10], [0, -Math.PI / 2, -Math.PI / 2], 7],
						[[-6.6, 13.8, -6], [0, 0, Math.PI], 5],
						[[6.6, 13.8, -14], [0, 0, -Math.PI / 2], 5],
						[[-6.6, 3.5, -22], [0, 0, Math.PI / 2], 4],
						[[6.6, 13.6, -30], [0, 0, -Math.PI / 2], 5],
						[[-12.4, 21, -40], [0, Math.PI / 2, Math.PI], 8],
					].map(([p, r, sz], i) => <Web key={i} position={p as V3} rotation={r as V3} size={sz as number} seed={13 + i} />)
				: null}
			{/* broken barrels / junk */}
			{[[-10, -8], [10.2, -24], [-9.6, -30]].map(([x, z], i) => (
				<mesh key={'bar' + i} geometry={cyl(0.9, 0.9, 1.8, 12)} material={plastic('#6b4a2a', {rough: 0.9})} position={[x, 0.9, z]} rotation={[i === 1 ? Math.PI / 2 : 0, 0, 0]} castShadow />
			))}
		</group>
	);
};

// ------------------------------------------------------------------ rows of thrones (instanced)
const PARTS = () => {
	const g = goldMat(0.32);
	const red = plastic('#ff3b3b', {rough: 0.12, emissive: '#ff2020', emissiveIntensity: 0.6});
	const m4 = (p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) => new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
	return [
		{geo: lathe('throne-base', [[0, 0], [0.78, 0], [0.82, 0.08], [0.6, 0.2], [0.46, 0.5], [0.52, 0.72], [0, 0.72]], 36), mat: g, m: m4([0, 0, 0])},
		{geo: lathe('throne-bowl', [[0.0, 0.62], [0.46, 0.64], [0.72, 0.8], [0.86, 1.04], [0.9, 1.18], [0.78, 1.18], [0.66, 0.98], [0.0, 0.9]], 40), mat: g, m: m4([0, 0, 0], [0, 0, 0], [1, 1, 1.22])},
		{geo: torus(0.74, 0.13, 12, 40), mat: g, m: m4([0, 1.24, 0.02], [Math.PI / 2, 0, 0], [1, 1.22, 1])},
		{geo: rbox(1.1, 0.9, 0.6, 0.2), mat: g, m: m4([0, 0.95, -0.85])},
		{geo: sphere(1, 28, 16), mat: g, m: m4([0, 1.28 + 0.9 * Math.cos(0.15), -0.86 - 0.9 * Math.sin(0.15)], [-0.15, 0, 0], [0.82, 0.95, 0.11])},
		{geo: rbox(1.78, 1.3, 0.82, 0.16), mat: g, m: m4([0, 2.02, -1.12])},
		{geo: rbox(1.98, 0.18, 1.0, 0.07), mat: g, m: m4([0, 2.72, -1.12])},
		{geo: cyl(0.29, 0.31, 0.2, 20), mat: red, m: m4([0, 2.98, -1.12])},
	];
};

export const ThroneRows: React.FC<{transforms: {p: V3; r: number; s?: number}[]}> = ({transforms}) => {
	const parts = useMemo(PARTS, []);
	const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
	useLayoutEffect(() => {
		const base = new THREE.Matrix4();
		const tmp = new THREE.Matrix4();
		parts.forEach((part, pi) => {
			const im = refs.current[pi];
			if (!im) return;
			transforms.forEach((t, i) => {
				base.compose(new THREE.Vector3(...t.p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.r, 0)), new THREE.Vector3(t.s ?? 1, t.s ?? 1, t.s ?? 1));
				tmp.multiplyMatrices(base, part.m);
				im.setMatrixAt(i, tmp);
			});
			im.instanceMatrix.needsUpdate = true;
			im.computeBoundingSphere();
		});
	}, [parts, transforms]);
	return (
		<group>
			{parts.map((part, pi) => (
				<instancedMesh key={pi} ref={(el) => (refs.current[pi] = el)} args={[part.geo, part.mat, transforms.length]} castShadow receiveShadow frustumCulled={false} />
			))}
		</group>
	);
};

export const Torch: React.FC<{position: V3; frame: number; seed?: number; light?: boolean}> = ({position, frame, seed = 1, light = false}) => {
	const fl = 1 + Math.sin(frame * 0.9 + seed) * 0.12 + Math.sin(frame * 2.3 + seed * 2) * 0.08;
	return (
		<group position={position}>
			<mesh geometry={cyl(0.12, 0.08, 1.2, 8)} material={plastic('#4a3020')} rotation={[0.3, 0, 0]} />
			<mesh geometry={cone(0.28, 0.8 * fl, 10)} material={glowMat('#ffb030', 3.2)} position={[0, 0.85, 0.2]} />
			<mesh geometry={cone(0.16, 0.5 * fl, 8)} material={glowMat('#fff2a0', 4)} position={[0, 0.78, 0.2]} />
			{light ? <pointLight position={[0, 1.2, 0.6]} color="#ffa040" intensity={22 * fl} distance={18} decay={1.5} /> : null}
		</group>
	);
};

export const Basement: React.FC<{frame: number}> = ({frame}) => {
	const floor = plastic('#ffffff', {map: stoneTex('#6a5f58', [8, 24], 15, 5), rough: 0.85});
	const wall = plastic('#ffffff', {map: stoneTex('#6e6058', [10, 2], 17, 7), rough: 0.9});
	const transforms = useMemo(() => {
		const out: {p: V3; r: number}[] = [];
		for (let row = 0; row < 26; row++)
			for (let col = 0; col < 9; col++) {
				const x = (col - 4) * 4.2;
				const z = 6 - row * 4.6;
				out.push({p: [x, 0, z], r: Math.PI + (hash(row * 9 + col, 2) - 0.5) * 0.1});
			}
		return out;
	}, []);
	return (
		<group>
			<mesh geometry={plane(46, 140)} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -54]} receiveShadow />
			{[-1, 1].map((sd) => (
				<mesh key={sd} geometry={box(1, 16, 140)} material={wall} position={[sd * 22, 8, -54]} receiveShadow />
			))}
			{Array.from({length: 12}).map((_, i) => (
				<mesh key={'arch' + i} geometry={torus(21, 0.9, 8, 28, Math.PI)} material={wall} position={[0, 8, 8 - i * 11]} castShadow />
			))}
			<ThroneRows transforms={transforms} />
			{Array.from({length: 10}).map((_, i) => (
				<group key={'t' + i}>
					<Torch position={[-21.3, 6, 4 - i * 12]} frame={frame} seed={i} light={i < 4} />
					<Torch position={[21.3, 6, -2 - i * 12]} frame={frame} seed={i + 20} light={i < 3} />
				</group>
			))}
		</group>
	);
};
