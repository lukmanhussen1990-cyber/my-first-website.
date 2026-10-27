import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {rng} from '../math';
import {useShot, type Vec3} from './shot';

let spriteTex: THREE.Texture | null = null;
const softDot = () => {
	if (spriteTex) return spriteTex;
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d')!;
	const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	grd.addColorStop(0, 'rgba(255,255,255,1)');
	grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
	grd.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = grd;
	g.fillRect(0, 0, 64, 64);
	spriteTex = new THREE.CanvasTexture(c);
	return spriteTex;
};

// Floating dust motes in a box; positions are a pure function of time.
export const Dust: React.FC<{
	count?: number;
	box: [Vec3, Vec3];
	size?: number;
	opacity?: number;
	color?: THREE.ColorRepresentation;
	seed?: number;
	speed?: number;
	burst?: number;
}> = ({count = 160, box, size = 0.05, opacity = 0.7, color, seed = 1, speed = 1}) => {
	const shot = useShot();
	const {geo, mat, base} = useMemo(() => {
		const r = rng(seed);
		const base = new Float32Array(count * 4);
		for (let i = 0; i < count; i++) base.set([r(), r(), r(), r()], i * 4);
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
		const mat = new THREE.PointsMaterial({map: softDot(), size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false});
		return {geo, mat, base};
	}, [count, seed, size]);
	useLayoutEffect(() => () => {
		geo.dispose();
		mat.dispose();
	}, [geo, mat]);
	useLayoutEffect(() => {
		const [a, b] = box;
		const pos = geo.attributes.position as THREE.BufferAttribute;
		const T = shot.T * speed;
		for (let i = 0; i < count; i++) {
			const [u, v, w, ph] = [base[i * 4], base[i * 4 + 1], base[i * 4 + 2], base[i * 4 + 3]];
			const x = a[0] + ((u + 0.01 * T + 0.02 * Math.sin(T * 0.4 + ph * 9)) % 1) * (b[0] - a[0]);
			const y = a[1] + ((v + 0.006 * T * (0.5 + ph)) % 1) * (b[1] - a[1]);
			const z = a[2] + ((w + 0.015 * Math.sin(T * 0.3 + ph * 7)) % 1 + 1) % 1 * (b[2] - a[2]);
			pos.setXYZ(i, x, y, z);
		}
		pos.needsUpdate = true;
		mat.color.copy(color ? new THREE.Color(color) : shot.sun.glow.clone().lerp(new THREE.Color('#ffffff'), 0.5));
		mat.opacity = opacity;
	});
	return <points geometry={geo} material={mat} frustumCulled={false} />;
};

const shaftVert = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
	vUv = uv;
	vec4 wp = modelMatrix * vec4(position, 1.0);
	vN = normalize(mat3(modelMatrix) * normal);
	vV = normalize(cameraPosition - wp.xyz);
	gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const shaftFrag = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
	float along = smoothstep(0.0, 0.15, vUv.y) * (0.35 + 0.65 * vUv.y);
	float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
	gl_FragColor = vec4(uColor * uOpacity * along * edge, 1.0);
}`;

// A volumetric-looking beam (additive open cylinder) from `from` toward `to`.
export const LightShaft: React.FC<{from: Vec3; to: Vec3; r0: number; r1: number; opacity?: number; color?: THREE.ColorRepresentation}> = ({
	from,
	to,
	r0,
	r1,
	opacity = 0.25,
	color,
}) => {
	const shot = useShot();
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: shaftVert,
				fragmentShader: shaftFrag,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				side: THREE.DoubleSide,
				uniforms: {uColor: {value: new THREE.Color()}, uOpacity: {value: opacity}},
			}),
		[opacity],
	);
	useLayoutEffect(() => () => mat.dispose(), [mat]);
	useLayoutEffect(() => {
		mat.uniforms.uColor.value.copy(color ? new THREE.Color(color) : shot.sun.light.clone().lerp(new THREE.Color('#ffffff'), 0.3));
		mat.uniforms.uOpacity.value = opacity;
	});
	const a = new THREE.Vector3(...from);
	const b = new THREE.Vector3(...to);
	const L = a.distanceTo(b);
	const mid = a.clone().add(b).multiplyScalar(0.5);
	const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
	return (
		<mesh position={mid} quaternion={q} material={mat} renderOrder={5}>
			<cylinderGeometry args={[r0, r1, L, 24, 1, true]} />
		</mesh>
	);
};

let glowTex: THREE.Texture | null = null;
const glowTexture = () => {
	if (glowTex) return glowTex;
	const c = document.createElement('canvas');
	c.width = c.height = 256;
	const g = c.getContext('2d')!;
	const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
	grd.addColorStop(0, 'rgba(255,255,255,1)');
	grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
	grd.addColorStop(0.6, 'rgba(255,255,255,0.14)');
	grd.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = grd;
	g.fillRect(0, 0, 256, 256);
	glowTex = new THREE.CanvasTexture(c);
	return glowTex;
};

// Soft additive light blob (anger/grief auras, healing light, glints)
export const Glow: React.FC<{at: Vec3; size: number | [number, number]; color: THREE.ColorRepresentation; opacity?: number; depthTest?: boolean; renderOrder?: number}> = ({
	at,
	size,
	color,
	opacity = 1,
	depthTest = true,
	renderOrder = 6,
}) => {
	const mat = useMemo(
		() => new THREE.SpriteMaterial({map: glowTexture(), transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending, fog: false}),
		[depthTest],
	);
	useLayoutEffect(() => () => mat.dispose(), [mat]);
	useLayoutEffect(() => {
		mat.color.set(color);
		mat.opacity = opacity;
	});
	const s = Array.isArray(size) ? size : [size, size];
	return <sprite position={at} scale={[s[0], s[1], 1]} material={mat} renderOrder={renderOrder} />;
};

// Sparkles flowing along paths (healing light into the hand)
export const Sparks: React.FC<{points: Vec3[]; size?: number; color?: THREE.ColorRepresentation; opacity?: number}> = ({points, size = 0.05, color = '#FFE7A8', opacity = 1}) => {
	const {geo, mat} = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(points.length, 1) * 3), 3));
		const mat = new THREE.PointsMaterial({map: softDot(), size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false});
		return {geo, mat};
	}, [points.length, size]);
	useLayoutEffect(() => () => {
		geo.dispose();
		mat.dispose();
	}, [geo, mat]);
	useLayoutEffect(() => {
		const pos = geo.attributes.position as THREE.BufferAttribute;
		points.forEach((p, i) => pos.setXYZ(i, ...p));
		pos.needsUpdate = true;
		geo.setDrawRange(0, points.length);
		mat.color.set(color);
		mat.opacity = opacity;
	});
	return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={7} />;
};
