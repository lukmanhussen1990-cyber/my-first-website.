import * as THREE from 'three';
import { mat, box, cyl, mesh, grp, canvasTex, plane, roundRect, rnd } from './lib.js';
import { tree, bush, lamppost, cloud, mattress, pizzaBox, bulb, trashcan, car } from './props.js';

export const OFF = {
  street: new THREE.Vector3(0, 0, 0),
  room: new THREE.Vector3(-200, 0, 0),
  stairs: new THREE.Vector3(200, 0, 0),
  hill: new THREE.Vector3(0, 0, -300),
  gas: new THREE.Vector3(0, 0, 300),
  studio: new THREE.Vector3(400, 0, 0),
};

function tiles(color, line, n = 4, size = 256) {
  return canvasTex(size, size, (c, w, h) => { c.fillStyle = color; c.fillRect(0, 0, w, h); c.strokeStyle = line; c.lineWidth = 4; for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * w / n, 0); c.lineTo(i * w / n, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / n); c.lineTo(w, i * h / n); c.stroke(); } });
}
function brick(color, mortar) {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = mortar; c.fillRect(0, 0, w, h);
    const bh = 32, bw = 96;
    for (let r = 0; r < h / bh; r++) for (let k = -1; k < w / bw + 1; k++) {
      const x = k * bw + (r % 2) * bw / 2, y = r * bh;
      const v = (rnd(r * 31 + k) - 0.5) * 18; c.fillStyle = shade(color, v); c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    }
  });
}
function shade(hex, v) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + v, g = ((n >> 8) & 255) + v, b = (n & 255) + v; const cl = x => Math.max(0, Math.min(255, Math.round(x))); return `rgb(${cl(r)},${cl(g)},${cl(b)})`; }
function facadeTex(base, win, cols, rows, frame = '#f4efe6') {
  return canvasTex(512, 768, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = i * cw + cw * 0.22, y = j * rh + rh * 0.2, ww = cw * 0.56, hh = rh * 0.55;
      c.fillStyle = frame; c.fillRect(x - 6, y - 6, ww + 12, hh + 12);
      c.fillStyle = win; c.fillRect(x, y, ww, hh);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x, y, ww * 0.35, hh);
    }
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 0, w, 14);
  });
}
function simpleBuilding(w, h, d, base, win, cols, rows) {
  const g = new THREE.Group();
  const t = facadeTex(base, win, cols, rows);
  const side = mat(base);
  const front = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  const mats = [side, side, mat(shade(base, -20)), side, front, side];
  const b = mesh(new THREE.BoxGeometry(w, h, d), mats); b.position.y = h / 2; g.add(b);
  g.add(box(w + 0.3, 0.35, d + 0.3, mat(shade(base, -35)), { pos: [0, h + 0.17, 0] }));
  return g;
}

// window with sliding sash; returns group with userData.open(k)
function windowUnit() {
  const g = new THREE.Group(), fr = mat('#f6f1e8');
  g.add(box(1.3, 0.1, 0.16, fr, { pos: [0, 0.85, 0] }), box(1.3, 0.1, 0.16, fr, { pos: [0, -0.85, 0] }));
  g.add(box(0.1, 1.8, 0.16, fr, { pos: [0.6, 0, 0] }), box(0.1, 1.8, 0.16, fr, { pos: [-0.6, 0, 0] }));
  g.add(box(1.5, 0.1, 0.3, fr, { pos: [0, -0.92, 0.08] }));
  const inside = box(1.12, 1.62, 0.02, mat('#2b2f3a'), { pos: [0, 0, -0.015], cast: false }); g.add(inside);
  const glassM = mat('#8fbfdd', { roughness: 0.15, metalness: 0.25 });
  const lower = grp(box(1.12, 0.8, 0.03, glassM, { cast: false }), box(1.12, 0.06, 0.06, fr, { pos: [0, 0.38, 0] }));
  const upper = grp(box(1.12, 0.8, 0.03, glassM, { cast: false }), box(1.12, 0.06, 0.06, fr, { pos: [0, -0.38, 0] }));
  lower.position.set(0, -0.4, 0.03); upper.position.set(0, 0.4, 0.0); g.add(lower, upper);
  g.userData.open = k => { lower.position.y = -0.4 + 0.78 * k; lower.position.z = 0.035; };
  g.userData.open(0);
  return g;
}

export function buildWorld(scene) {
  const S = {};
  // ===================== STREET =====================
  const st = S.street = new THREE.Group(); st.position.copy(OFF.street); scene.add(st);
  st.add(box(200, 0.1, 120, mat('#79b25a'), { pos: [0, -0.05, 10], cast: false }));
  const sw = new THREE.MeshStandardMaterial({ map: tiles('#d4d6d8', '#b5b8bc', 1, 128), roughness: 0.95 }); sw.map.wrapS = sw.map.wrapT = THREE.RepeatWrapping; sw.map.repeat.set(60, 2);
  st.add(mesh(new THREE.BoxGeometry(120, 0.16, 4.4), sw).translateY(0.08).translateZ(2.0));
  st.add(box(120, 0.2, 0.25, mat('#bfc2c6'), { pos: [0, 0.1, 4.25] }));
  st.add(box(120, 0.04, 8, mat('#4a4e57', { roughness: 0.95 }), { pos: [0, 0.02, 8.4], cast: false }));
  for (let i = -30; i < 30; i++) st.add(box(1.6, 0.02, 0.18, mat('#f2d14b'), { pos: [i * 4, 0.05, 8.4], cast: false }));
  const sw2 = new THREE.MeshStandardMaterial({ map: sw.map.clone(), roughness: 0.95 }); sw2.map.needsUpdate = true;
  st.add(mesh(new THREE.BoxGeometry(120, 0.16, 3), sw2).translateY(0.08).translateZ(13.9));
  // main building
  const B = S.building = new THREE.Group(); st.add(B);
  const bt = brick('#c9735a', '#e8d8c6'); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(4, 4);
  const bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.92 });
  const side = mat('#b9654e');
  B.add(mesh(new THREE.BoxGeometry(14, 12.4, 10), [side, side, side, side, bm, side]).translateY(6.2).translateZ(-5));
  for (let fl = 1; fl < 4; fl++) B.add(box(14.2, 0.18, 0.25, mat('#efe3d0'), { pos: [0, fl * 3.1 - 0.05, 0.06] }));
  B.add(box(14.6, 0.5, 10.4, mat('#efe3d0'), { pos: [0, 12.5, -5] }));
  B.add(box(14.3, 0.5, 0.3, mat('#a3a8ad'), { pos: [0, 0.25, 0.1] }));
  S.windows = [];
  const wx = [-5, -2.5, 2.5, 5];
  for (let fl = 0; fl < 4; fl++) for (const x of wx) {
    if (fl === 0 && Math.abs(x) < 3) continue;
    const w = windowUnit(); w.position.set(x, fl * 3.1 + 1.75, 0.02); B.add(w); S.windows.push(w);
  }
  // door + stoop + awning
  const door = new THREE.Group(); B.add(door);
  door.add(box(2.0, 2.9, 0.2, mat('#efe3d0'), { pos: [0, 1.85, 0.05] }));
  door.add(box(1.6, 2.6, 0.1, mat('#2e5f8a'), { pos: [0, 1.75, 0.12] }));
  door.add(box(0.7, 1.1, 0.02, mat('#a7d0ea', { roughness: 0.2 }), { pos: [0, 2.3, 0.18], cast: false }));
  door.add(box(0.08, 0.08, 0.08, mat('#e7c35a', { metalness: 0.6, roughness: 0.3 }), { pos: [0.6, 1.5, 0.2] }));
  for (let i = 0; i < 3; i++) door.add(box(2.6 - i * 0.2, 0.15, 0.5, mat('#c4c7cb'), { pos: [0, 0.075 + i * 0.15 + 0.08, 0.95 - i * 0.4] }));
  door.add(box(0.6, 0.15, 1.5, mat('#c4c7cb'), { pos: [0, 0.53, 0.25] }));
  door.add(box(3.0, 0.12, 1.6, mat('#2a6e4f'), { pos: [0, 3.55, 0.75], rot: [0.12, 0, 0] }));
  const aptSign = new THREE.MeshStandardMaterial({ map: canvasTex(512, 80, (c, w, h) => { c.fillStyle = '#2a6e4f'; c.fillRect(0, 0, w, h); c.fillStyle = '#f6eedb'; c.font = '900 46px Mont'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MAPLE APTS', w / 2, h / 2 + 3); }) });
  door.add(box(2.8, 0.45, 0.06, aptSign, { pos: [0, 3.35, 1.56] }));
  [[1.6, 1.0], [-1.6, 1.0]].forEach(([x, z]) => door.add(bush(0.9).translateX(x).translateZ(z)));
  // neighbours
  const nb = [[-14.3, 10.5, '#e2b65a', '#6c8fae', 4, 4], [14.3, 9.0, '#7fa9b5', '#3e5d78', 4, 3], [-26, 13.5, '#d98b6a', '#5d7d99', 4, 5], [26, 11, '#e6d2a6', '#5d7d99', 4, 4], [-38, 9.5, '#9db58a', '#4d6a84', 4, 3], [38, 12.5, '#c98a9a', '#4d6a84', 4, 4], [-50, 11, '#e2b65a', '#4d6a84', 4, 4], [50, 9.5, '#7fa9b5', '#4d6a84', 4, 3]];
  nb.forEach(([x, h, c, w, cols, rows]) => { const b = simpleBuilding(10.4, h, 10, c, w, cols, rows); b.position.set(x, 0, -5); st.add(b); });
  // across the street
  [[-30, 8, '#cfa07a'], [-18, 10, '#8fb3c0'], [-6, 7.5, '#e8c77a'], [6, 9, '#c98a9a'], [18, 8, '#9db58a'], [30, 10.5, '#d98b6a']].forEach(([x, h, c]) => { const b = simpleBuilding(11.5, h, 8, c, '#4d6a84', 4, Math.round(h / 3)); b.position.set(x, 0, 26); b.rotation.y = Math.PI; st.add(b); });
  [-17, -8.5, 8.5, 17, -29, 29].forEach((x, i) => { const t = tree(1.05, i); t.position.set(x, 0.16, 2.9); st.add(t); });
  [-12, 12, -24, 24].forEach(x => { const l = lamppost(); l.position.set(x, 0.16, 3.7); l.rotation.y = Math.PI / 2; st.add(l); });
  [-24, -12, 0, 12, 24].forEach((x, i) => { const t = tree(1.1, i + 1); t.position.set(x + 6, 0.16, 13.6); st.add(t); });
  S.clouds = new THREE.Group(); st.add(S.clouds);
  [[-30, 28, -60, 2.2], [10, 32, -70, 2.8], [40, 26, -55, 1.8], [-5, 24, -45, 1.4], [-45, 30, 60, 2.2], [20, 28, 70, 2.5]].forEach(([x, y, z, s]) => { const c = cloud(s); c.position.set(x, y, z); S.clouds.add(c); });

  // ===================== ROOM =====================
  const rm = S.room = new THREE.Group(); rm.position.copy(OFF.room); scene.add(rm);
  const wood = canvasTex(512, 512, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = shade('#a8784a', (rnd(i) - 0.5) * 26); c.fillRect(0, i * 64, w, 64); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, i * 64, w, 3); c.fillRect(((i * 211) % w), i * 64, 3, 64); } }); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 2);
  rm.add(mesh(new THREE.BoxGeometry(8, 0.1, 7), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.75 })).translateY(-0.05));
  const wallM = mat('#c8cdb9');
  const backWall = new THREE.Group(); rm.add(backWall);
  backWall.add(box(2.6, 3.4, 0.2, wallM, { pos: [-2.7, 1.7, -3.1] }), box(2.6, 3.4, 0.2, wallM, { pos: [2.7, 1.7, -3.1] }));
  backWall.add(box(2.8, 0.9, 0.2, wallM, { pos: [0, 0.45, -3.1] }), box(2.8, 0.9, 0.2, wallM, { pos: [0, 2.95, -3.1] }));
  backWall.add(box(2.8, 1.6, 0.05, mat('#cfe8ff', { emissive: '#bfe0ff', emissiveIntensity: 0.9 }), { pos: [0, 1.7, -3.3], cast: false }));
  const wf = mat('#f2efe8'); backWall.add(box(2.9, 0.1, 0.3, wf, { pos: [0, 0.9, -3.0] }), box(2.9, 0.1, 0.25, wf, { pos: [0, 2.5, -3.0] }), box(0.1, 1.6, 0.25, wf, { pos: [1.4, 1.7, -3.0] }), box(0.1, 1.6, 0.25, wf, { pos: [-1.4, 1.7, -3.0] }), box(0.06, 1.6, 0.1, wf, { pos: [0, 1.7, -3.05] }));
  rm.add(box(0.2, 3.4, 7, wallM, { pos: [-4, 1.7, 0] }));
  rm.add(box(0.2, 3.4, 7, wallM, { pos: [4, 1.7, 0] }));
  rm.add(box(8, 0.12, 0.05, mat('#9aa08e'), { pos: [0, 0.06, -2.98] }));
  // stains / crack on wall
  rm.add(box(0.5, 0.02, 0.02, mat('#7d846f'), { pos: [2.6, 2.6, -2.99], rot: [0, 0, 0.6] }));
  const mt = mattress(); mt.position.set(-2.6, 0, -1.6); mt.rotation.y = 0.1; rm.add(mt);
  const pz = pizzaBox(); pz.position.set(-1.4, 0, -0.4); pz.rotation.y = 0.5; rm.add(pz);
  const pz2 = pizzaBox(); pz2.position.set(-1.6, 0.05, -0.5); pz2.rotation.y = 0.2; rm.add(pz2);
  S.bulb = bulb(); S.bulb.position.set(0.3, 3.4, -0.5); rm.add(S.bulb);
  // crate desk (used for laptop + printer)
  S.desk = new THREE.Group(); rm.add(S.desk); S.desk.position.set(2.2, 0, -1.8);
  S.desk.add(box(1.8, 0.75, 0.9, mat('#c99a5c'), { pos: [0, 0.375, 0] }));
  S.desk.add(box(0.3, 0.76, 0.91, mat('#9a7038'), { pos: [0, 0.375, 0], cast: false }));

  // ===================== STAIRWELL =====================
  const sr = S.stairs = new THREE.Group(); sr.position.copy(OFF.stairs); scene.add(sr);
  const stM = mat('#b98c62'), stE = mat('#8e6a48'), swall = mat('#e8dcc4');
  sr.add(box(16, 0.1, 24, stM, { pos: [-3, -0.05, 10.5] }));
  sr.add(box(16, 0.012, 0.06, mat('#8e6a48'), { pos: [-3, 0.006, 1.2], cast: false }));
  for (let i = 0; i < 10; i++) { sr.add(box(0.32, 0.2 * (i + 1), 1.6, stM, { pos: [-1.5 + 0.3 * i + 0.15, 0.1 * (i + 1), -0.05] })); sr.add(box(0.32, 0.03, 1.6, stE, { pos: [-1.5 + 0.3 * i + 0.15, 0.2 * (i + 1) + 0.005, -0.05], cast: false })); }
  sr.add(box(5, 2.0, 1.6, stM, { pos: [4, 1.0, -0.05] }));
  sr.add(box(14, 6.5, 0.2, swall, { pos: [0, 3.2, -0.95] }));
  sr.add(box(14, 0.5, 0.25, mat('#cdbb9a'), { pos: [0, 0.25, -0.85] }));
  // ceiling bulkhead the couch jams against
  sr.add(box(5.5, 0.6, 1.9, mat('#efe6d3'), { pos: [3.2, 4.55, -0.05] }));
  sr.add(box(5.5, 0.1, 1.95, mat('#d8ccb2'), { pos: [3.2, 4.22, -0.05] }));
  sr.add(box(12, 0.3, 1.9, mat('#efe6d3'), { pos: [-3, 4.6, -0.05] }));
  // handrail
  const rail = box(3.9, 0.06, 0.06, mat('#5a3c26'), { pos: [0.1, 1.95, -0.78], rot: [0, 0, Math.atan2(2, 3)] }); sr.add(rail);
  for (let i = 0; i < 4; i++) sr.add(box(0.04, 0.9, 0.04, mat('#5a3c26'), { pos: [-1.2 + i * 0.9, 0.55 + (i * 0.9 + 0.3) * 2 / 3, -0.78] }));
  // picture frames
  sr.add(box(0.8, 0.6, 0.05, mat('#4a3424'), { pos: [-2.2, 2.2, -0.83] }));
  sr.add(box(0.68, 0.48, 0.02, mat('#7fb5d9'), { pos: [-2.2, 2.2, -0.8], cast: false }));
  sr.add(box(0.6, 0.6, 0.05, mat('#4a3424'), { pos: [4.6, 3.0 + 0.0, -0.83] }));
  // neighbour door (lower landing)
  S.nDoorFrame = grp(box(1.3, 2.4, 0.12, mat('#f0e8d8'), { pos: [0, 1.2, 0] }));
  S.nDoorFrame.position.set(-4.2, 0, -0.86); sr.add(S.nDoorFrame);
  S.nDoor = new THREE.Group(); S.nDoor.position.set(-4.2 + 0.5, 0, -0.78); sr.add(S.nDoor);
  S.nDoor.add(box(1.0, 2.15, 0.08, mat('#7a4a8f'), { pos: [-0.5, 1.08, 0] }));
  S.nDoor.add(box(0.07, 0.07, 0.08, mat('#e7c35a', { metalness: 0.6, roughness: 0.3 }), { pos: [-0.88, 1.05, 0.06] }));
  S.nDoor.add(box(0.12, 0.12, 0.02, mat('#d9c08a'), { pos: [-0.5, 1.6, 0.05] }));
  sr.add(box(0.9, 0.02, 0.5, mat('#b8545a'), { pos: [-4.2, 0.01, -0.4], cast: false }));
  const lampS = mesh(new THREE.SphereGeometry(0.18, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#fff3d0', { emissive: '#ffe6a0', emissiveIntensity: 0.9 }), { cast: false }); lampS.rotation.x = Math.PI; lampS.position.set(-2.5, 4.45, -0.05); sr.add(lampS);

  // ===================== HILL =====================
  const hl = S.hill = new THREE.Group(); hl.position.copy(OFF.hill); scene.add(hl);
  const ang = Math.atan(0.21), slopeY = x => (x > 15 ? 0 : x < -25 ? -8.4 : (x - 15) * 0.21);
  S.slopeY = slopeY; S.slopeAng = ang;
  const L = 40 / Math.cos(ang);
  const road = new THREE.Group(); road.position.set(-5, slopeY(-5), 0); road.rotation.z = ang; hl.add(road);
  road.add(box(L, 0.2, 6, mat('#4a4e57', { roughness: 0.95 }), { pos: [0, -0.1, 0], cast: false }));
  road.add(box(L, 0.36, 2.2, mat('#d0d3d6'), { pos: [0, -0.02, -4.1] }));
  road.add(box(L, 0.2, 30, mat('#79b25a'), { pos: [0, -0.2, -20] }));
  road.add(box(L, 0.2, 14, mat('#79b25a'), { pos: [0, -0.2, 10] }));
  for (let i = -9; i < 10; i++) road.add(box(1.4, 0.02, 0.16, mat('#f2d14b'), { pos: [i * 2.2, 0.01, 0], cast: false }));
  hl.add(box(30, 0.2, 6, mat('#4a4e57'), { pos: [15 + 15, -0.1, 0], cast: false }));
  hl.add(box(30, 0.2, 40, mat('#79b25a'), { pos: [30, -0.2, -10], cast: false }));
  hl.add(box(30, 0.2, 6, mat('#4a4e57'), { pos: [-40, -8.5, 0], cast: false }));
  hl.add(box(30, 0.2, 40, mat('#79b25a'), { pos: [-40, -8.6, -10], cast: false }));
  hl.add(box(30, 0.36, 2.2, mat('#d0d3d6'), { pos: [-40, -8.42, -4.1] }));
  const hcol = ['#e8c77a', '#8fb3c0', '#c98a9a', '#e6d2a6', '#9db58a', '#d98b6a', '#7fa9b5'];
  for (let i = 0; i < 9; i++) {
    const x = 20 - i * 6.2, y = slopeY(x);
    const hb = simpleBuilding(5.6, 6 + (i % 3) * 1.6, 7, hcol[i % hcol.length], '#4d6a84', 2, 2); hb.position.set(x, y - 2, -9.5); hl.add(hb);
    hb.add(box(5.6, 4, 7, mat(hcol[i % hcol.length]), { pos: [0, -1.5 + 2, 0] }));
    if (i % 2) { const t = tree(1, i); t.position.set(x + 3, y, -5.6); hl.add(t); }
  }
  for (let i = 0; i < 7; i++) { const x = 18 - i * 7, t = tree(1.1, i + 2); t.position.set(x, slopeY(x) - 0.2, 6.5); hl.add(t); }
  S.cans = [];
  [[-28.5, -0.6], [-28.6, 0.3], [-29.2, 1.1], [-28.2, 1.4]].forEach(([x, z], i) => { const c = trashcan(i % 2 ? '#3f8a52' : '#7c8a96'); c.position.set(x, -8.4, z); hl.add(c); S.cans.push(c); });
  const hc = cloud(2.6); hc.position.set(-20, 18, -70); hl.add(hc);
  const hc2 = cloud(2); hc2.position.set(20, 22, -60); hl.add(hc2);

  // ===================== GAS STATION =====================
  const gs = S.gas = new THREE.Group(); gs.position.copy(OFF.gas); scene.add(gs);
  gs.add(box(60, 0.1, 40, mat('#c9cbcf', { roughness: 0.95 }), { pos: [0, -0.05, 0], cast: false }));
  [[-4, -1.2], [4, -1.2]].forEach(([x, z]) => gs.add(box(0.5, 6, 0.5, mat('#f2f2ee'), { pos: [x, 3, z] })));
  gs.add(box(14, 0.8, 7, mat('#e8463c'), { pos: [0, 6.2, -0.5] }));
  gs.add(box(14.05, 0.2, 7.05, mat('#f2f2ee'), { pos: [0, 5.75, -0.5] }));
  const shop = simpleBuilding(14, 4.5, 8, '#f2f2ee', '#6c8fae', 4, 1); shop.position.set(2, 0, -12); gs.add(shop);
  gs.add(box(6, 1, 0.2, new THREE.MeshStandardMaterial({ map: canvasTex(600, 100, (c, w, h) => { c.fillStyle = '#2f7de1'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '74px Lucky'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GAS & SNACKS', w / 2, h / 2 + 4); }) }), { pos: [2, 3.6, -7.9] }));
  [-14, -8, 14, 18].forEach((x, i) => { const t = tree(1.2, i); t.position.set(x, 0, -10); gs.add(t); });
  const gc = cloud(2.4); gc.position.set(-10, 20, -60); gs.add(gc);

  // ===================== STUDIO =====================
  const sd = S.studio = new THREE.Group(); sd.position.copy(OFF.studio); scene.add(sd);
  S.studioCyc = new THREE.Group(); sd.add(S.studioCyc);
  const cg = new THREE.CylinderGeometry(9, 9, 14, 40, 1, true, Math.PI * 0.5, Math.PI);
  S.cycMat = new THREE.MeshStandardMaterial({ color: '#f3dfc6', side: THREE.BackSide, roughness: 1 });
  const cyc = mesh(cg, S.cycMat, { cast: false }); cyc.position.set(0, 7, 2); S.studioCyc.add(cyc);
  S.floorMat = new THREE.MeshStandardMaterial({ color: '#f3dfc6', roughness: 1 });
  S.studioCyc.add(mesh(new THREE.CircleGeometry(9.2, 40), S.floorMat, { cast: false }).rotateX(-Math.PI / 2).translateZ(0.001).translateY(-2));
  // sunburst backdrop
  const rays = canvasTex(1024, 1024, (c, w, h) => { c.fillStyle = '#ffb21f'; c.fillRect(0, 0, w, h); c.translate(w / 2, h / 2); c.fillStyle = '#ff8a1f'; for (let i = 0; i < 24; i++) { c.rotate(Math.PI / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(900, -110); c.lineTo(900, 110); c.closePath(); if (i % 2) c.fill(); } const g = c.createRadialGradient(0, 0, 40, 0, 0, 520); g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g; c.fillRect(-512, -512, 1024, 1024); });
  S.rays = mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: rays, toneMapped: false }), { cast: false, receive: false });
  S.rays.position.set(0, 4, -6); sd.add(S.rays);
  return S;
}
