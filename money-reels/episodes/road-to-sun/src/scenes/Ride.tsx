import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {Clouds, Sky, SpeedLines, Stars} from '../components/Sky';
import {Pt, RibbonRoad, spline} from '../components/RibbonRoad';
import {Sprite} from '../components/Sprite';
import {clamp, img} from '../lib/anim';

/** Distance travelled along the road (px) for a constant speed that brakes to a stop over `brake` seconds. */
export const travel = (t: number, t0: number, t1: number, v: number, brake = 0.5) => {
  if (t <= t0) return 0;
  const cruiseEnd = t1 - brake;
  if (t <= cruiseEnd) return v * (t - t0);
  const d = Math.min(t, t1) - cruiseEnd;
  return v * (cruiseEnd - t0) + v * (d - (d * d) / (2 * brake));
};

/** Sky that climbs from day to space, with clouds rushing down and stars appearing. */
export const ClimbSky: React.FC<{alt: number; rise: number; speed: number; warm?: number; seed?: number}> = ({alt, rise, speed, warm = 0, seed = 2}) => (
  <AbsoluteFill>
    <Sky alt={alt} warm={warm} />
    <Stars seed={seed + 30} count={240} offsetY={rise * 0.04} streakY={speed * 0.035} opacity={clamp((alt - 0.4) / 0.4)} />
    <Clouds seed={seed} n={7} span={3000} scrollY={rise * 0.9} scale={1.1} stretch={1 + Math.min(speed, 4000) / 6000} opacity={1 - clamp((alt - 0.3) / 0.3)} />
    <Clouds seed={seed + 7} n={4} span={3000} scrollY={rise * 1.6} scale={1.7} stretch={1 + Math.min(speed, 4000) / 4000} opacity={0.9 * (1 - clamp((alt - 0.25) / 0.25))} />
  </AbsoluteFill>
);

/** A rider surfing the tip of a road that trails back down to `tail`. */
export const Rider: React.FC<{
  t: number; name: string; feet: Pt; tail: Pt[]; h: number; scroll: number; lean?: number; glow?: number; settleAt?: number; billLen?: number;
}> = ({t, name, feet, tail, h, scroll, lean = -8, glow = 0.6, settleAt, billLen = 150}) => {
  const path = spline([feet, ...tail], 20);
  const wob = Math.sin(t * 9) * 1.5;
  const settle = settleAt !== undefined && t > settleAt ? Math.exp(-(t - settleAt) * 6) * Math.sin((t - settleAt) * 22) * 0.06 : 0;
  return (
    <>
      <RibbonRoad path={path} billLen={billLen} scroll={scroll} glow={glow} persp={0.35} seed={name.length * 7} />
      <Sprite name={name} x={feet[0]} y={feet[1] + 8} h={h * (1 + 0.01 * Math.sin(t * 6))} rot={lean + wob} sx={1 + settle} sy={1 - settle} />
    </>
  );
};

/** Small cartoon airliner drawn in code. */
export const Airplane: React.FC<{x: number; y: number; s: number; rot?: number}> = ({x, y, s, rot = 0}) => (
  <svg width={300} height={140} viewBox="0 0 300 140" style={{position: 'absolute', left: x - 150 * s, top: y - 70 * s, transform: `scale(${s}) rotate(${rot}deg)`, transformOrigin: '0 0', overflow: 'visible'}}>
    <g stroke="#1E1E24" strokeWidth={6} strokeLinejoin="round">
      <path d="M40,58 L18,10 L58,10 L96,58 Z" fill="#ff5a5a" />
      <path d="M120,78 L190,132 L222,132 L180,78 Z" fill="#c9d6e8" />
      <rect x={20} y={52} width={262} height={44} rx={22} fill="#ffffff" />
      <path d="M262,56 Q298,74 262,96 Z" fill="#9fd3ff" />
      <path d="M118,70 L176,30 L206,30 L170,72 Z" fill="#dfe8f5" />
    </g>
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <circle key={i} cx={92 + i * 22} cy={68} r={6} fill="#3d8cf0" />
    ))}
  </svg>
);

/** Planet sprite with soft glow (image is a centred square). */
export const Planet: React.FC<{name: string; x: number; y: number; d: number; glow?: string; blur?: number; rot?: number}> = ({name, x, y, d, glow, blur = 0, rot = 0}) => {
  if (d <= 1) return null;
  return (
    <Img
      src={img(name)}
      style={{
        position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, transform: `rotate(${rot}deg)`,
        filter: [glow ? `drop-shadow(0 0 ${d * 0.06}px ${glow})` : '', blur ? `blur(${blur}px)` : ''].join(' ') || undefined,
      }}
    />
  );
};

export const SpeedFx: React.FC<{t: number; speed: number; angle?: number}> = ({t, speed, angle = 90}) => (
  <SpeedLines t={t} intensity={clamp(speed / 3000) * 1.1} angle={angle} seed={13} />
);
