import {AbsoluteFill} from 'remotion';
import {noise1} from '../lib/random';

// Warm light leak + soft shafts radiating from the sun's screen position (screen blend, no WebGL cost).
export const SunGlow: React.FC<{x: number; y: number; t: number; strength?: number; color?: string; rays?: number}> = ({
  x, y, t, strength = 1, color = '255, 214, 140', rays = 7,
}) => (
  <AbsoluteFill style={{mixBlendMode: 'screen', pointerEvents: 'none'}}>
    <AbsoluteFill style={{background: `radial-gradient(circle at ${x}px ${y}px, rgba(${color}, ${0.75 * strength}) 0px, rgba(${color}, ${0.32 * strength}) 260px, rgba(${color}, ${0.1 * strength}) 760px, rgba(${color}, 0) 1400px)`}} />
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, filter: 'blur(18px)'}}>
      {Array.from({length: rays}, (_, i) => {
        const a = 0.35 + (i / rays) * 1.7 + noise1(t * 0.15 + i, 7) * 0.06;
        const w = 0.05 + (i % 3) * 0.025;
        const L = 2600;
        const p1 = [x + Math.cos(a - w) * L, y + Math.sin(a - w) * L];
        const p2 = [x + Math.cos(a + w) * L, y + Math.sin(a + w) * L];
        const o = (0.13 + 0.07 * Math.sin(t * 0.6 + i * 1.7)) * strength;
        return (
          <g key={i}>
            <defs>
              <linearGradient id={`ray${i}`} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={x + Math.cos(a) * 1600} y2={y + Math.sin(a) * 1600}>
                <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={o * 2.2} />
                <stop offset="1" stopColor={`rgb(${color})`} stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon points={`${x},${y} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill={`url(#ray${i})`} />
          </g>
        );
      })}
    </svg>
  </AbsoluteFill>
);
