// "Why Didn't Adam Stop Her?" - master composition (1080 x 1920, 30 fps).
import React from 'react';
import { AbsoluteFill, Audio, Freeze, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { useFonts } from '../../kit-storybook/text/fonts';
import { Brand, Captions, PlaceTag, QuoteCard, QuoteWord, Seg, TopText } from '../../kit-storybook/text/Text';
import { EndCard } from '../../kit-storybook/text/EndCard';
import { BloomFlash, Grain, Vignette } from '../../kit-storybook/fx/Light';
import { clamp01 } from '../../kit-storybook/core/time';
import { F, TOTAL, tl, lineWords } from './data';
import * as S from './shots';

type ShotRow = [number, number, React.FC<S.ShotProps>];
export const SHOTS: ShotRow[] = [
  [0, 58, S.S1a],
  [58, 100, S.S1b],
  [100, F('eveCU'), S.S1c],
  [F('eveCU'), F('readSlowly'), S.S1d],
  [F('readSlowly'), 300, S.S2a],
  [300, F('handoff'), S.S2b],
  [F('handoff'), F('wholeTime'), S.S3a],
  [F('wholeTime'), F('snake') - 4, S.S3b],
  [F('snake') - 4, F('watchedReach'), S.S4a],
  [F('watchedReach'), F('saidNothing'), S.S4b],
  [F('saidNothing'), F('hideScene'), S.S4c],
  [F('hideScene'), 704, S.S5a],
  [704, F('godCalled'), S.S5b],
  [F('godCalled'), F('adamSaid'), S.S6],
  [F('adamSaid'), F('T2'), S.S7a],
  [F('T2'), F('eveHurt'), S.S7b],
  [F('eveHurt'), F('blamedHer') - 6, S.S7c],
  [F('blamedHer') - 6, F('eveSaid'), S.S7d],
  [F('eveSaid'), F('T3') + 10, S.S8a],
  [F('T3') + 10, F('web'), S.S8b],
  [F('web'), F('modern'), S.S9],
  [F('modern'), F('butNotice'), S.S10],
  [F('butNotice'), 1440, S.S11a],
  [1440, F('oneMan'), S.S11b],
  [F('oneMan'), F('gethsemane'), S.S12],
  [F('gethsemane'), 1682, S.S13a],
  [1682, F('torches'), S.S13b],
  [F('torches'), F('didntHide'), S.S14a],
  [F('didntHide'), F('steppedForward'), S.S14b],
  [F('steppedForward'), F('iAmHe'), S.S15a],
  [F('iAmHe'), F('letTheseGo'), S.S15b],
  [F('letTheseGo'), F('protected'), S.S16a],
  [F('protected'), F('adamHid'), S.S16b],
  [F('adamHid'), F('jesusStepped'), S.S17a],
  [F('jesusStepped'), F('melt'), S.S17b],
  [F('melt'), F('stopPassing'), S.S17c],
  [F('stopPassing'), F('cta'), S.S18],
  [F('cta'), F('endCard'), S.S19],
];

// map spoken words of a line onto display tokens of a quote
function quote(line: number, startWord: number, tokens: string[], gold: number[], breaks: number[]): QuoteWord[] {
  const ws = lineWords(line).slice(startWord);
  return tokens.map((t, i) => ({ t, at: ws[i].at, gold: gold.includes(i), br: breaks.includes(i) }));
}
const GEN_3_6 = quote(3, 0, ['“She', 'took', 'of', 'the', 'fruit', 'thereof,', 'and', 'did', 'eat,', 'and', 'gave', 'also', 'unto', 'her', 'husband', 'with', 'her;', 'and', 'he', 'did', 'eat.”'], [15, 16], [5, 11, 16]);
const ROM_5_12 = quote(14, 3, ['“By', 'one', 'man', 'sin', 'entered', 'into', 'the', 'world.”'], [1, 2], [3]);
const COR_5_21 = quote(19, 0, ['“He', 'hath', 'made', 'him', 'to', 'be', 'sin', 'for', 'us,', 'who', 'knew', 'no', 'sin.”'], [10, 11, 12], [3, 8]);

const HOOK: Seg[][] = [[{ t: 'Adam was standing right there.' }], [{ t: "So why didn't he " }, { t: 'stop', gold: true }, { t: ' her?' }]];

// soft light-bloom transitions: [frame, peak, in, out]
const BLOOMS: [number, number, number, number][] = [
  [F('readSlowly'), 0.5, 5, 10], [F('hideScene'), 0.35, 5, 12], [F('web'), 0.3, 4, 10], [F('modern'), 0.4, 3, 10],
  [F('butNotice'), 0.3, 4, 10], [F('adamHid'), 0.25, 4, 8], [F('jesusStepped'), 0.2, 3, 8], [F('melt'), 0.95, 6, 24],
  [F('bringIt') + 10, 0.25, 8, 16], [F('endCard'), 0.35, 4, 10],
];
const bloomAt = (f: number) => Math.max(0, ...BLOOMS.map(([at, pk, i, o]) => (f < at ? pk * clamp01(1 - (at - f) / i) : pk * clamp01(1 - (f - at) / o))));
const DIPS: [number, number, number][] = [[F('gethsemane'), 8, 10], [F('oneMan'), 4, 6]];
const dipAt = (f: number) => Math.max(0, ...DIPS.map(([at, i, o]) => (f < at ? clamp01(1 - (at - f) / i) : clamp01(1 - (f - at) / o))));

export const AdamSilent: React.FC<{ fx?: boolean }> = ({ fx = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const endCard = F('endCard');
  const loopLen = 14;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {SHOTS.map(([a, b, C], i) => (
        <Sequence key={i} from={a} durationInFrames={b - a} layout="none">
          <AbsoluteFill><C at={a} dur={b - a} /></AbsoluteFill>
        </Sequence>
      ))}

      {fx && <Vignette strength={0.5} />}
      {fx && <Grain opacity={0.06} />}

      {/* top text, tags and quote cards */}
      <TopText lines={HOOK} from={-10} to={152} y={286} stagger={4} />
      <PlaceTag title="ADAM · RIGHT THERE" from={F('handoff')} to={F('snake') - 8} y={300} />
      <QuoteCard words={GEN_3_6} from={F('quoteCard') - 8} to={F('handoff') - 2} reference="GENESIS 3:6" y={330} size={62} />
      <PlaceTag title="THE COOL OF THE DAY" sub="Genesis 3:8" from={F('hideScene') + 8} to={F('godCalled') - 6} y={300} />
      <TopText lines={[[{ t: 'Where art ' }, { t: 'thou', gold: true }, { t: '?' }]]} sub="GENESIS 3:9" from={F('whereArtThou') - 4} to={F('adamSaid') + 8} y={300} />
      <PlaceTag title="GENESIS 3:12" from={F('blamedHer') - 4} to={F('eveSaid') - 2} y={300} size={40} />
      <PlaceTag title="GENESIS 3:12–13" from={F('eveSaid') + 6} to={F('web') - 2} y={300} size={40} />
      <PlaceTag title="GOD CALLED ADAM" from={1446} to={F('oneMan') - 2} y={300} />
      <QuoteCard words={ROM_5_12} from={F('oneMan')} to={F('gethsemane') - 6} reference="ROMANS 5:12" y={360} />
      <PlaceTag title="GETHSEMANE" sub="a garden · John 18:1" from={F('gethsemane') + 6} to={F('torches') - 4} y={300} size={56} />
      <TopText lines={[[{ t: 'I am ' }, { t: 'he', gold: true }, { t: '.' }]]} sub="JOHN 18:5" from={F('iAmHe') - 2} to={F('letTheseGo') - 1} y={300} size={72} />
      <TopText lines={[[{ t: 'Let these go their ' }, { t: 'way', gold: true }, { t: '.' }]]} sub="JOHN 18:8" from={F('letThese') - 4} to={F('protected') + 24} y={300} />
      <QuoteCard words={COR_5_21} from={F('melt') + 4} to={F('stopPassing') - 4} reference="2 CORINTHIANS 5:21" y={300} />
      <TopText lines={[[{ t: 'Who do you ' }, { t: 'blame', gold: true }, { t: ' for your mistakes?' }], [{ t: 'Be honest. 👇' }]]} from={F('cta') + 2} to={endCard + 2} y={300} size={54} stagger={10} />

      <Captions phrases={tl.phrases} hidden={[[F('quoteCard') - 8, F('handoff')], [F('oneMan'), F('gethsemane')], [F('melt'), F('stopPassing')], [endCard, TOTAL]]} />

      <BloomFlash amount={bloomAt(frame)} />
      {dipAt(frame) > 0 && <AbsoluteFill style={{ background: '#000', opacity: dipAt(frame) }} />}
      {frame < endCard && <Brand />}

      <EndCard from={endCard} len={TOTAL - endCard} />
      {/* loop: the final frames flow back into Eve's reaching hand */}
      {frame >= TOTAL - loopLen && (
        <AbsoluteFill style={{ opacity: clamp01((frame - (TOTAL - loopLen)) / loopLen) }}>
          <Freeze frame={0}>
            <Sequence from={0} durationInFrames={58} layout="none"><AbsoluteFill><S.S1a at={0} dur={58} /></AbsoluteFill></Sequence>
            {fx && <Vignette strength={0.5} />}
            <TopText lines={HOOK} from={-10} to={152} y={286} stagger={4} />
          </Freeze>
        </AbsoluteFill>
      )}
      <Audio src={staticFile('audio/final_mix.wav')} />
    </AbsoluteFill>
  );
};
