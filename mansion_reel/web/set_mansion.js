// The mansion: exterior (shots 5-10, 41), the very long gold hallway (13-16, 42-43), the big bathroom with the
// 30-button golden toilet (17-32, 38-40) and your own little bathroom (44).
import * as THREE from 'three';
import { mat, tex, clamp, lerp, rng, hash1 } from './lib.js';
import { MANSION, HALL, BATH, THRONE, YOUR_DOOR, MYBATH, MYTHRONE } from './layout.js';
import { plasterCanvas, marbleCanvas, goldCanvas, goldPanelCanvas, carpetCanvas, portraitCanvas, lawnCanvas, leafyCanvas, doorCanvas, signCanvas, stoneCanvas, poolCanvas, windowCanvas, glowDiscCanvas } from './set_tex2.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function named(m, n) { m.name = `set.mansion.${n}`; return m; }
function msh(geo, material, n, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; return named(m, n); }
function boxAt(g, w, h, d, material, x, y, z, n, o = {}) { const m = msh(new THREE.BoxGeometry(w, h, d), material, n, o); m.position.set(x, y, z); g.add(m); return m; }
function plane(g, w, h, material, pos, rot, n, o = { cast: false }) { const m = msh(new THREE.PlaneGeometry(w, h), material, n, o); m.position.set(...pos); m.rotation.set(...rot); g.add(m); return m; }
function cylAt(g, rt, rb, h, seg, material, x, y, z, n) { const m = msh(new THREE.CylinderGeometry(rt, rb, h, seg), material, n); m.position.set(x, y, z); g.add(m); return m; }

export function buildMansion(env) {
  const root = new THREE.Group(); root.name = 'set.mansion';
  const ext = new THREE.Group(); ext.name = 'set.mansion.ext'; root.add(ext);
  const inn = new THREE.Group(); inn.name = 'set.mansion.inside'; root.add(inn);
  const T = (c, r = [1, 1]) => tex(c, { repeat: r });
  const gold = (o = {}) => { const m = mat(T(goldCanvas(o), o.repeat || [1, 1]), { rough: o.rough ?? 0.3, metal: o.metal ?? 0.85 }); m.envMap = env; m.envMapIntensity = o.env ?? 1.25; return m; };
  const GOLD = gold(), GOLD_DARK = gold({ base: '#b88a2a', seed: 15 }), GOLD_SHINY = gold({ base: '#ffd060', rough: 0.2, seed: 17 });
  const marble = (o = {}) => { const m = mat(T(marbleCanvas(o), o.repeat || [1, 1]), { rough: o.rough ?? 0.25, metal: 0.0 }); m.envMap = env; m.envMapIntensity = 0.35; return m; };
  const FY = MANSION.floorY, Z0 = MANSION.z;

  // ================================================================ EXTERIOR
  const W = MANSION.width, Hh = MANSION.height, D = 34;
  const wallM = mat(T(plasterCanvas('#efe6d4', 3, 10), [W / 3, Hh / 3]), { rough: 0.85 });
  const dw = MANSION.door.w, dh = MANSION.door.h;
  // front wall with a hole for the door: left, right, top pieces
  const sideW = (W - dw) / 2;
  boxAt(ext, sideW, Hh, 0.6, wallM, -(dw / 2 + sideW / 2), Hh / 2, Z0 + 0.3, 'frontL');
  boxAt(ext, sideW, Hh, 0.6, wallM, dw / 2 + sideW / 2, Hh / 2, Z0 + 0.3, 'frontR');
  boxAt(ext, dw, Hh - FY - dh, 0.6, wallM, 0, FY + dh + (Hh - FY - dh) / 2, Z0 + 0.3, 'frontTop');
  boxAt(ext, dw, FY, 0.6, wallM, 0, FY / 2, Z0 + 0.3, 'frontSill');
  // body behind (sides + roof only matter from outside)
  const noFace = new THREE.MeshBasicMaterial({ visible: false });
  boxAt(ext, W, Hh, D - 0.6, [wallM, wallM, wallM, wallM, wallM, noFace], 0, Hh / 2, Z0 + 0.6 + (D - 0.6) / 2, 'body');   // no front face (the hall is behind the door)
  // roof: low hip roof + gold-trimmed balustrade cornice
  const roofM = mat(T(stoneCanvas('#5a4a44', 31), [10, 4]), { rough: 0.8 });
  const roof = msh(new THREE.CylinderGeometry(W * 0.36, W * 0.72, 4.5, 4, 1), roofM, 'roof'); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, D / W * 1.4); roof.position.set(0, Hh + 2.2, Z0 + D / 2); ext.add(roof);
  boxAt(ext, W + 0.8, 0.6, 1.2, GOLD_DARK, 0, Hh + 0.1, Z0 - 0.1, 'cornice');
  boxAt(ext, W + 0.6, 0.3, 0.8, GOLD, 0, 7.0, Z0 - 0.05, 'beltGold');
  for (let x = -W / 2 + 1; x <= W / 2 - 1; x += 0.9) boxAt(ext, 0.22, 0.75, 0.22, mat('#f4eee2'), x, Hh + 0.75, Z0 - 0.15, 'baluster');
  boxAt(ext, W + 0.6, 0.18, 0.5, mat('#f4eee2'), 0, Hh + 1.2, Z0 - 0.15, 'balustradeRail');
  // windows: two rows, warm light inside, gold frames
  const winM = mat(T(windowCanvas({ seed: 5, inside: '#8a5a2a', mullion: true })), { rough: 0.15, emissive: '#ffbe6a', emissiveIntensity: 0.55 });
  const winLit = [];
  for (const row of [{ y: FY + 3.0, h: 3.6 }, { y: 10.8, h: 3.4 }]) {
    for (let x = -W / 2 + 3.2; x <= W / 2 - 3.2; x += 3.6) {
      if (Math.abs(x) < 9.2) continue;
      const w = plane(ext, 1.8, row.h, winM.clone(), [x, row.y, Z0 - 0.02], [0, Math.PI, 0], 'window');
      winLit.push(w);
      boxAt(ext, 2.2, 0.25, 0.35, GOLD, x, row.y - row.h / 2 - 0.1, Z0 - 0.15, 'windowSill');
      boxAt(ext, 2.3, 0.35, 0.3, GOLD_DARK, x, row.y + row.h / 2 + 0.2, Z0 - 0.12, 'windowHead');
    }
  }
  // porch + steps (marble), portico columns + pediment
  const pm = marble({ base: '#f1ece2', repeat: [6, 2], seed: 3 });
  boxAt(ext, 18, FY, MANSION.porch.z1 - 98, pm, 0, FY / 2, (98 + MANSION.porch.z1) / 2, 'porch', { cast: false });
  const nS = MANSION.porch.steps, sd = (98 - MANSION.porch.z0) / nS;
  for (let i = 0; i < nS; i++) boxAt(ext, 14 + (nS - i) * 0.4, FY * (i + 1) / nS, sd, pm, 0, FY * (i + 1) / nS / 2, MANSION.porch.z0 + sd * (i + 0.5), 'step');
  const colM = mat(T(plasterCanvas('#f7f2e8', 9, 8), [2, 6]), { rough: 0.7 });
  for (const x of [-7.6, -5.2, -2.9, 2.9, 5.2, 7.6]) {
    const c = msh(new THREE.CylinderGeometry(0.42, 0.48, 12, 12), colM, 'column'); c.position.set(x, FY + 6, 98.6); ext.add(c);
    boxAt(ext, 1.25, 0.45, 1.25, GOLD, x, FY + 12.2, 98.6, 'capital');
    boxAt(ext, 1.2, 0.35, 1.2, GOLD_DARK, x, FY + 0.18, 98.6, 'columnBase');
  }
  boxAt(ext, 18.2, 0.9, 2.6, colM, 0, FY + 12.85, 98.9, 'entablature');
  boxAt(ext, 18.4, 0.25, 2.7, GOLD, 0, FY + 13.4, 98.9, 'entabGold');
  const ped = new THREE.Shape(); ped.moveTo(-9.2, 0); ped.lineTo(9.2, 0); ped.lineTo(0, 3.4); ped.lineTo(-9.2, 0);
  const pg = new THREE.ExtrudeGeometry(ped, { depth: 2.4, bevelEnabled: false }); const pedM = msh(pg, colM, 'pediment'); pedM.position.set(0, FY + 13.5, 97.7); ext.add(pedM);
  const crest = msh(new THREE.TorusGeometry(0.8, 0.16, 6, 14), GOLD_SHINY, 'crest'); crest.position.set(0, FY + 14.8, 97.6); ext.add(crest);
  // the giant golden double door (leaves hinge at the outer edges, open inward to +Z)
  const doorPanel = mat(T(goldPanelCanvas(5), [1, 3]), { rough: 0.28, metal: 0.85 }); doorPanel.envMap = env; doorPanel.envMapIntensity = 1.3;
  const leaves = [-1, 1].map((sd2) => {
    const piv = new THREE.Group(); piv.name = `set.mansion.doorPivot${sd2}`; piv.position.set(sd2 * dw / 2, FY, Z0 + 0.12); root.add(piv);   // seen from outside AND inside
    const leaf = msh(new THREE.BoxGeometry(dw / 2, dh, 0.22), doorPanel, 'doorLeaf'); leaf.position.set(-sd2 * dw / 4, dh / 2, 0); piv.add(leaf);
    const ring = msh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), GOLD_SHINY, 'knockerRing'); ring.position.set(-sd2 * (dw / 2 - 0.45), 3.6, -0.17); piv.add(ring);
    const lion = msh(new THREE.IcosahedronGeometry(0.2, 1), GOLD_SHINY, 'knockerLion'); lion.scale.set(1, 1.1, 0.5); lion.position.set(-sd2 * (dw / 2 - 0.45), 3.9, -0.15); piv.add(lion);
    const knob = msh(new THREE.SphereGeometry(0.06, 8, 6), GOLD_DARK, 'doorKnob'); knob.position.set(-sd2 * (dw / 2 - 0.2), 1.15, -0.14); piv.add(knob);
    piv.userData.sd = sd2; return piv;
  });
  boxAt(ext, dw + 0.8, 0.5, 0.5, GOLD_DARK, 0, FY + dh + 0.25, Z0 - 0.05, 'doorHead');
  for (const s2 of [-1, 1]) boxAt(ext, 0.4, dh, 0.5, GOLD_DARK, s2 * (dw / 2 + 0.2), FY + dh / 2, Z0 - 0.05, 'doorJamb');
  // golden urns on pedestals beside the steps
  for (const s2 of [-1, 1]) {
    boxAt(ext, 1.0, 1.4, 1.0, pm, s2 * 8.6, 0.7, 95.6, 'urnPedestal');
    const urn = msh(new THREE.LatheGeometry([V(0, 0), V(0.35, 0.05), V(0.5, 0.4), V(0.35, 0.8), V(0.42, 1.0), V(0, 1.0)].map((p) => new THREE.Vector2(p.x, p.y)), 10), GOLD, 'urn'); urn.position.set(s2 * 8.6, 1.4, 95.6); ext.add(urn);
    const shrub = msh(new THREE.IcosahedronGeometry(0.55, 1), mat(T(leafyCanvas('#3f7a32', 52)), { rough: 0.9 }), 'urnShrub'); shrub.position.set(s2 * 8.6, 2.65, 95.6); ext.add(shrub);
  }
  // grounds: lawn, driveway circle, fountain, hedges, palms
  const lawn = plane(ext, 220, 160, mat(T(lawnCanvas(), [40, 30]), { rough: 0.95 }), [0, 0, 40], [-Math.PI / 2, 0, 0], 'lawn');
  lawn.receiveShadow = true;
  const gravelM = mat(T(stoneCanvas('#d8cdb4', 61), [12, 12]), { rough: 0.95 });
  const drive = msh(new THREE.RingGeometry(MANSION.drive.r - 4, MANSION.drive.r, 40), gravelM, 'drive', { cast: false }); drive.rotation.x = -Math.PI / 2; drive.position.set(MANSION.fountain[0], 0.01, MANSION.fountain[1]); ext.add(drive);
  plane(ext, 7, 20, gravelM, [0, 0.012, 88], [-Math.PI / 2, 0, 0], 'driveToDoor');
  plane(ext, 7, 60, gravelM, [0, 0.012, 32], [-Math.PI / 2, 0, 0], 'driveOut');
  const fx = MANSION.fountain[0], fz = MANSION.fountain[1];
  const basin = msh(new THREE.CylinderGeometry(4.2, 4.4, 0.8, 24), pm, 'fountainBasin'); basin.position.set(fx, 0.4, fz); ext.add(basin);
  const water = msh(new THREE.CylinderGeometry(3.9, 3.9, 0.05, 24), mat(T(poolCanvas(), [3, 3]), { rough: 0.1, emissive: '#2a6a8a', emissiveIntensity: 0.25 }), 'fountainWater', { cast: false }); water.position.set(fx, 0.72, fz); ext.add(water);
  cylAt(ext, 0.5, 0.7, 2.6, 10, pm, fx, 1.9, fz, 'fountainStem');
  cylAt(ext, 1.8, 1.4, 0.35, 16, GOLD, fx, 3.2, fz, 'fountainBowl');
  const statue = msh(new THREE.SphereGeometry(0.7, 12, 8), GOLD_SHINY, 'fountainGlobe'); statue.position.set(fx, 4.1, fz); ext.add(statue);
  const globeRing = msh(new THREE.TorusGeometry(0.95, 0.06, 6, 24), GOLD, 'fountainRing'); globeRing.position.set(fx, 4.1, fz); globeRing.rotation.set(1.1, 0.3, 0.4); ext.add(globeRing);
  const hedgeM = mat(T(leafyCanvas('#356a2c', 53), [6, 1]), { rough: 0.9 });
  for (const s2 of [-1, 1]) {
    boxAt(ext, 16, 1.3, 1.4, hedgeM, s2 * 17.5, 0.65, 97.5, 'hedge');
    for (let i = 0; i < 4; i++) { const b = msh(new THREE.IcosahedronGeometry(0.85, 1), hedgeM, 'topiary'); b.position.set(s2 * (11 + i * 4.2), 2.0, 97.4); ext.add(b); }
  }
  const trunkM = mat(T(stoneCanvas('#8a6a48', 71), [1, 6]), { rough: 0.9 });
  const frondM = mat(T(leafyCanvas('#4f8a36', 73)), { rough: 0.85, side: THREE.DoubleSide });
  const palms = [];
  for (const [px, pz] of [[-9, 84], [9, 84], [-9, 66], [9, 66], [-14, 54], [14, 54], [-22, 90], [22, 90]]) {
    const pg2 = new THREE.Group(); pg2.position.set(px, 0, pz); ext.add(pg2);
    const h = 9 + hash1(px * 3 + pz) * 3;
    for (let i = 0; i < 6; i++) { const seg = msh(new THREE.CylinderGeometry(0.26 - i * 0.02, 0.3 - i * 0.02, h / 6, 7), trunkM, 'palmTrunk'); seg.position.set(Math.sin(i * 0.3) * 0.15 * i, h / 12 + i * h / 6, 0); pg2.add(seg); }
    for (let k = 0; k < 8; k++) {
      const fr = msh(new THREE.PlaneGeometry(0.9, 4.2, 1, 4), frondM, 'palmFrond', { cast: true });
      const pp = fr.geometry.attributes.position; for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); pp.setZ(i, -0.18 * (y + 2.1) ** 2 * 0.25); } fr.geometry.computeVertexNormals();
      fr.geometry.translate(0, 2.1, 0);
      fr.position.set(0.9, h, 0); fr.rotation.set(1.1, (k / 8) * Math.PI * 2, 0, 'YXZ'); pg2.add(fr);
    }
    palms.push(pg2);
  }

  // ================================================================ HALLWAY (inside)
  const L = HALL.z1 - HALL.z0, zc = (HALL.z0 + HALL.z1) / 2, hw = HALL.x1 - HALL.x0, H2 = HALL.ceilY - HALL.floorY;
  const floorM = marble({ base: '#efe7d6', vein: '#b0a080', repeat: [hw / 1.3, L / 1.3], grout: true, goldGrout: true, seed: 11 });
  plane(inn, hw, L, floorM, [0, FY, zc], [-Math.PI / 2, 0, 0], 'hallFloor', { cast: false, receive: true });
  const carpet = plane(inn, 1.9, L - 1, mat(T(carpetCanvas(), [1, (L - 1) / 3]), { rough: 0.95 }), [0, FY + 0.006, zc + 0.5], [-Math.PI / 2, 0, 0], 'carpet', { cast: false, receive: true });
  const upperM = mat(T(plasterCanvas('#8a2030', 25, 12), [L / 3, 1]), { rough: 0.85 });
  const panelM = mat(T(goldPanelCanvas(), [L / 1.2, 1]), { rough: 0.32, metal: 0.8 }); panelM.envMap = env; panelM.envMapIntensity = 1.1;
  // the walls are built in z-segments; the right wall (+X) has the opening for your door
  const ydz0 = YOUR_DOOR.z - YOUR_DOOR.w / 2 - 0.02, ydz1 = YOUR_DOOR.z + YOUR_DOOR.w / 2 + 0.02, ydh = YOUR_DOOR.h + 0.02;
  for (const s2 of [-1, 1]) {
    const x = s2 * (hw / 2);
    const segs = s2 > 0 ? [[HALL.z0, ydz0], [ydz1, HALL.z1]] : [[HALL.z0, HALL.z1]];
    const wallMat = (m0, len) => { const mm = m0.clone(); mm.map = m0.map.clone(); mm.map.needsUpdate = true; mm.map.repeat.set(m0.map.repeat.x * len / L, m0.map.repeat.y); return mm; };
    for (const [za, zb] of segs) {
      const len = zb - za, zm = (za + zb) / 2;
      plane(inn, len, 1.25, wallMat(panelM, len), [x - s2 * 0.001, FY + 0.625, zm], [0, -s2 * Math.PI / 2, 0], 'wainscot', { cast: false, receive: true });
      plane(inn, len, H2 - 1.25, wallMat(upperM, len), [x, FY + 1.25 + (H2 - 1.25) / 2, zm], [0, -s2 * Math.PI / 2, 0], 'hallWall', { cast: false, receive: true });
      boxAt(inn, 0.12, 0.12, len, GOLD, x - s2 * 0.06, FY + 1.28, zm, 'chairRail', { cast: false });
    }
    if (s2 > 0) plane(inn, ydz1 - ydz0, H2 - ydh, upperM, [x, FY + ydh + (H2 - ydh) / 2, (ydz0 + ydz1) / 2], [0, -Math.PI / 2, 0], 'hallWallOverDoor', { cast: false, receive: true });
    boxAt(inn, 0.25, 0.3, L, GOLD_DARK, x - s2 * 0.12, HALL.ceilY - 0.15, zc, 'crown', { cast: false });
  }
  plane(inn, hw, L, mat(T(goldPanelCanvas(27), [2, L / 2.6]), { rough: 0.4, metal: 0.7 }), [0, HALL.ceilY, zc], [Math.PI / 2, 0, 0], 'hallCeiling', { cast: false, receive: false }).material.envMap = env;
  // bays: pilasters, portraits, busts, sconces, chandeliers (repeated along the hall)
  const bustM = GOLD_SHINY;
  const chand = [];
  const portraitsM = [0, 1, 2, 3].map((k) => mat(tex(portraitCanvas(k)), { rough: 0.6 }));
  const glowTex = tex(glowDiscCanvas(64), { nearest: false });
  for (let z = HALL.z0 + 2.0, i = 0; z < HALL.z1 - 1; z += HALL.bay, i++) {
    for (const s2 of [-1, 1]) {
      const x = s2 * (hw / 2);
      boxAt(inn, 0.22, H2, 0.5, GOLD, x - s2 * 0.1, FY + H2 / 2, z, 'pilaster', { cast: false });
      const mid = z + HALL.bay / 2;
      if (mid > HALL.z1 - 1) continue;
      if (s2 > 0 && Math.abs(mid - YOUR_DOOR.z) < 2.2) continue;   // your door is here
      if ((i + (s2 > 0 ? 1 : 0)) % 3 !== 2) {
        boxAt(inn, 0.1, 1.9, 1.5, GOLD_DARK, x - s2 * 0.05, FY + 2.75, mid, 'frame', { cast: false });
        plane(inn, 1.2, 1.6, portraitsM[(i + (s2 > 0 ? 2 : 0)) % 4], [x - s2 * 0.105, FY + 2.75, mid], [0, -s2 * Math.PI / 2, 0], 'portrait');
      } else {
        boxAt(inn, 0.6, 1.0, 0.6, marble({ base: '#f2ede4', seed: 33 }), x - s2 * 0.4, FY + 0.5, mid, 'bustPedestal');
        const bust = msh(new THREE.IcosahedronGeometry(0.25, 1), bustM, 'bustHead'); bust.scale.set(0.9, 1.15, 0.9); bust.position.set(x - s2 * 0.4, FY + 1.55, mid); inn.add(bust);
        boxAt(inn, 0.5, 0.3, 0.35, bustM, x - s2 * 0.4, FY + 1.15, mid, 'bustShoulders');
        boxAt(inn, 0.2, 0.04, 0.05, mat('#1e1612'), x - s2 * 0.62, FY + 1.5, mid, 'bustMoustache', { cast: false });
      }
      // sconce
      const sc = msh(new THREE.SphereGeometry(0.1, 8, 6), mat('#fff2d0', { emissive: '#ffd890', emissiveIntensity: 1.2 }), 'sconce', { cast: false }); sc.position.set(x - s2 * 0.25, FY + 3.9, z + 0.001); inn.add(sc);
    }
    if (i % 2 === 0) {        // chandelier every 2 bays
      const cg = new THREE.Group(); cg.position.set(0, HALL.ceilY - 1.2, z + HALL.bay / 2); inn.add(cg); cg.name = 'set.mansion.chandelier';
      const ring = msh(new THREE.TorusGeometry(0.55, 0.05, 6, 16), GOLD, 'chandRing', { cast: false }); ring.rotation.x = Math.PI / 2; cg.add(ring);
      const chain = msh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5), GOLD, 'chandChain', { cast: false }); chain.position.y = 0.6; cg.add(chain);
      const crysM = mat('#fffaf0', { emissive: '#ffe8b0', emissiveIntensity: 1.4, rough: 0.1 });
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const cr = msh(new THREE.OctahedronGeometry(0.06, 0), crysM, 'crystal', { cast: false }); cr.scale.set(1, 2, 1); cr.position.set(Math.cos(a) * 0.55, -0.12, Math.sin(a) * 0.55); cg.add(cr); }
      const core = msh(new THREE.OctahedronGeometry(0.16, 0), crysM, 'chandCore', { cast: false }); core.scale.set(1, 2.2, 1); core.position.y = -0.25; cg.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd090', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })); glow.scale.set(2.6, 2.6, 1); glow.position.y = -0.15; glow.name = 'set.mansion.chandGlow'; glow.userData.noAudit = true; cg.add(glow);
      chand.push(cg);
    }
  }
  // vases on the floor along the walls
  for (let z = HALL.z0 + 6; z < HALL.z1 - 3; z += 12) for (const s2 of [-1, 1]) {
    if (s2 > 0 && Math.abs(z - YOUR_DOOR.z) < 2.5) continue;
    const v = msh(new THREE.LatheGeometry([[0, 0], [0.18, 0.02], [0.28, 0.35], [0.16, 0.75], [0.2, 0.9], [0, 0.9]].map((p) => new THREE.Vector2(...p)), 10), GOLD, 'vase'); v.position.set(s2 * (hw / 2 - 0.35), FY, z); inn.add(v);
  }
  // entry wall (inside face around the front door) + end wall with the bathroom door
  const endM = mat(T(plasterCanvas('#8a2030', 26, 12), [2, 2]), { rough: 0.85 });
  for (const s2 of [-1, 1]) plane(inn, (hw - dw) / 2 + 0.01, H2, endM, [s2 * (dw / 2 + (hw - dw) / 4), FY + H2 / 2, HALL.z0], [0, 0, 0], 'entryWall');
  plane(inn, dw, H2 - dh, endM, [0, FY + dh + (H2 - dh) / 2, HALL.z0], [0, 0, 0], 'entryWallTop');
  const bd = BATH.door;
  for (const s2 of [-1, 1]) plane(inn, (hw - bd.w) / 2, H2, endM, [s2 * (bd.w / 2 + (hw - bd.w) / 4), FY + H2 / 2, HALL.z1], [0, Math.PI, 0], 'endWall');
  plane(inn, bd.w, H2 - bd.h, endM, [0, FY + bd.h + (H2 - bd.h) / 2, HALL.z1], [0, Math.PI, 0], 'endWallTop');
  for (const s2 of [-1, 1]) boxAt(inn, 0.2, bd.h + 0.2, 0.3, GOLD, s2 * (bd.w / 2 + 0.1), FY + bd.h / 2, HALL.z1 - 0.05, 'bathDoorJamb');
  boxAt(inn, bd.w + 0.6, 0.3, 0.32, GOLD, 0, FY + bd.h + 0.15, HALL.z1 - 0.05, 'bathDoorHead');
  // the bathroom door: one leaf hinged at x = -w/2, opens into the bathroom (+Z)
  const bathDoor = new THREE.Group(); bathDoor.name = 'set.mansion.bathDoorPivot'; bathDoor.position.set(-bd.w / 2, FY, HALL.z1 + 0.04); inn.add(bathDoor);
  const bdl = msh(new THREE.BoxGeometry(bd.w, bd.h, 0.08), mat(T(doorCanvas({ seed: 63 })), { rough: 0.5 }), 'bathDoorLeaf'); bdl.position.set(bd.w / 2, bd.h / 2, 0); bathDoor.add(bdl);
  const bdk = msh(new THREE.SphereGeometry(0.06, 8, 6), GOLD_SHINY, 'bathDoorKnob'); bdk.position.set(bd.w - 0.15, 1.05, -0.07); bathDoor.add(bdk);
  const bdk2 = bdk.clone(); bdk2.position.z = 0.07; bathDoor.add(bdk2);
  // your door (right wall, opens into your bathroom, +X) with the "YOU" plaque
  const yd = YOUR_DOOR;
  const yourDoor = new THREE.Group(); yourDoor.name = 'set.mansion.yourDoorPivot'; yourDoor.position.set(yd.x + 0.03, FY, yd.z - yd.w / 2); inn.add(yourDoor);
  const ydl = msh(new THREE.BoxGeometry(0.08, yd.h, yd.w), mat(T(doorCanvas({ seed: 64, base: '#f6f2ea' })), { rough: 0.5 }), 'yourDoorLeaf'); ydl.position.set(0, yd.h / 2, yd.w / 2); yourDoor.add(ydl);
  const ydk = msh(new THREE.SphereGeometry(0.055, 8, 6), GOLD_SHINY, 'yourDoorKnob'); ydk.position.set(-0.07, 1.05, yd.w - 0.14); yourDoor.add(ydk);
  const plaqueM = mat(tex(signCanvas(['YOU'], { w: 128, h: 64, bg: '#e8b440', color: '#3a2410', border: '#8a5a1a', borderW: 6, scale: 0.95 })), { rough: 0.25, metal: 0.6 }); plaqueM.envMap = env; plaqueM.envMapIntensity = 0.9;
  const plaque = msh(new THREE.BoxGeometry(0.02, 0.2, 0.42), [plaqueM, plaqueM, GOLD, GOLD, GOLD, GOLD], 'plaque', { cast: false });
  plaque.position.set(-0.055, 1.78, yd.w / 2); yourDoor.add(plaque);
  plaque.rotation.y = Math.PI;      // the canvas face (+X face -> after flip faces -X, into the hall)
  for (const s2 of [-1, 1]) boxAt(inn, 0.3, yd.h + 0.15, 0.16, GOLD, yd.x - 0.05, FY + yd.h / 2, yd.z + s2 * (yd.w / 2 + 0.08), 'yourDoorJamb');
  boxAt(inn, 0.3, 0.2, yd.w + 0.4, GOLD, yd.x - 0.05, FY + yd.h + 0.1, yd.z, 'yourDoorHead');

  // ================================================================ BIG BATHROOM
  const bw = BATH.x1 - BATH.x0, bl = BATH.z1 - BATH.z0, bzc = (BATH.z0 + BATH.z1) / 2, bH = BATH.ceilY - BATH.floorY;
  const bath = new THREE.Group(); bath.name = 'set.mansion.bath'; inn.add(bath);
  plane(bath, bw, bl, marble({ base: '#f4f0e8', vein: '#c0b098', repeat: [bw / 1.0, bl / 1.0], grout: true, goldGrout: true, seed: 41, goldVeins: true }), [0, FY, bzc], [-Math.PI / 2, 0, 0], 'bathFloor', { cast: false, receive: true });
  const bWallLow = marble({ base: '#efe9de', vein: '#b8a890', repeat: [6, 1], seed: 43 });
  const bWallUp = mat(T(plasterCanvas('#f3dfb0', 44, 8), [4, 2]), { rough: 0.8 });
  const walls = [
    { len: bw, pos: [0, 0, BATH.z1], ry: Math.PI, name: 'back' },
    { len: bl, pos: [BATH.x0, 0, bzc], ry: Math.PI / 2, name: 'left' },
    { len: bl, pos: [BATH.x1, 0, bzc], ry: -Math.PI / 2, name: 'right' },
  ];
  for (const w of walls) {
    plane(bath, w.len, 2.0, bWallLow, [w.pos[0], FY + 1.0, w.pos[2]], [0, w.ry, 0], `bathWallLow.${w.name}`, { cast: false, receive: true });
    plane(bath, w.len, bH - 2.0, bWallUp, [w.pos[0], FY + 2.0 + (bH - 2.0) / 2, w.pos[2]], [0, w.ry, 0], `bathWallUp.${w.name}`, { cast: false, receive: true });
  }
  // front wall (door side) seen from inside
  for (const s2 of [-1, 1]) {
    plane(bath, (bw - bd.w) / 2, 2.0, bWallLow, [s2 * (bd.w / 2 + (bw - bd.w) / 4), FY + 1.0, BATH.z0], [0, 0, 0], 'bathFrontLow', { cast: false, receive: true });
    plane(bath, (bw - bd.w) / 2, bH - 2.0, bWallUp, [s2 * (bd.w / 2 + (bw - bd.w) / 4), FY + 2.0 + (bH - 2.0) / 2, BATH.z0], [0, 0, 0], 'bathFrontUp', { cast: false, receive: true });
  }
  plane(bath, bd.w, bH - bd.h, bWallUp, [0, FY + bd.h + (bH - bd.h) / 2, BATH.z0], [0, 0, 0], 'bathFrontTop');
  boxAt(bath, bw, 0.12, 0.1, GOLD, 0, FY + 2.02, BATH.z1 - 0.05, 'bathTrimBack', { cast: false });
  for (const s2 of [-1, 1]) boxAt(bath, 0.1, 0.12, bl, GOLD, s2 * (bw / 2 - 0.05), FY + 2.02, bzc, 'bathTrimSide', { cast: false });
  const ceilM = mat(T(goldPanelCanvas(29), [4, 4]), { rough: 0.45, metal: 0.6 }); ceilM.envMap = env;
  plane(bath, bw, bl, ceilM, [0, BATH.ceilY, bzc], [Math.PI / 2, 0, 0], 'bathCeiling');
  // red velvet drapes behind the throne + gold crown emblem
  const velvetM = mat(T(plasterCanvas('#8e1424', 47, 16), [1, 1]), { rough: 0.9 });
  for (let k = 0; k < 9; k++) {
    const x = -3 + k * 0.75, fold = msh(new THREE.CylinderGeometry(0.4, 0.42, bH - 0.3, 6, 1, true, 0, Math.PI), velvetM, 'drape');
    fold.material = velvetM; fold.position.set(x, FY + (bH - 0.3) / 2, BATH.z1 - 0.3); fold.rotation.y = Math.PI / 2 + Math.PI / 2; bath.add(fold);
  }
  boxAt(bath, 7.2, 0.5, 0.4, GOLD, 0, BATH.ceilY - 0.4, BATH.z1 - 0.4, 'drapeValance');
  const crown = new THREE.Group(); crown.position.set(0, FY + 4.4, BATH.z1 - 0.62); bath.add(crown);
  boxAt(crown, 1.2, 0.35, 0.12, GOLD_SHINY, 0, 0, 0, 'crownBand');
  for (let k = -2; k <= 2; k++) { const sp = msh(new THREE.ConeGeometry(0.12, 0.42, 4), GOLD_SHINY, 'crownSpike'); sp.position.set(k * 0.26, 0.38, 0); crown.add(sp); }
  // round marble platform (2 steps) with gold edges
  const tp = THRONE.pos, PH = THRONE.platform;
  const platM = marble({ base: '#f6f2ea', vein: '#c2b29a', repeat: [2, 2], seed: 45, goldVeins: true });
  cylAt(bath, 1.9, 1.95, PH / 2, 32, platM, tp[0], FY + PH / 4, tp[1], 'platform1');
  cylAt(bath, 1.45, 1.5, PH / 2, 32, platM, tp[0], FY + PH * 3 / 4, tp[1], 'platform2');
  for (const [r, y] of [[1.96, FY + PH / 2], [1.51, FY + PH]]) { const e = msh(new THREE.TorusGeometry(r, 0.025, 4, 40), GOLD, 'platformEdge', { cast: false }); e.rotation.x = Math.PI / 2; e.position.set(tp[0], y - 0.01, tp[1]); bath.add(e); }
  // the golden toilet (faces -Z): base + bowl + tank + spinning seat group (seat ring + lid)
  const throne = makeToilet({ GOLD, GOLD_SHINY, GOLD_DARK, env, buttons: 30 });
  throne.group.position.set(tp[0], FY + PH, tp[1]); throne.group.rotation.y = THRONE.rotY; bath.add(throne.group);
  // bathtub (gold clawfoot) on the right, sinks + mirrors on the left, plants, towels
  const tub = msh(new THREE.CylinderGeometry(0.9, 0.75, 0.75, 16, 1, true), GOLD, 'tub'); tub.scale.set(1.0, 1, 1.9); tub.position.set(4.6, FY + 0.6, 187.5); bath.add(tub);
  const tubIn = msh(new THREE.CylinderGeometry(0.86, 0.72, 0.7, 16, 1, true), mat('#f6f4ee', { rough: 0.3, side: THREE.BackSide }), 'tubInside'); tubIn.scale.set(1, 1, 1.9); tubIn.position.set(4.6, FY + 0.62, 187.5); bath.add(tubIn);
  const foam = msh(new THREE.CircleGeometry(0.84, 16), mat('#ffffff', { rough: 0.9, emissive: '#ffffff', emissiveIntensity: 0.1 }), 'tubFoam', { cast: false }); foam.rotation.x = -Math.PI / 2; foam.scale.set(1, 1.9, 1); foam.position.set(4.6, FY + 0.88, 187.5); bath.add(foam);
  for (const [dx, dz] of [[-0.6, -1.3], [0.6, -1.3], [-0.6, 1.3], [0.6, 1.3]]) cylAt(bath, 0.08, 0.12, 0.25, 6, GOLD, 4.6 + dx, FY + 0.12, 187.5 + dz, 'tubFoot');
  for (const z of [186.0, 189.5]) {
    boxAt(bath, 0.7, 0.9, 1.3, marble({ base: '#ede6da', seed: 49 }), BATH.x0 + 0.4, FY + 0.45, z, 'vanity');
    const sink = msh(new THREE.CylinderGeometry(0.3, 0.2, 0.18, 12), GOLD, 'sink'); sink.position.set(BATH.x0 + 0.45, FY + 0.95, z); bath.add(sink);
    boxAt(bath, 0.08, 1.4, 1.0, GOLD_DARK, BATH.x0 + 0.04, FY + 2.6, z, 'mirrorFrame');
    const mir = plane(bath, 0.85, 1.25, mat('#c9d4dc', { rough: 0.05, metal: 0.9 }), [BATH.x0 + 0.085, FY + 2.6, z], [0, Math.PI / 2, 0], 'mirror'); mir.material.envMap = env; mir.material.envMapIntensity = 1.4;
  }
  for (const [px, pz] of [[-5.6, 194.2], [5.6, 194.2], [-5.6, 183.0], [5.6, 183.0]]) {
    cylAt(bath, 0.32, 0.24, 0.6, 10, GOLD, px, FY + 0.3, pz, 'plantPot');
    const pl = msh(new THREE.IcosahedronGeometry(0.6, 1), mat(T(leafyCanvas('#3e7a34', 55)), { rough: 0.9 }), 'plant'); pl.scale.set(1, 1.5, 1); pl.position.set(px, FY + 1.35, pz); bath.add(pl);
  }
  boxAt(bath, 1.6, 0.06, 0.06, GOLD, 3.2, FY + 1.6, BATH.z1 - 0.08, 'towelBar', { cast: false });
  const towelGoldM = mat(T(goldCanvas({ base: '#f0c850', amount: 18 })), { rough: 0.9 });
  boxAt(bath, 0.6, 0.9, 0.06, towelGoldM, 3.0, FY + 1.18, BATH.z1 - 0.12, 'towelHung');
  // chandelier (center) + disco ball hatch
  const bch = new THREE.Group(); bch.position.set(-2.6, BATH.ceilY - 1.0, 186.5); bath.add(bch);
  const bring = msh(new THREE.TorusGeometry(0.7, 0.05, 6, 18), GOLD, 'bathChandRing', { cast: false }); bring.rotation.x = Math.PI / 2; bch.add(bring);
  const crys2 = mat('#fffaf0', { emissive: '#ffe8b0', emissiveIntensity: 1.4 });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; const cr = msh(new THREE.OctahedronGeometry(0.07, 0), crys2, 'bathCrystal', { cast: false }); cr.scale.set(1, 2, 1); cr.position.set(Math.cos(a) * 0.7, -0.14, Math.sin(a) * 0.7); bch.add(cr); }
  const disco = new THREE.Group(); disco.name = 'set.mansion.disco'; bath.add(disco);
  const ballTex = tex(discoCanvas(), { repeat: [1, 1] });
  const ball = msh(new THREE.SphereGeometry(0.42, 16, 10), mat(ballTex, { rough: 0.15, metal: 0.9 }), 'discoBall', { cast: false }); ball.material.envMap = env; ball.material.envMapIntensity = 1.6; ball.material.flatShading = true; disco.add(ball);
  const dchain = msh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5), GOLD, 'discoChain', { cast: false }); dchain.geometry.translate(0, 0.5, 0); disco.add(dchain);
  disco.userData = { ball, chain: dchain };
  const hatch = boxAt(bath, 1.1, 0.04, 1.1, GOLD_DARK, THRONE.pos[0], BATH.ceilY - 0.02, 188.6, 'discoHatch', { cast: false });

  // ================================================================ YOUR BATHROOM
  const my = new THREE.Group(); my.name = 'set.mansion.mybath'; inn.add(my);
  const mw = MYBATH.x1 - MYBATH.x0, ml = MYBATH.z1 - MYBATH.z0, mxc = (MYBATH.x0 + MYBATH.x1) / 2, mzc = (MYBATH.z0 + MYBATH.z1) / 2, mH = MYBATH.ceilY - MYBATH.floorY;
  plane(my, mw, ml, marble({ base: '#f6efe2', vein: '#d0b890', repeat: [mw / 0.8, ml / 0.8], grout: true, goldGrout: true, seed: 51 }), [mxc, FY, mzc], [-Math.PI / 2, 0, 0], 'myFloor', { cast: false, receive: true });
  const myWallM = mat(T(plasterCanvas('#f6d6c8', 52, 8), [3, 2]), { rough: 0.8 });
  plane(my, ml, mH, myWallM, [MYBATH.x1, FY + mH / 2, mzc], [0, -Math.PI / 2, 0], 'myWallBack', { cast: false, receive: true });
  plane(my, mw, mH, myWallM, [mxc, FY + mH / 2, MYBATH.z0], [0, 0, 0], 'myWallL', { cast: false, receive: true });
  plane(my, mw, mH, myWallM, [mxc, FY + mH / 2, MYBATH.z1], [0, Math.PI, 0], 'myWallR', { cast: false, receive: true });
  for (const s2 of [-1, 1]) plane(my, (ml - yd.w) / 2, mH, myWallM, [MYBATH.x0 + 0.01, FY + mH / 2, yd.z + s2 * (yd.w / 2 + (ml - yd.w) / 4)], [0, Math.PI / 2, 0], 'myWallDoor', { cast: false, receive: true });
  plane(my, yd.w, mH - yd.h, myWallM, [MYBATH.x0 + 0.01, FY + yd.h + (mH - yd.h) / 2, yd.z], [0, Math.PI / 2, 0], 'myWallDoorTop', { cast: false });
  plane(my, mw, ml, mat(T(plasterCanvas('#fff4e6', 53, 6), [2, 2]), { rough: 0.85 }), [mxc, MYBATH.ceilY, mzc], [Math.PI / 2, 0, 0], 'myCeiling');
  const myThrone = makeToilet({ GOLD, GOLD_SHINY, GOLD_DARK, env, buttons: 1 });
  myThrone.group.position.set(MYTHRONE.pos[0], FY, MYTHRONE.pos[1]); myThrone.group.rotation.y = MYTHRONE.rotY; my.add(myThrone.group);
  const rug = msh(new THREE.CircleGeometry(0.75, 20), mat('#e85a7a', { rough: 0.95 }), 'myRug', { cast: false }); rug.rotation.x = -Math.PI / 2; rug.position.set(MYTHRONE.pos[0] - 1.1, FY + 0.006, MYTHRONE.pos[1]); my.add(rug);
  const duck = msh(new THREE.IcosahedronGeometry(0.07, 1), mat('#ffd21e', { rough: 0.4 }), 'duck'); duck.position.set(MYTHRONE.pos[0] + 0.3, FY + 0.93, MYTHRONE.pos[1] - 0.12); my.add(duck);
  const duckHead = msh(new THREE.IcosahedronGeometry(0.045, 1), duck.material, 'duckHead'); duckHead.position.set(MYTHRONE.pos[0] + 0.27, FY + 1.0, MYTHRONE.pos[1] - 0.12); my.add(duckHead);
  const heartMir = msh(heartGeo(0.5), mat('#d2dce4', { rough: 0.05, metal: 0.9 }), 'heartMirror', { cast: false }); heartMir.material.envMap = env; heartMir.position.set(MYBATH.x1 - 0.02, FY + 2.3, MYTHRONE.pos[1] - 1.9); heartMir.rotation.y = -Math.PI / 2; my.add(heartMir);
  const towelYouM = mat(tex(signCanvas(['YOU'], { w: 64, h: 96, bg: '#f4f0e6', color: '#c89a30', scale: 0.5 })), { rough: 0.9 });
  boxAt(my, 0.05, 0.85, 0.55, towelYouM, MYBATH.x1 - 0.06, FY + 1.3, MYTHRONE.pos[1] + 1.6, 'towelYou');
  const myLamp = msh(new THREE.SphereGeometry(0.25, 10, 6), mat('#fff6e0', { emissive: '#ffe0a0', emissiveIntensity: 1.3 }), 'myLamp', { cast: false }); myLamp.position.set(mxc, MYBATH.ceilY - 0.3, mzc); my.add(myLamp);

  return { group: root, ext, inn, bath, my, leaves, bathDoor, yourDoor, plaque, throne, myThrone, disco, hatch, chand, winLit, palms, carpet };
}

// ---------------------------------------------------------------- the golden toilet (+ button panel)
function makeToilet({ GOLD, GOLD_SHINY, GOLD_DARK, env, buttons }) {
  const g = new THREE.Group(); g.name = 'set.mansion.toilet';
  // local frame: faces +Z (the group is rotated to face the door), seat top at y = 0.47
  const base = msh(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 12), GOLD, 'toiletBase'); base.position.set(0, 0.15, -0.02); g.add(base);
  const bowlPts = [[0.0, 0.0], [0.2, 0.0], [0.26, 0.08], [0.25, 0.14]].map((p) => new THREE.Vector2(...p));
  const bowl = msh(new THREE.LatheGeometry(bowlPts, 16), GOLD, 'toiletBowl'); bowl.scale.set(1, 1, 1.28); bowl.position.set(0, 0.3, 0.05); g.add(bowl);
  const tank = msh(new THREE.BoxGeometry(0.5, 0.45, 0.2), GOLD, 'toiletTank'); tank.position.set(0, 0.68, -0.27); g.add(tank);
  const tankLid = msh(new THREE.BoxGeometry(0.54, 0.05, 0.24), GOLD_SHINY, 'toiletTankLid'); tankLid.position.set(0, 0.92, -0.27); g.add(tankLid);
  // seat group spins around the bowl axis (YOU sits on it)
  const seat = new THREE.Group(); seat.name = 'set.mansion.seat'; seat.position.set(0, 0.45, 0.05); g.add(seat);
  const ring = msh(new THREE.TorusGeometry(0.21, 0.045, 6, 18), GOLD_SHINY, 'toiletSeat'); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1.25, 0.7); seat.add(ring);
  const lid = msh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 16), GOLD, 'toiletLid'); lid.scale.set(1, 1, 1.22); lid.rotation.x = -1.35; lid.position.set(0, 0.27, -0.26); seat.add(lid);
  // throne armrests
  for (const sd of [-1, 1]) {
    const arm = msh(new THREE.BoxGeometry(0.08, 0.06, 0.48), GOLD_DARK, 'armrest'); arm.position.set(sd * 0.36, 0.66, -0.02); g.add(arm);
    const post = msh(new THREE.CylinderGeometry(0.03, 0.035, 0.66, 6), GOLD, 'armPost'); post.position.set(sd * 0.36, 0.33, 0.18); g.add(post);
  }
  // button panel on a pedestal at the toilet's left (= the sitter's right when it faces the door... local -X)
  const panel = new THREE.Group(); panel.name = 'set.mansion.panel';
  const btns = [];
  if (buttons > 1) {
    panel.position.set(-0.62, 0, 0.12); g.add(panel);
    const ped = msh(new THREE.CylinderGeometry(0.07, 0.12, 0.72, 8), GOLD, 'panelPedestal'); ped.position.set(0, 0.36, 0); panel.add(ped);
    const top = new THREE.Group(); top.position.set(0, 0.76, 0); top.rotation.set(0, 0, -0.55); panel.add(top);    // tilted toward the seat (+X local)
    const plate = msh(new THREE.BoxGeometry(0.46, 0.05, 0.58), GOLD_SHINY, 'panelPlate'); top.add(plate);
    const cols = ['#e8352a', '#2a8ae8', '#2ac85a', '#ffd21e', '#b04ae8', '#ff8a1e', '#ffffff', '#1ed2d2', '#ff4aa8', '#8a5a2a'];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
      const col = cols[(r * 5 + c * 3) % cols.length];
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, emissive: col, emissiveIntensity: 0.05, flatShading: true });
      const b = msh(new THREE.CylinderGeometry(0.03, 0.032, 0.03, 10), m, 'button', { cast: false });
      b.position.set(-0.17 + c * 0.085, 0.035, -0.23 + r * 0.092); top.add(b); btns.push(b);
    }
    panel.userData.top = top;
  } else {
    // ONE big red button on a little golden stand
    panel.position.set(-0.55, 0, 0.1); g.add(panel);
    const ped = msh(new THREE.CylinderGeometry(0.05, 0.09, 0.72, 8), GOLD, 'panelPedestal'); ped.position.set(0, 0.36, 0); panel.add(ped);
    const plate = msh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18), GOLD_SHINY, 'panelPlate'); plate.position.set(0, 0.74, 0); panel.add(plate);
    const m = new THREE.MeshStandardMaterial({ color: '#e8241e', roughness: 0.3, emissive: '#ff2a1a', emissiveIntensity: 0.35, flatShading: true });
    const b = msh(new THREE.CylinderGeometry(0.14, 0.15, 0.08, 18), m, 'bigButton', { cast: false }); b.position.set(0, 0.81, 0); panel.add(b); btns.push(b);
  }
  return { group: g, seat, lid, panel, buttons: btns, bowl };
}

function discoCanvas() {
  const R = rng(91);
  const c = document.createElement('canvas'); c.width = 32; c.height = 16; const g = c.getContext('2d');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) { const v = 150 + Math.floor(R() * 105); g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 10)})`; g.fillRect(x, y, 1, 1); }
  return c;
}

function heartGeo(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.45 * s); sh.bezierCurveTo(0.55 * s, 0.0, 0.5 * s, 0.5 * s, 0.0, 0.3 * s); sh.bezierCurveTo(-0.5 * s, 0.5 * s, -0.55 * s, 0.0, 0, -0.45 * s);
  return new THREE.ShapeGeometry(sh, 8);
}
