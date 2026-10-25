// John's moon house and the props around it: the room (pod), airlock, oxygen
// tanks, furniture, entrance hut with dust brushes, light-pipe window, the
// protective dust mound, flag, shovel and phone.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { panelTexture, rugTexture, flagTexture, phoneScreenTexture, noSignalTexture } from './textures.js';
import { mulberry32 } from './util.js';

const INVIS = new THREE.MeshBasicMaterial({ visible: false });
function rbox(w, h, d, r, mat) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(r1, r2, h, mat, seg = 24, open = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg, 1, open), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function roundRectShape(w, h, r, x0 = -w / 2, y0 = 0) {
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
function plankTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d'); const r = mulberry32(8);
  for (let i = 0; i < 8; i++) {
    const v = 0.85 + r() * 0.15;
    g.fillStyle = `rgb(${Math.round(196 * v)},${Math.round(146 * v)},${Math.round(98 * v)})`;
    g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = 'rgba(90,55,30,0.5)'; g.fillRect(0, i * 64, 512, 3);
    for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(120,80,45,${0.12 + r() * 0.12})`; g.beginPath(); const y = i * 64 + 8 + r() * 48; g.moveTo(0, y); g.bezierCurveTo(170, y + (r() - 0.5) * 10, 340, y + (r() - 0.5) * 10, 512, y); g.stroke(); }
    g.fillStyle = 'rgba(90,55,30,0.45)'; g.fillRect(((i * 197) % 400) + 50, i * 64, 3, 64);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function bristleTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d'); g.clearRect(0, 0, 256, 128);
  const r = mulberry32(4);
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${40 + r() * 30},${40 + r() * 30},${50 + r() * 30},1)`; g.lineWidth = 2 + r() * 2; const x = r() * 256; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 8, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function chevronTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#ffc531'; g.fillRect(0, 0, 128, 512);
  g.fillStyle = '#2a2a30';
  for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(128, i * 64 + 64); g.lineTo(128, i * 64 + 96); g.lineTo(0, i * 64 + 32); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const POD = { w: 4.6, h: 2.6, d: 3.8, wall: 0.14, r: 0.75, cx: 0.8 };

export function createHouse(scene) {
  const M = {
    ext: new THREE.MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.42, metalness: 0.05 }),
    inner: new THREE.MeshStandardMaterial({ map: panelTexture(), color: 0xd8ccbb, roughness: 0.8, side: THREE.BackSide }),
    innerBack: new THREE.MeshStandardMaterial({ map: panelTexture(), color: 0xd8ccbb, roughness: 0.8 }),
    cut: new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.7 }),
    insul: new THREE.MeshStandardMaterial({ color: 0xffb547, roughness: 0.8 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.45 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb4bcc8, roughness: 0.3, metalness: 0.85 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x4b525e, roughness: 0.4, metalness: 0.6 }),
    floor: new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.6 }),
    lightStrip: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0d8, emissiveIntensity: 0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.25, depthWrite: false, clearcoat: 1 }),
    tank: new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.3, metalness: 0.2 }),
    tankBand: new THREE.MeshStandardMaterial({ color: 0x31c97b, roughness: 0.4 }),
    ledR: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff3344, emissiveIntensity: 3 }),
    ledG: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x33ff88, emissiveIntensity: 3 }),
    chevron: new THREE.MeshStandardMaterial({ map: chevronTexture(), roughness: 0.5 }),
    fabricBlue: new THREE.MeshStandardMaterial({ color: 0x4f7fd6, roughness: 0.85 }),
    fabricWhite: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 }),
    cushion: new THREE.MeshStandardMaterial({ color: 0xff9a4a, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xc08a58, roughness: 0.6 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.6 }),
    pot: new THREE.MeshStandardMaterial({ color: 0xd9734a, roughness: 0.7 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc977, emissiveIntensity: 0 }),
    rug: new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }),
  };

  // ---------------- the room (pod) ----------------
  const pod = new THREE.Group(); scene.add(pod);
  const { w, h, d, wall, r } = POD;
  const outerS = roundRectShape(w, h, r);
  const innerS = roundRectShape(w - 2 * wall, h - 2 * wall, r - wall, -w / 2 + wall, wall);
  const extrude = (shape, depth) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 }); g.translate(0, 0, -depth); return g; };
  const outerMesh = new THREE.Mesh(extrude(outerS, d), [INVIS, M.ext]); outerMesh.castShadow = true; outerMesh.receiveShadow = true; pod.add(outerMesh);
  const innerMesh = new THREE.Mesh(extrude(innerS, d - wall), [INVIS, M.inner]); innerMesh.receiveShadow = true; pod.add(innerMesh);
  const backWall = new THREE.Mesh(new THREE.ShapeGeometry(innerS, 16), M.innerBack); backWall.position.z = -(d - wall); backWall.receiveShadow = true; pod.add(backWall);
  const ringS = roundRectShape(w, h, r); ringS.holes.push(innerS);
  const ring = new THREE.Mesh(new THREE.ShapeGeometry(ringS, 16), M.cut); ring.position.z = 0.002; pod.add(ring);
  const insS = roundRectShape(w - wall * 0.9, h - wall * 0.9, r - wall * 0.45, -w / 2 + wall * 0.45, wall * 0.45);
  insS.holes.push(roundRectShape(w - wall * 1.3, h - wall * 1.3, r - wall * 0.65, -w / 2 + wall * 0.65, wall * 0.65));
  const insul = new THREE.Mesh(new THREE.ShapeGeometry(insS, 16), M.insul); insul.position.z = 0.004; pod.add(insul);
  // exterior stripe + roof details
  const stripe = new THREE.Mesh(extrude(roundRectShape(w + 0.02, 0.12, 0.05, -w / 2 - 0.01, 1.2), d - 0.4), M.orange);
  stripe.position.z = -0.2; stripe.visible = false; pod.add(stripe);
  for (let k = 0; k < 3; k++) { const v = rbox(0.5, 0.12, 0.35, 0.04, M.metal); v.position.set(-1.2 + k * 1.2, h + 0.03, -1.9); pod.add(v); }
  // floor deck
  const floor = rbox(w - 2 * wall - 0.04, 0.16, d - wall - 0.02, 0.02, M.floor);
  floor.material.map.repeat.set(1.5, 1.2);
  floor.position.set(0, wall + 0.25, -(d - wall) / 2); pod.add(floor);
  const FLOOR_Y = wall + 0.33; // top of the floor deck in pod space
  // ceiling light strips
  for (const x of [-1.1, 1.1]) { const l = rbox(1.2, 0.04, 0.16, 0.02, M.lightStrip); l.position.set(x, h - wall - 0.06, -1.6); l.castShadow = false; pod.add(l); }
  const lights = [new THREE.PointLight(0xffd7a8, 0, 7, 1.6), new THREE.PointLight(0xffd7a8, 0, 7, 1.6)];
  lights[0].position.set(-1.1, h - 0.6, -0.9); lights[1].position.set(1.2, h - 0.6, -0.9);
  lights.forEach((l) => pod.add(l));

  // ---------------- airlock (attached to the right end) ----------------
  const airlock = new THREE.Group(); pod.add(airlock);
  const AW = 1.5, AH = 2.25, AD = 2.6;
  airlock.position.set(w / 2 - 0.05, 0, 0);
  const aOut = roundRectShape(AW, AH, 0.35, 0, 0);
  const aIn = roundRectShape(AW - 2 * wall, AH - 2 * wall, 0.22, wall, wall);
  const aOuterMesh = new THREE.Mesh(extrude(aOut, AD), [INVIS, M.ext]); aOuterMesh.castShadow = true; airlock.add(aOuterMesh);
  const aInnerMesh = new THREE.Mesh(extrude(aIn, AD - wall), [INVIS, M.inner]); airlock.add(aInnerMesh);
  const aBack = new THREE.Mesh(new THREE.ShapeGeometry(aIn, 8), M.innerBack); aBack.position.z = -(AD - wall); airlock.add(aBack);
  const aRingS = roundRectShape(AW, AH, 0.35, 0, 0); aRingS.holes.push(aIn);
  const aRing = new THREE.Mesh(new THREE.ShapeGeometry(aRingS, 8), M.cut); aRing.position.z = 0.003; airlock.add(aRing);
  const aFloor = rbox(AW - 2 * wall, 0.16, AD - wall, 0.02, M.darkMetal); aFloor.position.set(AW / 2, FLOOR_Y - 0.08, -(AD - wall) / 2); airlock.add(aFloor);
  // two sliding bulkhead doors (seen in cross-section): inner at x=0.12, outer at x=AW-0.12
  const mkDoor = (x) => {
    const g = new THREE.Group(); g.position.set(x, 0, 0); airlock.add(g);
    const slab = rbox(0.14, AH - 2 * wall - 0.33, AD - wall - 0.1, 0.03, M.ext); slab.position.set(0, FLOOR_Y + (AH - 2 * wall - 0.33) / 2, -(AD - wall) / 2); g.add(slab);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.14, AH - 2 * wall - 0.35), M.chevron); face.position.set(0, FLOOR_Y + (AH - 2 * wall - 0.33) / 2, 0.006); g.add(face);
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), M.glass); win.rotation.y = Math.PI / 2; win.position.set(0.075, FLOOR_Y + 1.15, -1.2); g.add(win);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), M.ledR.clone()); led.position.set(0, AH - 0.05, 0.03); g.add(led);
    return { g, slab, face, led };
  };
  const doors = [mkDoor(0.12), mkDoor(AW - 0.12)];
  // ladder going up through the airlock ceiling (to the shaft and the entrance hut)
  const ladder = new THREE.Group(); ladder.position.set(0.45, 0, -AD + 0.35); airlock.add(ladder);
  for (const s of [-1, 1]) { const rail = cyl(0.025, 0.025, 2.4, M.metal, 8); rail.position.set(0.2 * s, FLOOR_Y + 1.2, 0); ladder.add(rail); }
  for (let k = 0; k < 6; k++) { const rung = cyl(0.018, 0.018, 0.4, M.metal, 8); rung.rotation.z = Math.PI / 2; rung.position.set(0, FLOOR_Y + 0.3 + k * 0.35, 0); ladder.add(rung); }

  // ---------------- oxygen tanks ----------------
  const tanks = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group(); g.position.set(-1.75 + k * 0.42, FLOOR_Y, -d + 0.55 + (k % 2) * 0.12); pod.add(g);
    const body = cyl(0.17, 0.17, 1.0, M.tank, 32); body.position.y = 0.55; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.tank); top.position.y = 1.05; top.castShadow = true; g.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.tank); bot.position.y = 0.05; g.add(bot);
    const band = cyl(0.175, 0.175, 0.16, M.tankBand, 32); band.position.y = 0.7; g.add(band);
    const valve = cyl(0.04, 0.05, 0.12, M.metal, 12); valve.position.y = 1.26; g.add(valve);
    const knob = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16), M.orange); knob.rotation.x = Math.PI / 2; knob.position.y = 1.32; g.add(knob);
    g.visible = false;
    tanks.push(g);
  }
  const vent = rbox(0.5, 0.25, 0.08, 0.04, M.metal); vent.position.set(-0.6, h - 0.75, -d + wall + 0.06); vent.visible = false; pod.add(vent);

  // ---------------- furniture (finished house) ----------------
  const furn = [];
  const addF = (obj, order) => { obj.visible = false; pod.add(obj); furn.push({ obj, order, base: obj.position.clone() }); return obj; };
  // bed (left)
  const bed = new THREE.Group(); bed.position.set(-1.45, FLOOR_Y, -2.3);
  { const frame = rbox(1.1, 0.32, 2.0, 0.06, M.wood); frame.position.y = 0.16; bed.add(frame);
    const matt = rbox(1.0, 0.18, 1.9, 0.08, M.fabricWhite); matt.position.y = 0.4; bed.add(matt);
    const blanket = rbox(1.04, 0.1, 1.2, 0.05, M.fabricBlue); blanket.position.set(0, 0.48, 0.35); bed.add(blanket);
    const pillow = rbox(0.7, 0.14, 0.38, 0.07, M.fabricWhite); pillow.position.set(0, 0.55, -0.7); bed.add(pillow); }
  addF(bed, 0);
  // rug
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.95, 48), M.rug); rug.rotation.x = -Math.PI / 2; rug.position.set(0.7, FLOOR_Y + 0.006, -1.8); rug.scale.set(1.25, 1, 1); rug.receiveShadow = true; addF(rug, 1);
  // round table + lamp
  const table = new THREE.Group(); table.position.set(1.25, FLOOR_Y, -2.35);
  { const topT = cyl(0.42, 0.42, 0.06, M.wood, 40); topT.position.y = 0.66; table.add(topT);
    const leg = cyl(0.05, 0.07, 0.64, M.metal, 16); leg.position.y = 0.32; table.add(leg);
    const foot = cyl(0.24, 0.26, 0.04, M.metal, 24); foot.position.y = 0.02; table.add(foot);
    const lampBase = cyl(0.06, 0.08, 0.05, M.metal, 16); lampBase.position.set(-0.15, 0.72, -0.08); table.add(lampBase);
    const lampStem = cyl(0.012, 0.012, 0.25, M.metal, 8); lampStem.position.set(-0.15, 0.85, -0.08); table.add(lampStem);
    const shade = cyl(0.07, 0.13, 0.13, M.lamp, 24); shade.position.set(-0.15, 1.0, -0.08); table.add(shade);
    const mug = cyl(0.045, 0.04, 0.09, M.orange, 16); mug.position.set(0.18, 0.74, 0.08); table.add(mug); }
  addF(table, 2);
  // reclining chair (John relaxes here)
  const chair = new THREE.Group(); chair.position.set(0.35, FLOOR_Y, -1.55); chair.rotation.y = -0.45;
  { const seat = rbox(0.62, 0.16, 0.6, 0.07, M.cushion); seat.position.set(0, 0.36, 0); chair.add(seat);
    const back = rbox(0.62, 0.7, 0.16, 0.07, M.cushion); back.position.set(0, 0.68, -0.34); back.rotation.x = -0.55; chair.add(back);
    for (const s of [-1, 1]) { const arm = rbox(0.1, 0.12, 0.55, 0.04, M.wood); arm.position.set(0.34 * s, 0.52, -0.02); chair.add(arm); }
    const base = rbox(0.5, 0.26, 0.5, 0.05, M.darkMetal); base.position.y = 0.14; chair.add(base); }
  addF(chair, 1.5);
  // plant
  const plant = new THREE.Group(); plant.position.set(2.0, FLOOR_Y, -3.1);
  { const p = cyl(0.16, 0.12, 0.28, M.pot, 24); p.position.y = 0.14; plant.add(p);
    const rr = mulberry32(12);
    for (let k = 0; k < 9; k++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), M.leaf); lf.scale.set(0.45, 1.3, 0.2); const a = (k / 9) * Math.PI * 2; lf.position.set(Math.cos(a) * 0.09, 0.42 + rr() * 0.12, Math.sin(a) * 0.09); lf.rotation.set(Math.sin(a) * 0.6, -a, Math.cos(a) * 0.6); lf.castShadow = true; plant.add(lf); } }
  addF(plant, 3);
  // shelf on the back wall with a little Earth photo
  const shelf = new THREE.Group(); shelf.position.set(0.3, FLOOR_Y + 1.25, -d + wall + 0.13);
  { const b = rbox(1.0, 0.05, 0.22, 0.02, M.wood); shelf.add(b);
    const book = (x, hh, c) => { const m = rbox(0.06, hh, 0.17, 0.01, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); m.position.set(x, hh / 2 + 0.025, 0); shelf.add(m); };
    book(-0.4, 0.2, 0x4f7fd6); book(-0.33, 0.24, 0xff9a4a); book(-0.26, 0.18, 0x31c97b);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), M.fabricBlue); globe.position.set(0.3, 0.14, 0); shelf.add(globe); }
  addF(shelf, 2.5);

  // ---------------- light pipe + round window (set in world coords) ----------------
  const tubeG = new THREE.Group(); scene.add(tubeG);
  const clipZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0); // keep z <= 0
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x5d6675, roughness: 0.35, metalness: 0.7, emissive: 0x2a4f8f, emissiveIntensity: 0.0, side: THREE.BackSide, clippingPlanes: [clipZ] });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1, 40, 1, true), tubeMat); tube.receiveShadow = true; tubeG.add(tube);
  const ribs = [];
  for (let k = 1; k < 8; k++) { const rb = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.025, 8, 40), new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.3, metalness: 0.8, clippingPlanes: [clipZ] })); rb.userData.k = k / 8; tubeG.add(rb); ribs.push(rb); }
  const winRing = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.06, 12, 40), new THREE.MeshStandardMaterial({ color: 0xb4bcc8, roughness: 0.3, metalness: 0.85, clippingPlanes: [clipZ] })); tubeG.add(winRing);
  const winGlass = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, emissive: 0x4f8fff, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: [clipZ] })); tubeG.add(winGlass);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.7, 1.2), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.75, 1, 32, 1, true), beamMat); tubeG.add(beam);
  const domeG = new THREE.Group(); scene.add(domeG);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.glass); domeG.add(dome);
  const domeRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 12, 40), M.metal); domeRing.rotation.x = Math.PI / 2; domeG.add(domeRing);
  tubeG.visible = domeG.visible = false;
  function setTube(a, b, show) {
    // a: window centre (bottom, at the ceiling), b: top end at the surface (THREE.Vector3)
    tubeG.visible = domeG.visible = show > 0;
    if (!show) return;
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length(); dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tube.position.copy(a).addScaledVector(dir, len / 2); tube.quaternion.copy(q); tube.scale.set(1, len * show, 1);
    tube.position.copy(a).addScaledVector(dir, (len * show) / 2);
    winRing.position.copy(a); winRing.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    winGlass.position.copy(a).addScaledVector(dir, 0.02); winGlass.quaternion.copy(winRing.quaternion);
    beam.position.copy(a).addScaledVector(dir, -0.6); beam.quaternion.copy(q); beam.scale.set(1, 1.3, 1);
    const ringQ = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    for (const rb of ribs) { rb.position.copy(a).addScaledVector(dir, len * show * rb.userData.k); rb.quaternion.copy(ringQ); rb.visible = rb.userData.k < show; }
    domeG.position.copy(b); domeG.scale.setScalar(Math.max(0.001, Math.min(1, show)));
  }

  // ---------------- entrance hut with door + dust brushes ----------------
  const hut = new THREE.Group(); scene.add(hut);
  { const shell = rbox(1.25, 2.25, 1.2, 0.28, M.ext); shell.position.y = 1.12; hut.add(shell);
    const roof = rbox(1.35, 0.14, 1.3, 0.06, M.orange); roof.position.y = 2.2; hut.add(roof);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), M.ledG); light.position.set(0, 2.32, 0.4); hut.add(light); }
  const doorFrame = rbox(0.86, 1.78, 0.12, 0.05, M.darkMetal); doorFrame.position.set(0, 0.95, 0.6); hut.add(doorFrame);
  const doorPanel = rbox(0.66, 1.62, 0.06, 0.04, M.metal); doorPanel.position.set(0, 0.9, 0.66); hut.add(doorPanel);
  const doorWin = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshStandardMaterial({ color: 0x0c1a2c, emissive: 0x3a7bd5, emissiveIntensity: 0.6 })); doorWin.position.set(0, 1.35, 0.695); doorPanel.add(doorWin); doorWin.position.set(0, 0.45, 0.035);
  const bristle = bristleTexture(); bristle.repeat.set(6, 1);
  const brushMat = new THREE.MeshStandardMaterial({ map: bristle, alphaTest: 0.5, transparent: false, roughness: 0.9, side: THREE.DoubleSide });
  const brushes = [];
  for (const s of [-1, 1]) {
    const core = cyl(0.04, 0.04, 1.55, M.orange, 12); core.position.set(0.5 * s, 0.92, 0.72); hut.add(core);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 24, 1, true), brushMat); br.position.copy(core.position); hut.add(br);
    // radial bristle fins for a fuzzy silhouette
    for (let k = 0; k < 10; k++) { const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 1.5), brushMat); fin.rotation.y = (k / 10) * Math.PI; br.add(fin); }
    brushes.push(br);
  }
  const floorBrush = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 20, 1, true), brushMat); floorBrush.rotation.z = Math.PI / 2; floorBrush.position.set(0, 0.08, 0.8); hut.add(floorBrush);
  for (let k = 0; k < 8; k++) { const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.9), brushMat); fin.rotation.y = (k / 8) * Math.PI; floorBrush.add(fin); }
  brushes.push(floorBrush);
  hut.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  hut.visible = false;

  // ---------------- flag (simple star, no country) ----------------
  const flag = new THREE.Group(); scene.add(flag);
  const pole = cyl(0.02, 0.02, 1.7, M.metal, 12); pole.position.y = 0.85; flag.add(pole);
  const rod = cyl(0.012, 0.012, 0.8, M.metal, 8); rod.rotation.z = Math.PI / 2; rod.position.set(0.4, 1.66, 0); flag.add(rod);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), M.metal); knob.position.y = 1.72; flag.add(knob);
  const clothGeo = new THREE.PlaneGeometry(0.78, 0.52, 24, 12); clothGeo.translate(0.39, -0.26, 0);
  const clothBase = clothGeo.attributes.position.array.slice();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: 0.75, side: THREE.DoubleSide }));
  cloth.position.set(0.01, 1.65, 0); cloth.castShadow = true; flag.add(cloth);
  flag.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  function setFlag(unfurl, t) {
    const p = clothGeo.attributes.position;
    const k = Math.max(0.02, unfurl);
    for (let i = 0; i < p.count; i++) {
      const x = clothBase[i * 3], y = clothBase[i * 3 + 1];
      const ripple = Math.sin(x * 9 - 1.0) * 0.025 * (x / 0.78) + Math.sin(y * 7 + x * 3) * 0.008;
      p.setXYZ(i, x * k, y, ripple * (0.6 + 0.4 * Math.min(1, k)));
    }
    p.needsUpdate = true; clothGeo.computeVertexNormals();
    rod.scale.set(1, Math.max(0.02, Math.min(1, k)), 1); rod.position.x = 0.4 * Math.min(1, k);
  }

  // ---------------- shovel ----------------
  const shovel = new THREE.Group();
  { const handle = cyl(0.018, 0.018, 0.95, M.metal, 10); handle.position.y = 0.0; shovel.add(handle);
    const grip = cyl(0.028, 0.028, 0.18, M.orange, 10); grip.rotation.z = Math.PI / 2; grip.position.y = 0.48; shovel.add(grip);
    const sleeve = cyl(0.026, 0.022, 0.2, M.orange, 10); sleeve.position.y = 0.2; shovel.add(sleeve);
    const bladeGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.26, 20, 1, true, -Math.PI * 0.45, Math.PI * 0.9);
    const blade = new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0xc9d0da, roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide }));
    blade.position.set(0, -0.58, -0.1); blade.castShadow = true; shovel.add(blade);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 10, -Math.PI * 0.45, Math.PI * 0.9, Math.PI / 2, Math.PI / 2), blade.material); tip.position.set(0, -0.71, -0.1); shovel.add(tip); }
  const shovelLoad = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), new THREE.MeshStandardMaterial({ color: 0x8c8c8f, roughness: 1 }));
  shovelLoad.scale.set(1, 0.55, 0.8); shovelLoad.position.set(0, -0.58, 0.0); shovel.add(shovelLoad);
  shovel.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ---------------- phone ----------------
  const phone = new THREE.Group();
  { const b = rbox(0.085, 0.16, 0.014, 0.012, M.darkMetal); phone.add(b);
    var phoneScreen = phoneScreenTexture(), noSignalScreen = noSignalTexture();
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.145), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: phoneScreen, emissiveIntensity: 1.6 }));
    scr.position.z = 0.0075; phone.add(scr); phone.userData.screen = scr; }

  return { beam, phoneScreen, noSignalScreen, tubeMat, pod, M, FLOOR_Y, airlock, doors, tanks, vent, furn, lights, setTube, tubeG, domeG, hut, doorPanel, brushes, flag, setFlag, shovel, shovelLoad, phone, AW, AH, AD, ladder, stripe };
}

// The protective layer of moon dust piled over the room (cut open at z = 0).
export function createMound(scene, regMat, faceMat) {
  const x0 = -2.4, x1 = 4.2, zb = -5.0;
  const prof = (x) => { const u = (x - x0) / (x1 - x0); return u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 0.85); };
  const back = (z) => { const u = -z / -zb; return u < 0.7 ? 1 : Math.cos(((u - 0.7) / 0.3) * Math.PI / 2); };
  const nx = 80, nz = 50;
  const g = new THREE.PlaneGeometry(x1 - x0, -zb, nx, nz); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, zb / 2);
  const base = g.attributes.position.array.slice();
  const top = new THREE.Mesh(g, regMat); top.castShadow = true; top.receiveShadow = true; scene.add(top);
  // front cross-section (fresh, fine dust with soft piling bands)
  const pts = []; for (let i = 0; i <= nx; i++) { const x = x0 + (i / nx) * (x1 - x0); pts.push(new THREE.Vector2(x, 0)); }
  const capGeo = new THREE.BufferGeometry();
  const capMat = faceMat;
  const cap = new THREE.Mesh(capGeo, capMat); cap.receiveShadow = true; scene.add(cap);
  function set(height) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      p.setY(i, height * prof(x) * back(z) - 0.03 + 0.03 * prof(x));
    }
    p.needsUpdate = true; g.computeVertexNormals();
    top.visible = cap.visible = height > 0.01;
    const pos = [], idx = [], uv = [];
    for (let i = 0; i <= nx; i++) {
      const x = x0 + (i / nx) * (x1 - x0), hgt = height * prof(x);
      pos.push(x, -0.02, 0, x, hgt, 0); uv.push(0, 0, 0, 0);
    }
    for (let i = 0; i < nx; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    capGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    capGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    capGeo.setIndex(idx); capGeo.computeVertexNormals();
  }
  set(0);
  return { set, prof, x0, x1 };
}
