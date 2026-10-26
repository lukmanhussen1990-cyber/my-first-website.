// The HTML layer over the 3D canvas: every element is a pure function of the frame.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, delayRender, continueRender } from 'remotion';
import { plan } from '../lib/planInstance.js';
import { shotAt } from '../plan.js';
import { fontsReady } from '../lib/fonts.js';
import { Header, HookTitle, Captions } from './captions.jsx';
import { Tracker } from './tracker.jsx';
import { Labels } from './labels.jsx';
import { RomansCard, PhoneScene, CheckBackdrop, CtaScene, EndCard } from './cards.jsx';

export const Overlay = ({ frame, debug }) => {
  const [handle] = useState(() => delayRender('overlay fonts'));
  useEffect(() => { fontsReady().then(() => continueRender(handle)); }, [handle]);
  const t = frame / 30;
  const { shot } = shotAt(plan, t);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <PhoneScene t={t} frame={frame} />
      <CheckBackdrop t={t} frame={frame} />
      <CtaScene t={t} frame={frame} />
      <Labels t={t} />
      <RomansCard t={t} />
      <Tracker t={t} frame={frame} />
      <EndCard t={t} frame={frame} />
      <Captions t={t} />
      <HookTitle t={t} frame={frame} />
      <Header t={t} />
      {debug ? <div style={{ position: 'absolute', left: 24, bottom: 24, color: '#fff', font: '600 30px monospace', textShadow: '0 2px 4px #000' }}>{`f${frame} ${t.toFixed(2)}s ${shot.id}`}</div> : null}
    </AbsoluteFill>
  );
};
