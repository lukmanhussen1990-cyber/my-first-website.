// X-ray scene for s20-s22: YOU seated (front view, facing +Z = the camera) as a glowing translucent shell with
// cartoon organs inside. Separate THREE.Scene. States (reset every frame, shots set them):
//   foodDrop 0..1 (turkey bite falls mouth -> pipe -> stomach), splash 0..1, zap 0..1 (signal travels stomach -> colon),
//   alert 0..1 (red "!" pops), squeeze 0..1 (peristalsis strength), flow (blob travel, any number), glow 0..1 (colon glow).
// Recommended cameras (9:16): body {pos:[0,0.98,1.75], target:[0,0.86,0], fov:42}
//   stomach {pos:[0.1,0.9,0.62], target:[0.04,0.84,0], fov:40}  colon {pos:[0,0.73,0.66], target:[0,0.71,0], fov:40}
import * as THREE from 'three';
import { clamp, smooth, hash1, noise1, easeOutBack } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function shellMat(color = '#5fd0ff', rim = '#c8f4ff', base = 0.07) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uCol: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) }, uBase: { value: base } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol, uRim; uniform float uBase; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); f = pow(f, 2.2);
        vec3 c = mix(uCol * uBase * 2.0, uRim, f); gl_FragColor = vec4(c * (uBase + f * 0.9), 1.0); }`,
  });
}
const organ = (hex, emis = 0.25) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, flatShading: true, emissive: new THREE.Color(hex).multiplyScalar(emis) });

function textCanvas(draw, w = 128, h = 128) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t; }

export function buildXray(world) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#071833');
  scene.add(new THREE.AmbientLight(0x9fb8ff, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(0.6, 1.6, 2.0); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd8ff, 1.0); rim.position.set(-1.5, 1.2, -1.0); scene.add(rim);

  {
    const gt = textCanvas((g, w, h) => {
      g.fillStyle = '#071833'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(80,170,255,0.35)'; for (let i = 0; i < w; i += 16) { g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
      g.fillStyle = 'rgba(80,170,255,0.12)'; for (let i = 8; i < w; i += 16) { g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
    });
    gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(10, 16);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(4, 6.4), new THREE.MeshBasicMaterial({ map: gt, toneMapped: false }));
    bg.position.set(0, 1.0, -0.8); scene.add(bg);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ color: '#1b4f9a', transparent: true, opacity: 0.35, toneMapped: false }));
    halo.position.set(0, 0.9, -0.79); scene.add(halo);
  }

  const body = new THREE.Group(); scene.add(body);
  const sm = shellMat();
  const part = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, sm); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.renderOrder = 5; body.add(m); return m; };
  part(new THREE.SphereGeometry(0.105, 12, 10).scale(0.82, 1.08, 0.95), 0, 1.27, 0.0);
  part(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 10), 0, 1.13, -0.005);
  const torsoG = new THREE.CylinderGeometry(0.175, 0.15, 0.5, 14, 4); torsoG.scale(1, 1, 0.62);
  part(torsoG, 0, 0.83, 0);
  part(new THREE.SphereGeometry(0.16, 12, 8).scale(1.05, 0.55, 0.7), 0, 0.57, 0.0);
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.06, 10, 8), s * 0.19, 1.04, 0);
    part(new THREE.CylinderGeometry(0.045, 0.04, 0.3, 9), s * 0.215, 0.9, 0.0, 0, 0, s * 0.08);
    part(new THREE.CylinderGeometry(0.04, 0.034, 0.27, 9), s * 0.17, 0.7, 0.13, 1.2, 0, -s * 0.2);
    part(new THREE.CylinderGeometry(0.075, 0.06, 0.44, 10), s * 0.095, 0.55, 0.23, Math.PI / 2, 0, 0);
    part(new THREE.CylinderGeometry(0.055, 0.045, 0.42, 9), s * 0.1, 0.3, 0.45, 0, 0, 0);
  }
  const seatM = shellMat('#7fa8ff', '#9fc4ff', 0.04);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.44), seatM); seat.position.set(0, 0.44, 0.05); seat.renderOrder = 4; scene.add(seat);
  const boneM = new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false });
  for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.13 - i * 0.004, 0.006, 4, 18, Math.PI * 1.4), boneM); r.rotation.set(Math.PI / 2, 0, Math.PI * 0.8); r.scale.set(1, 0.62, 1); r.position.set(0, 1.0 - i * 0.045, -0.01); r.renderOrder = 6; scene.add(r); }
  for (let i = 0; i < 12; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.025), boneM); v.position.set(0, 0.6 + i * 0.045, -0.07); v.renderOrder = 6; scene.add(v); }

  const pipeCurve = new THREE.CatmullRomCurve3([V(0, 1.2, 0.03), V(0, 1.1, 0.0), V(0.005, 1.0, -0.005), V(0.02, 0.95, 0.0), V(0.045, 0.925, 0.01)]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 24, 0.012, 7), organ('#e8909c', 0.3)));
  const stomachG = new THREE.SphereGeometry(1, 14, 10);
  { const p = stomachG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * 0.085, y * 0.055 - 0.35 * x * x * 0.06 + x * 0.02, z * 0.045); } stomachG.computeVertexNormals(); }
  const stomachMat = organ('#ee7f95', 0.35);
  const stomach = new THREE.Mesh(stomachG, stomachMat); stomach.position.set(0.065, 0.88, 0.01); stomach.rotation.z = -0.35; scene.add(stomach);
  const stomachC = V(0.065, 0.875, 0.01);
  const siPts = [];
  for (let i = 0; i <= 60; i++) { const u = i / 60, a = u * Math.PI * 9; siPts.push(V(Math.sin(a) * (0.05 + 0.012 * Math.sin(u * 13)), 0.78 - u * 0.13 + Math.cos(a * 0.5) * 0.008, 0.02 + Math.cos(a) * 0.02)); }
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(siPts), 200, 0.0105, 6), organ('#f3a3a0', 0.25)));
  const colonCurve = new THREE.CatmullRomCurve3([
    V(-0.095, 0.615, 0.02), V(-0.105, 0.7, 0.025), V(-0.1, 0.8, 0.03), V(-0.06, 0.825, 0.04), V(0.0, 0.815, 0.045), V(0.06, 0.825, 0.04),
    V(0.11, 0.8, 0.03), V(0.12, 0.7, 0.025), V(0.105, 0.625, 0.03), V(0.05, 0.6, 0.04), V(0.015, 0.575, 0.035), V(0.0, 0.53, 0.03),
  ]);
  const CSEG = 140, CRAD = 8;
  const colonG = new THREE.TubeGeometry(colonCurve, CSEG, 0.021, CRAD);
  const colonBase = Float32Array.from(colonG.attributes.position.array);
  const centers = []; for (let i = 0; i <= CSEG; i++) centers.push(colonCurve.getPointAt(i / CSEG));
  const colonMat = organ('#d98466', 0.25);
  scene.add(new THREE.Mesh(colonG, colonMat));
  const blobM = organ('#6b3b1c', 0.15);
  const blobs = []; for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 8, 6), blobM); scene.add(b); blobs.push(b); }
  const food = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.026), organ('#e2c39a', 0.35)); scene.add(food);
  const splash = []; for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.006 + hash1(i) * 0.004, 5, 4), organ('#ffd0d8', 0.6)); scene.add(s); splash.push(s); }
  const zapPath = [stomachC.clone().add(V(0.04, -0.02, 0.03)), V(0.13, 0.84, 0.05), V(0.1, 0.8, 0.06), V(0.15, 0.77, 0.06), V(0.11, 0.74, 0.06), V(0.14, 0.71, 0.06), V(0.115, 0.68, 0.05)];
  const zapMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff35a').multiplyScalar(1.6), toneMapped: false });
  const zapSegs = [];
  for (let i = 0; i < zapPath.length - 1; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1, 0.008), zapMat); m.renderOrder = 20; scene.add(m); zapSegs.push(m); }
  const glowTex = textCanvas((g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,245,140,1)'); gr.addColorStop(0.4, 'rgba(255,220,60,0.5)'); gr.addColorStop(1, 'rgba(255,200,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 64, 64);
  glowTex.magFilter = THREE.LinearFilter;
  const zapGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); zapGlow.renderOrder = 21; scene.add(zapGlow);
  const alertTex = textCanvas((g, w, h) => {
    g.fillStyle = '#e8262a'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.44, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#ffffff'; g.fillRect(w / 2 - 9, h * 0.2, 18, h * 0.42); g.fillRect(w / 2 - 9, h * 0.7, 18, 16);
  });
  const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTex, transparent: true, depthWrite: false, toneMapped: false })); alert.renderOrder = 22; scene.add(alert);

  const state = {};
  const anchors = { stomach: stomachC.clone(), colon: V(0.0, 0.71, 0.03), mouth: V(0, 1.2, 0.08), exit: V(0, 0.53, 0.03) };
  const tmp = V();

  function reset() { Object.assign(state, { foodDrop: -1, splash: 0, zap: 0, alert: 0, squeeze: 0, flow: 0, glow: 0 }); }

  function commit(ctx) {
    if (ctx.scene !== scene) return;
    const t = ctx.t, st = state;
    if (st.foodDrop >= 0 && st.foodDrop <= 1) {
      food.visible = true;
      const u = st.foodDrop;
      if (u < 0.75) food.position.copy(pipeCurve.getPointAt(u / 0.75));
      else food.position.copy(pipeCurve.getPointAt(1)).lerp(stomachC, smooth((u - 0.75) / 0.25));
      food.rotation.set(t * 3, t * 2, t * 1.3);
    } else food.visible = false;
    for (const [i, s] of splash.entries()) {
      const a = (i / splash.length) * Math.PI * 2 + hash1(i * 3) * 0.6, k = st.splash;
      s.visible = k > 0.001 && k < 0.999;
      const r = 0.02 + 0.045 * smooth(k);
      s.position.set(stomachC.x + Math.cos(a) * r, stomachC.y + Math.sin(a) * r * 0.7 + 0.02 * Math.sin(k * Math.PI), stomachC.z + 0.035);
      s.scale.setScalar(1 - k * 0.7);
    }
    stomach.scale.setScalar(1 + 0.08 * Math.sin(Math.PI * clamp(st.splash)));
    stomachMat.emissiveIntensity = 1 + st.splash * 1.5 + st.zap * 0.6;
    const pos = colonG.attributes.position;
    for (let i = 0; i <= CSEG; i++) {
      const u = i / CSEG;
      const w = Math.pow(Math.max(0, Math.sin((u * 6 - st.flow * 1.5) * Math.PI * 2)), 6);
      const k = 1 - st.squeeze * 0.5 * w + st.glow * 0.06 * Math.sin(t * 12 + u * 20);
      const c = centers[i];
      for (let j = 0; j <= CRAD; j++) {
        const vi = i * (CRAD + 1) + j;
        tmp.set(colonBase[vi * 3] - c.x, colonBase[vi * 3 + 1] - c.y, colonBase[vi * 3 + 2] - c.z).multiplyScalar(k);
        pos.setXYZ(vi, c.x + tmp.x, c.y + tmp.y, c.z + tmp.z);
      }
    }
    pos.needsUpdate = true; colonG.computeVertexNormals();
    colonMat.emissive.set('#d98466').multiplyScalar(0.25 + st.glow * 0.35);
    colonMat.emissiveIntensity = 1 + st.glow * 1.8;
    for (const [i, b] of blobs.entries()) {
      const u = 0.42 + ((st.flow * 0.12 + i * 0.13) % 0.55);
      b.visible = st.squeeze > 0.01 && u < 0.985;
      b.position.copy(colonCurve.getPointAt(Math.min(u, 1))).add(V(0, 0, 0.004));
      b.scale.setScalar(0.9 + 0.2 * hash1(i * 7));
    }
    const z = clamp(st.zap), nSeg = zapSegs.length;
    for (const [i, m] of zapSegs.entries()) {
      const a = zapPath[i], b = zapPath[i + 1];
      const segK = clamp(z * (nSeg + 2) - i);
      m.visible = z > 0 && segK > 0 && z < 0.999;
      if (!m.visible) continue;
      const end = a.clone().lerp(b, Math.min(1, segK));
      const d = end.clone().sub(a), len = Math.max(1e-4, d.length());
      m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.scale.set(1 + noise1(t * 40, i) * 0.4, len, 1);
    }
    if (z > 0 && z < 0.999) { const k = Math.min(nSeg - 0.001, z * (nSeg + 2)), i = Math.floor(k); zapGlow.visible = true; zapGlow.position.copy(zapPath[i].clone().lerp(zapPath[i + 1], clamp(k - i))); zapGlow.scale.setScalar(0.07 + 0.03 * Math.abs(noise1(t * 30, 3))); }
    else zapGlow.visible = false;
    alert.visible = st.alert > 0.001;
    alert.position.set(0.2, 0.86 + 0.01 * Math.sin(t * 8), 0.08); alert.scale.setScalar(0.085 * easeOutBack(clamp(st.alert * 1.4)));
  }

  return { scene, reset, commit, anchors, state };
}
