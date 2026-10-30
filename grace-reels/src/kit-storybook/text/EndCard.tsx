// End card: the Grace in Motion logo draws itself over soft dark + gold dust.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Dust } from '../fx/Particles';
import { clamp01, easeInOut, easeOut } from '../core/time';
import { GOLD, SANS, SERIF } from './fonts';

export const Logo: React.FC<{ draw: number; size?: number }> = ({ draw, size = 220 }) => {
  const d = (a: number, b: number) => easeInOut(clamp01((draw - a) / (b - a)));
  const stroke = (len: number, k: number) => ({ strokeDasharray: len, strokeDashoffset: len * (1 - k) });
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 200 250" style={{ overflow: 'visible', filter: 'drop-shadow(0 0 14px rgba(226,178,90,0.55))' }}>
      {/* slim cross */}
      <line x1="120" y1="20" x2="120" y2="235" stroke={GOLD} strokeWidth="6" strokeLinecap="round" style={stroke(215, d(0, 0.45))} />
      <line x1="78" y1="80" x2="162" y2="80" stroke={GOLD} strokeWidth="6" strokeLinecap="round" style={stroke(84, d(0.3, 0.6))} />
      {/* three motion lines on the left */}
      {[0, 1, 2].map((i) => (
        <line key={i} x1={66 - i * 6} y1={120 + i * 26} x2={18 + i * 4} y2={120 + i * 26} stroke={GOLD} strokeOpacity={0.9 - i * 0.2} strokeWidth="5" strokeLinecap="round" style={stroke(48, d(0.5 + i * 0.1, 0.8 + i * 0.1))} />
      ))}
    </svg>
  );
};

export const EndCard: React.FC<{ from: number; len: number; handle?: string; tagline?: string; outTo?: number }> = ({ from, len, handle = '@GraceINMotion616', tagline = 'Hard questions. Bible answers.' }) => {
  const frame = useCurrentFrame();
  const t = frame - from;
  if (t < 0 || t > len) return null;
  const fadeIn = easeOut(clamp01(t / 10));
  const draw = clamp01(t / 34);
  const txt = (at: number) => easeOut(clamp01((t - at) / 12));
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 45%, #241b2e 0%, #120d18 55%, #07060a 100%)' }} />
      <Dust seed={77} count={60} color="255,214,140" rise={10} opacity={0.9} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', paddingBottom: 120 }}>
        <Logo draw={draw} size={210} />
        <div style={{ marginTop: 36, fontFamily: SERIF, fontWeight: 600, fontSize: 70, letterSpacing: '0.18em', color: '#F3ECDF', opacity: txt(16), textShadow: '0 0 24px rgba(226,178,90,0.35)' }}>GRACE IN MOTION</div>
        <div style={{ marginTop: 14, fontFamily: SANS, fontWeight: 500, fontSize: 30, color: 'rgba(243,236,223,0.75)', opacity: txt(24) }}>{handle}</div>
        <div style={{ marginTop: 30, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 42, color: GOLD, opacity: txt(32) }}>{tagline}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
