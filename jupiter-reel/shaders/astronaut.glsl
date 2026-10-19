// Stylised 3D cartoon astronaut, ray-marched as a signed distance field.
// The joint positions come from astro.py (forward kinematics per frame), so
// the same model and proportions are used in every shot.
//
// The including shader must define, before this file:
//   vec3 envReflect(vec3 dir);           // what the visor reflects
//   vec3 extraLight(vec3 pw, vec3 n);    // scene lights (lightning, glow...)

uniform float uAstroOn;
uniform vec3  uAstroPos;      // world position of the torso centre
uniform mat3  uAstroRot;      // world -> body rotation
uniform float uAstroScale;    // world units per body unit
uniform vec3  uJ[12];         // shoulder/elbow/wrist L, R, hip/knee/ankle L, R (body space)
uniform vec3  uHandC[2];
uniform mat3  uHandR[2];      // body -> glove local
uniform vec3  uFootC[2];
uniform mat3  uFootR[2];      // body -> boot local
uniform vec3  uHeadC;
uniform mat3  uHeadR;         // body -> helmet local
uniform float uNoHelmet;      // 1 in first-person shots: camera sits inside the helmet
uniform float uWarn;          // red warning light 0..1
uniform float uLampOn;        // helmet lamps 0..1
uniform float uElec;          // suit electronics power 1 = normal, 0 = dead

uniform vec3  uKeyDir;
uniform vec3  uKeyCol;
uniform vec3  uAmbDir;
uniform vec3  uAmbA;          // ambient arriving from uAmbDir
uniform vec3  uAmbB;          // ambient from the opposite side
uniform vec3  uRimDir;
uniform vec3  uRimCol;
uniform float uOutline;
uniform vec3  uOutlineCol;
uniform float uOutlinePx;     // outline width in internal pixels
uniform float uSilhouette;    // 1 = dark backlit silhouette
uniform vec3  uSilCol;
uniform float uAstroFog;      // 0..1 fade into the surrounding haze
uniform vec3  uAstroFogCol;
#ifndef HAS_PIXANG
uniform float uPixAng;        // radians per internal pixel
#define HAS_PIXANG
#endif

#define M_SUIT 0
#define M_ORANGE 1
#define M_GREY 2
#define M_HELMET 3
#define M_VISOR 4
#define M_DARK 5
#define M_PANEL 6
#define M_LAMP 7

float ellipseD(vec2 p, vec2 ab) {
    return (length(p / ab) - 1.0) * min(ab.x, ab.y);
}

float helmetDist(vec3 p) {
    vec3 h = uHeadR * (p - uHeadC);
    float d = length(h) - 0.27;
    // the visor bulges slightly out of the shell inside an elliptical window
    float win = ellipseD(h.xy - vec2(0.0, 0.02), vec2(0.205, 0.165));
    float bulge = max(length(h - vec3(0.0, 0.014, 0.014)) - 0.27, max(win, -h.z));
    d = min(d, bulge);
    // side lamps
    vec3 q = vec3(abs(h.x) - 0.236, h.y - 0.075, h.z - 0.085);
    d = smin(d, sdRoundBox(q, vec3(0.02, 0.022, 0.03), 0.014), 0.02);
    return d;
}

float bodyDist(vec3 p) {
    float d = sdRoundBox(p - vec3(0.0, 0.03, 0.0), vec3(0.12, 0.15, 0.06), 0.12);
    d = smin(d, sdRoundBox(p - vec3(0.0, -0.22, 0.0), vec3(0.1, 0.04, 0.05), 0.095), 0.08);
    d = min(d, sdRoundBox(p - vec3(0.0, 0.06, -0.225), vec3(0.15, 0.19, 0.045), 0.06));
    d = smin(d, sdTorusY(p - vec3(0.0, 0.275, 0.0), vec2(0.14, 0.045)), 0.03);
    d = smin(d, sdRoundBox(p - vec3(0.0, 0.07, 0.172), vec3(0.085, 0.055, 0.02), 0.015), 0.015);
    d = smin(d, sdCapsule(p, uJ[0], uJ[1], 0.074), 0.07);
    d = smin(d, sdCapsule(p, uJ[1], uJ[2], 0.066), 0.035);
    d = smin(d, sdCapsule(p, uJ[3], uJ[4], 0.074), 0.07);
    d = smin(d, sdCapsule(p, uJ[4], uJ[5], 0.066), 0.035);
    d = smin(d, sdRoundBox(uHandR[0] * (p - uHandC[0]), vec3(0.028, 0.042, 0.018), 0.04), 0.03);
    d = smin(d, sdRoundBox(uHandR[1] * (p - uHandC[1]), vec3(0.028, 0.042, 0.018), 0.04), 0.03);
    d = smin(d, sdCapsule(p, uJ[6], uJ[7], 0.088), 0.07);
    d = smin(d, sdCapsule(p, uJ[7], uJ[8], 0.08), 0.035);
    d = smin(d, sdCapsule(p, uJ[9], uJ[10], 0.088), 0.07);
    d = smin(d, sdCapsule(p, uJ[10], uJ[11], 0.08), 0.035);
    d = smin(d, sdRoundBox(uFootR[0] * (p - uFootC[0]), vec3(0.032, 0.026, 0.058), 0.044), 0.06);
    d = smin(d, sdRoundBox(uFootR[1] * (p - uFootC[1]), vec3(0.032, 0.026, 0.058), 0.044), 0.06);
    d = min(d, sdCapsule(p, vec3(0.1, 0.24, -0.25), vec3(0.135, 0.46, -0.27), 0.008));
    return d;
}

float astroDist(vec3 p) {
    float d = bodyDist(p);
    if (uNoHelmet < 0.5) d = min(d, helmetDist(p));
    return d;
}

vec3 astroNormal(vec3 p) {
    const vec2 e = vec2(1.0, -1.0) * 0.0012;
    return normalize(e.xyy * astroDist(p + e.xyy) + e.yyx * astroDist(p + e.yyx) +
                     e.yxy * astroDist(p + e.yxy) + e.xxx * astroDist(p + e.xxx));
}

float astroAO(vec3 p, vec3 n) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.012 + 0.055 * float(i);
        occ += (h - astroDist(p + n * h)) * sca;
        sca *= 0.75;
    }
    return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

float astroShadow(vec3 ro, vec3 rd) {
    float res = 1.0, t = 0.015;
    for (int i = 0; i < 28; i++) {
        float h = astroDist(ro + rd * t);
        res = min(res, 9.0 * h / t);
        t += clamp(h, 0.008, 0.1);
        if (res < 0.005 || t > 1.8) break;
    }
    return smoothstep(0.0, 1.0, clamp(res, 0.0, 1.0));
}

#define TAKE(D, M) { float _d = (D); if (_d < best) { best = _d; id = (M); } }

// Material id plus albedo / specular / emission at a body-space surface point.
int astroMaterial(vec3 p, out vec3 alb, out float spec, out float gloss, out vec3 emis) {
    float best = 1e9;
    int id = M_SUIT;
    float hA0, hA1, hF0, hF1, hT0, hT1, hS0, hS1;
    TAKE(sdRoundBox(p - vec3(0.0, 0.03, 0.0), vec3(0.12, 0.15, 0.06), 0.12), 10);
    TAKE(sdRoundBox(p - vec3(0.0, -0.22, 0.0), vec3(0.1, 0.04, 0.05), 0.095), 11);
    TAKE(sdRoundBox(p - vec3(0.0, 0.06, -0.225), vec3(0.15, 0.19, 0.045), 0.06), 12);
    TAKE(sdTorusY(p - vec3(0.0, 0.275, 0.0), vec2(0.14, 0.045)), 13);
    TAKE(sdRoundBox(p - vec3(0.0, 0.07, 0.172), vec3(0.085, 0.055, 0.02), 0.015), 14);
    TAKE(sdCapsuleH(p, uJ[0], uJ[1], 0.074, hA0), 20);
    TAKE(sdCapsuleH(p, uJ[1], uJ[2], 0.066, hF0), 21);
    TAKE(sdCapsuleH(p, uJ[3], uJ[4], 0.074, hA1), 22);
    TAKE(sdCapsuleH(p, uJ[4], uJ[5], 0.066, hF1), 23);
    TAKE(sdRoundBox(uHandR[0] * (p - uHandC[0]), vec3(0.028, 0.042, 0.018), 0.04), 24);
    TAKE(sdRoundBox(uHandR[1] * (p - uHandC[1]), vec3(0.028, 0.042, 0.018), 0.04), 24);
    TAKE(sdCapsuleH(p, uJ[6], uJ[7], 0.088, hT0), 30);
    TAKE(sdCapsuleH(p, uJ[7], uJ[8], 0.08, hS0), 31);
    TAKE(sdCapsuleH(p, uJ[9], uJ[10], 0.088, hT1), 32);
    TAKE(sdCapsuleH(p, uJ[10], uJ[11], 0.08, hS1), 33);
    TAKE(sdRoundBox(uFootR[0] * (p - uFootC[0]), vec3(0.032, 0.026, 0.058), 0.044), 34);
    TAKE(sdRoundBox(uFootR[1] * (p - uFootC[1]), vec3(0.032, 0.026, 0.058), 0.044), 35);
    TAKE(sdCapsule(p, vec3(0.1, 0.24, -0.25), vec3(0.135, 0.46, -0.27), 0.008), 15);
    if (uNoHelmet < 0.5) TAKE(helmetDist(p), 40);

    vec3 WHITE = vec3(0.86, 0.87, 0.9);
    vec3 ORANGE = vec3(1.0, 0.33, 0.04);
    vec3 GREY = vec3(0.36, 0.38, 0.42);
    vec3 DARK = vec3(0.05, 0.055, 0.065);
    alb = WHITE; spec = 0.18; gloss = 18.0; emis = vec3(0.0);
    int m = M_SUIT;
    float elec = uElec;

    if (id == 10 || id == 11) {
        if (id == 11 && p.y > -0.2 && p.y < -0.145) { alb = GREY; m = M_GREY; }
        if (p.z > 0.1 && length(p.xy - vec2(0.135, 0.17)) < 0.032) { alb = ORANGE; m = M_ORANGE; }
    } else if (id == 12) {
        if (abs(p.x) > 0.165) { alb = ORANGE; m = M_ORANGE; }
        if (p.y < -0.1 && abs(p.x) < 0.09 && p.z < -0.27) { alb = DARK; m = M_DARK; }
    } else if (id == 13) {
        alb = ORANGE; m = M_ORANGE;
    } else if (id == 14) {
        alb = vec3(0.13, 0.14, 0.16); m = M_PANEL; spec = 0.4; gloss = 40.0;
        if (p.z > 0.188) {
            vec2 q = p.xy - vec2(0.0, 0.088);
            float lr = length(q - vec2(-0.045, 0.0));
            float la = length(q - vec2(0.0, 0.0));
            float lg = length(q - vec2(0.045, 0.0));
            if (lr < 0.015) emis += vec3(4.0, 0.15, 0.05) * (0.06 + 2.2 * uWarn);
            if (la < 0.013) emis += vec3(1.6, 0.8, 0.1) * 0.35 * elec;
            if (lg < 0.013) emis += vec3(0.2, 1.4, 0.45) * 0.45 * elec;
            vec2 sq = abs(p.xy - vec2(0.0, 0.045)) - vec2(0.055, 0.014);
            if (max(sq.x, sq.y) < 0.0) emis += mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.1, 0.05), uWarn) * 0.35 * elec;
        }
    } else if (id == 15) {
        alb = GREY; m = M_GREY;
        if (p.y > 0.445) emis = vec3(3.0, 0.2, 0.1) * (0.3 + 1.5 * uWarn);
    } else if (id == 20 || id == 22) {
        float h = (id == 20) ? hA0 : hA1;
        if (h > 0.2 && h < 0.34) { alb = ORANGE; m = M_ORANGE; }
    } else if (id == 21 || id == 23) {
        float h = (id == 21) ? hF0 : hF1;
        if (h > 0.8) { alb = ORANGE; m = M_ORANGE; }
    } else if (id == 24) {
        alb = vec3(0.72, 0.73, 0.76); m = M_GREY;
    } else if (id == 31 || id == 33) {
        float h = (id == 31) ? hS0 : hS1;
        if (h < 0.17) { alb = ORANGE; m = M_ORANGE; }
    } else if (id == 34 || id == 35) {
        vec3 q = ((id == 34) ? uFootR[0] * (p - uFootC[0]) : uFootR[1] * (p - uFootC[1]));
        alb = WHITE; m = M_SUIT;
        if (q.y < -0.03) { alb = vec3(0.16, 0.17, 0.19); m = M_DARK; }
        else if (q.y > 0.035) { alb = ORANGE; m = M_ORANGE; }
    } else if (id == 40) {
        vec3 h = uHeadR * (p - uHeadC);
        float win = ellipseD(h.xy - vec2(0.0, 0.02), vec2(0.205, 0.165));
        vec3 q = vec3(abs(h.x) - 0.236, h.y - 0.075, h.z - 0.085);
        alb = vec3(0.92, 0.92, 0.94); m = M_HELMET; spec = 0.75; gloss = 70.0;
        if (sdRoundBox(q, vec3(0.02, 0.022, 0.03), 0.014) < 0.004) {
            alb = GREY; m = M_LAMP; spec = 0.3;
            if (h.z > 0.118 && length(q.xy) < 0.02) {
                alb = vec3(0.9); emis = vec3(1.0, 0.95, 0.85) * (0.15 + 5.0 * uLampOn * elec);
            }
        } else if (h.z > 0.0 && win < 0.0) {
            m = M_VISOR;
        } else if (h.z > 0.0 && win < 0.022) {
            alb = ORANGE; m = M_ORANGE; spec = 0.5; gloss = 50.0;
        }
    }
    if (m == M_ORANGE) { spec = max(spec, 0.25); }
    return m;
}

// Trace the astronaut along a world-space ray. Returns colour and coverage;
// tHit receives the world distance to the surface (-1 on a miss).
vec4 traceAstro(vec3 ro, vec3 rd, out float tHit) {
    tHit = -1.0;
    if (uAstroOn < 0.5) return vec4(0.0);
    vec3 rob = uAstroRot * (ro - uAstroPos) / uAstroScale;
    vec3 rdb = uAstroRot * rd;
    vec2 bs = raySphere(rob, rdb, vec3(0.0, -0.05, 0.0), 1.2);
    if (bs.y < 0.0) return vec4(0.0);
    float t = max(bs.x, 0.0);
    float minRatio = 1e9;
    bool hit = false;
    for (int i = 0; i < 120; i++) {
        vec3 p = rob + rdb * t;
        float d = astroDist(p);
        float pix = max(t, 0.02) * uPixAng;
        minRatio = min(minRatio, d / pix);
        if (d < pix * 0.3) { hit = true; break; }
        t += d * 0.92;
        if (t > bs.y) break;
    }
    if (!hit) {
        float a = uOutline * (1.0 - smoothstep(uOutlinePx * 0.5, uOutlinePx, minRatio));
        return vec4(uOutlineCol, a);
    }
    vec3 p = rob + rdb * t;
    tHit = t * uAstroScale;
    vec3 pw = ro + rd * tHit;
    vec3 nb = astroNormal(p);
    vec3 n = normalize(transpose(uAstroRot) * nb);
    vec3 V = -rd;

    vec3 alb, emis;
    float spec, gloss;
    int m = astroMaterial(p, alb, spec, gloss, emis);

    float ao = astroAO(p, nb);
    float ndl = dot(n, uKeyDir);
    float sh = (ndl > 0.0) ? astroShadow(p + nb * 0.004, uAstroRot * uKeyDir) : 0.0;
    // stylised diffuse: a soft toon step blended with Lambert
    float dif = (smoothstep(0.0, 0.16, ndl) * 0.72 + 0.28 * sat(ndl)) * sh;
    vec3 amb = mix(uAmbB, uAmbA, 0.5 + 0.5 * dot(n, uAmbDir)) * (0.35 + 0.65 * ao);
    vec3 col = alb * (uKeyCol * dif + amb);
    vec3 H = normalize(uKeyDir + V);
    col += uKeyCol * spec * pow(sat(dot(n, H)), gloss) * sh;
    float fr = pow(1.0 - sat(dot(n, V)), 3.0);
    col += uRimCol * fr * (0.25 + 0.75 * sat(dot(n, uRimDir) * 0.6 + 0.4)) * (0.5 + 0.5 * ao);
    col += alb * extraLight(pw, n) * (0.5 + 0.5 * ao);

    if (m == M_VISOR) {
        vec3 R = reflect(rd, n);
        float f = 0.1 + 0.9 * pow(1.0 - sat(dot(n, V)), 4.0);
        col = vec3(0.006, 0.009, 0.02) + envReflect(R) * mix(0.32, 1.0, f) * vec3(0.92, 0.97, 1.08);
        col += uKeyCol * (pow(sat(dot(R, uKeyDir)), 400.0) * 8.0 + pow(sat(dot(R, uKeyDir)), 24.0) * 0.18);
        // painted cartoon highlight arcs on the glass
        vec3 h = uHeadR * (p - uHeadC);
        vec2 v = h.xy - vec2(-0.05, 0.07);
        float arc = abs(length(v) - 0.12);
        float arcMask = smoothstep(0.012, 0.004, arc) * smoothstep(-0.02, 0.06, -v.x + v.y * 0.4) * step(0.0, v.y + 0.02);
        col += vec3(1.0) * arcMask * 0.55 * (0.4 + 0.6 * sat(dot(uKeyCol, vec3(0.33))));
        col += extraLight(pw, R) * 0.25;
        emis += vec3(1.0, 0.1, 0.04) * uWarn * 0.08;   // warning light reflected inside the visor
    }
    col += emis;

    if (uSilhouette > 0.0) {
        vec3 sil = uSilCol + uRimCol * fr * 0.6;
        col = mix(col, sil, uSilhouette);
    }
    col = mix(col, uAstroFogCol, uAstroFog);
    return vec4(col, 1.0);
}
