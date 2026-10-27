import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useShot} from './shot';
import {SUN_RADIUS_DEG} from '../sun';
import {rng} from '../math';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
	vDir = normalize(position);
	vec4 p = modelViewMatrix * vec4(position, 1.0);
	gl_Position = projectionMatrix * p;
	gl_Position.z = gl_Position.w; // always at the far plane
}`;

const frag = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uGlow; uniform vec3 uGround;
uniform vec3 uSunDir; uniform float uSunCos; uniform float uSoft; uniform float uGlowAmt; uniform float uDisc;
uniform float uHorizonY;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
	vec3 d = normalize(vDir);
	float h = d.y - uHorizonY;
	float up = clamp(h, 0.0, 1.0);
	vec3 sky = mix(uHorizon, uZenith, pow(up, 0.48));
	vec2 dh = normalize(d.xz + 1e-5);
	vec2 sh = normalize(uSunDir.xz + 1e-5);
	float az = max(dot(dh, sh), 0.0);
	float band = exp(-abs(h) * 6.0) * (0.25 + 0.75 * pow(az, 4.0));
	sky = mix(sky, uGlow, clamp(band * uGlowAmt * 0.75, 0.0, 1.0));
	float mu = dot(d, uSunDir);
	float glow = pow(max(mu, 0.0), 10.0) * 0.45 + pow(max(mu, 0.0), 90.0) * 0.8;
	sky += uGlow * glow * uGlowAmt;
	sky = mix(sky, uGround, smoothstep(0.0, 0.2, -h));
	float disc = smoothstep(uSunCos - uSoft, uSunCos + uSoft * 0.3, mu) * uDisc;
	sky = mix(sky, uSun * 3.4, disc);
	sky += (hash(gl_FragCoord.xy) - 0.5) / 180.0;
	gl_FragColor = vec4(max(sky, 0.0), 1.0);
}`;

// Procedural sky dome that follows the camera: zenith/horizon gradient, a warm band toward
// the sun, the sun disc (HDR, so bloom catches it) and a ground haze below the horizon.
export const Sky: React.FC<{horizonY?: number; disc?: number; glow?: number; ground?: THREE.Color}> = ({
	horizonY = 0,
	disc = 1,
	glow = 1,
	ground,
}) => {
	const shot = useShot();
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: vert,
				fragmentShader: frag,
				side: THREE.BackSide,
				depthWrite: false,
				depthTest: false,
				fog: false,
				uniforms: {
					uZenith: {value: new THREE.Color()},
					uHorizon: {value: new THREE.Color()},
					uSun: {value: new THREE.Color()},
					uGlow: {value: new THREE.Color()},
					uGround: {value: new THREE.Color()},
					uSunDir: {value: new THREE.Vector3()},
					uSunCos: {value: Math.cos(THREE.MathUtils.degToRad(SUN_RADIUS_DEG))},
					uSoft: {value: 0.00012},
					uGlowAmt: {value: 1},
					uDisc: {value: 1},
					uHorizonY: {value: 0},
				},
			}),
		[],
	);
	useLayoutEffect(() => () => mat.dispose(), [mat]);
	useLayoutEffect(() => {
		const s = shot.sun;
		const u = mat.uniforms;
		u.uZenith.value.copy(s.zenith);
		u.uHorizon.value.copy(s.horizon);
		u.uSun.value.copy(s.sunColor);
		u.uGlow.value.copy(s.glow);
		u.uGround.value.copy(ground ?? s.fog);
		u.uSunDir.value.copy(shot.sunDir);
		u.uGlowAmt.value = glow;
		u.uDisc.value = disc;
		u.uHorizonY.value = horizonY;
	});
	return (
		<mesh position={shot.cam.pos} material={mat} renderOrder={-10} frustumCulled={false}>
			<sphereGeometry args={[900, 48, 24]} />
		</mesh>
	);
};

// ---------- paper-cut clouds ----------
const cloudCanvas = (seed: number) => {
	const c = document.createElement('canvas');
	c.width = 512;
	c.height = 256;
	const g = c.getContext('2d')!;
	const base = 196;
	// the same seeded puffs twice: a grey shade layer, then a white lit layer nudged up
	const puffs = (fill: string, dx: number, dy: number, k: number) => {
		const r = rng(seed);
		const n = 5 + Math.floor(r() * 4);
		g.fillStyle = fill;
		g.beginPath();
		for (let i = 0; i < n; i++) {
			const x = 70 + (i / (n - 1)) * 370 + (r() - 0.5) * 30;
			const rad = (40 + r() * 55 * Math.sin((i / (n - 1)) * Math.PI) + 18) * k;
			g.moveTo(x + dx + rad, base - rad * 0.55 + dy);
			g.arc(x + dx, base - rad * 0.55 + dy, rad, 0, Math.PI * 2);
		}
		g.rect(64 + dx, base - 36 + dy, 392, 36);
		g.fill();
	};
	puffs('rgb(120,120,120)', 0, 0, 1);
	puffs('rgb(255,255,255)', -4, -18, 0.94);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
};

const cloudVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const cloudFrag = /* glsl */ `
uniform sampler2D map; uniform vec3 uLit; uniform vec3 uShade; uniform float uOpacity;
varying vec2 vUv;
void main() {
	vec4 t = texture2D(map, vUv);
	if (t.a < 0.02) discard;
	float k = smoothstep(0.35, 0.95, t.r);
	gl_FragColor = vec4(mix(uShade, uLit, k), t.a * uOpacity);
}`;

export type CloudSpec = {az: number; el: number; size: number; seed: number; dist?: number};

// Flat cut-paper clouds on far cards, tinted by the sun (white at noon, gold, then ember).
export const Clouds: React.FC<{clouds: CloudSpec[]; opacity?: number}> = ({clouds, opacity = 1}) => {
	const shot = useShot();
	const mats = useMemo(
		() =>
			clouds.map(
				(c) =>
					new THREE.ShaderMaterial({
						vertexShader: cloudVert,
						fragmentShader: cloudFrag,
						transparent: true,
						depthWrite: false,
						fog: false,
						uniforms: {map: {value: cloudCanvas(c.seed)}, uLit: {value: new THREE.Color()}, uShade: {value: new THREE.Color()}, uOpacity: {value: 1}},
					}),
			),
		[clouds],
	);
	useLayoutEffect(() => () => mats.forEach((m) => {
		(m.uniforms.map.value as THREE.Texture).dispose();
		m.dispose();
	}), [mats]);
	useLayoutEffect(() => {
		for (const m of mats) {
			m.uniforms.uLit.value.copy(shot.sun.cloudLit);
			m.uniforms.uShade.value.copy(shot.sun.cloudShade);
			m.uniforms.uOpacity.value = opacity;
		}
	});
	const [cx, cy, cz] = shot.cam.pos;
	return (
		<group>
			{clouds.map((c, i) => {
				const d = c.dist ?? 600;
				const az = THREE.MathUtils.degToRad(c.az);
				const el = THREE.MathUtils.degToRad(c.el);
				const p: [number, number, number] = [cx + d * Math.cos(el) * Math.sin(az), cy + d * Math.sin(el), cz + d * Math.cos(el) * Math.cos(az)];
				return (
					<mesh key={i} position={p} rotation={[0, az + Math.PI, 0]} material={mats[i]} renderOrder={-9} frustumCulled={false}>
						<planeGeometry args={[c.size, c.size * 0.5]} />
					</mesh>
				);
			})}
		</group>
	);
};
