// The ark: keel + ribs + plank rows that appear with `progress`, pitch darkening, gabled roof with a
// window band, ONE side door (Genesis 6:16) that glows and can swing shut, ramp, scaffolding, ladder.
// Local space: length along x (-18..18), door side faces +z, ground at y=0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { matte, glowMat, radialTex, fadeTex } from './materials.js';
import { hash01, clamp, smooth, invLerp } from './util.js';

export const ARK = { L: 36, half: 18, base: 0.55, H: 6.2, bw: 2.8, tw: 4.1, rows: 14, door: { x0: 2.9, x1: 5.1, y0: 1.55, y1: 4.35 } };
const XS = [-18, -16.4, -14, -10.5, -7, -3.5, 0, 2.9, 5.1, 7.5, 10.5, 14, 16.4, 18];
const WOOD = ['#a26f40', '#95653a', '#ab7947', '#8c5e36', '#9e6c3d'];

export function taper(x) { const a = Math.abs(x); return a < 13 ? 1 : 1 - 0.55 * smooth((a - 13) / 5); }
export function hullHalfWidth(x, y) { const u = clamp((y - ARK.base) / ARK.H); return (ARK.bw + (ARK.tw - ARK.bw) * u) * taper(x); }

function plank(a, b, y, h, t, color) {
  const dx = b[0] - a[0], dz = b[1] - a[1]; const len = Math.hypot(dx, dz);
  const g = new THREE.BoxGeometry(len + 0.06, h, t);
  g.rotateY(-Math.atan2(dz, dx));
  g.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
  const c = new THREE.Color(color); const n = g.attributes.position.count; const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function buildArk(opts = {}) {
  const root = new THREE.Group();
  const A = { root, rows: [], ribs: [], parts: {} };
  const hullMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: '#ffffff' });
  A.hullMat = hullMat;
  const { rows, base, H } = ARK;
  const rowH = H / rows;
  const D = ARK.door;
  // ---- plank rows (per row, per chunk of length, merged) ----
  for (let r = 0; r < rows; r++) {
    const y = base + rowH * (r + 0.5);
    const chunks = [[], [], [], []];
    const chunkOf = (x) => Math.min(3, Math.floor((x + 18) / 9));
    for (const side of [1, -1]) {
      for (let i = 0; i < XS.length - 1; i++) {
        const x0 = XS[i], x1 = XS[i + 1];
        if (side === 1 && x0 >= D.x0 - 0.01 && x1 <= D.x1 + 0.01 && y > D.y0 && y < D.y1) continue; // the door opening
        const a = [x0, side * hullHalfWidth(x0, y)], b = [x1, side * hullHalfWidth(x1, y)];
        const col = WOOD[Math.floor(hash01(r * 31 + i * 7 + (side > 0 ? 3 : 0), 2) * WOOD.length)];
        chunks[chunkOf((x0 + x1) / 2)].push(plank(a, b, y, rowH * 0.93, 0.16, col));
      }
    }
    // end transoms
    for (const e of [-1, 1]) {
      const x = e * 18, w = hullHalfWidth(x, y);
      chunks[e < 0 ? 0 : 3].push(plank([x, -w], [x, w], y, rowH * 0.93, 0.16, WOOD[(r + (e > 0 ? 2 : 0)) % WOOD.length]));
    }
    const rowMeshes = chunks.map((list) => {
      const m = new THREE.Mesh(mergeGeometries(list), hullMat);
      m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
    });
    A.rows.push(rowMeshes);
  }
  // ---- bottom + keel ----
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(35.6, 0.25, ARK.bw * 2 * 0.92), matte('#5e3e24'));
  bottom.position.y = base + 0.05; bottom.castShadow = bottom.receiveShadow = true; root.add(bottom); A.parts.bottom = bottom;
  // cradle blocks
  for (let x = -15; x <= 15; x += 5) for (const z of [-1.6, 1.6]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, base, 0.9), matte('#6b4a2c')); b.position.set(x, base / 2, z); b.castShadow = true; root.add(b);
  }
  // ---- ribs ----
  const ribMat = matte('#6e4a2b');
  for (let i = 0; i < 15; i++) {
    const x = -16.8 + i * 2.4;
    const g = [];
    const top = base + H + 0.35;
    for (const s of [1, -1]) {
      const zb = s * ARK.bw * taper(x) * 0.98, zt = s * ARK.tw * taper(x) * 0.98;
      const len = Math.hypot(zt - zb, top - base);
      const bg = new THREE.BoxGeometry(0.22, len, 0.22);
      bg.rotateX(Math.atan2(zt - zb, top - base));
      bg.translate(x, (base + top) / 2, (zb + zt) / 2);
      g.push(bg);
    }
    const m = new THREE.Mesh(mergeGeometries(g), ribMat); m.castShadow = true; root.add(m); A.ribs.push(m);
  }
  // ---- deck walls, window band, roof ----
  const deckY = base + H;
  const roof = new THREE.Group(); root.add(roof); A.parts.roof = roof;
  const wallMat = matte('#6a4527');
  for (const s of [1, -1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(33, 0.55, 0.16), wallMat); w.position.set(0, deckY + 0.27, s * (ARK.tw - 0.35)); roof.add(w);
  }
  const winMat = new THREE.MeshLambertMaterial({ color: '#2a1a10', flatShading: true, emissive: new THREE.Color(0, 0, 0) });
  const win = new THREE.Mesh(new THREE.BoxGeometry(32.8, 0.5, ARK.tw * 2 - 0.9), winMat); win.position.set(0, deckY + 0.8, 0); roof.add(win);
  A.windowGlow = (k) => winMat.emissive.setRGB(0.5 * k, 0.26 * k, 0.07 * k);
  A.parts.window = win;
  const rp = new THREE.Group(); rp.position.y = deckY + 1.05; roof.add(rp); A.parts.roofPanels = rp;
  const roofMat = matte('#5a3a22');
  for (const s of [1, -1]) {
    const len = Math.hypot(ARK.tw + 0.3, 1.9);
    const p = new THREE.Mesh(new THREE.BoxGeometry(34, 0.22, len), roofMat);
    p.rotation.x = s * Math.atan2(1.9, ARK.tw + 0.3);
    p.position.set(0, 0.95, s * (ARK.tw + 0.3) / 2);
    p.castShadow = p.receiveShadow = true; rp.add(p);
    for (let k = -16; k <= 16; k += 2) { // battens
      const bt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, len), matte('#4a2f1a'));
      bt.rotation.x = p.rotation.x; bt.position.set(k, 1.08, s * (ARK.tw + 0.3) / 2); rp.add(bt);
    }
  }
  // gable ends
  for (const e of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(-ARK.tw - 0.3, 0); sh.lineTo(ARK.tw + 0.3, 0); sh.lineTo(0, 1.95); sh.closePath();
    const gg = new THREE.ShapeGeometry(sh); gg.rotateY(Math.PI / 2);
    const gm = new THREE.Mesh(gg, matte('#4e321d', { params: { side: THREE.DoubleSide } })); gm.position.set(e * 17, 0, 0); rp.add(gm);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(35, 0.2, ARK.tw * 2 - 0.2), matte('#6e4a2b')); deck.position.y = deckY; root.add(deck); A.parts.deck = deck;

  // ---- the door ----
  const dw = D.x1 - D.x0, dh = D.y1 - D.y0, dx = (D.x0 + D.x1) / 2, dy = (D.y0 + D.y1) / 2;
  const zDoor = hullHalfWidth(dx, dy);
  const doorG = new THREE.Group(); root.add(doorG); A.door = doorG;
  // warm interior light plane (HDR -> bloom)
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.82, 0.5), fog: false }));
  inner.position.set(dx, dy, zDoor - 0.35); doorG.add(inner); A.doorInner = inner;
  // frame
  const fm = matte('#4a2e1a');
  for (const [w, h, x, y] of [[0.28, dh + 0.3, D.x0 - 0.1, dy], [0.28, dh + 0.3, D.x1 + 0.1, dy], [dw + 0.5, 0.3, dx, D.y1 + 0.12], [dw + 0.5, 0.22, dx, D.y0 - 0.08]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.34), fm); f.position.set(x, y, zDoor + 0.02); f.castShadow = true; doorG.add(f);
  }
  // panel hinged on its left edge (x0)
  const hinge = new THREE.Group(); hinge.position.set(D.x0, dy, zDoor + 0.1); doorG.add(hinge); A.doorHinge = hinge;
  const panel = new THREE.Group(); hinge.add(panel);
  for (let k = 0; k < 4; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(dw / 4 - 0.03, dh - 0.04, 0.14), matte(WOOD[k % 5])); b.position.set(dw / 8 + k * dw / 4, 0, 0); b.castShadow = true; panel.add(b);
  }
  for (const yy of [-dh * 0.32, dh * 0.32]) { const c = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.1, 0.16, 0.1), matte('#4a2e1a')); c.position.set(dw / 2, yy, 0.1); panel.add(c); }
  // glow: halo sprite + light spill fan
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1.0, 0.75, 0.38], 0.0, { map: radialTex() }));
  halo.position.set(dx, dy, zDoor + 0.45); halo.scale.set(dw * 2.4, dh * 1.7, 1); doorG.add(halo); A.halo = halo;
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1.0, 0.7, 0.32], 0.0, { map: fadeTex() }));
  spill.rotation.x = -Math.PI / 2; doorG.add(spill); A.spill = spill;
  // light shafts (additive quads fanning out of the doorway)
  const shafts = new THREE.Group(); doorG.add(shafts); A.shafts = shafts;
  for (let k = 0; k < 5; k++) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1.0, 0.78, 0.4], 0.0, { map: fadeTex() }));
    q.userData.k = k; shafts.add(q);
  }
  const lamp = new THREE.PointLight('#ffb866', 0, 22, 1.6); lamp.position.set(dx, dy + 0.2, zDoor + 1.2); doorG.add(lamp); A.doorLight = lamp;
  A.doorPos = new THREE.Vector3(dx, dy, zDoor);

  // ---- ramp (from sill down to ground, outward +z) ----
  const ramp = new THREE.Group(); root.add(ramp); A.ramp = ramp;
  const rl = 7.2; const ang = Math.atan2(D.y0, rl);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.6, 0.22, Math.hypot(rl, D.y0)), matte('#7a5230'));
  slab.rotation.x = ang; slab.position.set(dx, D.y0 / 2, zDoor + rl / 2 + 0.1); slab.castShadow = slab.receiveShadow = true; ramp.add(slab);
  for (let k = 1; k < 12; k++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.4, 0.08, 0.12), matte('#5a3a22'));
    const u = k / 12; s.position.set(dx, D.y0 * (1 - u) + 0.14, zDoor + 0.1 + rl * u); ramp.add(s);
  }
  A.rampTop = new THREE.Vector3(dx, D.y0, zDoor + 0.2);
  A.rampBottom = new THREE.Vector3(dx, 0, zDoor + rl + 0.1);

  // ---- scaffolding + ladder (door side and far side) ----
  const scaf = new THREE.Group(); root.add(scaf); A.scaffold = scaf;
  const pole = matte('#a07a4a'), board = matte('#b08a58');
  for (const side of [1, -1]) {
    for (let x = -15; x <= 15; x += 5) {
      if (side === 1 && x < 9) continue; // keep the door side clear (hook shot, door)
      const z = side * (ARK.tw + 1.25);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 8.2, 5), pole); p.position.set(x, 4.1, z); p.castShadow = true; scaf.add(p);
      const p2 = p.clone(); p2.position.z = side * (ARK.tw + 0.25); scaf.add(p2);
    }
    for (const y of [2.6, 5.0]) for (let x = -15; x < 15; x += 5) {
      if (side === 1 && x < 9) continue;
      const b = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.09, 1.1), board); b.position.set(x + 2.5, y, side * (ARK.tw + 0.75)); b.castShadow = b.receiveShadow = true; scaf.add(b);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.06, 0.06), pole); rail.position.set(x + 2.5, y + 1.0, side * (ARK.tw + 1.25)); scaf.add(rail);
    }
  }
  const ladder = new THREE.Group(); root.add(ladder); A.ladder = ladder;
  const lx = -5.0, lz = hullHalfWidth(lx, 2) + 2.15;
  ladder.position.set(lx, 0, lz); ladder.rotation.x = -0.3;
  for (const s of [-0.38, 0.38]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.09, 5.4, 0.09), pole); r.position.set(s, 2.7, 0); r.castShadow = true; ladder.add(r); }
  for (let k = 0; k < 11; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.07), pole); r.position.set(0, 0.35 + k * 0.48, 0); ladder.add(r); }
  // world-space rung position helper (k-th rung)
  A.rung = (k) => { const v = new THREE.Vector3(0, 0.35 + k * 0.48, 0.04); ladder.updateMatrixWorld(true); return v.applyMatrix4(ladder.matrixWorld); };

  // ---- state ----
  A.set = ({ progress = 1, pitch = 0, door = 1, glow = 0, ramp = 1, scaffold = null, ladderOn = null } = {}) => {
    const p = progress; A.windowGlow(0);
    A.ribs.forEach((m, i) => { m.visible = p > 0.02 + 0.22 * (i / A.ribs.length); });
    A.rows.forEach((rowMeshes, r) => rowMeshes.forEach((m, c) => {
      const order = [1, 2, 0, 3][c];
      m.visible = p > 0.16 + 0.74 * ((r + order / 4) / rows);
    }));
    A.parts.bottom.visible = p > 0.0;
    const roofK = smooth(invLerp(0.9, 1.0, p));
    A.parts.roof.visible = roofK > 0.001; A.parts.roof.scale.set(1, Math.max(0.001, roofK), 1);
    A.parts.deck.visible = p > 0.88;
    A.scaffold.visible = scaffold ?? (p < 0.985);
    A.ladder.visible = ladderOn ?? (p < 0.985);
    A.ramp.visible = ramp > 0.001; A.ramp.scale.set(1, 1, 1);
    const doorRowsBuilt = p > 0.16 + 0.74 * (8 / rows);
    A.door.visible = doorRowsBuilt;
    hullMat.color.setRGB(1, 1, 1).lerp(new THREE.Color('#6e5a4c'), pitch);
    // door: 1 = open (swung out), 0 = shut
    A.doorHinge.rotation.y = -1.75 * smooth(door);
    const open = smooth(door);
    const gk = smooth(Math.min(1, glow * 1.4));
    A.doorInner.material.color.setRGB(0.1, 0.062, 0.036).lerp(new THREE.Color(0.85 + 0.75 * glow, 0.52 + 0.4 * glow, 0.2 + 0.12 * glow), gk).multiplyScalar(0.35 + 0.65 * Math.max(open, 0.05));
    A.halo.material.opacity = 0.42 * glow * Math.max(0.12, open);
    A.doorLight.intensity = 26 * glow * open;
    // spill fan on the ramp/ground
    const sp = A.spill; sp.material.opacity = 0.45 * glow * open;
    sp.scale.set(ARK.door.x1 - ARK.door.x0 + 2.5, 9, 1); sp.position.set(A.doorPos.x, 0.06 + 0.02, A.doorPos.z + 4.6);
    sp.rotation.set(-Math.PI / 2 + 0.0, 0, Math.PI);
    A.shafts.children.forEach((q) => {
      const k = q.userData.k; const spread = (k - 2) * 0.22;
      q.material.opacity = 0.12 * glow * open;
      q.scale.set(1.0 + 0.3 * (k % 2), 8, 1);
      q.position.set(A.doorPos.x + spread * 3, A.doorPos.y - 1.0, A.doorPos.z + 3.6);
      q.rotation.set(-1.25, spread, 0);
    });
  };
  A.set({ progress: 1 });
  return A;
}
