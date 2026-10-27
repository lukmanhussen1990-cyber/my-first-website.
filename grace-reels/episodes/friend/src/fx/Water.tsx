// Water made in code: the pouring stream (a ribbon along a falling arc with flowing streaks), the water
// surface in the basin with spreading ripples and glints, and droplets. All pure functions of `t`.
import {useMemo} from 'react';
import * as THREE from 'three';
import {hash} from '../lib/random';
import {ParticleSpec, Particles} from './Particles';

const NOISE = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
	return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
`;

// The stream from a spout to the water surface. `flow` 0..1 scales its thickness (it starts and stops
// thin); the ribbon is billboarded around its own path so it reads as a round stream from any side.
export const PourStream: React.FC<{
	from: [number, number, number];
	to: [number, number, number];
	t: number;
	flow: number;
	width?: number;
	light?: THREE.ColorRepresentation;
	renderOrder?: number;
}> = ({from, to, t, flow, width = 0.035, light = '#ffe2b0', renderOrder = 620}) => {
	const N = 28;
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const pos = new Float32Array((N + 1) * 2 * 3);
		const uv = new Float32Array((N + 1) * 2 * 2);
		const idx: number[] = [];
		for (let i = 0; i <= N; i++) {
			uv.set([i / N, 0, i / N, 1], i * 4);
			if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
		}
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
		g.setIndex(idx);
		return g;
	}, []);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uT: {value: 0}, uLight: {value: new THREE.Color()}, uFlow: {value: 1}},
				vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
				fragmentShader: `${NOISE}
					uniform float uT, uFlow; uniform vec3 uLight; varying vec2 vUv;
					void main(){
						float across = abs(vUv.y - 0.5) * 2.0;
						float streak = vn(vec2(vUv.x * 16.0 - uT * 9.0, vUv.y * 5.0));
						float body = smoothstep(1.0, 0.55, across);
						float core = smoothstep(0.45, 0.0, abs(vUv.y - 0.38) * 2.0);
						vec3 water = vec3(0.62, 0.74, 0.8);
						vec3 col = water * 0.55 + uLight * (0.55 * core + 0.35 * streak * body);
						float a = body * (0.55 + 0.35 * streak) * smoothstep(0.0, 0.04, vUv.x);
						gl_FragColor = vec4(col, a * uFlow);
					}`,
				transparent: true,
				depthWrite: false,
				// the ribbon's winding flips with the direction of the pour: draw both faces
				side: THREE.DoubleSide,
			}),
		[],
	);
	// A falling arc: leaves the spout moving sideways, accelerates down.
	const pos = geo.attributes.position as THREE.BufferAttribute;
	const a = new THREE.Vector3(...from);
	const b = new THREE.Vector3(...to);
	const side = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
	const w = width * (0.35 + 0.65 * flow);
	for (let i = 0; i <= N; i++) {
		const s = i / N;
		const x = a.x + side.x * (1 - (1 - s) ** 2);
		const z = a.z + side.z * (1 - (1 - s) ** 2);
		const y = a.y + (b.y - a.y) * s * s;
		// the stream narrows as it falls (and wobbles a little)
		const wob = Math.sin(t * 23 + s * 9) * 0.003 * s;
		const ww = w * (1 - 0.45 * s);
		pos.setXYZ(i * 2, x - ww / 2 + wob, y, z);
		pos.setXYZ(i * 2 + 1, x + ww / 2 + wob, y, z);
	}
	pos.needsUpdate = true;
	geo.computeBoundingSphere();
	mat.uniforms.uT.value = t;
	mat.uniforms.uLight.value.set(light);
	mat.uniforms.uFlow.value = Math.min(1, flow * 3);
	return <mesh geometry={geo} material={mat} renderOrder={renderOrder} frustumCulled={false} visible={flow > 0.01} />;
};

// The water in the basin: a flat disc with soft rings spreading from where the stream (or a hand) hits,
// a warm reflection of the lamps and sparkling glints.
export const WaterSurface: React.FC<{
	position: [number, number, number];
	radius: number;
	t: number;
	hits: {at: number; x: number; z: number; amp: number}[]; // ring sources (local metres)
	fill: number; // 0..1 how full (moves the surface up a little)
	light?: THREE.ColorRepresentation;
	color?: THREE.ColorRepresentation;
	renderOrder?: number;
	aspect?: number; // if set, the surface is drawn facing the camera as an ellipse (matches a painted basin)
}> = ({position, radius, t, hits, fill, light = '#ffd9a0', color = '#7d97a0', renderOrder = 610, aspect}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uT: {value: 0},
					uR: {value: 1},
					uHits: {value: Array.from({length: 8}, () => new THREE.Vector4())},
					uLight: {value: new THREE.Color()},
					uColor: {value: new THREE.Color()},
					uFill: {value: 1},
				},
				vertexShader: `varying vec2 vP; uniform float uR; void main(){ vP = position.xy * uR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy * uR, position.z, 1.); }`,
				fragmentShader: `${NOISE}
					uniform float uT, uR, uFill; uniform vec4 uHits[8]; uniform vec3 uLight, uColor; varying vec2 vP;
					void main(){
						float r = length(vP) / uR;
						float ring = 0.0;
						for (int i = 0; i < 8; i++) {
							vec4 h = uHits[i];
							float age = uT - h.x;
							if (age < 0.0 || h.w <= 0.0) continue;
							float d = length(vP - h.yz);
							float front = age * 0.32;
							float w = 0.012 + age * 0.01;
							ring += h.w * exp(-pow((d - front) / w, 2.0)) * exp(-age * 1.6) * smoothstep(0.0, 0.02, d);
							ring += h.w * 0.6 * exp(-pow((d - front * 0.62) / w, 2.0)) * exp(-age * 2.2);
						}
						float sheen = vn(vP * 26.0 + vec2(uT * 0.4, -uT * 0.3));
						vec3 col = uColor * (0.75 + 0.25 * sheen);
						// a warm reflected highlight of the lamps, slightly off centre
						col += uLight * (0.55 * exp(-pow(length(vP / uR - vec2(-0.25, 0.2)) * 2.4, 2.0)) + 0.9 * ring);
						float glint = step(0.93, vn(vP * 60.0 + vec2(floor(uT * 6.0) * 3.1, 0.0))) * 0.7;
						col += uLight * glint * (0.4 + ring);
						float edge = smoothstep(1.0, 0.94, r);
						gl_FragColor = vec4(col, 0.92 * edge * uFill);
					}`,
				transparent: true,
				depthWrite: false,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uT.value = t;
	u.uR.value = radius;
	u.uLight.value.set(light);
	u.uColor.value.set(color);
	u.uFill.value = Math.min(1, fill * 4);
	const arr = u.uHits.value as THREE.Vector4[];
	const recent = hits.filter((h) => t >= h.at && t - h.at < 2.5).slice(-8);
	arr.forEach((v, i) => {
		const h = recent[i];
		if (h) v.set(h.at, h.x, h.z, h.amp);
		else v.set(0, 0, 0, 0);
	});
	if (aspect !== undefined)
		return (
			<mesh position={[position[0], position[1] + 0.02 * fill * aspect, position[2]]} scale={[1, aspect, 1]} material={mat} renderOrder={renderOrder} visible={fill > 0.001}>
				<circleGeometry args={[1, 48]} />
			</mesh>
		);
	return (
		<mesh position={[position[0], position[1] + 0.02 * fill, position[2]]} rotation-x={-Math.PI / 2} material={mat} renderOrder={renderOrder} visible={fill > 0.001}>
			<circleGeometry args={[1, 48]} />
		</mesh>
	);
};

// Droplets thrown up where the stream lands (non-additive, pale and warm).
export const splashSpecs = (t0: number, t1: number, at: [number, number, number], rate: number, seed: number): ParticleSpec[] => {
	const n = Math.max(0, Math.round((t1 - t0) * rate));
	return Array.from({length: n}, (_, i) => {
		const a = hash(seed, i) * Math.PI * 2;
		const sp = 0.25 + hash(seed + 1, i) * 0.45;
		return {
			birth: t0 + (i / n) * (t1 - t0),
			pos: [at[0], at[1] + 0.01, at[2]] as [number, number, number],
			vel: [Math.cos(a) * sp * 0.5, 0.6 + hash(seed + 2, i) * 0.7, Math.sin(a) * sp * 0.5] as [number, number, number],
			life: 0.28 + hash(seed + 3, i) * 0.25,
			size: 0.4 + hash(seed + 4, i) * 0.5,
			seed: hash(seed + 5, i),
		};
	});
};

export const Splash: React.FC<{specs: ParticleSpec[]; t: number; px?: number; renderOrder?: number}> = ({specs, t, px = 6, renderOrder = 630}) => (
	<Particles specs={specs} t={t} gravity={-6} drag={0.2} additive colors={['#fff4dc', '#e8f0f0', '#9fb6be']} opacity={0.7} px={px} swirl={0} renderOrder={renderOrder} />
);
