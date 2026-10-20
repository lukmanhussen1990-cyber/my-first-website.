import * as THREE from 'three';

// Deforming generalized cylinder (body, legs, tails, arms). Each frame the
// owner supplies a centre curve and an elliptical cross-section profile; the
// tube rebuilds positions and analytic normals. uv = (rest arc length, angle)
// so fur and spot patterns stay glued to the skin while it bends.
// With shells > 0 the geometry is instanced: instance 0 is the skin, the
// rest are fur shells pushed out along the normal in the vertex shader.

export class Tube {
  constructor({ nu = 24, nv = 16, capStart = true, capEnd = true, capRings = 5, restLength = 1, shells = 0 }) {
    this.nu = nu; this.nv = nv; this.capRings = capRings; this.capStart = capStart; this.capEnd = capEnd;
    this.restLength = restLength;
    const rings = nu + (capStart ? capRings : 0) + (capEnd ? capRings : 0);
    this.rings = rings;
    const nVert = rings * (nv + 1) + (capStart ? 1 : 0) + (capEnd ? 1 : 0);
    this.nVert = nVert;
    const geo = shells > 0 ? new THREE.InstancedBufferGeometry() : new THREE.BufferGeometry();
    if (shells > 0) geo.instanceCount = shells + 1;
    this.pos = new Float32Array(nVert * 3);
    this.nor = new Float32Array(nVert * 3);
    this.uv = new Float32Array(nVert * 2);
    this.circ = new Float32Array(nVert);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    geo.setAttribute('aCirc', new THREE.BufferAttribute(this.circ, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    const ringIdx = (r, j) => r * (nv + 1) + j;
    for (let r = 0; r < rings - 1; r++) for (let j = 0; j < nv; j++) {
      const a = ringIdx(r, j), b = ringIdx(r, j + 1), c = ringIdx(r + 1, j), d = ringIdx(r + 1, j + 1);
      idx.push(a, b, c, b, d, c);
    }
    let tip = rings * (nv + 1);
    if (capStart) { this.tipStart = tip; for (let j = 0; j < nv; j++) idx.push(tip, ringIdx(0, j + 1), ringIdx(0, j)); tip++; }
    if (capEnd) { this.tipEnd = tip; for (let j = 0; j < nv; j++) idx.push(tip, ringIdx(rings - 1, j), ringIdx(rings - 1, j + 1)); }
    geo.setIndex(idx);
    this.geo = geo;
    this._tmp = { T: new THREE.Vector3(), U: new THREE.Vector3(), S: new THREE.Vector3(), P: new THREE.Vector3(), Pn: new THREE.Vector3() };
  }

  // centre(t) -> Vector3, prof(t) -> {ry, rz, oy} (vertical/side radius and
  // vertical offset of the ellipse centre), up: Vector3 hint (or fn(t)).
  update(centre, prof, up) {
    const { nu, nv, capStart, capEnd, capRings } = this;
    const pts = [], frames = [];
    const N = nu;
    for (let i = 0; i < N; i++) pts.push(centre(i / (N - 1)).clone());
    // frames with an up hint (projected, so they never flip on our curves)
    for (let i = 0; i < N; i++) {
      const T = new THREE.Vector3().subVectors(pts[Math.min(N - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      const uh = typeof up === 'function' ? up(i / (N - 1)) : up;
      const U = uh.clone().addScaledVector(T, -uh.dot(T));
      if (U.lengthSq() < 1e-8) U.set(0, 0, 1).addScaledVector(T, -T.z);
      U.normalize();
      const S = new THREE.Vector3().crossVectors(T, U).normalize();
      frames.push({ T, U, S });
    }
    const ringList = [];
    // start cap rings (hemisphere-ish), body rings, end cap rings
    const p0 = prof(0), p1 = prof(1);
    if (capStart) for (let k = 0; k < capRings; k++) {
      const a = (Math.PI / 2) * (1 - k / capRings); // from pole-ish to equator
      const s = Math.cos(a), back = Math.sin(a);
      ringList.push({ c: pts[0].clone().addScaledVector(frames[0].T, -back * Math.min(p0.ry, p0.rz) * 0.9), f: frames[0], ry: p0.ry * s, rz: p0.rz * s, oy: p0.oy, u: 0, nT: -back });
    }
    for (let i = 0; i < N; i++) { const pr = prof(i / (N - 1)); ringList.push({ c: pts[i], f: frames[i], ry: pr.ry, rz: pr.rz, oy: pr.oy, u: (i / (N - 1)) * this.restLength, nT: 0 }); }
    if (capEnd) for (let k = 1; k <= capRings; k++) {
      const a = (Math.PI / 2) * (k / capRings);
      const s = Math.cos(a), fwd = Math.sin(a);
      ringList.push({ c: pts[N - 1].clone().addScaledVector(frames[N - 1].T, fwd * Math.min(p1.ry, p1.rz) * 0.9), f: frames[N - 1], ry: p1.ry * Math.max(s, 0.02), rz: p1.rz * Math.max(s, 0.02), oy: p1.oy, u: this.restLength, nT: fwd });
    }
    const pos = this.pos, nor = this.nor, uv = this.uv, circ = this.circ;
    let v = 0;
    for (const r of ringList) {
      const { T, U, S } = r.f;
      // ellipse circumference (Ramanujan) of the ring at rest size
      const ra = Math.max(r.ry, 1e-4), rb = Math.max(r.rz, 1e-4);
      const cc = Math.PI * (3 * (ra + rb) - Math.sqrt((3 * ra + rb) * (ra + 3 * rb)));
      for (let j = 0; j <= nv; j++) {
        const th = (j / nv) * Math.PI * 2;
        const cs = Math.cos(th), sn = Math.sin(th);
        // th = 0 is the top (U), pi the bottom
        const px = r.c.x + U.x * (r.oy + r.ry * cs) + S.x * r.rz * sn;
        const py = r.c.y + U.y * (r.oy + r.ry * cs) + S.y * r.rz * sn;
        const pz = r.c.z + U.z * (r.oy + r.ry * cs) + S.z * r.rz * sn;
        pos[v * 3] = px; pos[v * 3 + 1] = py; pos[v * 3 + 2] = pz;
        // ellipse normal, tilted along T on the caps
        let nx = U.x * cs / Math.max(r.ry, 1e-4) + S.x * sn / Math.max(r.rz, 1e-4);
        let ny = U.y * cs / Math.max(r.ry, 1e-4) + S.y * sn / Math.max(r.rz, 1e-4);
        let nz = U.z * cs / Math.max(r.ry, 1e-4) + S.z * sn / Math.max(r.rz, 1e-4);
        const l = Math.hypot(nx, ny, nz) || 1;
        const ct = Math.sqrt(Math.max(0, 1 - r.nT * r.nT));
        nx = (nx / l) * ct + T.x * r.nT; ny = (ny / l) * ct + T.y * r.nT; nz = (nz / l) * ct + T.z * r.nT;
        nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
        uv[v * 2] = r.u; uv[v * 2 + 1] = j / nv;
        circ[v] = cc;
        v++;
      }
    }
    if (capStart) {
      const f = frames[0], c = pts[0].clone().addScaledVector(f.T, -Math.min(p0.ry, p0.rz) * 0.92).addScaledVector(f.U, p0.oy);
      pos.set([c.x, c.y, c.z], v * 3); nor.set([-f.T.x, -f.T.y, -f.T.z], v * 3); uv.set([-0.02, 0.5], v * 2); circ[v] = 0.01; v++;
    }
    if (capEnd) {
      const f = frames[N - 1], c = pts[N - 1].clone().addScaledVector(f.T, Math.min(p1.ry, p1.rz) * 0.92).addScaledVector(f.U, p1.oy);
      pos.set([c.x, c.y, c.z], v * 3); nor.set([f.T.x, f.T.y, f.T.z], v * 3); uv.set([this.restLength + 0.02, 0.5], v * 2); circ[v] = 0.01; v++;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.aCirc.needsUpdate = true;
    this.geo.computeBoundingSphere();
    // instanced fur shells extend past the skin; pad the bounds
    if (this.geo.isInstancedBufferGeometry) this.geo.boundingSphere.radius += 0.05;
  }
}
