import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import * as THREE from "three";
import { applyPose, CamPose } from "../lib/camera";
import { Vec3 } from "../lib/math";
import { Mood } from "../lib/moods";
import { Composer, PostSettings } from "../post/Composer";
import { Fog, Lights, Sky } from "./environment";

// Everything a scene needs to be rendered: a pure camera, a mood, label anchors and a 3D world.

export type SceneDef = {
  id: string;
  camera: (t: number) => CamPose;
  mood: (t: number) => Mood;
  anchors?: (t: number) => Record<string, Vec3>;
  World: React.FC<{ t: number; cam: CamPose; mood: Mood }>;
  post?: (t: number, mood: Mood) => Partial<PostSettings>;
  shadow?: (t: number) => { center: Vec3; radius: number };
  sky?: (t: number) => { sunDisc?: number; glowAmt?: number };
};

const CameraRig: React.FC<{ pose: CamPose }> = ({ pose }) => {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    applyPose(camera as THREE.PerspectiveCamera, pose, size.width / size.height);
  });
  return null;
};

export const Stage: React.FC<{ scene: SceneDef; t: number; width: number; height: number }> = ({ scene, t, width, height }) => {
  const cam = scene.camera(t);
  const mood = scene.mood(t);
  const sh = scene.shadow ? scene.shadow(t) : { center: cam.target, radius: 40 };
  const post: PostSettings = {
    exposure: mood.exposure,
    bloom: mood.bloom,
    bloomThreshold: mood.bloomThreshold,
    tilt: mood.tilt,
    ...(scene.post ? scene.post(t, mood) : {}),
  };
  const sky = scene.sky ? scene.sky(t) : {};
  return (
    <ThreeCanvas
      width={width}
      height={height}
      shadows="soft"
      gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={{ fov: cam.fov, near: 0.3, far: 900, position: cam.pos }}
    >
      <CameraRig pose={cam} />
      <Sky mood={mood} sunDisc={sky.sunDisc} glowAmt={sky.glowAmt} />
      <Fog mood={mood} />
      <Lights mood={mood} center={sh.center} radius={sh.radius} />
      <scene.World t={t} cam={cam} mood={mood} />
      <Composer settings={post} />
    </ThreeCanvas>
  );
};
