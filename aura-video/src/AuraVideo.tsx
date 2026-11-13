import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender, interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import '@fontsource/lora/400.css';
import '@fontsource/lora/400-italic.css';
import '@fontsource/lora/700.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/poppins/800.css';
import {Stage} from './three/Stage';
import {stateAt} from './shots';
import {Overlay, TopFlash, isInverted} from './overlay/Overlay';
import {DURATION, FPS, MUSIC_START_SEC, SFX} from './timeline';
import {Q} from './quality';

const FONTS = ['400 64px Lora', 'italic 400 64px Lora', '700 64px Lora', '600 32px Inter', '700 32px Inter', '800 32px Inter', '800 64px Poppins'];

const useFonts = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading fonts'));
  useEffect(() => {
    Promise.all(FONTS.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        setReady(true);
        continueRender(handle);
      });
  }, [handle]);
  return ready;
};

export const AuraVideo: React.FC<{noPost?: boolean; fx?: string; preview?: boolean}> = ({noPost, fx, preview}) => {
  Q.preview = !!preview;
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const ready = useFonts();
  const s = stateAt(f);
  const inv = isInverted(f);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{filter: inv ? 'invert(1) hue-rotate(180deg) contrast(1.15)' : undefined}}>
        {ready && (
          <ThreeCanvas
            width={width}
            height={height}
            shadows
            dpr={preview ? 0.2 : 1}
            gl={{antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true}}
            camera={{fov: 40, near: 0.05, far: 900, position: [0, 2, 10]}}
          >
            <Stage s={s} noPost={noPost} fx={fx} />
          </ThreeCanvas>
        )}
        {ready && <Overlay f={f} />}
      </AbsoluteFill>
      <TopFlash f={f} />
      <Audio
        src={staticFile('music.mp3')}
        trimBefore={Math.round(MUSIC_START_SEC * FPS)}
        volume={(fr) => interpolate(fr, [0, 4, DURATION - 40, DURATION], [0.0, 0.9, 0.9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
      {SFX.map((x, i) => (
        <Sequence key={i} from={x.at} durationInFrames={90} layout="none">
          <Audio src={staticFile(x.src)} volume={x.vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
