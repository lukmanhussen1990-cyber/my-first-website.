import React from 'react';
import {GOLD} from '../lib/theme';
import {clamp} from '../lib/anim';

/**
 * Grace In Motion mark: an open ring (motion) around a simple cross, with a small spark at the gap.
 * `draw` 0→1 animates it drawing itself.
 */
export const Logo: React.FC<{size: number; draw?: number; color?: string; glow?: number}> = ({size, draw = 1, color = GOLD, glow = 0}) => {
  const ringLen = 2 * Math.PI * 40 * 0.82;
  const r = clamp(draw / 0.6);
  const c = clamp((draw - 0.45) / 0.4);
  const s = clamp((draw - 0.85) / 0.15);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${glow}px ${color})` : undefined}}>
      <circle cx={50} cy={50} r={40} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={`${ringLen * r} 999`} transform="rotate(-50 50 50)" />
      <path d="M50,24 L50,78" stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${54 * c} 99`} />
      <path d="M35,42 L65,42" stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${30 * c} 99`} />
      <circle cx={50 + 40 * Math.cos((-55 * Math.PI) / 180)} cy={50 + 40 * Math.sin((-55 * Math.PI) / 180)} r={6 * s} fill={color} />
    </svg>
  );
};
