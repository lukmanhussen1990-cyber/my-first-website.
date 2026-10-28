// The whirlwind that takes Elijah up: a twisting funnel of dust and light (back and front halves so the
// rider sits inside it), debris spiralling upward, and a dust skirt at the ground. All driven by time.
import {useMemo} from 'react';
import * as THREE from 'three';
import {hash} from '../lib/random';
import {softDot} from '../lib/textures';
import {FIRE_GLSL} from './FireTeam';

const funnelGeo = (height: number, r0: number, r1: number) => {
	const pts: THREE.Vector2[] = [];
	for (let i = 0; i <= 40; i++) {
		const y = (i / 40) * height;
		const f = y / height;
		pts.push(new THREE.Vector2(r0 + (r1 - r0) * Math.pow(f, 1.6) + 0.25 * Math.sin(f * 9), y));
	}
	return new THREE.LatheGeometry(pts, 72);
};

const makeFunnelMat = (side: THREE.Side) =>
	new THREE.ShaderMaterial({
		uniforms: {uT: {value: 0}, uS: {value: 0}, uDust: {value: new THREE.Color('#b9a07c')}, uLight: {value: new THREE.Color('#ffe4a6')}, uSpeed: {value: 1}},
		vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
			void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
		fragmentShader: `${FIRE_GLSL}
			uniform float uT, uS, uSpeed; uniform vec3 uDust, uLight; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
			void main(){
				float y = vUv.y;
				float a = vUv.x * 6.28318;
				float sp = pow(sin(a * 3. + y * 22. - uT * 8. * uSpeed) * 0.5 + 0.5, 1.6);
				float n = fbm(vec2(vUv.x * 9. + y * 5. - uT * 1.6 * uSpeed, y * 7. - uT * 2.4));
				float band = smoothstep(0.25, 0.8, sp * 0.55 + n * 0.75);
				float edge = 1. - abs(dot(normalize(vN), normalize(vV)));
				float alpha = band * (0.12 + 0.88 * pow(edge, 0.8)) * uS * smoothstep(0., 0.04, y) * smoothstep(1., 0.6, y);
				vec3 col = mix(uDust * (0.75 + 0.5 * sp), uLight, smoothstep(0.35, 1.0, y) * 0.55 + 0.25 * n * sp);
				gl_FragColor = vec4(col * alpha, alpha * 0.85);
			}`,
		transparent: true,
		premultipliedAlpha: true,
		depthWrite: false,
		side,
		fog: false,
	});

// One spiral band of dust wound around the axis (a barber-pole twist); spinning it makes it climb.
const ribbonGeo = (height: number, r0: number, r1: number, turns: number, width: number, phase: number) => {
	const n = 220;
	const pos: number[] = [];
	const uv: number[] = [];
	const idx: number[] = [];
	for (let i = 0; i <= n; i++) {
		const f = i / n;
		const th = phase + turns * Math.PI * 2 * f;
		const r = r0 + (r1 - r0) * Math.pow(f, 1.6);
		const y = f * height;
		const w = width * (0.6 + 1.8 * f);
		pos.push(Math.cos(th) * r, y, Math.sin(th) * r, Math.cos(th) * r * 1.04, y + w, Math.sin(th) * r * 1.04);
		uv.push(f, 0, f, 1);
		if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	return g;
};

const makeRibbonMat = (near: boolean) =>
	new THREE.ShaderMaterial({
		uniforms: {uT: {value: 0}, uS: {value: 0}, uDust: {value: new THREE.Color()}, uLight: {value: new THREE.Color()}, uAxis: {value: new THREE.Vector3()}, uSeed: {value: 0}},
		vertexShader: `varying vec2 vUv; varying vec3 vW;
			void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
		fragmentShader: `${FIRE_GLSL}
			uniform float uT, uS, uSeed; uniform vec3 uDust, uLight, uAxis; varying vec2 vUv; varying vec3 vW;
			void main(){
				// keep only the half of the band on this side of the axis (seen from the camera)
				vec3 toCam = normalize(cameraPosition - uAxis);
				vec2 d = vW.xz - uAxis.xz;
				float side = dot(d, normalize(toCam.xz));
				if (${near ? 'side < 0.' : 'side >= 0.'}) discard;
				float across = vUv.y;
				float n = fbm(vec2(vUv.x * 26. - uT * 1.3 + uSeed, across * 3. + uSeed));
				float body = smoothstep(0., 0.35, across) * smoothstep(1., 0.55, across);
				float streak = smoothstep(0.25, 0.75, n);
				float alpha = body * (0.35 + 0.65 * streak) * uS * smoothstep(0., 0.03, vUv.x) * smoothstep(1., 0.7, vUv.x);
				vec3 col = mix(uDust * (0.7 + 0.45 * n), uLight, smoothstep(0.45, 1.0, vUv.x) * 0.6);
				col *= ${near ? '1.0' : '0.72'};
				gl_FragColor = vec4(col * alpha * 0.9, alpha * 0.9);
			}`,
		transparent: true,
		premultipliedAlpha: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		fog: false,
	});

// Debris spiralling up the funnel (computed in the vertex shader from time).
const makeDebris = (count: number, height: number, seed: number) => {
	const g = new THREE.BufferGeometry();
	const a = new Float32Array(count * 4);
	for (let i = 0; i < count; i++) a.set([hash(seed, i) * 6.283, hash(seed, i, 1), 0.6 + hash(seed, i, 2) * 0.9, hash(seed, i, 3)], i * 4);
	g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
	g.setAttribute('aD', new THREE.BufferAttribute(a, 4));
	const mat = new THREE.ShaderMaterial({
		uniforms: {uMap: {value: softDot()}, uT: {value: 0}, uS: {value: 0}, uH: {value: height}, uR0: {value: 1}, uR1: {value: 6}, uPx: {value: 8}, uC: {value: new THREE.Color('#6b5640')}, uL: {value: new THREE.Color('#ffe8b0')}},
		vertexShader: `attribute vec4 aD; uniform float uT, uS, uH, uR0, uR1, uPx; varying float vF; varying float vK;
			void main(){
				float f = fract(aD.y + uT * 0.09 * aD.z);
				float y = f * uH;
				float r = (uR0 + (uR1 - uR0) * pow(f, 1.6)) * (0.75 + 0.5 * aD.w);
				float ang = aD.x + uT * (3.2 + 2.0 * aD.w) / (0.6 + f * 1.8);
				vec3 p = vec3(cos(ang) * r, y, sin(ang) * r);
				vec4 mv = modelViewMatrix * vec4(p, 1.);
				gl_Position = projectionMatrix * mv;
				vF = f; vK = aD.w;
				gl_PointSize = uPx * (0.5 + aD.w) * uS * smoothstep(0., 0.05, f) * smoothstep(1., 0.7, f) * (30. / max(0.5, -mv.z));
			}`,
		fragmentShader: `uniform sampler2D uMap; uniform vec3 uC, uL; uniform float uS; varying float vF; varying float vK;
			void main(){ float m = texture2D(uMap, gl_PointCoord).a; vec3 c = vK > 0.82 ? uL * 1.6 : uC; float a = m * (vK > 0.82 ? 0.9 : 0.75);
				gl_FragColor = vec4(c * a, a); }`,
		transparent: true,
		premultipliedAlpha: true,
		depthWrite: false,
	});
	return {g, mat};
};

export const Whirlwind: React.FC<{
	position: [number, number, number];
	strength: number; // 0..1
	t: number;
	height?: number;
	r0?: number;
	r1?: number;
	lite?: boolean;
	dust?: string;
	light?: string;
	order?: number; // renderOrder of whatever rides inside (back half draws before, front half after)
}> = ({position, strength, t, height = 34, r0 = 0.9, r1 = 7.5, lite = false, dust = '#b9a07c', light = '#ffe4a6', order = 100}) => {
	const res = useMemo(() => {
		const geo = funnelGeo(height, r0, r1);
		const geoIn = funnelGeo(height, r0 * 0.6, r1 * 0.7);
		const ribbons = Array.from({length: lite ? 4 : 6}, (_, i) => ({
			geo: ribbonGeo(height, r0 * (1.05 + 0.25 * (i % 2)), r1 * (0.9 + 0.12 * (i % 3)), 3.2 + 0.4 * (i % 3), 0.55 + 0.2 * (i % 2), (i / (lite ? 4 : 6)) * Math.PI * 2),
			far: makeRibbonMat(false),
			near: makeRibbonMat(true),
			speed: 2.6 + 0.5 * (i % 3),
		}));
		return {
			geo,
			geoIn,
			ribbons,
			back: makeFunnelMat(THREE.BackSide),
			front: makeFunnelMat(THREE.FrontSide),
			inner: makeFunnelMat(THREE.DoubleSide),
			debris: makeDebris(lite ? 260 : 700, height, 77),
		};
	}, [height, r0, r1, lite]);
	res.ribbons.forEach((r, i) => {
		for (const m of [r.far, r.near]) {
			m.uniforms.uT.value = t;
			m.uniforms.uS.value = Math.min(1, strength * 1.2);
			m.uniforms.uDust.value.set(dust);
			m.uniforms.uLight.value.set(light);
			m.uniforms.uAxis.value.set(...position);
			m.uniforms.uSeed.value = i * 3.7;
		}
	});
	for (const [m, sp] of [[res.back, 1], [res.front, 1], [res.inner, 1.6]] as const) {
		m.uniforms.uT.value = t;
		m.uniforms.uS.value = strength * (m === res.inner ? 0.3 : 0.45);
		m.uniforms.uSpeed.value = sp;
		m.uniforms.uDust.value.set(dust);
		m.uniforms.uLight.value.set(light);
	}
	const d = res.debris.mat.uniforms;
	d.uT.value = t;
	d.uS.value = Math.min(1, strength * 1.4);
	d.uR0.value = r0;
	d.uR1.value = r1;
	if (strength <= 0.001) return null;
	return (
		<group position={position}>
			<mesh geometry={res.geo} material={res.back} renderOrder={order - 4} />
			<mesh geometry={res.geoIn} material={res.inner} renderOrder={order - 3} rotation-y={1.3} />
			{res.ribbons.map((r, i) => (
				<mesh key={`f${i}`} geometry={r.geo} material={r.far} renderOrder={order - 2} rotation-y={-t * r.speed} frustumCulled={false} />
			))}
			<points geometry={res.debris.g} material={res.debris.mat} renderOrder={order + 8} frustumCulled={false} />
			{res.ribbons.map((r, i) => (
				<mesh key={`n${i}`} geometry={r.geo} material={r.near} renderOrder={order + 6} rotation-y={-t * r.speed} frustumCulled={false} />
			))}
			<mesh geometry={res.geo} material={res.front} renderOrder={order + 7} />
		</group>
	);
};
