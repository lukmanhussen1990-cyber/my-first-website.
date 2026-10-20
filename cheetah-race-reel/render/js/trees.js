import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURSE, groundHeight, trackDist, RIVER_X } from './course.js';
import { mulberry32, fbm, GLSL_NOISE } from './util.js';
import { SUN_DIR } from './sky.js';

// Savanna scenery: umbrella-thorn acacias, bushes, a rock outcrop (kopje) on
// the inside of the corner, termite mounds and hazy hills on the horizon.

function lumpy(detail, amp, seed, flatTop = 0) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let s = 1 + amp * fbm(v.x * 1.7 + seed, v.y * 1.7 + v.z * 1.3 - seed, 3);
    v.multiplyScalar(s);
    if (flatTop && v.y > 0) v.y *= 1 - flatTop;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
  return g.toNonIndexed();
}

function foliageMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSun = { value: SUN_DIR.clone() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform vec3 uSun;\nvarying vec3 vWP;\n${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = fbm3(vWP * 1.4), f = vnoise3(vWP * 9.0);
        vec3 leaf = mix(vec3(0.07, 0.1, 0.035), vec3(0.2, 0.24, 0.07), n);
        leaf = mix(leaf, vec3(0.32, 0.3, 0.1), smoothstep(0.6, 0.9, f) * 0.5);
        diffuseColor.rgb = leaf * diffuseColor.rgb;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float hh = vnoise3(vWP * 7.0) * 0.06 + vnoise3(vWP * 23.0) * 0.02;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(hh), dhy = dFdy(hh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 V = normalize(cameraPosition - vWP);
          float back = pow(max(dot(-V, uSun), 0.0), 4.0);
          float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
          totalEmissiveRadiance += vec3(1.0, 0.55, 0.2) * back * rim * 0.35;
        }`);
  };
  return m;
}

function barkMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.95 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP;\n${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = vnoise3(vec3(vWP.x * 8.0, vWP.y * 1.5, vWP.z * 8.0));
        diffuseColor.rgb *= 0.75 + 0.45 * n;`);
  };
  return m;
}

function rockMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP;\n${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = fbm3(vWP * 1.3), f = vnoise3(vWP * 12.0);
        vec3 c = mix(vec3(0.42, 0.33, 0.27), vec3(0.66, 0.55, 0.45), n);
        c = mix(c, vec3(0.75, 0.68, 0.55), smoothstep(0.62, 0.8, vnoise3(vWP * 3.0)) * 0.5); // lichen patches
        diffuseColor.rgb = c * (0.85 + 0.25 * f);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float hh = fbm3(vWP * 4.0) * 0.05 + vnoise3(vWP * 18.0) * 0.008;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(hh), dhy = dFdy(hh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
        }`);
  };
  return m;
}

function makeAcacia(rnd, M, scale = 1) {
  const g = new THREE.Group();
  const H = (4.2 + rnd() * 2.2) * scale;      // canopy height
  const R = (3.0 + rnd() * 2.0) * scale;      // canopy radius
  const fork = (1.5 + rnd() * 1.0) * scale;
  const lean = (rnd() - 0.5) * 0.6;
  const trunkPts = [new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(lean * 0.3, fork * 0.5, 0.05), new THREE.Vector3(lean * 0.6, fork, 0)];
  const geos = [];
  geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 8, 0.16 * scale, 7, false));
  const nb = 3 + Math.floor(rnd() * 3);
  const tips = [];
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + rnd() * 0.8;
    const r = R * (0.45 + rnd() * 0.45);
    const tip = new THREE.Vector3(Math.cos(a) * r + lean * 0.6, H - 0.2 - rnd() * 0.5, Math.sin(a) * r);
    const mid = new THREE.Vector3(Math.cos(a) * r * 0.35 + lean * 0.6, fork + (H - fork) * 0.55, Math.sin(a) * r * 0.35);
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([trunkPts[2].clone(), mid, tip]), 10, 0.075 * scale, 6, false));
    // twigs
    for (let k = 0; k < 2; k++) {
      const b = a + (rnd() - 0.5) * 1.6;
      const t2 = tip.clone().add(new THREE.Vector3(Math.cos(b) * R * 0.3, 0.15, Math.sin(b) * R * 0.3));
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([mid.clone().lerp(tip, 0.6), t2]), 4, 0.035 * scale, 5, false));
    }
    tips.push(tip);
  }
  const bark = new THREE.Mesh(mergeGeometries(geos.map((x) => x.toNonIndexed())), M.bark);
  bark.castShadow = true; bark.receiveShadow = true;
  g.add(bark);
  // flat-topped canopy of lumpy clusters
  const cl = [];
  const nc = 9 + Math.floor(rnd() * 6);
  for (let i = 0; i < nc; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 0.95;
    const sx = (1.0 + rnd() * 0.9) * scale, sy = (0.32 + rnd() * 0.22) * scale, sz = (1.0 + rnd() * 0.9) * scale;
    const geo = M.blob[Math.floor(rnd() * M.blob.length)].clone();
    geo.scale(sx, sy, sz);
    geo.rotateY(rnd() * 6.28);
    geo.translate(Math.cos(a) * r + lean * 0.6, H + (rnd() - 0.5) * 0.25 * scale - (r / R) * 0.25 * scale, Math.sin(a) * r);
    cl.push(geo);
  }
  const canopy = new THREE.Mesh(mergeGeometries(cl), M.leaf);
  canopy.castShadow = true; canopy.receiveShadow = true;
  g.add(canopy);
  return g;
}

function makeBush(rnd, M, scale = 1) {
  const cl = [];
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const geo = M.blob[Math.floor(rnd() * M.blob.length)].clone();
    const s = (0.35 + rnd() * 0.35) * scale;
    geo.scale(s * (1 + rnd() * 0.4), s * 0.8, s * (1 + rnd() * 0.4));
    geo.translate((rnd() - 0.5) * scale, s * 0.55, (rnd() - 0.5) * scale);
    cl.push(geo);
  }
  const m = new THREE.Mesh(mergeGeometries(cl), M.leaf);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function makeScenery() {
  const group = new THREE.Group();
  const M = {
    leaf: foliageMaterial(),
    bark: barkMaterial(),
    rock: rockMaterial(),
    mound: new THREE.MeshStandardMaterial({ color: 0x9a5a34, roughness: 0.95 }),
    blob: [lumpy(2, 0.35, 1.3, 0.25), lumpy(2, 0.4, 7.1, 0.3), lumpy(2, 0.3, 3.7, 0.2)],
  };
  const rockGeos = [lumpy(3, 0.22, 2.2), lumpy(3, 0.28, 5.5), lumpy(2, 0.3, 9.1)];
  const rnd = mulberry32(777);
  const trees = [];
  const okSpot = (x, z, clear) => trackDist(x, z).d > COURSE.TRACK_HALF + clear && Math.abs(x - RIVER_X(z)) > COURSE.RIVER_W / 2 + 2.5;

  // hand-placed hero trees (composition) + scattered ones
  const hero = [[-6, -15.5, 1.05], [14, -22, 1.2], [36, -16.5, 0.95], [62, -24, 1.15], [80, -19.5, 1.0], [112, -27, 1.1], [138, -24, 1.0],
    [166, -16.5, 1.1], [201, -18.5, 1.05], [228, -26, 1.2], [252, -16.5, 0.95], [281, -21, 1.1], [304, -17, 1.0], [336, -16, 1.15], [356, -24, 1.0], [384, -18, 1.1]];
  const spots = hero.map(([x, z, s]) => ({ x, z, s }));
  for (let i = 0; i < 70; i++) {
    const x = COURSE.X0 + rnd() * (COURSE.X1 - COURSE.X0), z = -26 - rnd() * 80;
    spots.push({ x, z, s: 0.8 + rnd() * 0.5 });
  }
  for (const sp of spots) {
    if (!okSpot(sp.x, sp.z, 3)) continue;
    const t = makeAcacia(rnd, M, sp.s);
    t.position.set(sp.x, groundHeight(sp.x, sp.z), sp.z);
    t.rotation.y = rnd() * 6.28;
    group.add(t); trees.push(t);
  }
  // bushes
  for (let i = 0; i < 160; i++) {
    const x = COURSE.X0 + rnd() * (COURSE.X1 - COURSE.X0), z = -11 - rnd() * 50;
    if (!okSpot(x, z, 1.5)) continue;
    const b = makeBush(rnd, M, 0.8 + rnd() * 0.8);
    b.position.set(x, groundHeight(x, z) - 0.05, z);
    group.add(b);
  }
  // kopje on the inside of the corner + scattered rocks
  const rocks = [];
  const kop = [[84.5, -13.2, 1.6], [87.5, -14.5, 2.1], [85, -16.8, 1.4], [89.8, -12.2, 1.1], [82.5, -15.5, 1.0], [88.5, -17.4, 1.2], [91.5, -15.2, 0.8], [86.5, -11.6, 0.7]];
  for (const [x, z, s] of kop) rocks.push({ x, z, s, sy: 0.75 });
  for (let i = 0; i < 90; i++) {
    const x = COURSE.X0 + rnd() * (COURSE.X1 - COURSE.X0), z = -1 - rnd() * 45;
    if (!okSpot(x, z, 0.8)) continue;
    rocks.push({ x, z, s: 0.15 + Math.pow(rnd(), 2.5) * 0.6, sy: 0.6 });
  }
  for (const r of rocks) {
    const m = new THREE.Mesh(rockGeos[Math.floor(rnd() * rockGeos.length)], M.rock);
    m.scale.set(r.s * (1 + rnd() * 0.3), r.s * r.sy, r.s * (1 + rnd() * 0.3));
    m.rotation.y = rnd() * 6.28;
    m.position.set(r.x, groundHeight(r.x, r.z) + r.s * r.sy * 0.35, r.z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  // termite mounds
  for (const [x, z, h] of [[24, -14.5, 1.6], [128, -30, 2.2], [214, -13.5, 1.4], [270, -19, 1.9], [343, -13.8, 1.5]]) {
    if (!okSpot(x, z, 1.5)) continue;
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2((1 - t) * (0.55 + 0.25 * Math.sin(t * 9)) * h * 0.45 + 0.02, t * h)); }
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), M.mound);
    m.position.set(x, groundHeight(x, z) - 0.05, z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  // distant hills: two hazy layers far behind the slice
  const hillMat = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });
  for (const [z, hmax, col, seed] of [[-420, 30, new THREE.Color(0.95, 0.5, 0.26), 1], [-650, 64, new THREE.Color(0.7, 0.36, 0.34), 4]]) {
    const pos = [], idx = [];
    const n = 220;
    for (let i = 0; i <= n; i++) {
      const x = -900 + (2200 * i) / n;
      const h = hmax * (0.35 + 0.65 * Math.max(0, fbm(x * 0.004 + seed, seed * 3.1, 4) + 0.45));
      pos.push(x, -20, z, x, h, z);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, hillMat(col));
    m.renderOrder = -500;
    group.add(m);
  }
  return { group, trees };
}
