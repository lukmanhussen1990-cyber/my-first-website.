import * as THREE from 'three';
import { mulberry32, hash, noise1, clamp, lerp, smooth, ramp } from './util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Low-poly worlds: flat-shaded matte geometry, long soft shadows, hazy fog that
// melts into a gradient sky (see ref_style_notes.md §2).

// ---------------------------------------------------------------- palettes
export const PAL = {
  duskCity:  { skyTop: '#4d4868', skyHor: '#e5a76a', skyBot: '#b88a6a', fog: '#cf9a70', fogNear: 60, fogFar: 430, hemiSky: '#f6cfa0', hemiGround: '#4a3a3a', hemiI: 1.25, sun: '#ffb46e', sunI: 2.6, sunDir: [-0.75, 0.32, -0.55], ground: '#7a6a5c', sunGlow: '#ffc27a', sunGlowI: 0.9, lit: 0.2 },
  nightCity: { skyTop: '#121828', skyHor: '#363a55', skyBot: '#202233', fog: '#2c3046', fogNear: 40, fogFar: 460, hemiSky: '#7480b0', hemiGround: '#1a1a24', hemiI: 0.75, sun: '#a8b8e0', sunI: 0.8, sunDir: [0.5, 0.6, -0.4], ground: '#3a3a42', sunGlow: '#9fb0e0', sunGlowI: 0.0, lit: 0.62 },
  blinding:  { skyTop: '#a8865a', skyHor: '#c09a6c', skyBot: '#8a7056', fog: '#a88a66', fogNear: 30, fogFar: 260, hemiSky: '#fff4dc', hemiGround: '#8a7a6a', hemiI: 1.7, sun: '#fff1d0', sunI: 3.4, sunDir: [0.0, 0.75, -0.65], ground: '#8a8078', sunGlow: '#ffffff', sunGlowI: 0.0, lit: 0.2 },
  greyFear:  { skyTop: '#5e5e5e', skyHor: '#7a7774', skyBot: '#5e5c58', fog: '#6e6c68', fogNear: 30, fogFar: 260, hemiSky: '#d8d6d2', hemiGround: '#4a4844', hemiI: 1.3, sun: '#f0eee8', sunI: 2.2, sunDir: [0.0, 0.8, -0.6], ground: '#6a6864', sunGlow: '#ffffff', sunGlowI: 0.0, lit: 0.15 },
  dawnCity:  { skyTop: '#6c7aa2', skyHor: '#f3ba8c', skyBot: '#c79a86', fog: '#dcaa8c', fogNear: 50, fogFar: 560, hemiSky: '#ffd8b8', hemiGround: '#4a4050', hemiI: 1.15, sun: '#ffc48a', sunI: 2.2, sunDir: [0.85, 0.16, -0.5], ground: '#6a6070', sunGlow: '#ffd59a', sunGlowI: 1.3, lit: 0.08 },
  sinai:     { skyTop: '#6a3a2c', skyHor: '#c98458', skyBot: '#b07a52', fog: '#c08058', fogNear: 40, fogFar: 380, hemiSky: '#f0b48a', hemiGround: '#4a2a1c', hemiI: 0.95, sun: '#ffbc8a', sunI: 1.75, sunDir: [0.7, 0.42, -0.35], ground: '#ad7c55', sunGlow: '#ffb070', sunGlowI: 0.5, lit: 0 },
  sinaiDay:  { skyTop: '#b98a5a', skyHor: '#e6c094', skyBot: '#cf9a66', fog: '#dcb48a', fogNear: 50, fogFar: 400, hemiSky: '#fff0d0', hemiGround: '#7a5030', hemiI: 1.05, sun: '#fff0d8', sunI: 2.0, sunDir: [0.1, 0.95, -0.2], ground: '#c99a62', sunGlow: '#fff4dc', sunGlowI: 0.6, lit: 0 },
  sinaiNight:{ skyTop: '#151826', skyHor: '#3a3448', skyBot: '#2a2430', fog: '#2e2a3a', fogNear: 30, fogFar: 260, hemiSky: '#6a70a0', hemiGround: '#1a1418', hemiI: 0.6, sun: '#9fb0e0', sunI: 0.5, sunDir: [-0.4, 0.5, -0.3], ground: '#4a3a3a', sunGlow: '#000000', sunGlowI: 0, lit: 0 },
  bedroom:   { skyTop: '#2a1a12', skyHor: '#3a2618', skyBot: '#2a1a12', fog: '#2a1a10', fogNear: 16, fogFar: 46, hemiSky: '#d8a078', hemiGround: '#3a2416', hemiI: 1.45, sun: '#9fb0dc', sunI: 0.9, sunDir: [0.35, 0.55, 0.75], ground: '#5a3e2a', sunGlow: '#000000', sunGlowI: 0, lit: 0.5 },
  upperRoom: { skyTop: '#2c1c12', skyHor: '#3e2a1a', skyBot: '#2c1c12', fog: '#2e1e12', fogNear: 14, fogFar: 40, hemiSky: '#e0a870', hemiGround: '#3a2416', hemiI: 0.95, sun: '#ffcf96', sunI: 1.2, sunDir: [0.45, 0.8, 0.55], ground: '#6a4a32', sunGlow: '#000000', sunGlowI: 0, lit: 0 },
};

const C = (h) => new THREE.Color(h);
export function lerpPal(a, b, u) {
  if (u <= 0) return a; if (u >= 1) return b;
  const o = {};
  for (const k in a) {
    const va = a[k], vb = b[k];
    if (typeof va === 'string' && va[0] === '#') o[k] = '#' + C(va).lerp(C(vb), u).getHexString();
    else if (Array.isArray(va)) o[k] = va.map((v, i) => lerp(v, vb[i], u));
    else if (typeof va === 'number') o[k] = lerp(va, vb, u);
    else o[k] = u < 0.5 ? va : vb;
  }
  return o;
}

// ---------------------------------------------------------------- base world
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const SKY_FS = `precision highp float; varying vec3 vDir;
uniform vec3 top, hor, bot, sunDir, glow, burst; uniform float glowI, burstI, burstSize;
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = y > 0. ? mix(hor, top, pow(clamp(y*1.25,0.,1.), 0.65)) : mix(hor, bot, clamp(-y*4.,0.,1.));
  float s = max(dot(d, normalize(sunDir)), 0.);
  c += glow*(pow(s, 900.)*2.0 + pow(s, 40.)*0.35 + pow(s, 6.)*0.12)*glowI;
  if (burstI > 0.001) {
  vec3 bd = normalize(vec3(0.,0.225,-0.974));
  float b = max(dot(d, bd), 0.);
  vec3 bx = normalize(cross(bd, vec3(0.,1.,0.))), by = cross(bx, bd);
  float ang = atan(dot(d, by), dot(d, bx));
  float rays = 0.55 + 0.45*sin(ang*15. + sin(ang*6.)*2.2);
  c += burst*(pow(b, 1400./burstSize)*7.0 + pow(b, 160./burstSize)*1.6 + pow(b, 22./burstSize)*0.55*rays + pow(b, 5.)*0.22)*burstI;
  }
  gl_FragColor = vec4(c, 1.);
}`;

export class World {
  constructor(name) {
    this.name = name;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.1, 1400);
    this.scene.fog = new THREE.Fog(0xffffff, 30, 200);
    this.skyU = {
      top: { value: C('#000') }, hor: { value: C('#000') }, bot: { value: C('#000') }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
      glow: { value: C('#fff') }, glowI: { value: 0 }, burst: { value: C('#fff4dc') }, burstI: { value: 0 }, burstSize: { value: 1 },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.skyU, side: THREE.BackSide, depthWrite: true, fog: false }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 6;
    this.sun.shadow.blurSamples = 16;
    this.scene.add(this.sun, this.sun.target);
    this.groundMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    this.chars = [];
    this.pal = null;
    this.updaters = [];
  }
  addChar(c, x = 0, z = 0, y = 0) { c.group.position.set(x, y, z); this.scene.add(c.group); this.chars.push(c); return c; }
  setPalette(p) {
    this.pal = p;
    const u = this.skyU;
    u.top.value.set(p.skyTop); u.hor.value.set(p.skyHor); u.bot.value.set(p.skyBot);
    u.sunDir.value.set(...p.sunDir).normalize(); u.glow.value.set(p.sunGlow); u.glowI.value = p.sunGlowI;
    this.scene.fog.color.set(p.fog); this.scene.fog.near = p.fogNear; this.scene.fog.far = p.fogFar;
    this.hemi.color.set(p.hemiSky); this.hemi.groundColor.set(p.hemiGround); this.hemi.intensity = p.hemiI;
    this.sun.color.set(p.sun); this.sun.intensity = p.sunI;
    this.groundMat.color.set(p.ground);
  }
  // shadow frustum centred on the action
  aimSun(center, size = 20, dist = 60) {
    const key = [center.x, center.y, center.z, size, dist, ...this.pal.sunDir].map((v) => v.toFixed(3)).join(',');
    if (key !== this.shadowKey) { this.shadowKey = key; this.shadowDirty = true; }
    const d = new THREE.Vector3(...this.pal.sunDir).normalize();
    this.sun.position.copy(center).addScaledVector(d, dist);
    this.sun.target.position.copy(center);
    const sc = this.sun.shadow.camera;
    sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.near = 1; sc.far = dist * 2.5;
    sc.updateProjectionMatrix();
  }
  look(pos, target, fov = 32) {
    const c = this.camera;
    c.position.set(...pos);
    c.fov = fov; c.updateProjectionMatrix();
    c.up.set(0, 1, 0);
    c.lookAt(new THREE.Vector3(...target));
    c.updateMatrixWorld();
    this.sky.position.copy(c.position);
  }
  hideChars() { for (const c of this.chars) c.visible = false; }
}

// ---------------------------------------------------------------- geometry helpers
const flat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
function jitter(geo, amt, seed, keepY = false) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.round(x * 97) * 3 + Math.round(y * 89) * 7 + Math.round(z * 83) * 11 + seed;
    p.setXYZ(i, x + (hash(k) - 0.5) * amt, keepY ? y : y + (hash(k + 1) - 0.5) * amt, z + (hash(k + 2) - 0.5) * amt);
  }
  geo.computeVertexNormals();
  return geo;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; return m;
}
export function tree(seed, h = 3, col = '#6f7f45') {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.12 * h / 3, 0.18 * h / 3, h * 0.45, 6), flat('#5a3a22'), 0, h * 0.22, 0);
  const crown = mesh(jitter(new THREE.IcosahedronGeometry(h * 0.33, 1), h * 0.08, seed), flat(col), 0, h * 0.62, 0);
  crown.scale.set(1, 0.92, 1);
  g.add(trunk, crown);
  return g;
}
export function palm(seed, h = 4) {
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.1, 0.16, h, 5), flat('#6a4a2c'), 0, h / 2, 0);
  trunk.rotation.z = (hash(seed) - 0.5) * 0.2;
  g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(new THREE.ConeGeometry(0.28, 1.9, 3), flat('#5f6e38'), 0, h, 0);
    leaf.rotation.set(Math.PI / 2 - 0.5, (i / 7) * Math.PI * 2, 0, 'YXZ');
    leaf.translateY(0.85);
    leaf.rotation.x += 0;
    g.add(leaf);
  }
  return g;
}
export function rock(seed, s = 1, col = '#7a6656') {
  return mesh(jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.35, seed), flat(col), 0, s * 0.45, 0);
}

// radial gradient texture (soft blobs, pools, halos)
const texCache = {};
export function radialTex(stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], key = 'r') {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 127);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[key] = t);
}

// ---------------------------------------------------------------- city
export function windowMaterial(color, U) {
  const m = flat(color);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix*vec4(transformed,1.)).xyz; vWN = normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vWN; uniform float uLit, uTime; uniform vec3 uWin, uGlass;
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.31, 289.17)))*43758.5453); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (abs(vWN.y) < 0.5) {
  float side = abs(vWN.x) > 0.5 ? 1. : 0.;
  float u = side > 0.5 ? vWP.z : vWP.x;
  vec2 g = vec2(u/2.3, (vWP.y + 60.)/3.1);
  vec2 cell = floor(g); vec2 f = fract(g);
  float win = step(0.2, f.x)*step(f.x, 0.8)*step(0.26, f.y)*step(f.y, 0.8);
  vec2 key = cell + floor(vWP.xz/31.)*vec2(7.31, 3.17) + side*vec2(17., 3.);
  float id = h21(key);
  float lit = smoothstep(id, id + 0.008, uLit);
  float fl = 0.88 + 0.12*sin(uTime*(2. + id*9.) + id*40.)*step(0.93, h21(key + 5.));
  float tone = h21(key*1.7 + 3.);
  vec3 wc = uWin*(0.75 + 0.5*tone);
  wc = mix(wc, vec3(0.62,0.72,0.85)*length(uWin)*0.6, step(0.88, tone));
  diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, win*0.8);
  totalEmissiveRadiance += wc*lit*win*fl;
}`);
  };
  return m;
}

export function buildCity() {
  const w = new World('city');
  const s = w.scene;
  const U = (w.winU = { uLit: { value: 0.35 }, uTime: { value: 0 }, uWin: { value: C('#ffb860') }, uGlass: { value: C('#3a3a48') } });
  const r = mulberry32(42);
  // street level far below the roof
  const ground = mesh(new THREE.PlaneGeometry(3000, 3000), w.groundMat, 0, -34, 0, false, true);
  ground.rotation.x = -Math.PI / 2;
  s.add(ground);
  // our rooftop (the camera stands on it, so it extends behind the lens)
  const roofMat = flat('#8a7f74');
  w.roofMat = roofMat;
  s.add(mesh(new THREE.BoxGeometry(20, 0.5, 26), roofMat, 0, -0.25, 4.5));
  const bodyMats = ['#7a6458', '#6a5e5a', '#8a705e', '#5e5a62', '#86766a', '#6e6058'].map((c) => windowMaterial(c, U));
  s.add(mesh(new THREE.BoxGeometry(19.6, 34, 25.6), bodyMats[0], 0, -17.5, 4.5, false, true));
  const parapet = flat('#9a8e80');
  for (const [x, z, sx, sz] of [[0, 17.4, 20, 0.3], [0, -8.4, 20, 0.3], [-9.85, 4.5, 0.3, 26], [9.85, 4.5, 0.3, 26]]) s.add(mesh(new THREE.BoxGeometry(sx, 0.75, sz), parapet, x, 0.37, z));
  // stair housing, water tower, AC units, antenna
  s.add(mesh(new THREE.BoxGeometry(3, 2.6, 2.4), flat('#9a8a7a'), 6.2, 1.3, -6));
  s.add(mesh(new THREE.BoxGeometry(0.9, 1.9, 0.08), flat('#5a4a40'), 5.8, 0.95, -4.76));
  s.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 4), flat('#5a5048'), 7.2, 4.2, -6.6));
  const wt = new THREE.Group();
  wt.add(mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.9, 9), flat('#7a5a44'), 0, 2.6, 0));
  wt.add(mesh(new THREE.ConeGeometry(1.35, 0.8, 9), flat('#5a4436'), 0, 3.95, 0));
  for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) wt.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 4), flat('#4a3a30'), x, 0.85, z));
  wt.position.set(-6.6, 0, -6); s.add(wt);
  for (const [x, z] of [[8.2, 3.6], [-8.2, 3.2], [-8.2, 1.6]]) s.add(mesh(new THREE.BoxGeometry(1.1, 0.8, 1.0), flat('#a49a90'), x, 0.4, z));
  // string lights along the back of the roof (dusk warmth)
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.55), fog: true });
  w.bulbMat = bulbMat;
  const poles = [[-9.3, -7.9], [-1.5, -7.9], [5.0, -7.9]];
  for (const [x, z] of poles) s.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 5), flat('#4a3a30'), x, 1.4, z));
  const wire = (a, b) => {
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), bulbMat);
      m.position.set(lerp(a[0], b[0], u), 2.75 - Math.sin(u * Math.PI) * 0.5, lerp(a[1], b[1], u)); s.add(m);
    }
  };
  wire(poles[0], poles[1]); wire(poles[1], poles[2]);
  // the city: neighbours sit below our roof, the skyline rises far away in the haze
  const geos = bodyMats.map(() => []), roofs = [];
  for (let gx = -14; gx <= 14; gx++) for (let gz = -26; gz <= 7; gz++) {
    const x = gx * 15 + (r() - 0.5) * 4, z = gz * 15 + (r() - 0.5) * 4;
    const d = Math.hypot(x, z - 4);
    if (d < 22) continue;
    if (r() < 0.1) continue;
    let h;
    if (d < 110) h = 8 + r() * 20;           // roofs 6-26 m below ours
    else if (d < 200) h = 16 + r() * 22;
    else h = 26 + r() * 40 + (r() < 0.07 ? 30 : 0);
    const bw = 7 + r() * 6, bd = 7 + r() * 6;
    const g = new THREE.BoxGeometry(bw, h, bd);
    g.translate(x, -34 + h / 2, z);
    geos[Math.floor(r() * bodyMats.length)].push(g);
    if (r() < 0.35) { const rg = new THREE.BoxGeometry(bw * 0.4, 2.2, bd * 0.4); rg.translate(x + (r() - 0.5) * 2, -34 + h + 1.1, z + (r() - 0.5) * 2); roofs.push(rg); }
  }
  // landmark towers on the far skyline
  for (const [x, z, h, bw] of [[-40, -330, 92, 16], [70, -360, 80, 14], [-130, -300, 72, 18]]) { const g = new THREE.BoxGeometry(bw, h, bw); g.translate(x, -34 + h / 2, z); geos[3].push(g); const g2 = new THREE.BoxGeometry(bw * 0.55, 18, bw * 0.55); g2.translate(x, -34 + h + 9, z); geos[3].push(g2); }
  geos.forEach((list, i) => { if (list.length) s.add(mesh(mergeGeometries(list), bodyMats[i], 0, 0, 0, false, true)); });
  if (roofs.length) s.add(mesh(mergeGeometries(roofs), flat('#6a5e56'), 0, 0, 0, false, false));
  const blocks = [];
  w.blocks = blocks;
  return w;
}

// ---------------------------------------------------------------- Sinai, camp, calf
export function buildSinai() {
  const w = new World('sinai');
  const s = w.scene;
  const gGeo = new THREE.PlaneGeometry(1600, 1600, 80, 80);
  gGeo.rotateX(-Math.PI / 2);
  const p = gGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { // gentle low-poly dunes, flat near the camp
    const x = p.getX(i), z = p.getZ(i);
    const d = Math.hypot(x - 10, z + 10);
    const k = clamp((d - 40) / 120);
    p.setY(i, (Math.sin(x * 0.02 + 1) * Math.cos(z * 0.025) * 3 + (hash(i) - 0.5) * 1.6) * k);
  }
  gGeo.computeVertexNormals();
  w.groundMat.flatShading = true;
  s.add(mesh(gGeo, w.groundMat, 0, 0, 0, false, true));
  // the mountain: faceted cone + shoulders
  const rockMat = flat('#5e4236');
  w.rockMat = rockMat;
  const mk = (r0, h, x, z, seed) => { const g = jitter(new THREE.ConeGeometry(r0, h, 11, 6), r0 * 0.16, seed); return mesh(g, rockMat, x, h / 2 - 1, z, true, true); };
  w.summit = new THREE.Vector3(-15, 40, -160);
  s.add(mk(38, 42, -15, -160, 3));
  s.add(mk(24, 26, -44, -150, 5));
  s.add(mk(28, 22, 16, -178, 7));
  s.add(mk(15, 12, 2, -128, 11));
  s.add(mk(20, 16, -60, -190, 13));
  for (let i = 0; i < 34; i++) { const r = rock(i * 7, 0.4 + hash(i) * 1.6, '#8a6046'); r.position.set(-70 + hash(i + 3) * 140, 0, -110 + hash(i + 5) * 80); s.add(r); }
  // smoke column on the summit (low-poly puffs)
  w.smoke = [];
  const smokeMat = flat('#3e3432');
  w.smokeMat = smokeMat;
  for (let i = 0; i < 46; i++) {
    const m = mesh(jitter(new THREE.DodecahedronGeometry(1, 0), 0.3, i), smokeMat, 0, 0, 0, false, false);
    s.add(m); w.smoke.push(m);
  }
  // fire on the summit
  w.fire = [];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(1, 3, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3.2, i % 3 ? 1.3 : 2.0, 0.35), fog: false }));
    s.add(m); w.fire.push(m);
  }
  w.fireLight = new THREE.PointLight(0xff8a3a, 0, 160, 1.2);
  w.fireLight.position.copy(w.summit).add(new THREE.Vector3(0, 6, 8));
  s.add(w.fireLight);
  // lightning bolts (jagged ribbons, shown for a few frames)
  w.bolts = [];
  for (let b = 0; b < 4; b++) {
    const r = mulberry32(100 + b);
    const pts = [];
    let pt = new THREE.Vector3(w.summit.x + (r() - 0.5) * 30, w.summit.y + 46, w.summit.z + (r() - 0.5) * 10);
    const end = w.summit.clone().add(new THREE.Vector3((r() - 0.5) * 8, 2, (r() - 0.5) * 6));
    for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(pt.clone().lerp(end, u).add(new THREE.Vector3((r() - 0.5) * 7 * (1 - u * 0.5), 0, (r() - 0.5) * 3))); }
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.2, 5), fog: false });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], c = pts[i + 1];
      const L = a.distanceTo(c);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, L, 4), mat);
      seg.position.copy(a).add(c).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize());
      grp.add(seg);
    }
    grp.visible = false; s.add(grp); w.bolts.push(grp);
  }
  // camp: tents with flags
  w.flags = [];
  const tentCols = ['#e6d8bc', '#cdb38c', '#b58e66', '#d9c6a2', '#a0785a', '#e0cfae'];
  const tr = mulberry32(9);
  for (let i = 0; i < 46; i++) {
    const ang = tr() * Math.PI * 2, rad = 11 + Math.sqrt(tr()) * 34;
    const x = 34 + Math.cos(ang) * rad * 1.2, z = -6 + Math.sin(ang) * rad;
    if (x < 14 && z > -30) continue; // keep the Sinai crowd area clear
    const tg = new THREE.Group();
    const h = 2.2 + tr() * 1.2, rr = 1.8 + tr() * 1.2;
    const tent = mesh(new THREE.ConeGeometry(rr, h, tr() < 0.5 ? 4 : 6), flat(tentCols[i % tentCols.length]), 0, h / 2, 0);
    tent.rotation.y = tr() * Math.PI;
    tg.add(tent);
    const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), flat('#5a3a22'), 0, h + 0.7, 0, false, false);
    tg.add(pole);
    const fgeo = new THREE.PlaneGeometry(0.9, 0.5, 8, 1); fgeo.translate(0.45, 0, 0);
    const flag = mesh(fgeo, new THREE.MeshLambertMaterial({ color: ['#a8574a', '#5b6b8c', '#c8a23a', '#6f8f6a'][i % 4], side: THREE.DoubleSide }), 0, h + 1.25, 0, false, false);
    flag.userData.base = fgeo.attributes.position.array.slice();
    flag.userData.seed = i;
    tg.add(flag); w.flags.push(flag);
    tg.position.set(x, 0, z);
    s.add(tg);
    if (tr() < 0.4) { const r = rock(i, 0.35, '#7a5a44'); r.position.set(x + 2.5, 0, z + 1); s.add(r); }
  }
  // golden calf on a stone pedestal (in the camp plaza)
  const calf = (w.calf = new THREE.Group());
  const gold = new THREE.MeshStandardMaterial({ color: '#e0a83c', metalness: 0.35, roughness: 0.38, flatShading: true, emissive: '#6a4308', emissiveIntensity: 0.55 });
  w.goldMat = gold;
  const stone = flat('#8f7b66');
  calf.add(mesh(new THREE.BoxGeometry(3.4, 0.6, 2.6), stone, 0, 0.3, 0));
  calf.add(mesh(new THREE.BoxGeometry(2.6, 1.0, 1.9), stone, 0, 1.1, 0));
  calf.add(mesh(new THREE.BoxGeometry(2.9, 0.2, 2.2), flat('#a08a72'), 0, 1.7, 0));
  const cg = new THREE.Group(); // the calf itself, standing on the pedestal top (y = 1.8)
  const part = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = mesh(geo, gold, x, y, z); m.rotation.set(rx, ry, rz); cg.add(m); return m; };
  part(jitter(new THREE.BoxGeometry(1.5, 0.72, 0.66, 2, 1, 1), 0.07, 4), 0, 2.84, 0);
  part(jitter(new THREE.BoxGeometry(0.62, 0.78, 0.6), 0.05, 5), 0.66, 3.02, 0, 0, 0, -0.35);
  part(new THREE.BoxGeometry(0.42, 0.7, 0.42), 0.92, 3.36, 0, 0, 0, -0.6);
  part(jitter(new THREE.BoxGeometry(0.5, 0.42, 0.42), 0.04, 6), 1.2, 3.72, 0, 0, 0, -0.25);
  part(new THREE.BoxGeometry(0.28, 0.24, 0.34), 1.46, 3.6, 0, 0, 0, -0.35);
  for (const z of [-1, 1]) {
    part(new THREE.ConeGeometry(0.06, 0.42, 5), 1.12, 4.06, z * 0.16, z * 0.55, 0, 0.25);
    part(new THREE.BoxGeometry(0.18, 0.07, 0.12), 1.0, 3.84, z * 0.27, z * 0.4, 0, 0);
  }
  for (const [x, z] of [[-0.55, -0.22], [-0.55, 0.22], [0.52, -0.22], [0.52, 0.22]]) part(new THREE.CylinderGeometry(0.1, 0.075, 0.68, 6), x, 2.16, z);
  part(new THREE.CylinderGeometry(0.035, 0.025, 0.7, 4), -0.86, 2.75, 0, 0, 0, 0.45);
  calf.add(cg);
  calf.add(mesh(new THREE.BoxGeometry(2.4, 0.08, 1.6), flat('#b0987c'), 0, 1.84, 0));
  calf.position.set(34, 0, -6);
  calf.rotation.y = 0.35;
  s.add(calf);
  w.calfLight = new THREE.PointLight(0xffc870, 0, 18, 1.5); w.calfLight.position.set(34, 5, -2); s.add(w.calfLight);
  // fire pits around the calf
  w.pits = [];
  for (const a of [0.6, 2.4, 4.3]) {
    const x = 34 + Math.cos(a) * 6.2, z = -6 + Math.sin(a) * 6.2;
    const r = rock(a * 10, 0.35, '#5a4434'); r.position.set(x, 0, z); s.add(r);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.3) }));
    f.position.set(x, 0.75, z); s.add(f); w.pits.push(f);
  }
  return w;
}

// ---------------------------------------------------------------- interiors
function interiorBase(name, wallCol, floorCol) {
  const w = new World(name);
  const s = w.scene;
  w.groundMat.color.set(floorCol);
  const floor = mesh(new THREE.PlaneGeometry(40, 40), w.groundMat, 0, 0, 0, false, true); floor.rotation.x = -Math.PI / 2; s.add(floor);
  w.wallMat = flat(wallCol);
  return w;
}

export function buildBedroom() {
  const w = interiorBase('bedroom', '#5c4030', '#5a3e2a');
  const s = w.scene;
  const wall = w.wallMat;
  // back wall with a window cut-out (4 boxes), left wall
  s.add(mesh(new THREE.BoxGeometry(2.2, 3.2, 0.2), wall, -2.4, 1.6, -2.6));
  s.add(mesh(new THREE.BoxGeometry(2.4, 3.2, 0.2), wall, 2.7, 1.6, -2.6));
  s.add(mesh(new THREE.BoxGeometry(1.6, 1.15, 0.2), wall, 0.3, 0.575, -2.6));
  s.add(mesh(new THREE.BoxGeometry(1.6, 0.6, 0.2), wall, 0.3, 2.9, -2.6));
  s.add(mesh(new THREE.BoxGeometry(0.2, 3.2, 7), wall, -3.5, 1.6, 0.9));
  // window: frame + night city beyond
  const frame = flat('#3a2a20');
  for (const [x, y, sx, sy] of [[0.3, 1.18, 1.62, 0.08], [0.3, 2.58, 1.62, 0.08], [-0.48, 1.88, 0.08, 1.48], [1.08, 1.88, 0.08, 1.48], [0.3, 1.88, 0.05, 1.4]]) s.add(mesh(new THREE.BoxGeometry(sx, sy, 0.24), frame, x, y, -2.6, false, false));
  const nc = document.createElement('canvas'); nc.width = 256; nc.height = 256;
  const g = nc.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0e1424'); gr.addColorStop(1, '#2a2a40'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const rr = mulberry32(5);
  for (let i = 0; i < 14; i++) { const x = rr() * 256, bw = 20 + rr() * 30, h = 60 + rr() * 140; g.fillStyle = '#161a28'; g.fillRect(x, 256 - h, bw, h); for (let k = 0; k < 30; k++) if (rr() < 0.35) { g.fillStyle = rr() < 0.8 ? '#e8b060' : '#a0c0e8'; g.fillRect(x + 3 + Math.floor(rr() * (bw - 6) / 6) * 6, 256 - h + 6 + Math.floor(rr() * (h - 10) / 9) * 9, 3, 4); } }
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(rr() * 256, rr() * 90, 1.5, 1.5); }
  const nt = new THREE.CanvasTexture(nc); nt.colorSpace = THREE.SRGBColorSpace;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.4), new THREE.MeshBasicMaterial({ map: nt, color: new THREE.Color(1.2, 1.2, 1.3), fog: false }));
  glass.position.set(0.3, 1.88, -2.66); s.add(glass);
  // bed against the left wall
  s.add(mesh(new THREE.BoxGeometry(2.2, 0.28, 3.4), flat('#4a3222'), -2.3, 0.14, -0.7));
  s.add(mesh(new THREE.BoxGeometry(2.1, 0.16, 3.3), flat('#d8cdb8'), -2.3, 0.36, -0.7));
  s.add(mesh(new THREE.BoxGeometry(2.14, 0.08, 2.3), flat('#4f5d6b'), -2.3, 0.47, -0.15));
  s.add(mesh(jitter(new THREE.BoxGeometry(0.9, 0.22, 0.5), 0.05, 2), flat('#ece4d6'), -2.4, 0.56, -2.0));
  s.add(mesh(new THREE.BoxGeometry(2.3, 1.0, 0.12), flat('#3e2a1c'), -2.3, 0.5, -2.45));
  // nightstand + lamp, rug, shelf with books, poster
  s.add(mesh(new THREE.BoxGeometry(0.6, 0.55, 0.5), flat('#4a3222'), -0.75, 0.275, -2.2));
  s.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.3, 6), flat('#8a7a64'), -0.75, 0.7, -2.2));
  s.add(mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.22, 6), flat('#d8c8a8'), -0.75, 0.94, -2.2));
  const rug = mesh(new THREE.CircleGeometry(1.25, 10), flat('#7a4a3a'), 0.2, 0.01, 0.4, false, true); rug.rotation.x = -Math.PI / 2; s.add(rug);
  s.add(mesh(new THREE.BoxGeometry(1.4, 0.06, 0.32), flat('#4a3222'), 2.3, 1.7, -2.36));
  const bcol = ['#8a3f3a', '#4f7c86', '#c8a23a', '#6f8f6a', '#5b6b8c'];
  for (let i = 0; i < 7; i++) s.add(mesh(new THREE.BoxGeometry(0.1, 0.28 + hash(i) * 0.1, 0.24), flat(bcol[i % 5]), 1.75 + i * 0.12, 1.88, -2.36));
  s.add(mesh(new THREE.BoxGeometry(0.06, 0.9, 0.7), flat('#c09060'), -3.38, 1.9, 1.0, false, false));
  s.add(mesh(new THREE.BoxGeometry(0.07, 0.78, 0.58), flat('#2f4048'), -3.37, 1.9, 1.0, false, false));
  // a phone face-down on the bed: he stopped scrolling
  s.add(mesh(new THREE.BoxGeometry(0.16, 0.02, 0.3), flat('#1d2026'), -1.8, 0.52, 0.2));
  w.lamp = new THREE.PointLight(0xffb070, 0.0, 6, 1.6); w.lamp.position.set(-0.75, 1.1, -2.0); s.add(w.lamp);
  return w;
}

export function buildUpperRoom() {
  const w = interiorBase('upper', '#7a5a40', '#6a4a32');
  const s = w.scene;
  const wall = w.wallMat;
  // stone walls: back wall with an arched window, left wall
  s.add(mesh(new THREE.BoxGeometry(3.2, 4, 0.3), wall, -3.0, 2, -3));
  s.add(mesh(new THREE.BoxGeometry(3.6, 4, 0.3), wall, 3.6, 2, -3));
  s.add(mesh(new THREE.BoxGeometry(1.4, 1.6, 0.3), wall, 0.4, 0.8, -3));
  s.add(mesh(new THREE.BoxGeometry(1.4, 1.2, 0.3), wall, 0.4, 3.4, -3));
  s.add(mesh(new THREE.BoxGeometry(0.3, 4, 8), wall, -4.6, 2, 0.8));
  const stones = flat('#6a4c36');
  const sr = mulberry32(3);
  for (let i = 0; i < 26; i++) s.add(mesh(new THREE.BoxGeometry(0.5 + sr() * 0.6, 0.26, 0.05), stones, -4.4 + sr() * 9.6, 0.4 + sr() * 3.4, -2.83, false, false));
  const archC = document.createElement('canvas'); archC.width = 128; archC.height = 160;
  const ag = archC.getContext('2d'); const agr = ag.createLinearGradient(0, 0, 0, 160); agr.addColorStop(0, '#141a30'); agr.addColorStop(1, '#2a2a46'); ag.fillStyle = agr;
  ag.beginPath(); ag.moveTo(0, 160); ag.lineTo(0, 64); ag.arc(64, 64, 64, Math.PI, 0); ag.lineTo(128, 160); ag.closePath(); ag.fill();
  ag.fillStyle = '#f4ead0'; ag.beginPath(); ag.arc(92, 46, 10, 0, Math.PI * 2); ag.fill();
  for (let i = 0; i < 18; i++) { ag.fillStyle = 'rgba(255,255,255,0.7)'; ag.fillRect(sr() * 128, sr() * 100, 1.5, 1.5); }
  const at = new THREE.CanvasTexture(archC); at.colorSpace = THREE.SRGBColorSpace;
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.75), new THREE.MeshBasicMaterial({ map: at, transparent: true, color: new THREE.Color(1.3, 1.3, 1.4), fog: false }));
  arch.position.set(0.4, 2.47, -3.0); s.add(arch);
  // table with bread, cup and an oil lamp
  const wood = flat('#5a3a24');
  s.add(mesh(new THREE.BoxGeometry(3.4, 0.12, 1.1), wood, 0.2, 0.62, -1.7));
  for (const [x, z] of [[-1.35, -2.1], [1.75, -2.1], [-1.35, -1.3], [1.75, -1.3]]) s.add(mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), wood, x, 0.3, z));
  s.add(mesh(jitter(new THREE.SphereGeometry(0.2, 6, 4), 0.04, 1), flat('#c8945a'), -0.6, 0.76, -1.6));
  s.add(mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.22, 7), flat('#8a6a4a'), 0.7, 0.79, -1.8));
  s.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 8), flat('#a88a60'), -0.1, 0.71, -1.9));
  const lampBody = mesh(new THREE.SphereGeometry(0.13, 7, 5), flat('#9a6a46'), 0.25, 0.77, -1.4); lampBody.scale.set(1.4, 0.6, 1); s.add(lampBody);
  w.flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 2.0, 0.6) }));
  w.flame.position.set(0.42, 0.88, -1.4); s.add(w.flame);
  w.lampLight = new THREE.PointLight(0xffa850, 3, 9, 1.4); w.lampLight.position.set(0.42, 1.05, -1.3); w.lampLight.castShadow = false; s.add(w.lampLight);
  // jars and a bench
  s.add(mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.6, 7), flat('#9a6a46'), -3.8, 0.3, -2.4));
  s.add(mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.42, 7), flat('#8a5a3a'), -3.3, 0.21, -2.5));
  s.add(mesh(new THREE.BoxGeometry(2.6, 0.4, 0.5), wood, 3.4, 0.2, -2.4));
  return w;
}

export function buildVoid() { // ending screen backdrop
  const w = new World('void');
  w.scene.remove(w.sky);
  const u = (w.voidU = { col: { value: C('#21150e') }, ring: { value: C('#2c1c13') }, time: { value: 0 }, glowA: { value: new THREE.Vector3(0.28, 0.58, 0) }, glowB: { value: new THREE.Vector3(0.72, 0.58, 0) }, ga: { value: C('#000') }, gb: { value: C('#000') } });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: u, depthWrite: false, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform vec3 col, ring, ga, gb, glowA, glowB; uniform float time;
      void main(){ vec2 p = (vUv-vec2(0.5,0.55))*vec2(1.0,1.7778);
        float r = length(p);
        float rings = 0.5+0.5*sin(r*38. - time*0.6);
        vec3 c = mix(col, ring, smoothstep(0.6,1.,rings)*0.55*smoothstep(1.1,0.1,r));
        c *= 1.0 - smoothstep(0.35, 1.2, r)*0.5;
        vec2 a = (vUv-glowA.xy)*vec2(1.,1.7778), b = (vUv-glowB.xy)*vec2(1.,1.7778);
        c += ga*exp(-dot(a,a)*28.) + gb*exp(-dot(b,b)*28.);
        gl_FragColor = vec4(c,1.); }`,
  }));
  m.frustumCulled = false;
  w.scene.add(m);
  w.sun.castShadow = false;
  return w;
}

// ---------------------------------------------------------------- divine light pillar
const PILLAR_FS = `precision highp float; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
uniform vec3 col; uniform float inten, time;
void main(){
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float fade = smoothstep(0.0, 0.06, vUv.y)*(1.0 - smoothstep(0.55, 1.0, vUv.y)*0.55);
  float shimmer = 0.88 + 0.12*sin(vUv.x*40. + time*1.3)*sin(vUv.y*9. - time*0.7);
  gl_FragColor = vec4(col*edge*fade*inten*shimmer, 1.);
}`;
const PILLAR_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }`;
const SPARK_VS = `attribute float seed; uniform float time, height, radius, size; varying float vA;
void main(){
  float s = seed;
  float ph = fract(time*(0.05+0.06*fract(s*7.1)) + s*13.7);
  float a = s*91.3 + time*0.2*(fract(s*3.3)-0.5);
  float r = radius*sqrt(fract(s*17.9))*0.9;
  vec3 p = vec3(cos(a)*r, ph*height, sin(a)*r);
  vec4 mv = modelViewMatrix*vec4(p,1.);
  gl_Position = projectionMatrix*mv;
  float tw = 0.5+0.5*sin(time*(3.+fract(s*5.)*5.) + s*40.);
  vA = tw*smoothstep(0.,0.1,ph)*(1.-smoothstep(0.75,1.,ph));
  gl_PointSize = size*(0.6+0.8*fract(s*11.3))*(300./-mv.z);
}`;
const SPARK_FS = `precision highp float; varying float vA; uniform vec3 col; uniform float inten;
void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(col*a*vA*inten, 1.); }`;

export class Pillar {
  constructor(radius = 2, height = 40, n = 160) {
    this.group = new THREE.Group();
    this.u = { col: { value: new THREE.Color(1.0, 0.86, 0.55) }, inten: { value: 1 }, time: { value: 0 } };
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, height, 40, 1, true), new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: PILLAR_VS, fragmentShader: PILLAR_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    beam.position.y = height / 2;
    beam.renderOrder = 5;
    const core = beam.clone(); core.scale.set(0.45, 1, 0.45);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(radius * 3.4, radius * 3.4), new THREE.MeshBasicMaterial({
      map: radialTex([[0, 'rgba(255,250,200,1)'], [0.35, 'rgba(255,236,160,0.75)'], [0.55, 'rgba(255,220,130,0.32)'], [0.62, 'rgba(255,230,160,0.42)'], [0.7, 'rgba(255,210,120,0.08)'], [1, 'rgba(255,200,100,0)']], 'pool'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1, 1, 1), fog: false,
    }));
    this.pool.rotation.x = -Math.PI / 2; this.pool.position.y = 0.02; this.pool.renderOrder = 4;
    const geo = new THREE.BufferGeometry();
    const seeds = new Float32Array(n); for (let i = 0; i < n; i++) seeds[i] = hash(i * 1.37 + 0.5);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    this.su = { time: this.u.time, height: { value: height * 0.6 }, radius: { value: radius }, size: { value: 0.11 }, col: { value: new THREE.Color(1.6, 1.4, 1.0) }, inten: { value: 1 } };
    this.sparks = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.su, vertexShader: SPARK_VS, fragmentShader: SPARK_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.sparks.frustumCulled = false; this.sparks.renderOrder = 6;
    this.group.add(beam, core, this.pool, this.sparks);
    this.beams = [beam, core];
  }
  set(t, k, scale = 1) { // k = 0..1 visibility
    this.group.visible = k > 0.002;
    this.u.time.value = t;
    this.u.inten.value = 0.55 * k * scale;
    this.su.inten.value = k * scale;
    this.pool.material.opacity = k * 0.9 * scale;
  }
}

export function halo(size = 3, col = 'rgba(255,214,140,1)') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    map: radialTex([[0, col.replace(/[\d.]+\)$/, '0.9)')], [0.4, col.replace(/[\d.]+\)$/, '0.35)')], [1, col.replace(/[\d.]+\)$/, '0)')]], 'halo' + col),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  m.renderOrder = 1;
  return m;
}

// birds: little flapping V shapes on a deterministic path
export class Birds {
  constructor(n = 7, col = '#2a2220') {
    this.group = new THREE.Group();
    this.birds = [];
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, fog: true });
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group();
      for (const s of [-1, 1]) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.12, 0, 0, 0.12, s * 0.75, 0, -0.05]), 3));
        const wing = new THREE.Mesh(g, mat); wing.userData.s = s; b.add(wing);
      }
      this.group.add(b); this.birds.push(b);
    }
  }
  update(t, origin, vel, spread = 6, scale = 1) {
    this.birds.forEach((b, i) => {
      const off = new THREE.Vector3((hash(i) - 0.5) * spread, (hash(i + 9) - 0.5) * spread * 0.4, (hash(i + 4) - 0.5) * spread * 0.6);
      b.position.copy(origin).addScaledVector(vel, t).add(off).add(new THREE.Vector3(0, Math.sin(t * 1.3 + i) * 0.4, 0));
      b.lookAt(b.position.clone().add(vel));
      b.scale.setScalar(scale);
      const flap = Math.sin(t * 9 + i * 1.7) * 0.7;
      b.children.forEach((wg) => (wg.rotation.z = wg.userData.s * flap));
    });
  }
}

// dust motes (interiors)
export function motes(n = 90, box = [6, 3, 4], col = new THREE.Color(1.2, 1.0, 0.75)) {
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(n); for (let i = 0; i < n; i++) seeds[i] = hash(i * 2.71 + 0.3);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const u = { time: { value: 0 }, box: { value: new THREE.Vector3(...box) }, col: { value: col }, inten: { value: 0.5 } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: u, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `attribute float seed; uniform float time; uniform vec3 box; varying float vA;
      void main(){ vec3 p = vec3(fract(seed*13.1)-0.5, fract(seed*7.7 + time*0.012*(0.5+fract(seed*3.))), fract(seed*29.3)-0.5)*box;
        p.x += sin(time*0.3 + seed*30.)*0.08; vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        vA = 0.4+0.6*sin(time*1.5+seed*50.); gl_PointSize = (2.0+3.0*fract(seed*5.3))*(4.0/-mv.z)*4.; }`,
    fragmentShader: `precision highp float; varying float vA; uniform vec3 col; uniform float inten;
      void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(col*smoothstep(0.5,0.,d)*vA*inten,1.); }`,
  }));
  pts.frustumCulled = false;
  pts.userData.u = u;
  return pts;
}
