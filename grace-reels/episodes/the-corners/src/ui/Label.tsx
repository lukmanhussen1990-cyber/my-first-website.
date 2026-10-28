import React from 'react';
import {SANS} from '../lib/theme';
import {clamp, easeOutBack, smooth} from '../lib/anim';

/**
 * Near-black tag with white caps and a 2px leader line ending on `target` (screen px).
 * The tag sits at `at` (its centre). Callers pass a target that follows the character during camera moves.
 */
export const Label: React.FC<{text: string; at: {x: number; y: number}; target: {x: number; y: number}; t: number; tin: number; tout: number}> = ({
  text, at, target, t, tin, tout,
}) => {
  if (t < tin || t > tout) return null;
  const k = easeOutBack(clamp((t - tin) / 0.3), 1.6);
  const o = Math.min(clamp((t - tin) / 0.15), 1 - smooth(clamp((t - (tout - 0.25)) / 0.25)));
  const w = text.length * 16.5 + 40;
  const h = 46;
  // leader leaves from the tag edge nearest the target
  const ex = clamp(target.x, at.x - w / 2, at.x + w / 2);
  const ey = target.y > at.y ? at.y + h / 2 : at.y - h / 2;
  const lineK = clamp((t - tin - 0.1) / 0.25);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: o, pointerEvents: 'none'}}>
      <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={ex} y1={ey} x2={ex + (target.x - ex) * lineK} y2={ey + (target.y - ey) * lineK} stroke="#FFF7EA" strokeWidth={2} strokeOpacity={0.9} />
        <circle cx={target.x} cy={target.y} r={5 * lineK} fill="#FFF7EA" />
      </svg>
      <div style={{
        position: 'absolute', left: at.x - w / 2, top: at.y - h / 2, width: w, height: h, borderRadius: 6,
        background: 'rgba(20,18,16,0.9)', color: '#fff', fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.12em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${k})`, whiteSpace: 'nowrap',
        boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
      }}>{text}</div>
    </div>
  );
};
