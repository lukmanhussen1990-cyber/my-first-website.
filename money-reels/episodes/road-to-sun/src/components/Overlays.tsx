import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import captions from '../data/captions.json';
import timeline from '../data/timeline.json';
import {GREEN, SC, T, easeIn, easeOut, formatKm, img, lerp, pop, prog, within} from '../lib/anim';

type Word = {text: string; start: number; end: number; green: boolean};
type Chunk = {words: Word[]; start: number; end: number};

const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  for (const p of captions.phrases) {
    let cur: Word[] = [];
    const flush = () => {
      if (cur.length) out.push({words: cur, start: cur[0].start, end: p.end});
      cur = [];
    };
    for (const w of p.words as Word[]) {
      const len = cur.reduce((a, x) => a + x.text.length + 1, 0);
      if (cur.length && (len + w.text.length > 17 || cur.length >= 4)) flush();
      cur.push(w);
      if (/[,.!?]$/.test(w.text) && cur.length >= 2) flush();
    }
    flush();
  }
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    out[i].end = next ? Math.min(next.start, Math.max(out[i].end + 0.3, out[i].words[out[i].words.length - 1].start + 0.4)) : out[i].end + 0.6;
    out[i].start -= 0.06;
  }
  return out;
})();

export const STROKE: React.CSSProperties = {
  WebkitTextStroke: '16px #0b0b10',
  paintOrder: 'stroke fill',
};

/** Word-by-word captions in the middle of the screen. */
export const Captions: React.FC<{t: number; y?: number; size?: number}> = ({t, y = 1215, size = 82}) => {
  const c = CHUNKS.find((k) => t >= k.start && t < k.end);
  if (!c) return null;
  return (
    <div style={{position: 'absolute', left: 150, right: 150, top: y, transform: 'translateY(-50%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 22px'}}>
      {c.words.map((w, i) => {
        const s = pop(t, w.start - 0.04, 0.2, 2.2);
        return (
          <span
            key={i}
            style={{
              fontFamily: 'Nunito', fontWeight: 900, fontSize: size, lineHeight: 1.12, color: w.green ? GREEN : '#ffffff',
              ...STROKE, filter: 'drop-shadow(0 7px 0 rgba(0,0,0,0.35))',
              transform: `scale(${s}) translateY(${(1 - Math.min(s, 1)) * 20}px)`, opacity: s > 0 ? 1 : 0, display: 'inline-block',
              letterSpacing: 0.5,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

/** Big bouncy 3D-tilted number in bright green. */
export const BigText: React.FC<{t: number; t0: number; t1: number; text: string; y?: number; size?: number; color?: string; sub?: string; tilt?: number}> = ({
  t, t0, t1, text, y = 560, size = 150, color = GREEN, sub, tilt = 1,
}) => {
  if (t < t0 || t > t1 + 0.25) return null;
  const inS = pop(t, t0, 0.42, 2.6);
  const outS = 1 - easeIn(prog(t, t1, t1 + 0.22));
  const s = inS * outS;
  const tt = t - t0;
  const rx = (14 * Math.sin(tt * 4.1) + 22 * (1 - prog(t, t0, t0 + 0.45))) * tilt;
  const ry = -16 * Math.sin(tt * 2.7 + 0.6) * tilt;
  const rz = -4 * Math.sin(tt * 3.3) * tilt;
  const depth = Array.from({length: 9}, (_, i) => `${i + 1}px ${i + 1}px 0 #0f5c0e`).join(',');
  return (
    <div style={{position: 'absolute', left: 120, right: 120, top: y, perspective: 900, display: 'flex', justifyContent: 'center'}}>
      <div style={{transform: `translateY(-50%) scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`, transformStyle: 'preserve-3d', textAlign: 'center'}}>
        <div style={{fontFamily: 'Lilita One', fontSize: size, lineHeight: 1, color, WebkitTextStroke: '14px #08240a', paintOrder: 'stroke fill', textShadow: `${depth}, 12px 18px 0 rgba(0,0,0,0.45)`, whiteSpace: 'nowrap'}}>
          {text}
        </div>
        {sub ? (
          <div style={{fontFamily: 'Nunito', fontWeight: 900, fontSize: size * 0.32, color: '#fff', ...STROKE, WebkitTextStroke: '10px #0b0b10', marginTop: 4}}>{sub}</div>
        ) : null}
      </div>
    </div>
  );
};

const PEOPLE = [
  {key: 'you', label: 'YOU', color: '#ffc928', icon: 'icon_you', scene: 'you'},
  {key: 'ronaldo', label: 'RONALDO', color: '#ffffff', icon: 'icon_ronaldo', scene: 'ronaldo'},
  {key: 'mrbeast', label: 'MRBEAST', color: '#4fc3ff', icon: 'icon_mrbeast', scene: 'mrbeast'},
  {key: 'elon', label: 'ELON', color: '#ff5a5a', icon: 'icon_elon', scene: 'elon'},
];

/** Current road length for person i at time t (km). */
export const roadValue = (i: number, t: number) => {
  const c = timeline.counter[i];
  const x = prog(t, c.from, c.to);
  return lerp(c.start, c.end, 1 - Math.pow(1 - x, 3.2));
};

const activePerson = (t: number) => {
  if (t >= SC.kicker[0]) return 3;
  for (let i = PEOPLE.length - 1; i >= 0; i--) if (t >= SC[PEOPLE[i].scene][0]) return i;
  return -1;
};

/** "ROAD LENGTH" counter, top centre. */
/** The counter only shows while a road exists: from each launch to the end of that scene. */
const COUNTER_ON: [number, number][] = [
  [T.youRoadStart - 0.4, SC.you[1]],
  [T.ronLaunch - 0.1, SC.ronaldo[1]],
  [T.mbFire - 0.1, SC.mrbeast[1]],
  [T.elonIgnite - 0.1, SC.cta[0]],
];

export const Counter: React.FC<{t: number}> = ({t}) => {
  const on = COUNTER_ON.find(([a, b]) => t >= a && t < b);
  if (!on) return null;
  const i = activePerson(t);
  if (i < 0) return null;
  const p = PEOPLE[i];
  const v = roadValue(i, t);
  const appear = pop(t, on[0], 0.35);
  const out = 1 - prog(t, SC.cta[0] - 0.25, SC.cta[0]);
  const c = timeline.counter[i];
  const ticking = t > c.from && t < c.to;
  const bump = ticking ? 1 + 0.03 * Math.abs(Math.sin(t * 40)) : 1 + 0.12 * Math.exp(-(t - c.to) * 8) * (t > c.to ? 1 : 0);
  return (
    <div style={{position: 'absolute', top: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: out}}>
      <div style={{transform: `scale(${appear})`, background: 'rgba(8,10,24,0.72)', border: '4px solid rgba(255,255,255,0.9)', borderRadius: 28, padding: '10px 34px 12px', textAlign: 'center', boxShadow: '0 8px 0 rgba(0,0,0,0.3)'}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14}}>
          <span style={{fontFamily: 'Nunito', fontWeight: 900, fontSize: 30, letterSpacing: 4, color: '#fff'}}>ROAD LENGTH</span>
          <span style={{fontFamily: 'Nunito', fontWeight: 900, fontSize: 24, color: '#111', background: p.color, borderRadius: 12, padding: '2px 12px'}}>{p.label}</span>
        </div>
        <div style={{fontFamily: 'Lilita One', fontSize: 76, lineHeight: 1.05, color: GREEN, WebkitTextStroke: '8px #08240a', paintOrder: 'stroke fill', transform: `scale(${bump})`, fontVariantNumeric: 'tabular-nums', minWidth: 520}}>
          {formatKm(v)} <span style={{fontSize: 48, color: '#fff'}}>km</span>
        </div>
      </div>
    </div>
  );
};

const LOG_MAX = Math.log10(1.5e8);
const TOP = 372, BOTTOM = 1450, X = 64;
const ty = (km: number) => BOTTOM - (Math.log10(Math.max(km, 1)) / LOG_MAX) * (BOTTOM - TOP);

/** Vertical Earth -> Moon -> Sun tracker on the left edge (log scale). */
export const Tracker: React.FC<{t: number}> = ({t}) => {
  if (!within(t, SC.you[0], SC.cta[0])) return null;
  const a = easeOut(prog(t, SC.you[0], SC.you[0] + 0.5)) * (1 - prog(t, SC.cta[0] - 0.3, SC.cta[0]));
  const moonY = ty(384400);
  const half = ty(192200);
  const sunHit = prog(t, T.elonSun, T.elonSun + 0.8);
  return (
    <AbsoluteFill style={{opacity: a, transform: `translateX(${(1 - a) * -120}px)`}}>
      <div style={{position: 'absolute', left: X - 4, top: TOP, width: 8, height: BOTTOM - TOP, borderRadius: 4, background: 'linear-gradient(180deg,#ffd23a,#ffffff 40%,#7fd0ff)', boxShadow: '0 0 0 3px rgba(0,0,0,0.55)'}} />
      {[0.25, 0.5, 0.75].map((f) => (
        <div key={f} style={{position: 'absolute', left: X - 12, top: lerp(BOTTOM, TOP, f) - 2, width: 24, height: 4, background: 'rgba(255,255,255,0.7)'}} />
      ))}
      <div style={{position: 'absolute', left: X - 18, top: half - 2, width: 36, height: 0, borderTop: '4px dashed #fff', opacity: within(t, SC.ronaldo[0], SC.elon[0]) ? 1 : 0.4}} />
      <Img src={img('21_sun')} style={{position: 'absolute', left: X - 48, top: TOP - 48, width: 96, height: 96, filter: `drop-shadow(0 0 ${12 + 40 * Math.sin(Math.PI * sunHit)}px #ffcc33)`, transform: `scale(${1 + 0.5 * Math.sin(Math.PI * sunHit)})`}} />
      <Img src={img('20_moon')} style={{position: 'absolute', left: X - 28, top: moonY - 28, width: 56, height: 56}} />
      <Img src={img('19_earth')} style={{position: 'absolute', left: X - 38, top: BOTTOM - 38, width: 76, height: 76}} />
      {[
        ['SUN', TOP + 50],
        ['MOON', moonY + 28],
        ['EARTH', BOTTOM + 40],
      ].map(([l, yy]) => (
        <div key={l as string} style={{position: 'absolute', left: 0, width: X * 2, top: (yy as number) + 2, textAlign: 'center', fontFamily: 'Nunito', fontWeight: 900, fontSize: 20, color: '#fff', WebkitTextStroke: '5px #000', paintOrder: 'stroke fill'}}>
          {l}
        </div>
      ))}
      <div style={{position: 'absolute', left: 0, width: X * 2, top: BOTTOM + 66, textAlign: 'center', fontFamily: 'Nunito', fontWeight: 800, fontSize: 15, color: 'rgba(255,255,255,0.85)', WebkitTextStroke: '4px #000', paintOrder: 'stroke fill'}}>
        log scale
      </div>
      {PEOPLE.map((p, i) => {
        const s0 = SC[p.scene][0];
        if (t < s0) return null;
        const v = roadValue(i, t);
        const yy = ty(v);
        const side = i % 2 === 0 ? 0 : 1;
        const x = X + 14 + side * 46;
        const ps = pop(t, s0 + 0.15, 0.35);
        const current = activePerson(t) === i;
        const flash = i === 3 ? Math.sin(Math.PI * sunHit) : 0;
        return (
          <div key={p.key} style={{position: 'absolute', left: x, top: yy - 30, width: 60, height: 60, transform: `scale(${ps * (current ? 1.12 : 0.88)})`, zIndex: current ? 2 : 1}}>
            <Img src={img(p.icon)} style={{width: 60, height: 60, borderRadius: 30, border: `4px solid ${p.color}`, boxShadow: `0 0 ${8 + 40 * flash}px ${flash > 0 ? '#fff6a0' : 'rgba(0,0,0,0.6)'}`, boxSizing: 'border-box'}} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Flash: React.FC<{t: number; at: number; dur?: number; color?: string; peak?: number}> = ({t, at, dur = 0.35, color = '#ffffff', peak = 1}) => {
  const x = prog(t, at, at + dur);
  if (t < at || x >= 1) return null;
  return <AbsoluteFill style={{background: color, opacity: peak * Math.pow(1 - x, 2)}} />;
};

/** Tiny source note on the last frames. */
export const Note: React.FC<{t: number}> = ({t}) => {
  const a = prog(t, T.ctaGlow, T.ctaGlow + 0.4);
  if (a <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 1462, display: 'flex', justifyContent: 'center', opacity: a}}>
      <div style={{fontFamily: 'Nunito', fontWeight: 800, fontSize: 30, color: '#fff', background: 'rgba(10,10,24,0.62)', borderRadius: 18, padding: '6px 20px'}}>
        Net worth = public estimates, Oct 2026
      </div>
    </div>
  );
};
