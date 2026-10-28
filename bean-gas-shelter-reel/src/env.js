// The yard on a sunny day: grass, a low wooden fence across the back with a gap at
// the porch steps, a big tree (procedural branches and leaf clusters) with a little
// bird in it, flower beds, the neighbours' trees and roofs, a corrugated-metal shed,
// and the two-storey cream house with blue shutters and a red barrel-tile roof, its
// back porch facing the yard. When the cloud rolls over, the flowers droop and fade,
// the leaves curl and the bird flaps away.
import * as THREE from 'three';

const SRC = (s) => new THREE.Color(s);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// procedural detail shared by the env materials
const GLSL_ENV = /* glsl */ `
float stucco(vec3 p, vec3 n){ vec2 uv = puv(p, n); return fbm(uv * 3.0) * 0.5 + vnoise(uv * 23.0) * 0.3 * aaF(23.0) + vnoise(uv * 71.0) * 0.2 * aaF(71.0); }
`;

export function build(ctx) {
  const { scene, T, WD, MAT, G, U, add, mesh, envMap, envMats, instanced, beginInst, setInst, setInstQ, endInst } = ctx;
  const { clamp, lerp, smooth, prog, easeOutCubic } = U;
  const rnd = U.mulberry32(4242);
  const std = (hex, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color: SRC(hex), roughness: rough, metalness: 0, ...extra });
  const P = (mat, opts) => MAT.patch(mat, { ...opts, extraFrag: GLSL_ENV + (opts.extraFrag || '') });
  const shiny = (m) => (envMats.push(m), m);
  const updaters = [];
  const H = WD.HOUSE;

  // -------------------------------------------------------------------------
  // grass: tens of thousands of tapered blades, swaying; flattened by the storm
  // -------------------------------------------------------------------------
  const grassU = { uTime: { value: 0 }, uWind: { value: 0 }, ...MAT.PIT_U };
  {
    const hs = [0, 0.3, 0.58, 0.82, 1.0], ws = [1.0, 0.88, 0.66, 0.38, 0.0];
    const pos = [], nrm = [], idx = [];
    for (let i = 0; i < hs.length; i++) {
      const y = hs[i], w = ws[i] * 0.5, bend = 0.42 * y * y;
      if (i < hs.length - 1) {
        pos.push(-w, y, bend, w, y, bend);
        nrm.push(-0.2, 0.85, 0.5, 0.2, 0.85, 0.5);
      } else {
        pos.push(0, y, bend);
        nrm.push(0, 0.88, 0.48);
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
    // Lambert: grass is diffuse, and it is cheaper per pixel than the full PBR model
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const sx0 = WD.STAIR.x0.toFixed(2), sx1 = WD.STAIR.x1.toFixed(2), szb = WD.STAIR.zb.toFixed(2);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime, uWind; uniform vec4 uPit; uniform float uFill;
          varying float vH;
          bool grassHole(vec3 b){
            bool inPit = uPit.z > 0.002 && b.x > uPit.x - 0.03 && b.x < uPit.y + 0.03 && b.z > uPit.w - 0.03 && b.z < 0.03;
            if (!inPit) return false;
            bool well = b.x > ${sx0} - 0.04 && b.x < ${sx1} + 0.04 && b.z > ${szb} - 0.04;
            bool refilled = uFill > 0.0 && !well && b.z < uPit.w + (0.05 - uPit.w) * uFill - 0.05;
            return !refilled;
          }`)
        .replace(
          '#include <project_vertex>',
          `vec4 mvPosition = vec4(transformed, 1.0);
          vec3 base = vec3(0.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
            base = instanceMatrix[3].xyz;
          #endif
          vH = transformed.y;
          float hgt = mvPosition.y - base.y;
          float k = hgt * hgt * 40.0;
          float ph = base.x * 0.9 + base.z * 0.35;
          float gust = 0.6 + 0.4 * sin(uTime * 0.9 - base.x * 0.5 + base.z * 0.2);
          float flut = sin(uTime * (2.0 + 9.0 * uWind) + ph * 2.1) * 0.6 + sin(uTime * (3.1 + 13.0 * uWind) + ph * 3.7) * 0.3;
          float lean = uWind * uWind * 1.6 * gust;
          mvPosition.x += k * (0.0012 + 0.006 * uWind) * flut + hgt * lean * 0.9;
          mvPosition.y -= hgt * lean * lean * 0.28;
          mvPosition.z += k * 0.0008 * sin(uTime * 1.3 + ph);
          if (grassHole(base)) mvPosition.y -= 5.0;
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.35, 1.12, smoothstep(0.0, 0.1, vH));');
    };
    mat.customProgramCacheKey = () => 'grass';
    const spots = [];
    const free = (x, z) => {
      if (z > WD.FENCE_Z - 0.12 && z < WD.FENCE_Z + 0.08) return false;
      const Pc = WD.PORCH;
      if (x > Pc.x0 - 0.05 && x < Pc.x1 + 0.05 && z < Pc.z1 + 0.8 && z > WD.HOUSE.z - 0.1) return false;
      if (z < WD.HOUSE.z + 0.05) return false;
      const S = WD.SHED;
      if (x > S.x - S.w / 2 - 0.05 && x < S.x + S.w / 2 + 0.05 && z > S.z - S.d / 2 - 0.05 && z < S.z + S.d / 2 + 0.05) return false;
      if ((x - WD.TREE.x) ** 2 + (z - WD.TREE.z) ** 2 < 0.36 ** 2) return false;
      return true;
    };
    const fill = (x0, x1, z0, z1, perM2) => {
      const n = Math.round((x1 - x0) * (z1 - z0) * perM2);
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
        if (free(x, z)) spots.push([x, z]);
      }
    };
    fill(-5.0, 8.0, -0.9, -0.01, 560);
    fill(-6.0, 9.0, -2.4, -0.9, 230);
    fill(-7.5, 10.5, -5.0, -2.4, 70);
    fill(-8.5, 12.5, -8.55, -5.0, 34);
    fill(-9.5, 13.0, -10.55, -8.65, 18);
    const im = new THREE.InstancedMesh(g, mat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const greens = ['#4f7d2a', '#5b8b2f', '#6b9a35', '#466f29', '#76a23a', '#5e8e2e', '#8aa441', '#7d8f3a'].map(SRC);
    const c = new THREE.Color();
    spots.forEach(([x, z], i) => {
      const far = Math.min(1, -z / 8);
      const hgt = (0.06 + 0.07 * rnd()) * (1 + 0.4 * far);
      const wid = (0.014 + 0.008 * rnd()) * (1 + 1.7 * far);
      e.set((rnd() - 0.5) * 0.3, (rnd() - 0.5) * 2.4, (rnd() - 0.5) * 0.35);
      q.setFromEuler(e);
      m4.compose(v.set(x, 0, z), q, s.set(wid, hgt, wid));
      im.setMatrixAt(i, m4);
      c.copy(greens[Math.floor(rnd() * greens.length)]).multiplyScalar(0.6 + 0.35 * rnd());
      if (rnd() < 0.05) c.lerp(SRC('#9a8a4a'), 0.6);
      im.setColorAt(i, c);
    });
    im.castShadow = false;
    im.receiveShadow = true;
    im.frustumCulled = false;
    scene.add(im);
    updaters.push((t) => {
      grassU.uTime.value = t;
      grassU.uWind.value = WD.wind(t);
    });
  }

  // -------------------------------------------------------------------------
  // the fence: a low fence of weathered boards on posts and rails across the back of
  // the yard, open at the porch steps (the house and its porch stand behind it)
  // -------------------------------------------------------------------------
  // wood in the object's own space (so flying boards keep their grain), varied per instance
  const localWood = (key, hex, rough = 0.85, along = 'vec2(vLoc.y, vLoc.x + 0.25)', bw = 0.5) =>
    MAT.patch(new THREE.MeshStandardMaterial({ color: SRC(hex), roughness: rough }), {
      key, colorFn: key + 'C', bumpFn: key + 'B',
      vertex: `varying vec3 vLoc; varying float vSeed;@@vLoc = position;
        #ifdef USE_INSTANCING
          vSeed = fract(instanceMatrix[3].x * 0.731 + instanceMatrix[3].z * 0.117) * 40.0;
        #else
          vSeed = 0.0;
        #endif`,
      extraFrag: `varying vec3 vLoc; varying float vSeed;\n${MAT.GLSL_WOOD}
        vec3 ${key}C(vec3 p, vec3 n){ float h; vec2 uv = ${along}; return woodGrain(uv.x + vSeed, uv.y, ${bw.toFixed(3)}, 7.0 + floor(vSeed), h) * (0.85 + 0.25 * fbm(vec2(uv.x * 0.6 + vSeed, uv.y * 3.0) + 2.0)); }
        float ${key}B(vec3 p, vec3 n){ float h; vec2 uv = ${along}; woodGrain(uv.x + vSeed, uv.y, ${bw.toFixed(3)}, 7.0 + floor(vSeed), h); return h; }`,
    });
  const FZ = WD.FENCE_Z, FH = WD.FENCE_H, BW = 0.14;
  const boardMat = localWood('fenceB', '#6e5340', 0.85);
  const boardGeo = new THREE.BoxGeometry(BW - 0.008, FH, 0.022);
  const gate = WD.GATE;
  const boardIM = instanced(boardGeo, boardMat, 400, true);
  beginInst(boardIM);
  for (let x = -17; x < 19; x += BW) {
    if (x > gate.x - gate.w / 2 - BW && x < gate.x + gate.w / 2) continue;
    const h = FH + 0.03 * Math.sin(x * 9.1);
    setInst(boardIM, x + BW / 2, h / 2, FZ, 1, h / FH, 1, 0, 0, (rnd() - 0.5) * 0.01);
  }
  endInst(boardIM);
  {
    // posts and two rails behind the boards, two gate posts
    const pg = [];
    for (let x = -17; x < 19; x += 2.4) if (Math.abs(x - gate.x) > gate.w / 2 + 0.2) pg.push(G.box(0.1, FH + 0.12, 0.1, x, (FH + 0.12) / 2, FZ - 0.07));
    for (const x of [gate.x - gate.w / 2 - 0.07, gate.x + gate.w / 2 + 0.07]) pg.push(G.box(0.12, FH + 0.2, 0.12, x, (FH + 0.2) / 2, FZ - 0.03));
    for (const y of [0.22, FH - 0.2]) {
      pg.push(G.boxMM(-17, y - 0.04, FZ - 0.065, gate.x - gate.w / 2 - 0.05, y + 0.04, FZ - 0.02));
      pg.push(G.boxMM(gate.x + gate.w / 2 + 0.05, y - 0.04, FZ - 0.065, 19, y + 0.04, FZ - 0.02));
    }
    add(mesh(G.mergeAll(pg), MAT.woodMaterial('fenceP', '#5a4434', 'vec2(p.y, p.x + p.z)', 0.1, 0.88)), true, true);
  }

  // -------------------------------------------------------------------------
  // trees: procedural branches and leaf clusters (a canvas-painted texture of
  // leaves, alpha-tested, also in the shadows)
  // -------------------------------------------------------------------------
  const leafTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    const r2 = U.mulberry32(77);
    for (let i = 0; i < 22; i++) {
      const a = r2() * Math.PI * 2, d = 12 + r2() * 92;
      const cx = 128 + Math.cos(a) * d * 0.7, cy = 128 + Math.sin(a) * d * 0.7;
      const L = 30 + r2() * 22, Wd = L * (0.36 + r2() * 0.1);
      g.save();
      g.translate(cx, cy);
      g.rotate(a + (r2() - 0.5) * 0.8);
      const shade = 0.75 + r2() * 0.5;
      const gr = g.createLinearGradient(-L / 2, 0, L / 2, 0);
      gr.addColorStop(0, `rgb(${Math.round(70 * shade)},${Math.round(110 * shade)},${Math.round(38 * shade)})`);
      gr.addColorStop(1, `rgb(${Math.round(110 * shade)},${Math.round(150 * shade)},${Math.round(55 * shade)})`);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-L / 2, 0);
      g.quadraticCurveTo(-L * 0.1, -Wd, L / 2, 0);
      g.quadraticCurveTo(-L * 0.1, Wd, -L / 2, 0);
      g.fill();
      g.strokeStyle = `rgba(40,60,20,0.5)`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-L / 2, 0);
      g.lineTo(L / 2 - 3, 0);
      g.stroke();
      g.restore();
    }
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 4;
    return tx;
  })();
  const barkMat = P(std('#5b5047', 0.92), {
    key: 'bark', colorFn: 'barkC', bumpFn: 'barkB',
    extraFrag: `float barkF(vec3 p){ float a = atan(p.x - floor(p.x * 0.5) * 2.0, p.z); return fbm(vec2((p.x + p.z) * 18.0, p.y * 2.2)); }
      vec3 barkC(vec3 p, vec3 n){ float f = barkF(p); float fiss = smoothstep(0.55, 0.75, f); return vec3(0.82 + 0.3 * fbm(vec2((p.x - p.z) * 5.0, p.y * 7.0))) * (1.0 - 0.45 * fiss) * mix(vec3(1.0), vec3(0.85, 0.95, 0.8), smoothstep(0.6, 0.8, fbm(p.xz * 3.0 + p.y))); }
      float barkB(vec3 p, vec3 n){ return -0.012 * smoothstep(0.55, 0.75, barkF(p)) * aaF(18.0); }`,
  });
  const leafMats = [];
  function leafMat(tint) {
    const m = new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, color: tint });
    // leaves lit from behind glow a little (light through them); in the gas they curl
    // up (the cards shrink into a bowl, the edges eaten away) and turn yellow-brown
    m.userData.curl = { value: 0 };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSunV = { value: new THREE.Vector3(0, 1, 0) };
      sh.uniforms.uSunI = { value: 1 };
      sh.uniforms.uCurl = m.userData.curl;
      m.userData.sh = sh;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uCurl;')
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); transformed.xy *= 1.0 - 0.42 * uCurl; transformed.z += 0.5 * uCurl * dot(position.xy, position.xy);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunV; uniform float uSunI; uniform float uCurl;')
        .replace('#include <alphatest_fragment>', 'if (diffuseColor.a < 0.5 + 0.42 * uCurl) discard;\n diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.3, 1.05, 0.32), 0.85 * uCurl);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.35 * uSunI * max(0.0, -dot(normal, uSunV));');
    };
    m.customProgramCacheKey = () => 'leaf';
    leafMats.push(m);
    return m;
  }
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTex, alphaTest: 0.5 });
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  // grow a tree: returns a group (pivot at the foot) with a trunk and limbs (each a
  // sub-group with its branches and leaves, so limbs can sway or break on their own)
  function makeTree({ x, z, seed, height, spread, limbs, leafN, cardS, tint, breakable = [] }) {
    const r = U.mulberry32(seed);
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    const trunkTop = V3(0.12, height * 0.36, 0.0);
    const trunkG = [G.rod(V3(0, -0.2, 0), V3(0.05, height * 0.2, 0), 0.26 * spread, 0.2 * spread, 14), G.rod(V3(0.05, height * 0.2, 0), trunkTop, 0.2 * spread, 0.16 * spread, 12)];
    // root flare
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 6.283 + r();
      trunkG.push(G.rod(V3(0, 0.25, 0), V3(Math.cos(a) * 0.55 * spread, -0.05, Math.sin(a) * 0.55 * spread), 0.1 * spread, 0.03, 8));
    }
    root.add(mesh(G.mergeAll(trunkG), barkMat));
    const out = { root, limbs: [] };
    for (let li = 0; li < limbs; li++) {
      const lg = new THREE.Group();
      lg.position.copy(trunkTop);
      root.add(lg);
      const a = (li / limbs) * 6.283 + r() * 0.8;
      const dir = V3(Math.cos(a) * 0.75, 0.75 + r() * 0.35, Math.sin(a) * 0.45).normalize();
      const geos = [], leaves = [];
      const grow = (p0, d, len, rad, depth) => {
        const bendV = V3((r() - 0.5) * 0.3, 0.15, (r() - 0.5) * 0.3);
        const mid = p0.clone().addScaledVector(d, len * 0.5).addScaledVector(bendV, len * 0.15);
        const p1 = mid.clone().addScaledVector(d.clone().add(bendV.multiplyScalar(0.4)).normalize(), len * 0.5);
        geos.push(G.rod(p0, mid, rad, rad * 0.85, depth < 2 ? 9 : 6), G.rod(mid, p1, rad * 0.85, rad * 0.7, depth < 2 ? 9 : 6));
        if (depth >= 3) {
          // a cluster of leaf cards round the twig's end and along it
          for (let k = 0; k < leafN; k++) {
            const u = 0.35 + 0.65 * r();
            const c = p0.clone().lerp(p1, u).add(V3((r() - 0.5) * 1.1, (r() - 0.3) * 0.8, (r() - 0.5) * 1.1).multiplyScalar(len * 0.9 + 0.3));
            leaves.push({ c, rx: r() * 6.28, ry: r() * 6.28, rz: r() * 6.28, s: cardS * (0.7 + 0.6 * r()), sh: 0.75 + 0.4 * r() });
          }
          return;
        }
        const n = depth === 0 ? 3 : 3;
        for (let k = 0; k < n; k++) {
          const ang = (k / n) * 6.283 + r() * 1.2;
          const side = V3(Math.cos(ang), 0, Math.sin(ang));
          const nd = d.clone().multiplyScalar(0.6).addScaledVector(side, 0.65).add(V3(0, 0.28, 0)).normalize();
          const at = p0.clone().lerp(p1, 0.55 + 0.45 * r());
          grow(at, nd, len * (0.62 + 0.12 * r()), rad * 0.6, depth + 1);
        }
      };
      grow(V3(0, 0, 0), dir, height * 0.3 * (0.85 + 0.3 * r()), 0.12 * spread, 0);
      lg.add(mesh(G.mergeAll(geos), barkMat));
      const lm = leafMat(tint);
      out.mats = out.mats || [];
      out.mats.push(lm);
      const im = new THREE.InstancedMesh(leafGeo, lm, leaves.length);
      im.customDepthMaterial = leafDepth;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      const cc = new THREE.Color();
      leaves.forEach((l, i) => {
        q.setFromEuler(e.set(l.rx, l.ry, l.rz));
        m4.compose(l.c, q, V3(l.s, l.s, l.s));
        im.setMatrixAt(i, m4);
        im.setColorAt(i, cc.setRGB(l.sh, l.sh * (0.95 + 0.1 * r()), l.sh * 0.9));
      });
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      lg.add(im);
      out.limbs.push({ g: lg, base: lg.rotation.clone(), phase: r() * 6.28, breaks: breakable.includes(li), dir });
    }
    return out;
  }
  const bigTree = makeTree({ x: WD.TREE.x, z: WD.TREE.z, seed: 11, height: 8.2, spread: 1.15, limbs: 5, leafN: 26, cardS: 0.76, tint: SRC('#d8e8c8') });
  add(bigTree.root, true, true);
  const sideTree = makeTree({ x: -9.6, z: -13.2, seed: 23, height: 6.4, spread: 0.95, limbs: 4, leafN: 11, cardS: 0.95, tint: SRC('#c8d8b8') });
  add(sideTree.root, true, true);
  const farTree = makeTree({ x: 12.5, z: -14.5, seed: 31, height: 7.4, spread: 1.0, limbs: 4, leafN: 11, cardS: 0.95, tint: SRC('#c0d4b0') });
  add(farTree.root, true, true);
  const TREES = [bigTree, sideTree, farTree];
  updaters.push((t) => {
    const w = WD.wind(t);
    for (const tr of TREES) {
      const x = tr.root.position.x, z = tr.root.position.z;
      tr.root.rotation.z = -0.006 * Math.sin(t * 0.8 + x);
      tr.root.rotation.x = 0.004 * Math.sin(t * 0.6 + 1);
      for (const L of tr.limbs) {
        const s = Math.sin(t * (1.1 + 2.5 * w) + L.phase) * (0.012 + 0.06 * w) + Math.sin(t * (2.7 + 5 * w) + L.phase * 2) * (0.006 + 0.03 * w);
        L.g.rotation.set(L.base.x + s * 0.6, L.base.y, L.base.z + s);
      }
      // the leaves curl once the cloud has rolled over the tree
      const curl = WD.cloudAt(t, x, z) * smooth(prog(t, T.curl - 0.3, 1.4));
      for (const m of tr.mats) m.userData.curl.value = curl;
    }
  });

  // -------------------------------------------------------------------------
  // neighbourhood: a row of trees and roofs beyond the fence, a far tree line,
  // the meadow to the horizon
  // -------------------------------------------------------------------------
  {
    const crownMat = P(std('#56733c', 0.9), {
      key: 'farCrown', colorFn: 'fcC', bumpFn: 'fcB',
      extraFrag: `vec3 fcC(vec3 p, vec3 n){ vec4 ce = cellv(p.xy * 3.5 + p.z * 1.3); float lf = smoothstep(0.6, 0.15, ce.z);
          return vec3(0.6 + 0.45 * ce.w) * (0.55 + 0.6 * lf) * (0.8 + 0.35 * fbm(p.xz * 0.5 + p.y)); }
        float fcB(vec3 p, vec3 n){ vec4 ce = cellv(p.xy * 3.5 + p.z * 1.3); return 0.05 * smoothstep(0.6, 0.1, ce.z) * aaF(3.5); }`,
    });
    const crowns = [], trunks = [];
    for (let i = 0; i < 46; i++) {
      const x = -60 + i * 2.9 + (rnd() - 0.5) * 2.0, z = -24 - rnd() * 30;
      if (x < 2 || (x < 11 && z > -30)) continue;
      const hgt = 5 + rnd() * 6;
      const r = 1.8 + rnd() * 1.6;
      crowns.push(G.placed(G.lumpyBlob(r, 1, 0.22, 600 + i), x, hgt - r * 0.5, z, 0, rnd() * 3, 0, 1, 1.1, 1));
      crowns.push(G.placed(G.lumpyBlob(r * 0.75, 1, 0.24, 700 + i), x + r * 0.7, hgt - r * 1.0, z + 0.4));
      trunks.push(G.rod(V3(x, 0, z), V3(x, hgt - r, z), 0.18, 0.12, 6));
    }
    // far tree line on the horizon
    for (let i = 0; i < 70; i++) {
      const x = -260 + i * 7.6 + rnd() * 4, z = -150 - rnd() * 60, r = 4 + rnd() * 5;
      crowns.push(G.placed(G.lumpyBlob(r, 1, 0.25, 900 + i), x, r * 0.55, z, 0, 0, 0, 1.5, 1.0, 1));
    }
    add(mesh(G.mergeAll(crowns), crownMat, false), false, true);
    add(mesh(G.mergeAll(trunks), barkMat, false), false, true);
    // neighbours' houses: stucco boxes with red or grey hip roofs, left and right
    const wallM = P(std('#e9dcc6', 0.9), { key: 'nWall', colorFn: 'nwC', extraFrag: 'vec3 nwC(vec3 p, vec3 n){ return vec3(0.88 + 0.16 * stucco(p, n)); }' });
    const roofM = P(std('#a4492b', 0.8, { side: THREE.DoubleSide }), {
      key: 'nRoof', colorFn: 'nrC',
      extraFrag: `vec3 nrC(vec3 p, vec3 n){ float row = fract(p.y * 4.0); float col = fract(p.x * 4.5 + floor(p.y * 4.0) * 0.5);
        return vec3(0.85 + 0.25 * h21(floor(vec2(p.x * 4.5, p.y * 4.0)))) * (1.0 - 0.3 * smoothstep(0.8, 1.0, row) * aaF(4.0)) * (1.0 - 0.2 * smoothstep(0.85, 1.0, col) * aaF(4.5)); }`,
    });
    const walls = [], roofs = [];
    const hipRoof = (x0, x1, z0, z1, y0, rise, ov) => {
      const g = new THREE.BufferGeometry();
      const xa = x0 - ov, xb = x1 + ov, za = z1 + ov, zb = z0 - ov;
      const run = (za - zb) / 2, ym = y0 + rise;
      const r0 = V3(xa + run, ym, (za + zb) / 2), r1 = V3(xb - run, ym, (za + zb) / 2);
      const A = V3(xa, y0, za), B = V3(xb, y0, za), C = V3(xb, y0, zb), D = V3(xa, y0, zb);
      const tri = [A, B, r1, A, r1, r0, B, C, r1, C, D, r0, C, r0, r1, D, A, r0];
      g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((v) => [v.x, v.y, v.z]), 3));
      g.computeVertexNormals();
      return g;
    };
    for (const [x0, x1, z0, z1, hgt] of [[-19, -10, -30, -22, 6.2], [14.5, 24, -31, -23, 6.6], [-34, -25, -44, -36, 5.6], [28, 37, -46, -38, 6.0]]) {
      walls.push(G.boxMM(x0, 0, z0, x1, hgt, z1));
      roofs.push(hipRoof(x0, x1, z0, z1, hgt, 2.4, 0.4));
    }
    add(mesh(G.mergeAll(walls), wallM), true, true);
    add(mesh(G.mergeAll(roofs), roofM), true, true);
    const meadow = P(std('#ffffff', 0.95), {
      key: 'meadow', colorFn: 'mdC',
      extraFrag: `vec3 mdC(vec3 p, vec3 n){ vec3 c = s2l(vec3(0.33, 0.47, 0.2)) * (0.75 + 0.35 * fbm(p.xz * 0.3));
          return mix(c, s2l(vec3(0.55, 0.6, 0.52)), 0.7 * smoothstep(-40.0, -200.0, p.z)); }`,
    });
    add(mesh(G.placed(new THREE.PlaneGeometry(900, 600), 0, -0.004, -320, -Math.PI / 2, 0, 0), meadow), false, true);
  }

  // -------------------------------------------------------------------------
  // a corrugated-metal garden shed (left)
  // -------------------------------------------------------------------------
  const corrugated = (key, hex) => MAT.patch(new THREE.MeshStandardMaterial({ color: SRC(hex), roughness: 0.45, metalness: 0.75, side: THREE.DoubleSide }), {
    key, colorFn: key + 'C', bumpFn: key + 'B', roughFn: key + 'R', metalFn: key + 'M', vertex: 'varying vec3 vLoc;@@vLoc = position;',
    extraFrag: `varying vec3 vLoc;
      float ${key}Rust(vec3 p){ return smoothstep(0.58, 0.8, fbm(vLoc.xy * 3.0 + 4.0) * 0.7 + 0.35 * vnoise(vLoc.xy * 19.0) + 0.25 * smoothstep(0.2, -0.6, vLoc.y)); }
      vec3 ${key}C(vec3 p, vec3 n){ float r = ${key}Rust(p); return mix(vec3(0.95 + 0.12 * fbm(vLoc.xy * 6.0)), vec3(0.85, 0.42, 0.2), r); }
      float ${key}B(vec3 p, vec3 n){ return 0.009 * sin((vLoc.x + vLoc.z) * 6.2831 / 0.076) * aaF(14.0) + 0.0008 * vnoise(vLoc.xy * 50.0); }
      float ${key}R(vec3 p, vec3 n){ return mix(0.38, 0.9, ${key}Rust(p)); }
      float ${key}M(vec3 p, vec3 n){ return mix(0.85, 0.1, ${key}Rust(p)); }`,
  });
  const S = WD.SHED;
  const shedSheets = [];
  {
    const wallM = shiny(corrugated('shedW', '#a2a7aa'));
    wallM.envMap = envMap;
    const sh = new THREE.Group();
    sh.position.set(S.x, 0, S.z);
    const wg = [];
    const front = new THREE.BoxGeometry(S.w, S.h, 0.02);
    front.translate(0, S.h / 2, S.d / 2);
    const back = new THREE.BoxGeometry(S.w, S.h + 0.25, 0.02);
    back.translate(0, (S.h + 0.25) / 2, -S.d / 2);
    const left = new THREE.BoxGeometry(S.d, S.h, 0.02);
    left.rotateY(Math.PI / 2);
    left.translate(-S.w / 2, S.h / 2, 0);
    const right = left.clone();
    right.translate(S.w, 0, 0);
    wg.push(front, back, left, right);
    sh.add(mesh(G.mergeAll(wg), wallM));
    const door = mesh(G.box(0.8, 1.75, 0.03, 0.35, 0.9, S.d / 2 + 0.02), MAT.paintedSteel('shedDoor', '#5d6b55'));
    sh.add(door);
    const roofM = shiny(corrugated('shedR', '#9da3a6'));
    roofM.envMap = envMap;
    // three roof sheets, sloping back
    for (let k = 0; k < 3; k++) {
      const gsh = new THREE.Group();
      const sw = (S.w + 0.3) / 3;
      const geo = new THREE.BoxGeometry(sw - 0.01, 0.015, S.d + 0.35);
      gsh.add(mesh(geo, roofM));
      const x = -S.w / 2 - 0.15 + sw * (k + 0.5);
      gsh.position.set(x, S.h + 0.12, 0);
      gsh.rotation.x = -0.14;
      sh.add(gsh);
      shedSheets.push(gsh);
    }
    add(sh, true, true);
  }

  // -------------------------------------------------------------------------
  // the house: cream stucco, white trim, blue louvred shutters, a back door with a
  // little tiled canopy, a stone plinth, a red barrel-tile hip roof
  // -------------------------------------------------------------------------
  const ZF = H.z, ZB = H.z - H.depth, xc = (H.x0 + H.x1) / 2;
  const stuccoMat = P(std('#ece2cf', 0.92), {
    key: 'stucco', colorFn: 'stC', bumpFn: 'stB',
    extraFrag: `vec3 stC(vec3 p, vec3 n){ float s = stucco(p, n); vec3 c = vec3(0.9 + 0.14 * s);
        // faint grey streaks under the sills and the eaves
        c *= 1.0 - 0.07 * smoothstep(0.55, 0.85, fbm(vec2(p.x * 3.0, p.y * 0.4) + 3.0));
        c *= 1.0 - 0.1 * smoothstep(0.2, 0.0, p.y - 0.35);
        return c; }
      float stB(vec3 p, vec3 n){ return 0.0012 * vnoise(puv(p, n) * 60.0) * aaF(60.0) + 0.002 * fbm(puv(p, n) * 8.0); }`,
  });
  const trimMat = P(std('#f6f4ee', 0.55), { key: 'trim', colorFn: 'trC', extraFrag: 'vec3 trC(vec3 p, vec3 n){ return vec3(0.95 + 0.06 * fbm(p.xy * 6.0 + p.z)); }' });
  const shutterMat = P(std('#2f6fae', 0.6), {
    key: 'shutter', colorFn: 'shC', bumpFn: 'shB',
    extraFrag: `vec3 shC(vec3 p, vec3 n){ float f = fract(p.y / 0.055); return vec3(0.82 + 0.3 * smoothstep(0.0, 0.6, f) * aaF(18.0) + 0.15 * (1.0 - aaF(18.0))) * (0.92 + 0.12 * fbm(p.xy * 7.0)); }
      float shB(vec3 p, vec3 n){ return 0.004 * fract(p.y / 0.055) * aaF(18.0); }`,
  });
  const glassMat = shiny(P(std('#141c26', 0.08, { envMap, envMapIntensity: 1.0, metalness: 0.1 }), {
    key: 'glass', emissiveFn: 'glE',
    extraFrag: 'vec3 glE(vec3 p, vec3 n, vec3 c){ return vec3(0.02, 0.018, 0.015) * (0.6 + 0.4 * fbm(p.xy * 1.5)); }',
  }));
  const plinthMat = P(std('#b9b0a2', 0.9), {
    key: 'plinth', colorFn: 'plC', bumpFn: 'plB',
    extraFrag: `vec3 plC(vec3 p, vec3 n){ vec4 ce = cellv(vec2(p.x + p.z, p.y) * vec2(2.8, 5.0)); float m = smoothstep(0.02, 0.08, ce.z) * aaF(5.0) + (1.0 - aaF(5.0));
        return vec3(0.8 + 0.3 * ce.w) * mix(0.55, 1.0, m); }
      float plB(vec3 p, vec3 n){ vec4 ce = cellv(vec2(p.x + p.z, p.y) * vec2(2.8, 5.0)); return 0.01 * smoothstep(0.02, 0.1, ce.z) * aaF(5.0); }`,
  });
  const WINS = [];
  const UP = H.floor + H.story + 0.75, DN = H.floor + 0.85;
  for (const x of [-2.2, 0.0, 2.5, 5.0, 7.4]) WINS.push([x, UP, 1.05, 1.45]);
  for (const x of [-2.2, 3.7, 6.1]) WINS.push([x, DN, 1.05, 1.5]);
  const DOOR = { x: WD.KID.x, w: 1.0, h: 2.25 };
  {
    const facade = new THREE.Shape();
    facade.moveTo(H.x0, 0);
    facade.lineTo(H.x1, 0);
    facade.lineTo(H.x1, H.eave);
    facade.lineTo(H.x0, H.eave);
    facade.closePath();
    const rect = (x0, y0, x1, y1) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.closePath(); return p; };
    for (const [x, y, w, h] of WINS) facade.holes.push(rect(x - w / 2, y, x + w / 2, y + h));
    facade.holes.push(rect(DOOR.x - DOOR.w / 2, H.floor, DOOR.x + DOOR.w / 2, H.floor + DOOR.h));
    const fg = new THREE.ExtrudeGeometry(facade, { depth: 0.25, bevelEnabled: false });
    fg.translate(0, 0, ZF - 0.25);
    const side = [G.boxMM(H.x0, 0, ZB, H.x0 + 0.25, H.eave, ZF - 0.25), G.boxMM(H.x1 - 0.25, 0, ZB, H.x1, H.eave, ZF - 0.25)];
    add(mesh(G.mergeAll([fg, ...side]), stuccoMat), true, true);
    add(mesh(G.boxMM(H.x0 - 0.04, 0, ZB, H.x1 + 0.04, H.floor, ZF + 0.04), plinthMat), true, true);
    // dark rooms behind the glass
    add(mesh(G.boxMM(H.x0 + 0.25, H.floor, ZB + 0.3, H.x1 - 0.25, H.eave, ZF - 0.25), new THREE.MeshStandardMaterial({ color: SRC('#3a3530'), roughness: 0.95, side: THREE.BackSide })), false, false);
    const tg = [], gg = [], sg = [];
    for (const [x, y, w, h] of WINS) {
      const x0 = x - w / 2, x1 = x + w / 2, y1 = y + h;
      tg.push(G.boxMM(x0 - 0.08, y - 0.07, ZF - 0.05, x1 + 0.08, y, ZF + 0.07)); // sill
      tg.push(G.boxMM(x0 - 0.06, y1, ZF - 0.04, x1 + 0.06, y1 + 0.07, ZF + 0.03)); // head
      tg.push(G.boxMM(x0 - 0.06, y, ZF - 0.04, x0, y1, ZF + 0.03), G.boxMM(x1, y, ZF - 0.04, x1 + 0.06, y1, ZF + 0.03));
      // sashes and muntins: 2 x 3 panes per sash
      tg.push(G.boxMM(x - 0.025, y, ZF - 0.13, x + 0.025, y1, ZF - 0.08));
      for (const f of [1 / 3, 2 / 3]) tg.push(G.boxMM(x0, y + h * f - 0.015, ZF - 0.12, x1, y + h * f + 0.015, ZF - 0.09));
      for (const f of [0.25, 0.75]) tg.push(G.boxMM(x0 + w * f - 0.012, y, ZF - 0.12, x0 + w * f + 0.012, y1, ZF - 0.09));
      gg.push(G.boxMM(x0, y, ZF - 0.15, x1, y1, ZF - 0.13));
      // shutters, open against the wall
      for (const sx of [x0 - 0.06 - w * 0.5, x1 + 0.06]) sg.push(G.boxMM(sx, y - 0.02, ZF + 0.005, sx + w * 0.5, y1 + 0.02, ZF + 0.04));
    }
    // corner boards, a band between the floors, the door frame, the eave fascia
    tg.push(G.boxMM(H.x0 - 0.04, H.floor, ZF - 0.05, H.x0 + 0.14, H.eave, ZF + 0.03), G.boxMM(H.x1 - 0.14, H.floor, ZF - 0.05, H.x1 + 0.04, H.eave, ZF + 0.03));
    tg.push(G.boxMM(H.x0, H.floor + H.story - 0.06, ZF - 0.02, H.x1, H.floor + H.story + 0.06, ZF + 0.035));
    const dx0 = DOOR.x - DOOR.w / 2, dx1 = DOOR.x + DOOR.w / 2;
    tg.push(G.boxMM(dx0 - 0.09, H.floor, ZF - 0.05, dx0, H.floor + DOOR.h + 0.09, ZF + 0.05), G.boxMM(dx1, H.floor, ZF - 0.05, dx1 + 0.09, H.floor + DOOR.h + 0.09, ZF + 0.05), G.boxMM(dx0 - 0.09, H.floor + DOOR.h, ZF - 0.05, dx1 + 0.09, H.floor + DOOR.h + 0.12, ZF + 0.05));
    add(mesh(G.mergeAll(tg), trimMat), true, true);
    add(mesh(G.mergeAll(gg), glassMat), false, true);
    add(mesh(G.mergeAll(sg), shutterMat), true, true);
    // the back door (blue, with glass panes) and two steps
    const doorG = [G.boxMM(dx0, H.floor, ZF - 0.16, dx1, H.floor + DOOR.h, ZF - 0.11)];
    add(mesh(G.mergeAll(doorG), shutterMat), true, true);
    add(mesh(G.boxMM(dx0 + 0.15, H.floor + 1.2, ZF - 0.105, dx1 - 0.15, H.floor + 2.0, ZF - 0.1), glassMat), false, true);
  }
  // roof: the deck (dark felt under the tiles), white fascia, the tiles (instanced)
  const OV = 0.55;
  const ZE = ZF + OV, YE = H.eave + 0.05, ZR = ZF - H.depth / 2, YR = H.ridge;
  const slope = Math.atan2(YR - YE, ZE - ZR), SL = Math.hypot(YR - YE, ZE - ZR);
  const XA = H.x0 - OV, XB = H.x1 + OV;
  {
    const deckMat = P(std('#2f2a26', 0.95, { side: THREE.DoubleSide }), { key: 'deck', colorFn: 'dkC', extraFrag: 'vec3 dkC(vec3 p, vec3 n){ return vec3(0.8 + 0.3 * fbm(p.xz * 2.0)) * (1.0 - 0.35 * smoothstep(0.85, 1.0, fract(p.y * 3.6))); }' });
    const g = new THREE.BufferGeometry();
    const run = ZE - ZR;
    const r0 = V3(XA + run, YR, ZR), r1 = V3(XB - run, YR, ZR);
    const A = V3(XA, YE, ZE), B = V3(XB, YE, ZE), C = V3(XB, YE, ZR - run), D = V3(XA, YE, ZR - run);
    const tri = [A, B, r1, A, r1, r0, B, C, r1, C, D, r0, D, A, r0, C, r0, r1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((v) => [v.x, v.y, v.z]), 3));
    g.computeVertexNormals();
    add(mesh(g, deckMat), true, true);
    const fasc = new THREE.BoxGeometry(XB - XA, 0.2, 0.05);
    fasc.translate(xc, YE - 0.12, ZE + 0.02);
    const gut = new THREE.CylinderGeometry(0.06, 0.06, XB - XA, 10, 1, false);
    gut.rotateZ(Math.PI / 2);
    gut.translate(xc, YE - 0.08, ZE + 0.1);
    add(mesh(G.mergeAll([fasc]), trimMat), true, true);
    add(mesh(gut, shiny(std('#d9d9d4', 0.4, { metalness: 0.6, envMap }))), true, true);
    // the hips: red ridge tiles along them (static), and a chimney
    const ridgeM = std('#9b3f22', 0.7);
    add(mesh(G.mergeAll([G.rod(A, r0, 0.07, 0.07, 8), G.rod(B, r1, 0.07, 0.07, 8), G.rod(r0, r1, 0.08, 0.08, 8)]), ridgeM), true, true);
    add(mesh(G.boxMM(6.4, YR - 1.4, ZR - 0.6, 7.2, YR + 1.0, ZR + 0.2), stuccoMat), true, true);
    add(mesh(G.boxMM(6.3, YR + 1.0, ZR - 0.7, 7.3, YR + 1.12, ZR + 0.3), trimMat), true, true);
  }
  const tileMat = P(std('#ffffff', 0.72), {
    key: 'tile', colorFn: 'tlC', bumpFn: 'tlB', vertex: 'varying vec3 vLoc;@@vLoc = position;',
    extraFrag: `varying vec3 vLoc;
      vec3 tlC(vec3 p, vec3 n){ float age = fbm(p.xz * 1.2 + p.y); return vec3(0.9 + 0.15 * vnoise(vLoc.xz * 40.0)) * mix(vec3(1.0), vec3(0.75, 0.7, 0.62), smoothstep(0.55, 0.85, age)) * (0.75 + 0.25 * smoothstep(-0.2, 0.15, vLoc.z)); }
      float tlB(vec3 p, vec3 n){ return 0.0006 * vnoise(vLoc.xz * 60.0); }`,
  });
  const tileGeo = new THREE.CylinderGeometry(0.105, 0.115, 0.4, 9, 1, true, -Math.PI / 2, Math.PI);
  tileGeo.rotateX(-Math.PI / 2); // axis along z (down the slope), arch up
  const tiles = [];
  {
    const TW = 0.215, TE = 0.28;
    const rows = Math.floor(SL / TE);
    for (let k = 0; k < rows; k++) {
      const s = (k + 0.5) * TE;
      const dz = s * Math.cos(slope);
      const xl = XA + dz + 0.06, xr = XB - dz - 0.06;
      for (let x = Math.ceil((xl - XA) / TW) * TW + XA; x < xr; x += TW) {
        const y = YE + s * Math.sin(slope) + 0.06, z = ZE - dz;
        const edge = Math.min(x - xl, xr - x, (rows - k) * 0.4);
        tiles.push({ x, y, z, c: 0.78 + 0.3 * rnd(), red: rnd() });
      }
    }
  }
  const tileIM = instanced(tileGeo, tileMat, tiles.length, true);
  {
    // the tiles never move: placed once
    const c = new THREE.Color();
    const qSlope = new THREE.Quaternion().setFromEuler(new THREE.Euler(slope, 0, 0));
    beginInst(tileIM);
    tiles.forEach((tl) => {
      const k = setInstQ(tileIM, new THREE.Vector3(tl.x, tl.y, tl.z), qSlope, new THREE.Vector3(1, 1, 1));
      tileIM.setColorAt(k, c.setRGB(0.72, 0.29, 0.15).lerp(SRC('#c56a3a'), tl.red * 0.5).multiplyScalar(tl.c));
    });
    endInst(tileIM);
  }
  // -------------------------------------------------------------------------
  // the porch: a wooden deck along the back of the house, three steps down the middle
  // through the gap in the fence, white railings at the sides; three empty bean cans
  // -------------------------------------------------------------------------
  {
    const Pc = WD.PORCH;
    // boards run along x on the deck and across the risers and sides
    const deckWood = MAT.woodMaterial('deckW', '#9a7652', 'abs(n.y) > 0.5 ? vec2(p.x * 0.6, p.z * 5.5) : (abs(n.z) > 0.5 ? vec2(p.x * 0.6, p.y * 6.5) : vec2(p.z * 0.6, p.y * 6.5))', 0.14, 0.75);
    const dg = [];
    for (let z = Pc.z0 + 0.02; z < Pc.z1 - 0.01; z += 0.14) dg.push(G.boxMM(Pc.x0, Pc.y - 0.035, z, Pc.x1, Pc.y, Math.min(z + 0.13, Pc.z1)));
    // the skirt boards and the posts under the deck
    dg.push(G.boxMM(Pc.x0, 0, Pc.z1 - 0.04, Pc.sx0, Pc.y - 0.035, Pc.z1 - 0.01), G.boxMM(Pc.sx1, 0, Pc.z1 - 0.04, Pc.x1, Pc.y - 0.035, Pc.z1 - 0.01));
    dg.push(G.boxMM(Pc.x0, 0, Pc.z0, Pc.x0 + 0.03, Pc.y - 0.035, Pc.z1), G.boxMM(Pc.x1 - 0.03, 0, Pc.z0, Pc.x1, Pc.y - 0.035, Pc.z1));
    // three steps
    const rise = Pc.y / 3;
    for (let k = 0; k < 2; k++) {
      const top = Pc.y - (k + 1) * rise;
      dg.push(G.boxMM(Pc.sx0, 0, Pc.z1 + k * 0.26, Pc.sx1, top, Pc.z1 + (k + 1) * 0.26));
    }
    add(mesh(G.mergeAll(dg), deckWood), true, true);
    const rail = std('#f1efe8', 0.55);
    const rg = [];
    for (const [xa, xb] of [[Pc.x0 + 0.05, Pc.sx0 - 0.05], [Pc.sx1 + 0.05, Pc.x1 - 0.05]]) {
      // posts at the ends, a top rail, balusters
      for (const x of [xa, xb]) rg.push(G.box(0.08, 0.95, 0.08, x, Pc.y + 0.475, Pc.z1 - 0.06));
      rg.push(G.boxMM(xa, Pc.y + 0.86, Pc.z1 - 0.1, xb, Pc.y + 0.92, Pc.z1 - 0.02));
      rg.push(G.boxMM(xa, Pc.y + 0.08, Pc.z1 - 0.09, xb, Pc.y + 0.12, Pc.z1 - 0.03));
      for (let x = xa + 0.12; x < xb - 0.06; x += 0.12) rg.push(G.box(0.03, 0.74, 0.03, x, Pc.y + 0.49, Pc.z1 - 0.06));
    }
    add(mesh(G.mergeAll(rg), rail), true, true);
  }
  // an empty can of beans: steel with rolled rims, a paper label, the lid bent up on its hinge
  const beanLabel = (() => {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 160;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 160);
    gr.addColorStop(0, '#d9481f');
    gr.addColorStop(1, '#b8360f');
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#f6e7c1';
    g.fillRect(0, 18, 512, 6);
    g.fillRect(0, 136, 512, 6);
    for (const x0 of [0, 256]) {
      g.fillStyle = '#ffffff';
      g.font = 'bold 54px sans-serif';
      g.textAlign = 'center';
      g.fillText('BEANS', x0 + 128, 98);
      // a few baked beans in tomato sauce
      for (let k = 0; k < 5; k++) {
        g.fillStyle = '#7a2a12';
        g.beginPath();
        g.ellipse(x0 + 70 + k * 29, 122, 12, 7, (k % 2 ? 0.4 : -0.3), 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e8a35c';
        g.beginPath();
        g.ellipse(x0 + 70 + k * 29, 120, 8, 4, (k % 2 ? 0.4 : -0.3), 0, Math.PI * 2);
        g.fill();
      }
    }
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 4;
    return tx;
  })();
  ctx.makeBeanCan = () => {
    const can = new THREE.Group();
    const r = 0.037, h = 0.11;
    const steel = shiny(std('#c9cdd0', 0.32, { metalness: 0.9, envMap }));
    can.add(mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, true).translate(0, h / 2, 0), new THREE.MeshStandardMaterial({ map: beanLabel, roughness: 0.6 })));
    can.add(mesh(new THREE.CylinderGeometry(r * 0.985, r * 0.985, h * 0.995, 24, 1, true).translate(0, h / 2, 0), new THREE.MeshStandardMaterial({ color: SRC('#8d9296'), roughness: 0.4, metalness: 0.85, side: THREE.BackSide })));
    can.add(mesh(new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2).translate(0, 0.004, 0), steel));
    for (const y of [0.002, h]) can.add(mesh(new THREE.TorusGeometry(r, 0.0025, 6, 24).rotateX(Math.PI / 2).translate(0, y, 0), steel));
    // the lid, hinging up on one side
    const lid = mesh(new THREE.CircleGeometry(r * 0.95, 24).rotateX(-Math.PI / 2).translate(r * 0.95, 0, 0), new THREE.MeshStandardMaterial({ color: SRC('#c9cdd0'), roughness: 0.3, metalness: 0.9, side: THREE.DoubleSide, envMap }));
    const hinge = new THREE.Group();
    hinge.position.set(-r * 0.95, h, 0);
    hinge.rotation.z = 1.9;
    hinge.add(lid);
    can.add(hinge);
    return can;
  };
  {
    const Pc = WD.PORCH;
    for (const [x, z, ry, tip] of [[WD.KID.x + 0.62, Pc.z1 - 0.32, 0.6, 0], [WD.KID.x + 0.82, Pc.z1 - 0.5, 2.2, 1]]) {
      const c = ctx.makeBeanCan();
      c.position.set(x, Pc.y, z);
      c.rotation.set(tip ? Math.PI / 2 : 0, ry, 0);
      if (tip) c.position.y += 0.037;
      add(c, true, true);
    }
  }

  // -------------------------------------------------------------------------
  // flower beds along the fence and by the shed: tulips that droop and fade when
  // the cloud rolls over them
  // -------------------------------------------------------------------------
  const FLOWERS = [];
  {
    const stemM = std('#4d7a2c', 0.7);
    const leafM = new THREE.MeshStandardMaterial({ color: SRC('#4f8a31'), roughness: 0.65, side: THREE.DoubleSide });
    const cols = ['#d8202e', '#f2c21b', '#f06a9a', '#f07a1e', '#b23fb0', '#e8e4dc'];
    // a tulip cup: six petals round a lathe
    const cup = new THREE.LatheGeometry([0, 0.012, 0.024, 0.03, 0.031, 0.027, 0.02].map((r, i) => new THREE.Vector2(r, i * 0.011)), 12);
    const soilBed = P(std('#3a2a1c', 0.95), { key: 'bed', colorFn: 'bdC', extraFrag: 'vec3 bdC(vec3 p, vec3 n){ return vec3(0.7 + 0.5 * fbm(p.xz * 9.0)) * (0.85 + 0.3 * vnoise(p.xz * 60.0)); }' });
    for (const [x0, x1, z] of [[-6.4, WD.GATE.x - WD.GATE.w / 2 - 0.3, -8.25], [WD.GATE.x + WD.GATE.w / 2 + 0.3, 5.3, -8.25], [7.2, 9.6, -8.25], [-6.6, -3.7, -5.35]]) {
      add(mesh(G.boxMM(x0 - 0.15, -0.02, z - 0.28, x1 + 0.15, 0.025, z + 0.28), soilBed, false), false, true);
      for (let x = x0; x < x1; x += 0.24 + 0.12 * rnd()) {
        const fz = z + (rnd() - 0.5) * 0.36;
        const h = 0.36 + 0.22 * rnd();
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.02, fz);
        const lean = (rnd() - 0.5) * 0.12;
        pivot.rotation.set(lean, rnd() * 6, (rnd() - 0.5) * 0.12);
        pivot.add(mesh(G.rod(V3(0, 0, 0), V3(0, h, 0), 0.0055, 0.0045, 5), stemM, true, true));
        for (const sd of [-1, 1]) {
          const lf = new THREE.PlaneGeometry(0.035, 0.22);
          lf.translate(0, 0.11, 0);
          lf.rotateZ(sd * 0.35);
          lf.rotateY(rnd() * 2);
          pivot.add(mesh(lf, leafM, true, true));
        }
        const headPivot = new THREE.Group();
        headPivot.position.set(0, h, 0);
        const hm = new THREE.MeshStandardMaterial({ color: SRC(cols[Math.floor(rnd() * cols.length)]), roughness: 0.55, side: THREE.DoubleSide });
        const head = mesh(cup, hm, true, true);
        head.position.y = -0.004;
        headPivot.add(head);
        pivot.add(headPivot);
        add(pivot, true, true);
        FLOWERS.push({ pivot, headPivot, hm, base: hm.color.clone(), x, z: fz, lean, dir: rnd() < 0.5 ? -1 : 1, delay: rnd() * 0.5 });
      }
    }
  }
  const DEAD = SRC('#6b5a3a');
  updaters.push((t) => {
    for (const f of FLOWERS) {
      const k = WD.cloudAt(t, f.x, f.z) * smooth(prog(t, T.droop - 0.2 + f.delay, 0.9));
      f.pivot.rotation.x = f.lean + 0.95 * k * f.dir * 0.4;
      f.pivot.rotation.z = 0.9 * k * f.dir;
      f.headPivot.rotation.z = 1.6 * k * f.dir;
      f.hm.color.copy(f.base).lerp(DEAD, 0.55 * k);
      // a little sway in the breeze
      f.pivot.rotation.z += 0.03 * Math.sin(t * 1.7 + f.x * 3);
    }
  });

  // -------------------------------------------------------------------------
  // a little bird in the big tree: it bobs about, then flaps away fast as the cloud comes
  // -------------------------------------------------------------------------
  {
    const bird = new THREE.Group();
    const bodyM = std('#7a5a3c', 0.8), bellyM = std('#d9c4a2', 0.85), beakM = std('#e0a020', 0.5), eyeM = std('#111111', 0.3);
    bird.add(mesh(new THREE.SphereGeometry(0.06, 12, 8).scale(1.35, 0.9, 0.95), bodyM));
    bird.add(mesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1.1, 0.8, 0.9).translate(0.015, -0.02, 0), bellyM));
    const head = new THREE.Group();
    head.position.set(0.07, 0.04, 0);
    head.add(mesh(new THREE.SphereGeometry(0.038, 12, 8), bodyM));
    head.add(mesh(new THREE.ConeGeometry(0.012, 0.035, 8).rotateZ(-Math.PI / 2).translate(0.045, -0.005, 0), beakM));
    for (const sd of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.007, 6, 6).translate(0.022, 0.012, sd * 0.03), eyeM));
    bird.add(head);
    bird.add(mesh(new THREE.BoxGeometry(0.09, 0.008, 0.045).translate(-0.1, 0.01, 0), bodyM));
    const wings = [-1, 1].map((sd) => {
      const w = new THREE.Group();
      w.position.set(0.0, 0.03, sd * 0.045);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0.04, 0, 0, -0.05, 0, 0, -0.03, 0, sd * 0.14, 0.03, 0, sd * 0.11], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      w.add(mesh(g, new THREE.MeshStandardMaterial({ color: SRC('#5e4430'), roughness: 0.8, side: THREE.DoubleSide })));
      bird.add(w);
      return { w, sd };
    });
    bird.scale.setScalar(1.6);
    add(bird, true, true);
    const PERCH = V3(WD.TREE.x - 1.1, 4.7, WD.TREE.z + 0.9);
    updaters.push((t) => {
      const u = t - T.bird;
      if (u < 0) {
        bird.position.copy(PERCH);
        bird.rotation.set(0, 0.4 + 0.5 * Math.round(Math.sin(t * 0.9)), 0);
        head.rotation.z = 0.25 * Math.max(0, Math.sin(t * 5.3)) * (Math.sin(t * 0.7) > 0 ? 1 : 0);
        for (const { w, sd } of wings) w.rotation.x = -sd * 0.1;
        bird.visible = true;
        return;
      }
      // a startled jump, then up and away to the right, flapping hard
      bird.visible = u < 3.0;
      bird.position.set(PERCH.x + u * u * 2.2 + u * 1.5, PERCH.y + u * 2.4 + 0.3 * Math.sin(u * 9), PERCH.z + u * 0.8);
      bird.rotation.set(0, -0.3, 0.35);
      const flap = Math.sin(u * 2 * Math.PI * 11);
      for (const { w, sd } of wings) w.rotation.x = -sd * (0.2 + 1.0 * flap);
    });
  }

  // leaves lit from behind: keep the sun direction in view space current
  updaters.push(() => {
    const sv = ctx.SUN_DIR.clone().transformDirection(ctx.camera.matrixWorldInverse);
    for (const m of leafMats) if (m.userData.sh) m.userData.sh.uniforms.uSunV.value.copy(sv);
  });

  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}
