import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothstep, Vec3 } from "../../../lib/math";
import { fbm2, noise2, rngFrom } from "../../../lib/random";
import { bushGeometry, cloudGeometry, facet, hex, lambert, rockGeometry, thicketGeometry } from "../../../world/models";
import { altarGeometry, woodStackGeometry } from "../../../world/props";
import { Instance, Scatter } from "../../../world/Scatter";
import { makeTerrain, mixRgb, rgb, Terrain } from "../../../world/terrain";

// The top of the mountain: a rocky plateau with the altar, the thicket where the ram is caught,
// and a sea of hazy ridges all around.

export const ALTAR: Vec3 = [0, 0, 0];
export const ABRAHAM_TOP: Vec3 = [1.05, 0, -1.35];
export const ISAAC_TOP: Vec3 = [-1.5, 0, 0.75];
export const SEAT: Vec3 = [-1.05, 0, 1.95];
export const THICKET: Vec3 = [-1.2, 0, -5.6];

export type SummitSet = { terrain: Terrain; rocks: Instance[]; ridges: THREE.BufferGeometry; clouds: Instance[]; bushes: Instance[] };

let cached: SummitSet | null = null;
export function summitSet(): SummitSet {
  if (cached) return cached;
  const height = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    const plateau = 30 - smoothstep(9, 26, d) * 26 - smoothstep(26, 60, d) * 22;
    return plateau + fbm2(x * 0.09, z * 0.09, 17, 4) * (0.35 + smoothstep(6, 20, d) * 2.6) + Math.abs(noise2(x * 0.2, z * 0.2, 3)) * smoothstep(8, 16, d) * 1.2;
  };
  const top = rgb("#c7aa80");
  const rock = rgb("#8d7d6a");
  const dark = rgb("#776856");
  const terrain = makeTerrain({
    x0: -60, z0: -60, width: 120, depth: 120, segX: 96, segZ: 96,
    height,
    color: (x, z, y, slope, face) => {
      let c = mixRgb(top, rock, smoothstep(0.08, 0.35, slope));
      c = mixRgb(c, dark, smoothstep(0.4, 0.7, slope) * 0.8);
      const k = 0.93 + (((face * 2654435761) % 1000) / 1000) * 0.09;
      return [c[0] * k, c[1] * k, c[2] * k];
    },
  });
  const r = rngFrom(909);
  const rocks: Instance[] = [];
  for (let i = 0; i < 140; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(5.5, 24);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.hypot(x - THICKET[0], z - THICKET[2]) < 2.6) continue;
    const s = r.range(0.3, d > 10 ? 2.6 : 1.2);
    rocks.push({ pos: [x, terrain.heightAt(x, z) - s * 0.2, z], rotY: r.range(0, 6.28), scale: [s * r.range(0.9, 1.4), s, s], tint: r.pick(["#ffffff", "#ece4d8", "#ddd3c5"]) });
  }
  rocks.push({ pos: [SEAT[0], terrain.heightAt(SEAT[0], SEAT[2]) - 0.1, SEAT[2]], rotY: 0.4, scale: [0.52, 0.5, 0.44], tint: "#efe6d8" });
  const bushes: Instance[] = [];
  for (let i = 0; i < 26; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(6, 16);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    bushes.push({ pos: [x, terrain.heightAt(x, z), z], rotY: r.range(0, 6.28), scale: r.range(0.4, 0.8) });
  }
  // distant ridges in every direction (for depth through the haze)
  const ridgeParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r.range(-0.15, 0.15);
    const d = r.range(110, 190);
    const h = r.range(22, 48);
    const g = new THREE.ConeGeometry(r.range(40, 70), h, 7, 2);
    g.translate(Math.cos(a) * d, h / 2 - 12, Math.sin(a) * d);
    ridgeParts.push(facet(g, (p, k) => {
      const c = hex("#9d8a74");
      const m = 0.88 + (k % 5) * 0.035;
      return [c[0] * m, c[1] * m, c[2] * m];
    }));
  }
  const clouds: Instance[] = [];
  for (let i = 0; i < 22; i++) {
    const a = r.range(0, Math.PI * 2);
    const d = r.range(45, 120);
    clouds.push({ pos: [Math.cos(a) * d, r.range(8, 20), Math.sin(a) * d], rotY: r.range(0, 6.28), scale: r.range(6, 12) });
  }
  cached = { terrain, rocks, ridges: mergeGeometries(ridgeParts)!, clouds, bushes };
  return cached;
}

export const SummitTerrain: React.FC = () => {
  const set = summitSet();
  const mat = useMemo(() => lambert(), []);
  const cloudMat = useMemo(() => lambert({ transparent: true, opacity: 0.92 }), []);
  const geos = useMemo(() => ({ rock: rockGeometry(13, "#9a8a76"), altar: altarGeometry(3), wood: woodStackGeometry(4), thicket: thicketGeometry(77), bush: bushGeometry(6, "#7a7a42"), cloud: cloudGeometry(5) }), []);
  const y = set.terrain.heightAt(ALTAR[0], ALTAR[2]);
  const ty = set.terrain.heightAt(THICKET[0], THICKET[2]);
  return (
    <>
      <mesh geometry={set.terrain.geometry} material={mat} receiveShadow />
      <mesh geometry={set.ridges} material={mat} />
      <Scatter geometry={geos.rock} material={mat} items={set.rocks} />
      <Scatter geometry={geos.bush} material={mat} items={set.bushes} />
      <Scatter geometry={geos.cloud} material={cloudMat} items={set.clouds} castShadow={false} receiveShadow={false} />
      <mesh geometry={geos.altar} material={mat} position={[ALTAR[0], y - 0.05, ALTAR[2]]} castShadow receiveShadow />
      <mesh geometry={geos.wood} material={mat} position={[ALTAR[0], y + 0.83, ALTAR[2]]} castShadow receiveShadow />
      <Scatter
        geometry={geos.thicket}
        material={mat}
        items={[
          { pos: [THICKET[0], ty, THICKET[2]], scale: [2.1, 1.5, 1.6], rotY: 0.3 },
          { pos: [THICKET[0] - 1.3, ty, THICKET[2] - 0.5], scale: [1.4, 1.2, 1.3], rotY: 1.9 },
          { pos: [THICKET[0] + 1.2, ty, THICKET[2] - 0.3], scale: [1.3, 1.1, 1.2], rotY: 2.7 },
        ]}
      />
    </>
  );
};
