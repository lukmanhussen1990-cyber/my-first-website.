// The city diorama: floating street slab with a cake-slice cut face (soil layers,
// pipes, cables), roads + markings, sidewalks, glass towers, trees, lights, props.
import * as THREE from 'three';
import { LAYOUT as L } from './layout.js';
import { GB, prism, rectPoly, chamferPoly, circlePoly, hrect, merge, xf, tint, gradientTint } from './geo.js';
import * as T from './tex.js';
import { rng, smoothstep, clamp, lerp } from './util.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function blocksList() {
  const edges = [L.xMin];
  for (const c of L.cross) { edges.push(c[0], c[1]); }
  edges.push(L.xMax);
  const blocks = [];
  for (let i = 0; i < edges.length; i += 2) blocks.push([edges[i], edges[i + 1]]);
  return blocks;
}
export const inCross = (x, pad = 0) => L.cross.some(([a, b]) => x > a - pad && x < b + pad);

function stdMat(maps, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: maps.map || null, roughnessMap: maps.orm || null, metalnessMap: o.useMetal ? maps.orm : null,
    normalMap: maps.normal || null, emissiveMap: maps.emissive || null,
    roughness: o.roughness ?? 1, metalness: o.metalness ?? 0,
    color: o.color ?? 0xffffff, emissive: maps.emissive ? (o.emissive ?? 0xffffff) : 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1, vertexColors: !!o.vertexColors, envMapIntensity: o.env ?? 1,
  });
  if (maps.normal) m.normalScale = new THREE.Vector2(o.ns ?? 1, o.ns ?? 1);
  if (o.ao && maps.orm) { m.aoMap = maps.orm; m.aoMapIntensity = o.ao; }
  return m;
}

export function buildCity(ctx) {
  const group = new THREE.Group();
  const R = rng(2024);
  const blocks = blocksList();
  const shadows = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };

  // ---------- textures & materials ----------
  const asphalt = T.asphaltMaps(1024);
  const pavers = T.paverMaps(1024, [0.66, 0.63, 0.58]);
  const plazaPavers = T.paverMaps(1024, [0.80, 0.74, 0.66]);
  const soil = T.soilMaps();
  const roof = T.roofMaps();
  const glassA = T.curtainWallMaps(11, { glass: [0.46, 0.48, 0.5], frame: [0.66, 0.67, 0.69], spandrel: [0.22, 0.23, 0.25], lit: 0.12 });
  const glassB = T.curtainWallMaps(17, { glass: [0.40, 0.41, 0.43], frame: [0.28, 0.28, 0.3], spandrel: [0.2, 0.2, 0.21], lit: 0.16, spandrelH: 0.28, paneW: 1.5 });
  const punched = T.punchedFacadeMaps(5, { wall: [0.84, 0.80, 0.74] });
  const store = T.storefrontMaps(3);

  const M = {
    asphalt: stdMat(asphalt, { ns: 0.7, ao: 0.6 }),
    pavers: stdMat(pavers, { ns: 0.6, ao: 0.8 }),
    plaza: stdMat(plazaPavers, { ns: 0.6, ao: 0.8 }),
    curb: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.74, 0.72, 0.68), roughness: 0.85 }),
    paint: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.86, 0.84), roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    paintYellow: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.72, 0.12), roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    soil: stdMat(soil, { ns: 1.2, ao: 1.0 }),
    roof: stdMat(roof, { ao: 0.5 }),
    glass: stdMat(glassA, { useMetal: true, vertexColors: true, emissiveIntensity: 0.7, ns: 1.0, env: 1.0 }),
    glassB: stdMat(glassB, { useMetal: true, vertexColors: true, emissiveIntensity: 0.7, ns: 1.0, env: 1.0 }),
    punched: stdMat(punched, { useMetal: true, vertexColors: true, emissiveIntensity: 0.6, ns: 1.0 }),
    store: stdMat(store, { useMetal: true, emissiveIntensity: 0.45, ns: 1.0 }),
    trim: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.78, 0.77, 0.75), roughness: 0.7, vertexColors: true }),
    metal: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.56, 0.58), roughness: 0.45, metalness: 0.7, vertexColors: true }),
    darkMetal: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.11, 0.115, 0.12), roughness: 0.45, metalness: 0.6 }),
    lampGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.42).multiplyScalar(9) }),
    redGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.08, 0.05).multiplyScalar(14) }),
    greenGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 1.0, 0.45).multiplyScalar(6) }),
  };
  ctx.cityMats = M;

  // ---------- slab top: roads and sidewalk blocks ----------
  const road = new GB();
  hrect(road, L.xMin, L.roadFar, L.xMax, L.roadNear, 0, 8);
  for (const [a, b] of L.cross) {
    hrect(road, a, L.zBack, b, L.roadFar, 0, 8);
    hrect(road, a, L.roadNear, b, L.cutZ, 0, 8);
  }
  group.add(shadows(new THREE.Mesh(road.build(), M.asphalt), false, true));

  const walkTop = new GB(), plazaTop = new GB(), curbs = new GB();
  for (const [a, b] of blocks) {
    // near sidewalk
    prism(curbs, rectPoly(a, L.roadNear, b, L.cutZ), 0, L.curbH, { cap: 'none' });
    hrect(walkTop, a, L.roadNear, b, L.cutZ, L.curbH, 4.8);
    // far block (sidewalk + ground under buildings)
    prism(curbs, rectPoly(a, L.zBack, b, L.roadFar), 0, L.curbH, { cap: 'none' });
    if (a === L.cross[0][1]) {
      // block with the plaza: split ground
      hrect(walkTop, a, L.roadFar - 4.8, b, L.roadFar, L.curbH, 4.8);
      hrect(plazaTop, L.plaza.x0, L.plaza.z1, L.plaza.x1, L.roadFar - 4.8, L.curbH, 4.8);
      hrect(walkTop, a, L.zBack, b, L.plaza.z1, L.curbH, 4.8);
      hrect(walkTop, L.plaza.x1, L.plaza.z1, b, L.roadFar - 4.8, L.curbH, 4.8);
    } else {
      hrect(walkTop, a, L.zBack, b, L.roadFar, L.curbH, 4.8);
    }
  }
  group.add(shadows(new THREE.Mesh(walkTop.build(), M.pavers), false, true));
  group.add(shadows(new THREE.Mesh(plazaTop.build(), M.plaza), false, true));
  group.add(shadows(new THREE.Mesh(curbs.build(), M.curb), false, true));

  // ---------- cut face (cake slice) ----------
  const cut = new GB();
  const st = T.SOIL;
  const vOf = (y) => (y - (0 - st.depth)) / st.depth; // y=0 -> v=1
  cut.quad(V(L.xMin, L.slabBottom, L.cutZ), V(L.xMax, L.slabBottom, L.cutZ), V(L.xMax, 0, L.cutZ), V(L.xMin, 0, L.cutZ),
    [L.xMin / st.tileW, vOf(L.slabBottom)], [L.xMax / st.tileW, vOf(L.slabBottom)], [L.xMax / st.tileW, 1], [L.xMin / st.tileW, 1], V(0, 0, 1));
  // slab ends
  for (const x of [L.xMin, L.xMax]) {
    const f = x === L.xMin ? V(-1, 0, 0) : V(1, 0, 0);
    cut.quad(V(x, L.slabBottom, L.zBack), V(x, L.slabBottom, L.cutZ), V(x, 0, L.cutZ), V(x, 0, L.zBack),
      [L.zBack / st.tileW, vOf(L.slabBottom)], [L.cutZ / st.tileW, vOf(L.slabBottom)], [L.cutZ / st.tileW, 1], [L.zBack / st.tileW, 1], f);
  }
  group.add(shadows(new THREE.Mesh(cut.build(), M.soil), false, true));

  // pipes and cables running along the cut face (half embedded)
  const len = L.xMax - L.xMin, midX = (L.xMin + L.xMax) / 2;
  const pipe = (r, y, mat, protrude = 0.55, seg = 24) => {
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
    g.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(midX, y, L.cutZ - r * (1 - protrude * 2) * 0.5 - r * (0.5 - protrude));
    m.position.z = L.cutZ + r * (protrude * 2 - 1);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const pm = (c, rough = 0.45, metal = 0.2) => new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: rough, metalness: metal });
  const pipes = [
    { r: 0.42, y: -2.75, m: pm([0.10, 0.30, 0.72], 0.35, 0.3), fl: 6.0 },     // water main
    { r: 0.16, y: -1.45, m: pm([0.95, 0.70, 0.10], 0.4, 0.2), fl: 4.0 },      // gas
    { r: 0.80, y: -6.4, m: pm([0.58, 0.57, 0.55], 0.85, 0.0), fl: 2.5 },      // concrete sewer
    { r: 0.27, y: -4.1, m: pm([0.85, 0.86, 0.88], 0.3, 0.5), fl: 8.0 },       // district heating (silver jacket)
    { r: 0.27, y: -4.1, dz: 0.0, m: null },
    { r: 0.10, y: -1.0, m: pm([0.98, 0.45, 0.08], 0.5, 0.0) },                // fibre conduit
  ];
  for (const p of pipes) { if (p.m) { const mesh = pipe(p.r, p.y, p.m); p.mesh = mesh; } }
  // flanges / joints
  const flangeInst = [];
  for (const p of pipes) {
    if (!p.m || !p.fl) continue;
    const g = new THREE.CylinderGeometry(p.r * 1.12, p.r * 1.12, Math.max(0.05, p.r * 0.22), 24, 1, false);
    g.rotateZ(Math.PI / 2);
    const count = Math.floor(len / p.fl);
    const im = new THREE.InstancedMesh(g, p.m, count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) { m4.makeTranslation(L.xMin + i * p.fl + 1, p.y, p.mesh.position.z); im.setMatrixAt(i, m4); }
    im.receiveShadow = true; group.add(im); flangeInst.push(im);
  }
  // cable tray with coloured cables
  const cableCols = [[0.05, 0.05, 0.05], [0.85, 0.1, 0.08], [0.1, 0.55, 0.2], [0.95, 0.55, 0.05], [0.1, 0.3, 0.8]];
  cableCols.forEach((c, i) => pipe(0.045, -0.62 - i * 0.075, pm(c, 0.55, 0.0), 0.55, 10));
  // pipe ends (service lines running into the slice) – rings with dark interiors
  {
    const ringG = new THREE.CylinderGeometry(1, 1, 0.12, 20, 1, true); ringG.rotateX(Math.PI / 2);
    const holeG = new THREE.CircleGeometry(0.82, 20);
    const ringM = pm([0.75, 0.75, 0.78], 0.4, 0.5), holeM = new THREE.MeshBasicMaterial({ color: 0x050403 });
    const n = 160; const rIm = new THREE.InstancedMesh(ringG, ringM, n), hIm = new THREE.InstancedMesh(holeG, holeM, n);
    const m4 = new THREE.Matrix4(); const Rr = rng(77);
    for (let i = 0; i < n; i++) {
      const x = L.xMin + Rr() * len, y = -0.9 - Math.pow(Rr(), 1.5) * 9, r = 0.06 + Rr() * 0.14;
      m4.compose(V(x, y, L.cutZ + 0.03), new THREE.Quaternion(), V(r, r, 1)); rIm.setMatrixAt(i, m4);
      m4.compose(V(x, y, L.cutZ + 0.085), new THREE.Quaternion(), V(r, r, 1)); hIm.setMatrixAt(i, m4);
      if (Rr() < 0.5) rIm.setColorAt(i, new THREE.Color().setHSL(Rr() < 0.5 ? 0.6 : 0.08, 0.6, 0.45));
      else rIm.setColorAt(i, new THREE.Color(0.7, 0.7, 0.72));
    }
    group.add(rIm, hIm);
  }
  // vertical drains from the street to the sewer at cross streets + streetlight conduits
  {
    const vg = new GB();
    const g = new THREE.CylinderGeometry(0.14, 0.14, 6.4 - 0.2, 14, 1, true);
    const geos = [];
    for (const [a, b] of L.cross) { geos.push(xf(g, { p: [(a + b) / 2, -3.3, L.cutZ - 0.05] })); }
    const cg = new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8, 1, true);
    for (let x = L.xMin + 12; x < L.xMax; x += 24) if (!inCross(x, 2)) geos.push(xf(cg, { p: [x, -0.31, L.cutZ - 0.0] }));
    void vg;
    group.add(new THREE.Mesh(merge(geos), pm([0.3, 0.31, 0.33], 0.5, 0.4)));
  }

  // ---------- road markings ----------
  const paint = new GB(), yellow = new GB();
  const mk = (gb, x0, z0, x1, z1) => hrect(gb, x0, z0, x1, z1, 0.008, 1);
  for (let x = L.xMin; x < L.jamEnd; x += 9) {
    if (inCross(x, 5) || inCross(x + 3, 5)) continue;
    mk(paint, x, 0.0, x + 3, 0.15);
  }
  const edgeRuns = [];
  { let x0 = L.xMin; for (const [a, b] of L.cross) { edgeRuns.push([x0, a - 5]); x0 = b + 5; } edgeRuns.push([x0, L.xMax]); }
  for (const [a, b] of edgeRuns) { mk(paint, a, L.roadNear - 0.38, b, L.roadNear - 0.26); mk(yellow, a, L.roadFar + 0.26, b, L.roadFar + 0.38); }
  for (const [a, b] of L.cross) {
    for (const xs of [[a - 3.6, a - 0.6], [b + 0.6, b + 3.6]]) {
      for (let z = L.roadFar + 0.5; z < L.roadNear - 0.5; z += 0.95) mk(paint, xs[0], z, xs[1], z + 0.5);
    }
    mk(paint, a - 4.6, L.roadFar + 0.2, a - 4.2, L.roadNear - 0.2); // stop line
    for (const zs of [[L.roadFar - 3.6, L.roadFar - 0.6], [L.roadNear + 0.6, L.roadNear + 3.6]]) {
      for (let x = a + 0.6; x < b - 0.6; x += 0.95) mk(paint, x, zs[0], x + 0.5, zs[1]);
    }
  }
  group.add(shadows(new THREE.Mesh(paint.build(), M.paint), false, true));
  group.add(shadows(new THREE.Mesh(yellow.build(), M.paintYellow), false, true));

  // ---------- buildings ----------
  const B = buildBuildings(ctx, M, R, { glassA, glassB, punched, store });
  group.add(B.group);

  // ---------- trees, lights, props ----------
  const P = buildProps(ctx, M, R);
  group.add(P.group);

  return { group, mats: M, buildings: B, props: P };
}

// ---------------------------------------------------------------------------
function buildBuildings(ctx, M, R, maps) {
  const group = new THREE.Group();
  const slices = new Map();
  const sliceOf = (x) => { const k = Math.floor(x / 120); if (!slices.has(k)) slices.set(k, { gGlass: new GB(true), gGlassB: new GB(true), gPunch: new GB(true), gStore: new GB(), gRoof: new GB(), gTrim: new GB(true), gMetal: new GB(true) }); return slices.get(k); };
  const glassTints = [[0.80, 1.05, 1.25], [0.95, 1.10, 1.15], [1.25, 0.98, 0.78], [0.85, 1.12, 1.02], [1.05, 1.05, 1.08], [0.72, 0.90, 1.30]];
  const wallTints = [[1.0, 0.95, 0.88], [0.98, 0.78, 0.62], [0.92, 0.88, 0.85], [1.02, 0.98, 0.9], [0.85, 0.62, 0.5], [0.82, 0.84, 0.86]];
  const specs = [];

  // flight-path height limits for the first row (car must pass above)
  const row1Limit = (x) => {
    if (x > 104 && x < 440) return 42;
    if (x >= 440 && x < 498) return 14;
    if (x >= 526 && x < 646) return 24;
    return 60;
  };
  const skyline = (x, z) => {
    const down = Math.exp(-Math.pow((x - 470) / 230, 2));
    const depth = clamp((-z - 40) / 220, 0, 1);
    return 26 + 60 * down + 70 * depth * (0.4 + down);
  };

  for (const [a, b] of blocksList()) {
    // ---- row 1: along the far frontage ----
    let x = a + 0.8;
    while (x < b - 6) {
      let w = 13 + R() * 16;
      if (b - (x + w) < 9) w = b - 0.8 - x;
      const x0 = x, x1 = x + w;
      x = x1 + (R() < 0.35 ? 2 + R() * 2 : 0.4);
      // reserved lots
      if (x1 > L.plaza.x0 && x0 < L.tower.x1 + 0.5 && a === L.cross[0][1]) continue;
      if (x1 > L.helipad.x0 - 1 && x0 < L.helipad.x1 + 1) continue;
      if (x1 > L.carwash.x0 - 4 && x0 < L.carwash.x1 + 4) { /* car wash sits on the road, buildings behind are fine */ }
      const depth = 15 + R() * 13;
      let h = 16 + R() * 34;
      h = Math.min(h, row1Limit((x0 + x1) / 2), row1Limit(x0), row1Limit(x1));
      specs.push({ x0, x1, z0: L.frontage, z1: L.frontage - depth, h: Math.max(h, 9), row: 1 });
    }
    // ---- back rows ----
    let zf = -40;
    while (zf > L.zBack + 30) {
      const dz = 26 + R() * 22;
      let xx = a + 1;
      while (xx < b - 8) {
        let w = 16 + R() * 22;
        if (b - (xx + w) < 10) w = b - 1 - xx;
        const x0 = xx, x1 = xx + w;
        xx = x1 + 1.5 + R() * 4;
        const h = skyline((x0 + x1) / 2, zf) * (0.6 + R() * 0.75);
        specs.push({ x0, x1, z0: zf - R() * 3, z1: zf - dz + R() * 3, h, row: 2 });
      }
      zf -= dz + 8 + R() * 8;
    }
  }
  // special buildings
  specs.push({ x0: L.tower.x0, x1: L.tower.x1, z0: L.tower.z0, z1: L.tower.z1, h: L.tower.h, row: 1, special: 'tower' });
  specs.push({ x0: L.helipad.x0, x1: L.helipad.x1, z0: L.helipad.z0, z1: L.helipad.z1, h: L.helipad.h, row: 1, special: 'helipad' });
  // a small kiosk building at the start of the plaza block
  specs.push({ x0: 106.6, x1: 111.2, z0: L.frontage, z1: L.frontage - 12, h: 8, row: 1 });

  for (const s of specs) {
    const { gGlass, gGlassB, gPunch, gStore, gRoof, gTrim, gMetal } = sliceOf((s.x0 + s.x1) / 2);
    const glassy = s.special === 'tower' || (s.special !== 'helipad' && (s.h > 34 ? R() < (s.row === 2 ? 0.9 : 0.85) : R() < 0.45));
    const tintG = glassTints[Math.floor(R() * glassTints.length)];
    const tintW = wallTints[Math.floor(R() * wallTints.length)];
    const shapeR = R();
    const shape = s.special ? 'box' : shapeR < 0.55 ? 'box' : shapeR < 0.75 ? 'chamfer' : shapeR < 0.93 ? 'stepped' : 'round';
    const facade = glassy ? (R() < 0.6 ? { gb: gGlass, mp: maps.glassA } : { gb: gGlassB, mp: maps.glassB }) : { gb: gPunch, mp: maps.punched };
    const col = glassy ? tintG : tintW;
    const offU = R() * 8, offV = Math.floor(R() * 8) / 8;
    const ground = s.row === 1 ? 5 : 0;
    const poly = (x0, z0, x1, z1, inset = 0) => {
      const xa = Math.min(x0, x1) + inset, xb = Math.max(x0, x1) - inset, za = Math.min(z0, z1) + inset, zb = Math.max(z0, z1) - inset;
      if (shape === 'chamfer') return chamferPoly(xa, za, xb, zb, Math.min(xb - xa, zb - za) * 0.18);
      if (shape === 'round') return circlePoly((xa + xb) / 2, (za + zb) / 2, Math.min(xb - xa, zb - za) / 2, 24);
      return rectPoly(xa, za, xb, zb);
    };
    const crown = !s.special && glassy && s.h > 70 && shape !== 'stepped' && R() < 0.7;
    const tiers = shape === 'stepped' ? [[0, s.h * 0.62], [2.5, s.h * 0.85], [5, s.h]] : crown ? [[0, s.h * 0.86], [2.4, s.h * 0.95], [4.2, s.h]] : [[0, s.h]];
    const tScaleW = 0.8 + R() * 0.5, tScaleH = 0.85 + R() * 0.3;
    let yPrev = 0;
    for (let ti = 0; ti < tiers.length; ti++) {
      const [inset, yTop] = tiers[ti];
      if (Math.min(s.x1 - s.x0, Math.abs(s.z1 - s.z0)) - 2 * inset < 6) break;
      const pl = poly(s.x0, s.z0, s.x1, s.z1, inset);
      const yStart = ti === 0 ? ground : yPrev;
      if (ti === 0 && ground > 0) {
        prism(gStore, pl, 0, ground, { tileW: maps.store.tileW, tileH: maps.store.tileH, offU: R() * 4, cap: 'none' });
        // canopy ledge over storefronts
        prism(gTrim, poly(s.x0, s.z0, s.x1, s.z1, -0.35), ground - 0.05, ground + 0.45, { cap: 'both', color: [0.85, 0.84, 0.82] });
      }
      const tierCol = ti > 0 && crown ? col.map((v, k) => v * [0.92, 1.0, 1.12][k]) : col;
      prism(facade.gb, pl, yStart, yTop, { tileW: facade.mp.tileW * tScaleW, tileH: facade.mp.tileH * tScaleH, offU, offV, cap: 'none', color: tierCol });
      // roof slab + parapet
      prism(gRoof, pl, yTop, yTop + 0.02, { cap: 'top', sides: false, capTile: 6 });
      prism(gTrim, pl, yTop - 0.6, yTop + 0.9, { cap: 'none', color: glassy ? [0.55, 0.56, 0.6] : [0.8, 0.78, 0.74] });
      yPrev = yTop;
    }
    // rooftop clutter
    const topIn = shape === 'stepped' ? 5 : 0;
    const rx0 = s.x0 + topIn + 2, rx1 = s.x1 - topIn - 2, rz0 = Math.max(s.z0, s.z1) - topIn - 2, rz1 = Math.min(s.z0, s.z1) + topIn + 2;
    if (rx1 - rx0 > 4 && rz0 - rz1 > 4 && !s.special) {
      const nUnits = 1 + Math.floor(R() * 3);
      for (let k = 0; k < nUnits; k++) {
        const w = 2 + R() * 3, d = 2 + R() * 3, hh = 1.2 + R() * 1.8;
        const cx = lerp(rx0 + w / 2, rx1 - w / 2, R()), cz = lerp(rz1 + d / 2, rz0 - d / 2, R());
        prism(gMetal, rectPoly(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2), s.h, s.h + hh, { cap: 'top', color: [0.78, 0.78, 0.8] });
      }
      if (R() < 0.3) prism(gMetal, circlePoly(lerp(rx0, rx1, R()), lerp(rz1, rz0, R()), 1.4, 12), s.h, s.h + 3.2, { cap: 'top', color: [0.6, 0.55, 0.5] });
    }
    if (s.h > 90 && R() < 0.6) {
      // spire with a red aircraft light
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
      prism(gMetal, circlePoly(cx, cz, 0.35, 8), s.h, s.h + 14, { cap: 'top', color: [0.7, 0.7, 0.72] });
      ctx.aircraftLights = ctx.aircraftLights || []; ctx.aircraftLights.push(V(cx, s.h + 14.3, cz));
    }
  }

  const add = (gb, mat, cast = true) => { if (!gb.p.length) return null; const m = new THREE.Mesh(gb.build(), mat); m.castShadow = cast; m.receiveShadow = true; group.add(m); return m; };
  for (const sl of slices.values()) { add(sl.gGlass, M.glass); add(sl.gGlassB, M.glassB); add(sl.gPunch, M.punched); add(sl.gStore, M.store); add(sl.gRoof, M.roof, false); add(sl.gTrim, M.trim); add(sl.gMetal, M.metal); }

  // aircraft warning lights
  if (ctx.aircraftLights) {
    const g = new THREE.SphereGeometry(0.45, 8, 6);
    const im = new THREE.InstancedMesh(g, M.redGlow, ctx.aircraftLights.length);
    ctx.aircraftLights.forEach((p, i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    group.add(im);
  }

  // helipad markings on the landing building
  {
    const hp = L.helipad, cx = (hp.x0 + hp.x1) / 2, cz = (hp.z0 + hp.z1) / 2, y = hp.h + 0.04;
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.0, 6.6, 48), M.paintYellow); ring.rotation.x = -Math.PI / 2; ring.position.set(cx, y, cz);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(6.0, 48), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.18, 0.2, 0.22), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(cx, y - 0.01, cz); disc.receiveShadow = true;
    const hg = new GB();
    const bar = (x0, z0, x1, z1) => hrect(hg, cx + x0, cz + z0, cx + x1, cz + z1, y + 0.005, 1);
    bar(-1.6, -2.4, -0.9, 2.4); bar(0.9, -2.4, 1.6, 2.4); bar(-0.9, -0.35, 0.9, 0.35);
    const hm = new THREE.Mesh(hg.build(), M.paint);
    ring.receiveShadow = hm.receiveShadow = true;
    group.add(disc, ring, hm);
    // edge lights
    const lg = new THREE.SphereGeometry(0.12, 8, 6); const im = new THREE.InstancedMesh(lg, M.greenGlow, 16);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(cx + Math.cos(a) * 7, y + 0.1, cz + Math.sin(a) * 7)); }
    group.add(im);
  }
  return { group, specs };
}

// ---------------------------------------------------------------------------
function buildProps(ctx, M, R) {
  const group = new THREE.Group();
  // --- stylised trees (far sidewalk + plaza) ---
  const canopyGeo = (() => {
    const geos = [];
    const RR = rng(8);
    const blobs = [[0, 0, 0, 1.5], [0.9, -0.2, 0.3, 1.1], [-0.8, -0.1, -0.4, 1.15], [0.2, 0.75, -0.2, 1.05], [-0.3, -0.35, 0.9, 0.95]];
    for (const [x, y, z, r] of blobs) {
      const g = new THREE.IcosahedronGeometry(r, 2);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const v = V(p.getX(i), p.getY(i), p.getZ(i));
        const n = v.clone().normalize();
        const d = 1 + 0.09 * Math.sin(n.x * 9 + n.y * 7) * Math.cos(n.z * 8) + (RR() - 0.5) * 0.04;
        v.multiplyScalar(d);
        p.setXYZ(i, v.x + x, v.y + y, v.z + z);
      }
      g.computeVertexNormals();
      geos.push(g);
    }
    let g = merge(geos);
    g = gradientTint(g, -1.4, 1.8, [0.35, 0.5, 0.3], [1.15, 1.1, 0.8]);
    return g;
  })();
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.17, 3.4, 8);
  const leafMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.32, 0.55, 0.20), roughness: 0.8, vertexColors: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.36, 0.25, 0.17), roughness: 0.9 });
  const treePos = [];
  for (let x = L.xMin + 6; x < L.xMax; x += 15.5) {
    if (inCross(x, 3)) continue;
    if (x > L.carwash.x0 - 8 && x < L.carwash.x1 + 10) continue;
    if (x > L.plaza.x0 && x < L.plaza.x1) continue;
    treePos.push([x + (R() - 0.5) * 2, -6.5]);
  }
  // plaza planter trees
  treePos.push([52, -12], [52, -24], [52, -33], [60, -33]);
  const tIm = new THREE.InstancedMesh(trunkGeo, trunkMat, treePos.length);
  const cIm = new THREE.InstancedMesh(canopyGeo, leafMat, treePos.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  treePos.forEach(([x, z], i) => {
    const s = 0.85 + R() * 0.35;
    m4.compose(V(x, L.curbH + 1.7 * s, z), q, V(s, s, s)); tIm.setMatrixAt(i, m4);
    q.setFromEuler(new THREE.Euler(0, R() * 6.28, 0));
    m4.compose(V(x, L.curbH + 4.4 * s, z), q, V(s * 1.05, s * 0.95, s * 1.05)); cIm.setMatrixAt(i, m4);
    cIm.setColorAt(i, new THREE.Color().setHSL(0.22 + R() * 0.08, 0.55, 0.42 + R() * 0.12));
    q.identity();
  });
  tIm.castShadow = cIm.castShadow = true; tIm.receiveShadow = cIm.receiveShadow = true;
  group.add(tIm, cIm);

  // --- streetlights (both sidewalks) ---
  const lightPos = [];
  for (let x = L.xMin + 12; x < L.xMax; x += 24) {
    if (inCross(x, 3) || (x > L.carwash.x0 - 8 && x < L.carwash.x1 + 24)) continue;
    lightPos.push([x, L.roadNear + 0.55, -1]);
    lightPos.push([x + 12, L.roadFar - 0.55, 1]);
  }
  const poleG = merge([
    xf(new THREE.CylinderGeometry(0.07, 0.1, 7.2, 10), { p: [0, 3.6, 0] }),
    xf(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8), { p: [0, 7.05, 0.85], r: [Math.PI / 2, 0, 0] }),
    xf(new RoundedBoxGeometry(0.5, 0.16, 0.95, 2, 0.05), { p: [0, 6.95, 1.75] }),
  ]);
  const lampG = xf(new THREE.BoxGeometry(0.36, 0.04, 0.8), { p: [0, 6.86, 1.75] });
  const pIm = new THREE.InstancedMesh(poleG, M.darkMetal, lightPos.length);
  const lIm = new THREE.InstancedMesh(lampG, M.lampGlow, lightPos.length);
  lightPos.forEach(([x, z, dir], i) => {
    m4.compose(V(x, L.curbH, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, dir > 0 ? 0 : Math.PI, 0)), V(1, 1, 1));
    pIm.setMatrixAt(i, m4); lIm.setMatrixAt(i, m4);
  });
  pIm.castShadow = true;
  group.add(pIm, lIm);

  // --- traffic lights at intersections (red for our direction) ---
  const tlPos = [];
  for (const [a] of L.cross) { tlPos.push([a - 1.2, L.roadNear + 0.5]); tlPos.push([a - 1.2, L.roadFar - 0.5]); }
  const tlPole = merge([xf(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 10), { p: [0, 2.1, 0] }), xf(new RoundedBoxGeometry(0.42, 1.25, 0.38, 2, 0.06), { p: [0, 4.6, 0] })]);
  const tpIm = new THREE.InstancedMesh(tlPole, M.darkMetal, tlPos.length);
  const redIm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 8), M.redGlow, tlPos.length);
  tlPos.forEach(([x, z], i) => {
    m4.makeTranslation(x, L.curbH, z); tpIm.setMatrixAt(i, m4);
    m4.makeTranslation(x - 0.2, L.curbH + 5.0, z); redIm.setMatrixAt(i, m4);
  });
  tpIm.castShadow = true;
  group.add(tpIm, redIm);

  // --- small props on sidewalks: benches, bins, hydrants, bollards ---
  const benchG = merge([
    xf(new RoundedBoxGeometry(1.8, 0.08, 0.5, 2, 0.03), { p: [0, 0.48, 0] }),
    xf(new RoundedBoxGeometry(1.8, 0.4, 0.07, 2, 0.03), { p: [0, 0.75, -0.24], r: [-0.15, 0, 0] }),
    xf(new THREE.BoxGeometry(0.08, 0.45, 0.45), { p: [-0.75, 0.22, 0] }),
    xf(new THREE.BoxGeometry(0.08, 0.45, 0.45), { p: [0.75, 0.22, 0] }),
  ]);
  const woodMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.36, 0.22), roughness: 0.7 });
  const benches = [];
  for (let x = L.xMin + 20; x < L.xMax; x += 31) { if (!inCross(x, 3) && !(x > L.plaza.x0 && x < L.plaza.x1) && !(x > L.carwash.x0 - 8 && x < L.carwash.x1 + 24)) benches.push([x, L.roadFar - 2.6, 0]); }
  benches.push([66, -30, 0], [74, -30, 0]);
  const bIm = new THREE.InstancedMesh(benchG, woodMat, benches.length);
  benches.forEach(([x, z, r], i) => { m4.compose(V(x, L.curbH, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r, 0)), V(1, 1, 1)); bIm.setMatrixAt(i, m4); });
  bIm.castShadow = true; group.add(bIm);

  const hydG = merge([xf(new THREE.CylinderGeometry(0.13, 0.15, 0.6, 12), { p: [0, 0.3, 0] }), xf(new THREE.SphereGeometry(0.14, 12, 8, 0, 6.29, 0, 1.6), { p: [0, 0.6, 0] }), xf(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 8), { p: [0, 0.38, 0], r: [0, 0, Math.PI / 2] })]);
  const hydM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.85, 0.12, 0.08), roughness: 0.45, metalness: 0.2 });
  const hyd = []; for (let x = L.xMin + 30; x < L.xMax; x += 47) if (!inCross(x, 3) && !(x > L.carwash.x0 - 8 && x < L.carwash.x1 + 24)) hyd.push([x, L.roadNear + 0.6]);
  const hIm = new THREE.InstancedMesh(hydG, hydM, hyd.length);
  hyd.forEach(([x, z], i) => { m4.makeTranslation(x, L.curbH, z); hIm.setMatrixAt(i, m4); });
  hIm.castShadow = true; group.add(hIm);

  // plaza planters (low boxes) and a fountain-like round planter
  const planter = new GB(true);
  for (const [x, z] of [[52, -12], [52, -24], [52, -33], [60, -33]]) prism(planter, circlePoly(x, z, 1.4, 16), L.curbH, L.curbH + 0.55, { cap: 'top', color: [0.75, 0.72, 0.68] });
  group.add(new THREE.Mesh(planter.build(), M.trim));

  return { group, treePos, lightPos };
}
