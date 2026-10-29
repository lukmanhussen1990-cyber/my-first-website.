import {AbsoluteFill} from 'remotion';
import {Cam2, FacetBlob, Layer, Pt, path, toScreen, OUT} from '../lib/draw';
import {Person, Serpent} from '../characters/People';
import {SunGlow} from '../overlays/SunGlow';
import {ScriptureCard} from '../overlays/ScriptureCard';
import {Label} from '../overlays/Label';
import {cues, segWords} from '../lib/time';
import {inOut, lerp, mix, out, prog} from '../lib/anim';
import {noise1, rand} from '../lib/random';

const GREENS = ['#4E7A26', '#66922F', '#86B03A', '#A8C944', '#C2DA5E'];
export const SUN: Pt = [210, 600];
export const EVE_X = 330, EVE_Y = 1700, EVE_H = 780;
export const EVE_HEAD: Pt = [EVE_X + EVE_H * 0.024, EVE_Y - EVE_H * 0.888];

// serpent track in the subject plane: coils on the trunk, along the low branch, then toward Eve
export const TRACK: Pt[] = [[950, 1420], [800, 1360], [948, 1290], [800, 1220], [946, 1150], [810, 1085], [770, 1010], [680, 980], [610, 968], [560, 962], [515, 968]];

export const focusCam = (wx: number, wy: number, zoom: number, sx = 540, sy = 1050): Cam2 => ({
  zoom, x: wx - 540 - (sx - 540) / zoom, y: wy - 960 - (sy - 960) / zoom,
});

const TreeAndBranch: React.FC<{t: number; glow: number; wind: number}> = ({t, glow, wind}) => {
  const sw = Math.sin(t * 0.9) * 6 * wind;
  return (
    <g>
      <path d="M800,1740 Q840,1500 830,1250 Q815,1000 860,760 L960,760 Q930,1000 955,1250 Q975,1500 1010,1740 Q980,1760 905,1750Z" fill="#7A4B2B" stroke={OUT} strokeWidth={8} />
      {[[815, 1000, 860, 1600], [900, 800, 930, 1700], [870, 1300, 900, 1450]].map(([a, b, c, d], i) => (
        <path key={i} d={`M${a},${b} L${c},${d}`} stroke="#5E381F" strokeWidth={10} opacity={0.5} />
      ))}
      <path d="M760,1740 Q820,1700 830,1660 L870,1740Z M1000,1740 Q960,1700 960,1650 L930,1740Z" fill="#6A3F23" stroke={OUT} strokeWidth={6} />
      <path d={`M860,1020 Q700,965 560,955 Q480,955 420,985 Q485,975 560,978 Q700,990 850,1070Z`} fill="#6E4527" stroke={OUT} strokeWidth={7} />
      <path d="M900,800 Q760,600 640,560 M930,790 Q1010,600 1080,520" stroke="#6E4527" strokeWidth={36} strokeLinecap="round" fill="none" />
      <g transform={`rotate(${sw * 0.15} 880 700)`}>
        {[[640, 420, 300, 240], [930, 340, 330, 280], [420, 600, 220, 170], [1040, 640, 220, 200], [780, 160, 320, 240], [470, 250, 260, 200], [680, 660, 240, 170], [260, 420, 190, 150]].map(([cx, cy, rx, ry], i) => (
          <FacetBlob key={i} cx={cx} cy={cy} rx={rx} ry={ry} seed={200 + i} colors={GREENS} n={12} light={-2.4} />
        ))}
        {Array.from({length: 70}, (_, i) => {
          const a = rand(301, i) * Math.PI * 2;
          const cx = 260 + rand(302, i) * 860, cy = 120 + rand(303, i) * 640;
          const s = 22 + rand(304, i) * 26;
          return <path key={i} d={path([[cx, cy - s], [cx + s * 0.6, cy + s * 0.2], [cx - s * 0.5, cy + s * 0.4]])} fill={GREENS[2 + (i % 3)]} transform={`rotate(${(a * 57) % 360 + Math.sin(t * 1.4 + i) * 6 * wind} ${cx} ${cy})`} />;
        })}
        {/* the fruit is never shown: only warm light hidden in the leaves */}
        {[[560, 640], [760, 700], [980, 610], [430, 560], [880, 520], [660, 520]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={46 + Math.sin(t * 2 + i) * 4} fill="url(#fruitGlow)" opacity={0.25 + glow * 0.75} />
        ))}
      </g>
    </g>
  );
};

export const EdenWorld: React.FC<{t: number; cam: Cam2; drain?: number; glow?: number; wind?: number; children?: React.ReactNode; front?: React.ReactNode; blur?: number}> = ({
  t, cam, drain = 0, glow = 1, wind = 1, children, front, blur = 0,
}) => {
  const sun = toScreen(cam, 0.08, SUN[0], SUN[1]);
  return (
    <AbsoluteFill style={{filter: `saturate(${1 - drain * 0.85}) brightness(${1 - drain * 0.18})${blur ? ` blur(${blur}px)` : ''}`, background: '#F2CF8C'}}>
      <Layer cam={cam} d={0.08}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F3D9A6" />
            <stop offset="0.45" stopColor="#FBE6B4" />
            <stop offset="0.62" stopColor="#F5CF8A" />
            <stop offset="1" stopColor="#E9C27A" />
          </linearGradient>
          <radialGradient id="fruitGlow">
            <stop offset="0" stopColor="#FFF6D8" />
            <stop offset="0.3" stopColor="#FFD98A" stopOpacity={0.85} />
            <stop offset="1" stopColor="#FFC85A" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={-900} y={-1400} width={2900} height={4200} fill="url(#sky)" />
      </Layer>
      <Layer cam={cam} d={0.2}>
        {[[-200, 980, 260, 120], [80, 930, 300, 160], [420, 960, 280, 130], [760, 920, 320, 170], [1100, 960, 280, 120]].map(([x, y, w, hh], i) => (
          <path key={i} d={`M${x - w},${y + 140} L${x - w * 0.4},${y - hh * 0.4} L${x},${y - hh} L${x + w * 0.5},${y - hh * 0.3} L${x + w},${y + 140}Z`} fill={['#E8C9A3', '#E2BF98', '#EAD0AC', '#DDB892', '#E6C6A0'][i]} />
        ))}
      </Layer>
      <Layer cam={cam} d={0.35}>
        {[[-250, 830, 300], [30, 870, 240], [250, 900, 230], [520, 940, 220], [760, 900, 260], [1050, 860, 300]].map(([x, top, w], i) => (
          <g key={i}>
            <path d={`M${x},${top + 20} L${x + w * 0.3},${top} L${x + w * 0.7},${top + 12} L${x + w},${top + 30} L${x + w + 10},1240 L${x - 10},1240Z`} fill={i % 2 ? '#D6A889' : '#CB9C7E'} />
            <path d={`M${x},${top + 20} L${x + w * 0.3},${top} L${x + w * 0.7},${top + 12} L${x + w},${top + 30} L${x + w},${top + 60} Q${x + w / 2},${top + 30} ${x},${top + 60}Z`} fill="#93A75A" />
            <path d={`M${x + w * 0.62},${top + 40} L${x + w * 0.72},${top + 40} L${x + w * 0.76},1240 L${x + w * 0.58},1240Z`} fill="rgba(0,0,0,0.06)" />
          </g>
        ))}
        {[[175, 880], [610, 950]].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width={38} height={1220 - y} fill="#F4FBF8" opacity={0.9} />
            {[0, 1, 2, 3].map((k) => <rect key={k} x={x + 6 + k * 8} y={y + ((t * 220 + k * 90) % (1220 - y))} width={4} height={60} fill="#FFFFFF" />)}
            <ellipse cx={x + 19} cy={1222} rx={70} ry={26} fill="#FFFFFF" opacity={0.7} />
          </g>
        ))}
        {Array.from({length: 16}, (_, i) => {
          const x = -150 + i * 85 + rand(41, i) * 40, hh = 150 + rand(42, i) * 120, base = 1250 + rand(43, i) * 30;
          return <path key={i} d={`M${x},${base} L${x + 24},${base - hh} L${x + 48},${base}Z`} fill={i % 2 ? '#5E8A3A' : '#4F7A33'} opacity={0.85} />;
        })}
      </Layer>
      <Layer cam={cam} d={0.6}>
        <rect x={-700} y={1240} width={2500} height={1400} fill="#8BB246" />
        <path d="M1400,1270 Q900,1265 620,1300 Q300,1340 -400,1330 L-400,1390 Q300,1405 640,1362 Q930,1325 1400,1330Z" fill="#7CC1D6" />
        <path d="M1400,1280 Q900,1278 620,1312 Q300,1352 -400,1344" fill="none" stroke="#B7E6F0" strokeWidth={5} opacity={0.8} />
        {Array.from({length: 26}, (_, i) => {
          const u = rand(51, i);
          const x = -300 + u * 1700, y = 1300 + 40 * (1 - u) + rand(52, i) * 30;
          const k = Math.pow(Math.max(0, Math.sin(t * (2 + rand(53, i) * 3) + i)), 6);
          return <path key={i} d={`M${x - 14},${y} L${x},${y - 4} L${x + 14},${y} L${x},${y + 4}Z`} fill="#FFFDF0" opacity={k} />;
        })}
        {[[-180, 1300, 90], [60, 1290, 70], [480, 1275, 80], [1180, 1270, 90], [1320, 1290, 70]].map(([x, y, r], i) => (
          <FacetBlob key={i} cx={x} cy={y} rx={r * 1.4} ry={r} seed={60 + i} colors={['#4F7E28', '#5E8E2F', '#6E9E36', '#7FB040']} n={8} />
        ))}
        {[[150, 1370, 60], [420, 1355, 46], [1000, 1360, 55]].map(([x, y, r], i) => (
          <FacetBlob key={i} cx={x} cy={y} rx={r * 1.3} ry={r * 0.6} seed={70 + i} colors={['#9C8B7D', '#A3948A', '#B5A79A']} n={7} />
        ))}
      </Layer>
      <Layer cam={cam} d={1}>
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#97BC4B" />
            <stop offset="1" stopColor="#6A9631" />
          </linearGradient>
        </defs>
        <path d="M-900,1420 Q200,1360 1100,1400 Q1600,1420 2000,1420 L2000,3000 L-900,3000Z" fill="url(#grass)" />
        <ellipse cx={850} cy={1500} rx={520} ry={110} fill="#C0D35E" opacity={0.35} />
        {Array.from({length: 90}, (_, i) => {
          const x = -300 + rand(81, i) * 1700, y = 1450 + rand(82, i) * 450;
          const hh = 18 + rand(83, i) * 26;
          return <path key={i} d={`M${x},${y} L${x + 5 + Math.sin(t * 2 + i) * 3 * wind},${y - hh} L${x + 10},${y}Z`} fill={i % 3 ? '#7DA83A' : '#A3C851'} />;
        })}
        {Array.from({length: 40}, (_, i) => {
          const x = -200 + rand(84, i) * 1500, y = 1460 + rand(85, i) * 420;
          return <circle key={i} cx={x} cy={y} r={7 + rand(86, i) * 5} fill={['#FFFFFF', '#FFF3F0', '#E2453A', '#F4C542'][i % 4]} />;
        })}
        <TreeAndBranch t={t} glow={glow} wind={wind} />
        {children}
      </Layer>
      <AbsoluteFill style={{mixBlendMode: 'screen', opacity: 1 - drain * 0.8}}>
        <SunGlow x={sun[0]} y={sun[1]} t={t} strength={1.1} rays={8} />
      </AbsoluteFill>
      {front && <Layer cam={cam} d={1.5} style={{filter: 'blur(7px)'}}>{front}</Layer>}
    </AbsoluteFill>
  );
};

const FgFlowers: React.FC<{t: number}> = ({t}) => (
  <g>
    {[[-60, 1860, 1], [180, 1930, 0.8], [880, 1880, 1.1], [1120, 1840, 0.9]].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x},${y}) scale(${s})`}>
        {Array.from({length: 7}, (_, k) => (
          <path key={k} d="M0,0 Q40,-90 0,-200 Q-40,-90 0,0Z" fill={k % 2 ? '#5C9230' : '#7DB23E'} transform={`rotate(${-70 + k * 22 + Math.sin(t * 1.2 + k) * 3})`} />
        ))}
        {[0, 1, 2].map((k) => <circle key={k} cx={-50 + k * 50} cy={-150 - (k % 2) * 40} r={22} fill={k === 1 ? '#E2453A' : '#FFFFFF'} />)}
      </g>
    ))}
  </g>
);

// speaking: mouth opens on each spoken word of the given segments
export const talk = (t: number, segIds: number[]) => {
  for (const id of segIds) for (const w of segWords(id)) if (t >= w.start && t <= w.end) return 0.35 + 0.45 * Math.abs(Math.sin((t - w.start) * 18));
  return 0;
};

// ---------- S5: crane down, Adam and Eve walk in ----------
export const S5: React.FC<{t: number; a: number}> = ({t, a}) => {
  const k = inOut(prog(t, a, a + 2.6));
  const cam = {x: lerp(-30, 0, k), y: lerp(-760, 0, k), zoom: lerp(1.12, 1, k)};
  const w = prog(t, a - 0.2, a + 2.6);
  return (
    <EdenWorld t={t} cam={cam} front={<FgFlowers t={t} />}>
      <Person kind="adam" t={t} x={lerp(-260, 140, out(w))} y={1690} h={820} seed={3} pose={{walk: t * 0.9, walkAmt: 1 - out(w) * 0.9}} face={{smile: 0.6}} />
      <Person kind="eve" t={t} x={lerp(-120, EVE_X, out(w))} y={EVE_Y} h={EVE_H} pose={{walk: t * 0.95 + 0.3, walkAmt: 1 - out(w) * 0.9, head: -4}} face={{smile: 0.75, brow: 0.3}} />
    </EdenWorld>
  );
};

// ---------- S6: the serpent slides down the branch toward Eve ----------
export const S6: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const k = inOut(prog(t, a, b));
  const cam = {x: lerp(230, -30, k), y: lerp(-60, 20, k), zoom: lerp(1.3, 1.12, k)};
  const head = lerp(0.42, 1, inOut(prog(t, cues.snakeSlide - 0.1, cues.snakeSlide + 3.4)));
  const speak = talk(t, [17]);
  const listen = prog(t, cues.snakeSaid, cues.snakeSaid + 0.8);
  return (
    <>
      <EdenWorld t={t} cam={cam} front={<FgFlowers t={t} />}>
        <Person kind="adam" t={t} x={140} y={1690} h={820} seed={3} face={{smile: 0.4}} pose={{head: -2}} />
        <Person kind="eve" t={t} x={EVE_X} y={EVE_Y} h={EVE_H} pose={{head: lerp(0, -9, listen), arm: lerp(8, 24, listen), bend: 16}} face={{smile: lerp(0.6, 0.25, listen), brow: lerp(0.2, 0.5, listen), open: 0.05, look: 1}} />
        <Serpent track={TRACK} head={head} length={0.62} t={t} open={speak * 0.8} tongue={speak > 0 ? 0.3 : 0.8} />
      </EdenWorld>
      <ScriptureCard t={t} t0={cues.cardGen31} t1={cues.cardGen31 + 4.6} quote="“…Yea, hath God *said*, Ye shall not eat of every tree of the garden?”" refText="GENESIS 3:1 · KJV" />
    </>
  );
};

// ---------- S7: push-in on Eve; a question mark hooks into her thoughts ----------
export const S7: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const z = lerp(2.15, 2.6, inOut(prog(t, a, b)));
  const cam = focusCam(EVE_HEAD[0] + 40, EVE_HEAD[1], z, 470, 1080);
  const unsure = prog(t, cues.doubtWord - 0.15, cues.doubtWord + 0.5);
  const listen = prog(t, a, a + 0.6);
  const face = {smile: lerp(lerp(0.6, 0.2, listen), -0.4, unsure), brow: lerp(0.45, 0.15, unsure), furrow: unsure, open: 0.04, look: lerp(1, -1, unsure), eyesDown: unsure * 0.6};
  const snakeHead = toScreen(cam, 1, 515, 968);
  const eveTop = toScreen(cam, 1, EVE_HEAD[0], EVE_HEAD[1] - 130);
  const bub: Pt = [eveTop[0] - 60, Math.max(780, eveTop[1] - 90)];
  const draw = out(prog(t, cues.doubtHook, cues.doubtHook + 1.1));
  const bubIn = out(prog(t, cues.doubtHook + 0.7, cues.doubtHook + 1.1));
  const q = `M${snakeHead[0] + 40},${snakeHead[1] - 30} C${snakeHead[0] + 120},${snakeHead[1] - 260} ${bub[0] + 260},${bub[1] - 120} ${bub[0] + 30},${bub[1] - 10}`;
  return (
    <>
      <EdenWorld t={t} cam={cam}>
        <Person kind="eve" t={t} x={EVE_X} y={EVE_Y} h={EVE_H} pose={{head: lerp(-8, 4, unsure)}} face={face} />
        <Serpent track={TRACK} head={1} length={0.62} t={t} open={0.15} tongue={0.6} />
      </EdenWorld>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <path d={q} fill="none" stroke="#F2B544" strokeWidth={10} strokeLinecap="round" strokeDasharray={1400} strokeDashoffset={1400 * (1 - draw)} opacity={1 - bubIn * 0.6} />
        {bubIn > 0 && (
          <g transform={`translate(${bub[0]},${bub[1]}) scale(${0.6 + bubIn * 0.4})`} opacity={bubIn}>
            <circle cx={150} cy={170} r={14} fill="#FFF8EC" />
            <circle cx={110} cy={130} r={22} fill="#FFF8EC" />
            <ellipse cx={0} cy={0} rx={130} ry={95} fill="#FFF8EC" />
            <text x={0} y={46} textAnchor="middle" fontFamily='"Cormorant Garamond", serif' fontWeight={700} fontSize={150} fill="#9A5B0C">?</text>
          </g>
        )}
      </svg>
    </>
  );
};

// ---------- S9 opening: Eve speaking to the serpent ----------
export const S9a: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const cam = focusCam(EVE_HEAD[0] + 120, EVE_HEAD[1] + 140, lerp(1.55, 1.7, prog(t, a, b)), 480, 1140);
  const speak = 0.2 + 0.5 * Math.abs(Math.sin(t * 9)) * (noise1(t * 3, 5) > -0.3 ? 1 : 0.2);
  return (
    <EdenWorld t={t} cam={cam}>
      <Person kind="adam" t={t} x={140} y={1690} h={820} seed={3} face={{smile: 0.2}} />
      <Person kind="eve" t={t} x={EVE_X} y={EVE_Y} h={EVE_H} pose={{arm: 40 + Math.sin(t * 2.2) * 12, bend: 30, head: -4}} face={{smile: 0.15, brow: 0.3, open: speak, look: 1}} />
      <Serpent track={TRACK} head={1} length={0.62} t={t} open={0.1} tongue={0.5} />
    </EdenWorld>
  );
};

// ---------- S10: she gives, he eats too; the colour drains ----------
export const S10: React.FC<{t: number; a: number; b: number}> = ({t, a, b}) => {
  const k = prog(t, a, b);
  const cam = {x: lerp(-150, -110, k), y: lerp(40, 0, k), zoom: lerp(1.2, 1.02, inOut(k))};
  const give = inOut(prog(t, cues.give, cues.give + 1.0));
  const eat = inOut(prog(t, cues.eat - 0.5, cues.eat + 0.15));
  const drain = inOut(prog(t, cues.eat, cues.eat + 2.0));
  const shame = inOut(prog(t, cues.eat + 0.7, cues.eat + 1.5));
  const orb: Pt = eat > 0 ? [lerp(228, 136, eat), lerp(1252, 1006, eat)] : [lerp(275, 228, give), lerp(1285, 1252, give)];
  const orbO = 1 - prog(t, cues.eat + 0.1, cues.eat + 0.5);
  const leafT = prog(t, cues.eat + 0.6, cues.eat + 3.4);
  const head = toScreen(cam, 1, 80, 960);
  return (
    <>
      <EdenWorld t={t} cam={cam} drain={drain} glow={1 - drain} wind={1 - drain}>
        <Person kind="adam" t={t} x={60} y={1690} h={820} seed={3}
          pose={{arm: lerp(lerp(8, 30, give), 160, eat), bend: lerp(lerp(10, 20, give), -160, eat), head: shame * 16}}
          face={{smile: lerp(0.4, -0.45, shame), brow: lerp(0.2, -0.1, shame), eyesDown: shame, open: eat > 0.8 && shame < 0.2 ? 0.3 : 0}} />
        <Person kind="eve" t={t} x={430} y={EVE_Y} h={EVE_H} flip pose={{arm: lerp(10, 45, give), bend: 15, head: shame * 14}}
          face={{smile: lerp(0.3, -0.45, shame), furrow: shame * 0.6, eyesDown: shame}} />
        {orbO > 0 && <circle cx={orb[0]} cy={orb[1]} r={34} fill="url(#fruitGlow)" opacity={orbO} />}
        {orbO > 0 && <circle cx={orb[0]} cy={orb[1]} r={90} fill="url(#fruitGlow)" opacity={orbO * 0.5} />}
        {leafT > 0 && leafT < 1 && (
          <path d="M0,0 Q22,-30 0,-64 Q-22,-30 0,0Z" fill="#7DA83A" stroke={OUT} strokeWidth={4}
            transform={`translate(${600 - leafT * 220 + Math.sin(leafT * 9) * 60},${700 + leafT * 900}) rotate(${leafT * 500})`} />
        )}
      </EdenWorld>
      <Label t={t} t0={cues.give + 0.2} t1={b} x={250} y={820} ax={head[0]} ay={head[1] - 40} text="GENESIS 3:6" />
    </>
  );
};

export const EdenBlur: React.FC<{t: number; dark?: number}> = ({t, dark = 0.55}) => (
  <>
    <EdenWorld t={t} cam={{x: 40, y: -40, zoom: 1.15}} blur={16}>
      <Person kind="eve" t={t} x={EVE_X} y={EVE_Y} h={EVE_H} />
      <Serpent track={TRACK} head={1} length={0.62} t={t} />
    </EdenWorld>
    <AbsoluteFill style={{background: `rgba(24,16,10,${dark})`}} />
  </>
);
export {mix};
