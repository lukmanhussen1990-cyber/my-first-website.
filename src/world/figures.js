// Simple 3D people built from primitives (like the reference): a joint hierarchy
// that can be posed, with clothing colors per character.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLSL_NOISE, lerp } from '../util.js';

const JOINTS = ['spine', 'chest', 'neck', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR'];

function mat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.72, metalness: 0, ...o.extra });
  if (o.emissive) m.emissive = new THREE.Color(o.emissive);
  if (o.transparent) { m.transparent = true; m.opacity = 1; m.depthWrite = true; }
  return m;
}

function capsule(r, len, m) {
  const g = new THREE.CapsuleGeometry(r, len, 5, 12);
  const mesh = new THREE.Mesh(g, m);
  return mesh;
}

// frozen-skin material: pale grey-blue with frost speckles
export function frostSkinMaterial(color = 0xa7b7c4, transparent = false) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });
  if (transparent) { m.transparent = true; m.depthWrite = true; }
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFP;\n' + GLSL_NOISE)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float fr = vnoise3(vFP*180.0);
        float blot = fbm3(vFP*25.0);
        diffuseColor.rgb *= 0.85 + 0.25*blot;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93,0.97,1.0), smoothstep(0.72, 0.9, fr)*0.8);`);
  };
  m.customProgramCacheKey = () => 'frostskin' + transparent;
  return m;
}

export function createFigure(o = {}) {
  const T = o.transparent ?? true; // characters in front of ice are rendered after transmission (no colour bleed)
  const M = {
    jacket: mat(o.jacket ?? 0xff6a13, { transparent: T, emissive: o.jacketGlow ?? 0x000000, rough: 0.62 }),
    jacket2: mat(o.jacket2 ?? o.jacket ?? 0xff6a13, { transparent: T, emissive: o.jacketGlow ?? 0x000000, rough: 0.62 }),
    pants: mat(o.pants ?? 0x1c1f26, { transparent: T }),
    boots: mat(o.boots ?? 0x2a1d14, { transparent: T, rough: 0.5 }),
    gloves: mat(o.gloves ?? 0x15171c, { transparent: T }),
    skin: o.frozen ? frostSkinMaterial(o.skin ?? 0xa7b7c4, T) : mat(o.skin ?? 0xd9a07f, { transparent: T, rough: 0.6 }),
    hair: mat(o.hair ?? 0x2a1c12, { transparent: T }),
    helmet: mat(o.helmet ?? 0xf3f3f0, { transparent: T, rough: 0.35 }),
    hat: mat(o.hat ?? 0x6b6e72, { transparent: T, rough: 0.95 }),
    pack: mat(o.backpack ?? 0x2b3440, { transparent: T }),
    strap: mat(o.harness ?? 0x14161a, { transparent: T }),
    beard: mat(o.beard ?? 0x3a2a1e, { transparent: T, rough: 0.95 }),
    eye: mat(0x101012, { transparent: T, rough: 0.3 }),
    lens: new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: T }),
  };
  const s = o.scale ?? 1;
  const root = new THREE.Group();
  const J = {};
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  J.hips = hips;
  const add = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); J[name] = g; return g; };
  add('spine', hips, 0, 0.08, 0);
  add('chest', J.spine, 0, 0.17, 0);
  add('neck', J.chest, 0, 0.33, 0);
  add('head', J.neck, 0, 0.07, 0);
  add('shL', J.chest, 0.205, 0.27, 0);
  add('elL', J.shL, 0, -0.28, 0);
  add('wrL', J.elL, 0, -0.25, 0);
  add('shR', J.chest, -0.205, 0.27, 0);
  add('elR', J.shR, 0, -0.28, 0);
  add('wrR', J.elR, 0, -0.25, 0);
  add('hipL', hips, 0.1, -0.05, 0);
  add('knL', J.hipL, 0, -0.43, 0);
  add('anL', J.knL, 0, -0.42, 0);
  add('hipR', hips, -0.1, -0.05, 0);
  add('knR', J.hipR, 0, -0.43, 0);
  add('anR', J.knR, 0, -0.42, 0);

  const put = (mesh, parent, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);
    return mesh;
  };
  // torso
  put(new THREE.Mesh(new RoundedBoxGeometry(0.33, 0.2, 0.21, 3, 0.07), M.pants), hips, 0, -0.02, 0);
  put(new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.24, 0.23, 3, 0.08), M.jacket2), J.spine, 0, 0.08, 0);
  put(new THREE.Mesh(new RoundedBoxGeometry(0.43, 0.37, 0.27, 4, 0.11), M.jacket), J.chest, 0, 0.15, 0);
  // collar
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.07, 14), M.jacket), J.chest, 0, 0.34, 0);
  // neck + head
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), M.skin), J.neck, 0, 0.02, 0);
  const headMesh = put(new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), M.skin), J.head, 0, 0.1, 0.005);
  headMesh.scale.set(0.9, 1.08, 1.0);
  if (!o.noFace) {
    put(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M.eye), J.head, 0.036, 0.115, 0.093);
    put(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M.eye), J.head, -0.036, 0.115, 0.093);
    put(new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), M.skin), J.head, 0, 0.085, 0.105);
  }
  if (o.helmet !== null && o.helmet !== undefined) {
    const hel = put(new THREE.Mesh(new THREE.SphereGeometry(0.128, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), M.helmet), J.head, 0, 0.125, 0);
    hel.scale.set(0.95, 0.95, 1.05);
    put(new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.012, 6, 24), M.helmet), J.head, 0, 0.115, 0, Math.PI / 2, 0, 0);
    if (o.headlamp) {
      put(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.04, 0.035, 2, 0.01), M.strap), J.head, 0, 0.165, 0.12);
      const lens = put(new THREE.Mesh(new THREE.CircleGeometry(0.016, 14), M.lens), J.head, 0, 0.165, 0.139);
      J.lens = lens;
      J.lamp = new THREE.Object3D();
      J.lamp.position.set(0, 0.165, 0.15);
      J.head.add(J.lamp);
    }
  } else if (o.hat !== null && o.hat !== undefined) {
    const hat = put(new THREE.Mesh(new THREE.SphereGeometry(0.118, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.hat), J.head, 0, 0.12, 0);
    hat.scale.set(0.95, 1.05, 1.02);
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.118, 0.045, 22, 1, true), M.hat), J.head, 0, 0.13, 0);
  } else if (o.hair !== null) {
    const hair = put(new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), M.hair), J.head, 0, 0.11, -0.008);
    hair.scale.set(0.95, 1.05, 1.05);
  }
  if (o.beard) {
    const b = put(new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12, -Math.PI * 0.15, Math.PI * 1.3, Math.PI * 0.55, Math.PI * 0.4), M.beard), J.head, 0, 0.1, 0.012);
    b.scale.set(0.95, 1.1, 1.05);
    b.rotation.y = Math.PI * 0.5 + Math.PI;
  }
  if (o.backpack !== null && o.backpack !== undefined) {
    put(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.38, 0.15, 3, 0.05), M.pack), J.chest, 0, 0.13, -0.2);
  }
  if (o.harness) {
    put(new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 20), M.strap), hips, 0, 0.02, 0, Math.PI / 2, 0, 0);
    put(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 14), M.strap), J.hipL, 0, -0.08, 0, Math.PI / 2, 0, 0);
    put(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 14), M.strap), J.hipR, 0, -0.08, 0, Math.PI / 2, 0, 0);
    J.clip = new THREE.Object3D();
    J.clip.position.set(0, 0.02, 0.2);
    hips.add(J.clip);
  }
  // arms
  for (const sd of ['L', 'R']) {
    put(capsule(0.056, 0.2, M.jacket), J['sh' + sd], 0, -0.135, 0);
    put(capsule(0.048, 0.18, M.jacket), J['el' + sd], 0, -0.12, 0);
    const hand = put(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.gloves), J['wr' + sd], 0, -0.05, 0);
    hand.scale.set(0.75, 1.15, 0.55);
    // legs
    put(capsule(0.072, 0.3, M.pants), J['hip' + sd], 0, -0.215, 0);
    put(capsule(0.06, 0.3, M.pants), J['kn' + sd], 0, -0.21, 0);
    put(new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.1, 0.27, 2, 0.04), M.boots), J['an' + sd], 0, -0.03, 0.05);
  }
  root.scale.setScalar(s);
  root.traverse((ob) => { if (ob.isMesh) ob.frustumCulled = false; });

  const fig = { root, J, M, pose: {} };
  fig.setPose = (pose) => applyPose(fig, pose);
  return fig;
}

// ---------------------------------------------------------------- poses
// pose: { hipsPos:[x,y,z], hipsRot:[x,y,z], <joint>: [rx,ry,rz] }
export function applyPose(fig, pose) {
  const J = fig.J;
  const hp = pose.hipsPos ?? [0, 0.95, 0];
  J.hips.position.set(hp[0], hp[1], hp[2]);
  const hr = pose.hipsRot ?? [0, 0, 0];
  J.hips.rotation.set(hr[0], hr[1], hr[2]);
  for (const j of JOINTS) {
    const r = pose[j] ?? [0, 0, 0];
    J[j].rotation.set(r[0], r[1], r[2]);
  }
  fig.pose = pose;
}

export function blendPose(a, b, k) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const va = a[key] ?? (key === 'hipsPos' ? [0, 0.95, 0] : [0, 0, 0]);
    const vb = b[key] ?? (key === 'hipsPos' ? [0, 0.95, 0] : [0, 0, 0]);
    out[key] = va.map((v, i) => lerp(v, vb[i], k));
  }
  return out;
}

export const POSES = {
  stand: { shL: [0, 0, 0.1], shR: [0, 0, -0.1], elL: [-0.15, 0, 0], elR: [-0.15, 0, 0] },
  frozen: { spine: [0.05, 0, 0], neck: [0.12, 0, 0], head: [0.1, 0, 0], shL: [0.05, 0, 0.12], shR: [0.08, 0, -0.1], elL: [-0.2, 0, 0], elR: [-0.35, 0, 0], hipL: [0.02, 0, 0.03], hipR: [-0.02, 0, -0.03], knL: [0.05, 0, 0], knR: [0.08, 0, 0] },
  sitLedge: {
    hipsPos: [0, 0.13, 0], spine: [-0.12, 0, 0], chest: [0.05, 0, 0], neck: [0.05, 0, 0], head: [0.08, 0, 0],
    shL: [-0.55, 0, 0.18], elL: [-0.9, 0, 0], shR: [-0.5, 0, -0.18], elR: [-1.0, 0, 0],
    hipL: [-1.45, 0, 0.12], knL: [1.5, 0, 0], anL: [-0.2, 0, 0],
    hipR: [-1.35, 0, -0.05], knR: [1.05, 0.0, 0.55], anR: [0.2, 0, 0.3],
  },
  sitHug: {
    hipsPos: [0, 0.13, 0], spine: [0.15, 0, 0], chest: [0.15, 0, 0], neck: [0.2, 0, 0], head: [0.15, 0, 0],
    shL: [-1.0, 0, 0.3], elL: [-1.7, 0, 0], shR: [-1.0, 0, -0.3], elR: [-1.7, 0, 0],
    hipL: [-1.9, 0, 0.1], knL: [2.2, 0, 0], anL: [-0.3, 0, 0],
    hipR: [-1.35, 0, -0.05], knR: [1.05, 0.0, 0.55], anR: [0.2, 0, 0.3],
  },
  recoil: {
    hipsPos: [0, 0.13, -0.06], spine: [-0.32, 0, 0], chest: [-0.12, 0, 0], neck: [-0.18, 0, 0], head: [-0.1, 0, 0],
    shL: [0.35, 0, 0.75], elL: [-0.4, 0, 0], shR: [0.35, 0, -0.75], elR: [-0.4, 0, 0],
    hipL: [-1.45, 0, 0.12], knL: [1.5, 0, 0], anL: [-0.2, 0, 0],
    hipR: [-1.35, 0, -0.05], knR: [1.05, 0.0, 0.55], anR: [0.2, 0, 0.3],
  },
  eyesShut: {
    hipsPos: [0, 0.13, -0.05], spine: [-0.25, 0, 0], chest: [-0.05, 0, 0], neck: [0.05, -0.5, 0], head: [-0.05, -0.35, 0.1],
    shL: [-0.2, 0, 0.5], elL: [-0.6, 0, 0], shR: [-1.2, 0.3, -0.5], elR: [-2.0, 0, 0],
    hipL: [-1.45, 0, 0.12], knL: [1.5, 0, 0], anL: [-0.2, 0, 0],
    hipR: [-1.35, 0, -0.05], knR: [1.05, 0.0, 0.55], anR: [0.2, 0, 0.3],
  },
  slumped: {
    hipsPos: [0, 0.13, 0], spine: [0.0, 0, 0.05], chest: [0.15, 0, 0.05], neck: [0.35, 0, 0.1], head: [0.25, 0, 0.1],
    shL: [-0.2, 0, 0.15], elL: [-0.5, 0, 0], shR: [-0.25, 0, -0.15], elR: [-0.6, 0, 0],
    hipL: [-1.45, 0, 0.12], knL: [1.5, 0, 0], anL: [-0.2, 0, 0],
    hipR: [-1.35, 0, -0.05], knR: [1.05, 0.0, 0.55], anR: [0.2, 0, 0.3],
  },
  fall: {
    spine: [-0.3, 0, 0], neck: [-0.4, 0, 0], shL: [-0.3, 0, 2.4], elL: [-0.6, 0, 0], shR: [-0.5, 0, -2.2], elR: [-0.5, 0, 0],
    hipL: [-0.9, 0, 0.2], knL: [1.3, 0, 0], hipR: [-0.2, 0, -0.15], knR: [0.6, 0, 0],
  },
  lieBroken: {
    hipsPos: [0, 0.16, 0], hipsRot: [-1.35, 0, 0.12], spine: [0.15, 0, 0], neck: [0.4, 0.3, 0], head: [0.2, 0.4, 0],
    shL: [0.6, 0, 0.9], elL: [-0.9, 0, 0], shR: [-0.3, 0, -0.6], elR: [-0.4, 0, 0],
    hipL: [-0.3, 0, 0.15], knL: [0.9, 0, 0], hipR: [-0.6, 0, -0.2], knR: [0.4, 0.0, -1.15], anR: [0.3, 0, 0.5],
  },
  hang: {
    spine: [0.05, 0, 0], neck: [0.1, 0, 0], shL: [-2.7, 0, 0.25], elL: [-0.5, 0, 0], shR: [-2.6, 0, -0.25], elR: [-0.6, 0, 0],
    hipL: [-0.5, 0, 0.1], knL: [0.7, 0, 0], hipR: [-0.35, 0, -0.1], knR: [0.5, 0, 0],
  },
  carried: {
    spine: [0.1, 0, 0], neck: [0.3, 0, 0], shL: [-0.3, 0, 0.4], elL: [-0.9, 0, 0], shR: [-1.6, 0, -0.6], elR: [-0.8, 0, 0],
    hipL: [-0.4, 0, 0.12], knL: [0.6, 0, 0], hipR: [-0.6, 0, -0.1], knR: [0.2, 0, -0.9],
  },
  lookUp: { neck: [-0.5, 0, 0], head: [-0.45, 0, 0], shL: [0.05, 0, 0.12], shR: [0.05, 0, -0.12], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0] },
  reachUp: { neck: [-0.55, 0, 0], head: [-0.4, 0, 0], shL: [-2.9, 0, 0.2], elL: [-0.3, 0, 0], shR: [0.1, 0, -0.15], elR: [-0.3, 0, 0], hipL: [-0.1, 0, 0], knL: [0.2, 0, 0] },
  reachUp2: { neck: [-0.6, 0.2, 0], head: [-0.35, 0.2, 0], shL: [-2.7, 0, 0.5], elL: [-0.4, 0, 0], shR: [-2.6, 0, -0.45], elR: [-0.5, 0, 0], hipR: [-0.25, 0, -0.05], knR: [0.5, 0, 0] },
  curled: { spine: [0.35, 0, 0], chest: [0.2, 0, 0], neck: [-0.2, 0, 0], head: [-0.6, 0, 0], shL: [-1.2, 0, 0.3], elL: [-1.8, 0, 0], shR: [-1.1, 0, -0.3], elR: [-1.9, 0, 0], hipL: [-1.6, 0, 0.1], knL: [2.0, 0, 0], hipR: [-1.5, 0, -0.1], knR: [2.1, 0, 0] },
  talkRadio: { shL: [-0.2, 0, 0.1], elL: [-0.3, 0, 0], shR: [-0.9, 0.5, -0.3], elR: [-2.1, 0, 0], neck: [0.1, 0, 0] },
  flashlight: { shL: [-1.35, 0, 0.05], elL: [-0.1, 0, 0], shR: [-0.3, 0, -0.2], elR: [-0.9, 0, 0], neck: [0, 0, 0] },
  lantern: { shL: [-0.1, 0, 0.12], elL: [-0.2, 0, 0], shR: [-0.25, 0, -0.08], elR: [-1.4, 0, 0] },
  rappel: {
    hipsRot: [0.35, 0, 0], spine: [-0.1, 0, 0], neck: [0.25, 0, 0],
    shL: [-2.4, 0, 0.15], elL: [-0.7, 0, 0], shR: [-0.6, 0, -0.2], elR: [-1.3, 0, 0],
    hipL: [-1.25, 0, 0.18], knL: [1.2, 0, 0], anL: [0.2, 0, 0], hipR: [-1.15, 0, -0.18], knR: [1.1, 0, 0], anR: [0.2, 0, 0],
  },
  wrapped: {
    hipsPos: [0, 0.13, 0], spine: [0.15, 0, 0], neck: [0.2, 0, 0], head: [0.1, 0, 0],
    shL: [-0.9, 0, 0.35], elL: [-1.8, 0, 0], shR: [-0.9, 0, -0.35], elR: [-1.8, 0, 0],
    hipL: [-1.5, 0, 0.1], knL: [1.6, 0, 0], hipR: [-1.4, 0, -0.1], knR: [1.0, 0, 0.4],
  },
  kneelBook: { hipsPos: [0, 0.55, 0], spine: [0.25, 0, 0], neck: [0.45, 0, 0], shL: [-0.9, 0.3, 0.2], elL: [-1.4, 0, 0], shR: [-0.9, -0.3, -0.2], elR: [-1.4, 0, 0], hipL: [-1.5, 0, 0.1], knL: [2.3, 0, 0], hipR: [-0.3, 0, -0.1], knR: [1.7, 0, 0] },
};

export function walkPose(phase, amt = 1) {
  const s = Math.sin(phase), c = Math.cos(phase);
  const base = POSES.stand;
  const p = {
    hipsPos: [0, 0.95 + Math.abs(c) * 0.025 * amt - 0.015 * amt, 0],
    spine: [0.06 * amt, 0, 0],
    chest: [0, s * 0.06 * amt, 0],
    neck: [0.02, 0, 0],
    shL: [-s * 0.45 * amt, 0, 0.1], shR: [s * 0.45 * amt, 0, -0.1],
    elL: [-0.25 - Math.max(0, -s) * 0.4 * amt, 0, 0], elR: [-0.25 - Math.max(0, s) * 0.4 * amt, 0, 0],
    hipL: [s * 0.5 * amt, 0, 0.02], hipR: [-s * 0.5 * amt, 0, -0.02],
    knL: [Math.max(0, -Math.sin(phase - 0.9)) * 0.9 * amt + 0.06, 0, 0],
    knR: [Math.max(0, Math.sin(phase - 0.9)) * 0.9 * amt + 0.06, 0, 0],
    anL: [-0.1 * s * amt, 0, 0], anR: [0.1 * s * amt, 0, 0],
  };
  return { ...base, ...p };
}
