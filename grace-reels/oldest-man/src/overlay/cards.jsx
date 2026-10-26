// Floating cream paper verse cards (KJV, exact text) with karaoke: words warm from ghost to ink as they
// are spoken (timed from plan.words of the beat), gold words land as antique-gold serif caps with a pop and
// a hand-drawn gold underline that draws along the run as it is spoken. Real paper feel: warm cream with
// fibre texture, aged edge, gold-foil hairline frame with corner flourishes, soft long + contact shadows,
// slight 3D tilt and float, a glint when it lands. The scene behind darkens slightly around the card.
import React from 'react';
import { plan } from '../lib/planInstance.js';
import { SERIF, SANS, ease, pop, clamp, lerp, mixHex, layoutWords, paperURL } from './theme.js';

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
  // the verse is a quotation: typographic quotes around it
  toks[0].text = '“' + toks[0].text; toks[toks.length - 1].close = '”';   // closing quote stays ink even after gold
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

const CW = 920, CX = 80, CTOP = 356, PADX = 90, FS = 62, LH = 78, GS = 0.9;
const PAPER = '#f8eed8', INK = '#2b1a0e', CUR = '#3d2412', GOLD = '#87500a';
const GHOST = mixHex(INK, PAPER, 0.74), GHOST_G = mixHex(GOLD, PAPER, 0.66);

export const cardAt = (t) => CARDS.find((c) => t >= c.t0 - 0.05 && t < c.t1 + 0.05) || null;

export const VerseCards = ({ t, frame }) => <>{CARDS.map((c) => (t >= c.t0 - 0.05 && t < c.t1 + 0.05 ? <Card key={c.id} c={c} t={t} frame={frame} /> : null))}</>;

function Card({ c, t }) {
  const inU = (t - c.t0) / 0.62, outU = clamp((t - (c.t1 - 0.28)) / 0.28);
  const o = clamp((t - c.t0) / 0.22) * (1 - ease.in(outU));
  if (o <= 0.001) return null;
  const inK = ease.back(inU, 1.25), inE = ease.out(inU);
  const lay = layoutWords(c.toks.map((w, i) => ({ glue: w.gold && i > 0 && c.toks[i - 1].gold, text: w.text + (w.close || ''), font: w.gold ? `700 ${Math.round(FS * GS)}px ${SERIF}` : `italic 600 ${FS}px ${SERIF}`, extra: w.gold ? w.text.length * FS * GS * 0.035 : 0 })),
    { maxW: CW - 2 * PADX, lineH: LH, align: 'center', space: FS * 0.25 });
  const textTop = 40 + 26 + 22, h = textTop + lay.height + 40 + 24 + 46;
  const floatY = 5 * Math.sin(t * 1.15 + c.seed), rz = -0.15 + 0.25 * Math.sin(t * 0.62 + c.seed);
  const rx = lerp(18, 2.2, inE) - 10 * ease.in(outU) + 0.7 * Math.sin(t * 0.9), ry = -0.6 + 0.5 * Math.sin(t * 0.5 + 1);
  const y = (1 - inK) * 80 - 34 * ease.in(outU) + floatY;
  const glint = (t - c.t0 - 0.5) / 0.9;
  // gold runs -> underline paths
  const runs = []; let run = null;
  lay.items.forEach((it, i) => {
    const w = c.toks[i];
    if (w.gold && (!run || run.line !== it.line)) { run = { line: it.line, x0: it.x, x1: it.x + it.w, start: w.start, end: w.end }; runs.push(run); }
    else if (w.gold) { run.x1 = it.x + it.w; run.end = w.end; }
    else run = null;
  });
  const cy = CTOP + h / 2;
  return (
    <>
      {/* darken the scene slightly, centred on the card */}
      <div style={{ position: 'absolute', inset: 0, opacity: o, background: `radial-gradient(ellipse 85% 42% at 50% ${(cy / 1920 * 100).toFixed(1)}%, rgba(10,6,3,0.30) 0%, rgba(10,6,3,0.22) 55%, rgba(10,6,3,0.34) 100%)` }} />
      <div style={{ position: 'absolute', left: CX, top: CTOP, width: CW, height: h, opacity: o, perspective: 1500, perspectiveOrigin: '50% 30%' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${y}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${lerp(0.94, 1, inE)})`, transformOrigin: '50% 60%' }}>
          {/* long soft shadow + contact shadow */}
          <div style={{ position: 'absolute', left: 40, right: 40, top: 60, bottom: -36, borderRadius: 40, background: 'rgba(0,0,0,0.5)', filter: 'blur(32px)', transform: `translateY(${18 + 14 * (1 - inE)}px)` }} />
          <div style={{ position: 'absolute', left: 6, right: 6, top: 10, bottom: -5, borderRadius: 18, background: 'rgba(30,15,5,0.42)', filter: 'blur(6px)' }} />
          {/* paper */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(176deg, #fdf8ea 0%, #f8eed8 50%, #f1e2c3 100%)' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${paperURL(1024, 480, c.seed)})`, backgroundSize: '100% 100%', mixBlendMode: 'multiply', opacity: 0.55 }} />
            {/* warm top light + aged edge */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 35% 0%, rgba(255,252,240,0.55) 0%, rgba(255,252,240,0) 70%)' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, boxShadow: 'inset 0 0 40px rgba(170,115,45,0.22), inset 0 0 3px rgba(120,80,30,0.45), inset 0 1.5px 0 rgba(255,255,255,0.8)' }} />
            {/* gold-foil hairline frame + corner flourishes */}
            <div style={{ position: 'absolute', inset: 15, borderRadius: 9, border: '1px solid rgba(178,124,38,0.42)' }} />
            <Corners w={CW} h={h} />
            <Ornament y={40} w={CW} k={ease.out((t - c.t0 - 0.15) / 0.5)} />
            {/* verse */}
            <div style={{ position: 'absolute', left: PADX, top: textTop, width: CW - 2 * PADX, height: lay.height }}>
              {runs.map((r, i) => <Underline key={i} r={r} t={t} />)}
              {lay.items.map((it, i) => {
                const w = c.toks[i];
                const k = clamp((t - (w.start - 0.03)) / 0.16);
                const cur = t >= w.start - 0.03 && t < w.end + 0.08;
                const col = w.gold ? mixHex(GHOST_G, GOLD, k) : mixHex(GHOST, cur ? CUR : INK, k);
                const kp = w.gold ? pop(t, w.start, 0.2, 13, 6) : 0;
                const dy = w.gold ? 0.3185 * (FS - FS * GS) : 0;
                return (
                  <span key={i} style={{ position: 'absolute', left: it.x, top: it.y + dy, height: LH, font: it.font, lineHeight: `${LH}px`, whiteSpace: 'nowrap', color: col,
                    letterSpacing: w.gold ? '0.035em' : 0, transform: `scale(${1 + kp})`, transformOrigin: '50% 60%',
                    textShadow: w.gold && k > 0 ? `0 1px 0 rgba(255,250,235,${0.7 * k}), 0 0 ${14 * k}px rgba(225,150,40,${0.32 * k})` : 'none' }}>
                    {cur && !w.gold ? <span style={{ position: 'absolute', left: -6, right: -6, top: LH * 0.24, bottom: LH * 0.12, borderRadius: 8, background: 'rgba(238,186,96,0.24)' }} /> : null}
                    <span style={{ position: 'relative' }}>{w.close ? it.text.slice(0, -1) : it.text}</span>
                    {w.close ? <span style={{ position: 'relative', color: mixHex(GHOST, INK, k), textShadow: 'none' }}>{w.close}</span> : null}
                  </span>
                );
              })}
            </div>
            {/* reference line */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: textTop + lay.height + 40, textAlign: 'center', font: `700 21px ${SANS}`, letterSpacing: '0.32em', color: '#7a4a12',
              opacity: ease.out((t - c.t0 - 0.3) / 0.5) }}>{c.ref}</div>
            {/* glint */}
            {glint > 0 && glint < 1 ? <div style={{ position: 'absolute', top: '-50%', left: `${lerp(-50, 140, ease.inOut(glint))}%`, width: '24%', height: '200%', transform: 'rotate(22deg)',
              background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,252,240,0.5), rgba(255,255,255,0))' }} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}

const Ornament = ({ y, w, k }) => (
  <svg width={w} height={26} style={{ position: 'absolute', left: 0, top: y - 13, opacity: k }}>
    <defs>
      <linearGradient id="ornL" x1="0" x2="1"><stop offset="0" stopColor="#a5640c" stopOpacity="0" /><stop offset="1" stopColor="#a5640c" stopOpacity="0.9" /></linearGradient>
      <linearGradient id="ornR" x1="0" x2="1"><stop offset="0" stopColor="#a5640c" stopOpacity="0.9" /><stop offset="1" stopColor="#a5640c" stopOpacity="0" /></linearGradient>
    </defs>
    <line x1={w / 2 - 26 - 150 * k} y1={13} x2={w / 2 - 26} y2={13} stroke="url(#ornL)" strokeWidth="1.5" />
    <line x1={w / 2 + 26} y1={13} x2={w / 2 + 26 + 150 * k} y2={13} stroke="url(#ornR)" strokeWidth="1.5" />
    <path d={`M ${w / 2} 3 L ${w / 2 + 10} 13 L ${w / 2} 23 L ${w / 2 - 10} 13 Z`} fill="#b97a1c" />
    <path d={`M ${w / 2} 8 L ${w / 2 + 5} 13 L ${w / 2} 18 L ${w / 2 - 5} 13 Z`} fill="#f3d48a" />
    <circle cx={w / 2 - 19} cy={13} r={2.4} fill="#b97a1c" /><circle cx={w / 2 + 19} cy={13} r={2.4} fill="#b97a1c" />
  </svg>
);

// small gold flourishes in the four corners of the frame
const Corners = ({ w, h }) => {
  const d = 'M 0 22 L 0 6 Q 0 0 6 0 L 22 0 M 7 14 Q 7 7 14 7';
  const pos = [[22, 22, 0], [w - 22, 22, 90], [w - 22, h - 22, 180], [22, h - 22, 270]];
  return (
    <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
      {pos.map(([x, y, r], i) => <path key={i} d={d} transform={`translate(${x} ${y}) rotate(${r})`} fill="none" stroke="rgba(170,112,30,0.55)" strokeWidth="1.4" strokeLinecap="round" />)}
    </svg>
  );
};

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
