// Deterministic particles: dirt clods, dust puffs, glints and water drops.
// Every particle has a closed-form trajectory, so any frame can be rendered
// on its own (no simulation state).
import * as THREE from 'three';
import { mulberry32, clamp, lerp, seg, smooth, GLSL_NOISE, patch } from './lib.js';
import { B, L, holeDepth, waterLevel } from './beats.js';
import { looseDirtMat } from './props.js';

const G = 9.8;

function solveV(p, target, tau, g = G) {
  return [(target[0] - p[0]) / tau, (target[1] - p[1] + 0.5 * g * tau * tau) / tau, (target[2] - p[2]) / tau];
}
function landTime(p1, v1, landY, g = G) {
  // descending root of p1 + v1 a - g a^2 / 2 = landY
  const A = -0.5 * g, Bq = v1, Cq = p1 - landY;
  const disc = Bq * Bq - 4 * A * Cq; if (disc < 0) return Infinity;
  const r1 = (-Bq - Math.sqrt(disc)) / (2 * A), r2 = (-Bq + Math.sqrt(disc)) / (2 * A);
  return Math.max(r1, r2);
}

export function buildFX(scene) {
  const rnd = mulberry32(4242);
  const R = (a, b) => a + (b - a) * rnd();
  const F = {};

  // ---------------- dirt clods ----------------
  const dirt = [];
  const addDirt = (t0, p, v, s, landY, opts = {}) => {
    const pt = { t0, p, v, s, landY, fade: opts.fade ?? 0.25, spin: R(4, 14), ax: new THREE.Vector3(R(-1, 1), R(-1, 1), R(-1, 1)).normalize(), life: opts.life ?? 3 };
    pt.tl = landY === undefined ? Infinity : landTime(p[1], v[1], landY);
    pt.life = Math.min(pt.life, pt.tl + pt.fade);
    dirt.push(pt);
  };
  const DIG_F = 3.4; // hand strokes per second while digging "like a machine"
  // A: digging fountains (shallow throws, then over the fence onto the neighbour)
  for (let t = B.dig0; t < B.spray1; t += 1 / (DIG_F * 2)) {
    const hand = Math.round((t - B.dig0) * DIG_F * 2) % 2 ? 1 : -1;
    const d = holeDepth(t);
    const n = t < B.spray0 ? 10 : 30;
    for (let i = 0; i < n; i++) {
      const te = t + R(0, 0.08);
      const p = [L.gDig[0] + hand * R(0.2, 0.5), -d + 0.55 + R(-0.1, 0.2), L.gDig[2] + R(0.0, 0.35)];
      let target, tau;
      if (te < B.spray0) { target = [R(-1.5, 2.2), 0.0, R(-4.2, -2.0)]; tau = R(0.6, 0.9); }
      else {
        const k = smooth(seg(te, B.bury0, B.bury1));
        target = [L.neighbor[0] + R(-0.75, 0.75), 0.5 + k * 1.1 + R(-0.2, 0.3), L.neighbor[2] + R(-0.55, 0.4)];
        tau = R(1.05, 1.4);
      }
      addDirt(te, p, solveV(p, target, tau), rnd() < 0.15 ? R(0.08, 0.14) : R(0.025, 0.075), target[1], { fade: 0.15 });
    }
  }
  // B: neat scoops into the wheelbarrow
  for (const ts of B.scoops) {
    for (let i = 0; i < 34; i++) {
      const te = ts + 0.36 + R(0, 0.07);
      const d = holeDepth(te);
      const p = [L.gDig[0] + 0.2 + R(-0.25, 0.25), -d + 2.05 + R(-0.1, 0.1), L.gDig[2] - 0.55 + R(-0.15, 0.15)];
      const target = [L.barrow[0] + R(-0.28, 0.28), 0.66 + R(-0.05, 0.08), L.barrow[2] + R(-0.18, 0.18)];
      addDirt(te, p, solveV(p, target, R(0.38, 0.48)), R(0.035, 0.07), target[1], { fade: 0.35 });
    }
  }
  // C: way too deep — spray up out of the hole onto the heap
  for (let t = B.deep0; t < B.deep1; t += 1 / (DIG_F * 2)) {
    const hand = Math.round((t - B.deep0) * DIG_F * 2) % 2 ? 1 : -1;
    const d = holeDepth(t);
    for (let i = 0; i < 26; i++) {
      const te = t + R(0, 0.08);
      const p = [L.gDig[0] + hand * R(0.2, 0.5), -d + 0.55 + R(-0.1, 0.2), L.gDig[2] + R(0.0, 0.3)];
      const target = [L.heap[0] + R(-0.6, 0.6), R(0.1, 0.6), L.heap[2] + R(-0.45, 0.4)];
      addDirt(te, p, solveV(p, target, R(1.0, 1.3)), R(0.035, 0.08), target[1], { fade: 0.3 });
    }
  }
  // D: fill back up to the line (pushed off the heap into the hole)
  for (let t = B.fill0; t < B.fill1; t += 1 / 150) {
    const p = [L.heap[0] + R(-0.65, 0.9), R(0.05, 0.4), -2.05 + R(-0.15, 0.1)];
    const v = [R(-0.3, 0.6), R(0.5, 1.6), R(1.4, 2.6)];
    const tl = landTime(p[1], v[1], -holeDepth(t + 0.6));
    const landY = -holeDepth(t + Math.min(tl, 1.2));
    addDirt(t, p, v, R(0.04, 0.09), landY, { fade: 0.2 });
  }
  // E: crumbling walls
  for (let t = B.crumble0; t < B.crumble1; t += 1 / 70) {
    const side = Math.floor(R(0, 3));
    let p;
    if (side === 0) p = [-1.46, R(-0.85, -0.05), R(-1.5, 1.5)];
    else if (side === 1) p = [1.46, R(-0.85, -0.05), R(-1.5, 1.5)];
    else p = [R(-1.4, 1.4), R(-0.85, -0.05), -1.56];
    const v = [side === 0 ? R(0.1, 0.6) : side === 1 ? R(-0.6, -0.1) : R(-0.2, 0.2), R(-0.2, 0.4), side === 2 ? R(0.1, 0.6) : R(-0.2, 0.2)];
    addDirt(t, p, v, R(0.05, 0.13), -1.5, { fade: 0.5 });
  }
  // F: punch debris
  const punchPts = [[-1.38, -0.9, -0.2], [-0.2, -0.8, -1.45], [0.5, -0.6, -1.45], [1.38, -0.9, -0.1], [0.1, -1.5, -0.1]];
  B.punches.forEach((tp, j) => {
    for (let i = 0; i < 26; i++) {
      const p = punchPts[j].slice();
      const v = [R(-1.5, 1.5), R(0.5, 2.8), R(-1.2, 1.8)];
      addDirt(tp + R(0, 0.03), p, v, R(0.025, 0.06), -1.58, { fade: 0.25 });
    }
  });
  // G: first scoops of lawn when the hole opens
  for (let i = 0; i < 60; i++) {
    const te = B.dig0 + R(0, 0.5);
    const p = [L.gDig[0] + R(-0.5, 0.5), 0.05, L.gDig[2] + R(0.1, 0.6)];
    addDirt(te, p, [R(-1.5, 1.5), R(2.0, 4.0), R(-2.5, 0.5)], R(0.03, 0.07), 0.0, { fade: 0.3 });
  }
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  { const p = rockGeo.attributes.position; const v = new THREE.Vector3(); const rr = mulberry32(7);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.75 + 0.5 * Math.abs(Math.sin(v.x * 5.1 + v.y * 3.7 + v.z * 4.3)); p.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k); }
    rockGeo.computeVertexNormals(); }
  const clodMat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), {
    fColor: `diffuseColor.rgb *= vec3(0.15, 0.085, 0.045) * (0.7 + 0.6 * vnoise(vOPos * 3.0 + vWPos * 0.0));`,
  });
  F.dirtMesh = new THREE.InstancedMesh(rockGeo, clodMat, 3500);
  { const cc = new THREE.Color(); for (let i = 0; i < 3500; i++) { const v = 0.7 + rnd() * 0.7; cc.setRGB(v, v * (0.9 + rnd() * 0.15), v * (0.85 + rnd() * 0.2)); F.dirtMesh.setColorAt(i, cc); } }
  F.dirtMesh.castShadow = true; F.dirtMesh.receiveShadow = true; F.dirtMesh.frustumCulled = false;
  scene.add(F.dirtMesh);
  F.dirt = dirt;

  // ---------------- billboards ----------------
  const makeBoards = (max, additive) => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute vec4 aData; attribute vec3 aColor;
        varying vec2 vUv; varying vec4 vData; varying vec3 vColor;
        void main(){
          vUv = uv; vData = aData; vColor = aColor;
          vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          float cr = cos(aData.z), sr = sin(aData.z);
          vec2 q = vec2(position.x * cr - position.y * sr, position.x * sr + position.y * cr) * aData.x;
          gl_Position = projectionMatrix * viewMatrix * vec4(c + right * q.x + up * q.y, 1.0);
        }`,
      fragmentShader: `
        ${GLSL_NOISE}
        varying vec2 vUv; varying vec4 vData; varying vec3 vColor; uniform float uTime;
        void main(){
          vec2 p = vUv * 2.0 - 1.0; float r = length(p);
          ${additive ? `
            float star = exp(-abs(p.x) * 28.0) * exp(-abs(p.y) * 2.6) + exp(-abs(p.y) * 28.0) * exp(-abs(p.x) * 2.6);
            float core = exp(-r * r * 22.0);
            float a = (star * 0.8 + core) * vData.y;
            gl_FragColor = vec4(vColor * a, a);
          ` : `
            float n = fbm2(p * 1.6 + vData.w * 13.7);
            float a = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.7) * vData.y;
            if (a < 0.003) discard;
            gl_FragColor = vec4(vColor * (0.82 + 0.35 * n), a);
          `}
        }`,
    });
    const m = new THREE.InstancedMesh(geo, mat, max);
    geo.setAttribute('aData', new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3));
    m.frustumCulled = false; m.renderOrder = additive ? 160 : 150;
    scene.add(m);
    return m;
  };
  F.puffMesh = makeBoards(1200, false);
  F.glintMesh = makeBoards(900, true);

  // puff list: { t0, life, p, v, s0, s1, a, col, drag }
  const puffs = [];
  const dustCol = [0.62, 0.45, 0.3], whiteCol = [1.4, 1.35, 1.3], steamCol = [1.6, 1.6, 1.65];
  const addPuff = (t0, p, v, s0, s1, life, a, col, rise = 0.15) => puffs.push({ t0, p, v, s0, s1, life, a, col, rise, rot: R(0, 6.28), seed: R(0, 10) });
  const ring = (t0, c, n, rad, size, col = dustCol, a = 0.55) => {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + R(-0.2, 0.2);
      addPuff(t0 + R(0, 0.05), [c[0] + Math.cos(ang) * rad * 0.4, c[1] + 0.05, c[2] + Math.sin(ang) * rad * 0.4],
        [Math.cos(ang) * R(0.6, 1.3), R(0.1, 0.4), Math.sin(ang) * R(0.6, 1.3)], size * 0.5, size * R(1.2, 1.8), R(0.7, 1.1), a, col);
    }
  };
  // stomps (walk path from the right)
  B.stomps.forEach((ts, i) => {
    const k = (i + 1) / B.stomps.length; const x = 5.4 + (0.9 - 5.4) * k;
    ring(ts, [x + (i % 2 ? 0.25 : -0.25), 0, -2.0 + 0.5 * k + (i % 2 ? -0.2 : 0.2)], 7, 0.5, 0.45);
  });
  ring(B.hopLand, [L.gDig[0], 0, L.gDig[2]], 12, 0.9, 0.7);
  ring(B.climbLand, [-0.6, 0, -3.5], 12, 0.9, 0.7);
  ring(B.jumpInLand, [0.1, -1.46, -0.3], 10, 1.0, 0.65);
  ring(B.jumpOutLand, [L.gStage[0], 0, L.gStage[2]], 12, 0.9, 0.7);
  // digging dust
  for (const [a, b] of [[B.dig0, B.spray1], [B.deep0, B.deep1]]) {
    for (let t = a; t < b; t += 0.06) {
      const d = holeDepth(t);
      addPuff(t, [L.gDig[0] + R(-0.8, 0.8), -d + R(0.3, 0.9), L.gDig[2] + R(-0.2, 0.6)], [R(-0.3, 0.3), R(0.4, 1.0), R(-0.2, 0.3)], 0.25, R(0.6, 1.0), R(0.8, 1.2), 0.32, dustCol);
    }
  }
  // dirt landing on the neighbour
  for (let t = B.spray0 + 1.0; t < B.spray1 + 1.2; t += 0.09) addPuff(t, [L.neighbor[0] + R(-0.7, 0.7), 1.2 + R(0, 0.6), L.neighbor[2] + R(-0.3, 0.3)], [R(-0.4, 0.4), R(0.2, 0.6), R(-0.2, 0.2)], 0.2, 0.7, 0.8, 0.35, dustCol);
  // punches, crumble, slabs, fill
  B.punches.forEach((tp, j) => { for (let i = 0; i < 9; i++) addPuff(tp + R(0, 0.04), punchPts[j], [R(-1.2, 1.2), R(0.2, 1.2), R(-0.6, 1.2)], 0.2, R(0.5, 0.9), R(0.6, 0.9), 0.55, dustCol); });
  for (let t = B.crumble0; t < B.crumble1; t += 0.07) addPuff(t, [R(-1.4, 1.4), R(-1.4, -0.4), R(-1.4, 1.2)], [R(-0.2, 0.2), R(0.1, 0.4), R(-0.1, 0.3)], 0.25, R(0.6, 1.0), 1.0, 0.25, dustCol);
  for (let t = B.fill0; t < B.fill1; t += 0.05) addPuff(t, [R(-1.3, 1.3), -holeDepth(t) + R(0.1, 0.6), R(-1.4, 1.0)], [R(-0.3, 0.3), R(0.3, 0.8), R(-0.2, 0.4)], 0.25, R(0.6, 1.0), 1.0, 0.3, dustCol);
  B.slabs.forEach((ts) => { for (let i = 0; i < 6; i++) addPuff(ts + 0.12, [R(-1.4, 1.4), R(-1.5, -0.2), R(-1.4, 1.2)], [R(-0.3, 0.3), R(0.2, 0.5), R(-0.1, 0.3)], 0.2, 0.6, 0.7, 0.25, [0.75, 0.72, 0.68]); });
  // huffs (steam from the nostrils) — origin set relative to the gorilla in timeline via F.huffOrigin
  F.huffs = [B.huff, B.huff2];
  // poof cloud for the outfit change
  for (let i = 0; i < 26; i++) {
    const a = R(0, 6.28), e = R(-0.3, 1.2);
    addPuff(B.poof + R(0, 0.08), [L.kidEdge[0] + Math.cos(a) * 0.15, 0.7 + e * 0.35, L.kidEdge[2] + Math.sin(a) * 0.15],
      [Math.cos(a) * R(0.5, 1.2), R(-0.2, 0.9), Math.sin(a) * R(0.5, 1.2)], 0.3, R(0.6, 0.9), R(0.6, 0.9), 0.85, whiteCol, 0.05);
  }
  // splash spray mist
  for (let i = 0; i < 70; i++) {
    const a = R(0, 6.28);
    addPuff(B.impact + R(0, 0.25), [L.floatAt[0] + Math.cos(a) * R(0, 0.5), -0.1 + R(0, 1.5), L.floatAt[2] + Math.sin(a) * R(0, 0.5)],
      [Math.cos(a) * R(0.5, 2.5), R(0.5, 3.5), Math.sin(a) * R(0.5, 2.0)], 0.3, R(0.8, 1.4), R(0.7, 1.3), 0.55, [1.3, 1.45, 1.5], -0.4);
  }
  F.puffs = puffs;

  // ---------------- glints (additive stars) ----------------
  const glints = [];
  const addGlint = (t0, p, s, life, col, v = [0, 0, 0]) => glints.push({ t0, p, s, life, col, v, rot: R(0, 0.8) });
  for (let i = 0; i < 21; i++) addGlint(B.linePop + i * 0.035, [-1.75 + i * 0.175, -1.6, 1.7], R(0.2, 0.35), 0.45, [1.2, 3.0, 3.4]);
  for (let t = B.tiles0; t < B.tiles1; t += 0.03) addGlint(t, [R(-1.4, 1.4), R(-1.5, -0.1), R(-1.55, 1.4)], R(0.12, 0.25), 0.35, [2.2, 2.6, 3.0]);
  for (let t = B.water1 - 0.3; t < 50; t += 0.06) {
    const wl = waterLevel(t);
    addGlint(t, [R(-1.4, 1.4), wl + 0.02, R(-1.45, 1.5)], R(0.07, 0.16), R(0.35, 0.7), [2.6, 2.3, 1.8]);
  }
  for (let i = 0; i < 30; i++) { const a = R(0, 6.28); addGlint(B.poof + R(0, 0.35), [L.kidEdge[0] + Math.cos(a) * R(0.2, 0.6), R(0.3, 1.5), L.kidEdge[2] + Math.sin(a) * R(0.2, 0.5)], R(0.12, 0.26), 0.5, [3.0, 2.8, 2.2]); }
  for (let i = 0; i < 18; i++) addGlint(B.pilePop + R(0, 0.3), [L.pileStart[0] + R(-0.6, 0.6), R(0.3, 0.9), L.pileStart[2] + R(-0.4, 0.4)], R(0.12, 0.25), 0.45, [3.0, 2.6, 1.2]);
  for (let t = B.hoseOn; t < B.hoseOff; t += 0.05) addGlint(t, [R(-0.4, 0.8), R(0.2, 1.0), R(-1.6, -0.4)], R(0.08, 0.16), 0.3, [2.5, 2.8, 3.0]);
  for (let i = 0; i < 40; i++) addGlint(B.impact + R(0, 0.5), [R(-1.5, 1.5), R(0.2, 2.5), R(-1.3, 1.0)], R(0.12, 0.3), R(0.3, 0.6), [2.6, 2.8, 3.0]);
  F.glints = glints;

  // ---------------- water drops ----------------
  const dropMat = new THREE.MeshPhysicalMaterial({ color: 0xc8f2ff, roughness: 0.02, metalness: 0, clearcoat: 1, envMapIntensity: 2.2, emissive: 0x3a8ab0, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 });
  F.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), dropMat, 3200);
  F.dropMesh.frustumCulled = false; F.dropMesh.castShadow = false; F.dropMesh.renderOrder = 130;
  scene.add(F.dropMesh);
  const drops = [];
  const addDrop = (t0, p, v, s, landY, stretch = 1) => {
    const tl = landY === undefined ? 3 : landTime(p[1], v[1], landY);
    drops.push({ t0, p, v, s, tl, life: tl, stretch });
  };
  // cannonball splash
  const c = [L.floatAt[0], -0.12, L.floatAt[2]];
  for (let i = 0; i < 1400; i++) {
    const te = B.impact + R(0, 0.22);
    const kind = rnd();
    let p, v, landY;
    if (kind < 0.35) { // central column
      const a = R(0, 6.28), r = R(0, 0.35);
      p = [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r];
      v = [Math.cos(a) * R(0, 1.2), R(5.5, 10.5), Math.sin(a) * R(0, 1.0)];
    } else if (kind < 0.75) { // crown
      const a = R(0, 6.28);
      p = [c[0] + Math.cos(a) * 0.6, c[1], c[2] + Math.sin(a) * 0.5];
      v = [Math.cos(a) * R(1.5, 3.8), R(3.0, 6.0), Math.sin(a) * R(1.2, 3.0)];
    } else { // sheet toward the kid
      p = [c[0] - 0.4 + R(-0.2, 0.2), c[1] + R(0, 0.3), c[2] + R(-0.3, 0.3)];
      const target = [L.kidEdge[0] + R(-0.5, 0.25), R(0.2, 1.6), L.kidEdge[2] + R(-0.4, 0.4)];
      v = solveV(p, target, R(0.45, 0.8));
    }
    const lands = (x, z) => (x > -1.5 && x < 1.5 && z > -1.6 && z < 1.6 ? -0.05 : 0.0);
    // estimate landing surface from an approximate landing x/z
    const tl0 = landTime(p[1], v[1], 0);
    landY = lands(p[0] + v[0] * tl0, p[2] + v[2] * tl0);
    if (p[2] + v[2] * tl0 > 1.6) landY = -3; // falls past the front cut
    addDrop(te, p, v, R(0.018, 0.05), landY, 1.6);
  }
  // kid drips
  const dripPts = [[-0.1, 1.32, 0.12], [0.08, 1.33, 0.1], [0.0, 1.05, 0.15], [-0.24, 0.62, 0.05], [0.24, 0.62, 0.05], [0.12, 0.5, 0.1], [-0.12, 0.5, 0.1], [0.0, 1.45, -0.1]];
  for (let t = B.soak0 + 0.3; t < 50; t += 0.075) {
    const dp = dripPts[Math.floor(R(0, dripPts.length))];
    const p = [L.kidEdge[0] + dp[0], dp[1] + R(-0.02, 0.02), L.kidEdge[2] + dp[2]];
    addDrop(t, p, [R(-0.05, 0.05), R(-0.3, 0), R(-0.05, 0.05)], R(0.012, 0.02), 0.0, 1.4);
  }
  F.drops = drops;
  F.hose = { on: false };

  // splash crown + column
  const crownMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `${GLSL_NOISE} varying vec2 vUv; uniform float uTime; void main(){ vUv = uv; vec3 p = position; if (uv.y > 0.6) p.y += (vnoise2(vec2(uv.x * 24.0, 1.0)) - 0.5) * 0.5 * uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `${GLSL_NOISE} varying vec2 vUv; uniform float uA; uniform float uTime;
      void main(){ float n = vnoise2(vec2(vUv.x * 40.0, vUv.y * 6.0 - uTime * 3.0));
        float a = uA * (0.35 + 0.5 * n) * (1.0 - smoothstep(0.7, 1.0, vUv.y)) * smoothstep(0.0, 0.15, vUv.y);
        gl_FragColor = vec4(vec3(0.85, 0.97, 1.0) * 1.6, a); }`,
  });
  F.crown = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 1, 64, 8, true).translate(0, 0.5, 0), crownMat);
  F.crown.visible = false; F.crown.renderOrder = 125; scene.add(F.crown);
  F.column = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24).translate(0, 1, 0), crownMat.clone());
  F.column.visible = false; F.column.renderOrder = 126; scene.add(F.column);
  return F;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export function updateFX(F, t, ctx) {
  // dirt
  let n = 0;
  for (const pt of F.dirt) {
    const a = t - pt.t0;
    if (a < 0 || a > pt.life || n >= 3500) continue;
    const ta = Math.min(a, pt.tl);
    let sc = pt.s;
    if (a > pt.tl) sc *= 1 - clamp((a - pt.tl) / pt.fade);
    if (sc <= 0.002) continue;
    _p.set(pt.p[0] + pt.v[0] * ta, pt.p[1] + pt.v[1] * ta - 0.5 * G * ta * ta, pt.p[2] + pt.v[2] * ta);
    _q.setFromAxisAngle(pt.ax, ta * pt.spin);
    _s.set(sc, sc * 0.8, sc);
    _m.compose(_p, _q, _s); F.dirtMesh.setMatrixAt(n++, _m);
  }
  F.dirtMesh.count = n; F.dirtMesh.instanceMatrix.needsUpdate = true;

  // puffs (+ dynamic steam puffs)
  const pm = F.puffMesh, pd = pm.geometry.attributes.aData, pc = pm.geometry.attributes.aColor;
  n = 0;
  const puffList = F.puffs.concat(ctx.extraPuffs || []);
  for (const pf of puffList) {
    const a = t - pf.t0;
    if (a < 0 || a > pf.life || n >= 1200) continue;
    const k = a / pf.life;
    const drag = 1 - Math.exp(-a * 2.2);
    _p.set(pf.p[0] + pf.v[0] * drag / 2.2, pf.p[1] + pf.v[1] * drag / 2.2 + pf.rise * a, pf.p[2] + pf.v[2] * drag / 2.2);
    _m.makeTranslation(_p.x, _p.y, _p.z); pm.setMatrixAt(n, _m);
    const size = lerp(pf.s0, pf.s1, 1 - Math.pow(1 - k, 2));
    const alpha = pf.a * smooth(clamp(k * 6)) * (1 - smooth(k));
    pd.setXYZW(n, size, alpha, pf.rot + a * 0.3, pf.seed);
    const lf = ctx.light ?? 1;
    pc.setXYZ(n, pf.col[0] * lf, pf.col[1] * lf, pf.col[2] * lf);
    n++;
  }
  pm.count = n; pm.instanceMatrix.needsUpdate = true; pd.needsUpdate = true; pc.needsUpdate = true;

  // glints
  const gm = F.glintMesh, gd = gm.geometry.attributes.aData, gc = gm.geometry.attributes.aColor;
  n = 0;
  for (const g of F.glints) {
    const a = t - g.t0;
    if (a < 0 || a > g.life || n >= 900) continue;
    const k = a / g.life;
    _m.makeTranslation(g.p[0] + g.v[0] * a, g.p[1] + g.v[1] * a, g.p[2] + g.v[2] * a); gm.setMatrixAt(n, _m);
    const tw = Math.sin(k * Math.PI);
    gd.setXYZW(n, g.s * (0.5 + 0.5 * tw), tw, g.rot, 0);
    gc.setXYZ(n, g.col[0], g.col[1], g.col[2]);
    n++;
  }
  gm.count = n; gm.instanceMatrix.needsUpdate = true; gd.needsUpdate = true; gc.needsUpdate = true;

  // water drops: splash + drips + hose stream
  const dm = F.dropMesh; n = 0;
  const putDrop = (x, y, z, s, vx, vy, vz, stretch) => {
    if (n >= 3200) return;
    _p.set(x, y, z);
    const vel = new THREE.Vector3(vx, vy, vz); const sp = vel.length();
    if (sp > 0.5) _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.normalize()); else _q.identity();
    _s.set(s, s * (1 + Math.min(sp * 0.12, 1.2) * stretch), s);
    _m.compose(_p, _q, _s); dm.setMatrixAt(n++, _m);
  };
  for (const d of F.drops) {
    const a = t - d.t0;
    if (a < 0 || a > d.life) continue;
    putDrop(d.p[0] + d.v[0] * a, d.p[1] + d.v[1] * a - 0.5 * G * a * a, d.p[2] + d.v[2] * a, d.s, d.v[0], d.v[1] - G * a, d.v[2], d.stretch);
  }
  if (ctx.hose && ctx.hose.on) {
    const { o, v, tEnd, k } = ctx.hose;
    const rate = 260;
    for (let i = 0; i < Math.floor(tEnd * rate); i++) {
      const tt = (i / rate + t * 0.73) % tEnd;
      const h = Math.sin(i * 12.9898) * 43758.5453; const fr = h - Math.floor(h);
      const h2 = Math.sin(i * 78.233) * 12543.11; const fr2 = h2 - Math.floor(h2);
      const sp = 0.06 + tt * 0.12;
      putDrop(o.x + v.x * tt + (fr - 0.5) * sp, o.y + v.y * tt - 0.5 * G * tt * tt + (fr2 - 0.5) * sp, o.z + v.z * tt + (fr2 - fr) * sp * 0.6,
        0.014 + fr * 0.012, v.x, v.y - G * tt, v.z, 1.2 * k);
    }
  }
  dm.count = n; dm.instanceMatrix.needsUpdate = true;

  // crown / column
  const dt = t - B.impact;
  F.crown.visible = dt > 0 && dt < 1.4;
  F.column.visible = dt > 0 && dt < 1.2;
  if (F.crown.visible) {
    const k = dt / 1.4;
    F.crown.position.set(L.floatAt[0], waterLevel(t) - 0.05, L.floatAt[2]);
    const r = 0.5 + 1.3 * (1 - Math.pow(1 - k, 2));
    F.crown.scale.set(r, 2.2 * Math.sin(Math.min(1, k * 1.25) * Math.PI) + 0.01, r * 0.8);
    F.crown.material.uniforms.uA.value = 1 - smooth(k);
    F.crown.material.uniforms.uTime.value = t;
  }
  if (F.column.visible) {
    const k = dt / 1.2;
    F.column.position.set(L.floatAt[0], waterLevel(t) - 0.1, L.floatAt[2]);
    const hgt = 2.6 * Math.sin(Math.min(1, k * 1.1) * Math.PI);
    F.column.scale.set(0.45 * (1 - k * 0.5), Math.max(0.01, hgt), 0.4 * (1 - k * 0.5));
    F.column.material.uniforms.uA.value = 0.9 * (1 - smooth(k));
    F.column.material.uniforms.uTime.value = t;
  }
}
