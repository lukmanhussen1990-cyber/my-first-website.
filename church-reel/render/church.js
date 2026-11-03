// Church set: stone floor, red carpet, pews, stained glass with light beams, candles, cross, altar.
import { THREE, PI, RNG, mat, box, cyl, noiseTex } from './world.js';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';

export const ROWS = [2.0, 3.15, 4.3, 5.45, 6.6, 7.75, 8.9];       // pew z positions (front row first)
export const SEATS = [1.35, 2.1, 2.85, 3.6];                        // |x| of seats on each side

function stainedTex(seed, round = false) {
  const c = document.createElement('canvas'); c.width = 64; c.height = round ? 64 : 160;
  const x = c.getContext('2d'); const r = RNG(seed);
  const cols = ['#e2453c', '#2f6fd6', '#f2c230', '#3fae5a', '#8a4fd0', '#f08a2a', '#36b6c8', '#d84f9a'];
  x.fillStyle = '#1a140e'; x.fillRect(0, 0, c.width, c.height);
  const cs = 8;
  for (let py = 0; py < c.height; py += cs) for (let px = 0; px < c.width; px += cs) {
    x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(px + 1, py + 1, cs - 2, cs - 2);
  }
  // a simple figure / cross motif in the middle
  x.fillStyle = '#fff4c8'; if (!round) { x.fillRect(28, 30, 8, 70); x.fillRect(16, 46, 32, 8); } else { x.fillRect(28, 12, 8, 40); x.fillRect(14, 26, 36, 8); }
  // pointed / round top: cut with transparency
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000'; x.beginPath();
  if (round) x.arc(32, 32, 31, 0, PI * 2);
  else { x.moveTo(0, c.height); x.lineTo(0, 34); x.quadraticCurveTo(0, 0, 32, 0); x.quadraticCurveTo(64, 0, 64, 34); x.lineTo(64, c.height); }
  x.fill();
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildChurch(scene) {
  const S = {}; const G = S.group = new THREE.Group(); scene.add(G);
  const rnd = RNG(5);
  // floor: stone tiles
  const ft = noiseTex(0xb9ada0, 0.1, 16, 3).clone(); ft.needsUpdate = true; ft.repeat.set(7, 12);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.1, 24), new THREE.MeshLambertMaterial({ map: ft })); floor.position.set(0, -0.05, 4); floor.receiveShadow = true; G.add(floor);
  // red carpet
  const ct = noiseTex(0xa8222c, 0.08, 8, 4).clone(); ct.needsUpdate = true; ct.repeat.set(1, 12);
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 15), new THREE.MeshLambertMaterial({ map: ct })); carpet.position.set(0, 0.01, 5.5); carpet.receiveShadow = true; G.add(carpet);
  box(1.56, 0.022, 0.06, 0xd8a83a, 0, 0.012, 5.5 - 7.5, G); for (const sx of [1, -1]) box(0.06, 0.022, 15, 0xd8a83a, 0.75 * sx, 0.013, 5.5, G);
  // walls (plaster), no shadows so the warm light can come in
  const wall = mat(0xe8dcc4, { noise: 0.05, size: 16 });
  for (const sx of [1, -1]) { const w = box(0.4, 9, 24, wall, 6.3 * sx, 4.5, 4, G); w.castShadow = false; }
  box(13, 9, 0.4, mat(0xdcd0b6, { noise: 0.05, size: 16 }), 0, 4.5, -5.6, G).castShadow = false;
  box(13, 9, 0.4, wall, 0, 4.5, 16, G).castShadow = false;
  // stone columns and wooden roof beams
  for (const z of [0.4, 4.0, 7.6, 11.2]) for (const sx of [1, -1]) {
    box(0.7, 7.2, 0.7, mat(0xc8baa2, { noise: 0.08 }), 5.75 * sx, 3.6, z, G);
    box(0.9, 0.3, 0.9, mat(0xb8aa92), 5.75 * sx, 7.25, z, G);
  }
  box(13, 0.3, 24, mat(0x5a3a22), 0, 9.1, 4, G).castShadow = false;
  for (let z = -4; z < 16; z += 2.2) box(12.6, 0.35, 0.35, mat(0x6a4428, { noise: 0.1 }), 0, 8.6, z, G);
  // stained-glass windows (glowing) + coloured light beams + floor patches
  S.windows = [];
  const beamMats = [];
  for (const [i, z] of [1.8, 5.6, 9.4, 13.2].entries()) for (const sx of [1, -1]) {
    const tex = stainedTex(i * 7 + (sx > 0 ? 3 : 0));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    win.position.set(6.09 * sx, 4.6, z); win.rotation.y = -sx * PI / 2; G.add(win); S.windows.push(win);
    box(0.12, 4.2, 0.14, mat(0x9a8a72), 6.08 * sx, 4.5, z - 0.85, G); box(0.12, 4.2, 0.14, mat(0x9a8a72), 6.08 * sx, 4.5, z + 0.85, G);
    if (sx < 0) { // sunlight comes from the left side
      const col = [0xffc070, 0xff9a8a, 0x9ac8ff, 0xffe08a][i % 4];
      const bm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.11, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      beamMats.push(bm);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6.5, 0.05), bm);
      beam.position.set(-3.6, 3.0, z + 0.3); beam.rotation.set(0, 0, -0.75); G.add(beam);
      const beam2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6.5, 0.05), bm); beam2.position.copy(beam.position).add(new THREE.Vector3(0, 0, 0.6)); beam2.rotation.copy(beam.rotation); G.add(beam2);
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      patch.rotation.x = -PI / 2; patch.position.set(-1.6, 0.03, z + 0.5); G.add(patch);
    }
  }
  S.beamMats = beamMats;
  const rose = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: stainedTex(77, true), transparent: true, alphaTest: 0.5 }));
  rose.position.set(0, 6.9, -5.38); G.add(rose);
  // altar platform, steps, cross, altar table, lectern
  box(13, 0.45, 4.6, mat(0xcbbca4, { noise: 0.06, size: 16 }), 0, 0.22, -3.2, G);
  box(5, 0.22, 0.5, mat(0xc0b098), 0, 0.11, -0.65, G);
  const ac = noiseTex(0xa8222c, 0.08, 8, 6); box(4.0, 0.02, 2.2, new THREE.MeshLambertMaterial({ map: ac }), 0, 0.46, -2.4, G);
  const wood = mat(0x7a4a26, { noise: 0.1 });
  box(0.45, 4.6, 0.25, wood, 0, 3.4, -5.3, G); box(2.6, 0.45, 0.25, wood, 0, 4.4, -5.3, G);
  box(2.6, 1.0, 0.9, mat(0xf2ece0), 0, 0.95, -4.0, G); box(2.7, 0.06, 1.0, mat(0xd8a83a), 0, 1.47, -4.0, G);
  const lect = S.lectern = new THREE.Group(); lect.position.set(0, 0.45, -1.15); G.add(lect);
  box(0.16, 1.05, 0.16, wood, 0, 0.52, 0, lect); box(0.6, 0.08, 0.5, wood, 0, 0.05, 0, lect);
  const top = box(0.75, 0.06, 0.55, wood, 0, 1.1, 0.02, lect); top.rotation.x = -0.35;
  const book = S.bible = new THREE.Group(); book.position.set(0, 1.16, 0.0); book.rotation.x = -0.35; lect.add(book);
  for (const sx of [1, -1]) { const pg = box(0.27, 0.025, 0.36, mat(0xf6efdc), 0.14 * sx, 0.02, 0, book); pg.rotation.z = 0.06 * sx; }
  box(0.58, 0.02, 0.38, mat(0x5a1f1f), 0, 0.0, 0, book);
  // candles (tall stands) with warm lights
  S.flames = [];
  const candle = (x, z, h = 1.6, light = true) => {
    const g = new THREE.Group(); g.position.set(x, 0.45, z); G.add(g);
    cyl(0.2, 0.26, 0.08, 8, mat(0xc89a3a), 0, 0.04, 0, g); cyl(0.04, 0.04, h, 6, mat(0xd8aa4a), 0, h / 2, 0, g);
    cyl(0.12, 0.08, 0.06, 8, mat(0xd8aa4a), 0, h, 0, g); cyl(0.06, 0.06, 0.4, 8, mat(0xfbf6e8), 0, h + 0.22, 0, g);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a })); fl.position.y = h + 0.5; g.add(fl);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.y = h + 0.5; g.add(glow);
    S.flames.push({ fl, glow });
    if (light) { const l = new THREE.PointLight(0xffb060, 3.2, 7, 1.6); l.position.set(0, h + 0.6, 0); g.add(l); }
  };
  candle(-2.3, -1.6); candle(2.3, -1.6); candle(-1.2, -3.8, 0.9, false); candle(1.2, -3.8, 0.9, false);
  for (const sx of [1, -1]) for (const z of [2.6, 7.0]) { const g = new THREE.Group(); G.add(g); g.position.set(5.2 * sx, 0, z);
    cyl(0.18, 0.22, 0.08, 8, mat(0xc89a3a), 0, 0.04, 0, g); cyl(0.035, 0.035, 1.3, 6, mat(0xd8aa4a), 0, 0.65, 0, g); cyl(0.05, 0.05, 0.3, 8, mat(0xfbf6e8), 0, 1.45, 0, g);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), new THREE.MeshBasicMaterial({ color: 0xffd36a })); fl.position.y = 1.66; g.add(fl);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.y = 1.66; g.add(glow);
    S.flames.push({ fl, glow }); }
  // pews (merged)
  const pg = []; const pewC = new THREE.Color(0x8a5a32), pewD = new THREE.Color(0x6e4424);
  const add = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z);
    const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); pg.push(g); };
  for (const z of ROWS) for (const sx of [1, -1]) {
    const xc = 2.475 * sx;
    add(3.5, 0.07, 0.48, xc, 0.45, z + 0.02, pewC);                 // seat
    add(3.5, 0.6, 0.07, xc, 0.85, z + 0.3, pewC);                    // backrest
    add(3.5, 0.06, 0.12, xc, 1.17, z + 0.3, pewD);                    // top rail
    add(3.5, 0.06, 0.2, xc, 0.6, z + 0.45, pewD);                     // hymnal shelf behind
    for (const ex of [0.9, 4.05]) { add(0.08, 1.15, 0.62, ex * sx, 0.58, z + 0.1, pewD); }
  }
  const pews = new THREE.Mesh(mergeGeometries(pg), new THREE.MeshLambertMaterial({ vertexColors: true, map: noiseTex(0xffffff, 0.12, 8, 31) }));
  pews.castShadow = true; pews.receiveShadow = true; G.add(pews);
  S.pews = pews;
  return S;
}
