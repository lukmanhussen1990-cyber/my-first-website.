import { useMemo } from "react";
import { smoothstep, Vec3 } from "../../../lib/math";
import { fbm2, noise2, rngFrom } from "../../../lib/random";
import { makePath, Path } from "../../../people/motion";
import { bushGeometry, lambert, palmGeometry, rockGeometry, roundTreeGeometry, thicketGeometry } from "../../../world/models";
import { Instance, Scatter } from "../../../world/Scatter";
import { makeTerrain, mixRgb, rgb, Terrain } from "../../../world/terrain";

// The mountain in the land of Moriah: one slope with a winding path.
// S5 (foot), S1 (dawn path), S6 (the climb) and S9 (Golgotha match cut) are stretches of this path.

export const PATH_XZ: [number, number][] = [
  [-16, 34], [-8, 27], [0, 20], [6, 12], [3, 3], [-5, -6], [-11, -15], [-5, -25], [5, -33], [12, -42], [7, -52], [-3, -60], [-9, -70], [-3, -80],
];

function nearestOnPath(x: number, z: number) {
  let best = { d: 1e9, px: 0, pz: 0, s: 0 };
  let acc = 0;
  for (let i = 0; i < PATH_XZ.length - 1; i++) {
    const [ax, az] = PATH_XZ[i];
    const [bx, bz] = PATH_XZ[i + 1];
    const vx = bx - ax;
    const vz = bz - az;
    const L = Math.hypot(vx, vz);
    let k = ((x - ax) * vx + (z - az) * vz) / (L * L);
    k = Math.max(0, Math.min(1, k));
    const px = ax + vx * k;
    const pz = az + vz * k;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, px, pz, s: acc + k * L };
    acc += L;
  }
  return best;
}

function natural(x: number, z: number) {
  const u = 20 - z;
  const ramp = u <= 0 ? 0 : u * 0.34 + u * u * 0.0011;
  const ax = Math.abs(x);
  const shoulder = smoothstep(14, 42, ax) * (ramp * 0.5 + 4) * smoothstep(30, 10, z);
  const hills = fbm2(x * 0.045, z * 0.045, 7, 4) * 4.6 * (0.35 + 0.65 * smoothstep(22, -10, z));
  const rn = 1 - Math.abs(noise2(x * 0.028 + 3.1, z * 0.034, 15));
  const ridges = rn * rn * 4.5 * smoothstep(12, -20, z) * smoothstep(3, 12, Math.abs(x - 2));
  const rocky = Math.abs(noise2(x * 0.14, z * 0.14, 9)) * 1.3 * smoothstep(18, -15, z);
  const foot = fbm2(x * 0.08, z * 0.08, 4, 3) * 0.6 * smoothstep(15, 30, z);
  return ramp + shoulder + hills + ridges + rocky + foot;
}

export type MountainSet = {
  terrain: Terrain;
  path: Path;
  edges: Instance[];
  tufts: Instance[];
  rocks: Instance[];
  boulders: Instance[];
  bushes: Instance[];
  trees: Instance[];
  palms: Instance[];
  thorns: Instance[];
};

let cached: MountainSet | null = null;
export function mountainSet(): MountainSet {
  if (cached) return cached;
  const height = (x: number, z: number) => {
    const n = nearestOnPath(x, z);
    const w = smoothstep(2.3, 0.9, n.d);
    const h = natural(x, z);
    return w > 0 ? h + (natural(n.px, n.pz) - h) * w - w * 0.05 : h;
  };
  const sand = rgb("#c9a679");
  const dirt = rgb("#b08c64");
  const rock = rgb("#8e7e6b");
  const rockDark = rgb("#7a6b5a");
  const grass = rgb("#8f8c55");
  const pathCol = rgb("#ecdcb8");
  const pathEdge = rgb("#a88a66");
  const terrain = makeTerrain({
    x0: -55, z0: -115, width: 110, depth: 165, segX: 122, segZ: 182,
    height,
    color: (x, z, y, slope, face) => {
      const n = nearestOnPath(x, z);
      const v = noise2(x * 0.3, z * 0.3, 21) * 0.5 + 0.5;
      let c = mixRgb(sand, dirt, smoothstep(0.05, 0.25, slope) + v * 0.25);
      c = mixRgb(c, rock, smoothstep(0.18, 0.45, slope));
      c = mixRgb(c, rockDark, smoothstep(0.45, 0.7, slope) * 0.8);
      const g = smoothstep(0.2, 0.65, noise2(x * 0.07, z * 0.07, 33) * 0.5 + 0.5) * smoothstep(-5, 15, z) * (1 - smoothstep(0.1, 0.3, slope));
      c = mixRgb(c, grass, g * 0.55);
      c = mixRgb(c, pathEdge, smoothstep(1.9, 1.45, n.d) * smoothstep(0.95, 1.35, n.d) * 0.55);
      c = mixRgb(c, pathCol, smoothstep(1.25, 0.8, n.d));
      const k = 0.93 + ((face * 2654435761) % 1000) / 1000 * 0.09;
      return [c[0] * k, c[1] * k, c[2] * k];
    },
  });
  const path = makePath(PATH_XZ.map(([x, z]) => [x, terrain.heightAt(x, z), z] as Vec3));
  const r = rngFrom(77);
  const place = (n: number, minD: number, s0: number, s1: number, zone: (x: number, z: number) => boolean, tint: () => string, sink = 0.1) => {
    const out: Instance[] = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 40) {
      const x = r.range(-52, 52);
      const z = r.range(-110, 46);
      if (!zone(x, z)) continue;
      if (nearestOnPath(x, z).d < minD) continue;
      const s = r.range(s0, s1);
      out.push({ pos: [x, terrain.heightAt(x, z) - s * sink, z], rotY: r.range(0, Math.PI * 2), scale: [s * r.range(0.8, 1.3), s, s * r.range(0.8, 1.3)], tint: tint() });
    }
    return out;
  };
  const greys = ["#ffffff", "#f2ece4", "#e3dbd0", "#d8d0c4"];
  // small stones lining both edges of the path
  const edges: Instance[] = [];
  for (let d = 0; d < path.total; d += 1.05) {
    for (const side of [-1, 1]) {
      if (r.next() < 0.3) continue;
      let i = 1;
      while (i < path.lengths.length - 1 && path.lengths[i] < d) i++;
      const a = path.pts[i - 1];
      const b = path.pts[i];
      const L = path.lengths[i] - path.lengths[i - 1];
      const f = (d - path.lengths[i - 1]) / L;
      const nx = -(b[2] - a[2]) / L;
      const nz = (b[0] - a[0]) / L;
      const off = side * r.range(1.3, 1.7);
      const x = a[0] + (b[0] - a[0]) * f + nx * off;
      const z = a[2] + (b[2] - a[2]) * f + nz * off;
      const sc = r.range(0.12, 0.3);
      edges.push({ pos: [x, terrain.heightAt(x, z) - sc * 0.2, z], rotY: r.range(0, 6.28), scale: [sc * 1.3, sc, sc], tint: r.pick(greys) });
    }
  }
  cached = {
    terrain,
    path,
    edges,
    tufts: place(900, 1.45, 0.18, 0.42, (x, z) => z > -84, () => r.pick(["#ffffff", "#f0e6c0", "#e5ddb0"]), 0.15),
    rocks: place(560, 2.0, 0.18, 0.9, () => true, () => r.pick(greys)),
    boulders: place(130, 4.2, 1.3, 4.4, (x, z) => z < 22, () => r.pick(greys), 0.28),
    bushes: place(170, 1.9, 0.35, 0.8, (x, z) => z > -60, () => r.pick(["#ffffff", "#e9f0d8", "#f3e6c6"])),
    trees: place(46, 4, 2.4, 4.0, (x, z) => z > -64, () => r.pick(["#ffffff", "#e8f0d8", "#f4ecd0"]), 0.02),
    palms: place(10, 5, 4.5, 6, (x, z) => z > 22, () => "#ffffff", 0.02),
    thorns: place(26, 3, 0.7, 1.2, (x, z) => z < 10 && z > -70, () => "#ffffff", 0.05),
  };
  return cached;
}

export const MountainTerrain: React.FC<{ near?: Vec3 }> = () => {
  const set = mountainSet();
  const mat = useMemo(() => lambert(), []);
  const geos = useMemo(() => ({ rock: rockGeometry(5), boulder: rockGeometry(9, "#8d7e6c"), bush: bushGeometry(3, "#76783f"), tree: roundTreeGeometry(4, "#6a8a3e"), palm: palmGeometry(8), thorn: thicketGeometry(5), tuft: bushGeometry(12, "#9c9655") }), []);
  return (
    <>
      <mesh geometry={set.terrain.geometry} material={mat} receiveShadow />
      <Scatter geometry={geos.rock} material={mat} items={set.rocks} />
      <Scatter geometry={geos.rock} material={mat} items={set.edges} />
      <Scatter geometry={geos.tuft} material={mat} items={set.tufts} castShadow={false} />
      <Scatter geometry={geos.boulder} material={mat} items={set.boulders} />
      <Scatter geometry={geos.bush} material={mat} items={set.bushes} />
      <Scatter geometry={geos.tree} material={mat} items={set.trees} />
      <Scatter geometry={geos.palm} material={mat} items={set.palms} />
      <Scatter geometry={geos.thorn} material={mat} items={set.thorns} />
    </>
  );
};
