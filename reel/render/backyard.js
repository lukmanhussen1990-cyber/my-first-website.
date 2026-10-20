// Golden-hour backyard: striped lawn (with the hole), a two-story beige house
// with blue shutters, trees, bushes, flowers and a fence.
import * as THREE from 'three';
import { NOISE } from './lib/glsl.js';
import { LAYOUT } from './layout.js';
import { CUT_PLANE } from './earth.js';
import { rng } from './lib/util.js';

const L = LAYOUT;

function lawnMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nuniform float uHoleR;\n${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (length(vWPos.xz - vec2(0.0, ${L.TUNNEL_Z.toFixed(3)})) < uHoleR) discard;
        if (vWPos.z > 0.0) discard;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float px = length(fwidth(vWPos));
        // mowing stripes run front-to-back, with a soft edge
        float st = smoothstep(-0.12, 0.12, sin(vWPos.x * 3.14159 / 1.6));
        vec3 g1 = vec3(0.16, 0.36, 0.07), g2 = vec3(0.24, 0.50, 0.11);
        vec3 c = mix(g1, g2, st);
        float n = fbm2(vWPos.xz * 0.6, px * 0.6, 4);
        float fine = fbm2(vWPos.xz * 9.0, px * 9.0, 3);
        c *= 0.86 + 0.18 * n + 0.12 * fine;
        c = mix(c, c * vec3(1.05, 1.0, 0.7), smoothstep(0.3, 0.7, snoise(vWPos.xz * 0.15)) * 0.3);
        diffuseColor.rgb = c;
        float bump = fine;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(bump) * 0.02, dhy = dFdy(bump) * 0.02;
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2)); }`);
  };
  mat.customProgramCacheKey = () => 'lawn';
  return mat;
}

function sidingMaterial(color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float boards = fract(vWPos.y / 0.2);
        float px = fwidth(vWPos.y / 0.2);
        float lip = smoothstep(0.0, 0.08 + px, boards) * (0.9 + 0.1 * boards);
        diffuseColor.rgb *= mix(0.72, 1.0, lip);`);
  };
  mat.customProgramCacheKey = () => 'siding';
  return mat;
}

function shingleMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x5d544e, roughness: 0.85 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv2 = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2;\nuniform vec2 uRoofSize;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 q = vUv2 * vec2(14.0, 3.8) * 4.0;
        float row = floor(q.y);
        float tab = fract(q.x + mod(row, 2.0) * 0.5);
        float edge = smoothstep(0.0, 0.08, fract(q.y)) ;
        float gap = smoothstep(0.0, 0.04, tab) * smoothstep(1.0, 0.96, tab);
        float h = fract(sin(dot(vec2(row, floor(q.x + mod(row,2.0)*0.5)), vec2(12.9898,78.233))) * 43758.5453);
        diffuseColor.rgb *= (0.75 + 0.3 * h) * mix(0.6, 1.0, edge) * mix(0.7, 1.0, gap);`);
  };
  mat.customProgramCacheKey = () => 'shingles';
  return mat;
}

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}

function buildHouse() {
  const house = new THREE.Group();
  const W = 10, D = 7, H = 6.0, RISE = 3.0;
  const siding = sidingMaterial(0xe3cfa8);
  const trim = new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.6 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2f5f9e, roughness: 0.55 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x3a4250, roughness: 0.08, metalness: 0.0,
    envMapIntensity: 2.2, emissive: new THREE.Color(1.0, 0.62, 0.3), emissiveIntensity: 0.25 });
  const found = new THREE.MeshStandardMaterial({ color: 0x8e8a84, roughness: 0.95 });
  // walls
  box(W, H, D, siding, 0, H / 2, -D / 2, house);
  box(W + 0.12, 0.45, D + 0.12, found, 0, 0.2, -D / 2, house);
  // gable roof
  const roofMat = shingleMaterial();
  const slope = Math.hypot(D / 2 + 0.5, RISE);
  for (const side of [1, -1]) {
    const g = new THREE.BoxGeometry(W + 1.0, 0.16, slope);
    const m = new THREE.Mesh(g, roofMat);
    const ang = Math.atan2(RISE, D / 2 + 0.5);
    m.position.set(0, H + RISE / 2 - 0.05, -D / 2 + side * (D / 4 + 0.25));
    m.rotation.x = side * ang;
    m.castShadow = true; m.receiveShadow = true;
    house.add(m);
  }
  // gable ends (triangles)
  const gableMat = siding.clone(); gableMat.side = THREE.DoubleSide;
  gableMat.onBeforeCompile = siding.onBeforeCompile; gableMat.customProgramCacheKey = siding.customProgramCacheKey;
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, RISE); tri.closePath();
  for (const side of [1, -1]) {
    const g = new THREE.ShapeGeometry(tri);
    const m = new THREE.Mesh(g, gableMat);
    m.rotation.y = Math.PI / 2 * side;
    m.position.set(side * W / 2, H, -D / 2);
    m.castShadow = true; house.add(m);
  }
  // ridge cap + fascia
  box(W + 1.05, 0.14, 0.3, trim, 0, H + RISE + 0.03, -D / 2, house);
  box(W + 1.0, 0.22, 0.12, trim, 0, H - 0.05, 0.42, house);
  // corner boards
  for (const x of [-W / 2, W / 2]) box(0.22, H, 0.22, trim, x, H / 2, -0.05, house);
  // windows with blue shutters
  const win = (x, y) => {
    box(1.2, 1.5, 0.1, trim, x, y, 0.04, house);
    const g = box(1.0, 1.3, 0.05, glassMat, x, y, 0.09, house); g.castShadow = false;
    box(0.06, 1.3, 0.06, trim, x, y, 0.12, house);
    box(1.0, 0.06, 0.06, trim, x, y + 0.05, 0.12, house);
    box(1.3, 0.1, 0.18, trim, x, y - 0.8, 0.1, house);
    for (const s of [-1, 1]) {
      const sh = box(0.52, 1.5, 0.06, blue, x + s * 0.9, y, 0.06, house);
      for (let k = 0; k < 9; k++) box(0.46, 0.035, 0.03, blue, x + s * 0.9, y - 0.62 + k * 0.155, 0.1, house);
      sh.castShadow = true;
    }
  };
  for (const x of [-3.2, 0, 3.2]) win(x, 4.4);
  for (const x of [-3.2, 3.2]) win(x, 1.6);
  // front door + little porch roof
  box(1.3, 2.4, 0.12, trim, 0, 1.4, 0.04, house);
  box(1.05, 2.2, 0.08, blue, 0, 1.32, 0.09, house);
  const knob = box(0.08, 0.08, 0.08, new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.3 }), 0.38, 1.25, 0.16, house);
  knob.castShadow = false;
  const porch = box(2.4, 0.12, 1.2, trim, 0, 2.75, 0.6, house);
  porch.rotation.x = 0.18;
  box(2.0, 0.18, 1.0, found, 0, 0.09, 0.55, house);
  // chimney
  box(0.9, 2.6, 0.9, new THREE.MeshStandardMaterial({ color: 0x8c4a3a, roughness: 0.9 }), 3.3, H + 2.1, -D / 2 - 1.0, house);
  return house;
}

function bushMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: false });
}
function blob(radius, detail, seed, amp = 0.18) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const r = rng(seed);
  const p = g.attributes.position;
  const off = [r() * 10, r() * 10, r() * 10];
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const n = Math.sin(v.x * 3.1 + off[0]) * Math.sin(v.y * 2.7 + off[1]) * Math.sin(v.z * 3.3 + off[2]);
    v.multiplyScalar(1 + n * amp + (r() - 0.5) * amp * 0.5);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function buildTree(seed, height, canopyR) {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, height, 10), new THREE.MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.9 }));
  trunk.position.y = height / 2; trunk.castShadow = true; t.add(trunk);
  const r = rng(seed);
  const leafMats = [bushMaterial(0x2f6a22), bushMaterial(0x3d7d2a), bushMaterial(0x285c1e)];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(blob(canopyR * (0.55 + r() * 0.35), 2, seed * 13 + i), leafMats[i % 3]);
    m.position.set((r() - 0.5) * canopyR * 1.2, height + (r() - 0.2) * canopyR * 0.9, (r() - 0.5) * canopyR * 1.2);
    m.castShadow = true; m.receiveShadow = true; t.add(m);
  }
  return t;
}

export function buildBackyard(scene) {
  const group = new THREE.Group(); group.name = 'backyard';
  const uniforms = { uHoleR: { value: 0 } };
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(140, 90, 1, 1), lawnMaterial(uniforms));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0, -45);
  lawn.receiveShadow = true; group.add(lawn);

  // Grass blades along the cut edge (the "frosting" on the cake slice).
  const bladeGeo = new THREE.ConeGeometry(0.012, 1, 3, 1); bladeGeo.translate(0, 0.5, 0);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3f7a1e, roughness: 0.8 });
  const N = 9000;
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, N);
  const r = rng(7), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const x = (r() - 0.5) * 36, z = -r() * 0.14;
    const h = 0.05 + r() * 0.09;
    e.set((r() - 0.5) * 0.7 + 0.15, r() * 6.28, (r() - 0.5) * 0.7);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, -0.01, z), q, new THREE.Vector3(1, h, 1));
    blades.setMatrixAt(i, m4);
    col.setHSL(0.26 + r() * 0.05, 0.6, 0.22 + r() * 0.14);
    blades.setColorAt(i, col);
  }
  blades.receiveShadow = true;
  group.add(blades);

  // House behind the hole, a little to the left.
  const house = buildHouse();
  house.position.set(-3.5, 0, -10.5);
  group.add(house);
  // Bushes + flowers along the house front.
  const bushMat = [bushMaterial(0x2e6b25), bushMaterial(0x3a7d2c)];
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(blob(0.55 + r() * 0.25, 2, 100 + i), bushMat[i % 2]);
    const x = -3.5 - 4.6 + i * 1.15;
    if (Math.abs(x + 3.5) < 0.9) continue;
    b.position.set(x, 0.38, -9.6 + (r() - 0.5) * 0.3);
    b.scale.y = 0.75; b.castShadow = true; b.receiveShadow = true; group.add(b);
  }
  const flowerGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 160);
  const fcols = [0xff5f8f, 0xffd23f, 0xffffff, 0xff8c42, 0xc86bff];
  for (let i = 0; i < 160; i++) {
    const x = -8.6 + r() * 10.2;
    m4.makeTranslation(x, 0.5 + r() * 0.35, -9.0 + r() * 0.5);
    flowers.setMatrixAt(i, m4);
    flowers.setColorAt(i, col.set(fcols[i % fcols.length]));
  }
  group.add(flowers);
  // Trees.
  const t1 = buildTree(3, 3.4, 2.1); t1.position.set(-12.5, 0, -12); group.add(t1);
  const t2 = buildTree(5, 3.8, 2.4); t2.position.set(6.5, 0, -15.5); group.add(t2);
  const t3 = buildTree(9, 3.0, 1.9); t3.position.set(11, 0, -9); group.add(t3);
  // Wooden fence behind.
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xb08a62, roughness: 0.85 });
  for (let x = -30; x <= 30; x += 0.2) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.8, 0.04), fenceMat);
    p.position.set(x, 0.9, -20); p.receiveShadow = true; group.add(p);
  }
  box(60, 0.1, 0.06, fenceMat, 0, 1.4, -19.96, group);
  box(60, 0.1, 0.06, fenceMat, 0, 0.5, -19.96, group);

  // Turf plug that drops into the pit when the hole opens.
  const dirt = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1, clippingPlanes: [CUT_PLANE] });
  const turfTop = new THREE.MeshStandardMaterial({ color: 0x356f1a, roughness: 0.95, clippingPlanes: [CUT_PLANE] });
  const turf = new THREE.Mesh(new THREE.CylinderGeometry(L.TUNNEL_R - 0.02, L.TUNNEL_R * 0.9, 0.35, 40), [dirt, turfTop, dirt]);
  turf.visible = false;
  turf.position.set(0, -0.175, L.TUNNEL_Z);
  turf.castShadow = true; turf.receiveShadow = true;
  group.add(turf);

  scene.add(group);
  return { group, uniforms, turf, house };
}
