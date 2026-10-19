#version 430
// Pass 2 of the atmosphere shots, at internal (supersampled) resolution:
// astronaut + the gas in front of it, wind-blown particles, over the pass-1 volume.
#include "common.glsl"
#include "atmo_common.glsl"

uniform sampler2D uVol;
uniform vec3  uCamVel;
uniform float uPartAmt;
uniform vec3  uPartCol;
uniform float uPartSize;

out vec4 fragColor;

vec3 envReflect(vec3 dir) { return envReflectAtmo(dir); }

vec3 extraLight(vec3 pw, vec3 n) {
    vec3 L = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        if (uLt[i].w <= 0.0) continue;
        vec3 dv = uLt[i].xyz - pw;
        float r = length(dv);
        L += uLtCol * uLt[i].w * sat(dot(n, dv / r) * 0.8 + 0.2) / (1.0 + r * r / (uLtRange * uLtRange) * 3.0) * 0.35;
    }
    L += uHeatCol * uHeat * sat(-n.y * 0.7 + 0.3) * 0.5;
    return L;
}

#include "astronaut.glsl"

float raySegDist(vec3 ro, vec3 rd, vec3 a, vec3 b, out float tr) {
    vec3 ba = b - a, oa = ro - a;
    float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa);
    float den = baba - bard * bard;
    float s = den > 1e-9 ? clamp((baoa - bard * rdoa) / den, 0.0, 1.0) : 0.0;
    tr = bard * s - rdoa;
    return length(oa + rd * tr - ba * s);
}

// Ice crystals / droplets carried by the wind, streaking past the falling camera.
vec3 particles(vec3 ro, vec3 rd, float tMax) {
    if (uPartAmt <= 0.0) return vec3(0.0);
    const float CELL = 1.7;
    vec3 off = uWind * uTime;
    vec3 pg = (ro - off) / CELL;
    vec3 cell = floor(pg);
    vec3 ri = 1.0 / (rd + vec3(1e-6));
    vec3 rs = sign(rd);
    vec3 dis = (cell - pg + 0.5 + rs * 0.5) * ri;
    vec3 rel = (uWind - uCamVel) * 0.022;
    float rl = length(rel);
    float acc = 0.0;
    for (int i = 0; i < 20; i++) {
        vec3 h = hash33(cell + 0.37);
        if (h.x < 0.4) {
            vec3 P = (cell + 0.15 + 0.7 * hash33(cell + 5.1)) * CELL + off;
            float tr;
            float dist = raySegDist(ro, rd, P - rel, P, tr);
            if (tr > 0.3 && tr < tMax) {
                float r = uPartSize * (0.5 + h.y);
                float w = max(r, tr * uPixAng * 0.8);
                float a = exp(-dist * dist / (w * w)) * (r / w) * (r / w);
                a *= w / max(rl, w);
                acc += a * (0.4 + h.z) * sstep(0.3, 1.2, tr);
            }
        }
        vec3 mm = step(dis.xyz, dis.yzx) * step(dis.xyz, dis.zxy);
        dis += mm * rs * ri;
        cell += mm * rs;
    }
    return acc * uPartCol * uPartAmt;
}

void main() {
    vec2 frag = gl_FragCoord.xy + uJitter;
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 ndc = frag / uRes * 2.0 - 1.0;
    float aspect = uRes.x / uRes.y;
    vec3 rd = normalize(uCamRot * vec3(ndc.x * aspect * uTanHalfFov, ndc.y * uTanHalfFov, 1.0));
    vec3 bg = texture(uVol, uv).rgb;
    float tA;
    vec4 a = traceAstro(uCamPos, rd, tA);
    vec3 col = bg;
    float tMaxP = 40.0;
    float mask = 0.0;
    if (tA > 0.0) {
        float j = ign(gl_FragCoord.xy * 0.5 + uTime * 41.0);
        vec4 nv = marchVolume(uCamPos, rd, 0.25, tA, 10, j, 1.0);
        col = nv.rgb + nv.a * a.rgb;
        tMaxP = tA;
        mask = 1.0;
    } else if (a.a > 0.0) {
        col = mix(bg, a.rgb, a.a);
        mask = a.a;
    }
    col += particles(uCamPos, rd, tMaxP);
    fragColor = vec4(col, mask);
}
