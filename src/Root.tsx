// Every short is one composition: 1080x1920 at 30 fps (the final 2K export renders it with --scale 1.3333).
// New shorts: copy src/videos/bridge/ to src/videos/<name>/ and register the copy here next to BridgeShort.
import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { SlipperyShort, SLIPPERY_FRAMES } from "./videos/slippery/Slippery";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="SlipperyShort" component={SlipperyShort} durationInFrames={SLIPPERY_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
