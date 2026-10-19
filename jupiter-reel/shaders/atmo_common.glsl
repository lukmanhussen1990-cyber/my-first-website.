// Jupiter's atmosphere as a ray-marched volume (scenes 2-5).
// World units are metres, +y is up. The cloud decks sit at fixed altitudes and
// the camera falls through them, so the descent is continuous.

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uJitter;
uniform vec3  uCamPos;
uniform mat3  uCamRot;
uniform float uTanHalfFov;
uniform float uPixAng;
#define HAS_PIXANG
uniform float uMaxDist;

uniform vec3  uSunDir;        // toward the (filtered) sunlight, mostly straight up
uniform vec3  uSunCol;        // already dimmed by the decks above the camera
uniform vec3  uAmbTop;
uniform vec3  uAmbBot;
uniform vec3  uFogCol;        // in-scattered colour of the clear gas at the camera
uniform float uFogDen;        // gas extinction per metre at the camera altitude
uniform float uCloudDen;      // cloud extinction per metre at density 1
uniform vec3  uAlbA;          // ammonia-ice deck
uniform vec3  uAlbB;          // ammonium-hydrosulfide deck
uniform vec3  uAlbC;          // water-cloud towers
uniform vec3  uAlbD;          // deep murk
uniform vec3  uHeatCol;
uniform float uHeat;          // glow from the hot depths
uniform float uFluid;         // 0..1: morph toward a dense, fluid-like medium
uniform vec3  uWind;
uniform vec3  uSkyTop;
uniform vec3  uSkyHor;
uniform vec3  uAbyss;
uniform vec4  uLt[4];         // lightning: xyz position, w intensity
uniform vec3  uLtCol;
uniform float uLtRange;
uniform vec3  uLampPos;
uniform vec3  uLampDir;
uniform float uLamp;
uniform float uFlashAmb;
uniform vec4  uPathB;        // xz start/end of the astronaut's drift while crossing each deck:
uniform vec4  uPathC;        // a natural gap stays open around that stretch
uniform vec4  uPathD;

float sstep(float a, float b, float x) {
    float t = clamp((x - a) / (b - a), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

float pathDist(vec2 xz, vec4 seg) {
    vec2 a = seg.xy, b = seg.zw;
    vec2 pa = xz - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

// One cloud deck: billowy domes on top, flatter base. h = height fraction in the deck.
float deck(float n, float y, float top, float bot, float cov, out float h) {
    h = (y - bot) / (top - bot);
    if (h <= 0.0 || h >= 1.0) return 0.0;
    float thr = mix(1.0 - cov, 1.0 - cov * 0.32, h * h);
    return sat((n - thr) * 7.0) * sstep(0.0, 0.1, h);
}

// Cloud density (0..1) at p. e = weights of decks A, B, C, D; hgt = height in the deck.
float cloudField(vec3 p, float oct, out vec4 e, out float hgt) {
    e = vec4(0.0);
    hgt = 0.5;
    float y = p.y;
    bool inA = y < 30.0 && y > -235.0;
    bool inB = y < -560.0 && y > -1260.0;
    bool inC = y < -1080.0 && y > -2800.0;
    bool inD = y < -2050.0;
    if (!(inA || inB || inC || inD)) return 0.0;
    vec3 q = (p - uWind * uTime) * 0.0042;
    q.y *= 1.5;
    float tt = uTime * (0.04 + 0.1 * uFluid);
    vec3 wv = vec3(vnoise(q * 0.55 + vec3(0.0, tt, 0.0)),
                   vnoise(q * 0.55 + vec3(5.2, 1.3, tt)),
                   vnoise(q * 0.55 + vec3(tt, 7.7, 3.3))) - 0.5;
    q += wv * (1.1 + 2.4 * uFluid);
    float n = fbmL(q, oct);
    float d = 0.0, h;
    if (inA) {
        float c = deck(n, y, 10.0, -215.0, 0.5, h);
        if (c > d) { d = c; hgt = h; e = vec4(1.0, 0.0, 0.0, 0.0); }
    }
    if (inB) {
        float c = deck(n, y, -590.0, -1220.0, 0.56, h);
        c *= sstep(70.0, 150.0, pathDist(p.xz, uPathB) + (n - 0.5) * 160.0);   // a ragged gap we fall into
        // horizontal strata: the deck reads as stacked, oppressive layers
        c *= 0.55 + 0.45 * sstep(-0.35, 0.6, sin(y * 0.045 + n * 5.0));
        if (c > d) { d = c; hgt = h; e = vec4(0.0, 1.0, 0.0, 0.0); }
    }
    if (inC) {
        // convective towers rising out of the water-cloud deck
        float cm = fbm2(p.xz * 0.0009 + vec2(3.7, 1.9), 3);
        cm -= 0.45 * (1.0 - sstep(140.0, 320.0, pathDist(p.xz, uPathC) + (cm - 0.5) * 200.0));   // canyon between the towers
        float top = mix(-2400.0, -1120.0, sstep(0.46, 0.8, cm));
        float c = deck(n + 0.25 * sstep(0.42, 0.62, cm) - 0.1, y, top, -2750.0, 0.62, h);
        c *= sstep(0.4, 0.52, cm);
        if (c > d) { d = c; hgt = h; e = vec4(0.0, 0.0, 1.0, 0.0); }
    }
    if (inD) {
        // dense, fluid-like murk: smaller swirling masses with gaps toward the glow below
        float n2 = fbm(q * 3.2 + vec3(0.0, -uTime * 0.12, uTime * 0.05), 3);
        float c = sstep(-2050.0, -2450.0, y) * sat((n * 0.55 + n2 * 0.45 - 0.535) * 9.0);
        c *= mix(0.3, 1.0, sstep(50.0, 170.0, pathDist(p.xz, uPathD) + (n - 0.5) * 120.0));
        if (c > d) { d = c; hgt = 0.5; e = vec4(0.0, 0.0, 0.0, 1.0); }
    }
    return d;
}

vec3 cloudAlbedo(vec4 e) {
    return uAlbA * e.x + uAlbB * e.y + uAlbC * e.z + uAlbD * e.w;
}

float fogAt(float y) {
    // denser below, thinner above, capped so the deep glow stays visible
    return uFogDen * exp(clamp((uCamPos.y - y) / 2500.0, -1.2, 0.7));
}

vec3 pointLights(vec3 p) {
    vec3 L = vec3(0.0);
    for (int i = 0; i < 4; i++) {
        if (uLt[i].w <= 0.0) continue;
        vec3 dv = uLt[i].xyz - p;
        float r2 = dot(dv, dv) / (uLtRange * uLtRange);
        L += uLtCol * uLt[i].w / (1.0 + r2 * 9.0) * exp(-sqrt(r2) * 1.1);
    }
    if (uLamp > 0.0) {
        vec3 lv = p - uLampPos;
        float ld = length(lv);
        float cone = sstep(0.82, 0.97, dot(lv / max(ld, 1e-3), uLampDir));
        L += vec3(1.0, 0.93, 0.8) * uLamp * cone * 8.0 / (1.0 + ld * ld * 0.03);
    }
    return L;
}

// Emission of the hot deep layers: rises with depth below the camera, so looking
// down shows a glowing abyss while the gas around the astronaut stays dark.
vec3 heatGlow(vec3 p, float d, vec3 q) {
    if (uHeat <= 0.0) return vec3(0.0);
    float below = sstep(uCamPos.y - 30.0, uCamPos.y - 650.0, p.y);
    float deep = sstep(-1500.0, -2300.0, p.y);
    // the clear hot gas glows faintly; dense masses block it and read as silhouettes
    vec3 em = uHeatCol * uHeat * deep * (0.02 + 0.16 * below) * (1.0 - 0.9 * d);
    if (uFluid > 0.0) {
        // slow, swirling hot currents in the dense fluid-like depths
        vec3 qq = q * 0.6 + vec3(0.0, uTime * 0.06, 0.0);
        qq += (vec3(vnoise(qq * 0.7 + 3.1), vnoise(qq * 0.7 + 8.4), vnoise(qq * 0.7 + 1.7)) - 0.5) * 2.2;
        float v = fbm(qq, 4);
        float vein = exp(-pow((v - 0.5) / 0.035, 2.0)) + 0.35 * exp(-pow((v - 0.5) / 0.11, 2.0));
        em += uHeatCol * vec3(1.6, 1.15, 0.8) * vein * uFluid * deep * (0.35 + 0.65 * below) * 1.6;
    }
    return em;
}

vec3 background(vec3 rd) {
    vec3 c = mix(uAbyss, uSkyHor, sstep(-0.75, 0.05, rd.y));
    c = mix(c, uSkyTop, sstep(0.05, 0.85, rd.y));
    return c;
}

// March the volume from t0 to t1. Returns in-scattered colour and transmittance.
vec4 marchVolume(vec3 ro, vec3 rd, float t0, float t1, int steps, float jitter, float lodBias) {
    vec3 col = vec3(0.0);
    float T = 1.0;
    float ratio = pow(max(t1 / t0, 1.0001), 1.0 / float(steps));
    float t = t0 * pow(ratio, jitter);
    float tPrev = t0;
    for (int i = 0; i < 96; i++) {
        if (i >= steps) break;
        float tn = min(t * ratio, t1);
        float dt = tn - tPrev;
        vec3 p = ro + rd * t;
        float footprint = t * uPixAng;
        float oct = clamp(log2(24.0 / max(footprint, 1e-4)) + lodBias, 2.0, 6.0);
        vec4 e;
        float hgt;
        float d = cloudField(p, oct, e, hgt);
        float fog = fogAt(p.y);
        float sigC = d * uCloudDen;
        float sig = sigC + fog;
        if (sig > 1e-6) {
            vec3 Lpt = pointLights(p);
            vec3 Lc = vec3(0.0);
            if (sigC > 0.0) {
                vec4 e2;
                float h2;
                float d1 = cloudField(p + uSunDir * 22.0, 3.0, e2, h2);
                float d2 = cloudField(p + uSunDir * 85.0, 2.0, e2, h2);
                float sunT = exp(-(d1 * 22.0 + d2 * 63.0) * uCloudDen * 0.9);
                float powder = 1.0 - exp(-d * 6.0);
                vec3 alb = cloudAlbedo(e);
                vec3 amb = mix(uAmbBot, uAmbTop, sat(hgt * 1.15) * (0.6 + 0.4 * sunT));
                // deep masses: lit from the glowing depths, dark where open to the gas above
                amb = mix(amb, mix(uAmbBot, uAmbTop, sunT), e.w);
                Lc = alb * (uSunCol * sunT * (0.55 + 0.75 * powder) + amb * (1.0 + uFlashAmb) + Lpt);
            }
            vec3 hg = heatGlow(p, d, (p - uWind * uTime) * 0.0042);
            float hh = sstep(-900.0, 900.0, p.y - uCamPos.y);
            vec3 Lf = uFogCol * mix(0.55, 1.35, hh) * (1.0 + uFlashAmb) + Lpt * 0.6;
            vec3 S = (sigC * Lc + fog * Lf) / sig;
            float Ts = exp(-sig * dt);
            // scattering weighted by opacity; hot gas emits along the whole path
            col += T * ((1.0 - Ts) * S + hg * min(dt, 60.0) * 0.012);
            T *= Ts;
            if (T < 0.004) break;
        }
        tPrev = tn;
        t = tn;
        if (t >= t1) break;
    }
    return vec4(col, T);
}

vec3 envReflectAtmo(vec3 dir) {
    vec3 c = background(dir) * 1.2;
    for (int i = 0; i < 4; i++) {
        if (uLt[i].w <= 0.0) continue;
        vec3 ld = normalize(uLt[i].xyz - uCamPos);
        c += uLtCol * uLt[i].w * 0.04 * pow(sat(dot(dir, ld) * 0.5 + 0.5), 6.0);
    }
    c += uHeatCol * uHeat * 0.5 * sstep(0.0, -0.8, dir.y);
    return c;
}
