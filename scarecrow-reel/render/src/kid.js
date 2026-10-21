// The kid: toy-like rig with big expressive eyes, messy hair, striped tee, garden gloves, shovel.
import * as THREE from 'three';
import * as T from './textures.js';
import { V, M, setShadows } from './parts.js';
import { merge, paint } from './plants.js';
import { rng, fbm, clamp, lerp } from './util.js';

const SKIN = 0xc98d66, HAIR = 0x3b2417;

export function buildKid(scene) {
  const K = {};
  const skin = new THREE.MeshPhysicalMaterial({ color: SKIN, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffc8a8), sheenRoughness: 0.6 });
  const hairM = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.55 });
  const st = T.stripes('#1f9e8a', '#f6ecd4', 6);
  const tee = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.85 });
  const dn = T.denim();
  const shorts = new THREE.MeshStandardMaterial({ map: dn.map, normalMap: dn.normalMap, roughness: 0.9, color: 0xd8c6a0 });
  const gloveM = new THREE.MeshPhysicalMaterial({ color: 0x6cc23a, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xd8ff9a) });
  const cuffM = new THREE.MeshStandardMaterial({ color: 0xf4c430, roughness: 0.6 });
  const shoeM = new THREE.MeshPhysicalMaterial({ color: 0xe0473a, roughness: 0.45, clearcoat: 0.4 });
  const soleM = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.7 });
  const sockM = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.9 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1 });
  const irisM = new THREE.MeshPhysicalMaterial({ color: 0x5a3416, roughness: 0.2, clearcoat: 1 });
  const pupilM = new THREE.MeshPhysicalMaterial({ color: 0x07060a, roughness: 0.1, clearcoat: 1 });
  const hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mouthM = new THREE.MeshStandardMaterial({ color: 0x5a1a1c, roughness: 0.6 });
  const lipM = new THREE.MeshStandardMaterial({ color: 0x8e3b33, roughness: 0.6 });
  const blushM = new THREE.MeshStandardMaterial({ color: 0xe36d5e, roughness: 0.8, transparent: true, opacity: 0.35, depthWrite: false });

  const root = K.root = new THREE.Group(); scene.add(root);
  const hips = K.hips = new THREE.Group(); hips.position.y = 0.5; root.add(hips);
  const pel = new THREE.Mesh(new THREE.SphereGeometry(0.125, 24, 16), shorts); pel.scale.set(1.0, 0.75, 0.82); pel.position.y = 0.03; hips.add(pel);

  // legs
  K.legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.062, 0, 0); hips.add(hip);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.064, 0.15, 16), shorts); sh.position.y = -0.055; hip.add(sh);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.13, 4, 12), skin); thigh.position.y = -0.11; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.215; hip.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.041, 0.11, 4, 12), skin); shin.position.y = -0.08; knee.add(shin);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.037, 0.06, 14), sockM); sock.position.y = -0.17; knee.add(sock);
    const ankle = new THREE.Group(); ankle.position.y = -0.2; knee.add(ankle);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 12), shoeM); shoe.scale.set(0.85, 0.6, 1.45); shoe.position.set(0, -0.025, 0.03); ankle.add(shoe);
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.018, 18), soleM); sole.scale.set(1, 1, 1.7); sole.position.set(0, -0.052, 0.03); ankle.add(sole);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), soleM); toe.scale.set(1.3, 0.6, 0.6); toe.position.set(0, -0.03, 0.105); ankle.add(toe);
    K.legs.push({ hip, knee, ankle });
  }

  // torso
  const spine = K.spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  const tg = new THREE.LatheGeometry([[0, 0], [0.12, 0.0], [0.135, 0.06], [0.14, 0.16], [0.13, 0.25], [0.1, 0.3], [0.05, 0.32], [0, 0.32]].map(([x, y]) => new THREE.Vector2(x, y)), 32);
  tg.scale(1, 1, 0.82);
  const torso = new THREE.Mesh(tg, tee); spine.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 20), tee); collar.rotation.x = Math.PI / 2; collar.position.y = 0.31; spine.add(collar);

  // arms
  K.arms = [];
  const UA = 0.15, FA = 0.14;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.13, 0.26, 0); spine.add(sh);
    const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), tee); sleeve.scale.set(1, 1.25, 1); sleeve.position.y = -0.03; sh.add(sleeve);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, UA - 0.04, 4, 10), skin); upper.position.y = -UA / 2; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -UA; sh.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, FA - 0.05, 4, 10), skin); fore.position.y = -FA / 2 + 0.01; elbow.add(fore);
    const hand = new THREE.Group(); hand.position.y = -FA; elbow.add(hand);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.04, 14), cuffM); cuff.position.y = 0.012; hand.add(cuff);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), gloveM); palm.scale.set(1, 1.15, 0.8); palm.position.y = -0.035; hand.add(palm);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.03, 4, 8), gloveM); thumb.position.set(-s * 0.0, -0.03, 0.04); thumb.rotation.x = 0.9; hand.add(thumb);
    const fingers = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), gloveM); fingers.scale.set(1, 0.8, 0.75); fingers.position.set(0, -0.07, 0.008); hand.add(fingers);
    K.arms.push({ sh, elbow, hand, UA, FA, s });
  }

  // head
  const neck = new THREE.Group(); neck.position.y = 0.32; spine.add(neck);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.06, 12), skin); neckM.position.y = 0.02; neck.add(neckM);
  const head = K.head = new THREE.Group(); head.position.y = 0.2; neck.add(head);
  const HR = 0.165;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(HR, 40, 30), skin); skull.scale.set(1, 0.98, 0.95); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(HR * 0.86, 32, 20), skin); jaw.scale.set(1.0, 0.8, 0.98); jaw.position.set(0, -0.05, 0.012); head.add(jaw);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), skin); ear.scale.set(0.55, 1, 0.85); ear.position.set(s * 0.158, -0.005, -0.005); head.add(ear);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), blushM); blush.position.set(s * 0.092, -0.045, 0.142); blush.rotation.y = s * 0.55; head.add(blush);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), skin); nose.scale.set(1.1, 0.9, 0.9); nose.position.set(0, -0.025, 0.158); head.add(nose);
  // eyes
  K.eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.058, 0.018, 0.128); eye.rotation.y = s * 0.22; head.add(eye);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.042, 24, 18), white); sclera.scale.set(0.95, 1.15, 0.62); eye.add(sclera);
    const iris = new THREE.Group(); eye.add(iris);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.025, 20, 14), irisM); ir.scale.set(1, 1.08, 0.45); ir.position.z = 0.02; iris.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 10), pupilM); pu.scale.set(1, 1.08, 0.45); pu.position.z = 0.0275; iris.add(pu);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), hiM); hi.position.set(0.008, 0.011, 0.031); eye.add(hi);
    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 8, 6), hiM); hi2.position.set(-0.008, -0.008, 0.031); eye.add(hi2);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.046, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin); lid.scale.set(0.98, 1.18, 0.7); eye.add(lid);
    const lidPiv = lid; lid.rotation.x = -1.35;
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.045, 4, 8), hairM); brow.rotation.z = Math.PI / 2; brow.position.set(0, 0.068, 0.012); eye.add(brow);
    K.eyes.push({ eye, iris, lid: lidPiv, brow, s });
  }
  // mouths
  const mouths = K.mouths = {};
  { const g = new THREE.TorusGeometry(0.035, 0.0075, 8, 20, Math.PI); g.rotateZ(Math.PI); mouths.smile = new THREE.Mesh(g, lipM); }
  { const sh = new THREE.Shape(); sh.moveTo(-0.042, 0); sh.quadraticCurveTo(0, -0.07, 0.042, 0); sh.lineTo(-0.042, 0);
    const g = new THREE.ShapeGeometry(sh, 12); const m = new THREE.Mesh(g, mouthM); mouths.grin = new THREE.Group(); mouths.grin.add(m);
    const teeth = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.008), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })); teeth.position.set(0, -0.005, 0.001); mouths.grin.add(teeth);
    const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), new THREE.MeshStandardMaterial({ color: 0xd9616a })); tongue.scale.set(1.2, 0.6, 1); tongue.position.set(0, -0.036, 0.001); mouths.grin.add(tongue); }
  { const g = new THREE.CircleGeometry(0.02, 18); mouths.o = new THREE.Mesh(g, mouthM); mouths.o.scale.set(0.85, 1.15, 1); }
  { const g = new THREE.CapsuleGeometry(0.006, 0.04, 4, 8); g.rotateZ(Math.PI / 2); mouths.flat = new THREE.Mesh(g, lipM); }
  { const c = new THREE.CatmullRomCurve3([V(-0.035, 0.004, 0), V(-0.005, -0.006, 0), V(0.025, -0.002, 0), V(0.042, 0.014, 0)]); mouths.smirk = new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.007, 6), lipM); }
  const mouthHolder = new THREE.Group(); mouthHolder.position.set(0, -0.078, 0.148); mouthHolder.rotation.x = -0.25; head.add(mouthHolder);
  for (const m of Object.values(mouths)) { mouthHolder.add(m); m.visible = false; }

  // messy hair: cap + tufts
  const hr = rng(909); const tufts = [];
  const cap = new THREE.SphereGeometry(HR * 1.04, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55); cap.rotateX(-0.25); cap.translate(0, 0.012, -0.012);
  tufts.push(paint(cap, HAIR));
  for (let k = 0; k < 46; k++) {
    const u = hr(), a = hr() * Math.PI * 2; const pol = Math.acos(1 - u * 0.95);
    const n = V(Math.sin(pol) * Math.cos(a), Math.cos(pol), Math.sin(pol) * Math.sin(a));
    if (n.z > 0.55 && n.y < 0.65) continue; // keep the face clear
    const L = 0.05 + hr() * 0.06; const c = new THREE.ConeGeometry(0.026 + hr() * 0.012, L, 6); c.translate(0, L / 2, 0);
    const dir = n.clone().add(V((hr() - 0.5) * 0.6, 0.35, -0.25)).normalize();
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir));
    const p = n.clone().multiplyScalar(HR * 0.98); c.translate(p.x, p.y + 0.012, p.z - 0.01);
    tufts.push(paint(c, new THREE.Color(HAIR).multiplyScalar(0.85 + hr() * 0.3)));
  }
  for (let k = 0; k < 6; k++) { // bangs
    const c = new THREE.ConeGeometry(0.03, 0.075, 6); c.translate(0, 0.0375, 0); c.rotateX(1.9 + hr() * 0.3); c.rotateZ((k - 2.5) * 0.25);
    c.translate((k - 2.5) * 0.03, 0.12, 0.1); tufts.push(paint(c, new THREE.Color(HAIR).multiplyScalar(0.9 + hr() * 0.2)));
  }
  const hair = new THREE.Mesh(merge(tufts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, normalMap: T.straw().normalMap, normalScale: new THREE.Vector2(0.4, 0.4) }));
  head.add(hair);

  // shovel (positioned in world space by the director)
  const shovel = K.shovel = new THREE.Group(); scene.add(shovel);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.82, 10), M.wood); handle.position.y = 0.41 + 0.15; shovel.add(handle);
  const grip = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16), M.plasticDark); grip.position.y = 1.02; shovel.add(grip);
  const gripBar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 8), M.plasticDark); gripBar.rotation.z = Math.PI / 2; gripBar.position.y = 1.045; shovel.add(gripBar);
  const neckS = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.08, 10), M.darkMetal); neckS.position.y = 0.15; shovel.add(neckS);
  const bs = new THREE.Shape(); bs.moveTo(-0.075, 0.12); bs.lineTo(0.075, 0.12); bs.quadraticCurveTo(0.085, 0.02, 0.0, -0.05); bs.quadraticCurveTo(-0.085, 0.02, -0.075, 0.12);
  const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
  { const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - 0.03 * (x / 0.08) ** 2); } bg.computeVertexNormals(); }
  const blade = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.35 })); blade.position.y = 0.0; shovel.add(blade);
  const dirtOn = K.dirtOnBlade = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), M.soilLoose); dirtOn.scale.set(1, 0.5, 0.7); dirtOn.position.set(0, 0.05, 0.03); shovel.add(dirtOn);
  K.shovelTip = V(0, -0.05, 0); K.shovelGripTop = V(0, 1.03, 0); K.shovelGripLow = V(0, 0.55, 0);

  setShadows(root, true, true); setShadows(shovel, true, true);
  blushM.castShadow = false;

  // ---------------------------------------------------------------- IK + pose
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
  // Two-bone IK: put arm k's hand at world target. pole = world direction the elbow should point.
  K.reach = (k, target, pole = V(0, -0.3, -1)) => {
    const A = K.arms[k]; const parent = A.sh.parent; parent.updateWorldMatrix(true, false);
    const inv = tmpM.copy(parent.matrixWorld).invert();
    const tl = target.clone().applyMatrix4(inv);
    const pl = pole.clone().transformDirection(inv);
    const s = A.sh.position.clone(); const d = tl.sub(s);
    const u = A.UA, f = A.FA + 0.045;
    const L = clamp(d.length(), 0.03, (u + f) * 0.999); const dn = d.clone().normalize();
    const a = Math.acos(clamp((u * u + L * L - f * f) / (2 * u * L), -1, 1));
    const e = Math.PI - Math.acos(clamp((u * u + f * f - L * L) / (2 * u * f), -1, 1));
    let n = pl.clone().cross(dn); if (n.lengthSq() < 1e-6) n.set(1, 0, 0); n.normalize();
    const upperDir = dn.clone().applyAxisAngle(n, -a);
    const Y = upperDir.clone().negate(); const X = n.clone(); const Z = X.clone().cross(Y).normalize(); X.copy(Y.clone().cross(Z)).normalize();
    tmpM.makeBasis(X, Y, Z); A.sh.quaternion.setFromRotationMatrix(tmpM);
    A.elbow.rotation.set(e, 0, 0);
  };

  K.setPose = (p) => {
    root.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    root.rotation.y = p.yaw ?? 0;
    root.scale.setScalar(p.scale ?? 1);
    hips.position.y = 0.5 + (p.bob ?? 0);
    hips.rotation.set(p.hipX ?? 0, p.hipY ?? 0, p.hipZ ?? 0);
    spine.rotation.set(p.lean ?? 0, p.twist ?? 0, p.side ?? 0);
    head.rotation.set(p.headX ?? 0, p.headY ?? 0, p.headZ ?? 0);
    neck.position.y = 0.32 + (p.shrug ?? 0) * -0.03;
    // legs: [hip x-rot, knee]
    const legs = p.legs ?? [[0, 0], [0, 0]];
    K.legs.forEach((L, i) => { L.hip.rotation.set(legs[i][0], 0, (i ? -1 : 1) * (p.legSpread ?? 0.04)); L.knee.rotation.x = legs[i][1]; L.ankle.rotation.x = -(legs[i][0] + legs[i][1]) * 0.6; });
    // arms by angles (overridden by reach targets)
    const arms = p.arms ?? [[0.1, 0.12, 0, 0.2], [0.1, -0.12, 0, 0.2]];
    K.arms.forEach((A, i) => { const a = arms[i]; A.sh.rotation.set(a[0], a[2] ?? 0, a[1]); A.elbow.rotation.set(a[3] ?? 0, 0, 0); });
    if (p.shrug) K.arms.forEach((A, i) => { A.sh.position.y = 0.26 + p.shrug * 0.035; });
    else K.arms.forEach((A) => { A.sh.position.y = 0.26; });
    root.updateMatrixWorld(true);
    if (p.reachL) K.reach(0, p.reachL, p.poleL); if (p.reachR) K.reach(1, p.reachR, p.poleR);
    K.arms.forEach((A, i) => { const hr = (p.handRot ?? [[0, 0, 0], [0, 0, 0]])[i]; A.hand.rotation.set(hr[0], hr[1], hr[2]); });
    // face
    const gz = p.gaze ?? [0, 0];
    K.eyes.forEach((E) => {
      E.iris.position.set(clamp(gz[0], -1, 1) * 0.012, clamp(gz[1], -1, 1) * 0.011, 0);
      const blink = clamp(p.blink ?? 0); const wide = p.wide ?? 0;
      E.lid.rotation.x = lerp(-1.35 - wide * 0.3, 1.45, blink) + (p.squint ?? 0) * 0.6;
      E.eye.scale.setScalar(1 + wide * 0.12);
      E.brow.position.y = 0.068 + (p.brow ?? 0) * 0.016 + wide * 0.01;
      E.brow.rotation.z = Math.PI / 2 + E.s * (p.browTilt ?? 0) * 0.35;
    });
    for (const [k, m] of Object.entries(mouths)) m.visible = k === (p.mouth ?? 'smile');
    const mo = p.mouthScale ?? 1; mouthHolder.scale.set(mo, mo * (p.mouthOpen ?? 1), 1);
    // shovel world placement: tip + up direction (or hidden)
    if (p.shovel) {
      shovel.visible = true; const sp = p.shovel;
      shovel.position.copy(sp.tip);
      const up = sp.up.clone().normalize();
      const fwd = (sp.face || V(0, 0, 1)).clone(); fwd.addScaledVector(up, -fwd.dot(up)).normalize();
      const X = up.clone().cross(fwd).normalize();
      tmpM.makeBasis(X, up, fwd); shovel.quaternion.setFromRotationMatrix(tmpM);
      shovel.position.sub(K.shovelTip.clone().applyQuaternion(shovel.quaternion));
      K.dirtOnBlade.visible = (sp.dirt ?? 0) > 0.01; K.dirtOnBlade.scale.set(1, 0.5, 0.7).multiplyScalar(Math.max(0.001, sp.dirt ?? 0));
      shovel.updateMatrixWorld(true);
    } else shovel.visible = false;
  };
  K.shovelPoint = (local) => local.clone().applyMatrix4(shovel.matrixWorld);
  K.handWorld = (k) => K.arms[k].hand.getWorldPosition(new THREE.Vector3());
  K.headWorld = () => head.getWorldPosition(new THREE.Vector3());
  return K;
}
