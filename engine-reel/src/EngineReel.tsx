import React from 'react';
import * as THREE from 'three';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { VOICEOVER } from './timeline';
import { Scene3D } from './components/Scene3D';
import { Captions, Flashes, LabelPills, RpmCounter, Stickers, StrokeBadge, Vignette, whipBlur } from './components/Overlays';

export const EngineReel: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const blur = whipBlur(frame / fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#050207' }}>
      <Audio src={staticFile(VOICEOVER.file)} volume={VOICEOVER.volume} />

      <AbsoluteFill style={{ filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
        <ThreeCanvas
          width={width}
          height={height}
          shadows="soft"
          dpr={typeof window !== "undefined" ? Math.min(1, window.devicePixelRatio || 1) : 1}
          gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
          camera={{ fov: 34, near: 0.05, far: 600, position: [0, 2, 10] }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.0;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <Scene3D />
        </ThreeCanvas>
      </AbsoluteFill>

      <Vignette />
      <LabelPills />
      <RpmCounter />
      <StrokeBadge />
      <Stickers />
      <Captions />
      <Flashes />
    </AbsoluteFill>
  );
};
