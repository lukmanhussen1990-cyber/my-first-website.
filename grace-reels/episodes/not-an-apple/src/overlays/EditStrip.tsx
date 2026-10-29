import {SANS, SERIF} from '../lib/fonts';
import {out, prog, wobble} from '../lib/anim';

const RED = '#C0392B';

export type Insert = {word: string; at: number; cps?: number; pulseAt?: number[]};

// A cream paper strip holding a quote; an added word is typed in with a red caret and underline, like a document edit.
export const EditStrip: React.FC<{
  t: number; t0: number; t1: number; before: string; after: string; insert?: Insert;
  refText: string; tag: string; y: number; dim?: number; size?: number;
}> = ({t, t0, t1, before, after, insert, refText, tag, y, dim = 0, size = 58}) => {
  const a = out(prog(t, t0, t0 + 0.35)) * (1 - prog(t, t1 - 0.3, t1));
  if (a <= 0) return null;
  let typed = '';
  let gap = 0;
  let cursor = false;
  let done = false;
  let pulse = 0;
  if (insert) {
    const cps = insert.cps ?? 11;
    gap = out(prog(t, insert.at - 0.5, insert.at - 0.2));
    const n = Math.floor(Math.max(0, t - insert.at) * cps + (t >= insert.at ? 1 : 0));
    typed = insert.word.slice(0, Math.min(insert.word.length, n));
    done = typed.length === insert.word.length;
    cursor = gap > 0 && (!done || t - insert.at < insert.word.length / cps + 0.6) && Math.floor(t * 4) % 2 === 0;
    for (const p of insert.pulseAt ?? []) pulse = Math.max(pulse, Math.max(0, wobble(t - p, 2.4, 3.5)) + (t > p && t < p + 0.5 ? 0.2 : 0));
  }
  const underline = done ? out(prog(t, insert!.at + insert!.word.length / (insert!.cps ?? 11), insert!.at + insert!.word.length / (insert!.cps ?? 11) + 0.25)) : 0;
  return (
    <div style={{position: 'absolute', left: 72, top: y, width: 888, opacity: a * (1 - dim * 0.55), transform: `translateY(${(1 - a) * 24}px)`}}>
      <div style={{display: 'inline-block', marginBottom: 12, fontFamily: SANS, fontWeight: 600, fontSize: 20, letterSpacing: '0.2em', color: '#FFF8EC',
        background: 'rgba(20,18,16,0.88)', padding: '8px 14px', borderRadius: 8}}>{tag}</div>
      <div style={{position: 'relative', background: '#F3ECDF', borderRadius: 10, padding: '26px 30px 30px', boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
        fontFamily: SERIF, fontWeight: 700, fontSize: size, lineHeight: 1.08, letterSpacing: '0.02em', color: '#2B1D14', textTransform: 'uppercase'}}>
        <span>{before}</span>
        {insert && gap > 0 && (
          <span style={{position: 'relative', display: 'inline-block', marginLeft: `${0.25 * gap}em`, marginRight: typed ? '0.25em' : 0, minWidth: 6 * gap, color: RED,
            transform: `scale(${1 + pulse * 0.25})`, transformOrigin: '50% 80%', textShadow: pulse > 0 ? `0 0 ${24 * pulse}px rgba(192,57,43,0.6)` : 'none'}}>
            {typed}
            {cursor && <span style={{position: 'absolute', right: -6, top: '8%', width: 5, height: '82%', background: RED}} />}
            <span style={{position: 'absolute', left: '50%', bottom: -40, transform: 'translateX(-50%)', fontFamily: SANS, fontWeight: 700, fontSize: 34, color: RED, opacity: gap}}>^</span>
            <span style={{position: 'absolute', left: 0, bottom: -2, height: 5, width: `${underline * 100}%`, background: RED, borderRadius: 3}} />
          </span>
        )}
        <span>{insert && gap > 0 ? '' : ' '}{after}</span>
        <div style={{position: 'absolute', right: 22, bottom: -34, fontFamily: SANS, fontWeight: 600, fontSize: 20, letterSpacing: '0.22em', color: 'rgba(255,248,236,0.85)'}}>{refText}</div>
      </div>
    </div>
  );
};
