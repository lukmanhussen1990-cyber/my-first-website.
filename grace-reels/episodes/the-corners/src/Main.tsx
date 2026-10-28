import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {FPS, SC, E} from './lib/timeline';
import {clamp, smooth} from './lib/anim';
import {useFonts} from './ui/Fonts';
import {Header} from './ui/Header';
import {Title} from './ui/Title';
import {Captions} from './ui/Captions';
import {Tracker} from './ui/Tracker';
import {CARDS, ScriptureCard} from './ui/ScriptureCard';
import {CommentBox} from './ui/CommentBox';
import {EndCard} from './ui/EndCard';
import {Grade} from './scenes/kit';
import {S1Opening, S2Rule, S3Leave, S7Corner, S9Boaz} from './scenes/FieldScenes';
import {S4Hand, S14City} from './scenes/HandScenes';
import {S5Road, S6House, S8Map, S10Family} from './scenes/StoryScenes';
import {S11Vine, S12Manger, S13ForMe, S15Cta} from './scenes/LineScenes';

type SceneDef = {id: string; C: React.FC<{t: number; preview?: boolean}>; dissolveIn?: number; tint?: string; tintO?: number};
const SCENES: SceneDef[] = [
  {id: 'S1', C: S1Opening},
  {id: 'S2', C: S2Rule, tint: '#FFB860', tintO: 0.15},
  {id: 'S3', C: S3Leave, tint: '#FFB860', tintO: 0.15},
  {id: 'S4', C: S4Hand},
  {id: 'S5', C: S5Road, dissolveIn: 0.35, tint: '#7F93A8', tintO: 0.3},
  {id: 'S6', C: S6House, tint: '#FFB860', tintO: 0.12},
  {id: 'S7', C: S7Corner, tint: '#FF9E50', tintO: 0.18},
  {id: 'S8', C: S8Map},
  {id: 'S9', C: S9Boaz, tint: '#FFB860', tintO: 0.12},
  {id: 'S10', C: S10Family, tint: '#FFC070', tintO: 0.12},
  {id: 'S11', C: S11Vine, dissolveIn: 0.4},
  {id: 'S12', C: S12Manger, dissolveIn: 0.4},
  {id: 'S13', C: S13ForMe, tint: '#FFB860', tintO: 0.12},
  {id: 'S14', C: S14City},
  {id: 'S15', C: S15Cta, dissolveIn: 0.45},
];

export const TheCorners: React.FC<{preview?: boolean}> = ({preview = false}) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{background: '#120A05'}}>
      {SCENES.map((s, i) => {
        const sc = SC[s.id];
        const next = SCENES[i + 1];
        const tail = next?.dissolveIn ?? 0;
        const from = Math.max(0, Math.floor(sc.start * FPS));
        const to = Math.ceil((sc.end + tail) * FPS);
        const op = s.dissolveIn ? smooth(clamp((t - sc.start) / s.dissolveIn)) : 1;
        const Comp = s.C;
        return (
          <Sequence key={s.id} from={from} durationInFrames={to - from} layout="none" name={s.id}>
            <AbsoluteFill style={{opacity: op}}>
              <Comp t={t} preview={preview} />
              <Grade tint={s.tint} tintOpacity={s.tintO ?? 0} vignette={0.42} grain={0.08} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {/* the loop: the end card flows back into the opening field */}
      <Sequence from={Math.floor((E.loopFlow.start - 0.1) * FPS)} layout="none" name="loop">
        <S1Opening t={0} preview={preview} shot="LOOP" />
        <Grade vignette={0.42} grain={0.08} />
      </Sequence>

      {/* graphics layer (HTML/SVG on top; never inside the 3D) */}
      <Header opacity={Math.min(1, 1 - smooth(clamp((t - SC.S16.start) / 0.3)) + smooth(clamp((t - E.loopFlow.start) / (E.loopFlow.end - E.loopFlow.start))))} />
      <Title t={t} />
      <Captions t={t} />
      <Tracker t={t} />
      {CARDS.map((c) => <ScriptureCard key={c.key} card={c} t={t} />)}
      <CommentBox t={t} />
      <EndCard t={t} />
      <Audio src={staticFile('final_mix.wav')} />
    </AbsoluteFill>
  );
};
