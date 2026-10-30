import React from 'react';
import {random} from 'remotion';
import {
  Banner, Broom, C, Card, Chalkboard, Domino, DottedPath, Exclaim, FlatGalaxy, FogPanel, GROUND_Y, Glow, GlowPoint, GroundLine,
  HornAntenna, Jesus, Label, LabelBox, LensView, Letter, ObservatoryDome, OldBible, PegPerson, Pigeon, Planet, QuestionCircle,
  RadioMic, RockyHill, Sky, SkyMapOval, Sparkles, SpeechBubble, StaticLines, Telescope, VerseRef, WindowLamp, clamp, fade, lerp,
  pop, prog, progInOut, pushIn, walkPhaseAt,
} from '../../../../src/kit-flat';
import type {Pose} from '../../../../src/kit-flat';
import {FONT_CAPTION, FONT_SERIF, FONT_UI} from '../../../../src/kit-flat/fonts';
import {A} from '../data.ts';

const PRIEST = {robe: '#2B2830', headColor: '#E8DCCB', outfit: 'priest' as const};
const LAB = {robe: '#F4F2EC', headColor: '#E6DDCA', outfit: 'labcoat' as const};
const zoom = (z: number, fx: number, fy: number) => `translate(${fx},${fy}) scale(${z}) translate(${-fx},${-fy})`;

const Priest: React.FC<{f: number; x: number; pose?: Pose; swing?: number; look?: number; scale?: number; walkPhase?: number}> = ({f, x, pose = 'stand', swing = 0, look, scale = 0.9, walkPhase}) => (
  <PegPerson x={x} y={GROUND_Y} scale={scale} {...PRIEST} pose={pose} armSwing={swing} look={look} walkPhase={walkPhase} frame={f} seed="priest" />
);

/** A small rounded tag (Inter caps). */
const Tag: React.FC<{x: number; y: number; text: string; s?: number; color?: string; fill?: string}> = ({x, y, text, s = 1, color = C.captionInk, fill = C.cream}) => {
  if (s <= 0) return null;
  const w = text.length * 13 + 44;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-w / 2} y={-24} width={w} height={48} rx={24} fill={fill} stroke={C.ink} strokeWidth={4} />
      <text x={0} y={8} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={22} letterSpacing={1.5} fill={color}>
        {text}
      </text>
    </g>
  );
};

// galaxy field shared by S1–S4 and S14–S16
const GALAXIES = new Array(7).fill(0).map((_, i) => {
  const a = (i / 7) * Math.PI * 2 + random(`ga${i}`) * 0.6;
  return {dx: Math.cos(a), dy: Math.sin(a) * 0.75, d: 170 + random(`gd${i}`) * 170, r: 34 + random(`gr${i}`) * 34, rot: random(`gt${i}`) * 180};
});
const CX = 540;
const CY = 640;

const GalaxyField: React.FC<{f: number; spread: number; opacity?: number; trails?: number; spin?: number}> = ({f, spread, opacity = 1, trails = 0, spin = 0}) => (
  <g opacity={opacity}>
    {GALAXIES.map((g, i) => {
      const x = CX + g.dx * g.d * spread;
      const y = CY + g.dy * g.d * spread;
      return (
        <g key={i}>
          {trails > 0
            ? [1, 2, 3].map((k) => (
                <FlatGalaxy key={k} x={CX + g.dx * g.d * Math.min(1.4, spread + k * 0.09 * trails)} y={CY + g.dy * g.d * Math.min(1.4, spread + k * 0.09 * trails)} r={g.r * Math.max(0.2, spread)} rot={g.rot + f * 0.3 + spin} opacity={0.25 - k * 0.06} seed={`g${i}`} />
              ))
            : null}
          <FlatGalaxy x={x} y={y} r={g.r * Math.max(0.15, Math.min(1, spread))} rot={g.rot + f * 0.3 + spin} seed={`g${i}`} />
        </g>
      );
    })}
  </g>
);

// --- S1: the banner ------------------------------------------------------------------------------

export const OpeningWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, 0, A.board, 1.05);
  const walkT = prog(f, 0, 70);
  const px = lerp(-60, 170, walkT);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <GalaxyField f={f} spread={1.2} opacity={0.55} />
      <FogPanel />
      <GroundLine />
      {[470, 590, 710, 830].map((x, i) => (
        <PegPerson key={i} x={x} y={GROUND_Y} scale={0.82} {...LAB} pose="armsUp" frame={f} seed={`sc${i}`} />
      ))}
      <Banner x={650} y={770} w={600} text="NO BEGINNING ∞" wave={Math.sin(f / 18)} />
      <Priest f={f} x={px} pose={walkT < 1 ? 'walk' : 'write'} walkPhase={walkPhaseAt(f, 0)} swing={0.2} />
      <Exclaim x={650} y={690} frame={f} start={A.bang} />
      <Label x={540} y={430} text="NO BEGINNING?" tone="red" size={68} scale={pop(f, 1, 8)} />
    </g>
  );
};

// --- S2–S3: the chalkboard ------------------------------------------------------------------------

const EQUATIONS = [
  'M 40 70 q 20 -40 40 0 t 40 0 t 40 0',
  'M 190 58 l 30 0 M 205 43 l 0 30',
  'M 250 50 q 30 -20 40 10 q -20 30 -40 20',
  'M 330 60 l 40 0 M 330 75 l 40 0',
  'M 400 40 q 40 -10 30 30 q -10 30 30 30',
  'M 40 150 l 60 0 M 120 130 q 30 40 60 0 t 60 0',
  'M 60 250 l 250 0 M 290 235 l 25 15 l -25 15',
];

export const BoardWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.board, A.rewindShot - A.board, 1.05);
  const draw = progInOut(f, A.chalk + 6, A.expanding - A.chalk - 4);
  const drift = 1 + 0.25 * prog(f, A.chalk, A.rewindShot - A.chalk);
  const writing = f >= A.chalk && f < A.expanding + 10;
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <GalaxyField f={f} spread={drift} opacity={0.75} />
      <FogPanel />
      <GroundLine />
      <Chalkboard x={400} y={GROUND_Y} strokes={EQUATIONS} draw={draw}>
        {f >= A.expanding ? (
          <text x={330} y={262} fontFamily={FONT_CAPTION} fontWeight={800} fontSize={40} fill="#F2EFE6" opacity={prog(f, A.expanding, 8)}>
            EXPANDING
          </text>
        ) : null}
      </Chalkboard>
      <Priest f={f} x={740} pose={writing ? 'write' : 'stand'} swing={writing ? Math.abs(Math.sin(f / 4)) : 0} />
      <Label x={540} y={420} text="GEORGES LEMAÎTRE" tone="gold" size={58} scale={pop(f, A.name, 10)} opacity={1 - prog(f, A.chalk, 8)} />
      <VerseRef x={540} y={470} text="PRIEST + PHYSICIST" opacity={fade(f, A.name + 6, 10, A.chalk, 8)} />
      <g opacity={1 - prog(f, A.chalk, 8)}>
        <g transform={`translate(0,${-40 * prog(f, A.tagPriest, 40)})`}>
          <Tag x={660} y={720} text="✝ PRIEST" s={pop(f, A.tagPriest, 10)} />
        </g>
        <g transform={`translate(0,${-40 * prog(f, A.tagPhys, 40)})`}>
          <Tag x={860} y={760} text="PHYSICIST" s={pop(f, A.tagPhys, 10)} />
          <g transform={`translate(${860 - 92},760) scale(${pop(f, A.tagPhys, 10)})`} fill="none" stroke={C.blue} strokeWidth={2.5}>
            <ellipse rx={13} ry={5} />
            <ellipse rx={13} ry={5} transform="rotate(60)" />
            <ellipse rx={13} ry={5} transform="rotate(-60)" />
          </g>
        </g>
      </g>
      <VerseRef x={540} y={404} text="1927" color={C.gold} opacity={fade(f, A.chalk + 6, 10)} size={40} />
    </g>
  );
};

// --- S4: rewind ------------------------------------------------------------------------------------

export const RewindWorld: React.FC<{f: number}> = ({f}) => {
  const t = clamp((f - A.rewind) / Math.max(20, A.point - A.rewind));
  const ease = t * t * t;
  const spread = f < A.rewind ? 1.25 : 1.25 * (1 - ease);
  const done = f >= A.point;
  return (
    <g>
      <Sky kind="night" frame={f} stars />
      {!done ? <GalaxyField f={f} spread={spread} trails={t > 0 ? t : 0} spin={ease * 200} /> : null}
      {done || t > 0.85 ? <GlowPoint x={CX} y={CY} r={9} glow={done ? 1 + 0.1 * Math.sin((f - A.point) / 6) : 0.4} /> : null}
      <FogPanel />
      <GroundLine />
      <Priest f={f} x={200} look={1} scale={0.8} />
      {f >= A.rewind - 2 && !done ? (
        <text x={540} y={430} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={64} fill={C.cream} stroke={C.ink} strokeWidth={10} strokeLinejoin="round" style={{paintOrder: 'stroke'}} opacity={pop(f, A.rewind, 8)}>
          ◀◀ REWIND
        </text>
      ) : null}
      <Label x={540} y={430} text="A BEGINNING" tone="gold" size={66} scale={pop(f, A.aBeginning, 10)} />
      <Tag x={540} y={850} text="~13.8 BILLION YEARS AGO" s={pop(f, A.aBeginning + 10, 10)} />
    </g>
  );
};

// --- S5: Einstein -------------------------------------------------------------------------------------

export const EinsteinWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.einstein, A.obs - A.einstein, 1.05);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <FogPanel />
      <GroundLine />
      <Chalkboard x={540} y={GROUND_Y} strokes={EQUATIONS} draw={1} scale={0.8} />
      <PegPerson x={180} y={GROUND_Y} scale={0.9} robe="#9A9DA6" headColor="#E6DDCA" outfit="einstein" pose="point" armSwing={0.2} frame={f} seed="ein" />
      <Priest f={f} x={880} pose={f >= A.shrug ? 'shrug' : 'stand'} swing={f >= A.shrug ? Math.sin(((f - A.shrug) / 18) * Math.PI) * (f < A.shrug + 18 ? 1 : 0) : 0} />
      <Label x={180} y={780} text="EINSTEIN" tone="cream" size={40} />
      <SpeechBubble x={430} y={560} lines={['YOUR MATH IS CORRECT,', 'BUT YOUR PHYSICS', 'IS ABOMINABLE.']} tone="red" size={34} tail={{x: -170, y: 150}} scale={pop(f, A.eBubble, 10)} />
      <Tag x={540} y={404} text="REPORTEDLY · 1927" s={pop(f, A.reportedly, 10)} />
    </g>
  );
};

// --- S6: 1929 observatory ------------------------------------------------------------------------------

export const ObservatoryWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.obs, A.radio - A.obs, 1.04);
  const lens = pop(f, A.lens, 12);
  const apart = 0.5 + 0.9 * prog(f, A.lens + 6, A.radio - A.lens);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <FogPanel />
      <GroundLine />
      <RockyHill x={260} y={GROUND_Y} w={520} h={120} />
      <Telescope x={410} y={GROUND_Y - 120} tilt={-55} scale={0.8} />
      <ObservatoryDome x={250} y={GROUND_Y - 120} open={prog(f, A.obs + 6, 24)} scale={0.8} />
      <VerseRef x={650} y={404} text="1929 · HUBBLE" color={C.gold} size={36} opacity={fade(f, A.obs + 8, 10)} />
      {lens > 0 ? (
        <LensView x={650} y={650} r={210} scale={lens}>
          {[[-1, -0.6], [1, -0.4], [-0.6, 0.8], [0.8, 0.7], [0, 0]].map(([dx, dy], i) => (
            <g key={i}>
              <FlatGalaxy x={dx * 120 * apart} y={dy * 100 * apart} r={30} rot={i * 40 + f * 0.4} seed={`l${i}`} />
              {i < 4 ? (
                <path d={`M ${dx * 120 * apart + dx * 36} ${dy * 100 * apart + dy * 30} l ${dx * 34} ${dy * 28}`} stroke={C.red} strokeWidth={6} strokeLinecap="round" markerEnd="" />
              ) : null}
            </g>
          ))}
        </LensView>
      ) : null}
    </g>
  );
};

// --- S7: 1949 radio ------------------------------------------------------------------------------------

export const RadioWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.radio, A.antenna - A.radio, 1.05);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <rect x={-200} y={-400} width={1480} height={GROUND_Y + 400} fill="#5E4F5C" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={60 + i * 170} y={560} width={120} height={120} rx={8} fill="#6E5D6B" stroke={C.ink} strokeOpacity={0.3} strokeWidth={3} />
      ))}
      <Glow x={560} y={800} r={380} color="#FFC97A" opacity={0.35} />
      <FogPanel tint="#5E4F5C" tintAmount={0.5} />
      <GroundLine />
      <PegPerson x={330} y={GROUND_Y} scale={0.9} robe="#7C8696" headColor="#E6DDCA" outfit="suit" pose="stand" frame={f} seed="hoyle" />
      <RadioMic x={530} y={GROUND_Y} onAir={Math.floor(f / 20) % 2 === 0 ? 1 : 0.8} scale={0.85} />
      <Label x={330} y={790} text="FRED HOYLE" tone="cream" size={38} />
      <Tag x={330} y={720} text="BELIEVED: NO BEGINNING" s={pop(f, A.believed, 10)} />
      <SpeechBubble x={720} y={620} lines={['…THIS BIG BANG', 'IDEA…']} tone="gold" size={36} tail={{x: -140, y: 120}} scale={pop(f, A.bigBang - 6, 10)} />
      <Label x={540} y={430} text="BIG BANG" tone="gold" size={84} scale={pop(f, A.bigBang, 10)} />
      <VerseRef x={540} y={490} text="BBC RADIO · 1949" color={C.cream} opacity={fade(f, A.bigBang + 8, 10)} />
      <Exclaim x={860} y={480} frame={f} start={A.hoyle} color={C.gold} />
    </g>
  );
};

// --- S8: 1965 antenna -------------------------------------------------------------------------------------

export const AntennaWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.antenna, A.glowShot - A.antenna, 1.04);
  const shoo = f >= A.pigeon - 4;
  const fly = prog(f, A.pigeon, 30);
  const sweeping = f >= A.pigeon + 16;
  return (
    <g transform={zoom(z, 540, 1050)}>
      <defs>
        <linearGradient id="daySky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A9CBE8" />
          <stop offset="1" stopColor="#E3EEF6" />
        </linearGradient>
      </defs>
      <rect x={-200} y={-400} width={1480} height={GROUND_Y + 400} fill="url(#daySky)" />
      <circle cx={860} cy={500} r={70} fill="#FFE7A6" />
      <Glow x={860} y={500} r={260} color="#FFF0C2" opacity={0.7} />
      <FogPanel tint="#CFE0EC" tintAmount={0.5} />
      <GroundLine />
      <HornAntenna x={640} y={GROUND_Y} scale={1} />
      <StaticLines x={830} y={890} frame={f} opacity={fade(f, A.hiss, 12)} />
      <Pigeon x={650 + fly * 260} y={880 - fly * 420} frame={f} flap={fly > 0} />
      <Pigeon x={760 + fly * 320} y={850 - fly * 380} frame={f + 2} flap={fly > 0} flip />
      <PegPerson x={200} y={GROUND_Y} scale={0.85} robe="#7C8696" headColor="#E6DDCA" outfit="suit" pose={shoo && !sweeping ? 'shoo' : 'stand'} armSwing={1} frame={f} seed="pz" />
      <PegPerson x={340} y={GROUND_Y} scale={0.85} robe="#A9AEB8" headColor="#E6DDCA" outfit="suit" pose={sweeping ? 'sweep' : shoo ? 'shoo' : 'stand'} armSwing={1} frame={f + 5} seed="wl" />
      {sweeping ? <Broom x={300 + Math.sin(f * 0.5) * 18} y={GROUND_Y - 4} rotate={-30} scale={0.9} /> : null}
      <Label x={270} y={790} text="PENZIAS + WILSON" tone="cream" size={36} />
      <VerseRef x={540} y={404} text="1965" color={C.red} ring={false} size={44} opacity={fade(f, A.antenna + 8, 10)} />
    </g>
  );
};

// --- S9: the afterglow -------------------------------------------------------------------------------------

export const AfterglowWorld: React.FC<{f: number}> = ({f}) => {
  const reveal = prog(f, A.afterglow - 6, 24);
  const back = progInOut(f, A.every, 24);
  return (
    <g>
      <Sky kind="night" frame={f} stars />
      <FogPanel />
      <GroundLine />
      <StaticLines x={540} y={760} frame={f} opacity={1 - reveal} spread={1.2} />
      <g transform={zoom(1 - 0.3 * back, 540, 700)}>
        <g opacity={reveal}>
          <SkyMapOval x={540} y={700} w={800} h={400} reveal={reveal} frame={f} />
        </g>
        {back > 0 ? (
          <g opacity={back}>
            <Glow x={540} y={700} r={150} color="#FFE2A0" opacity={0.9} />
            <Planet x={540} y={700} r={52} />
            {new Array(10).fill(0).map((_, i) => {
              const a = (i / 10) * Math.PI * 2;
              return <line key={i} x1={540 + Math.cos(a) * 340} y1={700 + Math.sin(a) * 170} x2={540 + Math.cos(a) * 110} y2={700 + Math.sin(a) * 66} stroke={C.gold} strokeWidth={5} strokeLinecap="round" strokeDasharray="0.1 14" />;
            })}
          </g>
        ) : null}
      </g>
      <Label x={540} y={430} text="THE AFTERGLOW · 1965" tone="gold" size={54} scale={pop(f, A.afterglow, 10)} />
      <Tag x={540} y={1000} text="NOBEL PRIZE 1978" s={pop(f, A.every + 10, 10)} />
    </g>
  );
};

// --- S10: the news -----------------------------------------------------------------------------------------

export const NewsWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.news, A.page - A.news, 1.05);
  const lt = prog(f, A.letter, 20);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <rect x={-200} y={-400} width={1480} height={GROUND_Y + 400} fill="#3E3953" />
      <WindowLamp x={380} y={680} frame={f} />
      <FogPanel tint="#3E3953" tintAmount={0.55} />
      <GroundLine />
      <rect x={700} y={GROUND_Y - 150} width={170} height={20} rx={6} fill={C.woodDark} stroke={C.ink} strokeWidth={5} />
      <line x1={720} y1={GROUND_Y - 130} x2={720} y2={GROUND_Y} stroke={C.ink} strokeWidth={6} />
      <line x1={850} y1={GROUND_Y - 130} x2={850} y2={GROUND_Y} stroke={C.ink} strokeWidth={6} />
      <PegPerson x={785} y={GROUND_Y - 100} scale={0.85} {...PRIEST} pose="sit" look={0.3} frame={f} seed="old" />
      {lt > 0 ? <Letter x={lerp(1150, 690, lt)} y={lerp(700, 900, lt) - Math.sin(Math.PI * lt) * 80} rotate={lerp(25, -6, lt)} scale={0.9} /> : null}
      <Exclaim x={785} y={700} frame={f} start={A.letter + 18} color={C.gold} />
      <Label x={540} y={430} text="1966" tone="gold" size={70} scale={pop(f, A.news + 8, 10)} />
    </g>
  );
};

// --- S11: page one ---------------------------------------------------------------------------------------

const GEN_LINES = ['IN THE BEGINNING', 'GOD CREATED', 'THE HEAVEN AND', 'THE EARTH.'];

export const BibleWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.page, A.dominoes - A.page, 1.04);
  const words = A.T.tl.words.filter((w) => w.sentence === 14);
  const lit = words.filter((w) => f >= Math.round(w.start * 30)).length;
  return (
    <g transform={zoom(z, 540, 1000)}>
      <Sky kind="dawn" frame={f} />
      <Glow x={540} y={760} r={560} color="#FFD58A" opacity={0.5 + 0.4 * prog(f, A.gen, 40)} />
      <FogPanel tint={C.dawnLow} tintAmount={0.6} />
      <GroundLine />
      <Tag x={540} y={500} text="EVIDENCE · NOT PROOF" s={pop(f, A.page + 10, 10) * (1 - prog(f, A.gen - 6, 8))} />
      <OldBible x={540} y={800} lines={GEN_LINES} lit={lit} scale={pop(f, A.page + 14, 12) * 0.98} />
      <VerseRef x={540} y={470} text="GENESIS 1:1" color={C.red} ring={false} size={36} opacity={fade(f, A.gen, 10)} />
      <Sparkles x={540} y={720} frame={f} start={A.god} count={14} radius={260} />
    </g>
  );
};

// --- S12: dominoes ---------------------------------------------------------------------------------------

export const DominoWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.dominoes, A.boxes - A.dominoes, 1.05);
  const n = 8;
  const step = Math.max(4, Math.floor((A.cause - A.chain) / n));
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <FogPanel />
      <GroundLine />
      {new Array(n).fill(0).map((_, i) => {
        const k = n - 1 - i; // rightmost falls first
        const x = 150 + i * 92;
        const fall = prog(f, A.chain + k * step, 10);
        return <Domino key={i} x={x} y={GROUND_Y} fall={fall} />;
      })}
      <Label x={540} y={430} text="EFFECT ← CAUSE" tone="gold" size={58} scale={pop(f, A.chain - 6, 10)} />
      {f >= A.whyQ ? <QuestionCircle x={170} y={800} scale={pop(f, A.whyQ, 12) * 0.8} /> : null}
      {f >= A.whyQ ? <Tag x={190} y={660} text="NOTHING BEHIND IT" s={pop(f, A.whyQ + 10, 10)} /> : null}
    </g>
  );
};

// --- S13: outside time, space, matter ------------------------------------------------------------------

export const BoxesWorld: React.FC<{f: number}> = ({f}) => {
  const light = prog(f, A.outside, 30);
  return (
    <g>
      <Sky kind="night" frame={f} stars starOpacity={0.6} />
      <Glow x={540} y={760} r={760} ry={620} color="#FFD27A" opacity={light * 0.9} />
      {new Array(12).fill(0).map((_, i) => {
        const a = (i / 12) * Math.PI * 2 + f / 120;
        return <line key={i} x1={540 + Math.cos(a) * 330} y1={760 + Math.sin(a) * 300} x2={540 + Math.cos(a) * 560} y2={760 + Math.sin(a) * 500} stroke="#FFE3A3" strokeWidth={10} strokeLinecap="round" opacity={light * 0.5} />;
      })}
      <FogPanel />
      <GroundLine />
      {['TIME', 'SPACE', 'MATTER'].map((t, i) => (
        <LabelBox key={t} x={230 + i * 310} y={760} w={230} h={230} text={t} scale={pop(f, A.boxes + 8 + i * 6, 10)} />
      ))}
      <Label x={540} y={960} text="POWERFUL" tone="gold" size={52} scale={pop(f, A.powerful, 10)} />
      <Label x={540} y={1030} text="NOT MADE" tone="gold" size={52} scale={pop(f, A.notMade, 10)} />
      <Label x={540} y={1100} text="ETERNAL" tone="gold" size={52} scale={pop(f, A.eternal, 10)} />
    </g>
  );
};

// --- S14: let there be light ------------------------------------------------------------------------------

export const BurstWorld: React.FC<{f: number}> = ({f}) => {
  const b = prog(f, A.burst, 22);
  const flash = f >= A.burst ? Math.max(0, 1 - (f - A.burst) / 16) : 0;
  return (
    <g>
      <Sky kind="night" frame={f} stars starOpacity={b} />
      <Glow x={CX} y={CY} r={120 + 700 * b} color="#FFD98A" opacity={0.85 - 0.35 * b} />
      {b > 0 ? <GalaxyField f={f} spread={0.1 + 1.15 * b} spin={-(1 - b) * 220} /> : null}
      <GlowPoint x={CX} y={CY} r={9 + 40 * b} glow={1 + b} />
      {b > 0.6 ? <Planet x={780} y={900} r={56 * prog(f, A.burst + 14, 12)} color="#E9B46A" /> : null}
      <rect x={-200} y={-400} width={1480} height={2600} fill="#FFF3D6" opacity={flash * 0.45} />
      <FogPanel tint="#6B5E7A" tintAmount={0.5} />
      <GroundLine />
      <Sparkles x={CX} y={CY} frame={f} start={A.burst} count={18} radius={420} />
      <Label x={540} y={430} text="LET THERE BE LIGHT" tone="gold" size={60} scale={pop(f, A.burst + 14, 10)} />
      <VerseRef x={540} y={480} text="GENESIS 1:3" color={C.cream} opacity={fade(f, A.burst + 22, 10)} />
      {f >= A.worlds ? (
        <Card x={540} y={1010} refText="HEBREWS 11:3" w={820} size={38} scale={pop(f, A.worlds, 12)} lines={[[['…THE WORLDS WERE FRAMED']], [['BY THE '], ['WORD OF GOD', C.gold], ['…']]]} />
      ) : null}
    </g>
  );
};

// --- S15: him ------------------------------------------------------------------------------------------------

export const HimWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.him, A.cta - A.him, 1.05);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <GalaxyField f={f} spread={1.3} opacity={0.6} />
      <Glow x={540} y={880} r={420} color="#FFD98A" opacity={0.7} />
      <FogPanel />
      <GroundLine />
      <RockyHill x={540} y={GROUND_Y} w={520} h={110} fill="#4D4A66" />
      <Jesus x={540} y={GROUND_Y - 110} scale={0.9} pose="armsOpen" frame={f} glow={1.4} />
      {f >= A.allThings ? (
        <Card x={540} y={520} refText="JOHN 1:3" w={800} size={40} scale={pop(f, A.allThings, 12)} lines={[[['ALL THINGS WERE '], ['MADE BY HIM', C.gold], [';']]]} />
      ) : null}
    </g>
  );
};

// --- S16: call to action ---------------------------------------------------------------------------------------

export const CtaWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.cta, A.endCard - A.cta, 1.04);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <GalaxyField f={f} spread={1.3} opacity={0.8} />
      <FogPanel />
      <GroundLine />
      <Priest f={f} x={260} look={1} scale={0.85} />
      <PegPerson x={820} y={GROUND_Y} scale={0.85} {...LAB} pose="stand" look={1} frame={f} seed="sc0" />
      <Label x={540} y={520} text="WHO STARTED IT?" tone="gold" size={62} scale={pop(f, A.who, 10)} />
      <Sparkles x={540} y={720} frame={f} start={A.typing + 26} count={16} radius={300} />
      <DottedPath d="M 260 820 Q 540 560 820 820" len={640} progress={prog(f, A.cta + 6, 30)} arrow={null} />
    </g>
  );
};

export const GalaxyBackdrop: React.FC<{f: number}> = ({f}) => <GalaxyField f={f} spread={1.3} opacity={0.5} />;
