// The HTML layer over the 3D canvas (STUB — the overlay track rebuilds it). Pure function of the frame.
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, delayRender, continueRender } from 'remotion';
import { plan } from '../lib/planInstance.js';
import { shotAt } from '../plan.js';
import { fontsReady } from '../lib/fonts.js';

export const Overlay = ({ frame, debug }) => {
  const [handle] = useState(() => delayRender('overlay fonts', { timeoutInMilliseconds: 240000 }));
  useEffect(() => { fontsReady().then(() => continueRender(handle)); }, [handle]);
  const t = frame / 30;
  const { shot } = shotAt(plan, t);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {debug ? <div style={{ position: 'absolute', left: 24, bottom: 24, color: '#fff', font: '600 30px monospace', textShadow: '0 2px 4px #000' }}>{`f${frame} ${t.toFixed(2)}s ${shot.id}`}</div> : null}
    </AbsoluteFill>
  );
};
