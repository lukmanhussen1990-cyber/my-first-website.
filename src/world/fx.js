// Small living details: pot steam, breathing curtains, soft contact shadows.
import * as THREE from 'three';
import { radialSprite } from '../lib/textures.js';
import { hash1, noise1 } from '../lib/util.js';

const STEAM_N = 60;
const STEAM_LIFE = 2.8;

export function buildSteam(scene, origin) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STEAM_N * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(STEAM_N), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(STEAM_N), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { tSprite: { value: radialSprite({ size: 128 }) }, uColor: { value: new THREE.Color(1, 0.93, 0.82) }, uScale: { value: 1920 * 0.5 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uScale * projectionMatrix[1][1] / -mv.z, 900.0); vA = aAlpha; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ vec2 p = gl_PointCoord - 0.5; float d2 = dot(p, p) * 4.0;
        float a = exp(-d2 * 3.2) * (1.0 - smoothstep(0.75, 1.0, d2));
        gl_FragColor = vec4(uColor, a * vA); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts, geo, mat, origin: origin.clone() };
}

export function updateSteam(steam, t, strength = 1) {
  const p = steam.geo.attributes.position.array;
  const s = steam.geo.attributes.aSize.array;
  const a = steam.geo.attributes.aAlpha.array;
  for (let i = 0; i < STEAM_N; i++) {
    const phase = hash1(i * 3.1) * STEAM_LIFE;
    const life = ((t + phase) % STEAM_LIFE) / STEAM_LIFE; // 0..1
    const gen = Math.floor((t + phase) / STEAM_LIFE);
    const seed = i * 13.7 + gen * 5.3;
    const rise = life * 0.55;
    const sx = (hash1(seed) - 0.5) * 0.16 + noise1(t * 0.7 + seed, 2) * 0.09 * life;
    const sz = (hash1(seed + 1) - 0.5) * 0.16 + noise1(t * 0.6 + seed, 5) * 0.09 * life;
    p[i * 3] = steam.origin.x + sx;
    p[i * 3 + 1] = steam.origin.y + rise;
    p[i * 3 + 2] = steam.origin.z + sz;
    s[i] = 0.05 + life * 0.16;
    a[i] = Math.sin(Math.PI * Math.min(1, life * 1.15)) * 0.11 * strength;
  }
  steam.geo.attributes.position.needsUpdate = true;
  steam.geo.attributes.aSize.needsUpdate = true;
  steam.geo.attributes.aAlpha.needsUpdate = true;
}

export function updateCurtains(curtains, t, gust = 0) {
  for (const c of curtains) {
    const geo = c.geometry;
    const base = geo.userData.base;
    const pos = geo.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = base[i], y = base[i + 1];
      const hang = (1.2 - y) / 2.4; // 0 at the rod, 1 at the hem
      const pleat = Math.sin((x + 0.31) * 38) * 0.035;
      const sway = (Math.sin(t * 0.9 + y * 1.3 + c.userData.side) * 0.018 + noise1(t * 0.5 + x * 2, 7) * 0.02 * (1 + gust)) * hang;
      pos[i] = x + Math.sin(t * 0.7 + y * 2.1) * 0.006 * hang;
      pos[i + 2] = pleat + sway;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }
}

// Soft contact shadows (multiply decals) - cheap ambient occlusion where things touch the floor.
export function addContactShadows(scene, list) {
  // opaque white->black falloff; blended as dst * (1 - src) so white = darkest
  const tex = radialSprite({ size: 128, inner: 'rgb(255,255,255)', outer: 'rgb(0,0,0)' });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, color: 0xffffff });
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.ZeroFactor;
  mat.blendDst = THREE.OneMinusSrcColorFactor;
  for (const [x, z, w, d, strength = 0.5, y = 0.008] of list) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.clone());
    m.material.color.setScalar(strength);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 1;
    scene.add(m);
  }
}
