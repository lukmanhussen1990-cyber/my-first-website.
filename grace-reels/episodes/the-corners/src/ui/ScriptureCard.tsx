import React from 'react';
import {CREAM, DEEP_GOLD, SANS, SERIF} from '../lib/theme';
import {E, TL} from '../lib/timeline';
import {clamp, easeOut, noise1, smooth} from '../lib/anim';

// Exact BSB wording ("…" = part of the verse left out). *word* = deep-gold keyword.
// `spoken`: the voice clips that read this verse; `from`: index of the first card word that is spoken.
export type CardDef = {key: string; text: string; ref: string; spoken: number[]; from: number; cue: any; tag?: {text: string; at: number}};
export const CARDS: CardDef[] = [
  {key: 'lev199', text: '“When you reap the harvest of your land, you are not to reap to the very *EDGES* of your field…”', ref: 'LEVITICUS 19:9 · BSB', spoken: [4], from: 0, cue: E.lev199},
  {key: 'lev1910', text: '“…Leave them for the *POOR* and the foreigner. I am the LORD your God.”', ref: 'LEVITICUS 19:10 · BSB', spoken: [6], from: 0, cue: E.lev1910},
  {key: 'deut1511', text: '“For there will never cease to be poor in the land; that is why I am commanding you to *OPEN* *WIDE* *YOUR* *HAND*…”', ref: 'DEUTERONOMY 15:11 · BSB', spoken: [10], from: 19, cue: E.deut1511},
  {key: 'ruth22', text: '“Please let me go into the fields and *GLEAN* heads of grain…”', ref: 'RUTH 2:2 · BSB', spoken: [14], from: 0, cue: E.ruth22, tag: {text: 'GLEAN = PICK UP LEFTOVERS', at: E.gleanTag}},
  {key: 'cor89', text: '“For you know the grace of our Lord Jesus Christ, that though He was rich, yet for your sakes He *BECAME* *POOR*…”', ref: '2 CORINTHIANS 8:9 · BSB', spoken: [21], from: 11, cue: E.cor89},
  {key: 'matt2540', text: '“And the King will reply, ‘Truly I tell you, whatever you did for one of the least of these brothers of Mine, *YOU* *DID* *FOR* *ME*.’”', ref: 'MATTHEW 25:40 · BSB', spoken: [23, 24], from: 9, cue: E.matt2540},
];

type CW = {text: string; kw: boolean; t: number | null};
const layout = (c: CardDef): CW[] => {
  const words = c.text.split(' ').map((w) => ({text: w.replace(/\*/g, ''), kw: w.includes('*'), t: null as number | null}));
  const spoken = TL.words.filter((w) => c.spoken.includes(w.segment));
  spoken.forEach((sw, i) => {
    if (words[c.from + i]) words[c.from + i].t = sw.start;
  });
  return words;
};
const LAYOUTS = Object.fromEntries(CARDS.map((c) => [c.key, layout(c)]));

export const ScriptureCard: React.FC<{card: CardDef; t: number; top?: number}> = ({card, t, top = 730}) => {
  const {in: tin, out: tout} = card.cue;
  if (t < tin - 0.05 || t > tout + 0.05) return null;
  const words = LAYOUTS[card.key];
  const firstSpoken = words.find((w) => w.t !== null)?.t ?? tin;
  const lastSpoken = [...words].reverse().find((w) => w.t !== null)?.t ?? tin;
  const enter = easeOut(clamp((t - tin) / 0.45));
  const exit = smooth(clamp((t - (tout - 0.3)) / 0.3));
  const life = t - tin;
  // slow drift while holding
  const dy = (1 - enter) * 60 - exit * 30 - life * 3;
  const rot = noise1(card.key.length * 13, life * 0.25) * 0.5 + (1 - enter) * 1.5;
  return (
    <div style={{
      position: 'absolute', left: 92, width: 848, top: top + dy, opacity: enter * (1 - exit),
      transform: `rotate(${rot}deg) scale(${0.96 + 0.04 * enter})`, transformOrigin: '50% 50%',
    }}>
      <div style={{
        background: `linear-gradient(170deg, #F7F1E6 0%, ${CREAM} 55%, #E9DFCB 100%)`, borderRadius: 14, padding: '38px 46px 30px',
        boxShadow: '0 18px 40px rgba(30,14,4,0.45), 0 2px 0 rgba(255,255,255,0.6) inset', border: '1px solid rgba(154,91,12,0.18)',
      }}>
        <div style={{fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', fontWeight: 600, fontSize: 60, lineHeight: 1.12, color: '#3B2A1E', textAlign: 'center'}}>
          {words.map((w, i) => {
            // words before the spoken part show at once; spoken words light up as they are read; the rest after the reading
            let o: number;
            if (w.t !== null) o = 0.32 + 0.68 * easeOut(clamp((t - w.t + 0.08) / 0.22));
            else if (i < words.findIndex((x) => x.t !== null)) o = enter;
            else o = 0.32 + 0.68 * smooth(clamp((t - Math.max(lastSpoken + 0.3, firstSpoken)) / 0.5));
            const lit = w.kw && w.t !== null && t >= w.t;
            const pk = lit ? clamp((t - (w.t as number)) / 0.35) : 0;
            return (
              <span key={i} style={{
                display: 'inline-block', marginRight: '0.22em', opacity: o,
                transform: lit ? `scale(${1 + 0.1 * Math.sin(pk * Math.PI)})` : undefined,
                ...(w.kw ? {fontStyle: 'normal', fontWeight: 700, color: DEEP_GOLD, letterSpacing: '0.02em'} : null),
              }}>{w.text}</span>
            );
          })}
        </div>
        <div style={{marginTop: 18, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 21, letterSpacing: '0.22em', color: DEEP_GOLD, opacity: 0.9}}>
          {card.ref}
        </div>
        {card.tag && t >= card.tag.at && (
          <div style={{display: 'flex', justifyContent: 'center', marginTop: 16}}>
            <div style={{
              background: 'rgba(20,18,16,0.92)', color: '#fff', fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.12em',
              padding: '10px 18px', borderRadius: 6, transform: `scale(${easeOut(clamp((t - card.tag.at) / 0.25)) * (1 + 0.08 * Math.sin(clamp((t - card.tag.at) / 0.35) * Math.PI))})`,
            }}>{card.tag.text}</div>
          </div>
        )}
      </div>
    </div>
  );
};
void SERIF;
