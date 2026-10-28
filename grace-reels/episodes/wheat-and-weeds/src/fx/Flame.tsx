// Torch and lamp flames: noise-distorted teardrops that always face the camera (billboarded in the
// vertex shader, so they work in every shot and in both halves of a transition), plus soft glows.
// Pure functions of `t`; the flicker is seeded per flame.
import {useMemo} from 'react';
import * as THREE from 'three';
import {noise1} from '../lib/random';

const NOISE = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
	return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.07+vec2(13.1,7.7); a*=.5; } return s; }
`;

// Quad centred on the origin, billboarded: `position.xy` is the offset in view space (metres).
const BILLBOARD_VS = /* glsl */ `
uniform vec2 uSize; uniform vec2 uPivot; varying vec2 vUv;
void main(){
	vUv = uv;
	vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.);
	vec3 sc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.);
	mv.xy += (position.xy + uPivot) * uSize * sc.xy;
	gl_Position = projectionMatrix * mv;
}`;

const flameMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uT: {value: 0}, uSeed: {value: 0}, uSize: {value: new THREE.Vector2(1, 1)}, uPivot: {value: new THREE.Vector2(0, 0.5)}, uI: {value: 1}, uHue: {value: 0}},
		vertexShader: BILLBOARD_VS,
		fragmentShader: `${NOISE}
			uniform float uT, uSeed, uI, uHue; varying vec2 vUv;
			void main(){
				vec2 uv = vUv;
				float t = uT * 1.0 + uSeed * 7.3;
				float n = fbm(vec2(uv.x * 3.0 + uSeed, uv.y * 3.4 - t * 3.2));
				float n2 = vn(vec2(uv.x * 7.0 - uSeed, uv.y * 6.0 - t * 5.0));
				// sway grows with height; the tip flickers
				float x = uv.x - 0.5 + (n - 0.5) * 0.42 * uv.y + sin(t * 2.3 + uSeed) * 0.04 * uv.y;
				float y = uv.y + (n2 - 0.5) * 0.12 * uv.y;
				float prof = 0.46 * pow(max(0.0, y), 0.45) * pow(max(0.0, 1.0 - y), 1.15);
				float d = abs(x) / max(prof, 1e-3);
				float body = smoothstep(1.05, 0.55, d) * smoothstep(0.0, 0.06, y);
				float core = smoothstep(0.62, 0.0, d) * smoothstep(0.78, 0.18, y) * smoothstep(0.0, 0.1, y);
				vec3 red = mix(vec3(0.85, 0.18, 0.04), vec3(0.95, 0.35, 0.1), uHue);
				vec3 orange = vec3(1.0, 0.55, 0.16);
				vec3 yellow = vec3(1.0, 0.86, 0.5);
				vec3 col = mix(red, orange, smoothstep(0.0, 0.8, body)) * body + yellow * core * 1.4;
				col *= 0.75 + 0.5 * n;
				gl_FragColor = vec4(col * uI * 1.8, 1.0);
			}`,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		fog: false,
	});

const glowMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uSize: {value: new THREE.Vector2(1, 1)}, uPivot: {value: new THREE.Vector2(0, 0)}, uColor: {value: new THREE.Color()}, uI: {value: 1}},
		vertexShader: BILLBOARD_VS,
		fragmentShader: `uniform vec3 uColor; uniform float uI; varying vec2 vUv;
			void main(){ float r = length(vUv - 0.5) * 2.0; float g = exp(-r * r * 4.5) * 0.85 + exp(-r * 9.0) * 0.6;
				gl_FragColor = vec4(uColor * g * smoothstep(1.0, 0.7, r) * uI, 1.0); }`,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		fog: false,
	});

// Seeded flicker in about [0.75, 1.15] (fast + slow layers).
export const flicker = (t: number, seed: number) => 0.95 + 0.12 * noise1(t * 7.3, seed) + 0.08 * noise1(t * 17.1, seed + 9) + 0.05 * noise1(t * 1.3, seed + 3);

export const Flame: React.FC<{
	position: [number, number, number];
	height: number; // metres
	t: number;
	seed: number;
	intensity?: number;
	glow?: number; // size of the soft glow, in flame heights (0 = none)
	glowColor?: THREE.ColorRepresentation;
	renderOrder?: number;
	hue?: number;
}> = ({position, height, t, seed, intensity = 1, glow = 2.4, glowColor = '#ff9a4a', renderOrder = 500, hue = 0}) => {
	const mats = useMemo(() => ({flame: flameMaterial(), glow: glowMaterial()}), []);
	const f = flicker(t, seed);
	const u = mats.flame.uniforms;
	u.uT.value = t;
	u.uSeed.value = seed;
	u.uSize.value.set(height * 0.62, height * (0.95 + 0.1 * f));
	u.uI.value = intensity * f;
	u.uHue.value = hue;
	const g = mats.glow.uniforms;
	g.uSize.value.set(height * glow, height * glow);
	g.uPivot.value.set(0, 0.06);
	g.uColor.value.set(glowColor);
	g.uI.value = 0.55 * intensity * f;
	return (
		<group position={position}>
			{glow > 0 && (
				<mesh material={mats.glow} renderOrder={renderOrder - 1} frustumCulled={false}>
					<planeGeometry args={[1, 1]} />
				</mesh>
			)}
			<mesh material={mats.flame} renderOrder={renderOrder} frustumCulled={false}>
				<planeGeometry args={[1, 1]} />
			</mesh>
		</group>
	);
};

// A soft light glow on its own (lamp halos, the spotlight on Jesus' face, bokeh of far torches).
export const Glow: React.FC<{position: [number, number, number]; size: number; color: THREE.ColorRepresentation; intensity: number; renderOrder?: number}> = ({
	position,
	size,
	color,
	intensity,
	renderOrder = 480,
}) => {
	const mat = useMemo(glowMaterial, []);
	const g = mat.uniforms;
	g.uSize.value.set(size, size);
	g.uColor.value.set(color);
	g.uI.value = intensity;
	return (
		<mesh position={position} material={mat} renderOrder={renderOrder} frustumCulled={false} visible={intensity > 0.001}>
			<planeGeometry args={[1, 1]} />
		</mesh>
	);
};

// A flickering warm point light to go with a flame (lights the walls and faces nearby).
export const FlameLight: React.FC<{position: [number, number, number]; t: number; seed: number; intensity: number; distance?: number; color?: THREE.ColorRepresentation}> = ({
	position,
	t,
	seed,
	intensity,
	distance = 9,
	color = '#ffa45c',
}) => <pointLight position={position} color={color} intensity={intensity * flicker(t, seed)} distance={distance} decay={1.6} />;
