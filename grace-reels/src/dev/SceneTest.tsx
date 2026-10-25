import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Stage, SceneDef } from "../world/Stage";
import { S1 } from "../episodes/the-mountain/scenes/S1";
import { S2, S3, S4 } from "../episodes/the-mountain/scenes/S2S3S4";
import { S5, S6, S9 } from "../episodes/the-mountain/scenes/S5S6S9";
import { S7, S8 } from "../episodes/the-mountain/scenes/S7S8";
import { S10, S11 } from "../episodes/the-mountain/scenes/S10S11";

// Look development: render 3D scenes alone (no overlays).
export const SCENES: Record<string, SceneDef> = { S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11 };

export const SceneTest: React.FC<{ scene: string; offset: number }> = ({ scene, offset }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage scene={SCENES[scene]} t={offset + frame / fps} width={width} height={height} />
    </AbsoluteFill>
  );
};

// One frame per (scene, time) pair, so a single render reviews many shots.
export const LOOKS: [string, number][] = [
  ["S4", 15.4], ["S4", 15.75], ["S4", 16.05], ["S4", 16.9], ["S4", 18.4],
];

export const LookDev: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [scene, t] = LOOKS[Math.min(frame, LOOKS.length - 1)];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage key={`${scene}-${t}`} scene={SCENES[scene]} t={t} width={width} height={height} />
    </AbsoluteFill>
  );
};
