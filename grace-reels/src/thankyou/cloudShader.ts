// Golden-sunrise sea of clouds, seen from above, with god rays — and the organic
// cloud-shaped reveal mask, all in one fragment shader. Output is premultiplied alpha.

export const VERT = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `
precision highp float;

uniform vec2  uRes;      // canvas px
uniform float uScale;    // canvas px per frame px
uniform float uTime;     // seconds
uniform float uFwd;      // camera travel over the cloud sea
uniform float uHorizon;  // horizon height in p-space (0 = frame centre)
uniform vec2  uMaskC;    // mask centre, canvas px (GL origin = bottom-left)
uniform float uMaskR;    // mask radius, frame px
uniform float uRim;      // gold rim light on the mask edge
uniform float uDefocus;  // 0 sharp → 1 dreamy soft
uniform float uDim;      // 0 → 1 sink towards warm black

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Fractional octave count fades the finest octave in/out (no popping, no shimmer).
float fbm(vec2 p, float oct) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    float w = clamp(oct - float(i), 0.0, 1.0);
    v += a * noise(p) * w;
    p = m * p + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return v;
}

// Smooth cellular "domes": rounded cumulus puffs with soft creases between them.
float domes(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(i + g), hash(i + g + 17.31)) * 0.85 + 0.075;
      vec2 r = g + o - f;
      acc += exp(-4.5 * dot(r, r));
    }
  }
  return 1.0 - sqrt(max(-log(acc) / 4.5, 0.0));
}
float cloudH(vec2 uv, float oct) {
  float big = domes(uv * 0.8);
  float small = domes(uv * 1.9 + vec2(3.7, 1.1));
  float fine = fbm(uv * 3.2, oct - 1.5);
  return big * 0.55 + small * 0.3 + fine * 0.38;
}

const vec3 SKY_TOP   = vec3(0.16, 0.10, 0.06);
const vec3 SKY_HIGH  = vec3(0.55, 0.32, 0.11);
const vec3 SKY_MID   = vec3(0.95, 0.66, 0.30);
const vec3 HAZE      = vec3(0.98, 0.80, 0.54);
const vec3 SUN       = vec3(1.00, 0.95, 0.82);
const vec3 CLOUD_LIT = vec3(0.98, 0.84, 0.62);
const vec3 CLOUD_MID = vec3(0.58, 0.37, 0.19);
const vec3 CLOUD_SH  = vec3(0.22, 0.13, 0.07);
const vec3 AMBER     = vec3(1.00, 0.82, 0.48);
const vec3 WARM_BLACK = vec3(0.055, 0.043, 0.035);

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (fc - 0.5 * uRes) / uRes.y;
  float t = uTime;
  vec2 sunP = vec2(0.0, uHorizon + 0.012);
  float detail = mix(5.6, 2.2, uDefocus);
  vec3 col;

  if (p.y < uHorizon) {
    // ---- cloud sea: ray onto a plane below the camera
    float dy = uHorizon - p.y;
    float z = 0.6 / dy;
    vec2 w = vec2(p.x * z, z);
    vec2 uv = w * vec2(1.7, 1.45) + vec2(t * 0.05, t * 0.3 + uFwd);
    float oct = clamp(detail - log2(1.0 + z) * 1.05, 1.0, 6.0);
    vec2 warp = vec2(noise(uv * 0.6 + t * 0.05), noise(uv * 0.6 + vec2(7.1, 2.9))) - 0.5;
    vec2 wuv = uv + warp * 0.55;
    float e = 0.035;
    float h  = cloudH(wuv, oct);
    float hx = cloudH(wuv + vec2(e, 0.0), oct);
    float hz = cloudH(wuv + vec2(0.0, e), oct);
    vec3 nrm = normalize(vec3(-(hx - h) / e, 2.2, -(hz - h) / e));
    vec3 L = normalize(vec3(0.0, 0.42, 1.0));                // low sun, straight ahead
    float diff = clamp((dot(nrm, L) + 0.35) / 1.35, 0.0, 1.0);
    float skyL = clamp(nrm.y, 0.0, 1.0);
    float ao = smoothstep(0.25, 0.85, h);
    vec3 c = mix(CLOUD_SH, CLOUD_MID, ao);
    c += CLOUD_LIT * (diff * 0.3 + skyL * 0.1) * ao;
    // backlit gold lining on the crests
    float lining = pow(diff, 5.0) * smoothstep(0.55, 0.95, h);
    c += AMBER * lining * 0.22;
    c = min(c, vec3(1.0));
    // aerial perspective: distant clouds dissolve into the sunrise haze
    float fog = 1.0 - exp(-z * 0.06);
    float sunGlowLow = exp(-length((p - sunP) * vec2(1.0, 3.0)) * 4.0);
    c = mix(c, mix(HAZE, SUN, sunGlowLow * 0.6), fog);
    c += AMBER * sunGlowLow * 0.22;
    col = c;
  } else {
    // ---- sky
    float s = (p.y - uHorizon) / max(0.5 - uHorizon, 0.05);
    vec3 c = mix(HAZE, SKY_MID, smoothstep(0.0, 0.25, s));
    c = mix(c, SKY_HIGH, smoothstep(0.2, 0.7, s));
    c = mix(c, SKY_TOP, smoothstep(0.6, 1.2, s));
    // high, thin streaks of cloud lit from below
    float wisp = fbm(vec2(p.x * 2.2 + t * 0.03, (p.y - uHorizon) * 9.0 - t * 0.01), detail - 1.0);
    wisp = smoothstep(0.42, 0.78, wisp) * smoothstep(1.0, 0.15, s) * smoothstep(0.0, 0.1, s);
    c = mix(c, mix(CLOUD_LIT, SKY_MID, s), wisp * 0.5);
    col = c;
  }

  // ---- sun + soft god rays fanning up from behind the horizon
  vec2 v = p - sunP;
  float d = length(v);
  float ang = atan(v.x, v.y);
  float rays = noise(vec2(ang * 8.0, t * 0.2)) * 0.6 + noise(vec2(ang * 21.0, -t * 0.15 + 4.0)) * 0.4;
  rays = smoothstep(0.5, 1.0, rays);
  float rayFall = exp(-d * 3.2) * smoothstep(0.0, 0.08, d);
  float above = smoothstep(-0.06, 0.05, p.y - uHorizon);
  col += AMBER * rays * rayFall * mix(0.06, 0.26, above);
  col += SUN * (exp(-d * 60.0) * 0.8 + exp(-d * 12.0) * 0.18);

  // ---- grade
  col = clamp(col, 0.0, 1.0);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.25);           // gentle S-curve
  col = mix(col, WARM_BLACK + col * 0.32, uDim);                  // sink into the dark
  col += (hash(fc + fract(t) * 91.7) - 0.5) / 255.0;             // dither against banding

  // ---- organic, noise-driven cloud mask
  vec2 mq = (fc - uMaskC) / uScale;
  float r = length(mq);
  float th = atan(mq.y, mq.x);
  vec2 ring = vec2(cos(th), sin(th));
  float n = fbm(ring * 1.7 + vec2(t * 0.9, -t * 0.4), 3.0);
  float scallop = pow(abs(sin(th * 7.0 + t * 1.1 + n * 2.0)), 0.6);
  float R = uMaskR * (1.0 + 0.2 * (n - 0.45) + 0.055 * (scallop - 0.6));
  float feather = 2.0 + uMaskR * 0.014;
  float a = 1.0 - smoothstep(R - feather, R + feather, r);
  float rim = uRim * exp(-max(r - R, 0.0) / (10.0 + uMaskR * 0.06)) * (1.0 - a);
  vec3 rimCol = AMBER * 0.9;

  gl_FragColor = vec4(col * a + rimCol * rim, a + rim * (1.0 - a));
}
`;
