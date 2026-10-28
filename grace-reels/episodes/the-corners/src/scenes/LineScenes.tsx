import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Person, handPoint} from '../chars/Person';
import * as C from '../chars/cast';
import {GOLD, OUTLINE} from '../lib/theme';
import {E, SC} from '../lib/timeline';
import {blink, clamp, easeIn, easeInOut, easeOut, handheld, lerp, noise1, rand, randRange, smooth} from '../lib/anim';
import {Beam, Dust, FgWheat, Layer} from './kit';
import {Label} from '../ui/Label';
import {P, smoothClosed, smoothOpen} from '../chars/geom';
import {GrainHead} from '../chars/props';

// ------------------------------------------------------------------ S11: the golden family line grows up through history
const VINE_TOP = 260, VINE_ROOT = 2100;
const vineAt = (u: number): P => [540 + Math.sin(u * Math.PI * 3.1) * 190 * (1 - u * 0.35), lerp(VINE_ROOT, VINE_TOP, u)];
const VINE_PTS: P[] = Array.from({length: 61}).map((_, i) => vineAt(i / 60));
const NODES = [
  {u: 0.12, who: 'obed'}, {u: 0.22, who: 'jesse'}, {u: 0.33, who: 'david'},
  ...Array.from({length: 9}).map((_, i) => ({u: 0.43 + i * 0.058, who: 'gen'})),
];
export const S11Vine: React.FC<{t: number}> = ({t}) => {
  const grow = easeIn(clamp((t - E.vine.start) / (E.vine.end - E.vine.start))) * 0.92 + 0.08 * clamp((t - E.vine.start) / (E.vine.end - E.vine.start));
  const burst = clamp((t - E.jesusBurst) / 0.6);
  const flash = Math.max(0, 1 - Math.abs(t - E.jesusBurst - 0.05) / 0.28);
  const tip = vineAt(grow);
  // crane up following the growing tip, then pull back to show the whole line (Jesus at the top, Ruth at the root)
  const pb = easeInOut(clamp((t - E.pullBack) / 1.4));
  const followY = Math.max(0, tip[1] - 300) - 960; // world y at screen centre = tip - 300 (tip sits low in frame)
  const PB_ZOOM = 0.4;
  const pbCenter = -17 + (960 - 700) / PB_ZOOM; // Jesus' head lands just under the tracker
  const camY = lerp(followY, pbCenter - 960, pb);
  const zoom = lerp(1, PB_ZOOM, pb);
  const hh = handheld(11, t, 3);
  const cam = {x: hh.x, y: camY + hh.y, zoom};
  const lg = smooth(clamp((t - E.leftoversGlow) / 0.3)) * (1 - smooth(clamp((t - E.leftoversGlow - 1.2) / 0.5)));
  const grownPts = [...VINE_PTS.filter((_, i) => i / 60 < grow), tip];
  const vineD = grownPts.length > 1 ? smoothOpen(grownPts) : `M${tip[0]},${tip[1]}`;
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 80% 60% at 50% ${lerp(70, 30, burst)}%, ${burst > 0 ? '#5A3A16' : '#3A2410'} 0%, #1E120A 60%, #120A05 100%)`}}>
      <Layer cam={{...cam, y: cam.y * 0.3}} depth={0.3}>
        <Dust t={t} n={70} seed={111} area={[-200, -200, 1280, 2400]} size={3} opacity={0.6} color="#FFD98A" />
      </Layer>
      <Layer cam={cam} depth={1}>
        <defs>
          <filter id="vineglow" x="-30%" y="-5%" width="160%" height="110%">
            <feGaussianBlur stdDeviation={10} />
          </filter>
          <radialGradient id="jlight">
            <stop offset="0" stopColor="#FFF0C4" stopOpacity={0.95} />
            <stop offset="0.5" stopColor="#FFC85A" stopOpacity={0.35} />
            <stop offset="1" stopColor="#FFB040" stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* Ruth gleaning at the root of the line */}
        <ellipse cx={540} cy={VINE_ROOT + 110} rx={420} ry={60} fill="#5A3A16" />
        <Person look={C.RUTH} pose={C.BEND} t={t} seed={7} x={420} y={VINE_ROOT + 110} scale={0.62} face={{brow: 'kind', mouth: 'soft', eyeStyle: 'down', eyes: blink(7, t)}} front={{kind: 'grain', angle: 170}} back={{kind: 'basket', fill: 0.6}} />
        {lg > 0 && <circle cx={505} cy={VINE_ROOT + 70} r={60 + lg * 30} fill="url(#jlight)" opacity={lg} />}
        {/* the vine */}
        <path d={vineD} fill="none" stroke={GOLD} strokeWidth={34} strokeLinecap="round" opacity={0.6} filter="url(#vineglow)" />
        <path d={vineD} fill="none" stroke="#FFD772" strokeWidth={14} strokeLinecap="round" />
        {Array.from({length: 26}).map((_, i) => {
          const u = 0.03 + i * 0.037;
          if (u > grow) return null;
          const p = vineAt(u);
          const side = i % 2 ? 1 : -1;
          const k = easeOut(clamp((grow - u) / 0.04));
          return <path key={i} d={smoothClosed([[0, 0], [28 * side, -18], [56 * side, -6], [26 * side, 10]])} transform={`translate(${p[0]} ${p[1]}) scale(${k}) rotate(${side * 20})`} fill="#E9B44E" stroke={OUTLINE} strokeWidth={3} />;
        })}
        {/* generations along the line */}
        {NODES.map((n, i) => {
          if (n.u > grow + 0.01) return null;
          const p = vineAt(n.u);
          const k = easeOut(clamp((grow - n.u) / 0.05));
          const side = i % 2 ? 1 : -1;
          const px = p[0] + side * 150;
          if (n.who === 'gen')
            return (
              <g key={i} opacity={k}>
                <path d={`M${p[0]},${p[1]} L${px},${p[1] - 20}`} stroke={GOLD} strokeWidth={4} opacity={0.7} />
                <circle cx={px} cy={p[1] - 20} r={22 * k} fill="#2A1A0C" stroke={GOLD} strokeWidth={4} />
                <circle cx={px} cy={p[1] - 28} r={8 * k} fill={GOLD} opacity={0.7} />
                <path d={`M${px - 12},${p[1] - 8} Q${px},${p[1] - 22} ${px + 12},${p[1] - 8}`} fill={GOLD} opacity={0.7} />
              </g>
            );
          const look = n.who === 'obed' ? C.OBED_MAN : n.who === 'jesse' ? C.JESSE : C.DAVID;
          return (
            <g key={i} opacity={k}>
              <path d={`M${p[0]},${p[1]} L${px},${p[1] + 60}`} stroke={GOLD} strokeWidth={5} opacity={0.8} />
              <ellipse cx={px} cy={p[1] + 64} rx={90} ry={16} fill="rgba(255,200,90,0.25)" />
              <Person look={look} pose={C.STAND} flip={side > 0 ? false : true} t={t} seed={110 + i} x={px} y={p[1] + 64} scale={0.42 * k}
                face={{brow: 'kind', mouth: 'smile', eyes: blink(110 + i, t)}} front={n.who === 'david' ? {kind: 'staff'} : undefined} back={n.who === 'david' ? {kind: 'harp', angle: 0} : undefined} />
            </g>
          );
        })}
        {/* the "?" at the top bursts into light: Jesus */}
        {grow > 0.95 && burst <= 0 && (
          <g>
            <circle cx={vineAt(1)[0]} cy={VINE_TOP} r={70 + 10 * Math.sin(t * 8)} fill="url(#jlight)" />
            <text x={vineAt(1)[0]} y={VINE_TOP + 30} textAnchor="middle" fontFamily="Cormorant Garamond" fontWeight={700} fontSize={110} fill={GOLD}>?</text>
          </g>
        )}
        {burst > 0 && (
          <g>
            <circle cx={vineAt(1)[0]} cy={VINE_TOP - 120} r={lerp(80, 520, easeOut(burst))} fill="url(#jlight)" opacity={1 - burst * 0.4} />
            {Array.from({length: 16}).map((_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const r0 = 90 + burst * 80, r1 = 180 + burst * 420;
              const c = vineAt(1);
              return <line key={i} x1={c[0] + Math.cos(a) * r0} y1={VINE_TOP - 120 + Math.sin(a) * r0} x2={c[0] + Math.cos(a) * r1} y2={VINE_TOP - 120 + Math.sin(a) * r1} stroke="#FFE7A0" strokeWidth={6} opacity={(1 - burst) * 0.9} strokeLinecap="round" />;
            })}
            <g opacity={easeOut(burst)}>
              <Person look={C.JESUS} pose={{...C.STAND, shF: 22, elF: 26, shB: -18, elB: 26}} t={t} seed={120} x={vineAt(1)[0]} y={VINE_TOP + 80} scale={0.62 * lerp(0.8, 1, easeOut(burst))}
                face={{brow: 'kind', mouth: 'smile', eyes: blink(120, t)}} light={-1} />
            </g>
          </g>
        )}
      </Layer>
      {flash > 0 && <AbsoluteFill style={{background: '#FFF3D0', opacity: flash * 0.85, mixBlendMode: 'screen'}} />}
      <Label text="MATTHEW 1:5" t={t} tin={E.matt15Label} tout={SC.S11.end + 0.1} at={{x: 300, y: lerp(900, 1180, pb)}} target={{x: lerp(470, 560, pb), y: lerp(1260, 1100, pb)}} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ S12: became poor — the manger
export const S12Manger: React.FC<{t: number}> = ({t}) => {
  const lt = t - SC.S12.start;
  const z = easeInOut(clamp(lt / 4.2));
  const hh = handheld(12, t, 2);
  const cam = {x: hh.x, y: lerp(0, 160, z) + hh.y, zoom: lerp(1, 1.12, z)};
  const flick = 0.85 + 0.12 * noise1(121, t * 7) + 0.05 * noise1(122, t * 19);
  const poor = smooth(clamp((t - E.becamePoor) / 0.4));
  return (
    <AbsoluteFill style={{background: '#1A1420'}}>
      <Layer cam={cam} depth={0.5}>
        <defs>
          <linearGradient id="nightsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0F1830" />
            <stop offset="1" stopColor="#2B3A5E" />
          </linearGradient>
        </defs>
        <rect x={-200} y={-200} width={1480} height={1300} fill="url(#nightsky)" />
        {Array.from({length: 60}).map((_, i) => <circle key={i} cx={randRange(123, i, -100, 1180)} cy={randRange(124, i, -100, 900)} r={randRange(125, i, 1.5, 3.5)} fill="#FFF6DA" opacity={0.5 + 0.5 * Math.sin(t * 2 + i)} />)}
        {Array.from({length: 12}).map((_, i) => <rect key={i} x={-60 + i * 100} y={820 - (i % 3) * 30} width={90} height={300} fill="#151824" />)}
      </Layer>
      <Layer cam={cam} depth={1}>
        <defs>
          <radialGradient id="lantern">
            <stop offset="0" stopColor="#FFD480" stopOpacity={0.95} />
            <stop offset="0.45" stopColor="#F2A24A" stopOpacity={0.45} />
            <stop offset="1" stopColor="#E08A3A" stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* rocky cave walls framing the night opening */}
        <path d="M-200,-200 L1280,-200 L1280,1700 L-200,1700 Z M60,520 Q120,180 520,140 Q940,160 1010,560 L1010,1000 L60,1000 Z" fill="#4A3426" fillRule="evenodd" stroke={OUTLINE} strokeWidth={6} />
        {Array.from({length: 18}).map((_, i) => <path key={i} d={`M${randRange(126, i, -150, 1200)},${randRange(127, i, 1000, 1500)} l${randRange(128, i, 60, 160)},${randRange(129, i, -40, 40)} l-30,90 l-140,-10 Z`} fill={i % 2 ? '#5A4030' : '#3E2C20'} opacity={0.8} />)}
        {/* beams */}
        <path d="M-100,560 L1180,500 L1180,560 L-100,620 Z" fill="#6B4A2E" stroke={OUTLINE} strokeWidth={6} />
        <path d="M120,560 L150,1500 M960,520 L930,1500" stroke="#5E4028" strokeWidth={34} />
        {/* straw floor */}
        <rect x={-200} y={1320} width={1480} height={500} fill="#B88A3E" />
        {Array.from({length: 70}).map((_, i) => {
          const x = randRange(130, i, -150, 1230), y = randRange(131, i, 1320, 1700);
          return <path key={i} d={`M${x},${y} l${randRange(132, i, -40, 40)},${randRange(133, i, -12, 12)}`} stroke={i % 2 ? '#E2B85E' : '#9C7030'} strokeWidth={5} strokeLinecap="round" />;
        })}
        {/* lantern hanging from the beam */}
        <circle cx={800} cy={720} r={520 * flick} fill="url(#lantern)" />
        <path d="M800,530 L800,640" stroke="#2E2018" strokeWidth={5} />
        <path d="M770,640 L830,640 L840,720 L760,720 Z" fill="#FFD27A" stroke={OUTLINE} strokeWidth={5} />
        <path d="M790,700 Q800,670 810,700 Q800,710 790,700Z" fill="#FFF3C4" opacity={flick} />
        {/* animals resting */}
        <g transform="translate(150 1360)">
          <ellipse cx={0} cy={-60} rx={150} ry={70} fill="#8E8A86" stroke={OUTLINE} strokeWidth={5} />
          <path d="M110,-90 Q170,-170 200,-130 Q210,-90 160,-60 Z" fill="#8E8A86" stroke={OUTLINE} strokeWidth={5} />
          <path d="M150,-150 L140,-210 L160,-160 M175,-150 L186,-205 L182,-150" fill="#7A7672" stroke={OUTLINE} strokeWidth={5} />
          <path d="M175,-118 Q180,-110 186,-118" fill="none" stroke={OUTLINE} strokeWidth={4} />
        </g>
        <g transform="translate(900 1380)">
          <ellipse cx={0} cy={-46} rx={100} ry={56} fill="#F2EDE2" stroke={OUTLINE} strokeWidth={5} />
          <ellipse cx={-90} cy={-56} rx={26} ry={30} fill="#3A2C24" stroke={OUTLINE} strokeWidth={4} />
          <path d="M-98,-60 Q-92,-54 -86,-60" fill="none" stroke="#F2EDE2" strokeWidth={3} />
        </g>
        {/* the manger */}
        <ellipse cx={540} cy={1420} rx={300} ry={50} fill="rgba(255,200,110,0.3)" />
        <path d="M380,1300 L700,1300 L670,1400 L410,1400 Z" fill="#8A5E36" stroke={OUTLINE} strokeWidth={6} />
        <path d="M410,1400 L390,1450 M670,1400 L690,1450 M480,1400 L470,1450 M600,1400 L610,1450" stroke="#6E4A2A" strokeWidth={12} strokeLinecap="round" />
        {Array.from({length: 14}).map((_, i) => <path key={i} d={`M${390 + i * 22},1302 l${randRange(134, i, -18, 18)},-26`} stroke="#E2B85E" strokeWidth={5} strokeLinecap="round" />)}
        <g transform="translate(540 1262)">
          <path d={smoothClosed([[-110, 20], [-90, -24], [20, -34], [96, -12], [100, 22], [10, 38]])} fill="#F3ECDF" stroke={OUTLINE} strokeWidth={5} />
          <path d="M-60,4 Q0,16 60,2" fill="none" stroke="#D8CDB8" strokeWidth={4} />
          <circle cx={86} cy={-14} r={30} fill="#A8754F" stroke={OUTLINE} strokeWidth={5} />
          <path d="M70,-18 Q76,-12 82,-18 M92,-18 Q98,-12 104,-18" fill="none" stroke="#24150E" strokeWidth={3.5} strokeLinecap="round" />
          <path d="M82,-2 Q88,4 94,-2" fill="none" stroke="#4A1C12" strokeWidth={3.5} strokeLinecap="round" />
          <path d="M66,-40 Q86,-50 106,-38" fill="none" stroke="#3B2A1E" strokeWidth={5} strokeLinecap="round" />
        </g>
        <circle cx={620} cy={1250} r={140 + poor * 40} fill="url(#lantern)" opacity={0.35 + poor * 0.25} />
        <Dust t={t} n={30} seed={135} area={[300, 600, 1080, 1400]} size={3.5} opacity={0.6} />
      </Layer>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ S13: for Me — Jesus shares bread with a poor man
export const S13ForMe: React.FC<{t: number}> = ({t}) => {
  const lt = t - SC.S13.start;
  const hh = handheld(13, t, 3);
  const cam = {x: hh.x, y: hh.y + lerp(0, 40, clamp(lt / 5.7)), zoom: lerp(1, 1.06, easeInOut(clamp(lt / 5.7)))};
  const broken = t >= E.breadBreak + 0.15;
  const offer = easeInOut(clamp((t - E.breadOffer) / 0.6));
  const recv = smooth(clamp((t - E.breadOffer - 0.5) / 0.4));
  const me = Math.max(0, 1 - Math.abs(t - E.forMe - 0.3) / 0.8);
  const jPose = {...C.CROSS, shF: lerp(30, 72, offer), elF: lerp(70, 20, offer), shB: 24, elB: 70};
  const mPose = {...C.CROSS, shF: lerp(20, 58, recv), elF: lerp(70, 34, recv), head: lerp(10, -4, recv)};
  const jh = handPoint(jPose, {x: 300, y: 1470, scale: 0.86});
  const mh = handPoint(mPose, {x: 760, y: 1470, scale: 0.84, flip: true, thin: C.POOR_MAN.thin});
  const handed = smooth(clamp((t - E.breadOffer - 0.45) / 0.3));
  const breadX = lerp(jh[0], mh[0], handed), breadY = lerp(jh[1], mh[1], handed) - 6;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #F0B985 0%, #F6D2A0 45%, #EFC48A 62%, #D9A56E 100%)'}}>
      <Layer cam={cam} depth={0.2}>
        <circle cx={180} cy={900} r={240} fill="#FFE8B8" opacity={0.6} style={{filter: 'blur(26px)'}} />
        <rect x={-200} y={1010} width={1480} height={90} fill="#9FB3B6" />
        {Array.from({length: 14}).map((_, i) => <path key={i} d={`M${i * 90 - 40},${1030 + (i % 3) * 20} h40`} stroke="#E8F2EE" strokeWidth={4} opacity={0.4 + 0.4 * Math.sin(t * 2 + i)} />)}
      </Layer>
      <Layer cam={cam} depth={0.45}>
        <path d="M-300,1100 Q200,1040 700,1080 T1400,1070 L1400,1300 L-300,1300 Z" fill="#B9A66A" stroke={OUTLINE} strokeWidth={5} />
        {[[90, 1100], [880, 1090], [1010, 1110]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${0.7 + (i % 2) * 0.2})`}>
            <path d="M0,0 L-4,-130" stroke="#5E4128" strokeWidth={18} />
            <path d={smoothClosed([[-110, -130], [-50, -220], [40, -230], [110, -150], [50, -100], [-60, -104]])} fill={i % 2 ? '#8A9048' : '#7E8A44'} stroke={OUTLINE} strokeWidth={5} />
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={1}>
        <rect x={-300} y={1250} width={1680} height={800} fill="#CDAA6E" />
        <path d="M-300,1250 Q540,1210 1380,1250" fill="none" stroke={OUTLINE} strokeWidth={5} />
        {/* low stone wall behind */}
        {Array.from({length: 12}).map((_, i) => <path key={i} d={`M${-40 + i * 100},1260 l20,-50 l70,-6 l20,56 Z`} fill={i % 2 ? '#B9A88E' : '#AA9A80'} stroke={OUTLINE} strokeWidth={4} />)}
        {/* warm glow when "you did for Me" */}
        <ellipse cx={540} cy={1330} rx={480} ry={200} fill="#FFD27A" opacity={0.18 + me * 0.35} style={{filter: 'blur(30px)'}} />
        {/* cloth with a bowl between them */}
        <path d="M410,1440 L700,1440 L740,1480 L380,1480 Z" fill="#E8DCC4" stroke={OUTLINE} strokeWidth={5} />
        <path d="M520,1440 Q550,1406 580,1440 Z" fill="#B0703E" stroke={OUTLINE} strokeWidth={4} />
        <Person look={C.POOR_MAN} pose={mPose} flip t={t} seed={131} x={760} y={1470} scale={0.84}
          face={{brow: recv > 0.5 ? 'raised' : 'worried', mouth: recv > 0.6 ? 'smile' : 'soft', eyes: blink(131, t), lookX: 1, tears: recv > 0.8}} />
        <Person look={C.JESUS} pose={jPose} t={t} seed={120} x={300} y={1470} scale={0.86}
          face={{brow: 'kind', mouth: 'smile', eyes: blink(120, t), lookX: 1}} back={broken ? {kind: 'breadHalf', angle: 0} : undefined} />
        <g transform={`translate(${breadX} ${breadY})`}>{broken ? <g transform="scale(1.5)"><HalfBread /></g> : <g transform="scale(1.5)"><WholeBread /></g>}</g>
      </Layer>
    </AbsoluteFill>
  );
};
const WholeBread = () => (
  <g>
    <ellipse cx={0} cy={0} rx={34} ry={13} fill="#D49A52" stroke={OUTLINE} strokeWidth={4} />
    <path d="M-18,-3 Q-10,2 -2,-3 M4,-2 Q12,3 20,-2" fill="none" stroke="#9A6430" strokeWidth={3} />
  </g>
);
const HalfBread = () => (
  <g>
    <path d="M-30,-12 A34,13 0 0 0 -30,12 L4,12 L0,6 L5,0 L0,-6 L4,-12 Z" fill="#D49A52" stroke={OUTLINE} strokeWidth={4} />
    <path d="M-2,-10 L-2,10" stroke="#F1D7A6" strokeWidth={4} />
  </g>
);

// ------------------------------------------------------------------ S15: call to action background
export const S15Cta: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 55% at 50% 52%, #3E2410 0%, #1E1108 55%, #0E0805 100%)'}}>
    <AbsoluteFill>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <Dust t={t} n={60} seed={151} size={3} opacity={0.55} color="#FFD98A" />
        <g opacity={0.55}>
          <FgWheat t={t} n={22} seed={152} y={1920} scale={0.9} dark={0} />
        </g>
        <Beam id="ctabeam" x={540} y={-200} w0={200} w1={900} len={1800} opacity={0.18} />
      </svg>
    </AbsoluteFill>
  </AbsoluteFill>
);
void rand; void GrainHead; void easeIn;
