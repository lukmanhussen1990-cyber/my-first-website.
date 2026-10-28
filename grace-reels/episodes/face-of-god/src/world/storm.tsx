// The night storm on Sinai and God's glory, made only of light: a swirling storm sky with an opening that
// blazes white-gold, god rays, rain, lightning bolts. Never a figure, a face or a hand. All a pure
// function of `t`.
import {useMemo} from 'react';
import * as THREE from 'three';
import {hash, mulberry32} from '../lib/random';

const NOISE = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
	return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
`;

export type Vec3 = [number, number, number];

export type StormSkyProps = {
	t: number;
	holeDir: Vec3; // where the clouds open
	hole: number; // brightness of the opening (0 = closed)
	holeSize?: number; // angular size of the opening
	top?: THREE.ColorRepresentation; // high clouds
	mid?: THREE.ColorRepresentation; // cloud bands
	low?: THREE.ColorRepresentation; // horizon haze
	glow?: THREE.ColorRepresentation; // the light
	flash?: number; // lightning lighting up the clouds (0..1)
	flashDir?: Vec3;
	swirl?: number; // how fast the clouds turn around the opening
	brightness?: number;
};

// A sky dome of storm clouds that turn slowly around the opening. The cloud bands are lit from the
// opening (warm edges) and by lightning (cool). The opening itself is a soft, blinding glow.
export const StormSky: React.FC<StormSkyProps> = (p) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uT: {value: 0},
					uHoleDir: {value: new THREE.Vector3()},
					uHole: {value: 1},
					uHoleSize: {value: 1},
					uTop: {value: new THREE.Color()},
					uMid: {value: new THREE.Color()},
					uLow: {value: new THREE.Color()},
					uGlow: {value: new THREE.Color()},
					uFlash: {value: 0},
					uFlashDir: {value: new THREE.Vector3(0, 1, 0)},
					uSwirl: {value: 1},
					uBright: {value: 1},
				},
				vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
				fragmentShader: `${NOISE}
				uniform float uT, uHole, uHoleSize, uFlash, uSwirl, uBright;
				uniform vec3 uHoleDir, uTop, uMid, uLow, uGlow, uFlashDir;
				varying vec3 vDir;
				vec3 rotAxis(vec3 v, vec3 k, float a){ return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1. - cos(a)); }
				void main(){
					vec3 d = normalize(vDir);
					vec3 ax = normalize(uHoleDir);
					float rad = acos(clamp(dot(d, ax), -1., 1.));   // angle from the opening
					// the clouds turn slowly around the opening, a little faster close to it
					vec3 dr = rotAxis(d, ax, uT * 0.035 * uSwirl + 0.5 * exp(-rad * 1.6) * uSwirl * sin(uT * 0.05));
					// project onto a cloud deck overhead, then billow it with a warped fbm
					vec2 p = dr.xz / (max(dr.y, 0.0) + 0.24) * 1.15;
					vec2 w = vec2(fbm(p * 0.7 + vec2(uT * 0.012, 0.)), fbm(p * 0.7 + vec2(5.2, -uT * 0.01)));
					float n = fbm(p * 1.05 + w * 1.7);
					float n2 = fbm(p * 2.6 - w * 0.8 + 3.1);
					float dens = smoothstep(0.32, 0.72, n);
					vec3 gaps = uTop * 0.75;
					vec3 cl = mix(uLow, uMid, smoothstep(0.45, 0.95, n + 0.25 * n2));
					vec3 col = mix(gaps, cl, dens);
					// cloud edges near the opening catch its light; the rest stays storm-dark
					float near = exp(-rad / (0.17 * uHoleSize));
					float edge = smoothstep(0.42, 0.56, n) * (1. - smoothstep(0.58, 0.82, n));
					col += uGlow * uHole * near * (0.12 * dens + 0.9 * edge + 0.2 * n2 * dens);
					// farther out only a faint silver lining
					col += mix(uGlow, vec3(0.7, 0.78, 1.0), 0.6) * uHole * exp(-rad / 0.55) * edge * 0.18;
					// the opening: a small blinding core and a short soft halo
					col += uGlow * uHole * (exp(-pow(rad / (0.045 * uHoleSize), 2.0)) * 6.0 + exp(-rad / (0.075 * uHoleSize)) * 1.1 + exp(-rad / (0.2 * uHoleSize)) * 0.18);
					// haze at the horizon
					col = mix(col, uLow * 1.15, smoothstep(0.18, -0.06, d.y) * 0.7);
					// lightning lights the clouds from inside
					float fd = max(0., dot(d, normalize(uFlashDir)));
					col += vec3(0.6, 0.68, 0.95) * uFlash * (0.15 + 0.85 * pow(fd, 4.)) * (0.3 + dens);
					col *= uBright;
					gl_FragColor = vec4(col, 1.);
				}`,
				side: THREE.BackSide,
				depthWrite: false,
				fog: false,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uT.value = p.t;
	u.uHoleDir.value.set(...p.holeDir);
	u.uHole.value = p.hole;
	u.uHoleSize.value = p.holeSize ?? 1;
	u.uTop.value.set(p.top ?? '#151b33');
	u.uMid.value.set(p.mid ?? '#3b3f5c');
	u.uLow.value.set(p.low ?? '#2a2f4a');
	u.uGlow.value.set(p.glow ?? '#ffe3a6');
	u.uFlash.value = p.flash ?? 0;
	u.uFlashDir.value.set(...(p.flashDir ?? [0, 1, 0]));
	u.uSwirl.value = p.swirl ?? 1;
	u.uBright.value = p.brightness ?? 1;
	return (
		<mesh material={mat} renderOrder={-1000} frustumCulled={false}>
			<sphereGeometry args={[900, 64, 32]} />
		</mesh>
	);
};

// Rays of light fanning from a source (the opening in the clouds) toward an area on the ground. Each ray
// is a long camera-facing ribbon, widening toward the ground, with a soft flicker. Additive.
export const GodRays: React.FC<{
	from: Vec3;
	to: Vec3;
	spread: number; // radius of the area the rays land on
	count: number;
	t: number;
	intensity: number;
	color?: THREE.ColorRepresentation;
	width0?: number;
	width1?: number;
	seed?: number;
	renderOrder?: number;
}> = ({from, to, spread, count, t, intensity, color = '#ffe2a2', width0 = 0.4, width1 = 2.4, seed = 5, renderOrder = 920}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const segs = 16;
		const pos: number[] = [];
		const uv: number[] = [];
		const ray: number[] = [];
		const idx: number[] = [];
		for (let k = 0; k < count; k++) {
			for (let i = 0; i <= segs; i++) {
				for (const side of [-1, 1]) {
					pos.push(0, 0, 0);
					uv.push(i / segs, side);
					ray.push(k);
				}
			}
			const base = k * (segs + 1) * 2;
			for (let i = 0; i < segs; i++) {
				const a = base + i * 2;
				idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
			}
		}
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		g.setAttribute('aRay', new THREE.Float32BufferAttribute(ray, 1));
		g.setIndex(idx);
		return g;
	}, [count]);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uFrom: {value: new THREE.Vector3()},
					uTo: {value: new THREE.Vector3()},
					uSpread: {value: 1},
					uW0: {value: 0.4},
					uW1: {value: 2.4},
					uT: {value: 0},
					uI: {value: 1},
					uColor: {value: new THREE.Color()},
					uSeed: {value: 5},
				},
				vertexShader: `attribute float aRay; uniform vec3 uFrom, uTo; uniform float uSpread, uW0, uW1, uT, uSeed;
					varying vec2 vUv; varying float vFlick;
					float h(float x){ return fract(sin(x * 91.17 + uSeed * 13.3) * 43758.5453); }
					void main(){
						vUv = uv;
						vec3 axis = normalize(uTo - uFrom);
						vec3 e1 = normalize(cross(axis, vec3(0.0, 0.0, 1.0)));
						vec3 e2 = cross(axis, e1);
						float a = h(aRay) * 6.2832, r = sqrt(h(aRay + 7.0)) * uSpread;
						vec3 tgt = uTo + (e1 * cos(a) + e2 * sin(a)) * r;
						vec3 P = mix(uFrom, tgt, uv.x);
						vec3 dir = normalize(tgt - uFrom);
						vec3 side = normalize(cross(dir, normalize(cameraPosition - P)));
						float w = mix(uW0, uW1, uv.x) * (0.55 + 0.9 * h(aRay + 3.0));
						P += side * w * uv.y;
						float ph = h(aRay + 11.0) * 6.28;
						vFlick = (0.55 + 0.45 * sin(uT * (0.7 + h(aRay + 5.0) * 1.3) + ph)) * (0.35 + 0.65 * h(aRay + 9.0));
						gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
					}`,
				fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec2 vUv; varying float vFlick;
					void main(){
						float across = pow(max(0.0, 1.0 - vUv.y * vUv.y), 2.2);
						float along = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.55, 1.0, vUv.x)) * (1.25 - vUv.x * 0.7);
						gl_FragColor = vec4(uColor * across * along * vFlick * uI, 1.0);
					}`,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide,
				fog: false,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uFrom.value.set(...from);
	u.uTo.value.set(...to);
	u.uSpread.value = spread;
	u.uW0.value = width0;
	u.uW1.value = width1;
	u.uT.value = t;
	u.uI.value = intensity;
	u.uColor.value.set(color);
	u.uSeed.value = seed;
	return <mesh geometry={geo} material={mat} renderOrder={renderOrder} frustumCulled={false} visible={intensity > 0.001} />;
};

// Rain: streaks falling with the wind through a box, computed in the vertex shader from `t`.
export const Rain: React.FC<{
	count: number;
	center: Vec3;
	size: Vec3;
	t: number;
	wind?: [number, number]; // x, z drift per metre of fall
	speed?: number; // m/s
	length?: number; // streak length in metres
	color?: THREE.ColorRepresentation;
	opacity?: number;
	seed?: number;
	renderOrder?: number;
}> = ({count, center, size, t, wind = [0.35, 0], speed = 14, length = 0.55, color = '#b9c6e6', opacity = 0.35, seed = 3, renderOrder = 940}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const a = new Float32Array(count * 2 * 3);
		const e = new Float32Array(count * 2);
		for (let i = 0; i < count; i++) {
			const p = [hash(seed, i, 1), hash(seed, i, 2), hash(seed, i, 3)];
			a.set(p, i * 6);
			a.set(p, i * 6 + 3);
			e[i * 2] = 0;
			e[i * 2 + 1] = 1;
		}
		g.setAttribute('position', new THREE.BufferAttribute(a, 3));
		g.setAttribute('aEnd', new THREE.BufferAttribute(e, 1));
		return g;
	}, [count, seed]);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uCenter: {value: new THREE.Vector3()},
					uSize: {value: new THREE.Vector3()},
					uT: {value: 0},
					uWind: {value: new THREE.Vector2()},
					uSpeed: {value: 14},
					uLen: {value: 0.55},
					uColor: {value: new THREE.Color()},
					uOpacity: {value: 0.35},
				},
				vertexShader: `attribute float aEnd; uniform vec3 uCenter, uSize; uniform float uT, uSpeed, uLen; uniform vec2 uWind; varying float vA;
					void main(){
						vec3 p = position;
						float fall = uT * uSpeed / uSize.y;
						p.y = fract(p.y - fall * (0.85 + 0.3 * p.x));
						vec3 w = uCenter + (p - 0.5) * uSize;
						float drop = (1.0 - p.y) * uSize.y;
						w.x += uWind.x * drop;
						w.z += uWind.y * drop;
						// the streak points back along its motion
						vec3 back = normalize(vec3(-uWind.x, 1.0, -uWind.y)) * uLen;
						w += back * aEnd;
						vA = smoothstep(0.0, 0.1, p.y) * smoothstep(1.0, 0.85, p.y) * (0.4 + 0.6 * aEnd);
						gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
					}`,
				fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
					void main(){ gl_FragColor = vec4(uColor * vA * uOpacity, 1.0); }`,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				fog: false,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uCenter.value.set(...center);
	u.uSize.value.set(...size);
	u.uT.value = t;
	u.uWind.value.set(...wind);
	u.uSpeed.value = speed;
	u.uLen.value = length;
	u.uColor.value.set(color);
	u.uOpacity.value = opacity;
	return <lineSegments geometry={geo} material={mat} renderOrder={renderOrder} frustumCulled={false} visible={opacity > 0.001} />;
};

// How bright a lightning flash is at time t (a fast double flicker that decays).
export const flashAt = (t: number, at: number) => {
	const d = t - at;
	if (d < 0 || d > 0.6) return 0;
	return Math.max(0, Math.exp(-d / 0.05) + 0.7 * Math.exp(-Math.abs(d - 0.11) / 0.03) + 0.35 * Math.exp(-Math.abs(d - 0.24) / 0.04) - 0.02);
};

// A jagged lightning bolt from the clouds down to a far peak, as a camera-facing ribbon (visible only
// while it flashes).
export const Bolt: React.FC<{from: Vec3; to: Vec3; t: number; at: number; seed: number; width?: number; color?: THREE.ColorRepresentation}> = ({
	from,
	to,
	t,
	at,
	seed,
	width = 0.9,
	color = '#dfe8ff',
}) => {
	const geo = useMemo(() => {
		// midpoint displacement, plus one short branch
		const rnd = mulberry32(seed);
		let pts = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
		let amp = new THREE.Vector3(...from).distanceTo(new THREE.Vector3(...to)) * 0.18;
		for (let level = 0; level < 6; level++) {
			const next: THREE.Vector3[] = [];
			for (let i = 0; i < pts.length - 1; i++) {
				const a = pts[i];
				const b = pts[i + 1];
				const m = a.clone().lerp(b, 0.5);
				m.x += (rnd() - 0.5) * amp;
				m.z += (rnd() - 0.5) * amp * 0.5;
				m.y += (rnd() - 0.5) * amp * 0.2;
				next.push(a, m);
			}
			next.push(pts[pts.length - 1]);
			pts = next;
			amp *= 0.52;
		}
		const pos: number[] = [];
		const uv: number[] = [];
		const dirs: number[] = [];
		const idx: number[] = [];
		const strip = (line: THREE.Vector3[], w: number) => {
			const base = pos.length / 3;
			line.forEach((p, i) => {
				const q = line[Math.min(line.length - 1, i + 1)];
				const o = line[Math.max(0, i - 1)];
				const d = q.clone().sub(o).normalize();
				for (const side of [-1, 1]) {
					pos.push(p.x, p.y, p.z);
					uv.push(i / (line.length - 1), side * w);
					dirs.push(d.x, d.y, d.z);
				}
				if (i < line.length - 1) {
					const a = base + i * 2;
					idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
				}
			});
		};
		strip(pts, 1);
		const k = Math.floor(pts.length * 0.35);
		const branch = [pts[k]];
		let p = pts[k].clone();
		for (let i = 0; i < 12; i++) {
			p = p.clone().add(new THREE.Vector3((rnd() - 0.3) * 3.5, -2.2 - rnd() * 2, (rnd() - 0.5) * 1.2));
			branch.push(p);
		}
		strip(branch, 0.55);
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		g.setAttribute('aDir', new THREE.Float32BufferAttribute(dirs, 3));
		g.setIndex(idx);
		return g;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seed]);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uW: {value: 1}, uI: {value: 0}, uColor: {value: new THREE.Color()}},
				vertexShader: `attribute vec3 aDir; uniform float uW; varying vec2 vUv;
					void main(){
						vUv = uv;
						vec3 P = position;
						vec3 side = normalize(cross(aDir, normalize(cameraPosition - P)));
						P += side * uv.y * uW;
						gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
					}`,
				fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec2 vUv;
					void main(){
						float s = abs(vUv.y);
						float core = exp(-s * s * 18.0);
						gl_FragColor = vec4(uColor * (core * 3.0 + 0.6) * uI * (1.0 - s * 0.5), 1.0);
					}`,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide,
				fog: false,
			}),
		[],
	);
	const f = flashAt(t, at);
	mat.uniforms.uW.value = width;
	mat.uniforms.uI.value = f;
	mat.uniforms.uColor.value.set(color);
	return <mesh geometry={geo} material={mat} renderOrder={930} frustumCulled={false} visible={f > 0.01} />;
};

// Time inside a shot that runs fast, then eases into slow motion at `at` (speed `slow`).
export const slowmo = (t: number, at: number, slow = 0.3, ease = 0.25) => {
	if (t <= at - ease) return t;
	// integrate a speed that blends from 1 to `slow` over `ease` seconds
	const x = Math.min(t, at) - (at - ease);
	const blend = (u: number) => u * u * (3 - 2 * u);
	let acc = 0;
	const steps = 12;
	for (let i = 0; i < steps; i++) {
		const u = (i + 0.5) / steps;
		if (u * ease > x) break;
		acc += (1 - (1 - slow) * blend(u)) * Math.min(ease / steps, x - (u - 0.5 / steps) * ease);
	}
	return at - ease + acc + Math.max(0, t - at) * slow;
};
