// The police station set.
import * as THREE from 'three';
import { TEX, signTexture, wantedPoster, crtTexture, keyboardTexture, toTex, makeCanvas, pixelText, noiseRect, rng } from './pixel.js';
import { mat, tmat } from './characters.js';

function bx(w, h, d, m, { cast = true, recv = true } = {}) {
  const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  x.castShadow = cast; x.receiveShadow = recv;
  return x;
}
function texRep(t, rx, ry) { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; }

export const ROOM = { x0: -6, x1: 6, z0: -5, z1: 5, h: 3.4 };

export function buildWorld(scene) {
  const W = {};
  const { x0, x1, z0, z1, h } = ROOM;

  // ---------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0xfff0dc, 0x4a3a30, 0.75);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffe6c8, 0.2);
  scene.add(amb);
  const key = new THREE.DirectionalLight(0xffe4c0, 1.35);
  key.position.set(2.5, 7, 4.5);
  key.target.position.set(-0.5, 0, -1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 20 });
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  W.key = key;
  // warm practical lights (no shadows)
  const lamp = (x, y, z, c, i, d) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; };
  W.deskLamp = lamp(0.8, 2.7, 0.2, 0xffc890, 8, 9);
  W.cellLamp = lamp(-4.2, 2.8, -3.4, 0xffc27a, 5, 6);
  W.wcLight = lamp(3.6, 2.0, -5.7, 0xd8ffd0, 0, 4);
  W.doorLight = lamp(6.8, 2.0, 1.4, 0xfff4dd, 0, 5);

  // ---------------------------------------------------------- floor/ceiling
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), tmat(TEX.floor, { flatShading: false }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), tmat(TEX.ceiling, { flatShading: false }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = h;
  scene.add(ceil);

  // ---------------------------------------------------------- walls
  const wallMat = (len) => tmat(texRep(TEX.wall, len / 1.2, 1), { flatShading: false });
  const wall = (x, z, len, rotY, y0 = 0, y1 = h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, y1 - y0), wallMat(len));
    if (y0 > 0) { m.material.map = m.material.map.clone(); m.material.map.repeat.set(len / 1.2, (y1 - y0) / h); m.material.map.offset.set(0, y0 / h); m.material.map.needsUpdate = true; }
    m.position.set(x, (y0 + y1) / 2, z); m.rotation.y = rotY; m.receiveShadow = true;
    scene.add(m); return m;
  };
  // back wall with a gap for the WC door (x 3.1..4.1)
  wall((x0 + 3.1) / 2, z0, 3.1 - x0, 0);
  wall((4.1 + x1) / 2, z0, x1 - 4.1, 0);
  wall(3.6, z0, 1.0, 0, 2.2, h);
  // right wall with entrance gap (z 0.9..1.9)
  wall(x1, (z0 + 0.9) / 2, 0.9 - z0, -Math.PI / 2);
  wall(x1, (1.9 + z1) / 2, z1 - 1.9, -Math.PI / 2);
  wall(x1, 1.4, 1.0, -Math.PI / 2, 2.2, h);
  wall(x0, 0, z1 - z0, Math.PI / 2);
  wall(0, z1, x1 - x0, Math.PI);

  // ---------------------------------------------------------- "POLICE" sign
  {
    const [c, g] = makeCanvas(64, 14);
    g.fillStyle = '#16264a'; g.fillRect(0, 0, 64, 14);
    g.fillStyle = '#d9b44a'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 13, 64, 1);
    pixelText(g, 'POLICE', 32, 3, 8, 0xf3d36b, 'center');
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.44, 0.05), [mat(0x16264a), mat(0x16264a), mat(0x16264a), mat(0x16264a), new THREE.MeshStandardMaterial({ map: toTex(c), emissive: 0x30260a, emissiveIntensity: 0.4, roughness: 0.6 }), mat(0x16264a)]);
    s.position.set(1.0, 2.85, z0 + 0.04);
    scene.add(s);
  }

  // ---------------------------------------------------------- notice board
  {
    const g = new THREE.Group();
    const board = bx(1.7, 1.05, 0.05, tmat(TEX.cork));
    g.add(board);
    const frame = mat(0x4a2e1a);
    for (const [w, hh, x, y] of [[1.8, 0.07, 0, 0.56], [1.8, 0.07, 0, -0.56], [0.07, 1.15, 0.88, 0], [0.07, 1.15, -0.88, 0]]) {
      const f = bx(w, hh, 0.07, frame); f.position.set(x, y, 0.01); g.add(f);
    }
    const posters = [[-0.52, 0.06, 0.06, 1], [0.0, 0.1, -0.04, 2], [0.5, 0.02, 0.05, 3]];
    for (const [x, y, rz, seed] of posters) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: wantedPoster(seed, { mustache: seed === 2 }), roughness: 0.95 }));
      p.position.set(x, y, 0.03); p.rotation.z = rz; g.add(p);
      const pin = bx(0.03, 0.03, 0.03, mat(0xd0302a)); pin.position.set(x, y + 0.26, 0.05); g.add(pin);
    }
    for (const [x, y, c] of [[-0.75, -0.38, 0xfff27a], [0.76, -0.4, 0x9ee6ff]]) {
      const n = bx(0.18, 0.18, 0.01, mat(c)); n.position.set(x, y, 0.035); n.rotation.z = 0.1; g.add(n);
    }
    g.position.set(-0.9, 1.75, z0 + 0.05);
    scene.add(g);
    W.board = g;
  }

  // ---------------------------------------------------------- wall clock
  {
    const [c, g] = makeCanvas(16, 16);
    g.fillStyle = '#222'; g.beginPath(); g.arc(8, 8, 8, 0, 7); g.fill();
    g.fillStyle = '#f1ead6'; g.beginPath(); g.arc(8, 8, 7, 0, 7); g.fill();
    g.fillStyle = '#222'; for (let k = 0; k < 12; k++) g.fillRect(8 + Math.round(5.5 * Math.cos(k * Math.PI / 6)), 8 + Math.round(5.5 * Math.sin(k * Math.PI / 6)), 1, 1);
    g.fillRect(8, 4, 1, 4); g.fillRect(8, 8, 3, 1);
    const clk = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.7 }));
    clk.position.set(-2.1, 2.55, z0 + 0.03);
    scene.add(clk);
  }

  // ---------------------------------------------------------- front desk
  {
    const g = new THREE.Group();
    const wood = tmat(texRep(TEX.wood, 2, 1));
    const top = bx(2.6, 0.08, 1.0, wood); top.position.y = 1.02; g.add(top);
    const front = bx(2.6, 1.0, 0.08, tmat(texRep(TEX.wood, 3, 1.5))); front.position.set(0, 0.5, 0.46); g.add(front);
    for (const sx of [-1, 1]) { const s = bx(0.08, 1.0, 1.0, wood); s.position.set(sx * 1.26, 0.5, 0); g.add(s); }
    // "FRONT DESK" plaque
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshStandardMaterial({ map: signTexture('FRONT DESK', { w: 88, h: 14, bg: 0x1d2c52, fg: 0xf3d36b, border: 0xd9b44a }), roughness: 0.6 }));
    pl.position.set(0, 0.72, 0.505); g.add(pl);
    g.position.set(1.0, 0, -0.8);
    scene.add(g);
    W.desk = g;

    // CRT computer (screen faces the officer, slightly turned)
    const pc = new THREE.Group();
    const beige = mat(0xcfc3a3), beigeD = mat(0xa99d80);
    const body = bx(0.5, 0.44, 0.42, beige); body.position.y = 0.22; pc.add(body);
    const back = bx(0.36, 0.32, 0.3, beigeD); back.position.set(0, 0.2, -0.3); pc.add(back);
    const bezel = bx(0.42, 0.36, 0.02, mat(0x8e846c)); bezel.position.set(0, 0.24, 0.21); pc.add(bezel);
    W.crtTex = [crtTexture(2, true), crtTexture(4, false), crtTexture(5, true), crtTexture(6, false)];
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.27), new THREE.MeshBasicMaterial({ map: W.crtTex[0] }));
    screen.position.set(0, 0.245, 0.222); pc.add(screen);
    W.crtScreen = screen;
    const stand = bx(0.3, 0.04, 0.3, beigeD); stand.position.y = -0.02; pc.add(stand);
    pc.position.set(0.35, 1.08, -1.0);
    pc.rotation.y = Math.PI + 0.35;
    scene.add(pc);
    W.pc = pc;
    const glow = new THREE.PointLight(0x6dff8a, 0.6, 1.4, 2); glow.position.set(0.45, 1.35, -1.35); scene.add(glow);
    // keyboard
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.17), [beigeD, beigeD, new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.8 }), beigeD, beigeD, beigeD]);
    kb.position.set(1.0, 1.08, -1.05); kb.rotation.y = Math.PI; kb.castShadow = true; kb.receiveShadow = true;
    scene.add(kb);
    W.keyboard = kb;
    // papers, mug, notepad, pen, phone
    const paper = bx(0.3, 0.02, 0.38, mat(0xf2ecdc)); paper.position.set(1.85, 1.07, -0.75); paper.rotation.y = 0.2; scene.add(paper);
    const paper2 = bx(0.3, 0.015, 0.38, mat(0xe8e0c8)); paper2.position.set(1.83, 1.09, -0.73); paper2.rotation.y = -0.1; scene.add(paper2);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.13, 8), mat(0xc8402e)); mug.position.set(1.7, 1.13, -1.1); mug.castShadow = true; scene.add(mug);
    const pad = bx(0.22, 0.015, 0.3, mat(0xfff1a8)); pad.position.set(1.45, 1.065, -0.95); scene.add(pad);
    W.pad = pad;
    const phone = bx(0.22, 0.08, 0.18, mat(0x2a2a2e)); phone.position.set(-0.05, 1.1, -0.5); scene.add(phone);
    const rec = bx(0.24, 0.05, 0.06, mat(0x1a1a1e)); rec.position.set(-0.05, 1.17, -0.5); scene.add(rec);
    // keys on the desk
    const keys = new THREE.Group();
    const ringM = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.9, roughness: 0.3 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: 0.85, roughness: 0.3, emissive: 0x201400 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 5, 10), ringM); ring.rotation.x = Math.PI / 2; keys.add(ring);
    for (let k = 0; k < 3; k++) {
      const kg = new THREE.Group(); kg.rotation.y = -0.6 + k * 0.6;
      const shaft = bx(0.022, 0.012, 0.14, brass); shaft.position.z = 0.12; kg.add(shaft);
      const bow = bx(0.06, 0.014, 0.05, brass); bow.position.z = 0.06; kg.add(bow);
      for (let t = 0; t < 3; t++) { const tooth = bx(0.02, 0.012, 0.015, brass); tooth.position.set(0.018, 0, 0.14 + t * 0.03 - 0.02); kg.add(tooth); }
      keys.add(kg);
    }
    keys.position.set(2.0, 1.07, -1.15);
    scene.add(keys);
    W.keys = keys;
    W.keysHome = keys.position.clone();
    // officer chair
    const chair = new THREE.Group();
    const seat = bx(0.55, 0.08, 0.5, mat(0x2b2b30)); seat.position.y = 0.5; chair.add(seat);
    const backr = bx(0.55, 0.6, 0.07, mat(0x2b2b30)); backr.position.set(0, 0.85, -0.25); chair.add(backr);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), mat(0x777777)); pole.position.y = 0.25; chair.add(pole);
    chair.position.set(1.0, 0, -1.85);
    scene.add(chair);
    W.chair = chair;
  }

  // ---------------------------------------------------------- ceiling fan
  {
    const g = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), mat(0x3a3530)); rod.position.y = -0.175; g.add(rod);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.16, 8), mat(0x6a5a48)); motor.position.y = -0.4; g.add(motor);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); bulb.position.y = -0.52; g.add(bulb);
    const blades = new THREE.Group(); blades.position.y = -0.42; g.add(blades);
    for (let k = 0; k < 4; k++) {
      const b = bx(0.95, 0.025, 0.2, tmat(TEX.wood)); b.position.x = 0.58; const arm = new THREE.Group(); arm.rotation.y = k * Math.PI / 2; b.rotation.x = 0.12; arm.add(b); blades.add(arm);
    }
    g.position.set(0.4, h, 0.4);
    scene.add(g);
    W.fan = g; W.fanBlades = blades;
  }
  // pendant lamp over the cell
  {
    const shadeM = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.25, 8, 1, true), mat(0x2f4a3a, { side: THREE.DoubleSide }));
    shadeM.position.set(-4.2, 3.0, -3.4); scene.add(shadeM);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); bulb.position.set(-4.2, 2.88, -3.4); scene.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), mat(0x111111)); cord.position.set(-4.2, 3.25, -3.4); scene.add(cord);
  }

  // ---------------------------------------------------------- jail cell
  {
    const barM = new THREE.MeshStandardMaterial({ color: 0x3d4148, roughness: 0.45, metalness: 0.7, flatShading: true });
    const cellX = -2.6, cellZ = -1.7;
    const bar = (x, z, hh = 3.0) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, hh, 6), barM); b.position.set(x, hh / 2, z); b.castShadow = true; return b; };
    const cell = new THREE.Group();
    // front bars (z = cellZ), x from -6 to -3.85 (door covers -3.75..-2.75)
    for (let x = x0 + 0.1; x < -3.8; x += 0.19) cell.add(bar(x, cellZ));
    // side bars (x = cellX)
    for (let z = z0 + 0.1; z <= cellZ; z += 0.19) cell.add(bar(cellX, z));
    const rail = (w, d, x, y, z) => { const r = bx(w, 0.07, d, barM); r.position.set(x, y, z); cell.add(r); };
    rail(-3.8 - x0, 0.07, (x0 + -3.8) / 2, 2.95, cellZ); rail(-3.8 - x0, 0.07, (x0 + -3.8) / 2, 1.2, cellZ);
    rail(0.07, cellZ - z0, cellX, 2.95, (z0 + cellZ) / 2); rail(0.07, cellZ - z0, cellX, 1.2, (z0 + cellZ) / 2);
    rail(1.25, 0.07, -3.2, 2.95, cellZ);
    // door post near the hinge
    const post = bx(0.09, 3.0, 0.09, barM); post.position.set(cellX, 1.5, cellZ); cell.add(post);
    const post2 = bx(0.09, 3.0, 0.09, barM); post2.position.set(-3.8, 1.5, cellZ); cell.add(post2);
    scene.add(cell);
    // door: hinge at x = -2.7, extends toward -x to -3.75
    const door = new THREE.Group();
    door.position.set(-2.7, 0, cellZ);
    for (let k = 0; k < 6; k++) { const b = bar(-0.08 - k * 0.18, 0, 2.7); door.add(b); }
    const dr = (y) => { const r = bx(1.0, 0.07, 0.07, barM); r.position.set(-0.52, y, 0); door.add(r); };
    dr(0.1); dr(1.2); dr(2.65);
    const lock = bx(0.16, 0.24, 0.12, mat(0x9a8a5a, { metalness: 0.5, roughness: 0.35 })); lock.position.set(-0.98, 1.1, 0); door.add(lock);
    const hole = bx(0.03, 0.06, 0.01, BLACKM()); hole.position.set(-0.98, 1.1, 0.065); door.add(hole);
    scene.add(door);
    W.cellDoor = door;
    W.cellLock = lock;
    // cot
    const cot = new THREE.Group();
    const frameM = mat(0x5b6066);
    const fr = bx(0.9, 0.08, 2.0, frameM); fr.position.y = 0.45; cot.add(fr);
    const mt = bx(0.85, 0.14, 1.95, tmat(TEX.mattress)); mt.position.y = 0.56; cot.add(mt);
    const pil = bx(0.6, 0.1, 0.3, mat(0xe8e4da)); pil.position.set(0, 0.67, -0.8); cot.add(pil);
    for (const [x, z] of [[-0.4, -0.95], [0.4, -0.95], [-0.4, 0.95], [0.4, 0.95]]) { const l = bx(0.06, 0.45, 0.06, frameM); l.position.set(x, 0.22, z); cot.add(l); }
    cot.position.set(-5.4, 0, -3.7);
    scene.add(cot);
    // little window with bars high on the cell wall
    const win = bx(0.05, 0.5, 0.8, new THREE.MeshBasicMaterial({ color: 0x9cc7e8 })); win.position.set(x0 + 0.02, 2.5, -3.4); scene.add(win);
    for (let k = -1; k <= 1; k++) { const b = bx(0.06, 0.5, 0.04, barM); b.position.set(x0 + 0.05, 2.5, -3.4 + k * 0.22); scene.add(b); }
  }

  // ---------------------------------------------------------- WC door + little toilet room
  {
    const fr = mat(0x3e2614);
    for (const [w, hh, x, y] of [[0.12, 2.25, 3.06, 1.12], [0.12, 2.25, 4.14, 1.12], [1.2, 0.12, 3.6, 2.22]]) {
      const f = bx(w, hh, 0.12, fr); f.position.set(x, y, z0 + 0.02); scene.add(f);
    }
    const door = new THREE.Group();
    door.position.set(3.12, 0, z0 + 0.03); // hinge on the left edge
    const dm = bx(0.96, 2.14, 0.06, tmat(TEX.door)); dm.position.set(0.48, 1.07, 0); door.add(dm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), GOLDM()); knob.position.set(0.85, 1.05, 0.06); door.add(knob);
    scene.add(door);
    W.wcDoor = door;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.03), [mat(0xeeeeee), mat(0xeeeeee), mat(0xeeeeee), mat(0xeeeeee), new THREE.MeshStandardMaterial({ map: signTexture('WC', { w: 24, h: 14, bg: 0xf6f3ea, fg: 0x1b3a8a, border: 0x1b3a8a }), roughness: 0.5 }), mat(0xeeeeee)]);
    sign.position.set(3.6, 2.55, z0 + 0.04);
    scene.add(sign);
    W.wcSign = sign;
    // toilet room interior (behind the back wall)
    const tz = z0 - 0.75;
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 1.5), new THREE.MeshStandardMaterial({ color: 0xbfe0d0, side: THREE.BackSide, roughness: 0.9 }));
    inner.position.set(3.6, 1.15, tz);
    scene.add(inner);
    const bowl = new THREE.Group();
    const porc = mat(0xf4f4f0);
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 8), porc); b1.position.y = 0.2; bowl.add(b1);
    const tank = bx(0.4, 0.4, 0.18, porc); tank.position.set(0, 0.6, -0.22); bowl.add(tank);
    bowl.position.set(3.6, 0, z0 - 1.25);
    scene.add(bowl);
  }

  // ---------------------------------------------------------- entrance door (right wall)
  {
    const fr = mat(0x3e2614);
    for (const [w, hh, z, y] of [[0.12, 2.25, 0.84, 1.12], [0.12, 2.25, 1.96, 1.12], [1.24, 0.12, 1.4, 2.22]]) {
      const f = bx(0.12, hh, w === 0.12 ? 0.12 : w, fr); f.position.set(x1 - 0.02, y, z); scene.add(f);
    }
    const door = new THREE.Group();
    door.position.set(x1 - 0.03, 0, 0.9); // hinge on the far edge (away from camera)
    const dm = bx(0.06, 2.14, 0.98, tmat(TEX.door)); dm.position.set(0, 1.07, 0.49); door.add(dm);
    const glass = bx(0.07, 0.5, 0.5, new THREE.MeshBasicMaterial({ color: 0xbfe6ff })); glass.position.set(0, 1.55, 0.49); door.add(glass);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), GOLDM()); knob.position.set(-0.06, 1.05, 0.88); door.add(knob);
    scene.add(door);
    W.frontDoor = door;
    // bright daylight outside
    const out = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }));
    out.position.set(x1 + 0.8, 1.5, 1.4); out.rotation.y = -Math.PI / 2;
    scene.add(out);
    const mat2 = bx(0.9, 0.02, 1.2, mat(0x7a2a24)); mat2.position.set(x1 - 0.6, 0.01, 1.4); scene.add(mat2);
  }

  // ---------------------------------------------------------- bench, water cooler, plant, cabinet
  {
    const bench = new THREE.Group();
    const wood = tmat(TEX.wood);
    const seat = bx(0.5, 0.07, 2.0, wood); seat.position.y = 0.48; bench.add(seat);
    const back = bx(0.07, 0.5, 2.0, wood); back.position.set(0.24, 0.85, 0); bench.add(back);
    for (const z of [-0.85, 0.85]) { const l = bx(0.45, 0.45, 0.07, mat(0x2a2a2a)); l.position.set(0, 0.22, z); bench.add(l); }
    bench.position.set(x1 - 0.35, 0, -2.7);
    scene.add(bench);
    W.bench = bench;
    const cooler = new THREE.Group();
    const base = bx(0.38, 1.0, 0.38, mat(0xe8e6df)); base.position.y = 0.5; cooler.add(base);
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.45, 8), new THREE.MeshStandardMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.75, roughness: 0.2 })); jug.position.y = 1.25; cooler.add(jug);
    cooler.position.set(x1 - 0.4, 0, z0 + 0.45);
    scene.add(cooler);
    const plant = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 8), mat(0xa0522d)); pot.position.y = 0.2; plant.add(pot);
    for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 4), mat(0x3f7a35)); l.position.set(Math.cos(k) * 0.1, 0.7, Math.sin(k) * 0.1); l.rotation.set(Math.sin(k * 2) * 0.4, k, Math.cos(k * 2) * 0.4); l.castShadow = true; plant.add(l); }
    plant.position.set(x1 - 0.45, 0, 2.6);
    scene.add(plant);
    const cab = new THREE.Group();
    const cb = bx(0.6, 1.4, 0.55, mat(0x6d7a72)); cb.position.y = 0.7; cab.add(cb);
    for (let k = 0; k < 3; k++) { const d = bx(0.5, 0.36, 0.02, mat(0x7c8a81)); d.position.set(0, 0.28 + k * 0.45, 0.285); cab.add(d); const hnd = bx(0.14, 0.03, 0.03, mat(0x222222)); hnd.position.set(0, 0.36 + k * 0.45, 0.3); cab.add(hnd); }
    cab.position.set(2.4, 0, z0 + 0.35);
    scene.add(cab);
  }

  return W;
}

function BLACKM() { return new THREE.MeshBasicMaterial({ color: 0x050505 }); }
function GOLDM() { return new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: 0.8, roughness: 0.3 }); }
