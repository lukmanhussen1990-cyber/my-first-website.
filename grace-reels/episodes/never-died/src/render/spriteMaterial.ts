// One shader for every character sprite and rig part.
// Geometry is in sprite pixels (y up); uv.y = 1 at the top of the image. Warps are in pixels.
import * as THREE from 'three';

const vertex = /* glsl */ `
uniform vec2 uSize;     // sprite size in px
uniform vec4 uHem;      // x shear (px) for image-v between y..z (0 top, 1 bottom), squared falloff
uniform vec4 uWave;     // amp (px), freq (rad per v), phase, anchor v (cloth/hair wave below the anchor)
uniform vec4 uTilt;     // angle (rad), pivot u, pivot v, edge v (everything above edge v rotates)
uniform vec4 uBreath;   // amount (fraction), pivot v (chest bottom), 0, 0
uniform float uLean;    // x shear (px) at the top, 0 at the bottom
varying vec2 vUv;
varying float vWorldY;
#include <fog_pars_vertex>
void main() {
	vUv = uv;
	vec3 p = position;
	float v = 1.0 - uv.y;
	float hem = smoothstep(uHem.y, uHem.z, v);
	p.x += uHem.x * hem * hem;
	float below = max(0.0, v - uWave.w);
	p.x += uWave.x * below * sin(v * uWave.y + uWave.z);
	p.y += uWave.x * 0.25 * below * cos(v * uWave.y * 0.8 + uWave.z * 1.3);
	if (uBreath.x != 0.0) {
		float above = max(0.0, uBreath.y - v);
		p.y += uBreath.x * above * uSize.y;
	}
	if (uTilt.x != 0.0) {
		float w = 1.0 - smoothstep(uTilt.w - 0.025, uTilt.w + 0.025, v);
		vec2 piv = vec2((uTilt.y - 0.5) * uSize.x, (0.5 - uTilt.z) * uSize.y);
		float a = uTilt.x * w;
		vec2 d = p.xy - piv;
		p.xy = piv + vec2(cos(a) * d.x - sin(a) * d.y, sin(a) * d.x + cos(a) * d.y);
	}
	p.x += uLean * (1.0 - v);
	vWorldY = (modelMatrix * vec4(p, 1.0)).y;
	vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}
`;

const fragment = /* glsl */ `
uniform sampler2D map;
uniform vec3 uTint;
uniform float uShade;
uniform float uOpacity;
uniform vec3 uLightColor;
uniform float uLight;
uniform float uDissolve;
uniform vec3 uEdgeColor;
uniform float uSeed;
uniform float uSil;
uniform vec3 uSilColor;
uniform float uRim;
uniform vec3 uRimColor;
uniform vec2 uRimDir;
uniform vec2 uTexel;
uniform float uGlow;
uniform vec2 uDisY;     // world y of the feet and the head: the dissolve climbs from the feet up
varying vec2 vUv;
varying float vWorldY;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
	vec4 c = texture2D(map, vUv);
	if (c.a < 0.004) discard;
	vec3 col = c.rgb * uTint * uShade;
	float alpha = c.a * uOpacity;
	if (uSil > 0.0) {
		float n = texture2D(map, vUv + uRimDir * uTexel * 7.0).a;
		float n2 = texture2D(map, vUv + uRimDir * uTexel * 14.0).a;
		float edge = clamp(c.a - min(n, n2), 0.0, 1.0);
		col = mix(col, uSilColor + uRimColor * edge * uRim, uSil);
	}
	col = mix(col, uLightColor, uLight);
	col += uLightColor * uGlow;
	if (uDissolve > 0.0) {
		float gy = clamp((vWorldY - uDisY.x) / max(0.001, uDisY.y - uDisY.x), 0.0, 1.0);
		float d = vnoise(vUv * vec2(9.0, 16.0) + uSeed) * 0.4 + (1.0 - gy) * 0.6;
		float thr = 1.06 - uDissolve * 1.12;
		float keep = smoothstep(thr + 0.015, thr - 0.015, d);
		float edge = smoothstep(thr - 0.09, thr - 0.015, d) * keep;
		col = mix(col, uEdgeColor * 2.2, edge);
		alpha *= keep;
	}
	gl_FragColor = vec4(col, alpha);
	#include <fog_fragment>
}
`;

export type SpriteUniforms = {
	map: {value: THREE.Texture};
	uSize: {value: THREE.Vector2};
	uTexel: {value: THREE.Vector2};
	uHem: {value: THREE.Vector4};
	uWave: {value: THREE.Vector4};
	uTilt: {value: THREE.Vector4};
	uBreath: {value: THREE.Vector4};
	uLean: {value: number};
	uTint: {value: THREE.Color};
	uShade: {value: number};
	uOpacity: {value: number};
	uLightColor: {value: THREE.Color};
	uLight: {value: number};
	uGlow: {value: number};
	uDissolve: {value: number};
	uEdgeColor: {value: THREE.Color};
	uSeed: {value: number};
	uDisY: {value: THREE.Vector2};
	uSil: {value: number};
	uSilColor: {value: THREE.Color};
	uRim: {value: number};
	uRimColor: {value: THREE.Color};
	uRimDir: {value: THREE.Vector2};
};

export const makeSpriteMaterial = (texture: THREE.Texture, w: number, h: number) => {
	const uniforms: SpriteUniforms & Record<string, THREE.IUniform> = {
		...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
		map: {value: texture},
		uSize: {value: new THREE.Vector2(w, h)},
		uTexel: {value: new THREE.Vector2(1 / w, 1 / h)},
		uHem: {value: new THREE.Vector4(0, 0.6, 1, 0)},
		uWave: {value: new THREE.Vector4(0, 6, 0, 0)},
		uTilt: {value: new THREE.Vector4(0, 0.5, 0.2, 0.2)},
		uBreath: {value: new THREE.Vector4(0, 0.45, 0, 0)},
		uLean: {value: 0},
		uTint: {value: new THREE.Color(1, 1, 1)},
		uShade: {value: 1},
		uOpacity: {value: 1},
		uLightColor: {value: new THREE.Color('#fff2cf')},
		uLight: {value: 0},
		uGlow: {value: 0},
		uDissolve: {value: 0},
		uEdgeColor: {value: new THREE.Color('#ffd27a')},
		uSeed: {value: 0},
		uDisY: {value: new THREE.Vector2(0, 2)},
		uSil: {value: 0},
		uSilColor: {value: new THREE.Color('#1b130e')},
		uRim: {value: 0},
		uRimColor: {value: new THREE.Color('#ffe7b0')},
		uRimDir: {value: new THREE.Vector2(0, 1)},
	};
	const mat = new THREE.ShaderMaterial({
		uniforms,
		vertexShader: vertex,
		fragmentShader: fragment,
		transparent: true,
		depthWrite: false,
		fog: true,
	});
	return mat as THREE.ShaderMaterial & {uniforms: SpriteUniforms};
};

// Common look settings shared by every part of a character in one frame.
export type SpriteLook = {
	tint?: THREE.ColorRepresentation;
	opacity?: number;
	light?: number;
	glow?: number;
	lightColor?: THREE.ColorRepresentation;
	dissolve?: number;
	dissolveY?: [number, number]; // world y range the dissolve climbs through (feet, head)
	seed?: number;
	sil?: number;
	silColor?: THREE.ColorRepresentation;
	rim?: number;
	rimColor?: THREE.ColorRepresentation;
	rimDir?: [number, number];
};

const tmp = new THREE.Color();
export const applyLook = (m: ReturnType<typeof makeSpriteMaterial>, look: SpriteLook = {}, shade = 1) => {
	const u = m.uniforms;
	u.uTint.value.set(look.tint ?? '#ffffff');
	u.uShade.value = shade;
	u.uOpacity.value = look.opacity ?? 1;
	u.uLight.value = look.light ?? 0;
	u.uGlow.value = look.glow ?? 0;
	u.uLightColor.value.set(look.lightColor ?? '#fff2cf');
	u.uDissolve.value = look.dissolve ?? 0;
	u.uSeed.value = look.seed ?? 0;
	u.uDisY.value.set(...(look.dissolveY ?? [0, 2]));
	u.uSil.value = look.sil ?? 0;
	u.uSilColor.value.set(look.silColor ?? tmp.set('#1b130e'));
	u.uRim.value = look.rim ?? 0;
	u.uRimColor.value.set(look.rimColor ?? '#ffe7b0');
	const rd = look.rimDir ?? [0, 1];
	u.uRimDir.value.set(rd[0], rd[1]);
};
