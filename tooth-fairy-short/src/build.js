// Geometry helpers for the low-poly papercraft look.
import * as THREE from 'three';

export function shade(m, cast = true, recv = true) {
  m.castShadow = cast;
  m.receiveShadow = recv;
  return m;
}

// Box with optional world-scaled UVs so tiled patterns keep a constant size.
export function bx(w, h, d, mat, { uv = 'face', density = 1, seg = [1, 1, 1] } = {}) {
  const g = new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]);
  if (uv === 'world') {
    const a = g.attributes.uv;
    const pos = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const nx = Math.abs(g.attributes.normal.getX(i)), ny = Math.abs(g.attributes.normal.getY(i));
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      let u, v;
      if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
      a.setXY(i, u * density, v * density);
    }
  }
  return shade(new THREE.Mesh(g, mat));
}

export function cyl(rt, rb, h, seg, mat, open = false) {
  return shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat));
}

export function at(o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}

export function grp(...kids) {
  const g = new THREE.Group();
  kids.forEach((k) => g.add(k));
  return g;
}

// Octagonal prism ("round blocky" head). Material groups:
// 0 front face, 1 chamfers, 2 left/right sides, 3 back, 4 top, 5 bottom.
export function chamferBox(w, h, d, c) {
  const hw = w / 2, hd = d / 2, hh = h / 2;
  const P = [[-hw + c, hd], [hw - c, hd], [hw, hd - c], [hw, -hd + c], [hw - c, -hd], [-hw + c, -hd], [-hw, -hd + c], [-hw, hd - c]];
  const sideMat = [0, 1, 2, 1, 3, 1, 2, 1];
  const pos = [], nor = [], uv = [], idx = [];
  const groups = [];
  let v = 0;
  for (let i = 0; i < 8; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 8];
    const nx = z0 - z1, nz = x1 - x0, nl = Math.hypot(nx, nz);
    pos.push(x0, -hh, z0, x1, -hh, z1, x1, hh, z1, x0, hh, z0);
    for (let k = 0; k < 4; k++) nor.push(nx / nl, 0, nz / nl);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    groups.push([idx.length, 6, sideMat[i]]);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }
  for (const [y, ny, mi] of [[hh, 1, 4], [-hh, -1, 5]]) {
    const c0 = v;
    pos.push(0, y, 0); nor.push(0, ny, 0); uv.push(0.5, 0.5);
    v++;
    for (let i = 0; i < 8; i++) {
      pos.push(P[i][0], y, P[i][1]); nor.push(0, ny, 0); uv.push((P[i][0] + hw) / w, (P[i][1] + hd) / d);
      v++;
    }
    const start = idx.length;
    for (let i = 0; i < 8; i++) {
      const a = c0 + 1 + i, b = c0 + 1 + ((i + 1) % 8);
      if (ny > 0) idx.push(c0, a, b); else idx.push(c0, b, a);
    }
    groups.push([start, 24, mi]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  for (const [s, n, m] of groups) g.addGroup(s, n, m);
  return g;
}

// Puffy low-poly pillow: subdivided box squashed toward the edges.
export function pillowGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d, 8, 2, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2), z = p.getZ(i) / (d / 2);
    const edge = Math.max(Math.abs(x) ** 2.2, Math.abs(z) ** 2.2);
    const puff = 1 - 0.78 * edge;
    p.setY(i, y * (h / 2) * puff);
    p.setX(i, x * (w / 2) * (1 + 0.04 * (1 - z * z)));
    p.setZ(i, z * (d / 2) * (1 + 0.05 * (1 - x * x)));
  }
  g.computeVertexNormals();
  return g;
}

// Low-poly "bag/sack" lathe.
export function sackGeo(r, h, seg = 9, open = true) {
  const pts = [
    new THREE.Vector2(r * 0.55, 0), new THREE.Vector2(r * 0.95, h * 0.12), new THREE.Vector2(r, h * 0.45),
    new THREE.Vector2(r * 0.85, h * 0.78), new THREE.Vector2(r * 0.6, h * 0.92), new THREE.Vector2(r * 0.7, h),
  ];
  if (!open) pts.unshift(new THREE.Vector2(0, 0));
  return new THREE.LatheGeometry(pts, seg);
}

// Pleated curtain panel with optional bulges (people hiding behind it).
export function curtainGeo(w, h, bulges = [], pleats = 7, depth = 0.035) {
  const sx = 28, sy = 14;
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = (x + w / 2) / w;
    let z = Math.sin(u * pleats * Math.PI * 2) * depth;
    for (const b of bulges) {
      const dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1) z += b.z * (1 - d2) ** 1.5;
    }
    p.setZ(i, z);
  }
  g.computeVertexNormals();
  return g;
}

// 2D shape -> thin extrusion (moustache, badge, star...)
export function extrude(shape, depth, mat, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 });
  return shade(new THREE.Mesh(g, mat));
}

export function starShape(r1, r2, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
