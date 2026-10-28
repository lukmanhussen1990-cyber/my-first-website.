import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BigHand} from '../chars/BigHand';
import {Basket} from '../chars/props';
import {Person, handPoint} from '../chars/Person';
import * as C from '../chars/cast';
import {OUTLINE} from '../lib/theme';
import {E, SC} from '../lib/timeline';
import {blink, clamp, easeInOut, easeOut, easeOutBack, handheld, lerp, noise1, rand, smooth} from '../lib/anim';
import {Beam, Bokeh, Dust, GrainFall, Layer} from './kit';

// The open hand sits at the same place in S4 and S14 so the two shots match-cut.
export const HAND_AT = {x: 380, y: 1150, s: 1.35};

// ------------------------------------------------------------------ S4: "Open wide your hand"
export const S4Hand: React.FC<{t: number}> = ({t}) => {
  const sq = smooth(clamp((t - E.fistSqueeze) / 0.2)) * (1 - smooth(clamp((t - E.handOpen) / 0.12)));
  const ok = clamp((t - E.handOpen) / 0.4);
  const open = ok <= 0 ? 0 : easeOutBack(ok, 2.2);
  const tilt = lerp(-4, 13, easeInOut(clamp((t - E.handOpen - 0.1) / 0.5)));
  const zoom = lerp(1, 1.07, easeInOut(clamp((t - SC.S4.start) / (SC.S4.end - SC.S4.start))));
  const hh = handheld(4, t, 5);
  const fill = clamp((t - E.pour.start - 0.3) / (E.pour.end - E.pour.start)) * 1.0;
  const tipX = HAND_AT.x + 245 * HAND_AT.s * Math.cos((tilt * Math.PI) / 180);
  const tipY = HAND_AT.y + 245 * HAND_AT.s * Math.sin((tilt * Math.PI) / 180) - 20;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #F0B866 0%, #D99347 45%, #A9652C 100%)'}}>
      <Layer cam={{x: hh.x, y: hh.y, zoom, rot: hh.r}} depth={0.4}>
        <Bokeh t={t} seed={41} n={30} />
        <Beam id="s4beam" x={160} y={-100} w0={160} w1={620} len={2000} angle={-14} opacity={0.4} />
      </Layer>
      <Layer cam={{x: hh.x, y: hh.y, zoom, rot: hh.r}} depth={1}>
        <g transform={`translate(${tipX + 6} 1250) scale(2.3)`}>
          <Basket fill={fill} lw={3} handle={false} />
        </g>
        <GrainFall t={t} t0={E.pour.start} t1={E.pour.end - 0.25} from={[tipX, tipY]} to={[tipX + 6, 1338]} n={70} seed={44} spread={46} size={8} />
        <g transform={`translate(${HAND_AT.x} ${HAND_AT.y + sq * 10}) rotate(${tilt}) scale(${HAND_AT.s * (1 - sq * 0.035)})`}>
          <BigHand open={open} skin="#B47A52" skinShade="#93603F" sleeve="#E2D3B0" sleeveShade="#C2B08A" grains lw={5.5} />
        </g>
        <Dust t={t} n={26} seed={45} area={[0, 700, 1080, 1700]} size={5} opacity={0.7} />
      </Layer>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ S14: open hands today (match cut → city street)
const City: React.FC<{t: number}> = ({t}) => {
  const lamps = [170, 560, 950];
  return (
    <g>
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B3863" />
          <stop offset="0.45" stopColor="#8E5D6E" />
          <stop offset="0.7" stopColor="#E08A5A" />
          <stop offset="0.82" stopColor="#F4AE62" />
        </linearGradient>
        <radialGradient id="lampglow">
          <stop offset="0" stopColor="#FFD88A" stopOpacity={0.9} />
          <stop offset="1" stopColor="#FFB050" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={-400} y={-200} width={1880} height={1500} fill="url(#dusk)" />
      {/* far skyline */}
      {Array.from({length: 14}).map((_, i) => {
        const x = -300 + i * 130, h = 260 + rand(140, i) * 340;
        return <rect key={i} x={x} y={1150 - h} width={124} height={h} fill={i % 2 ? '#4A3A52' : '#54405A'} opacity={0.9} />;
      })}
      {/* street buildings with warm windows */}
      {[{x: -320, w: 520, h: 760, c: '#6A4A4E'}, {x: 200, w: 420, h: 640, c: '#5E4648'}, {x: 620, w: 560, h: 820, c: '#6E5050'}].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={1380 - b.h} width={b.w} height={b.h} fill={b.c} stroke={OUTLINE} strokeWidth={5} />
          {Array.from({length: Math.floor(b.w / 110) * Math.floor((b.h - 220) / 150)}).map((_, k) => {
            const cols = Math.floor(b.w / 110);
            const cx = b.x + 40 + (k % cols) * 110, cy = 1380 - b.h + 60 + Math.floor(k / cols) * 150;
            const on = rand(150 + i, k) > 0.3;
            const flick = on ? 0.85 + 0.15 * noise1(150 + i * 10 + k, t * 0.5) : 0.25;
            return <rect key={k} x={cx} y={cy} width={60} height={84} rx={4} fill={on ? '#FFC979' : '#3A2C34'} opacity={flick} stroke={OUTLINE} strokeWidth={3} />;
          })}
        </g>
      ))}
      {/* café awning + shop window glow at street level */}
      <rect x={640} y={1180} width={420} height={200} fill="#FFCF86" opacity={0.85} stroke={OUTLINE} strokeWidth={5} />
      <path d="M620,1180 L1080,1180 L1060,1120 L640,1120 Z" fill="#B5503C" stroke={OUTLINE} strokeWidth={5} />
      {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${640 + i * 70},1120 L${640 + i * 70 + 35},1180`} stroke="#E9C9A0" strokeWidth={14} opacity={0.6} />)}
      {/* brick wall where the man sits */}
      <rect x={-60} y={1180} width={700} height={200} fill="#8E5E48" stroke={OUTLINE} strokeWidth={5} />
      {Array.from({length: 24}).map((_, i) => <path key={i} d={`M${-60 + (i % 8) * 90 + (Math.floor(i / 8) % 2) * 45},${1200 + Math.floor(i / 8) * 60} h80`} stroke="#6E4434" strokeWidth={4} />)}
      {/* sidewalk + street */}
      <rect x={-400} y={1380} width={1880} height={300} fill="#8C7B6C" stroke={OUTLINE} strokeWidth={5} />
      <rect x={-400} y={1560} width={1880} height={500} fill="#4E4652" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={-300 + i * 420} y={1640} width={200} height={14} fill="#E8D8B0" opacity={0.6} />)}
      {/* street lamps */}
      {lamps.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={920} r={150} fill="url(#lampglow)" opacity={0.7 + 0.1 * Math.sin(t * 3 + i)} />
          <rect x={x - 7} y={930} width={14} height={460} fill="#2E2830" stroke={OUTLINE} strokeWidth={3} />
          <path d={`M${x - 26},930 L${x + 26},930 L${x + 16},900 L${x - 16},900 Z`} fill="#FFE2A6" stroke={OUTLINE} strokeWidth={4} />
        </g>
      ))}
      {/* distant car lights */}
      {Array.from({length: 6}).map((_, i) => (
        <circle key={i} cx={((i * 260 + t * 120 * (i % 2 ? 1 : -1)) % 1600 + 1600) % 1600 - 260} cy={1600 + (i % 2) * 30} r={14} fill={i % 2 ? '#FFE3A0' : '#FF7A5A'} opacity={0.6} />
      ))}
    </g>
  );
};

export const S14City: React.FC<{t: number}> = ({t}) => {
  const rv = E.reveal;
  const k = easeInOut(clamp((t - rv.start) / (rv.end - rv.start)));
  const zoom = lerp(1.45, 1, k);
  const closeO = 1 - smooth(clamp((t - rv.start) / 0.45));
  const hand = smooth(clamp((t - E.handoff + 0.1) / 0.55));
  const smile = smooth(clamp((t - E.smile) / 0.4));
  const helperPose = {...C.CROUCH, shF: lerp(58, 72, hand), elF: lerp(18, 6, hand)};
  const manPose = {...C.CROSS, shF: lerp(26, 56, hand), elF: lerp(70, 36, hand)};
  const helperAt = {x: 720, y: 1450, scale: 1.0, flip: true};
  const manAt = {x: 330, y: 1450, scale: 0.95};
  const hp = handPoint(helperPose, helperAt), mp = handPoint(manPose, manAt);
  const given = smooth(clamp((t - E.handoff - 0.15) / 0.4));
  const boxX = lerp(hp[0], mp[0], given), boxY = lerp(hp[1], mp[1], given) - 22;
  const hh = handheld(14, t, 3);
  const cam = {x: hh.x + 60 * (1 - k), y: hh.y + 140 * (1 - k), zoom};
  return (
    <AbsoluteFill style={{background: '#2C2236'}}>
      <Layer cam={{...cam, zoom: 1 + (zoom - 1) * 0.5}} depth={0.6}>
        <City t={t} />
      </Layer>
      <Layer cam={cam} depth={1}>
        <ellipse cx={520} cy={1452} rx={380} ry={44} fill="rgba(255,190,110,0.25)" />
        <g transform="translate(170 1450)">
          <path d="M-50,0 L-46,-90 Q-30,-112 -2,-104 L4,0 Z" fill="#5A4A3A" stroke={OUTLINE} strokeWidth={5} />
        </g>
        <Person look={C.IN_NEED} pose={manPose} t={t} seed={141} x={manAt.x} y={manAt.y} scale={manAt.scale}
          face={{brow: smile > 0.5 ? 'happy' : hand > 0.4 ? 'raised' : 'worried', mouth: smile > 0.5 ? 'bigSmile' : hand > 0.4 ? 'o' : 'soft', eyeStyle: smile > 0.6 ? 'happy' : 'normal', eyes: blink(141, t), lookX: 1}} />
        <Person look={C.HELPER} pose={helperPose} flip t={t} seed={142} x={helperAt.x} y={helperAt.y} scale={helperAt.scale}
          face={{brow: 'kind', mouth: smile > 0.5 ? 'bigSmile' : 'smile', eyes: blink(142, t), lookX: 1}} />
        <g transform={`translate(${boxX} ${boxY}) scale(1.25)`}>
          <path d="M-30,-6 L30,-6 L26,40 L-26,40 Z" fill="#B88A5A" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-30,-6 L-20,-18 L20,-18 L30,-6" fill="#C89A68" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-10,-18 Q0,-36 10,-18" fill="none" stroke={OUTLINE} strokeWidth={4} />
        </g>
        <Dust t={t} n={24} seed={143} area={[0, 900, 1080, 1500]} size={4} opacity={0.5} color="#FFD9A0" />
      </Layer>
      {/* match cut: the same open hand as S4, now in a hoodie sleeve, on dusk light */}
      {closeO > 0.01 && (
        <AbsoluteFill style={{opacity: closeO}}>
          <AbsoluteFill style={{background: 'linear-gradient(180deg, #5A4470 0%, #B0687A 50%, #E89A62 100%)'}} />
          <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', left: 0, top: 0}}>
            <Bokeh t={t} seed={144} n={26} />
            <g transform={`translate(${HAND_AT.x} ${HAND_AT.y}) rotate(13) scale(${HAND_AT.s})`}>
              <BigHand open={1} skin="#8A5A3C" skinShade="#6E462E" sleeve="#D9A23A" sleeveShade="#B5822A" lw={5.5} />
            </g>
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
void easeOut;
