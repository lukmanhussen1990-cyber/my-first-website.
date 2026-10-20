import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Tube } from './tube.js';
import { eyeMaterial, makeEye, skinMaterial } from './charmat.js';
import { clamp, lerp, mulberry32, smoothstep } from './util.js';

// John: a friendly young guy with messy brown hair, big expressive eyes,
// racing goggles and a red hoodie. He is only ever seen sitting in the car,
// so the rig covers head, torso, arms and hands.
// Local frame: +x forward, +y up, +z right; origin on the seat cushion.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const HEAD_R = 0.138;

function taperTube(curve, segs, r0, radial = 7) {
  const g = new THREE.TubeGeometry(curve, segs, r0, radial, false);
  const p = g.attributes.position;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPoint(t, c);
    const k = Math.pow(1 - t, 0.9) * (0.4 + 0.6 * Math.sin(Math.min(1, t * 3 + 0.3) * Math.PI / 2));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(k).add(c);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function defaultJohnPose() {
  return {
    lean: 0, twist: 0, headYaw: 0, headPitch: 0, headRoll: 0, headBack: 0,
    lidL: 0.05, lidR: 0.05, lowL: 0.05, lowR: 0.05, blink: 0, gaze: V3(1, 0, 0),
    browL: 0, browR: 0, browIn: 0, smile: 0.4, open: 0, oShape: 0, teeth: 0,
    handL: V3(0.36, 0.42, -0.14), handR: V3(0.36, 0.42, 0.14), fistL: 0, fistR: 0,
    hairBounce: 0,
  };
}

export function makeJohn(env) {
  const root = new THREE.Group();
  const torsoG = new THREE.Group(); root.add(torsoG);
  const skin = skinMaterial(new THREE.Color(0xd9a07c));
  const hoodie = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0xc4211c), roughness: 0.82, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color(1.0, 0.45, 0.4) });
  const hoodieDark = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0x8e1512), roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color(0.9, 0.35, 0.3) });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 });
  const hairMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0x7a4b2a), roughness: 0.5, sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.9, 0.6, 0.35), clearcoat: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1312, roughness: 0.6 });

  // torso: hoodie body (lathe), shoulders and hood collar
  const torsoPts = [];
  const prof = [[0.0, 0.17], [0.05, 0.2], [0.15, 0.205], [0.25, 0.2], [0.32, 0.185], [0.365, 0.15], [0.39, 0.09], [0.4, 0.05]];
  for (const [y, r] of prof) torsoPts.push(new THREE.Vector2(r, y));
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 28);
  torsoGeo.scale(0.78, 1, 1.0); // a bit flatter front-to-back
  const torso = new THREE.Mesh(torsoGeo, hoodie);
  torsoG.add(torso);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.045, 12, 28), hoodie);
  hood.rotation.x = Math.PI / 2; hood.position.set(-0.02, 0.39, 0); hood.scale.set(1.0, 1.15, 1); torsoG.add(hood);
  const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), hoodieDark);
  hoodBack.position.set(-0.11, 0.36, 0); hoodBack.rotation.z = 1.1; hoodBack.scale.set(1, 0.6, 1.3); torsoG.add(hoodBack);
  for (const s of [1, -1]) {
    const c = new THREE.CatmullRomCurve3([V3(0.06, 0.38, 0.04 * s), V3(0.12, 0.32, 0.05 * s), V3(0.13, 0.25, 0.055 * s)]);
    torsoG.add(new THREE.Mesh(new THREE.TubeGeometry(c, 10, 0.006, 5), white));
    const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.02, 3, 6), white); tip.position.set(0.13, 0.235, 0.055 * s); torsoG.add(tip);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.09, 16), skin);
  neck.position.set(0.0, 0.43, 0); torsoG.add(neck);

  // head
  const headG = new THREE.Group(); headG.position.set(0.0, 0.47, 0); torsoG.add(headG);
  const headInner = new THREE.Group(); headInner.position.set(0.0, HEAD_R * 0.86, 0); headG.add(headInner);
  const headGeo = new THREE.SphereGeometry(HEAD_R, 48, 36);
  {
    const p = headGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      // softer jaw and slightly fuller cheeks, a bit narrower than tall
      const d = v.clone().normalize();
      let s = 1 + 0.06 * Math.exp(-((d.y + 0.35) ** 2) / 0.05) * Math.max(0, d.x);
      if (d.y < -0.3) s *= 1 - 0.1 * (-0.3 - d.y);
      v.multiplyScalar(s); v.z *= 0.96;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    headGeo.computeVertexNormals();
  }
  const head = new THREE.Mesh(headGeo, skin);
  headInner.add(head);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), skin);
  nose.position.set(HEAD_R * 0.98, -0.018, 0); nose.scale.set(0.9, 0.85, 1); headInner.add(nose);
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), skin);
    ear.position.set(-0.005, -0.005, s * HEAD_R * 0.97); ear.scale.set(0.8, 1.15, 0.55); headInner.add(ear);
  }
  // eyes
  const eyeM = eyeMaterial({ iris: new THREE.Color(0.42, 0.24, 0.1), irisR: 0.66, pupilR: 0.33 });
  const eyes = [];
  for (const s of [1, -1]) {
    const e = makeEye(0.04, eyeM, skin);
    const dir = V3(0.86, 0.12, 0.4 * s).normalize();
    e.group.position.copy(dir.clone().multiplyScalar(HEAD_R - 0.018));
    const fwd = V3(1, 0.0, 0.12 * s).normalize();
    e.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(V3(0, 0, 0), fwd.clone().negate(), V3(0, 1, 0)));
    headInner.add(e.group);
    eyes.push({ ...e, side: s });
  }
  // brows
  const brows = [];
  for (const s of [1, -1]) {
    const g = new THREE.CapsuleGeometry(0.009, 0.045, 4, 8); g.rotateX(Math.PI / 2);
    const b = new THREE.Mesh(g, hairMat);
    const piv = new THREE.Group(); piv.position.set(HEAD_R * 0.86, 0.068, 0.058 * s); piv.add(b);
    piv.rotation.y = -0.25 * s;
    headInner.add(piv);
    brows.push({ piv, mesh: b, side: s });
  }
  // mouth shapes
  const mouthG = new THREE.Group(); mouthG.position.set(HEAD_R * 0.93, -0.06, 0); headInner.add(mouthG);
  const mouthDark = new THREE.MeshStandardMaterial({ color: 0x3a0f0e, roughness: 0.7 });
  let smileMesh = null, lastSmile = null;
  function buildSmile(k) {
    if (smileMesh) { mouthG.remove(smileMesh); smileMesh.geometry.dispose(); }
    const w = 0.04 + 0.012 * Math.abs(k);
    const c = new THREE.QuadraticBezierCurve3(V3(-0.006 + 0.01 * Math.max(0, k), 0.012 * k, -w), V3(0.012, -0.02 * k, 0), V3(-0.006 + 0.01 * Math.max(0, k), 0.012 * k, w));
    smileMesh = new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.0045, 6), mouthDark);
    mouthG.add(smileMesh);
  }
  const openMouth = new THREE.Group(); mouthG.add(openMouth);
  const om = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mouthDark);
  om.rotation.z = 0; openMouth.add(om);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.05), white); teeth.position.set(0.012, -0.004, 0); openMouth.add(teeth);
  const oMouth = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mouthDark); mouthG.add(oMouth);

  // hair: cap + messy tapered tufts + fringe
  const rnd = mulberry32(31);
  const hairGeos = [];
  const cap = new THREE.SphereGeometry(HEAD_R * 1.04, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
  cap.rotateZ(0.32); cap.translate(-0.008, 0.008, 0);
  hairGeos.push(cap.toNonIndexed());
  for (let i = 0; i < 34; i++) {
    // soft messy clumps over the top/back of the head, swept back, avoiding the face
    const th = rnd() * Math.PI * 2, ph = Math.acos(1 - rnd() * 1.1);
    const d = V3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    if (d.x > 0.5 && d.y < 0.65) continue;
    const base = d.clone().multiplyScalar(HEAD_R * 0.95);
    const out = d.clone().add(V3(-0.6 + (rnd() - 0.5) * 0.8, 0.25 + rnd() * 0.3, (rnd() - 0.5) * 0.7)).normalize();
    const len = 0.045 + rnd() * 0.045;
    const tip = base.clone().addScaledVector(out, len);
    const mid = base.clone().lerp(tip, 0.5).addScaledVector(d, 0.02);
    hairGeos.push(taperTube(new THREE.QuadraticBezierCurve3(base, mid, tip), 8, 0.032 + rnd() * 0.014).toNonIndexed());
  }
  // fringe falling over the forehead (above the goggles)
  for (let i = 0; i < 7; i++) {
    const z = (i / 6 - 0.5) * 0.17;
    const base = V3(HEAD_R * 0.62, HEAD_R * 0.78, z);
    const tip = V3(HEAD_R * 1.02, HEAD_R * 0.5 - rnd() * 0.02, z + (rnd() - 0.5) * 0.05);
    const mid = V3(HEAD_R * 0.98, HEAD_R * 0.86, z);
    hairGeos.push(taperTube(new THREE.QuadraticBezierCurve3(base, mid, tip), 8, 0.024).toNonIndexed());
  }
  for (const g of hairGeos) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
  const hair = new THREE.Mesh(mergeGeometries(hairGeos.map((g) => { const n = g.clone(); for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; })), hairMat);
  const hairPiv = new THREE.Group(); hairPiv.add(hair); headInner.add(hairPiv);

  // racing goggles: strap around the head, two round frames, clear lenses
  const goggles = new THREE.Group(); headInner.add(goggles);
  {
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.7 });
    const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xd8d8dc, metalness: 1.0, roughness: 0.2, envMap: env });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x6b3d22, roughness: 0.75 });
    const strap = new THREE.Mesh(new THREE.TorusGeometry(HEAD_R * 1.02, 0.012, 8, 48), strapMat);
    strap.rotation.x = Math.PI / 2; strap.rotation.z = 0; strap.position.y = 0.035; strap.rotation.y = 0;
    strap.scale.set(1, 0.96, 1); goggles.add(strap);
    const lensMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.55, 0.7, 0.9), roughness: 0.02, envMap: env, envMapIntensity: 1.5, transparent: true, depthWrite: false });
    lensMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
        // clear lens: mostly see-through so the eyes read, a faint tinted sheen
        float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 4.0);
        float a = mix(0.05, 0.4, fres);
        gl_FragColor = vec4(outgoingLight * (0.12 + 0.3 * fres) + vec3(0.02, 0.035, 0.05) * a, a);`).replace('#include <premultiplied_alpha_fragment>', '');
    };
    lensMat.blending = THREE.CustomBlending; lensMat.blendSrc = THREE.OneFactor; lensMat.blendDst = THREE.OneMinusSrcAlphaFactor;
    for (const s of [1, -1]) {
      const g = new THREE.Group();
      const dir = V3(0.86, 0.12, 0.4 * s).normalize();
      g.position.copy(dir.clone().multiplyScalar(HEAD_R + 0.03));
      g.lookAt(g.position.clone().add(V3(1, 0.05, 0.25 * s)));
      const pad = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.009, 10, 28), padMat); pad.position.z = -0.008; g.add(pad);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0055, 8, 32), rimMat); rim.position.z = 0.004; g.add(rim);
      // shallow cap (radius 0.11, 22 degrees) spanning the rim: flat enough that
      // Fresnel stays low over the middle of the lens
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 6, 0, Math.PI * 2, 0, 0.385), lensMat);
      lens.rotation.x = Math.PI / 2; lens.position.z = -0.11 + 0.012; lens.renderOrder = 12; g.add(lens);
      goggles.add(g);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12, Math.PI), padMat);
    bridge.position.set(HEAD_R + 0.025, 0.04, 0); bridge.rotation.y = Math.PI / 2; goggles.add(bridge);
  }

  // arms (tubes) and hands
  const armMat = hoodie;
  const arms = [];
  for (const s of [1, -1]) {
    const t = new Tube({ nu: 16, nv: 12, restLength: 0.5, capStart: true, capEnd: true, capRings: 3 });
    const m = new THREE.Mesh(t.geo, armMat); root.add(m);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.012, 8, 18), hoodieDark); root.add(cuff);
    const hand = new THREE.Group(); root.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), skin); palm.scale.set(1.05, 0.8, 0.95); hand.add(palm);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.025, 4, 8), skin); thumb.position.set(0.02, 0.022, 0.03 * s); thumb.rotation.z = -0.8; hand.add(thumb);
    const fingers = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.02, 4, 10), skin); fingers.scale.set(0.9, 0.8, 1.15); fingers.position.set(0.035, 0.0, 0); hand.add(fingers);
    arms.push({ tube: t, mesh: m, cuff, hand, fingers, thumb, side: s });
  }
  // seatbelt across the chest (right shoulder to left hip)
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.65 });
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.055), beltMat);
  belt.position.set(0.135, 0.22, 0.0); belt.rotation.x = 0.66; belt.rotation.z = 0.12; torsoG.add(belt);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  function apply(P, time = 0) {
    torsoG.rotation.set(0, P.twist, -P.lean, 'YXZ');
    headG.rotation.set(P.headRoll, P.headYaw, P.headPitch - P.headBack, 'YXZ');
    hairPiv.rotation.z = P.hairBounce * 0.12;
    hairPiv.position.y = P.hairBounce * 0.008;
    eyes.forEach((e, i) => {
      const up = e.side > 0 ? P.lidR : P.lidL, low = e.side > 0 ? P.lowR : P.lowL;
      const q = e.group.quaternion.clone().invert();
      const local = P.gaze.clone().normalize().applyQuaternion(q);
      if (local.z < 0.35) local.z = 0.35;
      e.set({ up: Math.max(up, P.blink), low: Math.max(low, P.blink * 0.6), gaze: local });
    });
    brows.forEach((b) => {
      const v = b.side > 0 ? P.browR : P.browL;
      b.piv.position.y = 0.068 + 0.014 * v - 0.006 * P.browIn;
      b.mesh.rotation.x = b.side * (0.25 * P.browIn - 0.12 * v);
    });
    // mouth
    const sk = Math.round(P.smile * 20) / 20;
    if (sk !== lastSmile) { buildSmile(sk); lastSmile = sk; }
    smileMesh.visible = P.open < 0.12 && P.oShape < 0.12;
    openMouth.visible = P.open >= 0.12;
    openMouth.scale.set(0.012, 0.03 * P.open + 0.006, 0.042 + 0.01 * P.smile);
    teeth.visible = P.teeth > 0.5;
    oMouth.visible = P.oShape >= 0.12 && P.open < 0.12;
    oMouth.scale.set(0.01, 0.02 * P.oShape, 0.014 * P.oShape);
    oMouth.position.set(0.002, -0.006, 0);
    // arms: shoulder -> elbow (IK) -> wrist
    torsoG.updateMatrixWorld();
    for (const a of arms) {
      const sh = V3(-0.01, 0.335, a.side * 0.19).applyMatrix4(torsoG.matrix);
      const target = (a.side > 0 ? P.handR : P.handL).clone();
      const l1 = 0.21, l2 = 0.21;
      const d = target.clone().sub(sh);
      const dist = clamp(d.length(), 0.08, l1 + l2 - 0.005);
      const dir = d.normalize();
      const wrist = sh.clone().addScaledVector(dir, dist);
      const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
      const pole = V3(-0.3, -1, a.side * 0.6).normalize();
      const perp = pole.addScaledVector(dir, -pole.dot(dir)).normalize();
      const elbow = sh.clone().addScaledVector(dir, l1 * cosA).addScaledVector(perp, l1 * Math.sqrt(1 - cosA * cosA));
      const c = new THREE.CatmullRomCurve3([sh.clone().add(V3(0, 0.02, -a.side * 0.03)), sh, elbow, wrist], false, 'centripetal');
      a.tube.update((t) => c.getPoint(t), (t) => { const r = lerp(0.058, 0.04, t); return { ry: r, rz: r, oy: 0 }; }, V3(0, 1, 0));
      const fwd = wrist.clone().sub(elbow).normalize();
      a.cuff.position.copy(wrist).addScaledVector(fwd, -0.005);
      a.cuff.quaternion.setFromUnitVectors(V3(0, 0, 1), fwd);
      a.hand.position.copy(wrist).addScaledVector(fwd, 0.045);
      a.hand.quaternion.setFromUnitVectors(V3(1, 0, 0), fwd);
      const fist = a.side > 0 ? P.fistR : P.fistL;
      a.fingers.scale.set(0.9 - 0.25 * fist, 0.8 + 0.15 * fist, 1.15);
      a.fingers.position.x = 0.035 - 0.012 * fist;
    }
  }
  apply(defaultJohnPose());
  return { root, apply, headG, eyes };
}
