import * as THREE from 'three';
import { mat, box, at } from './materials.js';
import { CONFIG } from './config.js';
import { rng } from './anim.js';

const pal = CONFIG.palette;

// Layout constants shared with the timeline (metres). Wall face is the plane z = 0.
export const WORLD = {
  win: { x: 0, sill: 3.0, top: 3.9, w: 0.9 }, // the bathroom window ("ten feet up")
  bathFloor: 2.36,
  toilet: { x: 0, z: -1.25 },
};

export function buildWorld(scene, set = {}) {
  const inRect = (x, z, r) => r && x > r[0] && x < r[1] && z > r[2] && z < r[3];
  scene.background = new THREE.Color(pal.sky);
  scene.fog = new THREE.Fog(pal.sky, 28, 75);

  // ------------------------------------------------------------ sky dome + stars + moon
  const skyGeo = new THREE.SphereGeometry(90, 24, 12);
  const colors = [];
  const top = new THREE.Color(pal.sky), hor = new THREE.Color(pal.skyHorizon), c = new THREE.Color();
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const h = Math.max(0, pos.getY(i) / 90);
    c.copy(hor).lerp(top, Math.pow(h, 0.55));
    colors.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);

  const r = rng(42);
  const starPos = [];
  for (let i = 0; i < 420; i++) {
    const az = r() * Math.PI * 2, el = 0.12 + r() * 1.3;
    starPos.push(Math.cos(az) * Math.cos(el) * 85, Math.sin(el) * 85, Math.sin(az) * Math.cos(el) * 85);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, fog: false })));

  const moon = new THREE.Mesh(new THREE.CircleGeometry(4.2, 10), new THREE.MeshBasicMaterial({ color: '#fff1c2', fog: false }));
  moon.position.set(-30, 48, 60);
  moon.lookAt(0, 0, 0);
  scene.add(moon);
  const moon2 = moon.clone();
  moon2.position.set(30, 44, -62);
  moon2.lookAt(0, 0, 0);
  scene.add(moon2);

  // ------------------------------------------------------------ lights: warm key, cool fill
  const hemi = new THREE.HemisphereLight('#8fa6ff', '#2e4a25', 1.15);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight('#4a5590', 0.35));
  const key = new THREE.DirectionalLight('#ffd09a', 2.6);
  key.position.set(7, 12, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -9; sc.right = 9; sc.top = 10; sc.bottom = -6; sc.near = 1; sc.far = 40;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  key.target.position.set(0, 1, 1);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#8fa6ff', 1.25);
  rim.position.set(-8, 6, -6);
  scene.add(rim);

  // ------------------------------------------------------------ ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat(pal.grass));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // grass tufts (instanced faceted cones)
  const tuftGeo = new THREE.ConeGeometry(0.035, 0.16, 3);
  tuftGeo.translate(0, 0.08, 0);
  const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshLambertMaterial({ flatShading: true }), 5200);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const greens = [pal.grass, pal.grassDark, pal.grassLight].map((g) => new THREE.Color(g));
  let n = 0;
  for (let i = 0; i < 5200; i++) {
    const x = (r() - 0.5) * 16, z = 0.2 + Math.pow(r(), 1.3) * 11;
    if (x < -1.6 && x > -5.2 && z < 2.4) continue; // patio
    if (set.pool && inRect(x, z, [set.pool[0] - 0.4, set.pool[1] + 0.4, set.pool[2] - 0.4, set.pool[3] + 0.4])) continue;
    if (set.stairs && inRect(x, z, [3.9, 7.1, 0, 1.2])) continue;
    p.set(x, 0, z);
    e.set((r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5);
    q.setFromEuler(e);
    const k = 0.6 + r() * 0.9;
    s.set(k, k * (0.7 + r() * 0.7), k);
    m4.compose(p, q, s);
    tufts.setMatrixAt(n, m4);
    tufts.setColorAt(n, greens[n % 3]);
    n++;
  }
  tufts.count = n;
  tufts.receiveShadow = true;
  scene.add(tufts);

  // terracotta patio by the back door
  for (let ix = 0; ix < 7; ix++) for (let iz = 0; iz < 5; iz++) {
    const t = box(0.47, 0.04, 0.44, (ix + iz) % 2 ? pal.floor : pal.floorAlt);
    t.position.set(-5.0 + ix * 0.5, 0.02, 0.24 + iz * 0.47);
    t.receiveShadow = true;
    t.castShadow = false;
    scene.add(t);
  }

  // ------------------------------------------------------------ house
  const house = new THREE.Group();
  scene.add(house);
  const W = WORLD.win, T = 0.3, H = 6.9, X0 = -9, X1 = 9;
  const wallPart = (x0, x1, y0, y1) => {
    const b = box(x1 - x0, y1 - y0, T, pal.wall);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, -T / 2);
    b.receiveShadow = true;
    house.add(b);
  };
  const wx0 = W.x - W.w / 2, wx1 = W.x + W.w / 2;
  wallPart(X0, wx0, 0, H);
  wallPart(wx1, X1, 0, H);
  wallPart(wx0, wx1, 0, W.sill);
  wallPart(wx0, wx1, W.top, H);
  // plinth + trim band + eaves
  const plinth = box(X1 - X0, 0.36, 0.06, pal.wallTrim);
  plinth.position.set(0, 0.18, 0.03);
  plinth.receiveShadow = true;
  house.add(plinth);
  for (const [a, b] of [[X0, wx0 - 0.3], [wx1 + 0.3, X1]]) {
    const band = box(b - a, 0.14, 0.06, pal.wallTrim);
    band.position.set((a + b) / 2, 4.35, 0.03);
    house.add(band);
  }
  const roof = box(X1 - X0 + 0.8, 0.35, 4.2, pal.roof);
  roof.position.set(0, H + 1.0, -1.5);
  roof.rotation.x = -0.55;
  house.add(roof);
  const fascia = box(X1 - X0 + 0.8, 0.22, 0.12, '#f4efe4');
  fascia.position.set(0, H + 0.05, 0.45);
  house.add(fascia);

  // decorative windows (dark blue glass, white frames)
  const windowAt = (cx, y0, w, h, glass = true) => {
    const g = new THREE.Group();
    const f = pal.windowFrame, d = 0.09;
    g.add(at(box(w + 0.16, 0.1, d, f), 0, -0.05, d / 2));
    g.add(at(box(w + 0.28, 0.08, 0.2, f), 0, -0.1, 0.1)); // sill
    g.add(at(box(w + 0.16, 0.1, d, f), 0, h + 0.05, d / 2));
    g.add(at(box(0.08, h, d, f), -w / 2 - 0.04, h / 2, d / 2));
    g.add(at(box(0.08, h, d, f), w / 2 + 0.04, h / 2, d / 2));
    g.add(at(box(0.06, h, d * 0.8, f), 0, h / 2, d / 2));
    if (glass) {
      const gl = box(w, h, 0.02, pal.glass, { emissive: '#030a26' });
      gl.position.set(0, h / 2, 0.01);
      gl.castShadow = false;
      g.add(gl);
    }
    g.position.set(cx, y0, 0);
    g.traverse((o) => o.isMesh && (o.receiveShadow = true));
    house.add(g);
    return g;
  };
  windowAt(3.4, 1.0, 1.3, 1.3);
  windowAt(-3.4, 4.75, 1.2, 1.3);
  windowAt(3.4, 4.75, 1.2, 1.3);
  windowAt(-6.8, 1.0, 1.2, 1.3);
  windowAt(6.8, 4.75, 1.2, 1.3);

  // back door + porch light (warm practical)
  const door = new THREE.Group();
  door.add(at(box(1.05, 2.15, 0.06, '#3f7f8c'), 0, 1.075, 0.03));
  door.add(at(box(0.8, 0.8, 0.02, '#4d93a0'), 0, 1.55, 0.065));
  door.add(at(box(0.08, 0.08, 0.08, '#e8c35a'), 0.38, 1.05, 0.09));
  door.add(at(box(1.25, 0.1, 0.1, pal.windowFrame), 0, 2.2, 0.05));
  door.position.set(-3.4, 0, 0);
  house.add(door);
  const lamp = box(0.18, 0.26, 0.14, '#fff2c4', { emissive: '#ffcf6a' });
  lamp.position.set(-2.6, 2.45, 0.1);
  house.add(lamp);
  const porch = new THREE.PointLight('#ffb766', 6, 7, 1.4);
  porch.position.set(-2.6, 2.35, 0.5);
  scene.add(porch);

  // bathroom window: frame + see-through glass
  const bw = windowAt(W.x, W.sill, W.w, W.top - W.sill, false);
  bw.children[5].visible = false; // no centre bar: keep the view into the bathroom clear
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W.w, W.top - W.sill),
    new THREE.MeshLambertMaterial({ color: '#7fb0ff', transparent: true, opacity: 0.16, depthWrite: false })
  );
  glass.position.set(W.x, (W.sill + W.top) / 2, -0.02);
  scene.add(glass);

  // ------------------------------------------------------------ bathroom interior (seen through the window)
  const bath = new THREE.Group();
  scene.add(bath);
  const bf = WORLD.bathFloor, bx0 = -1.4, bx1 = 1.4, bz0 = -2.1, bz1 = -0.3;
  const floorT = box(bx1 - bx0, 0.1, bz1 - bz0, pal.floor);
  floorT.position.set(0, bf - 0.05, (bz0 + bz1) / 2);
  floorT.receiveShadow = true;
  bath.add(floorT);
  const tileMat = pal.tile;
  const backWall = box(bx1 - bx0, 2.4, 0.1, tileMat);
  backWall.position.set(0, bf + 1.2, bz0 - 0.05);
  bath.add(backWall);
  for (const x of [bx0 - 0.05, bx1 + 0.05]) {
    const sw = box(0.1, 2.4, bz1 - bz0, '#93cbc4');
    sw.position.set(x, bf + 1.2, (bz0 + bz1) / 2);
    bath.add(sw);
  }
  const ceil = box(bx1 - bx0, 0.1, bz1 - bz0, '#f3efe6');
  ceil.position.set(0, bf + 2.4, (bz0 + bz1) / 2);
  bath.add(ceil);
  // tile grout lines on the back wall
  for (let i = 1; i < 6; i++) bath.add(at(box(bx1 - bx0, 0.012, 0.01, '#7fb7af'), 0, bf + i * 0.4, bz0 + 0.002));
  for (let i = -3; i <= 3; i++) bath.add(at(box(0.012, 2.4, 0.01, '#7fb7af'), i * 0.4, bf + 1.2, bz0 + 0.002));
  // mirror, towel, toilet paper
  bath.add(at(box(0.6, 0.7, 0.03, '#cfe6ff', { emissive: '#22344a' }), -0.85, bf + 1.55, bz0 + 0.03));
  bath.add(at(box(0.35, 0.55, 0.05, '#e65d5d'), 0.95, bf + 1.2, bz0 + 0.04));
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 8), mat('#ffffff'));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0.55, bf + 0.75, bz0 + 0.1);
  bath.add(roll);
  const bulb = new THREE.PointLight('#fff1d6', 5, 5, 1.2);
  bulb.position.set(0, bf + 2.1, -1.0);
  scene.add(bulb);
  bath.traverse((o) => o.isMesh && (o.receiveShadow = true));

  // ------------------------------------------------------------ fences + trees
  const fence = new THREE.Group();
  scene.add(fence);
  const plank = (x, z, rotY, i) => {
    const b = box(0.2, 1.9 + (i % 3) * 0.04, 0.05, i % 2 ? pal.fence : pal.fenceDark);
    b.position.set(x, 0.95, z);
    b.rotation.y = rotY;
    b.receiveShadow = true;
    fence.add(b);
  };
  let i = 0;
  for (let z = 0.2; z < 11; z += 0.22) {
    plank(-8.5, z, Math.PI / 2, i++);
    if (!(set.gate && Math.abs(z - set.gate[1]) < 0.55)) plank(8.5, z, Math.PI / 2, i++);
  }
  if (set.gate) {
    const [gx, gz] = set.gate;
    const g = new THREE.Group();
    g.add(at(box(0.06, 1.95, 1.0, '#f4f1ea'), 0, 0.975, 0));
    g.add(at(box(0.08, 0.6, 0.6, '#d8d2c4'), 0, 0.36, 0)); // doggy-door frame
    g.add(at(box(0.09, 0.5, 0.5, '#2a1d14'), 0, 0.36, 0)); // the hole
    g.add(at(box(0.08, 0.1, 0.1, '#c9a640'), 0.0, 1.0, -0.38)); // latch
    g.position.set(gx, 0, gz);
    g.traverse((o) => o.isMesh && (o.receiveShadow = true));
    fence.add(g);
  }
  for (let x = -8.5; x <= 8.5; x += 0.22) plank(x, 11, 0, i++);
  for (const [x0, x1, z] of [[-8.5, 8.5, 11.05]]) {
    for (const y of [0.4, 1.5]) fence.add(at(box(x1 - x0, 0.1, 0.06, pal.fenceDark), (x0 + x1) / 2, y, z - 0.1));
  }

  const tree = (x, z, sc, dark) => {
    const t = new THREE.Group();
    t.add(at(box(0.3 * sc, 2.2 * sc, 0.3 * sc, pal.trunk), 0, 1.1 * sc, 0));
    const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 * sc, 0), mat(dark ? pal.treeDark : pal.tree));
    c1.position.y = 2.9 * sc;
    const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0 * sc, 0), mat(dark ? pal.tree : pal.treeDark));
    c2.position.set(0.6 * sc, 3.6 * sc, 0.2 * sc);
    t.add(c1, c2);
    t.position.set(x, 0, z);
    t.traverse((o) => o.isMesh && (o.castShadow = true));
    scene.add(t);
  };
  tree(-6.5, 13.5, 1.5, false); tree(-2, 14.5, 1.8, true); tree(3.5, 13.2, 1.4, false); tree(7.5, 14.5, 1.9, true);
  tree(-11, 6, 1.6, true); tree(11, 3, 1.7, false); tree(-11, 1, 1.3, false); tree(11.5, 9, 1.4, true);
  // bushes along the wall
  for (const [x, z, s2] of [[-1.3, 0.5, 0.55], [1.5, 0.45, 0.5], [5.2, 0.5, 0.6], [-7.6, 0.6, 0.65], [7.6, 0.6, 0.55]].filter(([x]) => !(set.stairs && x > 1 && x < 8))) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s2, 0), mat(pal.treeDark));
    b.position.set(x, s2 * 0.6, z);
    b.castShadow = true;
    scene.add(b);
  }

  // ------------------------------------------------------------ optional set pieces
  if (set.pool) {
    const [x0, x1, z0, z1] = set.pool;
    const water = box(x1 - x0, 0.5, z1 - z0, '#2aa7e6', { emissive: '#0a3d66' });
    water.position.set((x0 + x1) / 2, -0.22, (z0 + z1) / 2);
    water.castShadow = false;
    water.receiveShadow = true;
    scene.add(water);
    const r2 = rng(7);
    for (let k = 0; k < 14; k++) {
      const rip = box(0.3 + r2() * 0.5, 0.01, 0.05, '#8fd8ff', { emissive: '#2a6f99' });
      rip.position.set(x0 + 0.3 + r2() * (x1 - x0 - 0.6), 0.035, z0 + 0.2 + r2() * (z1 - z0 - 0.4));
      rip.castShadow = false;
      scene.add(rip);
    }
    const c = '#e9e4da', w = 0.32;
    for (const [cx, cz, sx, sz] of [[(x0 + x1) / 2, z0 - w / 2, x1 - x0 + 2 * w, w], [(x0 + x1) / 2, z1 + w / 2, x1 - x0 + 2 * w, w], [x0 - w / 2, (z0 + z1) / 2, w, z1 - z0], [x1 + w / 2, (z0 + z1) / 2, w, z1 - z0]]) {
      const b = box(sx, 0.08, sz, c);
      b.position.set(cx, 0.04, cz);
      b.receiveShadow = true;
      scene.add(b);
    }
    // ladder rails + a lounger for the rich-house look
    for (const dz of [-0.2, 0.2]) scene.add(at(box(0.04, 0.5, 0.04, '#cfd6dd'), x1 + 0.05, 0.25, z0 + 0.8 + dz));
    const lounger = new THREE.Group();
    lounger.add(at(box(0.7, 0.12, 1.8, '#ffffff'), 0, 0.3, 0), at(box(0.7, 0.12, 0.6, '#ffffff'), 0, 0.55, -0.85));
    lounger.children[1].rotation.x = 0.6;
    lounger.position.set(x0 - 1.4, 0, (z0 + z1) / 2);
    lounger.traverse((o) => o.isMesh && (o.castShadow = true));
    scene.add(lounger);
  }
  if (set.stairs) {
    for (let k = 0; k < 10; k++) {
      const st = box(0.3, (k + 1) * 0.3, 1.0, k % 2 ? '#d9c39a' : '#cfb88d');
      st.position.set(7.0 - k * 0.3 - 0.15, ((k + 1) * 0.3) / 2, 0.6);
      st.receiveShadow = true;
      scene.add(st);
    }
    const bal = box(2.8, 0.16, 1.45, '#cfb88d');
    bal.position.set(2.7, 2.92, 0.72);
    bal.receiveShadow = true;
    scene.add(bal);
    for (let x = 1.35; x <= 4.0; x += 0.33) scene.add(at(box(0.05, 0.9, 0.05, '#ffffff'), x, 3.45, 1.4));
    scene.add(at(box(2.75, 0.07, 0.08, '#ffffff'), 2.68, 3.92, 1.4));
    // bedroom door (open, warm light inside)
    scene.add(at(box(1.0, 2.1, 0.04, '#3b2418', { emissive: '#4a2a10' }), 2.0, 4.05, 0.01));
    scene.add(at(box(1.2, 0.1, 0.1, pal.windowFrame), 2.0, 5.15, 0.05));
    const leaf = at(box(0.06, 2.05, 0.95, '#8a5a3c'), 1.5, 4.03, 0.48);
    scene.add(leaf);
    const glow = new THREE.PointLight('#ffb35c', 3, 4, 1.5);
    glow.position.set(2.0, 4.2, 0.6);
    scene.add(glow);
  }
  if (set.road) {
    const rx = set.road;
    const road = box(5, 0.03, 120, '#3a3d44');
    road.position.set(rx, 0.015, 0);
    road.castShadow = false;
    road.receiveShadow = true;
    scene.add(road);
    for (let z = -58; z < 60; z += 4) scene.add(at(box(0.18, 0.035, 1.8, '#f2d22a'), rx, 0.02, z));
    for (const sx of [-1, 1]) scene.add(at(box(0.12, 0.035, 120, '#f4f4f4'), rx + 2.35 * sx, 0.02, 0));
    const cars = ['#e23b2e', '#2a7fd8', '#f2c230', '#ffffff', '#4fb36a', '#9b59b6'];
    for (let k = 0; k < 9; k++) {
      const car = new THREE.Group();
      const c = cars[k % cars.length];
      car.add(at(box(1.7, 0.6, 3.6, c), 0, 0.55, 0), at(box(1.5, 0.5, 1.9, c), 0, 1.1, -0.2), at(box(1.45, 0.4, 1.8, '#9fd0ff', { emissive: '#1d3d5a' }), 0, 1.1, -0.2));
      for (const [wx, wz] of [[-0.85, 1.2], [0.85, 1.2], [-0.85, -1.2], [0.85, -1.2]]) car.add(at(box(0.25, 0.5, 0.5, '#1b1b1b'), wx, 0.25, wz));
      car.add(at(box(0.3, 0.15, 0.05, '#ffe9a8', { emissive: '#ffcc55' }), -0.5, 0.6, 1.81), at(box(0.3, 0.15, 0.05, '#ffe9a8', { emissive: '#ffcc55' }), 0.5, 0.6, 1.81));
      car.position.set(rx + (k % 2 ? 1.2 : -1.2), 0, -16 - Math.floor(k / 2) * 5.2);
      car.traverse((o) => o.isMesh && (o.castShadow = true));
      scene.add(car);
    }
    for (let z = -40; z < 40; z += 9) {
      scene.add(at(box(0.15, 4, 0.15, '#9aa3ad'), rx + 3.4, 2, z), at(box(1.2, 0.12, 0.3, '#9aa3ad'), rx + 2.9, 4, z), at(box(0.4, 0.1, 0.3, '#fff4c2', { emissive: '#ffd27a' }), rx + 2.5, 3.93, z));
    }
  }
  if (set.planet) {
    const [px, py, pz] = set.planet;
    const pl = new THREE.Group();
    pl.add(new THREE.Mesh(new THREE.IcosahedronGeometry(5, 2), mat('#2a6fd8')));
    const r3 = rng(9);
    for (let k = 0; k < 9; k++) {
      const land = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + r3() * 1.3, 1), mat(k % 3 ? '#4caf3a' : '#3f9a2c'));
      const a = r3() * Math.PI * 2, b = (r3() - 0.5) * 2.4;
      land.position.set(Math.cos(a) * Math.cos(b) * 4.15, Math.sin(b) * 4.15, Math.sin(a) * Math.cos(b) * 4.15);
      land.scale.set(1, 0.55, 1);
      land.lookAt(0, 0, 0);
      land.rotateX(Math.PI / 2);
      pl.add(land);
    }
    // the giant sleeping-bag lump, visible from space
    // the giant pants tube lying on the surface, visible from space
    const n = new THREE.Vector3(0.12, 0.62, 0.78).normalize();
    const lump = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 5.2, 8), mat('#2f8f4e'));
    lump.position.copy(n).multiplyScalar(5.15);
    lump.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0).sub(n.clone().multiplyScalar(n.x)).normalize());
    pl.add(lump);
    const tip = n.clone().multiplyScalar(5.2).add(new THREE.Vector3(2.6, 0, 0));
    pl.add(at(box(0.08, 0.7, 0.08, '#f4f4f4'), tip.x, tip.y + 0.4, tip.z));
    pl.add(at(box(0.5, 0.3, 0.03, '#e23b2e'), tip.x + 0.25, tip.y + 0.6, tip.z));
    const sat = new THREE.Group();
    sat.add(box(0.4, 0.4, 0.6, '#d9d9d9'), at(box(1.4, 0.04, 0.5, '#2a4fa8', { emissive: '#0d1e4a' }), 0, 0, 0));
    sat.position.set(-4.5, 3.5, 5.5);
    sat.rotation.set(0.4, 0.6, 0.2);
    pl.add(sat);
    pl.position.set(px, py, pz);
    pl.traverse((o) => o.isMesh && (o.castShadow = false));
    scene.add(pl);
  }
  return { key, hemi, glass };
}
