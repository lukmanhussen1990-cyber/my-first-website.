// Material factories. World = flat-shaded matte Lambert. Characters = unlit flat colour with a
// global mood multiplier + outlines extruded in the vertex shader (width set per character).
import * as THREE from 'three';

export const OUTLINE = '#2b1d14';

// shared uniforms (updated every frame by the timeline)
export const U = {
  uCharLight: { value: new THREE.Color(1, 1, 1) },
  uTime: { value: 0 },
  uWind: { value: 1 },
  // a single warm point light (camp fire) that also lights the flat characters, + soft foot AO
  uPointPos: { value: new THREE.Vector3(0, -999, 0) },
  uPointColor: { value: new THREE.Color(0, 0, 0) },
  uPointRange: { value: 1 },
  uAO: { value: 0.18 },
  uGroundY: { value: 0 },
  // the scene's key light for two-tone cel shading of the flat characters (set by the engine each frame)
  uSunDir: { value: new THREE.Vector3(-0.5, 0.7, 0.45).normalize() },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  // character cel-shading controls (v3 rig; optional — sane defaults, a set may tweak them per mood)
  uShadeTone: { value: new THREE.Color(0.74, 0.75, 0.84) }, // multiplier of the shadow tone (~24 % darker, slightly cool)
  uCelWrap: { value: 0.22 },                               // >0 keeps more of the figure in the lit tone
  uRimPx: { value: 2.6 },                                  // warm rim width in screen px
  uRimK: { value: 1 },                                     // rim strength
  uPointShade: { value: 0.1 },                             // lamp light reaching the far (shadow) side
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

// Unlit colour that still follows the scene mood (and fog), the fire light and a soft foot AO
const CHAR_UNI = 'uniform vec3 uCharLight; uniform vec3 uPointPos; uniform vec3 uPointColor; uniform float uPointRange; uniform float uAO; uniform float uGroundY;\nvarying vec3 vWP;\n';
function patchCharLight(m, lineMix = 1) {
  m.onBeforeCompile = (sh) => {
    for (const k of ['uCharLight', 'uPointPos', 'uPointColor', 'uPointRange', 'uAO', 'uGroundY']) sh.uniforms[k] = U[k];
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = CHAR_UNI + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float ao = mix(1.0 - uAO, 1.0, smoothstep(0.0, 1.1, vWP.y - uGroundY));
       vec3 pl = uPointColor * pow(1.0 - smoothstep(0.0, uPointRange, distance(vWP, uPointPos)), 1.6);
       outgoingLight *= mix(vec3(1.0), uCharLight * ao + pl, ${lineMix.toFixed(2)});
       #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'charLight' + lineMix;
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
    for (const k of ['uCharLight', 'uPointPos', 'uPointColor', 'uPointRange', 'uAO', 'uGroundY']) sh.uniforms[k] = U[k];
    sh.vertexShader = 'attribute vec2 miter;\nuniform float uOutline;\nvarying vec3 vWP;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.xy += miter * uOutline;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = CHAR_UNI + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 pl = uPointColor * pow(1.0 - smoothstep(0.0, uPointRange, distance(vWP, uPointPos)), 1.6);
       outgoingLight *= mix(vec3(1.0), uCharLight + pl * 0.5, 0.6);
       #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'outline2d';
  return m;
}

// ---------------------------------------------------------------- v3 character materials
// One fill + one outline material PER PERSON (programs are shared). Parts are coplanar; their stacking
// order comes from a per-vertex `layer` that moves each vertex toward the camera along its own view ray
// (screen position unchanged, so no parallax between layers; depth precision kept by uLayerStep).
export const OUTLINE_CHAR = '#2a1810';
const LAYER_VS = (attr) => `
  vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
  float lr = (uLayerBase + ${attr} * uLayerScale) * uLayerStep;
  mvPosition.xyz *= max(0.05, 1.0 - lr / max(length(mvPosition.xyz), 1e-3));
  gl_Position = projectionMatrix * mvPosition;`;
const VS_HEAD = 'attribute float layer;\nattribute float olayer;\nattribute float tint;\nattribute vec2 miter;\nuniform float uLayerStep;\nuniform float uLayerBase;\nuniform float uLayerScale;\nuniform float uOutline;\nvarying vec3 vWP;\nvarying vec3 vTx;\nvarying vec3 vBy;\nvarying float vTint;\n';

export function charFillMaterial(atlas, uni) {
  const m = new THREE.MeshBasicMaterial({ map: atlas.colorTex, side: THREE.DoubleSide, fog: true });
  m.userData.uni = uni;
  m.onBeforeCompile = (sh) => {
    for (const k of ['uCharLight', 'uPointPos', 'uPointColor', 'uPointRange', 'uAO', 'uGroundY', 'uSunDir', 'uSunColor', 'uShadeTone', 'uCelWrap', 'uRimPx', 'uRimK', 'uPointShade']) sh.uniforms[k] = U[k];
    for (const k of ['uLayerStep', 'uLayerBase', 'uLayerScale', 'uOutline']) sh.uniforms[k] = uni[k];
    sh.uniforms.shapeMap = { value: atlas.shapeTex };
    sh.uniforms.shapeSize = { value: new THREE.Vector2(atlas.SW, atlas.SH) };
    sh.vertexShader = VS_HEAD + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = tint;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTx = mat3(modelMatrix) * vec3(1.0, 0.0, 0.0);\nvBy = mat3(modelMatrix) * vec3(0.0, 1.0, 0.0);')
      .replace('#include <project_vertex>', LAYER_VS('layer'));
    sh.fragmentShader = `uniform vec3 uCharLight; uniform vec3 uPointPos; uniform vec3 uPointColor; uniform float uPointRange; uniform float uAO; uniform float uGroundY;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uShadeTone; uniform float uCelWrap; uniform float uRimPx; uniform float uRimK; uniform float uPointShade;
uniform sampler2D shapeMap; uniform vec2 shapeSize;
varying vec3 vWP; varying vec3 vTx; varying vec3 vBy; varying float vTint;
` + sh.fragmentShader.replace('#include <opaque_fragment>', `
  {
    vec4 shp = texture2D(shapeMap, vMapUv);
    vec2 g2 = shp.rg * 2.0 - 1.0; float gl2 = length(g2); vec2 gd = gl2 > 0.05 ? g2 / gl2 : vec2(0.0);
    float xm = shp.b; float dTex = shp.a * 32.0;
    vec3 Tw = normalize(vTx), Bw = normalize(vBy);
    vec3 Fw = normalize(cross(Tw, Bw)); if (dot(Fw, cameraPosition - vWP) < 0.0) Fw = -Fw;
    vec3 N = normalize(Tw * gd.x * xm + Bw * gd.y * xm + Fw * sqrt(max(0.0, 1.0 - xm * xm)));
    vec3 Ls = normalize(uSunDir);
    float litS = smoothstep(-uCelWrap - 0.035, -uCelWrap + 0.035, dot(N, Ls));
    vec3 Lp = uPointPos - vWP; float dp = length(Lp); Lp /= max(dp, 1e-4);
    vec3 pl = uPointColor * pow(1.0 - smoothstep(0.0, uPointRange, dp), 1.6);
    float litP = smoothstep(-0.05, 0.05, dot(N, Lp) + 0.06);
    float ao = mix(1.0 - uAO, 1.0, smoothstep(0.0, 1.1, vWP.y - uGroundY));
    vec3 base = outgoingLight * vTint;
    vec3 col = base * (uCharLight * ao * mix(uShadeTone, vec3(1.0), litS) + pl * mix(uPointShade, 1.0, litP));
    float tpp = max(length(dFdx(vMapUv * shapeSize)), length(dFdy(vMapUv * shapeSize)));
    float dPx = dTex / max(tpp, 1e-4);
    float edge = 1.0 - smoothstep(uRimPx * 0.5, uRimPx, dPx);
    vec2 Ls2 = vec2(dot(Ls, Tw), dot(Ls, Bw)); vec2 Lp2 = vec2(dot(Lp, Tw), dot(Lp, Bw));
    float rimS = edge * smoothstep(0.2, 0.65, dot(gd, Ls2 / max(length(Ls2), 1e-4))) * smoothstep(0.08, 0.4, length(Ls2)) * (1.0 - 0.55 * max(dot(Ls, Fw), 0.0)) * litS;
    float rimP = edge * smoothstep(0.2, 0.65, dot(gd, Lp2 / max(length(Lp2), 1e-4))) * smoothstep(0.08, 0.4, length(Lp2));
    vec3 warm = vec3(1.0, 0.8, 0.55);
    col += (rimS * uSunColor * uCharLight * 0.6 + rimP * pl * 1.2) * warm * (0.3 + base) * uRimK;
    outgoingLight = col;
  }
  #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'charFill3';
  return m;
}

export function charOutlineMaterial(uni, hex = OUTLINE_CHAR) {
  const m = new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, fog: true });
  m.userData.uni = uni;
  m.onBeforeCompile = (sh) => {
    for (const k of ['uCharLight', 'uPointPos', 'uPointColor', 'uPointRange']) sh.uniforms[k] = U[k];
    for (const k of ['uLayerStep', 'uLayerBase', 'uLayerScale', 'uOutline']) sh.uniforms[k] = uni[k];
    sh.vertexShader = VS_HEAD + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xy += miter * uOutline;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      .replace('#include <project_vertex>', LAYER_VS('olayer'));
    sh.fragmentShader = 'uniform vec3 uCharLight; uniform vec3 uPointPos; uniform vec3 uPointColor; uniform float uPointRange;\nvarying vec3 vWP;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 pl = uPointColor * pow(1.0 - smoothstep(0.0, uPointRange, distance(vWP, uPointPos)), 1.6);
       outgoingLight *= mix(vec3(1.0), uCharLight + pl * 0.5, 0.6);
       #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'charOutline3';
  return m;
}

// Silhouette for paper "shadow puppets": drawn once per pixel (stencil), so overlapping parts
// don't stack darker. One material per puppet so the opacity can animate.
export function silhouetteMat(hex = '#1d1218', opacity = 0.5) {
  return new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: true,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.IncrementStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp,
  });
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
