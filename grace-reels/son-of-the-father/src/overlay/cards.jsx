// Floating parchment verse cards (KJV, exact text) with karaoke: words warm from ghost to ink as they
// are spoken (timed from plan.words of the beat), gold words land as antique-gold serif caps with a pop and
// a hand-drawn gold underline that draws along the run as it is spoken. Our own card design: warm parchment
// with fibre texture, a finely deckled edge, gold top + bottom rules with a diamond ornament, soft long +
// contact shadows, slight 3D tilt and float, a glint when it lands. The scene behind darkens slightly.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { SERIF, SANS, ease, pop, clamp, lerp, mixHex, layoutBalanced, popFit, measure, paperURL, deckle } from './theme.js';

const E = plan.ev;
const shot = (id) => plan.shots.find((s) => s.id === id);
const clean = (s) => s.replace(/[^A-Za-z0-9']/g, '').toUpperCase();

// floating verse cards (the Matthew 27:26 card is full-screen: fullcard.jsx)
export const CARDS = [
  { id: 'm2721', beat: 'B07', ref: 'MATTHEW 27:21 · KJV', text: '…Whether of the twain will ye that I *release* unto you?', t0: E.card2721, t1: E.card2721Out, seed: 5 },
  { id: 'p318', beat: 'B16', ref: '1 PETER 3:18 · KJV', text: 'For Christ also hath once suffered for sins, the *just* for the *unjust*, that he might bring us to God.', t0: E.card318, t1: Math.min(E.card318Out, shot('S14a').t0 + 0.02), seed: 9 },
];

// tokens { text (gold or ink part), tail (ink punctuation after a gold word, closing quote), gold } +
// spoken times (LCS alignment of card words to the timeline words of the beat)
export function prepare(card) {
  const toks = []; let gold = false;
  for (const raw of card.text.split(' ')) {
    let body = '', tail = '', g = false;
    for (const ch of raw) {
      if (ch === '*') { gold = !gold; continue; }
      if (gold) { body += ch; if (/[A-Za-z]/.test(ch)) g = true; }
      else if (g) tail += ch;                    // punctuation after the gold run ends stays ink ("PERISH" + ",")
      else body += ch;
    }
    toks.push({ text: g ? body.toUpperCase() : body, tail, gold: g, key: clean(body + tail) });
  }
  // the verse is a quotation: typographic quotes around it (the closing quote is always ink)
  toks[0].text = '“' + toks[0].text; toks[toks.length - 1].tail += '”';
  const W = plan.words.filter((w) => w.beat === card.beat);
  const n = toks.length, m = W.length;
  const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) D[i][j] = toks[i].key === clean(W[j].w) ? 1 + D[i + 1][j + 1] : Math.max(D[i + 1][j], D[i][j + 1]);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (toks[i].key === clean(W[j].w)) { toks[i].start = W[j].start; toks[i].end = W[j].end; i++; j++; }
    else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++;
  }
  // unmatched words take the previous matched time (or the next one)
  for (let k = 0; k < n; k++) if (toks[k].start == null) {
    const p = toks.slice(0, k).reverse().find((x) => x.start != null), q = toks.slice(k + 1).find((x) => x.start != null);
    const s = p ? p.start : q ? q.start : card.t0; toks[k].start = s; toks[k].end = s + 0.2;
  }
  return toks;
}
CARDS.forEach((c) => { c.toks = prepare(c); });

const CW = 920, CX = 80, CTOP = 380, PADX = 90, FS = 62, LH = 78, GS = 0.9, GLS = 0.035;
const TW = CW - 2 * PADX;
const PAPER = '#efe2c2', INK = '#2b1a0e', CUR = '#3d2412', GOLD = '#87500a';
const GHOST = mixHex(INK, PAPER, 0.58), GHOST_G = mixHex(GOLD, PAPER, 0.52);
const fontOf = (w) => (w.gold ? `700 ${Math.round(FS * GS)}px ${SERIF}` : `italic 600 ${FS}px ${SERIF}`);

export const cardAt = (t) => CARDS.find((c) => t >= c.t0 - 0.05 && t < c.t1 + 0.05) || null;

export const VerseCards = ({ t, frame }) => <>{CARDS.map((c) => (t >= c.t0 - 0.05 && t < c.t1 + 0.05 ? <Card key={c.id} c={c} t={t} frame={frame} /> : null))}</>;

function Card({ c, t }) {
  const inU = (t - c.t0) / 0.62, outU = clamp((t - (c.t1 - 0.28)) / 0.28);
  const o = clamp((t - c.t0) / 0.22) * (1 - ease.in(outU));
  if (o <= 0.001) return null;
  const inK = ease.back(inU, 1.25), inE = ease.out(inU);
  const lay = layoutBalanced(c.toks.map((w, i) => ({ glue: w.gold && i > 0 && c.toks[i - 1].gold, text: w.text + w.tail, font: fontOf(w), extra: w.gold ? w.text.length * FS * GS * GLS : 0 })),
    { maxW: TW, lineH: LH, align: 'center', space: FS * 0.25 });
  const textTop = 40 + 26 + 22, h = textTop + lay.height + 40 + 24 + 46;
  const floatY = 5 * Math.sin(t * 1.15 + c.seed), rz = -0.15 + 0.25 * Math.sin(t * 0.62 + c.seed);
  const rx = lerp(18, 2.2, inE) - 10 * ease.in(outU) + 0.7 * Math.sin(t * 0.9), ry = -0.6 + 0.5 * Math.sin(t * 0.5 + 1);
  const y = (1 - inK) * 80 - 34 * ease.in(outU) + floatY;
  const glint = (t - c.t0 - 0.5) / 0.9;
  // gold runs -> underline paths (they stop before ink punctuation)
  const runs = []; let run = null;
  lay.items.forEach((it, i) => {
    const w = c.toks[i];
    const gx1 = it.x + (w.tail ? measure(it.font, w.text) + w.text.length * FS * GS * GLS : it.w);
    if (w.gold && (!run || run.line !== it.line)) { run = { line: it.line, x0: it.x, x1: gx1, start: w.start, end: w.end }; runs.push(run); }
    else if (w.gold) { run.x1 = gx1; run.end = w.end; }
    else run = null;
    if (w.tail) run = null;
  });
  const cy = CTOP + h / 2;
  const ruleK = ease.out((t - c.t0 - 0.15) / 0.5);
  const isGold = (j) => !!c.toks[j].gold;
  return (
    <>
      {/* darken the scene slightly, centred on the card */}
      <div style={{ position: 'absolute', inset: 0, opacity: o, background: `radial-gradient(ellipse 85% 42% at 50% ${(cy / 1920 * 100).toFixed(1)}%, rgba(10,6,3,0.30) 0%, rgba(10,6,3,0.22) 55%, rgba(10,6,3,0.34) 100%)` }} />
      <div style={{ position: 'absolute', left: CX, top: CTOP, width: CW, height: h, opacity: o, perspective: 1500, perspectiveOrigin: '50% 30%' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${y}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${lerp(0.94, 1, inE)})`, transformOrigin: '50% 60%' }}>
          {/* long soft shadow + contact shadow */}
          <div style={{ position: 'absolute', left: 40, right: 40, top: 60, bottom: -36, borderRadius: 40, background: 'rgba(0,0,0,0.5)', filter: 'blur(32px)', transform: `translateY(${18 + 14 * (1 - inE)}px)` }} />
          <div style={{ position: 'absolute', left: 6, right: 6, top: 10, bottom: -5, borderRadius: 10, background: 'rgba(30,15,5,0.42)', filter: 'blur(6px)' }} />
          {/* paper: warm parchment, fibre texture, finely deckled edge */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', clipPath: deckle(c.seed, 56, 0.8), background: `linear-gradient(176deg, #f6ead0 0%, ${PAPER} 52%, #e6d3ad 100%)` }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${paperURL(1024, 480, c.seed)})`, backgroundSize: '100% 100%', mixBlendMode: 'multiply', opacity: 0.75 }} />
            {/* warm top light + aged edge */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 35% 0%, rgba(255,250,232,0.42) 0%, rgba(255,250,232,0) 70%)' }} />
            <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 46px rgba(160,105,40,0.26), inset 0 0 4px rgba(120,80,30,0.5)' }} />
            {/* gold top + bottom rules (draw out from the centre), diamond ornament on the top rule */}
            <Rule y={30} w={CW} k={ruleK} gap={30} />
            <Rule y={h - 30} w={CW} k={ruleK} gap={0} />
            <Ornament y={30} w={CW} k={ruleK} />
            {/* verse */}
            <div style={{ position: 'absolute', left: PADX, top: textTop, width: TW, height: lay.height }}>
              {runs.map((r, i) => <Underline key={i} r={r} t={t} />)}
              {lay.items.map((it, i) => {
                const w = c.toks[i], nx = c.toks[i + 1];
                const k = clamp((t - (w.start - 0.03)) / 0.16);
                // one current word at a time (the window ends where the next word starts)
                const cur = t >= w.start - 0.03 && t < Math.min(w.end + 0.08, nx ? nx.start - 0.03 : 1e9);
                const col = w.gold ? mixHex(GHOST_G, GOLD, k) : mixHex(GHOST, cur ? CUR : INK, k);
                const pf = w.gold ? popFit(lay.items, i, { maxAmp: 0.2, edgeL: PADX - 34, edgeR: TW + PADX - 34, isPop: isGold }) : null;
                const kp = w.gold ? pop(t, w.start, pf.amp, 13, 6) : 0;
                const dy = w.gold ? 0.3185 * (FS - FS * GS) : 0;
                return (
                  <span key={i} style={{ position: 'absolute', left: it.x, top: it.y + dy, height: LH, font: it.font, lineHeight: `${LH}px`, whiteSpace: 'nowrap', color: col,
                    transform: `scale(${1 + kp})`, transformOrigin: pf ? `${pf.ox.toFixed(1)}% 60%` : '50% 60%' }}>
                    {cur && !w.gold ? <span style={{ position: 'absolute', left: -6, right: -6, top: LH * 0.24, bottom: LH * 0.12, borderRadius: 8, background: 'rgba(214,160,70,0.22)' }} /> : null}
                    <span style={{ position: 'relative', letterSpacing: w.gold ? `${GLS}em` : 0,
                      textShadow: w.gold && k > 0 ? `0 1px 0 rgba(255,248,228,${0.6 * k}), 0 0 ${14 * k}px rgba(225,150,40,${0.3 * k})` : 'none' }}>{w.text}</span>
                    {w.tail ? <span style={{ position: 'relative', color: mixHex(GHOST, INK, k), textShadow: 'none' }}>{w.tail}</span> : null}
                  </span>
                );
              })}
            </div>
            {/* reference line */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: textTop + lay.height + 40, textAlign: 'center', font: `700 21px ${SANS}`, letterSpacing: '0.32em', textIndent: '0.32em', color: '#7a4a12',
              opacity: ease.out((t - c.t0 - 0.3) / 0.5) }}>{c.ref}</div>
            {/* glint */}
            {glint > 0 && glint < 1 ? <div style={{ position: 'absolute', top: '-50%', left: `${lerp(-50, 140, ease.inOut(glint))}%`, width: '24%', height: '200%', transform: 'rotate(22deg)',
              background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,250,235,0.45), rgba(255,255,255,0))' }} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}

// a 1.5 px gold rule with a hairline companion, inset 30 px, drawing out from the centre (gap = room for the ornament)
const Rule = ({ y, w, k, gap }) => {
  const half = (w / 2 - 30) * k;
  const g = 'linear-gradient(90deg, rgba(168,112,30,0), rgba(168,112,30,0.85) 10%, rgba(196,140,50,0.95) 50%, rgba(168,112,30,0.85) 90%, rgba(168,112,30,0))';
  const seg = (x0, x1, top, hgt, op) => (x1 > x0 ? <div style={{ position: 'absolute', left: x0, width: x1 - x0, top, height: hgt, background: g, backgroundSize: `${w - 60}px 100%`, backgroundPosition: `${30 - x0}px 0`, opacity: op }} /> : null);
  const inner = y < 100 ? y + 5 : y - 5.5;
  return (
    <>
      {seg(w / 2 - half, w / 2 - gap, y - 0.75, 1.5, 1)}{seg(w / 2 + gap, w / 2 + half, y - 0.75, 1.5, 1)}
      {seg(w / 2 - half, w / 2 - gap, inner, 0.75, 0.55)}{seg(w / 2 + gap, w / 2 + half, inner, 0.75, 0.55)}
    </>
  );
};

const Ornament = ({ y, w, k }) => (
  <svg width={w} height={26} style={{ position: 'absolute', left: 0, top: y - 13, opacity: k }}>
    <path d={`M ${w / 2} 3 L ${w / 2 + 10} 13 L ${w / 2} 23 L ${w / 2 - 10} 13 Z`} fill="#b97a1c" />
    <path d={`M ${w / 2} 8 L ${w / 2 + 5} 13 L ${w / 2} 18 L ${w / 2 - 5} 13 Z`} fill="#f3d48a" />
    <circle cx={w / 2 - 19} cy={13} r={2.4} fill="#b97a1c" /><circle cx={w / 2 + 19} cy={13} r={2.4} fill="#b97a1c" />
  </svg>
);

// hand-drawn gold brush underline under a gold run, drawn along the run as it is spoken
const Underline = ({ r, t }) => {
  const k = ease.inOut((t - r.start) / (r.end - r.start + 0.15));
  if (k <= 0) return null;
  const y = r.line * LH + LH * 0.88, x0 = r.x0 + 2, x1 = r.x1 - 2, L = x1 - x0;
  const d = `M ${x0} ${y + 1.5} C ${x0 + L * 0.3} ${y - 2.5}, ${x0 + L * 0.65} ${y + 3}, ${x1} ${y - 1}`;
  return (
    <svg width={CW} height={LH * 6} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <path d={d} fill="none" stroke="rgba(214,150,40,0.22)" strokeWidth="7" strokeLinecap="round" pathLength="1" strokeDasharray={`${k} 1`} />
      <path d={d} fill="none" stroke="#b98a2e" strokeWidth="2.4" strokeLinecap="round" pathLength="1" strokeDasharray={`${k} 1`} />
    </svg>
  );
};
