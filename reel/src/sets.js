// Sets: street (day / red sky) and house (living room + kitchen + front door).
// Textures come from procedural canvases unless an image asset with the same key was loaded (GPT Image swap-in).
import * as THREE from 'three';
import * as T from './textures.js';
import { lowSphere } from './rig.js';

export const ASSETS = {}; // key -> HTMLImageElement (filled by main.js from assets/images/*.png)

export function tex(key, fallback, opts = {}) {
  const img = ASSETS[key];
  const src = img || fallback();
  const t = T.toTexture(src, opts);
  return t;
}

const lam = (map, o = {}) => new THREE.MeshLambertMaterial({ map, ...o });
const col = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// Box whose UVs are scaled to world size so tiled textures keep a constant texel density.
function worldBox(w, h, d, map, texSize, x, y, z, o = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const su = ax > 0.5 ? d : w, sv = ay > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * su / texSize, uv.getY(i) * sv / texSize);
  }
  const m = new THREE.Mesh(g, lam(map, o));
  m.position.set(x, y, z);
  return m;
}

function plane(w, h, mat, x, y, z, rx = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0);
  return m;
}

function billboardBush(scene, map, x, z, s, y = 0) {
  const mat = new THREE.MeshLambertMaterial({ map, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  for (const r of [0, Math.PI / 2]) {
    const p = plane(s * 1.3, s, mat, x, y + s / 2, z, 0, r + (x * 0.37) % 1);
    scene.add(p);
  }
}

function tree(scene, foliage, bark, x, z, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.6 * s, 6), lam(bark, { flatShading: true }));
  trunk.position.set(x, 1.3 * s, z);
  scene.add(trunk);
  const R = T.rng(Math.floor(x * 13 + z * 7));
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), lam(foliage, { flatShading: true }));
    const r = (1.0 + R() * 0.7) * s;
    c.scale.set(r * 1.1, r * 0.9, r);
    c.position.set(x + (R() - 0.5) * 1.6 * s, (3.0 + R() * 1.4) * s, z + (R() - 0.5) * 1.2 * s);
    c.rotation.set(R() * 3, R() * 3, R() * 3);
    scene.add(c);
  }
}

// ---------------------------------------------------------------- street
export function buildStreet() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#d6e4ef', 30, 110);
  const hemi = new THREE.HemisphereLight('#e6f2ff', '#a08c68', 2.1);
  const sun = new THREE.DirectionalLight('#fff2da', 2.4);
  sun.position.set(-6, 10, 7);
  scene.add(hemi, sun);

  const sky = { day: tex('sky_day', () => T.skyCanvas({ mode: 'day' }), { nearest: false }), red: T.toTexture(T.skyCanvas({ mode: 'red' }), { nearest: false }) };
  for (const k in sky) { sky[k].wrapT = THREE.ClampToEdgeWrapping; }
  const skyMat = new THREE.MeshBasicMaterial({ map: sky.day, side: THREE.BackSide, fog: false });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skyMat);
  skyMesh.position.y = -8;
  scene.add(skyMesh);

  const asphalt = tex('asphalt_texture', () => T.asphaltCanvas());
  const concrete = tex('sidewalk_texture', () => T.concreteCanvas());
  const grass = tex('grass_texture', () => T.grassCanvas());
  const brick = tex('brick_texture', () => T.brickCanvas());
  const bushMap = tex('dry_bush', () => T.bushCanvas(), { mip: true });
  const foliage = tex('tree_foliage', () => T.foliageCanvas());
  const bark = T.toTexture(T.solidCanvas('#5a4632', 4, 30));

  // ground layers (z grows toward the camera; houses at negative z)
  const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 18), lam(asphalt));
  asphalt.repeat.set(30, 6);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 5);
  scene.add(road);
  scene.add(worldBox(90, 0.13, 0.2, concrete, 1.5, 0, 0.065, -4.0));
  scene.add(worldBox(90, 0.13, 1.9, concrete, 1.9, 0, 0.065, -5.05));
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 9.5), lam(grass));
  grass.repeat.set(26, 3);
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.11, -10.7);
  scene.add(lawn);
  // painted lane line (faded)
  const line = plane(90, 0.12, col('#d8d2b0'), 0, 0.004, 3.6, -Math.PI / 2);
  scene.add(line);

  // houses
  const frameMat = col('#efece4', { flatShading: true });
  const glassMat = new THREE.MeshLambertMaterial({ color: '#3b4a5a', emissive: '#1c2733' });
  const woodMat = col('#5b3d2a', { flatShading: true });
  const roofMat = lam(T.toTexture(T.solidCanvas('#5d5a58', 12, 26), { repeat: [4, 4] }), { flatShading: true });
  const houseXs = [-19, -9.5, 0.5, 10.5, 20];
  houseXs.forEach((hx, i) => {
    const w = 8.6, h = i % 2 ? 6.4 : 5.8, d = 8, z = -19;
    scene.add(worldBox(w, h, d, brick, 1.7, hx, h / 2 + 0.1, z));
    const front = z + d / 2;
    for (let fl = 0; fl < 2; fl++) {
      for (const cx of [-2.7, 0, 2.7]) {
        if (fl === 0 && cx === 0) continue;
        const wy = fl === 0 ? 1.7 : 4.2;
        scene.add(box(1.15, 1.45, 0.1, frameMat, hx + cx, wy, front + 0.04));
        scene.add(box(0.95, 1.25, 0.1, glassMat, hx + cx, wy, front + 0.07));
        scene.add(box(0.08, 1.25, 0.1, frameMat, hx + cx, wy, front + 0.1));
        scene.add(box(0.95, 0.07, 0.1, frameMat, hx + cx, wy, front + 0.1));
      }
    }
    scene.add(box(1.1, 2.2, 0.12, woodMat, hx, 1.2, front + 0.05));
    // porch: slab on wooden posts
    scene.add(box(w * 0.82, 0.16, 2.2, woodMat, hx, 2.95, front + 1.1));
    for (const px of [-0.4, -0.13, 0.13, 0.4]) scene.add(box(0.2, 2.85, 0.2, woodMat, hx + px * w * 0.8, 1.52, front + 2.05));
    scene.add(box(w * 0.82, 0.12, 2.2, col('#8a8a86'), hx, 0.16, front + 1.1));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w * 0.78, 2.4, d * 0.78);
    roof.position.set(hx, h + 0.1 + 1.2, z);
    scene.add(roof);
    // bushes along the facade and lawn edge
    for (let k = 0; k < 7; k++) billboardBush(scene, bushMap, hx - 3.8 + k * 1.25, front + 0.6 + (k % 2) * 0.25, 0.9 + (k % 3) * 0.2, 0.1);
    for (let k = 0; k < 3; k++) billboardBush(scene, bushMap, hx - 2.5 + k * 2.6, -6.5, 0.7 + (k % 2) * 0.3, 0.1);
  });
  // low brick garden wall on a couple of lots (reference street detail)
  scene.add(worldBox(8, 0.9, 0.3, brick, 1.7, -9.5, 0.55, -6.3));
  scene.add(worldBox(8, 0.9, 0.3, brick, 1.7, 10.5, 0.55, -6.3));
  // trees behind / between houses
  for (const [x, z, s] of [[-14, -24, 1.4], [-4.5, -25, 1.6], [5.5, -24, 1.3], [15.5, -25, 1.5], [-24, -14, 1.2], [26, -15, 1.3], [-1, -27, 1.8]]) tree(scene, foliage, bark, x, z, s);
  // utility pole
  scene.add(box(0.22, 9, 0.22, woodMat, 6.2, 4.5, -4.3));
  scene.add(box(2.4, 0.16, 0.16, woodMat, 6.2, 8.4, -4.3));

  return {
    scene, hemi, sun,
    setMood(mode) {
      if (mode === 'red') {
        skyMat.map = sky.red; scene.fog.color.set('#4a0808'); scene.fog.near = 14; scene.fog.far = 70;
        hemi.color.set('#ffb0a0'); hemi.groundColor.set('#6a2a2a'); hemi.intensity = 2.1;
        sun.color.set('#ff7a5a'); sun.intensity = 2.2;
      } else {
        skyMat.map = sky.day; scene.fog.color.set('#d6e4ef'); scene.fog.near = 30; scene.fog.far = 110;
        hemi.color.set('#e6f2ff'); hemi.groundColor.set('#a08c68'); hemi.intensity = 2.1;
        sun.color.set('#fff2da'); sun.intensity = 2.4;
      }
    },
  };
}

// ---------------------------------------------------------------- house
function paintingCanvas() {
  const c = T.canvas(64, 48), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, '#9cc0d8'); g.addColorStop(0.55, '#e8dcc0'); g.addColorStop(0.56, '#6f8a4a'); g.addColorStop(1, '#3f5a2a');
  x.fillStyle = g; x.fillRect(0, 0, 64, 48);
  x.fillStyle = '#4a6a34'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(8 + i * 11, 26, 6 + (i % 3) * 2, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#efe6d6'; x.fillRect(38, 22, 10, 8); x.fillStyle = '#8a3a2a'; x.beginPath(); x.moveTo(36, 22); x.lineTo(43, 16); x.lineTo(50, 22); x.fill();
  return c;
}
function clockCanvas() {
  const c = T.canvas(64, 64), x = c.getContext('2d');
  x.fillStyle = '#f7f5ef'; x.beginPath(); x.arc(32, 32, 31, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#222'; x.lineWidth = 3; x.stroke();
  x.fillStyle = '#222';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.fillRect(32 + Math.sin(a) * 25 - 1, 32 - Math.cos(a) * 25 - 1, 3, 3); }
  x.lineWidth = 3; x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + 12, 32 - 6); x.moveTo(32, 32); x.lineTo(32 - 4, 32 - 20); x.stroke();
  return c;
}
function outsideCanvas() {
  const c = T.canvas(64, 64), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#bfe0f6'); g.addColorStop(0.5, '#e6f2fa'); g.addColorStop(0.55, '#5f8a3a'); g.addColorStop(1, '#7da04a');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#3f6a2a'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(i * 8, 33, 7, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#e8e8e8'; x.fillRect(40, 26, 18, 8);
  return c;
}
function bagCanvas() {
  const c = T.canvas(64, 96), x = c.getContext('2d');
  x.fillStyle = '#d9472b'; x.fillRect(0, 0, 64, 96);
  x.fillStyle = '#f7d046'; x.fillRect(0, 18, 64, 22);
  x.fillStyle = '#fff'; x.font = 'bold 15px Anton, sans-serif'; x.textAlign = 'center'; x.fillText('MEOW', 32, 35);
  x.fillStyle = '#7a4a24'; for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(10 + (i * 17) % 46, 58 + Math.floor(i / 3) * 7, 3, 0, Math.PI * 2); x.fill(); }
  return c;
}

export function buildHouse() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a2a2a');
  const hemi = new THREE.HemisphereLight('#fff6ea', '#8a6a52', 2.0);
  const sun = new THREE.DirectionalLight('#fff0d4', 1.6);
  sun.position.set(2, 5, 4);
  const lampLight = new THREE.PointLight('#ffd9a0', 1.5, 6, 1.6);
  lampLight.position.set(-2.55, 1.35, -2.1);
  scene.add(hemi, sun, lampLight);

  const wall = tex('wallpaper_texture', () => T.wallpaperCanvas());
  const floor = tex('wood_floor_texture', () => T.woodFloorCanvas());
  const rug = tex('rug_texture', () => T.rugCanvas());
  const leather = tex('sofa_leather_texture', () => T.leatherCanvas());
  const yellowKnit = T.toTexture(T.clothCanvas({ base: '#d9a92a', kind: 'knit', seed: 9 }), { repeat: [3, 3] });
  const whiteMat = col('#f2efe8', { flatShading: true });
  const darkWood = col('#5a3020', { flatShading: true });

  // living room shell: x [-3, 3], z [-2.5, 2.5]
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), lam(floor));
  floor.repeat.set(5, 4);
  fl.rotation.x = -Math.PI / 2;
  scene.add(fl);
  const ceil = plane(12, 6, col('#f4f1ea'), 1.5, 2.6, 0, Math.PI / 2);
  scene.add(ceil);
  const wallMat = lam(wall);
  wall.repeat.set(1, 1);
  const wTile = 0.9; // metres per wallpaper tile
  // back wall with a window opening (x 0.5..2.1, y 0.9..2.1)
  scene.add(worldBox(3.5, 2.6, 0.12, wall, wTile, -1.25, 1.3, -2.56));
  scene.add(worldBox(0.9, 2.6, 0.12, wall, wTile, 2.55, 1.3, -2.56));
  scene.add(worldBox(1.6, 0.9, 0.12, wall, wTile, 1.3, 0.45, -2.56));
  scene.add(worldBox(1.6, 0.5, 0.12, wall, wTile, 1.3, 2.35, -2.56));
  scene.add(plane(1.6, 1.2, new THREE.MeshBasicMaterial({ map: T.toTexture(outsideCanvas()) }), 1.3, 1.5, -2.75));
  for (const [w, h, x, y] of [[1.72, 0.08, 1.3, 2.1], [1.72, 0.1, 1.3, 0.9], [0.08, 1.2, 0.5, 1.5], [0.08, 1.2, 2.1, 1.5], [0.05, 1.2, 1.3, 1.5]]) scene.add(box(w, h, 0.16, whiteMat, x, y, -2.52));
  // left wall with front door (z -0.55..0.55)
  scene.add(worldBox(0.12, 2.6, 1.95, wall, wTile, -3.06, 1.3, -1.53));
  scene.add(worldBox(0.12, 2.6, 1.95, wall, wTile, -3.06, 1.3, 1.53));
  scene.add(worldBox(0.12, 0.45, 1.1, wall, wTile, -3.06, 2.38, 0));
  scene.add(plane(1.1, 2.15, new THREE.MeshBasicMaterial({ map: T.toTexture(outsideCanvas()) }), -3.3, 1.08, 0, 0, Math.PI / 2));
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-3.0, 0, 0.53);
  const door = box(0.07, 2.12, 1.04, col('#6e2a1c', { flatShading: true }), 0, 1.07, -0.52);
  const knob = new THREE.Mesh(lowSphere(0.03, 0.03, 0.03, 6, 4), col('#d8b04a'));
  knob.position.set(0.06, 1.0, -0.92);
  for (const [y, h] of [[0.6, 0.75], [1.55, 0.75]]) door.add(box(0.02, h, 0.7, col('#5a2016', { flatShading: true }), 0.04, y - 1.07, 0));
  doorPivot.add(door, knob);
  scene.add(doorPivot);
  for (const [w, h, d, x, y, z] of [[0.14, 2.2, 0.08, -2.98, 1.1, 0.6], [0.14, 2.2, 0.08, -2.98, 1.1, -0.6], [0.14, 0.08, 1.28, -2.98, 2.18, 0]]) scene.add(box(w, h, d, whiteMat, x, y, z));
  // right wall with kitchen opening (z -1.4..0.4)
  scene.add(worldBox(0.12, 2.6, 1.1, wall, wTile, 3.06, 1.3, -1.95));
  scene.add(worldBox(0.12, 2.6, 2.1, wall, wTile, 3.06, 1.3, 1.45));
  scene.add(worldBox(0.12, 0.4, 1.8, wall, wTile, 3.06, 2.4, -0.5));
  // front wall (behind camera for most shots)
  scene.add(worldBox(6.2, 2.6, 0.12, wall, wTile, 0, 1.3, 2.56));
  // baseboards
  for (const [w, d, x, z] of [[6, 0.03, 0, -2.49], [0.03, 5, -2.99, 0], [0.03, 5, 2.99, 0], [6, 0.03, 0, 2.49]]) scene.add(box(w, 0.12, d, whiteMat, x, 0.06, z));

  // rug
  const rugM = plane(2.7, 1.9, lam(rug), -0.9, 0.004, -0.75, -Math.PI / 2);
  scene.add(rugM);
  // chesterfield sofa
  const sofa = new THREE.Group();
  const lmat = lam(leather, { flatShading: true });
  leather.repeat.set(3, 1);
  sofa.add(worldBox(2.2, 0.36, 0.9, leather, 0.55, 0, 0.24, 0, { flatShading: true }));
  sofa.add(worldBox(1.02, 0.16, 0.72, leather, 0.55, -0.53, 0.5, 0.06, { flatShading: true }));
  sofa.add(worldBox(1.02, 0.16, 0.72, leather, 0.55, 0.53, 0.5, 0.06, { flatShading: true }));
  sofa.add(worldBox(2.2, 0.5, 0.22, leather, 0.55, 0, 0.68, -0.36, { flatShading: true }));
  for (const sd of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 8), lmat);
    arm.rotation.x = Math.PI / 2; arm.position.set(sd * 1.05, 0.62, 0);
    sofa.add(arm);
    sofa.add(worldBox(0.24, 0.4, 0.9, leather, 0.55, sd * 1.05, 0.3, 0, { flatShading: true }));
  }
  for (const [x, z] of [[-1, 0.38], [1, 0.38], [-1, -0.38], [1, -0.38]]) sofa.add(box(0.08, 0.06, 0.08, darkWood, x, 0.03, z));
  // throw pillow
  const pillow = worldBox(0.42, 0.34, 0.14, yellowKnit, 0.5, 0.75, 0.73, -0.15, { flatShading: true });
  pillow.rotation.set(-0.2, 0, 0.12);
  sofa.add(pillow);
  sofa.position.set(-1.0, 0, -1.98);
  scene.add(sofa);
  // yellow armchair
  const chair = new THREE.Group();
  chair.add(worldBox(0.85, 0.42, 0.8, yellowKnit, 0.5, 0, 0.36, 0, { flatShading: true }));
  chair.add(worldBox(0.85, 0.6, 0.18, yellowKnit, 0.5, 0, 0.82, -0.32, { flatShading: true }));
  for (const sd of [-1, 1]) chair.add(worldBox(0.16, 0.26, 0.8, yellowKnit, 0.5, sd * 0.42, 0.66, 0, { flatShading: true }));
  for (const [x, z] of [[-0.35, 0.3], [0.35, 0.3], [-0.35, -0.3], [0.35, -0.3]]) chair.add(box(0.05, 0.15, 0.05, col('#b08050'), x, 0.075, z));
  chair.position.set(2.15, 0, -1.55); chair.rotation.y = -0.6;
  scene.add(chair);
  // side table + lamp
  scene.add(box(0.5, 0.6, 0.5, darkWood, -2.55, 0.3, -2.1));
  scene.add(box(0.08, 0.35, 0.08, col('#c8b080'), -2.55, 0.78, -2.1));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.3, 10, 1, true), new THREE.MeshLambertMaterial({ color: '#f6ead0', emissive: '#7a6a40', side: THREE.DoubleSide }));
  shade.position.set(-2.55, 1.08, -2.1);
  scene.add(shade);
  // painting + clock
  scene.add(box(1.0, 0.75, 0.05, col('#8a6a2a', { flatShading: true }), -1.0, 1.75, -2.48));
  scene.add(plane(0.88, 0.63, lam(T.toTexture(paintingCanvas())), -1.0, 1.75, -2.45));
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16), [col('#333'), lam(T.toTexture(clockCanvas())), col('#333')]);
  clock.rotation.x = Math.PI / 2; clock.position.set(2.0, 2.0, -2.47);
  clock.rotation.y = Math.PI; // face +z
  scene.add(clock);
  // plant
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 8), col('#9a9a96', { flatShading: true })).translateX(0.3).translateY(0.16).translateZ(-2.2));
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.75 + (i % 3) * 0.12, 3), col(i % 2 ? '#4f7a3a' : '#6a8f44', { flatShading: true }));
    leaf.position.set(0.3 + Math.sin(i * 2.1) * 0.06, 0.62, -2.2 + Math.cos(i * 2.1) * 0.06);
    leaf.rotation.set(Math.cos(i * 2.1) * 0.25, 0, -Math.sin(i * 2.1) * 0.25);
    scene.add(leaf);
  }

  // ---------------- kitchen: x [3, 7], z [-2.5, 1.5]
  const checker = tex('kitchen_floor_texture', () => T.checkerCanvas());
  checker.repeat.set(4, 4);
  const kf = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), lam(checker));
  kf.rotation.x = -Math.PI / 2; kf.position.set(5, 0.001, -0.5);
  scene.add(kf);
  const paint = col('#e6e2c6');
  scene.add(box(4, 2.6, 0.12, paint, 5, 1.3, -2.56));
  scene.add(box(0.12, 2.6, 4, paint, 7.06, 1.3, -0.5));
  const tiles = tex('tiles_texture', () => T.tilesCanvas());
  tiles.repeat.set(10, 2);
  scene.add(plane(3.6, 0.6, lam(tiles), 5.0, 1.2, -2.49));
  const mint = col('#8fd0bd', { flatShading: true });
  const mintDark = col('#7bbfaa', { flatShading: true });
  scene.add(box(3.6, 0.88, 0.62, mint, 5.0, 0.44, -2.2));
  for (let i = 0; i < 6; i++) scene.add(box(0.52, 0.66, 0.02, mintDark, 3.5 + i * 0.6, 0.47, -1.88));
  scene.add(box(3.7, 0.05, 0.68, col('#d8c8a8', { flatShading: true }), 5.0, 0.905, -2.18));
  scene.add(box(3.6, 0.7, 0.38, mint, 5.0, 1.95, -2.32));
  for (let i = 0; i < 6; i++) scene.add(box(0.52, 0.6, 0.02, mintDark, 3.5 + i * 0.6, 1.95, -2.12));
  scene.add(box(0.75, 1.9, 0.7, col('#f2f2ee', { flatShading: true }), 6.55, 0.95, -0.9));
  // table + gingham cloth + chairs
  const ging = tex('tablecloth_texture', () => T.ginghamCanvas());
  ging.repeat.set(2, 2);
  scene.add(box(1.3, 0.05, 0.9, lam(ging), 5.1, 0.76, 0.35));
  for (const [w, d, x, z] of [[1.3, 0.02, 5.1, 0.8], [1.3, 0.02, 5.1, -0.1], [0.02, 0.9, 4.45, 0.35], [0.02, 0.9, 5.75, 0.35]]) scene.add(box(w, 0.26, d, lam(ging), x, 0.62, z));
  for (const [x, z] of [[4.55, -0.05], [5.65, -0.05], [4.55, 0.75], [5.65, 0.75]]) scene.add(box(0.05, 0.5, 0.05, col('#a0703a'), x, 0.25, z));
  // pear + orange on the table
  scene.add(new THREE.Mesh(lowSphere(0.05, 0.065, 0.05, 6, 5), col('#c8c03a', { flatShading: true })).translateX(5.0).translateY(0.84).translateZ(0.3));
  scene.add(new THREE.Mesh(lowSphere(0.05, 0.05, 0.05, 6, 5), col('#e8862a', { flatShading: true })).translateX(5.15).translateY(0.83).translateZ(0.36));

  // food bowl on the floor + kibble (kibble count set per frame)
  const bowl = new THREE.Group();
  const bowlProfile = [[0.0, 0.0], [0.09, 0.0], [0.11, 0.015], [0.12, 0.05], [0.105, 0.052], [0.09, 0.02], [0.0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y));
  bowl.add(new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 10), col('#d9443a', { flatShading: true, side: THREE.DoubleSide })));
  const kibble = [];
  const R = T.rng(77);
  for (let i = 0; i < 40; i++) {
    const k = new THREE.Mesh(lowSphere(0.011, 0.008, 0.011, 5, 3), col(i % 3 ? '#8a5a2a' : '#6a4220', { flatShading: true }));
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.075;
    k.position.set(Math.cos(a) * r, 0.025 + (i / 40) * 0.022, Math.sin(a) * r);
    k.rotation.set(R() * 3, R() * 3, R() * 3);
    k.visible = false;
    bowl.add(k);
    kibble.push(k);
  }
  bowl.position.set(3.75, 0, -1.45);
  scene.add(bowl);
  const waterBowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 10), col('#4a8ad0', { flatShading: true, side: THREE.DoubleSide }));
  waterBowl.position.set(4.05, 0, -1.5);
  scene.add(waterBowl);
  // food bag (held by the human)
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.07), [col('#c03a22'), col('#c03a22'), col('#c03a22'), col('#c03a22'), lam(T.toTexture(bagCanvas())), col('#c03a22')]);
  scene.add(bag);
  bag.visible = false;

  // clipboard (the "study" prop)
  const clip = new THREE.Group();
  clip.add(box(0.24, 0.32, 0.012, col('#a0703a', { flatShading: true }), 0, 0, 0));
  clip.add(box(0.2, 0.26, 0.004, col('#f8f6ee'), 0, -0.015, 0.008));
  clip.add(box(0.08, 0.03, 0.02, col('#c0c0c0', { flatShading: true }), 0, 0.15, 0.01));
  for (let i = 0; i < 5; i++) clip.add(box(0.14, 0.008, 0.002, col('#5a6a8a'), 0, 0.06 - i * 0.04, 0.011));
  clip.visible = false;
  scene.add(clip);

  return {
    scene, hemi, sun, doorPivot, bowl, kibble, bag, clip,
    setKibble(n) { kibble.forEach((k, i) => { k.visible = i < n; }); },
    setDoor(open) { doorPivot.rotation.y = -open * 1.4; },
  };
}
