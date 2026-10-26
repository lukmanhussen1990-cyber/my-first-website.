// The retention engine: a 7-slot tracker under the captions. Tiles pop in at ~2 s, flip gold on each
// spoken number; slot 7 is a glowing "?" that shakes harder and harder until the reveal, then bursts
// into a gold 7. Later the same tiles become the self-check (S12), get washed white by light (S14a)
// and turn into the comment row (S15).
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { C, L, SANS, ease, pop, win, shake } from './theme.js';
import { clamp, lerp, hash01, smooth, invLerp } from '../lib/util.js';

const E = plan.ev;
const shot = (id) => plan.shots.find((s) => s.id === id);
const S12 = shot('S12'), S14a = shot('S14a'), S15 = shot('S15');

function layout(t) {
  // returns { y (tile top), size, gap, opacity, scale, mode }
  if (t < S12.t0) return { mode: 'count', y: L.trackY, size: L.tile, gap: L.gap, opacity: clamp((t - E.trackerIn[0] + 0.05) / 0.1), scale: 1 };
  if (t < S14a.t0 - 1) {
    const k = ease.inOut((t - S12.t0) / 0.5);
    return { mode: 'check', y: lerp(L.trackY, 930, k), size: lerp(L.tile, 124, k), gap: lerp(L.gap, 16, k), opacity: 1 - clamp((t - (E.goodNews - 0.6)) / 0.7), scale: 1 + 0.06 * clamp((t - S12.t0) / (S12.t1 - S12.t0)) };
  }
  if (t < S15.t0 - 0.5) return { mode: 'wash', y: 1010, size: 116, gap: 15, opacity: clamp((t - S14a.t0) / 0.35) * (1 - clamp((t - (S14a.t1 - 0.35)) / 0.35)), scale: 1 + 0.03 * clamp((t - S14a.t0) / 3.7) };
  return { mode: 'cta', y: 930, size: 108, gap: 14, opacity: clamp((t - S15.t0 - 0.1) / 0.3) * (1 - clamp((t - (E.endCard - 0.15)) / 0.25)), scale: 1 };
}

const GOLD_FACE = 'linear-gradient(160deg, #ffe49a 0%, #f2b84a 48%, #c3801f 100%)';

export const Tracker = ({ t, frame }) => {
  if (t < E.trackerIn[0] - 0.05) return null;
  const Lt = layout(t);
  if (Lt.opacity <= 0.001) return null;
  const { size, gap } = Lt;
  const total = 7 * size + 6 * gap; const x0 = (1080 - total) / 2;
  const s = t - E.reveal; const [rx, ry] = s > 0 && s < 0.32 ? shake(frame, 21, 12 * (1 - s / 0.32) ** 2) : [0, 0];
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: Lt.opacity, transform: `translate(${rx}px, ${ry}px) scale(${Lt.scale})`, transformOrigin: `540px ${Lt.y + size / 2}px` }}>
      {Array.from({ length: 7 }, (_, i) => <Tile key={i} i={i} t={t} frame={frame} x={x0 + i * (size + gap)} y={Lt.y} size={size} mode={Lt.mode} />)}
    </div>
  );
};

function Tile({ i, t, frame, x, y, size, mode }) {
  const tin = E.trackerIn[i];
  const appear = mode === 'count' ? ease.back((t - tin) / 0.32) : 1;
  if (appear <= 0) return null;
  const flipT = E.flip[i];
  const ang = mode === 'count' ? 180 * ease.inOut((t - flipT) / 0.38) : 180;
  const gold = ang > 90;
  const nextFlip = E.flip[i + 1] ?? E.reveal + 3.5;
  const active = mode === 'count' && t > flipT && t < nextFlip;
  const fs = size * 0.47;
  let sx = 0, sy = 0, rot = 0, extra = 1;
  const isQ = i === 6 && !gold;
  if (isQ) { // the "?" trembles, harder through the build-up
    const amp = 1.2 + 2.5 * clamp((t - 30) / 13) + 7 * smooth(invLerp(E.buildup, E.reveal, t));
    [sx, sy] = shake(frame, 31, amp); rot = (hash01(frame, 33) - 0.5) * amp * 0.9;
  }
  if (i === 6) extra = 1 + pop(t, E.reveal, 0.55, 12, 6);
  let pulse = 0, glow = active ? 0.75 : 0;
  if (mode === 'check') { pulse = pop(t, E.pulses[i], 0.22, 13, 6); glow = Math.max(0, Math.exp(-6 * Math.max(0, t - E.pulses[i])) * (t > E.pulses[i] ? 1 : 0)); }
  if (mode === 'cta') { pulse = pop(t, E.taps[i], 0.16, 16, 8); glow = i === 6 ? smooth(invLerp(E.typeEnd - 0.2, E.typeEnd + 0.3, t)) : Math.exp(-5 * Math.max(0, t - E.taps[i])) * (t > E.taps[i] ? 0.8 : 0); }
  const washK = mode === 'wash' ? clamp((t - E.wash[i]) / 0.38) : 0;
  const cta = mode === 'cta';
  const sc = appear * (1 + pulse) * extra;
  const face = { position: 'absolute', inset: 0, borderRadius: size * 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', font: `800 ${fs}px ${SANS}` };
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, perspective: 700, transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${sc})` }}>
      {i === 6 && t > E.reveal && t < E.reveal + 0.7 ? <Burst t={t - E.reveal} size={size} /> : null}
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateX(${ang}deg)` }}>
        <div style={{ ...face, background: cta ? 'rgba(30,20,14,0.85)' : 'rgba(16,11,8,0.62)', border: `2px solid ${isQ ? 'rgba(255,200,90,0.95)' : 'rgba(240,191,90,0.55)'}`, color: isQ ? '#ffd27a' : 'rgba(255,240,215,0.6)',
          boxShadow: isQ ? `0 0 ${18 + 14 * Math.sin(t * 7) ** 2}px rgba(255,180,60,0.8), inset 0 0 14px rgba(255,190,80,0.35)` : '0 6px 18px rgba(0,0,0,0.35)', textShadow: isQ ? '0 0 16px rgba(255,190,70,0.95)' : 'none' }}>
          {isQ ? '?' : i + 1}
        </div>
        <div style={{ ...face, transform: 'rotateX(180deg)', background: washK > 0 ? `linear-gradient(160deg, ${mixHex('#ffe49a', '#fffdf6', washK)} 0%, ${mixHex('#f2b84a', '#fff8ea', washK)} 50%, ${mixHex('#c3801f', '#f6ead2', washK)} 100%)` : cta && i !== 6 ? 'linear-gradient(160deg, #3a281a, #241810)' : GOLD_FACE,
          color: washK > 0 ? `rgba(214,170,90,${1 - 0.6 * washK})` : cta && i !== 6 ? C.gold : '#2a1a10', border: cta && i !== 6 ? '2px solid rgba(240,191,90,0.6)' : '2px solid rgba(255,236,190,0.9)',
          boxShadow: `0 0 ${10 + 30 * glow + 30 * washK}px rgba(255,${washK > 0 ? 245 : 190},${washK > 0 ? 220 : 80},${0.25 + 0.6 * Math.max(glow, washK)}), 0 6px 18px rgba(0,0,0,0.35)` }}>
          {i + 1}
          <Shine t={mode === 'count' ? t - flipT - 0.25 : mode === 'wash' ? t - E.wash[i] : -1} />
        </div>
      </div>
    </div>
  );
}

const Shine = ({ t }) => {
  if (t < 0 || t > 0.6) return null;
  const x = lerp(-120, 220, t / 0.6);
  return <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden' }}><div style={{ position: 'absolute', top: '-40%', left: `${x}%`, width: '45%', height: '180%', transform: 'rotate(20deg)', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75), rgba(255,255,255,0))' }} /></div>;
};

// reveal burst: flash ring + gold sparks
const Burst = ({ t, size }) => {
  const u = t / 0.7;
  return (
    <div style={{ position: 'absolute', left: size / 2, top: size / 2 }}>
      <div style={{ position: 'absolute', left: -size * (0.5 + 1.6 * u), top: -size * (0.5 + 1.6 * u), width: size * (1 + 3.2 * u), height: size * (1 + 3.2 * u), borderRadius: '50%', border: `${4 * (1 - u) + 1}px solid rgba(255,214,120,${1 - u})`, boxShadow: `0 0 30px rgba(255,190,80,${0.8 * (1 - u)})` }} />
      {Array.from({ length: 12 }, (_, k) => { const a = k / 12 * Math.PI * 2 + 0.3; const d = size * (0.4 + 1.9 * ease.out(u) * (0.7 + 0.5 * hash01(k, 5))); const r = 5 + 4 * hash01(k, 6);
        return <div key={k} style={{ position: 'absolute', left: Math.cos(a) * d - r, top: Math.sin(a) * d - r + 40 * u * u, width: 2 * r, height: 2 * r, borderRadius: '50%', background: '#ffe2a0', opacity: 1 - u, boxShadow: '0 0 10px rgba(255,190,80,0.9)' }} />; })}
    </div>
  );
};

function mixHex(a, b, k) {
  const pa = [1, 3, 5].map((j) => parseInt(a.slice(j, j + 2), 16)), pb = [1, 3, 5].map((j) => parseInt(b.slice(j, j + 2), 16));
  return '#' + pa.map((v, j) => Math.round(lerp(v, pb[j], clamp(k))).toString(16).padStart(2, '0')).join('');
}
