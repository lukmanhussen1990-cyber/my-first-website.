// Mood palettes (sampled from the reference, see out/ref_style_notes.md §6) + blending.
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
export const MOODS = {
  build: { // bright warm green-gold — the building years
    fog: C('#e2cfa0'), fogNear: 40, fogFar: 300, skyTop: C('#a8c3cc'), skyHorizon: C('#efdfb4'), skyBottom: C('#c9b07a'),
    sunColor: C('#fff0d4'), sun: 3.0, sunDir: [-0.55, 0.62, -0.25], hemiSky: C('#fff3dc'), hemiGround: C('#9a8a5a'), hemi: 1.75,
    char: [1, 0.98, 0.95], sunGlow: C('#000000'),
    post: { hazeColor: C('#e6d3a2'), haze: 0.3, tint: [1.02, 1.0, 0.95], lift: [0.01, 0.005, 0], sat: 1.02, contrast: 1.03, exposure: 1.08, bloom: 0.35, bloomThreshold: 0.92, vignette: 0.42, grain: 0.032 },
  },
  clear: { // not one cloud
    fog: C('#dfe6e0'), fogNear: 60, fogFar: 420, skyTop: C('#4d8cc8'), skyHorizon: C('#d6e6ea'), skyBottom: C('#c9b07a'),
    sunColor: C('#fff6e4'), sun: 2.9, sunDir: [-0.4, 0.8, -0.2], hemiSky: C('#e8f2ff'), hemiGround: C('#8a7a4a'), hemi: 1.5,
    char: [1, 1, 1], sunGlow: C('#fff2c8'),
    post: { hazeColor: C('#d8e4ea'), haze: 0.0, tint: [0.98, 1.0, 1.03], lift: [0, 0, 0.01], sat: 1.06, contrast: 1.03, exposure: 1.02, bloom: 0.45, bloomThreshold: 0.9, vignette: 0.45, grain: 0.03 },
  },
  golden: { // invitation moments
    fog: C('#e9c37e'), fogNear: 30, fogFar: 260, skyTop: C('#e2b874'), skyHorizon: C('#f6d9a0'), skyBottom: C('#c99a5a'),
    sunColor: C('#ffd296'), sun: 2.5, sunDir: [-0.7, 0.38, -0.3], hemiSky: C('#ffe2b0'), hemiGround: C('#7a5a3a'), hemi: 1.35,
    char: [1.04, 0.95, 0.82], sunGlow: C('#ffcf80'),
    post: { hazeColor: C('#f2cd8e'), haze: 0.32, tint: [1.07, 0.98, 0.84], lift: [0.02, 0.01, 0], sat: 1.02, contrast: 1.05, exposure: 1.05, bloom: 0.45, bloomThreshold: 0.9, vignette: 0.5, grain: 0.034 },
  },
  storm: { // judgement weather
    fog: C('#68727c'), fogNear: 30, fogFar: 220, skyTop: C('#414b57'), skyHorizon: C('#7d8791'), skyBottom: C('#4a4e52'),
    sunColor: C('#b6c2d0'), sun: 0.9, sunDir: [-0.3, 0.8, 0.2], hemiSky: C('#8c98a6'), hemiGround: C('#3a3a3c'), hemi: 1.35,
    char: [0.64, 0.68, 0.76], sunGlow: C('#000000'),
    post: { hazeColor: C('#5d6770'), haze: 0.3, tint: [0.86, 0.92, 1.02], lift: [0, 0.005, 0.015], sat: 0.7, contrast: 1.06, exposure: 1.0, bloom: 0.55, bloomThreshold: 0.88, vignette: 0.7, grain: 0.04 },
  },
  lamp: { // inside the ark
    fog: C('#3a2414'), fogNear: 30, fogFar: 120, skyTop: C('#2a1a10'), skyHorizon: C('#2a1a10'), skyBottom: C('#2a1a10'),
    sunColor: C('#ffcf9a'), sun: 0.0, sunDir: [0, 1, 0], hemiSky: C('#ffcf9a'), hemiGround: C('#2a1a10'), hemi: 0.55,
    char: [1.0, 0.8, 0.6], sunGlow: C('#000000'),
    post: { hazeColor: C('#3a2414'), haze: 0.0, tint: [1.05, 0.93, 0.8], lift: [0.015, 0.008, 0], sat: 1.0, contrast: 1.06, exposure: 1.05, bloom: 0.5, bloomThreshold: 0.9, vignette: 0.7, grain: 0.04 },
  },
  pillar: { // golden pillar, hill of the cross
    fog: C('#c9a46a'), fogNear: 40, fogFar: 260, skyTop: C('#9c7a48'), skyHorizon: C('#d6b07a'), skyBottom: C('#a8874e'),
    sunColor: C('#ffd9a0'), sun: 1.15, sunDir: [-0.6, 0.45, -0.4], hemiSky: C('#ffe6b8'), hemiGround: C('#6a5034'), hemi: 0.85,
    char: [1.0, 0.94, 0.84], sunGlow: C('#ffd890'),
    post: { hazeColor: C('#e8cc92'), haze: 0.34, tint: [1.05, 0.98, 0.86], lift: [0.015, 0.01, 0], sat: 0.98, contrast: 1.05, exposure: 0.98, bloom: 0.5, bloomThreshold: 0.9, vignette: 0.5, grain: 0.034 },
  },
  dusk: { // modern city at dusk
    fog: C('#a8786a'), fogNear: 25, fogFar: 230, skyTop: C('#3d3a5c'), skyHorizon: C('#e8a066'), skyBottom: C('#6a5a5a'),
    sunColor: C('#ff9e60'), sun: 1.5, sunDir: [-0.85, 0.22, -0.25], hemiSky: C('#ffb894'), hemiGround: C('#3a3040'), hemi: 1.15,
    char: [1.0, 0.86, 0.78], sunGlow: C('#ff9a50'),
    post: { hazeColor: C('#c88a6a'), haze: 0.28, tint: [1.05, 0.94, 0.88], lift: [0.015, 0.005, 0.02], sat: 1.0, contrast: 1.05, exposure: 1.0, bloom: 0.5, bloomThreshold: 0.9, vignette: 0.52, grain: 0.036 },
  },
};

const lerpAny = (a, b, u) => {
  if (typeof a === 'number') return a + (b - a) * u;
  if (Array.isArray(a)) return a.map((x, i) => x + (b[i] - x) * u);
  if (a && a.isColor) return a.clone().lerp(b, u);
  if (a && typeof a === 'object') { const o = {}; for (const k of Object.keys(a)) o[k] = lerpAny(a[k], b[k] ?? a[k], u); return o; }
  return u < 0.5 ? a : b;
};
export function mood(a, b = null, u = 0) {
  const A = typeof a === 'string' ? MOODS[a] : a;
  if (!b || u <= 0) return A;
  const B = typeof b === 'string' ? MOODS[b] : b;
  if (u >= 1) return B;
  return lerpAny(A, B, u);
}

export function applyMood(m, ctx) {
  const { scene, sun, hemi, sky, U } = ctx;
  scene.fog.color.copy(m.fog); scene.fog.near = m.fogNear; scene.fog.far = m.fogFar;
  sky.material.uniforms.top.value.copy(m.skyTop); sky.material.uniforms.horizon.value.copy(m.skyHorizon); sky.material.uniforms.bottom.value.copy(m.skyBottom);
  sky.material.uniforms.sunGlow.value.copy(m.sunGlow);
  const d = new THREE.Vector3(...m.sunDir).normalize();
  sky.material.uniforms.sunDir.value.copy(d);
  sun.color.copy(m.sunColor); sun.intensity = m.sun; ctx.sunDir.copy(d);
  hemi.color.copy(m.hemiSky); hemi.groundColor.copy(m.hemiGround); hemi.intensity = m.hemi;
  U.uCharLight.value.setRGB(...m.char);
  const p = { ...m.post };
  p.tint = new THREE.Color(...m.post.tint); p.lift = new THREE.Color(...m.post.lift);
  return p;
}
