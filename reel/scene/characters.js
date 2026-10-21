// Toy-like characters: round heads, big expressive eyes, same base design for everyone.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from './util.js';

const fabric = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const skinMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 });

function capsule(r, len, mat, seg = 14) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }

// limb chain: joint group -> mesh offset down along -Y
function limb(r, len, mat) {
  const j = new THREE.Group();
  const m = capsule(r, len, mat); m.position.y = -len / 2; j.add(m);
  const end = new THREE.Group(); end.position.y = -len; j.add(end);
  j.userData.end = end; return j;
}

export function makeCharacter(opt) {
  const o = Object.assign({
    skin: 0xf2c4a0, hoodie: 0xd7322e, pants: 0x2d4a7a, shoes: 0xf5f5f5, shoeAccent: 0xd7322e,
    hair: 0x6b3f22, hairStyle: 'messy', iris: 0x5a3a1e, goggles: false, cap: null, vest: null, mustache: false, scale: 1, seed: 1,
  }, opt);
  const rnd = mulberry32(o.seed);
  const root = new THREE.Group();
  const rig = { root };
  const skin = skinMat(o.skin);
  const hood = fabric(o.hoodie, 0.85);
  // ---- hips / torso
  const hips = new THREE.Group(); hips.position.y = 0.38; root.add(hips); rig.hips = hips;
  const torso = new THREE.Group(); hips.add(torso); rig.torso = torso;
  const prof = [[0, -0.02], [0.13, 0.0], [0.15, 0.08], [0.145, 0.2], [0.12, 0.28], [0.06, 0.32], [0, 0.325]].map(([r, y]) => new THREE.Vector2(r, y));
  const tg = new THREE.LatheGeometry(prof, 28); tg.scale(1.0, 1, 0.82);
  const tmesh = new THREE.Mesh(tg, hood); tmesh.castShadow = tmesh.receiveShadow = true; torso.add(tmesh);
  // hood bunched behind the neck
  const hoodM = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 10, 20), hood); hoodM.position.set(0, 0.3, -0.06); hoodM.rotation.x = Math.PI / 2 - 0.4; hoodM.castShadow = true; torso.add(hoodM);
  if (!o.vest) {
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.07, 0.03, 2, 0.012), fabric(new THREE.Color(o.hoodie).multiplyScalar(0.8))); pocket.position.set(0, 0.09, 0.115); torso.add(pocket);
    for (const s of [-1, 1]) { const dsg = capsule(0.008, 0.08, fabric(0xf4f4f4, 0.6), 6); dsg.position.set(s * 0.035, 0.235, 0.115); torso.add(dsg); }
  } else {
    // worker: high-vis vest over shirt
    const vestMat = fabric(o.vest, 0.7);
    const vg = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x * 1.07, p.y)).slice(1, 5), 28, 0, Math.PI * 2); vg.scale(1, 1, 0.84);
    const v = new THREE.Mesh(vg, vestMat); v.position.y = 0.0; torso.add(v);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.3, metalness: 0.4, emissive: 0x404040 });
    for (const y of [0.07, 0.15]) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.158, 0.012, 6, 32), stripeMat); st.scale.set(1, 0.84, 1); st.rotation.x = Math.PI / 2; st.position.y = y; torso.add(st); }
    const badge = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.035, 0.01, 1, 0.005), fabric(0xffffff, 0.4)); badge.position.set(0.06, 0.22, 0.125); torso.add(badge);
  }
  // ---- head
  const neck = new THREE.Group(); neck.position.y = 0.33; torso.add(neck); rig.neck = neck;
  const head = new THREE.Group(); head.position.y = 0.2; neck.add(head); rig.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 30), skin); skull.scale.set(1.0, 0.96, 0.95); skull.castShadow = true; skull.receiveShadow = true; head.add(skull);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.198, -0.01, 0); head.add(ear); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), skin); nose.position.set(0, -0.03, 0.19); head.add(nose);
  for (const s of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.35, depthWrite: false }));
    blush.position.set(s * 0.115, -0.055, 0.16); blush.lookAt(s * 0.115 * 3, -0.055 * 3, 0.5); head.add(blush);
  }
  // eyes
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
  const irisM = new THREE.MeshStandardMaterial({ color: o.iris, roughness: 0.3 });
  const pupilM = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.2 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  rig.eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.082, 0.015, 0.152); head.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.064, 24, 18), white); ball.scale.set(0.95, 1.15, 0.65); eye.add(ball);
    const look = new THREE.Group(); eye.add(look);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.041, 20, 14), irisM); iris.scale.set(1, 1.12, 0.45); iris.position.z = 0.033; look.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), pupilM); pupil.scale.set(1, 1.12, 0.45); pupil.position.z = 0.043; look.add(pupil);
    const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), glint); g1.position.set(0.013, 0.019, 0.05); look.add(g1);
    const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), glint); g2.position.set(-0.013, -0.013, 0.05); look.add(g2);
    // eyelid (skin cap) for blinks
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.067, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin); lid.scale.set(0.98, 1.18, 0.7); lid.rotation.x = -1.65; eye.add(lid);
    rig.eyes.push({ eye, look, lid, s });
  }
  // brows
  const browM = fabric(o.hair, 0.7);
  rig.brows = [];
  for (const s of [-1, 1]) { const b = capsule(0.012, 0.05, browM, 8); b.rotation.z = Math.PI / 2; b.position.set(s * 0.08, 0.105, 0.17); head.add(b); rig.brows.push({ b, s }); }
  // mouth: smile arc + open mouth
  const mouthM = new THREE.MeshStandardMaterial({ color: 0x5a1a1e, roughness: 0.5 });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 8, 20, Math.PI), mouthM); smile.rotation.z = Math.PI; smile.position.set(0, -0.075, 0.178); smile.rotation.x = -0.25; head.add(smile);
  const open = new THREE.Group(); open.position.set(0, -0.09, 0.172); head.add(open);
  const om = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 14), mouthM); om.scale.set(1, 0.85, 0.35); open.add(om);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe86a7a, roughness: 0.5 })); tongue.scale.set(1.2, 0.6, 0.5); tongue.position.set(0, -0.018, 0.008); open.add(tongue);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })); teeth.position.set(0, 0.022, 0.01); open.add(teeth);
  rig.mouth = { smile, open };
  // hair
  const hairM = new THREE.MeshStandardMaterial({ color: o.hair, roughness: 0.72 });
  const hairG = new THREE.Group(); head.add(hairG); rig.hair = hairG;
  if (o.hairStyle === 'messy') {
    const capG = new THREE.SphereGeometry(0.212, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const capM = new THREE.Mesh(capG, hairM); capM.rotation.x = -0.25; capM.position.set(0, 0.01, -0.012); capM.castShadow = true; hairG.add(capM);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, el = 0.1 + rnd() * 0.95;
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(el), Math.cos(el), Math.sin(a) * Math.sin(el));
      if (dir.z > 0.55 && dir.y < 0.6) continue;
      const tuft = new THREE.Mesh(new THREE.CapsuleGeometry(0.038 + rnd() * 0.02, 0.05 + rnd() * 0.05, 4, 10), hairM);
      tuft.position.copy(dir.clone().multiplyScalar(0.2)); tuft.position.y += 0.015;
      tuft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.8, 0.3, (rnd() - 0.5) * 0.5)).normalize());
      tuft.castShadow = true; hairG.add(tuft);
    }
    // bangs
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.06, 4, 8), hairM); b.position.set(-0.1 + i * 0.05, 0.15, 0.14); b.rotation.x = 1.9 + (rnd() - 0.5) * 0.3; b.rotation.z = (rnd() - 0.5) * 0.7; hairG.add(b); }
  } else if (o.hairStyle === 'puffs') {
    const capM = new THREE.Mesh(new THREE.SphereGeometry(0.21, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM); capM.rotation.x = -0.2; capM.castShadow = true; hairG.add(capM);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), hairM); p.position.set(s * 0.16, 0.16, -0.03); p.castShadow = true; hairG.add(p); }
  } else if (o.hairStyle === 'short') {
    const capM = new THREE.Mesh(new THREE.SphereGeometry(0.21, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.45), hairM); capM.rotation.x = -0.3; capM.castShadow = true; hairG.add(capM);
  }
  if (o.cap) {
    const cm = fabric(o.cap, 0.6);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.215, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), cm); crown.position.y = 0.035; crown.castShadow = true; head.add(crown);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 24, 1, false, -Math.PI / 2, Math.PI), cm); brim.scale.set(1, 1, 1.2);
    brim.position.set(0, 0.05, o.capBack ? -0.19 : 0.19); brim.rotation.y = o.capBack ? Math.PI : 0; brim.rotation.x = o.capBack ? 0.1 : -0.1; head.add(brim);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), cm); btn.position.y = 0.25; head.add(btn);
  }
  if (o.mustache) {
    for (const s of [-1, 1]) { const mm = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.04, 4, 8), fabric(o.hair, 0.7)); mm.rotation.z = Math.PI / 2 + s * 0.35; mm.position.set(s * 0.03, -0.052, 0.188); head.add(mm); }
  }
  if (o.goggles) {
    const gog = new THREE.Group(); head.add(gog); rig.goggles = gog; // rotates about head centre (x axis)
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.207, 0.018, 8, 40), new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.6 }));
    strap.rotation.x = Math.PI / 2; strap.scale.set(1, 0.98, 1); gog.add(strap);
    const rimM = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.3, metalness: 0.1 });
    const lensM = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.02, metalness: 0.0, transparent: true, opacity: 0.22, envMapIntensity: 2.0, depthWrite: false });
    for (const s of [-1, 1]) {
      const cup = new THREE.Group(); cup.position.set(s * 0.084, 0.015, 0.2); cup.rotation.y = s * 0.3; gog.add(cup);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.016, 10, 28), rimM); cup.add(rim);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.079, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), lensM); lens.rotation.x = Math.PI / 2; lens.scale.set(1, 0.3, 1); lens.position.z = 0.005; cup.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), rimM); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, 0.02, 0.235); gog.add(bridge);
    gog.userData.upAngle = -0.95; // on the forehead
  }
  // ---- arms
  rig.arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.15, 0.27, 0); torso.add(sh);
    const upper = limb(0.045, 0.13, hood); sh.add(upper);
    const elbow = upper.userData.end;
    const lower = limb(0.042, 0.12, hood); elbow.add(lower);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 16), fabric(new THREE.Color(o.hoodie).multiplyScalar(0.8))); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.12; lower.add(cuff);
    const hand = new THREE.Group(); hand.position.y = -0.15; lower.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 14), skin); palm.scale.set(0.9, 1, 0.75); palm.castShadow = true; hand.add(palm);
    const thumb = new THREE.Group(); thumb.position.set(-s * 0.035, 0.0, 0.025); hand.add(thumb);
    const th = capsule(0.017, 0.035, skin, 8); th.position.y = 0.025; thumb.add(th);
    thumb.rotation.z = s * 0.9;
    rig.arms.push({ sh, elbow, hand, thumb, s, upper, lower });
  }
  // ---- legs
  rig.legs = [];
  const pantsM = fabric(o.pants, 0.85);
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.075, 0.0, 0); hips.add(hip);
    const thigh = limb(0.058, 0.15, pantsM); hip.add(thigh);
    const knee = thigh.userData.end;
    const shin = limb(0.052, 0.13, pantsM); knee.add(shin);
    const foot = new THREE.Group(); foot.position.y = -0.17; shin.add(foot);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.075, 0.17, 3, 0.035), fabric(o.shoes, 0.5)); shoe.position.set(0, -0.005, 0.035); shoe.castShadow = true; foot.add(shoe);
    const stripe = new THREE.Mesh(new RoundedBoxGeometry(0.112, 0.02, 0.12, 2, 0.008), fabric(o.shoeAccent, 0.5)); stripe.position.set(0, 0.0, 0.035); foot.add(stripe);
    const sole = new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.022, 0.175, 2, 0.01), fabric(0x3a3a3a, 0.8)); sole.position.set(0, -0.04, 0.035); foot.add(sole);
    rig.legs.push({ hip, knee, foot, s });
  }
  root.scale.setScalar(o.scale);
  rig.opt = o;
  root.traverse((m) => { if (m.isMesh && m.material && !m.material.transparent) { m.castShadow = true; } });
  return rig;
}

// ---- pose helpers ----------------------------------------------------------------------
// expression: { smile:0..1, open:0..1, brow: -1 (worried) .. +1 (determined), blink:0..1, lookX, lookY, wide:0..1 }
export function setFace(rig, f = {}) {
  const smile = f.smile ?? 1, open = f.open ?? 0, blink = f.blink ?? 0, wide = f.wide ?? 0;
  rig.mouth.smile.visible = open < 0.35;
  rig.mouth.smile.scale.set(0.7 + smile * 0.5, 0.6 + smile * 0.6, 1);
  rig.mouth.open.visible = open >= 0.35;
  rig.mouth.open.scale.set(0.8 + open * 0.3, 0.5 + open * 0.9, 1);
  for (const e of rig.eyes) {
    e.look.position.set((f.lookX ?? 0) * 0.016, (f.lookY ?? 0) * 0.014, 0);
    e.eye.scale.setScalar(1 + wide * 0.15);
    e.lid.rotation.x = -1.65 + blink * 1.75;
    e.lid.visible = blink > 0.02;
  }
  const br = f.brow ?? 0;
  for (const b of rig.brows) {
    b.b.rotation.z = Math.PI / 2 + b.s * br * 0.35;
    b.b.position.y = 0.105 + (f.browUp ?? 0) * 0.02 + wide * 0.012;
  }
}

// Sitting pose inside the basket (legs forward)
export function poseSit(rig, k = 1) {
  rig.hips.rotation.set(0, 0, 0);
  for (const L of rig.legs) {
    L.hip.rotation.set(-1.45 * k, 0, L.s * 0.12 * k);
    L.knee.rotation.set(0.25 * k, 0, 0);
    L.foot.rotation.set(-0.2 * k, 0, 0);
  }
}
export function poseStand(rig) {
  for (const L of rig.legs) { L.hip.rotation.set(0, 0, 0); L.knee.rotation.set(0, 0, 0); L.foot.rotation.set(0, 0, 0); }
}
// arm angles: shoulder pitch (forward +), roll (outward), elbow bend
export function setArm(a, pitch, roll, elbow, twist = 0) {
  a.sh.rotation.set(-pitch, twist, a.s * roll);
  a.elbow.rotation.set(-elbow, 0, 0);
}
