import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Person} from '../chars/Person';
import * as C from '../chars/cast';
import {OUTLINE} from '../lib/theme';
import {E, SC, TL} from '../lib/timeline';
import {blink, clamp, easeInOut, easeOut, handheld, lerp, noise1, rand, randRange, smooth} from '../lib/anim';
import {Beam, Dust, Layer} from './kit';
import {Label} from '../ui/Label';
import {P, smoothClosed, smoothOpen} from '../chars/geom';

/** Mouth openness while the voice reads the given clips (lip movement for a speaking character). */
export const talkAmount = (t: number, segs: number[]) => {
  const w = TL.words.find((x) => segs.includes(x.segment) && t >= x.start && t <= x.end);
  if (!w) return 0;
  const k = (t - w.start) / Math.max(0.08, w.end - w.start);
  return Math.sin(k * Math.PI) * (0.6 + 0.4 * Math.abs(Math.sin(t * 23)));
};

/** Faceted low-poly ridge: a band of triangles between a ridge line and a base. */
const Ridge: React.FC<{seed: number; y: number; amp: number; base: number; c1: string; c2: string; w?: number; x0?: number; n?: number}> = ({seed, y, amp, base, c1, c2, w = 2600, x0 = -700, n = 18}) => {
  const pts: P[] = Array.from({length: n + 1}).map((_, i) => [x0 + (i / n) * w, y - rand(seed, i) * amp]);
  const tris: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1];
    const mid: P = [(a[0] + b[0]) / 2 + randRange(seed + 1, i, -40, 40), base];
    tris.push(<path key={'a' + i} d={`M${a[0]},${a[1]} L${b[0]},${b[1]} L${mid[0]},${mid[1]} Z`} fill={i % 2 ? c1 : c2} />);
    tris.push(<path key={'b' + i} d={`M${a[0]},${a[1]} L${mid[0]},${mid[1]} L${a[0]},${base} Z`} fill={i % 2 ? c2 : c1} />);
    tris.push(<path key={'c' + i} d={`M${b[0]},${b[1]} L${mid[0]},${mid[1]} L${b[0]},${base} Z`} fill={i % 2 ? c2 : c1} />);
  }
  return (
    <g>
      {tris}
      <path d={'M' + pts.map((p) => `${p[0]},${p[1]}`).join(' L')} fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" opacity={0.55} />
    </g>
  );
};
const Rock: React.FC<{x: number; y: number; s: number; c?: string}> = ({x, y, s, c = '#B49072'}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-60,0 L-44,-46 L-6,-66 L40,-50 L64,0 Z" fill={c} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
    <path d="M-6,-66 L4,-10 L64,0 L40,-50 Z" fill="rgba(60,30,10,0.18)" />
  </g>
);
const Tuft: React.FC<{x: number; y: number; s: number; t: number; seed: number; c?: string}> = ({x, y, s, t, seed, c = '#B89A5A'}) => {
  const sw = noise1(seed, t * 1.1) * 8;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[-24, -10, 4, 18, 30].map((dx, i) => (
        <path key={i} d={`M${dx},0 Q${dx + sw * 0.5},-30 ${dx + sw + (i - 2) * 9},${-50 - (i % 2) * 18}`} fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" />
      ))}
    </g>
  );
};

// ------------------------------------------------------------------ S5: the road from Moab
export const S5Road: React.FC<{t: number}> = ({t}) => {
  const lt = t - SC.S5.start;
  const scroll = lt * 120;
  const hh = handheld(5, t, 4);
  const cam = (d: number) => ({x: scroll + hh.x / Math.max(0.2, d), y: hh.y, zoom: lerp(1, 1.05, clamp(lt / 7.5))});
  const ph = lt * 4.6;
  const ruthX = 600 + Math.sin(lt * 0.4) * 10, naomiX = 380;
  const ruthS = 0.92, naomiS = 0.84;
  const ruthHead = {x: ruthX + 10 * ruthS, y: 1462 - 545 * ruthS};
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #DCC0A4 0%, #EBCFAA 40%, #F2D9B0 58%, #E6C08E 100%)'}}>
      <Layer cam={cam(0.05)} depth={0.05}>
        <circle cx={880} cy={880} r={220} fill="#FFF0CC" opacity={0.55} style={{filter: 'blur(30px)'}} />
        <circle cx={880} cy={880} r={70} fill="#FFF6DE" opacity={0.85} />
      </Layer>
      <Layer cam={cam(0.15)} depth={0.15}>
        <Ridge seed={51} y={1010} amp={120} base={1180} c1="#C9A69C" c2="#BC998F" />
        {Array.from({length: 7}).map((_, i) => <rect key={i} x={1180 + i * 22} y={930 - (i % 3) * 10} width={20} height={20 + (i % 2) * 8} fill="#D8BFA6" stroke={OUTLINE} strokeWidth={2} />)}
      </Layer>
      <Layer cam={cam(0.32)} depth={0.32}>
        <Ridge seed={52} y={1110} amp={140} base={1300} c1="#CFA27A" c2="#C3966E" n={14} />
      </Layer>
      <Layer cam={cam(0.7)} depth={0.7}>
        <rect x={-800} y={1250} width={6000} height={800} fill="#D7B07C" />
        <path d={`M-800,1372 C0,1350 800,1392 1600,1370 S3200,1356 5200,1372 L5200,1468 C3200,1460 1600,1474 800,1466 S0,1460 -800,1468 Z`} fill="#EBCB9C" />
        <path d="M-800,1398 L5200,1396 M-800,1442 L5200,1444" stroke="#C99E6C" strokeWidth={4} strokeDasharray="30 22" />
        {Array.from({length: 22}).map((_, i) => <Rock key={i} x={i * 260 + rand(53, i) * 120} y={1300 + rand(54, i) * 60} s={0.5 + rand(55, i) * 0.5} />)}
        {Array.from({length: 26}).map((_, i) => <Tuft key={i} x={i * 210 + rand(56, i) * 100} y={1290 + rand(57, i) * 70} s={0.8} t={t} seed={57 + i} />)}
        {/* lone acacia */}
        <g transform="translate(1500 1300)">
          <path d="M0,0 L6,-170 M6,-120 L-50,-190 M6,-150 L60,-210" stroke="#5E4128" strokeWidth={12} strokeLinecap="round" />
          <path d="M-140,-200 Q0,-280 150,-215 Q20,-180 -140,-200 Z" fill="#8C8A4A" stroke={OUTLINE} strokeWidth={5} />
        </g>
      </Layer>
      {/* the two widows walking (camera walks along with them) */}
      <AbsoluteFill>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920">
          {(E.stepsS5 as number[]).map((st: number, i: number) => {
            const k = (t - st) / 0.7;
            if (k < 0 || k > 1) return null;
            const fx = (i % 2 ? naomiX : ruthX) + 20 - k * 60;
            return <ellipse key={i} cx={fx} cy={1448 - k * 20} rx={18 + k * 30} ry={8 + k * 10} fill="#E8CFA6" opacity={0.6 * (1 - k)} />;
          })}
          <Person look={C.NAOMI} pose={C.walkPose(ph + 1.2, 0.6, 9)} t={t} seed={52} x={naomiX} y={1440} scale={naomiS} walk={ph + 1.2}
            face={{brow: 'sad', mouth: 'sad', eyeStyle: 'down', eyes: blink(52, t), lookY: 1}} />
          <Person look={C.RUTH} pose={C.walkPose(ph, 0.65, 6)} t={t} seed={7} x={ruthX} y={1462} scale={ruthS} walk={ph}
            face={{brow: 'sad', mouth: 'sad', eyeStyle: 'down', eyes: blink(7, t), lookY: 1}} front={{kind: 'basket', fill: 0, angle: 0}} />
        </svg>
      </AbsoluteFill>
      <Layer cam={cam(1.5)} depth={1.5}>
        {Array.from({length: 10}).map((_, i) => <Rock key={i} x={i * 520 + 200} y={1880} s={1.4} c="#A98468" />)}
        {Array.from({length: 12}).map((_, i) => <Tuft key={i} x={i * 430 + 60} y={1900} s={1.8} t={t} seed={80 + i} c="#9E8048" />)}
      </Layer>
      <Dust t={t} n={1} />
      <Label text="RUTH · A WIDOW" t={t} tin={E.ruthLabel} tout={E.foreignerLabel - 0.15} at={{x: 330, y: 820}} target={{x: ruthHead.x - 30, y: ruthHead.y - 40}} />
      <Label text="A FOREIGNER" t={t} tin={E.foreignerLabel} tout={SC.S5.end + 0.1} at={{x: 330, y: 820}} target={{x: ruthHead.x - 30, y: ruthHead.y - 40}} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ S6: the ask (Naomi's small house)
export const S6House: React.FC<{t: number}> = ({t}) => {
  const lt = t - SC.S6.start;
  const zoom = lerp(1.0, 1.06, easeInOut(clamp(lt / 4.3)));
  const hh = handheld(6, t, 3);
  const cam = {x: hh.x + 20 * clamp(lt / 4), y: hh.y + 30 * clamp(lt / 4), zoom};
  const talk = talkAmount(t, [13, 14]);
  const nod = smooth(clamp((t - E.gleanTag - 0.2) / 0.5));
  const lamp = 0.85 + 0.15 * noise1(61, t * 6);
  return (
    <AbsoluteFill style={{background: '#3A2416'}}>
      <Layer cam={cam} depth={0.85}>
        <defs>
          <radialGradient id="lampg">
            <stop offset="0" stopColor="#FFD27A" stopOpacity={0.85} />
            <stop offset="1" stopColor="#FFB050" stopOpacity={0} />
          </radialGradient>
          <linearGradient id="doorlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF1C9" />
            <stop offset="1" stopColor="#F4C77E" />
          </linearGradient>
        </defs>
        {/* plaster wall made of faceted panels */}
        {Array.from({length: 40}).map((_, i) => {
          const cx = (i % 8) * 160 - 60, cy = Math.floor(i / 8) * 300 + 200;
          return <path key={i} d={`M${cx},${cy} L${cx + 170},${cy + randRange(62, i, -20, 20)} L${cx + 160},${cy + 310} L${cx - 10},${cy + 300} Z`} fill={['#D6B386', '#CFAA7C', '#DBBB90', '#C9A375'][i % 4]} />;
        })}
        {/* doorway with morning light and a glimpse of the fields */}
        <path d="M800,620 Q930,520 1060,620 L1060,1470 L800,1470 Z" fill="url(#doorlight)" stroke={OUTLINE} strokeWidth={6} />
        <rect x={804} y={1180} width={252} height={60} fill="#E9C060" />
        <path d="M804,1180 L1056,1180" stroke="#C99A3E" strokeWidth={6} />
        <Beam id="doorbeam" x={900} y={700} w0={220} w1={780} len={900} angle={38} opacity={0.5} />
        {/* shelf with a clay lamp */}
        <rect x={120} y={860} width={220} height={22} fill="#7A5232" stroke={OUTLINE} strokeWidth={5} />
        <circle cx={230} cy={830} r={160 * lamp} fill="url(#lampg)" />
        <path d="M190,860 Q230,820 270,860 Z" fill="#B0703E" stroke={OUTLINE} strokeWidth={4} />
        <path d="M262,842 Q272,822 266,808 Q280,826 270,842 Z" fill="#FFE29A" opacity={lamp} />
        {/* floor, mat, jar, rolled mat */}
        <rect x={-200} y={1380} width={1500} height={700} fill="#B98C5C" />
        <path d="M120,1470 L900,1470 L980,1560 L60,1560 Z" fill="#C9A065" stroke={OUTLINE} strokeWidth={5} />
        {Array.from({length: 9}).map((_, i) => <path key={i} d={`M${130 + i * 90},1474 L${100 + i * 98},1556`} stroke="#A9824C" strokeWidth={5} />)}
        <path d="M30,1380 Q-10,1280 40,1220 L110,1220 Q160,1280 120,1380 Z" fill="#B5683C" stroke={OUTLINE} strokeWidth={5} />
        <ellipse cx={75} cy={1222} rx={36} ry={10} fill="#8E4E2C" stroke={OUTLINE} strokeWidth={4} />
        <rect x={620} y={1330} width={150} height={56} rx={28} fill="#9C8A6A" stroke={OUTLINE} strokeWidth={5} />
        <Dust t={t} n={36} seed={63} area={[760, 650, 1080, 1450]} size={4} opacity={0.85} />
      </Layer>
      <Layer cam={cam} depth={1}>
        {/* stool */}
        <path d="M250,1320 L410,1320 L400,1340 L260,1340 Z" fill="#8A5E36" stroke={OUTLINE} strokeWidth={5} />
        <path d="M270,1340 L262,1462 M390,1340 L398,1462 M330,1340 L330,1462" stroke="#6E4A2A" strokeWidth={12} strokeLinecap="round" />
        <Person look={C.NAOMI} pose={{...C.SIT, head: 4 + nod * 8 * Math.sin(clamp((t - E.gleanTag) / 0.8) * Math.PI)}} t={t} seed={52} x={322} y={1462} scale={0.8}
          face={{brow: nod > 0.3 ? 'kind' : 'worried', mouth: nod > 0.3 ? 'smile' : 'soft', eyes: blink(52, t), lookX: 1}} />
        <Person look={C.RUTH} pose={{...C.STAND, shF: 18, elF: 128, shB: -8, elB: 14, head: -4}} flip t={t} seed={7} x={700} y={1470} scale={0.86}
          face={{brow: 'brave', mouth: talk > 0.05 ? 'talk' : 'soft', mouthOpen: talk, eyes: blink(7, t), lookX: 1}} />
      </Layer>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ S8: but notice — the map of many fields
const MAP_COLS = 5, MAP_ROWS = 8;
const mapPt = (c: number, r: number): P => [-40 + c * 232 + (c > 0 && c < MAP_COLS ? randRange(81, r * 10 + c, -30, 30) : 0), 330 + r * 205 + (r > 0 && r < MAP_ROWS ? randRange(82, r * 10 + c, -26, 26) : 0)];
const BOAZ = {c: 2, r: 4};
const PATH: P[] = [[250, 2000], [262, 1800], [300, 1660], [244, 1530], [270, 1395], [400, 1350], [470, 1300], [520, 1240]];
const pathPoint = (k: number): P => {
  const seg = Math.min(PATH.length - 2, Math.floor(k * (PATH.length - 1)));
  const f = k * (PATH.length - 1) - seg;
  return [lerp(PATH[seg][0], PATH[seg + 1][0], f), lerp(PATH[seg][1], PATH[seg + 1][1], f)];
};
export const S8Map: React.FC<{t: number}> = ({t}) => {
  const lt = t - SC.S8.start;
  const boazC: P = (() => {
    const a = mapPt(BOAZ.c, BOAZ.r), b = mapPt(BOAZ.c + 1, BOAZ.r + 1);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  })();
  const z = easeInOut(clamp(lt / (SC.S8.end - SC.S8.start)));
  const pulse = Math.max(0, 1 - Math.abs(t - E.butNotice - 0.15) / 0.35);
  const cam = {x: (boazC[0] - 540) * z * 0.9, y: (boazC[1] - 960) * z * 0.9, zoom: lerp(1.0, 1.55, z) + pulse * 0.02, rot: lerp(0, -4, z)};
  const pk = easeInOut(clamp((t - E.path.start) / (E.path.end - E.path.start)));
  const arrive = smooth(clamp((t - E.path.end + 0.1) / 0.4));
  const ruthP = pathPoint(pk);
  const fieldCols = ['#E8BE5A', '#D9A350', '#B0A452', '#E3CC94', '#C9B060', '#D4B26A', '#A9A05A'];
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < MAP_ROWS; r++)
    for (let c = 0; c < MAP_COLS; c++) {
      const q = [mapPt(c, r), mapPt(c + 1, r), mapPt(c + 1, r + 1), mapPt(c, r + 1)];
      const isB = c === BOAZ.c && r === BOAZ.r;
      const col = isB ? '#EDC35C' : fieldCols[Math.floor(rand(83, r * 10 + c) * fieldCols.length)];
      cells.push(<path key={`${r}-${c}`} d={`M${q.map((p) => p.join(',')).join(' L')} Z`} fill={col} stroke="#EAD3A2" strokeWidth={16} strokeLinejoin="round" />);
      // furrow lines
      cells.push(
        <g key={`f${r}-${c}`} opacity={0.35}>
          {[0.25, 0.5, 0.75].map((k2) => (
            <path key={k2} d={`M${lerp(q[0][0], q[3][0], k2)},${lerp(q[0][1], q[3][1], k2)} L${lerp(q[1][0], q[2][0], k2)},${lerp(q[1][1], q[2][1], k2)}`} stroke="#8E6A30" strokeWidth={3} />
          ))}
        </g>,
      );
    }
  const bq = [mapPt(BOAZ.c, BOAZ.r), mapPt(BOAZ.c + 1, BOAZ.r), mapPt(BOAZ.c + 1, BOAZ.r + 1), mapPt(BOAZ.c, BOAZ.r + 1)];
  const pathD = smoothOpen(PATH);
  return (
    <AbsoluteFill style={{background: '#CDA36A'}}>
      <Layer cam={cam} depth={1}>
        <defs>
          <filter id="pathglow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={8} />
          </filter>
        </defs>
        {cells}
        {/* village rooftops along the top */}
        {Array.from({length: 16}).map((_, i) => {
          const x = -20 + i * 72 + rand(84, i) * 20, y = 150 + rand(85, i) * 120;
          return (
            <g key={i}>
              <rect x={x + 10} y={y + 12} width={62} height={52} fill="rgba(60,30,10,0.25)" />
              <rect x={x} y={y} width={62} height={52} fill={i % 3 ? '#E6CFA4' : '#DCC090'} stroke={OUTLINE} strokeWidth={4} />
            </g>
          );
        })}
        {/* trees on the field corners */}
        {Array.from({length: 16}).map((_, i) => {
          const p = mapPt(1 + (i % 4), 1 + Math.floor(i / 4) * 2);
          return (
            <g key={i}>
              <circle cx={p[0] + 14} cy={p[1] + 14} r={34} fill="rgba(60,30,10,0.25)" />
              <circle cx={p[0]} cy={p[1]} r={34} fill={i % 2 ? '#7E8A44' : '#6E7A3A'} stroke={OUTLINE} strokeWidth={4} />
            </g>
          );
        })}
        {/* Boaz's field lights up as Ruth arrives */}
        <path d={`M${bq.map((p) => p.join(',')).join(' L')} Z`} fill="#FFD772" opacity={arrive * (0.45 + 0.1 * Math.sin(t * 5))} />
        <path d={`M${bq.map((p) => p.join(',')).join(' L')} Z`} fill="none" stroke="#FFE7A0" strokeWidth={10} opacity={arrive} filter="url(#pathglow)" />
        {/* the glowing path */}
        <path d={pathD} fill="none" stroke="#FFE7A0" strokeWidth={30} strokeLinecap="round" pathLength={1} strokeDasharray={`${pk} 2`} opacity={0.75} filter="url(#pathglow)" />
        <path d={pathD} fill="none" stroke="#FFF4D0" strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={`${pk} 2`} />
        {/* tiny Ruth from above */}
        <g transform={`translate(${ruthP[0]} ${ruthP[1]})`}>
          <ellipse cx={8} cy={8} rx={20} ry={14} fill="rgba(60,30,10,0.3)" />
          <ellipse cx={0} cy={4} rx={18} ry={22} fill="#B4766A" stroke={OUTLINE} strokeWidth={4} />
          <circle cx={0} cy={-8} r={13} fill="#EFE3C8" stroke={OUTLINE} strokeWidth={4} />
        </g>
      </Layer>
      <Label text="BOAZ'S FIELD · RUTH 2:3" t={t} tin={E.boazFieldLabel} tout={SC.S8.end + 0.15} at={{x: 470, y: 820}} target={{x: 540, y: 960 + 30}} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ S10: the family — wedding → baby Obed → Jesse & David
export const S10Family: React.FC<{t: number}> = ({t}) => {
  const p1 = easeInOut(clamp((t - (E.dotObed - 0.45)) / 0.5));
  const p2 = easeInOut(clamp((t - (E.dotJesse - 0.4)) / 0.5));
  const hh = handheld(10, t, 3);
  const cam = {x: p1 * 1080 + p2 * 1080 + hh.x, y: hh.y, zoom: 1.02};
  const clap = (k: number) => Math.abs(Math.sin(t * 9 + k)) * 0.7;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #F2C98E 0%, #F6DCA6 50%, #E8B878 100%)'}}>
      <Layer cam={cam} depth={0.4}>
        {/* far hills across all three panels */}
        <Ridge seed={101} y={1130} amp={130} base={1300} c1="#D2AE80" c2="#C8A276" w={3600} x0={-400} n={22} />
      </Layer>
      <Layer cam={cam} depth={1}>
        <defs>
          <radialGradient id="lampw">
            <stop offset="0" stopColor="#FFE09A" stopOpacity={0.9} />
            <stop offset="1" stopColor="#FFB050" stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* panel 1+2: courtyard wall with lamps and cloths */}
        <rect x={-300} y={760} width={2500} height={660} fill="#DDBE8E" stroke={OUTLINE} strokeWidth={6} />
        {Array.from({length: 26}).map((_, i) => <rect key={i} x={-280 + (i % 13) * 190} y={800 + Math.floor(i / 13) * 300} width={150} height={60} fill="#D3B282" />)}
        <path d="M-300,760 Q250,860 900,760 Q1500,860 2200,760" fill="none" stroke="#6E4A2A" strokeWidth={4} />
        {Array.from({length: 14}).map((_, i) => {
          const x = -240 + i * 170, y = 790 + Math.sin((i / 13) * Math.PI * 2) * 28 + 40;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={60} fill="url(#lampw)" opacity={0.7 + 0.2 * noise1(102 + i, t * 4)} />
              <path d={`M${x - 12},${y} Q${x},${y - 18} ${x + 12},${y} Z`} fill="#B0703E" stroke={OUTLINE} strokeWidth={3} />
            </g>
          );
        })}
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${-150 + i * 360},770 L${-60 + i * 360},770 L${-80 + i * 360},940 L${-120 + i * 360},900 Z`} fill={i % 2 ? '#F2E4C4' : '#E9B44E'} stroke={OUTLINE} strokeWidth={4} />)}
        {/* house door in panel 2 */}
        <path d="M1460,1000 Q1540,930 1620,1000 L1620,1420 L1460,1420 Z" fill="#7A5232" stroke={OUTLINE} strokeWidth={6} />
        {/* ground */}
        <rect x={-400} y={1410} width={4000} height={700} fill="#C9A06A" />
        {/* panel 3: open hillside meadow */}
        <path d="M2080,1420 L2080,1180 Q2600,1060 3600,1160 L3600,1420 Z" fill="#B9B062" stroke={OUTLINE} strokeWidth={6} />
        <path d="M2080,1420 L2080,1300 Q2700,1220 3600,1290 L3600,1420 Z" fill="#A9A257" />
        {/* olive tree */}
        <g transform="translate(260 1420)">
          <path d="M0,0 L-6,-170" stroke="#5E4128" strokeWidth={22} />
          <path d={smoothClosed([[-120, -170], [-60, -260], [40, -270], [120, -190], [60, -140], [-60, -140]])} fill="#8A9048" stroke={OUTLINE} strokeWidth={5} />
        </g>
        {/* --- panel 1: the wedding --- */}
        <Person look={C.REAPER_C} pose={{...C.STAND, shF: 50 + clap(0) * 20, elF: 90, shB: 40, elB: 90}} t={t} seed={103} x={120} y={1440} scale={0.62} face={{brow: 'happy', mouth: 'bigSmile', eyeStyle: 'happy'}} />
        <Person look={C.NAOMI} pose={{...C.STAND, shF: 30, elF: 110, shB: 26, elB: 110}} t={t} seed={52} x={880} y={1450} scale={0.74} flip face={{brow: 'happy', mouth: 'smile', eyeStyle: 'happy', tears: true}} />
        <Person look={C.RUTH_BRIDE} pose={{...C.STAND, shF: 24, elF: 30}} t={t} seed={7} x={420} y={1460} scale={0.86} face={{brow: 'happy', mouth: 'bigSmile', eyes: blink(7, t), lookX: 1}} />
        <Person look={C.BOAZ} pose={{...C.STAND, shB: -24, elB: 30}} flip t={t} seed={93} x={640} y={1460} scale={0.92} face={{brow: 'happy', mouth: 'bigSmile', eyes: blink(93, t), lookX: 1}} />
        {/* falling petals */}
        {Array.from({length: 26}).map((_, i) => {
          const x = randRange(104, i, -100, 1180) + noise1(104 + i, t) * 40;
          const y = ((randRange(105, i, 0, 900) + (t - SC.S10.start) * randRange(106, i, 90, 200)) % 1000) + 600;
          return <ellipse key={i} cx={x} cy={y} rx={9} ry={5} fill={i % 2 ? '#FFFDF4' : '#F4B6A6'} stroke={OUTLINE} strokeWidth={1.5} transform={`rotate(${t * 90 + i * 40} ${x} ${y})`} />;
        })}
        {/* --- panel 2: Ruth holds baby Obed --- */}
        <Person look={C.BOAZ} pose={{...C.STAND, shF: 20, elF: 60}} t={t} seed={93} x={1330} y={1430} scale={0.84} face={{brow: 'kind', mouth: 'smile', eyes: blink(94, t), lookX: 1}} />
        <Person look={C.RUTH} pose={{...C.STAND, head: 10}} t={t} seed={7} x={1580} y={1460} scale={0.88} cradle={{kind: 'baby'}} face={{brow: 'happy', mouth: 'smile', eyeStyle: 'happy'}} />
        <Person look={C.NAOMI} pose={{...C.STAND, shF: 70, elF: 40}} flip t={t} seed={52} x={1810} y={1450} scale={0.78} face={{brow: 'happy', mouth: 'bigSmile', eyes: blink(53, t), lookX: 1, tears: true}} />
        {/* --- panel 3: Jesse and young David the shepherd --- */}
        <Person look={C.JESSE} pose={{...C.STAND, shB: -4, elB: 10, shF: 40, elF: 20}} t={t} seed={107} x={2420} y={1440} scale={0.84} front={{kind: 'staff', angle: -10}} face={{brow: 'kind', mouth: 'smile', eyes: blink(107, t), lookX: 1}} />
        <Person look={C.DAVID} pose={{...C.STAND, shF: 10, elF: 20, shB: 30, elB: 60}} flip t={t} seed={108} x={2720} y={1450} scale={0.66} front={{kind: 'staff'}} back={{kind: 'harp', angle: 0}}
          face={{brow: 'happy', mouth: 'bigSmile', eyes: blink(108, t), lookX: 1}} />
        {[{x: 2900, y: 1440, s: 1}, {x: 3020, y: 1420, s: 0.8}].map((sh, i) => (
          <g key={i} transform={`translate(${sh.x} ${sh.y}) scale(${sh.s})`}>
            <ellipse cx={0} cy={-46} rx={62} ry={40} fill="#F4EFE4" stroke={OUTLINE} strokeWidth={5} />
            <ellipse cx={-62} cy={-60} rx={18} ry={22} fill="#3A2C24" stroke={OUTLINE} strokeWidth={4} />
            <path d="M-30,-10 L-30,0 M30,-10 L30,0" stroke="#3A2C24" strokeWidth={8} />
          </g>
        ))}
      </Layer>
      <Label text="RUTH 4:17" t={t} tin={E.ruth417Label} tout={E.dotJesse - 0.4} at={{x: 300, y: 860}} target={{x: 1580 + 30 - cam.x, y: 1460 - 330}} />
    </AbsoluteFill>
  );
};
void easeOut;
