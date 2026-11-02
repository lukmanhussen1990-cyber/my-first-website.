// The New York zoo (shots 33-37): penguin enclosure (rocks, pool, stone nest) in a park, skyscrapers behind.
import * as THREE from 'three';
import { mat, tex, rng, hash1 } from './lib.js';
import { ZOO, PENGUINS } from './layout.js';
import { stoneCanvas, poolCanvas, lawnCanvas, leafyCanvas, towerCanvas, slabCanvas, plasterCanvas } from './set_tex2.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function named(m, n) { m.name = `set.zoo.${n}`; return m; }
function msh(geo, material, n, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; return named(m, n); }

// lumpy rock: icosahedron with hashed vertex offsets
function rockGeo(r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.78 + hash1(Math.round(x * 40) * 3.1 + Math.round(y * 40) * 7.7 + Math.round(z * 40) * 1.3 + seed) * 0.4;
    p.setXYZ(i, x * k, y * k * 0.75, z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function buildZoo() {
  const g = new THREE.Group(); g.name = 'set.zoo';
  const ox = ZOO.x, oz = ZOO.z;
  const T = (c, r = [1, 1]) => tex(c, { repeat: r });
  // park ground
  const grass = msh(new THREE.PlaneGeometry(700, 700), mat(T(lawnCanvas(91), [140, 140]), { rough: 0.95 }), 'park', { cast: false });
  grass.rotation.x = -Math.PI / 2; grass.position.set(ox, -0.01, oz); g.add(grass);
  // enclosure: low stone wall + glass in front (camera side -Z), rocky back
  const stoneM = mat(T(stoneCanvas('#9a958c', 3), [2, 1]), { rough: 0.9 });
  const rockM = mat(T(stoneCanvas('#a8a49c', 5), [2, 2]), { rough: 0.95 });
  const pavM = mat(T(slabCanvas('#b8b2a6', 7), [12, 3]), { rough: 0.95 });
  const pav = msh(new THREE.PlaneGeometry(26, 6), pavM, 'path', { cast: false }); pav.rotation.x = -Math.PI / 2; pav.position.set(ox, 0.005, oz - 7.5); g.add(pav);
  const wall = msh(new THREE.BoxGeometry(18, 0.9, 0.5), stoneM, 'enclosureWall'); wall.position.set(ox, 0.45, oz - 4.3); g.add(wall);
  const glass = msh(new THREE.PlaneGeometry(18, 1.2), new THREE.MeshStandardMaterial({ color: '#cfe6f0', roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: false }), 'glass', { cast: false, receive: false });
  glass.position.set(ox, 1.5, oz - 4.3); glass.rotation.y = Math.PI; glass.userData.noAudit = true; g.add(glass);
  // floor of the enclosure (pale rock) + the pool
  const floor = msh(new THREE.PlaneGeometry(18, 14), mat(T(stoneCanvas('#c9c4ba', 9), [8, 6]), { rough: 0.95 }), 'enclosureFloor', { cast: false });
  floor.rotation.x = -Math.PI / 2; floor.position.set(ox, 0.02, oz + 2.5); g.add(floor);
  const P = ZOO.pool;
  const water = msh(new THREE.CircleGeometry(P.r, 28), mat(T(poolCanvas(), [3, 3]), { rough: 0.05, emissive: '#1a5a7a', emissiveIntensity: 0.25 }), 'pool', { cast: false });
  water.rotation.x = -Math.PI / 2; water.scale.set(1.6, 1, 1); water.position.set(P.x, 0.035, P.z); g.add(water);
  // rocks: a rocky rise behind + rocks around the pool + the little rock the penguins stand on
  const rocks = [];
  const R = rng(17);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2, r = P.r * 1.25 + (R() - 0.5) * 0.4;
    const rx = P.x + Math.cos(a) * r * 1.6, rz = P.z + Math.sin(a) * r;
    if (rz < P.z - 0.4 && rx < P.x + 2.2) continue;      // keep the front of the pool open (penguins + camera)
    const s = 0.35 + R() * 0.5;
    const m = msh(rockGeo(s, i), rockM, 'rock'); m.position.set(rx, s * 0.25, rz); m.rotation.y = R() * 6; g.add(m); rocks.push(m);
  }
  for (let i = 0; i < 9; i++) {      // back rockwork (tall)
    const s = 1.2 + R() * 1.0;
    const m = msh(rockGeo(s, 40 + i), rockM, 'rockBack'); m.position.set(ox - 8 + i * 2.0, s * 0.4, oz + 9.2 + R() * 1.0); g.add(m);
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {      // side rocks
    const s = 0.8 + R() * 0.8;
    const m = msh(rockGeo(s, 60 + i + (sx > 0 ? 9 : 0)), rockM, 'rockSide'); m.position.set(ox + sx * (7.2 + R()), s * 0.4, oz - 2 + i * 3); g.add(m);
  }
  // the penguins' rock ledge (flat-topped) + stone nest
  const ledge = msh(new THREE.CylinderGeometry(1.4, 1.6, 0.25, 9), rockM, 'ledge'); ledge.position.set(PENGUINS.nest[0], 0.125, PENGUINS.nest[1] + 0.2); ledge.scale.set(1.3, 1, 0.9); g.add(ledge);
  const nestM = mat(T(stoneCanvas('#8a8278', 21)), { rough: 0.95 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r = 0.2 + (i % 2) * 0.03;
    const s = msh(new THREE.IcosahedronGeometry(0.045 + (i % 3) * 0.01, 0), nestM, 'nestStone'); s.position.set(PENGUINS.nest[0] + Math.cos(a) * r, 0.27, PENGUINS.nest[1] + Math.sin(a) * r * 0.8); s.rotation.set(i, i * 2, 0); g.add(s);
  }
  // park trees around (blob crowns) + lamp posts + a bench
  const crownM = mat(T(leafyCanvas('#4a7f36', 61)), { rough: 0.9 }), crown2 = mat(T(leafyCanvas('#5c8a3a', 63)), { rough: 0.9 });
  const trunkM = mat(T(stoneCanvas('#6a5040', 65), [1, 3]), { rough: 0.9 });
  const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 1, 7); trunkG.translate(0, 0.5, 0);
  const crownG = new THREE.IcosahedronGeometry(1, 1);
  const trees = [];
  const TR = rng(23);
  for (let i = 0; i < 1100; i++) {
    const near = i < 260;     // a dense band right behind the enclosure (Central Park)
    const x = near ? ox + (TR() - 0.5) * 120 : ox + (TR() - 0.5) * 380, z = near ? oz + 14 + TR() * 60 : oz - 130 + TR() * 238;
    if (Math.abs(x - ox) < 16 && z > oz - 12 && z < oz + 16) continue;      // keep the enclosure clear
    if (Math.abs(x - ox) < 8 && z < oz - 10 && z > oz - 60) continue;        // camera lane in front
    trees.push({ x, z, h: 4 + TR() * 4, r: 2 + TR() * 2.2, k: i % 2 });
  }
  const tI = new THREE.InstancedMesh(trunkG, trunkM, trees.length); tI.name = 'set.zoo.trunks';
  const cI = [new THREE.InstancedMesh(crownG, crownM, trees.length), new THREE.InstancedMesh(crownG, crown2, trees.length)];
  cI[0].name = 'set.zoo.crowns0'; cI[1].name = 'set.zoo.crowns1';
  const M4 = new THREE.Matrix4(), cnt = [0, 0];
  trees.forEach((t, i) => {
    M4.compose(V(t.x, 0, t.z), new THREE.Quaternion(), V(1, t.h, 1)); tI.setMatrixAt(i, M4);
    M4.compose(V(t.x, t.h + t.r * 0.6, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.x, 0)), V(t.r, t.r * 0.85, t.r)); cI[t.k].setMatrixAt(cnt[t.k]++, M4);
  });
  cI[0].count = cnt[0]; cI[1].count = cnt[1];
  for (const m of [tI, ...cI]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  // skyline (New York-ish): towers behind the park, a few very tall ones, one art-deco spire
  const towers = [];
  const SR = rng(29);
  const towerMats = [0, 1, 2, 3, 4, 5].map((k) => mat(tex(towerCanvas({ seed: 100 + k, wall: ['#8a8a92', '#9a8e7e', '#6e7684', '#b0a690', '#7a6a5e', '#9aa2aa'][k], glass: ['#3a4a62', '#4a5470', '#2e3c56', '#50607a', '#3e4658', '#44506a'][k], lit: 0.18 + k * 0.04 }), { repeat: [2, 6] }), { rough: 0.6, emissive: '#ffffff', emissiveIntensity: 0.08 }));
  for (let i = 0; i < 95; i++) {
    const x = ox + (SR() - 0.5) * 480, z = oz + ZOO.skylineZ[0] + SR() * (ZOO.skylineZ[1] - ZOO.skylineZ[0]);
    const tall = SR() < 0.14;
    const h = tall ? 150 + SR() * 110 : 30 + SR() * 75, w = 10 + SR() * 16, d = 10 + SR() * 14;
    const m = msh(new THREE.BoxGeometry(w, h, d), towerMats[i % 6], 'tower', { cast: false }); m.position.set(x, h / 2, z); g.add(m); towers.push(m);
    if (tall && SR() < 0.5) { const top = msh(new THREE.BoxGeometry(w * 0.6, h * 0.12, d * 0.6), towerMats[(i + 2) % 6], 'towerTop', { cast: false }); top.position.set(x, h + h * 0.06, z); g.add(top); }
  }
  // the art-deco spire tower (generic) in the middle of the view
  const deco = new THREE.Group(); deco.position.set(ox + 18, 0, oz + 150); g.add(deco);
  const dm = towerMats[1];
  let y = 0;
  for (const [w, h] of [[30, 90], [24, 60], [18, 70], [12, 40], [7, 25]]) { const b = msh(new THREE.BoxGeometry(w, h, w), dm, 'decoBlock', { cast: false }); b.position.y = y + h / 2; deco.add(b); y += h; }
  const spire = msh(new THREE.ConeGeometry(2.5, 40, 6), mat('#c8c4b8', { rough: 0.4, metal: 0.3 }), 'decoSpire', { cast: false }); spire.position.y = y + 20; deco.add(spire);
  return { group: g, towers, rocks, water };
}
