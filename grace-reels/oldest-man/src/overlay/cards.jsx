// Floating cream paper verse cards (KJV, exact text) with karaoke: words warm from ghost to ink as they
// are spoken (timed from plan.words of the beat), gold words land as serif caps with a pop and get a
// hand-drawn gold underline. Real paper feel: fibre texture, deckled edge, double rule, soft long shadow,
// slight 3D tilt and float, a glint when it lands. The scene behind darkens slightly.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { C, SERIF, SANS, ease, pop, clamp, lerp, mixHex, layoutWords, paperURL, deckle } from './theme.js';

const E = plan.ev;
const clean = (s) => s.replace(/[^A-Za-z0-9']/g, '').toUpperCase();

export const CARDS = [
  { id: 'gen524', beat: 'B03', ref: 'GENESIS 5:24 · KJV', text: 'And Enoch walked with God: and he was not; for *God took him*.', t0: E.card524, t1: E.card524Out, seed: 5 },
  { id: 'pet320', beat: 'B13', ref: '1 PETER 3:20 · KJV', text: '…the longsuffering of God *waited* in the days of Noah, while the ark was a preparing…', t0: E.card320, t1: E.card320Out, seed: 9 },
  { id: 'pet39', beat: 'B15', ref: '2 PETER 3:9 · KJV', text: 'The Lord is… *not willing* that any should *perish*, but that all should come to repentance.', t0: E.card39, t1: E.card39Out, seed: 13 },
];

// tokens + gold flags + spoken times (LCS alignment of card words to the timeline words of the beat)
function prepare(card) {
  const toks = []; let gold = false;
  for (const raw of card.text.split(' ')) {
    let disp = '', g = false;
    for (const ch of raw) { if (ch === '*') { gold = !gold; continue; } if (gold && /[A-Za-z]/.test(ch)) g = true; disp += ch; }
    toks.push({ text: g ? disp.toUpperCase() : disp, gold: g, key: clean(disp) });
  }
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

const CW = 920, CX = 80, CTOP = 292, PADX = 64, FS = 54, LH = 70;
const PAPER = '#f6ecd5', INK = '#2b1a0e', CUR = '#3d2412', GOLD = '#a5640c';
const GHOST = mixHex(INK, PAPER, 0.74), GHOST_G = mixHex(GOLD, PAPER, 0.62);

export const cardAt = (t) => CARDS.find((c) => t >= c.t0 - 0.05 && t < c.t1 + 0.05) || null;

export const VerseCards = ({ t, frame }) => <>{CARDS.map((c) => (t >= c.t0 - 0.05 && t < c.t1 + 0.05 ? <Card key={c.id} c={c} t={t} frame={frame} /> : null))}</>;

function Card({ c, t }) {
  const inU = (t - c.t0) / 0.62, outU = clamp((t - (c.t1 - 0.28)) / 0.28);
  const o = clamp((t - c.t0) / 0.22) * (1 - ease.in(outU));
  if (o <= 0.001) return null;
  const inK = ease.back(inU, 1.25), inE = ease.out(inU);
  const lay = layoutWords(c.toks.map((w) => ({ text: w.text, font: w.gold ? `700 ${Math.round(FS * 0.86)}px ${SERIF}` : `italic 600 ${FS}px ${SERIF}`, extra: w.gold ? w.text.length * FS * 0.86 * 0.04 : 0 })),
    { maxW: CW - 2 * PADX, lineH: LH, align: 'center', space: FS * 0.25 });
  const textTop = 44 + 22 + 24, h = textTop + lay.height + 30 + 22 + 46;
  const floatY = 5 * Math.sin(t * 1.15 + c.seed), rz = -0.5 + 0.45 * Math.sin(t * 0.62 + c.seed);
  const rx = lerp(18, 2.5, inE) - 10 * ease.in(outU) + 0.8 * Math.sin(t * 0.9), ry = -2.5 + 1.2 * Math.sin(t * 0.5 + 1);
  const y = (1 - inK) * 80 - 34 * ease.in(outU) + floatY;
  const glint = (t - c.t0 - 0.5) / 0.9;
  // gold runs -> underline paths (after the run is spoken)
  const runs = []; let run = null;
  lay.items.forEach((it, i) => {
    const w = c.toks[i];
    if (w.gold && (!run || run.line !== it.line)) { run = { line: it.line, x0: it.x, x1: it.x + it.w, start: w.start, end: w.end }; runs.push(run); }
    else if (w.gold) { run.x1 = it.x + it.w; run.end = w.end; }
    else run = null;
  });
  return (
    <>
      {/* darken the scene behind */}
      <div style={{ position: 'absolute', inset: 0, opacity: o, background: 'radial-gradient(ellipse 80% 55% at 50% 30%, rgba(10,6,3,0.22) 0%, rgba(10,6,3,0.5) 70%, rgba(10,6,3,0.62) 100%)' }} />
      <div style={{ position: 'absolute', left: CX, top: CTOP, width: CW, height: h, opacity: o, perspective: 1500, perspectiveOrigin: '50% 30%' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${y}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${lerp(0.94, 1, inE)})`, transformOrigin: '50% 60%' }}>
          {/* long soft shadow + contact shadow (outside the deckle clip) */}
          <div style={{ position: 'absolute', left: 30, right: 30, top: 50, bottom: -40, borderRadius: 30, background: 'rgba(0,0,0,0.55)', filter: 'blur(30px)', transform: `translateY(${18 + 14 * (1 - inE)}px)` }} />
          <div style={{ position: 'absolute', left: 8, right: 8, top: 10, bottom: -6, borderRadius: 12, background: 'rgba(30,15,5,0.45)', filter: 'blur(7px)' }} />
          {/* paper */}
          <div style={{ position: 'absolute', inset: 0, clipPath: deckle(c.seed, 34, 0.5), borderRadius: 6,
            backgroundColor: PAPER, backgroundImage: `url(${paperURL(1024, 480, c.seed)}), linear-gradient(172deg, #fcf5e4 0%, #f6ead0 55%, #eedebb 100%)`,
            backgroundBlendMode: 'multiply', backgroundSize: '100% 100%, 100% 100%' }}>
            {/* aged edge + light falloff */}
            <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 50px rgba(160,105,40,0.28), inset 0 0 8px rgba(120,80,30,0.35)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 38%, rgba(110,70,25,0.08) 100%)' }} />
            {/* double rule */}
            <div style={{ position: 'absolute', inset: 16, borderRadius: 4, border: '1.2px solid rgba(165,110,35,0.45)' }} />
            <div style={{ position: 'absolute', inset: 22, borderRadius: 3, border: '0.8px solid rgba(165,110,35,0.28)' }} />
            {/* ornament */}
            <Ornament y={44} w={CW} k={ease.out((t - c.t0 - 0.15) / 0.5)} />
            {/* verse */}
            <div style={{ position: 'absolute', left: PADX, top: textTop, width: CW - 2 * PADX, height: lay.height }}>
              {runs.map((r, i) => <Underline key={i} r={r} t={t} />)}
              {lay.items.map((it, i) => {
                const w = c.toks[i];
                const k = clamp((t - (w.start - 0.03)) / 0.16);
                const cur = t >= w.start - 0.03 && t < w.end + 0.08;
                const col = w.gold ? mixHex(GHOST_G, GOLD, k) : mixHex(GHOST, cur ? CUR : INK, k);
                const kp = w.gold ? pop(t, w.start, 0.2, 13, 6) : 0;
                const dy = w.gold ? 0.3185 * (FS - FS * 0.86) : 0;
                return (
                  <span key={i} style={{ position: 'absolute', left: it.x, top: it.y + dy, height: LH, font: it.font, lineHeight: `${LH}px`, whiteSpace: 'nowrap', color: col,
                    letterSpacing: w.gold ? '0.04em' : 0, transform: `scale(${1 + kp})`, transformOrigin: '50% 60%',
                    textShadow: w.gold && k > 0 ? `0 0 ${16 * k}px rgba(235,165,50,${0.45 * k})` : cur ? '0 0 12px rgba(230,160,70,0.35)' : 'none' }}>
                    {cur && !w.gold ? <span style={{ position: 'absolute', left: -6, right: -6, top: LH * 0.22, bottom: LH * 0.12, borderRadius: 8, background: 'rgba(238,186,96,0.22)' }} /> : null}
                    <span style={{ position: 'relative' }}>{it.text}</span>
                  </span>
                );
              })}
            </div>
            {/* reference line */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: textTop + lay.height + 30, textAlign: 'center', font: `700 20px ${SANS}`, letterSpacing: '0.32em', color: C.goldCard,
              opacity: ease.out((t - c.t0 - 0.3) / 0.5) }}>{c.ref}</div>
            {/* glint */}
            {glint > 0 && glint < 1 ? <div style={{ position: 'absolute', top: '-50%', left: `${lerp(-50, 140, ease.inOut(glint))}%`, width: '26%', height: '200%', transform: 'rotate(22deg)',
              background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,252,240,0.45), rgba(255,255,255,0))' }} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}

const Ornament = ({ y, w, k }) => (
  <svg width={w} height={24} style={{ position: 'absolute', left: 0, top: y - 12, opacity: k }}>
    <defs>
      <linearGradient id="ornL" x1="0" x2="1"><stop offset="0" stopColor="#a5640c" stopOpacity="0" /><stop offset="1" stopColor="#a5640c" stopOpacity="0.85" /></linearGradient>
      <linearGradient id="ornR" x1="0" x2="1"><stop offset="0" stopColor="#a5640c" stopOpacity="0.85" /><stop offset="1" stopColor="#a5640c" stopOpacity="0" /></linearGradient>
    </defs>
    <line x1={w / 2 - 22 - 110 * k} y1={12} x2={w / 2 - 22} y2={12} stroke="url(#ornL)" strokeWidth="1.4" />
    <line x1={w / 2 + 22} y1={12} x2={w / 2 + 22 + 110 * k} y2={12} stroke="url(#ornR)" strokeWidth="1.4" />
    <path d={`M ${w / 2} 4 L ${w / 2 + 8} 12 L ${w / 2} 20 L ${w / 2 - 8} 12 Z`} fill="#b97a1c" />
    <circle cx={w / 2 - 16} cy={12} r={2} fill="#b97a1c" /><circle cx={w / 2 + 16} cy={12} r={2} fill="#b97a1c" />
  </svg>
);

// hand-drawn gold brush underline under a gold run, drawn on after the run is spoken
const Underline = ({ r, t }) => {
  const k = ease.inOut((t - r.start) / (r.end - r.start + 0.15));   // draws along the run as it is spoken
  if (k <= 0) return null;
  const y = r.line * LH + LH * 0.86, x0 = r.x0 - 6, x1 = r.x1 + 6, L = x1 - x0;
  const d = `M ${x0} ${y + 2} C ${x0 + L * 0.3} ${y - 3}, ${x0 + L * 0.65} ${y + 4}, ${x1} ${y - 1}`;
  return (
    <svg width={CW} height={LH * 6} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <path d={d} fill="none" stroke="rgba(214,150,40,0.35)" strokeWidth="9" strokeLinecap="round" pathLength="1" strokeDasharray={`${k} 1`} />
      <path d={d} fill="none" stroke="#c48a26" strokeWidth="3.2" strokeLinecap="round" pathLength="1" strokeDasharray={`${k} 1`} />
    </svg>
  );
};
