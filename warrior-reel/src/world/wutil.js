// World-module helpers: 2D value noise, faceted geometry utilities, material patching (wind sway).
// Everything deterministic (integer hashing, no Math.random).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- deterministic 2D noise ----------
export function hash2(i, j, s = 0) {
  let h = (i * 374761393 + j * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function noise2(x, z, s = 0) {
  const i = Math.floor(x), j = Math.floor(z);
  const fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm2(x, z, s = 0) {
  return noise2(x, z, s) * 0.55 + noise2(x * 2.03 + 5.2, z * 2.03 + 1.3, s + 1) * 0.3 + noise2(x * 4.1 + 9.1, z * 4.1 + 3.7, s + 2) * 0.15;
}

// ---------- geometry ----------
// Non-indexed copy with flat (per-face) normals, so lighting/shadow normal bias match the facets.
export function flatten(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

// Per-face box-projected UVs (dominant axis of the face normal) in world-ish units * scale.
export function boxUV(geo, scale = 1, offset = [0, 0]) {
  const pos = geo.attributes.position, n = pos.count;
  const uv = new Float32Array(n * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    nrm.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const ax = Math.abs(nrm.x), ay = Math.abs(nrm.y), az = Math.abs(nrm.z);
    for (let k = 0; k < 3; k++) {
      const p = k === 0 ? a : k === 1 ? b : c;
      let u, v;
      if (ay >= ax && ay >= az) { u = p.x; v = p.z; }
      else if (ax >= az) { u = p.z; v = p.y; }
      else { u = p.x; v = p.y; }
      uv[(i + k) * 2] = u * scale + offset[0];
      uv[(i + k) * 2 + 1] = v * scale + offset[1];
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Per-face colour from a callback (faceCentre, faceNormal, faceIndex) -> THREE.Color (linear).
export function faceColors(geo, fn) {
  const pos = geo.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3(), ctr = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    nrm.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    ctr.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    const cc = fn(ctr, nrm, i / 3);
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = cc.r; col[(i + k) * 3 + 1] = cc.g; col[(i + k) * 3 + 2] = cc.b; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Per-vertex colour from a callback (position, normal, index) -> THREE.Color.
export function vertexColors(geo, fn) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
  const col = new Float32Array(n * 3);
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    if (nor) q.fromBufferAttribute(nor, i);
    const cc = fn(p, q, i);
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Keep only the given attributes (so heterogeneous geometries can be merged).
export function keepAttrs(geo, names = ['position', 'normal', 'uv', 'color']) {
  for (const k of Object.keys(geo.attributes)) if (!names.includes(k)) geo.deleteAttribute(k);
  for (const k of names) {
    if (geo.attributes[k]) continue;
    const n = geo.attributes.position.count;
    const size = k === 'uv' ? 2 : 3;
    const arr = new Float32Array(n * size);
    if (k === 'color') arr.fill(1);
    geo.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return geo;
}

export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => keepAttrs(g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(list, false);
  m.computeBoundingSphere();
  m.computeBoundingBox();
  return m;
}

// Cylinder segment from point a to point b (faceted), returns non-indexed geometry with uv scaled to metres.
const _up = new THREE.Vector3(0, 1, 0);
export function limb(a, b, ra, rb, seg = 7, uvScale = 2, twist = 0) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, seg, Math.max(1, Math.round(len / 0.9)), false);
  g.rotateY(twist);
  const uv = g.attributes.uv;
  const circ = Math.PI * (ra + rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ * uvScale, uv.getY(i) * len * uvScale);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return flatten(g);
}

// ---------- material patching ----------
// Shared animated uniforms for every world material that sways.
export const WIND = { uTime: { value: 0 }, uWind: { value: 0.5 } };

// Replace the projection step so a displacement in mesh-local (post-instance) space can be added.
// `swayGLSL` is a GLSL snippet that may read `pos` (vec3, local post-instance position), `inst` (vec3 instance
// origin or vec3(0)), `objPos` (vec3 original transformed) and must write `vec3 sway`.
export function patchSway(material, swayGLSL, { extraAttribs = '', colorMix = null } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = WIND.uTime;
    shader.uniforms.uWind = WIND.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uWind;\n${extraAttribs}`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        vec3 inst = vec3(0.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          inst = instanceMatrix[3].xyz;
        #endif
        {
          vec3 pos = mvPosition.xyz; vec3 objPos = transformed; vec3 sway = vec3(0.0);
          ${swayGLSL}
          mvPosition.xyz += sway;
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    if (colorMix) shader.vertexShader = shader.vertexShader.replace('vColor.xyz *= instanceColor.xyz;', colorMix);
  };
  const key = 'sway:' + swayGLSL + '|' + (colorMix || '') + '|' + extraAttribs;
  material.customProgramCacheKey = () => key;
  return material;
}

// ---------- height fog (global ShaderChunk patch) ----------
// FogExp2's `fogDensity` is used as the ground-mist base density; distance haze = fogDensity * HAZE_K.
// Mist density decays exponentially with world height (scale MIST_H), integrated analytically along the ray,
// so hill bases melt into white mist while hill tops / the castle stay readable.
let fogPatched = false;
export function patchHeightFog({ mistH = 6.5, mistBase = 0.0, hazeK = 0.2, start = 3.0 } = {}) {
  if (fogPatched) return;
  fogPatched = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `
#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogWorldY;
#endif`;
  C.fog_vertex = `
#ifdef USE_FOG
  vFogDepth = length( mvPosition.xyz );
  vFogWorldY = ( transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[3].xyz ) ).y;
#endif`;
  C.fog_pars_fragment = `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying float vFogWorldY;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  C.fog_fragment = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogDist = max( 0.0, vFogDepth - ${start.toFixed(2)} );
    float hazeD = fogDensity * ${hazeK.toFixed(3)};
    float fogHaze = 1.0 - exp( - hazeD * hazeD * fogDist * fogDist );
    float fy0 = max( cameraPosition.y - ${mistBase.toFixed(2)}, 0.0 );
    float fy1 = max( vFogWorldY - ${mistBase.toFixed(2)}, 0.0 );
    float fdy = fy1 - fy0;
    float fe0 = exp( - fy0 / ${mistH.toFixed(2)} );
    float fg = abs( fdy ) < 0.05 ? fe0 : ${mistH.toFixed(2)} * ( fe0 - exp( - fy1 / ${mistH.toFixed(2)} ) ) / fdy;
    float fogMist = 1.0 - exp( - fogDensity * fogDist * fg );
    float fogFactor = 1.0 - ( 1.0 - fogHaze ) * ( 1.0 - fogMist );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}
