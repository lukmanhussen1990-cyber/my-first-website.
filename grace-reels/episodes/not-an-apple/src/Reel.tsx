import {AbsoluteFill, Audio, getInputProps, staticFile, useCurrentFrame} from 'remotion';
import {Header} from './overlays/Header';
import {Captions} from './overlays/Captions';
import {WordCheck} from './overlays/WordCheck';
import {ScriptureCard} from './overlays/ScriptureCard';
import {S1, S2, S3, S4, S8, S9b} from './scenes/Early';
import {S5, S6, S7, S9a, S10} from './scenes/Eden';
import {S11S12, S13, S14, S15, S16} from './scenes/Late';
import {FPS, cues, scene} from './lib/time';
import {lerp, out, prog} from './lib/anim';

type Shot = {a: number; b: number; fade?: number; C: React.FC<{t: number; a: number; b: number}>};
const sc = (id: string) => scene(id);
const SHOTS: Shot[] = [
  {a: 0, b: sc('S2').start + 0.2, C: ({t, b}) => <S1 t={t} b={b} />},
  {a: sc('S2').start, b: sc('S3').start + 0.2, fade: 0.2, C: S2},
  {a: sc('S3').start, b: sc('S4').start + 0.25, fade: 0.2, C: S3},
  {a: sc('S4').start, b: sc('S5').start + 0.2, fade: 0.25, C: ({t, a}) => <S4 t={t} a={a} />},
  {a: sc('S5').start, b: sc('S6').start + 0.1, fade: 0.2, C: ({t, a}) => <S5 t={t} a={a} />},
  {a: sc('S6').start, b: sc('S7').start + 0.15, fade: 0.1, C: S6},
  {a: sc('S7').start, b: sc('S8').start + 0.25, fade: 0.15, C: S7},
  {a: sc('S8').start, b: sc('S9').start + 0.2, fade: 0.25, C: S8},
  {a: sc('S9').start, b: cues.stripEat + 0.2, fade: 0.2, C: S9a},
  {a: cues.stripEat, b: sc('S10').start + 0.2, fade: 0.2, C: S9b},
  {a: sc('S10').start, b: sc('S11').start + 1.3, fade: 0.2, C: S10},
  {a: sc('S11').start + 0.6, b: sc('S13').start + 0.2, fade: 0.7, C: S11S12},
  {a: sc('S13').start, b: sc('S14').start, fade: 0.25, C: S13},
  {a: sc('S14').start, b: sc('S15').start + 0.25, C: S14},
  {a: sc('S15').start, b: sc('S16').start + 0.2, fade: 0.25, C: ({t, a}) => <S15 t={t} a={a} />},
  {a: sc('S16').start, b: sc('S16').end, fade: 0.2, C: S16},
];

export const Reel: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const end = sc('S16').start;
  const s15 = out(prog(t, sc('S15').start, sc('S15').start + 0.6));
  const hideEnd = 1 - prog(t, end - 0.1, end + 0.25);
  const noAudio = Boolean((getInputProps() as {noAudio?: boolean}).noAudio);
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      {!noAudio && <Audio src={staticFile('final_mix.wav')} />}
      {SHOTS.map((s, i) => (t >= s.a && t < s.b ? (
        <AbsoluteFill key={i} style={{opacity: s.fade ? prog(t, s.a, s.a + s.fade) : 1}}>
          <s.C t={t} a={s.a} b={s.b} />
        </AbsoluteFill>
      ) : null))}
      {t >= sc('S14').start && t < sc('S14').start + 0.35 && <AbsoluteFill style={{background: '#fff', opacity: 1 - prog(t, sc('S14').start, sc('S14').start + 0.35)}} />}
      <ScriptureCard t={t} t0={sc('S13').start + 0.2} t1={sc('S14').start + 1.1} size={50}
        quote="“But I fear, lest by any means, as the serpent *beguiled* Eve through his subtilty, so your minds should be corrupted from the simplicity that is in Christ.”" refText="2 CORINTHIANS 11:3 · KJV" />
      <Header opacity={prog(t, 0.2, 0.8) * hideEnd} />
      <Captions t={t} opacity={hideEnd} />
      <WordCheck t={t} y={lerp(650, 700, s15)} scale={lerp(1, 1.12, s15)} glow={s15} opacity={hideEnd} />
    </AbsoluteFill>
  );
};
