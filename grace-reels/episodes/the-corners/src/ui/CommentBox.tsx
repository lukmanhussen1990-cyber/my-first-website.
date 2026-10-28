import React from 'react';
import {CREAM, GOLD, SERIF} from '../lib/theme';
import {E, SC} from '../lib/timeline';
import {clamp, easeOut, easeOutBack, noise1, rand, smooth} from '../lib/anim';

const FULL = `${E.ctaText} 🙏`;

export const CommentBox: React.FC<{t: number}> = ({t}) => {
  const tin = SC.S15.start + 0.35;
  if (t < tin || t > SC.S16.start + 0.4) return null;
  const k = easeOutBack(clamp((t - tin) / 0.45), 1.4);
  const out = smooth(clamp((t - SC.S16.start) / 0.35));
  const chars = Array.from(FULL);
  const n = Math.floor(clamp((t - E.typing.start) / (E.typing.end - E.typing.start)) * chars.length + 0.0001);
  const typed = chars.slice(0, n).join('');
  const caret = Math.floor(t * 2.2) % 2 === 0 || (t > E.typing.start && t < E.typing.end);
  const sent = clamp((t - E.hearts.start) / 0.25);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: 1 - out}}>
      <div style={{
        position: 'absolute', left: 150, top: 1130, width: 760, height: 104, borderRadius: 52, background: CREAM,
        boxShadow: `0 16px 40px rgba(0,0,0,0.45), 0 0 ${30 * sent}px rgba(242,181,68,${0.6 * sent})`,
        transform: `scale(${k * (1 + 0.03 * Math.sin(sent * Math.PI))})`, display: 'flex', alignItems: 'center', padding: '0 34px',
      }}>
        <div style={{width: 58, height: 58, borderRadius: 29, background: `radial-gradient(circle at 35% 35%, #F6CF7A, ${GOLD} 60%, #B97C1E)`, flex: 'none', position: 'relative', overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 19, top: 11, width: 20, height: 20, borderRadius: 10, background: '#FFF4DC'}} />
          <div style={{position: 'absolute', left: 9, top: 34, width: 40, height: 30, borderRadius: '20px 20px 4px 4px', background: '#FFF4DC'}} />
        </div>
        <div style={{marginLeft: 24, fontFamily: SERIF, fontWeight: 600, fontSize: 50, color: '#2B1E14', whiteSpace: 'nowrap'}}>
          {typed}
          <span style={{opacity: caret && n < chars.length ? 1 : 0, color: '#9A5B0C', fontWeight: 500}}>|</span>
          {n === 0 && <span style={{opacity: 0.45, fontStyle: 'italic', fontWeight: 500}}>Add a comment…</span>}
        </div>
      </div>
      {/* floating hearts */}
      {Array.from({length: 9}).map((_, i) => {
        const st = E.hearts.start + i * 0.12;
        const life = (t - st) / 1.6;
        if (life <= 0 || life >= 1) return null;
        const x = 820 - rand(3, i) * 120 + noise1(i + 4, t * 2) * 26;
        const y = 1130 - easeOut(life) * 420;
        const s = 0.7 + rand(5, i) * 0.6;
        const col = i % 3 === 0 ? GOLD : i % 3 === 1 ? '#E2685A' : '#F3A36B';
        return (
          <svg key={i} width={60} height={56} viewBox="0 0 60 56" style={{position: 'absolute', left: x, top: y, opacity: 1 - life, transform: `scale(${s * easeOutBack(clamp(life * 6), 2)})`}}>
            <path d="M30,52 C10,36 2,26 2,15 C2,7 9,2 16,2 C22,2 27,6 30,11 C33,6 38,2 44,2 C51,2 58,7 58,15 C58,26 50,36 30,52Z" fill={col} />
          </svg>
        );
      })}
    </div>
  );
};
