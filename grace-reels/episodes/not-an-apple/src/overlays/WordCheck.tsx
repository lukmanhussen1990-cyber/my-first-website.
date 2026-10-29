import {cues} from '../lib/time';
import {SANS} from '../lib/fonts';
import {out, prog, spring, wobble} from '../lib/anim';

const RED = '#C0392B';
const GOLD = '#F2B544';
const SLOTS = [
  {at: 'slot1', who: 'SNAKE:', what: '+ NOT', color: RED},
  {at: 'slot2', who: 'EVE:', what: '+ TOUCH', color: RED},
  {at: 'slot3', who: 'JESUS:', what: 'IT IS WRITTEN', color: GOLD},
];

// Retention tracker under the captions: three locked "?" slots that unlock as the story reveals each word.
export const WordCheck: React.FC<{t: number; y?: number; scale?: number; glow?: number; opacity?: number}> = ({t, y = 650, scale = 1, glow = 0, opacity = 1}) => {
  const appear = out(prog(t, cues.panelIn, cues.panelIn + 0.45));
  if (appear <= 0 || opacity <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 72, top: y, transformOrigin: '0 0', transform: `translateX(${(1 - appear) * -40}px) scale(${scale})`, opacity: appear * opacity,
      padding: '14px 18px 16px', borderRadius: 20, background: 'rgba(18,14,10,0.78)', border: `1.5px solid rgba(242,181,68,${0.28 + glow * 0.5})`,
      boxShadow: `0 8px 30px rgba(0,0,0,0.35), 0 0 ${40 * glow}px rgba(242,181,68,${0.45 * glow})`}}>
      <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 18, letterSpacing: '0.2em', color: 'rgba(255,248,236,0.7)', marginBottom: 10}}>WORD CHECK</div>
      <div style={{display: 'flex', gap: 12}}>
        {SLOTS.map((s, i) => {
          const tu = cues[s.at];
          const open = t >= tu;
          const k = spring(t - tu, 3.4, 0.38);
          const squash = open ? 1 + wobble(t - tu, 3.2, 6) * 0.22 : 1;
          const urgent = i === 2 && t > cues.desert ? 2.6 : 1;
          const pulse = 1 + 0.12 * Math.max(0, Math.sin(t * Math.PI * 1.6 * urgent + i));
          const burst = i === 2 ? prog(t, tu, tu + 0.7) : 0;
          return (
            <div key={i} style={{position: 'relative', minWidth: open ? undefined : 74, height: 46, borderRadius: 12, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${squash}, ${open ? 2 - squash : 1})`,
              background: open ? (i === 2 ? `linear-gradient(135deg, #F7CB6A, ${GOLD} 55%, #D6952A)` : s.color) : 'rgba(255,255,255,0.06)',
              border: open ? 'none' : '1.5px dashed rgba(242,181,68,0.45)',
              fontFamily: SANS, fontWeight: 700, fontSize: 24, letterSpacing: '0.04em', color: open ? (i === 2 ? '#2A1A08' : '#FFF8EC') : GOLD,
              boxShadow: open ? `0 0 ${18 + glow * 20}px ${i === 2 ? 'rgba(242,181,68,0.7)' : 'rgba(192,57,43,0.55)'}` : 'none', whiteSpace: 'nowrap'}}>
              {open ? (
                <span style={{opacity: k, display: 'inline-block', transform: `translateY(${(1 - k) * 10}px)`}}>
                  <span style={{fontWeight: 600, opacity: 0.85}}>{s.who}</span> {s.what}
                </span>
              ) : (
                <span style={{display: 'inline-block', transform: `scale(${pulse})`, opacity: 0.6 + 0.4 * (pulse - 1) / 0.12}}>?</span>
              )}
              {burst > 0 && burst < 1 && (
                <svg width={240} height={240} style={{position: 'absolute', left: '50%', top: '50%', marginLeft: -120, marginTop: -120, pointerEvents: 'none', overflow: 'visible'}}>
                  {Array.from({length: 12}, (_, r) => {
                    const a = (r / 12) * Math.PI * 2;
                    const r0 = 30 + burst * 60, r1 = 44 + burst * 110;
                    return <line key={r} x1={120 + Math.cos(a) * r0} y1={120 + Math.sin(a) * r0} x2={120 + Math.cos(a) * r1} y2={120 + Math.sin(a) * r1} stroke={GOLD} strokeWidth={4} strokeLinecap="round" opacity={1 - burst} />;
                  })}
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
