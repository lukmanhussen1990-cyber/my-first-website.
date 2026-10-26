// The HTML layer over the 3D canvas. Pure function of the frame (t = frame / 30).
// Layers, bottom -> top: verse cards, S4 parchment timeline (slides over the outgoing card), S2 life-ribbon, world labels,
// S10 note, S14 CTA, S15 end card (its flare wipe covers the fading CTA), math tracker, captions, hook title, header.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, delayRender, continueRender } from 'remotion';
import { plan } from '../lib/planInstance.js';
import { shotAt } from '../plan.js';
import { fontsReady } from '../lib/fonts.js';
import { Header, Brand, HookTitle, Captions } from './captions.jsx';
import { Tracker } from './tracker.jsx';
import { Labels, SomeSay, LifeRibbon } from './labels.jsx';
import { VerseCards } from './cards.jsx';
import { Timeline, timelineCover } from './timeline.jsx';
import { Cta } from './cta.jsx';
import { EndCard } from './endcard.jsx';

export const Overlay = ({ frame, debug }) => {
  const [handle] = useState(() => delayRender('overlay fonts', { timeoutInMilliseconds: 240000 }));
  const [ready, setReady] = useState(false);
  useEffect(() => { fontsReady().then(() => setReady(true)); }, []);
  useEffect(() => { if (ready) continueRender(handle); }, [ready, handle]);
  const t = frame / 30;
  const { shot } = shotAt(plan, t);
  if (!ready) return <AbsoluteFill style={{ pointerEvents: 'none' }} />;
  return (
    <AbsoluteFill className="gim-ov" style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {/* lining figures everywhere (the inline \`font\` shorthand would reset font-variant-numeric) */}
      <style>{'.gim-ov, .gim-ov * { font-variant-numeric: lining-nums !important; font-feature-settings: "lnum" 1 !important; }'}</style>
      <VerseCards t={t} frame={frame} />
      <Timeline t={t} frame={frame} />
      <LifeRibbon t={t} frame={frame} />
      <Labels t={t} />
      <SomeSay t={t} />
      <Cta t={t} frame={frame} />
      <EndCard t={t} frame={frame} />
      <Tracker t={t} frame={frame} />
      <Captions t={t} />
      <HookTitle t={t} frame={frame} />
      <Header t={t} ink={timelineCover(t)} />
      <Brand t={t} ink={timelineCover(t)} />
      {debug ? <div style={{ position: 'absolute', left: 24, bottom: 24, color: '#fff', font: '600 30px monospace', textShadow: '0 2px 4px #000' }}>{`f${frame} ${t.toFixed(2)}s ${shot.id}`}</div> : null}
    </AbsoluteFill>
  );
};
