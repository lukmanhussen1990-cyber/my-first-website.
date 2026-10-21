// Details on the cut face of the soil: roots, half-buried stones and an earthworm.
import * as THREE from 'three';
import { ZC } from './world.js';
import { M, V, lumpy } from './parts.js';
import { merge, paint } from './plants.js';
import { rng, lerp } from './util.js';

export function buildCutaway(scene) {
  const grp = new THREE.Group(); scene.add(grp);
  const r = rng(301);
  // roots under the front plants: branching tubes lying on the face
  const roots = [];
  const rootFrom = (x, depth, spread, thick, seed) => {
    const rr = rng(seed);
    const grow = (p0, dir, len, rad, gen) => {
      const pts = [p0.clone()]; let p = p0.clone(); let d = dir.clone();
      const n = 6;
      for (let i = 0; i < n; i++) {
        d.x += (rr() - 0.5) * 0.7; d.y -= 0.15; d.normalize();
        p = p.clone().addScaledVector(d, len / n); p.z = ZC - rad * 0.2; pts.push(p);
      }
      const c = new THREE.CatmullRomCurve3(pts);
      const g = new THREE.TubeGeometry(c, 14, rad, 5);
      { const pa = g.attributes.position; // taper toward the tip
        for (let i = 0; i < pa.count; i++) { const t = Math.floor(i / 6) / 14; const k = lerp(1, 0.25, t); const ci = c.getPoint(Math.min(1, t)); pa.setXYZ(i, ci.x + (pa.getX(i) - ci.x) * k, ci.y + (pa.getY(i) - ci.y) * k, ci.z + (pa.getZ(i) - ci.z) * k); } }
      roots.push(paint(g, new THREE.Color().setHSL(0.08, 0.3, 0.42 + rr() * 0.1)));
      if (gen < 2) for (let k = 0; k < 3; k++) { const t = 0.25 + rr() * 0.6; grow(c.getPoint(t), V((rr() - 0.5) * 2, -0.6, 0), len * 0.5, rad * 0.6, gen + 1); }
    };
    for (let k = 0; k < 3; k++) grow(V(x + (rr() - 0.5) * 0.04, -0.03, ZC), V((k - 1) * spread, -1, 0), depth, thick, 0);
  };
  [0.62, 0.98, 1.34, 1.7, 2.06, -2.75, -2.39, -2.03].forEach((x, i) => rootFrom(x, 0.32, 0.6, 0.0085, 400 + i));
  for (let i = 0; i < 40; i++) rootFrom(lerp(-5, 5, r()), 0.08 + r() * 0.1, 0.9, 0.0035, 500 + i); // fine grass roots
  const rootMesh = new THREE.Mesh(merge(roots), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  rootMesh.receiveShadow = true; grp.add(rootMesh);

  // half-buried stones
  const stones = [];
  for (let i = 0; i < 46; i++) {
    const deep = r(); const y = -lerp(0.45, 4.3, Math.pow(deep, 0.8)); const x = lerp(-3.5, 3.5, r());
    if (Math.abs(x) < 0.5 && y > -1.5) continue; // keep the hole area clear
    if (x > 0.3 && x < 1.4 && y > -1.0) continue; // battery + wires
    if (x < -0.3 && x > -1.0 && y > -0.9) continue; // random box
    const rad = lerp(0.025, 0.07, r()) * (1 + deep * 1.6);
    const g = lumpy(rad, 600 + i, 0.22, 2); g.scale(1, lerp(0.6, 0.9, r()), 0.8); g.rotateZ(r() * 3);
    g.translate(x, y, ZC - rad * 0.35);
    const c = new THREE.Color().setHSL(0.08 + r() * 0.04, 0.12 + r() * 0.1, 0.38 + r() * 0.2);
    stones.push(paint(g, c));
  }
  const stoneMesh = new THREE.Mesh(merge(stones), M.stone); stoneMesh.castShadow = true; stoneMesh.receiveShadow = true; grp.add(stoneMesh);

  // earthworm (re-shaped every frame)
  const wormMat = new THREE.MeshStandardMaterial({ color: 0xd98a86, roughness: 0.45 });
  const worm = new THREE.Mesh(new THREE.BufferGeometry(), wormMat); worm.castShadow = true; grp.add(worm);
  const wormEyes = new THREE.Group(); grp.add(wormEyes);

  return {
    grp,
    update(t, wormX = 1.45, wormY = -0.27) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8; const ph = t * 3 + u * 5;
        pts.push(V(wormX + (u - 0.5) * 0.3 + Math.sin(t * 1.2) * 0.03, wormY + Math.sin(ph) * 0.025 * (0.4 + u), ZC + 0.006));
      }
      const c = new THREE.CatmullRomCurve3(pts);
      const g = new THREE.TubeGeometry(c, 24, 0.017, 8);
      const pa = g.attributes.position; // segment rings + rounded ends
      for (let i = 0; i < pa.count; i++) {
        const seg = Math.floor(i / 9), u = seg / 24; const ci = c.getPoint(Math.min(u, 1));
        const k = Math.sqrt(Math.max(0.05, Math.sin(Math.PI * Math.min(u, 1)))) * (1 + 0.12 * Math.sin(u * 60));
        pa.setXYZ(i, ci.x + (pa.getX(i) - ci.x) * k, ci.y + (pa.getY(i) - ci.y) * k, ci.z + (pa.getZ(i) - ci.z) * k);
      }
      g.computeVertexNormals();
      worm.geometry.dispose(); worm.geometry = g;
    },
  };
}
