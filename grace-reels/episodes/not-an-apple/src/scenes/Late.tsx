import {AbsoluteFill} from 'remotion';
import {Cam2, FacetBlob, Layer, OUT, toScreen} from '../lib/draw';
import {Person, Shadow} from '../characters/People';
import {SunGlow} from '../overlays/SunGlow';
import {Label} from '../overlays/Label';
import {ScriptureCard} from '../overlays/ScriptureCard';
import {Logo} from '../overlays/Logo';
import {Apple, RedX} from './Early';
import {focusCam, talk} from './Eden';
import {cues} from '../lib/time';
import {SANS, SERIF} from '../lib/fonts';
import {inOut, lerp, out, outBack, prog, wobble} from '../lib/anim';
import {noise1, rand} from '../lib/random';

const GOLD = '#F2B544';

// ---------- desert at dusk ----------
const Desert: React.FC<{t: number; cam: Cam2; children: React.ReactNode}> = ({t, cam, children}) => {
  const sun = toScreen(cam, 0.1, 800, 1150);
  return (
    <AbsoluteFill>
      <Layer cam={cam} d={0.08}>
        <defs>
          <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4E3A66" /><stop offset="0.35" stopColor="#A9607A" /><stop offset="0.55" stopColor="#E08A68" /><stop offset="0.7" stopColor="#F4B46C" /><stop offset="1" stopColor="#E9A062" />
          </linearGradient>
        </defs>
        <rect x={-900} y={-1200} width={2900} height={4000} fill="url(#dusk)" />
        <circle cx={800} cy={1150} r={70} fill="#FFE7B0" />
      </Layer>
      <Layer cam={cam} d={0.3}>
        <path d="M-600,1240 L-200,1120 L100,1190 L380,1100 L640,1170 L900,1080 L1300,1180 L1700,1120 L1700,1500 L-600,1500Z" fill="#B97A6A" />
        <path d="M-600,1300 L-100,1230 L300,1280 L700,1220 L1100,1290 L1700,1240 L1700,1600 L-600,1600Z" fill="#C98B6E" />
      </Layer>
      <Layer cam={cam} d={0.6}>
        <path d="M-700,1380 Q0,1320 600,1370 Q1100,1410 1800,1360 L1800,2600 L-700,2600Z" fill="#D69A6E" />
        {[[-80, 1380, 120], [1080, 1390, 140], [180, 1400, 60]].map(([x, y, r], i) => <FacetBlob key={i} cx={x} cy={y} rx={r * 1.3} ry={r * 0.8} seed={140 + i} colors={['#8E5E48', '#A06C52', '#B47D5E']} n={8} />)}
      </Layer>
      <Layer cam={cam} d={1}>
        <path d="M-900,1560 Q100,1500 1100,1540 Q1600,1560 2000,1550 L2000,3000 L-900,3000Z" fill="#E1A877" />
        {Array.from({length: 26}, (_, i) => <ellipse key={i} cx={-200 + rand(151, i) * 1500} cy={1600 + rand(152, i) * 320} rx={6 + rand(153, i) * 10} ry={4 + rand(154, i) * 5} fill="#B9845E" />)}
        {[[520, 1690, 40], [600, 1705, 34], [565, 1668, 30], [660, 1690, 28], [480, 1712, 26]].map(([x, y, r], i) => <FacetBlob key={i} cx={x} cy={y} rx={r * 1.25} ry={r * 0.8} seed={160 + i} colors={['#9C7458', '#B98C68', '#D2A47C']} n={7} stroke={OUT} />)}
        {children}
        {Array.from({length: 14}, (_, i) => {
          const x = ((rand(170, i) * 1300 + t * (40 + rand(171, i) * 50)) % 1400) - 160;
          return <circle key={i} cx={x} cy={1300 + rand(172, i) * 500 + Math.sin(t + i) * 20} r={3 + rand(173, i) * 4} fill="#FFE2B8" opacity={0.5} />;
        })}
      </Layer>
      <SunGlow x={sun[0]} y={sun[1]} t={t} strength={0.9} color="255, 196, 140" rays={6} />
    </AbsoluteFill>
  );
};

const Rock: React.FC = () => <FacetBlob cx={300} cy={1540} rx={190} ry={95} seed={181} colors={['#7E5A46', '#946B52', '#A97C5E', '#BE916E']} n={9} stroke={OUT} />;

const Stamp: React.FC<{t: number; at: number; i: number}> = ({t, at, i}) => {
  if (t < at) return null;
  const d = t - at;
  const k = Math.max(0, 1 - d / 0.12);
  const sq = 1 + wobble(d, 4, 8) * 0.12;
  const sheen = prog(d, 0.1, 0.8);
  return (
    <div style={{position: 'absolute', left: 440 + i * 14, top: 780 + i * 112, transform: `rotate(${-7 + i * 3}deg) scale(${(1 + k * 0.6) * sq}, ${(1 + k * 0.6) / sq})`, opacity: 1 - k * 0.6,
      border: `6px solid ${GOLD}`, borderRadius: 16, padding: '10px 22px', background: 'rgba(40,22,8,0.55)', boxShadow: `0 0 34px rgba(242,181,68,0.55)`, overflow: 'hidden'}}>
      <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 52, letterSpacing: '0.06em', color: GOLD, whiteSpace: 'nowrap'}}>IT IS WRITTEN <span style={{fontFamily: SANS, fontSize: 30}}>×{i + 1}</span></div>
      <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 18, letterSpacing: '0.22em', color: '#FFE2A8'}}>{['MATTHEW 4:4', 'MATTHEW 4:7', 'MATTHEW 4:10'][i]}</div>
      <div style={{position: 'absolute', top: 0, bottom: 0, width: 80, left: `${-20 + sheen * 120}%`, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,240,200,0.55), rgba(255,255,255,0))', opacity: sheen < 1 ? 1 : 0}} />
    </div>
  );
};

export const S11S12: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const stand = inOut(prog(t, cues.jesusStands + 0.1, cues.jesusStands + 0.9));
  const antic = Math.sin(prog(t, cues.jesusStands - 0.2, cues.jesusStands + 0.5) * Math.PI) * 10;
  const push = inOut(prog(t, cues.jesusStands, cues.jesusStands + 2.5));
  const wide = {x: lerp(-20, 10, prog(t, a, cues.jesusStands)), y: -60, zoom: 1.04};
  const cam = push > 0 ? {x: lerp(wide.x, -120, push), y: lerp(wide.y, 40, push), zoom: lerp(wide.zoom, 1.25, push)} : wide;
  const leave = inOut(prog(t, cues.devilLeaves, cues.devilLeaves + 1.1));
  const leanIn = inOut(prog(t, a + 0.3, a + 1.4));
  const speak = talk(t, [39, 41]);
  const hood = toScreen(cam, 1, 780 + 0, 1730 - 860);
  return (
    <>
      <Desert t={t} cam={cam}>
        <Rock />
        <Person kind="jesus" t={t} x={300} y={1730} h={820} seed={7}
          pose={{sit: 1 - stand, lean: antic, arm: lerp(20, 50, prog(t, cues.stamp1 - 0.3, cues.stamp1)), bend: 30, head: lerp(8, -2, stand)}}
          face={{smile: lerp(0.05, 0.25, stand), brow: lerp(-0.1, 0.2, stand), open: speak, eyesDown: (1 - stand) * 0.5}} />
        <Shadow x={780 + leave * 160} y={1740} h={1000} t={t} lean={lerp(-2, -9, leanIn) + leave * 14} point={leanIn * (1 - leave)} opacity={1 - leave} />
      </Desert>
      <Label t={t} t0={a + 0.4} t1={cues.jesusStands} x={90} y={790} ax={hood[0]} ay={hood[1]} text="MATTHEW 4 · THAT OLD SERPENT (REV 12:9)" />
      {[cues.stamp1, cues.stamp2, cues.stamp3].map((at, i) => <Stamp key={i} t={t} at={at} i={i} />)}
      <ScriptureCard t={t} t0={cues.stamp1 - 0.1} t1={b + 0.1} size={52} quote="“But he answered and said, *It is written*, Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.”" refText="MATTHEW 4:4 · KJV" />
    </>
  );
};

// ---------- S13: today, a phone at night ----------
export const S13: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const ping = prog(t, cues.notifPing, cues.notifPing + 0.35);
  const pause = prog(t, cues.notifPing + 0.2, cues.notifPing + 0.8);
  const dive = inOut(prog(t, b - 0.45, b));
  const z = lerp(1, 1.12, prog(t, a, b - 0.45)) * (1 + dive * 6);
  const thumb = (1 - pause) * Math.sin(t * 7) * 8;
  const shadowX = lerp(980, 60, prog(t, cues.snakeShadow - 0.2, cues.snakeShadow + 1.1));
  return (
    <AbsoluteFill style={{background: '#0B1020'}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, transform: `scale(${z})`, transformOrigin: '560px 1170px'}}>
        <defs>
          <radialGradient id="phoneLight"><stop offset="0" stopColor="#BFE3FF" stopOpacity={0.6} /><stop offset="1" stopColor="#BFE3FF" stopOpacity={0} /></radialGradient>
          <radialGradient id="bulb"><stop offset="0" stopColor="#FFD58A" /><stop offset="1" stopColor="#FFD58A" stopOpacity={0} /></radialGradient>
        </defs>
        <rect x={0} y={0} width={1080} height={1920} fill="#141B33" />
        <rect x={620} y={520} width={330} height={460} rx={12} fill="#1E3566" stroke="#0A0F1E" strokeWidth={18} />
        <circle cx={860} cy={610} r={40} fill="#E8F0FF" opacity={0.9} />
        {Array.from({length: 16}, (_, i) => <rect key={i} x={640 + rand(191, i) * 290} y={860 + rand(192, i) * 100} width={10} height={14} fill="#FFD58A" opacity={0.6} />)}
        <path d="M60,560 Q540,640 1020,560" stroke="#3A3A3A" strokeWidth={3} fill="none" />
        {Array.from({length: 11}, (_, i) => {
          const x = 60 + i * 96, y = 560 + Math.sin((i / 10) * Math.PI) * 42;
          return <g key={i}><circle cx={x} cy={y} r={40} fill="url(#bulb)" opacity={0.6 + 0.3 * Math.sin(t * 2 + i)} /><circle cx={x} cy={y} r={8} fill="#FFE3A8" /></g>;
        })}
        <path d="M80,1440 L1000,1440 L1040,1700 L40,1700Z" fill="#2E3A5E" stroke="#0A0F1E" strokeWidth={10} />
        <path d="M80,1440 L1000,1440 L1000,1380 Q540,1350 80,1380Z" fill="#46557E" />
        <rect x={120} y={1300} width={260} height={110} rx={40} fill="#D9DEEA" stroke="#0A0F1E" strokeWidth={8} />
        <circle cx={560} cy={1150} r={260} fill="url(#phoneLight)" />
        <Person kind="teen" t={t} x={520} y={1440} h={700} seed={9} pose={{sit: 1, arm: 30 + thumb * 0.2, bend: 95, backArm: 25, backBend: 100, head: lerp(10, 16, pause)}}
          face={{smile: lerp(0.3, -0.2, pause), furrow: pause, brow: lerp(0, 0.3, pause), eyesDown: 1}}
          hold={<g transform="rotate(-20)"><rect x={-34} y={-70} width={68} height={120} rx={12} fill="#111" /><rect x={-28} y={-62} width={56} height={102} rx={8} fill="#BFE3FF" /></g>} />
      </svg>
      {ping > 0 && (
        <div style={{position: 'absolute', left: 92, top: 770, width: 848, transform: `translateY(${(1 - out(ping)) * -40}px) scale(${0.9 + outBack(ping) * 0.1})`, opacity: ping,
          background: 'rgba(245,247,252,0.94)', borderRadius: 30, padding: '24px 28px', display: 'flex', gap: 22, alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden'}}>
          <div style={{width: 76, height: 76, borderRadius: 20, background: 'linear-gradient(135deg,#2F7A3A,#1A4A24)', flexShrink: 0}} />
          <div>
            <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 22, color: '#6A6F7A', letterSpacing: '0.04em'}}>A THOUGHT · now</div>
            <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 38, color: '#14161C'}}>Did God really say…?</div>
          </div>
          <svg width={848} height={140} style={{position: 'absolute', left: 0, top: 0}}>
            <path d={`M${shadowX},90 q30,-22 60,0 t60,0 t60,0 t60,0`} stroke="rgba(10,30,15,0.55)" strokeWidth={16} fill="none" strokeLinecap="round" />
          </svg>
        </div>
      )}
      {dive > 0.6 && <AbsoluteFill style={{background: '#FFFFFF', opacity: (dive - 0.6) / 0.4}} />}
    </AbsoluteFill>
  );
};

// ---------- S14: the apple turns to gold dust and flows into the Bible ----------
const OpenBible: React.FC<{glow: number}> = ({glow}) => (
  <g transform="translate(540,1330)">
    <ellipse cx={0} cy={40} rx={420} ry={70} fill="#000" opacity={0.4} />
    <path d="M-400,-40 Q-200,-90 0,-50 Q200,-90 400,-40 L400,60 Q200,10 0,50 Q-200,10 -400,60Z" fill="#5A2E18" stroke={OUT} strokeWidth={8} />
    <path d="M-380,-50 Q-200,-110 -10,-60 L-10,40 Q-200,0 -380,46Z" fill="#F4EAD2" stroke="#B89A66" strokeWidth={4} />
    <path d="M380,-50 Q200,-110 10,-60 L10,40 Q200,0 380,46Z" fill="#F4EAD2" stroke="#B89A66" strokeWidth={4} />
    {Array.from({length: 6}, (_, i) => <path key={i} d={`M-340,${-40 + i * 14} Q-200,${-80 + i * 14} -40,${-46 + i * 14} M40,${-46 + i * 14} Q200,${-80 + i * 14} 340,${-40 + i * 14}`} stroke="#C9B48A" strokeWidth={3} fill="none" />)}
    <ellipse cx={0} cy={-60} rx={300 + glow * 80} ry={110 + glow * 40} fill="url(#bibleGlow)" opacity={glow} />
  </g>
);

export const S14: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const brk = prog(t, cues.appleBreak, cues.appleBreak + 1.6);
  const textIn = out(prog(t, cues.whatDidGodSay - 0.1, cues.whatDidGodSay + 0.4));
  const bibleIn = out(prog(t, cues.appleBreak - 0.4, cues.appleBreak + 0.4));
  const glow = prog(t, cues.appleBreak + 0.5, cues.appleBreak + 2.2);
  const N = 140;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 60%, rgba(90,52,20,${glow * 0.9}) 0%, #0B0705 60%, #000 100%)`}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="bibleGlow"><stop offset="0" stopColor="#FFF1C8" /><stop offset="0.4" stopColor="#F2B544" stopOpacity={0.6} /><stop offset="1" stopColor="#F2B544" stopOpacity={0} /></radialGradient>
          <radialGradient id="dust"><stop offset="0" stopColor="#FFF6D6" /><stop offset="0.5" stopColor="#F2B544" stopOpacity={0.8} /><stop offset="1" stopColor="#F2B544" stopOpacity={0} /></radialGradient>
        </defs>
        <g opacity={bibleIn}><OpenBible glow={glow} /></g>
        <Apple t={t} size={420} x={540} y={850} opacity={1 - prog(brk, 0, 0.5)} dim={0.15} />
        {brk > 0 && Array.from({length: N}, (_, i) => {
          const start = rand(201, i) * 0.45;
          const k = prog(brk, start, start + 0.55);
          if (k <= 0 || k >= 1) return null;
          const a0 = rand(202, i) * Math.PI * 2, r0 = Math.sqrt(rand(203, i)) * 190;
          const x0 = 540 + Math.cos(a0) * r0, y0 = 850 + Math.sin(a0) * r0;
          const x1 = 540 + (rand(204, i) - 0.5) * 300, y1 = 1290;
          const e = inOut(k);
          const x = lerp(x0, x1, e) + Math.sin(k * Math.PI * 2 + i) * 60 * (1 - e);
          const y = lerp(y0, y1, e) - Math.sin(k * Math.PI) * 80;
          return <circle key={i} cx={x} cy={y} r={10 + rand(205, i) * 12} fill="url(#dust)" opacity={1 - k * 0.3} />;
        })}
      </svg>
      {t < cues.appleBreak + 0.4 && <RedX t={t} at={a + 0.05} x={540} y={850} size={430} />}
      <div style={{position: 'absolute', left: 0, right: 0, top: 800, textAlign: 'center', opacity: textIn, transform: `scale(${0.9 + textIn * 0.1})`,
        fontFamily: SERIF, fontWeight: 700, fontSize: 112, lineHeight: 1, letterSpacing: '0.04em', color: GOLD, textShadow: '0 0 50px rgba(242,181,68,0.6)'}}>
        WHAT DID<br />GOD SAY?
      </div>
    </AbsoluteFill>
  );
};

// ---------- S15: call to action ----------
export const S15: React.FC<{t: number; a: number}> = ({t, a}) => {
  const inK = out(prog(t, a, a + 0.5));
  const tap = t >= cues.tapYes ? 1 + wobble(t - cues.tapYes, 4, 7) * -0.12 : 1;
  const msg = 'Yes 😅 my whole life';
  const chars = Array.from(msg);
  const n = Math.floor(Math.max(0, t - cues.typeComment) * 14);
  const typed = chars.slice(0, n).join('');
  const done = n >= chars.length;
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 50%, #3A2414 0%, #1A0F08 60%, #0B0604 100%)'}}>
      <div style={{position: 'absolute', left: 72, width: 888, top: 960, display: 'flex', gap: 28, opacity: inK, transform: `translateY(${(1 - inK) * 30}px)`}}>
        {['YES', 'NO'].map((w, i) => (
          <div key={w} style={{flex: 1, height: 120, borderRadius: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 44, letterSpacing: '0.12em',
            transform: `scale(${i === 0 ? tap : 1})`, background: i === 0 ? (t >= cues.tapYes ? GOLD : 'rgba(242,181,68,0.18)') : 'rgba(255,248,236,0.08)',
            color: i === 0 && t >= cues.tapYes ? '#2A1A08' : '#FFF8EC', border: `3px solid ${i === 0 ? GOLD : 'rgba(255,248,236,0.5)'}`, boxShadow: i === 0 && t >= cues.tapYes ? '0 0 40px rgba(242,181,68,0.6)' : 'none'}}>{w}</div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 72, width: 888, top: 1150, height: 100, borderRadius: 50, background: '#F3ECDF', display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', boxSizing: 'border-box', opacity: inK}}>
        <div style={{width: 58, height: 58, borderRadius: 29, background: '#9A5B0C'}} />
        <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 36, color: '#2B1D14'}}>{typed}{!done && Math.floor(t * 4) % 2 === 0 && <span style={{color: '#9A5B0C'}}>|</span>}</div>
      </div>
      {done && Array.from({length: 7}, (_, i) => {
        const k = prog(t, cues.typeComment + chars.length / 14 + i * 0.12, cues.typeComment + chars.length / 14 + i * 0.12 + 1.4);
        if (k <= 0 || k >= 1) return null;
        return <div key={i} style={{position: 'absolute', left: 820 + Math.sin(k * 6 + i) * 30 - i * 14, top: 1150 - k * 320, fontSize: 44, opacity: 1 - k, color: '#E2453A'}}>♥</div>;
      })}
    </AbsoluteFill>
  );
};

// ---------- S16: end card, flowing back to the apple so the reel loops ----------
export const S16: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const draw = prog(t, a, a + 1.4);
  const txt = out(prog(t, a + 0.9, a + 1.5));
  const loop = prog(t, b - 0.35, b);
  return (
    <AbsoluteFill style={{background: '#0B0705'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - loop}}>
        <Logo size={230} draw={draw} stroke={2} />
        <div style={{marginTop: 40, fontFamily: SERIF, fontWeight: 700, fontSize: 78, letterSpacing: '0.12em', color: '#FFF8EC', opacity: txt}}>GRACE IN MOTION</div>
        <div style={{marginTop: 12, fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: '0.06em', color: GOLD, opacity: txt}}>@GraceINMotion616</div>
        <div style={{marginTop: 26, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 50, color: 'rgba(255,248,236,0.85)', opacity: txt}}>Hard questions. Bible answers.</div>
      </div>
      {loop > 0 && (
        <AbsoluteFill style={{opacity: loop, background: 'radial-gradient(circle at 50% 42%, #2A140C 0%, #0B0705 45%, #000 80%)'}}>
          <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}><Apple t={0} size={470} x={540} y={830} /></svg>
          <div style={{position: 'absolute', left: 0, right: 0, top: 1110, textAlign: 'center', fontFamily: SERIF, fontWeight: 700}}>
            <div style={{fontSize: 100, color: '#FFFFFF', letterSpacing: '0.04em', lineHeight: 1}}>IT WASN'T</div>
            <div style={{fontSize: 130, color: GOLD, letterSpacing: '0.03em', lineHeight: 1.05, textShadow: '0 0 40px rgba(242,181,68,0.55)'}}>AN APPLE.</div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
export {focusCam, noise1};
