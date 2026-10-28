import React from 'react';
import {GOLD, SANS, TEXT} from '../lib/theme';
import {E, SC} from '../lib/timeline';
import {clamp, easeOut, easeInOut, pop, smooth} from '../lib/anim';

const XS = [150, 337, 524, 711, 898];
const NAMES = ['RUTH', 'OBED', 'JESSE', 'DAVID', '?'];

export const Tracker: React.FC<{t: number}> = ({t}) => {
  const tin = E.trackerIn;
  if (t < tin) return null;
  const fills = [E.dots.ruth, E.dots.obed, E.dots.jesse, E.dots.david, E.dots.jesus];
  const lineDraw = easeOut(clamp((t - tin) / 0.55));
  const out = 1 - smooth(clamp((t - SC.S16.start) / 0.35));
  // CTA mode: tracker moves to the centre and glows
  const cta = easeInOut(clamp((t - SC.S15.start) / 0.7));
  const y = 650 + cta * 250;
  const sc = 1 + cta * 0.12;
  const filledUpTo = fills.reduce((n, ft, i) => (t >= ft ? i : n), -1);
  const lastFillT = filledUpTo >= 0 ? fills[filledUpTo] : 0;
  const progX = filledUpTo < 0 ? XS[0] : XS[Math.max(0, filledUpTo - 1)] + (XS[filledUpTo] - XS[Math.max(0, filledUpTo - 1)]) * easeOut(clamp((t - lastFillT + 0.25) / 0.3));
  const burstK = clamp((t - E.jesusBurst) / 0.9);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: out, pointerEvents: 'none'}}>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <radialGradient id="trkGlow">
            <stop offset="0" stopColor={GOLD} stopOpacity={0.9} />
            <stop offset="1" stopColor={GOLD} stopOpacity={0} />
          </radialGradient>
        </defs>
        <g transform={`translate(524 ${y}) scale(${sc}) translate(-524 0)`}>
          <rect x={92} y={-34} width={864} height={92} rx={46} fill="rgba(20,12,6,0.55)" opacity={1 - cta} style={{filter: 'blur(5px)'}} />
          {/* glow bed in CTA mode */}
          {cta > 0 && <ellipse cx={524} cy={0} rx={520} ry={90} fill="url(#trkGlow)" opacity={0.18 * cta} />}
          <line x1={XS[0]} y1={0} x2={XS[0] + (XS[4] - XS[0]) * lineDraw} y2={0} stroke={GOLD} strokeOpacity={0.4} strokeWidth={2} />
          {filledUpTo >= 0 && <line x1={XS[0]} y1={0} x2={progX} y2={0} stroke={GOLD} strokeWidth={3.5} style={{filter: 'drop-shadow(0 0 6px rgba(242,181,68,0.8))'}} />}
          {XS.map((x, i) => {
            const appear = pop(t, tin + 0.15 + i * 0.09, 0.3, 0.2);
            if (appear <= 0) return null;
            const filled = t >= fills[i];
            const fp = filled ? pop(t, fills[i], 0.4, 0.35) : 1;
            const isQ = i === 4;
            const pulse = isQ && !filled ? 0.5 + 0.5 * Math.sin(t * 4.2) : 0;
            const ruthGlow = i === 0 && !filled && t >= E.dots.ruthGlow ? smooth(clamp((t - E.dots.ruthGlow) / 0.5)) : 0;
            const r = 13 * appear * (filled ? fp : 1);
            return (
              <g key={i}>
                {(pulse > 0 || ruthGlow > 0) && <circle cx={x} cy={0} r={26 + pulse * 8} fill="url(#trkGlow)" opacity={0.35 * pulse + 0.45 * ruthGlow} />}
                {filled && <circle cx={x} cy={0} r={30 * fp} fill="url(#trkGlow)" opacity={0.45 + cta * 0.3} />}
                <circle cx={x} cy={0} r={r} fill={filled ? GOLD : `rgba(20,12,6,${0.45 + ruthGlow * 0.2})`} stroke={GOLD} strokeWidth={2.5} />
                {ruthGlow > 0 && !filled && <circle cx={x} cy={0} r={r * 0.55} fill={GOLD} opacity={0.55 * ruthGlow} />}
                {isQ && !filled && (
                  <text x={x} y={7} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={18} fill={GOLD} opacity={appear}>?</text>
                )}
              </g>
            );
          })}
          {/* the "?" bursts open into JESUS */}
          {burstK > 0 && burstK < 1 && (
            <g opacity={1 - burstK}>
              <circle cx={XS[4]} cy={0} r={18 + burstK * 90} fill="none" stroke={GOLD} strokeWidth={4 * (1 - burstK) + 1} />
              {Array.from({length: 12}).map((_, k) => {
                const a = (k / 12) * Math.PI * 2;
                const r0 = 20 + burstK * 30, r1 = 34 + burstK * 110;
                return <line key={k} x1={XS[4] + Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={XS[4] + Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={GOLD} strokeWidth={3} strokeLinecap="round" />;
              })}
            </g>
          )}
        </g>
      </svg>
      {/* labels */}
      {XS.map((x, i) => {
        const appear = clamp((t - (tin + 0.25 + i * 0.09)) / 0.25);
        if (appear <= 0) return null;
        const filled = t >= fills[i];
        const name = i === 4 && filled ? 'JESUS' : NAMES[i];
        const lp = i === 4 && filled ? pop(t, fills[i], 0.45, 0.4) : 1;
        const lx = 524 + (x - 524) * sc;
        return (
          <div key={i} style={{
            position: 'absolute', left: lx - 80, width: 160, top: y + 26 * sc, textAlign: 'center', opacity: appear,
            fontFamily: SANS, fontWeight: 600, fontSize: (i === 4 && filled ? 22 : 20) * sc, letterSpacing: '0.14em',
            color: filled ? '#FFC95A' : TEXT, textShadow: filled ? '0 0 2px rgba(30,14,2,0.95), 0 0 12px rgba(242,181,68,0.55), 0 1px 4px rgba(0,0,0,0.7)' : '0 1px 5px rgba(0,0,0,0.8)',
            transform: `scale(${lp})`,
          }}>{name}</div>
        );
      })}
    </div>
  );
};
