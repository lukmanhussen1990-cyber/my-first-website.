import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {RibbonRoad} from '../components/RibbonRoad';
import {SpeedLines, Stars} from '../components/Sky';
import {Sprite, spriteMeta} from '../components/Sprite';
import {SC, T, easeInOut, img, lerp, pop, prog, rng, squash} from '../lib/anim';
import {Planet} from './Ride';

const ROAD_Y = 1300;
const CAR_H = 430;
const WHEELS = [[286, 769], [1257, 769]]; // hub centres in the car sprite's own pixels
const WHEEL_R = 150;

/** A wheel cut from the car image and spun in place. */
const Wheel: React.FC<{cx: number; cy: number; s: number; angle: number; carX: number; carY: number}> = ({cx, cy, s, angle, carX, carY}) => {
  const m = spriteMeta('17_car_grandpa');
  const r = WHEEL_R * s;
  return (
    <div style={{position: 'absolute', left: carX + cx * s - r, top: carY + cy * s - r, width: r * 2, height: r * 2, borderRadius: '50%', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: r * 2, height: r * 2, transform: `rotate(${angle}deg)`}}>
        <Img src={img('17_car_grandpa')} style={{position: 'absolute', left: r - cx * s, top: r - cy * s, width: m.w * s, height: m.h * s, maxWidth: 'none'}} />
      </div>
    </div>
  );
};

const Calendar: React.FC<{t: number; year: number; flip: number}> = ({t, year, flip}) => {
  const s = pop(t, SC.kicker[0] + 0.3, 0.4);
  if (s <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 540 - 170, top: 380, width: 340, transform: `scale(${s}) rotate(${Math.sin(t * 3) * 2}deg)`}}>
      <div style={{height: 70, background: '#ff4b4b', border: '7px solid #1E1E24', borderRadius: '22px 22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Lilita One', fontSize: 40, color: '#fff', letterSpacing: 3}}>YEAR</div>
      <div style={{height: 170, background: '#fff', border: '7px solid #1E1E24', borderTop: 'none', borderRadius: '0 0 22px 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 600}}>
        <div style={{fontFamily: 'Lilita One', fontSize: 128, color: '#1E1E24', transform: `rotateX(${flip * 70}deg)`, fontVariantNumeric: 'tabular-nums'}}>{year}</div>
      </div>
      {[90, 250].map((x) => (
        <div key={x} style={{position: 'absolute', left: x - 9, top: -22, width: 18, height: 48, borderRadius: 9, background: '#c9cfd8', border: '5px solid #1E1E24'}} />
      ))}
    </div>
  );
};

/** KICKER: grandpa drives the money road at 100 km/h for 178 years. */
export const Kicker: React.FC<{t: number}> = ({t}) => {
  const [a] = SC.kicker;
  const m = spriteMeta('17_car_grandpa');
  const s = CAR_H / (m.bbox[3] - m.bbox[1]);
  const carW = (m.bbox[2] - m.bbox[0]) * s;
  const honk = t >= T.kickHonk;
  const [sx, sy] = squash(t, T.kickHonk, 0.12, 0.45);
  const bounce = Math.abs(Math.sin(t * 13)) * 5 + (honk ? -Math.exp(-(t - T.kickHonk) * 8) * 30 : 0);
  const carX = 540 - carW / 2 - m.bbox[0] * s + Math.sin(t * 1.3) * 12;
  const carY = ROAD_Y - 6 - m.bbox[3] * s - bounce;
  const angle = (t - a) * 900;
  const yp = easeInOut(prog(t, T.kickCalStart, T.kickCalEnd));
  const yearF = 2026 + 178 * yp;
  const year = Math.round(yearF);
  const flip = t > T.kickCalStart && t < T.kickCalEnd ? Math.abs(Math.sin(yearF * Math.PI)) : 0;
  const signP = prog(t, 45.3, 46.7);
  const r = rng(91);
  const beep = pop(t, T.kickHonk + 0.02, 0.3);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg,#05040f 0%,#0b0a2a 60%,#1b0d33 100%)'}}>
      <Stars seed={71} count={260} offsetX={-(t - a) * 420} streakX={70} />
      <Planet name="21_sun" x={1180} y={760} d={620} rot={t * 8} glow="rgba(255,190,60,0.9)" />
      <RibbonRoad path={[[1400, ROAD_Y], [-300, ROAD_Y]]} billLen={160} scroll={(t - a) * 1500} glow={0.7} flutter={false} seed={23} />
      {signP > 0 && signP < 1 ? (
        <svg width={170} height={330} viewBox="0 0 170 330" style={{position: 'absolute', left: lerp(1150, -250, signP), top: ROAD_Y - 330}}>
          <rect x={77} y={140} width={16} height={190} fill="#c9cfd8" stroke="#1E1E24" strokeWidth={5} />
          <circle cx={85} cy={80} r={74} fill="#fff" stroke="#e03131" strokeWidth={20} />
          <circle cx={85} cy={80} r={84} fill="none" stroke="#1E1E24" strokeWidth={5} />
          <text x={85} y={102} textAnchor="middle" fontFamily="Lilita One" fontSize={62} fill="#1E1E24">100</text>
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${sx},${sy})`, transformOrigin: `540px ${ROAD_Y}px`, width: 1080, height: 1920}}>
        <Sprite name="17_car_grandpa" x={carX + (m.bbox[0] + (m.bbox[2] - m.bbox[0]) / 2) * s} y={carY + m.bbox[3] * s} h={CAR_H} rot={Math.sin(t * 7) * 0.6} />
        {WHEELS.map(([cx, cy], i) => (
          <Wheel key={i} cx={cx} cy={cy} s={s} angle={angle} carX={carX} carY={carY} />
        ))}
      </div>
      {Array.from({length: 7}, (_, i) => {
        const k = (t - a) * 2.2 + i / 7;
        const f = k % 1;
        return <div key={i} style={{position: 'absolute', left: carX + 10 - f * 260, top: carY + 300 * s * 2.2 - f * 40 + r() * 30, width: 40 + f * 70, height: 40 + f * 70, borderRadius: '50%', background: 'rgba(230,236,255,0.55)', opacity: 1 - f}} />;
      })}
      <SpeedLines t={t} intensity={0.8} angle={180} seed={44} />
      <Calendar t={t} year={year} flip={flip} />
      {t > T.kickCalStart && t < T.kickCalEnd
        ? Array.from({length: 8}, (_, i) => {
            const k = ((t - T.kickCalStart) * 3.2 + i / 8) % 1;
            return <div key={i} style={{position: 'absolute', left: 560 + k * 380, top: 470 - k * 320, width: 120, height: 100, background: '#fff', border: '5px solid #1E1E24', borderRadius: 10, transform: `rotate(${k * 260}deg)`, opacity: 1 - k}} />;
          })
        : null}
      {beep > 0 ? (
        <div style={{position: 'absolute', left: 500, top: 905, transform: `scale(${beep}) rotate(-10deg)`, fontFamily: 'Lilita One', fontSize: 74, color: '#ffe14a', WebkitTextStroke: '11px #1E1E24', paintOrder: 'stroke fill', whiteSpace: 'nowrap'}}>
          BEEP BEEP!
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
