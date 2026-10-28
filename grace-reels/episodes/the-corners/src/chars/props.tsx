import React from 'react';
import {OUTLINE} from '../lib/theme';
import {P, f, smoothClosed, smoothOpen} from './geom';

export type PropKind =
  | 'basket' | 'sickle' | 'staff' | 'stick' | 'harp' | 'bread' | 'breadHalf' | 'mealbox' | 'grain' | 'baby'
  | 'bundle' | 'openPalm' | 'sheaf';

const WHEAT = '#E9B949', WHEAT_S = '#C08A2C', BASKET = '#B98848', BASKET_S = '#8E6230';

export const GrainHead: React.FC<{x: number; y: number; a: number; s?: number; lw: number}> = ({x, y, a, s = 1, lw}) => (
  <g transform={`translate(${f(x)},${f(y)}) rotate(${f(a)}) scale(${s})`}>
    <path d="M0,0 L0,40" stroke={WHEAT_S} strokeWidth={lw * 0.7} />
    <path d={smoothClosed([[0, -26], [7, -14], [6, 2], [0, 8], [-6, 2], [-7, -14]])} fill={WHEAT} stroke={OUTLINE} strokeWidth={lw * 0.6} />
    <path d="M0,-24 L0,-36 M4,-16 L10,-26 M-4,-16 L-10,-26" stroke={WHEAT_S} strokeWidth={lw * 0.4} />
  </g>
);

export const Basket: React.FC<{fill?: number; lw: number; handle?: boolean}> = ({fill = 0, lw, handle = true}) => {
  const heads = Math.round(fill * 9);
  return (
    <g>
      {handle && <path d="M-40,40 Q0,-12 40,40" fill="none" stroke={BASKET_S} strokeWidth={lw * 1.6} strokeLinecap="round" />}
      {Array.from({length: heads}).map((_, i) => (
        <GrainHead key={i} x={-30 + (i / Math.max(1, heads - 1)) * 60} y={40 - fill * 10 - (i % 2) * 6} a={-30 + (i / Math.max(1, heads - 1)) * 60} s={0.9} lw={lw} />
      ))}
      <path d={smoothClosed([[-48, 38], [48, 38], [42, 74], [0, 84], [-42, 74]], 0.8)} fill={BASKET} stroke={OUTLINE} strokeWidth={lw} />
      <path d="M-44,52 Q0,60 44,52 M-40,66 Q0,74 40,66" fill="none" stroke={BASKET_S} strokeWidth={lw * 0.8} />
      {[-30, -15, 0, 15, 30].map((x) => (
        <path key={x} d={`M${x},40 L${x * 0.85},80`} stroke={BASKET_S} strokeWidth={lw * 0.5} />
      ))}
      <ellipse cx={0} cy={38} rx={48} ry={9} fill={fill > 0 ? WHEAT_S : BASKET_S} stroke={OUTLINE} strokeWidth={lw * 0.8} />
    </g>
  );
};

export const PropShape: React.FC<{kind: PropKind; fill?: number; t?: number; lw: number}> = ({kind, fill = 0, lw}) => {
  switch (kind) {
    case 'basket':
      return <Basket fill={fill} lw={lw} />;
    case 'sickle':
      return (
        <g>
          <path d="M-5,26 L-4,-14 L5,-14 L5,26 Z" fill="#7A5232" stroke={OUTLINE} strokeWidth={lw * 0.8} />
          <path d="M0,-14 C-4,-60 40,-84 72,-58 C48,-70 18,-58 10,-14 Z" fill="#C88A3E" stroke={OUTLINE} strokeWidth={lw * 0.8} strokeLinejoin="round" />
        </g>
      );
    case 'staff':
      return (
        <g>
          <path d="M-3,-120 L3,-120 L6,330 L-2,330 Z" fill="#8A5A30" stroke={OUTLINE} strokeWidth={lw * 0.8} />
          <path d="M0,-120 Q-4,-160 22,-166 Q44,-160 34,-136" fill="none" stroke="#8A5A30" strokeWidth={lw * 1.8} strokeLinecap="round" />
          <path d="M0,-120 Q-4,-160 22,-166 Q44,-160 34,-136" fill="none" stroke={OUTLINE} strokeWidth={lw * 0.5} strokeLinecap="round" opacity={0.6} />
        </g>
      );
    case 'stick':
      return <path d="M-3,-30 L4,-30 L10,300 L3,300 Z" fill="#7A5232" stroke={OUTLINE} strokeWidth={lw * 0.8} />;
    case 'harp':
      return (
        <g transform="translate(-10,-60)">
          <path d="M-30,80 Q-44,10 -26,-10 L-16,-6 Q-30,20 -18,70 L18,70 Q30,20 16,-6 L26,-10 Q44,10 30,80 Z" fill="#B07438" stroke={OUTLINE} strokeWidth={lw * 0.8} />
          <path d="M-24,4 L24,4" stroke="#7A4A20" strokeWidth={lw * 1.2} />
          {[-12, -4, 4, 12].map((x) => (
            <path key={x} d={`M${x},6 L${x},70`} stroke="#F3E2B8" strokeWidth={lw * 0.35} />
          ))}
        </g>
      );
    case 'bread':
      return (
        <g>
          <ellipse cx={0} cy={0} rx={34} ry={13} fill="#D49A52" stroke={OUTLINE} strokeWidth={lw * 0.8} />
          <path d="M-18,-3 Q-10,2 -2,-3 M4,-2 Q12,3 20,-2" fill="none" stroke="#9A6430" strokeWidth={lw * 0.5} />
        </g>
      );
    case 'breadHalf':
      return (
        <g>
          <path d="M0,-13 A34,13 0 0 0 0,13 L4,9 L0,4 L5,-1 L0,-6 L4,-10 Z" fill="#D49A52" stroke={OUTLINE} strokeWidth={lw * 0.8} transform="translate(14,0) scale(-1,1)" />
          <path d="M-18,0 L4,0" stroke="#F1D7A6" strokeWidth={lw * 0.6} />
        </g>
      );
    case 'mealbox':
      return (
        <g>
          <path d="M-30,-6 L30,-6 L26,40 L-26,40 Z" fill="#B88A5A" stroke={OUTLINE} strokeWidth={lw * 0.8} strokeLinejoin="round" />
          <path d="M-30,-6 L-20,-18 L20,-18 L30,-6" fill="#C89A68" stroke={OUTLINE} strokeWidth={lw * 0.8} strokeLinejoin="round" />
          <path d="M-10,-18 Q0,-36 10,-18" fill="none" stroke={OUTLINE} strokeWidth={lw * 0.8} />
          <path d="M-22,10 L22,10" stroke="#9A7046" strokeWidth={lw * 0.5} />
        </g>
      );
    case 'grain':
      return (
        <g>
          <GrainHead x={-6} y={-30} a={-18} s={0.8} lw={lw} />
          <GrainHead x={4} y={-34} a={6} s={0.85} lw={lw} />
          <GrainHead x={12} y={-26} a={26} s={0.75} lw={lw} />
        </g>
      );
    case 'sheaf':
      return (
        <g>
          {[-14, -6, 2, 10, 18].map((x, i) => (
            <GrainHead key={i} x={x} y={-70 - (i % 2) * 8} a={(x - 2) * 1.6} s={1} lw={lw} />
          ))}
          <path d="M-18,-40 L22,-40 L16,40 L-12,40 Z" fill={WHEAT_S} stroke={OUTLINE} strokeWidth={lw * 0.8} />
          <path d="M-16,-6 L20,-6" stroke="#8E6230" strokeWidth={lw * 1.4} />
        </g>
      );
    case 'baby':
      return (
        <g>
          <path d={smoothClosed([[-58, 6], [-44, -22], [10, -26], [52, -12], [58, 14], [20, 30], [-40, 28]] as P[])} fill="#E8C35A" stroke={OUTLINE} strokeWidth={lw} />
          <path d={smoothOpen([[-30, 10], [0, 18], [30, 12]] as P[])} fill="none" stroke="#C99E35" strokeWidth={lw * 0.7} />
          <circle cx={36} cy={-14} r={22} fill="#B98060" stroke={OUTLINE} strokeWidth={lw} />
          <path d="M28,-36 Q34,-44 40,-36" fill="none" stroke="#3A2418" strokeWidth={lw * 1.1} strokeLinecap="round" />
          <path d="M28,-16 Q31,-20 34,-16 M40,-16 Q43,-20 46,-16" fill="none" stroke="#24150E" strokeWidth={lw * 0.7} strokeLinecap="round" />
          <path d="M33,-6 Q38,-1 43,-6" fill="none" stroke="#4A1C12" strokeWidth={lw * 0.7} strokeLinecap="round" />
          <ellipse cx={30} cy={-8} rx={5} ry={3} fill="#E07A6A" opacity={0.35} />
        </g>
      );
    case 'bundle':
      return (
        <g>
          <path d={smoothClosed([[-34, -30], [26, -40], [40, 10], [10, 40], [-36, 24]] as P[])} fill="#A88A64" stroke={OUTLINE} strokeWidth={lw} />
          <path d="M20,-38 L36,-56 M26,-36 L44,-46" stroke="#7E6444" strokeWidth={lw} strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
};
