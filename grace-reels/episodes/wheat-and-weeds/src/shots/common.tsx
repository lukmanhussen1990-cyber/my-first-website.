// Shared pieces for the shots: grades per time of day, fog, cut-outs that face the camera and pick up the
// scene light on screen, seeds (golden and black) with their trails, dust puffs and fireflies.
import {useMemo} from 'react';
import * as THREE from 'three';
import {hash} from '../lib/random';
import {softDot} from '../lib/textures';
import type {PuppetLook} from '../characters/Puppet';
import type {CamState, FogState, Grade, Vec3} from '../render/types';
import type {Mood} from '../world/mood';

export const NIGHT_GRADE: Partial<Grade> = {exposure: 1.06, contrast: 1.1, saturation: 1.0, gain: [0.92, 0.98, 1.1], lift: [0.002, 0.004, 0.012], vignette: 0.55, bloom: 0.2, bloomThreshold: 1.05, grain: 0.02};
export const SUNRISE_GRADE: Partial<Grade> = {exposure: 1.03, contrast: 1.05, saturation: 1.06, gain: [1.05, 1.0, 0.94], lift: [0.012, 0.008, 0.01], vignette: 0.42, bloom: 0.5, bloomThreshold: 0.8, grain: 0.016};
export const DAY_GRADE: Partial<Grade> = {exposure: 1.0, contrast: 1.05, saturation: 1.05, gain: [1.02, 1.0, 0.97], vignette: 0.36, bloom: 0.3, bloomThreshold: 0.86, grain: 0.014};
export const GOLDEN_GRADE: Partial<Grade> = {exposure: 1.02, contrast: 1.07, saturation: 1.07, gain: [1.06, 1.0, 0.92], lift: [0.012, 0.007, 0.004], vignette: 0.44, bloom: 0.5, bloomThreshold: 0.78, grain: 0.015};

export const fogOf = (m: Mood, k = 1): FogState => ({color: m.fog, near: m.fogNear * k, far: m.fogFar * k});

const v3 = (a: Vec3) => new THREE.Vector3(...a);

// Yaw (and a little lean) so a cut-out standing at `p` faces the camera.
export const faceCam = (cam: CamState, p: Vec3, leanK = 0.6) => {
	const dx = cam.pos[0] - p[0];
	const dz = cam.pos[2] - p[2];
	const dy = cam.pos[1] - (p[1] + 0.9);
	return {yaw: Math.atan2(dx, dz), lean: Math.atan2(dy, Math.hypot(dx, dz)) * leanK};
};

// The scene light (sun or moon) as a direction on screen, for the cut-outs' two-tone shading.
export const screenLight = (cam: CamState, dir: Vec3): [number, number] => {
	const f = v3(cam.target).sub(v3(cam.pos)).normalize();
	const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
	const u = new THREE.Vector3().crossVectors(r, f);
	const d = v3(dir).normalize();
	const x = d.dot(r);
	const y = d.dot(u) + 0.3;
	const n = Math.hypot(x, y) || 1;
	return [x / n, y / n];
};

// How a cut-out is lit in a mood, seen from this camera.
export const lookIn = (m: Mood, cam: CamState, extra: PuppetLook = {}): PuppetLook => ({tint: m.tint, lightDir: screenLight(cam, m.sunDir), ...extra});

// ------------------------------------------------------------------------------------------------
// Seeds: small grains thrown in an arc, each one a function of time (launch, gravity, tumble, landing).
// ------------------------------------------------------------------------------------------------
export type SeedSpec = {t0: number; p0: Vec3; v0: Vec3; land: number; spin: number; seed: number};

// A handful thrown from `from` toward `dir` (a horizontal heading) at time t0; they land on y = ground.
export const throwSeeds = (o: {t0: number; from: Vec3; dir: [number, number]; n: number; speed: number; spread: number; up: number; g: number; ground: number; seed: number; dur?: number}): SeedSpec[] =>
	Array.from({length: o.n}, (_, i) => {
		const a = Math.atan2(o.dir[1], o.dir[0]) + (hash(o.seed, i, 1) - 0.5) * o.spread;
		const sp = o.speed * (0.6 + hash(o.seed, i, 2) * 0.7);
		const vy = o.up * (0.4 + hash(o.seed, i, 3) * 0.9);
		const t0 = o.t0 + hash(o.seed, i, 4) * (o.dur ?? 0.12);
		// time to fall from p0.y to the ground: p0.y + vy t - g t^2 / 2 = ground
		const h = o.from[1] - o.ground;
		const land = (vy + Math.sqrt(vy * vy + 2 * o.g * h)) / o.g;
		return {t0, p0: [o.from[0] + (hash(o.seed, i, 5) - 0.5) * 0.05, o.from[1], o.from[2] + (hash(o.seed, i, 6) - 0.5) * 0.05], v0: [Math.cos(a) * sp, vy, Math.sin(a) * sp], land, spin: 4 + hash(o.seed, i, 7) * 8, seed: hash(o.seed, i, 8)};
	});

export const seedAt = (s: SeedSpec, t: number, g: number): Vec3 | null => {
	const a = t - s.t0;
	if (a < 0) return null;
	const k = Math.min(a, s.land);
	return [s.p0[0] + s.v0[0] * k, s.p0[1] + s.v0[1] * k - 0.5 * g * k * k, s.p0[2] + s.v0[2] * k];
};

// The grains themselves (low-poly), with an optional glowing trail of where each has been.
export const Seeds: React.FC<{
	specs: SeedSpec[];
	t: number;
	g: number;
	size: number;
	color: string;
	emissive?: string;
	glow?: number;
	trail?: {len: number; color: string; px: number; opacity: number};
	hideAfter?: number; // seconds after landing when a grain disappears into the soil
	renderOrder?: number;
	rim?: [number, number, number, number]; // colour and strength of the edge light
}> = ({specs, t, g, size, color, emissive = '#000000', glow = 0, trail, hideAfter = 0.35, renderOrder = 20, rim = [0.6, 0.7, 1.0, 0]}) => {
	const mesh = useMemo(() => {
		const geo = new THREE.IcosahedronGeometry(1, 0);
		geo.scale(0.62, 1, 0.62);
		const mat = new THREE.MeshLambertMaterial({flatShading: true});
		// a thin bright rim so a dark grain still reads against a dark sky
		mat.onBeforeCompile = (sh) => {
			sh.uniforms.uRim = rimU;
			sh.fragmentShader = sh.fragmentShader
				.replace('#include <common>', '#include <common>\nuniform vec4 uRim;')
				.replace(
					'#include <emissivemap_fragment>',
					'#include <emissivemap_fragment>\nfloat fr = 1.0 - abs(dot(normal, normalize(vViewPosition)));\ntotalEmissiveRadiance += uRim.rgb * pow(fr, 2.0) * uRim.a;',
				);
		};
		const rimU = {value: new THREE.Vector4(0.6, 0.7, 1.0, 0)};
		(mat.userData as {rim?: typeof rimU}).rim = rimU;
		const m = new THREE.InstancedMesh(geo, mat, specs.length);
		m.frustumCulled = false;
		return m;
	}, [specs]);
	const mat = mesh.material as THREE.MeshLambertMaterial;
	mat.color.set(color);
	mat.emissive.set(emissive);
	mat.emissiveIntensity = glow;
	(mat.userData as {rim: {value: THREE.Vector4}}).rim.value.set(...rim);
	const m4 = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const e = new THREE.Euler();
	specs.forEach((s, i) => {
		const p = seedAt(s, t, g);
		const gone = !p || t - s.t0 > s.land + hideAfter;
		const r = (t - s.t0) * s.spin;
		e.set(r, r * 0.7 + s.seed * 6, s.seed * 3);
		q.setFromEuler(e);
		const k = gone ? 0 : size * (0.8 + s.seed * 0.4);
		m4.compose(new THREE.Vector3(...(p ?? s.p0)), q, new THREE.Vector3(k, k, k));
		mesh.setMatrixAt(i, m4);
	});
	mesh.instanceMatrix.needsUpdate = true;
	mesh.renderOrder = renderOrder;
	return (
		<>
			<primitive object={mesh} />
			{trail && <SeedTrails specs={specs} t={t} g={g} {...trail} />}
		</>
	);
};

// Each grain leaves a fading streak of light along its path (additive points sampled back in time).
const TRAIL_N = 14;
const SeedTrails: React.FC<{specs: SeedSpec[]; t: number; g: number; len: number; color: string; px: number; opacity: number}> = ({specs, t, g, len, color, px, opacity}) => {
	const {geo, mat} = useMemo(() => {
		const n = specs.length * TRAIL_N;
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
		geo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n), 1));
		const mat = new THREE.ShaderMaterial({
			uniforms: {uMap: {value: softDot()}, uColor: {value: new THREE.Color()}, uPx: {value: 10}, uOpacity: {value: 1}},
			vertexShader: `attribute float aA; uniform float uPx; varying float vA;
				void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
				gl_PointSize = uPx * (0.35 + 0.65 * aA) * (6.0 / max(0.3, -mv.z)); }`,
			fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vA;
				void main(){ float m = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(uColor * m * vA * uOpacity, 1.); }`,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		});
		return {geo, mat};
	}, [specs]);
	const pos = geo.attributes.position as THREE.BufferAttribute;
	const al = geo.attributes.aA as THREE.BufferAttribute;
	specs.forEach((s, i) => {
		for (let j = 0; j < TRAIL_N; j++) {
			const back = (j / TRAIL_N) * len;
			const tt = t - back;
			const p = seedAt(s, tt, g);
			const k = i * TRAIL_N + j;
			const alive = p && tt - s.t0 < s.land && t - s.t0 < s.land + 0.15;
			pos.setXYZ(k, ...(p ?? s.p0));
			al.setX(k, alive ? Math.pow(1 - j / TRAIL_N, 1.6) : 0);
		}
	});
	pos.needsUpdate = true;
	al.needsUpdate = true;
	mat.uniforms.uColor.value.set(color);
	mat.uniforms.uPx.value = px;
	mat.uniforms.uOpacity.value = opacity;
	return <points geometry={geo} material={mat} renderOrder={30} frustumCulled={false} />;
};

// Little puffs of soil where the grains land (non-additive, they darken a bright field a touch).
export const landPuffs = (specs: SeedSpec[], g: number, every = 2) =>
	specs
		.filter((_, i) => i % every === 0)
		.flatMap((s, i) => {
			const p = seedAt(s, s.t0 + s.land, g)!;
			return Array.from({length: 4}, (_, k) => {
				const a = hash(s.seed * 1000 + 3, i, k) * Math.PI * 2;
				return {
					birth: s.t0 + s.land,
					pos: [p[0], p[1] + 0.01, p[2]] as Vec3,
					vel: [Math.cos(a) * 0.12, 0.12 + hash(17, i, k) * 0.12, Math.sin(a) * 0.12] as Vec3,
					life: 0.5 + hash(19, i, k) * 0.4,
					size: 0.6 + hash(23, i, k) * 0.6,
					seed: hash(29, i, k),
				};
			});
		});

// Fireflies drifting over the field at night: soft yellow-green points that glow and fade.
export const Fireflies: React.FC<{t: number; center: Vec3; size: Vec3; count?: number; opacity?: number; px?: number; seed?: number}> = ({t, center, size, count = 60, opacity = 1, px = 9, seed = 3}) => {
	const {geo, mat} = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		const a = new Float32Array(count * 3);
		const r = new Float32Array(count);
		for (let i = 0; i < count; i++) {
			a.set([hash(seed, i, 1), hash(seed, i, 2), hash(seed, i, 3)], i * 3);
			r[i] = hash(seed, i, 4);
		}
		geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
		geo.setAttribute('aR', new THREE.BufferAttribute(r, 1));
		const mat = new THREE.ShaderMaterial({
			uniforms: {uMap: {value: softDot()}, uT: {value: 0}, uC: {value: new THREE.Vector3()}, uS: {value: new THREE.Vector3()}, uO: {value: 1}, uPx: {value: 9}},
			vertexShader: `attribute float aR; uniform float uT, uPx; uniform vec3 uC, uS; varying float vA;
				void main(){
					vec3 p = position;
					p.x += 0.06 * sin(uT * (0.4 + aR * 0.5) + aR * 30.0);
					p.y += 0.05 * sin(uT * (0.5 + aR * 0.3) + aR * 17.0);
					p.z += 0.06 * cos(uT * (0.35 + aR * 0.4) + aR * 11.0);
					vec4 mv = modelViewMatrix * vec4(uC + (p - 0.5) * uS, 1.);
					gl_Position = projectionMatrix * mv;
					gl_PointSize = uPx * (0.6 + 0.6 * aR) * (20.0 / max(1.0, -mv.z));
					vA = pow(0.5 + 0.5 * sin(uT * (1.2 + aR * 1.5) + aR * 40.0), 3.0);
				}`,
			fragmentShader: `uniform sampler2D uMap; uniform float uO; varying float vA;
				void main(){ float m = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vec3(1.0, 0.92, 0.45) * m * vA * uO * 1.6, 1.); }`,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		});
		return {geo, mat};
	}, [count, seed]);
	const u = mat.uniforms;
	u.uT.value = t;
	u.uC.value.set(...center);
	u.uS.value.set(...size);
	u.uO.value = opacity;
	u.uPx.value = px;
	return <points geometry={geo} material={mat} renderOrder={940} frustumCulled={false} visible={opacity > 0.001} />;
};
