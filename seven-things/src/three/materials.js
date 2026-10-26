// Material factories. World = flat-shaded matte Lambert. Characters = unlit flat colour with a
// global mood multiplier + outlines extruded in the vertex shader (width set per character).
import * as THREE from 'three';

export const OUTLINE = '#2b1d14';

// shared uniforms (updated every frame by the timeline)
export const U = {
  uCharLight: { value: new THREE.Color(1, 1, 1) },
  uTime: { value: 0 },
  uWind: { value: 1 },
};

const matteCache = new Map();
export function matte(hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (!opts.unique && matteCache.has(key)) return matteCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color: hex, flatShading: true, ...opts.params });
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  if (!opts.unique) matteCache.set(key, m);
  return m;
}

// Unlit colour that still follows the scene mood (and fog)
function patchCharLight(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCharLight = U.uCharLight;
    sh.fragmentShader = 'uniform vec3 uCharLight;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight *= uCharLight;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'charLight';
  return m;
}

const flatCache = new Map();
export function flat(hex) {
  if (flatCache.has(hex)) return flatCache.get(hex);
  const m = patchCharLight(new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, fog: true }));
  flatCache.set(hex, m);
  return m;
}

// Outline material: every vertex is pushed along its precomputed miter vector by uOutline.
export function outlineMaterial(width = 0.014, hex = OUTLINE) {
  const m = new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, fog: true });
  m.userData.uOutline = { value: width };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOutline = m.userData.uOutline;
    sh.uniforms.uCharLight = U.uCharLight;
    sh.vertexShader = 'attribute vec2 miter;\nuniform float uOutline;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.xy += miter * uOutline;');
    sh.fragmentShader = 'uniform vec3 uCharLight;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight *= mix(vec3(1.0), uCharLight, 0.6);\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'outline2d';
  return m;
}

// Inverted-hull outline for low-poly 3D animals/props (BackSide, scaled copy)
const hullCache = new Map();
export function hullMat(hex = OUTLINE) {
  if (hullCache.has(hex)) return hullCache.get(hex);
  const m = new THREE.MeshBasicMaterial({ color: hex, side: THREE.BackSide, fog: true });
  hullCache.set(hex, m);
  return m;
}

// Additive glow material (bright values > 1 feed the bloom pass)
export function glowMat(rgb, opacity = 1, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(...rgb), transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: opts.side ?? THREE.DoubleSide, map: opts.map ?? null,
  });
}

// Soft radial gradient texture (white centre -> transparent)
let _radial = null;
export function radialTex() {
  if (_radial) return _radial;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c);
  return _radial;
}

// Linear fade texture along v (opaque at v=0 -> clear at v=1)
let _fade = null;
export function fadeTex() {
  if (_fade) return _fade;
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  _fade = new THREE.CanvasTexture(c);
  return _fade;
}
