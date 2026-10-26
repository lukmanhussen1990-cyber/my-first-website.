// Post chain (deterministic, a pure function of the frame):
//   scene (MSAA 4x, HDR, optional 1.5x supersample, optional sub-frame accumulation for motion blur)
//   -> SSAO (half res, normals from depth, bilateral blur)                       [post.ao > 0]
//   -> screen-space god rays (quarter res, occlusion mask + 2-pass radial blur)  [post.godrays.strength > 0]
//   -> half/eighth-res blur (depth of field + tilt-shift) + two-level bloom
//   -> composite: DOF mix, AO, exponential height fog [fog.density > 0], god rays, bloom,
//      tone mapping (ACES filmic | AgX | soft roll-off), haze, grade (tint/lift/sat/contrast +
//      lift/gamma/gain + split toning), flash, vignette, fade
//   -> SMAA 1x (edges + weights + blend, three's lookup textures decoded synchronously) or FXAA 3.11, then grain.
// Two shots can be composited separately and joined by a transition (dissolve, dust, flare, push, whip).
import * as THREE from 'three';
import { SMAAEdgesShader, SMAAWeightsShader } from 'three/addons/shaders/SMAAShader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const GLSL_HASH = `float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`;

const BLUR = `uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
void main(){ vec4 c = texture2D(tIn, vUv) * 0.2270270270;
  c += texture2D(tIn, vUv + dir * 1.3846153846) * 0.3162162162; c += texture2D(tIn, vUv - dir * 1.3846153846) * 0.3162162162;
  c += texture2D(tIn, vUv + dir * 3.2307692308) * 0.0702702703; c += texture2D(tIn, vUv - dir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c; }`;

const BRIGHT = `uniform sampler2D tIn; uniform float threshold; varying vec2 vUv;
void main(){ vec3 c = texture2D(tIn, vUv).rgb; float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(threshold, threshold + 0.45, l); gl_FragColor = vec4(min(c * k, vec3(12.0)), 1.0); }`;

// quarter-res DOF source: colour premultiplied by its own circle of confusion, so sharp foreground pixels
// do not bleed into the blurred background (no halos around in-focus subjects)
const COC_DOWN = `uniform sampler2D tIn; uniform sampler2D tDepth; uniform float near; uniform float far; uniform float focus; uniform float focusRange; uniform float dof;
uniform float tiltTop; uniform float tiltBottom; uniform float tilt; varying vec2 vUv;
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
void main(){ vec3 c = texture2D(tIn, vUv).rgb;
  float cocD = dof > 0.0 ? smoothstep(focusRange, focusRange * 3.0, abs(lin(texture2D(tDepth, vUv).x) - focus)) * dof : 0.0;
  float cocT = (smoothstep(tiltTop, 1.0, vUv.y) + smoothstep(tiltBottom, 0.0, vUv.y)) * tilt;
  float w = clamp(max(cocD, cocT), 0.0, 1.0) + 0.003;
  gl_FragColor = vec4(c * w, w); }`;
const COPY = 'uniform sampler2D tIn; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tIn, vUv); }';
const BLOOM_MERGE = 'uniform sampler2D tA; uniform sampler2D tB; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tA, vUv).rgb * 0.65 + texture2D(tB, vUv).rgb * 0.55, 1.0); }';
const ADD = 'uniform sampler2D tIn; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tIn, vUv).rgb * w, 1.0); }';

// ---------- SSAO (N8AO-style hemisphere samples, normals reconstructed from depth) ----------
const AO_N = 10;
const SSAO = `uniform sampler2D tDepth; uniform mat4 proj; uniform mat4 invProj; uniform vec3 kern[${AO_N}];
uniform float radius; uniform float bias; uniform vec2 texel; uniform float near; uniform float far; varying vec2 vUv;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 vpos(vec2 uv, float d){ vec4 p = invProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float vz(float d){ float z = d * 2.0 - 1.0; return -2.0 * near * far / (far + near - z * (far - near)); }
void main(){
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.9999999) { gl_FragColor = vec4(1.0, -1.0e4, 0.0, 1.0); return; }
  vec3 P = vpos(vUv, d);
  vec2 ox = vec2(texel.x, 0.0), oy = vec2(0.0, texel.y);
  vec3 pl = vpos(vUv - ox, texture2D(tDepth, vUv - ox).x), pr = vpos(vUv + ox, texture2D(tDepth, vUv + ox).x);
  vec3 pd = vpos(vUv - oy, texture2D(tDepth, vUv - oy).x), pu = vpos(vUv + oy, texture2D(tDepth, vUv + oy).x);
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  float a = h12(gl_FragCoord.xy) * 6.2831853;
  vec3 rv = vec3(cos(a), sin(a), 0.0);
  vec3 T = normalize(rv - N * dot(rv, N)); vec3 B = cross(N, T);
  float r = radius * (1.0 + max(-P.z - 25.0, 0.0) * 0.015);
  float occ = 0.0;
  for (int i = 0; i < ${AO_N}; i++) {
    vec3 S = P + (T * kern[i].x + B * kern[i].y + N * kern[i].z) * r;
    vec4 q = proj * vec4(S, 1.0); vec2 suv = q.xy / q.w * 0.5 + 0.5;
    float sz = vz(texture2D(tDepth, suv).x);
    float dz = sz - S.z;
    occ += step(bias * (1.0 + -P.z * 0.02), dz) * smoothstep(0.0, 1.0, r / max(abs(P.z - sz), 1e-4));
  }
  gl_FragColor = vec4(1.0 - occ / ${AO_N}.0, P.z, 0.0, 1.0);
}`;
const AO_BLUR = `uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
void main(){ vec2 c = texture2D(tIn, vUv).rg; float s = c.r, ws = 1.0;
  float tol = 0.04 * abs(c.g) + 0.06;
  for (int i = -2; i <= 2; i++) { if (i == 0) continue;
    vec2 q = texture2D(tIn, vUv + dir * (float(i) * 1.5)).rg;
    float w = exp(-float(i * i) / 4.0) * max(0.0, 1.0 - abs(q.g - c.g) / tol);
    s += q.r * w; ws += w; }
  gl_FragColor = vec4(s / ws, c.g, 0.0, 1.0); }`;

// ---------- god rays: occlusion mask around the light's screen position, then radial blur ----------
const RAY_MASK = `uniform sampler2D tDepth; uniform sampler2D tScene; uniform vec2 lp; uniform float ld; uniform float aspect;
uniform float radius; uniform float streaks; uniform float bright; uniform float seed; varying vec2 vUv;
float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float vn1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
void main(){
  float d = texture2D(tDepth, vUv).x;
  float open = step(ld, d);
  vec2 q = (vUv - lp) * vec2(aspect, 1.0);
  float r = length(q);
  float src = exp(-r * r / (radius * radius)) + 0.25 * exp(-r * r / (radius * radius * 9.0));
  float a = atan(q.y, q.x);
  float st = mix(1.0, 0.25 + 1.5 * vn1(a * 13.0 + seed) * vn1(a * 4.7 - seed * 0.61 + 3.0), streaks);
  vec3 sc = texture2D(tScene, vUv).rgb;
  float b = bright * smoothstep(1.0, 3.0, max(sc.r, max(sc.g, sc.b)));
  gl_FragColor = vec4(vec3(open * (src * st + b)), 1.0);
}`;
const RAY_N = 20;
const RAY_BLUR = `uniform sampler2D tIn; uniform vec2 lp; uniform float len; uniform float decay; varying vec2 vUv;
void main(){ vec2 delta = (lp - vUv) * len / ${RAY_N}.0; vec2 uv = vUv; float w = 1.0, acc = 0.0, ws = 0.0;
  for (int i = 0; i < ${RAY_N}; i++) { acc += texture2D(tIn, uv).r * w; ws += w; w *= decay; uv += delta; }
  gl_FragColor = vec4(vec3(acc / ws), 1.0); }`;

// ---------- composite (HDR -> display) ----------
// Compiled per feature set (#defines), so a shot only pays for the features its mood uses; full-res 1:1 reads
// use texelFetch (no filtering) when the scene is not supersampled. Defines: SS1 CA BLUR DOF AO FOG RAYS BLOOM
// TM (0 ACES, 1 AgX, 2 soft roll-off mixed with ACES) HAZE LGG SPLIT FLASH VIG FADE GRAIN.
const COMPOSITE = `
uniform sampler2D tScene; uniform sampler2D tBlur; uniform sampler2D tBlur2; uniform sampler2D tBloom; uniform sampler2D tDepth;
uniform sampler2D tAO; uniform sampler2D tRays;
uniform float near; uniform float far; uniform float focus; uniform float focusRange; uniform float dof;
uniform float tiltTop; uniform float tiltBottom; uniform float tilt;
uniform float bloom; uniform vec3 hazeColor; uniform float haze;
uniform vec3 tint; uniform vec3 lift; uniform float sat; uniform float contrast; uniform float exposure;
uniform float vignette; uniform float grain; uniform float seed; uniform float flash; uniform float ca;
uniform vec3 fadeColor; uniform float fade; uniform float aces; uniform float agxLook;
uniform float aoK; uniform float aoPow; uniform vec3 raysColor; uniform float raysK;
uniform float fogD; uniform float fogH; uniform float fogBase; uniform float fogSun; uniform float fogMax; uniform float fogSky;
uniform vec3 fogCol; uniform vec3 sunCol; uniform vec3 sunDirW; uniform vec3 camPos; uniform mat4 invProj; uniform mat4 camWorld;
uniform vec3 gLift; uniform vec3 gGamma; uniform vec3 gGain; uniform vec3 splitShadow; uniform vec3 splitHigh; uniform float split; uniform float splitBalance;
varying vec2 vUv;
${GLSL_HASH}
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 acesFilmic(vec3 c){
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c = IN * (c / 0.6); c = RRTAndODTFit(c); c = OUT * c; return clamp(c, 0.0, 1.0);
}
#if TM == 1
vec3 agxContrast(vec3 x){ vec3 x2 = x * x; vec3 x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 agx(vec3 color){
  const mat3 R2020_TO_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
  const mat3 SRGB_TO_R2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
  const mat3 INSET = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 OUTSET = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  color = INSET * (SRGB_TO_R2020 * color);
  color = clamp((log2(max(color, 1e-10)) + 12.47393) / 16.499999, 0.0, 1.0);
  color = agxContrast(color);
  vec3 pv = pow(max(color, 0.0), vec3(1.35)); float pl = dot(pv, vec3(0.2126, 0.7152, 0.0722));   // 'punchy' look (agxLook)
  color = mix(color, pl + 1.4 * (pv - pl), agxLook);
  color = OUTSET * color;
  color = pow(max(color, 0.0), vec3(2.2));
  return clamp(R2020_TO_SRGB * color, 0.0, 1.0);
}
#endif
vec3 softLight(vec3 a, vec3 b){ return mix(2.0 * a * b + a * a * (1.0 - 2.0 * b), 2.0 * a * (1.0 - b) + sqrt(max(a, 0.0)) * (2.0 * b - 1.0), step(0.5, b)); }
void main(){
#ifdef SS1
  ivec2 ip = ivec2(gl_FragCoord.xy);
  #define SCENE_C texelFetch(tScene, ip, 0)
  #define DEPTH_C texelFetch(tDepth, ip, 0).x
#else
  #define SCENE_C texture2D(tScene, vUv)
  #define DEPTH_C texture2D(tDepth, vUv).x
#endif
#ifdef CA
  vec2 dq = (vUv - 0.5) * ca * dot(vUv - 0.5, vUv - 0.5) * 4.0;
  vec3 sharp = vec3(texture2D(tScene, vUv + dq).r, SCENE_C.g, texture2D(tScene, vUv - dq).b);
#else
  vec3 sharp = SCENE_C.rgb;
#endif
#if defined(DOF) || defined(FOG)
  float dRaw = DEPTH_C;
#endif
  vec3 c = sharp;
#ifdef BLUR
  float coc = (smoothstep(tiltTop, 1.0, vUv.y) + smoothstep(tiltBottom, 0.0, vUv.y)) * tilt;
  #ifdef DOF
  coc = max(coc, smoothstep(focusRange, focusRange * 3.0, abs(lin(dRaw) - focus)) * dof);
  #endif
  coc = clamp(coc, 0.0, 1.0);
  if (coc > 0.002) {
    vec4 B1 = texture2D(tBlur, vUv); vec3 b1 = B1.a > 1e-4 ? B1.rgb / B1.a : sharp;
    c = mix(sharp, b1, smoothstep(0.0, 0.5, coc));
    if (coc > 0.5) { vec4 B2 = texture2D(tBlur2, vUv); c = mix(c, B2.a > 1e-4 ? B2.rgb / B2.a : b1, smoothstep(0.5, 1.0, coc)); }
  }
#endif
#ifdef AO
  float ao = pow(clamp(texture2D(tAO, vUv).r, 0.0, 1.0), aoPow);
  float lum0 = max(c.r, max(c.g, c.b));
  c *= mix(1.0, ao, aoK * (1.0 - smoothstep(1.2, 4.0, lum0)));
#endif
#ifdef FOG
  {
    vec4 vp = invProj * vec4(vUv * 2.0 - 1.0, dRaw * 2.0 - 1.0, 1.0); vp /= vp.w;
    vec3 wp = (camWorld * vec4(vp.xyz, 1.0)).xyz;
    vec3 rd = wp - camPos; float dist = length(rd); rd /= max(dist, 1e-4);
    if (dRaw >= 0.9999999) dist = fogSky;
    float k = 1.0 / max(fogH, 0.01);
    float a = fogD * exp(-(camPos.y - fogBase) * k);
    float bb = rd.y * k;
    float integ = abs(bb) > 1e-4 ? a * (1.0 - exp(-bb * dist)) / bb : a * dist;
    float f = min(1.0 - exp(-max(integ, 0.0)), fogMax);
    vec3 fc = fogCol + sunCol * fogSun * pow(max(dot(rd, sunDirW), 0.0), 6.0);
    c = mix(c, fc, f);
  }
#endif
#ifdef RAYS
  c += raysColor * raysK * texture2D(tRays, vUv).r;
#endif
#ifdef BLOOM
  c += texture2D(tBloom, vUv).rgb * bloom;
#endif
  c *= exposure;
#if TM == 1
  c = toSRGB(agx(c));
#elif TM == 0
  c = toSRGB(acesFilmic(c));
#else
  vec3 kk = vec3(0.62);
  vec3 roll = mix(c, kk + (1.0 - kk) * (1.0 - exp(-(c - kk) / (1.0 - kk))), step(kk, c));
  c = mix(toSRGB(roll), toSRGB(acesFilmic(c)), aces);
#endif
#ifdef HAZE
  c = mix(c, hazeColor, haze * smoothstep(0.45, 1.0, vUv.y));
#endif
  c = c * tint + lift;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, sat);
  c = (c - 0.5) * contrast + 0.5;
#ifdef LGG
  c = pow(max(gGain * (c + gLift * (1.0 - c)), 0.0), 1.0 / max(gGamma, vec3(0.05)));
#endif
#ifdef SPLIT
  {
    float L = dot(clamp(c, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
    vec3 tone = mix(splitShadow, splitHigh, smoothstep(0.0, 1.0, clamp(L + splitBalance, 0.0, 1.0)));
    c = mix(c, softLight(clamp(c, 0.0, 1.0), tone), split);
  }
#endif
#ifdef FLASH
  c += flash * vec3(1.0, 0.92, 0.78);
#endif
#ifdef VIG
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
  c *= mix(1.0, smoothstep(0.85, 0.2, length(q) * 1.12), vignette);
#endif
#ifdef FADE
  c = mix(c, fadeColor, fade);
#endif
#ifdef GRAIN
  float n = hash(vUv * vec2(1080.0, 1920.0) + seed * 17.13) - 0.5;
  float lg = dot(clamp(c, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
  c += n * grain * (0.55 + 0.45 * (1.0 - lg));
#endif
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// ---------- anti-aliasing after tone mapping (on display-referred colour) + grain ----------
const GRAIN = `
uniform float grain; uniform float seed;
${GLSL_HASH}
vec3 addGrain(vec3 c, vec2 uv){ float l = dot(c, vec3(0.299, 0.587, 0.114)); float n = hash(uv * vec2(1080.0, 1920.0) + seed * 17.13) - 0.5;
  return clamp(c + n * grain * (0.55 + 0.45 * (1.0 - l)), 0.0, 1.0); }`;
// SMAA neighbourhood blending (as three's SMAABlendShader) + grain
const SMAA_BLEND_VS = `uniform vec2 resolution; varying vec2 vUv; varying vec4 vOffset[2];
void main(){ vUv = uv; vOffset[0] = uv.xyxy + resolution.xyxy * vec4(-1.0, 0.0, 0.0, 1.0); vOffset[1] = uv.xyxy + resolution.xyxy * vec4(1.0, 0.0, 0.0, -1.0);
  gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const SMAA_BLEND_FS = `uniform sampler2D tDiffuse; uniform sampler2D tColor; uniform vec2 resolution; varying vec2 vUv; varying vec4 vOffset[2];
${GRAIN}
void main(){
  vec4 a; a.xz = texture2D(tDiffuse, vUv).xz; a.y = texture2D(tDiffuse, vOffset[1].zw).g; a.w = texture2D(tDiffuse, vOffset[1].xy).a;
  vec3 col;
  if (dot(a, vec4(1.0)) < 1e-5) col = texture2D(tColor, vUv).rgb;
  else {
    vec2 off; off.x = a.a > a.b ? a.a : -a.b; off.y = a.g > a.r ? -a.g : a.r;
    if (abs(off.x) > abs(off.y)) off.y = 0.0; else off.x = 0.0;
    vec3 C = texture2D(tColor, vUv).rgb; vec3 Cop = texture2D(tColor, vUv + sign(off) * resolution).rgb;
    float s = abs(off.x) > abs(off.y) ? abs(off.x) : abs(off.y);
    col = pow(mix(pow(C, vec3(2.2)), pow(Cop, vec3(2.2)), s), vec3(1.0 / 2.2));
  }
  gl_FragColor = vec4(addGrain(col, vUv), 1.0);
}`;
// FXAA 3.11 (quality, 12 search steps) + grain
const FXAA_FS = `uniform sampler2D tIn; uniform vec2 inv; varying vec2 vUv;
${GRAIN}
float luma(vec3 c){ return sqrt(dot(c, vec3(0.299, 0.587, 0.114))); }
float QS(int i){ return i < 5 ? 1.0 : (i == 5 ? 1.5 : (i < 10 ? 2.0 : (i == 10 ? 4.0 : 8.0))); }
void main(){
  vec3 cC = texture2D(tIn, vUv).rgb; float lC = luma(cC);
  float lD = luma(texture2D(tIn, vUv + vec2(0.0, -inv.y)).rgb), lU = luma(texture2D(tIn, vUv + vec2(0.0, inv.y)).rgb);
  float lL = luma(texture2D(tIn, vUv + vec2(-inv.x, 0.0)).rgb), lR = luma(texture2D(tIn, vUv + vec2(inv.x, 0.0)).rgb);
  float lMin = min(lC, min(min(lD, lU), min(lL, lR))), lMax = max(lC, max(max(lD, lU), max(lL, lR)));
  float range = lMax - lMin;
  if (range < max(0.0312, lMax * 0.125)) { gl_FragColor = vec4(addGrain(cC, vUv), 1.0); return; }
  float lDL = luma(texture2D(tIn, vUv + vec2(-inv.x, -inv.y)).rgb), lUR = luma(texture2D(tIn, vUv + vec2(inv.x, inv.y)).rgb);
  float lUL = luma(texture2D(tIn, vUv + vec2(-inv.x, inv.y)).rgb), lDR = luma(texture2D(tIn, vUv + vec2(inv.x, -inv.y)).rgb);
  float lDU = lD + lU, lLR = lL + lR, lLc = lDL + lUL, lDc = lDL + lDR, lRc = lDR + lUR, lUc = lUR + lUL;
  float eH = abs(-2.0 * lL + lLc) + abs(-2.0 * lC + lDU) * 2.0 + abs(-2.0 * lR + lRc);
  float eV = abs(-2.0 * lU + lUc) + abs(-2.0 * lC + lLR) * 2.0 + abs(-2.0 * lD + lDc);
  bool hor = eH >= eV;
  float l1 = hor ? lD : lL, l2 = hor ? lU : lR;
  float g1 = l1 - lC, g2 = l2 - lC; bool s1 = abs(g1) >= abs(g2);
  float gS = 0.25 * max(abs(g1), abs(g2));
  float stepL = hor ? inv.y : inv.x; float lAvg;
  if (s1) { stepL = -stepL; lAvg = 0.5 * (l1 + lC); } else lAvg = 0.5 * (l2 + lC);
  vec2 cu = vUv; if (hor) cu.y += stepL * 0.5; else cu.x += stepL * 0.5;
  vec2 off = hor ? vec2(inv.x, 0.0) : vec2(0.0, inv.y);
  vec2 u1 = cu - off, u2 = cu + off;
  float e1 = luma(texture2D(tIn, u1).rgb) - lAvg, e2 = luma(texture2D(tIn, u2).rgb) - lAvg;
  bool r1 = abs(e1) >= gS, r2 = abs(e2) >= gS;
  if (!r1) u1 -= off; if (!r2) u2 += off;
  if (!(r1 && r2)) {
    for (int i = 2; i < 12; i++) {
      if (!r1) e1 = luma(texture2D(tIn, u1).rgb) - lAvg;
      if (!r2) e2 = luma(texture2D(tIn, u2).rgb) - lAvg;
      r1 = abs(e1) >= gS; r2 = abs(e2) >= gS;
      if (!r1) u1 -= off * QS(i); if (!r2) u2 += off * QS(i);
      if (r1 && r2) break;
    }
  }
  float d1 = hor ? (vUv.x - u1.x) : (vUv.y - u1.y), d2 = hor ? (u2.x - vUv.x) : (u2.y - vUv.y);
  bool dir1 = d1 < d2; float dF = min(d1, d2);
  float pxOff = -dF / (d1 + d2) + 0.5;
  bool cSmall = lC < lAvg;
  bool ok = ((dir1 ? e1 : e2) < 0.0) != cSmall;
  float fo = ok ? pxOff : 0.0;
  float la = (1.0 / 12.0) * (2.0 * (lDU + lLR) + lLc + lRc);
  float sp1 = clamp(abs(la - lC) / range, 0.0, 1.0); float sp2 = (-2.0 * sp1 + 3.0) * sp1 * sp1;
  fo = max(fo, sp2 * sp2 * 0.75);
  vec2 fu = vUv; if (hor) fu.y += fo * stepL; else fu.x += fo * stepL;
  gl_FragColor = vec4(addGrain(texture2D(tIn, fu).rgb, vUv), 1.0);
}`;

const MIX = `uniform sampler2D tA; uniform sampler2D tB; uniform float k; uniform int mode; uniform vec3 color; uniform float seed;
varying vec2 vUv;
${GLSL_HASH}
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb, c;
  if (mode == 0) { c = mix(a, b, smoothstep(0.0, 1.0, k)); }
  else if (mode == 1) {           // dust wipe: ragged sandy edge sweeping up from the bottom-left
    float d = vUv.x * 0.45 + (1.0 - vUv.y) * 0.55;
    float n = fbm(vUv * vec2(5.0, 9.0) + seed) - 0.5;
    float e = mix(1.3, -0.3, k);
    float m = smoothstep(e - 0.025, e + 0.025, d + n * 0.24);
    c = mix(a, b, m);
    float band = exp(-pow((d + n * 0.24 - e) / 0.05, 2.0));
    float grit = step(0.55, hash(floor(vUv * vec2(360.0, 640.0)) + seed));
    c = mix(c, color, band * (0.45 + 0.4 * grit));
  }
  else if (mode == 2) {           // light-flare wipe: a warm streak sweeps across, new shot behind it
    float x = vUv.x + (vUv.y - 0.5) * 0.22;
    float e = mix(-0.25, 1.25, k);
    float m = smoothstep(e - 0.07, e + 0.07, x);
    c = mix(b, a, m);
    float streak = exp(-pow((x - e) / 0.08, 2.0));
    float glow = sin(3.14159 * clamp(k, 0.0, 1.0));
    c += color * (streak * 0.95 + glow * 0.22);
    c += color * 0.5 * streak * exp(-pow((vUv.y - 0.52) / 0.012, 2.0));
  }
  else if (mode == 3) {           // push-through: zoom into A with a radial blur, flash, B settles in
    vec2 q = vUv - 0.5; vec3 sa = vec3(0.0), sb = vec3(0.0);
    float za = 1.0 + 3.0 * k * k, zb = 1.0 + 0.45 * (1.0 - k);
    for (int i = 0; i < 8; i++) { float f = float(i) / 7.0;
      sa += texture2D(tA, 0.5 + q / (za * (1.0 + 0.14 * k * f))).rgb;
      sb += texture2D(tB, 0.5 + q / (zb * (1.0 + 0.14 * (1.0 - k) * f))).rgb; }
    c = mix(sa / 8.0, sb / 8.0, smoothstep(0.38, 0.62, k));
    c += color * pow(sin(3.14159 * k), 3.0) * 0.75;
  }
  else {                          // whip: horizontal smear across the cut
    float s = sin(3.14159 * k) * 0.08; vec3 sa = vec3(0.0), sb = vec3(0.0);
    for (int i = 0; i < 10; i++) { float f = float(i) / 9.0 - 0.5;
      sa += texture2D(tA, vUv + vec2(f * s, 0.0)).rgb; sb += texture2D(tB, vUv + vec2(f * s, 0.0)).rgb; }
    c = mix(sa, sb, smoothstep(0.4, 0.6, k)) / 10.0;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export const MODES = { dissolve: 0, dust: 1, flare: 2, push: 3, whip: 4 };

// Every key a mood may set under `post` (moods.js BASE.post is a copy of this).
export const DEFAULT_POST = {
  focus: 20, focusRange: 6, dof: 0, tiltTop: 0.7, tiltBottom: 0.12, tilt: 0.55,
  bloom: 0.5, bloomThreshold: 0.85, hazeColor: '#d9c497', haze: 0.25,
  tint: '#ffffff', lift: '#000000', sat: 1, contrast: 1, exposure: 1, aces: 1, ca: 0.004,
  vignette: 0.5, grain: 0.03, flash: 0, fadeColor: '#000000', fade: 0,
  // tone mapping: 'aces' (ACES filmic; `aces` 0..1 mixes from a soft roll-off to ACES) | 'agx' (+ agxLook 0..1 = 'punchy')
  tonemap: 'aces', agxLook: 0.6,
  // ASC-style lift / gamma / gain per channel (display space) + split toning (soft-light; '#808080' = neutral)
  gLift: [0, 0, 0], gGamma: [1, 1, 1], gGain: [1, 1, 1],
  splitShadow: '#808080', splitHigh: '#808080', split: 0, splitBalance: 0,
  // screen-space ambient occlusion (0 = off). radius in metres (grows slowly with distance), power shapes the falloff
  ao: 0, aoRadius: 0.45, aoPower: 1.25, aoBias: 0.025,
  // screen-space god rays from a SET-LOCAL world point (strength 0 = off)
  godrays: { pos: [0, 60, -120], color: '#ffe6b8', strength: 0, decay: 0.965, density: 0.9, radius: 0.16, streaks: 0.6, bright: 0 },
  // anti-aliasing after tone mapping: 'smaa' | 'fxaa' | 'none'; supersample: 1 or 1.5 (scene rendered larger, downsampled)
  aa: 'smaa', supersample: 1, msaa: 4,
  profile: false,
};

// ---------- tiny synchronous PNG decoder (8-bit grey/RGB/RGBA, no interlace) for the SMAA lookup textures ----------
function decodePNG(dataUrl) {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1)); const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  const dv = new DataView(b.buffer); let p = 8, w = 0, h = 0, ct = 0; const parts = []; let tot = 0;
  while (p < b.length) {
    const len = dv.getUint32(p); const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (type === 'IHDR') { w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); ct = b[p + 17]; }
    else if (type === 'IDAT') { parts.push(b.subarray(p + 8, p + 8 + len)); tot += len; }
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const z = new Uint8Array(tot); let o = 0; for (const s of parts) { z.set(s, o); o += s.length; }
  const raw = unzlibSync(z);
  const bpp = ct === 0 ? 1 : ct === 4 ? 2 : ct === 2 ? 3 : 4; const stride = w * bpp;
  const out = new Uint8Array(w * h * 4); let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0; let v = raw[row + x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const q = (y * w + x) * 4, s = x * bpp;
      if (bpp < 3) { out[q] = out[q + 1] = out[q + 2] = cur[s]; out[q + 3] = bpp === 2 ? cur[s + 1] : 255; }
      else { out[q] = cur[s]; out[q + 1] = cur[s + 1]; out[q + 2] = cur[s + 2]; out[q + 3] = bpp === 4 ? cur[s + 3] : 255; }
    }
    const t = prev; prev = cur; cur = t;
  }
  return { w, h, data: out };
}
let _smaaTex = null;
function smaaTextures() {
  if (_smaaTex) return _smaaTex;
  const mk = (url, filter) => {
    const { w, h, data } = decodePNG(url);
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = filter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true; return t;
  };
  _smaaTex = { area: mk(SMAAPass.prototype._getAreaTexture(), THREE.LinearFilter), search: mk(SMAAPass.prototype._getSearchTexture(), THREE.NearestFilter) };
  return _smaaTex;
}

function aoKernel(n) { // cosine-weighted hemisphere, lengths biased toward the centre (deterministic)
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, a = i * 2.39996323, r = Math.sqrt(u);
    const x = Math.cos(a) * r, y = Math.sin(a) * r, z = Math.sqrt(Math.max(0.05, 1 - u));
    const s = 0.15 + 0.85 * ((i * 7 % n) / n) ** 2;
    out.push(new THREE.Vector3(x * s, y * s, z * s));
  }
  return out;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
export class Post {
  constructor(renderer, W, H) {
    this.r = renderer; this.W = W; this.H = H;
    const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
    this._sceneRT = {}; this.useSS(1);
    this.h1 = new THREE.WebGLRenderTarget(W / 2, H / 2, hdr); this.h2 = new THREE.WebGLRenderTarget(W / 2, H / 2, hdr);
    this.q1 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr); this.q2 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr);
    this.e1 = new THREE.WebGLRenderTarget(W / 8, H / 8, hdr); this.e2 = new THREE.WebGLRenderTarget(W / 8, H / 8, hdr);
    this.bl1 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr); this.bl2 = new THREE.WebGLRenderTarget(W / 4, H / 4, hdr);
    this.bs1 = new THREE.WebGLRenderTarget(W / 16, H / 16, hdr); this.bs2 = new THREE.WebGLRenderTarget(W / 16, H / 16, hdr);
    this.outA = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false }); this.outB = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
    this.ldr = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.cam.position.z = 0.5;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const mk = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.mk = mk;
    this.mCopy = mk(COPY, { tIn: { value: null } });
    this.mAdd = mk(ADD, { tIn: { value: null }, w: { value: 1 } }, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, transparent: true });
    this.mBlur = mk(BLUR, { tIn: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mBright = mk(BRIGHT, { tIn: { value: null }, threshold: { value: 0.9 } });
    this.mBloomMerge = mk(BLOOM_MERGE, { tA: { value: null }, tB: { value: null } });
    this.mCoc = mk(COC_DOWN, { tIn: { value: null }, tDepth: { value: null }, near: { value: 0.1 }, far: { value: 1000 }, focus: { value: 20 }, focusRange: { value: 6 }, dof: { value: 0 }, tiltTop: { value: 0.7 }, tiltBottom: { value: 0.12 }, tilt: { value: 0 } });
    const u = {
      tScene: { value: null }, tBlur: { value: null }, tBlur2: { value: null }, tBloom: { value: null }, tDepth: { value: null },
      tAO: { value: null }, tRays: { value: null }, near: { value: 0.5 }, far: { value: 1000 }, seed: { value: 0 },
      focus: { value: 20 }, focusRange: { value: 6 }, dof: { value: 0 }, tiltTop: { value: 0.7 }, tiltBottom: { value: 0.12 }, tilt: { value: 0.55 },
      bloom: { value: 0.5 }, hazeColor: { value: new THREE.Color() }, haze: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, lift: { value: new THREE.Color(0, 0, 0) },
      sat: { value: 1 }, contrast: { value: 1 }, exposure: { value: 1 }, vignette: { value: 0.5 }, grain: { value: 0.03 }, flash: { value: 0 }, ca: { value: 0 },
      fadeColor: { value: new THREE.Color() }, fade: { value: 0 }, aces: { value: 1 }, agxLook: { value: 0.6 },
      aoK: { value: 0 }, aoPow: { value: 1 }, raysColor: { value: new THREE.Color() }, raysK: { value: 0 },
      fogD: { value: 0 }, fogH: { value: 8 }, fogBase: { value: 0 }, fogSun: { value: 0 }, fogMax: { value: 1 }, fogSky: { value: 600 },
      fogCol: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDirW: { value: new THREE.Vector3(0, 1, 0) }, camPos: { value: new THREE.Vector3() },
      invProj: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
      gLift: { value: new THREE.Vector3() }, gGamma: { value: new THREE.Vector3(1, 1, 1) }, gGain: { value: new THREE.Vector3(1, 1, 1) },
      splitShadow: { value: new THREE.Color(0.5, 0.5, 0.5) }, splitHigh: { value: new THREE.Color(0.5, 0.5, 0.5) }, split: { value: 0 }, splitBalance: { value: 0 },
    };
    this.cu = u; this._comp = new Map();   // composite variants share one uniforms object
    this.mMix = mk(MIX, { tA: { value: null }, tB: { value: null }, k: { value: 0 }, mode: { value: 0 }, color: { value: new THREE.Color() }, seed: { value: 0 } });
    // lazily created passes (only shots that ask for them pay)
    this._ao = null; this._rays = null; this._smaa = null; this._fxaa = null;
    this.prof = null;
  }

  // composite material for a feature set (compiled once per combination)
  compMat(defs) {
    const key = Object.entries(defs).map(([k, v]) => k + '=' + v).join(',');
    let m = this._comp.get(key);
    if (!m) { m = this.mk(COMPOSITE, this.cu, { defines: { ...defs } }); this._comp.set(key, m); }
    return m;
  }

  // scene render targets for a supersample factor (1 or 1.5), created on first use
  useSS(ss, msaa = 4) {
    const key = (ss > 1 ? 's' : 'n') + msaa;
    if (!this._sceneRT[key]) {
      const f = ss > 1 ? 1.5 : 1, w = Math.round(this.W * f), h = Math.round(this.H * f);
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa, stencilBuffer: true });
      const dt = new THREE.DepthTexture(w, h); dt.format = THREE.DepthStencilFormat; dt.type = THREE.UnsignedInt248Type;
      rt.depthTexture = dt;
      this._sceneRT[key] = { rt, acc: new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false }), w, h };
    }
    const S = this._sceneRT[key];
    this.rtScene = S.rt; this.rtAccum = S.acc; this.sw = S.w; this.sh = S.h;
  }

  // ---- profiling (only when a mood sets post.profile: gl.finish() between passes) ----
  profStart(on) {
    if (on && !this._sync) { this._sync = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }); this._px = new Uint8Array(4); }
    if (on) this.sync();
    this.prof = on ? { t: performance.now(), list: [] } : null;
  }
  // readPixels is synchronous and in-order: it returns only when every queued GL command has executed
  sync() { const r = this.r, prev = r.getRenderTarget(); r.setRenderTarget(this._sync); r.clear(); r.readRenderTargetPixels(this._sync, 0, 0, 1, 1, this._px); r.setRenderTarget(prev); }
  mark(label) {
    if (!this.prof) return;
    this.sync(); const n = performance.now();
    this.prof.list.push([label, +(n - this.prof.t).toFixed(1)]); this.prof.t = n;
  }

  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  blur(src, a, b, w, h, iters = 1, spread = 1) {
    let s = src;
    for (let i = 0; i < iters; i++) {
      this.mBlur.uniforms.tIn.value = s; this.mBlur.uniforms.dir.value.set(spread / w, 0); this.pass(this.mBlur, b);
      this.mBlur.uniforms.tIn.value = b.texture; this.mBlur.uniforms.dir.value.set(0, spread / h); this.pass(this.mBlur, a);
      s = a.texture;
    }
    return a.texture;
  }
  // render the scene once (n = 1) or as n sub-frame samples; draw(i) poses the world for sample i
  // and returns the camera. The last sample is the centre one, so the depth buffer matches it.
  scene(scene, n, draw, ss = 1, msaa = 4) {
    const r = this.r;
    this.useSS(ss, msaa);
    if (n <= 1) {
      const cam = draw(0); this.mark('update');
      r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, cam); this.src = this.rtScene.texture; this.mark('scene'); return cam;
    }
    r.setRenderTarget(this.rtAccum); r.setClearColor(0x000000, 1); r.clear();
    let cam = null;
    for (let i = 0; i < n; i++) {
      cam = draw(i);
      r.setRenderTarget(this.rtScene); r.clear(); r.render(scene, cam);
      this.mAdd.uniforms.tIn.value = this.rtScene.texture; this.mAdd.uniforms.w.value = 1 / n;
      this.pass(this.mAdd, this.rtAccum);
    }
    this.src = this.rtAccum.texture;
    this.mark('scene x' + n);
    return cam;
  }

  // ---- SSAO: half-res AO + depth, two bilateral blur passes -> texture (r = AO)
  ao(P, camera) {
    if (!this._ao) {
      const W = this.W / 2, H = this.H / 2, o = { type: THREE.HalfFloatType, depthBuffer: false };
      this._ao = { a: new THREE.WebGLRenderTarget(W, H, o), b: new THREE.WebGLRenderTarget(W, H, o), W, H,
        m: this.mk(SSAO, { tDepth: { value: null }, proj: { value: new THREE.Matrix4() }, invProj: { value: new THREE.Matrix4() }, kern: { value: aoKernel(AO_N) },
          radius: { value: 0.5 }, bias: { value: 0.03 }, texel: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 1000 } }),
        mb: this.mk(AO_BLUR, { tIn: { value: null }, dir: { value: new THREE.Vector2() } }) };
    }
    const A = this._ao, u = A.m.uniforms;
    u.tDepth.value = this.rtScene.depthTexture; u.proj.value.copy(camera.projectionMatrix); u.invProj.value.copy(camera.projectionMatrixInverse);
    u.radius.value = P.aoRadius; u.bias.value = P.aoBias; u.texel.value.set(1 / this.sw, 1 / this.sh); u.near.value = camera.near; u.far.value = camera.far;
    this.pass(A.m, A.a);
    const b = A.mb.uniforms;
    b.tIn.value = A.a.texture; b.dir.value.set(1 / A.W, 0); this.pass(A.mb, A.b);
    b.tIn.value = A.b.texture; b.dir.value.set(0, 1 / A.H); this.pass(A.mb, A.a);
    return A.a.texture;
  }

  // ---- god rays from a world point: quarter-res occlusion mask + 2 radial blur passes -> { tex, k }
  rays(G, camera, worldPos, t) {
    _v.set(...worldPos);
    _w.copy(_v).applyMatrix4(camera.matrixWorldInverse);
    if (_w.z > -0.1) return null;                  // light behind the camera
    _v.project(camera);
    const lp = [(_v.x + 1) / 2, (_v.y + 1) / 2], ld = Math.min(_v.z * 0.5 + 0.5, 0.9999999);
    const off = Math.max(Math.abs(_v.x), Math.abs(_v.y));
    const fadeOff = off < 1.6 ? 1 : Math.max(0, 1 - (off - 1.6) / 1.4);
    if (fadeOff <= 0) return null;
    if (!this._rays) {
      const W = this.W / 4, H = this.H / 4, o = { type: THREE.HalfFloatType, depthBuffer: false };
      this._rays = { a: new THREE.WebGLRenderTarget(W, H, o), b: new THREE.WebGLRenderTarget(W, H, o),
        mm: this.mk(RAY_MASK, { tDepth: { value: null }, tScene: { value: null }, lp: { value: new THREE.Vector2() }, ld: { value: 1 }, aspect: { value: this.W / this.H },
          radius: { value: 0.15 }, streaks: { value: 0.5 }, bright: { value: 0 }, seed: { value: 0 } }),
        mb: this.mk(RAY_BLUR, { tIn: { value: null }, lp: { value: new THREE.Vector2() }, len: { value: 1 }, decay: { value: 0.96 } }) };
    }
    const R = this._rays, m = R.mm.uniforms;
    m.tDepth.value = this.rtScene.depthTexture; m.tScene.value = this.src; m.lp.value.set(...lp); m.ld.value = ld;
    m.radius.value = G.radius ?? 0.16; m.streaks.value = G.streaks ?? 0.6; m.bright.value = G.bright ?? 0; m.seed.value = 3.7 + t * 0.04;
    this.pass(R.mm, R.a);
    const b = R.mb.uniforms; b.lp.value.set(...lp);
    b.tIn.value = R.a.texture; b.len.value = G.density ?? 0.9; b.decay.value = G.decay ?? 0.965; this.pass(R.mb, R.b);
    b.tIn.value = R.b.texture; b.len.value = (G.density ?? 0.9) / RAY_N * 1.5; b.decay.value = 1; this.pass(R.mb, R.a);
    return { tex: R.a.texture, k: fadeOff };
  }

  // X = { o: set offset [x,y,z], M: resolved mood } (optional; needed for god rays / height fog)
  compose(P0, camera, target, frame, X = null) {
    const P = { ...DEFAULT_POST, ...P0 };
    const W = this.W, H = this.H, src = this.src;
    const u = this.cu;
    const strip = new Set(P.strip || []);          // debug/bench: force features off
    const on = (k, v) => v && !strip.has(k);
    // AO + god rays first (they read the scene's depth)
    const aoOn = on('AO', P.ao > 0.001);
    u.aoK.value = aoOn ? P.ao : 0; u.aoPow.value = P.aoPower;
    if (aoOn) { u.tAO.value = this.ao(P, camera); this.mark('ao'); }
    const G = { ...DEFAULT_POST.godrays, ...(P.godrays || {}) };
    u.raysK.value = 0;
    if (on('RAYS', G.strength > 0.001)) {
      const o = X?.o || [0, 0, 0];
      const res = this.rays(G, camera, [G.pos[0] + o[0], G.pos[1] + o[1], G.pos[2] + o[2]], frame / 30);
      if (res) { u.tRays.value = res.tex; u.raysK.value = G.strength * res.k; u.raysColor.value.set(G.color); }
      this.mark('godrays');
    }
    // DOF/tilt-shift blur chain (half-res copy -> quarter-res CoC-weighted blur -> eighth-res blur) + bloom
    const needBlur = on('BLUR', P.dof > 0 || P.tilt > 0), bloomOn = on('BLOOM', P.bloom > 0);
    let blurQ = null, blurE = null;
    if (needBlur || bloomOn) { this.mCopy.uniforms.tIn.value = src; this.pass(this.mCopy, this.h1); }
    if (needBlur) {
      const cu = this.mCoc.uniforms; cu.tIn.value = this.h1.texture; cu.tDepth.value = this.rtScene.depthTexture; cu.near.value = camera.near; cu.far.value = camera.far;
      for (const k of ['focus', 'focusRange', 'dof', 'tiltTop', 'tiltBottom', 'tilt']) cu[k].value = P[k];
      this.pass(this.mCoc, this.q1);
      blurQ = this.blur(this.q1.texture, this.q1, this.q2, W / 4, H / 4, 2, 1.25);
      this.mCopy.uniforms.tIn.value = blurQ; this.pass(this.mCopy, this.e1);
      blurE = this.blur(this.e1.texture, this.e1, this.e2, W / 8, H / 8, 2, 1.3);
      this.mark('dofblur');
    }
    let bloomTex = null;
    if (bloomOn) {
      this.mBright.uniforms.tIn.value = this.h1.texture; this.mBright.uniforms.threshold.value = P.bloomThreshold;
      this.pass(this.mBright, this.bl1);
      const bloomQ = this.blur(this.bl1.texture, this.bl1, this.bl2, W / 4, H / 4, 2, 2.0);
      this.mCopy.uniforms.tIn.value = bloomQ; this.pass(this.mCopy, this.bs1);
      const bloomS = this.blur(this.bs1.texture, this.bs1, this.bs2, W / 16, H / 16, 3, 1.5);
      this.mBloomMerge.uniforms.tA.value = bloomQ; this.mBloomMerge.uniforms.tB.value = bloomS; this.pass(this.mBloomMerge, this.bl2);
      bloomTex = this.bl2.texture;
      this.mark('bloom');
    }
    // feature set -> shader variant
    const F = X?.M?.fog;
    const fogOn = on('FOG', !!(F && F.density > 0));
    const aa = P.aa === 'fxaa' || P.aa === 'smaa' ? P.aa : 'none';
    const lgg = [...P.gLift, ...P.gGamma.map((v) => v - 1), ...P.gGain.map((v) => v - 1)].some((v) => Math.abs(v) > 1e-4);
    const defs = { TM: P.tonemap === 'agx' ? 1 : (P.aces >= 0.999 ? 0 : 2) };
    const flag = (k, v) => { if (on(k, v)) defs[k] = 1; };
    flag('SS1', this.sw === W && this.sh === H); flag('CA', P.ca > 0); flag('BLUR', needBlur); flag('DOF', needBlur && P.dof > 0);
    flag('AO', aoOn); flag('FOG', fogOn); flag('RAYS', u.raysK.value > 0); flag('BLOOM', bloomOn);
    flag('HAZE', P.haze > 0); flag('LGG', lgg); flag('SPLIT', P.split > 0); flag('FLASH', P.flash > 0);
    flag('VIG', P.vignette > 0); flag('FADE', P.fade > 0); flag('GRAIN', aa === 'none' && P.grain > 0);
    // composite uniforms (unused samplers stay bound to a valid texture)
    const any = this.h1.texture;
    u.tScene.value = src; u.tBlur.value = blurQ || any; u.tBlur2.value = blurE || any; u.tBloom.value = bloomTex || any; u.tDepth.value = this.rtScene.depthTexture;
    if (!aoOn) u.tAO.value = any;
    if (!defs.RAYS) u.tRays.value = any;
    u.near.value = camera.near; u.far.value = camera.far; u.seed.value = frame % 997;
    for (const k of ['focus', 'focusRange', 'dof', 'tiltTop', 'tiltBottom', 'tilt', 'bloom', 'haze', 'sat', 'contrast', 'exposure', 'vignette', 'grain', 'flash', 'ca', 'fade', 'aces', 'agxLook', 'split', 'splitBalance']) u[k].value = P[k];
    for (const k of ['hazeColor', 'tint', 'lift', 'fadeColor', 'splitShadow', 'splitHigh']) u[k].value.set(P[k]);
    for (const k of ['gLift', 'gGamma', 'gGain']) u[k].value.set(...P[k]);
    // exponential height fog (mood keys fog.density / fog.height / fog.base / fog.sun / fog.max / fog.sky / fog.hcolor)
    u.fogD.value = fogOn ? F.density : 0;
    if (fogOn) {
      u.fogH.value = F.height ?? 8; u.fogBase.value = (F.base ?? 0) + (X.o?.[1] || 0); u.fogSun.value = F.sun ?? 0.35; u.fogMax.value = F.max ?? 0.92; u.fogSky.value = F.sky ?? 600;
      u.fogCol.value.set(F.hcolor ?? F.color); u.sunCol.value.set(X.M.sun?.color ?? '#ffffff');
      u.sunDirW.value.set(...(X.M.sunDir || [0, 1, 0])).normalize();
      u.camPos.value.setFromMatrixPosition(camera.matrixWorld); u.invProj.value.copy(camera.projectionMatrixInverse); u.camWorld.value.copy(camera.matrixWorld);
    }
    this.pass(this.compMat(defs), aa === 'none' ? target : this.ldr);
    this.mark('composite');
    if (P.copytest) { this.mCopy.uniforms.tIn.value = this.ldr.texture; this.pass(this.mCopy, this.outB); this.mark('copytest'); }
    if (aa === 'smaa') this.smaa(P, target, frame);
    else if (aa === 'fxaa') { this.fxaa(P, target, frame); this.mark('fxaa'); }
  }

  // SMAA 1x: edges (luma) -> blend weights (area/search LUTs) -> neighbourhood blend (+ grain).
  // P.smaaPreset: 'low' (threshold 0.15, 4 search steps) | 'medium' (0.1, 8; default) | 'high' (0.1, 16)
  smaa(P, target, frame) {
    const preset = P.smaaPreset || 'medium';
    if (!this._smaa) {
      const W = this.W, H = this.H;
      this._smaa = { e: new THREE.WebGLRenderTarget(W, H, { depthBuffer: false }), w: new THREE.WebGLRenderTarget(W, H, { depthBuffer: false }), res: new THREE.Vector2(1 / W, 1 / H), mats: {} };
    }
    const S = this._smaa, r = this.r;
    if (!S.mats[preset]) {
      const T = smaaTextures(), res = S.res;
      const PR = { low: ['0.15', '4'], medium: ['0.1', '8'], high: ['0.1', '16'] }[preset] || ['0.1', '8'];
      const sh = (Sh, u, defs) => new THREE.ShaderMaterial({ defines: { ...Sh.defines, ...defs }, uniforms: u, vertexShader: Sh.vertexShader, fragmentShader: Sh.fragmentShader, depthTest: false, depthWrite: false });
      S.mats[preset] = {
        me: sh(SMAAEdgesShader, { tDiffuse: { value: this.ldr.texture }, resolution: { value: res } }, { SMAA_THRESHOLD: PR[0] }),
        mw: sh(SMAAWeightsShader, { tDiffuse: { value: S.e.texture }, tArea: { value: T.area }, tSearch: { value: T.search }, resolution: { value: res } }, { SMAA_MAX_SEARCH_STEPS: PR[1] }),
        mb: new THREE.ShaderMaterial({ vertexShader: SMAA_BLEND_VS, fragmentShader: SMAA_BLEND_FS, depthTest: false, depthWrite: false,
          uniforms: { tDiffuse: { value: S.w.texture }, tColor: { value: this.ldr.texture }, resolution: { value: res }, grain: { value: 0 }, seed: { value: 0 } } }),
      };
    }
    const Mt = S.mats[preset];
    r.setRenderTarget(S.e); r.setClearColor(0x000000, 0); r.clear(); r.setClearColor(0x000000, 1);
    this.pass(Mt.me, S.e); this.mark('smaa-edges');
    this.pass(Mt.mw, S.w); this.mark('smaa-weights');
    Mt.mb.uniforms.grain.value = P.grain; Mt.mb.uniforms.seed.value = frame % 997;
    this.pass(Mt.mb, target); this.mark('smaa-blend');
  }

  fxaa(P, target, frame) {
    if (!this._fxaa) this._fxaa = this.mk(FXAA_FS, { tIn: { value: this.ldr.texture }, inv: { value: new THREE.Vector2(1 / this.W, 1 / this.H) }, grain: { value: 0 }, seed: { value: 0 } });
    this._fxaa.uniforms.grain.value = P.grain; this._fxaa.uniforms.seed.value = frame % 997;
    this.pass(this._fxaa, target);
  }

  mix(a, b, mode, k, color = '#ffffff', seed = 0) {
    const u = this.mMix.uniforms; u.tA.value = a.texture; u.tB.value = b.texture; u.k.value = k;
    u.mode.value = MODES[mode] ?? 0; u.color.value.set(color); u.seed.value = seed;
    this.pass(this.mMix, null);
  }
}
