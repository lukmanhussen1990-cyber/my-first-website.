import {timeline} from '../lib/time';
import {SERIF} from '../lib/fonts';
import {clamp, prog} from '../lib/anim';

const GOLD = '#F2B544';

// Word-by-word captions: each word fades and rises on its timestamp, the next word ghosts in 150 ms early,
// keywords are gold bold caps with a small pop. One caption block at a time, never more than 3 lines.
export const Captions: React.FC<{t: number; opacity?: number; scrim?: number}> = ({t, opacity = 1, scrim = 1}) => {
  const {blocks, words} = timeline;
  let bi = -1;
  for (let i = 0; i < blocks.length; i++) if (t >= words[blocks[i].first].start - 0.18) bi = i;
  if (bi < 0) return null;
  const b = blocks[bi];
  const next = blocks[bi + 1];
  const nextStart = next ? words[next.first].start - 0.18 : Infinity;
  const fadeOut = 1 - prog(t, Math.min(nextStart - 0.12, b.end + 3.2), Math.min(nextStart, b.end + 3.6));
  const blockIn = prog(t, words[b.first].start - 0.18, words[b.first].start);
  const op = opacity * fadeOut;
  if (op <= 0.001) return null;
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 170, height: 470, opacity: op * scrim,
        background: 'linear-gradient(to bottom, rgba(14,10,6,0) 0%, rgba(14,10,6,0.46) 24%, rgba(14,10,6,0.46) 66%, rgba(14,10,6,0) 100%)'}} />
      <div style={{position: 'absolute', left: 72, top: 250, width: 888, opacity: op, transform: `translateY(${(1 - blockIn) * 8}px)`,
        fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 66, lineHeight: 1.15, color: '#FFF8EC',
        textShadow: '0 2px 14px rgba(0,0,0,0.55)'}}>
        {words.slice(b.first, b.last + 1).map((w) => {
          const ghost = t >= w.start - 0.15 && t < w.start ? 0.25 : 0;
          const k = prog(t, w.start, w.start + 0.16);
          const o = Math.max(ghost, k);
          const rise = (1 - clamp(k)) * 16;
          return (
            <span key={w.i} style={{display: 'inline-block', marginRight: '0.24em', opacity: o, transform: `translateY(${rise}px) scale(${w.kw ? lerpPop(t, w.start) : 1})`, transformOrigin: '50% 70%',
              ...(w.kw ? {fontStyle: 'normal', fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.02em', textShadow: '0 0 18px rgba(242,181,68,0.45), 0 2px 12px rgba(0,0,0,0.5)'} : {})}}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </>
  );
};

// keyword pop: 1 -> 1.14 -> 1 over ~0.3 s
const lerpPop = (t: number, s: number) => {
  const k = prog(t, s, s + 0.3);
  return 1 + Math.sin(k * Math.PI) * 0.14 * (1 - k * 0.3);
};
