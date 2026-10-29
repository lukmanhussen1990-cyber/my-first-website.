import {SANS} from '../lib/fonts';
import {out, prog} from '../lib/anim';

// Near-black tag with a 2 px leader line ending in a dot on the anchor (which can follow a character).
export const Label: React.FC<{t: number; t0: number; t1: number; x: number; y: number; ax?: number; ay?: number; text: string; align?: 'left' | 'right' | 'center'}> = ({
  t, t0, t1, x, y, ax, ay, text, align = 'left',
}) => {
  const a = out(prog(t, t0, t0 + 0.3)) * (1 - prog(t, t1 - 0.25, t1));
  if (a <= 0) return null;
  const line = prog(t, t0 + 0.1, t0 + 0.45);
  const tx = align === 'left' ? '0%' : align === 'right' ? '-100%' : '-50%';
  return (
    <>
      {ax !== undefined && ay !== undefined && (
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: a}}>
          <line x1={x} y1={y + 22} x2={x + (ax - x) * line} y2={y + 22 + (ay - y - 22) * line} stroke="rgba(255,248,236,0.9)" strokeWidth={2} />
          <circle cx={ax} cy={ay} r={5 * line} fill="#FFF8EC" />
        </svg>
      )}
      <div style={{position: 'absolute', left: x, top: y, transform: `translateX(${tx}) scale(${0.92 + 0.08 * a})`, transformOrigin: 'left center', opacity: a,
        background: 'rgba(20,18,16,0.9)', color: '#FFF8EC', fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.12em',
        padding: '10px 18px', borderRadius: 10, whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(0,0,0,0.3)'}}>
        {text}
      </div>
    </>
  );
};
