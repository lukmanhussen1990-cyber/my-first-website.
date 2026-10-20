// The static world at golden hour: the sunset sky (and the storm that rolls over
// it in scene 3), thousands of swaying grass blades, the yard (fence, trees,
// hedges, flower beds, stepping stones), the doghouse and the two-story beige
// house with blue shutters, whose back door opens for Dad in scene 7.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// procedural detail helpers shared by the env materials (appended to GLSL_COMMON)
const GLSL_ENV = /* glsl */ `
// fade a pattern of spatial frequency f (cycles per metre) before it aliases
float aaF(float f){ float fw = max(length(fwidth(vWPos)), 1e-5); return 1.0 - smoothstep(0.22, 0.55, fw * f); }
// boards: u along the grain, v across; returns colour, h = bump height
vec3 boards(float u, float v, float bw, vec3 base, float seed, out float h){
  float bi = floor(v / bw), fv = fract(v / bw);
  float id = h21(vec2(bi, seed));
  float sd = min(fv, 1.0 - fv) * bw;
  float seam = (1.0 - smoothstep(0.0, 0.006, sd)) * aaF(1.0 / max(bw, 0.02));
  float g1 = fbm(vec2(u * 1.6 + id * 9.0, v * 14.0 + id * 3.0));
  float g2 = vnoise(vec2(u * 3.0 + id * 5.0, v * 38.0)) * aaF(38.0);
  vec3 c = base * (0.84 + 0.26 * id) * (0.86 + 0.22 * g1) * (0.94 + 0.1 * g2);
  c *= 1.0 - 0.5 * seam;
  h = -0.003 * seam + 0.0012 * g1 + 0.0004 * g2;
  return c;
}
// roof shingles: rows along u, stacked up the slope in v
vec3 shingles(float u, float v, vec3 base, out float h){
  float rv = v / 0.2; float r = floor(rv), fr = fract(rv);
  float cu = u / 0.3 + 0.5 * mod(r, 2.0); float cid = floor(cu), fc = fract(cu);
  float id = h21(vec2(cid, r));
  float edge = (1.0 - smoothstep(0.0, 0.14, fr)) * aaF(5.0);
  float gap = (1.0 - smoothstep(0.0, 0.035, min(fc, 1.0 - fc))) * aaF(3.3);
  vec3 c = base * (0.8 + 0.32 * id) * (0.88 + 0.2 * fbm(vec2(u, v) * 5.0));
  c *= 1.0 - 0.4 * edge - 0.3 * gap;
  h = 0.012 * fr * aaF(5.0) - 0.004 * gap;
  return c;
}
`;

const SRC = (s) => new THREE.Color(s); // sRGB hex -> linear
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const V2 = (x, y) => new THREE.Vector2(x, y);

export function build(ctx) {
  const { scene, T, WD, MAT, G, U, add, mesh, envMap, envMats } = ctx;
  const { HOUSE, DOGHOUSE: D, BACKDOOR } = WD;
  const rnd = U.mulberry32(97);
  const std = (hex, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color: SRC(hex), roughness: rough, metalness: 0, ...extra });
  const P = (mat, opts) => MAT.patch(mat, { ...opts, extraFrag: GLSL_ENV + (opts.extraFrag || '') });
  const shiny = (m) => (envMats.push(m), m);
  const updaters = [];
  // stepping stones from the porch towards the yard, along Dad's path
  const STONES = [[2.95, -4.05, 0.2], [2.62, -3.3, 0.19], [2.22, -2.6, 0.2], [1.86, -1.95, 0.18]];

  // -------------------------------------------------------------------------
  // sky: a golden-hour sunset gradient, warmest towards the left where the sun
  // is going down, soft clouds lit pink and gold from the left; the storm covers
  // it with heavy grey rain clouds and clears again
  // -------------------------------------------------------------------------
  const skyU = { uTime: { value: 0 }, uStorm: { value: 0 } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: /* glsl */ `varying vec3 vD; uniform float uTime, uStorm;
        float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
          return mix(mix(h21(i),h21(i+vec2(1.,0.)),u.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),u.x), u.y); }
        float fb(vec2 p){ float s=0., a=0.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.3); a*=0.5;} return s/0.96875; }
        void main(){
          vec3 d = normalize(vD);
          float h = d.y;
          // gradient: gold at the horizon, peach and rose, violet, deep blue overhead
          vec3 hor = vec3(1.9, 0.95, 0.38), low = vec3(1.25, 0.55, 0.42), mid = vec3(0.5, 0.33, 0.55), zen = vec3(0.1, 0.13, 0.4);
          vec3 c = mix(hor, low, smoothstep(0.0, 0.07, h));
          c = mix(c, mid, smoothstep(0.05, 0.24, h));
          c = mix(c, zen, smoothstep(0.2, 0.62, h));
          // warmer and brighter towards the sun (low on the left)
          float left = smoothstep(0.35, -0.6, d.x);
          c *= mix(0.82, 1.3, left);
          c += vec3(1.6, 0.72, 0.22) * pow(max(0.0, -d.x * 0.8 + 0.25 - h * 1.5), 3.0) * 1.4;
          if (h < 0.0) c = mix(hor * 0.5, vec3(0.2, 0.15, 0.1), smoothstep(0.0, -0.05, h));
          // clouds on a flat layer
          vec2 q = d.xz / max(h + 0.06, 0.02);
          vec2 wq = q * 0.55 + vec2(uTime * 0.012, 0.0);
          float n = fb(wq) * 0.8 + 0.2 * fb(wq * 2.7 + 5.0);
          float band = smoothstep(0.02, 0.09, h) * (1.0 - smoothstep(0.3, 0.55, h));
          float cl = smoothstep(0.52, 0.72, n) * band;
          // lit from the left: the side towards the sun glows, the rest is lavender
          float lit = clamp(0.5 + (fb(wq + vec2(-0.08, 0.0)) - n) * 6.0 + left * 0.35, 0.0, 1.0);
          vec3 cc = mix(vec3(0.55, 0.36, 0.5), vec3(2.0, 0.95, 0.55), lit) * mix(0.9, 1.25, left);
          c = mix(c, cc, cl * 0.85);
          // storm: low heavy grey clouds over everything
          float s = uStorm;
          if (s > 0.0) {
            vec2 sq = q * 0.35 + vec2(uTime * 0.05, uTime * 0.01);
            float sn = fb(sq) * 0.75 + 0.25 * fb(sq * 3.1 + 2.0);
            vec3 sc = mix(vec3(0.12, 0.13, 0.16), vec3(0.34, 0.36, 0.42), smoothstep(0.35, 0.75, sn));
            sc = mix(sc, vec3(0.42, 0.44, 0.48), smoothstep(0.12, 0.0, h) * 0.6);
            float cover = smoothstep(0.0, 1.0, s * 1.6 - (1.0 - sn) * 0.6);
            c = mix(c, sc, clamp(cover, 0.0, 1.0));
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  updaters.push((t) => {
    skyU.uTime.value = t;
    skyU.uStorm.value = WD.storm(t);
  });

  // -------------------------------------------------------------------------
  // grass: thousands of tapered blades, instanced, swaying in a slow breeze
  // -------------------------------------------------------------------------
  const grassU = { uTime: { value: 0 }, uRain: { value: 0 } };
  {
    const hs = [0, 0.38, 0.72, 1.0], ws = [1.0, 0.78, 0.45, 0.0];
    const pos = [], nrm = [], idx = [];
    for (let i = 0; i < hs.length; i++) {
      const y = hs[i], w = ws[i] * 0.5, bend = 0.5 * y * y;
      if (i < hs.length - 1) {
        pos.push(-w, y, bend, w, y, bend);
        nrm.push(-0.25, 0.75, 0.6, 0.25, 0.75, 0.6);
      } else {
        pos.push(0, y, bend);
        nrm.push(0, 0.8, 0.6);
      }
    }
    for (let i = 0; i < hs.length - 2; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const tip = (hs.length - 1) * 2;
    idx.push(tip - 2, tip - 1, tip);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime, uRain;\nvarying float vH;')
        .replace(
          '#include <project_vertex>',
          `vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
            vec3 base = instanceMatrix[3].xyz;
          #else
            vec3 base = vec3(0.0);
          #endif
          vH = transformed.y;
          float k = transformed.y * transformed.y;
          float ph = base.x * 0.9 + base.z * 0.35;
          float gust = 0.55 + 0.45 * sin(uTime * 0.42 - base.x * 0.33 + base.z * 0.1);
          float sway = sin(uTime * 1.55 + ph * 1.9) * 0.65 + sin(uTime * 2.6 + ph * 3.3) * 0.25;
          mvPosition.x += k * (0.016 + 0.022 * gust + 0.02 * uRain) * sway + k * 0.025 * uRain;
          mvPosition.y -= k * 0.02 * uRain;
          mvPosition.z -= k * 0.005 * (1.0 + sin(uTime * 1.2 + ph * 1.6));
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.42, 1.18, smoothstep(0.0, 0.9, vH));');
    };
    mat.customProgramCacheKey = () => 'grass';
    const spots = [];
    const free = (x, z) => {
      if (x > -0.42 && x < 0.42 && z > -0.72) return false; // the patch over the hole
      if (x > HOUSE.x0 - 0.05 && x < HOUSE.x1 + 0.05 && z < HOUSE.z + 0.05) return false;
      if (x > BACKDOOR.x - 0.95 && x < BACKDOOR.x + 0.95 && z < HOUSE.z + 1.85 && z > HOUSE.z - 0.1) return false; // porch and steps
      if (x > D.x - D.w / 2 - 0.05 && x < D.x + D.w / 2 + 0.05 && z > D.z - D.d / 2 - 0.05 && z < D.z + D.d / 2 + 0.03) return false;
      if (STONES.some(([sx, sz, r]) => (x - sx) ** 2 + (z - sz) ** 2 < (r + 0.02) ** 2)) return false;
      if (z > -14.2 && z < -13.85) return false; // fence line
      return true;
    };
    const fill = (x0, x1, z0, z1, perM2) => {
      const n = Math.round((x1 - x0) * (z1 - z0) * perM2);
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
        if (free(x, z)) spots.push([x, z]);
      }
    };
    fill(-5.5, 8.5, -1.0, -0.02, 560);
    fill(-6.5, 9.5, -3.2, -1.0, 280);
    fill(-11, 12, -9.0, -3.2, 70);
    fill(-14, 14, -14.0, -9.0, 26);
    const im = new THREE.InstancedMesh(g, mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const greens = ['#4a7a2a', '#5a8a30', '#6a9a36', '#3f6c2c', '#74a23c', '#5f8f2e', '#8aa83c'].map(SRC);
    const c = new THREE.Color();
    spots.forEach(([x, z], i) => {
      const far = Math.min(1, -z / 9);
      const hgt = (0.075 + 0.07 * rnd()) * (1 + 0.35 * far);
      const wid = (0.02 + 0.008 * rnd()) * (1 + 1.1 * far);
      e.set((rnd() - 0.5) * 0.25, (rnd() - 0.5) * 1.4, (rnd() - 0.5) * 0.3);
      q.setFromEuler(e);
      m4.compose(v.set(x, 0, z), q, s.set(wid, hgt, wid));
      im.setMatrixAt(i, m4);
      c.copy(greens[Math.floor(rnd() * greens.length)]).multiplyScalar(0.62 + 0.32 * rnd());
      im.setColorAt(i, c);
    });
    im.castShadow = false;
    im.receiveShadow = true;
    im.frustumCulled = false;
    scene.add(im);
    // the grass on the patch itself, until the first spadeful of scene 1 takes it
    const pg = [];
    const n = Math.round(0.84 * 0.74 * 560);
    for (let i = 0; i < n; i++) pg.push([-0.42 + rnd() * 0.84, -0.72 + rnd() * 0.7]);
    const pim = new THREE.InstancedMesh(g, mat, pg.length);
    pg.forEach(([x, z], i) => {
      const hgt = 0.075 + 0.07 * rnd(), wid = 0.02 + 0.008 * rnd();
      e.set((rnd() - 0.5) * 0.25, (rnd() - 0.5) * 1.4, (rnd() - 0.5) * 0.3);
      q.setFromEuler(e);
      m4.compose(v.set(x, 0, z), q, s.set(wid, hgt, wid));
      pim.setMatrixAt(i, m4);
      c.copy(greens[Math.floor(rnd() * greens.length)]).multiplyScalar(0.62 + 0.32 * rnd());
      pim.setColorAt(i, c);
    });
    pim.castShadow = false;
    pim.receiveShadow = true;
    pim.frustumCulled = false;
    scene.add(pim);
    updaters.push((t) => {
      grassU.uTime.value = t;
      grassU.uRain.value = WD.rainK(t);
      pim.visible = t < T.dig1[0] - 0.12;
    });
  }

  // -------------------------------------------------------------------------
  // yard dressing: stepping stones, fence, hedges, trees, flower beds, the
  // neighbours' trees, a hazy ridge on the horizon
  // -------------------------------------------------------------------------
  {
    const stoneMat = P(std('#9a948a', 0.85), {
      key: 'yardStone', colorFn: 'stCol', bumpFn: 'stBump',
      extraFrag: `vec3 stCol(vec3 p, vec3 n){ return vec3(0.82 + 0.3 * fbm(p.xz * 6.0)) * (0.9 + 0.15 * vnoise(p.xz * 30.0) * aaF(30.0)); }
        float stBump(vec3 p, vec3 n){ return 0.006 * fbm(p.xz * 9.0); }`,
    });
    const geos = STONES.map(([x, z, r], i) => G.placed(new THREE.CylinderGeometry(r, r * 1.05, 0.04, 20), x, 0.012, z, 0, i, 0, 1, 1, 0.8));
    add(mesh(G.mergeAll(geos), stoneMat), false, true);
  }
  const woodMat = (hex, key, along, bw = 0.12) =>
    P(std(hex, 0.78), {
      key, colorFn: key + 'C', bumpFn: key + 'B',
      extraFrag: `vec2 ${key}UV(vec3 p, vec3 n){ return ${along}; }
        vec3 ${key}C(vec3 p, vec3 n){ float h; vec2 uv = ${key}UV(p, n); return boards(uv.x, uv.y, ${bw.toFixed(3)}, vec3(1.0), 3.0, h); }
        float ${key}B(vec3 p, vec3 n){ float h; vec2 uv = ${key}UV(p, n); boards(uv.x, uv.y, ${bw.toFixed(3)}, vec3(1.0), 3.0, h); return h; }`,
    });
  {
    // a pale wooden fence across the back of the yard
    const fz = -14.0;
    const bg = [];
    for (let x = -16; x < 16; x += 0.16) {
      const h = 1.25 + 0.03 * Math.sin(x * 7.1);
      bg.push(G.placed(new THREE.BoxGeometry(0.13, h, 0.03), x, h / 2, fz, 0, 0, (rnd() - 0.5) * 0.012));
    }
    for (const y of [0.3, 0.95]) bg.push(G.box(32, 0.08, 0.05, 0, y, fz - 0.04));
    for (let x = -16; x < 16; x += 2.4) bg.push(G.box(0.1, 1.32, 0.1, x, 0.66, fz - 0.07));
    add(mesh(G.mergeAll(bg), woodMat('#d9c7a8', 'fence', 'vec2(p.y, p.x)', 0.16)), true, true);
  }
  const leafMat = (hex, key) =>
    P(std(hex, 0.85), {
      key, colorFn: key + 'C', bumpFn: key + 'B',
      extraFrag: `vec3 ${key}C(vec3 p, vec3 n){ vec4 ce = cellv(p.xy * 9.0 + p.z * 3.0);
          float leaf = smoothstep(0.55, 0.15, ce.z) * aaF(9.0);
          return vec3(0.6 + 0.5 * ce.w * aaF(9.0)) * (0.6 + 0.55 * leaf) * (0.85 + 0.3 * fbm(p.xz * 2.0 + p.y)); }
        float ${key}B(vec3 p, vec3 n){ vec4 ce = cellv(p.xy * 9.0 + p.z * 3.0); return 0.02 * smoothstep(0.6, 0.1, ce.z) * aaF(9.0); }`,
    });
  const bushGeo = (x, y, z, r, n = 5) => {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd();
      const rr = r * (0.55 + 0.3 * rnd());
      parts.push(G.placed(G.lumpyBlob(rr, 2, 0.22, Math.floor(rnd() * 1000)), x + Math.cos(a) * r * 0.45, y + rr * 0.85 + rnd() * r * 0.3, z + Math.sin(a) * r * 0.3));
    }
    parts.push(G.placed(G.lumpyBlob(r * 0.7, 2, 0.2, Math.floor(rnd() * 1000)), x, y + r * 1.0, z));
    return G.mergeAll(parts);
  };
  const barkMat = P(std('#5a4332', 0.9), {
    key: 'bark', colorFn: 'barkC', bumpFn: 'barkB',
    extraFrag: `vec3 barkC(vec3 p, vec3 n){ return vec3(0.75 + 0.4 * fbm(vec2((p.x + p.z) * 6.0, p.y * 9.0))); }
      float barkB(vec3 p, vec3 n){ return 0.008 * fbm(vec2((p.x + p.z) * 8.0, p.y * 14.0)) * aaF(14.0); }`,
  });
  const tree = (x, z, h, r, seed, crown, trunks) => {
    trunks.push(G.rod(V3(x, 0, z), V3(x - 0.05, h * 0.7, z), 0.16 * r, 0.1 * r, 12));
    trunks.push(G.rod(V3(x - 0.05, h * 0.55, z), V3(x - 0.65 * r, h * 0.82, z + 0.1), 0.07 * r, 0.045 * r, 8));
    trunks.push(G.rod(V3(x - 0.05, h * 0.6, z), V3(x + 0.6 * r, h * 0.85, z - 0.1), 0.065 * r, 0.04 * r, 8));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rr = (0.75 + 0.35 * rnd()) * r;
      crown.push(G.placed(G.lumpyBlob(rr, 2, 0.2, seed + i), x + Math.cos(a) * 0.95 * r, h + Math.sin(a * 1.3) * 0.45 * r + rnd() * 0.4 * r, z + Math.sin(a) * 0.6 * r));
    }
    crown.push(G.placed(G.lumpyBlob(1.15 * r, 2, 0.18, seed + 20), x, h + 0.55 * r, z));
  };
  {
    const hedges = [];
    for (let x = -13; x < 13; x += 1.25) if (Math.abs(x - 5) > 3.6) hedges.push(bushGeo(x + rnd() * 0.4, 0, -13.3 - rnd() * 0.3, 0.55 + 0.25 * rnd(), 4));
    hedges.push(bushGeo(-4.4, 0, -3.6, 0.55), bushGeo(-5.6, 0, -4.4, 0.7), bushGeo(1.25, 0, -6.4, 0.5), bushGeo(8.9, 0, -5.5, 0.7), bushGeo(9.8, 0, -3.8, 0.55), bushGeo(-3.4, 0, -2.6, 0.38));
    add(mesh(G.mergeAll(hedges), leafMat('#3b6a2c', 'bush')), true, true);
    const crown = [], trunks = [];
    tree(-3.6, -5.8, 3.4, 1.15, 40, crown, trunks); // behind the doghouse, on the left
    tree(-8.5, -9.5, 4.0, 1.3, 70, crown, trunks);
    tree(11.2, -9.0, 4.2, 1.3, 100, crown, trunks); // right of the house
    tree(-0.6, -11.5, 3.6, 1.1, 130, crown, trunks);
    add(mesh(G.mergeAll(trunks), barkMat), true, true);
    add(mesh(G.mergeAll(crown), leafMat('#4a7a2e', 'crown')), true, true);
    // the neighbours' trees beyond the fence, and a hazy ridge on the horizon
    const far = [], farTrunks = [];
    for (let i = 0; i < 26; i++) {
      const x = -26 + i * 2.1 + (rnd() - 0.5) * 1.2, z = -16 - rnd() * 7;
      if (rnd() < 0.15) continue;
      const hgt = 2.8 + rnd() * 2.4;
      if (rnd() < 0.3) {
        for (let k = 0; k < 3; k++) far.push(G.placed(new THREE.ConeGeometry(0.85 - k * 0.2, hgt * 0.42, 14), x, 0.55 + k * hgt * 0.24 + hgt * 0.21, z, 0, rnd(), 0));
      } else {
        const r = 0.85 + rnd() * 0.6;
        far.push(G.placed(G.lumpyBlob(r, 2, 0.22, 200 + i), x, hgt - r * 0.6, z, 0, 0, 0, 1, 1.15, 1));
        far.push(G.placed(G.lumpyBlob(r * 0.7, 2, 0.22, 260 + i), x + r * 0.6, hgt - r * 1.05, z + 0.3));
        farTrunks.push(G.rod(V3(x, 0, z), V3(x, hgt - r, z), 0.12, 0.08, 6));
      }
    }
    add(mesh(G.mergeAll(far), leafMat('#3c5e34', 'farTree')), false, true);
    add(mesh(G.mergeAll(farTrunks), std('#3a2e24', 0.9)), false, true);
    const ridge = [];
    for (let i = 0; i < 14; i++) {
      const x = -150 + i * 23 + rnd() * 8, z = -135 - rnd() * 30, r = 15 + rnd() * 8;
      ridge.push(G.placed(G.lumpyBlob(r, 2, 0.12, 400 + i), x, -r * 0.1, z, 0, 0, 0, 1.6, 0.42, 1));
    }
    const ridgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.34, 0.33) });
    const RIDGE = new THREE.Color(0.55, 0.34, 0.33), RIDGE_STORM = new THREE.Color(0.2, 0.21, 0.24);
    add(mesh(G.mergeAll(ridge), ridgeMat), false, false);
    updaters.push((t) => ridgeMat.color.copy(RIDGE).lerp(RIDGE_STORM, WD.storm(t)));
    // the meadow beyond the fence, fading into the warm haze
    const meadow = P(std('#ffffff', 0.95), {
      key: 'meadow', colorFn: 'mdC',
      extraFrag: `vec3 mdC(vec3 p, vec3 n){
          vec3 c = s2l(vec3(0.3, 0.45, 0.18)) * (0.8 + 0.3 * fbm(p.xz * 0.45));
          return mix(c, s2l(vec3(0.62, 0.48, 0.36)), 0.75 * smoothstep(-20.0, -90.0, p.z)); }`,
    });
    add(mesh(G.placed(new THREE.PlaneGeometry(420, 290), 0, -0.003, -160, -Math.PI / 2, 0, 0), meadow), false, true);
    // flower beds: along the fence, under the house's windows, by the doghouse
    const petal = ['#e8524a', '#f2c84b', '#c66bd6', '#f58fb2', '#f39a3c', '#ffffff'].map(SRC);
    const fl = [], leaves = [];
    const bed = (x0, x1, z0, z1, n) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), y = 0.14 + 0.16 * rnd();
        const g = G.placed(new THREE.IcosahedronGeometry(0.035 + 0.02 * rnd(), 1), x, y, z);
        const col = petal[Math.floor(rnd() * petal.length)];
        const cols = new Float32Array(g.attributes.position.count * 3);
        for (let k = 0; k < cols.length; k += 3) cols.set([col.r, col.g, col.b], k);
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        fl.push(g);
        leaves.push(G.placed(G.lumpyBlob(0.07, 1, 0.3, 500 + fl.length), x, y * 0.45, z, 0, 0, 0, 1, 0.9, 1));
      }
    };
    bed(-12, -2.5, -13.55, -13.0, 70);
    bed(4.3, 8.2, -5.95, -5.6, 34);
    bed(-2.9, -2.65, -2.1, -1.2, 8);
    const flG = mergeKeepColor(fl);
    add(mesh(flG, std('#ffffff', 0.7, { vertexColors: true })), false, true);
    add(mesh(G.mergeAll(leaves), leafMat('#3d7030', 'bedLeaf')), false, true);
  }
  // merge geometries keeping their vertex colours (G.mergeAll drops extra attributes)
  function mergeKeepColor(list) {
    let n = 0;
    for (const g of list) n += (g.index ? g.toNonIndexed() : g).attributes.position.count;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const g0 of list) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      pos.set(g.attributes.position.array, o * 3);
      nrm.set(g.attributes.normal.array, o * 3);
      col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return out;
  }

  // -------------------------------------------------------------------------
  // the doghouse: red plank walls with white trim, a shingled gable roof, an
  // arched door facing the camera, a bowl beside it
  // -------------------------------------------------------------------------
  {
    const x0 = D.x - D.w / 2, x1 = D.x + D.w / 2, z0 = D.z - D.d / 2, z1 = D.z + D.d / 2;
    const wt = 0.05, fl = 0.06;
    const dgWood = woodMat('#c0473a', 'dgWall', 'abs(n.x) > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y)', 0.1);
    const walls = [G.boxMM(x0, 0, z0, x0 + wt, D.h, z1), G.boxMM(x1 - wt, 0, z0, x1, D.h, z1), G.boxMM(x0, 0, z0, x1, D.h, z0 + wt)];
    // front wall with an arched door, and the back gable
    const front = new THREE.Shape();
    front.moveTo(x0, 0);
    front.lineTo(x1, 0);
    front.lineTo(x1, D.h);
    front.lineTo(D.x, D.ridge);
    front.lineTo(x0, D.h);
    front.closePath();
    const dw = 0.23, dh = 0.36;
    const door = new THREE.Path();
    door.moveTo(D.x - dw, 0.02);
    door.lineTo(D.x + dw, 0.02);
    door.lineTo(D.x + dw, dh);
    door.absarc(D.x, dh, dw, 0, Math.PI, false);
    door.lineTo(D.x - dw, 0.02);
    front.holes.push(door);
    const fg = new THREE.ExtrudeGeometry(front, { depth: wt, bevelEnabled: false, curveSegments: 16 });
    fg.translate(0, 0, z1 - wt);
    walls.push(fg);
    const back = new THREE.Shape();
    back.moveTo(x0, D.h);
    back.lineTo(x1, D.h);
    back.lineTo(D.x, D.ridge);
    back.closePath();
    const bg = new THREE.ExtrudeGeometry(back, { depth: wt, bevelEnabled: false });
    bg.translate(0, 0, z0);
    walls.push(bg);
    add(mesh(G.mergeAll(walls), dgWood), true, true);
    // white trim: corner posts and the door arch; a floor and a blanket inside
    const trimMat = P(std('#f1ece2', 0.6), { key: 'dgTrim', colorFn: 'dtC', extraFrag: 'vec3 dtC(vec3 p, vec3 n){ return vec3(0.92 + 0.1 * fbm(p.xy * 8.0)); }' });
    const trim = [G.boxMM(x0 - 0.02, 0, z1 - 0.02, x0 + 0.05, D.h, z1 + 0.015), G.boxMM(x1 - 0.05, 0, z1 - 0.02, x1 + 0.02, D.h, z1 + 0.015)];
    const arch = new THREE.Shape();
    arch.moveTo(dw + 0.045, 0);
    arch.absarc(0, 0, dw + 0.045, 0, Math.PI, false);
    arch.lineTo(-dw - 0.045, -dh + 0.02);
    arch.lineTo(-dw, -dh + 0.02);
    arch.lineTo(-dw, 0);
    arch.absarc(0, 0, dw, Math.PI, 0, true);
    arch.lineTo(dw, -dh + 0.02);
    arch.lineTo(dw + 0.045, -dh + 0.02);
    arch.closePath();
    const ag = new THREE.ExtrudeGeometry(arch, { depth: 0.02, bevelEnabled: false, curveSegments: 16 });
    ag.translate(D.x, dh, z1);
    trim.push(ag);
    add(mesh(G.mergeAll(trim), trimMat), true, true);
    add(mesh(G.boxMM(x0 + wt, 0, z0 + wt, x1 - wt, fl, z1 - wt), woodMat('#8a5a36', 'dgFloor', 'vec2(p.z, p.x)', 0.1)), false, true);
    add(mesh(G.boxMM(x0 + wt, fl, z0 + wt, x1 - wt, fl + 0.03, z1 - wt - 0.05), std('#3a4a7a', 0.95)), false, true);
    // roof: two shingled slopes, ridge along z, a little overhang
    const ov = 0.1, halfW = D.w / 2, half = halfW + ov, rise = D.ridge - D.h;
    const slope = Math.atan2(rise, halfW);
    const len = half / Math.cos(slope);
    const roofMat = P(std('#3f4a5a', 0.82), {
      key: 'dgRoof', colorFn: 'dgrC', bumpFn: 'dgrB',
      extraFrag: `float dgV(vec3 p){ return (${D.ridge.toFixed(3)} - p.y) * 1.8; }
        vec3 dgrC(vec3 p, vec3 n){ float h; return shingles(p.z * 1.4, dgV(p) * 1.3, vec3(1.0), h); }
        float dgrB(vec3 p, vec3 n){ float h; shingles(p.z * 1.4, dgV(p) * 1.3, vec3(1.0), h); return h * 0.6; }`,
    });
    const depth = D.d + 0.2;
    const rg = [];
    for (const sgn of [-1, 1]) {
      const b = new THREE.BoxGeometry(len, 0.045, depth);
      b.translate((sgn * len) / 2, 0.022, 0);
      b.rotateZ(-sgn * slope);
      b.translate(D.x, D.ridge + 0.02, D.z);
      rg.push(b);
    }
    add(mesh(G.mergeAll(rg), roofMat), true, true);
    const bowl = new THREE.LatheGeometry([V2(0, 0), V2(0.1, 0), V2(0.12, 0.05), V2(0.105, 0.055), V2(0.085, 0.015), V2(0, 0.015)], 24);
    bowl.translate(x1 + 0.25, 0, z1 - 0.15);
    add(mesh(bowl, shiny(std('#3a7ac0', 0.35, { envMap, envMapIntensity: 0.5 }))), true, true);
  }

  // -------------------------------------------------------------------------
  // the house: two stories, beige lap siding, white trim, blue shutters, a
  // gable facing the yard with a round attic window, chimney, gutters, a porch
  // with steps, a porch light and the back door that opens for Dad
  // -------------------------------------------------------------------------
  const H = HOUSE, ZF = H.z, ZB = H.z - H.depth;
  const xc = (H.x0 + H.x1) / 2;
  const wallMat = P(std('#ffffff', 0.86), {
    key: 'houseWall', colorFn: 'hwC', bumpFn: 'hwB',
    extraFrag: `vec3 hwC(vec3 p, vec3 n){ float v = (p.y - 0.02) / 0.17; float f = fract(v);
        vec3 c = s2l(vec3(0.93, 0.84, 0.68)) * (0.92 + 0.1 * h21(vec2(floor(v), 3.0)));
        c *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.16, f)) * aaF(6.0);
        c *= 0.93 + 0.1 * fbm(vec2(p.x + p.z, p.y) * 3.0);
        return c; }
      float hwB(vec3 p, vec3 n){ float f = fract((p.y - 0.02) / 0.17); return 0.006 * smoothstep(0.0, 0.16, f) * aaF(6.0) + 0.0005 * fbm(p.xz * 20.0); }`,
  });
  const trimMat = P(std('#ffffff', 0.55), { key: 'houseTrim', colorFn: 'htC', extraFrag: 'vec3 htC(vec3 p, vec3 n){ return s2l(vec3(0.97, 0.96, 0.93)) * (0.95 + 0.06 * fbm(p.xy * 6.0 + p.z)); }' });
  const shutterMat = P(std('#ffffff', 0.6), {
    key: 'shutter', colorFn: 'shC', bumpFn: 'shB',
    extraFrag: `vec3 shC(vec3 p, vec3 n){ float f = fract(p.y / 0.07); return s2l(vec3(0.24, 0.47, 0.74)) * (0.8 + 0.3 * smoothstep(0.0, 0.5, f) * aaF(14.0) + 0.15 * (1.0 - aaF(14.0))) * (0.95 + 0.08 * fbm(p.xy * 9.0)); }
      float shB(vec3 p, vec3 n){ return 0.004 * fract(p.y / 0.07) * aaF(14.0); }`,
  });
  // glass: reflects the sunset, a warm room light glowing inside
  const glassMat = shiny(P(std('#1b2433', 0.12, { envMap, envMapIntensity: 0.9 }), {
    key: 'houseGlass', emissiveFn: 'hgE',
    extraFrag: `vec3 hgE(vec3 p, vec3 n, vec3 c){ return vec3(1.0, 0.62, 0.3) * 0.22 * (0.7 + 0.3 * fbm(p.xy * 2.0)); }`,
  }));
  const roofMat = P(std('#ffffff', 0.85), {
    key: 'houseRoof', colorFn: 'hrC', bumpFn: 'hrB',
    extraFrag: `float hrV(vec3 p){ return (${H.ridge.toFixed(3)} - p.y) * 1.3; }
      vec3 hrC(vec3 p, vec3 n){ float h; return shingles(p.z, hrV(p), s2l(vec3(0.45, 0.32, 0.3)), h); }
      float hrB(vec3 p, vec3 n){ float h; shingles(p.z, hrV(p), vec3(1.0), h); return h; }`,
  });
  const stoneMat = P(std('#ffffff', 0.9), {
    key: 'plinth', colorFn: 'plC', bumpFn: 'plB',
    extraFrag: `vec3 plC(vec3 p, vec3 n){ vec4 ce = cellv(vec2(p.x + p.z, p.y) * vec2(3.5, 6.0)); float m = smoothstep(0.02, 0.08, ce.z) * aaF(6.0) + (1.0 - aaF(6.0));
        return s2l(vec3(0.62, 0.58, 0.54)) * (0.8 + 0.3 * ce.w) * mix(0.6, 1.0, m); }
      float plB(vec3 p, vec3 n){ vec4 ce = cellv(vec2(p.x + p.z, p.y) * vec2(3.5, 6.0)); return 0.01 * smoothstep(0.02, 0.1, ce.z) * aaF(6.0); }`,
  });
  const dx0 = BACKDOOR.x - BACKDOOR.w / 2, dx1 = BACKDOOR.x + BACKDOOR.w / 2;
  {
    const fl0 = H.floor, eave = H.eave;
    // the yard-facing facade with openings for the door and the windows
    const facade = new THREE.Shape();
    facade.moveTo(H.x0, fl0);
    facade.lineTo(H.x1, fl0);
    facade.lineTo(H.x1, eave);
    facade.lineTo(xc, H.ridge);
    facade.lineTo(H.x0, eave);
    facade.closePath();
    const WINS = [
      // [x centre, y bottom, w, h]: ground floor (right of the door), upstairs
      [5.0, 1.45, 1.0, 1.3], [7.1, 1.45, 1.0, 1.3],
      [2.95, 4.1, 0.95, 1.25], [5.1, 4.1, 0.95, 1.25], [7.25, 4.1, 0.95, 1.25],
    ];
    const rect = (x0, y0, x1, y1) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; };
    facade.holes.push(rect(dx0, fl0 + 0.001, dx1, fl0 + BACKDOOR.h));
    for (const [x, y, w, h] of WINS) facade.holes.push(rect(x - w / 2, y, x + w / 2, y + h));
    const attic = new THREE.Path();
    attic.absarc(xc, 7.25, 0.36, 0, Math.PI * 2, true);
    facade.holes.push(attic);
    const fg = new THREE.ExtrudeGeometry(facade, { depth: 0.2, bevelEnabled: false, curveSegments: 24 });
    fg.translate(0, 0, ZF - 0.2);
    const side = [G.boxMM(H.x0, fl0, ZB, H.x0 + 0.2, eave, ZF - 0.2), G.boxMM(H.x1 - 0.2, fl0, ZB, H.x1, eave, ZF - 0.2)];
    add(mesh(G.mergeAll([fg, ...side]), wallMat), true, true);
    // the plinth all round, a little proud of the walls
    add(mesh(G.boxMM(H.x0 - 0.05, 0, ZB, H.x1 + 0.05, fl0, ZF + 0.05), stoneMat), true, true);
    // inside: dim warm rooms behind the windows
    const inner = new THREE.MeshStandardMaterial({ color: SRC('#5a3a26'), roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color(0.35, 0.18, 0.08) });
    add(mesh(G.boxMM(H.x0 + 0.2, fl0, ZB + 0.2, H.x1 - 0.2, eave, ZF - 0.2), inner), false, false);
    // window frames, mullions, sills, glass, shutters
    const tg = [], gg = [], sg = [];
    for (const [x, y, w, h] of WINS) {
      const x0 = x - w / 2, x1 = x + w / 2, y1 = y + h, fz = ZF;
      tg.push(G.boxMM(x0 - 0.06, y - 0.06, fz - 0.04, x1 + 0.06, y, fz + 0.06)); // sill
      tg.push(G.boxMM(x0 - 0.06, y1, fz - 0.04, x1 + 0.06, y1 + 0.08, fz + 0.04)); // head
      tg.push(G.boxMM(x0 - 0.06, y, fz - 0.04, x0, y1, fz + 0.04), G.boxMM(x1, y, fz - 0.04, x1 + 0.06, y1, fz + 0.04));
      tg.push(G.boxMM(x - 0.025, y, fz - 0.1, x + 0.025, y1, fz - 0.05), G.boxMM(x0, y + h * 0.52 - 0.025, fz - 0.1, x1, y + h * 0.52 + 0.025, fz - 0.05));
      gg.push(G.boxMM(x0, y, fz - 0.13, x1, y1, fz - 0.11));
      for (const sx of [x0 - 0.06 - w * 0.42, x1 + 0.06]) sg.push(G.boxMM(sx, y - 0.02, fz + 0.005, sx + w * 0.42, y1 + 0.02, fz + 0.04));
    }
    // attic: a round window with a white ring and a cross
    const ring = new THREE.Shape();
    ring.absarc(0, 0, 0.44, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.36, 0, Math.PI * 2, true);
    ring.holes.push(hole);
    const rgG = new THREE.ExtrudeGeometry(ring, { depth: 0.06, bevelEnabled: false, curveSegments: 32 });
    rgG.translate(xc, 7.25, ZF - 0.01);
    tg.push(rgG, G.boxMM(xc - 0.36, 7.23, ZF - 0.1, xc + 0.36, 7.27, ZF - 0.06), G.boxMM(xc - 0.02, 6.89, ZF - 0.1, xc + 0.02, 7.61, ZF - 0.06));
    gg.push(G.placed(new THREE.CircleGeometry(0.36, 32), xc, 7.25, ZF - 0.12));
    // corner boards, a band between the floors, the door frame
    tg.push(G.boxMM(H.x0 - 0.03, fl0, ZF - 0.05, H.x0 + 0.12, eave, ZF + 0.04), G.boxMM(H.x1 - 0.12, fl0, ZF - 0.05, H.x1 + 0.03, eave, ZF + 0.04));
    tg.push(G.boxMM(H.x0, fl0 + H.story - 0.05, ZF - 0.02, H.x1, fl0 + H.story + 0.07, ZF + 0.035));
    tg.push(G.boxMM(dx0 - 0.08, fl0, ZF - 0.05, dx0, fl0 + BACKDOOR.h + 0.08, ZF + 0.05), G.boxMM(dx1, fl0, ZF - 0.05, dx1 + 0.08, fl0 + BACKDOOR.h + 0.08, ZF + 0.05), G.boxMM(dx0 - 0.08, fl0 + BACKDOOR.h, ZF - 0.05, dx1 + 0.08, fl0 + BACKDOOR.h + 0.12, ZF + 0.05));
    add(mesh(G.mergeAll(tg), trimMat), true, true);
    add(mesh(G.mergeAll(gg), glassMat), false, true);
    add(mesh(G.mergeAll(sg), shutterMat), true, true);
    // the porch: a deck, three steps down to the lawn, two posts and a little roof
    const pz1 = ZF + 1.05;
    const deck = woodMat('#a77a52', 'porch', 'vec2(p.z, p.x)', 0.12);
    const pg = [G.boxMM(BACKDOOR.x - 0.85, 0, ZF, BACKDOOR.x + 0.85, fl0, pz1)];
    for (let i = 0; i < 3; i++) pg.push(G.boxMM(BACKDOOR.x - 0.6, 0, pz1 + 0.24 * i, BACKDOOR.x + 0.6, fl0 - (i + 1) * 0.15, pz1 + 0.24 * (i + 1)));
    add(mesh(G.mergeAll(pg), deck), true, true);
    add(mesh(G.mergeAll([G.boxMM(BACKDOOR.x - 0.82, fl0, pz1 - 0.12, BACKDOOR.x - 0.72, 2.95, pz1 - 0.02), G.boxMM(BACKDOOR.x + 0.72, fl0, pz1 - 0.12, BACKDOOR.x + 0.82, 2.95, pz1 - 0.02)]), trimMat), true, true);
    const awning = new THREE.BoxGeometry(1.95, 0.06, 1.25);
    awning.rotateX(0.32);
    awning.translate(BACKDOOR.x, 3.05, ZF + 0.55);
    add(mesh(awning, roofMat), true, true);
    // porch light: a little lantern by the door, glowing warm
    const lampG = new RoundedBoxGeometry(0.12, 0.2, 0.1, 2, 0.02);
    lampG.translate(dx1 + 0.22, fl0 + 1.75, ZF + 0.07);
    add(mesh(lampG, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(2.4, 1.5, 0.7), roughness: 0.4 })), false, false);
    // roof: two shingled slopes, the ridge running back from the yard
    const ov = 0.35, halfW = (H.x1 - H.x0) / 2, half = halfW + ov, rise = H.ridge - eave;
    const slope = Math.atan2(rise, halfW);
    const len = half / Math.cos(slope);
    const depth = H.depth + 0.7;
    const rg = [], fasc = [];
    for (const sgn of [-1, 1]) {
      const b = new THREE.BoxGeometry(len, 0.12, depth);
      b.translate((sgn * len) / 2, 0.06, 0);
      b.rotateZ(-sgn * slope);
      b.translate(xc, H.ridge + 0.05, (ZF + ZB) / 2 + 0.1);
      rg.push(b);
      const f = new THREE.BoxGeometry(len + 0.05, 0.18, 0.06);
      f.translate((sgn * (len + 0.05)) / 2, -0.02, 0);
      f.rotateZ(-sgn * slope);
      f.translate(xc, H.ridge + 0.05, ZF + 0.46);
      fasc.push(f);
    }
    add(mesh(G.mergeAll(rg), roofMat), true, true);
    add(mesh(G.mergeAll(fasc), trimMat), true, true);
    // chimney (brick), a downspout
    const brick = P(std('#ffffff', 0.85), {
      key: 'brick', colorFn: 'brC', bumpFn: 'brB',
      extraFrag: `vec3 brC(vec3 p, vec3 n){ float r = floor(p.y / 0.08); float u = (abs(n.x) > 0.5 ? p.z : p.x) / 0.2 + 0.5 * mod(r, 2.0);
          float m = min(fract(p.y / 0.08), 1.0 - fract(p.y / 0.08)) * 0.08; float mu = min(fract(u), 1.0 - fract(u)) * 0.2;
          float mortar = (1.0 - smoothstep(0.004, 0.009, min(m, mu))) * aaF(10.0);
          return mix(s2l(vec3(0.62, 0.28, 0.2)) * (0.85 + 0.25 * h21(vec2(floor(u), r))), vec3(0.6), mortar); }
        float brB(vec3 p, vec3 n){ float m = min(fract(p.y / 0.08), 1.0 - fract(p.y / 0.08)) * 0.08; return -0.004 * (1.0 - smoothstep(0.004, 0.009, m)) * aaF(10.0); }`,
    });
    add(mesh(G.boxMM(6.75, 6.6, -9.0, 7.35, 9.5, -8.4), brick), true, true);
    add(mesh(G.boxMM(6.7, 9.5, -9.05, 7.4, 9.62, -8.35), trimMat), true, true);
    add(mesh(G.rod(V3(H.x1 + 0.12, eave - 0.02, ZF + 0.12), V3(H.x1 + 0.12, 0.05, ZF + 0.12), 0.04, 0.04, 10), trimMat), true, true);
    // a garden hose reel and a watering can by the house
    const reel = [G.placed(new THREE.TorusGeometry(0.2, 0.05, 10, 28), 8.0, 0.32, -5.5), G.box(0.06, 0.32, 0.06, 7.85, 0.16, -5.5), G.box(0.06, 0.32, 0.06, 8.15, 0.16, -5.5)];
    add(mesh(G.mergeAll(reel), std('#3f8a4a', 0.5)), true, true);
    const can = new THREE.LatheGeometry([V2(0, 0), V2(0.13, 0), V2(0.13, 0.24), V2(0.11, 0.26), V2(0, 0.26)], 20);
    can.translate(6.6, 0, -5.25);
    add(mesh(G.mergeAll([can, G.rod(V3(6.7, 0.12, -5.25), V3(6.95, 0.3, -5.25), 0.02, 0.015, 8)]), shiny(std('#4d8fbf', 0.35, { metalness: 0.5, envMap, envMapIntensity: 0.8 }))), true, true);
  }
  // the back door: hinged on its left edge, swings out towards the yard; a warm
  // lit hallway behind it
  {
    add(mesh(G.boxMM(dx0, H.floor, ZF - 1.3, dx1, H.floor + BACKDOOR.h, ZF - 0.2), new THREE.MeshStandardMaterial({ color: SRC('#f0d9b0'), emissive: new THREE.Color(0.9, 0.6, 0.32), roughness: 0.9, side: THREE.BackSide })), false, false);
    const doorMat = P(std('#ffffff', 0.55), { key: 'door', colorFn: 'drC', extraFrag: 'vec3 drC(vec3 p, vec3 n){ return s2l(vec3(0.95, 0.94, 0.9)) * (0.95 + 0.06 * fbm(p.xy * 5.0)); }' });
    const g = new THREE.Group();
    const w = BACKDOOR.w - 0.02, h = BACKDOOR.h - 0.01;
    const panel = [G.box(w, h * 0.42, 0.05, w / 2, h * 0.21, 0), G.box(w, h * 0.12, 0.05, w / 2, h - h * 0.06, 0), G.box(0.12, h * 0.46, 0.05, 0.06, h * 0.65, 0), G.box(0.12, h * 0.46, 0.05, w - 0.06, h * 0.65, 0), G.box(w, 0.06, 0.05, w / 2, h * 0.65, 0)];
    panel.push(G.box(w * 0.36, h * 0.3, 0.02, w * 0.27, h * 0.2, 0.03), G.box(w * 0.36, h * 0.3, 0.02, w * 0.73, h * 0.2, 0.03));
    g.add(mesh(G.mergeAll(panel), doorMat));
    g.add(mesh(G.box(w - 0.24, h * 0.46 - 0.02, 0.01, w / 2, h * 0.65, -0.005), glassMat));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), shiny(std('#c9a24a', 0.25, { metalness: 1, envMap })));
    knob.position.set(w - 0.09, h * 0.47, 0.05);
    g.add(knob);
    g.position.set(dx0 + 0.01, H.floor + 0.005, ZF + 0.02);
    add(g, true, true);
    updaters.push((t) => {
      g.rotation.y = -1.75 * U.easeOutBack(U.prog(t, T.door, 0.5), 1.6);
    });
  }

  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}
