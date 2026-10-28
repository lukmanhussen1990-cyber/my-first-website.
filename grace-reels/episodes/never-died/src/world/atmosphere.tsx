// Sky dome, light beams, floating dust, river ribbon and footprint decals. All time-driven by `t`.
import {useMemo} from 'react';
import * as THREE from 'three';
import {hash} from '../lib/random';
import {footprintTexture, softDot} from '../lib/textures';

const NOISE = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
	return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
`;

export type SkyParams = {
	top: THREE.ColorRepresentation;
	mid?: THREE.ColorRepresentation; // optional colour between horizon and top (avoids a grey blend)
	horizon: THREE.ColorRepresentation;
	bottom: THREE.ColorRepresentation;
	sunDir: [number, number, number];
	sunColor: THREE.ColorRepresentation;
	sunSize?: number;
	sunGlow?: number;
	storm?: number;
	stormA?: THREE.ColorRepresentation;
	stormB?: THREE.ColorRepresentation;
	hole?: number;
	holeDir?: [number, number, number];
	holeColor?: THREE.ColorRepresentation;
	curve?: number; // gradient exponent: higher keeps the low sky warm longer
	t: number;
};

export const Sky: React.FC<SkyParams> = (p) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uTop: {value: new THREE.Color()},
					uMid: {value: new THREE.Color()},
					uHasMid: {value: 0},
					uHorizon: {value: new THREE.Color()},
					uBottom: {value: new THREE.Color()},
					uSunDir: {value: new THREE.Vector3()},
					uSunColor: {value: new THREE.Color()},
					uSunSize: {value: 1},
					uSunGlow: {value: 0.4},
					uStorm: {value: 0},
					uStormA: {value: new THREE.Color()},
					uStormB: {value: new THREE.Color()},
					uHole: {value: 0},
					uHoleDir: {value: new THREE.Vector3(0, 1, 0)},
					uHoleColor: {value: new THREE.Color()},
					uTime: {value: 0},
					uCurve: {value: 0.55},
				},
				vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
				fragmentShader: `${NOISE}
				uniform vec3 uTop,uMid,uHorizon,uBottom,uSunDir,uSunColor,uStormA,uStormB,uHoleDir,uHoleColor;
				uniform float uSunSize,uSunGlow,uStorm,uHole,uTime,uCurve,uHasMid;
				varying vec3 vDir;
				void main(){
					vec3 d = normalize(vDir);
					float h = d.y;
					float g = pow(smoothstep(0., 1., h), uCurve);
					vec3 up = uHasMid > 0.5 ? (g < 0.3 ? mix(uHorizon, uMid, g / 0.3) : mix(uMid, uTop, (g - 0.3) / 0.7)) : mix(uHorizon, uTop, g);
					vec3 col = h > 0. ? up : mix(uHorizon, uBottom, smoothstep(0., -0.25, h));
					float sd = max(0., dot(d, normalize(uSunDir)));
					col += uSunColor * (smoothstep(1. - 0.0009 * uSunSize, 1. - 0.0006 * uSunSize, sd) * 1.6 + pow(sd, 10.) * uSunGlow + pow(sd, 3.) * uSunGlow * 0.25);
					if (uStorm > 0.) {
						vec3 ax = normalize(uHoleDir);
						float ang = atan(d.z, d.x);
						float rad = acos(clamp(dot(d, ax), -1., 1.));
						float sw = fbm(vec2(ang * 2.2 + rad * 5.0 - uTime * 0.18, rad * 6.0 - uTime * 0.05));
						float bands = smoothstep(0.35, 0.75, sw);
						vec3 sc = mix(uStormA, uStormB, bands);
						col = mix(col, sc, uStorm * smoothstep(-0.05, 0.25, h));
					}
					if (uHole > 0.) {
						float hd = max(0., dot(d, normalize(uHoleDir)));
						col += uHoleColor * uHole * (pow(hd, 90.) * 3.0 + pow(hd, 12.) * 0.9 + pow(hd, 3.) * 0.18);
					}
					gl_FragColor = vec4(col, 1.);
				}`,
				side: THREE.BackSide,
				depthWrite: false,
				fog: false,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uTop.value.set(p.top);
	u.uHasMid.value = p.mid ? 1 : 0;
	if (p.mid) u.uMid.value.set(p.mid);
	u.uHorizon.value.set(p.horizon);
	u.uBottom.value.set(p.bottom);
	u.uSunDir.value.set(...p.sunDir);
	u.uSunColor.value.set(p.sunColor);
	u.uSunSize.value = p.sunSize ?? 1;
	u.uSunGlow.value = p.sunGlow ?? 0.4;
	u.uStorm.value = p.storm ?? 0;
	u.uStormA.value.set(p.stormA ?? '#3b3a52');
	u.uStormB.value.set(p.stormB ?? '#6b5a6e');
	u.uHole.value = p.hole ?? 0;
	u.uHoleDir.value.set(...(p.holeDir ?? [0, 1, 0]));
	u.uHoleColor.value.set(p.holeColor ?? '#ffd27a');
	u.uTime.value = p.t;
	u.uCurve.value = p.curve ?? 0.55;
	return (
		<mesh material={mat} renderOrder={-1000} frustumCulled={false}>
			<sphereGeometry args={[900, 48, 24]} />
		</mesh>
	);
};

// Soft volumetric beam (open cone): additive, brightest where it faces the camera, with a hot inner core.
export const LightBeam: React.FC<{
	position: [number, number, number];
	height: number;
	rTop: number;
	rBottom: number;
	color?: THREE.ColorRepresentation;
	intensity: number;
	t: number;
	tilt?: [number, number];
	renderOrder?: number;
	core?: number; // strength of the narrow inner column
}> = ({position, height, rTop, rBottom, color = '#ffe9b5', intensity, t, tilt = [0, 0], renderOrder = 900, core = 0.8}) => {
	const make = () =>
		new THREE.ShaderMaterial({
			uniforms: {uColor: {value: new THREE.Color()}, uI: {value: 0}, uT: {value: 0}, uH: {value: 40}, uPow: {value: 2.2}},
			vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
				void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz);
				vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
			fragmentShader: `${NOISE}
				uniform vec3 uColor; uniform float uI, uT, uH, uPow; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
				void main(){
					float f = abs(dot(normalize(vN), normalize(vV)));
					float c = pow(f, uPow);
					float y = vUv.y * uH;
					float vert = smoothstep(0.0, 0.35, y) * smoothstep(uH, uH * 0.3, y) * (1.0 + 0.6 * exp(-y * 0.6));
					float streak = 0.72 + 0.28 * fbm(vec2(vUv.x * 18.0, vUv.y * 2.0 - uT * 0.12));
					gl_FragColor = vec4(uColor * c * vert * streak * uI, 1.);
				}`,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			side: THREE.DoubleSide,
			fog: false,
		});
	const mats = useMemo(() => [make(), make()], []);
	mats.forEach((m, i) => {
		m.uniforms.uColor.value.set(color);
		m.uniforms.uI.value = i === 0 ? intensity : intensity * core;
		m.uniforms.uT.value = t + i * 3.7;
		m.uniforms.uH.value = height;
		m.uniforms.uPow.value = i === 0 ? 2.2 : 4.0;
	});
	return (
		<group position={[position[0], position[1] + height / 2, position[2]]} rotation={[tilt[0], 0, tilt[1]]} visible={intensity > 0.001}>
			<mesh material={mats[0]} renderOrder={renderOrder}>
				<cylinderGeometry args={[rTop, rBottom, height, 40, 1, true]} />
			</mesh>
			<mesh material={mats[1]} renderOrder={renderOrder + 1}>
				<cylinderGeometry args={[rTop * 0.35, rBottom * 0.45, height, 32, 1, true]} />
			</mesh>
		</group>
	);
};

// Floating motes in a box, drifting upward with a gentle swirl. Computed in the vertex shader from `t`.
export const Dust: React.FC<{
	count: number;
	center: [number, number, number];
	size: [number, number, number];
	t: number;
	color?: THREE.ColorRepresentation;
	opacity?: number;
	px?: number;
	rise?: number;
	seed?: number;
	swirl?: number;
	renderOrder?: number;
}> = ({count, center, size, t, color = '#ffe1a0', opacity = 1, px = 9, rise = 0.12, seed = 1, swirl = 0, renderOrder = 950}) => {
	const geo = useMemo(() => {
		const g = new THREE.BufferGeometry();
		const a = new Float32Array(count * 3);
		const r = new Float32Array(count);
		for (let i = 0; i < count; i++) {
			a.set([hash(seed, i, 1), hash(seed, i, 2), hash(seed, i, 3)], i * 3);
			r[i] = hash(seed, i, 4);
		}
		g.setAttribute('position', new THREE.BufferAttribute(a, 3));
		g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
		return g;
	}, [count, seed]);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {
					uMap: {value: softDot()},
					uColor: {value: new THREE.Color()},
					uCenter: {value: new THREE.Vector3()},
					uSize: {value: new THREE.Vector3()},
					uT: {value: 0},
					uOpacity: {value: 1},
					uPx: {value: 9},
					uRise: {value: 0.12},
					uSwirl: {value: 0},
				},
				vertexShader: `attribute float aR; uniform vec3 uCenter, uSize; uniform float uT, uPx, uRise, uSwirl; varying float vA;
					void main(){
						vec3 p = position;
						p.y = fract(p.y + uT * uRise * (0.5 + aR));
						float a = uT * (0.3 + aR * 0.4) + aR * 40.0;
						p.x += 0.04 * sin(a) + uSwirl * 0.1 * sin(uT * 0.9 + aR * 20.0);
						p.z += 0.04 * cos(a * 1.3);
						vec3 w = uCenter + (p - 0.5) * uSize;
						vec4 mv = modelViewMatrix * vec4(w, 1.);
						gl_Position = projectionMatrix * mv;
						gl_PointSize = uPx * (0.5 + aR) * (30.0 / -mv.z);
						vA = smoothstep(0.0, 0.15, p.y) * smoothstep(1.0, 0.8, p.y) * (0.55 + 0.45 * sin(uT * 2.0 + aR * 50.0));
					}`,
				fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vA;
					void main(){ float m = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(uColor * m * vA * uOpacity, 1.); }`,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uColor.value.set(color);
	u.uCenter.value.set(...center);
	u.uSize.value.set(...size);
	u.uT.value = t;
	u.uOpacity.value = opacity;
	u.uPx.value = px;
	u.uRise.value = rise;
	u.uSwirl.value = swirl;
	return <points geometry={geo} material={mat} renderOrder={renderOrder} frustumCulled={false} visible={opacity > 0.001} />;
};

// River ribbon along a curve with drifting pale ripple dashes.
export const River: React.FC<{curve: THREE.Curve<THREE.Vector3>; width: number; t: number; color?: string; light?: string}> = ({
	curve,
	width,
	t,
	color = '#6f8fa0',
	light = '#c9dde2',
}) => {
	const geo = useMemo(() => {
		const n = 160;
		const pos: number[] = [];
		const uv: number[] = [];
		const idx: number[] = [];
		for (let i = 0; i <= n; i++) {
			const u = i / n;
			const p = curve.getPointAt(u);
			const tg = curve.getTangentAt(u);
			const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(width / 2);
			pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z);
			uv.push(u, 0, u, 1);
			if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		g.setIndex(idx);
		g.computeVertexNormals();
		return g;
	}, [curve, width]);
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uC: {value: new THREE.Color()}, uL: {value: new THREE.Color()}, uT: {value: 0}, uLen: {value: 1}},
				// Preprocessor lines (#include, which expand to #ifdef ... #endif) must sit on lines of their own.
				vertexShader: `varying vec2 vUv;
					#include <fog_pars_vertex>
					void main(){
						vUv = uv;
						vec4 mvPosition = modelViewMatrix * vec4(position,1.);
						gl_Position = projectionMatrix * mvPosition;
						#include <fog_vertex>
					}`,
				fragmentShader: `${NOISE}
					uniform vec3 uC, uL; uniform float uT, uLen; varying vec2 vUv;
					#include <fog_pars_fragment>
					void main(){
						float across = abs(vUv.y - 0.5) * 2.0;
						vec3 col = mix(uC, uC * 0.82, smoothstep(0.55, 1.0, across));
						float along = vUv.x * uLen;
						float lane = floor(vUv.y * 7.0);
						float dash = step(0.72, fract(along * 0.55 - uT * 0.12 + h21(vec2(lane, 3.0)) * 7.0));
						float inLane = smoothstep(0.35, 0.45, fract(vUv.y * 7.0)) * smoothstep(0.65, 0.55, fract(vUv.y * 7.0));
						col = mix(col, uL, dash * inLane * 0.7 * (1.0 - across * 0.6));
						gl_FragColor = vec4(col, 1.);
						#include <fog_fragment>
					}`,
				fog: true,
			}),
		[],
	);
	mat.uniforms.uC.value.set(color);
	mat.uniforms.uL.value.set(light);
	mat.uniforms.uT.value = t;
	mat.uniforms.uLen.value = curve.getLength();
	return <mesh geometry={geo} material={mat} receiveShadow />;
};

// Sandal prints that appear when a foot lands (decals lying on the ground).
export const Footprints: React.FC<{prints: {x: number; y: number; z: number; at: number; flip?: boolean}[]; t: number; color?: string; opacity?: number; size?: number}> = ({
	prints,
	t,
	color = '#5a3e22',
	opacity = 0.55,
	size = 0.34,
}) => {
	const mats = useMemo(
		() => prints.map(() => new THREE.MeshBasicMaterial({map: footprintTexture(), color, transparent: true, depthWrite: false, fog: true})),
		[prints, color],
	);
	return (
		<>
			{prints.map((p, i) => {
				const a = Math.min(1, Math.max(0, (t - p.at) / 0.12));
				if (a <= 0) return null;
				const m = mats[i];
				m.opacity = opacity * a;
				return (
					<mesh key={i} position={[p.x, p.y + 0.015, p.z]} rotation={[-Math.PI / 2, 0, p.flip ? 0.08 : -0.08]} material={m} renderOrder={5}>
						<planeGeometry args={[size, size * 0.42]} />
					</mesh>
				);
			})}
		</>
	);
};

// Glowing pool of light on the ground under a beam (additive ellipse with a bright core and slow ripples).
export const LightPool: React.FC<{
	position: [number, number, number];
	radius: number;
	intensity: number;
	t: number;
	color?: THREE.ColorRepresentation;
	squash?: number;
	renderOrder?: number;
}> = ({position, radius, intensity, t, color = '#ffe6b0', squash = 1, renderOrder = 6}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uColor: {value: new THREE.Color()}, uI: {value: 0}, uT: {value: 0}},
				vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
				fragmentShader: `uniform vec3 uColor; uniform float uI, uT; varying vec2 vUv;
					void main(){
						float r = length(vUv - 0.5) * 2.0;
						float body = smoothstep(1.0, 0.55, r);
						float core = exp(-r * r * 9.0);
						float ring = smoothstep(0.08, 0.0, abs(fract(r * 2.2 - uT * 0.35) - 0.5) - 0.38) * smoothstep(1.0, 0.4, r) * 0.18;
						gl_FragColor = vec4(uColor * (body * 0.55 + core * 1.1 + ring) * uI, 1.);
					}`,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				fog: false,
			}),
		[],
	);
	mat.uniforms.uColor.value.set(color);
	mat.uniforms.uI.value = intensity;
	mat.uniforms.uT.value = t;
	return (
		<mesh position={[position[0], position[1] + 0.03, position[2]]} rotation-x={-Math.PI / 2} scale={[radius * 2, radius * 2 * squash, 1]} material={mat} renderOrder={renderOrder} visible={intensity > 0.001}>
			<planeGeometry args={[1, 1]} />
		</mesh>
	);
};
