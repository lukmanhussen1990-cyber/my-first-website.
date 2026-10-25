import * as THREE from "three";

// Low-poly terrain: a regular grid, every triangle flat-shaded with one colour.
// heightAt() interpolates the exact same triangles, so anything placed on the ground sits on it.

export type TerrainSpec = {
  x0: number;
  z0: number;
  width: number;
  depth: number;
  segX: number;
  segZ: number;
  height: (x: number, z: number) => number;
  color: (x: number, z: number, y: number, slope: number, face: number) => [number, number, number];
};

export type Terrain = { geometry: THREE.BufferGeometry; heightAt: (x: number, z: number) => number; spec: TerrainSpec };

export function makeTerrain(spec: TerrainSpec): Terrain {
  const { x0, z0, width, depth, segX, segZ } = spec;
  const dx = width / segX;
  const dz = depth / segZ;
  const H = new Float32Array((segX + 1) * (segZ + 1));
  for (let iz = 0; iz <= segZ; iz++)
    for (let ix = 0; ix <= segX; ix++) H[iz * (segX + 1) + ix] = spec.height(x0 + ix * dx, z0 + iz * dz);
  const h = (ix: number, iz: number) => H[iz * (segX + 1) + ix];

  const pos: number[] = [];
  const col: number[] = [];
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  let face = 0;
  const pushTri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => {
    const ay = h(ax, az);
    const by = h(bx, bz);
    const cy = h(cx, cz);
    const A = [x0 + ax * dx, ay, z0 + az * dz];
    const B = [x0 + bx * dx, by, z0 + bz * dz];
    const C = [x0 + cx * dx, cy, z0 + cz * dz];
    pos.push(...A, ...B, ...C);
    tmpA.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    tmpB.set(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
    tmpN.crossVectors(tmpA, tmpB).normalize();
    if (tmpN.y < 0) tmpN.negate();
    const slope = 1 - tmpN.y;
    const mx = (A[0] + B[0] + C[0]) / 3;
    const my = (ay + by + cy) / 3;
    const mz = (A[2] + B[2] + C[2]) / 3;
    const [r, g, b] = spec.color(mx, mz, my, slope, face++);
    const c = new THREE.Color(r, g, b).convertSRGBToLinear();
    for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b);
  };
  for (let iz = 0; iz < segZ; iz++)
    for (let ix = 0; ix < segX; ix++) {
      // a=(ix,iz) b=(ix,iz+1) c=(ix+1,iz+1) d=(ix+1,iz); faces (a,b,d) and (b,c,d), counter-clockwise from above
      pushTri(ix, iz, ix, iz + 1, ix + 1, iz);
      pushTri(ix, iz + 1, ix + 1, iz + 1, ix + 1, iz);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const heightAt = (x: number, z: number) => {
    const fx = Math.min(segX - 1e-6, Math.max(0, (x - x0) / dx));
    const fz = Math.min(segZ - 1e-6, Math.max(0, (z - z0) / dz));
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const u = fx - ix;
    const v = fz - iz;
    // triangle (a,b,d) covers u + v <= 1 (a at origin, b at +v, d at +u)
    if (u + v <= 1) return h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * u + (h(ix, iz + 1) - h(ix, iz)) * v;
    // triangle (b,c,d)
    return h(ix + 1, iz + 1) + (h(ix, iz + 1) - h(ix + 1, iz + 1)) * (1 - u) + (h(ix + 1, iz) - h(ix + 1, iz + 1)) * (1 - v);
  };
  return { geometry: g, heightAt, spec };
}

/** sRGB hex -> [r,g,b] 0..1 (for terrain colour functions). */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function mixRgb(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, k));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
