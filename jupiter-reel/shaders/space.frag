#version 430
// Space shots: Jupiter from outside, the stylised cutaway, and the astronaut.
#include "common.glsl"

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uJitter;
uniform vec3  uCamPos;        // planet frame, Jupiter radius = 1
uniform mat3  uCamRot;        // columns: right, up, forward
uniform float uTanHalfFov;    // vertical
uniform vec3  uAstroCam;      // camera position in the astronaut's metre space
uniform mat3  uPlanetRot;     // world -> planet-fixed
uniform vec3  uSunDir;
uniform vec3  uSunCol;
uniform float uHaze;          // whiteout while dropping into the upper atmosphere
uniform vec3  uHazeCol;
uniform float uCut;           // cutaway wedge half-angle (radians), 0 = closed
uniform vec3  uCutC;          // horizontal world direction the wedge is centred on
uniform vec3  uIoPos;
uniform float uIoR;
uniform float uStars;
uniform float uBump;          // cloud relief for close-ups
uniform float uAurora;
uniform float uNightFlash;
uniform float uGrsSpin;
uniform vec3  uGrsC;          // planet-fixed unit centre of the Great Red Spot
uniform sampler2D uBands;     // latitude -> albedo (rgb) + turbulence (a)
uniform vec4  uVortA[40];     // planet-fixed unit centre + angular radius
uniform vec4  uVortB[40];     // twist, aspect, tint amount, tint kind
uniform int   uNumVort;

out vec4 fragColor;

vec3 envReflect(vec3 dir);
vec3 extraLight(vec3 pw, vec3 n) { return vec3(0.0); }

#include "astronaut.glsl"

vec3 starfield(vec3 rd, float pixAng) {
    vec3 col = vec3(0.0);
    for (int layer = 0; layer < 3; layer++) {
        float scale = (layer == 0) ? 90.0 : ((layer == 1) ? 210.0 : 480.0);
        vec3 p = rd * scale;
        vec3 id = floor(p);
        vec3 h = hash33(id + float(layer) * 31.7);
        if (h.x < 0.86) continue;
        vec3 sp = id + 0.25 + 0.5 * hash33(id + 11.3);
        float d = length(p - sp) / (scale * pixAng);
        float mag = (layer == 0 ? 2.2 : (layer == 1 ? 1.0 : 0.55)) * (0.25 + pow(h.y, 5.0) * 3.0);
        vec3 tint = mix(vec3(0.65, 0.78, 1.0), vec3(1.0, 0.86, 0.68), h.z);
        col += tint * mag * exp(-d * d * 0.55);
    }
    // faint galactic dust so deep space is not flat
    float neb = fbm(rd * 3.0 + vec3(4.1, 1.7, 8.3), 4);
    col += vec3(0.010, 0.012, 0.03) * smoothstep(0.45, 0.85, neb) * 0.8;
    return col * uStars;
}

vec3 tintFor(float kind) {
    if (kind < 0.5) return vec3(0.97, 0.95, 0.9);    // white oval
    if (kind < 1.5) return vec3(0.42, 0.22, 0.12);   // brown barge
    return vec3(0.82, 0.38, 0.2);                    // reddish oval
}

// Planet-fixed unit vector -> cloud albedo. fp = pixel footprint in planet radii.
// relief: brightness change from sunlit cloud relief (close-ups only).
vec3 jupiterAlbedo(vec3 n, float fp, vec3 sunF, out float relief) {
    const float F = 5.0;
    float oct = clamp(log2(1.0 / (fp * F * 2.5)), 1.0, 15.0);

    // Great Red Spot frame (anticyclone, turns counter-clockwise)
    vec3 c = uGrsC;
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), c));
    vec3 north = cross(c, east);
    vec2 g = vec2(dot(n, east), dot(n, north)) / vec2(0.112, 0.084);
    float gx = length(g);
    vec3 m = n;
    if (dot(n, c) > 0.0 && gx < 2.6) {
        float w = sat(1.0 - gx / 2.6); w *= w;
        float inner = smoothstep(1.2, 0.5, gx);
        float ang = 1.9 * w + inner * (2.4 * (1.0 - gx) + uGrsSpin);
        vec2 e = (rot2(ang) * g) * vec2(0.112, 0.084);
        m = normalize(c * dot(n, c) + east * e.x + north * e.y);
    }

    // smaller storms: ovals, barges, polar cyclones, eddies
    float tintAmt = 0.0;
    vec3 tintCol = vec3(0.0);
    for (int i = 0; i < 40; i++) {
        if (i >= uNumVort) break;
        vec4 A = uVortA[i];
        float cd = dot(m, A.xyz);
        vec4 B = uVortB[i];
        if (cd < cos(A.w * max(B.y, 1.0) * 1.08)) continue;
        vec3 ve = normalize(cross(vec3(0.0, 1.0, 0.0), A.xyz));
        vec3 vn = cross(A.xyz, ve);
        vec2 s = vec2(dot(m, ve), dot(m, vn)) / vec2(A.w * B.y, A.w);
        float x2 = dot(s, s);
        if (x2 >= 1.0) continue;
        float w = 1.0 - x2; w *= w;
        vec2 e = (rot2(B.x * w) * s) * vec2(A.w * B.y, A.w);
        m = normalize(A.xyz * cd + ve * e.x + vn * e.y);
        float core = smoothstep(0.8, 0.2, sqrt(x2));
        if (B.z * core > tintAmt) { tintAmt = B.z * core; tintCol = tintFor(B.w); }
    }

    // multi-scale turbulent swirls: each layer 5x finer, faded in once resolvable
    vec3 p = m;
    for (int L = 0; L < 6; L++) {
        float fq = 6.0 * pow(5.0, float(L));
        float vis = sat(log2(1.0 / (fp * fq * 12.0)));
        if (vis <= 0.0) break;
        vec3 sp = vec3(p.x, p.y * 2.6, p.z) * fq;
        vec3 d = vec3(vnoise(sp + vec3(1.3, 7.1, 4.4)), vnoise(sp + vec3(9.2, 2.3, 6.8)),
                      vnoise(sp + vec3(5.5, 3.9, 1.2))) - 0.5;
        d.y *= mix(0.45, 0.8, sat(float(L) / 3.0));
        p += d * (2.0 / fq) * vis;
    }

    // zonal bands with turbulent, domain-warped boundaries
    vec3 pn = normalize(p);
    float lat = asin(clamp(pn.y, -1.0, 1.0));
    float tb = texture(uBands, vec2(0.5 + lat / PI, 0.5)).a;
    vec3 q = vec3(p.x, p.y * 3.2, p.z) * F;
    float wo = min(oct, 5.0);
    vec2 wv = vec2(fbmL(q * 0.9 + vec3(1.7, 9.2, 3.1), wo), fbmL(q * 0.9 + vec3(8.3, 2.8, 5.5), wo));
    vec3 q2 = q + vec3(wv.x, wv.y * 0.3, wv.y) * 2.4;
    float f = fbmL(q2 * 1.6, min(oct, 7.0));
    float latW = lat + (f - 0.5) * (0.03 + 0.11 * tb);
    vec3 col = texture(uBands, vec2(0.5 + latW / PI, 0.5)).rgb;
    float streak = fbmL(vec3(p.x, p.y * 16.0, p.z) * F * 1.6 + q2 * 0.35, clamp(oct - 1.5, 1.0, 8.0));
    col *= (0.8 + 0.4 * streak) * (0.88 + 0.24 * f);

    // scale-adaptive cloud detail: features stay ~200 px wide however close we get,
    // crossfading between octave-spaced layers so nothing pops
    float zoom = sat((oct - 6.0) / 4.5);
    float lvl = log2(1.0 / (fp * 200.0));
    float L0 = floor(lvl);
    float lf = lvl - L0;
    vec3 pp = vec3(p.x, p.y * 1.25, p.z);
    float sA = exp2(L0), sB = exp2(L0 + 1.0);
    float det = mix(fbm(pp * sA, 6), fbm(pp * sB, 6), lf);
    float detC = smoothstep(0.28, 0.72, det);
    float pz = mix(fbm(pp * sA * 1.9 + 3.1, 5), fbm(pp * sB * 1.9 + 3.1, 5), lf);
    float puff = smoothstep(0.54, 0.7, pz) * smoothstep(0.3, 0.6, det) * zoom;
    // stylised three-tone cloud palette: rust gaps, orange body, cream tops
    vec3 rust = mix(col * vec3(0.55, 0.36, 0.26), vec3(0.42, 0.16, 0.07), 0.5);
    vec3 orng = mix(col, vec3(0.85, 0.45, 0.2), 0.45);
    vec3 crem = vec3(0.98, 0.93, 0.83);
    vec3 dc = mix(rust, orng, smoothstep(0.34, 0.46, det));
    dc = mix(dc, crem, smoothstep(0.52, 0.64, det));
    col = mix(col, dc, 0.15 + 0.7 * zoom);
    col = mix(col, vec3(1.0, 0.975, 0.93), puff * 0.85);

    // blue-grey festoons along the edge of the equatorial zone
    float fest = smoothstep(0.6, 0.76, fbmL(q2 * 2.3 + 3.3, clamp(oct - 1.0, 1.0, 8.0))) * exp(-pow((latW - 0.12) / 0.028, 2.0));
    col = mix(col, vec3(0.34, 0.4, 0.5), fest * 0.8);
    col = mix(col, tintCol, sat(tintAmt));

    // Great Red Spot colouring: crimson spiral, paler core, bright collar
    if (gx < 1.7) {
        vec2 gr = rot2(2.8 * sat(1.0 - gx) + uGrsSpin) * g;
        float sw = fbmL(vec3(gr * 2.6, 7.7), min(oct + 1.0, 10.0));
        float ringN = 0.5 + 0.5 * sin(gx * 15.0 + sw * 7.0);
        vec3 red = mix(vec3(0.5, 0.08, 0.05), vec3(0.86, 0.3, 0.13), sw * 0.7 + ringN * 0.3);
        red = mix(red, vec3(0.8, 0.45, 0.3), smoothstep(0.4, 0.0, gx) * 0.55);
        red *= 0.85 + 0.3 * detC;
        float inside = smoothstep(1.03, 0.85, gx + (sw - 0.5) * 0.18);
        float collar = smoothstep(0.98, 1.1, gx) * smoothstep(1.6, 1.18, gx);
        col = mix(col, vec3(0.97, 0.91, 0.82), collar * 0.7);
        col = mix(col, red, inside);
    }

    // sunlit relief: compare the cloud height a little toward the Sun
    relief = 0.0;
    if (uBump > 0.0 && zoom > 0.0) {
        vec3 ps = pp + vec3(sunF.x, sunF.y * 1.25, sunF.z) * fp * 6.0;
        float d1 = mix(fbm(ps * sA, 6), fbm(ps * sB, 6), lf);
        float z1 = mix(fbm(ps * sA * 1.9 + 3.1, 5), fbm(ps * sB * 1.9 + 3.1, 5), lf);
        float h0 = det + 0.5 * puff;
        float h1 = d1 + 0.5 * smoothstep(0.54, 0.7, z1) * smoothstep(0.3, 0.6, d1) * zoom;
        relief = clamp((h1 - h0) * 9.0, -1.0, 1.0) * zoom;
    }
    return col;
}

vec3 shadeJupiter(vec3 pw, vec3 nW, vec3 rd, float t) {
    vec3 n = uPlanetRot * nW;
    float mu = sat(dot(nW, -rd));
    float fp = t * uPixAng / max(mu, 0.12);
    vec3 sunF = uPlanetRot * uSunDir;
    sunF = normalize(sunF - n * dot(sunF, n) + 1e-5);
    float relief;
    vec3 alb = jupiterAlbedo(n, fp, sunF, relief);
    vec3 N = nW;
    float ndlG = dot(nW, uSunDir);
    float term = smoothstep(-0.1, 0.24, ndlG);
    float lam = mix(0.3, 1.0, sat(dot(N, uSunDir) * 1.1)) * clamp(1.0 - uBump * relief * 0.9, 0.25, 1.6);
    vec3 c = alb * uSunCol * term * lam * (0.5 + 0.5 * pow(mu, 0.35));

    vec3 toIo = uIoPos - pw;
    float along = dot(toIo, uSunDir);
    if (along > 0.0) {
        float dd = length(toIo - uSunDir * along);
        c *= mix(0.02, 1.0, smoothstep(uIoR * 0.8, uIoR * 1.3, dd));
    }

    // electric-blue limb haze on the day side
    float rim = pow(1.0 - mu, 4.0);
    c += vec3(0.22, 0.52, 1.0) * rim * smoothstep(-0.3, 0.4, ndlG) * 0.85;

    float night = smoothstep(0.08, -0.12, ndlG);
    if (night > 0.0 && uNightFlash > 0.0) {
        float lon = atan(n.z, n.x), lat = asin(clamp(n.y, -1.0, 1.0));
        vec2 cc = vec2(lon, lat) * 26.0;
        vec2 id = floor(cc);
        vec2 hh = hash22(id + 13.1);
        float period = 1.2 + hh.x * 2.8;
        float ph = fract(uTime / period + hh.y);
        float flash = exp(-ph * 45.0) * step(0.6, hash12(id + 7.0));
        float d = length(fract(cc) - (0.25 + 0.5 * hh));
        float storm = texture(uBands, vec2(0.5 + lat / PI, 0.5)).a;
        c += vec3(0.55, 0.78, 1.0) * flash * exp(-d * d * 40.0) * 3.0 * night * uNightFlash * storm;
    }
    if (uAurora > 0.0) {
        float latD = degrees(asin(clamp(n.y, -1.0, 1.0)));
        float lon = atan(n.z, n.x);
        float ring = exp(-pow((latD - 72.0) / 2.5, 2.0)) + 0.5 * exp(-pow((latD + 72.0) / 2.5, 2.0));
        float curtain = fbm2(vec2(lon * 9.0, uTime * 0.4), 3);
        c += vec3(0.2, 0.55, 1.0) * ring * (0.25 + 1.2 * curtain) * uAurora * (0.35 + 0.65 * night);
    }
    return c;
}

// Illustrative interior: smooth gradients only, denser and hotter with depth.
vec3 interiorColor(vec3 p) {
    float r = length(p);
    float sw = fbm(p * 5.0 + vec3(0.0, uTime * 0.06, 0.0), 5);
    float rr = r + (sw - 0.5) * 0.05;
    vec3 c = mix(vec3(4.2, 3.0, 1.6), vec3(2.4, 0.95, 0.22), smoothstep(0.0, 0.32, rr));
    c = mix(c, vec3(0.75, 0.16, 0.05), smoothstep(0.3, 0.72, rr));
    c = mix(c, vec3(0.92, 0.45, 0.16), smoothstep(0.7, 0.95, rr));
    c = mix(c, vec3(0.98, 0.84, 0.62), smoothstep(0.965, 0.992, rr));
    c *= 0.88 + 0.12 * sin(rr * 70.0 + sw * 8.0);
    return c;
}

bool inRemoved(vec3 p, vec3 n1, vec3 n2) {
    return dot(p, n1) > 0.0 && dot(p, n2) > 0.0 && p.y > 0.0;
}

vec3 renderSpace(vec3 ro, vec3 rd) {
    vec3 col = starfield(rd, uPixAng);
    vec2 hj = raySphere(ro, rd, vec3(0.0), 1.0);

    // atmosphere glow just outside the limb
    float tc = -dot(ro, rd);
    if (tc > 0.0) {
        vec3 pc = ro + rd * tc;
        float b = length(pc);
        if (b > 1.0 && b < 1.12) {
            vec3 nn = pc / b;
            float lit = smoothstep(-0.35, 0.35, dot(nn, uSunDir));
            col += vec3(0.25, 0.55, 1.0) * exp(-(b - 1.0) / 0.009) * lit * 0.9;
            col += vec3(0.25, 0.5, 1.0) * exp(-(b - 1.0) / 0.035) * lit * 0.12;
            if (uAurora > 0.0) {
                vec3 nf = uPlanetRot * nn;
                float latD = degrees(asin(clamp(nf.y, -1.0, 1.0)));
                col += vec3(0.25, 0.6, 1.0) * smoothstep(60.0, 76.0, latD) * exp(-(b - 1.0) / 0.02) * uAurora * 0.6;
            }
        }
    }
    if (hj.x <= 0.0) return col;

    vec3 cc = normalize(vec3(uCutC.x, 0.0, uCutC.z));
    vec3 cs = cross(vec3(0.0, 1.0, 0.0), cc);
    vec3 n1 = cc * sin(uCut) - cs * cos(uCut);
    vec3 n2 = cc * sin(uCut) + cs * cos(uCut);

    vec3 p0 = ro + rd * hj.x;
    if (uCut > 0.001 && inRemoved(p0, n1, n2)) {
        float tExit = hj.y;
        int face = -1;
        vec3 ns[3] = vec3[3](n1, n2, vec3(0.0, 1.0, 0.0));
        for (int i = 0; i < 3; i++) {
            float dn = dot(rd, ns[i]);
            if (dn < 0.0) {
                float ti = -dot(ro, ns[i]) / dn;
                if (ti > hj.x && ti < tExit) { tExit = ti; face = i; }
            }
        }
        if (face < 0) return col;
        vec3 p = ro + rd * tExit;
        vec3 fn = ns[face];
        vec3 ic = interiorColor(p);
        float lit = 0.55 + 0.45 * sat(dot(fn, uSunDir));
        vec3 c = ic * lit;
        // crisp outlines along the cut edges
        float r = length(p);
        float e = 0.0;
        e = max(e, smoothstep(0.988, 0.998, r));
        for (int i = 0; i < 3; i++) {
            if (i == face) continue;
            e = max(e, smoothstep(0.012, 0.002, abs(dot(p, ns[i]))));
        }
        c = mix(c, vec3(1.0, 0.93, 0.8) * 1.4, e * 0.6);
        return c;
    }
    vec3 nW = p0;
    vec3 c = shadeJupiter(p0, nW, rd, hj.x);
    return c;
}

vec3 envReflect(vec3 dir) {
    vec2 h = raySphere(uCamPos, dir, vec3(0.0), 1.0);
    if (h.x > 0.0) {
        vec3 nn = normalize(uCamPos + dir * h.x);
        vec3 n = uPlanetRot * nn;
        float lat = asin(clamp(n.y, -1.0, 1.0));
        vec3 alb = texture(uBands, vec2(0.5 + lat / PI, 0.5)).rgb;
        float lit = smoothstep(-0.1, 0.3, dot(nn, uSunDir));
        return alb * uSunCol * lit * 0.8 + vec3(0.2, 0.45, 1.0) * pow(1.0 - sat(dot(nn, -dir)), 4.0) * 0.4;
    }
    // smooth space backdrop: a few soft stars, faint blue glow toward the limb
    float glow = pow(sat(dot(dir, normalize(-uCamPos)) * 0.5 + 0.5), 6.0);
    return vec3(0.004, 0.006, 0.014) + vec3(0.1, 0.25, 0.6) * glow * 0.25;
}

void main() {
    vec2 frag = gl_FragCoord.xy + uJitter;
    vec2 ndc = frag / uRes * 2.0 - 1.0;
    float aspect = uRes.x / uRes.y;
    vec3 rd = normalize(uCamRot * vec3(ndc.x * aspect * uTanHalfFov, ndc.y * uTanHalfFov, 1.0));
    vec3 col = renderSpace(uCamPos, rd);
    col = mix(col, uHazeCol, uHaze);
    float tA;
    vec4 a = traceAstro(uAstroCam, rd, tA);
    col = mix(col, a.rgb, a.a);
    fragColor = vec4(col, a.a);
}
