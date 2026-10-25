import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothstep, Vec3 } from "../../../lib/math";
import { fbm2, rngFrom } from "../../../lib/random";
import { bushGeometry, cloudGeometry, facet, hex, lambert, rockGeometry, roundTreeGeometry } from "../../../world/models";
import { crossGeometry } from "../../../world/props";
import { Instance, Scatter } from "../../../world/Scatter";
import { makeTerrain, mixRgb, rgb, Terrain } from "../../../world/terrain";

// The place of a skull: a bare hill with one cross, a city wall far behind, a heavy sky.

export const CROSS: Vec3 = [0, 0, 0];

export type GolgothaSet = { terrain: Terrain; rocks: Instance[]; bushes: Instance[]; trees: Instance[]; clouds: Instance[]; city: THREE.BufferGeometry };

let cached: GolgothaSet | null = null;
export function golgothaSet(): GolgothaSet {
  if (cached) return cached;
  const height = (x: number, z: number) => {
    const d = Math.hypot(x, z * 1.15);
    return 7.5 * Math.exp(-(d * d) / (2 * 9.5 * 9.5)) + fbm2(x * 0.06, z * 0.06, 31, 4) * 1.4 - smoothstep(30, 70, Math.hypot(x, z)) * 2;
  };
  const grass = rgb("#a39a74");
  const earth = rgb("#a1866a");
  const stone = rgb("#8a7b6b");
  const terrain = makeTerrain({
    x0: -80, z0: -90, width: 160, depth: 150, segX: 100, segZ: 94,
    height,
    color: (x, z, y, slope, face) => {
      let c = mixRgb(grass, earth, smoothstep(0.03, 0.2, slope) + smoothstep(4, 7, y) * 0.5);
      c = mixRgb(c, stone, smoothstep(0.25, 0.5, slope));
      const k = 0.93 + (((face * 2654435761) % 1000) / 1000) * 0.08;
      return [c[0] * k, c[1] * k, c[2] * k];
    },
  });
  const r = rngFrom(1212);
  const ring = (n: number, d0: number, d1: number, s0: number, s1: number, sink = 0.15, keep = (_x: number, _z: number) => true) => {
    const out: Instance[] = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 30) {
      const a = r.range(0, Math.PI * 2);
      const d = r.range(d0, d1);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (!keep(x, z)) continue;
      const s = r.range(s0, s1);
      out.push({ pos: [x, terrain.heightAt(x, z) - s * sink, z], rotY: r.range(0, 6.28), scale: s });
    }
    return out;
  };
  // keep the gathering ground in front of the hill clear
  const clear = (x: number, z: number) => !(z > 2 && z < 16 && Math.abs(x) < 14);
  // city wall + towers far behind the hill
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const x = -70 + i * 11;
    const h = 5 + (i % 3) * 1.5;
    const b = new THREE.BoxGeometry(11.2, h, 2.4);
    b.translate(x, h / 2 - 1, -62 - Math.sin(i * 0.7) * 4);
    parts.push(facet(b, hex("#b5a487")));
    if (i % 3 === 0) {
      const tw = new THREE.BoxGeometry(4, h + 5, 4);
      tw.translate(x, (h + 5) / 2 - 1, -62 - Math.sin(i * 0.7) * 4);
      parts.push(facet(tw, hex("#a99878")));
    }
  }
  for (let i = 0; i < 22; i++) {
    const w = r.range(4, 8);
    const h = r.range(3, 7);
    const b = new THREE.BoxGeometry(w, h, w);
    b.translate(r.range(-60, 60), h / 2 - 1, r.range(-90, -68));
    parts.push(facet(b, hex(r.pick(["#c2b192", "#b8a684", "#ab9a7a"]))));
  }
  cached = {
    terrain,
    rocks: ring(150, 3, 46, 0.25, 1.3, 0.2, clear),
    bushes: ring(70, 8, 50, 0.4, 0.9, 0.05, clear),
    trees: ring(18, 22, 55, 3, 5, 0.02, clear),
    clouds: Array.from({ length: 26 }, (_, i) => {
      const a = (i / 26) * Math.PI * 2 + r.range(-0.2, 0.2);
      const d = r.range(40, 95);
      return { pos: [Math.cos(a) * d, r.range(22, 34), Math.sin(a) * d - 25] as Vec3, rotY: r.range(0, 6.28), scale: r.range(8, 15) };
    }),
    city: mergeGeometries(parts)!,
  };
  return cached;
}

export const GolgothaTerrain: React.FC<{ cloudShift?: number; cloudTint?: string }> = ({ cloudShift = 0, cloudTint = "#8e949c" }) => {
  const set = golgothaSet();
  const mat = useMemo(() => lambert(), []);
  const cloudMat = useMemo(() => lambert({ transparent: true, opacity: 0.95 }), []);
  cloudMat.color.set(cloudTint);
  const geos = useMemo(() => ({ rock: rockGeometry(23, "#8f8070"), bush: bushGeometry(13, "#6f6c45"), tree: roundTreeGeometry(17, "#5e7a42"), cloud: cloudGeometry(9), cross: crossGeometry() }), []);
  // clouds part away from the cross as the light breaks
  const clouds = useMemo(() => set.clouds.map((c) => c), [set]);
  const parted = clouds.map((c) => {
    const dx = c.pos[0];
    const dz = c.pos[2] + 25;
    const d = Math.hypot(dx, dz) || 1;
    return { ...c, pos: [c.pos[0] + (dx / d) * cloudShift, c.pos[1], c.pos[2] + (dz / d) * cloudShift] as Vec3 };
  });
  const cy = set.terrain.heightAt(CROSS[0], CROSS[2]);
  return (
    <>
      <mesh geometry={set.terrain.geometry} material={mat} receiveShadow />
      <mesh geometry={set.city} material={mat} receiveShadow />
      <Scatter geometry={geos.rock} material={mat} items={set.rocks} />
      <Scatter geometry={geos.bush} material={mat} items={set.bushes} />
      <Scatter geometry={geos.tree} material={mat} items={set.trees} />
      <Scatter geometry={geos.cloud} material={cloudMat} items={parted} castShadow={false} receiveShadow={false} />
      <mesh geometry={geos.cross} material={mat} position={[CROSS[0], cy - 0.1, CROSS[2]]} castShadow receiveShadow />
    </>
  );
};
