// The yard: wind-blown grass, the dark wooden privacy fence with a gate, a big
// tree (procedural branches and leaf clusters, limbs that sway and break), the
// neighbours' trees and roofs, a corrugated-metal garden shed, a garden chair,
// and the two-storey cream house with blue shutters and a red barrel-tile roof
// whose tiles peel off when the tornado passes.
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
  // the storm's wind, left to right (the tornado passes from the left)
  const gustAt = (t, x) => WD.wind(t) * (0.75 + 0.25 * Math.sin(t * 1.7 + x * 0.3) + 0.15 * Math.sin(t * 4.3 + x));

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
    const sx0 = WD.STAIR.x0.toFixed(2), szb = (WD.STAIR.zb - WD.WALL).toFixed(2);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime, uWind; uniform vec4 uPit; uniform float uFill;
          varying float vH;
          bool grassHole(vec3 b){
            bool inPit = uPit.z > 0.002 && b.x > uPit.x - 0.03 && b.x < uPit.y + 0.03 && b.z > uPit.w - 0.03 && b.z < 0.03;
            if (!inPit) return false;
            bool refilled = uFill > 0.0 && b.x > ${sx0} && b.z < ${szb} && b.z < uPit.w + 1.2 * uFill - 0.05;
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
    fill(-7.5, 10.5, -5.0, -2.4, 60);
    fill(-8.5, 12.5, -8.95, -5.0, 26);
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
  // the fence: dark weathered boards on posts and rails, a gate on the right;
  // boards rip off and fly when the tornado passes
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
  const FZ = WD.FENCE_Z, FH = 1.95, BW = 0.14;
  const boardMat = localWood('fenceB', '#6e5340', 0.85);
  const boardGeo = new THREE.BoxGeometry(BW - 0.008, FH, 0.022);
  const gate = WD.GATE;
  const boards = [];
  for (let x = -17; x < 19; x += BW) {
    if (x > gate.x - gate.w / 2 - 0.02 && x < gate.x + gate.w / 2) continue;
    boards.push({ x, h: FH + 0.03 * Math.sin(x * 9.1), tilt: (rnd() - 0.5) * 0.01, fly: 0, seed: rnd() });
  }
  // the boards the tornado takes: a scatter round the middle; a few land on the lawn
  const FLY = [];
  boards.forEach((b, i) => {
    const near = Math.abs(b.x - 1.5) < 9;
    if (near && rnd() < 0.2) {
      b.fly = 1;
      b.t0 = T.hitT + 0.9 + rnd() * 4.6;
      b.land = rnd() < 0.18 ? { x: b.x + 2 + rnd() * 3, z: -2.6 - rnd() * 4.5, ry: rnd() * 3 } : null;
      FLY.push(b);
    }
  });
  const boardIM = instanced(boardGeo, boardMat, boards.length, true);
  const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1);
  function boardPose(b, t) {
    // standing (rattling in the wind), torn off, tumbling away to the right
    const w = WD.wind(t);
    const rattle = w * w * 0.04 * Math.sin(t * 23 + b.seed * 40);
    if (!b.fly || t < b.t0) return { x: b.x, y: b.h / 2, z: FZ, rx: rattle, ry: 0, rz: b.tilt };
    const u = t - b.t0;
    if (b.land) {
      const k = clamp(u / 1.6);
      const e = easeOutCubic(k);
      const y = lerp(b.h / 2, 0.02, e) + Math.sin(k * Math.PI) * 2.4;
      return { x: lerp(b.x, b.land.x, e), y, z: lerp(FZ, b.land.z, e), rx: k < 1 ? u * 9 : Math.PI / 2, ry: b.land.ry * e, rz: k < 1 ? u * 5 : 0 };
    }
    return { x: b.x + u * u * 9 + u * 6, y: b.h / 2 + u * 7 - u * u * 1.2, z: FZ + u * 3.5 + Math.sin(u * 3 + b.seed) * 2, rx: u * 11 * (0.6 + b.seed), ry: u * 4, rz: u * 7 };
  }
  updaters.push((t) => {
    beginInst(boardIM);
    for (const b of boards) {
      const p = boardPose(b, t);
      if (p.x > 40) continue;
      setInst(boardIM, p.x + BW / 2, p.y, p.z, 1, b.h / FH, 1, p.rx, p.ry, p.rz);
    }
    endInst(boardIM);
  });
  {
    // posts and two rails behind the boards
    const pg = [];
    for (let x = -17; x < 19; x += 2.4) pg.push(G.box(0.1, FH + 0.12, 0.1, x, (FH + 0.12) / 2, FZ - 0.07));
    for (const y of [0.3, 1.6]) {
      pg.push(G.boxMM(-17, y - 0.045, FZ - 0.065, gate.x - gate.w / 2 - 0.05, y + 0.045, FZ - 0.02));
      pg.push(G.boxMM(gate.x + gate.w / 2 + 0.05, y - 0.045, FZ - 0.065, 19, y + 0.045, FZ - 0.02));
    }
    add(mesh(G.mergeAll(pg), MAT.woodMaterial('fenceP', '#5a4434', 'vec2(p.y, p.x + p.z)', 0.1, 0.88)), true, true);
  }
  // the gate: boards on a Z brace, hinged on its right post; the family comes through it
  const gateG = new THREE.Group();
  {
    const gg = [];
    for (let k = 0; k < 8; k++) gg.push(G.box(BW - 0.008, FH - 0.05, 0.022, -(k + 0.5) * BW, (FH - 0.05) / 2 + 0.03, 0));
    gg.push(G.box(gate.w - 0.04, 0.09, 0.03, -gate.w / 2, 0.35, -0.03), G.box(gate.w - 0.04, 0.09, 0.03, -gate.w / 2, 1.55, -0.03));
    const br = new THREE.BoxGeometry(1.35, 0.08, 0.03);
    br.rotateZ(Math.atan2(1.2, gate.w - 0.1));
    br.translate(-gate.w / 2, 0.95, -0.03);
    gg.push(br);
    gateG.add(mesh(G.mergeAll(gg), localWood('gateB', '#6e5340', 0.85, 'vec2(vLoc.y, vLoc.x)', 0.14)));
    const latch = mesh(G.box(0.12, 0.03, 0.03, -gate.w + 0.1, 1.05, 0.03), std('#2a2a2a', 0.5, { metalness: 0.8 }));
    gateG.add(latch);
    gateG.position.set(gate.x + gate.w / 2, 0, FZ);
    add(gateG, true, true);
  }
  updaters.push((t) => {
    const open = smooth(prog(t, T.run0 - 0.3, 0.45));
    const bang = WD.engulf(t) * (0.5 + 0.5 * Math.sin(t * 7.3));
    const after = smooth(prog(t, T.hitT, 1.0));
    gateG.rotation.y = -open * lerp(1.75, 1.2 + 0.6 * bang, after);
  });

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
    // leaves lit from behind glow a little (light through them)
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSunV = { value: new THREE.Vector3(0, 1, 0) };
      sh.uniforms.uSunI = { value: 1 };
      m.userData.sh = sh;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunV; uniform float uSunI;')
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
  const bigTree = makeTree({ x: WD.TREE.x, z: WD.TREE.z, seed: 11, height: 8.2, spread: 1.15, limbs: 5, leafN: 26, cardS: 0.76, tint: SRC('#d8e8c8'), breakable: [1, 3] });
  add(bigTree.root, true, true);
  const sideTree = makeTree({ x: -9.6, z: -13.2, seed: 23, height: 6.4, spread: 0.95, limbs: 4, leafN: 11, cardS: 0.95, tint: SRC('#c8d8b8') });
  add(sideTree.root, true, true);
  const farTree = makeTree({ x: 12.5, z: -14.5, seed: 31, height: 7.4, spread: 1.0, limbs: 4, leafN: 11, cardS: 0.95, tint: SRC('#c0d4b0') });
  add(farTree.root, true, true);
  const TREES = [bigTree, sideTree, farTree];
  updaters.push((t) => {
    const w = WD.wind(t);
    for (const tr of TREES) {
      const g = gustAt(t, tr.root.position.x);
      tr.root.rotation.z = -0.006 * Math.sin(t * 0.8) - 0.09 * g * g;
      tr.root.rotation.x = 0.004 * Math.sin(t * 0.6 + 1);
      for (const L of tr.limbs) {
        const s = Math.sin(t * (1.1 + 2.5 * w) + L.phase) * (0.012 + 0.06 * w) + Math.sin(t * (2.7 + 5 * w) + L.phase * 2) * (0.006 + 0.03 * w);
        L.g.rotation.set(L.base.x + s * 0.6, L.base.y, L.base.z + s - 0.12 * g * g * (0.5 + 0.5 * Math.sign(L.dir.x)));
        if (L.breaks) {
          // torn off: tumbles away to the right, out of the picture
          const tb = T.hitT + (L === tr.limbs[1] ? 1.6 : 3.4);
          const u = t - tb;
          L.g.visible = u < 3.0;
          if (u > 0) {
            L.g.position.set(0.12 + u * u * 7 + u * 5, tr.root.position.y + 8.2 * 0.36 + u * 3.5 - u * u * 0.8, u * 2.5);
            L.g.rotation.set(L.base.x + u * 2.2, u * 1.4, L.base.z - u * 3.1);
          } else L.g.position.set(0.12, 8.2 * 0.36, 0);
        }
      }
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
  // a corrugated-metal garden shed (left); its roof sheets tear off in the storm
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
      gsh.userData = { x, y: S.h + 0.12, z: 0, rx: -0.14, k, t0: T.hitT + 0.4 + k * 0.9 };
      gsh.position.set(x, S.h + 0.12, 0);
      gsh.rotation.x = -0.14;
      sh.add(gsh);
      shedSheets.push(gsh);
    }
    add(sh, true, true);
  }
  updaters.push((t) => {
    for (const g of shedSheets) {
      const d = g.userData;
      const u = t - d.t0;
      const flap = WD.wind(t) * WD.wind(t) * 0.12 * Math.max(0, Math.sin(t * 9 + d.k * 2));
      if (u < 0) {
        g.position.set(d.x, d.y + flap * 0.2, d.z);
        g.rotation.set(d.rx - flap, 0, 0);
        g.visible = true;
      } else {
        g.visible = u < 3.5;
        g.position.set(d.x + u * u * 8 + u * 3, d.y + u * 6 - u * u * 0.5, d.z + u * 2);
        g.rotation.set(d.rx - u * 4, u * 1.5, -u * 3);
      }
    }
  });

  // -------------------------------------------------------------------------
  // a plastic garden chair by the shed: the wind lifts it and tumbles it away (scene 5)
  // -------------------------------------------------------------------------
  const chair = new THREE.Group();
  {
    const m = std('#e9ebe6', 0.45);
    const cg = [];
    cg.push(new RoundedBoxGeometryish(0.46, 0.04, 0.44, 0, 0.44, 0));
    cg.push(G.placed(new THREE.BoxGeometry(0.46, 0.5, 0.035), 0, 0.72, -0.21, -0.18, 0, 0));
    for (const [x, z] of [[-0.2, 0.18], [0.2, 0.18], [-0.2, -0.18], [0.2, -0.18]]) cg.push(G.rod(V3(x, 0.44, z), V3(x * 1.12, 0, z * 1.15), 0.02, 0.018, 8));
    for (const s of [-1, 1]) cg.push(G.box(0.04, 0.03, 0.4, s * 0.23, 0.64, 0));
    chair.add(mesh(G.mergeAll(cg), m));
    add(chair, true, true);
  }
  const CHAIR0 = V3(-2.6, 0, -3.6);
  updaters.push((t) => {
    const u = t - T.lift0;
    if (u < 0) {
      chair.position.copy(CHAIR0);
      chair.rotation.set(0, 0.5, 0.02 * WD.wind(t) * Math.sin(t * 13));
      chair.visible = true;
      return;
    }
    // a hop, then up and away to the right, tumbling
    chair.visible = u < 4;
    chair.position.set(CHAIR0.x + u * u * 2.6 + u * 0.8, Math.max(0, u * 3.2 - u * u * 0.35 + Math.sin(u * 3) * 0.3), CHAIR0.z + u * 0.6);
    chair.rotation.set(u * 2.5, 0.5 + u * 1.3, -u * 3.4);
  });

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
  for (const x of [-1.2, 1.2, 3.6, 6.0, 8.4]) WINS.push([x, UP, 1.05, 1.45]);
  for (const x of [-1.2, 3.6, 6.0, 8.4]) WINS.push([x, DN, 1.05, 1.5]);
  const DOOR = { x: 1.2, w: 1.0, h: 2.25 };
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
    add(mesh(G.mergeAll([G.boxMM(dx0 - 0.3, 0, ZF, dx1 + 0.3, H.floor * 0.5, ZF + 0.6), G.boxMM(dx0 - 0.3, H.floor * 0.5, ZF, dx1 + 0.3, H.floor, ZF + 0.3)]), plinthMat), true, true);
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
        const fly = rnd() < (edge < 0.8 ? 0.75 : 0.42) && x > -1.5 && x < 9.5;
        tiles.push({ x, y, z, c: 0.78 + 0.3 * rnd(), red: rnd(), fly, t0: T.tiles0 + rnd() * 5.2 + (rows - k) * 0.02, seed: rnd() });
      }
    }
  }
  const tileIM = instanced(tileGeo, tileMat, tiles.length, true);
  {
    const c = new THREE.Color();
    tiles.forEach((tl, i) => {
      c.setRGB(0.72, 0.29, 0.15).lerp(SRC('#c56a3a'), tl.red * 0.5).multiplyScalar(tl.c);
      tileIM.setColorAt(i, c);
    });
  }
  const qSlope = new THREE.Quaternion().setFromEuler(new THREE.Euler(slope, 0, 0));
  const tq = new THREE.Quaternion(), tv = new THREE.Vector3(), ts = new THREE.Vector3(1, 1, 1), te = new THREE.Euler();
  updaters.push((t) => {
    beginInst(tileIM);
    tiles.forEach((tl, i) => {
      if (tl.fly && t > tl.t0) {
        const u = t - tl.t0;
        if (u > 3.2) return;
        // lifts at its lower edge, then the wind takes it up and away to the right
        tv.set(tl.x + u * u * 9 + u * 2.5 + Math.sin(u * 4 + tl.seed * 9) * 0.5, tl.y + u * 4.5 - u * u * 0.4, tl.z + u * 1.5);
        tq.setFromEuler(te.set(slope - u * (5 + 4 * tl.seed), u * 3 * tl.seed, -u * 6 * (tl.seed - 0.3)));
      } else {
        const rattle = tl.fly ? WD.engulf(t) * 0.04 * Math.sin(t * 31 + tl.seed * 50) : 0;
        tv.set(tl.x, tl.y, tl.z);
        tq.copy(qSlope);
        if (rattle) tq.multiply(new THREE.Quaternion().setFromEuler(te.set(rattle, 0, 0)));
      }
      const k = setInstQ(tileIM, tv, tq, ts);
      if (k >= 0) {
        // keep each tile's own colour on whatever slot it lands in
        tileIM.setColorAt(k, new THREE.Color().setRGB(0.72, 0.29, 0.15).lerp(SRC('#c56a3a'), tl.red * 0.5).multiplyScalar(tl.c));
      }
    });
    endInst(tileIM);
  });

  // leaves lit from behind: keep the sun direction in view space current
  updaters.push((t) => {
    const sv = ctx.SUN_DIR.clone().transformDirection(ctx.camera.matrixWorldInverse);
    for (const m of leafMats) if (m.userData.sh) { m.userData.sh.uniforms.uSunV.value.copy(sv); m.userData.sh.uniforms.uSunI.value = 1 - 0.85 * WD.storm(t); }
  });

  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}

// a rounded slab for the chair seat (keeps the chair from looking like a box)
function RoundedBoxGeometryish(w, h, d, x, y, z) {
  const s = new THREE.Shape();
  const r = 0.06;
  s.moveTo(-w / 2 + r, -d / 2);
  s.lineTo(w / 2 - r, -d / 2);
  s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
  s.lineTo(w / 2, d / 2 - r);
  s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
  s.lineTo(-w / 2 + r, d / 2);
  s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
  s.lineTo(-w / 2, -d / 2 + r);
  s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.translate(x, y + h / 2, z);
  return g;
}
