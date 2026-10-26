// S1 / LOOP — the desert hook: a giant stone 7 hangs, drops and slams into the sand. Cracks race
// across its face and the ground, a dust shockwave rolls out, rocks fly, sheep scatter, palms whip
// back from the blast and sway home (follow-through). The loop pre-roll lifts it back into the hang.
import * as THREE from 'three';
import { makeTerrain, makeMountains, makePalm, makeRock, makeGrass, srgb, mixc, stoneTex } from '../kit.js';
import { makeSprites, puffTex, cloudTex } from '../fx.js';
import { matte } from '../materials.js';
import { makeAnimal } from '../animals.js';
import { fbm, hash01, mulberry32, clamp, smooth, invLerp, easeOut, lerp, noise2 } from '../../lib/util.js';

export const SEVEN = [[-0.9, 0], [0.75, 0], [2.75, 6.75], [2.75, 8.0], [-2.55, 8.0], [-2.55, 6.55], [1.0, 6.55]];
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

// the stone 7 (beveled, faceted, per-face tint) — also used by the cover renderer
export function makeStoneSeven() {
  const shape = new THREE.Shape(); shape.moveTo(...SEVEN[0]); for (const p of SEVEN.slice(1)) shape.lineTo(...p); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.17, bevelSegments: 2, curveSegments: 1 });
  geo.translate(-0.1, 0.17, -0.8);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) { const k = 0.9 + 0.16 * hash01(i / 3, 77); for (let j = 0; j < 3; j++) { col[(i + j) * 3] = k; col[(i + j) * 3 + 1] = k * 0.98; col[(i + j) * 3 + 2] = k * 0.95; } }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const map = stoneTex().clone(); map.needsUpdate = true; map.repeat.set(0.32, 0.32);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#d4ad80', map, vertexColors: true, flatShading: true }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// crack ribbons revealed by a time uniform (each vertex knows when the crack front reaches it)
function crackMesh(paths, uS, { width = [0.075, 0.016], plane = 'xy', z = 0, color = '#2a190f', speed = 26 } = {}) {
  const pos = [], rev = [], idx = [];
  for (const P of paths) {
    let L = 0; const acc = [0]; for (let i = 1; i < P.pts.length; i++) { L += Math.hypot(P.pts[i][0] - P.pts[i - 1][0], P.pts[i][1] - P.pts[i - 1][1]); acc.push(L); }
    const base = pos.length / 3;
    for (let i = 0; i < P.pts.length; i++) {
      const a = P.pts[Math.max(0, i - 1)], b = P.pts[Math.min(P.pts.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = lerp(width[0], width[1], acc[i] / (L || 1)) * (P.scale || 1) * (0.7 + 0.6 * hash01(i, P.seed || 1));
      const [x, y] = P.pts[i];
      for (const s of [1, -1]) {
        const px = x - ty * w / 2 * s, py = y + tx * w / 2 * s;
        if (plane === 'xy') pos.push(px, py, z); else pos.push(px, z, py);
        rev.push(P.t0 + acc[i] / speed);
      }
      if (i < P.pts.length - 1) { const v = base + i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('tRev', new THREE.Float32BufferAttribute(rev, 1)); geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uS = uS;
    sh.vertexShader = 'attribute float tRev; varying float vRev;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRev = tRev;');
    sh.fragmentShader = 'uniform float uS; varying float vRev;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (vRev > uS) discard;');
  };
  mat.customProgramCacheKey = () => 'crack';
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 1; return m;
}
function walkCracks(starts, seed, inside, { steps = 13, step = [0.22, 0.32], turn = 0.85, branch = 0.2 } = {}) {
  const R = mulberry32(seed); const out = [];
  const walk = (x, y, a, t0, gen, scale) => {
    const pts = [[x, y]];
    for (let i = 0; i < steps - gen * 4; i++) {
      a += (R() - 0.5) * turn; const st = lerp(step[0], step[1], R());
      const nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
      if (!inside(nx, ny)) break;
      x = nx; y = ny; pts.push([x, y]);
      if (gen < 2 && R() < branch) walk(x, y, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), t0 + 0.03 + i * 0.012, gen + 1, scale * 0.6);
    }
    if (pts.length > 1) out.push({ pts, t0, scale, seed: out.length + 3 });
  };
  for (const [x, y, a, t0 = 0] of starts) walk(x, y, a, t0, 0, 1);
  return out;
}

export function buildDesert(ctx) {
  const { plan, B } = ctx; const E = plan.ev;
  const g = new THREE.Group();
  const height = (x, z) => {
    const r = Math.hypot(x, z);
    const open = smooth(invLerp(9, 32, r));
    let h = 0.16 * fbm(x * 0.09, z * 0.09, 3, 4);
    const dune = fbm(x * 0.011 + 3.3, z * 0.017, 4, 7);
    h += open * (5.0 * Math.max(0, dune) + 1.4 * dune + 0.6 * Math.sin(x * 0.045 + dune * 3));
    h += smooth(invLerp(110, 250, r)) * 16 * (0.6 + 0.4 * fbm(x * 0.01, z * 0.01, 2, 9));
    return h;
  };
  const sA = srgb('#d8ad74'), sB = srgb('#b9895a'), sC = srgb('#ecc690'), sD = srgb('#a77a4e');
  const terrain = makeTerrain({
    size: 640, seg: 190, height,
    color: (x, z, y) => {
      const n = fbm(x * 0.07, z * 0.07, 3, 12);
      const k = clamp(0.45 + y * 0.07 + n * 0.4);
      let c = mixc(mixc(sB, sA, smooth(k)), sC, smooth((k - 0.62) * 2.4));
      return mixc(c, sD, smooth(invLerp(0.12, 0.5, -n)) * 0.5);
    },
  });
  g.add(terrain);
  g.add(makeMountains({ seed: 4, n: 22, r0: 230, r1: 340, h0: 7, h1: 19, color: '#c09670' }));
  const mesas = makeMountains({ seed: 9, n: 4, r0: 260, r1: 300, h0: 8, h1: 13, color: '#b58c66', arc: [Math.PI * 0.75, Math.PI * 1.25] });
  mesas.children.forEach((m, i) => { m.geometry = new THREE.CylinderGeometry(10 + i * 3, 13 + i * 3, 12, 7); m.scale.set(1.8, 0.7, 1.2); m.position.y = 3; });
  g.add(mesas);

  // ---- the stone 7 ----
  const stone = new THREE.Group(); g.add(stone);
  const seven = makeStoneSeven(); stone.add(seven);
  const uS = { value: -1 };
  const face = SEVEN.map(([x, y]) => [x - 0.1, y + 0.17]);
  const insideFace = (x, y) => inPoly(x, y, face) && inPoly(x + 0.09, y, face) && inPoly(x - 0.09, y, face) && inPoly(x, y + 0.09, face) && inPoly(x, y - 0.09, face);
  const facePaths = walkCracks([[-0.05, 0.3, 1.45], [0.25, 0.35, 1.2, 0.01], [1.0, 2.6, 2.1, 0.06], [2.35, 7.1, 2.6, 0.09], [-1.6, 7.25, 0.2, 0.11], [1.7, 4.8, 1.5, 0.08]], 21, insideFace);
  stone.add(crackMesh(facePaths, uS, { plane: 'xy', z: 1.03 }));
  const back = crackMesh(walkCracks([[0.0, 0.4, 1.6], [2.0, 7.0, 2.9, 0.08]], 29, insideFace), uS, { plane: 'xy', z: -1.03 }); stone.add(back);
  const groundPaths = walkCracks(Array.from({ length: 7 }, (_, i) => { const a = i / 7 * Math.PI * 2 + 0.3; return [Math.cos(a) * 2.2, Math.sin(a) * 2.2, a, 0.0]; }), 33, (x, y) => Math.hypot(x, y) < 8, { steps: 12, step: [0.4, 0.7], turn: 0.55, branch: 0.12 });
  const gcr = crackMesh(groundPaths, uS, { plane: 'xz', z: 0.035, width: [0.1, 0.02], speed: 30, color: '#8a6440' }); g.add(gcr);
  // crater rim (disturbed sand) pops up on impact
  const rimPts = [[1.3, -0.05], [1.7, 0.12], [2.2, 0.24], [2.9, 0.14], [3.8, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const rimGeo = new THREE.LatheGeometry(rimPts, 22); const rp = rimGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) { const k = 0.85 + 0.3 * hash01(i, 5); rp.setY(i, rp.getY(i) * k); }
  rimGeo.computeVertexNormals();
  const rim = new THREE.Mesh(rimGeo, matte('#c0925f')); rim.receiveShadow = true; rim.castShadow = true; g.add(rim);

  // ---- flying rocks ----
  const NR = 26;
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, matte('#8f6f50'), NR); rocks.castShadow = true; rocks.frustumCulled = false; g.add(rocks);
  const RK = Array.from({ length: NR }, (_, i) => {
    const a = hash01(i, 1) * Math.PI * 2; const vh = 2.5 + 7 * hash01(i, 2); const vy = 3 + 8 * hash01(i, 3);
    const s = 0.08 + 0.22 * hash01(i, 4) ** 2; const gr = 16;
    const tl = (vy + Math.sqrt(vy * vy + 2 * gr * 0.4)) / gr; // lands at y=0 from y0=0.4
    return { a, vh, vy, s, gr, tl, sp: [hash01(i, 5) * 9, hash01(i, 6) * 9, hash01(i, 7) * 9] };
  });
  // ---- dust ----
  const ring = makeSprites(90, { tex: puffTex(), order: 4 });
  const billow = makeSprites(40, { tex: puffTex(), order: 4 });
  const spray = makeSprites(140, { order: 5 });
  g.add(ring.group, billow.group, spray.group);
  // ---- sheep + palms + scrub ----
  const sheepPos = [[-2.6, 5.2], [-3.6, 3.1], [2.9, 4.6], [3.7, 1.7], [-1.9, -4.4], [4.6, -3.2]];
  const sheep = sheepPos.map(([x, z], i) => { const A = makeAnimal('sheep', i + 1); A.group.scale.setScalar(1.25); A.p0 = [x, z]; g.add(A.group); return A; });
  const palmPos = [[-15, -30, 1.9], [-19, -36, 1.6], [17, -52, 2.0], [22, -47, 1.7], [-6, -70, 1.8]];
  const palms = palmPos.map(([x, z, s], i) => { const p = makePalm(s, 11 + i); p.position.set(x, height(x, z) - 0.1, z); g.add(p); p.userData.r = Math.hypot(x, z); p.userData.dir = Math.atan2(z, x); return p; });
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.45, 0), matte('#7a7442'), 60); bushes.castShadow = true;
  { const R = mulberry32(8); const m4 = new THREE.Matrix4(); let k = 0;
    while (k < 60) { const a = R() * Math.PI * 2, r = 6 + R() * 50; const x = Math.cos(a) * r, z = Math.sin(a) * r; const s = 0.4 + R() * 0.9; m4.compose(new THREE.Vector3(x, height(x, z) + 0.1 * s, z), new THREE.Quaternion(), new THREE.Vector3(s * 1.3, s * 0.55, s)); bushes.setMatrixAt(k++, m4); } }
  g.add(bushes);
  // soft dusty clouds far away (billboards facing the camera side)
  for (let i = 0; i < 7; i++) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: cloudTex(1 + (i % 3)), color: new THREE.Color(1.05, 0.95, 0.82), transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    const a = -0.9 + i * 0.3 + hash01(i, 71) * 0.15, r = 420 + 80 * hash01(i, 72);
    cl.position.set(Math.sin(a) * r, 55 + 70 * hash01(i, 73), -Math.cos(a) * r); cl.lookAt(0, cl.position.y * 0.6, 0);
    cl.scale.setScalar(160 + 120 * hash01(i, 74)); cl.renderOrder = -5; g.add(cl);
  }
  g.add(makeGrass(700, [-30, -40, 30, 18], 6, '#b5a060', 0.45, height, (x, z) => Math.hypot(x, z) < 4.2));
  for (let i = 0; i < 14; i++) { const a = hash01(i, 61) * Math.PI * 2, r = 5 + 30 * hash01(i, 62); const rk = makeRock(0.3 + hash01(i, 63) * 0.9, i, '#a98a68'); const x = Math.cos(a) * r, z = Math.sin(a) * r; rk.position.set(x, height(x, z), z); g.add(rk); }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const dustCol = (k, sh = 1) => [0.82 * k * sh, 0.64 * k * sh, 0.43 * k * sh];

  return {
    group: g, persons: [],
    update(t0, cam, shot) {
      const t = shot.id === 'LOOP' ? t0 - plan.dur : t0;       // the loop pre-roll runs in negative time
      const s = t - E.impact;                                     // seconds since impact
      // stone
      const sink = s > 0 ? 0.32 * easeOut(s / 0.07) : 0;
      stone.position.set(0, B.stoneY(t) - sink, 0);
      const settle = s > 0 ? 1 - Math.exp(-7 * s) * Math.cos(19 * s) : 0;
      stone.rotation.set(0.028 * settle, 0.0 + 0.02 * Math.sin(t * 2.1) * (s > 0 ? 0 : 1), -0.042 * settle + (s > 0 ? 0 : 0.012 * Math.sin(t * 3.3)));
      uS.value = s > 0 ? s : -1;
      gcr.visible = s > 0;
      rim.visible = s > 0; if (s > 0) { const k = easeOut(clamp(s / 0.18)); rim.scale.set(0.5 + 0.5 * k, k * (1 + 0.25 * Math.exp(-6 * s) * Math.sin(20 * s)), 0.5 + 0.5 * k); }
      // rocks
      for (let i = 0; i < NR; i++) {
        const r = RK[i]; let x = 0, y = -50, z = 0;
        if (s > 0) {
          const ss = Math.min(s, r.tl); const slide = s > r.tl ? (1 - Math.exp(-(s - r.tl) * 6)) * 0.12 : 0;
          const d = 1.3 + r.vh * (ss + slide);
          x = Math.cos(r.a) * d; z = Math.sin(r.a) * d; y = Math.max(0, 0.4 + r.vy * ss - 0.5 * r.gr * ss * ss) + r.s * 0.5;
          const spin = Math.min(s, r.tl);
          e.set(spin * r.sp[0], spin * r.sp[1], spin * r.sp[2]); q.setFromEuler(e);
        }
        p.set(x, y, z); sc.setScalar(r.s); m4.compose(p, q, sc); rocks.setMatrixAt(i, m4);
      }
      rocks.instanceMatrix.needsUpdate = true;
      // dust shockwave ring + rising billow + fine spray
      ring.begin(); billow.begin(); spray.begin();
      if (s > 0) {
        for (let i = 0; i < 90; i++) {
          const h1 = hash01(i, 11), h2 = hash01(i, 12), h3 = hash01(i, 13);
          const a = (i / 90) * Math.PI * 2 + h1 * 0.2; const u = easeOut(clamp(s / (1.5 + h2)));
          const r = 1.4 + (11 + 6 * h3) * u; const life = 1 - smooth(invLerp(1.0 + 1.6 * h2, 3.4 + h2, s));
          const k = 0.92 + 0.1 * h2;
          ring.add(Math.cos(a) * r, 0.25 + (0.4 + 1.6 * h3) * u, Math.sin(a) * r, 1.0 + (2.6 + 1.6 * h1) * u, ...dustCol(k), 0.78 * life * smooth(clamp(s / 0.04)), h1 * 6);
        }
        for (let i = 0; i < 40; i++) {
          const h1 = hash01(i, 21), h2 = hash01(i, 22), h3 = hash01(i, 23);
          const a = h1 * Math.PI * 2; const u = easeOut(clamp(s / (2.5 + 1.5 * h2)));
          const r = 0.6 + 3.4 * h2 + 2.2 * u; const life = 1 - smooth(invLerp(2.2 + 2 * h3, 5.5 + h3, s));
          billow.add(Math.cos(a) * r, 0.6 + (1.2 + 4.2 * h3) * u + 0.3 * noise2(s * 0.5, i, 3), Math.sin(a) * r, 1.6 + (2.4 + 2.5 * h1) * u, ...dustCol(0.95, 0.94 + 0.12 * h3), 0.45 * life * smooth(clamp(s / 0.08)), h2 * 6 + s * 0.1 * (h1 - 0.5));
        }
        for (let i = 0; i < 140; i++) {
          const h1 = hash01(i, 31), h2 = hash01(i, 32), h3 = hash01(i, 33);
          const a = h1 * Math.PI * 2, vh = 2 + 6 * h2, vy = 2 + 7 * h3, ss = clamp(s, 0, 1.4);
          const y = 0.3 + vy * ss - 7 * ss * ss; if (y < 0) continue;
          spray.add(Math.cos(a) * (1.2 + vh * ss), y, Math.sin(a) * (1.2 + vh * ss), 0.05 + 0.05 * h2, ...dustCol(1.0), 0.9 * (1 - ss / 1.4));
        }
      }
      ring.end(); billow.end(); spray.end();
      // sheep: graze, then startle and scatter away from the impact
      sheep.forEach((A, i) => {
        const [x0, z0] = A.p0; const away = Math.atan2(z0, x0) + (hash01(i, 3) - 0.5) * 0.6;
        const react = s - (0.05 + 0.03 * i);
        let x = x0, z = z0, y = 0, walk = 0, head = -0.45 + 0.08 * Math.sin(t * 1.3 + i);
        if (react > 0) {
          const hop = react < 0.32 ? Math.sin(Math.PI * react / 0.32) * 0.45 : 0;
          const run = Math.max(0, react - 0.22);
          const dist = run < 3.9 ? 5.5 * run - 0.7 * run * run : 5.5 * 3.9 - 0.7 * 3.9 * 3.9;
          x = x0 + Math.cos(away) * dist; z = z0 + Math.sin(away) * dist; y = hop; walk = run > 0 && run < 3.9 ? 1 : 0; head = 0.15;
        }
        A.group.position.set(x, height(x, z) + y, z);
        A.group.rotation.y = react > 0 ? -away : -away + Math.PI * 0.8 + 0.3 * Math.sin(i);
        A.update(t * (react > 0 ? 2.2 : 1), walk);
        if (A.head) A.head.rotation.z = head;
      });
      // palms: blast push (arrives with the shockwave), damped sway home, plus wind
      palms.forEach((pm, i) => {
        const r = pm.userData.r, dir = pm.userData.dir; const th = s - r / 42;
        const push = th > 0 ? (9 / Math.max(6, r)) * 0.55 * Math.exp(-2.2 * th) * Math.sin(5.5 * th + 0.3) : 0;
        const wind = 0.035 * Math.sin(t * 1.2 + i * 1.7) + 0.02 * noise2(t * 0.8, i, 4);
        pm.rotation.set(Math.sin(dir) * (push * 0.25 + wind * 0.5), 0, -Math.cos(dir) * (push * 0.25 + wind * 0.5), 'XYZ');
        const cr = pm.userData.crown; cr.rotation.set(Math.sin(dir) * (push + wind * 2), t * 0.0, -Math.cos(dir) * (push + wind * 2));
      });
    },
    mood() {
      return {
        sky: { top: '#8f9ea6', horizon: '#f0d3a2', bottom: '#cfa774', band: '#3a2810', sunGlow: '#ffc77a', sunDisk: '#fff0d0' },
        sunDir: [-0.62, 0.5, 0.42], sun: { color: '#ffdcae', intensity: 3.1 },
        hemi: { sky: '#f0d9b4', ground: '#9a7048', intensity: 1.05 },
        fog: { color: '#e4c595', near: 45, far: 330 }, char: '#fff1dc', wind: 0.8,
        post: { haze: 0.12, hazeColor: '#ecd3a6', bloom: 0.55, bloomThreshold: 0.9, tint: '#fff3e2', sat: 1.06, contrast: 1.06, exposure: 0.92, vignette: 0.55, tilt: 0.3, tiltTop: 0.86, tiltBottom: 0.08, grain: 0.03 },
      };
    },
  };
}
