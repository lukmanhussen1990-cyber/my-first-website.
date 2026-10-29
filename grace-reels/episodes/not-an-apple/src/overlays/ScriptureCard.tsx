import {SANS, SERIF} from '../lib/fonts';
import {out, prog} from '../lib/anim';

// Cream KJV card. Quote uses *WORD* for deep-gold keyword caps. Anchored by its bottom edge (default y=1440).
export const ScriptureCard: React.FC<{t: number; t0: number; t1: number; quote: string; refText: string; bottom?: number; top?: number; size?: number; children?: React.ReactNode}> = ({
  t, t0, t1, quote, refText, bottom = 1440, top, size = 60, children,
}) => {
  const a = out(prog(t, t0, t0 + 0.4)) * (1 - prog(t, t1 - 0.3, t1));
  if (a <= 0) return null;
  const drift = prog(t, t0, t1);
  const parts = quote.split(/(\*[^*]+\*)/g);
  return (
    <div style={{position: 'absolute', left: 72, width: 888, ...(top !== undefined ? {top} : {bottom: 1920 - bottom}), opacity: a,
      transform: `translateY(${(1 - a) * 30 - drift * 12}px) scale(${1 + drift * 0.02})`, transformOrigin: '50% 100%',
      background: '#F3ECDF', borderRadius: 18, padding: '34px 44px 30px 52px', boxShadow: '0 18px 50px rgba(0,0,0,0.38)', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: '#9A5B0C'}} />
      <div style={{fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: size, lineHeight: 1.12, color: '#2B1D14'}}>
        {parts.map((p, i) => p.startsWith('*')
          ? <span key={i} style={{fontStyle: 'normal', fontWeight: 700, color: '#9A5B0C', letterSpacing: '0.02em'}}>{p.slice(1, -1).toUpperCase()}</span>
          : <span key={i}>{p}</span>)}
      </div>
      <div style={{marginTop: 18, fontFamily: SANS, fontWeight: 600, fontSize: 20, letterSpacing: '0.22em', color: '#7A4A12'}}>{refText}</div>
      {children}
    </div>
  );
};
