// GLSL for fx.js (owner: fx agent). All fragment shaders write DISPLAY colours (no lighting, no tone mapping, no fog),
// so the cartoon overlays keep their exact colours under any light. Every shader can pixelate itself in SCREEN space
// (uPix = block size in device pixels) so the pixel look is the same in close-ups and wide shots.

// snap the fragment to the centre of its screen-space pixel block and shift any varying by its derivatives
const PIX = /* glsl */`
uniform float uPix;
vec2 pixOff(){ if (uPix <= 0.0) return vec2(0.0); vec2 fc = gl_FragCoord.xy; return (floor(fc / uPix) + 0.5) * uPix - fc; }
vec2 snap2(vec2 v, vec2 o){ return v + dFdx(v) * o.x + dFdy(v) * o.y; }
float snap1(float v, vec2 o){ return v + dFdx(v) * o.x + dFdy(v) * o.y; }
`;

export const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// strips: aW = local half width / max half width, aA = per-vertex alpha
export const VS_STRIP = /* glsl */`attribute float aW; attribute float aA; varying vec2 vUv; varying float vW; varying float vA;
void main(){ vUv = uv; vW = aW; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ------------------------------------------------------------------ stink line
// Quad: x in [-W/2, W/2], y in [0, H] (world units through uSize). One wavy line segment [uYa, uYb] with round caps,
// light lime core + highlight stripe + dark green outline, the lower part of the segment fades out (like the refs).
export const STINK_FS = /* glsl */`
uniform float uT, uPhase, uAmp, uLambda, uThick, uOpacity, uYa, uYb, uFadeBot, uSway, uOutline;
uniform vec2 uSize;
uniform vec3 uCore, uEdge, uHi;
varying vec2 vUv;
${PIX}
float cx(float y){
  float k = clamp(y / uSize.y, 0.0, 1.0);
  float a = uAmp * (0.55 + 0.6 * k);
  float w = 6.28318 * (y / uLambda) - uT + uPhase;
  return a * sin(w) + 0.16 * a * sin(1.73 * w + uPhase * 2.3 + uT * 0.37) + uSway * k * k;
}
void main(){
  vec2 o = pixOff();
  vec2 uv = snap2(vUv, o);
  vec2 p = vec2((uv.x - 0.5) * uSize.x, uv.y * uSize.y);
  float st = uLambda / 16.0;
  float y0 = clamp(p.y, uYa, uYb);
  float best = 1e9, sAt = y0, sgn = 1.0;
  for (int j = -4; j <= 3; j++) {
    float ya = clamp(y0 + float(j) * st, uYa, uYb);
    float yb = clamp(ya + st, uYa, uYb);
    vec2 A = vec2(cx(ya), ya), B = vec2(cx(yb), yb);
    vec2 pa = p - A, ba = B - A;
    float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-10), 0.0, 1.0);
    float d = length(pa - ba * hh);
    if (d < best) { best = d; sAt = mix(ya, yb, hh); sgn = (ba.y * pa.x - ba.x * pa.y) >= 0.0 ? 1.0 : -1.0; }
  }
  float k = clamp(sAt / uSize.y, 0.0, 1.0);
  float th = uThick * 0.5 * mix(1.0, 0.8, k);
  if (best > th) discard;
  float ow = th * uOutline;
  float s = -sgn * best / th;                 // -1..1 across the line (negative = left side)
  vec3 col = uCore;
  col = mix(col, uHi, step(-0.78, s) * step(s, -0.18));
  col = mix(col, uCore * 0.82, step(0.45, s));
  col = mix(uEdge, col, step(best, th - ow));
  float segLen = max(uYb - uYa, 1e-5);
  float a = smoothstep(0.0, uFadeBot, (sAt - uYa) / segLen);   // lower part fades out
  a = mix(0.18, 1.0, a);
  a *= 1.0 - smoothstep(0.9, 1.0, sAt / uSize.y);
  a *= uOpacity;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}`;

// ------------------------------------------------------------------ outlined strip (flows, jets, tear streams, air curls)
// uv.x along the strip 0..1, uv.y across 0..1. Constant outline width (fraction of the strip's MAX half width).
export const STRIP_FS = /* glsl */`
uniform vec3 uCore, uEdge, uHi;
uniform float uOutline, uOpacity, uHiAmt, uHiSide, uShade;
varying vec2 vUv; varying float vW; varying float vA;
${PIX}
void main(){
  vec2 o = pixOff();
  vec2 uv = snap2(vUv, o);
  float w = max(snap1(vW, o), 1e-4), al = snap1(vA, o);
  float s = (uv.y - 0.5) * 2.0 * uHiSide;
  float d = abs(s);
  if (d > 1.0) discard;
  float edge = (1.0 - d) * w;                 // distance to the edge in max-half-width units
  vec3 col = uCore;
  col = mix(col, uCore * uShade, smoothstep(0.35, 0.9, s));
  col = mix(col, uHi, uHiAmt * step(-0.72, s) * step(s, -0.22) * step(0.25, w));
  col = mix(uEdge, col, step(uOutline, edge));
  float a = uOpacity * clamp(al, 0.0, 1.0);
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}`;

// ------------------------------------------------------------------ soft lumpy cloud (haze, dust, puffs)
export const CLOUD_FS = /* glsl */`
uniform float uT, uPhase, uOpacity, uSoft, uCoreA, uLump;
uniform vec3 uCol, uCol2;
varying vec2 vUv;
${PIX}
void main(){
  vec2 uv = snap2(vUv, pixOff());
  vec2 p = uv - 0.5;
  float r = length(p) * 2.0;
  float ang = atan(p.y, p.x);
  float lump = uLump * (0.08 * sin(ang * 3.0 + uPhase + uT * 0.7) + 0.06 * sin(ang * 5.0 - uPhase * 1.3 - uT * 1.1) + 0.035 * sin(ang * 8.0 + uPhase * 2.1));
  float edge = 0.8 + lump;
  float a = 1.0 - smoothstep(edge - uSoft, edge, r);
  a *= mix(uCoreA, 1.0, smoothstep(0.0, edge, r));
  float sh = clamp(0.5 + (p.y - p.x * 0.4) * 1.2, 0.0, 1.0);
  vec3 col = mix(uCol2, uCol, sh);
  a *= uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;

// ------------------------------------------------------------------ 4-point sparkle with soft glow
export const STAR_FS = /* glsl */`
uniform float uOpacity; uniform vec3 uCol, uGlowCol;
varying vec2 vUv;
${PIX}
void main(){
  vec2 p = (snap2(vUv, pixOff()) - 0.5) * 2.0;
  vec2 q = abs(p);
  float st = sqrt(q.x) + sqrt(q.y);
  float s = 1.0 - smoothstep(0.86, 0.96, st);
  float r = length(p);
  float glow = exp(-r * r * 9.0);
  float a = max(s, glow * 0.8);
  vec3 col = mix(uGlowCol, uCol, max(s, smoothstep(0.55, 1.0, glow)));
  a *= uOpacity;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}`;

// ------------------------------------------------------------------ red zigzag itch squiggle (quad, x along the zigzag)
export const ZIG_FS = /* glsl */`
uniform float uN, uAmp, uW, uOpacity, uT, uSeed;
uniform vec3 uCore, uEdge, uHi;
varying vec2 vUv;
${PIX}
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
vec2 pt(float k){
  float x = mix(-0.8, 0.8, k / uN);
  float j = sin(uT * 37.0 + k * 2.7 + uSeed) * 0.22 + sin(uT * 23.0 + k * 5.1 + uSeed * 1.7) * 0.12;
  float y = (k < 0.5 || k > uN - 0.5) ? 0.0 : (mod(k, 2.0) < 0.5 ? -uAmp : uAmp) * (1.0 + j);
  return vec2(x, y);
}
void main(){
  vec2 p = (snap2(vUv, pixOff()) - 0.5) * 2.0;
  float d = 10.0;
  for (int i = 0; i < 9; i++) {
    float k = float(i);
    if (k >= uN) break;
    d = min(d, sdSeg(p, pt(k), pt(k + 1.0)));
  }
  float ow = uW * 0.55;
  if (d > uW + ow) discard;
  vec3 col = mix(uEdge, uCore, step(d, uW));
  col = mix(col, uHi, step(d, uW * 0.35) * 0.6);
  gl_FragColor = vec4(col, uOpacity);
}`;

// ------------------------------------------------------------------ comic streak lines (radial fan for impacts)
export const STREAK_FS = /* glsl */`
uniform float uOpacity, uCount, uProg, uW, uSeed;
uniform vec3 uCol, uOut;
varying vec2 vUv;
${PIX}
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * hh); }
void main(){
  vec2 p = (snap2(vUv, pixOff()) - 0.5) * 2.0;
  float dmin = 10.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    if (fi >= uCount) break;
    float ang = 6.28318 * (fi + 0.3 * sin(fi * 3.7 + uSeed)) / uCount + uSeed;
    vec2 dir = vec2(cos(ang), sin(ang));
    float r0 = mix(0.32, 0.72, uProg), r1 = mix(0.5, 0.98, smoothstep(0.0, 0.45, uProg));
    dmin = min(dmin, seg(p, dir * r0, dir * max(r1, r0 + 0.02)));
  }
  float core = step(dmin, uW * 0.62);
  float outl = step(dmin, uW);
  if (outl < 0.5) discard;
  gl_FragColor = vec4(mix(uOut, uCol, core), uOpacity);
}`;

// ------------------------------------------------------------------ map stink trail (flat ribbon, uv in METERS)
// uv.x = arc length s along the path (0..uLen), uv.y = across (meters, centre 0). Revealed up to uHead.
// Main thick wavy line + two thin companion lines + soft translucent glow band; bright pulsing head.
export const TRAIL_FS = /* glsl */`
uniform float uT, uHead, uLen, uWidth, uOpacity, uTailIn, uHeadLen;
uniform vec3 uCore, uEdge, uHi, uGlowCol, uHeadCol;
varying vec2 vUv;
${PIX}
float cw(float s, float A, float lam, float om, float ph){ return A * sin(6.28318 * s / lam - om * uT + ph); }
// distance to y = A sin(...) for s in [0, sEnd], round caps
float sdW(vec2 p, float A, float lam, float om, float ph, float sEnd){
  float x = clamp(p.x, 0.0, sEnd);
  float w = 6.28318 * x / lam - om * uT + ph;
  float c = A * sin(w);
  if (p.x > sEnd || p.x < 0.0) return length(p - vec2(x, c));
  float dc = A * 6.28318 / lam * cos(w);
  return abs(p.y - c) / sqrt(1.0 + dc * dc);
}
void main(){
  vec2 o = pixOff();
  vec2 p = snap2(vUv, o);
  float W = uWidth;
  float head = uHead;
  if (head <= 0.0) discard;
  // thickness envelope: thin tail at the start, fat bright head
  float tail = smoothstep(0.0, uTailIn, p.x);
  float hk = smoothstep(head - uHeadLen, head, p.x);                 // 0 body .. 1 at the head
  float swell = 1.0 + 0.35 * hk + 0.08 * sin(p.x * 0.9 - uT * 5.0);
  // main line
  float A0 = W * 0.17 * (1.0 + 0.4 * hk);
  float th0 = W * 0.2 * mix(0.35, 1.0, tail) * swell;
  float d0 = sdW(p, A0, W * 3.2, 3.0, 0.0, head);
  // companions (thin, opposite phase, wider swing)
  float th1 = W * 0.075 * mix(0.3, 1.0, tail);
  float d1 = sdW(p - vec2(0.0, W * 0.05), W * 0.36, W * 2.5, 3.6, 2.3, head - W * 0.55);
  float d2 = sdW(p + vec2(0.0, W * 0.05), W * 0.33, W * 2.9, 2.7, 4.4, head - W * 1.1);
  vec3 col = vec3(0.0); float a = 0.0;
  // soft glow band around the main line (translucent green)
  float gb = exp(-pow(d0 / (W * 0.55), 2.0)) * (p.x <= head + W * 0.3 ? 1.0 : 0.0);
  float g = 0.32 * gb * mix(0.4, 1.0, tail) + 0.45 * hk * exp(-pow(length(p - vec2(head, cw(head, A0, W * 3.2, 3.0, 0.0))) / (W * 0.9), 2.0));
  col = uGlowCol; a = g;
  float ow1 = max(th1 * 0.38, W * 0.03);
  if (d1 < th1 || d2 < th1) { float dd = min(d1, d2); col = mix(uEdge, uCore, step(dd, th1 - ow1)); a = 1.0; }
  float ow0 = max(th0 * 0.26, W * 0.035);
  if (d0 < th0) {
    float s = (p.y - cw(clamp(p.x, 0.0, head), A0, W * 3.2, 3.0, 0.0)) / th0;
    vec3 core = mix(uCore, uHeadCol, hk);
    vec3 c = core;
    c = mix(c, uHi, step(0.2, s) * step(s, 0.68));
    c = mix(c, core * 0.84, step(s, -0.5));
    col = mix(uEdge, c, step(d0, th0 - ow0)); a = 1.0;
  }
  a *= uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;
