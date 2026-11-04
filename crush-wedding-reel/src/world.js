// Church interior + exterior steps, lighting rig, props, reusable FX sprites.
import * as THREE from 'three';
import * as T from './tex.js';
import { Character, rbox, icoGeo, stdMat } from './char.js';
import { rng } from './util.js';

export const ROWS = [-28, -22, -16, -10, -4, 2, 8, 14, 20];
export const SEATS_X = [7.2, 11.2, 15.2];
export const SEAT_TOP = 1.6;
export const ALTAR_Y = 1.2;
export const STEP = (i) => ({ z0: 34.6 + 1.5 * i, z1: 36.1 + 1.5 * i, top: -0.8 * (i + 1) });

// box with UVs scaled to world units so tiling textures keep a constant texel size
function uvBox(w, h, d, tile = 8) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  return g;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
function extrudeWithDoor(outline, thickness, tile) {
  const s = new THREE.Shape(); outline.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const hole = new THREE.Path();
  hole.moveTo(-4.5, 0); hole.lineTo(4.5, 0); hole.lineTo(4.5, 11); hole.absarc(0, 11, 4.5, 0, Math.PI, false); hole.lineTo(-4.5, 0);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 20 });
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  return g;
}

export function buildWorld(scene, quality) {
  const W = { chars: {}, guests: [], fx: {}, lights: {}, props: {} };
  const root = new THREE.Group(); scene.add(root);
  const interior = new THREE.Group(); root.add(interior);
  const exterior = new THREE.Group(); root.add(exterior);
  W.interior = interior; W.exterior = exterior;

  // ---------- materials
  const floorMat = stdMat({ map: T.woodFloor(), roughness: 0.55 });
  const wallMat = stdMat({ map: T.plaster(), roughness: 0.85 });
  const wainMat = stdMat({ map: T.wainscot(), roughness: 0.6 });
  const pewMat = stdMat({ map: T.pewWood(), roughness: 0.45 });
  const carpetMat = stdMat({ map: T.carpet(), roughness: 0.9 });
  const stoneMat = stdMat({ map: T.stone('#e2d3b4'), roughness: 0.85 });
  const stepMat = stdMat({ map: T.stone('#c8c0b2', 'step'), roughness: 0.85 });
  const goldMat = stdMat({ color: '#e0b24a', metalness: 0.85, roughness: 0.3 });
  const ceilMat = stdMat({ map: T.pewWood(), color: '#a07050', roughness: 0.7 });

  // ---------- interior shell
  mesh(uvBox(36, 0.4, 88, 8), floorMat, 0, -0.2, -12, interior).receiveShadow = true;
  for (const sx of [-1, 1]) {
    mesh(uvBox(1, 30, 86, 8), wallMat, sx * 18.5, 14, -12, interior).receiveShadow = true;
    const wn = mesh(uvBox(0.4, 3.4, 84, 4), wainMat, sx * 17.9, 1.7, -12, interior); wn.receiveShadow = true;
  }
  mesh(uvBox(38, 30, 1, 8), wallMat, 0, 14, -54.5, interior).receiveShadow = true;
  mesh(uvBox(38, 1, 88, 8), ceilMat, 0, 28.5, -12, interior);
  for (let z = -50; z <= 28; z += 6) mesh(uvBox(36, 1.0, 0.9, 4), pewMat, 0, 27.6, z, interior);
  for (let z = -46; z <= 26; z += 12) for (const sx of [-1, 1]) {
    const p = mesh(uvBox(1.4, 28, 1.4, 4), wallMat, sx * 17.6, 14, z, interior); p.receiveShadow = true;
    mesh(uvBox(1.8, 0.8, 1.8, 2), wainMat, sx * 17.6, 3.6, z, interior);
  }
  // back wall (interior face) with door hole
  const backIn = new THREE.Mesh(extrudeWithDoor([[-19, -0.5], [19, -0.5], [19, 29], [-19, 29]], 0.8, 8), wallMat);
  backIn.position.z = 30.0; interior.add(backIn); backIn.receiveShadow = true;
  const wainBack = mesh(uvBox(13.5, 3.4, 0.4, 4), wainMat, -11.25, 1.7, 29.8, interior);
  mesh(uvBox(13.5, 3.4, 0.4, 4), wainMat, 11.25, 1.7, 29.8, interior);
  // door frame (interior)
  const frameMat = stdMat({ map: T.pewWood(), color: '#c08a60' });
  mesh(rbox(0.8, 11, 0.6, 1, 0.1), frameMat, -4.9, 5.5, 29.7, interior);
  mesh(rbox(0.8, 11, 0.6, 1, 0.1), frameMat, 4.9, 5.5, 29.7, interior);
  const archIn = new THREE.Mesh(new THREE.TorusGeometry(4.9, 0.4, 6, 24, Math.PI), frameMat); archIn.position.set(0, 11, 29.7); interior.add(archIn);

  // altar
  mesh(uvBox(36, 0.6, 2.5, 4), carpetMat.clone(), 0, 0.3, -35.75, interior);
  const plat = mesh(uvBox(36, 1.2, 17.5, 8), floorMat, 0, 0.6, -45.75, interior); plat.receiveShadow = true;
  const stepTop = mesh(uvBox(36, 0.62, 2.5, 8), floorMat, 0, 0.3, -35.75, interior); stepTop.receiveShadow = true;
  const altarCarpet = mesh(new THREE.BoxGeometry(8, 0.06, 18.5), carpetMat, 0, 1.23, -45.5, interior); altarCarpet.receiveShadow = true;
  const runner = mesh(new THREE.BoxGeometry(6.0, 0.06, 64.6), carpetMat, 0, 0.03, -2.5, interior); runner.receiveShadow = true;
  // carpet texture repeats along length
  const ct = T.carpet(); ct.repeat.set(1, 1);
  runner.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 1) a[i] = v * 12; });
  // altar table + cross + candles
  const tableMat = stdMat({ color: '#f6f0e2', map: T.fabric('#f6f0e2', { pattern: 'lace', c2: '#e2d8c4' }) });
  mesh(rbox(7, 3.2, 2.6, 2, 0.1), tableMat, 0, 2.8, -51, interior).castShadow = true;
  mesh(rbox(0.3, 1.6, 0.2, 1, 0.05), goldMat, 0, 3.0, -49.6, interior);
  mesh(rbox(1.0, 0.3, 0.2, 1, 0.05), goldMat, 0, 3.3, -49.6, interior);
  W.flames = [];
  const flameTex = T.iconTex('flame');
  const flameMat = new THREE.SpriteMaterial({ map: flameTex, color: '#ffffff', transparent: true, depthWrite: false });
  flameMat.color.setScalar(3.0);
  const addCandle = (x, y, z, h = 0.8, parent = interior, scale = 0.38) => {
    mesh(new THREE.CylinderGeometry(0.12, 0.12, h, 8), stdMat({ color: '#fff8e8', emissive: '#ffd9a0', emissiveIntensity: 0.25 }), x, y + h / 2, z, parent);
    const f = new THREE.Sprite(flameMat); f.scale.set(scale * 0.66, scale, 1); f.position.set(x, y + h + scale * 0.4, z); parent.add(f); W.flames.push(f);
    return f;
  };
  for (const x of [-2.6, -1.3, 1.3, 2.6]) addCandle(x, 4.4, -51, 0.9);
  for (const sx of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.18, 0.4, 7, 8), goldMat, sx * 8, 1.2 + 3.5, -46, interior);
    mesh(new THREE.CylinderGeometry(0.7, 0.3, 0.4, 8), goldMat, sx * 8, 8.4, -46, interior);
    addCandle(sx * 8, 8.6, -46, 1.6, interior, 0.6);
  }

  // flowers (instanced): arch, vases, pew ends
  const flowers = [];
  const fr = rng(42);
  const petalCols = ['#ff7aa2', '#ffffff', '#ff4766', '#ffc8d8', '#ffe0ea', '#fff4c8', '#ff9db8'];
  const leafCols = ['#4f9a3c', '#3e8a35', '#66b04a'];
  for (let i = 0; i < 190; i++) {
    const a = fr() * Math.PI;
    const R = 6.4 + (fr() - 0.5) * 1.2;
    const x = Math.cos(a) * R, y = ALTAR_Y + Math.sin(a) * 11.5 + (fr() - 0.5) * 0.8;
    const leaf = fr() < 0.32;
    flowers.push({ p: [x, y, -46.8 + (fr() - 0.5) * 1.2], s: leaf ? 0.45 + fr() * 0.3 : 0.5 + fr() * 0.38, c: leaf ? leafCols[i % 3] : petalCols[i % petalCols.length] });
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 26; i++) {
    const a = fr() * Math.PI * 2, rr = fr() * 1.4;
    flowers.push({ p: [sx * 11 + Math.cos(a) * rr, 5.6 + fr() * 1.6, -40 + Math.sin(a) * rr], s: 0.45 + fr() * 0.3, c: fr() < 0.3 ? leafCols[i % 3] : petalCols[i % petalCols.length] });
  }
  for (const sx of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(1.0, 0.6, 2.2, 8), goldMat, sx * 11, 1.2 + 3.5, -40, interior);
    mesh(new THREE.CylinderGeometry(0.4, 0.6, 2.6, 8), goldMat, sx * 11, 1.2 + 1.3, -40, interior);
  }
  for (const z of ROWS) for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) flowers.push({ p: [sx * 5.0, 3.4 + fr() * 0.7, z + 0.1 + (fr() - 0.5) * 0.9], s: 0.26 + fr() * 0.14, c: i < 2 ? leafCols[i] : petalCols[(i * 3) % petalCols.length] });
  }
  {
    const im = new THREE.InstancedMesh(icoGeo(1, 0), stdMat({ color: '#ffffff', flatShading: true, roughness: 0.55 }), flowers.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    flowers.forEach((f, i) => {
      e.set(fr() * 3, fr() * 3, fr() * 3); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(...f.p), q, new THREE.Vector3(f.s, f.s * 0.85, f.s)); im.setMatrixAt(i, m4);
      im.setColorAt(i, new THREE.Color(f.c));
    });
    im.castShadow = false; im.receiveShadow = true; interior.add(im);
  }
  // pew-end ribbons
  {
    const bows = new THREE.InstancedMesh(rbox(0.5, 0.36, 0.14, 1, 0.05), stdMat({ color: '#ffffff' }), ROWS.length * 4);
    const m4 = new THREE.Matrix4(); let k = 0;
    for (const z of ROWS) for (const sx of [-1, 1]) for (const d of [-1, 1]) {
      m4.compose(new THREE.Vector3(sx * 4.95, 3.0, z + 0.1 + d * 0.28), new THREE.Quaternion().setFromEuler(new THREE.Euler(d * 0.6, Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1));
      bows.setMatrixAt(k++, m4);
    }
    interior.add(bows);
  }
  // petals on the carpet
  {
    const n = 260; const pr = rng(9);
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.7 }), n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const z = -34 + pr() * 63, x = (pr() - 0.5) * 5.2 * (pr() < 0.85 ? 1 : 1.6);
      m4.compose(new THREE.Vector3(x, 0.08, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + (pr() - 0.5) * 0.3, 0, pr() * 6)), new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(['#ff6f9a', '#ffffff', '#ff3d5e', '#ffc2d6'][i % 4]));
    }
    im.receiveShadow = true; interior.add(im);
    // petals on the altar too
  }

  // pews
  {
    const geos = [];
    const seat = uvBox(12.0, 0.35, 2.3, 4), back = uvBox(12.0, 2.3, 0.32, 4), end = uvBox(0.36, 3.2, 2.9, 4), skirt = uvBox(12.0, 0.9, 0.16, 4);
    for (const z of ROWS) for (const sx of [-1, 1]) {
      const cx = sx * 11.2;
      const g = new THREE.Group(); g.position.set(cx, 0, z); interior.add(g);
      mesh(seat, pewMat, 0, SEAT_TOP - 0.175, 0, g);
      mesh(back, pewMat, 0, SEAT_TOP + 1.15, 1.2, g).rotation.x = 0.06;
      mesh(end, pewMat, -6.0, 1.6, 0.1, g); mesh(end, pewMat, 6.0, 1.6, 0.1, g);
      mesh(skirt, pewMat, 0, 0.9, -1.0, g);
      mesh(uvBox(12.2, 0.18, 0.5, 4), pewMat, 0, SEAT_TOP + 2.35, 1.25, g);
      g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    }
  }

  // stained-glass windows + light shafts
  const glassMats = [0, 1, 2].map((s) => new THREE.MeshStandardMaterial({ map: T.stainedGlass(s + 1), emissiveMap: T.stainedGlass(s + 1), emissive: '#ffffff', emissiveIntensity: 1.6, alphaTest: 0.5, transparent: false, roughness: 0.3 }));
  W.glassMats = glassMats;
  const winZ = [-40, -28, -16, -4, 8, 20];
  winZ.forEach((z, i) => {
    for (const sx of [-1, 1]) {
      const w = mesh(new THREE.PlaneGeometry(5, 10), glassMats[(i + (sx > 0 ? 1 : 0)) % 3], sx * 17.95, 13.5, z, interior);
      w.rotation.y = -sx * Math.PI / 2;
      const sill = mesh(uvBox(0.8, 0.4, 5.6, 2), stoneMat, sx * 17.7, 8.3, z, interior);
    }
  });
  for (const sx of [-1, 1]) { const w = mesh(new THREE.PlaneGeometry(4.5, 9), glassMats[2], sx * 9, 14, -53.95, interior); }
  const rose = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32), new THREE.MeshStandardMaterial({ map: T.roseWindow(), emissiveMap: T.roseWindow(), emissive: '#ffffff', emissiveIntensity: 1.8, alphaTest: 0.5 }));
  rose.position.set(0, 18.5, -53.95); interior.add(rose);
  const roseRing = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.4, 6, 32), stoneMat); roseRing.position.copy(rose.position); interior.add(roseRing);
  // transom over doors (interior side)
  const transom = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24, 0, Math.PI), new THREE.MeshStandardMaterial({ map: T.roseWindow(), emissiveMap: T.roseWindow(), emissive: '#ffffff', emissiveIntensity: 1.3, side: THREE.DoubleSide }));
  transom.position.set(0, 11.05, 30.6); transom.rotation.y = Math.PI; interior.add(transom);

  // light shafts (additive) from left windows
  W.shafts = [];
  const shaftMat = new THREE.MeshBasicMaterial({ map: T.shaftTex(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: '#ffe2b0', fog: false });
  winZ.forEach((z) => {
    for (const rot of [0, Math.PI / 2]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 30), shaftMat);
      const g = new THREE.Group(); g.position.set(-17.5, 13.5, z); g.rotation.z = -0.95; g.rotation.y = 0.15; s.position.y = -15; s.rotation.y = rot; g.add(s); interior.add(g); W.shafts.push(g);
    }
  });
  // floating dust motes
  {
    const n = 500, pr = rng(19), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (pr() - 0.5) * 34; pos[i * 3 + 1] = pr() * 22 + 1; pos[i * 3 + 2] = -50 + pr() * 78; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    W.motesBase = pos.slice();
    const m = new THREE.PointsMaterial({ size: 0.12, color: '#fff2cc', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, map: T.glowTex() });
    W.motes = new THREE.Points(g, m); interior.add(W.motes);
  }

  // chandeliers
  W.chandeliers = [];
  for (const z of [-24, -6, 12]) {
    const g = new THREE.Group(); g.position.set(0, 19.5, z); interior.add(g);
    mesh(new THREE.CylinderGeometry(0.08, 0.08, 8.5, 6), goldMat, 0, 4.25, 0, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.14, 6, 24), goldMat); ring.rotation.x = Math.PI / 2; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 6, 18), goldMat); ring2.rotation.x = Math.PI / 2; ring2.position.y = 1.0; g.add(ring2);
    mesh(icoGeo(0.6, 0), goldMat, 0, 0.2, 0, g);
    mesh(new THREE.ConeGeometry(0.5, 1.2, 8), goldMat, 0, -0.8, 0, g);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), goldMat, Math.cos(a) * 1.2, 0.0, Math.sin(a) * 1.2, g).rotation.set(Math.sin(a) * 1.5, 0, -Math.cos(a) * 1.5);
      addCandle(Math.cos(a) * 2.4, 0.15, Math.sin(a) * 2.4, 0.6, g, 0.42);
      const cr = mesh(icoGeo(0.12, 0), stdMat({ color: '#e8f6ff', emissive: '#bfe6ff', emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.1 }), Math.cos(a + 0.3) * 2.0, -0.5, Math.sin(a + 0.3) * 2.0, g);
    }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; addCandle(Math.cos(a) * 1.3, 1.1, Math.sin(a) * 1.3, 0.5, g, 0.34); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowTex(), color: '#ffcf8a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(8, 8, 1); glow.position.y = 0.4; g.add(glow); glow.material.opacity = 0.3;
    W.chandeliers.push(g);
  }

  // doors
  const doorMat = stdMat({ map: T.doorWood(), roughness: 0.55 });
  W.doors = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 4.5, 0, 30.6); root.add(pivot);
    const panel = new THREE.Mesh(rbox(4.48, 11, 0.45, 1, 0.06), doorMat); panel.position.set(-sx * 2.24, 5.5, 0); pivot.add(panel);
    // arched top piece (half of the semicircle)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(4.48, 4.48, 0.45, 16, 1, false, sx < 0 ? Math.PI : Math.PI / 2, Math.PI / 2), doorMat);
    top.rotation.x = Math.PI / 2; top.position.set(-sx * 4.5, 11, 0); pivot.add(top);
    const ringM = stdMat({ color: '#2e2a26', metalness: 0.7, roughness: 0.4 });
    for (const zz of [0.3, -0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 6, 14), ringM); r.position.set(-sx * 3.7, 5.2, zz); pivot.add(r); }
    // wreath (exterior side)
    const wr = new THREE.Group(); wr.position.set(-sx * 2.4, 7.2, 0.42); pivot.add(wr);
    const wt = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.28, 6, 14), stdMat({ color: '#4f9a3c', flatShading: true })); wr.add(wt);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; mesh(icoGeo(0.24, 0), stdMat({ color: petalCols[i % 4], flatShading: true }), Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.2, wr); }
    pivot.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    W.doors.push(pivot);
  }
  W.setDoors = (aL, aR = aL) => { W.doors[0].rotation.y = -aL; W.doors[1].rotation.y = aR; };
  // bright doorway backdrop seen from inside when the doors open
  const outsideGlow = new THREE.Mesh(new THREE.PlaneGeometry(10, 16), new THREE.MeshBasicMaterial({ color: '#fff3dc', fog: false }));
  outsideGlow.position.set(0, 7, 45); outsideGlow.rotation.y = Math.PI; interior.add(outsideGlow); W.outsideGlow = outsideGlow;

  // ---------- exterior
  const facade = new THREE.Mesh(extrudeWithDoor([[-24, -4.2], [24, -4.2], [24, 30], [0, 44], [-24, 30]], 0.9, 8), stoneMat);
  facade.position.z = 30.8; exterior.add(facade); facade.receiveShadow = true;
  for (const sx of [-1, 1]) {
    const pil = mesh(rbox(1.2, 12.2, 1.3, 1, 0.12), stoneMat, sx * 5.3, 5.3, 31.9, exterior); pil.castShadow = true;
    mesh(rbox(2.4, 30, 2.4, 1, 0.1), stoneMat, sx * 23, 11, 31.9, exterior);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.6, 6, 24, Math.PI), stoneMat); arch.position.set(0, 11.2, 31.9); exterior.add(arch); arch.castShadow = true;
  const roseExt = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshStandardMaterial({ map: T.roseWindow(), emissiveMap: T.roseWindow(), emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.2 }));
  roseExt.position.set(0, 24, 31.75); exterior.add(roseExt);
  const roseExtR = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.55, 6, 32), stoneMat); roseExtR.position.set(0, 24, 31.8); exterior.add(roseExtR);
  const transOut = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24, 0, Math.PI), new THREE.MeshStandardMaterial({ map: T.roseWindow(), emissiveMap: T.roseWindow(), emissive: '#ffffff', emissiveIntensity: 0.2 }));
  transOut.position.set(0, 11.05, 31.0); exterior.add(transOut);
  for (const sx of [-1, 1]) {
    const w = mesh(new THREE.PlaneGeometry(4, 8), new THREE.MeshStandardMaterial({ map: T.stainedGlass(sx > 0 ? 2 : 3), emissiveMap: T.stainedGlass(sx > 0 ? 2 : 3), emissive: '#ffffff', emissiveIntensity: 0.25, alphaTest: 0.5 }), sx * 13, 15, 31.75, exterior);
  }
  // bell turret
  mesh(uvBox(5, 7, 5, 4), stoneMat, 0, 46, 28, exterior);
  const roofCone = mesh(new THREE.ConeGeometry(4.2, 7, 4), stdMat({ color: '#7a3b2e', flatShading: true }), 0, 53, 28, exterior); roofCone.rotation.y = Math.PI / 4;
  mesh(rbox(0.4, 2.4, 0.4, 1, 0.05), goldMat, 0, 57.5, 28, exterior); mesh(rbox(1.4, 0.4, 0.4, 1, 0.05), goldMat, 0, 57.8, 28, exterior);
  // roof slopes
  for (const sx of [-1, 1]) { const r = mesh(uvBox(28, 0.8, 90, 6), stdMat({ map: T.stone('#8a4a3a', 'roof'), roughness: 0.8 }), sx * 11.5, 37, -12, exterior); r.rotation.z = sx * -0.55; }
  // landing + steps + plaza
  const land = mesh(uvBox(18, 4.2, 3.0, 4), stepMat, 0, -2.1, 33.1, exterior); land.receiveShadow = true; land.castShadow = true;
  for (let i = 0; i < 4; i++) {
    const s = STEP(i); const h = s.top + 4.2;
    const b = mesh(uvBox(18 + i * 1.2, h, s.z1 - s.z0, 4), stepMat, 0, -4.2 + h / 2, (s.z0 + s.z1) / 2, exterior); b.receiveShadow = true; b.castShadow = true;
  }
  const pave = T.paving();
  const plaza = mesh(uvBox(120, 0.4, 120, 6), stdMat({ map: pave, roughness: 0.9 }), 0, -4.2, 92, exterior); plaza.receiveShadow = true;
  const grass = mesh(uvBox(400, 0.4, 400, 8), stdMat({ map: T.grassTex(), roughness: 1 }), 0, -4.35, 60, exterior); grass.receiveShadow = true;
  // bushes, trees, lamps
  const leafM = stdMat({ map: T.leafTex('#4f9a3c'), flatShading: true, roughness: 0.8 });
  const leafM2 = stdMat({ map: T.leafTex('#3d8a35'), flatShading: true, roughness: 0.8 });
  const trunkM = stdMat({ map: T.pewWood(), color: '#a0714e' });
  const er = rng(5);
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) {
    const b = new THREE.Group(); b.position.set(sx * (10.5 + i * 3.2), -4, 32.8 + (i % 2) * 0.6); exterior.add(b);
    for (let k = 0; k < 4; k++) mesh(icoGeo(1.2 + er() * 0.5, 0), k % 2 ? leafM : leafM2, (er() - 0.5) * 2, 1.0 + er() * 0.6, (er() - 0.5) * 1.2, b);
    for (let k = 0; k < 6; k++) mesh(icoGeo(0.25, 0), stdMat({ color: petalCols[k % 4], flatShading: true }), (er() - 0.5) * 2.6, 1.4 + er() * 1.0, 0.9 + er() * 0.3, b);
    b.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  }
  const trees = [[-20, 44], [22, 46], [-28, 58], [30, 62], [-16, 70], [18, 76], [-36, 80], [38, 40]];
  trees.forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, -4, z); exterior.add(g);
    mesh(new THREE.CylinderGeometry(0.5, 0.8, 6, 6), trunkM, 0, 3, 0, g);
    mesh(icoGeo(3.6, 0), leafM, 0, 7.5, 0, g); mesh(icoGeo(2.8, 0), leafM2, 1.2, 10, 0.5, g); mesh(icoGeo(2.2, 0), leafM, -1, 11.6, -0.4, g);
    g.rotation.y = i; g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  });
  W.lampGlows = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(sx * 11, -4, 42); exterior.add(g);
    mesh(new THREE.CylinderGeometry(0.16, 0.26, 7, 8), stdMat({ color: '#2b2b30', metalness: 0.6, roughness: 0.4 }), 0, 3.5, 0, g);
    mesh(rbox(0.9, 1.2, 0.9, 1, 0.1), stdMat({ color: '#fff0c0', emissive: '#ffd27a', emissiveIntensity: 1.5 }), 0, 7.6, 0, g);
    mesh(new THREE.ConeGeometry(0.8, 0.6, 4), stdMat({ color: '#2b2b30' }), 0, 8.5, 0, g).rotation.y = Math.PI / 4;
  }
  // sky dome + clouds + sun
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.MeshBasicMaterial({ map: T.skyTex('#2f7fe0', '#8cc6f2', '#ffd29a'), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(0, -60, 40); exterior.add(sky); W.sky = sky;
  const cloudM = stdMat({ color: '#ffffff', emissive: '#ffe9d0', emissiveIntensity: 0.35, flatShading: true, roughness: 1 });
  [[-90, 70, -120], [60, 85, -150], [140, 60, -60], [-150, 95, 0], [0, 110, -220], [100, 120, 60]].forEach(([x, y, z], i) => {
    const g = new THREE.Group(); g.position.set(x, y, z); exterior.add(g);
    for (let k = 0; k < 5; k++) mesh(icoGeo(10 + er() * 8, 1), cloudM, (k - 2) * 12, er() * 5, er() * 6, g).scale.y = 0.55;
  });
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowTex(), color: '#fff0c8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sun.scale.set(160, 160, 1); sun.position.set(-150, 120, -260); exterior.add(sun);

  // ---------- lights
  const L = W.lights;
  L.hemi = new THREE.HemisphereLight('#fff4e4', '#8a5a3c', 1.5); scene.add(L.hemi);
  L.key = new THREE.DirectionalLight('#ffd6a6', 2.6); L.key.castShadow = true;
  const sm = quality.shadow;
  L.key.shadow.mapSize.set(sm, sm); L.key.shadow.bias = -0.0004; L.key.shadow.normalBias = 0.03;
  L.key.shadow.camera.near = 1; L.key.shadow.camera.far = 220;
  scene.add(L.key); scene.add(L.key.target);
  L.fill = new THREE.DirectionalLight('#ffe8d2', 0.55); L.fill.position.set(30, 20, 40); scene.add(L.fill);
  L.rim = new THREE.DirectionalLight('#ffc890', 0.0); L.rim.position.set(0, 20, -60); scene.add(L.rim);
  L.points = W.chandeliers.map((c) => { const p = new THREE.PointLight('#ffad62', 160, 60, 1.6); p.position.copy(c.position).add(new THREE.Vector3(0, -0.5, 0)); scene.add(p); return p; });
  L.altar = new THREE.SpotLight('#fff0dc', 900, 90, 0.42, 0.85, 1.5); L.altar.position.set(0, 26, -26); L.altar.target.position.set(0, 3, -43); scene.add(L.altar); scene.add(L.altar.target);
  L.doorway = new THREE.PointLight('#fff2d8', 0, 40, 1.4); L.doorway.position.set(0, 7, 32); scene.add(L.doorway);
  L.back = new THREE.PointLight('#ffc888', 90, 45, 1.4); L.back.position.set(0, 14, 22); scene.add(L.back);

  // ---------- characters
  const C = W.chars;
  C.you = new Character({ name: 'you', skin: '#ffd2a2', shirt: '#9a8466', sleeve: '#9a8466', pants: '#857258', shoe: '#3a2618', torsoKind: 'messy', torsoOpts: { shirt: '#f1efe4', tie: '#c2263a', crooked: true, wrinkled: true }, wrinkled: true, hair: { style: 'messy', color: '#6a4426', seed: 11 }, face: { eyes: 'crazy', mouth: 'creepy', brows: 'crazy' } });
  C.you.noBlink = true;
  C.bride = new Character({ name: 'bride', skin: '#ffd8b8', shirt: '#fbfaf6', sleeve: '#ffd8b8', torsoKind: 'bride', torsoOpts: {}, outfit: 'gown', hair: { style: 'bride', color: '#7a4a24' }, face: { eyes: 'pretty', mouth: 'pretty', blush: true }, acc: ['tiara', 'veil', 'bouquet'] });
  C.groom = new Character({ name: 'groom', skin: '#f3c79c', shirt: '#1b1b22', sleeve: '#1b1b22', pants: '#17171c', shoe: '#0c0c0e', torsoKind: 'groom', torsoOpts: { shirt: '#ffffff' }, hair: { style: 'slick', color: '#141010' }, face: { eyes: 'dot', mouth: 'smug', brows: 'proud' } });
  C.priest = new Character({ name: 'priest', skin: '#f0c49a', shirt: '#f7f5ef', sleeve: '#f7f5ef', torsoKind: 'robe', outfit: 'robe', hair: { style: 'bald', color: '#b9b9b9' }, face: { eyes: 'dot', mouth: 'smallsmile', glasses: 'round', brows: 'raised' }, acc: ['bible'] });
  C.grandma = new Character({ name: 'grandma', skin: '#f2c8a6', shirt: '#7b4fb0', sleeve: '#7b4fb0', pants: '#7b4fb0', shoe: '#3a2a4a', torsoKind: 'grandma', torsoOpts: {}, hair: { style: 'bun', color: '#d9d9de' }, face: { eyes: 'dot', mouth: 'smallsmile', glasses: 'square', blush: true }, acc: ['fan'] });
  C.guardL = new Character({ name: 'guardL', skin: '#d39a6c', shirt: '#151519', sleeve: '#151519', pants: '#121215', shoe: '#050505', torsoKind: 'guard', torsoOpts: { shirt: '#ffffff', tie: '#0a0a0a' }, hair: { style: 'buzz', color: '#1a1410' }, face: { eyes: 'none', mouth: 'flat', brows: 'thick' }, acc: ['sunglasses'], scale: 1.22, wide: 1.12 });
  C.guardR = new Character({ name: 'guardR', skin: '#a06a44', shirt: '#151519', sleeve: '#151519', pants: '#121215', shoe: '#050505', torsoKind: 'guard', torsoOpts: { shirt: '#ffffff', tie: '#0a0a0a' }, hair: { style: 'buzz', color: '#0e0b09' }, face: { eyes: 'none', mouth: 'flat', brows: 'thick' }, acc: ['sunglasses'], scale: 1.22, wide: 1.12 });
  C.guardL.noBlink = C.guardR.noBlink = true;
  for (const k in C) root.add(C[k].root);

  // guests: a full church in fancy clothes
  const gr = rng(2024);
  const skins = ['#f6d0aa', '#e9b98c', '#d39a6c', '#a06a44', '#f3c3a0', '#ffdcbc', '#c08258', '#8a5a3c'];
  const suitCols = ['#1f2a44', '#2e2e34', '#5a2a3a', '#2b4a3a', '#3b3f6b', '#6a5a4a', '#24323f'];
  const dressCols = ['#e05a8a', '#5aa0e0', '#f2c14a', '#9a6ad8', '#3fbf9a', '#ff8a5a', '#e04a4a', '#ffd0e0', '#7ad0ff'];
  const hairCols = ['#2a1a10', '#5a3418', '#a0682c', '#e0c070', '#141010', '#7a2a18', '#cfcfd4', '#3a2a20'];
  let gi = 0;
  for (const z of ROWS) {
    for (const sx of [-1, 1]) for (let s = 0; s < 3; s++) {
      if (z === 20) continue; // back row left empty: YOU sits alone in the back
      if (z === -28 && sx < 0 && s === 0) continue; // grandma's seat
      const female = gr() < 0.5;
      const skin = skins[Math.floor(gr() * skins.length)];
      const hc = hairCols[Math.floor(gr() * hairCols.length)];
      let spec;
      if (female) {
        const dc = dressCols[Math.floor(gr() * dressCols.length)];
        const pat = ['dots', 'floral', null][Math.floor(gr() * 3)];
        spec = { skin, shirt: dc, sleeve: gr() < 0.5 ? skin : dc, pants: dc, shoe: '#3a2020', torsoKind: 'dress', torsoOpts: { pattern: pat, c2: '#ffffff', necklace: gr() < 0.5 }, outfit: 'dress', fabric: pat ? { pattern: pat === 'dots' ? 'dots' : 'floral', c2: '#ffffff' } : {}, hair: { style: ['long', 'bun', 'curly', 'long'][Math.floor(gr() * 4)], color: hc, hat: gr() < 0.3 ? (gr() < 0.5 ? 'sun' : 'fascinator') : null, hatColor: dressCols[Math.floor(gr() * dressCols.length)] }, face: { eyes: 'pretty', mouth: 'smallsmile', blush: gr() < 0.6 } };
      } else {
        const sc = suitCols[Math.floor(gr() * suitCols.length)];
        spec = { skin, shirt: sc, sleeve: sc, pants: sc, shoe: '#151515', torsoKind: 'suit', torsoOpts: { shirt: '#f4f4f0', tie: dressCols[Math.floor(gr() * dressCols.length)] }, hair: { style: ['short', 'buzz', 'slick', 'bald', 'curly'][Math.floor(gr() * 5)], color: hc, hat: gr() < 0.1 ? 'top' : null }, face: { eyes: 'dot', mouth: 'smallsmile', moustache: gr() < 0.2 ? hc : null, glasses: gr() < 0.15 ? 'round' : null } };
      }
      const c = new Character(Object.assign({ name: 'guest' + gi }, spec));
      c.blinkSeed = gr();
      c.seat = { x: sx * SEATS_X[s], z: z + 0.45, row: ROWS.indexOf(z), side: sx, s };
      c.seed = gr() * 100;
      c.female = female;
      root.add(c.root); W.guests.push(c); gi++;
    }
  }
  C.grandma.seat = { x: -SEATS_X[0], z: -28 + 0.45 };

  // ---------- FX pools (sprites)
  const spriteMat = (kind, frame = 0) => new THREE.SpriteMaterial({ map: T.iconTex(kind, frame), transparent: true, depthWrite: false });
  const pool = (kind, n, frames = 1) => {
    const arr = [];
    for (let i = 0; i < n; i++) { const s = new THREE.Sprite(spriteMat(kind)); s.visible = false; s.renderOrder = 5; root.add(s); arr.push(s); }
    arr.frames = []; for (let f = 0; f < frames; f++) arr.frames.push(T.iconTex(kind, f));
    return arr;
  };
  const F = W.fx;
  F.swirl = pool('swirl', 2); F.heart = pool('heart', 10); F.sparkle = pool('sparkle', 26); F.drop = pool('drop', 10);
  F.stink = pool('stink', 18, 4); F.tear = pool('tear', 10); F.dust = pool('dust', 8);
  F.cloud = new THREE.Group(); root.add(F.cloud);
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#86d44e', emissive: '#3a7a12', emissiveIntensity: 0.55, transparent: true, opacity: 0.72, flatShading: true, depthWrite: false, roughness: 0.9 });
  F.cloudMat = cloudMat;
  const cr = rng(66);
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(icoGeo(1, 1), cloudMat); m.userData.o = [(cr() - 0.5) * 3.2, (cr() - 0.3) * 1.6, (cr() - 0.5) * 3.2, 1.0 + cr() * 1.1, cr() * 6]; F.cloud.add(m); }
  F.cloud.visible = false;
  F.hide = () => {
    for (const k of ['swirl', 'heart', 'sparkle', 'drop', 'stink', 'tear', 'dust']) F[k].forEach((s) => { s.visible = false; s.material.rotation = 0; s.material.opacity = 1; });
    F.cloud.visible = false;
  };
  // helper to place one sprite
  F.put = (kind, i, x, y, z, size, opacity = 1, rot = 0, frame = null) => {
    const s = F[kind][i]; if (!s) return null;
    s.visible = opacity > 0.01; s.position.set(x, y, z); s.scale.set(size * (s.material.map.image.width / s.material.map.image.height), size, 1);
    s.material.opacity = opacity; s.material.rotation = rot;
    if (frame !== null && F[kind].frames.length > 1) s.material.map = F[kind].frames[frame % F[kind].frames.length];
    return s;
  };
  return W;
}
