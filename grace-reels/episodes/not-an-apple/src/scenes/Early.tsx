import {useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill} from 'remotion';
import {FacetBlob, OUT} from '../lib/draw';
import {Person} from '../characters/People';
import {Label} from '../overlays/Label';
import {ScriptureCard} from '../overlays/ScriptureCard';
import {EditStrip} from '../overlays/EditStrip';
import {EdenBlur} from './Eden';
import {cues} from '../lib/time';
import {SANS, SERIF} from '../lib/fonts';
import {inOut, lerp, out, outBack, prog, wobble} from '../lib/anim';
import {noise1, rand} from '../lib/random';

const RED = '#C0392B';
const GOLD = '#F2B544';

// ---------- the shiny apple (2D), slowly "turning" via its moving highlight ----------
export const Apple: React.FC<{t: number; size: number; x: number; y: number; opacity?: number; dim?: number}> = ({t, size, x, y, opacity = 1, dim = 0}) => {
  const turn = Math.sin(t * 0.55);
  const s = size / 600;
  return (
    <g transform={`translate(${x},${y}) scale(${s * (1 - Math.abs(turn) * 0.025)},${s})`} opacity={opacity}>
      <defs>
        <radialGradient id="appleBody" cx={0.42 + turn * 0.08} cy="0.38" r="0.7">
          <stop offset="0" stopColor="#E5392C" />
          <stop offset="0.55" stopColor="#B81E18" />
          <stop offset="1" stopColor="#5E0C0A" />
        </radialGradient>
        <linearGradient id="rimWarm" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFB45A" stopOpacity={0.95} />
          <stop offset="0.25" stopColor="#FF8A3A" stopOpacity={0} />
          <stop offset="0.8" stopColor="#7FB4FF" stopOpacity={0} />
          <stop offset="1" stopColor="#9CC4FF" stopOpacity={0.6} />
        </linearGradient>
        <clipPath id="appleClip"><path d="M0,-210 C120,-300 300,-230 290,-40 C285,130 170,290 40,270 C10,265 -10,255 -40,270 C-170,290 -285,130 -290,-40 C-300,-230 -120,-300 0,-210Z" /></clipPath>
      </defs>
      <ellipse cx={0} cy={300} rx={240} ry={30} fill="rgba(255,120,60,0.18)" />
      <g clipPath="url(#appleClip)">
        <rect x={-320} y={-320} width={640} height={640} fill="url(#appleBody)" />
        {Array.from({length: 7}, (_, i) => <path key={i} d={`M${-250 + i * 80 + turn * 30},-260 Q${-200 + i * 80 + turn * 40},0 ${-240 + i * 80 + turn * 30},280`} stroke="#F05A3C" strokeWidth={10} opacity={0.12} fill="none" />)}
        <rect x={-320} y={-320} width={640} height={640} fill="url(#rimWarm)" />
        <ellipse cx={-110 + turn * 60} cy={-120} rx={60} ry={95} fill="#FFFFFF" opacity={0.55} transform={`rotate(-25 ${-110 + turn * 60} -120)`} />
        <ellipse cx={-80 + turn * 60} cy={-150} rx={18} ry={30} fill="#FFFFFF" opacity={0.9} />
        {/* the bite on the right, cream flesh with tooth scallops */}
        <path d={`M${300 + turn * 10},-150 Q${200 + turn * 10},-140 ${190 + turn * 10},-80 Q${160 + turn * 10},-40 ${185 + turn * 10},0 Q${160 + turn * 10},40 ${190 + turn * 10},80 Q${200 + turn * 10},130 ${300},140Z`} fill="#F4E3BE" stroke="#C9A86A" strokeWidth={6} />
        <path d={`M${215 + turn * 10},-60 Q${230 + turn * 10},0 ${215 + turn * 10},60`} stroke="#E2C88E" strokeWidth={8} fill="none" />
      </g>
      <rect width={640} height={640} x={-320} y={-320} fill="#000" opacity={dim} clipPath="url(#appleClip)" />
      <path d={`M${-6 + turn * 8},-215 Q${-14 + turn * 8},-290 ${16 + turn * 8},-330`} stroke="#5B3A1E" strokeWidth={20} strokeLinecap="round" fill="none" />
      <path d={`M${14 + turn * 8},-300 Q${90 + turn * 12},-360 ${150 + turn * 12},-300 Q${80 + turn * 12},-270 ${14 + turn * 8},-300Z`} fill="#4E8E2E" stroke={OUT} strokeWidth={5} />
    </g>
  );
};

// rough brush X with wind-up (anticipation) and slam
export const RedX: React.FC<{t: number; at: number; x: number; y: number; size: number}> = ({t, at, x, y, size}) => {
  const pre = prog(t, at - 0.3, at - 0.03);
  if (t < at - 0.3) return null;
  const slam = t >= at;
  const k = slam ? 1 + wobble(t - at, 3.5, 7) * 0.08 : lerp(1.3, 1.45, pre);
  const o = slam ? 1 : pre * 0.3;
  const rot = slam ? 0 : -8 * pre;
  const brush = (d: string) => (
    <>
      <path d={d} stroke="#7E1A12" strokeWidth={88} strokeLinecap="round" fill="none" />
      <path d={d} stroke={RED} strokeWidth={74} strokeLinecap="round" fill="none" filter="url(#rough)" />
      <path d={d} stroke="#E0574A" strokeWidth={12} strokeLinecap="round" fill="none" opacity={0.5} transform="translate(-10,-12)" />
    </>
  );
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <defs>
        <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={3} /><feDisplacementMap in="SourceGraphic" scale={18} /></filter>
      </defs>
      <g transform={`translate(${x},${y}) rotate(${rot}) scale(${(k * size) / 600})`} opacity={o}>
        {brush('M-250,-250 L250,250')}
        {brush('M250,-260 L-240,250')}
      </g>
      {slam && t - at < 0.25 && <circle cx={x} cy={y} r={200 + (t - at) * 1600} fill="none" stroke="#FFD6C8" strokeWidth={10} opacity={1 - (t - at) / 0.25} />}
    </svg>
  );
};

export const shakeAt = (t: number, at: number) => {
  const d = t - at;
  if (d < 0 || d > 0.45) return [0, 0];
  const e = Math.exp(-d * 9);
  return [noise1(d * 60, 1) * 22 * e, noise1(d * 60, 2) * 22 * e];
};

export const S1: React.FC<{t: number; b: number}> = ({t, b}) => {
  const [sx, sy] = shakeAt(t, cues.xSlam);
  const z = 1 + prog(t, 0, b) * 0.08;
  const titleIn = 1; // the title is on screen from frame 0 (no fade from black)
  const leave = prog(t, b - 0.3, b);
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 42%, #2A140C 0%, #0B0705 45%, #000 80%)', transform: `translate(${sx}px,${sy}px)`}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '540px 820px'}}>
        <Apple t={t} size={470} x={540} y={830} dim={t > cues.xSlam ? 0.15 : 0} />
      </svg>
      <RedX t={t} at={cues.xSlam} x={540} y={830} size={480} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 1110, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, textTransform: 'uppercase', opacity: titleIn * (1 - leave),
        transform: `scale(${0.96 + titleIn * 0.04})`}}>
        <div style={{fontSize: 100, color: '#FFFFFF', letterSpacing: '0.04em', lineHeight: 1}}>IT WASN'T</div>
        <div style={{fontSize: 130, color: GOLD, letterSpacing: '0.03em', lineHeight: 1.05, textShadow: '0 0 40px rgba(242,181,68,0.55)'}}>AN APPLE.</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- S2: the open Bible; the magnifier finds FRUIT ----------
const GEN3 = [
  ['1', 'Now the serpent was more subtil than any beast of the field which the LORD God had made. And he said unto the woman, Yea, hath God said, Ye shall not eat of every tree of the garden?'],
  ['2', 'And the woman said unto the serpent, We may eat of the fruit of the trees of the garden:'],
  ['3', 'But of the fruit of the tree which is in the midst of the garden, God hath said, Ye shall not eat of it, neither shall ye touch it, lest ye die.'],
  ['4', 'And the serpent said unto the woman, Ye shall not surely die:'],
  ['5', 'For God doth know that in the day ye eat thereof, then your eyes shall be opened, and ye shall be as gods, knowing good and evil.'],
  ['6', 'And when the woman saw that the tree was good for food, and that it was pleasant to the eyes, and a tree to be desired to make one wise, she took of the |fruit| thereof, and did eat, and gave also unto her husband with her; and he did eat.'],
  ['7', 'And the eyes of them both were opened, and they knew that they were naked; and they sewed fig leaves together, and made themselves aprons.'],
];

const Pages: React.FC<{glow: number; fruitRef?: React.Ref<HTMLSpanElement>}> = ({glow, fruitRef}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 1000, height: 700, display: 'flex', gap: 40, padding: '46px 44px', boxSizing: 'border-box',
    fontFamily: SERIF, fontWeight: 500, fontSize: 25.5, lineHeight: 1.3, color: '#3A2A1C', textAlign: 'justify'}}>
    {[GEN3.slice(0, 4), GEN3.slice(4)].map((col, ci) => (
      <div key={ci} style={{flex: 1}}>
        {ci === 0 && <div style={{fontWeight: 700, fontSize: 30, letterSpacing: '0.2em', textAlign: 'center', marginBottom: 12}}>GENESIS 3</div>}
        {col.map(([n, txt]) => (
          <p key={n} style={{margin: '0 0 8px'}}>
            <sup style={{fontFamily: SANS, fontSize: 13, color: '#9A5B0C', marginRight: 4}}>{n}</sup>
            {txt.split('|').map((p, i) => i === 1
              ? <span key={i} ref={fruitRef} style={{color: glow > 0 ? '#9A5B0C' : undefined, fontWeight: glow > 0 ? 700 : 500, textShadow: glow > 0 ? `0 0 ${18 * glow}px rgba(242,181,68,${glow})` : 'none', background: `rgba(242,181,68,${0.35 * glow})`, borderRadius: 4}}>{glow > 0 ? 'FRUIT' : p}</span>
              : <span key={i}>{p}</span>)}
          </p>
        ))}
      </div>
    ))}
  </div>
);

export const S2: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [target, setTarget] = useState<[number, number]>([760, 520]);
  useLayoutEffect(() => {
    let el: HTMLElement | null = ref.current;
    let x = 0, y = 0;
    while (el && el.dataset.page === undefined) {
      x += el.offsetLeft; y += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    if (ref.current) setTarget([x + ref.current.offsetWidth / 2, y + ref.current.offsetHeight / 2]);
  }, []);
  const glow = prog(t, cues.fruitFound, cues.fruitFound + 0.3);
  const slide = inOut(prog(t, a, b));
  // lens path: searching across verses, then gliding onto FRUIT
  const search = prog(t, a, cues.fruitFound - 0.45);
  const sx = 200 + Math.sin(search * Math.PI * 3) * 230 + search * 200, sy = 140 + search * 300;
  const go = inOut(prog(t, cues.fruitFound - 0.45, cues.fruitFound));
  const away = inOut(prog(t, cues.cardGen36 - 0.1, cues.cardGen36 + 0.6));
  const lx = lerp(lerp(sx, target[0], go), target[0] + 160, away), ly = lerp(lerp(sy, target[1], go), target[1] - 230, away);
  const R = 120, M = 1.7;
  const bookX = 40 - slide * 30, bookY = 790 + slide * 20;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 30% 30%, #5A3A22 0%, #2E1C10 55%, #140B06 100%)'}}>
      <div style={{position: 'absolute', left: bookX, top: bookY, width: 1000, height: 700, transform: `rotate(${-3 + slide * 2}deg)`}} data-page="">
        <div style={{position: 'absolute', inset: -26, borderRadius: 26, background: 'linear-gradient(135deg,#5A2E18,#3B1D0E)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', border: '3px solid #B88A3A'}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(90deg,#EFE3C6 0%,#F8EFDA 44%,#D9C9A4 50%,#F8EFDA 56%,#EFE3C6 100%)'}} />
        <div data-page="" style={{position: 'absolute', inset: 0}}><Pages glow={glow} fruitRef={ref} /></div>
        <div style={{position: 'absolute', right: 120, top: -26, width: 18, height: 760, background: '#A52A22'}} />
        {/* magnifier: a scaled copy of the pages clipped to the lens */}
        <div style={{position: 'absolute', inset: 0, clipPath: `circle(${R}px at ${lx}px ${ly}px)`}}>
          <div style={{position: 'absolute', inset: 0, background: '#FBF3E0', transformOrigin: `${lx}px ${ly}px`, transform: `scale(${M})`}}><Pages glow={glow} /></div>
          <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at ${lx}px ${ly}px, rgba(255,255,255,0) ${R * 0.7}px, rgba(120,80,30,0.25) ${R}px)`}} />
        </div>
        <svg width={1000} height={700} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <path d={`M${lx + R * 0.7},${ly + R * 0.7} L${lx + R * 1.9},${ly + R * 1.9}`} stroke="#3B2416" strokeWidth={44} strokeLinecap="round" />
          <path d={`M${lx + R * 0.7},${ly + R * 0.7} L${lx + R * 1.9},${ly + R * 1.9}`} stroke="#6B3E1E" strokeWidth={32} strokeLinecap="round" />
          <circle cx={lx} cy={ly} r={R + 10} fill="none" stroke="#7A5418" strokeWidth={26} />
          <circle cx={lx} cy={ly} r={R + 10} fill="none" stroke="#E3B35A" strokeWidth={14} />
          <path d={`M${lx - R * 0.6},${ly - R * 0.5} A${R * 0.8},${R * 0.8} 0 0 1 ${lx + R * 0.2},${ly - R * 0.8}`} stroke="#fff" strokeWidth={8} opacity={0.6} fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 75% 20%, rgba(255,190,110,0.25), rgba(0,0,0,0) 55%)', mixBlendMode: 'screen'}} />
      <Label t={t} t0={a + 0.15} t1={cues.fruitFound + 0.2} x={90} y={1400} text={'"APPLE" IS NOT IN GENESIS'} />
      <ScriptureCard t={t} t0={cues.cardGen36} t1={b + 0.1} quote="“…she took of the *fruit* thereof, and did eat, and gave also unto her husband with her; and he did eat.”" refText="GENESIS 3:6 · KJV" />
    </AbsoluteFill>
  );
};

// ---------- S3: the painter's studio; MALUM splits ----------
const Candle: React.FC<{x: number; y: number; t: number; i: number}> = ({x, y, t, i}) => {
  const f = 1 + noise1(t * 6 + i * 4, i) * 0.12;
  return (
    <g>
      <circle cx={x} cy={y - 60} r={170 * f} fill="url(#candleGlow)" />
      <rect x={x - 18} y={y - 40} width={36} height={110} fill="#F1E6CE" stroke={OUT} strokeWidth={5} />
      <path d={`M${x},${y - 92 * f} Q${x + 16},${y - 58} ${x},${y - 42} Q${x - 16},${y - 58} ${x},${y - 92 * f}Z`} fill="#FFD27A" transform={`rotate(${noise1(t * 5 + i, i + 9) * 8} ${x} ${y - 42})`} />
      <path d={`M${x},${y - 75 * f} Q${x + 7},${y - 55} ${x},${y - 46} Q${x - 7},${y - 55} ${x},${y - 75 * f}Z`} fill="#FFF7DA" />
    </g>
  );
};

const Painting: React.FC<{t: number; apple: number}> = ({t, apple}) => (
  <g>
    <rect x={-210} y={-270} width={420} height={540} fill="#2E2416" />
    <rect x={-210} y={-270} width={420} height={540} fill="url(#varnish)" />
    <FacetBlob cx={0} cy={-150} rx={190} ry={110} seed={9} colors={['#2F4A1E', '#3D5C24', '#4E6E2A']} />
    <rect x={-14} y={-60} width={28} height={300} fill="#4A2F1A" />
    <g opacity={0.92}>
      <Person kind="adam" t={0} x={-110} y={250} h={300} seed={3} face={{smile: 0.3}} />
      <Person kind="eve" t={0} x={90} y={250} h={285} flip pose={{arm: 150, bend: -20}} face={{smile: 0.4}} />
    </g>
    <circle cx={42} cy={-62} r={26 * apple} fill="#C0271F" stroke="#5E0C0A" strokeWidth={4} />
    <circle cx={34} cy={-70} r={8 * apple} fill="#FFFFFF" opacity={0.6} />
    <rect x={-210} y={-270} width={420} height={540} fill="none" stroke="#C9973E" strokeWidth={34} />
    <rect x={-210} y={-270} width={420} height={540} fill="none" stroke="#8A5E1E" strokeWidth={8} />
  </g>
);

export const S3: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const z = 1 + inOut(prog(t, a, b)) * 0.12;
  const paint = prog(t, cues.paintStroke - 0.4, cues.paintStroke + 0.8);
  const stroke = Math.sin(t * 7) * 18 * (t > cues.paintStroke - 0.6 && t < cues.paintStroke + 1.2 ? 1 : 0.3);
  const rise = out(prog(t, cues.malumRise - 0.2, cues.malumRise + 0.5));
  const split = outBack(prog(t, cues.malumSplit - 0.1, cues.malumSplit + 0.45), 1.4);
  return (
    <AbsoluteFill style={{background: '#1C120B'}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '600px 1150px'}}>
        <defs>
          <radialGradient id="candleGlow"><stop offset="0" stopColor="#FFC977" stopOpacity={0.55} /><stop offset="1" stopColor="#FF9A3A" stopOpacity={0} /></radialGradient>
          <linearGradient id="varnish" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8A5A20" stopOpacity={0.25} /><stop offset="1" stopColor="#2A1A08" stopOpacity={0.45} /></linearGradient>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A2516" /><stop offset="1" stopColor="#24170D" /></linearGradient>
        </defs>
        <rect x={-100} y={-100} width={1300} height={2200} fill="url(#wall)" />
        {[0, 1, 2].map((i) => <rect key={i} x={-100} y={720 + i * 6} width={1300} height={44} fill="#2A1A0E" transform={`translate(0,${i * 220})`} opacity={0.6} />)}
        <path d="M120,620 L120,980 L360,980 L360,620 Q240,480 120,620Z" fill="#132241" stroke="#5A3A22" strokeWidth={22} />
        {Array.from({length: 14}, (_, i) => <circle key={i} cx={140 + rand(5, i) * 200} cy={560 + rand(6, i) * 400} r={2 + rand(7, i) * 3} fill="#FFF6D8" opacity={0.5 + 0.5 * Math.sin(t * 3 + i)} />)}
        <rect x={-50} y={1060} width={420} height={18} fill="#4A2F1A" />
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={10 + i * 70} y={990 - (i % 2) * 30} width={50} height={70 + (i % 2) * 30} rx={10} fill={['#6E8B6A', '#A86A3A', '#8A7A9A', '#C2A060', '#5A7A8A'][i]} stroke={OUT} strokeWidth={5} />)}
        <rect x={-100} y={1640} width={1300} height={500} fill="#2B1B0F" />
        <rect x={20} y={1480} width={420} height={30} fill="#5B3A20" stroke={OUT} strokeWidth={6} />
        <Candle x={110} y={1440} t={t} i={0} /><Candle x={220} y={1430} t={t} i={1} /><Candle x={330} y={1445} t={t} i={2} />
        <path d="M640,1760 L760,1000 M900,1760 L780,1000 M770,1100 L800,1780" stroke="#6B4423" strokeWidth={26} strokeLinecap="round" />
        <rect x={600} y={1380} width={340} height={26} fill="#5B3A20" />
        <g transform="translate(770,1110)"><Painting t={t} apple={paint} /></g>
        <Person kind="painter" t={t} x={330} y={1760} h={720} seed={5}
          pose={{arm: 72 + stroke * 0.4, bend: 18 + stroke, backArm: 20, backBend: 40}}
          face={{smile: 0.5, brow: 0.5}}
          hold={<g><path d="M0,0 L80,-60" stroke="#6B4423" strokeWidth={10} strokeLinecap="round" /><circle cx={84} cy={-63} r={9} fill="#C0271F" /></g>}
          backHold={<g><ellipse cx={10} cy={0} rx={70} ry={42} fill="#C9A46A" stroke={OUT} strokeWidth={6} />{['#C0392B', '#2E7D4F', '#E0A93B', '#3B5BA5'].map((c, i) => <circle key={c} cx={-30 + i * 22} cy={-10 + (i % 2) * 18} r={10} fill={c} />)}</g>} />
      </svg>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 25% 72%, rgba(255,170,80,0.22), rgba(0,0,0,0) 50%)', mixBlendMode: 'screen'}} />
      <Label t={t} t0={cues.paintStroke - 0.2} t1={cues.malumRise - 0.2} x={90} y={760} ax={720} ay={1050} text="EUROPEAN PAINTERS MADE THE APPLE POPULAR" />
      {rise > 0 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: lerp(1000, 820, rise), height: 300, opacity: rise}}>
          {[-1, 1].map((d) => {
            const dx = d * split * 220;
            const label = split > 0.5;
            return (
              <div key={d} style={{position: 'absolute', left: 540 + dx, top: 0, transform: 'translateX(-50%)', textAlign: 'center'}}>
                <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: label ? 92 : 120, color: GOLD, letterSpacing: '0.08em', textShadow: '0 0 30px rgba(242,181,68,0.5)',
                  opacity: split > 0 ? 1 : d > 0 ? 1 : 0}}>{d < 0 ? 'MALUM' : split > 0 ? 'MĀLUM' : 'MALUM'}</div>
                {label && (
                  <div style={{display: 'inline-block', marginTop: 8, fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: '0.16em', color: '#FFF8EC', padding: '8px 18px', borderRadius: 10,
                    background: d < 0 ? '#5A1E16' : RED, opacity: prog(split, 0.5, 1)}}>{d < 0 ? 'EVIL' : 'APPLE'}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- S4: fruit cards flip; the fourth stays locked ----------
const Fruit: React.FC<{kind: number}> = ({kind}) => (
  <svg width={160} height={160} viewBox="-80 -80 160 160">
    {kind === 0 && <g><path d="M0,-55 Q46,-20 40,22 Q32,60 0,62 Q-32,60 -40,22 Q-46,-20 0,-55Z" fill="#6B3A6E" stroke={OUT} strokeWidth={5} /><path d="M0,-55 Q20,-20 14,40" stroke="#8E5A90" strokeWidth={8} fill="none" /><path d="M0,-55 Q24,-80 44,-66 Q22,-56 0,-55Z" fill="#4E8E2E" stroke={OUT} strokeWidth={4} /></g>}
    {kind === 1 && <g>{[[0, -40], [-22, -16], [22, -16], [-30, 12], [0, 8], [30, 12], [-16, 36], [16, 36], [0, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={17} fill={i % 2 ? '#5B3A7A' : '#6E4A92'} stroke={OUT} strokeWidth={4} />)}<path d="M0,-58 Q10,-76 30,-70" stroke="#5B3A1E" strokeWidth={6} fill="none" /></g>}
    {kind === 2 && <g>{[-24, -8, 8, 24].map((dx, i) => <g key={i} transform={`rotate(${dx * 0.8})`}><path d="M0,70 L0,-40" stroke="#C9973E" strokeWidth={5} />{[0, 1, 2, 3, 4].map((k) => <ellipse key={k} cx={k % 2 ? 7 : -7} cy={-40 + k * 12} rx={7} ry={11} fill="#E3B35A" stroke={OUT} strokeWidth={3} />)}</g>)}<rect x={-30} y={30} width={60} height={12} fill="#8A6A3A" /></g>}
  </svg>
);

export const S4: React.FC<{t: number; a: number}> = ({t, a}) => {
  const flips = [cues.flipFig, cues.flipGrape, cues.flipWheat];
  const names = ['FIG', 'GRAPE', 'WHEAT'];
  const shake = t > cues.lockedClunk ? wobble(t - cues.lockedClunk, 6, 6) * 8 : 0;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 55%, #4A2E1A 0%, #22150C 60%, #0E0805 100%)'}}>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 20% 80%, rgba(255,170,80,0.25), rgba(0,0,0,0) 45%)'}} />
      <div style={{position: 'absolute', left: 96, top: 880, width: 840, display: 'flex', gap: 18, perspective: 1200}}>
        {[0, 1, 2, 3].map((i) => {
          const deal = out(prog(t, a + i * 0.1, a + i * 0.1 + 0.4));
          const fl = i < 3 ? inOut(prog(t, flips[i] - 0.12, flips[i] + 0.25)) : 0;
          const ang = fl * 180;
          const showFront = ang > 90;
          return (
            <div key={i} style={{flex: 1, height: 300, position: 'relative', transform: `translateY(${(1 - deal) * 120}px) rotateY(${ang}deg) ${i === 3 ? `translateX(${shake}px)` : ''}`, opacity: deal, transformStyle: 'preserve-3d'}}>
              <div style={{position: 'absolute', inset: 0, borderRadius: 18, transform: showFront ? 'rotateY(180deg)' : 'none', boxShadow: '0 14px 30px rgba(0,0,0,0.45)',
                background: showFront ? '#F3ECDF' : 'linear-gradient(135deg,#6E1E18,#3A0E0A)', border: `4px solid ${showFront ? '#C9973E' : '#B88A3A'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                {showFront ? (
                  <>
                    <Fruit kind={i} />
                    <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 28, letterSpacing: '0.14em', color: '#3A2A1C', marginTop: 6}}>{names[i]}</div>
                  </>
                ) : (
                  <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 120, color: GOLD, textShadow: i === 3 ? `0 0 ${20 + 14 * Math.sin(t * 5)}px rgba(242,181,68,0.9)` : 'none', opacity: i === 3 ? 1 : 0.55}}>?</div>
                )}
                {i === 3 && <div style={{position: 'absolute', bottom: 18, fontFamily: SANS, fontWeight: 700, fontSize: 18, letterSpacing: '0.2em', color: GOLD}}>LOCKED</div>}
              </div>
            </div>
          );
        })}
      </div>
      <Label t={t} t0={cues.lockedClunk} t1={cues.lockedClunk + 1.6} x={540} y={1250} text="THE BIBLE DOESN'T SAY" align="center" />
    </AbsoluteFill>
  );
};

// ---------- S8 + S9b: the edits ----------
export const S8: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => (
  <AbsoluteFill>
    <EdenBlur t={t} />
    <EditStrip t={t} t0={cues.strip217} t1={b + 0.2} tag="GOD SAID" before="THOU SHALT SURELY DIE" after="" refText="GENESIS 2:17" y={790} />
    <EditStrip t={t} t0={cues.strip34} t1={b + 0.2} tag="THE SNAKE SAID" before="YE SHALL" after="SURELY DIE" refText="GENESIS 3:4" y={1070}
      insert={{word: 'NOT', at: cues.typeNot, cps: 9, pulseAt: [cues.slot1]}} />
  </AbsoluteFill>
);

export const S9b: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const both = t >= cues.bothEdits - 0.2;
  return (
    <AbsoluteFill>
      <EdenBlur t={t} />
      {!both && <EditStrip t={t} t0={cues.stripEat} t1={cues.bothEdits} tag="GOD SAID" before="THOU SHALT NOT EAT OF IT" after="" refText="GENESIS 2:17" y={790} />}
      {both && <EditStrip t={t} t0={cues.bothEdits - 0.2} t1={b + 0.2} tag="THE SNAKE SAID" before="YE SHALL" after="SURELY DIE" refText="GENESIS 3:4" y={790}
        insert={{word: 'NOT', at: cues.bothEdits - 1.5, cps: 30, pulseAt: [cues.bothEdits + 0.15]}} />}
      <EditStrip t={t} t0={cues.stripEat + 0.9} t1={b + 0.2} tag="EVE SAID" before="…NEITHER SHALL YE" after="IT" refText="GENESIS 3:3" y={1070}
        insert={{word: 'TOUCH', at: cues.typeTouch, cps: 12, pulseAt: [cues.bothEdits + 1.1]}} />
      <Label t={t} t0={cues.tagNeverTouch} t1={cues.bothEdits - 0.1} x={540} y={1370} text="GOD NEVER SAID TOUCH" align="center" />
    </AbsoluteFill>
  );
};
