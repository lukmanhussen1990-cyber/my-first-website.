// GLSL for the post-processing pipeline.

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;

// View-space position from depth.
vec3 viewPos(vec2 uv, float depth) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

export const FOG_FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
precision highp sampler2DShadow;
${COMMON}
#define MAX_STEPS 32
#define MAX_LAMPS 8
uniform sampler2D tDepth;
uniform sampler3D tNoise;
uniform mat4 uCarInv;
uniform vec3 uCabinMin;
uniform vec3 uCabinMax;
uniform float uTime;
uniform float uFrame;
uniform int uSteps;
uniform float uMaxDist;
uniform float uDensity;
uniform float uHeightFall;
uniform float uGroundY;
uniform float uNoiseAmt;
uniform vec3 uWindOffset;
// Fog bank crossing the road.
uniform float uBankDensity;
uniform vec3 uBankCenter;
uniform vec3 uBankFwd;
uniform vec3 uBankRight;
uniform vec3 uBankSize;
// Headlights.
uniform vec3 uHeadPos[2];
uniform mat4 uHeadMatrix[2];
uniform sampler2D tHeadPattern;
uniform vec3 uHeadColor;
uniform sampler2DShadow tHeadShadow;
uniform float uHeadShadowOn;
// Moon.
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform vec3 uMoonLightDir;
uniform mat4 uMoonMatrix;
uniform sampler2DShadow tMoonShadow;
uniform float uMoonShadowOn;
uniform vec3 uAmbient;
// Lamps (streetlights, beacons, event glows).
uniform vec4 uLampPos[MAX_LAMPS];
uniform vec4 uLampCol[MAX_LAMPS];
uniform vec4 uLampDir[MAX_LAMPS];
varying vec2 vUv;

float hg(float c, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (12.566 * pow(max(1.0 + g2 - 2.0 * g * c, 1e-3), 1.5));
}

float density(vec3 p) {
  float h = p.y - uGroundY;
  float d = uDensity * exp(-clamp(h, -3.0, 60.0) * uHeightFall);
  float n1 = texture(tNoise, p * 0.021 + uWindOffset).r;
  float n2 = texture(tNoise, p * 0.067 + uWindOffset * 2.3 + 0.37).r;
  float m = n1 * 1.25 + n2 * 0.55 - 0.42;
  d *= max(mix(1.0, m * 1.6, uNoiseAmt), 0.0);
  if (uBankDensity > 0.0) {
    vec3 q = p - uBankCenter;
    vec3 l = vec3(dot(q, uBankRight), q.y, dot(q, uBankFwd)) / uBankSize;
    float shape = smoothstep(1.0, 0.35, length(l));
    float wisps = texture(tNoise, p * 0.05 + uWindOffset * 3.0).r;
    d += uBankDensity * shape * (0.35 + wisps * 1.1);
  }
  return d;
}

vec3 lightAt(vec3 p, vec3 rd) {
  vec3 L = uAmbient;
  // Headlights: sample their actual projected beam pattern and shadows.
  for (int i = 0; i < 2; i++) {
    vec4 sc = uHeadMatrix[i] * vec4(p, 1.0);
    if (sc.w <= 0.0) continue;
    vec3 c = sc.xyz / sc.w;
    if (any(lessThan(c.xy, vec2(0.0))) || any(greaterThan(c.xy, vec2(1.0)))) continue;
    vec3 pat = texture(tHeadPattern, c.xy).rgb;
    vec3 tl = p - uHeadPos[i];
    float d2 = dot(tl, tl);
    float vis = 1.0;
    if (i == 0 && uHeadShadowOn > 0.5) vis = texture(tHeadShadow, vec3(c.xy, c.z - 0.0004));
    float cosA = dot(tl * inversesqrt(d2), -rd);
    float ph = hg(cosA, 0.55) * 0.55 + hg(cosA, -0.35) * 0.45;
    L += uHeadColor * pat * pat * vis * ph / (d2 + 2.0);
  }
  // Moonlight with tree shadows -> shafts.
  float mvis = 1.0;
  if (uMoonShadowOn > 0.5) {
    vec4 ms = uMoonMatrix * vec4(p, 1.0);
    vec3 mc = ms.xyz / ms.w;
    if (all(greaterThan(mc.xy, vec2(0.0))) && all(lessThan(mc.xy, vec2(1.0)))) {
      mvis = texture(tMoonShadow, vec3(mc.xy, mc.z - 0.001));
    }
  }
  float cm = dot(uMoonDir, rd);
  L += uMoonColor * mvis * (hg(cm, 0.72) * 0.8 + 0.035);
  // Lamps.
  for (int i = 0; i < MAX_LAMPS; i++) {
    vec4 col = uLampCol[i];
    if (col.w < -1.5) continue;
    vec3 tl = p - uLampPos[i].xyz;
    float d2 = dot(tl, tl);
    float r = uLampPos[i].w;
    if (d2 > r * r) continue;
    vec3 l = tl * inversesqrt(d2);
    float cone = 1.0;
    if (col.w > -0.99) cone = smoothstep(col.w, uLampDir[i].w, dot(l, uLampDir[i].xyz));
    float fall = (1.0 - smoothstep(r * 0.4, r, sqrt(d2)));
    float ph = hg(dot(l, -rd), 0.45) * 0.7 + 0.024;
    L += col.rgb * cone * fall * ph / (d2 + 0.8);
  }
  return L;
}

void main() {
  float depth = texture(tDepth, vUv).r;
  vec3 vp = viewPos(vUv, depth);
  float sceneDist = depth >= 0.99999 ? 1e6 : length(vp);
  vec3 rd = normalize((uCamWorld * vec4(normalize(vp), 0.0)).xyz);
  vec3 ro = uCamPos;
  // Start where the ray leaves the cabin.
  vec3 roC = (uCarInv * vec4(ro, 1.0)).xyz;
  vec3 rdC = (uCarInv * vec4(rd, 0.0)).xyz;
  vec3 inv = 1.0 / (rdC + vec3(1e-6));
  vec3 t1 = (uCabinMin - roC) * inv;
  vec3 t2 = (uCabinMax - roC) * inv;
  vec3 tmax = max(t1, t2);
  float tStart = max(min(min(tmax.x, tmax.y), tmax.z), 0.0);
  float tEnd = min(sceneDist, uMaxDist);
  if (tEnd <= tStart + 0.01) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  // Interleaved-gradient jitter, rotated every frame.
  vec2 fc = gl_FragCoord.xy + vec2(uFrame * 5.588238, uFrame * 3.12);
  float jitter = fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715))));
  vec3 scat = vec3(0.0);
  float trans = 1.0;
  float span = tEnd - tStart;
  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= uSteps) break;
    float a = (float(i) + jitter) / float(uSteps);
    float b = min((float(i) + 1.0 + jitter) / float(uSteps), 1.0);
    float ta = tStart + span * a * a;
    float tb = tStart + span * b * b;
    float seg = tb - ta;
    if (seg <= 0.0) continue;
    vec3 p = ro + rd * (ta + tb) * 0.5;
    float dens = density(p);
    if (dens < 1e-6) continue;
    float T = exp(-dens * seg);
    scat += trans * lightAt(p, rd) * (1.0 - T);
    trans *= T;
    if (trans < 0.01) break;
  }
  gl_FragColor = vec4(scat, trans);
}
`;

export const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tScene;
uniform sampler2D tFog;
uniform sampler2D tDepth;
uniform sampler2D tWipe;
uniform vec2 uFogSize;
uniform mat4 uCarInv;
uniform mat4 uCarWorld;
uniform mat4 uViewProj;
uniform vec3 uPane[24];
uniform vec4 uPaneInfo[6];   // flow.xy, wipers?, enabled
uniform vec3 uWiperPivot[2];
uniform vec2 uWiperLen;
uniform vec2 uWiperMax;
uniform vec3 uGlassUp;
uniform float uTime;
uniform float uRain;
uniform float uSpeed;
uniform float uWetGlass;
uniform float uDashReflect;
uniform vec3 uSkyRefl;
varying vec2 vUv;

vec4 fogAt(vec2 uv, float dist) {
  // Depth-aware upsample of the low-res fog (also smooths the dither).
  vec2 texel = 1.0 / uFogSize;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y)) * texel;
      float dd = texture(tDepth, uv + o).r;
      float dist2 = dd >= 0.99999 ? 1e6 : length(viewPos(uv + o, dd));
      float w = 1.0 / (0.02 + abs(log(max(dist2, 0.01)) - log(max(dist, 0.01))) * 6.0);
      w *= (x == 0 && y == 0) ? 1.5 : 1.0;
      acc += texture(tFog, uv + o) * w;
      wsum += w;
    }
  }
  return acc / wsum;
}

vec3 fogged(vec2 uv) {
  float d = texture(tDepth, uv).r;
  float dist = d >= 0.99999 ? 1e6 : length(viewPos(uv, d));
  vec4 f = texture(tFog, uv);
  return texture(tScene, uv).rgb * f.a + f.rgb;
}

// Raindrops resting on glass: random drop per cell, refracting (offset, mask).
vec3 staticDrops(vec2 p, float cells, float age, float density, float seed) {
  vec2 q = p * cells;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec3 n = hash32(id + seed);
  float present = step(n.z, density);
  float appear = hash12(id + seed * 3.1) * 5.0 / max(density, 0.05);
  present *= smoothstep(appear, appear + 0.4, age);
  vec2 o = (n.xy - 0.5) * 0.65;
  float r = mix(0.12, 0.34, hash12(id + 7.7 + seed));
  vec2 d = f - o;
  d.y *= 1.12;
  float dist = length(d);
  float m = smoothstep(r, r * 0.55, dist) * present;
  return vec3(d / r * m, m);
}

// Drops streaking along the airflow with thin trails behind them.
vec3 runningDrops(vec2 p, vec2 flow, float t, float speed, float density) {
  vec2 fd = normalize(flow);
  vec2 pr = vec2(dot(p, vec2(fd.y, -fd.x)), dot(p, fd));
  vec2 q = pr * vec2(16.0, 3.0);
  float col = floor(q.x);
  float cr = hash12(vec2(col, 3.7));
  q.y -= t * (0.4 + cr * 1.2) * speed;
  vec2 id = vec2(col, floor(q.y));
  vec2 f = vec2(fract(q.x) - 0.5, fract(q.y));
  vec3 n = hash32(id + 11.0);
  float present = step(n.z, density * 0.8);
  float x0 = (n.x - 0.5) * 0.5;
  float y0 = 0.2 + n.y * 0.6;
  vec2 d = vec2((f.x - x0) * 4.0, (f.y - y0) * 16.0 / 3.0);
  float r = 0.32;
  float dist = length(d);
  float m = smoothstep(r, r * 0.5, dist) * present;
  // Trail: the wet line left behind the drop.
  float trail = smoothstep(0.08, 0.0, abs(f.x - x0)) * smoothstep(y0, y0 - 0.5, f.y) * step(f.y, y0) * present * 0.5;
  vec2 off = d / r * m;
  vec2 offW = off.x * vec2(fd.y, -fd.x) + off.y * fd;
  return vec3(offW, max(m, trail * 0.35));
}

float paneHit(int k, vec3 ro, vec3 rd, out vec2 ab, out vec3 hit) {
  vec3 c0 = uPane[k * 4];
  vec3 c1 = uPane[k * 4 + 1];
  vec3 c2 = uPane[k * 4 + 2];
  vec3 c3 = uPane[k * 4 + 3];
  vec3 n = normalize(cross(c1 - c0, c3 - c0));
  float den = dot(rd, n);
  if (abs(den) < 1e-5) return -1.0;
  float t = dot(c0 - ro, n) / den;
  if (t <= 0.0) return -1.0;
  vec3 p = ro + rd * t;
  float s0 = dot(cross(c1 - c0, p - c0), n);
  float s1 = dot(cross(c2 - c1, p - c1), n);
  float s2 = dot(cross(c3 - c2, p - c2), n);
  float s3 = dot(cross(c0 - c3, p - c3), n);
  bool inside = (s0 >= 0.0 && s1 >= 0.0 && s2 >= 0.0 && s3 >= 0.0) || (s0 <= 0.0 && s1 <= 0.0 && s2 <= 0.0 && s3 <= 0.0);
  if (!inside) return -1.0;
  vec3 ax = normalize(c1 - c0);
  vec3 up = normalize((c3 - c0) - ax * dot(c3 - c0, ax));
  ab = vec2(dot(p - c0, ax), dot(p - c0, up));
  hit = p;
  return t;
}

float wipeAge(vec3 hit) {
  float age = 1e4;
  for (int i = 0; i < 2; i++) {
    vec3 rel = hit - uWiperPivot[i];
    float dx = rel.x;
    float db = dot(rel, uGlassUp);
    float r = length(vec2(dx, db));
    float ang = atan(db, dx);
    if (r < uWiperLen[i] && ang >= -0.05 && ang <= uWiperMax[i] + 0.05) {
      float bin = clamp(ang / uWiperMax[i], 0.0, 1.0) * 63.0;
      float last = texelFetch(tWipe, ivec2(int(bin + 0.5), i), 0).r;
      age = min(age, uTime - last);
    }
  }
  return age;
}

void main() {
  vec2 uv = vUv;
  float depth = texture(tDepth, uv).r;
  vec3 vp = viewPos(uv, depth);
  float dist = depth >= 0.99999 ? 1e6 : length(vp);
  vec4 fog = fogAt(uv, dist);
  vec3 col = texture(tScene, uv).rgb * fog.a + fog.rgb;
  float glassMask = 0.0;
  float dropMask = 0.0;

  vec3 rd = normalize((uCamWorld * vec4(normalize(vp), 0.0)).xyz);
  vec3 roC = (uCarInv * vec4(uCamPos, 1.0)).xyz;
  vec3 rdC = normalize((uCarInv * vec4(rd, 0.0)).xyz);
  float best = dist - 0.01;
  int pane = -1;
  vec2 ab = vec2(0.0);
  vec3 hit = vec3(0.0);
  for (int k = 0; k < 6; k++) {
    if (uPaneInfo[k].w < 0.5) continue;
    vec2 ab2;
    vec3 h2;
    float t = paneHit(k, roC, rdC, ab2, h2);
    if (t > 0.0 && t < best) {
      best = t;
      pane = k;
      ab = ab2;
      hit = h2;
    }
  }

  if (pane >= 0) {
    glassMask = 1.0;
    vec4 info = uPaneInfo[pane];
    float age = info.z > 0.5 ? wipeAge(hit) : 1e4;
    float rain = uRain;
    float wet = uWetGlass;
    // Airflow pushes drops; at low speed gravity wins.
    float spd = clamp(uSpeed / 25.0, 0.0, 1.0);
    vec2 flow = normalize(mix(vec2(0.0, -1.0), info.xy, spd) + vec2(1e-4));
    vec3 d1 = staticDrops(ab, 55.0, age, rain * 0.85 * wet, float(pane) * 13.0);
    vec3 d2 = staticDrops(ab + 0.37, 120.0, age, rain * 0.9 * wet, float(pane) * 7.0 + 3.0);
    vec3 d3 = runningDrops(ab, flow, uTime, 0.4 + spd * (info.z > 0.5 ? 0.6 : 2.4), rain * wet);
    if (info.z > 0.5) d3 *= smoothstep(0.6, 2.5, age);
    vec2 off = d1.xy * 0.022 + d2.xy * 0.012 + d3.xy * 0.02;
    float m = clamp(d1.z + d2.z * 0.8 + d3.z, 0.0, 1.0);
    dropMask = m;
    if (m > 0.001) {
      // A drop is a tiny lens: it shows a flipped, shrunken view of what is behind.
      vec2 ruv = clamp(uv - off * 1.6, vec2(0.001), vec2(0.999));
      vec3 refr = fogged(ruv);
      float edge = smoothstep(0.35, 0.95, length(d1.xy) + length(d2.xy) * 0.5);
      refr *= mix(1.15, 0.45, edge);
      col = mix(col, refr, m);
    }
    // Glass: faint tint, sky/env reflection by fresnel, and a dim ghost of the
    // glowing dashboard in the lower windshield.
    vec3 n = normalize(cross(uPane[pane * 4 + 1] - uPane[pane * 4], uPane[pane * 4 + 3] - uPane[pane * 4]));
    float cosi = abs(dot(rdC, n));
    float F = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
    col *= vec3(0.9, 0.94, 0.93);
    col += uSkyRefl * F;
    if (pane == 0 && uDashReflect > 0.0) {
      vec3 c0 = uPane[0];
      vec3 ax = normalize(uPane[1] - c0);
      vec3 upv = normalize((uPane[3] - c0) - ax * dot(uPane[3] - c0, ax));
      vec3 mirrored = c0 + ax * ab.x - upv * ab.y * 0.9 - n * 0.02;
      vec4 clip = uViewProj * uCarWorld * vec4(mirrored, 1.0);
      vec2 muv = clip.xy / clip.w * 0.5 + 0.5;
      if (clip.w > 0.0 && all(greaterThan(muv, vec2(0.0))) && all(lessThan(muv, vec2(1.0)))) {
        vec3 dashCol = texture(tScene, muv).rgb;
        col += dashCol * F * uDashReflect * smoothstep(0.35, 0.0, ab.y);
      }
    }
  }
  gl_FragColor = vec4(col, glassMask * (0.5 + 0.5 * dropMask));
}
`;

export const DOF_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
uniform vec2 uPixel;
varying vec2 vUv;
#define GOLDEN 2.39996323
#define RAD_SCALE 0.7

float distAt(vec2 uv) {
  float d = texture(tDepth, uv).r;
  return d >= 0.99999 ? 1e5 : length(viewPos(uv, d));
}
float coc(float dist) {
  return clamp(uAperture * abs(1.0 / uFocus - 1.0 / max(dist, 0.05)), 0.0, uMaxCoc);
}

void main() {
  vec4 c0 = texture(tColor, vUv);
  float cd = distAt(vUv);
  float cs = coc(cd);
  // Raindrops on the glass are near the eye: blur them like near objects.
  if (c0.a > 0.5) {
    float drop = (c0.a - 0.5) * 2.0;
    cs = mix(cs, coc(1.5), drop);
  }
  vec3 color = c0.rgb;
  float tot = 1.0;
  float radius = RAD_SCALE;
  float ang = 0.0;
  for (int i = 0; i < 96; i++) {
    if (radius >= uMaxCoc) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uPixel * radius;
    vec3 sc = texture(tColor, tc).rgb;
    float sd = distAt(tc);
    float ss = coc(sd);
    if (sd > cd) ss = clamp(ss, 0.0, cs * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, ss);
    color += mix(color / tot, sc, m);
    tot += 1.0;
    radius += RAD_SCALE / radius;
    ang += GOLDEN;
  }
  gl_FragColor = vec4(color / tot, cs);
}
`;

export const BLOOM_DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uFirst;
varying vec2 vUv;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
float karis(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722)) * 0.25); }
void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 o;
  if (uFirst > 0.5) {
    // Karis-weighted groups suppress fireflies on the first downsample.
    vec3 g0 = (j + k + l + m) * 0.25;
    vec3 g1 = (a + b + d + e) * 0.25;
    vec3 g2 = (b + c + e + f) * 0.25;
    vec3 g3 = (d + e + g + h) * 0.25;
    vec3 g4 = (e + f + h + i) * 0.25;
    float w0 = karis(g0) * 0.5, w1 = karis(g1) * 0.125, w2 = karis(g2) * 0.125, w3 = karis(g3) * 0.125, w4 = karis(g4) * 0.125;
    o = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
    // Soft threshold so the dim night scene does not haze over.
    float br = max(o.r, max(o.g, o.b));
    float knee = 0.6;
    float soft = clamp(br - 0.15, 0.0, knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    o *= max(soft, br - 0.15) / max(br, 1e-4);
  } else {
    o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(o, 1.0);
}
`;

export const BLOOM_UP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 c = texture(tSrc, vUv).rgb * 4.0;
  c += (texture(tSrc, vUv + vec2(-t.x, 0.0)).rgb + texture(tSrc, vUv + vec2(t.x, 0.0)).rgb +
        texture(tSrc, vUv + vec2(0.0, -t.y)).rgb + texture(tSrc, vUv + vec2(0.0, t.y)).rgb) * 2.0;
  c += texture(tSrc, vUv + vec2(-t.x, -t.y)).rgb + texture(tSrc, vUv + vec2(t.x, -t.y)).rgb +
       texture(tSrc, vUv + vec2(-t.x, t.y)).rgb + texture(tSrc, vUv + vec2(t.x, t.y)).rgb;
  gl_FragColor = vec4(c / 16.0, 1.0);
}
`;

export const FINAL_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tComp;
uniform sampler2D tDof;
uniform sampler2D tBloom;
uniform sampler2D tDepth;
uniform float uDofOn;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
uniform float uBloom;
uniform float uGlassGlare;
uniform float uExposure;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uChroma;
uniform float uFade;
uniform float uSaturation;
uniform float uLetterbox;
uniform float uFlash;
uniform vec3 uLift;
uniform vec3 uGain;
uniform vec2 uRes;
varying vec2 vUv;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float cocAt(vec2 uv) {
  float d = texture(tDepth, uv).r;
  float dist = d >= 0.99999 ? 1e5 : length(viewPos(uv, d));
  return clamp(uAperture * abs(1.0 / uFocus - 1.0 / max(dist, 0.05)), 0.0, uMaxCoc);
}
vec3 sampleColor(vec2 uv, float blend) {
  vec3 sharp = texture(tComp, uv).rgb;
  if (uDofOn < 0.5) return sharp;
  vec3 soft = texture(tDof, uv).rgb;
  return mix(sharp, soft, blend);
}

void main() {
  vec2 uv = vUv;
  vec2 dc = uv - 0.5;
  float blend = 0.0;
  if (uDofOn > 0.5) {
    vec4 dofc = texture(tDof, uv);
    float cs = max(cocAt(uv), dofc.a);
    blend = smoothstep(0.35, 1.4, cs);
  }
  float r2 = dot(dc, dc);
  vec2 off = dc * r2 * uChroma;
  vec3 col;
  col.r = sampleColor(uv - off, blend).r;
  col.g = sampleColor(uv, blend).g;
  col.b = sampleColor(uv + off, blend).b;
  float glass = texture(tComp, uv).a > 0.0 ? 1.0 : 0.0;
  vec3 bloom = texture(tBloom, uv).rgb;
  col += bloom * (uBloom + glass * uGlassGlare);
  col += vec3(0.75, 0.8, 1.0) * uFlash;
  col *= uExposure;
  col = aces(col);
  float l = luma(col);
  col = mix(vec3(l), col, uSaturation);
  // Split-tone: cold shadows, slightly warm highlights.
  col = col * uGain + uLift * (1.0 - col) * (1.0 - l);
  float vig = smoothstep(1.0, 0.2, length(dc * vec2(1.25, 1.0)) * 1.25);
  col *= mix(1.0, vig, uVignette);
  col = toSRGB(col);
  float g = hash12(uv * uRes + fract(uTime * 7.31) * 913.0) - 0.5;
  col += g * uGrain * (1.0 - l * 0.7);
  col *= 1.0 - uFade;
  float bars = step(uLetterbox, uv.y) * step(uv.y, 1.0 - uLetterbox);
  col *= bars;
  col += (hash12(uv * uRes + 17.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
