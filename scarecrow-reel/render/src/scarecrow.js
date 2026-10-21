// The scarecrow and all its gadgets. Pose is driven entirely by setPose(p).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, V, glow, strawTuft, stitches, lumpy, labelTexture, setShadows } from './parts.js';
import { merge, paint, blob } from './plants.js';
import { ZC } from './world.js';
import { rng, fbm, lerp, clamp } from './util.js';

export const PZ = ZC - 0.01;      // pole axis z (right at the cut face)
export const BODY_DROP = -0.34;
export const HEAD_Y = 1.77;
export const ARM_Y = 1.46;
export const MOTOR_Y = -0.52;

function lathe(points, segs = 32) { return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs); }

function lumpify(geo, amp, freq, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (fbm(x * freq + 3, y * freq + z * freq * 0.7, 3, seed) - 0.5) * amp;
    p.setXYZ(i, x * k, y, z * k);
  }
  geo.computeVertexNormals(); return geo;
}

function onSphere(r, dir) { return dir.clone().normalize().multiplyScalar(r); }

export function buildScarecrow(scene) {
  const S = {};
  const root = S.root = new THREE.Group(); root.position.set(0, 0, PZ); scene.add(root);
  const lift = S.lift = new THREE.Group(); root.add(lift);          // planting drop / pop
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.36, 12), M.wood); lower.position.y = -0.66; lift.add(lower);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 12), M.wood); tip.rotation.x = Math.PI; tip.position.y = -1.39; lift.add(tip);
  const spin = S.spin = new THREE.Group(); lift.add(spin);
  const body = S.body = new THREE.Group(); body.position.y = BODY_DROP; spin.add(body);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 1.0, 12), M.wood); upper.position.y = 0.5; spin.add(upper);

  // ---- torso (checked shirt)
  const torsoGeo = lathe([[0.0, 0.9], [0.165, 0.9], [0.205, 0.925], [0.19, 1.0], [0.178, 1.1], [0.192, 1.25], [0.206, 1.37], [0.2, 1.46], [0.168, 1.525], [0.11, 1.565], [0.06, 1.585], [0.0, 1.59]], 36);
  torsoGeo.scale(1, 1, 0.8); lumpify(torsoGeo, 0.09, 7, 3);
  const torso = new THREE.Mesh(torsoGeo, M.plaid); body.add(torso);
  // buttons + placket
  for (let k = 0; k < 4; k++) {
    const y = 1.04 + k * 0.12; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.008, 12), M.plasticWhite);
    b.rotation.x = Math.PI / 2; b.position.set(0, y, 0.8 * (0.178 + 0.02 * Math.sin((y - 1) * 4)) + 0.008); body.add(b);
  }
  // denim patch with stitches
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.08), new THREE.MeshStandardMaterial({ color: 0x4b6fa3, roughness: 0.9 }));
  patch.position.set(-0.1, 1.12, 0.137); patch.rotation.set(-0.05, -0.5, 0.15); body.add(patch);
  const pst = stitches(new THREE.CatmullRomCurve3([V(-0.045, 0.04, 0.002), V(0.045, 0.04, 0.002)]), { count: 5, cross: 0.012, r: 0.0022 });
  const pm = new THREE.Mesh(pst, new THREE.MeshStandardMaterial({ color: 0xf2e3c0 })); patch.add(pm);
  const pm2 = pm.clone(); pm2.position.y = -0.08; patch.add(pm2);
  // collar flaps
  for (const s of [-1, 1]) {
    const g = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(s * 0.09, -0.03, 0.02), V(s * 0.02, -0.09, 0.03)]);
    g.setIndex(s > 0 ? [0, 2, 1] : [0, 1, 2]); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 0, 0.5, 1, 0], 2));
    const c = new THREE.Mesh(g, M.plaidSleeve); c.material.side = THREE.DoubleSide; c.position.set(s * 0.02, 1.575, 0.075); c.rotation.x = 0.35; body.add(c);
  }
  // straw at the waist and neck
  const waist = new THREE.Mesh(strawTuft({ n: 70, len: 0.16, spread: 0.5, dir: V(0, -1, 0), base: 0.3, seed: 7 }), M.strawPlain);
  waist.scale.set(1, 1, 0.8); waist.position.y = 0.93; body.add(waist);
  const neckStraw = new THREE.Mesh(strawTuft({ n: 22, len: 0.07, spread: 1.2, dir: V(0, 1, 0), base: 0.1, seed: 8 }), M.strawPlain); neckStraw.position.y = 1.57; body.add(neckStraw);

  // ---- arms (hinged at the shoulders)
  S.arms = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.13, ARM_Y, 0); piv.scale.set(0.88, 1, 1); body.add(piv);
    const sg = new THREE.CylinderGeometry(0.068, 0.085, 0.6, 18, 10); sg.translate(0, 0.3, 0);
    lumpify(sg, 0.16, 9, 10 + s);
    sg.rotateZ(-s * Math.PI / 2);
    const sleeve = new THREE.Mesh(sg, M.plaidSleeve); piv.add(sleeve);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.7, 8), M.wood); stick.rotation.z = Math.PI / 2; stick.position.x = s * 0.33; piv.add(stick);
    const cuff = new THREE.Mesh(strawTuft({ n: 26, len: 0.13, spread: 0.75, dir: V(s, -0.15, 0), base: 0.07, seed: 20 + s }), M.strawPlain);
    cuff.position.x = s * 0.6; piv.add(cuff);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 18), M.rope); band.rotation.y = Math.PI / 2; band.position.x = s * 0.57; piv.add(band);
    S.arms.push(piv);
  }

  // ---- head (burlap sack)
  const head = S.head = new THREE.Group(); head.position.y = HEAD_Y + 0.03; head.scale.setScalar(1.2); body.add(head);
  const hr = 0.165;
  const hg = new THREE.SphereGeometry(hr, 40, 28); hg.scale(1, 0.94, 0.9);
  { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const n = v.clone().normalize(); v.multiplyScalar(1 + (fbm(n.x * 2.5 + 1, n.y * 2.5 + n.z * 2, 3, 41) - 0.5) * 0.12); p.setXYZ(i, v.x, v.y, v.z); } hg.computeVertexNormals(); }
  head.add(new THREE.Mesh(hg, M.burlap));
  const gather = new THREE.Mesh(lumpify(new THREE.CylinderGeometry(0.06, 0.12, 0.08, 20, 3), 0.25, 14, 42), M.burlap); gather.position.y = -0.16; head.add(gather);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.014, 8, 24), M.rope); rope.rotation.x = Math.PI / 2; rope.position.y = -0.14; head.add(rope);
  const knot = new THREE.Mesh(lumpy(0.022, 3, 0.3), M.rope); knot.position.set(0.05, -0.145, 0.05); head.add(knot);
  for (const a of [-0.4, 0.3]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.08, 5), M.rope); e.position.set(0.06 + a * 0.03, -0.18, 0.06); e.rotation.z = a; head.add(e); }
  // face
  const faceDir = (x, y) => V(x, y, Math.sqrt(Math.max(0.05, 1 - x * x - y * y)));
  const surf = (x, y, out = 1.0) => { const d = faceDir(x, y); return V(d.x * hr * out, d.y * hr * 0.94 * out, d.z * hr * 0.9 * out); };
  S.eyeAnchors = [];
  for (const s of [-1, 1]) {
    const pos = surf(s * 0.37, 0.12, 0.995); const n = pos.clone().normalize();
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.014, 24), new THREE.MeshPhysicalMaterial({ color: 0x141218, roughness: 0.3, clearcoat: 1 }));
    btn.quaternion.setFromUnitVectors(V(0, 1, 0), n); btn.position.copy(pos); head.add(btn);
    for (const [hx, hy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 6), new THREE.MeshStandardMaterial({ color: 0xe9d7b0 }));
      hole.position.set(hx * 0.009, 0.008, hy * 0.009); btn.add(hole);
    }
    const anchor = new THREE.Object3D(); anchor.position.copy(surf(s * 0.37, 0.12, 1.07)); anchor.quaternion.copy(btn.quaternion); head.add(anchor);
    S.eyeAnchors.push(anchor);
    // stitched brow
    const b0 = surf(s * 0.2, 0.33, 1.005), b1 = surf(s * 0.52, 0.27, 1.005), bm = surf(s * 0.36, 0.33, 1.01);
    head.add(new THREE.Mesh(stitches(new THREE.CatmullRomCurve3([b0, bm, b1]), { count: 4, cross: 0.014, r: 0.003 }), M.thread));
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.045, 3), M.feltOrange); nose.rotation.x = Math.PI / 2; nose.rotation.z = Math.PI; nose.scale.set(1, 1, 0.45);
  nose.position.copy(surf(0, -0.04, 1.03)); head.add(nose);
  const smile = []; for (let k = 0; k <= 8; k++) { const u = (k / 8) * 2 - 1; smile.push(surf(u * 0.48, -0.3 + 0.16 * u * u, 1.004)); }
  head.add(new THREE.Mesh(stitches(new THREE.CatmullRomCurve3(smile), { count: 11, cross: 0.026, r: 0.0036 }), M.thread));
  // LED eyes (pop in later)
  S.ledMat = glow(0xff2a1a, 0); S.ledMat.color.set(0x4a0805); S.ledMat.roughness = 0.15;
  S.leds = S.eyeAnchors.map((a) => {
    const g = new THREE.Group(); a.add(g);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), S.ledMat); g.add(dome);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.006, 8, 24), M.darkMetal); ring.rotation.x = Math.PI / 2; g.add(ring);
    g.scale.setScalar(0); return g;
  });
  S.eyeLight = new THREE.PointLight(0xff2a1a, 0, 0.9, 2); S.eyeLight.position.set(0, 0.1, 0.35); head.add(S.eyeLight);

  // ---- hat
  const hat = S.hat = new THREE.Group(); hat.position.set(0, 0.12, -0.005); hat.rotation.set(-0.06, 0, 0.1); head.add(hat);
  const crown = new THREE.Mesh(lumpify(lathe([[0.137, 0], [0.138, 0.025], [0.13, 0.09], [0.112, 0.135], [0.06, 0.152], [0.02, 0.142], [0, 0.145]], 36), 0.05, 10, 50), M.hat); hat.add(crown);
  const brimPts = [[0.13, 0.006], [0.2, 0.002], [0.27, -0.014], [0.33, -0.036], [0.338, -0.046], [0.332, -0.054], [0.27, -0.026], [0.2, -0.008], [0.13, -0.004]];
  const brimG = lathe(brimPts, 64);
  { const p = brimG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const rr = Math.hypot(x, z), a = Math.atan2(z, x); const k = clamp((rr - 0.13) / 0.2); p.setY(i, p.getY(i) + Math.sin(a * 3 + 1) * 0.014 * k + Math.sin(a * 7) * 0.005 * k); } brimG.computeVertexNormals(); }
  hat.add(new THREE.Mesh(brimG, M.hatBrim));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.139, 0.032, 36, 1, true), M.ribbon); band.position.y = 0.022; hat.add(band);
  const fr = rng(55); const fray = [];
  for (let k = 0; k < 24; k++) { const a = fr() * Math.PI * 2; fray.push({ a }); }
  const frayG = merge(fray.map(({ a }, k) => { const L = 0.03 + fr() * 0.05; const c = new THREE.CylinderGeometry(0.0025, 0.003, L, 3); c.translate(0, L / 2, 0); c.rotateZ(-Math.PI / 2 + (fr() - 0.5) * 0.6); c.translate(0.325, -0.045, 0); c.rotateY(-a); return paint(c, new THREE.Color(0.85, 0.66, 0.3)); }));
  hat.add(new THREE.Mesh(frayG, M.strawPlain));

  // ---- speaker on the hat brim (pops in, scene 5)
  const spk = S.speaker = new THREE.Group(); spk.position.set(0.2, 0.012, 0.11); spk.rotation.set(0.06, -0.35, -0.08); hat.add(spk);
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.1, 0.085, 3, 0.015), M.paintYellow); box.position.y = 0.05; spk.add(box);
  const grillTex = labelTexture(128, 128, (c, w, h) => { c.fillStyle = '#111114'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a3a44'; for (let y = 8; y < h; y += 12) for (let x = 8 + ((y / 12) % 2) * 6; x < w; x += 12) { c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.fill(); } });
  const grill = new THREE.Mesh(new THREE.CircleGeometry(0.036, 24), new THREE.MeshStandardMaterial({ map: grillTex, roughness: 0.7 })); grill.position.set(0, 0.05, 0.0435); spk.add(grill);
  const cone = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 8, 28), M.metal); cone.position.set(0, 0.05, 0.044); spk.add(cone);
  S.speakerCone = cone;
  const btnM = new THREE.MeshPhysicalMaterial({ color: 0xe02626, roughness: 0.25, clearcoat: 1, emissive: 0xff3030, emissiveIntensity: 0 });
  const sbtn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.018, 18), btnM); sbtn.position.set(0.02, 0.105, 0); spk.add(sbtn);
  S.speakerBtn = sbtn; S.speakerBtnMat = btnM;
  const spLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), glow(0x40ff70, 0)); spLed.position.set(-0.04, 0.085, 0.044); spk.add(spLed); S.speakerLed = spLed;
  S.speakerMouth = new THREE.Object3D(); S.speakerMouth.position.set(0, 0.05, 0.06); spk.add(S.speakerMouth);
  spk.scale.setScalar(0);

  // ---- nest on top of the hat (scene 7)
  const nest = S.nest = new THREE.Group(); nest.position.set(0, 0.13, 0); hat.add(nest); const nestScale = 1.3;
  const nr = rng(77); const twigs = [];
  for (let k = 0; k < 150; k++) {
    const a = nr() * Math.PI * 2; const rad = 0.1 + nr() * 0.05; const h = nr() * 0.07; const L = 0.07 + nr() * 0.08;
    const c = new THREE.CylinderGeometry(0.0035, 0.0045, L, 4); c.rotateZ(Math.PI / 2 + (nr() - 0.5) * 0.9); c.rotateY(-a + Math.PI / 2 + (nr() - 0.5) * 0.8);
    c.translate(Math.cos(a) * rad, h + 0.005, Math.sin(a) * rad);
    twigs.push(paint(c, new THREE.Color().setHSL(0.07 + nr() * 0.03, 0.4, 0.22 + nr() * 0.16)));
  }
  const bowl = new THREE.SphereGeometry(0.115, 24, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45); bowl.translate(0, 0.075, 0);
  nest.add(new THREE.Mesh(merge(twigs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
  const lining = new THREE.Mesh(bowl, new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 1, side: THREE.DoubleSide })); nest.add(lining);
  nest.scale.setScalar(0);

  // ---- motion sensor on the chest (scene 4)
  const sen = S.sensor = new THREE.Group(); sen.position.set(0.075, 1.3, 0.152); sen.rotation.set(0.1, 0.38, 0); body.add(sen);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.07, 0.025, 2, 0.008), M.plasticWhite); sen.add(plate);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.92 }));
  dome.rotation.x = Math.PI / 2; dome.position.z = 0.012; sen.add(dome);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), new THREE.MeshPhysicalMaterial({ color: 0x1a1d2a, roughness: 0.1, clearcoat: 1 })); lens.position.z = 0.043; sen.add(lens);
  S.sensorLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), glow(0x30ff60, 0)); S.sensorLed.position.set(0.03, -0.022, 0.014); sen.add(S.sensorLed);
  sen.scale.setScalar(0);
  // glowing detection cone
  const coneLen = 2.3, coneR = 0.95;
  const cg = new THREE.ConeGeometry(coneR, coneLen, 48, 12, true); cg.translate(0, -coneLen / 2, 0);
  const coneMat = S.coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: new THREE.Color(0.35, 1.0, 0.55) }, uInt: { value: 0 }, uTime: { value: 0 }, uLen: { value: coneLen } },
    vertexShader: /* glsl */`varying float vT; varying vec3 vN; varying vec3 vV; uniform float uLen;
      void main(){ vT = -position.y / uLen; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`varying float vT; varying vec3 vN; varying vec3 vV; uniform vec3 uColor; uniform float uInt, uTime;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float scan = 0.65 + 0.35 * sin(vT * 26.0 - uTime * 9.0);
        float a = pow(1.0 - vT, 1.4) * smoothstep(0.0, 0.06, vT) * (0.18 + 0.82 * pow(f, 2.0)) * scan * uInt;
        gl_FragColor = vec4(uColor * a * 1.6, a); }`,
  });
  const coneM = S.cone = new THREE.Mesh(cg, coneMat); coneM.renderOrder = 5;
  body.add(coneM); coneM.position.copy(sen.position).add(V(0.012, 0, 0.045));
  S.setConeDir = (d) => coneM.quaternion.setFromUnitVectors(V(0, -1, 0), d.clone().normalize());
  S.setConeDir(V(-0.62, -0.42, 0.66));
  S.coneAxis = (out) => { coneM.updateWorldMatrix(true, false); const a = V(0, 0, 0).applyMatrix4(coneM.matrixWorld); const b = V(0, -1, 0).applyMatrix4(coneM.matrixWorld); return { apex: a, dir: b.sub(a).normalize(), len: coneLen, radius: coneR }; };

  // ---- underground gadgets (do not spin)
  const under = S.under = new THREE.Group(); root.add(under);
  const zf = (d) => -d * 0.35; // protrude from the cut face
  // motor: collar on the pole + motor can + gears
  const motor = S.motor = new THREE.Group(); motor.position.set(0, MOTOR_Y, 0); under.add(motor);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.09, 24), M.metal); motor.add(collar);
  for (const y of [-0.035, 0.035]) { const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.069, 0.007, 6, 24), M.darkMetal); r2.rotation.x = Math.PI / 2; r2.position.y = y; motor.add(r2); }
  const gearG = (r, n, h) => { const parts = [new THREE.CylinderGeometry(r, r, h, 24)]; for (let k = 0; k < n; k++) { const t = new THREE.BoxGeometry(0.018, h, 0.016); t.translate(r + 0.006, 0, 0); t.rotateY(k * Math.PI * 2 / n); parts.push(t); } return merge(parts); };
  const poleGear = S.poleGear = new THREE.Mesh(gearG(0.075, 16, 0.025), M.gold); poleGear.position.y = 0.06; motor.add(poleGear);
  const can = new THREE.Group(); can.position.set(0.17, 0.0, 0.0); motor.add(can);
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 28), M.paintRed); can.add(canBody);
  for (const y of [-0.085, 0.085]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.018, 28), M.metal); cap.position.y = y; can.add(cap); }
  const lbl = labelTexture(256, 128, (c, w, h) => { c.fillStyle = '#f2c230'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d1d22'; for (let k = -2; k < 12; k++) { c.beginPath(); c.moveTo(k * 28, 0); c.lineTo(k * 28 + 14, 0); c.lineTo(k * 28 - 18, h); c.lineTo(k * 28 - 32, h); c.fill(); } c.fillStyle = '#f2c230'; c.fillRect(70, 22, 116, 84); c.fillStyle = '#1d1d22'; c.beginPath(); c.moveTo(138, 28); c.lineTo(104, 70); c.lineTo(128, 70); c.lineTo(116, 102); c.lineTo(152, 56); c.lineTo(128, 56); c.closePath(); c.fill(); });
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0705, 0.0705, 0.07, 28, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ map: lbl, roughness: 0.5 })); can.add(label);
  const motorGear = S.motorGear = new THREE.Mesh(gearG(0.04, 10, 0.022), M.gold); motorGear.position.set(-0.05, 0.1, 0); can.add(motorGear);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), M.metal); shaft.position.set(-0.05, 0.09, 0); can.add(shaft);
  S.motorLed = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), glow(0x38ff6a, 0)); S.motorLed.position.set(0.0, 0.03, 0.07); can.add(S.motorLed);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.05), M.darkMetal); bracket.position.set(0.09, -0.02, 0); motor.add(bracket);
  motor.position.z = zf(0.22); motor.userData.base = 1.6; motor.scale.setScalar(0);

  // battery pack
  const bat = S.battery = new THREE.Group(); bat.position.set(0.95, -0.42, zf(0.18)); bat.userData.base = 1.6; under.add(bat);
  const batBody = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.13, 0.11, 2, 0.015), M.paintYellow); bat.add(batBody);
  const batTop = new THREE.Mesh(new RoundedBoxGeometry(0.245, 0.04, 0.115, 2, 0.012), M.plasticDark); batTop.position.y = 0.055; bat.add(batTop);
  const blbl = labelTexture(256, 128, (c, w, h) => { c.fillStyle = '#1d1d22'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2c230'; c.font = 'bold 84px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('+  –', w / 2, h / 2 + 4); });
  const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshStandardMaterial({ map: blbl, roughness: 0.5 })); bl.position.set(0, -0.005, 0.0565); bat.add(bl);
  for (const x of [-0.06, 0.06]) { const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), M.metal); tm.position.set(x, 0.085, 0); bat.add(tm); }
  bat.scale.setScalar(0);

  // wires (grow along the face)
  const wireCurve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, y]) => V(x, y, -0.005)));
  const mkWire = (pts, mat) => { const c = wireCurve(pts); const g = new THREE.TubeGeometry(c, 40, 0.016, 6); const m = new THREE.Mesh(g, mat); under.add(m); m.userData.curve = c; m.userData.total = g.index.count; g.setDrawRange(0, 0); return m; };
  S.wires = [
    mkWire([[0.3, -0.5], [0.48, -0.62], [0.68, -0.6], [0.86, -0.34]], M.wireRed),
    mkWire([[0.32, -0.6], [0.52, -0.72], [0.78, -0.68], [1.04, -0.34]], M.wireBlack),
  ];
  // random-chip box + its wire
  const rb = S.randomBox = new THREE.Group(); rb.position.set(-0.66, -0.46, zf(0.13)); rb.userData.base = 1.8; under.add(rb);
  const rbBody = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.13, 0.07, 2, 0.012), new THREE.MeshPhysicalMaterial({ color: 0x2b6cc4, roughness: 0.3, clearcoat: 0.8 })); rb.add(rbBody);
  const chipTex = labelTexture(256, 160, (c, w, h) => {
    c.fillStyle = '#0a0f12'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = 'bold 50px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RANDOM', w / 2, 46);
    const die = (x, y, n) => { c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.beginPath(); c.roundRect(x - 26, y - 26, 52, 52, 10); c.stroke(); const d = { 1: [[0, 0]], 3: [[-1, -1], [0, 0], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]] }[n]; for (const [a, b] of d) { c.beginPath(); c.arc(x + a * 13, y + b * 13, 5.5, 0, 7); c.fill(); } };
    die(60, 112, 3); die(128, 112, 5); die(196, 112, 1);
  });
  const chipMat = S.chipMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: chipTex, emissiveIntensity: 0 });
  const chip = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.094), chipMat); chip.position.z = 0.0365; rb.add(chip);
  S.chipTint = new THREE.Color(0x40e0ff);
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) { const pin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.01), M.gold); pin.position.set(-0.06 + k * 0.03, s * 0.073, 0.02); rb.add(pin); }
  rb.scale.setScalar(0);
  S.chipWire = mkWire([[-0.5, -0.5], [-0.36, -0.6], [-0.2, -0.62], [-0.1, -0.56]], new THREE.MeshPhysicalMaterial({ color: 0x2e9b4f, roughness: 0.35, clearcoat: 0.6 }));
  // little glowing energy dots that travel along the wires when powered
  S.sparks = [];
  for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), glow(k % 2 ? 0xffe066 : 0x7ff6ff, 4)); m.visible = false; under.add(m); S.sparks.push(m); }

  setShadows(root, true, true);
  S.cone.castShadow = false; S.cone.receiveShadow = false;
  S.sparks.forEach((m) => { m.castShadow = false; });
  S.root.traverse((o) => { if (o.isMesh && (o.material === M.strawPlain)) o.castShadow = true; });

  // ------------------------------------------------------------------ pose
  S.setPose = (p) => {
    lift.position.y = p.lift ?? 0;
    lift.rotation.z = p.tilt ?? 0;
    const sq = p.squash ?? 0; body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    spin.rotation.y = p.spin ?? 0;
    const pz = p.pop ?? 1; lift.scale.setScalar(Math.max(0.0001, pz));
    S.arms[0].rotation.z = -(p.armL ?? -0.06);
    S.arms[1].rotation.z = (p.armR ?? -0.06);
    S.arms[0].rotation.x = p.armLx ?? 0; S.arms[1].rotation.x = p.armRx ?? 0;
    head.rotation.z = p.headTilt ?? 0; head.rotation.y = p.headTurn ?? 0;
    // gadgets
    motor.scale.setScalar(Math.max(0.0001, (p.motor ?? 0) * 1.6)); motor.visible = (p.motor ?? 0) > 0.001;
    bat.scale.setScalar(Math.max(0.0001, (p.battery ?? 0) * 1.6)); bat.visible = (p.battery ?? 0) > 0.001;
    const wr = p.wires ?? 0; S.wires.forEach((w) => { const n = Math.floor(clamp(wr) * w.userData.total / 6) * 6; w.geometry.setDrawRange(0, n); w.visible = n > 0; });
    const cw = p.chipWire ?? 0; { const n = Math.floor(clamp(cw) * S.chipWire.userData.total / 6) * 6; S.chipWire.geometry.setDrawRange(0, n); S.chipWire.visible = n > 0; }
    poleGear.rotation.y = p.spin ?? 0; motorGear.rotation.y = -(p.spin ?? 0) * 1.9;
    S.motorLed.material.emissiveIntensity = (p.motorOn ?? 0) * 5;
    rb.scale.setScalar(Math.max(0.0001, (p.randomBox ?? 0) * 1.8)); rb.visible = (p.randomBox ?? 0) > 0.001;
    chipMat.emissive.copy(S.chipTint).lerp(new THREE.Color(0xff4fd8), p.chipHue ?? 0); chipMat.emissiveIntensity = (p.chipGlow ?? 0) * 3.2;
    S.leds.forEach((l) => l.scale.setScalar(Math.max(0.0001, p.leds ?? 0)));
    S.ledMat.emissiveIntensity = Math.min(1.4, p.eyeGlow ?? 0) * 6.5; S.eyeLight.intensity = Math.min(1.2, p.eyeGlow ?? 0) * 0.3;
    sen.scale.setScalar(Math.max(0.0001, p.sensor ?? 0)); sen.visible = (p.sensor ?? 0) > 0.001;
    S.sensorLed.material.emissiveIntensity = (p.sensorLed ?? 0) * 6;
    coneMat.uniforms.uInt.value = p.cone ?? 0; coneMat.uniforms.uTime.value = p.time ?? 0; S.cone.visible = (p.cone ?? 0) > 0.002;
    coneMat.uniforms.uColor.value.setRGB(0.35, 1.0, 0.55).lerp(new THREE.Color(1.0, 0.25, 0.2), p.coneAlarm ?? 0);
    spk.scale.setScalar(Math.max(0.0001, p.speaker ?? 0)); spk.visible = (p.speaker ?? 0) > 0.001;
    S.speakerLed.material.emissiveIntensity = (p.speakerLed ?? 0) * 6;
    btnM.emissiveIntensity = (p.speakerBtnGlow ?? 0) * 1.5;
    sbtn.position.y = 0.105 - (p.speakerBtnPress ?? 0) * 0.008;
    cone.scale.setScalar(1 + (p.speakerThump ?? 0) * 0.25);
    nest.scale.setScalar(Math.max(0.0001, (p.nest ?? 0) * nestScale)); nest.visible = (p.nest ?? 0) > 0.001;
    // energy sparks along wires
    const on = p.motorOn ?? 0; const t = p.time ?? 0;
    S.sparks.forEach((m, k) => {
      const w = k < 4 ? S.wires[k % 2] : S.chipWire; const show = k < 4 ? on > 0.05 && wr >= 1 : on > 0.05 && cw >= 1 && (p.chipGlow ?? 0) > 0.1;
      m.visible = show; if (!show) return;
      const u = ((t * 0.9 + k * 0.37) % 1); m.position.copy(w.userData.curve.getPoint(k % 2 ? 1 - u : u)); m.position.z += w.position.z;
      m.scale.setScalar(0.7 + 0.3 * Math.sin(t * 20 + k));
    });
  };

  // helpers for attaching crows etc.
  const tmp = new THREE.Vector3();
  S.armPoint = (side, u, out = new THREE.Vector3()) => { // side 0 = left, 1 = right; u in 0..1 along the arm
    const piv = S.arms[side]; piv.updateWorldMatrix(true, false);
    const s = side ? 1 : -1; return out.set(s * (0.08 + u * 0.5), 0.078, 0).applyMatrix4(piv.matrixWorld);
  };
  S.armQuat = (side, out = new THREE.Quaternion()) => { S.arms[side].getWorldQuaternion(out); return out; };
  S.worldOf = (obj, local = V(0, 0, 0)) => { obj.updateWorldMatrix(true, false); return local.clone().applyMatrix4(obj.matrixWorld); };
  S.hatTop = () => S.worldOf(hat, V(0, 0.15, 0));
  S.nestPoint = (a, rad = 0.06, h = 0.07) => S.worldOf(nest, V(Math.cos(a) * rad, h, Math.sin(a) * rad));
  S.buttonPos = () => S.worldOf(sbtn, V(0, 0.012, 0));
  S.speakerPos = () => S.worldOf(S.speakerMouth);
  S.sensorPos = () => S.worldOf(sen, V(0, 0, 0.04));
  S.eyePos = (k) => S.worldOf(S.eyeAnchors[k]);
  S.groundSpot = (pz2) => tmp;
  return S;
}
