// Trees, clouds, sun/moon, stars, grass tufts, rocks — simple shapes only.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {plastic, sphere, cyl, cone, glowMat, basicMat, rbox, circle} from '../lib/materials';
import {hash, mulberry32} from '../lib/random';
import {dotTex} from '../lib/textures';
import {V3} from '../lib/anim';

export const RoundTree: React.FC<{position?: V3; scale?: number; seed?: number; leaf?: string; trunk?: string; shadow?: boolean}> = ({position, scale = 1, seed = 1, leaf = '#3fbf4a', trunk = '#8a5a34', shadow = true}) => {
	const k = (n: number) => hash(n, seed);
	const leafM = plastic(leaf, {rough: 0.75});
	const leafM2 = plastic(new THREE.Color(leaf).offsetHSL(0.01, 0, -0.05).getStyle(), {rough: 0.75});
	return (
		<group position={position} scale={scale}>
			<mesh geometry={cyl(0.38, 0.5, 3.4, 10)} material={plastic(trunk, {rough: 0.8})} position={[0, 1.7, 0]} castShadow={shadow} receiveShadow />
			<mesh geometry={sphere(2.0, 18, 12)} material={leafM} position={[0, 4.6, 0]} scale={[1, 0.88, 1]} castShadow={shadow} receiveShadow />
			<mesh geometry={sphere(1.45, 16, 10)} material={leafM2} position={[1.2 + k(1) * 0.3, 4.0, 0.5]} castShadow={shadow} receiveShadow />
			<mesh geometry={sphere(1.4, 16, 10)} material={leafM2} position={[-1.1, 4.2 + k(2) * 0.3, -0.4]} castShadow={shadow} receiveShadow />
			<mesh geometry={sphere(1.25, 16, 10)} material={leafM} position={[0.2, 5.8, -0.2]} castShadow={shadow} receiveShadow />
		</group>
	);
};

export const PineTree: React.FC<{position?: V3; scale?: number; color?: string; shadow?: boolean}> = ({position, scale = 1, color = '#2f9a4a', shadow = true}) => (
	<group position={position} scale={scale}>
		<mesh geometry={cyl(0.3, 0.4, 2, 8)} material={plastic('#7a4a2a', {rough: 0.8})} position={[0, 1, 0]} castShadow={shadow} />
		<mesh geometry={cone(2.2, 3.0, 10)} material={plastic(color, {rough: 0.75})} position={[0, 3.2, 0]} castShadow={shadow} receiveShadow />
		<mesh geometry={cone(1.75, 2.6, 10)} material={plastic(color, {rough: 0.75})} position={[0, 4.6, 0]} castShadow={shadow} receiveShadow />
		<mesh geometry={cone(1.2, 2.2, 10)} material={plastic(color, {rough: 0.75})} position={[0, 5.9, 0]} castShadow={shadow} receiveShadow />
	</group>
);

/** spooky bare tree (swamp) */
export const DeadTree: React.FC<{position?: V3; scale?: number; seed?: number; color?: string}> = ({position, scale = 1, seed = 1, color = '#4a3a2a'}) => {
	const r = mulberry32(seed);
	const m = plastic(color, {rough: 0.9});
	const branches = Array.from({length: 5}).map((_, i) => ({
		y: 2.2 + i * 0.7 + r() * 0.3,
		a: r() * Math.PI * 2,
		tilt: 0.7 + r() * 0.5,
		len: 1.6 + r() * 1.4,
	}));
	return (
		<group position={position} scale={scale} rotation={[0, r() * 6, (r() - 0.5) * 0.2]}>
			<mesh geometry={cyl(0.22, 0.45, 5.5, 8)} material={m} position={[0, 2.75, 0]} castShadow />
			{branches.map((b, i) => (
				<group key={i} position={[0, b.y, 0]} rotation={[0, b.a, b.tilt]}>
					<mesh geometry={cyl(0.07, 0.16, b.len, 6)} material={m} position={[0, b.len / 2, 0]} castShadow />
					<group position={[0, b.len * 0.8, 0]} rotation={[0, 0, -0.9]}>
						<mesh geometry={cyl(0.04, 0.08, b.len * 0.5, 5)} material={m} position={[0, b.len * 0.25, 0]} />
					</group>
				</group>
			))}
		</group>
	);
};

/** puffy Roblox-style cloud from flattened spheres */
export const Cloud: React.FC<{position?: V3; scale?: number; seed?: number; color?: string; opacity?: number}> = ({position, scale = 1, seed = 1, color = '#ffffff', opacity = 1}) => {
	const r = mulberry32(seed);
	const puffs = Array.from({length: 6}).map((_, i) => ({x: (i - 2.5) * 1.6 + (r() - 0.5), y: r() * 0.6, z: (r() - 0.5) * 1.5, s: 1.3 + r() * 1.1}));
	const m = plastic(color, {rough: 0.95, emissive: color, emissiveIntensity: 0.25, transparent: opacity < 1, opacity});
	return (
		<group position={position} scale={scale}>
			{puffs.map((p, i) => (
				<mesh key={i} geometry={sphere(1, 16, 10)} material={m} position={[p.x, p.y, p.z]} scale={[p.s * 1.2, p.s * 0.55, p.s]} />
			))}
		</group>
	);
};

/** glowing sun or moon disc with a soft halo (always faces +z; place far away) */
export const SkyDisc: React.FC<{position: V3; size: number; color: string; halo?: string; intensity?: number}> = ({position, size, color, halo, intensity = 2.5}) => {
	const haloMat = useMemo(
		() => new THREE.MeshBasicMaterial({map: dotTex(), color: new THREE.Color(halo ?? color).multiplyScalar(1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false}),
		[color, halo],
	);
	const discMat = useMemo(() => {
		const m = new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), fog: false});
		m.toneMapped = false;
		return m;
	}, [color, intensity]);
	return (
		<group position={position}>
			<mesh geometry={circle(size, 40)} material={discMat} />
			<mesh geometry={circle(size * 4, 32)} material={haloMat} position={[0, 0, -0.5]} />
		</group>
	);
};

/** star field on a far sphere (night) */
export const Stars: React.FC<{count?: number; radius?: number; seed?: number}> = ({count = 260, radius = 380, seed = 5}) => {
	const geo = useMemo(() => {
		const r = mulberry32(seed);
		const pos = new Float32Array(count * 3);
		for (let i = 0; i < count; i++) {
			const u = r() * Math.PI * 2;
			const v = 0.08 + r() * 0.9;
			const y = Math.sin(v * Math.PI * 0.5);
			const rr = Math.cos(v * Math.PI * 0.5);
			pos[i * 3] = Math.cos(u) * rr * radius;
			pos[i * 3 + 1] = y * radius;
			pos[i * 3 + 2] = Math.sin(u) * rr * radius;
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		return g;
	}, [count, radius, seed]);
	const mat = useMemo(() => new THREE.PointsMaterial({map: dotTex(), size: 5, sizeAttenuation: true, color: new THREE.Color('#fff6dd').multiplyScalar(1.6), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending}), []);
	return <points geometry={geo} material={mat} frustumCulled={false} />;
};

export const Rock: React.FC<{position?: V3; scale?: number | V3; color?: string; rot?: number}> = ({position, scale = 1, color = '#8b8f99', rot = 0}) => (
	<mesh geometry={rbox(1.4, 0.9, 1.1, 0.35, 3)} material={plastic(color, {rough: 0.85})} position={position} scale={scale} rotation={[0, rot, 0.1]} castShadow receiveShadow />
);

export const Bush: React.FC<{position?: V3; scale?: number; color?: string}> = ({position, scale = 1, color = '#36b34a'}) => (
	<group position={position} scale={scale}>
		<mesh geometry={sphere(0.9, 14, 10)} material={plastic(color, {rough: 0.8})} position={[0, 0.6, 0]} scale={[1.2, 0.85, 1]} castShadow receiveShadow />
		<mesh geometry={sphere(0.7, 12, 8)} material={plastic(color, {rough: 0.8})} position={[0.8, 0.45, 0.2]} castShadow receiveShadow />
		<mesh geometry={sphere(0.65, 12, 8)} material={plastic(color, {rough: 0.8})} position={[-0.75, 0.45, -0.1]} castShadow receiveShadow />
	</group>
);

/** flat glowing quad that always faces the camera (sprite) */
export const GlowSprite: React.FC<{position?: V3; size?: number; color?: string; opacity?: number}> = ({position, size = 2, color = '#ffd27a', opacity = 1}) => {
	const mat = useMemo(() => new THREE.SpriteMaterial({map: dotTex(), color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending}), [color, opacity]);
	return <sprite material={mat} position={position} scale={[size, size, size]} />;
};

export {basicMat, glowMat};
