// FX for the Thanksgiving reel: stink lines, sweat drops, rumble rings, haze, glint, steam, impact puffs, action lines.
// Owner: fx agent. See CONTRACTS.md.
//
// Rules followed here:
//  - Everything is a pure function of time t (+ seed). No Math.random / Date.
//  - All meshes are pooled: created once in buildFX(), hidden in reset(), positioned + shown in commit().
//  - Emitters (stink(), sweat(), ...) only RECORD the request; the work happens in commit() after the camera is set,
//    so billboards always face the final camera of the frame.
//  - Transparent quads: depthWrite false, fixed renderOrder per pool slot (no sorting flicker), unlit custom shaders
//    that output display colours directly (no tone mapping), so the greens stay bright lime under any lighting.
import * as THREE from 'three';
import { clamp, lerp, smooth, easeOutBack, hash1, noise1 } from './lib.js';

const TESTMODE = typeof location !== 'undefined' && /[?&]fxtest=1/.test(location.search);
const testMod = TESTMODE ? await import('./fx_test.js') : null;

// sRGB hex -> vec3 uniform (no colour-space conversion: these shaders write display colours directly)
const C = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const V = (a) => (a && a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const TAU = Math.PI * 2;
const h = (i, s) => hash1(i * 13.17 + s * 71.31); // stable per-slot hash in [0,1)

// ------------------------------------------------------------------ shaders
const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Wavy rising ribbon line (stink + steam). Quad: x in [-W/2, W/2], y in [0, H] (world units via uSize).
// The wave is a low-poly polyline (uSegs points per wavelength) and is pixelated in SCREEN space (uPixScr device
// pixels per block), so the pixel look is the same in close-ups and wide shots.
const WAVE_FS = /* glsl */`
uniform float uT, uPhase, uAmp, uLambda, uSpeed, uThick, uOpacity, uReveal, uSway, uPixScr, uGlow, uSegF, uRise, uSoft, uLevels, uTopFade, uSegs;
uniform vec2 uSize;
uniform vec3 uCore, uEdge, uGlowCol;
varying vec2 vUv;
float cxs(float y){
  float k = clamp(y / uSize.y, 0.0, 1.0);
  float a = uAmp * (0.6 + 0.55 * k);
  float w = 6.28318 * (y / uLambda - uT * uSpeed) + uPhase;
  return a * sin(w) + 0.2 * a * sin(w * 0.53 + uPhase * 1.7 + uT * 0.9) + uSway * k * k;
}
// distance to the polyline through samples of cxs taken on a phase grid that moves with the wave
// (so the low-poly corners travel up with it). Returns signed distance (negative = left of the line).
float sdLine(vec2 p){
  if (uSegs <= 0.0) {
    float slope = (cxs(p.y + 0.002) - cxs(p.y - 0.002)) / 0.004;
    return (p.x - cxs(p.y)) / sqrt(1.0 + slope * slope);
  }
  float st = uLambda / uSegs;
  float off = fract(uT * uSpeed * uSegs) * st;
  float y0 = floor((p.y - off) / st) * st + off;
  float best = 1e9, sgn = 1.0;
  for (int j = -2; j <= 2; j++) {
    float ya = y0 + float(j) * st, yb = ya + st;
    vec2 A = vec2(cxs(ya), ya), B = vec2(cxs(yb), yb);
    vec2 pa = p - A, ba = B - A;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float dd = length(pa - ba * hh);
    if (dd < best) { best = dd; sgn = (ba.y * pa.x - ba.x * pa.y) >= 0.0 ? 1.0 : -1.0; }
  }
  return best * sgn;
}
void main(){
  vec2 uv = vUv;
  if (uPixScr > 0.0) {
    vec2 fc = gl_FragCoord.xy, q = (floor(fc / uPixScr) + 0.5) * uPixScr;
    uv += dFdx(vUv) * (q.x - fc.x) + dFdy(vUv) * (q.y - fc.y);
  }
  vec2 p = vec2((uv.x - 0.5) * uSize.x, uv.y * uSize.y);
  float k = clamp(p.y / uSize.y, 0.0, 1.0);
  float sd = sdLine(p);
  float d = abs(sd);
  // envelope: grows in at the bottom, thins + fades out at the top; segments rise with pointed (brush) ends
  float env = smoothstep(0.0, 0.2, k) * (1.0 - smoothstep(uTopFade, 1.0, k));
  env *= 1.0 - smoothstep(uReveal - 0.12, uReveal, k);
  float m = fract(k * uSegF - uT * uRise + uPhase * 0.1591);
  float seg = smoothstep(0.0, 0.16, m) * (1.0 - smoothstep(0.7, 0.92, m));
  float taper = sqrt(clamp(seg, 0.0, 1.0)) * mix(0.3, 1.0, env);
  float th = uThick * mix(1.0, 0.62, k) * 0.5 * taper + 1e-5;
  float core = 1.0 - smoothstep(th * (1.0 - uSoft), th * (1.0 + uSoft) + 1e-5, d);
  float inner = clamp(1.0 - d / th, 0.0, 1.0);
  float th0 = uThick * 0.5;
  float glow = uGlow * exp(-d * d / (th0 * th0 * 5.0));
  float aCore = core * smoothstep(0.0, 0.35, env) * smoothstep(0.0, 0.08, seg);
  float aGlow = glow * env * mix(0.45, 1.0, seg);
  float a = max(aCore, aGlow);
  // ribbon shading: lit side (-x) lighter, far edge darker
  float lit = smoothstep(-1.0, 0.6, -sd / th) * 0.55 + 0.45 * smoothstep(0.0, 0.85, inner);
  vec3 col = mix(uEdge, uCore, clamp(lit, 0.0, 1.0));
  col = mix(uGlowCol, col, clamp(aCore / max(a, 1e-4), 0.0, 1.0));
  a *= uOpacity;
  if (uLevels > 0.0) a = floor(a * uLevels + 0.5) / uLevels;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

// Soft lumpy cloud blob (stink puffs, haze, impact dust). Quad centred, uv 0..1.
const CLOUD_FS = /* glsl */`
uniform float uT, uPhase, uOpacity, uPix, uSoft, uCoreA;
uniform vec3 uCol, uCol2;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  if (uPix > 0.0) {   // uPix = screen block size in device pixels
    vec2 fc = gl_FragCoord.xy, q = (floor(fc / uPix) + 0.5) * uPix;
    uv += dFdx(vUv) * (q.x - fc.x) + dFdy(vUv) * (q.y - fc.y);
  }
  vec2 p = uv - 0.5;
  float r = length(p) * 2.0;
  float ang = atan(p.y, p.x);
  float lump = 0.08 * sin(ang * 3.0 + uPhase + uT * 0.7) + 0.06 * sin(ang * 5.0 - uPhase * 1.3 - uT * 1.1) + 0.035 * sin(ang * 8.0 + uPhase * 2.1);
  float edge = 0.8 + lump;
  float a = 1.0 - smoothstep(edge - uSoft, edge, r);
  a *= mix(uCoreA, 1.0, smoothstep(0.0, edge, r));
  float sh = clamp(0.5 + (p.y - p.x * 0.4) * 1.2, 0.0, 1.0);
  vec3 col = mix(uCol2, uCol, sh);
  a *= uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;

// 4-point star sparkle with soft glow (glint).
const STAR_FS = /* glsl */`
uniform float uOpacity; uniform vec3 uCol, uGlowCol;
varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  vec2 q = abs(p);
  float st = sqrt(q.x) + sqrt(q.y);
  float s = 1.0 - smoothstep(0.86, 0.96, st);
  float r = length(p);
  float glow = exp(-r * r * 10.0);
  float a = max(s, glow * 0.85);
  vec3 col = mix(uGlowCol, uCol, max(s, smoothstep(0.5, 1.0, glow)));
  a *= uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

// Rumble: wavy arcs / rings pulsing outward. Quad centred.
const RING_FS = /* glsl */`
uniform float uT, uOpacity, uRate, uArcs, uWob;
uniform vec3 uCol, uOut;
varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float side = abs(cos(ang));
  float arc = mix(1.0, smoothstep(0.42, 0.7, side), uArcs);
  float core = 0.0, outl = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ph = fract(uT * uRate + fi / 3.0);
    float rr = mix(0.32, 0.94, ph);
    float wob = uWob * sin(ang * 7.0 + uT * 23.0 + fi * 2.1) + uWob * 0.6 * sin(ang * 3.0 - uT * 17.0 + fi);
    float d = abs(r - rr * (1.0 + wob));
    float w = mix(0.055, 0.03, ph);
    float fade = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.62, 1.0, ph)) * arc;
    core = max(core, (1.0 - smoothstep(w * 0.55, w * 0.75, d)) * fade);
    outl = max(outl, (1.0 - smoothstep(w * 1.05, w * 1.3, d)) * fade);
  }
  float a = max(core, outl * 0.75);
  vec3 col = mix(uOut, uCol, clamp(core / max(a, 1e-4), 0.0, 1.0));
  a *= uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

// Short comic streaks. mode 0 = parallel action lines along +x, mode 1 = radial upward fan (impact).
const STREAK_FS = /* glsl */`
uniform float uT, uOpacity, uCount, uMode, uProg, uW;
uniform vec3 uCol, uOut;
varying vec2 vUv;
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * hh); }
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  float dmin = 10.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= uCount) break;
    if (uMode < 0.5) {
      float y = (uCount > 1.0) ? mix(-0.6, 0.6, fi / (uCount - 1.0)) : 0.0;
      float ph = fract(uT * 2.4 + fi * 0.37);
      float len = 0.75 + 0.3 * sin(fi * 2.3 + 1.0);
      float x1 = 0.85 - ph * 0.35 - abs(y) * 0.3;
      float x0 = x1 - len * (1.0 - ph * 0.7);
      dmin = min(dmin, seg(p, vec2(x0, y), vec2(x1, y)));
    } else {
      float ang = mix(0.35, 2.79, (uCount > 1.0) ? fi / (uCount - 1.0) : 0.5);
      vec2 dir = vec2(cos(ang), sin(ang));
      float r0 = mix(0.3, 0.75, uProg), r1 = mix(0.45, 0.98, smoothstep(0.0, 0.5, uProg));
      dmin = min(dmin, seg(p, dir * r0, dir * max(r1, r0 + 0.02)));
    }
  }
  float core = 1.0 - smoothstep(uW * 0.75, uW, dmin);
  float outl = 1.0 - smoothstep(uW * 1.55, uW * 1.85, dmin);
  float a = max(core, outl * 0.8);
  vec3 col = mix(uOut, uCol, core);
  a *= uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

function shaderMat(fs, uniforms, { depthTest = true, additive = false } = {}) {
  const u = {};
  for (const [k, v] of Object.entries(uniforms)) u[k] = { value: v };
  return new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VS, fragmentShader: fs, transparent: true, depthWrite: false, depthTest,
    side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
  });
}

// ------------------------------------------------------------------ colours (display sRGB)
const COL = {
  stinkCore: C('#9cf05a'), stinkEdge: C('#2f8f24'), stinkGlow: C('#5cc23a'),
  puff: C('#8fd858'), puff2: C('#4a9a30'),
  haze: C('#a9cf63'), haze2: C('#7fa848'),
  steamCore: C('#ffffff'), steamEdge: C('#e9eef2'), steamGlow: C('#ffffff'),
  white: C('#ffffff'), ink: C('#2b2118'), star: C('#ffffff'), starGlow: C('#fff3b8'),
  ring: C('#fff4c4'), ringOut: C('#3a2a1c'),
  dust: C('#f6efe2'), dust2: C('#cfc2aa'),
};
const CRUMB_COLS = ['#c98a4b', '#e2b27a', '#8a5a32', '#f0e0c0'];

export function buildFX(world) {
  const group = new THREE.Group();
  group.name = 'fx';
  world.scene.add(group);

  const quadBottom = new THREE.PlaneGeometry(1, 1); quadBottom.translate(0, 0.5, 0); // origin at bottom centre
  const quadCenter = new THREE.PlaneGeometry(1, 1);

  const pools = [];
  function pool(n, make, name) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const m = make(i);
      m.name = `fx.${name}.${i}`;
      m.visible = false;
      m.traverse((o) => { o.userData.noAudit = true; o.castShadow = false; o.receiveShadow = false; if (o !== m && o.isMesh) o.name = `${m.name}.${o.name || 'part'}`; });
      group.add(m);
      items.push(m);
    }
    const p = { items, used: 0, take() { return this.used < items.length ? items[this.used++] : null; } };
    pools.push(p);
    return p;
  }

  const waveU = () => ({ uT: 0, uPhase: 0, uAmp: 0.04, uLambda: 0.15, uSpeed: 1, uThick: 0.03, uOpacity: 1, uReveal: 2, uSway: 0, uPixScr: 0, uSegs: 0,
    uGlow: 0.35, uSegF: 0.85, uRise: 0.45, uSoft: 0.15, uLevels: 0, uTopFade: 0.5, uSize: new THREE.Vector2(0.2, 0.5),
    uCore: COL.stinkCore.clone(), uEdge: COL.stinkEdge.clone(), uGlowCol: COL.stinkGlow.clone() });
  const cloudU = () => ({ uT: 0, uPhase: 0, uOpacity: 0.5, uPix: 0, uSoft: 0.3, uCoreA: 1, uCol: COL.puff.clone(), uCol2: COL.puff2.clone() });

  // ---------------------------------------------------------------- sweat drop mesh (teardrop + outline + highlight)
  // geometry units: bulb radius 0.3 (width 0.6, bottom y=-0.5), tip at y=0.52 -> height 1.02
  function makeDrop() {
    const prof = [];
    const R = 0.3, cy = -0.2;
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2 + 0.75); prof.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * R), cy + Math.sin(a) * R)); }
    prof.push(new THREE.Vector2(0.09, 0.3)); prof.push(new THREE.Vector2(0.0001, 0.52));
    const g = new THREE.LatheGeometry(prof, 9);
    g.computeVertexNormals();
    const grp = new THREE.Group();
    const body = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#3aa0e8', emissiveIntensity: 0.55, roughness: 0.12, metalness: 0, flatShading: true }));
    body.name = 'body';
    const outline = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#1b4f8f', side: THREE.BackSide }));
    outline.name = 'outline'; outline.scale.setScalar(1.14); outline.position.y = -0.005;
    const hl = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    hl.name = 'highlight'; hl.scale.set(0.055, 0.11, 0.035); hl.position.set(-0.1, -0.08, 0.265); hl.rotation.z = -0.35;
    grp.add(body, outline, hl);
    return grp;
  }

  const P = {
    wave: pool(48, () => new THREE.Mesh(quadBottom, shaderMat(WAVE_FS, waveU())), 'wave'),
    cloud: pool(48, () => new THREE.Mesh(quadCenter, shaderMat(CLOUD_FS, cloudU())), 'cloud'),
    star: pool(48, () => new THREE.Mesh(quadCenter, shaderMat(STAR_FS, { uOpacity: 1, uCol: COL.star.clone(), uGlowCol: COL.starGlow.clone() }, { depthTest: false })), 'star'),
    ring: pool(4, () => new THREE.Mesh(quadCenter, shaderMat(RING_FS, { uT: 0, uOpacity: 1, uRate: 1.6, uArcs: 1, uWob: 0.03, uCol: COL.ring.clone(), uOut: COL.ringOut.clone() })), 'ring'),
    streak: pool(8, () => new THREE.Mesh(quadCenter, shaderMat(STREAK_FS, { uT: 0, uOpacity: 1, uCount: 3, uMode: 0, uProg: 0, uW: 0.07, uCol: COL.white.clone(), uOut: COL.ink.clone() })), 'streak'),
    crumb: pool(24, (i) => new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: CRUMB_COLS[i % 4], roughness: 0.8, flatShading: true })), 'crumb'),
    sweat: pool(8, () => makeDrop(), 'sweat'),
  };

  // ---------------------------------------------------------------- state
  let T = 0, CTX = null;
  const pixBlock = (k = 5) => k * Math.max(0.25, (world.renderer?.domElement?.width || 1080) / 1080);
  const calls = [];
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  const ray = new THREE.Raycaster();

  // yaw (+ partial tilt toward camera) billboard for upright effects anchored at their bottom
  function uprightBillboard(m, base, cam, tiltK = 0.35) {
    const dx = cam.position.x - base.x, dz = cam.position.z - base.z, dy = cam.position.y - base.y;
    const yaw = Math.atan2(dx, dz);
    const elev = Math.atan2(dy, Math.hypot(dx, dz));
    m.rotation.set(-clamp(elev * tiltK, -0.45, 0.45), yaw, 0, 'YXZ');
    m.position.copy(base);
  }
  function fullBillboard(m, pos, cam, roll = 0) {
    m.position.copy(pos);
    m.quaternion.copy(cam.quaternion);
    if (roll) m.quaternion.multiply(tmpQ.setFromAxisAngle(tmpV2.set(0, 0, 1), roll));
  }
  const towardCam = (p, cam, d) => p.clone().add(tmpV.subVectors(cam.position, p).normalize().multiplyScalar(d));

  // ---------------------------------------------------------------- stink + steam
  // Line bases are spread along the camera's horizontal right vector (layout 'screen', default) so from any view the
  // lines fan out across the frame (optionally leaving a central `gap`, e.g. the body width), with a little depth
  // jitter; layout 'ring' places them on a fixed ring around `at` instead.
  const SLOTS = [-0.55, 0.6, 0.02, -0.95, 0.95, 0.3];
  function doStink(o, idx, cam, steam = false) {
    const t = o.t ?? T;
    const amount = clamp(o.amount ?? (steam ? 0.7 : 0.6));
    if (amount <= 0.001) return;
    const seed = o.seed ?? (idx * 17 + (steam ? 101 : 3));
    const at = V(o.at);
    const spread = o.spread ?? (steam ? 0.12 : 0.32);
    const gap = Math.min(o.gap ?? 0, spread * 0.9);
    const H0 = (o.height ?? (steam ? 0.22 : 0.5)) * lerp(0.62, 1.0, amount);
    const thickK = o.thick ?? 1;
    const maxN = steam ? 4 : 6;
    const nF = o.count ?? (steam ? lerp(2, 4, amount) : lerp(3, 6, amount));
    const opac = (steam ? lerp(0.3, 0.6, amount) : lerp(0.6, 1.0, amount)) * smooth(amount / 0.06);
    const bursts = o.burst == null ? [] : (Array.isArray(o.burst) ? o.burst : [o.burst]);
    let boost = 0;
    for (const b of bursts) { const u = (t - b) / 0.9; if (u >= 0 && u < 1) boost = Math.max(boost, Math.sin(Math.PI * Math.min(1, u * 2.5)) * (1 - u)); }
    // camera-horizontal frame
    const fwd = cam.getWorldDirection(new THREE.Vector3()); fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    for (let i = 0; i < maxN; i++) {
      const w = clamp(nF - i);
      if (w <= 0.001) break;
      const m = P.wave.take(); if (!m) break;
      const r1 = h(i, seed), r2 = h(i + 31, seed), r3 = h(i + 57, seed), r4 = h(i + 83, seed);
      const H = H0 * (0.8 + 0.3 * r2) * (1 + boost * 0.25);
      const amp = H * (steam ? 0.06 : 0.075) * (0.85 + 0.35 * r3);
      const lam = H * (steam ? 0.42 : 0.36) * (0.85 + 0.3 * r4);
      const thick = H * (steam ? 0.035 : 0.085) * thickK * (0.88 + 0.24 * r2);
      const sway = amp * 0.8 * Math.sin(t * (0.9 + 0.5 * r1) + r3 * TAU);
      const W = 2 * (amp * 1.25 + Math.abs(sway) + thick * 2.2);
      const base = at.clone();
      if ((o.layout ?? 'screen') === 'ring') {
        const ang = i * 2.39996 + seed * 0.7, rad = (0.62 + 0.38 * r1) * spread * 0.5;
        base.add(tmpV.set(Math.cos(ang) * rad, 0, Math.sin(ang) * rad));
      } else {
        const sl = (steam ? [-0.5, 0.5, 0.0, 0.9][i] : SLOTS[i]) + (r1 - 0.5) * 0.12;
        const x = Math.sign(sl || 1) * (gap / 2 + Math.abs(sl) * (spread / 2 - gap / 2));
        base.addScaledVector(right, x).addScaledVector(fwd, (r4 - 0.5) * spread * 0.35);
      }
      base.y += (r4 - 0.5) * 0.04 * H;
      uprightBillboard(m, base, cam);
      m.scale.set(W, H, 1);
      const u = m.material.uniforms;
      u.uT.value = t + r1 * 7.0; u.uPhase.value = r2 * TAU; u.uAmp.value = amp; u.uLambda.value = lam;
      const riseRate = steam ? 0.28 : 0.4 + 0.12 * r3, segF = steam ? 0.7 : 0.8 + 0.25 * r4;
      u.uRise.value = riseRate; u.uSegF.value = segF;
      u.uSpeed.value = (riseRate / segF) / (lam / H);
      u.uThick.value = thick; u.uSway.value = sway; u.uSize.value.set(W, H);
      u.uOpacity.value = Math.min(1, opac * smooth(w / 0.35) * (1 + boost * 0.3));   // a line fading in grows up from the base
      u.uPixScr.value = steam ? 0 : pixBlock(o.pixel ?? 5);
      u.uSegs.value = steam ? 0 : 8;
      u.uGlow.value = steam ? 0.25 : 0.12;
      u.uSoft.value = steam ? 0.45 : 0.04;
      u.uLevels.value = 0;
      u.uTopFade.value = steam ? 0.35 : 0.55;
      u.uReveal.value = Math.min(o.t0 != null ? clamp((t - o.t0 - i * 0.12) / 0.55) * 1.25 : 2, w < 1 ? w * 1.25 : 2);
      if (steam) { u.uCore.value.copy(COL.steamCore); u.uEdge.value.copy(COL.steamEdge); u.uGlowCol.value.copy(COL.steamGlow); }
      else { u.uCore.value.copy(COL.stinkCore); u.uEdge.value.copy(COL.stinkEdge); u.uGlowCol.value.copy(COL.stinkGlow); }
      m.material.depthTest = !o.overlay;
      m.renderOrder = (steam ? 40 : 20) + P.wave.used * 0.01;
      m.visible = true;
    }
    if (steam) return;
    // small green puffs drifting up from the base
    const puffs = o.puffs ?? false;
    if (puffs) {
      for (let i = 0; i < 3; i++) {
        if (o.t0 != null && t < o.t0 + 0.2 + i * 0.25) continue;
        const m = P.cloud.take(); if (!m) break;
        const r1 = h(i + 200, seed), r2 = h(i + 230, seed);
        const u = ((t + 20) / 1.9 + i / 3 + r1 * 0.2) % 1;
        const sl = [-0.75, 0.8, 0.1][i];
        const x = Math.sign(sl) * (gap / 2 + Math.abs(sl) * (spread / 2 - gap / 2));
        const base = at.clone().addScaledVector(right, x).addScaledVector(fwd, (r2 - 0.5) * spread * 0.2);
        base.y += H0 * (0.05 + 0.4 * u);
        const s = H0 * (0.16 + 0.2 * u) * (0.85 + 0.3 * r2);
        fullBillboard(m, base, cam, r1 * 3);
        m.scale.set(s, s, 1);
        const un = m.material.uniforms;
        un.uT.value = t; un.uPhase.value = r2 * TAU; un.uPix.value = pixBlock(5); un.uSoft.value = 0.2; un.uCoreA.value = 0.75;
        un.uOpacity.value = Math.sin(Math.PI * u) * 0.5 * amount;
        un.uCol.value.copy(COL.puff); un.uCol2.value.copy(COL.puff2);
        m.renderOrder = 15 + P.cloud.used * 0.01;
        m.visible = true;
      }
    }
    // bursts: green puffs pushed out of the source (e.g. on every chew)
    for (const b of bursts) {
      const ub = (t - b) / 1.1;
      if (ub < 0 || ub >= 1) continue;
      for (let i = 0; i < 4; i++) {
        const m = P.cloud.take(); if (!m) break;
        const r1 = h(i + 300, seed + Math.round(b * 30));
        const e = 1 - Math.pow(1 - ub, 2.5);
        const sl = [-1, 1, -0.55, 0.6][i] * (0.85 + 0.3 * r1);
        const x = Math.sign(sl) * (gap / 2 + Math.abs(sl) * spread * 0.5 * (0.35 + 0.65 * e));
        const pos = at.clone().addScaledVector(right, x).addScaledVector(fwd, (r1 - 0.5) * spread * 0.2);
        pos.y += H0 * (0.04 + 0.3 * e) + (i % 2) * 0.03;
        const s = H0 * (0.12 + 0.3 * e);
        fullBillboard(m, pos, cam, r1 * 4);
        m.scale.set(s, s, 1);
        const un = m.material.uniforms;
        un.uT.value = t; un.uPhase.value = r1 * TAU; un.uPix.value = pixBlock(5); un.uSoft.value = 0.2; un.uCoreA.value = 0.7;
        un.uOpacity.value = smooth(ub / 0.08) * Math.pow(1 - ub, 1.4) * 0.7;
        un.uCol.value.copy(COL.puff); un.uCol2.value.copy(COL.puff2);
        m.renderOrder = 16 + P.cloud.used * 0.01;
        m.visible = true;
      }
    }
  }

  // ---------------------------------------------------------------- sweat
  // Paths in head space: [azimuth from the face direction toward the side (deg), elevation (deg)] keypoints.
  const DROP_PATHS = [
    [[38, 30], [50, 2], [60, -40]],     // temple -> cheek -> jaw (main)
    [[16, 52], [44, 24], [56, -30]],    // forehead (same side) -> around the outer brow -> cheek
    [[40, 26], [52, 0], [62, -36]],     // other temple
  ];
  function pathDir(path, s, sx, out) {
    const seg = s < 0.5 ? 0 : 1, u = s < 0.5 ? s * 2 : (s - 0.5) * 2;
    const a = path[seg], b = path[seg + 1];
    const az = THREE.MathUtils.degToRad(lerp(a[0], b[0], u)), el = THREE.MathUtils.degToRad(lerp(a[1], b[1], u));
    return out.set(sx * Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  }
  const headMeshes = (head) => { const arr = []; head.traverse((o) => { if (o.isMesh && o.visible) arr.push(o); }); return arr; };
  // ray from outside toward the head centre; first hit = outer surface. Returns {rho (local units), slant 0..1}
  function surfaceRadius(head, meshes, dirLocal, rL, sW) {
    const o = head.localToWorld(tmpV.copy(dirLocal).multiplyScalar(rL * 2.6));
    const c = head.localToWorld(tmpV2.set(0, 0, 0));
    const dir = c.sub(o).normalize();
    ray.set(o, dir); ray.near = 0; ray.far = rL * 2.6 * sW;
    const hits = meshes.length ? ray.intersectObjects(meshes, false) : [];
    if (!hits.length) return { rho: rL, slant: 0, hair: false };
    const hit = hits[0];
    const nm = `${hit.object.name} ${hit.object.parent ? hit.object.parent.name : ''}`;
    const hair = /hair|hat|cap|bun|beanie|wig/i.test(nm);
    let slant = 0;
    if (hit.face) {
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const c2 = Math.max(0, -n.dot(dir));
      slant = Math.sqrt(Math.max(0, 1 - c2 * c2));
    }
    return { rho: (rL * 2.6 * sW - hit.distance) / sW, slant, hair };
  }
  function doSweat(o, idx, cam) {
    const ch = o.ch;
    if (!ch || !ch.head) return;
    if (ch.root && ch.root.visible === false) return;
    const t = o.t ?? T;
    const head = ch.head;
    head.updateWorldMatrix(true, true);
    const sW = new THREE.Vector3().setFromMatrixScale(head.matrixWorld).x || 1;
    const r = ch.headRadius || 0.11, rL = r / sW;
    const size = o.size ?? 1;
    const dropH = r * 0.46 * size, dropW = dropH * 0.6, dropT = dropH * 0.36; // world metres
    const t0 = o.t0 ?? (CTX ? CTX.t - CTX.lt + 0.15 : 0);
    const hold = o.hold ?? 0.25, slide = o.slide ?? 1.3, drip = 0.3;
    const count = clamp(Math.round(o.count ?? 1), 1, 3);
    let side = o.side ?? 'auto';
    if (side !== 'L' && side !== 'R') side = head.worldToLocal(cam.position.clone()).x >= 0 ? 'L' : 'R';
    const sxMain = side === 'L' ? 1 : -1; // 'L' = the character's left = +X in head space (face looks +Z)
    const meshes = headMeshes(head);
    const dirL = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      const start = t0 + k * 0.42;
      let tau = t - start;
      if (o.repeat && tau > 0) tau %= o.repeat;
      const life = 0.2 + hold + slide + drip;
      if (tau < 0 || tau >= life) continue;
      const g = P.sweat.take(); if (!g) break;
      const path = DROP_PATHS[k], sx = k === 2 ? -sxMain : sxMain;
      // slide parameter: clings, then accelerates, with a tiny stick-slip
      let s = 0;
      const ts = tau - 0.2 - hold;
      if (ts > 0) { const u = clamp(ts / slide); s = clamp(0.35 * u * u + 0.65 * u * u * u + 0.025 * Math.sin(u * TAU * 2) * u * (1 - u)); }
      // surface distance profile along the path (max-filtered so the drop rides over bumps smoothly)
      const N = 14, prof = [];
      const d = new THREE.Vector3();
      let firstSkin = -1;
      for (let i = 0; i <= N; i++) {
        pathDir(path, i / N, sx, d);
        const { rho, slant, hair } = surfaceRadius(head, meshes, d, rL, sW);
        prof.push(rho + (dropW * 0.5 * slant * 0.8) / sW);
        if (!hair && firstSkin < 0) firstSkin = i;
      }
      // start below the hairline (sweat sits on skin, not on hair)
      const s0 = firstSkin > 0 && firstSkin <= N - 4 ? (firstSkin + 0.25) / N : 0;
      const se = s0 + s * (1 - s0);
      pathDir(path, se, sx, dirL);
      const fi = se * N, i0 = Math.min(N - 1, Math.floor(fi)), fr = fi - i0;
      const pm = (i) => Math.max(prof[Math.max(0, i - 1)], prof[i], prof[Math.min(N, i + 1)]);
      const rho = lerp(pm(i0), pm(i0 + 1), fr);
      const out = rho + (dropT * 0.42 + 0.0015) / sW;
      const pos = head.localToWorld(dirL.clone().multiplyScalar(out));
      const n = dirL.clone().transformDirection(head.matrixWorld);
      const upW = new THREE.Vector3(0, 1, 0).transformDirection(head.matrixWorld);
      const up = upW.sub(n.clone().multiplyScalar(upW.dot(n))).normalize();
      const xAxis = new THREE.Vector3().crossVectors(up, n).normalize();
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, up, n));
      // pop (overshoot) / jiggle / drip off
      let sc = 1;
      if (tau < 0.2) sc = Math.max(0.001, easeOutBack(tau / 0.2, 2.6));
      let sy = 1 + Math.sin(tau * 26) * Math.exp(-tau * 6) * 0.12 + (ts > 0 ? 0.12 * clamp(ts / slide) : 0);
      const td = tau - (0.2 + hold + slide);
      if (td > 0) {
        const u = td / drip;
        pos.addScaledVector(n, 0.12 * td * r / 0.11).add(tmpV.set(0, -0.5 * 3.2 * td * td - 0.15 * td, 0));
        sy *= 1 + 0.5 * u;
        sc *= 1 - smooth((u - 0.35) / 0.65);
      }
      g.position.copy(pos);
      g.scale.set((dropW * sc) / 0.6, (dropH * sc * sy) / 1.02, (dropT * sc) / 0.6);
      g.visible = sc > 0.01;
    }
  }

  // ---------------------------------------------------------------- rumble
  function doRumble(o, idx, cam) {
    const t = o.t ?? T;
    const amount = clamp(o.amount ?? 0.7);
    if (amount <= 0.001) return;
    const m = P.ring.take(); if (!m) return;
    const at = V(o.at);
    const pos = towardCam(at, cam, o.offset ?? 0.12);
    const jit = new THREE.Vector3(noise1(t * 22, 3), noise1(t * 22, 7), 0).applyQuaternion(cam.quaternion).multiplyScalar(0.004 * amount);
    pos.add(jit);
    const R = 0.16 * (0.6 + 0.7 * amount) * (o.size ?? 1) * (1 + 0.04 * Math.sin(t * 31));
    fullBillboard(m, pos, cam, Math.sin(t * 9) * 0.05);
    m.scale.set(R * 2, R * 2, 1);
    const u = m.material.uniforms;
    u.uT.value = t; u.uOpacity.value = smooth(amount / 0.15); u.uRate.value = 1.3 + 0.9 * amount;
    u.uArcs.value = (o.style ?? 'arcs') === 'rings' ? 0 : 1; u.uWob.value = 0.025 + 0.03 * amount;
    m.renderOrder = 60 + P.ring.used * 0.01;
    m.visible = true;
  }

  // ---------------------------------------------------------------- haze
  function doHaze(o, idx, cam) {
    const t = o.t ?? T;
    const amount = clamp(o.amount ?? 0.6);
    if (amount <= 0.001) return;
    const at = V(o.at), R = o.radius ?? 0.5, seed = o.seed ?? (idx * 29 + 5);
    for (let i = 0; i < 8; i++) {
      const m = P.cloud.take(); if (!m) break;
      const r1 = h(i + 400, seed), r2 = h(i + 430, seed), r3 = h(i + 460, seed);
      const ang = i * 2.39996 + seed;
      const rad = R * (i === 0 ? 0 : 0.35 + 0.45 * r1);
      const pos = at.clone().add(tmpV.set(
        Math.cos(ang) * rad + noise1(t * 0.25 + i * 3, 1) * R * 0.12,
        (r2 - 0.4) * R * 0.6 + noise1(t * 0.2 + i * 5, 2) * R * 0.08 + Math.sin(t * 0.4 + i) * R * 0.03,
        Math.sin(ang) * rad + noise1(t * 0.25 + i * 7, 4) * R * 0.12));
      const s = R * (0.9 + 0.5 * r3) * (1 + 0.05 * Math.sin(t * 0.7 + i));
      fullBillboard(m, pos, cam, r1 * TAU + t * 0.05 * (r2 - 0.5));
      m.scale.set(s, s, 1);
      const u = m.material.uniforms;
      u.uT.value = t * 0.6; u.uPhase.value = r2 * TAU; u.uPix.value = 0; u.uSoft.value = 0.55; u.uCoreA.value = 1;
      u.uOpacity.value = 0.2 * amount * (0.8 + 0.2 * Math.sin(t * 0.9 + i * 1.7));
      u.uCol.value.copy(COL.haze); u.uCol2.value.copy(COL.haze2);
      m.renderOrder = 5 + P.cloud.used * 0.01;
      m.visible = true;
    }
  }

  // ---------------------------------------------------------------- glint
  function doGlint(o, idx, cam) {
    const t = o.t ?? T;
    const t0 = o.t0 ?? (CTX ? CTX.t - CTX.lt + 0.3 : 0);
    const at = V(o.at), size = o.size ?? 1;
    for (let k = 0; k < 2; k++) {
      const tau = t - t0 - k * 0.09;
      if (tau < 0 || tau > 0.62) continue;
      const m = P.star.take(); if (!m) break;
      let sc = tau < 0.12 ? easeOutBack(tau / 0.12, 2.2) : tau < 0.3 ? 1 : 1 - smooth((tau - 0.3) / 0.32);
      sc = Math.max(1e-4, sc * (k === 0 ? 0.09 : 0.045) * size);
      const off = k === 0 ? new THREE.Vector3() : new THREE.Vector3(0.035, 0.028, 0).applyQuaternion(cam.quaternion).multiplyScalar(size);
      fullBillboard(m, towardCam(at, cam, 0.03).add(off), cam, tau * 2.4 + k * 0.6);
      m.scale.set(sc, sc, 1);
      m.material.uniforms.uOpacity.value = 1;
      m.renderOrder = 90 + P.star.used * 0.01;
      m.visible = true;
    }
  }

  // ---------------------------------------------------------------- impact
  function doImpact(o, idx, cam) {
    const t = o.t ?? T;
    const t0 = o.t0 ?? (CTX ? CTX.t - CTX.lt : 0);
    const tau = t - t0;
    if (tau < 0 || tau > 0.75) return;
    const at = V(o.at), size = o.size ?? 1, seed = o.seed ?? (idx * 37 + 9);
    // dust puffs sliding outward along the surface
    const u = clamp(tau / 0.55);
    if (u < 1) {
      for (let i = 0; i < 5; i++) {
        const m = P.cloud.take(); if (!m) break;
        const r1 = h(i + 500, seed), ang = (i / 5) * TAU + r1 * 0.8;
        const e = 1 - Math.pow(1 - u, 2.2);
        const s = size * (0.035 + 0.07 * e) * (0.8 + 0.4 * r1);
        const pos = at.clone().add(tmpV.set(Math.cos(ang) * 0.11 * size * e, s * 0.45 + 0.01 * size, Math.sin(ang) * 0.11 * size * e));
        fullBillboard(m, pos, cam, r1 * 5);
        m.scale.set(s, s, 1);
        const un = m.material.uniforms;
        un.uT.value = t; un.uPhase.value = r1 * TAU; un.uPix.value = pixBlock(4); un.uSoft.value = 0.25; un.uCoreA.value = 0.8;
        un.uOpacity.value = smooth(u / 0.06) * Math.pow(1 - u, 1.3) * 0.85;
        un.uCol.value.copy(COL.dust); un.uCol2.value.copy(COL.dust2);
        m.renderOrder = 64 + P.cloud.used * 0.01;
        m.visible = true;
      }
    }
    // crumbs hop out, bounce once and shrink away
    if (o.crumbs !== false) {
      for (let i = 0; i < 7; i++) {
        const r1 = h(i + 600, seed), r2 = h(i + 630, seed), r3 = h(i + 660, seed);
        const sc = 0.008 * size * (0.7 + 0.6 * r2) * (1 - smooth((tau - 0.5) / 0.25));
        if (sc < 1e-4) continue;
        const m = P.crumb.take(); if (!m) break;
        const ang = (i / 7) * TAU + r1;
        const vh = (0.35 + 0.35 * r2) * size, vy = (0.9 + 0.6 * r3) * Math.sqrt(size), g = 9.0;
        const tf = (2 * vy) / g;
        let y, dist;
        if (tau < tf) { y = vy * tau - 0.5 * g * tau * tau; dist = vh * tau; }
        else { const t2 = tau - tf, vy2 = vy * 0.3, tf2 = (2 * vy2) / g; y = t2 < tf2 ? vy2 * t2 - 0.5 * g * t2 * t2 : 0; dist = vh * tf + vh * 0.4 * Math.min(t2, tf2 + 0.05); }
        m.position.copy(at).add(tmpV.set(Math.cos(ang) * dist, Math.max(0, y) + sc * 0.45, Math.sin(ang) * dist));
        m.rotation.set(tau * 9 * r1, tau * 7 * r3 + i, 0);
        m.scale.setScalar(sc);
        m.material.color.set(o.color ? (Array.isArray(o.color) ? o.color[i % o.color.length] : o.color) : CRUMB_COLS[i % 4]);
        m.visible = true;
      }
    }
    // radial motion lines (upward fan)
    const ul = tau / 0.38;
    if (ul < 1) {
      const m = P.streak.take();
      if (m) {
        const R = 0.17 * size;
        fullBillboard(m, towardCam(at, cam, 0.05).add(new THREE.Vector3(0, R * 0.25, 0)), cam);
        m.scale.set(R * 2, R * 2, 1);
        const un = m.material.uniforms;
        un.uMode.value = 1; un.uCount.value = 5; un.uProg.value = ul; un.uW.value = 0.05; un.uT.value = t;
        un.uOpacity.value = 1 - smooth((ul - 0.6) / 0.4);
        m.renderOrder = 66 + P.streak.used * 0.01;
        m.visible = true;
      }
    }
  }

  // ---------------------------------------------------------------- action lines
  function doLines(o, idx, cam) {
    const t = o.t ?? T;
    let a = clamp(o.amount ?? 1);
    if (o.t0 != null) a *= smooth((t - o.t0) / 0.06);
    if (o.t1 != null) a *= 1 - smooth((t - o.t1 + 0.1) / 0.1);
    if (a <= 0.001) return;
    const m = P.streak.take(); if (!m) return;
    const at = V(o.at), dir = V(o.dir ?? [0, 1, 0]).normalize(), len = o.len ?? 0.14;
    const p0 = at.clone().project(cam), p1 = at.clone().addScaledVector(dir, 0.05).project(cam);
    const ang = Math.atan2(p1.y - p0.y, (p1.x - p0.x) * cam.aspect);
    const behind = at.clone().addScaledVector(dir, -len * 0.45);   // streaks trail behind the moving point
    fullBillboard(m, towardCam(behind, cam, 0.04), cam, ang);
    m.scale.set(len * 2, len * 1.3, 1);
    const un = m.material.uniforms;
    un.uMode.value = 0; un.uCount.value = clamp(o.count ?? 3, 1, 8); un.uT.value = t; un.uW.value = 0.07; un.uProg.value = 0;
    un.uOpacity.value = a;
    m.renderOrder = 70 + P.streak.used * 0.01;
    m.visible = true;
  }

  // ---------------------------------------------------------------- module API
  const DO = { stink: (o, i, c) => doStink(o, i, c, false), steam: (o, i, c) => doStink(o, i, c, true), sweat: doSweat, rumble: doRumble,
    haze: doHaze, glint: doGlint, impact: doImpact, lines: doLines };
  const api = {
    group,
    reset(t, ctx) {
      T = t; CTX = ctx;
      calls.length = 0;
      for (const p of pools) { p.used = 0; for (const m of p.items) m.visible = false; }
      if (testMod) testMod.fxTest(api, t, ctx, world);
    },
    commit(ctx) {
      const cam = ctx.camera;
      cam.updateMatrixWorld(true);
      const counters = {};
      for (const [type, o] of calls) {
        const idx = (counters[type] = (counters[type] ?? -1) + 1);
        try { DO[type](o, idx, cam); } catch (e) { console.error(`[log] fx.${type} failed: ${e.message}`); }
      }
    },
  };
  for (const type of Object.keys(DO)) api[type] = (o = {}) => { if (o && (o.at || o.ch)) calls.push([type, o]); };
  return api;
}
