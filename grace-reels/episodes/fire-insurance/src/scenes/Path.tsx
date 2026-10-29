import React from 'react';
import {
  C, DottedPath, FlameIcon, FogPanel, GROUND_Y, Glow, GroundLine, Heart, Jesus, Label, PathFloor, PegPerson, Signpost,
  Sparkles, Sky, Stone, ThoughtBubble, Tree, VerseRef, fade, pop, prog, progInOut, walkPhaseAt,
} from '../../../../src/kit-flat';
import type {Pose} from '../../../../src/kit-flat';
import {A} from '../data.ts';
import {jesusWalkRange, youLegs} from '../anchors.ts';
import {Cam, camTransform, lerpCam, shotActive, shotIn} from '../common.tsx';

const FIG = 0.9; // figure scale in this world
const STONE_X = 120;
const SIGN_X = 290;
const JESUS_STOP = 800;

/** Piecewise walk: returns x and whether walking at frame f. */
const youPath = (f: number) => {
  const legs = youLegs(A);
  let x = 300;
  let walking = false;
  for (const [a, b, x0, x1] of legs) {
    if (f >= b) x = x1;
    else if (f >= a) {
      x = x0 + (x1 - x0) * progInOut(f, a, b - a);
      walking = true;
    }
  }
  return {x, walking};
};

const jesusPath = (f: number) => {
  const [start, end] = jesusWalkRange(A);
  if (f < start) return {x: 1250, walking: false, visible: false};
  const t = prog(f, start, end - start);
  return {x: 1250 + (JESUS_STOP - 1250) * t, walking: f < end, visible: true};
};

const PathWorld: React.FC<{f: number}> = ({f}) => {
  const you = youPath(f);
  const youPose: Pose = f < A.youStand ? 'pray' : you.walking ? 'walk' : 'stand';
  const j = jesusPath(f);
  const jPose: Pose = j.walking ? 'walk' : 'armsOpen';
  const sunrise = prog(f, A.dawn, 120);
  const warmth = 0.5 + 0.5 * prog(f, A.goldWash, 40) + 0.3 * prog(f, A.loved, 30);
  // the fear thought-bubble over YOU (S14): pops, gold wash shrinks it, bursts
  const bIn = pop(f, A.fearBubble, 10);
  const bShrink = 1 - 0.75 * progInOut(f, A.goldWash + 8, A.burst - A.goldWash - 8);
  const bubble = f < A.burst ? bIn * bShrink : 0;
  const youHead = {x: you.x, y: GROUND_Y - 352 * FIG};
  const heartT = progInOut(f, A.heartFloat, 40);
  const heartPos = {x: 990 + (you.x + 70 - 990) * heartT, y: 1120 + (720 - 1120) * heartT - Math.sin(heartT * Math.PI) * 120};
  return (
    <g>
      <Sky kind="dawn" frame={f} />
      <Glow x={1010} y={GROUND_Y - 30} r={520 + 120 * sunrise} color="#FFC46E" opacity={0.75 * warmth} />
      <Glow x={1010} y={GROUND_Y - 10} r={220} color="#FFE6A8" opacity={0.9} />
      <Tree x={-30} y={GROUND_Y} scale={0.75} fill="#B8BC98" />
      <FogPanel tint={C.dawnLow} tintAmount={0.75} />
      <Glow x={980} y={GROUND_Y + 40} r={460} ry={200} color="#FFC97A" opacity={0.6 * warmth} />
      <PathFloor toX={960} reveal={prog(f, A.dawn, 30)} />
      <GroundLine />
      <Stone x={STONE_X} y={GROUND_Y + 2} text="FEAR" scale={0.95 * pop(f, A.fearStone, 10)} />
      {f >= A.signpost - 2 ? (
        <g transform={`translate(${SIGN_X},${GROUND_Y}) scale(${pop(f, A.signpost, 12)}) translate(${-SIGN_X},${-GROUND_Y})`}>
          <Signpost x={SIGN_X} y={GROUND_Y} text="" scale={0.74}>
            <text x={-190} y={-374} fontFamily='"Playfair Display", serif' fontWeight={900} fontSize={48} fill={C.red} letterSpacing={1}>
              FEAR
            </text>
            <path d="M -36 -390 L 14 -390 M -2 -403 L 16 -390 L -2 -377" fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            <text x={30} y={-374} fontFamily='"Playfair Display", serif' fontWeight={900} fontSize={48} fill={C.gold} letterSpacing={1}>
              LOVE
            </text>
          </Signpost>
        </g>
      ) : null}
      {j.visible ? (
        <Jesus x={j.x} y={GROUND_Y} scale={FIG} pose={jPose} walkPhase={walkPhaseAt(f, A.jesusWalk)} frame={f} glow={1.2 + 0.3 * prog(f, A.loved, 20)} />
      ) : null}
      <PegPerson
        x={you.x}
        y={GROUND_Y}
        scale={FIG}
        robe={C.youBlue}
        pose={youPose}
        walkPhase={walkPhaseAt(f, A.walk1)}
        tremble={f < A.youStand ? 0.35 : 0}
        frame={f}
        seed="you"
      />
      {/* heart floating out of the horizon (S13) */}
      {f >= A.heartFloat && f < A.loveCasts + 6 ? (
        <Heart x={heartPos.x} y={heartPos.y} frame={f} start={A.heartFloat} size={1.7} float={0} />
      ) : null}
      {bubble > 0 ? (
        <ThoughtBubble x={you.x + 120} y={700} w={230} tip={{x: -110, y: 170}} scale={bubble} fill={C.cloud}>
          <FlameIcon x={0} y={4} scale={0.8} frame={f} />
        </ThoughtBubble>
      ) : null}
      <Sparkles x={you.x + 120} y={700} frame={f} start={A.burst} count={14} radius={170} />
      {/* S15: dotted line linking YOU and Jesus, hearts rising */}
      {f >= A.dotted && f < A.dontStay + 8 ? (
        <DottedPath
          d={`M ${youHead.x + 40} ${youHead.y - 40} Q ${(youHead.x + JESUS_STOP) / 2} ${youHead.y - 210} ${JESUS_STOP - 50} ${youHead.y - 46}`}
          len={420}
          progress={progInOut(f, A.dotted, 20)}
          arrow={null}
        />
      ) : null}
      {f >= A.loved - 2 && f < A.dontStay + 8 ? (
        <>
          <Heart x={590} y={700} frame={f} start={A.loved} size={1.5} />
          <Heart x={660} y={630} frame={f} start={A.loved + 7} size={1.8} />
          <Heart x={735} y={700} frame={f} start={A.loved + 14} size={1.5} />
        </>
      ) : null}
      {f >= A.lovesYou - 2 && f < A.dontStay + 8 ? (
        <Heart x={you.x} y={youHead.y - 110} frame={f} start={A.lovesYou} size={1.6} fill="#F6D9A0" float={40} />
      ) : null}
      {f >= A.walkHome + 40 ? (
        <>
          <Heart x={you.x + 40} y={youHead.y - 120} frame={f} start={A.walkHome + 40} size={1.7} fill="#F6D9A0" />
          <Sparkles x={you.x + 40} y={youHead.y - 60} frame={f} start={A.walkHome + 42} count={10} radius={130} />
        </>
      ) : null}
    </g>
  );
};

/** Gold wash rolling in from the horizon (screen space). */
const GoldWash: React.FC<{f: number}> = ({f}) => {
  const t = prog(f, A.goldWash, 36);
  const out = prog(f, A.burst + 6, 24);
  const o = t * (1 - out);
  if (o <= 0) return null;
  return <Glow x={1060 - 380 * t} y={640} r={560} ry={420} color="#FFD27A" opacity={0.7 * o} />;
};

const WIDE: Cam = {s: 1, x: 540, y: 1180};

interface Shot {
  from: number;
  to: number;
  cam: (f: number) => Cam;
  overlay?: (f: number) => React.ReactNode;
}

const SHOTS = (): Shot[] => [
  {
    // S12: the beginning
    from: A.dawn,
    to: A.youStand - 8,
    cam: (f) => lerpCam(WIDE, {s: 1.05, x: 500, y: 1180}, progInOut(f, A.dawn, A.youStand - A.dawn)),
    overlay: (f) => (
      <>
        <Label x={540} y={400} text="THE BEGINNING" tone="gold" scale={pop(f, A.beginningLabel, 10)} />
        <VerseRef x={540} y={452} text="PROVERBS 9:10" color={C.red} ring={false} opacity={fade(f, A.beginningLabel + 6, 10)} />
        <RespectTag f={f} />
      </>
    ),
  },
  {
    // S13: YOU walks toward the light
    from: A.youStand - 8,
    to: A.loveCasts,
    cam: (f) => {
      const x = youPath(f).x;
      return {s: 1.14, x: x + 110, y: 1180};
    },
    overlay: () => null,
  },
  {
    // S14: love casts out fear
    from: A.loveCasts,
    to: A.firstLoved,
    cam: (f) => lerpCam({s: 1.24, x: 580, y: 1180}, {s: 1.3, x: 590, y: 1180}, progInOut(f, A.loveCasts, A.firstLoved - A.loveCasts)),
    overlay: (f) => (
      <>
        <GoldWash f={f} />
        <VerseRef x={540} y={400} text="1 JOHN 4:18" color={C.red} ring={false} opacity={fade(f, A.loveCasts + 6, 10)} />
      </>
    ),
  },
  {
    // S15: he first loved us (+ "close enough")
    from: A.firstLoved,
    to: A.dontStay,
    cam: (f) =>
      f < A.closeStep
        ? lerpCam({s: 1, x: 610, y: 1180}, {s: 1.04, x: 620, y: 1180}, progInOut(f, A.firstLoved, A.closeStep - A.firstLoved))
        : lerpCam({s: 1.04, x: 620, y: 1180}, {s: 1.18, x: 650, y: 1180}, progInOut(f, A.closeStep, A.dontStay - A.closeStep)),
    overlay: (f) => <VerseRef x={540} y={400} text="1 JOHN 4:19" color={C.red} ring={false} opacity={fade(f, A.firstLoved + 6, 10, A.closeStep, 10)} />,
  },
  {
    // S16: don't stay there
    from: A.dontStay,
    to: A.cta,
    cam: (f) => lerpCam({s: 1, x: 500, y: 1180}, {s: 1.05, x: 520, y: 1180}, progInOut(f, A.dontStay, A.cta - A.dontStay)),
    overlay: () => null,
  },
];

const RespectTag: React.FC<{f: number}> = ({f}) => {
  const s = pop(f, A.respectTag, 10);
  if (s <= 0) return null;
  return (
    <g transform={`translate(540,520) scale(${s})`}>
      <rect x={-300} y={-32} width={600} height={64} rx={32} fill={C.cream} stroke={C.ink} strokeWidth={4} />
      <text x={0} y={11} textAnchor="middle" fontFamily='"Plus Jakarta Sans", sans-serif' fontWeight={800} fontSize={28} letterSpacing={0.5} fill={C.captionInk}>
        FEAR OF THE LORD = <tspan fill={C.gold}>DEEP RESPECT</tspan>
      </text>
    </g>
  );
};

export const PathSequence: React.FC<{f: number}> = ({f}) => {
  const shots = SHOTS();
  const active = shots.filter((sh) => shotActive(f, sh.from, sh.to));
  return (
    <g>
      {active.map((sh, i) => (
        <g key={sh.from} opacity={i === 0 ? 1 : shotIn(f, sh.from)}>
          <g transform={camTransform(sh.cam(f))}>
            <PathWorld f={f} />
          </g>
          {sh.overlay ? sh.overlay(f) : null}
        </g>
      ))}
    </g>
  );
};

