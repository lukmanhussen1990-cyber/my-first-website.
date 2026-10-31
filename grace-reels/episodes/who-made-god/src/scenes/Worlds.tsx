import React from 'react';
import {random} from 'remotion';
import {
  AlphaOmegaBar, AnswerButtons, BurningBush, C, Card, ChainArrow, ChainCard, Chessboard, DottedPath, Easel, Exclaim, FlatGalaxy,
  FogPanel, GROUND_Y, Glow, GoldCheck, GroundLine, Heart, Jesus, Label, Mountains, PaintPalette, PegPerson, QuestionCircle, RedX, Sky,
  Sparkles, SpeechBubble, Stable, StepCounter, VerseRef, clamp, fade, lerp, pop, prog, progInOut, pushIn, walkPhaseAt,
} from '../../../../src/kit-flat';
import type {ChainIcon} from '../../../../src/kit-flat';
import {FONT_UI} from '../../../../src/kit-flat/fonts';
import {A} from '../data.ts';
import {TYPE_FRAMES} from '../anchors.ts';

const zoom = (z: number, fx: number, fy: number) => `translate(${fx},${fy}) scale(${z}) translate(${-fx},${-fy})`;
const You: React.FC<{f: number; x: number; scale?: number; look?: number}> = ({f, x, scale = 1, look = 1}) => (
  <PegPerson x={x} y={GROUND_Y} scale={scale} robe={C.youBlue} pose="stand" look={look} frame={f} seed="you" />
);
const Tag: React.FC<{x: number; y: number; text: string; s?: number}> = ({x, y, text, s = 1}) => {
  if (s <= 0) return null;
  const w = text.length * 13 + 44;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-w / 2} y={-24} width={w} height={48} rx={24} fill={C.cream} stroke={C.ink} strokeWidth={4} />
      <text x={0} y={8} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={22} letterSpacing={1.5} fill={C.captionInk}>
        {text}
      </text>
    </g>
  );
};

// --- S1–S2: the question + the chessboard ---------------------------------------------------------

export const OpeningWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, 0, A.cards, 1.06);
  const chessOn = f >= A.chess;
  return (
    <g transform={zoom(z, 380, 1050)}>
      <Sky kind="night" frame={f} moon={{x: 850, y: 560, r: 105}} />
      <FogPanel />
      <GroundLine />
      <You f={f} x={340} scale={1.1} />
      <QuestionCircle x={340} y={660} scale={pop(f, A.q, 12) * 1.15} />
      <Label x={540} y={430} text="WHO MADE GOD?" tone="red" size={70} scale={pop(f, 1, 8)} opacity={1 - prog(f, A.chess, 8)} />
      {chessOn ? (
        <>
          <Chessboard x={760} y={980} size={280} scale={pop(f, A.chess, 12) * 0.85} piece={progInOut(f, A.piece, 12)} wobble={f >= A.checkmate ? Math.sin((f - A.checkmate) / 3) * 4 * Math.max(0, 1 - (f - A.checkmate) / 30) : 0} />
          <Label x={760} y={760} text="CHECKMATE?" tone="red" size={52} scale={pop(f, A.checkmate, 10)} />
          <Exclaim x={540} y={500} frame={f} start={A.watch} color={C.gold} />
          <Label x={540} y={430} text="WATCH THIS" tone="gold" size={66} scale={pop(f, A.watch + 2, 10)} />
        </>
      ) : null}
    </g>
  );
};

// --- S3–S4: things that began ---------------------------------------------------------------------

const Room: React.FC = () => (
  <g>
    <rect x={-200} y={-400} width={1480} height={GROUND_Y + 400} fill="#CDBFAE" />
    {[120, 360, 600, 840].map((x) => (
      <line key={x} x1={x} y1={0} x2={x} y2={GROUND_Y} stroke="#BBAC99" strokeWidth={4} />
    ))}
  </g>
);

export const CardsWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.cards, A.chain - A.cards, 1.04);
  const cards: [number, ChainIcon, string, number][] = [
    [230, 'phone', 'MADE', A.phone],
    [540, 'house', 'BUILT', A.house],
    [850, 'baby', 'BORN', A.baby],
  ];
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Room />
      <FogPanel tint="#CDBFAE" tintAmount={0.6} />
      <GroundLine />
      {cards.map(([x, icon, label, at], i) => (
        <g key={i}>
          <ChainCard x={x} y={GROUND_Y - 110} icon={icon} label={label} scale={pop(f, at, 10)} />
          <ChainArrow x1={x - 270} y1={GROUND_Y - 110} x2={x - 110} y2={GROUND_Y - 110} draw={prog(f, A.arrows + i * 8, 12)} />
          {f >= A.arrows + i * 8 ? (
            <text x={x - 285} y={GROUND_Y - 96} textAnchor="middle" fontFamily='"Playfair Display", serif' fontWeight={900} fontSize={44} fill={C.red} opacity={prog(f, A.arrows + i * 8 + 6, 8)}>
              ?
            </text>
          ) : null}
        </g>
      ))}
      {f >= A.heb ? (
        <Card x={540} y={560} refText="HEBREWS 3:4" w={820} size={38} scale={pop(f, A.heb, 12)} opacity={1 - prog(f, A.caused - 4, 10)} lines={[[['…BUT '], ['HE THAT BUILT', C.gold]], [['ALL THINGS IS GOD.', C.gold]]]} />
      ) : null}
      <Label x={540} y={560} text="CAUSED" tone="red" size={64} scale={pop(f, A.caused, 10)} />
    </g>
  );
};

// --- S5–S8: the "WHO MADE THAT?" chain -------------------------------------------------------------

const CHAIN: {icon: ChainIcon; label: string; count: string}[] = [
  {icon: 'you', label: 'YOU', count: '0'},
  {icon: 'parents', label: 'PARENTS', count: '1'},
  {icon: 'grand', label: 'GRANDPARENTS', count: '2'},
  {icon: 'great', label: 'GREAT-GRAND…', count: '3'},
  {icon: 'earth', label: 'EARTH', count: '20'},
  {icon: 'sun', label: 'SUN', count: '50'},
  {icon: 'stars', label: 'STARS', count: '100'},
  {icon: 'galaxies', label: 'GALAXIES', count: '1,000'},
  {icon: 'universe', label: 'UNIVERSE', count: '1,000,000'},
  {icon: 'universe', label: '…', count: '∞?'},
  {icon: 'universe', label: '…', count: '∞?'},
];
const STEP = 300;
const CY = 760;
const cardX = (i: number) => 540 - i * STEP;
const FIRST_X = cardX(CHAIN.length) - 260;

/** Camera for the chain: pans left with an ease-in, zooms out for the fall, then flies to the first card. */
const chainCam = (f: number) => {
  const pan1 = progInOut(f, A.chain + 6, A.space - A.chain - 6); // family
  const pan2 = prog(f, A.space, A.forever - A.space, (t) => t * t); // speeding into space
  let x = 540 - pan1 * 3 * STEP - pan2 * 5 * STEP;
  let s = 1;
  const out = progInOut(f, A.forever, 24);
  x = lerp(x, cardX(5), out);
  s = lerp(1, 0.32, out);
  const back = progInOut(f, A.rewind + 18, 30);
  x = lerp(x, FIRST_X, back);
  s = lerp(s, 1, back);
  return {x, s};
};

const fallAt = (i: number) => A.fall + i * 4; // rightmost card (YOU, index 0) falls first
const unfall = (f: number) => prog(f, A.rewind, 28);

export const ChainWorld: React.FC<{f: number}> = ({f}) => {
  const cam = chainCam(f);
  const spaceT = clamp((540 - cam.x) / (6 * STEP));
  const deep = clamp((540 - cam.x - 5 * STEP) / (4 * STEP));
  const back = unfall(f);
  return (
    <g>
      {/* backdrop: room → sky → deep space (screen space) */}
      <Room />
      <g opacity={spaceT}>
        <Sky kind="night" frame={f} stars />
      </g>
      <g opacity={deep}>
        <rect x={-200} y={-400} width={1480} height={GROUND_Y + 400} fill="#14132A" opacity={0.7} />
        {new Array(5).fill(0).map((_, i) => (
          <FlatGalaxy key={i} x={((random(`bg${i}`) * 1300 + cam.x * 0.15) % 1300) - 100} y={420 + random(`bgy${i}`) * 500} r={30 + random(`bgr${i}`) * 30} opacity={0.6} seed={`bg${i}`} />
        ))}
      </g>
      <FogPanel tint={spaceT > 0.5 ? C.nightLow : '#CDBFAE'} tintAmount={0.6} />
      <GroundLine />
      <g transform={`translate(540,${CY}) scale(${cam.s}) translate(${-cam.x},${-CY})`}>
        {/* the first card: gold, nothing pointing into it */}
        <ChainCard x={FIRST_X} y={CY} icon="iam" label="?" gold scale={pop(f, A.rewind + 30, 12)} />
        {f >= A.rewind + 30 ? <ChainArrow x1={FIRST_X + 110} y1={CY} x2={cardX(CHAIN.length - 1) - 110} y2={CY} draw={prog(f, A.rewind + 34, 14)} /> : null}
        {CHAIN.map((c, i) => {
          const x = cardX(i);
          const enterAt = A.chain + (i <= 3 ? i * 26 : 0);
          const visibleAt = i <= 3 ? enterAt : A.space + (i - 4) * 18;
          const s0 = pop(f, visibleAt, 10);
          if (s0 <= 0) return null;
          const fa = fallAt(i);
          let fall = f >= fa ? prog(f, fa, 14, (t) => t * t) : 0;
          fall = fall * (1 - back);
          const bounce = f >= fa + 14 && back === 0 ? Math.abs(Math.sin(((f - fa - 14) / 10) * Math.PI)) * 30 * Math.max(0, 1 - (f - fa - 14) / 20) : 0;
          const groundY = CY + (GROUND_Y - 70 - CY) / Math.max(0.3, cam.s);
          const y = lerp(CY, groundY, fall) - bounce;
          const dark = f >= fa ? Math.min(1, (f - fa) / 4) * (1 - back) : 0;
          return (
            <g key={i}>
              {i < CHAIN.length - 1 ? <ChainArrow x1={cardX(i + 1) + 110} y1={CY} x2={x - 110} y2={CY} draw={prog(f, visibleAt + 4, 10)} opacity={1 - dark} /> : null}
              <ChainCard x={x} y={y} icon={c.icon} label={c.label} scale={s0} dark={dark} rotate={fall * (i % 2 ? 14 : -12)} />
              {i >= 1 && i <= 3 && f < A.space + 10 ? (
                <SpeechBubble x={x} y={CY - 205} lines={['WHO MADE', 'THAT?']} tone="red" size={26} tail={{x: 0, y: 70}} scale={pop(f, visibleAt + 8, 10)} />
              ) : null}
            </g>
          );
        })}
      </g>
      <Label x={540} y={430} text="NOTHING WOULD EVER START" tone="red" size={46} scale={pop(f, A.fall + 30, 10)} opacity={1 - prog(f, A.rewind, 8)} />
      <Label x={540} y={430} text="NEVER MADE" tone="gold" size={64} scale={pop(f, A.neverMade, 10)} />
      <Label x={540} y={500} text="NEVER BEGAN" tone="gold" size={64} scale={pop(f, A.neverBegan, 10)} />
      {f >= A.rewind && f < A.rewind + 28 ? (
        <text x={540} y={560} textAnchor="middle" fontFamily='"Playfair Display", serif' fontWeight={900} fontSize={70} fill={C.cream} opacity={0.85}>
          ◀◀
        </text>
      ) : null}
    </g>
  );
};

/** STEPS BACK counter value for the chain section. */
export const counterValue = (f: number) => {
  if (f >= A.forever) return '∞?';
  const cam = chainCam(f);
  const passed = Math.floor((540 - cam.x + STEP * 0.4) / STEP);
  const i = Math.max(1, Math.min(CHAIN.length - 1, passed));
  return CHAIN[i].count;
};

// --- S9: everlasting ------------------------------------------------------------------------------

export const EverlastingWorld: React.FC<{f: number}> = ({f}) => (
  <g transform={zoom(pushIn(f, A.everlasting, A.bush - A.everlasting, 1.05), 540, 1050)}>
    <Sky kind="night" frame={f} moon={{x: 820, y: 760, r: 90}} />
    <Mountains y={GROUND_Y} rise={progInOut(f, A.everlasting + 6, 50)} />
    <FogPanel />
    <GroundLine />
    {f >= A.psalm ? (
      <Card x={540} y={520} refText="PSALM 90:2" w={820} size={38} scale={pop(f, A.psalm, 12)} lines={[[['…EVEN '], ['FROM EVERLASTING', C.gold]], [['TO EVERLASTING', C.gold], [', THOU ART GOD.']]]} />
    ) : null}
  </g>
);

// --- S10–S11: the burning bush + "just I AM" ---------------------------------------------------------

export const BushWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.bush, A.paint - A.bush, 1.05);
  const iamOut = prog(f, A.just, 10);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <FogPanel tint="#B79A72" tintAmount={0.55} />
      <GroundLine />
      <BurningBush x={640} y={GROUND_Y} frame={f} scale={0.9} />
      <PegPerson x={300} y={GROUND_Y} scale={0.9} robe={C.robeBlue} wrap beard wrapColor={C.robeRust} pose="staff" look={0.4} frame={f} seed="moses" />
      <line x1={386} y1={GROUND_Y} x2={386} y2={GROUND_Y - 420} stroke={C.woodDark} strokeWidth={9} strokeLinecap="round" />
      <Label x={300} y={760} text="MOSES" tone="cream" size={38} />
      <g opacity={1 - iamOut}>
        <SpeechBubble x={640} y={520} lines={['I AM THAT I AM']} tone="gold" size={44} tail={{x: 0, y: 150}} scale={pop(f, A.iamBubble, 10)} />
        <VerseRef x={540} y={404} text="EXODUS 3:14" color={C.cream} opacity={fade(f, A.iamBubble, 10)} />
        {f >= A.iamCard - 20 ? <ChainCard x={180} y={540} icon="iam" label={f >= A.iamCard ? 'I AM' : '?'} gold scale={pop(f, A.iamCard - 20, 10) * 0.6} /> : null}
      </g>
      {f >= A.just ? (
        <>
          <SpeechBubble x={200} y={560} lines={['I WAS', 'MADE']} tone="red" size={32} tail={{x: 0, y: 90}} scale={pop(f, A.x1 - 6, 10)} />
          <RedX x={200} y={660} s={pop(f, A.x1 + 4, 8)} />
          <SpeechBubble x={530} y={560} lines={['I', 'BEGAN']} tone="red" size={32} tail={{x: 0, y: 90}} scale={pop(f, A.x2 - 6, 10)} />
          <RedX x={530} y={660} s={pop(f, A.x2 + 4, 8)} />
          <SpeechBubble x={840} y={560} lines={['I AM']} tone="gold" size={40} tail={{x: 0, y: 80}} scale={pop(f, A.check - 6, 10)} />
          <GoldCheck x={840} y={660} s={pop(f, A.check + 2, 8)} />
          <Sparkles x={840} y={560} frame={f} start={A.check + 2} count={12} radius={150} />
        </>
      ) : null}
    </g>
  );
};

// --- S12–S13: the painting ----------------------------------------------------------------------------

export const PaintWorld: React.FC<{f: number}> = ({f}) => {
  const z = pushIn(f, A.paint, A.aToZ - A.paint, 1.05);
  return (
    <g transform={zoom(z, 540, 1050)}>
      <Sky kind="dawn" frame={f} />
      <Glow x={900} y={GROUND_Y - 60} r={420} color="#FFC46E" opacity={0.6} />
      <FogPanel tint={C.dawnLow} tintAmount={0.6} />
      <GroundLine />
      <Easel x={660} y={GROUND_Y} scale={1}>
        <PegPerson x={0} y={60} scale={0.32} robe={C.robeBlush} pose="stand" look={1} frame={f} seed="tiny" />
      </Easel>
      <PegPerson x={300} y={GROUND_Y} scale={0.9} robe={C.robeBlush} outfit="painter" pose="write" armSwing={Math.abs(Math.sin(f / 5)) * 0.6} frame={f} seed="painter" />
      <PaintPalette x={230} y={980} scale={1} />
      <SpeechBubble x={700} y={560} lines={['WHO PAINTED', 'THE PAINTER?']} tone="gold" size={32} tail={{x: -30, y: 120}} scale={pop(f, A.paintBubble, 10)} opacity={1 - prog(f, A.notGod, 8)} />
      <Exclaim x={300} y={740} frame={f} start={A.painterBang} color={C.gold} />
      <Label x={540} y={430} text="BUT NOTICE" tone="gold" size={60} scale={pop(f, A.paint + 8, 10)} opacity={1 - prog(f, A.notGod, 8)} />
      <Label x={540} y={430} text="IF SOMEONE MADE HIM…" tone="red" size={50} scale={pop(f, A.notGod + 2, 10)} />
      <Label x={540} y={505} text="…HE WOULDN’T BE GOD" tone="gold" size={50} scale={pop(f, A.notGodGold, 10)} />
    </g>
  );
};

// --- S14: A to Z ----------------------------------------------------------------------------------------

export const AtoZWorld: React.FC<{f: number}> = ({f}) => (
  <g transform={zoom(pushIn(f, A.aToZ, A.born - A.aToZ, 1.04), 540, 1050)}>
    <Sky kind="night" frame={f} stars />
    <FogPanel />
    <GroundLine />
    <AlphaOmegaBar x={540} y={720} w={720} draw={progInOut(f, A.aToZ + 6, 30)} letters={pop(f, A.alpha, 10)} />
    <Jesus x={540} y={GROUND_Y} scale={0.85} pose="armsOpen" frame={f} glow={1.3} />
    {f >= A.revCard ? (
      <Card x={540} y={430} refText="REVELATION 22:13" w={820} size={34} scale={pop(f, A.revCard, 12)} lines={[[['I AM ALPHA AND OMEGA,']], [['THE BEGINNING AND THE END', C.gold], [',']]]} />
    ) : null}
    <Tag x={540} y={600} text="Α = A · Ω = Z" s={pop(f, A.az, 10)} />
  </g>
);

// --- S15: born --------------------------------------------------------------------------------------------

export const StableWorld: React.FC<{f: number}> = ({f}) => (
  <g transform={zoom(pushIn(f, A.born, A.know - A.born, 1.06), 540, 1050)}>
    <Sky kind="night" frame={f} moon={{x: 820, y: 560, r: 110}} />
    <FogPanel />
    <GroundLine />
    <Stable x={520} y={GROUND_Y} scale={1.05} />
    <Label x={540} y={430} text="THE WORD WAS MADE FLESH" tone="gold" size={46} scale={pop(f, A.flesh, 10)} />
    <VerseRef x={540} y={482} text="JOHN 1:14" color={C.cream} opacity={fade(f, A.flesh + 6, 10)} />
  </g>
);

// --- S16: so you could know Him -------------------------------------------------------------------------

export const KnowWorld: React.FC<{f: number}> = ({f}) => {
  const end = Math.max(A.know + 40, A.knowWord - 4);
  const jt = prog(f, A.know + 6, end - A.know - 6);
  const walking = f > A.know + 6 && f < end;
  return (
    <g transform={zoom(pushIn(f, A.know, A.madeYou - A.know, 1.05), 540, 1050)}>
      <Sky kind="dawn" frame={f} />
      <Glow x={980} y={GROUND_Y - 40} r={520} color="#FFC46E" opacity={0.8} />
      <FogPanel tint={C.dawnLow} tintAmount={0.7} />
      <GroundLine />
      <Jesus x={lerp(1180, 720, jt)} y={GROUND_Y} scale={0.9} pose={walking ? 'walk' : 'armsOpen'} walkPhase={walkPhaseAt(f, A.know)} frame={f} glow={1.3} />
      <You f={f} x={340} scale={0.9} />
      {f >= A.knowWord - 4 ? <DottedPath d="M 380 850 Q 530 690 680 850" len={360} progress={progInOut(f, A.knowWord - 4, 16)} arrow={null} /> : null}
      {[0, 8, 16].map((d, i) => (f >= A.knowWord + d ? <Heart key={i} x={[460, 540, 620][i]} y={760} frame={f} start={A.knowWord + d} size={1.5} /> : null))}
    </g>
  );
};

// --- S17: He made you ------------------------------------------------------------------------------------

export const MadeYouWorld: React.FC<{f: number}> = ({f}) => {
  const q = 1 - prog(f, A.noOne, 10);
  const bang = f >= A.noOne + 8 && f < A.heMade ? pop(f, A.noOne + 8, 10) : 0;
  return (
    <g transform={zoom(pushIn(f, A.madeYou, A.cta - A.madeYou, 1.05), 540, 1050)}>
      <Sky kind="night" frame={f} stars />
      <Glow x={780} y={560} r={360} color="#FFD98A" opacity={0.6} />
      <FogPanel />
      <GroundLine />
      <ChainCard x={780} y={560} icon="iam" label="I AM" gold scale={pop(f, A.madeYou + 6, 12) * 0.8} />
      <You f={f} x={380} scale={1} />
      {q > 0 ? <QuestionCircle x={380} y={680} scale={q * 0.9} /> : null}
      {bang > 0 ? <Exclaim x={380} y={720} frame={f} start={A.noOne + 8} color={C.gold} size={1.3} /> : null}
      {f >= A.heMade ? <Heart x={380} y={680} frame={f} start={A.heMade} size={2.2} fill="#F6D9A0" float={20} /> : null}
      <ChainArrow x1={700} y1={630} x2={460} y2={760} draw={prog(f, A.heMade, 16)} width={9} />
      <Label x={540} y={430} text="HE MADE YOU" tone="gold" size={70} scale={pop(f, A.youWord, 10)} />
    </g>
  );
};

// --- S18: call to action -----------------------------------------------------------------------------------

export const CtaWorld: React.FC<{f: number}> = ({f}) => {
  const done = A.typing + TYPE_FRAMES + 2;
  return (
    <g transform={zoom(pushIn(f, A.cta, A.endCard - A.cta, 1.04), 540, 1050)}>
      <Sky kind="night" frame={f} moon={{x: 830, y: 880, r: 100}} />
      <FogPanel />
      <GroundLine />
      <You f={f} x={300} scale={0.9} />
      <AnswerButtons x={540} y={500} labels={['YES', 'NO']} colors={[C.gold, C.red]} pressed={f >= A.btnYes ? 'YES' : null} pulse={Math.max(0, 1 - (f - A.btnYes) / 10)} scale={pop(f, A.cta + 8, 12)} />
      {f >= done ? [0, 8, 16].map((d, i) => <Heart key={i} x={[420, 540, 660][i]} y={760} frame={f} start={done + d} size={1.5} float={220} />) : null}
    </g>
  );
};
