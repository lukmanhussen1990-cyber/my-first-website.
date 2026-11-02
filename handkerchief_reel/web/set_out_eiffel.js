// The Eiffel Tower, low-poly: four curved lattice legs on stone piers, the four big arches, the first and second
// platforms (arcade friezes + railings + pavilions), the tapering lattice shaft, the third platform, the campanile and
// the antenna. Lattice = alpha-tested texture on double-sided faces + solid corner girders. Origin = centre of the base.
import * as THREE from 'three';
import { mat, tex } from './lib.js';
import { TriBuilder, mergeGeos } from './set_util.js';
import { latticeCanvas, ironCanvas, friezeCanvas, gravelCanvas } from './set_out_tex.js';
import { V, msh } from './set_out_kit.js';

export function buildEiffel(H = 62) {
  const k = H / 62;                                           // designed at 62 m
  const h1 = 10.9 * k, h2 = 22.0 * k, h3 = 52.8 * k;
  const w = (y) => k * (1.0 + 10.95 * Math.exp(-(y / k) / 16.7));              // outer corner half-width
  const ic = (y) => (y >= h2 ? 0 : k * 6.95 * Math.pow(1 - y / h2, 1.25));     // leg inner-corner offset
  const g = new THREE.Group(); g.name = 'set.paris.eiffel';

  // ---------------------------------------------------------------- materials
  const latT = tex(latticeCanvas({ base: '#8c6a4c', seed: 401 }));
  const LAT = mat(latT, { rough: 0.8, side: THREE.DoubleSide }); LAT.alphaTest = 0.5;
  const railT = tex(latticeCanvas({ base: '#8c6a4c', seed: 402, strut: true }));
  const RAIL = mat(railT, { rough: 0.8, side: THREE.DoubleSide }); RAIL.alphaTest = 0.5;
  const IRON = mat(tex(ironCanvas({ base: '#6c4e36' })), { rough: 0.75 });
  const IRON_D = mat(tex(ironCanvas({ base: '#4e3828', seed: 409 })), { rough: 0.8 });
  const FRIEZE = mat(tex(friezeCanvas({ base: '#8a6a4c' })), { rough: 0.75 });
  const STONE = mat(tex(gravelCanvas('#c9bea8', 417)), { rough: 0.95 });

  const tbLat = new TriBuilder(), tbRail = new TriBuilder(), tbFr = new TriBuilder();
  const girders = [], ironD = [], stones = [];
  const box1 = new THREE.BoxGeometry(1, 1, 1); box1.translate(0, 0.5, 0);
  // square girder between two points, thickness t
  const beam = (a, b, t, list = girders) => {
    const d = b.clone().sub(a), len = d.length(); if (len < 1e-4) return;
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
    const gg = box1.clone(); gg.scale(t, len, t); gg.applyQuaternion(q); gg.translate(a.x, a.y, a.z); list.push(gg.toNonIndexed());
  };
  // lattice quad strip between two corner polylines (same length), u tiles across, v by height
  const strip = (tb, A, B, tilesU, tileV, v0 = 0) => {
    for (let i = 0; i < A.length - 1; i++) {
      const va = v0 + A[i].y / tileV, vb = v0 + A[i + 1].y / tileV;
      tb.quad([A[i].x, A[i].y, A[i].z], [B[i].x, B[i].y, B[i].z], [B[i + 1].x, B[i + 1].y, B[i + 1].z], [A[i + 1].x, A[i + 1].y, A[i + 1].z],
        [0, va], [tilesU, va], [tilesU, vb], [0, vb]);
    }
  };

  // ---------------------------------------------------------------- the four legs (built for the +x+z leg, rotated)
  const LY = [0, 1.3, 2.7, 4.2, 5.9, 7.7, 9.5, 10.9, 12.8, 15.0, 17.3, 19.7, 22.0].map((y) => y * k);
  const legPts = (y) => { const W = w(y), I = ic(y); return { O: V(W, y, W), A: V(W, y, I), B: V(I, y, W), I: V(I, y, I) }; };
  const legGeosLat = [], legGeosGird = [];
  {
    const P = LY.map(legPts);
    const col = (key) => P.map((p) => p[key]);
    const tb = new TriBuilder();
    strip(tb, col('O'), col('A'), 3, 1.9 * k); strip(tb, col('O'), col('B'), 3, 1.9 * k);
    strip(tb, col('A'), col('I'), 3, 1.9 * k); strip(tb, col('B'), col('I'), 3, 1.9 * k);
    legGeosLat.push(tb.build());
    const gl = [];
    for (const [key, t] of [['O', 0.42], ['A', 0.32], ['B', 0.32], ['I', 0.34]]) for (let i = 0; i < P.length - 1; i++) beam(P[i][key], P[i + 1][key], t * k, gl);
    for (const y of [2.7, 5.9, 9.5, 15.0, 19.7].map((v) => v * k)) {           // horizontal girders around the leg
      const p = legPts(y);
      beam(p.O, p.A, 0.26 * k, gl); beam(p.O, p.B, 0.26 * k, gl); beam(p.A, p.I, 0.26 * k, gl); beam(p.B, p.I, 0.26 * k, gl);
    }
    legGeosGird.push(mergeGeos(gl));
    // stone pier under the leg
    const p0 = legPts(0), pw = p0.O.x - p0.I.x + 1.2 * k;
    const st = new THREE.BoxGeometry(pw, 1.1 * k, pw); st.translate((p0.O.x + p0.I.x) / 2, 0.45 * k, (p0.O.z + p0.I.z) / 2); stones.push(st.toNonIndexed());
    const st2 = new THREE.BoxGeometry(pw * 0.8, 0.5 * k, pw * 0.8); st2.translate((p0.O.x + p0.I.x) / 2, 1.2 * k, (p0.O.z + p0.I.z) / 2); stones.push(st2.toNonIndexed());
  }
  const rotCopies = (geo) => [0, 1, 2, 3].map((r) => { const c = geo.clone(); c.rotateY((r * Math.PI) / 2); return c; });
  const latGeos = [...rotCopies(legGeosLat[0])];
  girders.push(...rotCopies(legGeosGird[0]));
  stones.splice(0, stones.length, ...stones.flatMap(rotCopies));

  // ---------------------------------------------------------------- the big arches (one per side, in the outer face plane)
  {
    const ys = 1.5 * k, ya = 9.65 * k, X0 = ic(ys) + 0.5 * k, bw = 0.42 * k, dep = 0.32 * k, N = 22;
    const tb = new TriBuilder(), gl = [];
    const pt = (th, off, dz) => { const x = (X0 + off) * Math.cos(th), y = ys + (ya - ys + off) * Math.sin(th); return V(x, y, -(w(y) - 0.25 * k) + dz); };
    const sides = [];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI;
      sides.push({ io: pt(th, -bw, -dep), oo: pt(th, bw, -dep), ii: pt(th, -bw, dep), oi: pt(th, bw, dep), u: i / N });
    }
    const L = Math.PI * (X0 + ya - ys) / 2, tilesU = Math.round(L / (0.85 * k));
    for (let i = 0; i < N; i++) {
      const a = sides[i], b = sides[i + 1], ua = a.u * tilesU, ub = b.u * tilesU;
      tb.quad([a.io.x, a.io.y, a.io.z], [b.io.x, b.io.y, b.io.z], [b.oo.x, b.oo.y, b.oo.z], [a.oo.x, a.oo.y, a.oo.z], [ua, 0], [ub, 0], [ub, 1], [ua, 1]);  // front lattice
      tb.quad([a.ii.x, a.ii.y, a.ii.z], [b.ii.x, b.ii.y, b.ii.z], [b.oi.x, b.oi.y, b.oi.z], [a.oi.x, a.oi.y, a.oi.z], [ua, 0], [ub, 0], [ub, 1], [ua, 1]);  // back lattice
      beam(a.oo.clone().lerp(a.oi, 0.5), b.oo.clone().lerp(b.oi, 0.5), 0.24 * k, gl);                                                                  // extrados
      beam(a.io.clone().lerp(a.ii, 0.5), b.io.clone().lerp(b.ii, 0.5), 0.3 * k, gl);                                                                   // intrados
    }
    const arch = tb.build(); latGeos.push(...rotCopies(arch));
    girders.push(...rotCopies(mergeGeos(gl)));
  }

  // ---------------------------------------------------------------- platforms (square ring bands with friezes)
  const band = (Q, q, y0, y1, tileU = 4 * k) => {      // outer frieze faces + iron top / bottom / inner faces
    const tbI = new TriBuilder();
    for (let r = 0; r < 4; r++) {
      const rot = (p) => { const c = Math.cos((r * Math.PI) / 2), s = Math.sin((r * Math.PI) / 2); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
      const len = 2 * Q / tileU;
      tbFr.quad(rot([-Q, y0, -Q]), rot([Q, y0, -Q]), rot([Q, y1, -Q]), rot([-Q, y1, -Q]), [0, 0], [len, 0], [len, 1], [0, 1]);
      tbI.quad(rot([-Q, y1, -Q]), rot([Q, y1, -Q]), rot([q, y1, -q]), rot([-q, y1, -q]));                // top
      tbI.quad(rot([-q, y0, -q]), rot([q, y0, -q]), rot([Q, y0, -Q]), rot([-Q, y0, -Q]));                // bottom
      tbI.quad(rot([q, y0, -q]), rot([-q, y0, -q]), rot([-q, y1, -q]), rot([q, y1, -q]));                // inner wall
    }
    const gi = tbI.build(); ironD.push(gi);
  };
  const railing = (Q, y0, hgt) => {
    for (let r = 0; r < 4; r++) {
      const rot = (p) => { const c = Math.cos((r * Math.PI) / 2), s = Math.sin((r * Math.PI) / 2); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
      const n = Math.max(2, Math.round((2 * Q) / (hgt * 1.0)));
      tbRail.quad(rot([-Q, y0, -Q]), rot([Q, y0, -Q]), rot([Q, y0 + hgt, -Q]), rot([-Q, y0 + hgt, -Q]), [0, 0], [n, 0], [n, 1], [0, 1]);
    }
  };
  // first floor
  const Q1 = w(h1) + 0.55 * k, q1 = 3.0 * k, p1y0 = h1 - 0.55 * k, p1y1 = h1 + 0.95 * k;
  band(Q1, q1, p1y0, p1y1, 4.2 * k);
  railing(Q1 - 0.05 * k, p1y1, 0.7 * k);
  for (let r = 0; r < 4; r++) {                                  // little pavilions on the first floor
    const a = (r * Math.PI) / 2, x = Math.sin(a) * (Q1 - 1.6 * k), z = Math.cos(a) * (Q1 - 1.6 * k);
    const pv = new THREE.BoxGeometry(r % 2 ? 1.6 * k : 5.2 * k, 1.5 * k, r % 2 ? 5.2 * k : 1.6 * k); pv.translate(x, p1y1 + 0.75 * k, z); girders.push(pv.toNonIndexed());
    const rf = new THREE.BoxGeometry(r % 2 ? 1.9 * k : 5.6 * k, 0.25 * k, r % 2 ? 5.6 * k : 1.9 * k); rf.translate(x, p1y1 + 1.6 * k, z); ironD.push(rf.toNonIndexed());
  }
  // second floor
  const Q2 = w(h2) + 0.45 * k, q2 = 1.3 * k, p2y0 = h2 - 0.6 * k, p2y1 = h2 + 0.45 * k;
  band(Q2, q2, p2y0, p2y1, 3.0 * k);
  railing(Q2 - 0.05 * k, p2y1, 0.6 * k);
  { const pv = new THREE.BoxGeometry(2.6 * k, 1.3 * k, 2.6 * k); pv.translate(0, p2y1 + 0.65 * k, 0); girders.push(pv.toNonIndexed()); }

  // ---------------------------------------------------------------- the shaft (second floor -> third floor)
  {
    const SY = []; for (let i = 0; i <= 14; i++) SY.push(p2y1 + ((h3 + 0.2 * k - p2y1) * i) / 14);
    const C4 = (y) => { const W = w(y); return [V(W, y, W), V(W, y, -W), V(-W, y, -W), V(-W, y, W)]; };
    const P = SY.map(C4);
    for (let f = 0; f < 4; f++) strip(tbLat, P.map((p) => p[f]), P.map((p) => p[(f + 1) % 4]), 4, 1.7 * k);
    for (let c = 0; c < 4; c++) for (let i = 0; i < P.length - 1; i++) beam(P[i][c], P[i + 1][c], (0.34 - 0.15 * (i / P.length)) * k);
    for (const y of [27.5, 33.5, 40.0, 46.5].map((v) => v * k)) { const p = C4(y); for (let c = 0; c < 4; c++) beam(p[c], p[(c + 1) % 4], 0.2 * k); }
    // inner core (lift shaft) seen through the lattice
    const core = new THREE.BoxGeometry(0.75 * k, h3 - p2y1, 0.75 * k); core.translate(0, (h3 + p2y1) / 2, 0); ironD.push(core.toNonIndexed());
  }
  // ---------------------------------------------------------------- third floor, campanile, antenna
  {
    const Q3 = w(h3) + 0.45 * k;
    band(Q3, 0.01, h3 - 0.15 * k, h3 + 0.75 * k, 2.0 * k);
    railing(Q3 - 0.03 * k, h3 + 0.75 * k, 0.45 * k);
    const y0 = h3 + 0.75 * k;
    const cb = new THREE.BoxGeometry(2.2 * k, 2.3 * k, 2.2 * k); cb.translate(0, y0 + 1.15 * k, 0); girders.push(cb.toNonIndexed());
    // frieze windows on the campanile
    for (let r = 0; r < 4; r++) {
      const rot = (p) => { const c = Math.cos((r * Math.PI) / 2), s = Math.sin((r * Math.PI) / 2); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
      const Q = 1.11 * k;
      tbFr.quad(rot([-Q, y0 + 0.4 * k, -Q]), rot([Q, y0 + 0.4 * k, -Q]), rot([Q, y0 + 2.0 * k, -Q]), rot([-Q, y0 + 2.0 * k, -Q]), [0, 0], [0.5, 0], [0.5, 1], [0, 1]);
    }
    const cap = new THREE.CylinderGeometry(0.85 * k, 1.35 * k, 0.6 * k, 4); cap.rotateY(Math.PI / 4); cap.translate(0, y0 + 2.6 * k, 0); ironD.push(cap.toNonIndexed());
    const lan = new THREE.CylinderGeometry(0.42 * k, 0.5 * k, 1.1 * k, 8); lan.translate(0, y0 + 3.45 * k, 0); girders.push(lan.toNonIndexed());
    const dome = new THREE.CylinderGeometry(0.08 * k, 0.5 * k, 0.5 * k, 8); dome.translate(0, y0 + 4.25 * k, 0); ironD.push(dome.toNonIndexed());
    const ant = new THREE.CylinderGeometry(0.05 * k, 0.13 * k, H - (y0 + 4.4 * k), 6); ant.translate(0, (H + y0 + 4.4 * k) / 2, 0); ironD.push(ant.toNonIndexed());
    for (const yy of [0.35, 0.6]) { const rg = new THREE.CylinderGeometry(0.2 * k, 0.2 * k, 0.18 * k, 6); rg.translate(0, y0 + 4.4 * k + (H - y0 - 4.4 * k) * yy, 0); ironD.push(rg.toNonIndexed()); }
  }

  // ---------------------------------------------------------------- meshes
  const o = { cast: false, receive: false };
  latGeos.push(tbLat.build());
  g.add(msh(mergeGeos(latGeos), LAT, 'set.paris.eiffelLattice', o));
  g.add(msh(tbRail.build(), RAIL, 'set.paris.eiffelRail', o));
  g.add(msh(mergeGeos(girders), IRON, 'set.paris.eiffelGirders', o));
  g.add(msh(mergeGeos(ironD), IRON_D, 'set.paris.eiffelIronDark', o));
  g.add(msh(tbFr.build(), FRIEZE, 'set.paris.eiffelFrieze', o));
  g.add(msh(mergeGeos(stones), STONE, 'set.paris.eiffelPiers', o));
  return { group: g, h1, h2, h3, w, ic, materials: { LAT, IRON, IRON_D, FRIEZE } };
}
