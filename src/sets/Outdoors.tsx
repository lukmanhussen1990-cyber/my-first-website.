import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, rnd} from '../lib/anim';
import {circleGeo, coneGeo, cylGeo, plastic, sphGeo} from '../three/cache';
import {Box, Glow, RBox} from '../three/prims';
import {fogTex, noiseTex} from '../three/textures';
import {Banner, Bench, Bush, Car, Fence, Flowers, Tree} from './props';

/* ---------- Park (Fetch Day) ---------- */

export const Park: React.FC<{children?: React.ReactNode}> = ({children}) => (
	<group>
		<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('grass3', '#86d45e', '#6cbf4a', 'grass', 100), rough: 0.95})}>
			<planeGeometry args={[800, 800]} />
		</mesh>
		{/* path */}
		<mesh rotation={[-Math.PI / 2, 0, 0.3]} position={[-10, 0.02, 0]} receiveShadow material={plastic('#eedcb4', {rough: 0.9})}>
			<planeGeometry args={[5, 200]} />
		</mesh>
		<Banner text="FETCH DAY!" position={[0, 9, -22]} w={18} bg="#ff7a1a" />
		{[[-24, -18], [22, -20], [-30, 6], [30, 2], [-18, -34], [12, -36], [36, -12], [-38, -10], [0, -44], [-44, 20], [44, 22]].map(([x, z], i) => (
			<Tree key={i} position={[x, 0, z]} scale={1.5 + rnd(`pt${i}`) * 0.5} color={['#5cbf4a', '#7ad04a', '#4fae3f'][i % 3]} />
		))}
		{[[-14, -12], [16, -14], [-26, -4]].map(([x, z], i) => (
			<Bush key={i} position={[x, 0, z]} scale={1.3} color="#5fbf55" />
		))}
		<Bench position={[-20, 0, -12]} yaw={0.6} />
		<Bench position={[20, 0, -10]} yaw={-0.6} />
		<Flowers position={[8, 0, -16]} w={6} seed="pk" />
		<Fence position={[0, 0, -30]} len={60} />
		{/* little pond */}
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[26, 0.04, -26]} geometry={circleGeo(7, 40)} material={plastic('#5ec8ff', {rough: 0.05, emissive: '#1a6aa0', ei: 0.3})} />
		{children}
	</group>
);

/* ---------- Night forest ---------- */

/** Instanced tall pine trees (trunks + 3 cone layers). */
export const PineForest: React.FC<{n?: number; radius?: number; clear?: number; seed?: string; center?: V3; minZ?: number}> = ({n = 70, radius = 70, clear = 9, seed = 'pf', center = [0, 0, 0], minZ = -1e9}) => {
	const meshes = useMemo(() => {
		const trunkG = cylGeo(0.5, 0.8, 1, 8);
		const coneG = coneGeo(1, 1, 8);
		const trunkM = plastic('#2a1c18', {rough: 0.9});
		const leafM = plastic('#1b3d3a', {rough: 0.85});
		const leafM2 = plastic('#16302f', {rough: 0.85});
		const pos: [number, number, number][] = [];
		let i = 0;
		while (pos.length < n && i < n * 6) {
			const a = rnd(`${seed}a${i}`) * Math.PI * 2;
			const d = clear + Math.sqrt(rnd(`${seed}d${i}`)) * (radius - clear);
			const x = Math.cos(a) * d;
			const z = Math.sin(a) * d;
			i++;
			if (z < minZ) continue;
			pos.push([x, z, 0.8 + rnd(`${seed}s${i}`) * 0.7]);
		}
		const trunks = new THREE.InstancedMesh(trunkG, trunkM, pos.length);
		const leaves = new THREE.InstancedMesh(coneG, leafM, pos.length * 2);
		const leaves2 = new THREE.InstancedMesh(coneG, leafM2, pos.length);
		const o = new THREE.Object3D();
		pos.forEach(([x, z, s], k) => {
			const H = 22 * s;
			o.position.set(center[0] + x, H * 0.35, center[2] + z);
			o.rotation.set(0, 0, 0);
			o.scale.set(s * 1.2, H * 0.7, s * 1.2);
			o.updateMatrix();
			trunks.setMatrixAt(k, o.matrix);
			[0, 1].forEach((j) => {
				o.position.set(center[0] + x, H * (0.42 + j * 0.24), center[2] + z);
				o.scale.set(s * (6.5 - j * 1.8), H * 0.36, s * (6.5 - j * 1.8));
				o.updateMatrix();
				leaves.setMatrixAt(k * 2 + j, o.matrix);
			});
			o.position.set(center[0] + x, H * 0.9, center[2] + z);
			o.scale.set(s * 2.8, H * 0.3, s * 2.8);
			o.updateMatrix();
			leaves2.setMatrixAt(k, o.matrix);
		});
		[trunks, leaves, leaves2].forEach((m) => {
			m.castShadow = true;
			m.receiveShadow = true;
			m.frustumCulled = false;
		});
		return [trunks, leaves, leaves2];
			// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [n, radius, clear, seed, center[0], center[2], minZ]);
	return (
		<group>
			{meshes.map((m, i) => (
				<primitive key={i} object={m} />
			))}
		</group>
	);
};

/** The big tree where the girl hides. */
export const BigTree: React.FC<{position: V3}> = ({position}) => {
	const bark = plastic('#3a2620', {rough: 0.9});
	const leaf = plastic('#1d4440', {rough: 0.85});
	return (
		<group position={position}>
			<mesh geometry={cylGeo(1.8, 2.6, 16, 12)} material={bark} position={[0, 8, 0]} castShadow receiveShadow />
			{[0, 1, 2, 3, 4].map((i) => {
				const a = (i / 5) * Math.PI * 2 + 0.3;
				return <RBox key={i} s={[1.0, 0.9, 3.4]} r={0.3} mat={bark} position={[Math.cos(a) * 2.6, 0.35, Math.sin(a) * 2.6]} rotation={[0.25, -a + Math.PI / 2, 0]} />;
			})}
			<mesh geometry={sphGeo(7, 16, 12)} material={leaf} position={[0, 18, 0]} castShadow />
			<mesh geometry={sphGeo(5, 16, 12)} material={leaf} position={[4.5, 16, 1]} castShadow />
			<mesh geometry={sphGeo(5, 16, 12)} material={leaf} position={[-4.5, 16.5, -1]} castShadow />
			{/* hollow */}
			<mesh geometry={sphGeo(1.1, 12, 10)} material={plastic('#120a08')} position={[0, 5, 1.9]} scale={[0.8, 1.2, 0.4]} />
		</group>
	);
};

/** Drifting fog puffs (sprites), deterministic from t. */
export const FogBank: React.FC<{t: number; n?: number; area?: [number, number]; center?: V3; y?: number; opacity?: number; size?: number; color?: string}> = ({t, n = 30, area = [60, 60], center = [0, 0, 0], y = 2, opacity = 0.35, size = 18, color = '#9fb4e8'}) => (
	<group>
		{Array.from({length: n}).map((_, i) => {
			const x = center[0] + (rnd(`fx${i}`) - 0.5) * area[0] + Math.sin(t * 0.15 + i) * 3 + t * 0.6;
			const z = center[2] + (rnd(`fz${i}`) - 0.5) * area[1];
			const s = size * (0.7 + rnd(`fs${i}`) * 0.6);
			return (
				<sprite key={i} position={[x, y + rnd(`fy${i}`) * 3, z]} scale={[s, s * 0.5, 1]}>
					<spriteMaterial map={fogTex()} color={color} transparent opacity={opacity} depthWrite={false} />
				</sprite>
			);
		})}
	</group>
);

/** Visible flashlight beam (additive cone) + a real spot light. */
export const Beam: React.FC<{from: V3; to: V3; k?: number; color?: string; light?: boolean; len?: number; width?: number}> = ({from, to, k = 1, color = '#fff2c0', light = true, len = 26, width = 3.2}) => {
	const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
	const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
	const mid: V3 = [from[0] + dir.x * len * 0.5, from[1] + dir.y * len * 0.5, from[2] + dir.z * len * 0.5];
	const tgt = useMemo(() => new THREE.Object3D(), []);
	tgt.position.set(...to);
	tgt.updateMatrixWorld();
	return (
		<group>
			<mesh position={mid} quaternion={quat} geometry={cylGeo(0.12, width, len, 20, true)} renderOrder={5}>
				<meshBasicMaterial color={color} transparent opacity={0.13 * k} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} />
			</mesh>
			<Glow position={from} size={2.2} color={color} opacity={0.9 * k} />
			{light ? (
				<>
					<primitive object={tgt} />
					<spotLight position={from} target={tgt} intensity={260 * k} angle={0.22} penumbra={0.6} distance={60} decay={1.4} color={color} />
				</>
			) : null}
		</group>
	);
};

export const ForestEdge: React.FC<{t: number; police?: boolean; children?: React.ReactNode}> = ({t, police = true, children}) => (
	<group>
		<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={plastic('#ffffff', {map: noiseTex('grassN', '#24402e', '#1a3022', 'grass', 120), rough: 0.95})}>
			<planeGeometry args={[800, 800]} />
		</mesh>
		{/* dirt road to the forest */}
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 30]} receiveShadow material={plastic('#4a3a30', {rough: 0.95})}>
			<planeGeometry args={[10, 80]} />
		</mesh>
		<PineForest n={110} radius={110} clear={0} seed="edge" center={[0, 0, -40]} minZ={-90} />
		{police ? (
			<>
				<Car position={[-14, 0, 22]} yaw={0.5} police t={t} />
				<Car position={[18, 0, 30]} yaw={-0.7} police t={t + 0.13} />
			</>
		) : null}
		{children}
	</group>
);

export {Box};
