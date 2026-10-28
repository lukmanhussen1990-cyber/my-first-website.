// Renders the active shot(s) into HDR targets, blends transitions, then bloom + grade to the screen.
// Everything is a pure function of the current frame.
import {useFrame, useThree} from '@react-three/fiber';
import {useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {applyCamera, projectToScreen} from './camera';
import {DEFAULT_GRADE, Dof, Grade, Inset, ShotDef, Transition} from './types';

const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const HASH = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
	return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }`;

const KIND_ID: Record<string, number> = {cut: 0, dissolve: 1, haze: 2, cloak: 3, light: 4, whip: 5, fade: 6, swirl: 7, split: 8, streak: 9};

export type ShotRender = {shot: ShotDef; t: number};

// Which shots are on screen at time t, and how far along a transition we are. `wB` is how much of the
// picture belongs to shot B (the grade and the label anchors follow it); for a split it is B's share of
// the screen (B is right of the divider).
export const activeShots = (shots: ShotDef[], transitions: Transition[], t: number) => {
	for (const tr of transitions) {
		const a = tr.at - tr.dur / 2;
		const b = tr.at + tr.dur / 2;
		if (tr.kind !== 'cut' && t >= a && t < b) {
			const split = tr.kind === 'split' && tr.divider;
			const mix = split ? tr.divider!(t) : (t - a) / tr.dur;
			const from = shots.find((s) => s.id === tr.from);
			const to = shots.find((s) => s.id === tr.to);
			if (from && to) return {a: from, b: to as ShotDef | null, mix, wB: split ? 1 - mix : mix, kind: tr.kind, slant: tr.slant ?? 0};
		}
	}
	// Outside a blend: of the shots whose windows hold t, each transition between two of them picks the
	// earlier one before its time and the later one after it (so cuts land exactly on their beat).
	let live = shots.filter((x) => t >= x.start && t < x.end);
	for (const tr of transitions) {
		if (live.length < 2) break;
		const from = live.find((x) => x.id === tr.from);
		const to = live.find((x) => x.id === tr.to);
		if (from && to) live = live.filter((x) => x !== (t >= tr.at ? from : to));
	}
	const s =
		live[0] ??
		// outside every shot: hold the nearest real shot (the cover has start < 0 and is never picked)
		[...shots].filter((x) => x.start >= 0).sort((p, q) => Math.min(Math.abs(t - p.start), Math.abs(t - p.end)) - Math.min(Math.abs(t - q.start), Math.abs(t - q.end)))[0] ??
		shots[0];
	return {a: s, b: null as ShotDef | null, mix: 0, wB: 0, kind: 'cut' as Transition['kind'], slant: 0};
};

export const gradeAt = (shot: ShotDef | null, t: number): Grade => ({...DEFAULT_GRADE, ...(shot?.grade?.(t) ?? {})});

const lerpGrade = (g1: Grade, g2: Grade, m: number): Grade => {
	const l = (a: number, b: number) => a + (b - a) * m;
	const l3 = (a: number[], b: number[]) => [l(a[0], b[0]), l(a[1], b[1]), l(a[2], b[2])] as [number, number, number];
	return {
		exposure: l(g1.exposure, g2.exposure),
		contrast: l(g1.contrast, g2.contrast),
		saturation: l(g1.saturation, g2.saturation),
		gain: l3(g1.gain, g2.gain),
		lift: l3(g1.lift, g2.lift),
		vignette: l(g1.vignette, g2.vignette),
		bloom: l(g1.bloom, g2.bloom),
		bloomThreshold: l(g1.bloomThreshold, g2.bloomThreshold),
		grain: l(g1.grain, g2.grain),
		flash: l(g1.flash, g2.flash),
		flashColor: l3(g1.flashColor, g2.flashColor),
		desat: l(g1.desat, g2.desat),
		shimmer: l(g1.shimmer, g2.shimmer),
		shimmerRect: m < 0.5 ? g1.shimmerRect : g2.shimmerRect,
		rewind: l(g1.rewind, g2.rewind),
	};
};

export const INSET_PX = [760, 800];

export const Director: React.FC<{
	shots: ShotDef[];
	transitions: Transition[];
	lite: boolean;
	insets?: Inset[];
	timeMap?: (t: number) => number;
}> = ({shots, transitions, lite, insets = [], timeMap}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = timeMap ? timeMap(frame / fps) : frame / fps;
	const {gl, scene, camera, size} = useThree();
	const groups = useRef<Record<string, THREE.Group | null>>({});

	const res = useMemo(() => {
		const w = size.width;
		const h = size.height;
		const hdr = {type: THREE.HalfFloatType, samples: lite ? 0 : 4, colorSpace: THREE.LinearSRGBColorSpace};
		const rtA = new THREE.WebGLRenderTarget(w, h, hdr);
		const rtB = new THREE.WebGLRenderTarget(w, h, hdr);
		rtA.depthTexture = new THREE.DepthTexture(w, h);
		rtB.depthTexture = new THREE.DepthTexture(w, h);
		// depth of field: a half-size gather blur, then a composite back over the sharp picture
		const rtDofHalf = new THREE.WebGLRenderTarget(Math.round(w / 2), Math.round(h / 2), {type: THREE.HalfFloatType});
		const rtDofA = new THREE.WebGLRenderTarget(w, h, {type: THREE.HalfFloatType});
		const rtDofB = new THREE.WebGLRenderTarget(w, h, {type: THREE.HalfFloatType});
		const DOF_COMMON = `uniform sampler2D tColor, tDepth; uniform float uFocus, uRange, uAperture, uMax, uScale; uniform vec2 uRes;
			float viewZ(float d){ float n = 0.1, f = 2000.0; return (2.0 * n * f) / (f + n - (d * 2.0 - 1.0) * (f - n)); }
			float coc(float z){
				if (abs(z - uFocus) <= uRange) return 0.0;
				float e = z < uFocus ? uFocus - uRange : uFocus + uRange;
				return clamp(uAperture * (1.0 - e / z), -uMax, uMax) * uScale;
			}`;
		const dofGather = new THREE.ShaderMaterial({
			uniforms: {tColor: {value: null}, tDepth: {value: null}, uFocus: {value: 5}, uRange: {value: 0}, uAperture: {value: 10}, uMax: {value: 20}, uScale: {value: w / 1080}, uRes: {value: new THREE.Vector2(w, h)}},
			vertexShader: VS,
			fragmentShader: `${DOF_COMMON} varying vec2 vUv;
				void main(){
					float zc = viewZ(texture2D(tDepth, vUv).r);
					float cc = coc(zc);
					vec3 acc = texture2D(tColor, vUv).rgb; float ws = 1.0; float spread = abs(cc);
					for (int i = 0; i < 44; i++) {
						float fi = float(i);
						float r = sqrt((fi + 0.5) / 44.0) * uMax * uScale;
						float a = fi * 2.39996;
						vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uRes;
						float zs = viewZ(texture2D(tDepth, uv).r);
						float cs = coc(zs);
						float m = abs(cs);
						// something behind can't blur over something nearer than it
						if (zs > zc) m = min(m, abs(cc));
						float w = clamp(m - r + 1.0, 0.0, 1.0);
						acc += texture2D(tColor, uv).rgb * w; ws += w;
						if (cs < 0.0 && zs < zc) spread = max(spread, m * w);
					}
					gl_FragColor = vec4(acc / ws, spread);
				}`,
		});
		const dofComposite = new THREE.ShaderMaterial({
			uniforms: {tColor: {value: null}, tBlur: {value: null}, uScale: {value: w / 1080}},
			vertexShader: VS,
			fragmentShader: `uniform sampler2D tColor, tBlur; uniform float uScale; varying vec2 vUv;
				void main(){
					vec4 b = texture2D(tBlur, vUv);
					float k = smoothstep(0.6, 2.6, b.a / uScale);
					gl_FragColor = vec4(mix(texture2D(tColor, vUv).rgb, b.rgb, k), 1.0);
				}`,
		});
		const rtMix = new THREE.WebGLRenderTarget(w, h, {type: THREE.HalfFloatType});
		const k = w / 1080;
		const rtInset = new THREE.WebGLRenderTarget(Math.round(INSET_PX[0] * k), Math.round(INSET_PX[1] * k), hdr);
		const levels = [2, 4, 8, 16, 32].map((d) =>
			[0, 1].map(() => new THREE.WebGLRenderTarget(Math.max(1, Math.round(w / d)), Math.max(1, Math.round(h / d)), {type: THREE.HalfFloatType})),
		);
		const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
		quad.frustumCulled = false;
		const qs = new THREE.Scene();
		qs.add(quad);
		const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const mixMat = new THREE.ShaderMaterial({
			uniforms: {tA: {value: null}, tB: {value: null}, uMix: {value: 0}, uKind: {value: 0}, uSlant: {value: 0}, uRes: {value: new THREE.Vector2(w, h)}},
			vertexShader: VS,
			fragmentShader: `${HASH}
				uniform sampler2D tA, tB; uniform float uMix, uKind, uSlant; uniform vec2 uRes; varying vec2 vUv;
				vec3 blur(sampler2D t, vec2 uv, vec2 d){ vec3 c = vec3(0.); for(int i=-4;i<=4;i++){ c += texture2D(t, uv + d*float(i)).rgb; } return c/9.; }
				void main(){
					float m = clamp(uMix, 0., 1.);
					vec3 a = texture2D(tA, vUv).rgb; vec3 b = texture2D(tB, vUv).rgb; vec3 c;
					if (uKind < 0.5) { c = m < 0.5 ? a : b; }
					else if (uKind < 1.5) { c = mix(a, b, smoothstep(0., 1., m)); }
					else if (uKind < 2.5) {
						float bl = sin(3.14159 * m);
						vec3 aa = mix(a, blur(tA, vUv, vec2(0., 3.0/uRes.y) * bl * 2.0), bl);
						vec3 bb = mix(b, blur(tB, vUv, vec2(0., 3.0/uRes.y) * bl * 2.0), bl);
						c = mix(aa, bb, smoothstep(0.15, 0.85, m)) + vec3(1.0, 0.86, 0.62) * bl * 0.28;
					}
					else if (uKind < 3.5) {
						float n = vn(vUv * vec2(3., 5.)) * 0.3 + vn(vUv * vec2(7., 12.)) * 0.08;
						float r = length((vUv - 0.5) * vec2(1., 1.6)) * 0.55;
						float mask = smoothstep(m * 1.4 - 0.3, m * 1.4 - 0.02, r + n);
						c = mix(b, a * (1. - smoothstep(0., 0.5, m) * 0.85), mask);
					}
					else if (uKind < 4.5) {
						// a warm bloom of light between the shots (never a full white frame)
						float up = smoothstep(0., 0.5, m) * 0.4, down = smoothstep(0.4, 1., m);
						vec3 w = vec3(1.25, 1.05, 0.78);
						c = mix(mix(a, w, up), b, down) + w * (1.0 - abs(m - 0.5) * 2.0) * 0.12;
					}
					else if (uKind < 5.5) {
						float s = sin(3.14159 * m);
						vec3 aa = blur(tA, vUv, vec2(14.0/uRes.x, 0.) * s);
						vec3 bb = blur(tB, vUv, vec2(14.0/uRes.x, 0.) * s);
						c = mix(aa, bb, smoothstep(0.35, 0.65, m));
					}
					else if (uKind < 6.5) { c = m < 0.5 ? a * (1. - smoothstep(0., 0.5, m)) : b * smoothstep(0.5, 1., m); }
					else if (uKind < 7.5) {
						// the rewind: the picture twists around the centre (counter-clockwise, time running back),
						// smeared along the arc, with a warm flash in the eye of the swirl
						float s = sin(3.14159 * m);
						float asp = uRes.x / uRes.y;
						vec2 p = (vUv - 0.5) * vec2(asp, 1.);
						float r = length(p);
						float ang = s * s * 7.0 * exp(-r * 1.4);
						vec3 ca = vec3(0.), cb = vec3(0.);
						for (int i = 0; i < 7; i++) {
							float aa = ang * (1.0 - float(i) * 0.07 * s);
							vec2 q = vec2(cos(aa) * p.x - sin(aa) * p.y, sin(aa) * p.x + cos(aa) * p.y);
							vec2 uv = (q / vec2(asp, 1.)) * (1.0 - 0.22 * s) + 0.5;
							ca += texture2D(tA, uv).rgb;
							cb += texture2D(tB, uv).rgb;
						}
						c = mix(ca, cb, smoothstep(0.45, 0.62, m)) / 7.;
						c += vec3(1.0, 0.78, 0.46) * pow(s, 3.0) * 0.6 * exp(-r * 2.2);
					}
					else if (uKind > 8.5) {
						// a streak of light flies across the screen on a slight arc: the new picture opens behind its
						// head, with a hot core and a long warm tail
						float asp = uRes.x / uRes.y;
						float hx = mix(-0.25, 1.25, m);
						float hy = 0.56 + 0.07 * sin(3.14159 * m);
						vec2 p = vec2((vUv.x - hx) * asp, vUv.y - hy);
						float behind = max(0., -p.x);
						float trail = step(p.x, 0.) * exp(-behind * 2.0);
						float thick = 0.005 + behind * 0.03;
						float band = exp(-pow(p.y / thick, 2.)) * trail;
						float core = exp(-dot(p, p) / 0.0007);
						float halo = exp(-abs(p.y) * 8.) * trail * 0.3 + exp(-length(p) * 5.) * 0.45;
						float reveal = smoothstep(0.04, -0.1, vUv.x - hx);
						vec3 w = vec3(1.3, 1.06, 0.72);
						c = mix(a, b, reveal) + w * (band * 2.2 + core * 3.5 + halo) + w * sin(3.14159 * m) * 0.08;
					}
					else {
						// split screen: A left of a slanted divider, B right, a thin gold seam with a soft shadow
						float x = (vUv.x - (m + uSlant * (vUv.y - 0.5))) * uRes.x;
						c = x < 0. ? a : b;
						c *= 1.0 - 0.45 * exp(-abs(x) / 18.0);
						c = mix(c, vec3(1.35, 1.0, 0.55), smoothstep(3.0, 1.0, abs(x)));
					}
					gl_FragColor = vec4(c, 1.);
				}`,
		});
		const blurMat = new THREE.ShaderMaterial({
			uniforms: {tex: {value: null}, dir: {value: new THREE.Vector2()}, threshold: {value: 0}},
			vertexShader: VS,
			fragmentShader: `uniform sampler2D tex; uniform vec2 dir; uniform float threshold; varying vec2 vUv;
				void main(){ vec3 c = vec3(0.); float w[6]; w[0]=.1964; w[1]=.1748; w[2]=.1216; w[3]=.0660; w[4]=.0280; w[5]=.0093;
				for(int i=-5;i<=5;i++){ vec3 s = texture2D(tex, vUv + dir*float(i)*1.6).rgb;
					if(threshold>0.){ float l = max(max(s.r,s.g),s.b); s *= smoothstep(threshold, threshold + 0.35, l); }
					c += s*w[i<0?-i:i]; }
				gl_FragColor = vec4(c,1.); }`,
		});
		// god rays: a radial blur of the bright parts of the picture toward the light's place on screen
		const rtRays = new THREE.WebGLRenderTarget(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)), {type: THREE.HalfFloatType});
		const raysMat = new THREE.ShaderMaterial({
			uniforms: {tex: {value: null}, uLight: {value: new THREE.Vector2(0.5, 0.5)}, uThr: {value: 0.9}, uAsp: {value: w / h}},
			vertexShader: VS,
			fragmentShader: `uniform sampler2D tex; uniform vec2 uLight; uniform float uThr, uAsp; varying vec2 vUv;
				void main(){
					vec2 d = (vUv - uLight) * (0.92 / 56.0);
					vec2 uv = vUv; float decay = 1.0; vec3 acc = vec3(0.);
					for (int i = 0; i < 56; i++) {
						uv -= d;
						vec3 s = texture2D(tex, clamp(uv, 0.0, 1.0)).rgb;
						float l = max(max(s.r, s.g), s.b);
						acc += s * smoothstep(uThr, uThr + 0.7, l) * decay;
						decay *= 0.962;
					}
					// fade the rays out at the light itself so the core is not doubled
					vec2 q = (vUv - uLight) * vec2(uAsp, 1.0);
					gl_FragColor = vec4(acc / 56.0 * smoothstep(0.0, 0.08, length(q)), 1.);
				}`,
		});
		const finalMat = new THREE.ShaderMaterial({
			uniforms: {
				tBase: {value: null},
				b0: {value: null},
				b1: {value: null},
				b2: {value: null},
				b3: {value: null},
				b4: {value: null},
				uExposure: {value: 1},
				uContrast: {value: 1},
				uSat: {value: 1},
				uGain: {value: new THREE.Vector3(1, 1, 1)},
				uLift: {value: new THREE.Vector3()},
				uVignette: {value: 0.35},
				uBloom: {value: 0.35},
				uGrain: {value: 0.02},
				uFlash: {value: 0},
				uFlashColor: {value: new THREE.Vector3(1, 0.93, 0.78)},
				uDesat: {value: 0},
				uShimmer: {value: 0},
				uShimmerRect: {value: new THREE.Vector4(0, 0, 1, 1)},
				uRewind: {value: 0},
				uTime: {value: 0},
				uRes: {value: new THREE.Vector2(w, h)},
				tInset: {value: null},
				tRays: {value: null},
				uRays: {value: 0},
				uRaysColor: {value: new THREE.Vector3(1, 0.86, 0.6)},
				uInsetOn: {value: 0},
				uInsetC: {value: new THREE.Vector2()},
				uInsetS: {value: new THREE.Vector2()},
				uInsetRot: {value: 0},
				uInsetAge: {value: 0},
			},
			vertexShader: VS,
			fragmentShader: `${HASH}
				uniform sampler2D tBase, b0, b1, b2, b3, b4, tInset, tRays;
				uniform float uRays; uniform vec3 uRaysColor;
				uniform float uInsetOn, uInsetRot, uInsetAge; uniform vec2 uInsetC, uInsetS;
				uniform float uExposure, uContrast, uSat, uVignette, uBloom, uGrain, uFlash, uDesat, uShimmer, uRewind, uTime;
				uniform vec3 uGain, uLift, uFlashColor; uniform vec4 uShimmerRect; uniform vec2 uRes;
				varying vec2 vUv;
				vec3 softclip(vec3 c){ vec3 k = vec3(0.82); return mix(c, k + (1. - k) * (1. - exp(-(c - k) / (1. - k))), step(k, c)); }
				void main(){
					vec2 uv = vUv;
					if (uShimmer > 0.) {
						vec2 r0 = uShimmerRect.xy, r1 = uShimmerRect.zw;
						float inside = smoothstep(r0.x, r0.x + 0.05, uv.x) * smoothstep(r1.x, r1.x - 0.05, uv.x) * smoothstep(r0.y, r0.y + 0.05, uv.y) * smoothstep(r1.y, r1.y - 0.08, uv.y);
						float n = vn(vec2(uv.x * 30., uv.y * 22. - uTime * 6.)) - 0.5;
						uv.x += n * 0.006 * uShimmer * inside;
						uv.y += (vn(vec2(uv.x * 26. + 7., uv.y * 18. - uTime * 5.)) - 0.5) * 0.004 * uShimmer * inside;
					}
					if (uRewind > 0.) {
						float band = step(0.82, vn(vec2(3., uv.y * 40. + uTime * 30.)));
						uv.x += (band * 0.03 + 0.012 * sin(uv.y * 90. + uTime * 60.)) * uRewind;
					}
					vec3 c = texture2D(tBase, uv).rgb;
					if (uRewind > 0.) {
						c.r = mix(c.r, texture2D(tBase, uv + vec2(0.004 * uRewind, 0.)).r, uRewind);
						c.b = mix(c.b, texture2D(tBase, uv - vec2(0.004 * uRewind, 0.)).b, uRewind);
					}
					vec3 bl = texture2D(b0, uv).rgb * 0.45 + texture2D(b1, uv).rgb * 0.6 + texture2D(b2, uv).rgb * 0.75 + texture2D(b3, uv).rgb * 0.85 + texture2D(b4, uv).rgb;
					c += bl * uBloom * 0.42;
					if (uRays > 0.) c += texture2D(tRays, uv).rgb * uRaysColor * uRays * 2.4;
					c *= uExposure * uGain;
					c += uLift;
					float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
					c = mix(vec3(l), c, uSat * (1. - uDesat));
					c = (c - 0.18) * uContrast + 0.18;
					c = max(c, 0.);
					c += uFlashColor * uFlash;
					c = softclip(c);
					vec2 d = vUv - 0.5;
					c *= 1. - dot(d * vec2(1.0, 0.75), d * vec2(1.0, 0.75)) * uVignette * 1.6;
					c += (h21(vUv * uRes + fract(uTime * 13.7) * 91.) - 0.5) * uGrain;
					if (uRewind > 0.) c += vec3(0.04, 0.05, 0.08) * step(0.97, fract(vUv.y * 120. + uTime * 8.)) * uRewind;
					if (uInsetOn > 0.) {
						// picture-in-picture (an old painting): rotate into the frame's space, sepia, vignette, grain
						float asp = uRes.x / uRes.y;
						vec2 p = (vUv - uInsetC) * vec2(asp, 1.);
						float cs = cos(uInsetRot), sn = sin(uInsetRot);
						p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
						vec2 q = p / (uInsetS * 0.5 * vec2(asp, 1.));
						if (abs(q.x) < 1. && abs(q.y) < 1.) {
							vec2 iuv = q * 0.5 + 0.5;
							vec3 ic = texture2D(tInset, iuv).rgb;
							ic = ic / (1. + ic * 0.35);
							ic = max((ic - 0.42) * 1.22 + 0.4, 0.);
							float l = dot(ic, vec3(0.299, 0.587, 0.114));
							vec3 sep = vec3(l) * vec3(1.12, 0.95, 0.72);
							ic = mix(ic, sep, 0.55 * uInsetAge);
							ic *= 1. - uInsetAge * 0.55 * pow(length(q * vec2(0.85, 0.9)), 2.4);
							ic += (vn(iuv * 260.) - 0.5) * 0.05 * uInsetAge + (vn(iuv * vec2(30., 6.)) - 0.5) * 0.04 * uInsetAge;
							c = mix(c, ic, uInsetOn);
						}
					}
					gl_FragColor = vec4(c, 1.);
					#include <colorspace_fragment>
				}`,
		});
		return {rtA, rtB, rtMix, rtInset, rtRays, levels, quad, qs, qc, mixMat, blurMat, raysMat, finalMat, rtDofHalf, rtDofA, rtDofB, dofGather, dofComposite};
	}, [size.width, size.height, lite]);

	const active = activeShots(shots, transitions, t);
	const grade = active.b ? lerpGrade(gradeAt(active.a, t), gradeAt(active.b, t), active.wB) : gradeAt(active.a, t);

	useFrame(() => {
		const cam = camera as THREE.PerspectiveCamera;
		const renderShot = (shot: ShotDef, target: THREE.WebGLRenderTarget, aspect = size.width / size.height) => {
			for (const [id, g] of Object.entries(groups.current)) if (g) g.visible = id === shot.id;
			const f = shot.fog?.(t);
			scene.fog = f ? new THREE.Fog(f.color, f.near, f.far) : null;
			scene.background = new THREE.Color('#000000');
			applyCamera(cam, shot.camera(t), t, aspect);
			gl.setRenderTarget(target);
			gl.clear();
			gl.render(scene, cam);
		};
		const {rtA, rtB, rtMix, rtInset, rtRays, levels, quad, qs, qc, mixMat, blurMat, raysMat, finalMat, rtDofHalf, rtDofA, rtDofB, dofGather, dofComposite} = res;
		// depth of field for one rendered shot; returns the picture to use
		const withDof = (shot: ShotDef, src: THREE.WebGLRenderTarget, out: THREE.WebGLRenderTarget): THREE.Texture => {
			const d: Dof | null | undefined = lite ? null : shot.dof?.(t);
			if (!d || d.aperture <= 0.01) return src.texture;
			const g = dofGather.uniforms;
			g.tColor.value = src.texture;
			g.tDepth.value = src.depthTexture;
			g.uFocus.value = d.focus;
			g.uRange.value = d.range ?? 0;
			g.uAperture.value = d.aperture;
			g.uMax.value = d.max ?? 22;
			quad.material = dofGather;
			gl.setRenderTarget(rtDofHalf);
			gl.render(qs, qc);
			dofComposite.uniforms.tColor.value = src.texture;
			dofComposite.uniforms.tBlur.value = rtDofHalf.texture;
			quad.material = dofComposite;
			gl.setRenderTarget(out);
			gl.render(qs, qc);
			return out.texture;
		};
		// picture-in-picture first (it uses the same scene graph)
		let insetRect = null;
		for (const ins of insets) {
			const r = ins.rect(t);
			const shot = shots.find((s) => s.id === ins.shot);
			if (r && shot && r.opacity > 0.001) {
				renderShot(shot, rtInset, r.w / r.h);
				insetRect = r;
				break;
			}
		}
		renderShot(active.a, rtA);
		const texA = withDof(active.a, rtA, rtDofA);
		let base: THREE.Texture = texA;
		if (active.b) {
			renderShot(active.b, rtB);
			const texB = withDof(active.b, rtB, rtDofB);
			quad.material = mixMat;
			mixMat.uniforms.tA.value = texA;
			mixMat.uniforms.tB.value = texB;
			mixMat.uniforms.uMix.value = active.mix;
			mixMat.uniforms.uKind.value = KIND_ID[active.kind];
			mixMat.uniforms.uSlant.value = active.slant;
			gl.setRenderTarget(rtMix);
			gl.render(qs, qc);
			base = rtMix.texture;
		}
		quad.material = blurMat;
		let src: THREE.Texture = base;
		levels.forEach(([a, b], i) => {
			blurMat.uniforms.tex.value = src;
			blurMat.uniforms.threshold.value = i === 0 ? grade.bloomThreshold : 0;
			blurMat.uniforms.dir.value.set(1 / a.width, 0);
			gl.setRenderTarget(a);
			gl.render(qs, qc);
			blurMat.uniforms.tex.value = a.texture;
			blurMat.uniforms.threshold.value = 0;
			blurMat.uniforms.dir.value.set(0, 1 / a.height);
			gl.setRenderTarget(b);
			gl.render(qs, qc);
			src = b.texture;
		});
		// god rays from the dominant shot's light (fading with the transition)
		const raysOf = (shot: ShotDef | null, w: number) => {
			const r = shot?.rays?.(t);
			if (!shot || !r || r.strength * w <= 0.001) return null;
			const p = projectToScreen(shot.camera(t), t, r.at);
			return p ? {x: p.x / 1080, y: 1 - p.y / 1920, s: r.strength * w, color: r.color ?? ([1, 0.86, 0.6] as [number, number, number])} : null;
		};
		const ra = raysOf(active.a, 1 - active.wB);
		const rb = raysOf(active.b, active.wB);
		const rays = ra && rb ? {...(ra.s >= rb.s ? ra : rb), s: ra.s + rb.s} : (ra ?? rb);
		if (rays) {
			quad.material = raysMat;
			raysMat.uniforms.tex.value = base;
			raysMat.uniforms.uLight.value.set(rays.x, rays.y);
			raysMat.uniforms.uThr.value = 0.85;
			gl.setRenderTarget(rtRays);
			gl.render(qs, qc);
		}
		const u = finalMat.uniforms;
		u.tBase.value = base;
		u.tRays.value = rtRays.texture;
		u.uRays.value = rays ? rays.s : 0;
		if (rays) u.uRaysColor.value.set(...rays.color);
		levels.forEach(([, b], i) => (u[`b${i}`].value = b.texture));
		u.uExposure.value = grade.exposure;
		u.uContrast.value = grade.contrast;
		u.uSat.value = grade.saturation;
		u.uGain.value.set(...grade.gain);
		u.uLift.value.set(...grade.lift);
		u.uVignette.value = grade.vignette;
		u.uBloom.value = grade.bloom;
		u.uGrain.value = grade.grain;
		u.uFlash.value = grade.flash;
		u.uFlashColor.value.set(...grade.flashColor);
		u.uDesat.value = grade.desat;
		u.uShimmer.value = grade.shimmer;
		u.uShimmerRect.value.set(...grade.shimmerRect);
		u.uRewind.value = grade.rewind;
		u.uTime.value = t;
		u.tInset.value = rtInset.texture;
		u.uInsetOn.value = insetRect ? insetRect.opacity : 0;
		if (insetRect) {
			u.uInsetC.value.set(insetRect.cx / 1080, 1 - insetRect.cy / 1920);
			u.uInsetS.value.set(insetRect.w / 1080, insetRect.h / 1920);
			u.uInsetRot.value = (insetRect.rot * Math.PI) / 180;
			u.uInsetAge.value = insetRect.age;
		}
		quad.material = finalMat;
		gl.setRenderTarget(null);
		gl.render(qs, qc);
	}, 1);

	return (
		<>
			{shots.map((s) => (
				<group key={s.id} ref={(g) => void (groups.current[s.id] = g)} visible={false}>
					<s.Content t={t} lite={lite} />
				</group>
			))}
		</>
	);
};
