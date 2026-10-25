import { useMemo } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { smoothstep, Vec3 } from "../../../lib/math";
import { fbm2, noise2, rngFrom } from "../../../lib/random";
import { makePath, Path } from "../../../people/motion";
import { facet, hex, lambert, palmGeometry, rockGeometry, bushGeometry } from "../../../world/models";
import { tentGeometry } from "../../../world/props";
import { Instance, Scatter } from "../../../world/Scatter";
import { makeTerrain, mixRgb, rgb, Terrain } from "../../../world/terrain";

// The desert between Beersheba and Moriah: dunes, palms, Abraham's tent, the caravan road,
// and the mountains of Moriah far away on the horizon.

export const TENT: Vec3 = [0, 0, 0];
export const MORIAH: Vec3 = [40, 0, -300];
export const MORIAH_PEAK: Vec3 = [40, 20, -300]; // filled in by desertSet()
export const ROAD_XZ: [number, number][] = [[-60, 30], [-30, 24], [0, 20], [30, 14], [60, 6], [90, -4]];

export type DesertSet = { terrain: Terrain; road: Path; palms: Instance[]; rocks: Instance[]; bushes: Instance[]; moriah: THREE.BufferGeometry; ranges: THREE.BufferGeometry };

let cached: DesertSet | null = null;
export function desertSet(): DesertSet {
  if (cached) return cached;
  const height = (x: number, z: number) => {
    const dunes = Math.sin(x * 0.07 + fbm2(x * 0.02, z * 0.02, 3) * 3) * 1.1 + fbm2(x * 0.035, z * 0.035, 5, 4) * 2.4;
    const flat = smoothstep(14, 4, Math.hypot(x - TENT[0], z - TENT[2])); // flat camp ground
    const roadD = Math.abs(z - (20 - x * 0.2));
    const road = smoothstep(5, 1.5, roadD);
    return dunes * (1 - flat * 0.85) * (1 - road * 0.7) + noise2(x * 0.2, z * 0.2, 4) * 0.12;
  };
  const sand = rgb("#d9b98a");
  const sandShade = rgb("#c59f72");
  const roadCol = rgb("#e6cfa4");
  const terrain = makeTerrain({
    x0: -110, z0: -130, width: 240, depth: 190, segX: 120, segZ: 95,
    height,
    color: (x, z, y, slope, face) => {
      let c = mixRgb(sand, sandShade, smoothstep(0.02, 0.16, slope) + noise2(x * 0.1, z * 0.1, 8) * 0.2);
      c = mixRgb(c, roadCol, smoothstep(3.0, 1.2, Math.abs(z - (20 - x * 0.2))) * 0.8);
      const k = 0.95 + (((face * 2654435761) % 1000) / 1000) * 0.07;
      return [c[0] * k, c[1] * k, c[2] * k];
    },
  });
  const road = makePath(ROAD_XZ.map(([x, z]) => [x, terrain.heightAt(x, z), z] as Vec3));
  const r = rngFrom(404);
  const scatter = (n: number, s0: number, s1: number, keep: (x: number, z: number) => boolean, sink = 0.05) => {
    const out: Instance[] = [];
    let g = 0;
    while (out.length < n && g++ < n * 50) {
      const x = r.range(-100, 120);
      const z = r.range(-120, 55);
      if (!keep(x, z)) continue;
      const s = r.range(s0, s1);
      out.push({ pos: [x, terrain.heightAt(x, z) - s * sink, z], rotY: r.range(0, 6.28), scale: s });
    }
    return out;
  };
  const offRoad = (x: number, z: number) => Math.abs(z - (20 - x * 0.2)) > 4 && Math.hypot(x, z) > 6 && !(z > 20 - x * 0.2 && z < 20 - x * 0.2 + 34);
  // the far mountains: big low-poly cones on the horizon
  const mountain = (seed: number, at: Vec3, rad: number, h: number, col: string) => {
    const g = new THREE.ConeGeometry(rad, h, 9, 3);
    const pos = g.getAttribute("position");
    const rr = rngFrom(seed);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < h / 2 - 0.01) pos.setXYZ(i, pos.getX(i) * rr.range(0.85, 1.15), y + rr.range(-0.06, 0.06) * h, pos.getZ(i) * rr.range(0.85, 1.15));
    }
    g.translate(at[0], at[1] + h / 2 - h * 0.08, at[2]);
    return facet(g, (p, i) => {
      const c = hex(col);
      const k = 0.88 + (i % 5) * 0.04;
      return [c[0] * k, c[1] * k, c[2] * k];
    });
  };
  const ridgeH = (x: number, z: number) => {
    const dx = x - MORIAH[0];
    const along = 9 + 15 * Math.exp(-(dx * dx) / (2 * 55 * 55)) + fbm2(x * 0.012, 3.3, 61, 4) * 9 + Math.abs(noise2(x * 0.03, z * 0.03, 62)) * 5;
    const front = smoothstep(MORIAH[2] + 70, MORIAH[2] - 10, z); // rises from the plain to the crest
    return along * front - 1.5;
  };
  const ridge = makeTerrain({
    x0: MORIAH[0] - 300, z0: MORIAH[2] - 70, width: 600, depth: 150, segX: 90, segZ: 22,
    height: ridgeH,
    color: (x, z, y, slope, face) => {
      const c = mixRgb(rgb("#b39880"), rgb("#8e7764"), smoothstep(0.05, 0.4, slope) + y * 0.012);
      const k = 0.92 + (((face * 2654435761) % 1000) / 1000) * 0.1;
      return [c[0] * k, c[1] * k, c[2] * k];
    },
  });
  let peak: Vec3 = [MORIAH[0], 0, MORIAH[2]];
  for (let x = MORIAH[0] - 60; x <= MORIAH[0] + 60; x += 2)
    for (let z = MORIAH[2] - 20; z <= MORIAH[2] + 10; z += 2) {
      const h = ridge.heightAt(x, z);
      if (h > peak[1]) peak = [x, h, z];
    }
  MORIAH_PEAK[0] = peak[0];
  MORIAH_PEAK[1] = peak[1];
  MORIAH_PEAK[2] = peak[2];
  const moriah = ridge.geometry;
  const ranges = mergeGeometries([
    mountain(4, [-150, 0, -330], 90, 21, "#b0957a"),
    mountain(5, [-250, 0, -300], 80, 17, "#b39a80"),
    mountain(6, [230, 0, -330], 85, 19, "#ab9176"),
  ])!;
  cached = {
    terrain,
    road,
    palms: [
      { pos: [4.5, terrain.heightAt(4.5, -3.5), -3.5], scale: 5.6, rotY: 1 },
      { pos: [-5.2, terrain.heightAt(-5.2, -4.2), -4.2], scale: 6.4, rotY: 2 },
      { pos: [-3.5, terrain.heightAt(-3.5, 5.5), 5.5], scale: 4.8, rotY: 3 },
      ...scatter(26, 4.5, 6.5, offRoad, 0.02),
    ],
    rocks: scatter(260, 0.25, 1.4, offRoad, 0.15),
    bushes: scatter(120, 0.3, 0.7, offRoad),
    moriah,
    ranges,
  };
  return cached;
}

export const DesertTerrain: React.FC<{ tent?: boolean; haze?: string }> = ({ tent = true, haze = "#e9d2a8" }) => {
  const set = desertSet();
  const mat = useMemo(() => lambert(), []);
  const far = useMemo(() => lambert({ fog: false }), []);
  far.color.set("#ffffff").lerp(new THREE.Color(haze), 0.45);
  const geos = useMemo(() => ({ palm: palmGeometry(21), rock: rockGeometry(17, "#b49a7c"), bush: bushGeometry(9, "#8a8448"), tent: tentGeometry() }), []);
  return (
    <>
      <mesh geometry={set.terrain.geometry} material={mat} receiveShadow />
      <mesh geometry={set.moriah} material={far} />
      <mesh geometry={set.ranges} material={far} />
      <Scatter geometry={geos.palm} material={mat} items={set.palms} />
      <Scatter geometry={geos.rock} material={mat} items={set.rocks} />
      <Scatter geometry={geos.bush} material={mat} items={set.bushes} />
      {tent ? <mesh geometry={geos.tent} material={mat} position={[TENT[0], set.terrain.heightAt(TENT[0], TENT[2]), TENT[2]]} rotation={[0, 0.5, 0]} castShadow receiveShadow /> : null}
    </>
  );
};
