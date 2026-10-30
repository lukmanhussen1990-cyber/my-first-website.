import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Audio, continueRender, delayRender, staticFile} from 'remotion';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/lilita-one/400.css';
import {DirBlur} from './components/Fx';
import {BigText, Captions, Counter, Flash, Note, Tracker} from './components/Overlays';
import {SpeedLines} from './components/Sky';
import {SC, T, W, H, easeIn, easeOut, prog, useT, within} from './lib/anim';
import {Hook} from './scenes/Hook';
import {Intro, You} from './scenes/Street';
import {Ronaldo} from './scenes/Ronaldo';
import {MrBeast} from './scenes/MrBeast';
import {Elon} from './scenes/Elon';
import {Kicker} from './scenes/Kicker';
import {Cta} from './scenes/Cta';

const useFonts = () => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('900 80px Nunito'),
      document.fonts.load('800 40px Nunito'),
      document.fonts.load('80px "Lilita One"'),
    ]).then(() => continueRender(handle));
  }, [handle]);
};

type Whip = {at: number; dx: number; dy: number};
/** Push transitions between scenes: the direction the content travels. */
const WHIPS: Record<string, Whip> = {
  intro: {at: SC.intro[0], dx: 0, dy: -1},
  you: {at: SC.you[0], dx: -1, dy: 0},
  ronaldo: {at: SC.ronaldo[0], dx: 1, dy: 0},
  mrbeast: {at: SC.mrbeast[0], dx: -1, dy: 0},
  elon: {at: SC.elon[0], dx: 1, dy: 0},
  kicker: {at: SC.kicker[0], dx: -1, dy: 0},
  cta: {at: SC.cta[0], dx: 1, dy: 0},
};
const PRE = 0.16, POST = 0.2;
const whipE = (t: number, w: Whip) => {
  const x = prog(t, w.at - PRE, w.at + POST);
  return x < 0.5 ? easeIn(x * 2) / 2 : 0.5 + easeOut(x * 2 - 1) / 2;
};

/** Mounts a scene for its time range and slides it in or out during the push transitions. */
const SceneSlot: React.FC<{name: string; next?: string; t: number; children: React.ReactNode}> = ({name, next, t, children}) => {
  const [a, b] = SC[name];
  const win = WHIPS[name];
  const wout = next ? WHIPS[next] : undefined;
  if (!within(t, win ? a - PRE : a, wout ? b + POST : b)) return null;
  let x = 0, y = 0, k = 0;
  if (win && t < a + POST) {
    const e = whipE(t, win);
    x = win.dx * W * (e - 1);
    y = win.dy * H * (e - 1);
    k = Math.sin(Math.PI * e);
  } else if (wout && t > b - PRE) {
    const e = whipE(t, wout);
    x = wout.dx * W * e;
    y = wout.dy * H * e;
    k = Math.sin(Math.PI * e);
  }
  const d = win && t < a + POST ? win : wout;
  return (
    <DirBlur id={`whip-${name}`} x={d ? Math.abs(d.dx) * 70 * k : 0} y={d ? Math.abs(d.dy) * 90 * k : 0} style={{transform: `translate(${x}px, ${y}px)`}}>
      {children}
    </DirBlur>
  );
};

export const BIG: {t0: number; t1: number; text: string; y: number; size: number; sub?: string}[] = [
  {t0: T.youCash, t1: 12.45, text: '$10,000', y: 470, size: 165},
  {t0: T.youBig, t1: 15.05, text: '1.5 KM', y: 600, size: 170},
  {t0: T.ronCash, t1: 19.05, text: '$1.2 BILLION', y: 470, size: 122},
  {t0: T.ronBig, t1: 24.48, text: '187,200 KM', y: 1090, size: 130},
  {t0: T.mbCash, t1: 26.95, text: '$2.6 BILLION', y: 470, size: 122},
  {t0: T.elonCash, t1: 34.4, text: '$1 TRILLION', y: 420, size: 132},
  {t0: T.elonBig, t1: 44.6, text: '156,000,000 KM', y: 1420, size: 108},
  {t0: T.kickBig, t1: 49.95, text: '178 YEARS', y: 735, size: 140},
];

export const MoneyRoad: React.FC = () => {
  useFonts();
  const t = useT();
  const whipLines = Object.values(WHIPS).reduce((m, w) => Math.max(m, Math.sin(Math.PI * whipE(t, w))), 0);
  const ctaQuiet = within(t, 50.1, 52.4);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Audio src={staticFile('audio/mix.wav')} />
      <SceneSlot name="hook" next="intro" t={t}><Hook t={t} /></SceneSlot>
      <SceneSlot name="intro" next="you" t={t}><Intro t={t} /></SceneSlot>
      <SceneSlot name="you" next="ronaldo" t={t}><You t={t} /></SceneSlot>
      <SceneSlot name="ronaldo" next="mrbeast" t={t}><Ronaldo t={t} /></SceneSlot>
      <SceneSlot name="mrbeast" next="elon" t={t}><MrBeast t={t} /></SceneSlot>
      <SceneSlot name="elon" next="kicker" t={t}><Elon t={t} /></SceneSlot>
      <SceneSlot name="kicker" next="cta" t={t}><Kicker t={t} /></SceneSlot>
      <SceneSlot name="cta" t={t}><Cta t={t} /></SceneSlot>
      <SpeedLines t={t} intensity={whipLines * 1.3} angle={0} seed={77} />
      <Tracker t={t} />
      <Counter t={t} />
      {BIG.map((b) => (
        <BigText key={b.text} t={t} {...b} />
      ))}
      {!ctaQuiet ? <Captions t={t} y={within(t, SC.kicker[0], SC.kicker[1]) ? 1460 : 1215} /> : null}
      <Flash t={t} at={T.elonSun} dur={0.6} color="#fffbe0" />
      <Flash t={t} at={SC.intro[0]} dur={0.18} peak={0.5} />
      <Note t={t} />
    </AbsoluteFill>
  );
};
