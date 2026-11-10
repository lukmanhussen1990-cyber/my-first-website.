// Low-poly adult guy: procedural faceted body, points-based rig (IK arms/legs), expressive face, phone in both hands.
import * as THREE from 'three';
import { facet, mat, mesh, loft, limbGeo, blob, box, span, ik2 } from './geo.js';
import { clamp, lerp, sat, TAU, hash1 } from './util.js';


export const PHONE = { W: 0.086, H: 0.178, T: 0.010, SW: 0.0800, SH: 0.1720 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const SKIN = new THREE.Color(0xedb48e), SKIN_RED = new THREE.Color(0xe2553f);

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}

export function faceZ(x, y) {   // approximate front surface of the head (head-local, centre at origin)
  const nx = x / 0.19, ny = y / 0.215; const nz = Math.sqrt(Math.max(1 - nx * nx - ny * ny, 0.05));
  let z = nz > 0.55 ? 0.2 * (0.55 + (nz - 0.55) * 0.45) : 0.2 * nz; if (ny < 0) z *= 1 - 0.1 * -ny; return z;
}

export function buildCharacter(uiTexture) {
  const root = new THREE.Group();
  const skinM = mat(SKIN.getHex(), { roughness: 0.7 });
  const shirtM = mat(0x2f6fe0, { roughness: 0.9 }), pantsM = mat(0x1c2748, { roughness: 0.9 }), sockM = mat(0xd9dbe3, { roughness: 1 });
  const hairM = mat(0x5a371c, { roughness: 0.8 }), blackM = new THREE.MeshStandardMaterial({ color: 0x08080c, roughness: 0.35 });
  const whiteM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5) });
  const mouthM = new THREE.MeshBasicMaterial({ color: 0x14060a, side: THREE.DoubleSide }), teethM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.92, 0.92, 0.9), side: THREE.DoubleSide });
  const tongueM = new THREE.MeshBasicMaterial({ color: 0x9c2f3a, side: THREE.DoubleSide });

  // ---------- pelvis + legs (root space) ----------
  mesh(loft([{ y: -0.085, rx: 0.13, rz: 0.1 }, { y: -0.02, rx: 0.145, rz: 0.105 }, { y: 0.05, rx: 0.132, rz: 0.092 }], 8, { seed: 11 }), pantsM, { parent: root });
  const legs = [-1, 1].map((s) => {
    const o = { s, thigh: mesh(limbGeo(0.066, 0.05, 6, { seed: 20 + s }), pantsM, { parent: root }), shin: mesh(limbGeo(0.05, 0.036, 6, { seed: 22 + s }), pantsM, { parent: root }),
      knee: mesh(blob(0.052, 0, null, { seed: 24 + s }), pantsM, { parent: root }),
      foot: mesh(blob(1, 1, (v, n) => v.set(n.x * 0.045, Math.max(n.y, -0.35) * 0.04, n.z * 0.1 + 0.045), { seed: 26 + s }), sockM, { parent: root }) };
    return o;
  });

  // ---------- torso ----------
  const torso = new THREE.Group(); root.add(torso);
  mesh(loft([{ y: 0.0, rx: 0.136, rz: 0.098 }, { y: 0.12, rx: 0.124, rz: 0.086, z: 0.004 }, { y: 0.3, rx: 0.15, rz: 0.098, z: 0.008 }, { y: 0.43, rx: 0.17, rz: 0.088 }, { y: 0.495, rx: 0.075, rz: 0.062 }], 8, { seed: 30, jitter: 0.08 }), shirtM, { parent: torso });
  mesh(limbGeo(0.047, 0.043, 6, { seed: 31 }), skinM, { parent: torso, pos: [0, 0.47, 0.004], scale: [1, 0.12, 1] });   // neck
  mesh(loft([{ y: 0.478, rx: 0.068, rz: 0.058 }, { y: 0.505, rx: 0.058, rz: 0.05 }], 8, { seed: 32, capStart: false, capEnd: false }), shirtM, { parent: torso });   // collar
  const SHOULDER = [V(-0.178, 0.425, 0), V(0.178, 0.425, 0)];

  // ---------- head ----------
  const head = new THREE.Group(); head.position.set(0, 0.555, 0.006); torso.add(head);   // pivot at neck top
  const skull = new THREE.Group(); skull.position.y = 0.175; head.add(skull);
  mesh(blob(1, 1, (v, n) => {
    let x = n.x * 0.19, y = n.y * 0.215, z = n.z > 0.55 ? 0.2 * (0.55 + (n.z - 0.55) * 0.45) : n.z * 0.2;
    if (n.y < 0) { const t = -n.y; x *= 1 - 0.34 * Math.pow(t, 1.3); z *= 1 - 0.1 * t; }
    if (n.z < 0) z *= 1.04; v.set(x, y, z);
  }, { seed: 41, jitter: 0.055 }), skinM, { parent: skull });
  // ears (big)
  const earG = blob(1, 1, (v, n) => v.set(n.x * 0.024, n.y * 0.068 * (1 + 0.25 * n.y), n.z * 0.05), { seed: 43, jitter: 0.07 });
  const ears = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.178, 0.0, -0.005); skull.add(p); mesh(earG, skinM, { parent: p, pos: [s * 0.03, 0.005, -0.012], rot: [0, s * 0.75, s * -0.12] }); return p; });
  // nose (pointy)
  const nose = mesh(facet(new THREE.ConeGeometry(0.03, 0.1, 4), 0.07, 44), skinM, { parent: skull, pos: [0, -0.022, faceZ(0, -0.02) + 0.028], rot: [Math.PI / 2 + 0.22, Math.PI / 4, 0] });
  // hair
  const hair = new THREE.Group(); skull.add(hair);
  mesh(blob(1, 1, (v, n) => {
    let x = n.x * 0.207, y = n.y * 0.2 + 0.04, z = n.z * 0.212 - 0.022; const yMin = 0.02 + 0.105 * n.z + 0.03 * Math.abs(n.x);
    if (y < yMin) { y = yMin - 0.01; x *= 0.95; z = z * 0.95 - 0.004; } v.set(x, y, z);
  }, { seed: 45, jitter: 0.1 }), hairM, { parent: hair });
  const tuftG = facet(new THREE.ConeGeometry(0.062, 0.1, 4).translate(0, 0.04, 0), 0.1, 46);
  const tuftDefs = [[-0.105, 0.16, 0.115, 1.05, 0, 0.55, 0.95], [-0.036, 0.182, 0.135, 1.1, 0, 0.2, 1.05], [0.036, 0.182, 0.135, 1.15, 0, -0.15, 1.0], [0.105, 0.16, 0.115, 1.0, 0, -0.55, 0.9],
    [-0.055, 0.222, 0.035, 0.55, 0, 0.3, 0.95], [0.055, 0.222, 0.025, 0.45, 0, -0.35, 0.9], [0.0, 0.212, -0.09, -0.75, 0, 0.05, 0.95]];
  const tufts = tuftDefs.map(([x, y, z, rx, ry, rz, s], i) => { const m = mesh(tuftG, hairM, { parent: hair, pos: [x, y, z], rot: [rx, ry, rz], scale: s }); m.userData.base = [rx, ry, rz]; m.userData.k = 0.6 + hash1(i) * 0.8; return m; });
  // eyes
  const eyeG = new THREE.BoxGeometry(1, 1, 1);
  const eyes = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.074, 0.03, faceZ(0.074, 0.03) + 0.006); skull.add(p);
    const b = new THREE.Mesh(eyeG, blackM); b.scale.set(0.044, 0.074, 0.012); p.add(b);
    const gl = new THREE.Mesh(eyeG, whiteM); gl.scale.set(0.012, 0.016, 0.004); gl.position.set(-0.009, 0.02, 0.008); p.add(gl);
    const lid = new THREE.Mesh(eyeG, skinM); lid.scale.set(0.052, 0.04, 0.014); lid.position.set(0, 0.06, 0.004); p.add(lid); lid.visible = false;
    return { p, b, gl, lid, s };
  });
  const brows = [-1, 1].map((s) => { const m = new THREE.Mesh(eyeG, hairM); m.scale.set(0.064, 0.016, 0.014); m.position.set(s * 0.074, 0.095, faceZ(0.074, 0.095) + 0.008); skull.add(m); return m; });
  // mouth (dynamic ribbon)
  const MN = 14;
  const mkRibbon = (material, z) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((MN + 1) * 2 * 3), 3)); const idx = []; for (let i = 0; i < MN; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx); const m = new THREE.Mesh(g, material); m.position.set(0, -0.108, z); m.frustumCulled = false; skull.add(m); return m; };
  const mz = faceZ(0, -0.108) + 0.007;
  const mouth = mkRibbon(mouthM, mz), teeth = mkRibbon(teethM, mz + 0.0012), tongue = mkRibbon(tongueM, mz + 0.0008);
  function setRibbon(m, w, top, bot) { const p = m.geometry.attributes.position; for (let i = 0; i <= MN; i++) { const u = i / MN * 2 - 1; const x = u * w; p.setXYZ(i * 2, x, top(u), 0); p.setXYZ(i * 2 + 1, x, bot(u), 0); } p.needsUpdate = true; }
  // cheeks blush (two soft red facets)
  const blushM = new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0, depthWrite: false });
  const blush = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.027, 12), blushM); m.position.set(s * 0.105, -0.045, faceZ(0.105, -0.045) + 0.004); m.rotation.y = s * 0.35; skull.add(m); return m; });
  // sweat drops
  const dropG = facet(new THREE.LatheGeometry([new THREE.Vector2(0, -1), new THREE.Vector2(0.62, -0.62), new THREE.Vector2(0.72, -0.1), new THREE.Vector2(0.42, 0.55), new THREE.Vector2(0, 1.5)], 6), 0.04, 50);
  const dropM = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0x4aa3d8, emissiveIntensity: 0.55, roughness: 0.08, flatShading: true, vertexColors: true });
  const dropDefs = [[-0.105, 0.135, 1.7, 0.0], [0.045, 0.15, 2.1, 0.37], [0.125, 0.115, 1.5, 0.71], [-0.03, 0.125, 2.4, 0.55], [-0.15, 0.06, 1.9, 0.2], [0.155, 0.04, 2.2, 0.88], [0.085, 0.16, 2.6, 0.12]];
  const drops = dropDefs.map((d) => { const m = new THREE.Mesh(dropG, dropM); m.castShadow = false; skull.add(m); return m; });

  // ---------- arms (root space) ----------
  const arms = [-1, 1].map((s) => ({ s,
    upper: mesh(limbGeo(0.037, 0.032, 6, { seed: 60 + s }), skinM, { parent: root }), sleeve: mesh(limbGeo(0.058, 0.05, 6, { seed: 62 + s, bulge: 1.0 }), shirtM, { parent: root }),
    fore: mesh(limbGeo(0.032, 0.026, 6, { seed: 64 + s }), skinM, { parent: root }), elbow: mesh(blob(0.034, 0, null, { seed: 66 + s }), skinM, { parent: root }), shoulder: mesh(blob(0.06, 0, null, { seed: 68 + s }), shirtM, { parent: root }) }));

  // ---------- phone + hands (phone space) ----------
  const phone = new THREE.Group(); root.add(phone);
  const bodyG = new THREE.ExtrudeGeometry(roundedRectShape(PHONE.W, PHONE.H, 0.013), { depth: PHONE.T - 0.002, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 2, curveSegments: 6 }); bodyG.translate(0, 0, -PHONE.T / 2 + 0.001);
  const phoneBody = new THREE.Mesh(bodyG, new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.3, metalness: 0.5 })); phoneBody.castShadow = true; phone.add(phoneBody);
  const camBump = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.003), new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.25, metalness: 0.6 })); camBump.position.set(-0.02, 0.062, -PHONE.T / 2 - 0.001); phone.add(camBump);
  const screenMat = new THREE.MeshBasicMaterial({ map: uiTexture, color: new THREE.Color(1.12, 1.12, 1.12) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(PHONE.SW, PHONE.SH), screenMat); screen.position.z = PHONE.T / 2 + 0.0004; phone.add(screen);
  const glow = new THREE.SpotLight(0xa8ccff, 1, 3, 1.05, 0.8, 2); glow.position.set(0, 0, -0.45); phone.add(glow); const glowT = new THREE.Object3D(); glowT.position.set(0, 0, 1); phone.add(glowT); glow.target = glowT;
  const hands = [-1, 1].map((s) => {
    const h = new THREE.Group(); phone.add(h);
    // palm + fingers behind the phone
    const palm = mesh(blob(1, 1, (v, n) => v.set(n.x * 0.04, n.y * 0.05, n.z * 0.018), { seed: 70 + s }), skinM, { parent: h, pos: [s * 0.034, -0.05, -0.02], rot: [0, 0, s * 0.5] });
    const fingers = [0, 1, 2, 3].map((i) => mesh(limbGeo(0.0105, 0.009, 5, { seed: 72 + i }), skinM, { parent: h, pos: [s * 0.046, -0.068 + i * 0.022, -0.0125], rot: [0, 0, s * (Math.PI / 2 + 0.08 - i * 0.03)], scale: [1, 0.062 - Math.abs(i - 1.3) * 0.006, 1] }));
    const heel = mesh(blob(1, 0, (v, n) => v.set(n.x * 0.024, n.y * 0.034, n.z * 0.021), { seed: 74 + s }), skinM, { parent: h, pos: [s * 0.055, -0.075, -0.004] });
    const th1 = mesh(limbGeo(0.0135, 0.0125, 6, { seed: 76 + s }), skinM, { parent: h }), th2 = mesh(limbGeo(0.0125, 0.0105, 6, { seed: 78 + s }), skinM, { parent: h });
    const nail = mesh(box(0.013, 0.012, 0.003), mat(0xf7d6c4, { roughness: 0.4 }), { parent: h, cast: false });
    const wrist = V(s * 0.068, -0.108, -0.018);
    return { s, h, palm, fingers, heel, th1, th2, nail, wrist, base: V(s * 0.054, -0.07, 0.004) };
  });

  const tmp = { a: V(), b: V(), c: V(), m: new THREE.Matrix4(), q: new THREE.Quaternion() };
  const pinv = new THREE.Matrix4();

  function update(p, t) {
    // torso
    torso.rotation.set(p.pitch, p.twist || 0, p.lean || 0, 'YXZ');
    const sq = p.squash || 0; torso.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    torso.position.set(p.shiftX || 0, p.bounce || 0, 0);
    torso.updateMatrix();
    head.rotation.set(p.headPitch || 0, p.headYaw || 0, p.headRoll || 0, 'YXZ');
    const hs = p.headSquash || 0; skull.scale.set(1 + hs * 0.4, 1 - hs, 1 + hs * 0.4);
    // face
    const fl = sat(p.flush || 0); skinM.color.copy(SKIN).lerp(SKIN_RED, fl * 0.62); blushM.opacity = sat(0.12 + fl * 0.3) * (p.blush ?? 1);
    eyes.forEach((e) => {
      const tw = (e.s > 0 ? (p.twitch || 0) : 0);
      const open = clamp((p.eyeOpen ?? 1) * (1 - tw * 0.75), 0.06, 2); const big = p.eyeSize ?? 1;
      e.b.scale.set(0.044 * big * (1 + (1 - Math.min(open, 1)) * 0.35), 0.074 * big * open, 0.012);
      e.p.rotation.z = -e.s * (p.eyeSlant || 0) + tw * 0.2;
      e.p.position.x = e.s * 0.074 + (p.lookX || 0) * 0.012; e.p.position.y = 0.03 + (p.lookY || 0) * 0.012 + tw * 0.004;
      e.gl.visible = open > 0.35; e.gl.scale.set(0.012 * big, 0.016 * big, 0.004); e.gl.position.set(-0.009 * big, 0.02 * big * Math.min(open, 1.2), 0.008);
    });
    brows.forEach((b, i) => { const s = i ? 1 : -1; const tw = (s > 0 ? (p.twitch || 0) : 0); b.rotation.z = -s * (p.browAngle || 0) + tw * 0.25; b.position.y = 0.095 + (p.browY || 0) + ((p.eyeSize ?? 1) - 1) * 0.04 + (s > 0 ? (p.browYR || 0) : 0) - tw * 0.012; });
    // mouth
    const mo = p.mouth || {}; const w = mo.w ?? 0.045, open = mo.open ?? 0.0, curve = mo.curve ?? 0, th = 0.006 + open;
    const cen = (u) => curve * (u * u - 0.35) * w * 1.4 + (mo.skew || 0) * u * 0.01;
    const prof = (u) => Math.pow(Math.max(1 - u * u, 0), mo.sq ?? 0.55);
    setRibbon(mouth, w, (u) => cen(u) + th * 0.4 * prof(u), (u) => cen(u) - th * 0.6 * prof(u));
    const tv = mo.teeth ?? 0; teeth.visible = tv > 0.01; if (teeth.visible) setRibbon(teeth, w * 0.9, (u) => cen(u * 0.9) + th * 0.4 * prof(u * 0.9) - 0.0015, (u) => cen(u * 0.9) + th * 0.4 * prof(u * 0.9) - 0.0015 - Math.min(th * 0.42 * tv, 0.016) * Math.pow(Math.max(1 - u * u, 0), 0.25));
    const bt = mo.teethBot ?? 0; tongue.visible = bt > 0.01 || open > 0.02;
    if (bt > 0.01) { tongue.material = teethM; setRibbon(tongue, w * 0.86, (u) => cen(u * 0.86) - th * 0.6 * prof(u * 0.86) + 0.0015 + Math.min(th * 0.4 * bt, 0.014) * Math.pow(Math.max(1 - u * u, 0), 0.25), (u) => cen(u * 0.86) - th * 0.6 * prof(u * 0.86) + 0.0015); }
    else if (tongue.visible) { tongue.material = tongueM; setRibbon(tongue, w * 0.55, (u) => cen(0) - th * 0.6 + th * 0.5 * Math.pow(Math.max(1 - u * u, 0), 0.8), (u) => cen(u * 0.55) - th * 0.6 * prof(u * 0.55) + 0.0008); }
    // secondary motion
    ears.forEach((e, i) => { const s = i ? 1 : -1; e.rotation.set((p.earWob || 0) * 0.5, s * (p.earFlap || 0), s * (p.earWob || 0) * 0.35); });
    tufts.forEach((m) => { const b = m.userData.base; m.rotation.set(b[0] + (p.hairSway || 0) * m.userData.k, b[1], b[2] + (p.hairSwayZ || 0) * m.userData.k); });
    nose.rotation.x = Math.PI / 2 + 0.22 + (p.hairSway || 0) * 0.05;
    // sweat
    const sweatAmt = p.sweat ?? 1;
    drops.forEach((m, i) => {
      const [x0, y0, per, ph] = dropDefs[i]; const u = ((t / per + ph) % 1 + 1) % 1; let y = y0, s = 1, x = x0;
      if (u < 0.12) s = u / 0.12; else if (u < 0.72) { const k = (u - 0.12) / 0.6; y = y0 - k * k * 0.085; } else { const k = (u - 0.72) / 0.28; y = y0 - 0.085 - k * k * 0.16; s = 1 - k * 0.6; }
      const z = faceZ(x, Math.max(y, -0.12)) + 0.006 + (u > 0.72 ? (u - 0.72) * 0.05 : 0);
      m.position.set(x, y, z); const k = 0.0125 * s * sweatAmt * (0.8 + hash1(i * 3.3) * 0.5); m.scale.set(k, k * (1 + (u > 0.12 ? 0.35 : 0)), k); m.visible = k > 0.0005;
    });

    // phone transform (root space)
    const N = tmp.a.copy(p.phoneN).normalize(); const U = tmp.b.copy(p.phoneU).addScaledVector(N, -p.phoneU.dot(N)).normalize(); const X = tmp.c.crossVectors(U, N);
    tmp.m.makeBasis(X, U, N); phone.quaternion.setFromRotationMatrix(tmp.m); if (p.phoneRoll) phone.rotateZ(p.phoneRoll);
    phone.position.copy(p.phonePos); phone.updateMatrix();
    glow.intensity = p.glow ?? 0.5; if (p.glowColor) glow.color.set(p.glowColor);
    // thumbs (phone space): tip targets
    hands.forEach((h) => {
      const tip = (h.s < 0 ? p.thumbL : p.thumbR) || V(h.s * 0.012, -0.05, PHONE.T / 2 + 0.006);
      const k = ik2(h.base, tip, 0.036, 0.034, V(h.s * 0.25, -0.2, 1), V());
      span(h.th1, h.base, k); span(h.th2, k, tip, V(0, 0, 1));
      h.nail.position.copy(k).lerp(tip, 0.72); h.nail.quaternion.copy(h.th2.quaternion); h.nail.translateZ(0.0105);
      h.h.visible = !(h.s > 0 && p.hideHandR);
    });
    // arms via IK to wrists
    arms.forEach((a, i) => {
      const S = SHOULDER[i].clone().applyMatrix4(torso.matrix); const Wp = (i === 0 && p.freeL) ? p.freeL.clone() : hands[i].wrist.clone().applyMatrix4(phone.matrix);
      const pole = V(a.s * 1.0, -0.55, -0.35 + (p.elbowOut || 0));
      const E = ik2(S, Wp, 0.27, 0.255, pole, V());
      span(a.upper, S, E); span(a.sleeve, S, tmp.a.copy(S).lerp(E, 0.56)); span(a.fore, E, Wp); a.elbow.position.copy(E); a.shoulder.position.copy(S);
    });
    // legs
    legs.forEach((l, i) => {
      const hip = V(l.s * 0.085, -0.03, 0.03); const kb = (i ? p.kneeR : p.kneeL) || 0;
      const ankle = V(l.s * (0.13 + (p.legSpread || 0)), -(0.57 - 0.05) + kb * 0.035, 0.44 + (i ? 0.02 : -0.02));
      const K = ik2(hip, ankle, 0.43, 0.46, V(l.s * 0.12, 1, 0.5), V());
      span(l.thigh, hip, K); span(l.shin, K, ankle); l.knee.position.copy(K);
      l.foot.position.copy(ankle).add(V(0, -0.012, 0)); l.foot.rotation.set(-kb * 0.5, l.s * 0.18, 0);
    });
  }

  return { root, torso, head, skull, phone, screen, screenMat, glow, update, hands, eyes, arms, SHOULDER };
}
