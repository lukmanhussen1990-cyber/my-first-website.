// Secondary 3D props: giant typing bubbles, the chihuahua, Grandma's door-slam diorama, sparkles/hearts, slow-mo sweat.
import * as THREE from 'three';
import { facet, mat, mesh, loft, limbGeo, blob, box, canvasTex } from './geo.js';
import { drawAvatar, heart as heart2d } from './ui.js';
import { clamp, lerp, sat, prog, ease, pop, impulse, TAU, hash1, mulberry32, spring } from './util.js';

function rrShape(w, h, r) { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0); s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2); s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5); return s; }

export function avatarTex(who, o = {}) { return canvasTex(256, 256, (c) => { c.clearRect(0, 0, 256, 256); drawAvatar(c, who, 128, 128, 124, o); }); }

// ---------------------------------------------------------------- typing bubble
export function makeTypingBubble({ color, dot, who, label, labelColor = '#ffffff', emissive = 0.35 }) {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color, roughness: 0.45, emissive: color, emissiveIntensity: emissive, flatShading: true });
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(rrShape(1.0, 0.5, 0.25), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 5 }).translate(0, 0, -0.05), bodyM); body.castShadow = true; g.add(body);
  const tail = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.38, -0.2), new THREE.Vector2(-0.6, -0.36), new THREE.Vector2(-0.2, -0.24)]), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }).translate(0, 0, -0.05), bodyM); g.add(tail);
  const dotM = new THREE.MeshStandardMaterial({ color: dot, roughness: 0.4, flatShading: true, emissive: dot, emissiveIntensity: 0.25 });
  const dots = [-1, 0, 1].map((i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 1), dotM); m.position.set(i * 0.26, 0, 0.1); m.castShadow = true; g.add(m); return m; });
  // avatar coin
  const coin = new THREE.Group(); coin.position.set(-0.72, -0.34, 0.06); g.add(coin);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), new THREE.MeshBasicMaterial({ map: avatarTex(who), color: new THREE.Color(1.05, 1.05, 1.05) })); face.position.z = 0.026; coin.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); rim.rotation.x = Math.PI / 2; coin.add(rim);
  // label
  const lt = canvasTex(1024, 160, (c) => { c.clearRect(0, 0, 1024, 160); c.font = '900 92px Nunito'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 22; c.strokeStyle = 'rgba(10,12,24,0.9)'; c.strokeText(label, 20, 84); c.fillStyle = labelColor; c.fillText(label, 20, 84); });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1 * 160 / 1024), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, color: new THREE.Color(1.1, 1.1, 1.1) })); lab.position.set(0.12, -0.42, 0.07); lab.renderOrder = 5; g.add(lab);
  g.userData = { dots, body, bodyM, dotM, coin, lab };
  g.update = (t, t0, speed = 5) => { dots.forEach((d, i) => { const b = Math.max(0, Math.sin((t - t0) * speed - i * 0.85)); d.position.y = b * 0.11 - 0.02; const s = 1 + b * 0.12; d.scale.set(s * (1 - b * 0.06), s * (1 + b * 0.1), s); }); };
  return g;
}

// ---------------------------------------------------------------- chihuahua
export function makeChihuahua() {
  const g = new THREE.Group(); const fur = mat(0xdca466, { roughness: 0.85 }), furL = mat(0xf3d9b0, { roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.15 });
  const body = new THREE.Group(); g.add(body);
  mesh(blob(1, 1, (v, n) => v.set(n.x * 0.058 * (1 + 0.12 * n.z), n.y * 0.055 + 0.01 * n.z, n.z * 0.105), { seed: 3, jitter: 0.08 }), fur, { parent: body, pos: [0, 0.115, 0], rot: [-0.32, 0, 0] });
  mesh(blob(1, 1, (v, n) => v.set(n.x * 0.045, n.y * 0.05, n.z * 0.04), { seed: 4 }), furL, { parent: body, pos: [0, 0.12, 0.085] });
  const legG = limbGeo(0.013, 0.009, 5, { seed: 5 });
  const legs = [[-0.035, 0.07], [0.035, 0.07], [-0.04, -0.07], [0.04, -0.07]].map(([x, z], i) => { const l = mesh(legG, fur, { parent: g, pos: [x, 0.105 - (i > 1 ? 0.03 : 0), z], rot: [Math.PI + (i > 1 ? -0.5 : 0.1), 0, 0], scale: [1, i > 1 ? 0.075 : 0.105, 1] }); return l; });
  [[-0.035, 0.085], [0.035, 0.085], [-0.045, -0.035], [0.045, -0.035]].forEach(([x, z], i) => mesh(blob(0.017, 0, null, { seed: 6 + i }), furL, { parent: g, pos: [x, 0.012, z], scale: [1, 0.7, 1.4] }));
  mesh(blob(1, 1, (v, n) => v.set(n.x * 0.04, n.y * 0.035, n.z * 0.05), { seed: 8 }), fur, { parent: g, pos: [0, 0.05, -0.065] });   // haunches (sitting)
  const tail = mesh(facet(new THREE.ConeGeometry(0.012, 0.1, 4).translate(0, 0.05, 0), 0.06, 9), fur, { parent: body, pos: [0, 0.09, -0.1], rot: [-0.7, 0, 0] });
  const head = new THREE.Group(); head.position.set(0, 0.2, 0.085); g.add(head);
  mesh(blob(1, 1, (v, n) => v.set(n.x * 0.062, n.y * 0.056 * (n.y > 0 ? 1.1 : 0.9), n.z * 0.058), { seed: 10, jitter: 0.07 }), fur, { parent: head });
  mesh(blob(1, 1, (v, n) => v.set(n.x * 0.028, n.y * 0.022, n.z * 0.034), { seed: 11 }), furL, { parent: head, pos: [0, -0.02, 0.055] });
  mesh(blob(0.011, 0, null, { seed: 12 }), dark, { parent: head, pos: [0, -0.012, 0.09] });
  const ears = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.042, 0.04, -0.01); head.add(p); mesh(facet(new THREE.ConeGeometry(0.034, 0.1, 4).translate(0, 0.05, 0), 0.07, 13), fur, { parent: p, rot: [0.05, s * 0.4, s * -0.5] }); mesh(facet(new THREE.ConeGeometry(0.02, 0.07, 4).translate(0, 0.04, 0), 0.04, 14), mat(0xf2a7a0), { parent: p, pos: [s * 0.003, 0.004, 0.012], rot: [0.05, s * 0.4, s * -0.5] }); return p; });
  const eyes = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.034, 0.012, 0.045); head.add(p); const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.021, 2), dark); p.add(e); const gl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.006, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.5, 2.5) })); gl.position.set(-0.006, 0.009, 0.016); p.add(gl); const gl2 = gl.clone(); gl2.scale.setScalar(0.5); gl2.position.set(0.007, -0.005, 0.018); p.add(gl2); return p; });
  mesh(facet(new THREE.TorusGeometry(0.04, 0.008, 4, 10), 0.05, 15), mat(0xe5397d, { roughness: 0.5 }), { parent: g, pos: [0, 0.158, 0.07], rot: [1.15, 0, 0] });
  mesh(blob(0.012, 0, null, { seed: 16 }), mat(0xffd24a, { roughness: 0.3, metalness: 0.6 }), { parent: g, pos: [0, 0.135, 0.108] });
  g.update = (t, amt = 1) => {
    const a = Math.sin(TAU * 15 * t), b = Math.sin(TAU * 12.4 * t + 1), c2 = Math.sin(TAU * 19 * t + 2);
    body.position.set(a * 0.0035 * amt, Math.abs(b) * 0.002 * amt, 0); body.rotation.z = a * 0.03 * amt;
    head.position.set(a * 0.004 * amt, 0.2 + b * 0.0025 * amt, 0.085); head.rotation.set(-0.1 + c2 * 0.015 * amt, b * 0.04 * amt, a * 0.05 * amt);
    ears.forEach((e, i) => { e.rotation.z = Math.sin(TAU * 15 * (t - 0.02) + i) * 0.14 * amt; e.rotation.x = c2 * 0.06 * amt; });
    eyes.forEach((e, i) => { e.position.x = (i ? 1 : -1) * 0.034 + c2 * 0.0012 * amt; const s = 1 + 0.05 * b * amt; e.scale.setScalar(s); });
    tail.rotation.z = Math.sin(TAU * 15 * (t - 0.03)) * 0.25 * amt; legs.forEach((l, i) => { l.rotation.z = Math.sin(TAU * 15 * t + i * 1.7) * 0.05 * amt; });
  };
  return g;
}

// ---------------------------------------------------------------- Grandma leaves (door slam diorama)
export function makeDiorama() {
  const g = new THREE.Group();
  const wallT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#b9a4e6'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#b19bdf' : '#c3b0ec'; c.fillRect(i * 64, 0, 64, h); } c.fillStyle = 'rgba(255,255,255,0.12)'; const r = mulberry32(3); for (let i = 0; i < 60; i++) heart2d(c, r() * w, r() * h, 16 + r() * 10, 'rgba(255,255,255,0.0)'); }, { repeat: [3, 2] });
  const wallM = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.95 });
  const DW = 0.72, DH = 1.5;
  // wall with doorway hole (4 panels)
  const panel = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), wallM); m.position.set(x, y, -0.04); m.receiveShadow = true; m.castShadow = true; g.add(m); };
  panel(3, 3.2, -1.5 - DW / 2, 1.6); panel(3, 3.2, 1.5 + DW / 2, 1.6); panel(DW, 3.2 - DH, 0, DH + (3.2 - DH) / 2);
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(DW + 0.4, DH + 0.2), new THREE.MeshBasicMaterial({ color: 0x06081a })); dark.position.set(0, DH / 2, -0.7); g.add(dark);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshStandardMaterial({ color: 0x8a6fc7, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.position.z = 0.9; floor.receiveShadow = true; g.add(floor);
  const frM = mat(0xfaf5ee, { roughness: 0.6 });
  mesh(box(0.09, DH + 0.09, 0.13), frM, { pos: [-DW / 2 - 0.045, (DH + 0.09) / 2, 0.0], parent: g }); mesh(box(0.09, DH + 0.09, 0.13), frM, { pos: [DW / 2 + 0.045, (DH + 0.09) / 2, 0.0], parent: g }); mesh(box(DW + 0.18, 0.09, 0.13), frM, { pos: [0, DH + 0.045, 0.0], parent: g });
  mesh(box(7, 0.12, 0.03), frM, { pos: [-3.5 - DW / 2 - 0.09, 0.06, 0.015], parent: g }); mesh(box(7, 0.12, 0.03), frM, { pos: [3.5 + DW / 2 + 0.09, 0.06, 0.015], parent: g });
  // door hinged on the right edge, opening toward camera
  const hinge = new THREE.Group(); hinge.position.set(DW / 2, 0, 0.02); g.add(hinge);
  const doorM = mat(0xd9603f, { roughness: 0.55 });
  const door = mesh(box(DW, DH, 0.05, { sx: 2, sy: 3 }), doorM, { pos: [-DW / 2, DH / 2, 0], parent: hinge });
  mesh(box(DW * 0.62, DH * 0.34, 0.012), mat(0xc4502f), { pos: [-DW / 2, DH * 0.72, 0.03], parent: hinge }); mesh(box(DW * 0.62, DH * 0.34, 0.012), mat(0xc4502f), { pos: [-DW / 2, DH * 0.28, 0.03], parent: hinge });
  mesh(blob(0.04, 1, null, { seed: 2 }), mat(0xffd24a, { roughness: 0.25, metalness: 0.7 }), { pos: [-DW + 0.09, DH * 0.5, 0.05], parent: hinge });
  // "FAMILY" sign above the door
  const signP = new THREE.Group(); signP.position.set(-0.3, DH + 0.48, 0.03); g.add(signP);
  const signT = canvasTex(512, 180, (c, w, h) => { c.fillStyle = '#fff7e8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5a371c'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14); c.font = '900 92px Nunito'; c.fillStyle = '#1d2433'; c.textBaseline = 'middle'; c.fillText('FAMILY', 44, 96); heart2d(c, 432, 92, 86); });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.03), [frM, frM, frM, frM, new THREE.MeshStandardMaterial({ map: signT, roughness: 0.7 }), frM]); sign.position.set(0.3, -0.14, 0); sign.castShadow = true; signP.add(sign);
  // grandma: avatar coin with legs + handbag
  const gm = new THREE.Group(); g.add(gm);
  const coin = new THREE.Group(); gm.add(coin);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.235, 40), new THREE.MeshBasicMaterial({ map: avatarTex('grandma', { shock: 0, crack: 1 }) })); face.position.z = 0.032; coin.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.castShadow = true; coin.add(rim);
  const legM = mat(0xe8c7a8), shoeM = mat(0x6a3fa0);
  const legsG = [-1, 1].map((s) => ({ s, leg: mesh(limbGeo(0.022, 0.018, 5, { seed: 3 }), legM, { parent: gm }), shoe: mesh(blob(1, 1, (v, n) => v.set(n.x * 0.04, Math.max(n.y, -0.3) * 0.035, n.z * 0.07 + 0.02), { seed: 4 }), shoeM, { parent: gm }) }));
  const bag = new THREE.Group(); gm.add(bag); mesh(box(0.14, 0.11, 0.05), mat(0xc0392b, { roughness: 0.5 }), { parent: bag, pos: [0, -0.16, 0] }); mesh(facet(new THREE.TorusGeometry(0.045, 0.008, 4, 8, Math.PI), 0.04, 5), mat(0x7a1f17), { parent: bag, pos: [0, -0.105, 0] });
  // huff puffs + dust
  const puffM = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 1, flatShading: true, transparent: true, opacity: 0.95 });
  const puffG = new THREE.IcosahedronGeometry(1, 1);
  const puffs = []; const rnd = mulberry32(12);
  for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(puffG, puffM); m.castShadow = false; g.add(m); const side = i % 3; puffs.push({ m, a: rnd() * TAU, sp: 0.5 + rnd() * 1.1, s: 0.05 + rnd() * 0.07, side, u: rnd(), dl: rnd() * 0.05 }); }
  const light = new THREE.SpotLight(0xffe2c0, 60, 12, 0.7, 0.6, 1.5); light.position.set(-1.6, 3.0, 3.2); light.target.position.set(0, 0.8, 0); light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.0008; light.shadow.normalBias = 0.01; light.shadow.radius = 4; light.shadow.camera.near = 1; light.shadow.camera.far = 9; g.add(light, light.target);
  const fillL = new THREE.PointLight(0x9fb4ff, 6, 8, 1.4); fillL.position.set(1.6, 1.6, 2.2); g.add(fillL);
  g.userData = { light, fillL };

  // t0: start of the cartoon, slam: door hits the frame
  g.update = (t, t0, slam) => {
    const walkEnd = slam - 0.1; const u = prog(t, t0 - 0.2, walkEnd);
    // path: from front-left, into the doorway and out
    const x = lerp(-0.62, 0, ease.out(Math.min(u * 1.5, 1))); const z = lerp(0.62, -0.5, ease.in(sat((u - 0.35) / 0.65)));
    const steps = (t - t0) * 9; const hop = Math.abs(Math.sin(steps * Math.PI)) * 0.045;
    gm.position.set(x, 0, z); gm.visible = t < slam + 0.02;
    coin.position.set(0, 0.42 + hop, 0); coin.rotation.z = Math.sin(steps * Math.PI) * 0.12; coin.rotation.y = lerp(0.25, -0.1, u);
    legsG.forEach((l) => { const ph = Math.sin(steps * Math.PI + (l.s > 0 ? 0 : Math.PI)); const hip = new THREE.Vector3(l.s * 0.07, 0.42 + hop - 0.2, 0); const foot = new THREE.Vector3(l.s * 0.075, 0.03 + Math.max(0, ph) * 0.07, ph * 0.08); const m = l.leg; m.position.copy(hip); const d = foot.clone().sub(hip); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); l.shoe.position.copy(foot); l.shoe.rotation.x = -Math.max(0, ph) * 0.5; });
    bag.position.set(0.27, 0.5 + hop, 0.02); bag.rotation.z = Math.sin(steps * Math.PI - 0.6) * 0.5;
    // door: open 105deg -> slam shut with tiny rebound
    const open = 1.85; let ang;
    if (t < slam - 0.13) ang = open + Math.sin((t - t0) * 3) * 0.03; else if (t < slam) ang = open * (1 - ease.in(prog(t, slam - 0.13, slam))); else ang = Math.max(0, Math.sin((t - slam) * 38) * 0.05 * Math.exp(-(t - slam) * 14));
    hinge.rotation.y = -ang;
    const sh = impulse(t, slam, 0.01, 0.12);
    // sign swings loose on one nail after the slam
    signP.rotation.z = t < slam ? 0 : -0.5 * (1 - Math.exp(-(t - slam) * 9) * Math.cos((t - slam) * 22)) * 0.62;
    // dust puffs from the door frame
    puffs.forEach((p) => {
      const k = (t - slam - p.dl) / 0.75; if (k <= 0 || k >= 1) { p.m.visible = false; return; } p.m.visible = true;
      let bx, by; if (p.side === 0) { bx = -DW / 2 - 0.02; by = p.u * DH; } else if (p.side === 1) { bx = (p.u - 0.5) * DW; by = DH + 0.02; } else { bx = (p.u - 0.5) * DW; by = 0.03; }
      const e = ease.out(k); const dx = (p.side === 0 ? -1 : Math.cos(p.a) * 0.6) * p.sp * 0.42 * e, dy = (p.side === 1 ? 0.5 : p.side === 2 ? 0.25 : Math.sin(p.a) * 0.3) * p.sp * 0.4 * e;
      p.m.position.set(bx + dx, by + dy, 0.12 + e * 0.35 * p.sp); const s = p.s * (0.5 + e * 1.5) * (1 - k * k * 0.9); p.m.scale.setScalar(Math.max(s, 0.001)); p.m.rotation.set(k * 2 + p.a, k * 3, p.a);
    });
    return sh;
  };
  return g;
}

// ---------------------------------------------------------------- sparkles + hearts (soft romantic moment)
export function makeSparkles(n = 18) {
  const g = new THREE.Group();
  const star = new THREE.Shape(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.28 : 1; const a = i / 8 * TAU; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starG = new THREE.ShapeGeometry(star);
  const hs = new THREE.Shape(); hs.moveTo(0, -0.75); hs.bezierCurveTo(-1.25, 0.05, -1.0, 1.0, -0.48, 1.0); hs.bezierCurveTo(-0.2, 1.0, 0, 0.8, 0, 0.56); hs.bezierCurveTo(0, 0.8, 0.2, 1.0, 0.48, 1.0); hs.bezierCurveTo(1.0, 1.0, 1.25, 0.05, 0, -0.75);
  const heartG = new THREE.ExtrudeGeometry(hs, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 1, curveSegments: 4 }).translate(0, 0, -0.15);
  const rnd = mulberry32(55); const items = [];
  for (let i = 0; i < n; i++) {
    const isHeart = i % 3 === 0;
    const m = isHeart ? new THREE.Mesh(heartG, new THREE.MeshStandardMaterial({ color: 0xff4f7a, emissive: 0xff2d60, emissiveIntensity: 0.9, roughness: 0.4, flatShading: true }))
      : new THREE.Mesh(starG, new THREE.MeshBasicMaterial({ color: i % 2 ? new THREE.Color(3.0, 2.3, 0.8) : new THREE.Color(3.0, 1.5, 2.2), side: THREE.DoubleSide }));
    m.castShadow = false; g.add(m);
    items.push({ m, isHeart, ang: rnd() * TAU, rad: 0.24 + rnd() * 0.2, y: -0.12 + rnd() * 0.42, dl: rnd() * 0.55, life: 0.8 + rnd() * 0.6, s: (isHeart ? 0.022 : 0.03) * (0.7 + rnd() * 0.8), spin: (rnd() - 0.5) * 3 });
  }
  g.update = (t, t0, center, camQ) => {
    items.forEach((it) => { const u = (t - t0 - it.dl) / it.life; if (u <= 0 || u >= 1) { it.m.visible = false; return; } it.m.visible = true;
      const a = it.ang + u * 0.5; it.m.position.set(center.x + (Math.cos(it.ang) > 0 ? 1 : -1) * (0.2 + (it.rad - 0.24) * 0.9) + Math.cos(a) * 0.02, center.y + it.y * 1.25 - 0.08 + u * 0.14, center.z + 0.1 + Math.sin(a) * 0.1);
      it.m.quaternion.copy(camQ); it.m.rotateZ(it.spin * u + (it.isHeart ? Math.sin(u * 6) * 0.2 : 0)); const s = it.s * Math.sin(Math.min(u * 1.6, 1) * Math.PI * 0.5) * (1 - Math.pow(u, 3)) * (1 + 0.3 * Math.sin(u * 30 + it.ang)); it.m.scale.setScalar(Math.max(s, 1e-4)); });
  };
  return g;
}

// ---------------------------------------------------------------- buzz arcs (phone vibrating)
export function makeBuzz() {
  const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3.2), side: THREE.DoubleSide });
  const arcs = []; for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const a = new THREE.Mesh(new THREE.RingGeometry(0.07 + i * 0.03, 0.078 + i * 0.03, 12, 1, -0.5, 1.0), m); a.rotation.z = s > 0 ? 0 : Math.PI; g.add(a); arcs.push({ a, i }); }
  g.update = (t) => { arcs.forEach(({ a, i }) => { const k = (t * 5 + i * 0.5) % 1; const s = 0.8 + k * 0.5; a.scale.setScalar(s); a.visible = k < 0.75; }); };
  return g;
}
