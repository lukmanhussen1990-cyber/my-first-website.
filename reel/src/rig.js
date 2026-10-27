// Shared low-poly building blocks: lofts, bones, 2-bone IK, planar-projected heads.
import * as THREE from 'three';

export const UP = new THREE.Vector3(0, 1, 0);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

// Loft through elliptical rings ({z, w, h, y}) along +Z. u = along rings, v = around (0 = top).
export function loftGeometry(rings, sides, { capStart = true, capEnd = true } = {}) {
  const pos = [], uv = [], idx = [];
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const r = rings[i];
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      pos.push(Math.sin(a) * r.w + (r.x || 0), Math.cos(a) * r.h + r.y, r.z);
      uv.push(i / (n - 1), s / sides);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * row + s, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const addCap = (ringIdx, flip) => {
    const r = rings[ringIdx];
    const ci = pos.length / 3;
    pos.push(r.x || 0, r.y, r.z + (flip ? -1 : 1) * (r.capBulge || 0));
    uv.push(ringIdx / (n - 1), 0.5);
    for (let s = 0; s < sides; s++) {
      const a = ringIdx * row + s, b = a + 1;
      if (flip) idx.push(ci, a, b); else idx.push(ci, b, a);
    }
  };
  if (capStart) addCap(0, true);
  if (capEnd) addCap(n - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Unit bone along +Y (0..1) with given bottom/top radii; caller sets scale.y = length.
// uRange maps the bone's length onto a slice of the texture's u axis (anchor end -> far end).
export function boneGeometry(r0, r1, sides = 6, uRange = [0, 1]) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, sides, 1, false);
  g.translate(0, 0.5, 0);
  // CylinderGeometry: v = 1 at top (far end), u around -> texture u along the bone, v around
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, uRange[0] + v * (uRange[1] - uRange[0]), u);
  }
  return g;
}

export function placeBone(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  mesh.position.copy(a);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  mesh.scale.set(1, Math.max(len, 1e-4), 1);
}

// 2-bone IK in a 2D plane (h = horizontal coord, v = vertical). bend +1 = joint toward +h.
export function ik2(ah, av, bh, bv, L1, L2, bend) {
  const dh = bh - ah, dv = bv - av;
  const raw = Math.hypot(dh, dv) || 1e-6;
  const d = clamp(raw, Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
  const base = Math.atan2(dv, dh);
  const a1 = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const ang = base + bend * a1;
  const jh = ah + Math.cos(ang) * L1, jv = av + Math.sin(ang) * L1;
  const eh = ah + (dh / raw) * d, ev = av + (dv / raw) * d;
  return { jh, jv, eh, ev };
}

// Ellipsoid-ish low-poly head. Front-facing triangles get material 1 with planar UVs (face texture),
// the rest material 0 (fur). Returns geometry with 2 groups.
export function headGeometry({ rx, ry, rz, segW = 12, segH = 9, flatFront = 0.55, cheeks = 0.14, muzzle = null, faceW, faceH, faceY = 0, frontCut = 0.25 }) {
  const parts = [];
  const sph = new THREE.SphereGeometry(1, segW, segH).toNonIndexed();
  const p = sph.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0.3) z = 0.3 + (z - 0.3) * flatFront;
    if (y < 0.1) x *= 1 + cheeks * (0.1 - y);
    p.setXYZ(i, x * rx, y * ry, z * rz);
  }
  parts.push(sph);
  if (muzzle) {
    const m = new THREE.SphereGeometry(1, 8, 6).toNonIndexed();
    const mp = m.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      mp.setXYZ(i, mp.getX(i) * muzzle.rx + (muzzle.x || 0), mp.getY(i) * muzzle.ry + muzzle.y, mp.getZ(i) * muzzle.rz + muzzle.z);
    }
    parts.push(m);
  }
  const faceTris = [], furTris = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), n = new THREE.Vector3();
  for (const g of parts) {
    const gp = g.attributes.position;
    for (let i = 0; i < gp.count; i += 3) {
      va.fromBufferAttribute(gp, i); vb.fromBufferAttribute(gp, i + 1); vc.fromBufferAttribute(gp, i + 2);
      n.subVectors(vc, vb).cross(vb.clone().sub(va)).normalize();
      // winding check: SphereGeometry is CCW outward; recompute properly
      const e1 = new THREE.Vector3().subVectors(vb, va), e2 = new THREE.Vector3().subVectors(vc, va);
      n.crossVectors(e1, e2).normalize();
      const cz = (va.z + vb.z + vc.z) / 3;
      const tri = [va.clone(), vb.clone(), vc.clone()];
      if (n.z > frontCut && cz > 0) faceTris.push(tri); else furTris.push(tri);
    }
  }
  const pos = [], uv = [];
  for (const tri of faceTris) for (const v of tri) {
    pos.push(v.x, v.y, v.z);
    uv.push(0.5 + v.x / faceW, 0.5 + (v.y - faceY) / faceH);
  }
  for (const tri of furTris) for (const v of tri) {
    pos.push(v.x, v.y, v.z);
    uv.push(0.5 + Math.atan2(v.x, -v.z) / (Math.PI * 2), 0.5 + v.y / (ry * 2));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.addGroup(0, faceTris.length * 3, 1);
  g.addGroup(faceTris.length * 3, furTris.length * 3, 0);
  g.computeVertexNormals();
  return g;
}

export function lowSphere(rx, ry, rz, w = 7, h = 5) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return g;
}
