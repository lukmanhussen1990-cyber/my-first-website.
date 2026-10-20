import * as THREE from 'three';
import { COURSE, groundHeight, trackDist, RIVER_X } from './course.js';
import { mulberry32, smoothstep } from './util.js';
import { SUN_DIR } from './sky.js';

// Golden savanna grass: instanced blades, bent and swayed in the vertex
// shader (wind gusts roll across the field, plus a push from passing racers),
// glowing at the tips when backlit by the low sun.

const CHUNK = 10;

function bladeGeometry() {
  const seg = 4;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < seg; i++) {
    const t = i / seg, w = 0.5 * (1 - t * 0.85);
    pos.push(-w, t, 0, w, t, 0); uv.push(0, t, 1, t);
  }
  pos.push(0, 1, 0); uv.push(0.5, 1);
  for (let i = 0; i < seg - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const a = (seg - 1) * 2; idx.push(a, a + 1, seg * 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

export function makeGrassMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: SUN_DIR.clone() },
    uPush: { value: [new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0)] }, // x, z, radius, strength
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aOffset;   // x, y, z, yaw
        attribute vec4 aShape;    // height, width, lean, phase
        attribute vec3 aTint;
        uniform float uTime;
        uniform vec4 uPush[2];
        varying float vT;
        varying vec3 vTint;
        varying vec3 vWPosG;`)
      .replace('#include <beginnormal_vertex>', `
        float t = uv.y;
        float yaw = aOffset.w;
        float cs = cos(yaw), sn = sin(yaw);
        vec2 base = aOffset.xz;
        // wind: slow gusts rolling along +x plus a quick flutter
        float gust = sin(dot(base, vec2(0.21, 0.07)) - uTime * 1.6) * 0.5 + 0.5;
        gust = gust * gust;
        float flutter = sin(uTime * 3.7 + aShape.w * 6.28 + base.x * 0.9) * 0.5;
        vec2 wind = vec2(0.9, 0.35) * (0.18 + 0.55 * gust) + vec2(0.3, 0.6) * flutter * 0.12;
        // push away from passing racers / thruster blasts
        for (int i = 0; i < 2; i++) {
          vec2 d = base - uPush[i].xy;
          float r = length(d);
          float k = uPush[i].w * smoothstep(uPush[i].z, 0.0, r);
          wind += normalize(d + 1e-4) * k;
        }
        float lean = aShape.z;
        vec2 bendDir = vec2(cs, -sn) * lean + wind;
        float bend = t * t;
        vec3 objectNormal = normalize(vec3(-sn, 0.35, cs) + vec3(bendDir.x, 0.0, bendDir.y) * 0.3);
        objectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), 0.45));`)
      .replace('#include <begin_vertex>', `
        float h = aShape.x;
        vec3 transformed = vec3(position.x * aShape.y, position.y * h, 0.0);
        // rotate the flat blade by yaw (about y)
        transformed = vec3(transformed.x * cs, transformed.y, -transformed.x * sn);
        transformed.xz += bendDir * bend * h * 0.9;
        transformed.y -= length(bendDir) * bend * h * 0.25;
        transformed += aOffset.xyz;
        vT = t; vTint = aTint;
        vWPosG = transformed;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <worldpos_vertex>', `
        vec4 worldPosition = vec4(transformed, 1.0);`)
      .replace('#include <defaultnormal_vertex>', `
        vec3 transformedNormal = normalMatrix * objectNormal;
        transformedNormal = normalize(mat3(viewMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = 1.0; // both blade sides share the up-leaning normal
        vec3 normal = normalize(vNormal);
        vec3 nonPerturbedNormal = normal;`)
      .replace('#include <common>', `#include <common>
        uniform vec3 uSun;
        varying float vT;
        varying vec3 vTint;
        varying vec3 vWPosG;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 baseC = vec3(0.2, 0.15, 0.07), midC = vec3(0.62, 0.47, 0.2), tipC = vec3(0.95, 0.78, 0.42);
        vec3 gc = mix(baseC, midC, smoothstep(0.0, 0.45, vT));
        gc = mix(gc, tipC, smoothstep(0.4, 1.0, vT));
        diffuseColor.rgb = gc * vTint;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 V = normalize(cameraPosition - vWPosG);
          float back = pow(max(dot(-V, uSun), 0.0), 3.0);
          totalEmissiveRadiance += vec3(1.0, 0.62, 0.25) * back * smoothstep(0.25, 1.0, vT) * 0.55 * vTint;
        }`);
  };
  m.userData.uniforms = uniforms;
  return m;
}

function densityAt(x, z) {
  const { d } = trackDist(x, z);
  if (d < COURSE.TRACK_HALF - 0.15) return 0;
  const rd = Math.abs(x - RIVER_X(z));
  if (rd < COURSE.RIVER_W / 2 + 0.4) return 0;
  let dens;
  if (z > -1.8) dens = 260;
  else if (z > -26) dens = 95;
  else if (z > -55) dens = 26;
  else if (z > -90) dens = 6;
  else return 0;
  // thinner right at the track edge and on the river banks, patchy overall
  dens *= smoothstep(COURSE.TRACK_HALF - 0.15, COURSE.TRACK_HALF + 1.2, d) * 0.85 + 0.15;
  dens *= 0.35 + 0.65 * smoothstep(COURSE.RIVER_W / 2 + 0.4, COURSE.RIVER_W / 2 + 3, rd);
  return dens;
}

export function makeGrass() {
  const mat = makeGrassMaterial();
  const geo = bladeGeometry();
  const group = new THREE.Group();
  const chunks = [];
  for (let x0 = COURSE.X0; x0 < COURSE.X1; x0 += CHUNK) {
    const rnd = mulberry32(9000 + Math.round(x0 * 7));
    const off = [], shp = [], tint = [];
    // stratified sampling over the chunk in z bands
    const bands = [[0, -1.8, 260], [-1.8, -26, 95], [-26, -55, 26], [-55, -90, 6]];
    for (const [za, zb, maxD] of bands) {
      const area = CHUNK * (za - zb);
      const n = Math.round(area * maxD);
      for (let i = 0; i < n; i++) {
        const x = x0 + rnd() * CHUNK, z = zb + rnd() * (za - zb);
        const dens = densityAt(x, z);
        if (rnd() * maxD > dens) continue;
        // clumping: modulate with low-frequency noise
        const clump = 0.5 + 0.5 * Math.sin(x * 1.7 + Math.sin(z * 1.3) * 2.0) * Math.sin(z * 2.1 + x * 0.4);
        if (rnd() > 0.35 + 0.65 * clump) continue;
        const y = groundHeight(x, z) - 0.02;
        const far = smoothstep(-20, -70, z);
        const front = z > -1.8 ? 1 : 0;
        const h = (front ? 0.2 + rnd() * 0.24 : 0.32 + rnd() * 0.5) * (1 + far * 0.6);
        const w = (0.022 + rnd() * 0.02) * (1 + far * 2.2);
        off.push(x, y, z, rnd() * Math.PI * 2);
        shp.push(h, w, 0.12 + rnd() * 0.35, rnd());
        const v = 0.8 + rnd() * 0.4;
        const g = rnd();
        tint.push(v * (g < 0.15 ? 0.8 : 1.0), v * (g < 0.15 ? 0.95 : 1.0), v * (g < 0.15 ? 0.7 : 1.0));
      }
    }
    if (!off.length) continue;
    const g = geo.clone();
    g.instanceCount = off.length / 4;
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(off), 4));
    g.setAttribute('aShape', new THREE.InstancedBufferAttribute(new Float32Array(shp), 4));
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tint), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + CHUNK / 2, 0.5, -45), Math.hypot(CHUNK / 2, 46, 2));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(x0 - 1, -2, -91), new THREE.Vector3(x0 + CHUNK + 1, 2, 0.5));
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
    chunks.push(mesh);
  }
  return { group, mat, chunks, update(time) { mat.userData.uniforms.uTime.value = time; } };
}
