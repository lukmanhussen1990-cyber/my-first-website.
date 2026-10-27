// The HTML layer over the 3D canvas. Pure function of the frame (t = frame / 30).
// Layers, bottom -> top: S5 memory glow, verse cards, S11 full-screen card, world labels, S8 BARABBAS slam, the name
// card, S15 CTA, S16 end card (its flare wipe covers the fading CTA), captions, hook title, header + watermark.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, delayRender, continueRender } from 'remotion';
import { plan } from '../lib/planInstance.js';
import { shotAt } from '../plan.js';
import { fontsReady } from '../lib/fonts.js';
import { Header, Brand, HookTitle, Captions } from './captions.jsx';
import { Labels } from './labels.jsx';
import { VerseCards } from './cards.jsx';
import { FullCard, fullCardCover } from './fullcard.jsx';
import { NameCard, BarabbasSlam, MemoryGlow } from './namecard.jsx';
import { Cta } from './cta.jsx';
import { EndCard } from './endcard.jsx';

export const Overlay = ({ frame, debug }) => {
  const [handle] = useState(() => delayRender('overlay fonts', { timeoutInMilliseconds: 1800000 }));
  const [ready, setReady] = useState(false);
  useEffect(() => { fontsReady().then(() => setReady(true)); }, []);
  useEffect(() => { if (ready) continueRender(handle); }, [ready, handle]);
  const t = frame / 30;
  const { shot } = shotAt(plan, t);
  if (!ready) return <AbsoluteFill style={{ pointerEvents: 'none' }} />;
  const ink = fullCardCover(t);
  return (
    <AbsoluteFill className="gim-ov" style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {/* lining figures everywhere (the inline \`font\` shorthand would reset font-variant-numeric) */}
      <style>{'.gim-ov, .gim-ov * { font-variant-numeric: lining-nums !important; font-feature-settings: "lnum" 1 !important; }'}</style>
      <MemoryGlow t={t} />
      <VerseCards t={t} frame={frame} />
      <FullCard t={t} frame={frame} />
      <Labels t={t} />
      <BarabbasSlam t={t} frame={frame} />
      <NameCard t={t} frame={frame} />
      <Cta t={t} frame={frame} />
      <EndCard t={t} frame={frame} />
      <Captions t={t} />
      <HookTitle t={t} frame={frame} />
      <Header t={t} ink={ink} />
      <Brand t={t} ink={ink} />
      {debug ? <div style={{ position: 'absolute', left: 24, bottom: 24, color: '#fff', font: '600 30px monospace', textShadow: '0 2px 4px #000' }}>{`f${frame} ${t.toFixed(2)}s ${shot.id}`}</div> : null}
    </AbsoluteFill>
  );
};
