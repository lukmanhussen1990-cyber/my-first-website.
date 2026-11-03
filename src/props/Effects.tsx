// Frame-driven particle and light effects. Every value is a pure function of the frame.
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {dotTex, starTex, raysTex, fadeTex, textTex} from '../lib/textures';
import {hash, mulberry32} from '../lib/random';
import {sphere, plastic, cyl} from '../lib/materials';
import {V3, clamp} from '../lib/anim';
import {POPPINS} from '../lib/fonts';

/** generic glowing point cloud; positions/sizes computed by fn(i) -> [x,y,z,size,alpha] */
export const GlowPoints: React.FC<{
	count: number;
	fn: (i: number) => [number, number, number, number, number];
	color?: string;
	tex?: 'dot' | 'star';
	size?: number;
	additive?: boolean;
	position?: V3;
}> = ({count, fn, color = '#ffd96a', tex = 'dot', size = 1, additive = true, position}) => {
	const ref = useRef<THREE.Points>(null);
	const {geo, mat} = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
		geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
		geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1));
		const mat = new THREE.ShaderMaterial({
			uniforms: {map: {value: tex === 'star' ? starTex() : dotTex()}, color: {value: new THREE.Color(color)}, scale: {value: 900}},
			vertexShader: /* glsl */ `
				attribute float aSize; attribute float aAlpha; varying float vA; uniform float scale;
				void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
			fragmentShader: /* glsl */ `
				uniform sampler2D map; uniform vec3 color; varying float vA;
				void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color * t.rgb, t.a * vA); }`,
			transparent: true,
			depthWrite: false,
			blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
		});
		mat.toneMapped = false;
		return {geo, mat};
	}, [count, tex, color, additive]);
	const pos = geo.getAttribute('position') as THREE.BufferAttribute;
	const sz = geo.getAttribute('aSize') as THREE.BufferAttribute;
	const al = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
	for (let i = 0; i < count; i++) {
		const [x, y, z, s, a] = fn(i);
		pos.setXYZ(i, x, y, z);
		sz.setX(i, s * size);
		al.setX(i, a);
	}
	pos.needsUpdate = true;
	sz.needsUpdate = true;
	al.needsUpdate = true;
	(mat.uniforms.color.value as THREE.Color).set(color);
	return <points ref={ref} geometry={geo} material={mat} position={position} frustumCulled={false} renderOrder={10} />;
};

/** sparkles orbiting / twinkling around a centre */
export const Sparkles: React.FC<{frame: number; count?: number; radius?: number; height?: number; seed?: number; color?: string; position?: V3; size?: number}> = ({
	frame,
	count = 40,
	radius = 2.2,
	height = 3,
	seed = 1,
	color = '#ffe48a',
	position,
	size = 1,
}) => {
	const t = frame / 30;
	return (
		<GlowPoints
			count={count}
			tex="star"
			color={color}
			position={position}
			size={size}
			fn={(i) => {
				const a = hash(i, seed) * Math.PI * 2 + t * (0.3 + hash(i, seed + 1) * 0.5);
				const r = radius * (0.55 + hash(i, seed + 2) * 0.6);
				const y = ((hash(i, seed + 3) * height + t * 0.35 * (0.5 + hash(i, seed + 4))) % height) - 0.2;
				const tw = 0.5 + 0.5 * Math.sin(t * (4 + hash(i, seed + 5) * 5) + i);
				return [Math.cos(a) * r, y, Math.sin(a) * r, 0.25 + 0.35 * hash(i, seed + 6), tw];
			}}
		/>
	);
};

/** WHOOSH: a spiral of gold particles rushing up, k = 0..1 progress */
export const MagicSwirl: React.FC<{k: number; position?: V3; radius?: number; height?: number; count?: number; color?: string}> = ({k, position, radius = 2.2, height = 7, count = 160, color = '#ffd24a'}) => {
	if (k <= 0 || k >= 1) return null;
	const fade = Math.sin(clamp(k) * Math.PI);
	return (
		<GlowPoints
			count={count}
			position={position}
			color={color}
			fn={(i) => {
				const lane = i / count;
				const tt = (k * 1.6 + lane) % 1;
				const ang = lane * 40 + k * 14 + tt * 6;
				const r = radius * (1 - tt * 0.55) * (0.8 + 0.4 * hash(i, 4));
				const y = tt * height;
				return [Math.cos(ang) * r, y, Math.sin(ang) * r, 0.5 + hash(i, 5) * 0.5, fade * (1 - tt * 0.6)];
			}}
		/>
	);
};

/** rotating fan of soft light rays (billboard: faces +z of its parent) */
export const LightRays: React.FC<{frame: number; position?: V3; size?: number; color?: string; opacity?: number; speed?: number; rotation?: V3}> = ({
	frame,
	position,
	size = 14,
	color = '#ffd77a',
	opacity = 0.6,
	speed = 0.25,
	rotation,
}) => {
	const mat = useMemo(() => {
		const m = new THREE.MeshBasicMaterial({map: raysTex(), color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false});
		m.toneMapped = false;
		return m;
	}, [color]);
	mat.opacity = opacity;
	return (
		<group position={position} rotation={rotation}>
			<mesh material={mat} rotation={[0, 0, (frame / 30) * speed]} renderOrder={-5}>
				<planeGeometry args={[size, size]} />
			</mesh>
		</group>
	);
};

/** visible beam cone (flashlight / sun shaft). Points along -y of its group from the apex. */
export const BeamCone: React.FC<{length?: number; radius?: number; color?: string; opacity?: number}> = ({length = 10, radius = 2.5, color = '#fff2c4', opacity = 0.35}) => {
	const mat = useMemo(() => {
		const tex = fadeTex();
		const m = new THREE.MeshBasicMaterial({map: tex, color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide});
		m.toneMapped = false;
		return m;
	}, [color]);
	mat.opacity = opacity;
	return (
		<mesh material={mat} position={[0, -length / 2, 0]} renderOrder={8}>
			<cylinderGeometry args={[0.12, radius, length, 32, 1, true]} />
		</mesh>
	);
};

/** floating dust motes */
export const Dust: React.FC<{frame: number; count?: number; box?: V3; position?: V3; color?: string; size?: number; seed?: number}> = ({
	frame,
	count = 160,
	box = [12, 8, 12],
	position,
	color = '#fff1d0',
	size = 0.12,
	seed = 3,
}) => {
	const t = frame / 30;
	return (
		<GlowPoints
			count={count}
			position={position}
			color={color}
			size={1}
			fn={(i) => {
				const x = (hash(i, seed) - 0.5) * box[0] + Math.sin(t * 0.3 + i) * 0.4;
				const y = ((hash(i, seed + 1) * box[1] + t * 0.12 * (0.3 + hash(i, seed + 2))) % box[1]);
				const z = (hash(i, seed + 3) - 0.5) * box[2] + Math.cos(t * 0.25 + i * 1.3) * 0.4;
				return [x, y, z, size * (0.6 + hash(i, seed + 4)), 0.35 + 0.35 * Math.sin(t * 1.3 + i)];
			}}
		/>
	);
};

/** confetti: falling, tumbling coloured paper (instanced) */
const CONFETTI = ['#ff4d6d', '#ffd23f', '#3ad1ff', '#7cff6b', '#c77dff', '#ff9e3d', '#ffffff'];
export const Confetti: React.FC<{frame: number; start: number; count?: number; area?: V3; position?: V3; seed?: number}> = ({frame, start, count = 260, area = [26, 18, 18], position, seed = 9}) => {
	const ref = useRef<THREE.InstancedMesh>(null);
	const {geo, mat} = useMemo(() => {
		const geo = new THREE.PlaneGeometry(0.28, 0.42);
		const mat = new THREE.MeshStandardMaterial({side: THREE.DoubleSide, roughness: 0.5, emissive: new THREE.Color('#222222')});
		return {geo, mat};
	}, []);
	const dummy = useMemo(() => new THREE.Object3D(), []);
	const t = (frame - start) / 30;
	useLayoutEffect(() => {
		const m = ref.current;
		if (!m) return;
		for (let i = 0; i < count; i++) {
			const delay = hash(i, seed) * 1.2;
			const tt = Math.max(0, t - delay);
			const x0 = (hash(i, seed + 1) - 0.5) * area[0];
			const z0 = (hash(i, seed + 2) - 0.5) * area[2];
			const y = area[1] - tt * (1.6 + hash(i, seed + 3) * 1.4) + (hash(i, seed + 4) - 0.5) * 2;
			const sway = Math.sin(tt * (2 + hash(i, seed + 5) * 3) + i) * 0.7;
			dummy.position.set(x0 + sway, t < delay ? -50 : y, z0 + Math.cos(tt * 2 + i) * 0.4);
			dummy.rotation.set(tt * (3 + hash(i, seed + 6) * 4), tt * 2 + i, tt * (2 + hash(i, seed + 7) * 3));
			dummy.updateMatrix();
			m.setMatrixAt(i, dummy.matrix);
			m.setColorAt(i, new THREE.Color(CONFETTI[i % CONFETTI.length]));
		}
		m.instanceMatrix.needsUpdate = true;
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	});
	if (t < 0) return null;
	return <instancedMesh ref={ref} args={[geo, mat, count]} position={position} frustumCulled={false} />;
};

/** floating "z" letters from a sleeping head */
export const SleepZ: React.FC<{frame: number; position?: V3; scale?: number}> = ({frame, position, scale = 1}) => {
	const mats = useMemo(() => {
		const tex = textTex('zzz', 128, 128, null, [{text: 'z', size: 120, color: '#ffffff', y: 60, weight: 900}]);
		return [0, 1, 2].map(() => new THREE.SpriteMaterial({map: tex, transparent: true, depthWrite: false, fog: false}));
	}, []);
	const t = frame / 30;
	return (
		<group position={position} scale={scale}>
			{[0, 1, 2].map((i) => {
				const ph = (t * 0.55 + i / 3) % 1;
				mats[i].opacity = Math.sin(ph * Math.PI);
				return <sprite key={i} material={mats[i]} position={[ph * 1.6 + Math.sin(ph * 6) * 0.2, ph * 2.6, 0]} scale={[0.5 + ph * 0.7, 0.5 + ph * 0.7, 1]} />;
			})}
		</group>
	);
};

/** a little comic text sprite ("RING!", "6:00") */
export const ComicText: React.FC<{text: string; position?: V3; scale?: number; color?: string; stroke?: string; opacity?: number; rot?: number}> = ({text, position, scale = 1, color = '#ffe14a', stroke = '#1d1d24', opacity = 1, rot = 0}) => {
	const mat = useMemo(() => {
		const w = 512;
		const h = 192;
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d')!;
		ctx.font = `900 120px ${POPPINS}, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 22;
		ctx.strokeStyle = stroke;
		ctx.strokeText(text, w / 2, h / 2);
		ctx.fillStyle = color;
		ctx.fillText(text, w / 2, h / 2);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		return new THREE.SpriteMaterial({map: tex, transparent: true, depthWrite: false, depthTest: false, rotation: rot});
	}, [text, color, stroke, rot]);
	mat.opacity = opacity;
	return <sprite material={mat} position={position} scale={[scale * 2.67, scale, 1]} renderOrder={50} />;
};

/** a fat cartoon tear drop falling (for crying crowds, etc.) */
export const FallingDrops: React.FC<{frame: number; count?: number; position?: V3; seed?: number}> = ({frame, count = 4, position, seed = 1}) => {
	const t = frame / 30;
	const m = plastic('#5ab8ff', {rough: 0.1, emissive: '#2a78ff', emissiveIntensity: 0.3});
	return (
		<group position={position}>
			{Array.from({length: count}).map((_, i) => {
				const ph = (t * 1.4 + hash(i, seed)) % 1;
				return <mesh key={i} geometry={sphere(0.07, 8, 6)} material={m} position={[(hash(i, seed + 1) - 0.5) * 0.8, -ph * 1.6, 0.2]} scale={[1, 1.4, 1]} />;
			})}
		</group>
	);
};

export const Pillar: React.FC<{position?: V3; h?: number; r?: number; color?: string}> = ({position, h = 8, r = 0.6, color = '#7b7f8c'}) => (
	<mesh geometry={cyl(r, r * 1.1, h, 14)} material={plastic(color, {rough: 0.8})} position={position} castShadow receiveShadow />
);

export {mulberry32};
