import { ThreeCanvas } from "@remotion/three";
import { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { applyPose, orbit } from "../lib/camera";
import { MOODS } from "../lib/moods";
import { fbm2, rngFrom } from "../lib/random";
import { Composer } from "../post/Composer";
import { Fog, Lights, Sky } from "../world/environment";
import { lambert, palmGeometry, rockGeometry, roundTreeGeometry } from "../world/models";
import { Scatter } from "../world/Scatter";
import { makeTerrain, mixRgb, rgb } from "../world/terrain";

const Cam: React.FC<{ t: number }> = ({ t }) => {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    applyPose(camera as THREE.PerspectiveCamera, { pos: orbit([0, 0, 0], 70, 20 + t * 8, 40), target: [0, 0, 0], fov: 26 }, size.width / size.height);
  });
  return null;
};

const World: React.FC = () => {
  const terrain = useMemo(() => makeTerrain({
    x0: -60, z0: -60, width: 120, depth: 120, segX: 110, segZ: 110,
    height: (x, z) => fbm2(x * 0.04, z * 0.04, 3, 4) * 6,
    color: (x, z, y, slope) => mixRgb(rgb("#c9a878"), rgb("#8f7a63"), slope * 3 + y * 0.03),
  }), []);
  const mat = useMemo(() => lambert(), []);
  const rockGeo = useMemo(() => rockGeometry(3), []);
  const treeGeo = useMemo(() => roundTreeGeometry(5), []);
  const palmGeo = useMemo(() => palmGeometry(7), []);
  const items = (n: number, seed: number, s0: number, s1: number) => {
    const r = rngFrom(seed);
    return Array.from({ length: n }, () => {
      const x = r.range(-50, 50), z = r.range(-50, 50);
      return { pos: [x, terrain.heightAt(x, z), z] as [number, number, number], rotY: r.range(0, 6.28), scale: r.range(s0, s1) };
    });
  };
  const rocks = useMemo(() => items(300, 1, 0.3, 1.2), []);
  const trees = useMemo(() => items(80, 2, 3, 5), []);
  const palms = useMemo(() => items(25, 4, 4, 6), []);
  return (
    <>
      <mesh geometry={terrain.geometry} material={mat} receiveShadow />
      <Scatter geometry={rockGeo} material={mat} items={rocks} />
      <Scatter geometry={treeGeo} material={mat} items={trees} />
      <Scatter geometry={palmGeo} material={mat} items={palms} />
    </>
  );
};

export const Bench: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const m = MOODS.climb;
  return (
    <ThreeCanvas width={width} height={height} shadows="soft" gl={{ antialias: false, powerPreference: "high-performance" }} camera={{ fov: 26, position: [0, 40, 60] }}>
      <Cam t={t} />
      <Sky mood={m} />
      <Fog mood={m} />
      <Lights mood={m} center={[0, 0, 0]} radius={60} />
      <World />
      <Composer settings={{ exposure: m.exposure, bloom: m.bloom, bloomThreshold: m.bloomThreshold, tilt: m.tilt }} />
    </ThreeCanvas>
  );
};
