import React from 'react';
import {
  AshPatch, BoardSign, BrokenHeart, C, Card, DottedPath, Exclaim, FlatCross, FogPanel, GROUND_Y, Glow, GroundLine, Harp,
  Heart, House, Jesus, Label, LightColumn, MorphBubble, MusicNote, PathFloor, PegPerson, RainCloud, RockyHill, Scroll,
  Sky, Stamp, Stone, VerseRef, AnswerButtons, clamp, fade, lerp, pop, prog, progInOut, pushIn, walkPhaseAt,
} from '../../../../src/kit-flat';
import type {Pose} from '../../../../src/kit-flat';
import {FONT_SERIF} from '../../../../src/kit-flat/fonts';
import {A} from '../data.ts';
import {TYPE_FRAMES} from '../anchors.ts';

export const DAVID_WRAP = '#3D5A8C';
const HILL_X = 330;
const HILL_TOP = GROUND_Y - 150;
const zoom = (z: number, fx: number, fy: number) => `translate(${fx},${fy}) scale(${z}) translate(${-fx},${-fy})`;

const David: React.FC<{f: number; pose: Pose; tremble?: number; look?: number; y?: number; sway?: number; swing?: number}> = ({f, pose, tremble = 0, look = 1, y = HILL_TOP, sway = 0, swing = 0}) => (
  <g transform={`rotate(${sway} ${HILL_X} ${y})`}>
    <PegPerson x={HILL_X} y={y} scale={0.9} robe={C.robeRust} wrap beard wrapColor={DAVID_WRAP} pose={pose} tremble={tremble} look={look} armSwing={swing} frame={f} seed="david" />
  </g>
);

const Hill = () => <RockyHill x={HILL_X} y={GROUND_Y} w={480} h={150} />;

// --- S1–S4: David on the hill at night -------------------------------------------------

const THROWN = [
  {at: () => A.b1, x: 290, y: 480, lines: ['FORGET ME?']},
  {at: () => A.b2, x: 750, y: 490, lines: ['HIDE THY', 'FACE?']},
  {at: () => A.b3, x: 205, y: 640, lines: ['SORROW IN', 'MY HEART?']},
  {at: () => A.b4, x: 740, y: 670, lines: ['MY ENEMY?']},
];

export const DavidNight: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, 0, A.job, 1.06);
  const head = {x: HILL_X, y: HILL_TOP - 330};
  const stackT = progInOut(f, A.stack, 18);
  const angry = f < A.honest;
  return (
    <g transform={zoom(z, 420, 1050)}>
      <Sky kind="night" frame={f} moon={{x: 830, y: 820, r: 110}} />
      <FogPanel />
      <GroundLine />
      <Hill />
      <David f={f} pose={angry ? 'armsUp' : 'stand'} tremble={angry ? 0.75 : 0.1} look={1} />
      {f < A.psalmLabel + 8 ? (
        <g opacity={1 - prog(f, A.psalmLabel - 4, 10)}>
          <Label x={540} y={420} text="ANGRY AT GOD?" tone="red" size={66} scale={pop(f, 1, 8)} />
          <MorphBubble x={360} y={540} lines={['HOW LONG?!']} size={48} tail={{x: -24, y: 110}} scale={pop(f, A.howLong, 10)} seed="hl" />
        </g>
      ) : null}
      {f >= A.scroll - 2 && f < A.b1 + 10 ? (
        <g opacity={1 - prog(f, A.psalmLabel + 4, 12)}>
          <Scroll x={790} y={860} unroll={prog(f, A.scroll, 18)} title="PSALM 13" sub="A PSALM OF DAVID" scale={0.78} rotate={4} />
          <Stamp x={790} y={975} text="IN THE BIBLE" t={prog(f, A.stamp, 5)} size={30} />
        </g>
      ) : null}
      <VerseRef x={540} y={404} text="PSALM 13:1–2" opacity={fade(f, A.psalmLabel + 6, 10, A.stack, 10)} />
      {THROWN.map((b, i) => {
        const at = b.at();
        if (f < at) return null;
        const t = prog(f, at, 11);
        const bx = lerp(head.x, b.x, t);
        const by = lerp(head.y, b.y, t) - Math.sin(Math.PI * t) * 90;
        const sx = lerp(bx, 790, stackT);
        const sy = lerp(by, 560 - i * 30, stackT);
        return (
          <MorphBubble
            key={i}
            x={sx}
            y={sy}
            lines={b.lines}
            size={36}
            badge={i + 1}
            tail={{x: clamp((head.x - b.x) * 0.3, -110, 110), y: 92}}
            scale={pop(f, at, 12) * lerp(1, 0.55, stackT)}
            seed={`b${i}`}
          />
        );
      })}
      <Label x={540} y={430} text="NOT POLITE. HONEST." tone="gold" size={58} scale={pop(f, A.honest - 4, 10)} />
    </g>
  );
};

// --- S5–S8: Job ---------------------------------------------------------------------------

const JOB_X = 450;
const jab = (f: number, at: number) => (f >= at && f < at + 14 ? Math.sin(((f - at) / 14) * Math.PI) : 0);

export const JobWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.job, A.cross - A.job, 1.05);
  const light = prog(f, A.light, 30);
  const look = f < A.jobLook ? -1 : lerp(-1, 1, prog(f, A.jobLook, 14));
  const melt = prog(f, A.jobFill, 30);
  const crackT = prog(f, A.crack, 26);
  const friendsIn = prog(f, A.friends, 12);
  const backOff = 40 * prog(f, A.anger, 20);
  const friendBubbles = [
    {at: A.f1, x: 230, y: 560, lines: ['IT’S YOUR', 'FAULT!'], tail: {x: -40, y: 110}},
    {at: A.f2, x: 770, y: 470, lines: ['YOU DID', 'SOMETHING!'], tail: {x: -20, y: 110}},
    {at: A.f3, x: 700, y: 660, lines: ['JUST', 'ADMIT IT!'], tail: {x: 60, y: 110}},
  ];
  return (
    <g transform={zoom(z, JOB_X, 1050)}>
      <Sky kind="greyDay" frame={f} />
      <g opacity={light * 0.75}>
        <Sky kind="dawn" frame={f} />
      </g>
      <LightColumn x={600} y={GROUND_Y} frame={f} strength={light} />
      <FogPanel tint="#B4B6C0" tintAmount={0.6} />
      <GroundLine />
      <AshPatch x={JOB_X} y={GROUND_Y} w={300} />
      <Glow x={JOB_X} y={GROUND_Y - 200} r={300} color="#FFD58A" opacity={prog(f, A.honestMan, 20) * 0.8} />
      <g transform={`translate(0,${Math.sin(f / 22) * 2})`}>
        <PegPerson x={JOB_X} y={GROUND_Y} robe={C.robeGrey} wrap beard wrapColor="#7E828C" pose="sitGround" look={look} frame={f} seed="job" />
      </g>
      <g opacity={1 - melt}>
        <RainCloud x={JOB_X} y={GROUND_Y - 470} frame={f} melt={melt} />
        <BrokenHeart x={300} y={790 + Math.sin(f / 18) * 6} scale={1.1} />
        <BrokenHeart x={610} y={770 + Math.sin(f / 21 + 1) * 6} scale={0.95} />
      </g>
      {friendsIn > 0 ? (
        <g opacity={friendsIn}>
          <PegPerson x={170 - backOff} y={GROUND_Y} scale={0.85} robe={C.robeBlush} pose="point" armSwing={jab(f, A.f1)} tremble={f >= A.anger ? 0.25 : 0} frame={f} seed="fa" />
          <PegPerson x={760 + backOff} y={GROUND_Y} scale={0.85} robe={C.robeCream} wrap beard pose="pointLeft" armSwing={jab(f, A.f2)} tremble={f >= A.anger ? 0.25 : 0} frame={f} seed="fb" />
          <PegPerson x={900 + backOff} y={GROUND_Y} scale={0.85} robe={C.robeSage} pose="pointLeft" armSwing={jab(f, A.f3)} tremble={f >= A.anger ? 0.25 : 0} frame={f} seed="fc" />
        </g>
      ) : null}
      {friendBubbles.map((b, i) =>
        f >= b.at && crackT < 1 ? (
          <g key={i} transform={`translate(${(i - 1) * 40 * crackT},${700 * crackT * crackT}) rotate(${(i - 1 || 1) * 25 * crackT} ${b.x} ${b.y})`} opacity={1 - crackT}>
            <MorphBubble x={b.x} y={b.y} lines={b.lines} size={34} badge={i + 1} tail={b.tail} scale={pop(f, b.at, 10)} seed={`fb${i}`} />
            {crackT > 0 ? (
              <path
                d={`M ${b.x - 60} ${b.y - 50} l 30 30 l -14 18 l 34 24 l -10 30`}
                fill="none"
                stroke={C.ink}
                strokeWidth={4}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>
        ) : null,
      )}
      <Label x={540} y={420} text="JOB" tone="gold" size={70} scale={pop(f, A.job + 10, 10)} opacity={1 - prog(f, A.complain - 6, 8)} />
      <VerseRef x={540} y={404} text="JOB 7:11" opacity={fade(f, A.complain, 10, A.friends, 10)} />
      {f >= A.complain && f < A.f1 + 10 ? (
        <g opacity={1 - prog(f, A.friends, 10)}>
          <MorphBubble x={620} y={560} lines={['I WILL', 'COMPLAIN…']} size={38} morph={1} from={C.blue} to={C.blue} tail={{x: -130, y: 180}} scale={pop(f, A.complain, 10)} />
        </g>
      ) : null}
      {f >= A.card42 ? (
        <Card
          x={540}
          y={560}
          refText="JOB 42:7"
          w={830}
          size={36}
          scale={pop(f, A.card42, 12)}
          opacity={1 - prog(f, A.cross - 14, 10)}
          lines={[[['YE HAVE NOT SPOKEN OF ME']], [['THE THING THAT IS '], ['RIGHT', C.gold], [',']], [['AS MY SERVANT JOB HATH.']]]}
        />
      ) : null}
    </g>
  );
};

// --- S9–S10: the cross ----------------------------------------------------------------------

export const CrossWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.cross, A.sign - A.cross, 1.05);
  const foot = GROUND_Y - 90;
  const p22 = prog(f, A.psalm22, 24);
  return (
    <g transform={zoom(z, 540, 1000)}>
      <Sky kind="darkDay" frame={f} />
      <FogPanel tint="#4E4559" tintAmount={0.65} />
      <GroundLine />
      <Glow x={540} y={foot - 280} r={360} color="#FFD58A" opacity={0.45} />
      <RockyHill x={540} y={GROUND_Y} w={560} h={90} fill="#3B3548" />
      <FlatCross x={540} y={foot} h={520} beamY={257} beamW={440} />
      <Jesus x={540} y={foot} scale={0.9} pose="cross" frame={f} glow={0.7} />
      <VerseRef x={540} y={404} text="MATTHEW 27:46" opacity={fade(f, A.whyBubble, 10)} />
      <MorphBubble x={540} y={528} lines={['MY GOD, MY GOD,', 'WHY HAST THOU', 'FORSAKEN ME?']} size={32} morph={1} from={C.blue} to={C.blue} tail={{x: 0, y: 100}} scale={pop(f, A.whyBubble, 10)} />
      {f >= A.psalm22 - 2 ? (
        <>
          <DottedPath d="M 770 520 Q 940 520 860 690" len={330} progress={p22} arrow={{x: 860, y: 690, angle: 105}} />
          <Scroll x={850} y={850} unroll={prog(f, A.psalm22 + 18, 16)} title="PSALM 22" sub="DAVID" scale={0.52} titleColor={C.gold} />
          <Exclaim x={850} y={700} frame={f} start={A.psalm22Bang} color={C.gold} />
        </>
      ) : null}
    </g>
  );
};

// --- S11: angry ≠ sin -------------------------------------------------------------------------

export const SignWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.sign, A.away - A.sign, 1.05);
  return (
    <g transform={zoom(z, 540, 1100)}>
      <Sky kind="night" frame={f} moon={{x: 820, y: 560, r: 95}} />
      <FogPanel />
      <GroundLine />
      <g transform={zoom(pop(f, A.sign + 8, 12), 540, GROUND_Y)}>
        <BoardSign x={540} y={GROUND_Y} w={640}>
          <text x={-150} y={26} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={74} fill={C.red} letterSpacing={2}>
            ANGRY
          </text>
          <g stroke={C.ink} strokeWidth={8} strokeLinecap="round">
            <line x1={36} y1={-12} x2={86} y2={-12} />
            <line x1={36} y1={10} x2={86} y2={10} />
            <line x1={74} y1={-30} x2={48} y2={28} />
          </g>
          <text x={190} y={26} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={74} fill={C.gold} letterSpacing={2}>
            SIN
          </text>
        </BoardSign>
      </g>
      {f >= A.eph ? (
        <Card x={540} y={540} refText="EPHESIANS 4:26" w={800} size={40} scale={pop(f, A.eph, 12)} lines={[[['BE YE ANGRY, AND '], ['SIN NOT', C.gold], [':']]]} />
      ) : null}
    </g>
  );
};

// --- S12: walking away (+ rewind) -------------------------------------------------------------

const AWAY_FROM = 680;
const AWAY_TO = 240;

export const AwayWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.away, A.dawn - A.away, 1.04);
  const walkEnd = Math.max(A.away + 50, A.door - 4);
  const r = prog(f, A.rewind, 14);
  const fwd = progInOut(f, A.away + 8, walkEnd - A.away - 8);
  const x = f < A.rewind ? lerp(AWAY_FROM, AWAY_TO, fwd) : lerp(AWAY_TO, AWAY_FROM, r);
  const walking = (f > A.away + 8 && f < walkEnd) || (r > 0 && r < 1);
  const door = f < A.rewind ? prog(f, A.door, 10) : 1 - r;
  const glow = f < A.rewind ? 1 - 0.85 * prog(f, A.door, 22) : 0.15 + 0.85 * r;
  const cloud = (f < A.rewind ? prog(f, A.silent, 16) : 1 - r) * (f >= A.silent ? 1 : 0);
  const phase = f < A.rewind ? walkPhaseAt(f, A.away) : -walkPhaseAt(f, A.rewind) * 3;
  return (
    <g transform={zoom(z, 540, 1100)}>
      <Sky kind="night" frame={f} moon={{x: 200, y: 520, r: 80}} />
      <Glow x={760} y={GROUND_Y - 120} r={300} color="#FFC46E" opacity={0.5 * glow} />
      <FogPanel />
      <GroundLine />
      <House x={790} y={GROUND_Y} scale={1.15} glow={glow} door={door} />
      {r > 0 && r < 1
        ? [1, 2, 3].map((k) => (
            <PegPerson key={k} x={lerp(AWAY_TO, AWAY_FROM, clamp(r - k * 0.09))} y={GROUND_Y} scale={0.95} robe={C.youBlue} pose="walk" walkPhase={phase} frame={f} seed="you" opacity={0.4 - k * 0.1} />
          ))
        : null}
      <PegPerson x={x} y={GROUND_Y} scale={0.95} robe={C.youBlue} pose={walking ? 'walk' : 'stand'} walkPhase={phase} frame={f} seed="you" />
      <Label x={x} y={GROUND_Y - 410} text="YOU" tone="green" size={40} />
      {cloud > 0 ? (
        <g opacity={cloud}>
          <RainCloud x={x} y={GROUND_Y - 500} frame={f} />
        </g>
      ) : null}
      <Label x={540} y={420} text="THE REAL DANGER" tone="red" size={62} scale={pop(f, A.danger, 10)} opacity={1 - prog(f, A.rewind, 6)} />
      {r > 0 && r < 1 ? (
        <text x={540} y={430} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={70} fill={C.cream} opacity={0.85}>
          ◀◀
        </text>
      ) : null}
    </g>
  );
};

// --- S13–S14: dawn on the hill ------------------------------------------------------------------

export const DawnWorld: React.FC<{f: number; singing: boolean}> = ({f, singing}) => {
  const z = pushIn(f, A.dawn, A.path - A.dawn, 1.06);
  const d = progInOut(f, A.dawn, 60);
  const bright = singing ? prog(f, A.sing, 40) : 0;
  const m = prog(f, A.morph, 20);
  const seat = HILL_TOP - 66;
  return (
    <g transform={zoom(z, 420, 1050)}>
      <Sky kind="night" frame={f} moon={{x: 830, y: 820, r: 110}} starOpacity={1 - d} />
      <g opacity={d}>
        <Sky kind="dawn" frame={f} />
      </g>
      <Glow x={HILL_X + 60} y={GROUND_Y - 60 - 140 * d} r={320 + 420 * d + 120 * bright} color="#FFC46E" opacity={d} />
      <FogPanel tint={C.dawnLow} tintAmount={0.6 * d} />
      <GroundLine />
      <Hill />
      {!singing ? (
        <>
          <David f={f} pose="stand" look={1} />
          <MorphBubble
            x={590}
            y={520}
            lines={m < 0.5 ? ['HOW', 'LONG?!'] : ['BUT I HAVE TRUSTED', 'IN THY MERCY.']}
            width={620}
            size={40}
            morph={m}
            tail={{x: -170, y: 130}}
            scale={pop(f, A.dawn + 10, 10)}
            seed="dm"
          />
          <VerseRef x={540} y={404} text="PSALM 13:5" color={C.red} ring={false} opacity={fade(f, A.morph + 12, 10)} />
        </>
      ) : (
        <>
          <Stone x={HILL_X} y={HILL_TOP + 2} scale={0.68} />
          <David f={f} pose="harp" look={0.6} y={seat + 49} sway={Math.sin(f / 20) * 2} swing={Math.abs(Math.sin(f / 6))} />
          <Harp x={HILL_X + 92} y={seat + 30} scale={0.72} pluck={(f % 12) / 12} />
          {new Array(8).fill(0).map((_, i) => {
            const born = A.sing + 8 + i * 14;
            const t = (f - born) / 70;
            if (t <= 0 || t >= 1) return null;
            return <MusicNote key={i} x={HILL_X + 40 + t * (120 + (i % 3) * 60)} y={seat - 40 - t * 300} scale={1.1} opacity={Math.sin(Math.PI * t)} rotate={Math.sin(t * 6 + i) * 12} />;
          })}
          <MorphBubble x={620} y={520} lines={['I WILL SING', 'UNTO THE LORD']} size={40} morph={1} tail={{x: -190, y: 150}} scale={pop(f, A.singBubble, 10)} />
          <VerseRef x={540} y={404} text="PSALM 13:6" color={C.red} ring={false} opacity={fade(f, A.singBubble, 10)} />
        </>
      )}
    </g>
  );
};

// --- S15: rather hear it --------------------------------------------------------------------------

export const PathWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.path, A.cta - A.path, 1.05);
  const walkEnd = Math.max(A.path + 40, A.rather - 4);
  const jt = prog(f, A.path + 6, walkEnd - A.path - 6);
  const jx = lerp(1180, 720, jt);
  const walking = f > A.path + 6 && f < walkEnd;
  return (
    <g transform={zoom(z, 540, 1100)}>
      <Sky kind="dawn" frame={f} />
      <Glow x={1000} y={GROUND_Y - 40} r={560} color="#FFC46E" opacity={0.8} />
      <FogPanel tint={C.dawnLow} tintAmount={0.7} />
      <Glow x={960} y={GROUND_Y + 40} r={420} ry={190} color="#FFC97A" opacity={0.55} />
      <PathFloor toX={960} />
      <GroundLine />
      <Jesus x={jx} y={GROUND_Y} scale={0.9} pose={walking ? 'walk' : 'armsOpen'} walkPhase={walkPhaseAt(f, A.path)} frame={f} glow={1.3} />
      <PegPerson x={340} y={GROUND_Y} scale={0.9} robe={C.youBlue} pose="stand" frame={f} seed="you" />
      {f >= A.rather ? (
        <DottedPath d={`M 380 850 Q 530 690 680 850`} len={360} progress={progInOut(f, A.rather, 18)} arrow={null} />
      ) : null}
      {[A.rather + 2, A.rather + 10, A.loseYou, A.loseYou + 8].map((at, i) =>
        f >= at ? <Heart key={i} x={[470, 590, 530, 410][i]} y={[760, 730, 690, 720][i]} frame={f} start={at} size={1.5} fill={i >= 2 ? '#F6D9A0' : 'none'} /> : null,
      )}
      {f >= A.pour ? (
        <Card
          x={540}
          y={520}
          refText="PSALM 62:8"
          w={820}
          size={38}
          scale={pop(f, A.pour, 12)}
          lines={[[['YE PEOPLE, '], ['POUR OUT', C.gold]], [['YOUR HEART', C.gold], [' BEFORE HIM:']], [['GOD IS A REFUGE FOR US.']]]}
        />
      ) : null}
    </g>
  );
};

// --- S16: call to action -------------------------------------------------------------------------

export const CtaWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.cta, A.endCard - A.cta, 1.04);
  const done = A.typing + TYPE_FRAMES + 2;
  return (
    <g transform={zoom(z, 420, 1050)}>
      <Sky kind="night" frame={f} moon={{x: 830, y: 860, r: 100}} />
      <FogPanel />
      <GroundLine />
      <Hill />
      <PegPerson x={HILL_X} y={HILL_TOP} scale={0.9} robe={C.youBlue} pose="pray" frame={f} seed="you" />
      <AnswerButtons x={540} y={500} labels={['YES', 'NO']} colors={[C.gold, C.red]} pressed={f >= A.btnYes ? 'YES' : null} pulse={Math.max(0, 1 - (f - A.btnYes) / 10)} scale={pop(f, A.cta + 8, 12)} />
      {f >= done
        ? [0, 8, 16].map((d, i) => <Heart key={i} x={[420, 540, 660][i]} y={700} frame={f} start={done + d} size={1.5} float={220} />)
        : null}
    </g>
  );
};
