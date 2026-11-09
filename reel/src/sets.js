// The two worlds: the cosy living room and the sunny back yard.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mat, mesh, facet } from './characters.js';
import * as TX from './textures.js';
import { mulberry32 } from './util.js';

const box = (w, h, d, m, x = 0, y = 0, z = 0, opts) => { const b = mesh(new THREE.BoxGeometry(w, h, d), m, opts); b.position.set(x, y, z); return b; };

// Wall in the XY plane (facing +z) with rectangular holes; local UV in metres.
function wallWithHoles(w, h, holes, material) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
  for (const [x0, y0, x1, y1] of holes) {
    const p = new THREE.Path();
    p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.lineTo(x0, y0);
    s.holes.push(p);
  }
  const g = new THREE.ShapeGeometry(s);
  return mesh(g, material, { cast: false, receive: true });
}

function envFor(renderer, scene, intensity) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = intensity;
}

export const ROOM = {
  doorA: { x: -1.3, w: 1.0, h: 2.15 },          // doorway on the back wall (you scratch on its right post)
  window: { x: 1.5, y: 1.55, w: 1.3, h: 1.25 },  // back wall window
  doorB: { z: -1.975, w: 0.95, h: 2.15 },       // dad's door on the right wall
  fan: new THREE.Vector3(0, 3.0, 0),
  switchPos: new THREE.Vector3(3.48, 1.25, -1.1),
  chair: new THREE.Vector3(2.55, 0, 1.25),
};

export function buildRoom(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1d14');
  envFor(renderer, scene, 0.32);
  const W = 7, D = 6, H = 3.0;
  const wpTex = TX.wallpaper();
  const wallMat = new THREE.MeshStandardMaterial({ map: wpTex, roughness: 0.92 });
  const trimTex = TX.woodTrim(5);
  const woodMat = new THREE.MeshStandardMaterial({ map: trimTex, roughness: 0.55, color: '#ffffff' });
  const creamTrim = mat('#f3ecdd', { roughness: 0.6, flatShading: false });

  // floor
  const floor = mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: TX.woodFloor(), roughness: 0.5, metalness: 0 }), { cast: false });
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  floor.material.map.repeat.set(W / 2.2, D / 2.2);
  // ceiling
  const ceil = mesh(new THREE.PlaneGeometry(W, D), mat('#f4ede0', { roughness: 0.95, flatShading: false }), { cast: false });
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);

  // back wall (z=-3) with doorway A + window
  const dA = ROOM.doorA, win = ROOM.window, dB = ROOM.doorB;
  const back = wallWithHoles(W, H, [
    [dA.x - dA.w / 2, 0.001, dA.x + dA.w / 2, dA.h],
    [win.x - win.w / 2, win.y - win.h / 2, win.x + win.w / 2, win.y + win.h / 2],
  ], wallMat);
  back.position.set(0, 0, -D / 2); scene.add(back);
  // right wall (x=+3.5), local x runs from z=+3 (left) to z=-3 (right) when facing -x
  const right = wallWithHoles(D, H, [[-dB.z - dB.w / 2, 0.001, -dB.z + dB.w / 2, dB.h]], wallMat);
  right.rotation.y = -Math.PI / 2; right.position.set(W / 2, 0, 0); scene.add(right);
  const left = wallWithHoles(D, H, [], wallMat);
  left.rotation.y = Math.PI / 2; left.position.set(-W / 2, 0, 0); scene.add(left);
  const front = wallWithHoles(W, H, [], wallMat);
  front.rotation.y = Math.PI; front.position.set(0, 0, D / 2); scene.add(front);

  // baseboards + crown moulding
  const bb = [[W, 0, -D / 2 + 0.012, 0], [W, 0, D / 2 - 0.012, Math.PI], [D, -W / 2 + 0.012, 0, Math.PI / 2], [D, W / 2 - 0.012, 0, -Math.PI / 2]];
  for (const [len, x, z, ry] of bb) {
    const b = box(len, 0.13, 0.025, creamTrim, x, 0.065, z); b.rotation.y = ry; b.castShadow = false; scene.add(b);
    const c = box(len, 0.09, 0.05, creamTrim, x, H - 0.045, z); c.rotation.y = ry; c.castShadow = false; scene.add(c);
  }

  // ---- doorway A (back wall) with warm wood casing + hallway ----
  const casing = (parent, cx, w, h, rot = 0) => {
    const g = new THREE.Group();
    const post = 0.12, dep = 0.06;
    g.add(box(post, h + post, dep, woodMat, -w / 2 - post / 2, (h + post) / 2, dep / 2));
    g.add(box(post, h + post, dep, woodMat, w / 2 + post / 2, (h + post) / 2, dep / 2));
    g.add(box(w + post * 2 + 0.04, post, dep + 0.01, woodMat, 0, h + post / 2, dep / 2));
    // jambs through the wall thickness
    g.add(box(0.03, h, 0.16, woodMat, -w / 2 + 0.015, h / 2, -0.08));
    g.add(box(0.03, h, 0.16, woodMat, w / 2 - 0.015, h / 2, -0.08));
    g.add(box(w, 0.03, 0.16, woodMat, 0, h - 0.015, -0.08));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  };
  const cA = casing(scene, dA.x, dA.w, dA.h); cA.position.set(dA.x, 0, -D / 2); scene.add(cA);
  // hallway behind A
  const hallMat = mat('#d9c7a3', { roughness: 0.95, flatShading: false });
  const hall = new THREE.Group();
  const hb = mesh(new THREE.PlaneGeometry(2.4, 2.6), hallMat, { cast: false }); hb.position.set(dA.x, 1.3, -4.7); hall.add(hb);
  const hl = mesh(new THREE.PlaneGeometry(1.7, 2.6), hallMat, { cast: false }); hl.rotation.y = Math.PI / 2; hl.position.set(dA.x - 1.0, 1.3, -3.85); hall.add(hl);
  const hr = mesh(new THREE.PlaneGeometry(1.7, 2.6), hallMat, { cast: false }); hr.rotation.y = -Math.PI / 2; hr.position.set(dA.x + 1.0, 1.3, -3.85); hall.add(hr);
  const hf = mesh(new THREE.PlaneGeometry(2.4, 1.7), new THREE.MeshStandardMaterial({ map: TX.woodFloor(), roughness: 0.6 }), { cast: false }); hf.rotation.x = -Math.PI / 2; hf.position.set(dA.x, 0.001, -3.85); hall.add(hf);
  const hc = mesh(new THREE.PlaneGeometry(2.4, 1.7), hallMat, { cast: false }); hc.rotation.x = Math.PI / 2; hc.position.set(dA.x, 2.6, -3.85); hall.add(hc);
  const hpic = framedPicture('flowers', 0.42, 0.5); hpic.position.set(dA.x, 1.55, -4.68); hall.add(hpic);
  const hallLight = new THREE.PointLight('#ffcf8a', 2.2, 4, 1.6); hallLight.position.set(dA.x, 2.3, -3.9); hall.add(hallLight);
  scene.add(hall);

  // ---- door B (right wall) where dad comes in ----
  const cB = casing(scene, 0, dB.w, dB.h); cB.rotation.y = -Math.PI / 2; cB.position.set(W / 2, 0, dB.z); scene.add(cB);
  const doorLeaf = new THREE.Group();
  const leafM = mesh(new THREE.BoxGeometry(dB.w - 0.04, dB.h - 0.02, 0.045), new THREE.MeshStandardMaterial({ map: TX.woodTrim(8, [24, 50, 46]), roughness: 0.6 }));
  leafM.position.set((dB.w - 0.04) / 2, (dB.h - 0.02) / 2, 0); doorLeaf.add(leafM);
  for (const [py, ph] of [[0.55, 0.7], [1.5, 0.75]]) {
    const pnl = box(dB.w * 0.62, ph, 0.02, new THREE.MeshStandardMaterial({ map: TX.woodTrim(9, [24, 46, 40]), roughness: 0.6 }), (dB.w - 0.04) / 2, py, 0.03);
    doorLeaf.add(pnl);
  }
  const knob = mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: '#d8b25a', metalness: 0.9, roughness: 0.25 }));
  knob.position.set(dB.w - 0.13, 1.0, 0.05); doorLeaf.add(knob);
  // hinge on the far (z=-2.45) side, opened out into the hallway
  doorLeaf.position.set(W / 2 + 0.16, 0, dB.z - dB.w / 2 + 0.02);
  doorLeaf.rotation.y = Math.PI * 0.08 + Math.PI / 2;
  scene.add(doorLeaf);
  const hall2 = new THREE.Group();
  const h2b = mesh(new THREE.PlaneGeometry(2.6, 2.6), hallMat, { cast: false }); h2b.rotation.y = -Math.PI / 2; h2b.position.set(5.4, 1.3, dB.z); hall2.add(h2b);
  const h2l = mesh(new THREE.PlaneGeometry(1.9, 2.6), hallMat, { cast: false }); h2l.position.set(4.45, 1.3, dB.z - 1.1); hall2.add(h2l);
  const h2r = mesh(new THREE.PlaneGeometry(1.9, 2.6), hallMat, { cast: false }); h2r.rotation.y = Math.PI; h2r.position.set(4.45, 1.3, dB.z + 1.1); hall2.add(h2r);
  const h2f = mesh(new THREE.PlaneGeometry(1.9, 2.2), new THREE.MeshStandardMaterial({ map: TX.woodFloor(), roughness: 0.6 }), { cast: false }); h2f.rotation.x = -Math.PI / 2; h2f.position.set(4.45, 0.001, dB.z); hall2.add(h2f);
  const h2c = mesh(new THREE.PlaneGeometry(1.9, 2.2), hallMat, { cast: false }); h2c.rotation.x = Math.PI / 2; h2c.position.set(4.45, 2.6, dB.z); hall2.add(h2c);
  const hl2 = new THREE.PointLight('#ffd9a0', 2.0, 4, 1.6); hl2.position.set(4.6, 2.3, dB.z); hall2.add(hl2);
  scene.add(hall2);

  // ---- window with green curtains + garden view ----
  const winG = new THREE.Group(); winG.position.set(win.x, win.y, -D / 2); scene.add(winG);
  const frameMat = mat('#f1eadb', { roughness: 0.5, flatShading: false });
  const fw = 0.07;
  winG.add(box(win.w + fw * 2, fw, 0.1, frameMat, 0, win.h / 2 + fw / 2, 0.02));
  winG.add(box(win.w + fw * 2 + 0.12, 0.06, 0.2, frameMat, 0, -win.h / 2 - 0.03, 0.06)); // sill
  winG.add(box(fw, win.h, 0.1, frameMat, -win.w / 2 - fw / 2, 0, 0.02));
  winG.add(box(fw, win.h, 0.1, frameMat, win.w / 2 + fw / 2, 0, 0.02));
  const mull = [box(0.04, win.h, 0.06, frameMat, 0, 0, -0.03), box(win.w, 0.04, 0.06, frameMat, 0, 0, -0.03)];
  mull.forEach((m) => winG.add(m));
  // reveal (wall thickness)
  winG.add(box(win.w, 0.02, 0.18, frameMat, 0, -win.h / 2 + 0.01, -0.09));
  winG.add(box(win.w, 0.02, 0.18, frameMat, 0, win.h / 2 - 0.01, -0.09));
  winG.add(box(0.02, win.h, 0.18, frameMat, -win.w / 2 + 0.01, 0, -0.09));
  winG.add(box(0.02, win.h, 0.18, frameMat, win.w / 2 - 0.01, 0, -0.09));
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#dff0ff', transparent: true, opacity: 0.14, roughness: 0.03, metalness: 0, envMapIntensity: 1.6 });
  const panes = [];
  for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = mesh(new THREE.PlaneGeometry(win.w / 2 - 0.03, win.h / 2 - 0.03), glassMat, { cast: false, receive: false });
    p.position.set(px * win.w / 4, py * win.h / 4, -0.04); winG.add(p); panes.push(p);
  }
  const view = mesh(new THREE.PlaneGeometry(4.2, 3.0), new THREE.MeshBasicMaterial({ map: TX.windowView() }), { cast: false, receive: false });
  view.position.set(win.x, 1.5, -D / 2 - 1.2); scene.add(view);
  // curtains: folded low-poly planes
  const curtMat = new THREE.MeshStandardMaterial({ color: '#3d8c4c', roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
  for (const s of [-1, 1]) {
    const cg = new THREE.PlaneGeometry(0.5, 1.9, 14, 4);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const gather = 1 - 0.35 * Math.exp(-((y + 0.25) ** 2) / 0.02); // tie-back pinch
      p.setX(i, x * gather);
      p.setZ(i, Math.sin((x + 0.25) * 34) * 0.035 * (0.6 + 0.4 * gather));
    }
    cg.computeVertexNormals();
    const cm = mesh(cg, curtMat);
    cm.position.set(win.x + s * (win.w / 2 + 0.18), 1.4, -D / 2 + 0.12);
    scene.add(cm);
    const tie = mesh(new THREE.TorusGeometry(0.11, 0.015, 4, 10), mat('#d6a645', { roughness: 0.4 }));
    tie.position.set(win.x + s * (win.w / 2 + 0.18), 1.15, -D / 2 + 0.13); tie.rotation.x = Math.PI / 2; tie.scale.set(1.1, 1, 0.5); scene.add(tie);
  }
  const rod = mesh(new THREE.CylinderGeometry(0.018, 0.018, win.w + 1.0, 8), new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.4, metalness: 0.3 }));
  rod.rotation.z = Math.PI / 2; rod.position.set(win.x, 2.38, -D / 2 + 0.12); scene.add(rod);
  const winLight = new THREE.PointLight('#e8f2ff', 1.6, 4.5, 1.5); winLight.position.set(win.x, 1.6, -2.4); scene.add(winLight);

  // ---- framed pictures ----
  const pics = [];
  const addPic = (kind, w, h, pos, ry) => { const p = framedPicture(kind, w, h); p.position.copy(pos); p.rotation.y = ry; scene.add(p); pics.push(p); return p; };
  addPic('hills', 0.5, 0.62, new THREE.Vector3(0.12, 1.75, -D / 2 + 0.03), 0);
  // left wall: the wall you get stuck to
  addPic('boat', 0.55, 0.68, new THREE.Vector3(-W / 2 + 0.03, 1.85, -0.95), Math.PI / 2);
  addPic('flowers', 0.42, 0.52, new THREE.Vector3(-W / 2 + 0.03, 1.55, 0.9), Math.PI / 2);
  addPic('hills', 0.34, 0.42, new THREE.Vector3(-W / 2 + 0.03, 2.2, 0.3), Math.PI / 2);
  // right wall by grandma: the pancake portrait
  addPic('pancake', 0.5, 0.62, new THREE.Vector3(W / 2 - 0.03, 1.75, 1.3), -Math.PI / 2);
  addPic('flowers', 0.36, 0.44, new THREE.Vector3(W / 2 - 0.03, 1.6, 0.35), -Math.PI / 2);

  // ---- rug ----
  const rugM = mesh(new THREE.CircleGeometry(1.45, 40), new THREE.MeshStandardMaterial({ map: TX.rug(), roughness: 0.95 }), { cast: false });
  rugM.rotation.x = -Math.PI / 2; rugM.position.set(0, 0.004, 0.2); scene.add(rugM);

  // ---- ceiling fan ----
  const fan = new THREE.Group(); fan.position.copy(ROOM.fan); scene.add(fan);
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a35a', metalness: 0.85, roughness: 0.3 });
  fan.add(box(0.001, 0.001, 0.001, brass));
  const canopy = mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.06, 12), brass); canopy.position.y = -0.03; fan.add(canopy);
  const rodF = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), brass); rodF.position.y = -0.2; fan.add(rodF);
  const motor = mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.12, 14), brass); motor.position.y = -0.38; fan.add(motor);
  const rotor = new THREE.Group(); rotor.position.y = -0.44; fan.add(rotor);
  const bladeMat = new THREE.MeshStandardMaterial({ map: TX.woodTrim(12, [28, 50, 34]), roughness: 0.5 });
  const blades = [];
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group(); arm.rotation.y = (i / 5) * Math.PI * 2; rotor.add(arm);
    const iron = box(0.18, 0.02, 0.05, brass, 0.2, 0, 0); arm.add(iron);
    const blade = box(0.62, 0.016, 0.16, bladeMat, 0.58, -0.005, 0); blade.rotation.x = 0.12; arm.add(blade);
    blades.push(arm);
  }
  const bowl = mesh(new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe2a8', emissiveIntensity: 0.6, roughness: 0.3 }));
  bowl.position.y = -0.04; rotor.add(bowl);

  // ---- fan switch (a big push button with speed lights) ----
  const sw = new THREE.Group(); sw.position.copy(ROOM.switchPos); sw.rotation.y = -Math.PI / 2; scene.add(sw);
  sw.add(box(0.11, 0.17, 0.012, mat('#f7f4ee', { roughness: 0.35, flatShading: false })));
  const label = mesh(new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshBasicMaterial({ map: TX.fanLabel() }), { cast: false });
  label.position.set(0, 0.06, 0.007); sw.add(label);
  const button = mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.02, 16), new THREE.MeshStandardMaterial({ color: '#d8352a', roughness: 0.3 }));
  button.rotation.x = Math.PI / 2; button.position.set(0, 0.0, 0.016); sw.add(button);
  const leds = [];
  for (let i = 0; i < 3; i++) {
    const led = mesh(new THREE.SphereGeometry(0.007, 8, 6), new THREE.MeshStandardMaterial({ color: '#3a3a3a', emissive: '#40ff60', emissiveIntensity: 0 }));
    led.position.set(-0.025 + i * 0.025, -0.055, 0.009); sw.add(led); leds.push(led);
  }

  // ---- grandma's armchair, side table, lamp, plants ----
  const chair = makeArmchair(); chair.position.copy(ROOM.chair); chair.rotation.y = -Math.PI / 2 - 0.35; scene.add(chair);
  const table = new THREE.Group(); table.position.set(2.95, 0, 0.2); scene.add(table);
  const tw = new THREE.MeshStandardMaterial({ map: TX.woodTrim(14, [22, 45, 32]), roughness: 0.5 });
  const top = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 16), tw); top.position.y = 0.62; table.add(top);
  const leg = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8), tw); leg.position.y = 0.3; table.add(leg);
  const lampBase = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.05, 10), brass); lampBase.position.y = 0.665; table.add(lampBase);
  const lampStem = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6), brass); lampStem.position.y = 0.85; table.add(lampStem);
  const shade = mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#f6e7c8', emissive: '#ffcf80', emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.8 }));
  shade.position.y = 1.08; table.add(shade);
  const lampLight = new THREE.PointLight('#ffc070', 1.4, 3.2, 1.6); lampLight.position.set(2.95, 1.05, 0.2); scene.add(lampLight);
  scene.add(makePlant(new THREE.Vector3(2.95, 0, -2.6), 1.0, 5));
  scene.add(makePlant(new THREE.Vector3(-3.05, 0, 2.5), 1.2, 6));
  scene.add(makePlant(new THREE.Vector3(-2.95, 0, -2.6), 0.85, 7));
  // sideboard on left wall front
  const sb = new THREE.Group(); sb.position.set(-3.22, 0, 1.9); scene.add(sb);
  sb.add(box(0.5, 0.8, 1.2, new THREE.MeshStandardMaterial({ map: TX.woodTrim(15, [24, 42, 36]), roughness: 0.55 }), 0, 0.4, 0));
  const vase = mesh(facet(new THREE.CylinderGeometry(0.06, 0.09, 0.26, 8), 0.004, 5), mat('#4f86b8', { roughness: 0.3 })); vase.position.set(0, 0.93, -0.2); sb.add(vase);

  // ---- lights ----
  const hemi = new THREE.HemisphereLight('#fff3df', '#7a5b45', 0.85); scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffd6a3', 2.7);
  key.position.set(-2.2, 5.2, 4.2); key.target.position.set(0.2, 0.8, -0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 16 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#c6dbff', 0.75); fill.position.set(3.5, 2.5, 3); scene.add(fill);

  return {
    scene, key, fill, hemi, floor, fan, rotor, blades, button, leds, panes, winG, pics, doorLeaf, chair,
    light: { hall: hallLight, lamp: lampLight },
  };
}

export function framedPicture(kind, w, h) {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: kind === 'pancake' ? '#c9a24f' : '#8a5a32', metalness: kind === 'pancake' ? 0.7 : 0.1, roughness: 0.4 });
  const fw = 0.045;
  g.add(box(w + fw * 2, fw, 0.04, frame, 0, h / 2 + fw / 2, 0));
  g.add(box(w + fw * 2, fw, 0.04, frame, 0, -h / 2 - fw / 2, 0));
  g.add(box(fw, h, 0.04, frame, -w / 2 - fw / 2, 0, 0));
  g.add(box(fw, h, 0.04, frame, w / 2 + fw / 2, 0, 0));
  const art = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: TX.painting(kind), roughness: 0.7 }), { cast: false });
  art.position.z = 0.002; g.add(art);
  return g;
}

function makeArmchair() {
  const g = new THREE.Group();
  const orange = mat('#e07a2c', { roughness: 0.85 });
  const orange2 = mat('#ea8a3a', { roughness: 0.85 });
  const legM = mat('#4a2e1a', { roughness: 0.5 });
  const soft = (w, h, d, m, x, y, z, seed) => { const b = mesh(facet(new THREE.BoxGeometry(w, h, d, 3, 2, 3), 0.025, seed), m); b.position.set(x, y, z); return b; };
  g.add(soft(0.9, 0.3, 0.82, orange, 0, 0.3, 0, 1));
  g.add(soft(0.66, 0.16, 0.66, orange2, 0, 0.52, 0.06, 2));
  g.add(soft(0.9, 0.78, 0.2, orange, 0, 0.75, -0.33, 3));
  g.add(soft(0.62, 0.42, 0.12, orange2, 0, 0.82, -0.2, 4));
  for (const s of [-1, 1]) g.add(soft(0.16, 0.34, 0.8, orange, s * 0.39, 0.58, 0.0, 5 + s));
  for (const [x, z] of [[-0.38, -0.34], [0.38, -0.34], [-0.38, 0.34], [0.38, 0.34]]) {
    const l = mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.16, 6), legM); l.position.set(x, 0.08, z); g.add(l);
  }
  return g;
}

function makePlant(pos, s = 1, seed = 1) {
  const g = new THREE.Group(); g.position.copy(pos); g.scale.setScalar(s);
  const pot = mesh(facet(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 8), 0.006, seed), mat('#c0603a', { roughness: 0.8 }));
  pot.position.y = 0.15; g.add(pot);
  const r = mulberry32(seed * 31);
  const leafM = mat('#3f8a3a', { roughness: 0.7 }), leafM2 = mat('#56a347', { roughness: 0.7 });
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(facet(new THREE.IcosahedronGeometry(0.11, 0), 0.02, seed * 10 + i), i % 2 ? leafM : leafM2);
    const a = r() * Math.PI * 2;
    leaf.scale.set(0.5, 1.6, 0.25);
    leaf.position.set(Math.cos(a) * 0.12, 0.45 + r() * 0.25, Math.sin(a) * 0.12);
    leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
    g.add(leaf);
  }
  return g;
}

// ===================== back yard =====================
export const YARD = {
  tramp: new THREE.Vector3(1.0, 0, 8.6),
  roofRidgeY: 5.4, roofEaveY: 3.15, roofEaveZ: 3.9,
};
export function roofSurfaceY(z) { // top surface of the front slope at depth z (z>=0)
  const slope = (YARD.roofRidgeY - YARD.roofEaveY) / YARD.roofEaveZ;
  return YARD.roofRidgeY - Math.abs(z) * slope + 0.07;
}

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,1.0)).xyz - cameraPosition); gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunSize; varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, clamp(-h*4.0,0.0,1.0));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += sunCol * (pow(sd, 900.0/sunSize) * 6.0 + pow(sd, 18.0) * 0.35 + pow(sd, 4.0)*0.12);
  gl_FragColor = vec4(col, 1.0); }`;

export function buildYard(renderer) {
  const scene = new THREE.Scene();
  envFor(renderer, scene, 0.4);
  const skyU = {
    top: { value: new THREE.Color('#3d86e0') }, horizon: { value: new THREE.Color('#cfe8ff') }, bottom: { value: new THREE.Color('#9cc7a0') },
    sunDir: { value: new THREE.Vector3(-0.4, 0.6, 0.5) }, sunCol: { value: new THREE.Color('#fff2d0') }, sunSize: { value: 1.0 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }));
  sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  scene.fog = new THREE.Fog('#cfe8ff', 45, 190);

  const ground = mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: TX.grass(), roughness: 0.95 }), { cast: false });
  ground.material.map.repeat.set(80, 80);
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  // ---- the house ----
  const house = new THREE.Group(); scene.add(house);
  const sid = new THREE.MeshStandardMaterial({ map: TX.siding('#f1e4c8'), roughness: 0.85 });
  sid.map.repeat.set(5, 2);
  const hw = 9, hd = 7, hh = 3.3;
  const walls = mesh(new THREE.BoxGeometry(hw, hh, hd), sid); walls.position.y = hh / 2; house.add(walls);
  const roofMat = new THREE.MeshStandardMaterial({ map: TX.shingles(), roughness: 0.75, flatShading: true });
  const rise = YARD.roofRidgeY - YARD.roofEaveY + 0.0, run = YARD.roofEaveZ;
  const slopeLen = Math.hypot(rise, run) + 0.2, ang = Math.atan2(rise, run);
  for (const s of [-1, 1]) {
    const slab = mesh(new THREE.BoxGeometry(hw + 0.8, 0.14, slopeLen), roofMat);
    slab.position.set(0, (YARD.roofRidgeY + YARD.roofEaveY) / 2, s * run / 2);
    slab.rotation.x = s * ang; house.add(slab);
  }
  const ridgeCap = mesh(new THREE.BoxGeometry(hw + 0.85, 0.12, 0.3), mat('#5e2a20', { roughness: 0.7 }));
  ridgeCap.position.y = YARD.roofRidgeY + 0.07; ridgeCap.rotation.x = Math.PI / 4; ridgeCap.scale.z = 0.7; house.add(ridgeCap);
  // gable ends
  const gShape = new THREE.Shape(); gShape.moveTo(-hd / 2, 0); gShape.lineTo(hd / 2, 0); gShape.lineTo(0, YARD.roofRidgeY - hh); gShape.lineTo(-hd / 2, 0);
  for (const s of [-1, 1]) {
    const gm = mesh(new THREE.ShapeGeometry(gShape), mat('#efe0c0', { roughness: 0.85, side: THREE.DoubleSide }));
    gm.rotation.y = s * Math.PI / 2; gm.position.set(s * hw / 2, hh, 0); house.add(gm);
  }
  const chim = mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), mat('#9c4a36', { roughness: 0.9 })); chim.position.set(-2.6, 5.4, -1.4); house.add(chim);
  // front windows (one with a person-shaped hole) + door + porch
  const winFrame = mat('#f7f2e8', { roughness: 0.5, flatShading: false });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#9fc6e6', roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5, transparent: true, opacity: 0.85 });
  const holeGlass = new THREE.MeshPhysicalMaterial({ color: '#9fc6e6', roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5, transparent: true, alphaMap: silhouetteAlpha(), alphaTest: 0.5, side: THREE.DoubleSide });
  const darkInside = mat('#2b2018', { roughness: 1 });
  const addWin = (x, broken) => {
    const g = new THREE.Group(); g.position.set(x, 1.65, hd / 2 + 0.01); house.add(g);
    g.add(box(1.3, 1.2, 0.02, darkInside, 0, 0, -0.005));
    g.add(mesh(new THREE.PlaneGeometry(1.24, 1.14), broken ? holeGlass : glass, { cast: false }));
    for (const [w, h, px, py] of [[1.42, 0.08, 0, 0.64], [1.5, 0.1, 0, -0.65], [0.08, 1.3, -0.67, 0], [0.08, 1.3, 0.67, 0], [0.05, 1.2, 0, 0], [1.3, 0.05, 0, 0]]) g.add(box(w, h, 0.08, winFrame, px, py, 0.03));
    for (const s of [-1, 1]) g.add(box(0.36, 1.3, 0.04, mat('#3d7a4a', { roughness: 0.7 }), s * 0.92, 0, 0.02));
    return g;
  };
  const brokenWin = addWin(2.3, true);
  addWin(-2.4, false);
  const door = box(1.0, 2.1, 0.08, mat('#8e3b2c', { roughness: 0.6 }), -0.2, 1.05, hd / 2 + 0.03); house.add(door);
  house.add(box(1.8, 0.12, 1.0, mat('#cfc6b4'), -0.2, 0.06, hd / 2 + 0.5));
  // bushes along the front
  const r = mulberry32(99);
  for (let i = 0; i < 9; i++) {
    const b = mesh(facet(new THREE.IcosahedronGeometry(0.45 + r() * 0.25, 1), 0.06, 400 + i), mat(['#3f8a3a', '#4c9a43', '#357a33'][i % 3], { roughness: 0.85 }));
    b.position.set(-4.2 + i * 1.05 + r() * 0.3, 0.35, hd / 2 + 0.55 + r() * 0.2); b.scale.y = 0.75; house.add(b);
  }

  // ---- fence between the yards ----
  const picket = mat('#f4efe4', { roughness: 0.7 });
  const fence = new THREE.Group(); scene.add(fence);
  for (let x = -16; x <= 16; x += 0.32) {
    const p = mesh(facet(new THREE.BoxGeometry(0.14, 1.1, 0.04), 0.004, Math.floor(x * 10)), picket); p.position.set(x, 0.55, 6.2); fence.add(p);
    const tip = mesh(new THREE.ConeGeometry(0.1, 0.12, 4), picket); tip.position.set(x, 1.16, 6.2); tip.rotation.y = Math.PI / 4; fence.add(tip);
  }
  fence.add(box(32, 0.08, 0.05, picket, 0, 0.35, 6.17));
  fence.add(box(32, 0.08, 0.05, picket, 0, 0.85, 6.17));

  // ---- neighbour's trampoline ----
  const tr = new THREE.Group(); tr.position.copy(YARD.tramp); scene.add(tr);
  const pad = mesh(new THREE.TorusGeometry(1.62, 0.11, 6, 36), mat('#2f7fd6', { roughness: 0.6 }));
  pad.rotation.x = Math.PI / 2; pad.position.y = 0.78; tr.add(pad);
  const prof = [];
  for (let i = 0; i <= 10; i++) { const rr = (i / 10) * 1.52; prof.push(new THREE.Vector2(Math.max(rr, 0.001), -Math.pow(1 - (rr / 1.52) ** 2, 1.6))); }
  const matGeo = new THREE.LatheGeometry(prof, 36);
  const tmat = mesh(matGeo, new THREE.MeshStandardMaterial({ color: '#1d1d22', roughness: 0.7, side: THREE.DoubleSide, flatShading: true }));
  tmat.position.y = 0.76; tmat.scale.y = 0.02; tr.add(tmat);
  const steel = new THREE.MeshStandardMaterial({ color: '#a9b0b8', metalness: 0.8, roughness: 0.35 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), steel); l.position.set(Math.cos(a) * 1.6, 0.4, Math.sin(a) * 1.6); tr.add(l);
  }
  const ring = mesh(new THREE.TorusGeometry(1.62, 0.025, 4, 36), steel); ring.rotation.x = Math.PI / 2; ring.position.y = 0.7; tr.add(ring);

  // ---- trees, clouds, neighbour house ----
  const trees = [[-7, -6, 1.3], [-9.5, 2, 1.1], [7.5, -5, 1.4], [10, 3, 1.0], [-6.5, 11, 0.9], [8.5, 12, 1.2], [3, -9, 1.5], [-3, -10, 1.2], [13, -2, 1.3], [-13, 6, 1.4], [-11, 15, 1.1], [12.5, 9, 0.9]];
  trees.forEach(([x, z, s], i) => scene.add(i % 3 === 2 ? makePine(x, z, s, i) : makeTree(x, z, s, i)));
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const cl = makeCloud(i);
    const a = -2.2 + i * 0.75;
    cl.position.set(Math.sin(a) * 120, 38 + (i % 3) * 7, -Math.cos(a) * 120 + 20);
    scene.add(cl); clouds.push(cl);
  }
  const nh = new THREE.Group(); nh.position.set(-15, 0, 10); nh.rotation.y = Math.PI / 2; scene.add(nh);
  const nsid = new THREE.MeshStandardMaterial({ map: TX.siding('#bcd6e6'), roughness: 0.85 });
  nh.add(box(8, 3.2, 6, nsid, 0, 1.6, 0));
  for (const s of [-1, 1]) { const sl = mesh(new THREE.BoxGeometry(8.6, 0.14, 3.9), mat('#4a5568', { roughness: 0.8 })); sl.position.set(0, 4.15, s * 1.6); sl.rotation.x = s * 0.62; nh.add(sl); }

  // ---- lights ----
  const hemi = new THREE.HemisphereLight('#cfe6ff', '#6a9a50', 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d4', 3.1);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#ffd7a8', 0.0); fill.position.set(0, 8, 14); scene.add(fill);

  return { scene, sky, skyU, sun, hemi, fill, tramp: tr, trampMat: tmat, house, brokenWin, clouds, ground };
}

// person-shaped hole for the broken window (cartoon gag)
function silhouetteAlpha() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#000';
  g.beginPath(); g.arc(128, 62, 30, 0, Math.PI * 2); g.fill();
  g.beginPath();
  g.moveTo(80, 95); g.lineTo(176, 95); g.lineTo(236, 40); g.lineTo(250, 58); g.lineTo(178, 140); g.lineTo(170, 190);
  g.lineTo(196, 256); g.lineTo(150, 256); g.lineTo(128, 205); g.lineTo(106, 256); g.lineTo(60, 256); g.lineTo(86, 190);
  g.lineTo(78, 140); g.lineTo(6, 58); g.lineTo(20, 40); g.closePath(); g.fill();
  // jagged cracks
  g.strokeStyle = '#000'; g.lineWidth = 3;
  for (let i = 0; i < 10; i++) { const a = i * 0.63; g.beginPath(); g.moveTo(128 + Math.cos(a) * 70, 130 + Math.sin(a) * 70); g.lineTo(128 + Math.cos(a) * 125, 130 + Math.sin(a) * 125); g.stroke(); }
  const t = new THREE.CanvasTexture(c); return t;
}

function makeTree(x, z, s, seed) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  const trunk = mesh(facet(new THREE.CylinderGeometry(0.16, 0.24, 2.0, 6), 0.03, seed + 500), mat('#6b4a2b', { roughness: 0.9 }));
  trunk.position.y = 1.0; g.add(trunk);
  const greens = ['#3f8f3a', '#4ea145', '#36803a', '#5aae4c'];
  const r = mulberry32(seed + 600);
  for (let i = 0; i < 4; i++) {
    const b = mesh(facet(new THREE.IcosahedronGeometry(0.9 + r() * 0.5, 1), 0.12, seed * 10 + i), mat(greens[(i + seed) % 4], { roughness: 0.85 }));
    b.position.set((r() - 0.5) * 1.2, 2.4 + r() * 0.9, (r() - 0.5) * 1.2); g.add(b);
  }
  return g;
}
function makePine(x, z, s, seed) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), mat('#5e4027')); trunk.position.y = 0.6; g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const c = mesh(facet(new THREE.ConeGeometry(1.3 - i * 0.32, 1.6, 7), 0.08, seed * 7 + i), mat(i % 2 ? '#2f7a3a' : '#2a6c34', { roughness: 0.85 }));
    c.position.y = 1.5 + i * 0.85; g.add(c);
  }
  return g;
}
function makeCloud(seed) {
  const g = new THREE.Group();
  const r = mulberry32(seed + 900);
  const m = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
  for (let i = 0; i < 5; i++) {
    const b = mesh(facet(new THREE.IcosahedronGeometry(4 + r() * 3, 1), 0.6, seed * 13 + i), m, { cast: false, receive: false });
    b.position.set((i - 2) * 4.5 + r() * 2, r() * 2, r() * 3); b.scale.y = 0.6; g.add(b);
  }
  return g;
}
