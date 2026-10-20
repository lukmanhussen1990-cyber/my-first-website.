// The static world at night: starry sky with a soft moon, the yard (swaying grass
// blades, fence, tree line, bushes, stepping stones), the doghouse (cut open, with
// the floorboard patch that rides on the kid's head) and the house shell (cut open
// like a dollhouse: walls, back door, kitchen window, ceiling, a dim bedroom, the
// attic and the roof). The kitchen inside is kitchen.js.
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
  vec3 c = base * (0.8 + 0.34 * id) * (0.84 + 0.26 * g1) * (0.93 + 0.12 * g2);
  float ku = floor(u * 0.9 + id * 3.7);
  vec2 kq = vec2(fract(u * 0.9 + id * 3.7) - 0.5, fv - 0.5);
  float knot = (1.0 - smoothstep(0.0, 0.05, length(kq * vec2(1.6, bw * 3.0)))) * step(0.72, h21(vec2(bi, ku)));
  c *= 1.0 - 0.35 * knot;
  c *= 1.0 - 0.55 * seam;
  h = -0.003 * seam + 0.0012 * g1 + 0.0004 * g2 - 0.0008 * knot;
  return c;
}
// roof shingles: rows along u, stacked up the slope in v (0.18 m rows, 0.26 m wide, staggered)
vec3 shingles(float u, float v, vec3 base, out float h){
  float rv = v / 0.18; float r = floor(rv), fr = fract(rv);
  float cu = u / 0.26 + 0.5 * mod(r, 2.0); float cid = floor(cu), fc = fract(cu);
  float id = h21(vec2(cid, r));
  float edge = 1.0 - smoothstep(0.0, 0.12, fr);
  float gap = (1.0 - smoothstep(0.0, 0.035, min(fc, 1.0 - fc))) * aaF(4.0);
  vec3 c = base * (0.78 + 0.36 * id) * (0.88 + 0.2 * fbm(vec2(u, v) * 6.0));
  c *= 1.0 - 0.42 * edge - 0.32 * gap;
  h = 0.012 * fr - 0.004 * gap;
  return c;
}
`;

const SRC = (s) => new THREE.Color(s); // sRGB hex -> linear

export function build(ctx) {
  const { scene, T, WD, MAT, G, U, add, mesh, envMap } = ctx;
  const { HOUSE, DOGHOUSE, PATCH } = WD;
  const rnd = U.mulberry32(97);
  const std = (hex, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color: SRC(hex), roughness: rough, metalness: 0, ...extra });
  const P = (mat, opts) => MAT.patch(mat, { ...opts, extraFrag: GLSL_ENV + (opts.extraFrag || '') });
  const updaters = [];
  // stepping stones from the back door across the lawn (x, z, radius)
  const STONES = [[0.25, -1.55, 0.17], [-0.12, -1.74, 0.15], [-2.15, -1.98, 0.15], [-2.6, -1.72, 0.14], [-3.05, -1.95, 0.13]];

  // -------------------------------------------------------------------------
  // sky: deep blue gradient, thousands of anti-aliased stars with a slow gentle
  // twinkle, a soft moon with a halo (top left of the yard shots), faint wisps
  // -------------------------------------------------------------------------
  const MOON = new THREE.Vector3(-0.15, 0.115, -1).normalize();
  const skyU = { uTime: { value: 0 }, uMoon: { value: MOON } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: /* glsl */ `varying vec3 vD; uniform float uTime; uniform vec3 uMoon;
        float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
          return mix(mix(h21(i),h21(i+vec2(1.,0.)),u.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),u.x), u.y); }
        float fb(vec2 p){ float s=0., a=0.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(17.1,9.3); a*=0.5;} return s/0.9375; }
        // one star layer: cells of cs radians, at most one star each
        vec3 starLayer(vec2 q, float cs, float density, float bright, float px){
          vec3 acc = vec3(0.0);
          vec2 gi = floor(q / cs);
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 c = gi + vec2(float(x), float(y));
            if (h21(c + 11.7) > density) continue;
            vec2 sp = (c + vec2(h21(c), h21(c + 3.1)) * 0.8 + 0.1) * cs;
            float d = length(q - sp) / px;
            float m = h21(c + 7.3);
            float b = bright * (0.25 + 1.6 * m * m * m);
            float r = 0.85 + 0.9 * m;
            float tw = 0.82 + 0.18 * sin(uTime * (0.9 + 1.4 * h21(c + 5.0)) + 6.283 * h21(c + 9.0));
            vec3 tint = mix(vec3(0.75, 0.85, 1.25), vec3(1.25, 1.0, 0.8), h21(c + 2.2));
            acc += tint * b * tw * exp(-d * d / (r * r));
          }
          return acc;
        }
        void main(){
          vec3 d = normalize(vD);
          float h = d.y;
          vec3 zen = vec3(0.004, 0.008, 0.040), mid = vec3(0.009, 0.019, 0.075), hor = vec3(0.028, 0.050, 0.130);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.10, h));
          c = mix(c, zen, smoothstep(0.08, 0.55, h));
          if (h < 0.0) c = mix(hor * 0.75, vec3(0.012, 0.018, 0.03), smoothstep(0.0, -0.15, h));
          float md = acos(clamp(dot(d, uMoon), -1.0, 1.0));
          c += vec3(0.05, 0.07, 0.13) * exp(-md * 7.0) + vec3(0.12, 0.15, 0.22) * exp(-md * 28.0);
          vec2 q = vec2(atan(d.x, -d.z), asin(clamp(h, -1.0, 1.0)));
          float px = 1.0 / 2600.0;
          vec3 st = starLayer(q, 0.016, 0.55, 0.045, px) + starLayer(q + 3.7, 0.041, 0.65, 0.12, px);
          c += st * smoothstep(0.01, 0.07, h) * (1.0 - 0.85 * exp(-md * 16.0));
          float cl = fb(vec2(q.x * 9.0 + uTime * 0.012, q.y * 26.0));
          float wisp = smoothstep(0.55, 0.85, cl) * smoothstep(0.02, 0.06, h) * (1.0 - smoothstep(0.12, 0.2, h));
          c = mix(c, vec3(0.06, 0.08, 0.14) + vec3(0.12, 0.13, 0.17) * exp(-md * 9.0), wisp * 0.55);
          float R = 0.026;
          float disc = 1.0 - smoothstep(R - 0.0014, R + 0.0014, md);
          vec2 mq = (q - vec2(atan(uMoon.x, -uMoon.z), asin(uMoon.y))) / R;
          float maria = fb(mq * 2.2 + 4.0);
          vec3 moonC = vec3(2.3, 2.38, 2.55) * (0.78 + 0.22 * smoothstep(0.35, 0.7, maria)) * (1.0 - 0.18 * dot(mq, mq));
          c = mix(c, moonC, disc);
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // -------------------------------------------------------------------------
  // grass: thousands of tapered blades, instanced, swaying in a slow breeze
  // -------------------------------------------------------------------------
  const grassU = { uTime: { value: 0 } };
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
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vH;')
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
          mvPosition.x += k * (0.016 + 0.022 * gust) * sway;
          mvPosition.z -= k * 0.005 * (1.0 + sin(uTime * 1.2 + ph * 1.6));
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.45, 1.12, smoothstep(0.0, 0.9, vH));');
    };
    mat.customProgramCacheKey = () => 'grass';
    const spots = [];
    const free = (x, z) => {
      if (x > HOUSE.x0 - 0.03 && x < HOUSE.x1 + 0.03 && z > HOUSE.z0 - 0.05) return false;
      if (x > -4.88 && x < -3.62 && z > -1.75) return false; // shaft opening and the dirt round it
      if ((x + 5.25) ** 2 + ((z + 0.55) / 0.9) ** 2 < 0.6) return false; // dirt pile
      if (x > DOGHOUSE.x0 - 0.06 && x < DOGHOUSE.x1 + 0.06 && z > DOGHOUSE.z0 - 0.06) return false;
      if (STONES.some(([sx, sz, r]) => (x - sx) ** 2 + (z - sz) ** 2 < (r + 0.02) ** 2)) return false;
      if (z > -8.15 && z < -7.85) return false; // fence line
      return true;
    };
    const fill = (x0, x1, z0, z1, perM2) => {
      const n = Math.round((x1 - x0) * (z1 - z0) * perM2);
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
        if (free(x, z)) spots.push([x, z]);
      }
    };
    fill(-8.5, 0.6, -1.0, -0.03, 520);
    fill(-8.5, 0.6, -3.0, -1.0, 300);
    fill(-11, 0.6, -8.0, -3.0, 70);
    fill(5.6, 9.5, -1.5, -0.03, 260);
    fill(5.6, 11, -8.0, -1.5, 40);
    const im = new THREE.InstancedMesh(g, mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const greens = ['#3f6b2a', '#4d7a30', '#5b8a36', '#3a6230', '#61903c', '#527f2e'].map(SRC);
    const c = new THREE.Color();
    spots.forEach(([x, z], i) => {
      const far = Math.min(1, -z / 8);
      const hgt = (0.075 + 0.07 * rnd()) * (1 + 0.25 * far);
      const wid = (0.02 + 0.008 * rnd()) * (1 + 0.9 * far);
      e.set((rnd() - 0.5) * 0.25, (rnd() - 0.5) * 1.4, (rnd() - 0.5) * 0.3);
      q.setFromEuler(e);
      m4.compose(v.set(x, 0, z), q, s.set(wid, hgt, wid));
      im.setMatrixAt(i, m4);
      c.copy(greens[Math.floor(rnd() * greens.length)]).multiplyScalar(0.8 + 0.4 * rnd());
      im.setColorAt(i, c);
    });
    im.castShadow = false;
    im.receiveShadow = true;
    im.frustumCulled = false;
    scene.add(im);
    updaters.push((t) => (grassU.uTime.value = t));
  }

  // -------------------------------------------------------------------------
  // yard dressing: stepping stones, fence, bushes, a tree, the tree line, flowers
  // -------------------------------------------------------------------------
  {
    const stoneMat = P(std('#8d8a84', 0.85), {
      key: 'yardStone', colorFn: 'stCol', bumpFn: 'stBump',
      extraFrag: `vec3 stCol(vec3 p, vec3 n){ return vec3(0.82 + 0.3 * fbm(p.xz * 6.0)) * (0.9 + 0.15 * vnoise(p.xz * 30.0) * aaF(30.0)); }
        float stBump(vec3 p, vec3 n){ return 0.006 * fbm(p.xz * 9.0); }`,
    });
    const geos = STONES.map(([x, z, r], i) => G.placed(new THREE.CylinderGeometry(r, r * 1.05, 0.04, 20), x, 0.012, z, 0, i, 0, 1, 1, 0.78 + 0.1 * (i % 2)));
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
    const fz = -8.0;
    const boardsG = [];
    for (let x = -14; x < 11; x += 0.155) {
      const h = 1.55 + 0.04 * Math.sin(x * 7.1);
      boardsG.push(G.placed(new THREE.BoxGeometry(0.14, h, 0.03), x, h / 2, fz, 0, 0, (rnd() - 0.5) * 0.012));
    }
    for (const y of [0.35, 1.2]) boardsG.push(G.box(25, 0.09, 0.05, -1.5, y, fz - 0.04));
    for (let x = -14; x < 11; x += 2.4) boardsG.push(G.box(0.1, 1.62, 0.1, x, 0.81, fz - 0.07));
    add(mesh(G.mergeAll(boardsG), woodMat('#8a6a4c', 'fence', 'vec2(p.y, p.x)', 0.155)), true, true);
  }
  const leafMat = (hex, key) =>
    P(std(hex, 0.85), {
      key, colorFn: key + 'C', bumpFn: key + 'B',
      extraFrag: `vec3 ${key}C(vec3 p, vec3 n){ vec4 ce = cellv(p.xy * 9.0 + p.z * 3.0);
          float leaf = smoothstep(0.55, 0.15, ce.z);
          return vec3(0.6 + 0.5 * ce.w) * (0.55 + 0.6 * leaf) * (0.85 + 0.3 * fbm(p.xz * 2.0 + p.y)); }
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
  {
    const bushes = [bushGeo(-7.4, 0, -7.2, 0.75), bushGeo(-6.1, 0, -7.4, 0.55), bushGeo(-2.8, 0, -7.35, 0.6), bushGeo(-0.15, 0, -3.4, 0.5), bushGeo(6.4, 0, -6.8, 0.7), bushGeo(-9.5, 0, -7.0, 0.8)];
    add(mesh(G.mergeAll(bushes), leafMat('#2f5a2a', 'bush')), true, true);
    // a tree behind the doghouse, its crown against the sky
    const trunk = [G.rod(new THREE.Vector3(-0.35, 0, -6.4), new THREE.Vector3(-0.42, 2.6, -6.4), 0.17, 0.11, 12), G.rod(new THREE.Vector3(-0.42, 2.2, -6.4), new THREE.Vector3(-1.1, 3.3, -6.3), 0.08, 0.05, 8), G.rod(new THREE.Vector3(-0.42, 2.4, -6.4), new THREE.Vector3(0.25, 3.4, -6.5), 0.07, 0.045, 8)];
    const barkMat = P(std('#4a3a2c', 0.9), {
      key: 'bark', colorFn: 'barkC', bumpFn: 'barkB',
      extraFrag: `vec3 barkC(vec3 p, vec3 n){ return vec3(0.75 + 0.4 * fbm(vec2(atan(p.x + 0.4, p.z + 6.4) * 3.0, p.y * 9.0))); }
        float barkB(vec3 p, vec3 n){ return 0.008 * fbm(vec2(atan(p.x + 0.4, p.z + 6.4) * 4.0, p.y * 14.0)); }`,
    });
    add(mesh(G.mergeAll(trunk), barkMat), true, true);
    const crown = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 0.8 + 0.35 * rnd();
      crown.push(G.placed(G.lumpyBlob(r, 2, 0.2, 40 + i), -0.4 + Math.cos(a) * 1.0, 3.6 + Math.sin(a * 1.3) * 0.5 + rnd() * 0.4, -6.4 + Math.sin(a) * 0.6));
    }
    crown.push(G.placed(G.lumpyBlob(1.2, 2, 0.18, 77), -0.4, 4.2, -6.4));
    add(mesh(G.mergeAll(crown), leafMat('#2c5329', 'crown')), true, true);
    // tree line and neighbours' trees beyond the fence (fill the view up to the horizon)
    const far = [];
    for (let i = 0; i < 26; i++) {
      const x = -26 + i * 2.2 + rnd() * 1.2, z = -12 - rnd() * 6;
      const r = 1.3 + rnd() * 1.4;
      far.push(G.placed(G.lumpyBlob(r, 1, 0.25, 200 + i), x, r * 0.9 + rnd() * 1.6, z, 0, 0, 0, 1, 1.25, 1));
    }
    for (let i = 0; i < 22; i++) {
      const x = -60 + i * 6 + rnd() * 3, z = -34 - rnd() * 14, r = 3 + rnd() * 3;
      far.push(G.placed(G.lumpyBlob(r, 1, 0.25, 300 + i), x, r * 0.6, z, 0, 0, 0, 1.3, 1.1, 1));
    }
    add(mesh(G.mergeAll(far), leafMat('#1f3a26', 'farTree')), false, true);
    // the ground out to the trees, and the lawn behind the house
    const lawnFar = MAT.lawnMaterial({ shaft: new THREE.Vector4(99, 99.1, 99, 99.1), open: 999 });
    add(mesh(G.placed(new THREE.PlaneGeometry(160, 70), 0, -0.002, -49, -Math.PI / 2, 0, 0), lawnFar), false, true);
    add(mesh(G.placed(new THREE.PlaneGeometry(HOUSE.x1 - HOUSE.x0, 14 + HOUSE.z0), (HOUSE.x0 + HOUSE.x1) / 2, 0, (HOUSE.z0 - 14) / 2, -Math.PI / 2, 0, 0), lawnFar), false, true);
    // pale flowers along the fence
    const fl = [];
    for (let i = 0; i < 46; i++) {
      const x = -9 + rnd() * 9.4, z = -7.75 + rnd() * 0.45;
      if (x > -3.1 && x < -2.5) continue;
      fl.push(G.placed(new THREE.IcosahedronGeometry(0.035 + 0.02 * rnd(), 0), x, 0.18 + 0.2 * rnd(), z));
    }
    add(mesh(G.mergeAll(fl), std('#d9d2f0', 0.7)), false, true);
  }

  // -------------------------------------------------------------------------
  // the doghouse: plank walls, gable roof with shingles, cut open at z = 0
  // -------------------------------------------------------------------------
  const D = DOGHOUSE;
  const dgWood = woodMat('#b0703e', 'dgWall', 'abs(n.x) > 0.5 ? vec2(p.y, p.z) : vec2(p.y, p.x)', 0.1);
  const dgFloorMat = woodMat('#9a6a42', 'dgFloor', 'vec2(p.z, p.x)', 0.11);
  {
    const wt = 0.05, x0 = D.x0, x1 = D.x1, z0 = D.z0, fl = D.floor;
    const wallsG = [G.boxMM(x0, fl, z0, x0 + wt, D.eave, 0), G.boxMM(x1 - wt, fl, z0, x1, D.eave, 0), G.boxMM(x0, fl, z0, x1, D.eave, z0 + wt)];
    const tri = new THREE.Shape();
    tri.moveTo(x0, D.eave);
    tri.lineTo(x1, D.eave);
    tri.lineTo((x0 + x1) / 2, D.ridge);
    tri.closePath();
    const triG = new THREE.ExtrudeGeometry(tri, { depth: wt, bevelEnabled: false });
    triG.translate(0, 0, z0);
    wallsG.push(triG);
    add(mesh(G.mergeAll(wallsG), dgWood), true, true);
    // floor with a hole for the patch, on two skids
    const fg = [
      G.boxMM(x0 + wt, fl - 0.04, z0 + wt, PATCH.x0, fl, 0),
      G.boxMM(PATCH.x1, fl - 0.04, z0 + wt, x1 - wt, fl, 0),
      G.boxMM(PATCH.x0, fl - 0.04, z0 + wt, PATCH.x1, fl, PATCH.z0),
      G.boxMM(PATCH.x0, fl - 0.04, PATCH.z1, PATCH.x1, fl, 0),
      G.boxMM(x0 + 0.08, 0, z0 + 0.05, x0 + 0.16, fl - 0.04, -0.02),
      G.boxMM(x1 - 0.16, 0, z0 + 0.05, x1 - 0.08, fl - 0.04, -0.02),
    ];
    add(mesh(G.mergeAll(fg), dgFloorMat), true, true);
    // roof: two shingled slopes with a little overhang (cut at z = 0)
    const ov = 0.1, halfW = (x1 - x0) / 2, half = halfW + ov, rise = D.ridge - D.eave;
    const slope = Math.atan2(rise, halfW);
    const len = half / Math.cos(slope);
    const roofMat = P(std('#7a3a2c', 0.82), {
      key: 'dgRoof', colorFn: 'dgrC', bumpFn: 'dgrB',
      extraFrag: `float dgV(vec3 p){ return (${D.ridge.toFixed(3)} - p.y) * 1.6; }
        vec3 dgrC(vec3 p, vec3 n){ if (n.z > 0.5 && p.z > -0.01) return vec3(0.75, 0.6, 0.45) * 1.6; float h; return shingles(p.z * 1.4, dgV(p) * 1.3, vec3(1.0), h); }
        float dgrB(vec3 p, vec3 n){ if (n.z > 0.5 && p.z > -0.01) return 0.0; float h; shingles(p.z * 1.4, dgV(p) * 1.3, vec3(1.0), h); return h * 0.6; }`,
    });
    const cx = (x0 + x1) / 2, depth = -z0 + 0.12;
    const rg = [];
    for (const sgn of [-1, 1]) {
      const b = new THREE.BoxGeometry(len, 0.045, depth);
      b.translate((sgn * len) / 2, 0.022, -depth / 2);
      b.rotateZ(-sgn * slope);
      b.translate(cx, D.ridge + 0.02, 0);
      rg.push(b);
    }
    add(mesh(G.mergeAll(rg), roofMat), true, true);
    // a cushion inside (left, where the dog sleeps), a bowl outside
    const cushion = new RoundedBoxGeometry(0.42, 0.07, 0.9, 3, 0.03);
    cushion.translate(x0 + 0.27, fl + 0.035, -0.62);
    add(mesh(cushion, P(std('#5b6fa8', 0.95), { key: 'cushion', colorFn: 'cuC', extraFrag: `vec3 cuC(vec3 p, vec3 n){ return vec3(0.85 + 0.25 * step(0.5, fract((p.x + p.z) * 9.0)) * aaF(9.0)); }` })), true, true);
    const bowl = new THREE.LatheGeometry([new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.1, 0.0), new THREE.Vector2(0.12, 0.05), new THREE.Vector2(0.105, 0.055), new THREE.Vector2(0.085, 0.015), new THREE.Vector2(0.0, 0.015)], 24);
    bowl.translate(x1 + 0.28, 0, -0.45);
    add(mesh(bowl, std('#b84a3a', 0.4, { envMap, envMapIntensity: 0.6 })), true, true);
  }
  // the floorboard patch that rides on the kid's head (pivots about its centre)
  const patch = new THREE.Group();
  const PC = { x: (PATCH.x0 + PATCH.x1) / 2, z: (PATCH.z0 + PATCH.z1) / 2 };
  patch.add(mesh(G.box(PATCH.x1 - PATCH.x0 - 0.008, 0.04, PATCH.z1 - PATCH.z0 - 0.008, 0, -0.02, 0), dgFloorMat));
  patch.position.set(PC.x, D.floor, PC.z);
  add(patch, true, true);
  // when the patch lands back after the sink (the head passes below the floor)
  let tLand = T.sink1;
  for (let t = T.sink0; t < T.sink1 + 0.6; t += 0.005) {
    if (WD.dogPopHead(t) + 0.04 < D.floor) { tLand = t; break; }
  }
  updaters.push((t) => {
    let y = D.floor;
    if (t > T.dogUp1 && t < tLand) y = Math.max(D.floor, WD.dogPopHead(t) + 0.04);
    const lift = U.clamp((y - D.floor) / 0.3);
    let rz = lift * (0.06 + 0.05 * Math.sin(t * 2.7)), rx = -0.05 * lift;
    if (t >= tLand) {
      const b = U.wobble(t, tLand, 4.5, 7);
      y = D.floor + 0.03 * Math.abs(b);
      rz = 0.04 * b;
    }
    patch.position.y = y;
    patch.rotation.set(rx, 0, rz);
  });

  // -------------------------------------------------------------------------
  // the house shell, cut open at z = 0 like a dollhouse
  // -------------------------------------------------------------------------
  const H = HOUSE, wt = H.wall;
  const ZF = 0.003; // cut faces just proud of z = 0 so nothing z-fights them
  const cutCol = `vec3 cutCol(vec3 p){ return vec3(0.92, 0.88, 0.82) * (0.93 + 0.1 * fbm(p.xy * 6.0)); }`;
  const wallMat = P(std('#ffffff', 0.86), {
    key: 'houseWall', colorFn: 'hwC', bumpFn: 'hwB',
    extraFrag: `${cutCol}
      bool hwExt(vec3 p, vec3 n){ return (n.x < -0.5 && p.x < ${(H.x0 + 0.01).toFixed(3)}) || (n.x > 0.5 && p.x > ${(H.x1 - 0.01).toFixed(3)}) || (n.z < -0.5 && p.z < ${(H.z0 + 0.01).toFixed(3)}); }
      vec3 siding(vec3 p, vec3 n){ float v = p.y / 0.16; float f = fract(v);
        vec3 c = vec3(0.96, 0.86, 0.62) * (0.9 + 0.14 * h21(vec2(floor(v), 3.0)));
        c *= 1.0 - 0.38 * (1.0 - smoothstep(0.0, 0.14, f)) * aaF(6.0);
        c *= 0.92 + 0.12 * fbm(vec2(p.x + p.z, p.y) * 3.0);
        return c; }
      vec3 hwC(vec3 p, vec3 n){
        if (n.z > 0.5 && p.z > -0.012) return cutCol(p);
        if (hwExt(p, n)) return siding(p, n);
        if (p.y < ${H.ceil.toFixed(3)}) {
          vec3 c = p.y < 0.95 ? vec3(0.62, 0.72, 0.58) : vec3(0.93, 0.86, 0.72);
          c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.015, abs(p.y - 0.95)));
          return c * (0.93 + 0.08 * fbm(p.xy * 4.0 + p.z));
        }
        vec2 uv = abs(n.x) > 0.5 ? p.zy : p.xy;
        vec4 ce = cellv(uv * 7.0);
        float star = (1.0 - smoothstep(0.05, 0.08, ce.z)) * step(0.6, ce.w) * aaF(14.0);
        return mix(vec3(0.55, 0.66, 0.86), vec3(0.98, 0.92, 0.7), star * 0.7) * (0.94 + 0.08 * fbm(uv * 3.0));
      }
      float hwB(vec3 p, vec3 n){ if (hwExt(p, n)) { float f = fract(p.y / 0.16); return (0.006 * smoothstep(0.0, 0.15, f) * (1.0 - smoothstep(0.85, 1.0, f))) * aaF(6.0) + 0.0006 * fbm(p.xz * 20.0); } return 0.0005 * fbm(p.xy * 14.0 + p.z); }`,
  });
  {
    const wg = [];
    const B = (x0, y0, z0, x1, y1, z1) => wg.push(G.boxMM(x0, y0, z0, x1, y1, z1 > -0.001 ? ZF : z1));
    const dz0 = WD.BACKDOOR.z0, dz1 = WD.BACKDOOR.z1, dh = WD.BACKDOOR.h;
    // ground floor: left wall with the back door, back wall with the window, right wall
    B(H.x0, H.slab0, H.z0, H.x0 + wt, H.ceil, dz0);
    B(H.x0, H.slab0, dz1, H.x0 + wt, H.ceil, 0);
    B(H.x0, H.slab0, dz0, H.x0 + wt, H.floor, dz1);
    B(H.x0, dh, dz0, H.x0 + wt, H.ceil, dz1);
    const w = WD.WINDOW;
    B(H.x0 + wt, H.slab0, H.z0, w.x0, H.ceil, H.z0 + wt);
    B(w.x1, H.slab0, H.z0, H.x1 - wt, H.ceil, H.z0 + wt);
    B(w.x0, H.slab0, H.z0, w.x1, w.y0, H.z0 + wt);
    B(w.x0, w.y1, H.z0, w.x1, H.ceil, H.z0 + wt);
    B(H.x1 - wt, H.slab0, H.z0, H.x1, H.ceil, 0);
    // upper floor: walls with a window at the back
    const u0 = H.upper, u1 = H.roof0;
    B(H.x0, u0, H.z0, H.x0 + wt, u1, 0);
    B(H.x1 - wt, u0, H.z0, H.x1, u1, 0);
    B(H.x0 + wt, u0, H.z0, 3.6, u1, H.z0 + wt);
    B(4.6, u0, H.z0, H.x1 - wt, u1, H.z0 + wt);
    B(3.6, u0, H.z0, 4.6, 3.85, H.z0 + wt);
    B(3.6, 4.85, H.z0, 4.6, u1, H.z0 + wt);
    add(mesh(G.mergeAll(wg), wallMat), true, true);
    // footings
    const conc = P(std('#9a968e', 0.9), {
      key: 'footing', colorFn: 'ftC', bumpFn: 'ftB',
      extraFrag: `vec3 ftC(vec3 p, vec3 n){ return vec3(0.85 + 0.2 * fbm(p.xy * 5.0)) * (1.0 - 0.2 * step(0.93, vnoise(p.xy * 40.0)) * aaF(40.0)); }
        float ftB(vec3 p, vec3 n){ return 0.002 * fbm(p.xy * 12.0); }`,
    });
    add(mesh(G.mergeAll([G.boxMM(H.x0, H.foot, H.z0, H.x0 + wt, H.slab0, 0.004), G.boxMM(H.x1 - wt, H.foot, H.z0, H.x1, H.slab0, 0.004), G.boxMM(H.x0, H.foot, H.z0, H.x1, H.slab0, H.z0 + wt)]), conc), true, true);
  }
  // slabs: kitchen ceiling / bedroom floor, bedroom ceiling / attic floor
  const slabMat = P(std('#ffffff', 0.8), {
    key: 'houseSlab', colorFn: 'hsC', bumpFn: 'hsB',
    extraFrag: `${cutCol}
      vec3 hsC(vec3 p, vec3 n){
        if (n.z > 0.5 && p.z > -0.012) return cutCol(p) * 0.95;
        if (n.y < -0.5) return vec3(0.9, 0.87, 0.8);
        if (n.y > 0.5) { float h; return boards(p.x, p.z, 0.14, vec3(0.62, 0.42, 0.26), 9.0, h); }
        return vec3(0.8, 0.76, 0.7); }
      float hsB(vec3 p, vec3 n){ if (n.y > 0.5) { float h; boards(p.x, p.z, 0.14, vec3(1.0), 9.0, h); return h; } return 0.0; }`,
  });
  add(mesh(G.mergeAll([G.boxMM(H.x0, H.ceil, H.z0, H.x1, H.upper, 0.002), G.boxMM(H.x0, H.roof0, H.z0, H.x1, H.roof0 + 0.12, 0.002)]), slabMat), true, true);
  // back door (closed, a little window in it) and the kitchen window with curtains
  {
    const dz0 = WD.BACKDOOR.z0, dz1 = WD.BACKDOOR.z1, dh = WD.BACKDOOR.h, xi = H.x0 + wt;
    add(mesh(G.boxMM(H.x0 + 0.06, H.floor, dz0 + 0.03, H.x0 + 0.11, dh - 0.03, dz1 - 0.03), woodMat('#3f6f8a', 'door', 'vec2(p.y, p.z)', 0.13)), true, true);
    const trim = std('#f2ece0', 0.6);
    const tg = [G.boxMM(xi - 0.02, H.floor, dz0 - 0.08, xi + 0.02, dh + 0.08, dz0), G.boxMM(xi - 0.02, H.floor, dz1, xi + 0.02, dh + 0.08, dz1 + 0.08), G.boxMM(xi - 0.02, dh, dz0, xi + 0.02, dh + 0.08, dz1)];
    const w = WD.WINDOW, zf = H.z0 + wt;
    tg.push(G.boxMM(w.x0 - 0.07, w.y0 - 0.06, zf, w.x1 + 0.07, w.y0, zf + 0.07));
    tg.push(G.boxMM(w.x0 - 0.06, w.y1, zf, w.x1 + 0.06, w.y1 + 0.06, zf + 0.03));
    tg.push(G.boxMM(w.x0 - 0.06, w.y0, zf, w.x0, w.y1, zf + 0.03), G.boxMM(w.x1, w.y0, zf, w.x1 + 0.06, w.y1, zf + 0.03));
    tg.push(G.boxMM((w.x0 + w.x1) / 2 - 0.02, w.y0, H.z0 + 0.09, (w.x0 + w.x1) / 2 + 0.02, w.y1, H.z0 + 0.13), G.boxMM(w.x0, (w.y0 + w.y1) / 2 - 0.02, H.z0 + 0.09, w.x1, (w.y0 + w.y1) / 2 + 0.02, H.z0 + 0.13));
    tg.push(G.placed(new THREE.SphereGeometry(0.03, 12, 8), xi + 0.02, 1.0, dz0 + 0.12));
    add(mesh(G.mergeAll(tg), trim), true, true);
    const glass = () => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.65, 0.8), roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.16, envMap, envMapIntensity: 1.4, depthWrite: false });
    add(mesh(G.placed(new THREE.PlaneGeometry(w.x1 - w.x0, w.y1 - w.y0), (w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, H.z0 + 0.11), glass()), false, false);
    add(mesh(G.placed(new THREE.PlaneGeometry(0.42, 0.5), H.x0 + 0.115, 1.55, (dz0 + dz1) / 2, 0, Math.PI / 2, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.12, 0.25), roughness: 0.1, envMap, envMapIntensity: 1.5 })), false, false);
    const curtainMat = P(std('#c8664f', 0.95, { side: THREE.DoubleSide }), {
      key: 'curtain', colorFn: 'ctC',
      extraFrag: `vec3 ctC(vec3 p, vec3 n){ return vec3(0.9 + 0.12 * fbm(p.xy * 7.0)); }`,
    });
    const curt = (xa, xb) => {
      const g = new THREE.PlaneGeometry(xb - xa, w.y1 - w.y0 + 0.25, 24, 8);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i);
        const pinch = 1 - 0.55 * Math.exp(-((y + 0.15) ** 2) / 0.02);
        pa.setX(i, x * pinch);
        pa.setZ(i, 0.03 * Math.sin((x + xb) * 30));
      }
      g.computeVertexNormals();
      return G.placed(g, (xa + xb) / 2, (w.y0 + w.y1) / 2 + 0.05, H.z0 + wt + 0.06);
    };
    add(mesh(G.mergeAll([curt(w.x0 - 0.2, w.x0 + 0.12), curt(w.x1 - 0.12, w.x1 + 0.2)]), curtainMat), true, true);
    // upstairs window
    add(mesh(G.placed(new THREE.PlaneGeometry(1.0, 1.0), 4.1, 4.35, H.z0 + 0.11), glass()), false, false);
    add(mesh(G.mergeAll([G.boxMM(3.55, 3.8, H.z0 + wt, 4.65, 3.86, H.z0 + wt + 0.06), G.boxMM(4.08, 3.85, H.z0 + 0.09, 4.12, 4.85, H.z0 + 0.13)]), trim), true, true);
  }
  // upstairs: the kid's empty bed (blanket thrown back), a nightstand with a little lamp, a rug
  {
    const y0 = H.upper;
    const bedWood = woodMat('#8b5a3c', 'bed', 'vec2(p.x, p.y)', 0.09);
    add(mesh(G.mergeAll([G.boxMM(1.25, y0, -2.36, 3.05, y0 + 0.32, -1.35), G.boxMM(1.25, y0, -2.38, 1.33, y0 + 0.95, -1.35), G.boxMM(2.97, y0, -2.38, 3.05, y0 + 0.62, -1.35), G.boxMM(3.25, y0, -2.36, 3.7, y0 + 0.55, -1.95)]), bedWood), true, true);
    const sheet = new RoundedBoxGeometry(1.62, 0.16, 0.98, 3, 0.05);
    sheet.translate(2.15, y0 + 0.4, -1.86);
    add(mesh(sheet, std('#e9e4f2', 0.95)), true, true);
    const pillow = new RoundedBoxGeometry(0.42, 0.12, 0.62, 3, 0.05);
    pillow.translate(1.58, y0 + 0.52, -1.86);
    add(mesh(pillow, std('#f4efe6', 0.95)), true, true);
    const blanket = new THREE.PlaneGeometry(0.95, 1.05, 16, 12);
    const pa = blanket.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i);
      pa.setZ(i, 0.05 * Math.sin(x * 9 + y * 4) + 0.12 * Math.exp(-((x - 0.3) ** 2) / 0.03));
    }
    blanket.computeVertexNormals();
    G.placed(blanket, 2.55, y0 + 0.5, -1.86, -Math.PI / 2, 0, 0);
    add(mesh(blanket, P(std('#e0a23c', 0.95, { side: THREE.DoubleSide }), { key: 'blanket', colorFn: 'blC', extraFrag: `vec3 blC(vec3 p, vec3 n){ return vec3(0.82 + 0.3 * step(0.5, fract(p.x * 6.0)) * aaF(12.0)); }` })), true, true);
    // lamp: a warm glowing shade (emissive, so it blooms) and a soft glow on the wall behind it
    const shade = new THREE.CylinderGeometry(0.07, 0.11, 0.14, 20, 1, true);
    shade.translate(3.47, y0 + 0.78, -2.15);
    add(mesh(shade, new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.7, 0.4), emissive: new THREE.Color(1.6, 0.95, 0.42), roughness: 0.9, side: THREE.DoubleSide })), false, false);
    add(mesh(G.mergeAll([G.placed(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), 3.47, y0 + 0.65, -2.15), G.placed(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 16), 3.47, y0 + 0.565, -2.15)]), std('#c9b28a', 0.5)), false, false);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g2 = cv.getContext('2d');
    const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 64, 64);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), color: new THREE.Color(0.55, 0.32, 0.12), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.position.set(3.47, y0 + 0.85, H.z0 + wt + 0.005);
    pool.renderOrder = 5;
    scene.add(pool);
    const rug = new RoundedBoxGeometry(1.5, 0.012, 0.9, 2, 0.006);
    rug.translate(2.3, y0 + 0.006, -0.85);
    add(mesh(rug, P(std('#6f8f7a', 0.95), { key: 'rug', colorFn: 'rgC', extraFrag: `vec3 rgC(vec3 p, vec3 n){ vec2 q = (p.xz - vec2(2.3, -0.85)) / vec2(0.75, 0.45); float b = step(0.8, max(abs(q.x), abs(q.y))); return mix(vec3(1.0), vec3(1.25, 1.1, 0.7), b); }` })), false, true);
  }
  // roof: gable facing the camera (ridge along z), shingles; the cut shows the attic
  {
    const ov = 0.28, cxh = (H.x0 + H.x1) / 2, half = (H.x1 - H.x0) / 2, rise = H.ridge - H.roof0;
    const slope = Math.atan2(rise, half);
    const len = (half + ov) / Math.cos(slope);
    const depth = -H.z0 + 0.35;
    const roofMat = P(std('#ffffff', 0.85), {
      key: 'houseRoof', colorFn: 'hrC', bumpFn: 'hrB',
      extraFrag: `float hrV(vec3 p){ return (${H.ridge.toFixed(3)} - p.y) / ${Math.sin(slope).toFixed(4)}; }
        vec3 hrC(vec3 p, vec3 n){
          if (n.z > 0.5 && p.z > -0.012) return vec3(0.55, 0.36, 0.25) * (0.9 + 0.1 * fbm(p.xy * 9.0));
          if (n.y < -0.2) return vec3(0.62, 0.48, 0.34);
          float h; return shingles(p.z, hrV(p), vec3(0.6, 0.3, 0.24), h); }
        float hrB(vec3 p, vec3 n){ if (n.y < 0.2 || (n.z > 0.5 && p.z > -0.012)) return 0.0; float h; shingles(p.z, hrV(p), vec3(1.0), h); return h; }`,
    });
    const rg = [];
    for (const sgn of [-1, 1]) {
      const b = new THREE.BoxGeometry(len, 0.16, depth);
      b.translate((sgn * len) / 2, -0.08, -depth / 2 + ZF);
      b.rotateZ(-sgn * slope);
      b.translate(cxh, H.ridge + 0.08 / Math.cos(slope), 0);
      rg.push(b);
    }
    add(mesh(G.mergeAll(rg), roofMat), true, true);
    // the attic's back gable wall and a couple of boxes up there
    const tri = new THREE.Shape();
    tri.moveTo(H.x0, H.roof0);
    tri.lineTo(H.x1, H.roof0);
    tri.lineTo(cxh, H.ridge);
    tri.closePath();
    const triG = new THREE.ExtrudeGeometry(tri, { depth: wt, bevelEnabled: false });
    triG.translate(0, 0, H.z0);
    add(mesh(triG, woodMat('#9c7a58', 'attic', 'vec2(p.y, p.x)', 0.16)), true, true);
    const boxes = [new RoundedBoxGeometry(0.5, 0.36, 0.45, 2, 0.02).translate(2.0, H.roof0 + 0.3, -1.9), new RoundedBoxGeometry(0.4, 0.3, 0.4, 2, 0.02).translate(2.55, H.roof0 + 0.27, -2.05), new RoundedBoxGeometry(0.34, 0.26, 0.34, 2, 0.02).translate(2.08, H.roof0 + 0.61, -1.95)];
    add(mesh(G.mergeAll(boxes), std('#b08a5a', 0.9)), true, true);
    const brick = P(std('#9a4b36', 0.85), {
      key: 'chim', colorFn: 'chC', bumpFn: 'chB',
      extraFrag: `vec3 chC(vec3 p, vec3 n){ vec2 uv = abs(n.x) > 0.5 ? p.zy : p.xy; float r = floor(uv.y / 0.09); vec2 c = vec2(uv.x / 0.22 + 0.5 * mod(r, 2.0), uv.y / 0.09);
          vec2 f = fract(c); float m = 1.0 - smoothstep(0.0, 0.08, min(min(f.x, 1.0 - f.x) * 0.22, min(f.y, 1.0 - f.y) * 0.09) / 0.02);
          return mix(vec3(0.8 + 0.4 * h21(floor(c))), vec3(1.6, 1.55, 1.45), m * aaF(11.0)); }
        float chB(vec3 p, vec3 n){ vec2 uv = abs(n.x) > 0.5 ? p.zy : p.xy; float r = floor(uv.y / 0.09); vec2 f = fract(vec2(uv.x / 0.22 + 0.5 * mod(r, 2.0), uv.y / 0.09)); return -0.004 * (1.0 - smoothstep(0.0, 0.1, min(f.x, f.y))) * aaF(11.0); }`,
    });
    add(mesh(G.boxMM(4.25, 5.9, -2.0, 4.7, 7.9, -1.55), brick), true, true);
  }
  // keep the moon off the kitchen and the bedroom (dim until the fridge light):
  // an invisible flag in front of the house that only casts a shadow
  {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 5.4), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    flag.position.set(2.35, 3.95, 0.65);
    flag.castShadow = true;
    flag.receiveShadow = false;
    scene.add(flag);
  }

  return {
    update(t) {
      skyU.uTime.value = t;
      for (const f of updaters) f(t);
    },
  };
}
