// Room shell, window + autumn backyard, wall decor, sideboard, hutch, rug, chandelier. (set.js helper)
import * as THREE from 'three';
import { rng, mesh, box, cyl, lowSphere, mat, hash1, noise1, tex, lerp } from './lib.js';
import { ROOM, WINDOW, FURNITURE } from './layout.js';
import { V, worldUV, bakeColors, mergeGeos, latheGeo, leafGeo, ringXZ, frameXY, rectPath, flatten, glowCanvas, wrap01 } from './set_util.js';
import { photoCanvases, grassCanvas, strawCanvas } from './set_tex.js';

const { minX, maxX, minZ, maxZ, height: H, wallThick: WT } = ROOM;

// convenient placed box (centre + size)
function bx(M, [x0, y0, z0], [x1, y1, z1], material, o = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return mesh(o.uv ? worldUV(g, o.uv) : g, material, o);
}

export function buildRoom(S) {
  const { M, batch, colliders, B } = S;
  const dyn = {};
  const add = (...o) => batch.add(...o);
  const noCast = (m) => { m.traverse((c) => { if (c.isMesh) c.castShadow = false; }); return m; };

  // ------------------------------------------------------------ floor, ceiling, walls
  add(bx(M, [minX - WT, -0.1, minZ - WT], [maxX + WT, 0, maxZ + WT], M.floor, { uv: 1.12, cast: false }));
  add(bx(M, [minX - WT, H, minZ - WT], [maxX + WT, H + 0.1, maxZ + WT], M.ceiling, { uv: 1.0, cast: false }));
  {
    const W = WINDOW, s = rectPath(minX - WT, -0.1, maxX + WT, H + 0.1);
    s.holes.push(rectPath(W.cx - W.width / 2, W.bottom, W.cx + W.width / 2, W.bottom + W.height, true));
    const g = new THREE.ExtrudeGeometry(s, { depth: WT, bevelEnabled: false });
    g.translate(0, 0, minZ - WT);
    add(mesh(worldUV(g, 0.4), M.wall, { cast: false }));
  }
  add(bx(M, [minX - WT, -0.1, maxZ], [maxX + WT, H + 0.1, maxZ + WT], M.wall, { uv: 0.4, cast: false }));
  add(bx(M, [minX - WT, -0.1, minZ - WT], [minX, H + 0.1, maxZ + WT], M.wall, { uv: 0.4, cast: false }));
  add(bx(M, [maxX, -0.1, minZ - WT], [maxX + WT, H + 0.1, maxZ + WT], M.wall, { uv: 0.4, cast: false }));
  colliders.push({ name: 'wallBack', box: B([minX - WT, -0.1, minZ - WT], [maxX + WT, H + 0.1, minZ]) });
  colliders.push({ name: 'wallFront', box: B([minX - WT, -0.1, maxZ], [maxX + WT, H + 0.1, maxZ + WT]) });
  colliders.push({ name: 'wallLeft', box: B([minX - WT, -0.1, minZ - WT], [minX, H + 0.1, maxZ + WT]) });
  colliders.push({ name: 'wallRight', box: B([maxX, -0.1, minZ - WT], [maxX + WT, H + 0.1, maxZ + WT]) });
  colliders.push({ name: 'floor', box: B([minX - WT, -0.2, minZ - WT], [maxX + WT, -0.004, maxZ + WT]) });

  // ------------------------------------------------------------ wainscoting, chair rail, baseboard, crown (seamless rings)
  const ring = (depth, y0, y1, material, uv = 0.3) => add(mesh(worldUV(ringXZ(minX, maxX, minZ, maxZ, depth, 0.03, y0, y1), uv), material, { cast: false }));
  ring(0.012, -0.02, 0.70, M.wainscot);
  ring(0.028, 0.69, 0.735, M.trim);
  ring(0.034, 0.70, 0.715, M.trim);           // rail lip (proud, thinner) -> moulded look
  ring(0.022, -0.02, 0.11, M.trim);
  ring(0.03, 2.60, H + 0.02, M.trim);          // crown, stepped
  ring(0.055, 2.645, H + 0.02, M.trim);
  ring(0.075, 2.675, H + 0.02, M.trim);
  // raised panels on the wainscot
  {
    const panelRow = (a0, a1, place) => {
      const n = Math.max(1, Math.round((a1 - a0) / 0.72)), w = (a1 - a0) / n;
      for (let i = 0; i < n; i++) { const c = a0 + w * (i + 0.5); place(c, w - 0.12); }
    };
    const wainZ = 0.012 - 0.003; // panel frames start 3 mm inside the wainscot surface
    const fr = (w) => frameXY(w, 0.42, 0.032, 0.006);
    panelRow(minX + 0.06, maxX - 0.06, (c, w) => { const m = mesh(fr(w), M.trim, { cast: false }); m.position.set(c, 0.39, minZ + wainZ); add(m); });
    panelRow(minX + 0.06, maxX - 0.06, (c, w) => { const m = mesh(fr(w), M.trim, { cast: false }); m.position.set(c, 0.39, maxZ - wainZ); m.rotation.y = Math.PI; add(m); });
    panelRow(minZ + 0.06, maxZ - 0.06, (c, w) => { const m = mesh(fr(w), M.trim, { cast: false }); m.position.set(minX + wainZ, 0.39, c); m.rotation.y = Math.PI / 2; add(m); });
    panelRow(minZ + 0.06, maxZ - 0.06, (c, w) => { const m = mesh(fr(w), M.trim, { cast: false }); m.position.set(maxX - wainZ, 0.39, c); m.rotation.y = -Math.PI / 2; add(m); });
  }

  // ------------------------------------------------------------ window (back wall)
  const wx0 = WINDOW.cx - WINDOW.width / 2, wx1 = WINDOW.cx + WINDOW.width / 2, wy0 = WINDOW.bottom, wy1 = WINDOW.bottom + WINDOW.height;
  const zIn = minZ, zOut = minZ - WT;
  {
    const L = 0.015; // jamb liner
    add(bx(M, [wx0, wy0, zOut - 0.01], [wx0 + L, wy1, zIn - 0.002], M.trim, { cast: false }));
    add(bx(M, [wx1 - L, wy0, zOut - 0.01], [wx1, wy1, zIn - 0.002], M.trim, { cast: false }));
    add(bx(M, [wx0, wy1 - L, zOut - 0.01], [wx1, wy1, zIn - 0.002], M.trim, { cast: false }));
    // sash: stiles/rails (deep), meeting rail, muntins (shallower => no coplanar crossings)
    const sz0 = -2.49, sz1 = -2.45, ix0 = wx0 + L, ix1 = wx1 - L;
    const sb = 0.045;
    add(bx(M, [ix0, wy0, sz0], [ix0 + sb, wy1 - L, sz1], M.trim));
    add(bx(M, [ix1 - sb, wy0, sz0], [ix1, wy1 - L, sz1], M.trim));
    add(bx(M, [ix0 + sb, wy1 - L - sb, sz0], [ix1 - sb, wy1 - L, sz1], M.trim));
    add(bx(M, [ix0 + sb, wy0 + 0.015, sz0], [ix1 - sb, wy0 + 0.015 + 0.06, sz1], M.trim));
    const ym = (wy0 + wy1) / 2;
    add(bx(M, [ix0 + sb, ym - 0.025, sz0 + 0.004], [ix1 - sb, ym + 0.025, sz1 + 0.006], M.trim));
    const mw = 0.018;
    for (const k of [1, 2]) { const x = lerp(ix0 + sb, ix1 - sb, k / 3); add(bx(M, [x - mw / 2, wy0 + 0.075, sz0 + 0.008], [x + mw / 2, wy1 - L - sb, sz1 - 0.004], M.trim)); }
    for (const y of [lerp(wy0 + 0.075, ym - 0.025, 0.5), lerp(ym + 0.025, wy1 - L - sb, 0.5)]) add(bx(M, [ix0 + sb, y - mw / 2, sz0 + 0.011], [ix1 - sb, y + mw / 2, sz1 - 0.008], M.trim));
    // glass pane (very faint)
    const pane = mesh(new THREE.PlaneGeometry(ix1 - ix0, wy1 - wy0), mat('#e8f4ff', { rough: 0.05, transparent: true, opacity: 0.07 }), { cast: false, receive: false });
    pane.position.set((ix0 + ix1) / 2, (wy0 + wy1) / 2, -2.47); pane.userData.noAudit = true; S.group.add(pane);
    // interior casing
    const cw = 0.085;
    add(bx(M, [wx0 - cw, 0.865, zIn - 0.01], [wx0 + 0.006, wy1, zIn + 0.02], M.trim));
    add(bx(M, [wx1 - 0.006, 0.865, zIn - 0.01], [wx1 + cw, wy1, zIn + 0.02], M.trim));
    add(bx(M, [wx0 - cw - 0.02, wy1, zIn - 0.01], [wx1 + cw + 0.02, wy1 + 0.11, zIn + 0.025], M.trim));
    add(bx(M, [wx0 - cw - 0.035, wy1 + 0.11, zIn - 0.01], [wx1 + cw + 0.035, wy1 + 0.135, zIn + 0.035], M.trim));
    add(bx(M, [wx0 - cw - 0.05, 0.835, zOut + 0.02], [wx1 + cw + 0.05, 0.865, zIn + 0.06], M.trim));    // stool (sill)
    add(bx(M, [wx0 - cw, 0.75, zIn - 0.01], [wx1 + cw, 0.835, zIn + 0.02], M.trim));                    // apron
    colliders.push({ name: 'windowSill', box: B([wx0 - cw - 0.05, 0.75, zIn - 0.01], [wx1 + cw + 0.05, 0.865, zIn + 0.06]) });
    // mini pumpkins on the sill
    S.pumpkin(add, -1.05, 0.865, -2.43, 0.045, M.pumpkin, 11);
    S.pumpkin(add, -0.93, 0.865, -2.45, 0.032, M.pumpkinWhite, 12);
    S.pumpkin(add, 0.02, 0.865, -2.44, 0.038, M.pumpkin, 13);
  }

  // ------------------------------------------------------------ curtains (pleated, tied back), rod, garland
  {
    const rodY = 2.43, rodZ = -2.29;
    const rod = mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.5, 8), M.iron); rod.rotation.z = Math.PI / 2; rod.position.set(-0.55, rodY, rodZ); add(rod);
    for (const x of [-1.8, 0.7]) { const f = mesh(lowSphere(0.03, 0.03, 0.03, 8, 6), M.iron); f.position.set(x, rodY, rodZ); add(f); }
    for (const x of [-1.62, 0.52]) {
      add(bx(M, [x - 0.012, rodY - 0.012, minZ - 0.005], [x + 0.012, rodY + 0.012, rodZ], M.iron));
      add(bx(M, [x - 0.03, rodY - 0.04, minZ - 0.005], [x + 0.03, rodY + 0.04, minZ + 0.012], M.iron));
    }
    const curtain = (xOut, xIn, side) => {
      const segU = 18, segV = 22, top = 2.405, bot = 0.06, tieV = 0.6;
      const g = new THREE.PlaneGeometry(1, 1, segU, segV);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5, v = 0.5 - p.getY(i);          // u across (0 = outer edge), v down
        const y = lerp(top, bot, v);
        const gather = v < tieV ? lerp(1, 0.42, Math.pow(v / tieV, 1.6)) : lerp(0.42, 0.78, Math.pow((v - tieV) / (1 - tieV), 0.7));
        const x = lerp(xOut, lerp(xOut, xIn, gather), u);
        const amp = 0.022 + (1 - gather) * 0.03;
        const z = rodZ - 0.005 + Math.sin(u * Math.PI * 2 * 4.5) * amp * (0.6 + 0.4 * Math.sin(v * 3 + side));
        p.setXYZ(i, x, y, Math.max(z, minZ + 0.075));
      }
      g.computeVertexNormals();
      const uvs = g.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 2.0, uvs.getY(i) * 6.0);
      const m = mesh(g, M.curtain); add(m);
      // tie-back band
      const tx = lerp(xOut, xIn, 0.21), ty = lerp(top, bot, tieV);
      const band = mesh(new THREE.TorusGeometry(Math.abs(xIn - xOut) * 0.25, 0.012, 4, 10), M.bow);
      band.scale.set(1, 0.35, 1.1); band.rotation.x = Math.PI / 2; band.position.set(tx, ty, rodZ - 0.005); add(band);
    };
    curtain(-1.72, -1.16, 0);
    curtain(0.62, 0.06, 1.3);
    // fall-leaf garland swagged along the rod
    const R = rng(301), mats = [M.leafRed, M.leafOrange, M.leafYellow, M.leafBrown];
    const leafG = [leafGeo(0.07, 0.25, 0), leafGeo(0.06, 0.3, 1)];
    const anchors = [-1.75, -0.95, -0.15, 0.62];
    for (let i = 0; i < 70; i++) {
      const s = i / 69, xa = lerp(anchors[0], anchors[3], s);
      const seg = Math.min(2, Math.floor(s * 3)), ls = s * 3 - seg;
      const sag = Math.sin(ls * Math.PI) * 0.13;
      const l = mesh(leafG[i % 2], mats[Math.floor(R() * 4)], { cast: false });
      l.position.set(xa + (R() - 0.5) * 0.03, rodY - 0.03 - sag + (R() - 0.5) * 0.05, rodZ + 0.045 + R() * 0.02);
      l.rotation.set(Math.PI / 2 + (R() - 0.5) * 0.9, (R() - 0.5) * 0.8, R() * Math.PI * 2);
      add(l);
    }
    for (let i = 0; i < 12; i++) { const s = (i + 0.5) / 12, x = lerp(anchors[0], anchors[3], s); const ls = wrap01(s * 3);
      const b = mesh(lowSphere(0.012, 0.012, 0.012, 5, 4), M.berry, { cast: false }); b.position.set(x, rodY - 0.04 - Math.sin(ls * Math.PI) * 0.13, rodZ + 0.06); add(b); }
    colliders.push({ name: 'curtainL', box: B([-1.8, 0.05, minZ], [-1.1, 2.47, rodZ + 0.08]) });
    colliders.push({ name: 'curtainR', box: B([0.0, 0.05, minZ], [0.72, 2.47, rodZ + 0.08]) });
  }

  // ------------------------------------------------------------ autumn backyard (unlit, baked colours)
  buildOutside(S, dyn);

  // ------------------------------------------------------------ front wall: family photos
  {
    const P = photoCanvases();
    const fmat = { gold: M.frameGold, black: M.frameBlack, white: M.frameWhite, walnut: M.walnut };
    const frames = [
      { c: P.fam, x: 0.0, y: 1.66, w: 0.64, h: 0.47, f: 'gold', b: 0.055 },
      { c: P.wedding, x: -0.62, y: 1.86, w: 0.26, h: 0.33, f: 'black', b: 0.03 },
      { c: P.dog, x: -0.98, y: 1.58, w: 0.22, h: 0.22, f: 'white', b: 0.028 },
      { c: P.school, x: 0.6, y: 1.86, w: 0.24, h: 0.3, f: 'walnut', b: 0.03 },
      { c: P.fish, x: 0.68, y: 1.45, w: 0.3, h: 0.25, f: 'black', b: 0.028 },
      { c: P.baby, x: 1.04, y: 1.7, w: 0.2, h: 0.25, f: 'white', b: 0.026 },
    ];
    for (const F of frames) {
      const g = new THREE.Group();
      const fr = mesh(frameXY(F.w, F.h, F.b, 0.022), fmat[F.f]); fr.position.z = -0.008; g.add(fr);
      g.add(bx(M, [-F.w / 2 + 0.005, -F.h / 2 + 0.005, -0.008], [F.w / 2 - 0.005, F.h / 2 - 0.005, 0.004], M.backing, { cast: false }));
      const pic = mesh(new THREE.PlaneGeometry(F.w - F.b * 2 + 0.006, F.h - F.b * 2 + 0.006), mat(tex(F.c, { mip: true }), { rough: 0.45, polygonOffset: 2 }), { cast: false });
      pic.position.z = 0.008; g.add(pic);
      g.position.set(F.x, F.y, maxZ); g.rotation.y = Math.PI; add(g);
    }
    // +X wall: autumn landscape painting
    const g = new THREE.Group();
    const fr = mesh(frameXY(0.86, 0.6, 0.07, 0.03), M.frameGold); fr.position.z = -0.008; g.add(fr);
    g.add(bx(M, [-0.42, -0.29, -0.008], [0.42, 0.29, 0.005], M.backing, { cast: false }));
    const pic = mesh(new THREE.PlaneGeometry(0.74, 0.48), mat(tex(P.landscape, { mip: true }), { rough: 0.6, polygonOffset: 2 }), { cast: false }); pic.position.z = 0.009; g.add(pic);
    g.position.set(maxX, 1.58, 1.62); g.rotation.y = -Math.PI / 2; add(g);
  }

  // ------------------------------------------------------------ sideboard (front wall) + decor
  buildSideboard(S, add, dyn);
  // ------------------------------------------------------------ china hutch (+X wall)
  buildHutch(S, add);
  // ------------------------------------------------------------ -X wall: wreath + sconces
  buildWreath(S, add, dyn);
  // ------------------------------------------------------------ corners: hay bale + pumpkins + corn stalks ; plant
  buildCorners(S, add);

  // ------------------------------------------------------------ rug (raised 2 mm off the floor)
  {
    const rug = mesh(new THREE.BoxGeometry(4.1, 0.01, 3.1), M.rug, { cast: false });
    rug.position.set(0.18, 0.007, 0); add(rug);
  }

  // ------------------------------------------------------------ chandelier
  buildChandelier(S, add, dyn);
  return dyn;
}

// =============================================================== outside
function buildOutside(S, dyn) {
  const { group } = S;
  const out = new THREE.Group(); out.name = 'outside'; group.add(out);
  const basic = (c = 1.0) => new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(c, c, c) });
  const geos = [];
  const sun = [0.75, 0.5, 0.55];
  const put = (geo, hex, o = {}) => { geos.push(bakeColors(geo, hex, { sun, amb: o.amb ?? 0.62, jitter: o.jitter ?? 0.06, seed: o.seed ?? geos.length + 1, palette: o.palette })); };
  const GY = -0.3;
  // sky dome (vertex gradient)
  {
    const g = new THREE.SphereGeometry(36, 24, 14);
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    const top = new THREE.Color('#7fa8d8'), mid = new THREE.Color('#bcd2e6'), hor = new THREE.Color('#f6d0a2'), low = new THREE.Color('#e9b98c');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 36, x = p.getX(i) / 36;
      let col = y > 0.25 ? mid.clone().lerp(top, Math.min(1, (y - 0.25) / 0.6)) : y > 0.02 ? hor.clone().lerp(mid, (y - 0.02) / 0.23) : low.clone();
      col.lerp(new THREE.Color('#ffe0b0'), Math.max(0, x) * Math.max(0, 0.35 - Math.abs(y)) * 0.8); // warm glow toward the low sun (+X)
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
    sky.renderOrder = -10; sky.userData.noAudit = true; out.add(sky);
    // soft clouds
    const R = rng(511);
    for (let i = 0; i < 7; i++) {
      const cg = lowSphere(1.6 + R() * 1.4, 0.35 + R() * 0.2, 0.8, 7, 4);
      cg.translate(-14 + i * 5 + R() * 2, 7 + R() * 5, -30 + R() * 3);
      put(cg, '#fff3e4', { amb: 0.85, jitter: 0.03 });
    }
  }
  // lawn
  {
    const g = new THREE.PlaneGeometry(80, 40); g.rotateX(-Math.PI / 2); g.translate(0, GY, minZ - WT - 20);
    const t = tex(grassCanvas(), { repeat: [1, 1] });
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 20);
    const lawn = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.05, 1.05, 1.0) }));
    lawn.userData.noAudit = true; out.add(lawn);
  }
  // fence
  {
    const fz = -10.5;
    for (let x = -16; x < 16; x += 0.16) {
      const g = new THREE.BoxGeometry(0.14, 1.6, 0.03); g.translate(x, GY + 0.8 + hash1(x * 7) * 0.03, fz);
      put(g, hash1(x * 3) > 0.5 ? '#a08262' : '#94765a', { amb: 0.7 });
    }
    for (const y of [0.3, 1.25]) { const g = new THREE.BoxGeometry(32, 0.08, 0.05); g.translate(0, GY + y, fz + 0.04); put(g, '#7e6248', { amb: 0.7 }); }
  }
  // trees
  const tree = (x, z, h, palette, seed, scale = 1) => {
    const R = rng(seed);
    const trunk = new THREE.CylinderGeometry(0.1 * scale, 0.2 * scale, h, 6); trunk.translate(x, GY + h / 2, z); put(trunk, '#5a4030', { amb: 0.5 });
    for (let b = 0; b < 4; b++) {
      const a = R() * Math.PI * 2, len = (0.9 + R() * 0.8) * scale;
      const br = new THREE.CylinderGeometry(0.04 * scale, 0.08 * scale, len, 5); br.translate(0, len / 2, 0);
      br.rotateZ(0.7 + R() * 0.4); br.rotateY(a); br.translate(x, GY + h * (0.55 + R() * 0.3), z); put(br, '#5a4030', { amb: 0.5 });
    }
    for (let i = 0; i < 9; i++) {
      const r = (0.7 + R() * 0.6) * scale;
      const g = new THREE.IcosahedronGeometry(r, 1);
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const s = 1 + (hash1(k * 3.1 + seed + i) - 0.5) * 0.25; p.setXYZ(k, p.getX(k) * s, p.getY(k) * s * 0.85, p.getZ(k) * s); }
      const a = (i / 9) * Math.PI * 2 + R(), d = i === 0 ? 0 : (0.6 + R() * 0.7) * scale;
      g.translate(x + Math.cos(a) * d, GY + h + (R() - 0.3) * 1.0 * scale, z + Math.sin(a) * d * 0.7);
      put(g, palette[0], { palette, amb: 0.55, jitter: 0.08, seed: seed * 10 + i });
    }
  };
  tree(-1.45, -5.6, 3.0, ['#d8652a', '#c8402a', '#e8912e', '#e0b03a', '#b8352a'], 7, 1.15);
  tree(2.6, -8.2, 3.3, ['#e8c040', '#f0d050', '#d8a030', '#c89a2a'], 8, 1.0);
  tree(-6.0, -9.0, 3.6, ['#b8352a', '#c84a2a', '#a83030', '#d06a2a'], 9, 1.1);
  tree(7.5, -12.5, 4.0, ['#8a9a3a', '#c8a03a', '#a8a840', '#d08a2a'], 10, 1.2);
  tree(-11, -13, 4.4, ['#d8a030', '#e0903a', '#c8702a'], 11, 1.3);
  // bushes along the fence + distant house
  {
    const R = rng(77);
    for (let i = 0; i < 16; i++) {
      const g = new THREE.IcosahedronGeometry(0.5 + R() * 0.35, 0); g.scale(1.3, 0.8, 1); g.translate(-14 + i * 1.9 + R(), GY + 0.35, -10.0 + R() * 0.3);
      put(g, '#4a6a32', { palette: ['#4a6a32', '#5a7a3a', '#7a3a2a', '#6a7a3a'], amb: 0.55, seed: 900 + i });
    }
    const house = new THREE.BoxGeometry(5, 3, 4); house.translate(5.5, GY + 1.5, -18); put(house, '#d8c8a8', { amb: 0.7 });
    const roof = new THREE.CylinderGeometry(0.01, 3.6, 1.6, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1, 1, 0.8); roof.translate(5.5, GY + 3.8, -18); put(roof, '#6a3a30', { amb: 0.6 });
    for (const wx of [4.3, 6.7]) { const w = new THREE.BoxGeometry(0.7, 0.8, 0.05); w.translate(wx, GY + 1.6, -15.99); put(w, '#4a5a6a', { amb: 0.9 }); }
    // leaf pile under the maple + scattered leaves
    const pile = lowSphere(0.9, 0.22, 0.7, 8, 4); pile.translate(-1.2, GY, -5.2); put(pile, '#d06a2a', { palette: ['#d06a2a', '#c84a2a', '#e09a30', '#b8803a'], amb: 0.6, seed: 950 });
  }
  const outMesh = new THREE.Mesh(mergeGeos(geos), basic(1.12)); outMesh.userData.noAudit = true; out.add(outMesh);
  // falling leaves (animated in set.reset)
  const leafMats = ['#d8652a', '#c8402a', '#e8a030', '#e0c040'].map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.1), side: THREE.DoubleSide }));
  const lg = leafGeo(0.11, 0.3, 0);
  dyn.fallingLeaves = [];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(lg, leafMats[i % 4]); m.userData.noAudit = true; out.add(m);
    dyn.fallingLeaves.push({ m, seed: i * 13.7 + 3, x0: -3.2 + hash1(i * 5.1) * 4.6, z0: -6.4 + hash1(i * 2.3) * 3.4, period: 6 + hash1(i * 9.7) * 4, phase: hash1(i * 4.4) });
  }
}

export function animateLeaves(dyn, t) {
  for (const L of dyn.fallingLeaves) {
    const u = wrap01(t / L.period + L.phase);
    const y = lerp(4.6, -0.28, u);
    L.m.position.set(L.x0 + Math.sin(t * 1.3 + L.seed) * 0.35 + u * 0.6, y, L.z0 + Math.cos(t * 0.9 + L.seed) * 0.2);
    L.m.rotation.set(Math.sin(t * 2.1 + L.seed) * 1.2, t * 1.5 + L.seed, Math.cos(t * 1.7 + L.seed) * 0.8);
    L.m.visible = u < 0.985;
  }
}

// =============================================================== sideboard
function buildSideboard(S, add, dyn) {
  const { M, colliders, B } = S;
  const F = FURNITURE.sideboard;
  const x0 = F.x - F.w / 2, x1 = F.x + F.w / 2, zb = maxZ - 0.025, zf = zb - F.d + 0.025; // body front face
  const g = new THREE.Group();
  const P = (a, b, m, o) => g.add(bx(S.M, a, b, m, { uv: 0.5, ...o }));
  P([x0 + 0.02, 0.12, zf], [x1 - 0.02, 0.86, zb], M.cherry);
  P([x0, 0.86, zf - 0.02], [x1, 0.9, maxZ - 0.005], M.walnutDark);
  for (const lx of [x0 + 0.05, x1 - 0.05]) for (const lz of [zf + 0.03, zb - 0.03]) {
    const leg = mesh(latheGeo([[0, 0], [0.018, 0], [0.026, 0.06], [0.03, 0.12], [0, 0.12]], 8), M.walnutDark); leg.position.set(lx, 0, lz); g.add(leg);
  }
  P([x0 + 0.02, 0.1, zf - 0.005], [x1 - 0.02, 0.13, zb], M.walnutDark);
  const cols = 3, cw = (F.w - 0.08) / cols;
  for (let i = 0; i < cols; i++) {
    const cx0 = x0 + 0.04 + i * cw + 0.012, cx1 = x0 + 0.04 + (i + 1) * cw - 0.012;
    P([cx0, 0.7, zf - 0.012], [cx1, 0.835, zf + 0.004], M.cherry);           // drawer front
    P([cx0, 0.16, zf - 0.012], [cx1, 0.675, zf + 0.004], M.cherry);          // door
    P([cx0 + 0.05, 0.22, zf - 0.02], [cx1 - 0.05, 0.615, zf - 0.008], M.walnut); // raised panel
    const k1 = mesh(lowSphere(0.014, 0.014, 0.014, 6, 4), M.knob); k1.position.set((cx0 + cx1) / 2, 0.767, zf - 0.022); g.add(k1);
    const k2 = mesh(lowSphere(0.013, 0.013, 0.013, 6, 4), M.knob); k2.position.set(i === 1 ? cx0 + 0.04 : (i === 0 ? cx1 - 0.04 : cx0 + 0.04), 0.42, zf - 0.03); g.add(k2);
  }
  add(g);
  colliders.push({ name: 'sideboard', box: B([x0, 0, zf - 0.03], [x1, 0.9, maxZ]) });
  const top = 0.9;
  // lamp (ginger-jar base + glowing shade)
  {
    const lx = -0.7, lz = 2.36;
    const base = mesh(latheGeo([[0, 0], [0.05, 0], [0.075, 0.06], [0.08, 0.14], [0.05, 0.22], [0.02, 0.24], [0.012, 0.3], [0, 0.3]], 12), M.ceramicSage);
    base.position.set(lx, top, lz); add(base);
    const shade = mesh(latheGeo([[0.17, 0], [0.1, 0.2]], 14), M.shade, { cast: false }); shade.position.set(lx, top + 0.26, lz); add(shade);
    const bulb = mesh(lowSphere(0.03, 0.04, 0.03, 8, 6), M.bulb, { cast: false }); bulb.position.set(lx, top + 0.33, lz); add(bulb);
    colliders.push({ name: 'lamp', box: B([lx - 0.18, top, lz - 0.18], [lx + 0.18, top + 0.48, lz + 0.18]) });
  }
  // cornucopia with fruit
  {
    const rings = [];
    for (let i = 0; i <= 12; i++) { const s = i / 12; const r = lerp(0.11, 0.008, Math.pow(s, 0.8)); rings.push({ z: s * 0.42, w: r, h: r, y: Math.pow(s, 2.2) * 0.16 + r, x: Math.sin(s * 3) * 0.03 }); }
    const { loftGeometry } = S.lib;
    const hg = loftGeometry(rings, 10, { capStart: false, capEnd: true });
    const horn = mesh(hg, S.M.wicker); horn.material = S.M.wicker;
    const hg2 = new THREE.Group(); hg2.add(horn);
    // fruit spilling out of the mouth
    const R = rng(611);
    const fruit = (gx, gy, gz, r, m) => { const f = mesh(lowSphere(r, r * 0.95, r, 7, 5), m); f.position.set(gx, gy, gz); hg2.add(f); };
    fruit(0.0, 0.04, -0.06, 0.04, M.apple); fruit(0.07, 0.035, -0.09, 0.035, M.pumpkin); fruit(-0.07, 0.03, -0.08, 0.032, M.apple);
    for (let i = 0; i < 9; i++) fruit(0.03 + (R() - 0.5) * 0.06, 0.02 + R() * 0.04, -0.13 - R() * 0.04, 0.014, M.grape);
    const corn = mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.14, 6), M.corn); corn.rotation.set(Math.PI / 2, 0.6, 0); corn.position.set(-0.04, 0.03, -0.14); hg2.add(corn);
    hg2.rotation.y = -Math.PI / 2 - 0.25; hg2.position.set(0.12, top, 2.34);
    add(hg2);
  }
  // pillar candles on a tray + pumpkins
  {
    const tray = mesh(latheGeo([[0, 0], [0.14, 0], [0.15, 0.015], [0.135, 0.015], [0.13, 0.006], [0, 0.006]], 16), M.brass); tray.position.set(0.48, top, 2.34); add(tray);
    dyn.sideCandles = [];
    for (const [dx, dz, h] of [[-0.06, 0.02, 0.2], [0.05, -0.03, 0.15], [0.03, 0.06, 0.11]]) {
      const c = mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 10), M.candle); c.position.set(0.48 + dx, top + 0.006 + h / 2, 2.34 + dz); add(c);
      dyn.sideCandles.push({ pos: [0.48 + dx, top + 0.006 + h, 2.34 + dz] });
    }
    S.pumpkin(add, 0.76, top, 2.4, 0.07, M.pumpkinWhite, 21);
    S.pumpkin(add, 0.8, top, 2.25, 0.045, M.pumpkin, 22);
    S.pumpkin(add, -0.42, top, 2.3, 0.05, M.pumpkin, 23);
  }
}

// =============================================================== hutch
function buildHutch(S, add) {
  const { M, colliders, B } = S;
  const F = FURNITURE.hutch;
  const xf = F.x - F.w / 2, xb = maxX - 0.025, z0 = F.z - F.d / 2, z1 = F.z + F.d / 2;
  const g = new THREE.Group();
  const P = (a, b, m, o) => g.add(bx(M, a, b, m, { uv: 0.5, ...o }));
  // lower cabinet
  P([xf + 0.005, 0.0, z0 + 0.01], [xb, 0.1, z1 - 0.01], M.walnutDark);
  P([xf + 0.01, 0.1, z0 + 0.01], [xb, 0.86, z1 - 0.01], M.paintedHutch);
  P([xf - 0.015, 0.86, z0 - 0.01], [maxX - 0.005, 0.9, z1 + 0.01], M.walnut);
  const dw = (F.d - 0.06) / 2;
  for (let i = 0; i < 2; i++) {
    const a = z0 + 0.03 + i * dw + 0.01, b = z0 + 0.03 + (i + 1) * dw - 0.01;
    P([xf - 0.005, 0.68, a], [xf + 0.012, 0.83, b], M.paintedHutch);
    P([xf - 0.005, 0.14, a], [xf + 0.012, 0.65, b], M.paintedHutch);
    P([xf - 0.014, 0.2, a + 0.05], [xf - 0.002, 0.59, b - 0.05], M.paintedHutch);
    const k = mesh(lowSphere(0.013, 0.013, 0.013, 6, 4), M.knob); k.position.set(xf - 0.02, 0.755, (a + b) / 2); g.add(k);
    const k2 = mesh(lowSphere(0.013, 0.013, 0.013, 6, 4), M.knob); k2.position.set(xf - 0.022, 0.4, i === 0 ? b - 0.04 : a + 0.04); g.add(k2);
  }
  // upper display
  const ux = xf + 0.13, uy0 = 0.9, uy1 = 1.92;
  P([ux, uy0, z0 + 0.02], [xb, uy1, z0 + 0.05], M.paintedHutch);        // side panels
  P([ux, uy0, z1 - 0.05], [xb, uy1, z1 - 0.02], M.paintedHutch);
  P([xb - 0.012, uy0, z0 + 0.05], [xb, uy1, z1 - 0.05], M.hutchBack);    // back
  P([ux - 0.02, uy1, z0], [maxX - 0.005, uy1 + 0.05, z1], M.paintedHutch);       // top
  P([ux - 0.04, uy1 + 0.05, z0 - 0.02], [maxX - 0.005, 2.0, z1 + 0.02], M.walnut);  // crown
  for (const sy of [1.22, 1.56]) P([ux + 0.01, sy - 0.012, z0 + 0.05], [xb - 0.012, sy + 0.012, z1 - 0.05], M.paintedHutch);
  // glass doors (frames + muntins) proud of the carcass
  const half = (z1 - z0 - 0.1) / 2;
  for (let i = 0; i < 2; i++) {
    const a = z0 + 0.05 + i * half, b = a + half, fx0 = ux - 0.02, fx1 = ux + 0.0;
    P([fx0, uy0 + 0.01, a], [fx1, uy1 - 0.01, a + 0.04], M.paintedHutch);
    P([fx0, uy0 + 0.01, b - 0.04], [fx1, uy1 - 0.01, b], M.paintedHutch);
    P([fx0, uy0 + 0.01, a + 0.04], [fx1, uy0 + 0.06, b - 0.04], M.paintedHutch);
    P([fx0, uy1 - 0.06, a + 0.04], [fx1, uy1 - 0.01, b - 0.04], M.paintedHutch);
    P([fx0 + 0.004, uy0 + 0.06, (a + b) / 2 - 0.008], [fx1 - 0.003, uy1 - 0.06, (a + b) / 2 + 0.008], M.paintedHutch);
    for (const y of [1.22, 1.56]) P([fx0 + 0.006, y - 0.008, a + 0.04], [fx1 - 0.005, y + 0.008, b - 0.04], M.paintedHutch);
    const k = mesh(lowSphere(0.01, 0.01, 0.01, 6, 4), M.knob); k.position.set(fx0 - 0.008, 1.4, i === 0 ? b - 0.025 : a + 0.025); g.add(k);
    const pane = mesh(new THREE.PlaneGeometry(half - 0.08, uy1 - uy0 - 0.12), mat('#e8f4ff', { rough: 0.05, transparent: true, opacity: 0.1 }), { cast: false, receive: false });
    pane.rotation.y = -Math.PI / 2; pane.position.set(fx0 + 0.01, (uy0 + uy1) / 2, (a + b) / 2); pane.userData.noAudit = true; S.group.add(pane);
  }
  // display plates + cups
  const plateTex = S.plateBandMat;
  const R = rng(712);
  for (const [sy, n] of [[0.9, 4], [1.234, 4], [1.574, 4]]) {
    for (let i = 0; i < n; i++) {
      const pz = lerp(z0 + 0.16, z1 - 0.16, (i + 0.5) / n);
      if (sy > 1 || i % 2 === 0) {
        const pl = mesh(latheGeo([[0, 0], [0.06, 0], [0.11, 0.012], [0.12, 0.016], [0.112, 0.016], [0.06, 0.006], [0, 0.006]], 18), plateTex);
        pl.rotation.set(0, 0, Math.PI / 2 - 0.16); pl.position.set(xb - 0.055, sy + 0.13, pz); g.add(pl);
      } else {
        const tur = mesh(latheGeo([[0, 0], [0.05, 0], [0.08, 0.06], [0.07, 0.11], [0.03, 0.12], [0.012, 0.14], [0, 0.14]], 12), M.porcelain); tur.position.set(xb - 0.12, sy + 0.012, pz); g.add(tur);
      }
      if (sy > 1) for (const dz of [-0.06, 0.06]) {
        const cup = mesh(latheGeo([[0, 0], [0.022, 0], [0.03, 0.045], [0.028, 0.045], [0.02, 0.006], [0, 0.006]], 10), i % 2 ? M.ceramicBlue : M.porcelain);
        cup.position.set(xb - 0.16 + R() * 0.02, sy + 0.012, pz + dz); g.add(cup);
      }
    }
  }
  const hut = flatten(g, 'hutch'); add(hut);
  // decorative pumpkin on the hutch top
  S.pumpkin(add, F.x + 0.04, 2.0, F.z - 0.25, 0.07, M.pumpkin, 31);
  S.pumpkin(add, F.x + 0.06, 2.0, F.z + 0.05, 0.05, M.pumpkinWhite, 32);
  colliders.push({ name: 'hutch', box: B([xf - 0.05, 0, z0 - 0.03], [maxX, 2.1, z1 + 0.03]) });
}

// =============================================================== wreath + sconces on the -X wall
function buildWreath(S, add, dyn) {
  const { M } = S;
  const g = new THREE.Group();
  const R = rng(813), mats = [M.leafRed, M.leafOrange, M.leafYellow, M.leafBrown, M.leafOrange];
  const base = mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 18), M.twine); g.add(base);
  const lg = [leafGeo(0.09, 0.3, 0), leafGeo(0.08, 0.3, 1)];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + R() * 0.1, r = 0.22 + (R() - 0.5) * 0.09;
    const l = mesh(lg[i % 2], mats[Math.floor(R() * mats.length)], { cast: false });
    l.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.03 + R() * 0.04);
    l.rotation.set(Math.PI / 2 + (R() - 0.5) * 0.7, (R() - 0.5) * 0.7, a + Math.PI / 2 + (R() - 0.5) * 1.2);
    g.add(l);
  }
  for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2, r = 0.22 + (R() - 0.5) * 0.08; const b = mesh(lowSphere(0.016, 0.016, 0.016, 5, 4), i % 3 ? M.berry : M.pine); b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.07); g.add(b); }
  for (const s of [-1, 1]) { const bow = mesh(new THREE.ConeGeometry(0.06, 0.12, 4), M.bow); bow.rotation.z = s * Math.PI / 2; bow.position.set(s * 0.06, -0.22, 0.08); g.add(bow);
    const tail = mesh(new THREE.BoxGeometry(0.04, 0.16, 0.006), M.bow); tail.rotation.z = s * 0.3; tail.position.set(s * 0.04, -0.32, 0.075); g.add(tail); }
  S.pumpkin((m) => g.add(m), 0, -0.22, 0.04, 0.035, M.pumpkin, 41, true);
  const w = flatten(g, 'wreath'); w.position.set(minX + 0.012, 1.62, 0.1); w.rotation.y = Math.PI / 2; add(w);
  // sconces
  dyn.sconces = [];
  for (const z of [-0.75, 0.95]) {
    const s = new THREE.Group();
    s.add(bx(M, [-0.04, -0.07, -0.005], [0.04, 0.07, 0.012], M.brass));
    const arm = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), M.brass); arm.rotation.x = Math.PI / 2; arm.position.set(0, 0, 0.065); s.add(arm);
    const cup = mesh(latheGeo([[0, 0], [0.03, 0], [0.035, 0.02], [0, 0.02]], 8), M.brass); cup.position.set(0, 0, 0.12); s.add(cup);
    const sh = mesh(latheGeo([[0.075, 0], [0.045, 0.1]], 12), M.shade, { cast: false }); sh.position.set(0, 0.03, 0.12); s.add(sh);
    const bulb = mesh(lowSphere(0.016, 0.024, 0.016, 6, 5), M.bulb, { cast: false }); bulb.position.set(0, 0.06, 0.12); s.add(bulb);
    s.position.set(minX + 0.0, 1.7, z); s.rotation.y = Math.PI / 2; add(s);
  }
}

// =============================================================== corners
function buildCorners(S, add) {
  const { M, colliders, B } = S;
  const P = FURNITURE.plant;
  // hay bale + pumpkins
  const bale = mesh(worldUV(new THREE.BoxGeometry(0.56, 0.34, 0.38), 0.3), M.straw);
  bale.position.set(P.x + 0.02, 0.17 + 0.002, P.z + 0.05); bale.rotation.y = 0.12; add(bale);
  for (const dy of [0.09, 0.25]) { const tw = mesh(new THREE.BoxGeometry(0.565, 0.012, 0.385), M.twine); tw.position.set(0, -0.17 + dy, 0); tw.rotation.set(0, 0, 0); bale.add(tw); }
  S.pumpkin(add, P.x - 0.05, 0.342, P.z + 0.05, 0.14, M.pumpkin, 51);
  S.pumpkin(add, P.x + 0.17, 0.342, P.z + 0.1, 0.08, M.pumpkinWhite, 52);
  S.pumpkin(add, P.x - 0.06, 0.342 + 0.17, P.z + 0.04, 0.065, M.pumpkinGreen, 53);
  S.pumpkin(add, P.x + 0.35, 0.002, P.z + 0.3, 0.11, M.pumpkin, 54);
  S.pumpkin(add, P.x + 0.2, 0.002, P.z + 0.42, 0.07, M.pumpkinWhite, 55);
  // corn stalk bundle leaning in the corner
  {
    const R = rng(911); const g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const h = 1.5 + R() * 0.35, st = mesh(new THREE.CylinderGeometry(0.008, 0.014, h, 5), M.stalk);
      st.position.set((R() - 0.5) * 0.1, h / 2, (R() - 0.5) * 0.1); st.rotation.set((R() - 0.5) * 0.12, 0, (R() - 0.5) * 0.12); g.add(st);
      for (let k = 0; k < 3; k++) { const lf = mesh(new THREE.PlaneGeometry(0.05, 0.45), M.stalk); lf.position.set(st.position.x, 0.6 + k * 0.35 + R() * 0.1, st.position.z); lf.rotation.set(0.5 + R() * 0.4, R() * 6.28, 0.3); g.add(lf); }
    }
    const tie = mesh(new THREE.TorusGeometry(0.075, 0.012, 4, 10), M.twine); tie.rotation.x = Math.PI / 2; tie.position.y = 0.75; g.add(tie);
    const f = flatten(g, 'cornstalks'); f.position.set(minX + 0.16, 0.002, minZ + 0.16); f.rotation.set(0.06, 0, -0.06); add(f);
  }
  colliders.push({ name: 'cornerDecor', box: B([minX, 0, minZ], [P.x + 0.5, 1.9, P.z + 0.55]) });
  // potted plant in the +X back corner
  {
    const g = new THREE.Group(), R = rng(1001);
    const pot = mesh(latheGeo([[0, 0], [0.12, 0], [0.16, 0.3], [0.17, 0.32], [0.15, 0.32], [0.14, 0.28], [0, 0.28]], 12), M.pot); g.add(pot);
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, el = 0.3 + R() * 0.9, len = 0.35 + R() * 0.45;
      const dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const tip = V(0, 0.3, 0).addScaledVector(dir, len);
      const lf = mesh(leafGeo(0.2, 0.2, 1), M.plantLeaf);
      lf.position.copy(tip); lf.lookAt(tip.clone().add(dir)); lf.rotateX(Math.PI / 2 - 0.6); g.add(lf);
      const st = mesh(new THREE.CylinderGeometry(0.004, 0.006, len, 4), M.plantLeaf); st.position.copy(V(0, 0.3, 0).addScaledVector(dir, len / 2)); st.quaternion.setFromUnitVectors(V(0, 1, 0), dir); g.add(st);
    }
    const f = flatten(g, 'plant'); f.position.set(maxX - 0.32, 0.002, minZ + 0.32); add(f);
    colliders.push({ name: 'plant', box: B([maxX - 0.75, 0, minZ], [maxX, 1.25, minZ + 0.75]) });
  }
}

// =============================================================== chandelier
function buildChandelier(S, add, dyn) {
  const { M, colliders, B } = S;
  const C = FURNITURE.chandelier, g = new THREE.Group();
  const canopy = mesh(latheGeo([[0, 0], [0.04, 0], [0.09, 0.04], [0.1, 0.06], [0, 0.06]], 12), M.brass); canopy.position.y = H - 0.06; g.add(canopy);
  const med = mesh(latheGeo([[0, 0], [0.26, 0], [0.27, 0.012], [0.2, 0.025], [0, 0.025]], 24), M.trim); med.position.y = H - 0.02; g.add(med);
  for (let i = 0; i < 7; i++) { const l = mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 8), M.brass); l.position.y = H - 0.08 - i * 0.034; l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); }
  const col = mesh(latheGeo([[0, 0], [0.02, 0], [0.045, 0.04], [0.03, 0.09], [0.06, 0.15], [0.05, 0.2], [0.02, 0.24], [0.016, 0.33], [0, 0.33]], 10), M.brass);
  col.position.y = C.bottomY; g.add(col);
  const ring = mesh(new THREE.TorusGeometry(0.22, 0.008, 4, 24), M.brass); ring.rotation.x = Math.PI / 2; ring.position.y = C.bottomY + 0.11; g.add(ring);
  dyn.chandelierBulbs = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const curve = new THREE.QuadraticBezierCurve3(V(0, C.bottomY + 0.12, 0), V(Math.cos(a) * 0.34, C.bottomY + 0.02, Math.sin(a) * 0.34), V(Math.cos(a) * 0.36, C.bottomY + 0.16, Math.sin(a) * 0.36));
    g.add(mesh(new THREE.TubeGeometry(curve, 8, 0.009, 5), M.brass));
    const cx = Math.cos(a) * 0.36, cz = Math.sin(a) * 0.36, cy = C.bottomY + 0.16;
    const cup = mesh(latheGeo([[0, 0], [0.012, 0], [0.035, 0.025], [0.03, 0.03], [0, 0.03]], 8), M.brass); cup.position.set(cx, cy - 0.005, cz); g.add(cup);
    const sleeve = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), M.candle); sleeve.position.set(cx, cy + 0.055, cz); g.add(sleeve);
    const bulb = mesh(lowSphere(0.014, 0.024, 0.014, 6, 5), M.bulb, { cast: false }); bulb.position.set(cx, cy + 0.1, cz); g.add(bulb);
    const shade = mesh(latheGeo([[0.065, 0], [0.04, 0.085]], 10), M.shade, { cast: false }); shade.position.set(cx, cy + 0.055, cz); g.add(shade);
    dyn.chandelierBulbs.push([cx, cy + 0.1, cz]);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  const f = flatten(g, 'chandelier'); f.position.set(C.x, 0, C.z); add(f);
  colliders.push({ name: 'chandelier', box: B([C.x - 0.46, C.bottomY - 0.02, C.z - 0.46], [C.x + 0.46, H, C.z + 0.46]) });
}
