// Bedroom + hallway set: walls, floor, window, door, furniture (KayKit CC0), lights.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ROOM = { x0: -2.1, x1: 2.1, z0: -2.2, z1: 2.4, h: 2.6, hallX1: 4.5, hallZ0: -0.6, hallZ1: 2.9 };
export const BED = { cx: 0, hw: 0.96, zHead: -2.12, zFoot: 0.02, top: 0.39, zPillow: -1.42, zBoard: -1.9 };   // mattress top surface
export const WIN = { z: -0.75, y: 1.5, w: 1.05, h: 1.35 };                       // bedroom window (left wall)
export const HWIN = { z: 1.15, y: 1.45, w: 0.95, h: 1.3 };                       // hallway window (far wall)
export const DOOR = { z0: 0.7, z1: 1.6, h: 2.05, x: ROOM.x1 };

const loader = new GLTFLoader();

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// deterministic rng
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function woodTexture() {
  const r = rng(7);
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#2b1a10'; g.fillRect(0, 0, w, h);
    const pw = w / 8;
    for (let i = 0; i < 8; i++) {
      let y = -r() * 300;
      while (y < h) {
        const len = 260 + r() * 260, l = 20 + r() * 12;
        g.fillStyle = `hsl(${20 + r() * 8},${38 + r() * 12}%,${l * 0.62}%)`;
        g.fillRect(i * pw + 1.5, y + 1.5, pw - 3, len - 3);
        g.globalAlpha = 0.16;
        for (let k = 0; k < 14; k++) { g.fillStyle = r() > 0.5 ? '#000' : '#a5693a'; g.fillRect(i * pw + r() * pw, y, 1 + r() * 1.5, len); }
        g.globalAlpha = 1; y += len;
      }
    }
  }, [2.2, 2.2]);
}

function skyTexture() {
  const r = rng(99);
  return canvasTex(512, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060b2a'); gr.addColorStop(1, '#1b3a7c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 130; i++) { g.globalAlpha = 0.4 + r() * 0.6; g.fillStyle = '#fff'; const s = r() * 2.2 + 0.6; g.beginPath(); g.arc(r() * w, r() * h, s, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    const mx = w * 0.64, my = h * 0.3, mr = 62;
    const halo = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2); halo.addColorStop(0, 'rgba(200,225,255,0.55)'); halo.addColorStop(1, 'rgba(200,225,255,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4f8ff'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,180,215,0.55)';
    for (const [dx, dy, rr] of [[-18, -12, 13], [20, 14, 9], [-6, 26, 7], [24, -22, 6]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr, 0, 7); g.fill(); }
  });
}

// Map the KayKit atlas to a blue palette (keeps the modelled shading, makes the bed blue).
function blueAtlas(img) {
  return canvasTex(img.width, img.height, (g, w, h) => {
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const l = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255;
      p[i] = 20 + l * 70; p[i + 1] = 55 + l * 120; p[i + 2] = 120 + l * 135;
    }
    g.putImageData(d, 0, 0);
  });
}

function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}

// Wall lying in a plane x = X (normal along X), spanning z0..z1, with an optional rectangular hole.
function wallX(parent, mat, X, z0, z1, h, hole, thick = 0.12, outward = 1) {
  const cx = X + outward * thick / 2;
  if (!hole) { box(thick, h, z1 - z0, mat, cx, h / 2, (z0 + z1) / 2, parent); return; }
  const { a, b, y0, y1 } = hole;
  box(thick, h, a - z0, mat, cx, h / 2, (z0 + a) / 2, parent);
  box(thick, h, z1 - b, mat, cx, h / 2, (b + z1) / 2, parent);
  if (y0 > 0) box(thick, y0, b - a, mat, cx, y0 / 2, (a + b) / 2, parent);
  box(thick, h - y1, b - a, mat, cx, (h + y1) / 2, (a + b) / 2, parent);
}

function makeWindow(parent, X, zc, yc, w, h, inward, mats, open) {
  const g = new THREE.Group(); g.position.set(X, yc, zc); parent.add(g);
  const f = 0.07, d = 0.16;
  // frame
  box(d, f, w + f * 2, mats.trim, 0, h / 2 + f / 2, 0, g); box(d, f, w + f * 2, mats.trim, 0, -h / 2 - f / 2, 0, g);
  box(d, h, f, mats.trim, 0, 0, -w / 2 - f / 2, g); box(d, h, f, mats.trim, 0, 0, w / 2 + f / 2, g);
  box(0.26, 0.05, w + 0.3, mats.trim, inward * 0.06, -h / 2 - f - 0.02, 0, g); // sill
  if (!open) {
    box(0.04, h, 0.04, mats.trim, 0, 0, 0, g); box(0.04, 0.04, w, mats.trim, 0, 0.08, 0, g);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.glass);
    glass.rotation.y = inward * Math.PI / 2; glass.renderOrder = 1; g.add(glass);
  } else {
    // two casement sashes swung outward
    for (const s of [-1, 1]) {
      const sash = new THREE.Group(); sash.position.set(-inward * 0.05, 0, s * w / 2); g.add(sash);
      sash.rotation.y = s * inward * -1.25;
      box(0.04, h, 0.05, mats.trim, 0, 0, -s * 0.025, sash); box(0.04, h, 0.05, mats.trim, 0, 0, -s * (w / 2 - 0.025), sash);
      box(0.04, 0.05, w / 2, mats.trim, 0, h / 2 - 0.025, -s * w / 4, sash); box(0.04, 0.05, w / 2, mats.trim, 0, -h / 2 + 0.025, -s * w / 4, sash);
    }
  }
  // night sky backdrop
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(w * 4.2, h * 3.6), mats.sky);
  sky.position.set(-inward * 1.6, 0.5, 0); sky.rotation.y = inward * Math.PI / 2; g.add(sky);
  return g;
}

export async function buildSet(scene) {
  const set = { };
  const R = ROOM;
  const mats = {
    wall: new THREE.MeshStandardMaterial({ color: 0x9ad21c, roughness: 0.92 }),
    floor: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55, metalness: 0.0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.6 }),
    door: new THREE.MeshStandardMaterial({ color: 0xcfd8e2, roughness: 0.55 }),
    knob: new THREE.MeshStandardMaterial({ color: 0xd9b24a, roughness: 0.3, metalness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fc4ff, roughness: 0.1, transparent: true, opacity: 0.12, depthWrite: false }),
    sky: new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false, toneMapped: false }),
    ceil: new THREE.MeshStandardMaterial({ color: 0xc9d4c0, roughness: 1, side: THREE.FrontSide }),
  };
  set.mats = mats;
  const room = new THREE.Group(); scene.add(room); set.room = room;

  // floor (bedroom + hallway)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.hallX1 - R.x0 + 4, 12), mats.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.set((R.x0 + R.hallX1) / 2, 0, 0.5); floor.receiveShadow = true; room.add(floor);
  // ceiling (single sided: invisible from above for top-down shots)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(R.hallX1 - R.x0, 8), mats.ceil);
  ceil.rotation.x = Math.PI / 2; ceil.position.set((R.x0 + R.hallX1) / 2, R.h, 0.5); room.add(ceil); set.ceil = ceil;

  // walls
  wallX(room, mats.wall, R.x0, R.z0 - 0.12, R.z1, R.h, { a: WIN.z - WIN.w / 2, b: WIN.z + WIN.w / 2, y0: WIN.y - WIN.h / 2, y1: WIN.y + WIN.h / 2 }, 0.12, -1);
  box(R.x1 - R.x0 + 0.24, R.h, 0.12, mats.wall, 0, R.h / 2, R.z0 - 0.06, room);            // back wall
  const doorWall = new THREE.Group(); room.add(doorWall); set.doorWall = doorWall;
  wallX(doorWall, mats.wall, R.x1, R.z0 - 0.12, R.hallZ1, R.h, { a: DOOR.z0, b: DOOR.z1, y0: 0, y1: DOOR.h }, 0.12, 1); // door wall
  wallX(room, mats.wall, R.hallX1, R.hallZ0, R.hallZ1, R.h, { a: HWIN.z - HWIN.w / 2, b: HWIN.z + HWIN.w / 2, y0: HWIN.y - HWIN.h / 2, y1: HWIN.y + HWIN.h / 2 }, 0.12, 1);
  // front wall of bedroom + hallway end walls: single-sided planes so the camera can sit behind them
  const oneSided = new THREE.MeshStandardMaterial({ color: 0x9ad21c, roughness: 0.92, side: THREE.FrontSide });
  const fw = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.h), oneSided); fw.position.set(0, R.h / 2, R.z1); fw.rotation.y = Math.PI; fw.receiveShadow = true; room.add(fw);
  const h0 = new THREE.Mesh(new THREE.PlaneGeometry(R.hallX1 - R.x1, R.h), oneSided); h0.position.set((R.x1 + R.hallX1) / 2, R.h / 2, R.hallZ0); h0.receiveShadow = true; room.add(h0);
  const h1 = new THREE.Mesh(new THREE.PlaneGeometry(R.hallX1 - R.x1, R.h), oneSided); h1.position.set((R.x1 + R.hallX1) / 2, R.h / 2, R.hallZ1); h1.rotation.y = Math.PI; h1.receiveShadow = true; room.add(h1);
  // baseboards
  box(0.03, 0.1, R.z1 - R.z0, mats.trim, R.x0 + 0.015, 0.05, (R.z0 + R.z1) / 2, room, false);
  box(R.x1 - R.x0, 0.1, 0.03, mats.trim, 0, 0.05, R.z0 + 0.015, room, false);
  box(0.03, 0.1, DOOR.z0 - R.z0, mats.trim, R.x1 - 0.015, 0.05, (R.z0 + DOOR.z0) / 2, room, false);
  box(0.03, 0.1, R.z1 - DOOR.z1, mats.trim, R.x1 - 0.015, 0.05, (R.z1 + DOOR.z1) / 2, room, false);

  // windows
  set.window = makeWindow(room, R.x0 - 0.06, WIN.z, WIN.y, WIN.w, WIN.h, 1, mats, false);
  set.hallWindow = makeWindow(room, R.hallX1 + 0.06, HWIN.z, HWIN.y, HWIN.w, HWIN.h, -1, mats, true);

  // door: frame + hinged leaf (hinge on z0 edge, swings into the hallway)
  const dz = (DOOR.z0 + DOOR.z1) / 2, dw = DOOR.z1 - DOOR.z0;
  box(0.2, 0.08, dw + 0.16, mats.trim, DOOR.x + 0.06, DOOR.h + 0.04, dz, doorWall);
  box(0.2, DOOR.h, 0.08, mats.trim, DOOR.x + 0.06, DOOR.h / 2, DOOR.z0 - 0.04, doorWall);
  box(0.2, DOOR.h, 0.08, mats.trim, DOOR.x + 0.06, DOOR.h / 2, DOOR.z1 + 0.04, doorWall);
  const hinge = new THREE.Group(); hinge.position.set(DOOR.x + 0.1, 0, DOOR.z0); doorWall.add(hinge);
  const leaf = box(0.05, DOOR.h - 0.02, dw - 0.02, mats.door, 0, DOOR.h / 2, dw / 2, hinge);
  for (const s of [-1, 1]) {
    for (const [py, ph] of [[1.45, 0.85], [0.52, 0.72]]) box(0.012, ph, dw - 0.3, mats.trim, s * 0.028, py - DOOR.h / 2, 0, leaf, false);
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), mats.knob); k.position.set(s * 0.07, -0.03, dw / 2 - 0.1); k.castShadow = true; leaf.add(k);
  }
  set.doorHinge = hinge;   // rotation.y: 0 closed, negative = swung open into the hallway

  // ---------- furniture (KayKit Furniture Bits, CC0) ----------
  const load = async (n) => (await loader.loadAsync('/assets/furniture/' + n + '.gltf')).scene;
  const prep = (o, tex) => o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (tex) { m.material = m.material.clone(); m.material.map = tex; } m.material.roughness = 0.8; m.material.metalness = 0; } });
  const bed = await load('bed_double_A');
  let atlas = null; bed.traverse((m) => { if (m.isMesh && !atlas) atlas = m.material.map; });
  const blue = blueAtlas(atlas.image); blue.flipY = atlas.flipY;
  prep(bed, blue);
  bed.scale.set(0.62, 0.78, 0.713); bed.position.set(BED.cx, 0, (BED.zHead + BED.zFoot) / 2);
  set.bed = bed; set.blueAtlas = blue; room.add(bed);

  const cab = await load('cabinet_small'); prep(cab); cab.scale.setScalar(0.52); cab.position.set(1.48, 0, -1.9); room.add(cab);
  const lamp = await load('lamp_table'); prep(lamp); lamp.scale.setScalar(0.42); lamp.position.set(1.48, 0.52, -1.92); room.add(lamp);
  const rug = await load('rug_oval_A'); prep(rug, blue); rug.scale.set(0.8, 0.5, 0.8); rug.position.set(0.1, 0.0, 1.05); room.add(rug);
  const pic = await load('pictureframe_large_A'); prep(pic); pic.scale.setScalar(0.75); pic.position.set(1.35, 1.75, R.z0 + 0.01); room.add(pic);
  const pic2 = await load('pictureframe_medium'); prep(pic2); pic2.scale.setScalar(0.6); pic2.position.set(R.x1 - 0.01, 1.6, -0.6); pic2.rotation.y = -Math.PI / 2; doorWall.add(pic2);
  const cactus = await load('cactus_small_A'); prep(cactus); cactus.scale.setScalar(0.45); cactus.position.set(R.x0 + 0.35, 0, 1.6); room.add(cactus);
  set.lamp = lamp;

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xa9c4ff, 0x2a3a20, 1.25); scene.add(hemi); set.hemi = hemi;
  const fill = new THREE.DirectionalLight(0x8fa8ee, 0.9); fill.position.set(1.5, 3, 4); scene.add(fill); set.fill = fill;
  const moon = new THREE.SpotLight(0xa8c8ff, 130, 0, 0.42, 0.55, 1.6);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.02;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 14; moon.shadow.radius = 5; moon.shadow.blurSamples = 12;
  scene.add(moon); scene.add(moon.target); set.moon = moon;
  const lampLight = new THREE.PointLight(0xffb060, 1.6, 3.2, 2); lampLight.position.set(1.48, 0.86, -1.92); scene.add(lampLight); set.lampLight = lampLight;
  set.setMoon = (where) => {
    if (where === 'hall') { moon.position.set(R.hallX1 + 3.2, 3.3, HWIN.z + 0.5); moon.target.position.set(R.x1 + 0.3, 0.9, HWIN.z - 0.1); }
    else { moon.position.set(R.x0 - 3.6, 3.7, WIN.z - 0.6); moon.target.position.set(0.1, 0.4, -0.75); }
    moon.target.updateMatrixWorld();
  };
  set.setMoon('bed');
  return set;
}
