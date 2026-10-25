import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { applyPose, CamPose, orbit } from "../lib/camera";
import { MOODS } from "../lib/moods";
import { fbm2 } from "../lib/random";
import { ABRAHAM, crowdSpecs, figure, ISAAC, JESUS, SERVANT_A, SERVANT_B } from "../people/cast";
import { PaperPerson } from "../people/Paper";
import { Composer } from "../post/Composer";
import { Fog, Lights, Sky, sunDirection } from "../world/environment";
import { lambert } from "../world/models";
import { makeTerrain, mixRgb, rgb } from "../world/terrain";

const Cam: React.FC<{ pose: CamPose }> = ({ pose }) => {
  const { camera, size } = useThree();
  useLayoutEffect(() => applyPose(camera as THREE.PerspectiveCamera, pose, size.width / size.height));
  return null;
};

export const PeopleTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const m = MOODS.dawnGold;
  const sun = sunDirection(m);
  const pose: CamPose = { pos: orbit([-0.6, 0.9, -1], 17, 10, 38), target: [-0.6, 0.6, -1], fov: 26 };
  const terrain = useMemo(() => makeTerrain({ x0: -20, z0: -20, width: 40, depth: 40, segX: 40, segZ: 40, height: (x, z) => fbm2(x * 0.1, z * 0.1, 2) * 0.4, color: (x, z, y, sl) => mixRgb(rgb("#c9a878"), rgb("#a88f70"), sl * 4 + 0.2 * Math.sin(x)) }), []);
  const mat = useMemo(() => lambert(), []);
  const crowd = useMemo(() => crowdSpecs(4, 7).map((s) => figure(s)), []);
  const figs = [figure(ABRAHAM), figure(ISAAC), figure(SERVANT_A), figure(SERVANT_B), figure(JESUS), ...crowd];
  const xs = [-3.2, -1.9, -0.6, 0.7, 2.0, -2.6, -1.2, 0.2, 1.6];
  const zs = [0, 0.2, -0.2, 0.1, 0.3, -2.2, -2.4, -2.1, -2.3];
  return (
    <ThreeCanvas width={width} height={height} shadows="soft" gl={{ antialias: false }}>
      <Cam pose={pose} />
      <Sky mood={m} />
      <Fog mood={m} />
      <Lights mood={m} center={[0, 0, 0]} radius={14} />
      <mesh geometry={terrain.geometry} material={mat} receiveShadow />
      {figs.map((f, i) => (
        <PaperPerson key={i} fig={f} cam={pose.pos} sun={sun} pose={{ pos: [xs[i], terrain.heightAt(xs[i], zs[i]), zs[i]], face: i % 3 === 2 ? -1 : 1, walk: t * 5 + i, walkAmt: i % 2 ? 1 : 0.0, t, seed: i * 7 + 1, armFront: i === 0 ? 0.5 : undefined }} />
      ))}
      <Composer settings={{ exposure: m.exposure, bloom: m.bloom, bloomThreshold: m.bloomThreshold, tilt: 0.4 }} />
    </ThreeCanvas>
  );
};
