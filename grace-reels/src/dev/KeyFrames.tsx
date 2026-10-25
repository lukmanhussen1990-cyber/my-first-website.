import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TheMountain } from "../episodes/the-mountain/TheMountain";

// Review stills of the finished reel: frame i of this composition = times[i] seconds of the reel.
// Other times: --props='{"times":[25.9,28.6]}'
export const KEY_TIMES = [0.4, 1.7, 5.4, 9.6, 13.9, 17.9, 25.1, 30.95, 33.3, 36.5, 39.0, 43.5, 46.0, 48.1, 49.6, 52.4, 54.0, 56.5, 60.5, 68.95, 72.2, 74.6, 77.4, 78.6];
export const KeyFrames: React.FC<{ times?: number[] }> = ({ times = KEY_TIMES }) => {
  const i = useCurrentFrame();
  return (
    <AbsoluteFill>
      <TheMountain at={times[Math.min(i, times.length - 1)]} />
    </AbsoluteFill>
  );
};
