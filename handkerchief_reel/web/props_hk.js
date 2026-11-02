// Small hand props owned by the cast: the pink silk HANDKERCHIEF (animated cloth), its faded old twin, the leaf and
// the bus ticket YOU finds, and the bodyguard's huge tissue. Pure functions of their state p + t.
//   prop.p = { visible, pos:[x,y,z], rot:[x,y,z] (Euler YXZ) | quat, mode, k, ... }   (reset every frame)
// Hands grip them through userData.grip = { pos, axis, up } in prop space (see cast.js gripFrame).
// The handkerchief's local frame: origin = the pinched corner; it hangs toward -Y.
import * as THREE from 'three';
import { paint, tex, clamp, lerp, smooth, hash1, noise1 } from './lib.js';

const S = 0.34;                // handkerchief size (m)
const N = 12;                  // grid segments

function silkCanvas(old) {
  const base = old ? [214, 160, 176] : [246, 120, 172], gold = old ? [196, 168, 110] : [240, 196, 70];
  return paint(32, 32, (x, y) => {
    const e = Math.min(x, y, 31 - x, 31 - y);
    if (e < 2) {                                         // gold edge with a little stitch pattern
      const d = ((x + y) % 3 === 0) ? 22 : 0;
      return [gold[0] + d, gold[1] + d, gold[2] + d * 0.5];
    }
    if (e === 2) return [base[0] - 30, base[1] - 30, base[2] - 30];
    let sh = Math.sin((x + y * 0.4) * 0.55) * 9 + (hash1(x * 31 + y * 17) - 0.5) * 8;
    if (!old && x > 4 && x < 9 && y > 4 && y < 9 && (x + y) % 2 === 0) sh += 30;          // tiny embroidered heart corner
    let c = [base[0] + sh, base[1] + sh, base[2] + sh];
    if (old) {                                           // faded + a few brownish spots (old, never washed)
      for (const [sx, sy, r] of [[12, 15, 3], [20, 9, 2], [9, 22, 2], [22, 21, 3]]) {
        const d = Math.hypot(x - sx, y - sy);
        if (d < r) c = [c[0] - 50 + d * 6, c[1] - 62 + d * 7, c[2] - 66 + d * 7];
      }
    }
    return c;
  });
}

function makeCloth(name, old) {
  const g = new THREE.PlaneGeometry(1, 1, N, N);
  const mat = new THREE.MeshStandardMaterial({ map: tex(silkCanvas(old)), roughness: old ? 0.75 : 0.3, metalness: old ? 0 : 0.12,
    emissive: new THREE.Color(old ? '#000000' : '#5a1030'), emissiveIntensity: old ? 0 : 0.35, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  const grp = new THREE.Group(); grp.name = `${name}.grp`; grp.add(m);
  grp.userData.grip = { pos: [0, 0.01, 0], axis: [1, 0, 0], up: [0, 0, 1] };
  grp.userData.cloth = m;
  return grp;
}

// cloth shape (local coords, origin at the pinched corner) for grid point (u, v) in [0,1]^2
function clothPos(mode, u, v, t, k, out) {
  if (mode === 'float') {                              // spread out, slow undulating silk drifting in the air
    const x = (u - 0.5) * S, y = (v - 0.5) * S * 0.9;
    const w = Math.sin(2 * Math.PI * (u * 0.9 + v * 0.5 - t * 0.35)) * 0.045 + Math.sin(2 * Math.PI * (v * 1.3 - t * 0.27) + 1.3) * 0.03;
    out.set(x + Math.sin(2 * Math.PI * (v - t * 0.3)) * 0.015, y + w * 0.3, w);
    return;
  }
  if (mode === 'held') {                               // held out by one corner (straight arm), the rest hangs + flutters
    const d = (u + v) / 2;                             // 0 at the pinch, 1 at the far corner
    const x = (u - v) * S * 0.42 * (0.35 + 0.65 * d);
    const y = -d * S * 1.25;
    const z = Math.sin(2 * Math.PI * (d * 1.2 - t * 0.9) + u * 2) * 0.025 * d * (1 + k) + (u - v) * 0.02;
    out.set(x + Math.sin(t * 2.1 + d * 3) * 0.01 * d, y, z);
    return;
  }
  if (mode === 'crumpled') {                           // stiff + crumpled (the old one in a hand)
    const x = (u - 0.5) * S * 0.8, y = (v - 0.5) * S * 0.8;
    const n = noise1(u * 7 + v * 13, 3) * 0.03 + noise1(u * 13 - v * 5, 7) * 0.02;
    out.set(x, y, n);
    return;
  }
  out.set((u - 0.5) * S, (v - 0.5) * S, 0);           // flat
}

function leafCanvas() {
  return paint(16, 24, (x, y) => {
    const u = (x - 7.5) / 7.5, v = y / 23;
    const w = Math.sin(Math.PI * v) * (1 - v * 0.2);
    if (Math.abs(u) > w) return [0, 0, 0, 0];
    if (Math.abs(u) < 0.09 || (Math.abs(Math.abs(u) - (v * 0.6 % 0.3) * 2) < 0.08 && v > 0.2)) return [140, 200, 90];
    return [70 + (hash1(x * 7 + y) - 0.5) * 20, 140 + (hash1(x + y * 9) - 0.5) * 20, 50];
  });
}

export function buildHandheld(world) {
  const group = new THREE.Group(); group.name = 'handheld'; world.scene.add(group);
  const hanky = makeCloth('hanky', false), hankyOld = makeCloth('hankyOld', true);
  group.add(hanky, hankyOld);
  // leaf (YOU's "toilet paper" option #1)
  const lm = new THREE.MeshStandardMaterial({ map: tex(leafCanvas()), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
  const leafG = new THREE.PlaneGeometry(0.11, 0.16); leafG.translate(0, 0.08, 0);
  const leaf = new THREE.Group(); leaf.name = 'leaf'; const lmesh = new THREE.Mesh(leafG, lm); lmesh.castShadow = true; leaf.add(lmesh); group.add(leaf);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 4), new THREE.MeshStandardMaterial({ color: '#5a7a30' })); st.position.y = -0.015; leaf.add(st);
  leaf.userData.grip = { pos: [0, -0.02, 0], axis: [1, 0, 0], up: [0, 0, 1] };
  // crumpled bus ticket (blank paper, no text)
  const tg = new THREE.PlaneGeometry(0.07, 0.04, 4, 3);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (hash1(i * 3.7) - 0.5) * 0.008); tg.computeVertexNormals(); }
  tg.translate(0, 0.02, 0);
  const ticket = new THREE.Group(); ticket.name = 'ticket';
  const tmesh = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: '#e8dcb8', roughness: 0.9, side: THREE.DoubleSide }));
  ticket.add(tmesh); group.add(ticket);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.008), new THREE.MeshStandardMaterial({ color: '#c86a3a', side: THREE.DoubleSide }));
  stripe.position.set(0, 0.033, 0.001); ticket.add(stripe);
  ticket.userData.grip = { pos: [0, -0.002, 0], axis: [1, 0, 0], up: [0, 0, 1] };
  // the bodyguard's huge white tissue
  const sg = new THREE.PlaneGeometry(0.34, 0.34, 6, 6);
  { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (hash1(i * 5.1) - 0.5) * 0.04); sg.computeVertexNormals(); }
  sg.translate(0, 0.14, 0);
  const tissue = new THREE.Group(); tissue.name = 'tissue';
  const smesh = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#f6f6f2', roughness: 0.95, side: THREE.DoubleSide })); smesh.castShadow = true;
  tissue.add(smesh); group.add(tissue);
  tissue.userData.grip = { pos: [0, 0, 0], axis: [1, 0, 0], up: [0, 0, 1] };

  // a tiny fly (for the framed handkerchief): black body, flapping see-through wings
  const fly = new THREE.Group(); fly.name = 'fly';
  const fb = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4 }));
  fb.scale.set(1, 0.8, 1.4); fly.add(fb);
  const fh = new THREE.Mesh(new THREE.SphereGeometry(0.007, 5, 4), fb.material); fh.position.z = 0.016; fly.add(fh);
  const wm = new THREE.MeshBasicMaterial({ color: '#d8e8f4', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  fly.userData.wings = [-1, 1].map((sd) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.026), wm); w.position.set(sd * 0.01, 0.008, -0.004); w.rotation.x = -Math.PI / 2; fly.add(w); return w; });
  group.add(fly);
  const items = { hanky, hankyOld, leaf, ticket, tissue, fly };
  const def = () => ({ visible: false, pos: [0, 0, 0], rot: [0, 0, 0], quat: null, mode: 'held', k: 0, scale: 1, t0: 0 });
  for (const it of Object.values(items)) it.p = def();
  const tmp = new THREE.Vector3();
  const api = {
    group, ...items, items,
    reset() { for (const it of Object.values(items)) { it.p = def(); it.visible = false; } },
    // place props now (shots call this before reading grips; the cast commit calls it again)
    place() {
      for (const it of Object.values(items)) {
        const p = it.p; it.visible = p.visible;
        if (!p.visible) continue;
        it.position.set(...p.pos);
        if (p.quat) it.quaternion.copy(p.quat); else it.rotation.set(p.rot[0], p.rot[1], p.rot[2], 'YXZ');
        it.scale.setScalar(p.scale);
        it.updateMatrixWorld(true);
      }
    },
    commit(t) {
      api.place();
      if (fly.visible) fly.userData.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.3 + 0.6 * Math.abs(Math.sin(t * 90))); });
      for (const it of [hanky, hankyOld]) {
        if (!it.p.visible) continue;
        const pos = it.userData.cloth.geometry.attributes.position;
        let i = 0;
        for (let iy = 0; iy <= N; iy++) for (let ix = 0; ix <= N; ix++, i++) {
          const u = ix / N, v = iy / N;
          clothPos(it.p.mode, u, v, t - it.p.t0, it.p.k, tmp);
          pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
        }
        pos.needsUpdate = true; it.userData.cloth.geometry.computeVertexNormals();
      }
    },
  };
  return api;
}
