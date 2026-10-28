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
uniform float uRimLight;
uniform vec3 uRimColor;
uniform vec2 uRimDir;
uniform vec2 uTexel;
uniform float uGlow;
uniform vec2 uDisY;     // world y of the feet and the head: the dissolve climbs from the feet up
uniform float uBlur;    // depth-of-field blur radius in texels (0 = sharp)
uniform vec4 uGrad;     // light gradient across the sprite: direction (x, y in uv), strength, softness
uniform vec3 uGradColor;
uniform float uOutline; // outline width in screen pixels around the part's silhouette (0 = none)
uniform vec3 uOutlineColor;
uniform vec4 uCel;      // two-tone cel shading: light direction (x, y in uv, toward the light), amount, radius (px)
uniform vec3 uCelColor; // colour multiplier on the side away from the light
uniform float uCelBias; // mip bias for the blurred silhouette that gives the shading its roundness
uniform vec2 uSize;     // sprite size in px
varying vec2 vUv;
varying float vWorldY;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec4 blurred(vec2 uv) {
	// 13-tap disc, premultiplied so transparent texels don't darken the edge
	vec4 acc = vec4(0.0);
	for (int i = 0; i < 13; i++) {
		float fi = float(i);
		float r = sqrt((fi + 0.5) / 13.0);
		float a = fi * 2.39996;
		vec4 s = texture2D(map, uv + vec2(cos(a), sin(a)) * r * uBlur * uTexel);
		acc += vec4(s.rgb * s.a, s.a);
	}
	acc /= 13.0;
	return vec4(acc.rgb / max(acc.a, 1e-4), acc.a);
}
void main() {
	vec4 c = uBlur > 0.0 ? blurred(vUv) : texture2D(map, vUv);
	// outline: the part's silhouette grown by uOutline screen pixels, whatever the zoom
	float ol = 0.0;
	if (uOutline > 0.0) {
		vec2 du = vec2(length(vec2(dFdx(vUv.x), dFdy(vUv.x))), length(vec2(dFdx(vUv.y), dFdy(vUv.y)))) * uOutline;
		for (int i = 0; i < 16; i++) {
			float a = float(i) * 0.39269908;
			vec2 o = vec2(cos(a), sin(a)) * du;
			ol = max(ol, texture2D(map, vUv + o).a);
			ol = max(ol, texture2D(map, vUv + o * 0.5).a);
		}
		ol = smoothstep(0.25, 0.6, ol);
	}
	if (c.a < 0.004 && ol < 0.004) discard;
	vec3 col = c.rgb * uTint * uShade;
	if (uCel.z > 0.0) {
		// a pseudo normal from the blurred silhouette: edges turned away from the light fall into shadow
		vec2 r = vec2(uCel.w) / uSize;
		float ax = texture2D(map, vUv + vec2(r.x, 0.0), uCelBias).a - texture2D(map, vUv - vec2(r.x, 0.0), uCelBias).a;
		float ay = texture2D(map, vUv + vec2(0.0, r.y), uCelBias).a - texture2D(map, vUv - vec2(0.0, r.y), uCelBias).a;
		vec3 n = normalize(vec3(-ax * 1.7, -ay * 1.7, 0.6));
		vec3 L = normalize(vec3(uCel.xy, 0.62));
		float lit = smoothstep(0.30, 0.38, dot(n, L));
		col *= mix(vec3(1.0), uCelColor, (1.0 - lit) * uCel.z);
	}
	if (uGrad.z > 0.0) {
		float g = smoothstep(-uGrad.w, uGrad.w, dot(vUv - 0.5, normalize(uGrad.xy)));
		col *= mix(vec3(1.0), uGradColor, g * uGrad.z);
	}
	float alpha = c.a * uOpacity;
	if (uSil > 0.0 || uRimLight > 0.0) {
		float n = texture2D(map, vUv + uRimDir * uTexel * 7.0).a;
		float n2 = texture2D(map, vUv + uRimDir * uTexel * 14.0).a;
		float edge = clamp(c.a - min(n, n2), 0.0, 1.0);
		col = mix(col, uSilColor + uRimColor * edge * uRim, uSil);
		// a rim of light on the edges facing the light, without darkening the figure
		col += uRimColor * edge * uRimLight;
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
	if (uOutline > 0.0) {
		// the outline sits behind the part; the art's own soft edge blends into it
		col = mix(uOutlineColor * uTint, col, c.a);
		alpha = max(alpha, ol * uOpacity);
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
	uBlur: {value: number};
	uGrad: {value: THREE.Vector4};
	uGradColor: {value: THREE.Color};
	uOutline: {value: number};
	uOutlineColor: {value: THREE.Color};
	uCel: {value: THREE.Vector4};
	uCelColor: {value: THREE.Color};
	uCelBias: {value: number};
	uSil: {value: number};
	uSilColor: {value: THREE.Color};
	uRim: {value: number};
	uRimLight: {value: number};
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
		uBlur: {value: 0},
		uGrad: {value: new THREE.Vector4(1, 0, 0, 0.5)},
		uGradColor: {value: new THREE.Color('#ffffff')},
		uOutline: {value: 0},
		uOutlineColor: {value: new THREE.Color('#2b1d12')},
		uCel: {value: new THREE.Vector4(-0.6, 0.8, 0, 40)},
		uCelColor: {value: new THREE.Color('#b7a3b8')},
		uCelBias: {value: 4},
		uSil: {value: 0},
		uSilColor: {value: new THREE.Color('#1b130e')},
		uRim: {value: 0},
		uRimLight: {value: 0},
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
	rimLight?: number; // rim of light on the edges facing rimDir, without the silhouette
	rimColor?: THREE.ColorRepresentation;
	rimDir?: [number, number];
	blur?: number; // depth-of-field blur radius in texels
	depthTest?: boolean; // false: always drawn over the set (a foreground figure that must not clip into rock)
	grad?: {dir: [number, number]; color: THREE.ColorRepresentation; amount: number; soft?: number}; // side light across the sprite
	outline?: number; // screen-pixel outline around the silhouette (code-drawn characters: about 5)
	outlineColor?: THREE.ColorRepresentation;
	// two-tone cel shading: light direction in the part's own uv space (x right, y up), strength, shadow colour
	cel?: {dir: [number, number]; amount: number; color?: THREE.ColorRepresentation; radius?: number; bias?: number};
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
	u.uRimLight.value = look.rimLight ?? 0;
	u.uRimColor.value.set(look.rimColor ?? '#ffe7b0');
	const rd = look.rimDir ?? [0, 1];
	u.uRimDir.value.set(rd[0], rd[1]);
	u.uBlur.value = look.blur ?? 0;
	m.depthTest = look.depthTest ?? true;
	const g = look.grad;
	u.uGrad.value.set(g?.dir[0] ?? 1, g?.dir[1] ?? 0, g?.amount ?? 0, g?.soft ?? 0.5);
	u.uGradColor.value.set(g?.color ?? '#ffffff');
	u.uOutline.value = look.outline ?? 0;
	u.uOutlineColor.value.set(look.outlineColor ?? '#2b1d12');
	const cel = look.cel;
	u.uCel.value.set(cel?.dir[0] ?? -0.6, cel?.dir[1] ?? 0.8, cel?.amount ?? 0, cel?.radius ?? 40);
	u.uCelColor.value.set(cel?.color ?? '#b7a3b8');
	u.uCelBias.value = cel?.bias ?? 4;
};
