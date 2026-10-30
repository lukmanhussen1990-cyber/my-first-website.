import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {Bill3D, BillRoad3D, Cam3D, project} from '../components/BillRoad3D';
import {Clouds, Sky, SpeedLines} from '../components/Sky';
import {Sprite} from '../components/Sprite';
import {H, SC, T, W, breathe, easeInOut, easeOut, img, lerp, pop, prog, rng, squash, sway} from '../lib/anim';

/** Vanishing point of the street background in video pixels. */
export const VP = {x: 540, y: 825};
const BASE = 1.25; // the 1024x1536 background covers 1080x1920 at this scale
export const STREET_BILL = 0.57; // bills are drawn ~12x real size so the road reads on screen
const BL = 1.4 * 2.36 * STREET_BILL;

/** Sky, clouds and the city street, zoomed around the vanishing point. */
export const StreetBG: React.FC<{t: number; zoom?: number; panX?: number; blur?: number}> = ({t, zoom = 1, panX = 0, blur = 0}) => {
  const w = 1024 * BASE, h = 1536 * BASE;
  return (
    <AbsoluteFill>
      <Sky alt={0} />
      <Clouds seed={21} n={6} span={2400} scrollY={0} scrollX={t * 26} scale={0.8} />
      <AbsoluteFill style={{transform: `translateX(${panX}px) scale(${zoom})`, transformOrigin: `${VP.x}px ${VP.y}px`, filter: blur > 0 ? `blur(${blur}px)` : undefined}}>
        <Img src={img('18_bg_street')} style={{position: 'absolute', left: (W - w) / 2, top: 0, width: w, height: h}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 3D camera that matches StreetBG at a given zoom (pure zoom = narrower field of view). */
export const streetCam = (zoom: number): Cam3D => {
  const f = (H / 2 / Math.tan((50 * Math.PI) / 360)) * zoom;
  const fov = (2 * Math.atan(H / 2 / f) * 180) / Math.PI;
  const pitch = Math.atan((H / 2 - VP.y) / f);
  return {pos: [0, 1.6, 0], look: [0, 1.6 - Math.tan(pitch) * 100, -100], fov};
};

const landing = (t: number, t0: number, drop = 1.2, dur = 0.12) => {
  const p = prog(t, t0, t0 + dur);
  const y = drop * (1 - p * p);
  const bounce = t > t0 + dur ? 0.06 * Math.exp(-(t - t0 - dur) * 14) * Math.sin((t - t0 - dur) * 40) : 0;
  return {y: Math.max(0, y) + Math.abs(bounce) * 0.2, s: 1 + bounce, visible: t >= t0};
};

/** INTRO: one bill flips down, then a line of bills slaps down toward the camera. */
export const Intro: React.FC<{t: number}> = ({t}) => {
  const zoom = lerp(1.0, 1.12, easeInOut(prog(t, SC.intro[0], SC.intro[1])));
  const cam = streetCam(zoom);
  const bills: Bill3D[] = [];
  // the hero bill
  const t0 = T.introFirstBill;
  if (t >= t0) {
    const p = prog(t, t0, T.introBillLand);
    const l = landing(t, T.introBillLand, 0, 0.01);
    bills.push({x: 0.05, y: 3.2 * (1 - easeOut(p)) * (1 - p) + l.y, z: -7.5, rx: (1 - p) * Math.PI * 4, ry: 0.25 * (1 - p) + 0.06, rz: (1 - p) * 0.6, s: STREET_BILL * l.s});
  }
  // the line, far to near
  const n = 26;
  for (let k = 0; k < n; k++) {
    const z = -6 - (n - 1 - k) * BL * 0.98 - 0.4;
    if (Math.abs(z + 7.5) < BL * 0.6) continue;
    const tk = lerp(T.introSlapStart, T.introSlapEnd, k / (n - 1));
    const l = landing(t, tk - 0.12, 1.4, 0.12);
    if (!l.visible) continue;
    const r = rng(300 + k);
    bills.push({x: (r() - 0.5) * 0.08, y: l.y, z, ry: (r() - 0.5) * 0.1, rx: l.y * 0.4, s: STREET_BILL * l.s});
  }
  const shake = Math.exp(-Math.max(0, t - T.introBillLand) * 10) * (t > T.introBillLand ? 6 : 0);
  return (
    <AbsoluteFill style={{transform: `translateY(${shake * Math.sin(t * 90)}px)`}}>
      <StreetBG t={t} zoom={zoom} />
      <BillRoad3D bills={bills} cam={cam} />
    </AbsoluteFill>
  );
};

/** A stopwatch badge that spins fast to show the walk time. */
const Stopwatch: React.FC<{x: number; y: number; s: number; t: number}> = ({x, y, s, t}) => {
  if (s <= 0) return null;
  const a = (t * 900) % 360;
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${s})`, textAlign: 'center'}}>
      <svg width={170} height={190} viewBox="-85 -105 170 190">
        <rect x={-16} y={-102} width={32} height={22} rx={6} fill="#ff5a5a" stroke="#1E1E24" strokeWidth={7} />
        <circle r={78} fill="#ffffff" stroke="#1E1E24" strokeWidth={9} />
        <circle r={62} fill="#fff6d6" />
        <path d={`M0,0 L${62 * Math.sin((a * Math.PI) / 180)},${-62 * Math.cos((a * Math.PI) / 180)} A62,62 0 ${a > 180 ? 1 : 0},0 0,-62 Z`} fill="#3DFF3A" opacity={0.55} />
        <line x1={0} y1={0} x2={50 * Math.sin((a * Math.PI) / 180)} y2={-50 * Math.cos((a * Math.PI) / 180)} stroke="#1E1E24" strokeWidth={8} strokeLinecap="round" />
        <circle r={9} fill="#1E1E24" />
      </svg>
      <div style={{fontFamily: 'Lilita One', fontSize: 56, color: '#fff', WebkitTextStroke: '9px #1E1E24', paintOrder: 'stroke fill', marginTop: -8}}>20 MIN</div>
    </div>
  );
};

/** Little finish flag for the end of a road. */
export const FinishFlag: React.FC<{x: number; y: number; h: number; label?: string}> = ({x, y, h, label}) => {
  if (h < 4) return null;
  const s = h / 300;
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-12px,-100%) scale(${s})`, transformOrigin: '12px 100%'}}>
      <svg width={220} height={300} viewBox="0 0 220 300">
        <rect x={6} y={10} width={14} height={290} rx={6} fill="#ddd" stroke="#1E1E24" strokeWidth={6} />
        <g stroke="#1E1E24" strokeWidth={6}>
          <path d="M20,16 L200,30 L200,128 L20,114 Z" fill="#fff" />
        </g>
        {[0, 1, 2, 3, 4, 5].map((i) => [0, 1, 2].map((j) => ((i + j) % 2 ? <rect key={`${i}${j}`} x={20 + i * 30} y={18 + j * 32 + i * 2.3} width={30} height={32} fill="#1E1E24" /> : null)))}
      </svg>
      {label ? <div style={{position: 'absolute', left: 30, top: -70, whiteSpace: 'nowrap', fontFamily: 'Lilita One', fontSize: 64, color: '#3DFF3A', WebkitTextStroke: '10px #08240a', paintOrder: 'stroke fill'}}>{label}</div> : null}
    </div>
  );
};

/** YOU: wallet, the 1.56 km road down the street, then the 20-minute walk. */
export const You: React.FC<{t: number}> = ({t}) => {
  const [a] = SC.you;
  const youZ = -4.4;
  const lay0 = T.youRoadStart, lay1 = T.youRoadEnd;
  const lp = prog(t, lay0, lay1);
  const layE = 1 - Math.pow(1 - lp, 3.2);
  const endZ = -230;
  // camera: gentle drift, then zoom toward the end of the road while it is laid out, then back for the walk
  const walk = t >= T.youWalk - 0.05;
  const zoomLay = lerp(1.02, 3.0, easeInOut(prog(t, lay0 + 0.2, lay1 + 0.15)));
  const zoom = walk ? lerp(2.2, 1.25, easeOut(prog(t, T.youWalk - 0.05, T.youWalk + 0.45))) + 0.04 * (t - T.youWalk) : zoomLay + 0.03 * (t - a);
  const cam = streetCam(zoom);

  const tipZ = lerp(youZ, endZ, layE);
  const bills: Bill3D[] = [];
  const step = BL * 0.97;
  for (let k = 0; ; k++) {
    const z = youZ - 0.6 - k * step;
    if (z < tipZ || k > 140) break;
    const r = rng(500 + k);
    const fromTip = (z - tipZ) / step;
    const fl = t < lay1 + 0.1 && fromTip < 2.5 ? (1 - fromTip / 2.5) : 0;
    bills.push({x: (r() - 0.5) * 0.08, y: fl * 0.5, z, ry: (r() - 0.5) * 0.12, rx: fl * Math.PI * 0.9, s: STREET_BILL});
  }
  if (walk) {
    // the walk shot sees the finished road from close by
    for (let k = 0; k < 6; k++) bills.push({x: 0, y: 0, z: youZ + 0.6 + k * step, ry: (rng(700 + k)() - 0.5) * 0.12, s: STREET_BILL});
  }

  // the wallet guy stands on the road; he is left behind once the camera zooms away
  const feet = project(cam, [0, 0, youZ]);
  const youH = 1.75 * feet.scale * 1.05;
  const popS = pop(t, T.youPop, 0.38);
  const [sx, sy] = squash(t, T.youPop + 0.2, 0.14);
  const shock = t > T.youCash && t < T.youCash + 0.5 ? Math.sin((t - T.youCash) * 70) * 5 * (1 - (t - T.youCash) / 0.5) : 0;
  const leave = prog(t, lay0 + 0.25, lay0 + 0.7);

  // the walk: he walks toward the camera along the road
  const wz = lerp(-8.5, -4.6, prog(t, T.youWalk, SC.you[1]));
  const wp = project(cam, [0, 0, wz]);
  const bob = Math.abs(Math.sin(t * Math.PI * 3.6)) * 14;
  const end = project(cam, [0.9, 0, endZ]);
  const speed = t > lay0 + 0.1 && t < lay1 ? 1 - lp : 0;

  return (
    <AbsoluteFill>
      <StreetBG t={t} zoom={zoom} blur={speed * 3} />
      <BillRoad3D bills={bills} cam={cam} />
      {!walk && end.visible ? <FinishFlag x={end.x} y={end.y} h={2.2 * end.scale} label={lp > 0.95 ? '1.56 KM' : undefined} /> : null}
      {!walk && popS > 0 && leave < 1 ? (
        <Sprite name="11_you_wallet" x={feet.x + shock} y={feet.y} h={youH * popS * breathe(t)} sx={sx} sy={sy} rot={sway(t, 1, 0.8)}
          opacity={1 - leave} filter={leave > 0 ? `blur(${leave * 10}px)` : undefined} />
      ) : null}
      {walk ? (
        <>
          <Sprite name="12_you_walk" x={wp.x} y={wp.y - bob} h={1.75 * wp.scale * 1.05} rot={Math.sin(t * Math.PI * 1.8) * 3} />
          <Stopwatch x={Math.min(wp.x + 270, 840)} y={wp.y - 1.75 * wp.scale * 0.78} s={pop(t, T.youWalk + 0.2, 0.35)} t={t} />
        </>
      ) : null}
      <SpeedLines t={t} intensity={speed * 1.2} radial cx={VP.x} cy={VP.y} />
    </AbsoluteFill>
  );
};
