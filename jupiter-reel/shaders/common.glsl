// Shared helpers: hashing, value noise, fbm, SDF primitives, ray-sphere.

#define PI 3.14159265359
#define TAU 6.28318530718

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

// Interleaved gradient noise: cheap per-pixel dither / jitter.
float ign(vec2 px) { return fract(52.9829189 * fract(0.06711056 * px.x + 0.00583715 * px.y)); }

// Fast 3D value noise in [0,1].
float hn(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hn(i + vec3(0, 0, 0)), hn(i + vec3(1, 0, 0)), f.x),
                   mix(hn(i + vec3(0, 1, 0)), hn(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hn(i + vec3(0, 0, 1)), hn(i + vec3(1, 0, 1)), f.x),
                   mix(hn(i + vec3(0, 1, 1)), hn(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

// 2D value noise in [0,1].
float vnoise2(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

const mat3 M3 = mat3(0.00, 0.80, 0.60,
                    -0.80, 0.36, -0.48,
                    -0.60, -0.48, 0.64);

// fbm with a fractional octave count (smooth level of detail), normalised to ~[0,1].
float fbmL(vec3 p, float oct) {
    float a = 0.5, s = 0.0, n = 0.0;
    int full = int(oct);
    for (int i = 0; i < 16; i++) {
        if (i > full) break;
        float w = (i < full) ? 1.0 : fract(oct);
        s += a * w * vnoise(p);
        n += a * w;
        p = M3 * p * 2.03;
        a *= 0.5;
    }
    return s / max(n, 1e-4);
}

float fbm(vec3 p, int oct) {
    float a = 0.5, s = 0.0, n = 0.0;
    for (int i = 0; i < oct; i++) {
        s += a * vnoise(p);
        n += a;
        p = M3 * p * 2.03;
        a *= 0.5;
    }
    return s / n;
}

float fbm2(vec2 p, int oct) {
    float a = 0.5, s = 0.0, n = 0.0;
    const mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < oct; i++) {
        s += a * vnoise2(p);
        n += a;
        p = R * p * 2.02;
        a *= 0.5;
    }
    return s / n;
}

// ---- SDF primitives ----
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}
float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}
// capsule distance plus the 0..1 parameter along its axis
float sdCapsuleH(vec3 p, vec3 a, vec3 b, float r, out float h) {
    vec3 pa = p - a, ba = b - a;
    h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}
float sdTorusY(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}
float sdCylZ(vec3 p, float r, float h) {
    vec2 d = abs(vec2(length(p.xy), p.z)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

vec2 raySphere(vec3 ro, vec3 rd, vec3 c, float r) {
    vec3 oc = ro - c;
    float b = dot(oc, rd);
    float cc = dot(oc, oc) - r * r;
    float h = b * b - cc;
    if (h < 0.0) return vec2(-1.0, -1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

vec3 rotAxis(vec3 p, vec3 axis, float ang) {
    float c = cos(ang), s = sin(ang);
    return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
