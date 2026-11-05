import React, {useMemo} from 'react';
import * as THREE from 'three';
import {V3, rnd} from '../lib/anim';
import {boxGeo, circleGeo, coneGeo, cylGeo, litTex, planeGeo, plastic, rboxGeo, sphGeo, unlit} from './cache';
import {TextOpts, glowTex, gradientTex, textTex} from './textures';

export type Xf = {
	position?: V3;
	rotation?: V3;
	scale?: V3 | number;
	color?: string;
	mat?: THREE.Material;
	cast?: boolean;
	receive?: boolean;
	children?: React.ReactNode;
	visible?: boolean;
};

const sc = (s?: V3 | number): V3 | undefined => (s === undefined ? undefined : typeof s === 'number' ? [s, s, s] : s);

export const RBox: React.FC<Xf & {s: V3; r?: number}> = ({s, r = 0.12, position, rotation, scale, color = '#ffffff', mat, cast = true, receive = true, children, visible}) => (
	<mesh geometry={rboxGeo(s[0], s[1], s[2], r)} material={mat ?? plastic(color)} position={position} rotation={rotation} scale={sc(scale)} castShadow={cast} receiveShadow={receive} visible={visible}>
		{children}
	</mesh>
);

export const Box: React.FC<Xf & {s: V3}> = ({s, position, rotation, scale, color = '#ffffff', mat, cast = true, receive = true, children, visible}) => (
	<mesh geometry={boxGeo(s[0], s[1], s[2])} material={mat ?? plastic(color)} position={position} rotation={rotation} scale={sc(scale)} castShadow={cast} receiveShadow={receive} visible={visible}>
		{children}
	</mesh>
);

export const Cyl: React.FC<Xf & {r: number; r2?: number; h: number; seg?: number}> = ({r, r2, h, seg = 24, position, rotation, scale, color = '#ffffff', mat, cast = true, receive = true, children, visible}) => (
	<mesh geometry={cylGeo(r, r2 ?? r, h, seg)} material={mat ?? plastic(color)} position={position} rotation={rotation} scale={sc(scale)} castShadow={cast} receiveShadow={receive} visible={visible}>
		{children}
	</mesh>
);

export const Sph: React.FC<Xf & {r: number; seg?: number}> = ({r, seg = 24, position, rotation, scale, color = '#ffffff', mat, cast = true, receive = true, children, visible}) => (
	<mesh geometry={sphGeo(r, seg, Math.max(8, Math.round(seg * 0.66)))} material={mat ?? plastic(color)} position={position} rotation={rotation} scale={sc(scale)} castShadow={cast} receiveShadow={receive} visible={visible}>
		{children}
	</mesh>
);

export const Cone: React.FC<Xf & {r: number; h: number; seg?: number}> = ({r, h, seg = 16, position, rotation, scale, color = '#ffffff', mat, cast = true, receive = true, children, visible}) => (
	<mesh geometry={coneGeo(r, h, seg)} material={mat ?? plastic(color)} position={position} rotation={rotation} scale={sc(scale)} castShadow={cast} receiveShadow={receive} visible={visible}>
		{children}
	</mesh>
);

export const Plane: React.FC<Xf & {w: number; h: number; map?: THREE.Texture; glow?: number; basic?: boolean; opacity?: number; double?: boolean}> = ({w, h, map, glow = 0.3, basic, opacity, double, position, rotation, scale, color = '#ffffff', mat, cast = false, receive = true, children, visible}) => {
	const m = mat ?? (map ? (basic ? unlit('#ffffff', {map, transparent: true, opacity, side: double ? THREE.DoubleSide : THREE.FrontSide}) : litTex(map, glow, {side: double ? THREE.DoubleSide : THREE.FrontSide})) : plastic(color, {side: double ? THREE.DoubleSide : THREE.FrontSide}));
	return (
		<mesh geometry={planeGeo(w, h)} material={m} position={position} rotation={rotation} scale={sc(scale)} castShadow={cast} receiveShadow={receive} visible={visible}>
			{children}
		</mesh>
	);
};

/** A flat text sign. Height derived from texture aspect. */
export const TextPlane: React.FC<Xf & {text: string; w: number; opts?: TextOpts; glow?: number; basic?: boolean}> = ({text, w, opts = {}, glow = 0.35, basic, ...rest}) => {
	const tw = opts.w ?? 1024;
	const th = opts.h ?? 256;
	const tex = textTex(text, opts);
	return <Plane w={w} h={(w * th) / tw} map={tex} glow={glow} basic={basic} {...rest} />;
};

export const Disc: React.FC<Xf & {r: number}> = ({r, position, rotation, color = '#ffffff', mat, receive = true}) => (
	<mesh geometry={circleGeo(r)} material={mat ?? plastic(color)} position={position} rotation={rotation} receiveShadow={receive} />
);

/** Additive glow sprite (for lamps, flashes, police lights). */
export const Glow: React.FC<{position: V3; size: number; color?: string; opacity?: number}> = ({position, size, color = '#ffd27a', opacity = 1}) => (
	<sprite position={position} scale={[size, size, size]}>
		<spriteMaterial map={glowTex()} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
	</sprite>
);

/* ---------- Lights ---------- */

export const Sun: React.FC<{pos: V3; target?: V3; intensity?: number; color?: string; size?: number; far?: number; shadow?: boolean; bias?: number}> = ({pos, target = [0, 0, 0], intensity = 2.6, color = '#fff4e0', size = 30, far = 300, shadow = true, bias = -0.0004}) => {
	const tgt = useMemo(() => new THREE.Object3D(), []);
	tgt.position.set(...target);
	tgt.updateMatrixWorld();
	return (
		<>
			<primitive object={tgt} />
			<directionalLight
				position={pos}
				target={tgt}
				intensity={intensity}
				color={color}
				castShadow={shadow}
				shadow-mapSize={[2048, 2048]}
				shadow-camera-left={-size}
				shadow-camera-right={size}
				shadow-camera-top={size}
				shadow-camera-bottom={-size}
				shadow-camera-near={0.5}
				shadow-camera-far={far}
				shadow-bias={bias}
				shadow-normalBias={0.03}
				shadow-radius={4}
			/>
		</>
	);
};

export const Spot: React.FC<{pos: V3; target: V3; intensity?: number; color?: string; angle?: number; penumbra?: number; distance?: number; shadow?: boolean; decay?: number}> = ({pos, target, intensity = 50, color = '#ffffff', angle = 0.4, penumbra = 0.6, distance = 0, shadow = false, decay = 1.2}) => {
	const tgt = useMemo(() => new THREE.Object3D(), []);
	tgt.position.set(...target);
	tgt.updateMatrixWorld();
	return (
		<>
			<primitive object={tgt} />
			<spotLight position={pos} target={tgt} intensity={intensity} color={color} angle={angle} penumbra={penumbra} distance={distance} decay={decay} castShadow={shadow} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
		</>
	);
};

export type LightPreset = 'day' | 'morning' | 'night' | 'office' | 'dark' | 'sunrise' | 'forest' | 'meeting';

/** Standard lighting set-ups. The sun position is relative to `center`. */
export const Lights: React.FC<{preset: LightPreset; center?: V3; size?: number; sunDir?: V3; k?: number}> = ({preset, center = [0, 0, 0], size = 30, sunDir, k = 1}) => {
	const c = center;
	const at = (d: V3, dist: number): V3 => [c[0] + d[0] * dist, c[1] + d[1] * dist, c[2] + d[2] * dist];
	switch (preset) {
		case 'day':
			return (
				<>
					<hemisphereLight args={['#cfe9ff', '#9bc27a', 0.85 * k]} />
					<ambientLight intensity={0.15 * k} />
					<Sun pos={at(sunDir ?? [0.45, 0.8, 0.55], 80)} target={c} intensity={2.3 * k} size={size} />
				</>
			);
		case 'morning':
		case 'sunrise':
			return (
				<>
					<hemisphereLight args={['#ffd9b8', '#8a7a9a', 1.0 * k]} />
					<ambientLight intensity={0.2 * k} />
					<Sun pos={at(sunDir ?? [-0.6, 0.45, 0.6], 80)} target={c} intensity={2.8 * k} color="#ffc48a" size={size} />
				</>
			);
		case 'office':
			return (
				<>
					<hemisphereLight args={['#fff6ea', '#b48a6a', 1.15 * k]} />
					<ambientLight intensity={0.3 * k} />
					<Sun pos={at(sunDir ?? [-0.5, 0.7, 0.6], 40)} target={c} intensity={2.2 * k} color="#fff1dc" size={size} far={150} />
				</>
			);
		case 'meeting':
			return (
				<>
					<hemisphereLight args={['#fff4e6', '#9a7f6a', 1.1 * k]} />
					<ambientLight intensity={0.3 * k} />
					<Sun pos={at(sunDir ?? [0.3, 0.9, 0.5], 40)} target={c} intensity={1.8 * k} color="#fff1dc" size={size} far={150} />
				</>
			);
		case 'dark':
			return (
				<>
					<hemisphereLight args={['#4a5a8a', '#1a1420', 0.35 * k]} />
					<ambientLight intensity={0.08 * k} />
				</>
			);
		case 'night':
			return (
				<>
					<hemisphereLight args={['#5a78c8', '#1c2340', 0.65 * k]} />
					<ambientLight intensity={0.12 * k} />
					<Sun pos={at(sunDir ?? [-0.4, 0.8, 0.45], 80)} target={c} intensity={0.75 * k} color="#9fb6ff" size={size} />
				</>
			);
		case 'forest':
			return (
				<>
					<hemisphereLight args={['#5a78d0', '#1a2440', 0.95 * k]} />
					<ambientLight intensity={0.14 * k} />
					<Sun pos={at(sunDir ?? [0.3, 0.9, 0.3], 60)} target={c} intensity={0.85 * k} color="#9fb6ff" size={size} />
				</>
			);
	}
};

/* ---------- Sky ---------- */

export type SkyPreset = 'day' | 'night' | 'sunrise' | 'dusk';
const SKIES: Record<SkyPreset, [number, string][]> = {
	day: [
		[0, '#3d9cf0'],
		[0.42, '#7cc4ff'],
		[0.5, '#c4e7ff'],
		[1, '#e8f6ff'],
	],
	night: [
		[0, '#060a24'],
		[0.4, '#121c52'],
		[0.5, '#24307a'],
		[1, '#0a0f2e'],
	],
	sunrise: [
		[0, '#3c5aa6'],
		[0.32, '#9a8ad0'],
		[0.45, '#ffb48a'],
		[0.5, '#ffd9a0'],
		[1, '#ffe8c8'],
	],
	dusk: [
		[0, '#1b2a6b'],
		[0.45, '#6a5aa8'],
		[0.5, '#ff9a7a'],
		[1, '#2a2a50'],
	],
};

export const Sky: React.FC<{preset: SkyPreset; stars?: boolean; moon?: V3; sun?: V3}> = ({preset, stars, moon, sun}) => {
	const tex = gradientTex(preset, SKIES[preset]);
	const starGeo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const n = 700;
		const p = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) {
			const th = rnd(`st${i}`) * Math.PI * 2;
			const ph = 0.05 + rnd(`sp${i}`) * 1.3;
			p[i * 3] = Math.cos(th) * Math.cos(ph) * 850;
			p[i * 3 + 1] = Math.sin(ph) * 850;
			p[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 850;
		}
		g.setAttribute('position', new THREE.BufferAttribute(p, 3));
		return g;
	}, []);
	return (
		<>
			<mesh geometry={sphGeo(900, 32, 24)} material={unlit('#ffffff', {map: tex, side: THREE.BackSide, fog: false, transparent: false})} renderOrder={-10} />
			{stars ? (
				<points geometry={starGeo}>
					<pointsMaterial color="#ffffff" size={2.2} sizeAttenuation={false} fog={false} transparent opacity={0.9} />
				</points>
			) : null}
			{moon ? (
				<>
					<mesh position={moon} geometry={sphGeo(18, 32, 24)} material={unlit('#fff6d8', {fog: false})} />
					<Glow position={moon} size={140} color="#9fb4ff" opacity={0.55} />
				</>
			) : null}
			{sun ? (
				<>
					<mesh position={sun} geometry={sphGeo(30, 32, 24)} material={unlit('#fff2c0', {fog: false})} />
					<Glow position={sun} size={320} color="#ffb070" opacity={0.9} />
				</>
			) : null}
		</>
	);
};

/** Puffy cartoon clouds made of spheres. */
export const Clouds: React.FC<{seed?: string; n?: number; radius?: number; y?: number; color?: string; scale?: number}> = ({seed = 'c', n = 10, radius = 300, y = 120, color = '#ffffff', scale = 1}) => {
	const m = plastic(color, {rough: 0.9, emissive: color, ei: 0.45});
	return (
		<group>
			{Array.from({length: n}).map((_, i) => {
				const a = rnd(`${seed}a${i}`) * Math.PI * 2;
				const d = radius * (0.5 + rnd(`${seed}d${i}`) * 0.5);
				const s = (14 + rnd(`${seed}s${i}`) * 14) * scale;
				return (
					<group key={i} position={[Math.cos(a) * d, y + rnd(`${seed}y${i}`) * 50, Math.sin(a) * d]}>
						<mesh geometry={sphGeo(s, 16, 12)} material={m} />
						<mesh geometry={sphGeo(s * 0.75, 16, 12)} material={m} position={[s * 1.0, -s * 0.2, 0]} />
						<mesh geometry={sphGeo(s * 0.7, 16, 12)} material={m} position={[-s * 0.95, -s * 0.25, s * 0.1]} />
						<mesh geometry={sphGeo(s * 0.55, 16, 12)} material={m} position={[s * 0.3, -s * 0.35, s * 0.6]} />
					</group>
				);
			})}
		</group>
	);
};

export {boxGeo, cylGeo, planeGeo};
