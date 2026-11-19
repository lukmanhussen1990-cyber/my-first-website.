/**
 * 2D overlays on top of the 3D canvas: captions, label pills, stroke badge,
 * comic stickers, RPM counter, vignette and light flashes.
 */
import React from 'react';
import { AbsoluteFill, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/fonts';
import {
  CAPTIONS,
  CAPTION_STYLE,
  EVENTS,
  HOOK,
  LABEL_PILLS,
  LABEL_PILLS_OUT,
  RPM_COUNTER,
  STICKERS,
  STROKE_BADGES,
} from '../timeline';
import { bump, clamp, smoothstep } from '../lib/math';

export const FONT = 'Montserrat';
loadFont({ family: FONT, url: staticFile('fonts/montserrat-latin-900-normal.woff2'), weight: '900' });
loadFont({ family: FONT, url: staticFile('fonts/montserrat-latin-800-normal.woff2'), weight: '800' });

const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { frame, fps, t: frame / fps };
};

/** Text with a crisp thick outline: a stroked copy underneath, a clean fill on top. */
const OutlinedText: React.FC<{
  children: React.ReactNode;
  size: number;
  stroke: number;
  ink?: string;
  shadow?: string;
  style?: React.CSSProperties;
}> = ({ children, size, stroke, ink = '#000', shadow = '0 8px 0 rgba(0,0,0,0.35)', style }) => {
  const base: React.CSSProperties = {
    fontFamily: FONT,
    fontWeight: 900,
    fontSize: size,
    lineHeight: 1.04,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    whiteSpace: 'pre-wrap',
    textAlign: 'center',
    ...style,
  };
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div aria-hidden style={{ ...base, position: 'absolute', inset: 0, WebkitTextStroke: `${stroke * 2}px ${ink}`, color: ink, textShadow: shadow }}>
        {children}
      </div>
      <div style={{ ...base, position: 'relative' }}>{children}</div>
    </div>
  );
};

// ── Captions ────────────────────────────────────────────────────────────
export const Captions: React.FC = () => {
  const { t, frame, fps } = useT();
  const S = CAPTION_STYLE;
  const cap = CAPTIONS.find((c) => t >= c.start - S.leadSec && t < c.end);
  if (!cap) return null;
  const startFrame = Math.round((cap.start - S.leadSec) * fps);
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 13, stiffness: 260, mass: 0.55 } });
  const scale = S.popFrom + (1 - S.popFrom) * s;
  const opacity = clamp((frame - startFrame + 1) / 2);
  // viral-caption look: no trailing dashes / full stops
  const words = cap.text.replace(/[—.]+/g, '').trim().split(' ');
  const isKey = (w: string) => S.keywords.includes(w.toLowerCase().replace(/[^a-z']/g, ''));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: `${S.topPercent}%`,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: `translateY(-50%) scale(${scale})`,
          opacity,
          padding: '0 70px',
        }}
      >
        <OutlinedText size={S.fontSize} stroke={S.strokePx} style={{ color: S.color, maxWidth: 940 }}>
          {words.map((w, i) => (
            <span key={i} style={{ color: isKey(w) ? S.keywordColor : undefined }}>
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </OutlinedText>
      </div>
    </AbsoluteFill>
  );
};

// ── SUCK / SQUEEZE / BANG / BLOW pills during the reveal ───────────────
export const LabelPills: React.FC = () => {
  const { t, frame, fps } = useT();
  const out = 1 - smoothstep(LABEL_PILLS_OUT, LABEL_PILLS_OUT + 0.25, t);
  if (out <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {LABEL_PILLS.map((p, i) => {
        if (t < p.t) return null;
        const s = spring({ frame: frame - Math.round(p.t * fps), fps, config: { damping: 9, stiffness: 240, mass: 0.6 } });
        const bob = Math.sin(t * 2.4 + i * 1.7) * 8;
        const isNew = bump(p.t, p.t + 0.08, p.t + 0.6, t);
        return (
          <div
            key={p.text}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate(-50%, -50%) translateY(${bob}px) rotate(${p.tilt}deg) scale(${s * out * (1 + 0.08 * isNew)})`,
              background: p.color,
              borderRadius: 999,
              padding: '18px 44px 20px',
              border: '7px solid #ffffff',
              boxShadow: '0 14px 0 rgba(0,0,0,0.28), 0 20px 40px rgba(0,0,0,0.25)',
            }}
          >
            <OutlinedText size={74} stroke={4} ink="rgba(0,0,0,0.55)" shadow="none" style={{ color: '#fff' }}>
              {p.text}
            </OutlinedText>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Stroke badge (top) ─────────────────────────────────────────────────
export const StrokeBadge: React.FC = () => {
  const { t, frame, fps } = useT();
  const b = STROKE_BADGES.find((x) => t >= x.start && t < x.end);
  if (!b) return null;
  const s = spring({ frame: frame - Math.round(b.start * fps), fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  const out = 1 - smoothstep(b.end - 0.2, b.end, t);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '6.2%',
          left: '50%',
          transform: `translate(-50%, 0) scale(${s * out})`,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          background: 'rgba(255,255,255,0.96)',
          borderRadius: 999,
          padding: '14px 40px 14px 14px',
          boxShadow: '0 12px 0 rgba(0,0,0,0.22), 0 18px 40px rgba(0,0,0,0.22)',
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: 999,
            background: b.color,
            color: '#fff',
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {b.n}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 66, color: b.color, letterSpacing: 1 }}>{b.word}</span>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: '#4a5560', letterSpacing: 4, marginTop: 6 }}>{b.name}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Comic stickers ("BANG!", "VROOM!" …) ───────────────────────────────
export const Stickers: React.FC = () => {
  const { t, frame, fps } = useT();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {STICKERS.map((st) => {
        if (t < st.t || t > st.t + st.dur) return null;
        const s = spring({ frame: frame - Math.round(st.t * fps), fps, config: { damping: 8, stiffness: 300, mass: 0.6 } });
        const out = 1 - smoothstep(st.t + st.dur - 0.18, st.t + st.dur, t);
        const shake = st.text.startsWith('BANG') ? Math.exp(-4 * (t - st.t)) * 10 * Math.sin((t - st.t) * 70) : 0;
        return (
          <div
            key={st.text}
            style={{
              position: 'absolute',
              left: `${st.x}%`,
              top: `${st.y}%`,
              transform: `translate(-50%, -50%) translate(${shake}px, ${shake * 0.6}px) rotate(${st.tilt}deg) scale(${s * out})`,
            }}
          >
            <OutlinedText
              size={st.size}
              stroke={Math.max(6, st.size * 0.07)}
              ink="#ffffff"
              shadow={`0 ${st.size * 0.06}px 0 ${st.ink}, 0 ${st.size * 0.1}px 30px rgba(0,0,0,0.35)`}
              style={{ color: st.color, fontStyle: 'italic', letterSpacing: 2 }}
            >
              {st.text}
            </OutlinedText>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── ×3,000 / MIN counter ───────────────────────────────────────────────
export const RpmCounter: React.FC = () => {
  const { t, frame, fps } = useT();
  const R = RPM_COUNTER;
  if (t < R.in || t > R.out) return null;
  const s = spring({ frame: frame - Math.round(R.in * fps), fps, config: { damping: 10, stiffness: 240, mass: 0.6 } });
  const out = 1 - smoothstep(R.out - 0.2, R.out, t);
  const v = Math.round(R.value * smoothstep(R.countFrom, R.countTo, t) / 10) * 10;
  const pulse = 1 + 0.06 * bump(R.countTo, R.countTo + 0.06, R.countTo + 0.3, t);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: `${R.x}%`, top: `${R.y}%`, transform: `translate(-50%, -50%) rotate(-4deg) scale(${s * out * pulse})` }}>
        <OutlinedText size={128} stroke={9} ink="#111" shadow="0 10px 0 rgba(0,0,0,0.4)" style={{ color: '#fff' }}>
          {`×${v.toLocaleString('en-US')}`}
          <span style={{ fontSize: 60 }}>/MIN</span>
        </OutlinedText>
      </div>
    </AbsoluteFill>
  );
};

// ── Vignette, flashes ──────────────────────────────────────────────────
export const Vignette: React.FC = () => {
  const { t } = useT();
  const hook = 1 - smoothstep(EVENTS.lightSnap - 0.02, EVENTS.lightSnap + 0.05, t);
  const strength = 0.22 + 0.7 * hook;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(ellipse 75% 60% at 50% 46%, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`,
      }}
    />
  );
};

export const Flashes: React.FC = () => {
  const { t } = useT();
  const snap = 0.45 * Math.exp(-40 * Math.max(0, t - EVENTS.lightSnap)) * (t >= EVENTS.lightSnap ? 1 : 0);
  const bang = 0.6 * Math.exp(-9 * Math.max(0, t - EVENTS.bang)) * (t >= EVENTS.bang ? 1 : 0);
  return (
    <>
      {snap > 0.01 && <AbsoluteFill style={{ background: '#ffffff', opacity: snap, pointerEvents: 'none' }} />}
      {bang > 0.01 && <AbsoluteFill style={{ background: '#ffd9a0', opacity: bang, mixBlendMode: 'screen', pointerEvents: 'none' }} />}
    </>
  );
};

/** Motion-blur amount (px) for whip-pans, applied to the 3D canvas. */
export const whipBlur = (t: number) =>
  18 * bump(HOOK.pushStart + 0.12, HOOK.engineCut, HOOK.engineCut + 0.3, t) +
  16 * bump(EVENTS.whipStart + 0.05, EVENTS.whipCut, EVENTS.whipEnd, t);
