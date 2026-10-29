import React from 'react';
import {
  Boat, Bolt, C, Cloud, Exclaim, Glow, Jesus, Label, LightningFlash, PegPerson, Pillow, Rain, Sea, Sky,
  SpeechBubble, SplashDots, StormWaves, VerseRef, Zzz, bob, clamp, fade, pop, prog, progInOut,
} from '../../../../src/kit-flat';
import type {Pose} from '../../../../src/kit-flat';
import {A} from '../data.ts';
import {Cam, camTransform, lerpCam, shotActive, shotIn, toScreen} from '../common.tsx';

// Boat origin (gunwale centre) in world space.
const BX = 540;
const BY = 1110;
const BOAT_SCALE_X = 380 / 300;

/** 1 = full storm, 0 = calm. Calms over 1.5 s from "still". */
export const stormAmount = (f: number) => 1 - progInOut(f, A.still, 45);

const boatMotion = (f: number) => {
  const s = stormAmount(f);
  const rock = s * (4.2 * Math.sin(f / 17) + 1.6 * Math.sin(f / 7.3));
  const dy = s * 12 * Math.sin(f / 13) + (1 - s) * bob(f, 2, 2.5, 90);
  return {rock, dy};
};

interface Disciple {
  x: number;
  robe: string;
  beard?: boolean;
  face?: string;
}

const DISCIPLES: Disciple[] = [
  {x: -290, robe: C.robeBlush},
  {x: -170, robe: C.robeBlue, beard: true},
  {x: -50, robe: C.robeCream},
  {x: 70, robe: C.robeRust, beard: true, face: '#4A3428'},
];

const DSCALE = 0.85;
const HEAD_TOP = 60 - DSCALE * 398; // local y of disciple head tops

const discipleState = (i: number, f: number): {pose: Pose; tremble: number; dx: number; swing: number} => {
  const s = stormAmount(f);
  let pose: Pose = 'hold';
  let tremble = 0.35 * s;
  let dx = 0;
  let swing = 0;
  if (f >= A.waveHit - 6) tremble = 0.75 * s;
  if (f >= A.pureFear - 6 && f < A.notice) tremble = 1;
  if (i === 3 && f >= A.shake - 8 && f < A.pureFear) {
    pose = 'shake';
    swing = 1;
    dx = 40 * prog(f, A.shake - 8, 10);
  }
  if (f >= A.still + 20) {
    pose = f >= A.stopped ? 'armsUp' : 'stand';
    tremble = 0;
  }
  if (f >= A.answered + 10) pose = 'stand';
  return {pose, tremble, dx, swing};
};

/** The whole storm world, in world coordinates (camera applied outside). */
const StormWorld: React.FC<{f: number}> = ({f}) => {
  const s = stormAmount(f);
  const {rock, dy} = boatMotion(f);
  const standing = f >= A.standUp;
  const standT = prog(f, A.standUp, 8);
  const jPose: Pose =
    f >= A.whyBubble - 6 ? 'pointLeft' : f >= A.peaceBubble - 4 && f < A.still + 40 ? 'armsOut' : 'stand';
  const shaken = f >= A.shake && f < A.pureFear ? Math.sin(f * 1.3) * 2 : 0;
  return (
    <g>
      {/* calm night (underneath) and storm sky (on top, fading out) */}
      <Sky kind="night" frame={f} moon={{x: 250, y: 640, r: 105}} />
      <g opacity={s}>
        <Sky kind="storm" frame={f} stars={false} />
        {[0, 1, 2, 3].map((i) => (
          <Cloud
            key={i}
            x={((i * 340 + f * (0.8 + i * 0.25)) % 1500) - 200}
            y={430 + (i % 2) * 120}
            w={300 + i * 30}
            fill={i % 2 ? '#3E4257' : '#4B4F64'}
          />
        ))}
        <Bolt x={860} y={360} frame={f} at={A.lightning1} />
        <Bolt x={200} y={400} frame={f} at={A.lightning2} />
      </g>
      <Sea frame={f} storm={s} reflection={s < 0.6 ? {x: 250, opacity: 1 - s / 0.6} : undefined} />
      <StormWaves frame={f} height={170 * s} />
      {/* the boat and everyone in it rock together */}
      <g transform={`translate(${BX},${BY + dy}) rotate(${rock})`}>
        {DISCIPLES.map((d, i) => {
          const st = discipleState(i, f);
          return (
            <PegPerson
              key={i}
              x={d.x + st.dx}
              y={60}
              scale={DSCALE}
              robe={d.robe}
              wrap={d.beard}
              beard={d.beard}
              faceColor={d.face}
              pose={st.pose}
              tremble={st.tremble}
              armSwing={st.swing}
              frame={f}
              seed={`d${i}`}
            />
          );
        })}
        {!standing || standT < 1 ? (
          <g opacity={1 - standT} transform={`translate(${shaken * 0.6},${shaken})`}>
            <Pillow x={334} y={-58} rotate={-4} />
            <Jesus x={86} y={-62} rotate={90} scale={0.7} pose="lie" frame={f} glow={0.9} />
          </g>
        ) : null}
        {standing ? (
          <Jesus
            x={250}
            y={60 + (1 - standT) * 60}
            scale={0.85}
            pose={jPose}
            armSwing={jPose === 'armsOut' ? Math.sin(f / 10) * 0.3 : 0.15}
            frame={f}
            glow={1.15}
            opacity={standT}
          />
        ) : null}
        <g transform={`scale(${BOAT_SCALE_X},1)`}>
          <Boat x={0} y={0} />
        </g>
        <SplashDots x={-360} y={-20} frame={f} start={A.waveHit} seed="w1" size={1.3} />
        <SplashDots x={-250} y={-30} frame={f} start={A.waveHit + 5} seed="w2" />
        <SplashDots x={330} y={-20} frame={f} start={A.bang2} seed="w3" />
        {/* red "!" over three disciples */}
        {f < A.notice ? (
          <>
            <Exclaim x={DISCIPLES[0].x} y={HEAD_TOP - 30} frame={f} start={A.bang1} />
            <Exclaim x={DISCIPLES[1].x} y={HEAD_TOP - 30} frame={f} start={A.bang2} />
            <Exclaim x={DISCIPLES[2].x} y={HEAD_TOP - 30} frame={f} start={A.bang3} />
          </>
        ) : null}
        {/* gold "!" when the storm stops */}
        {f >= A.goldBang1 - 2 && f < A.whyShot + 20 ? (
          <>
            <Exclaim x={DISCIPLES[1].x} y={HEAD_TOP - 34} frame={f} start={A.goldBang1} color={C.gold} />
            <Exclaim x={DISCIPLES[2].x} y={HEAD_TOP - 34} frame={f} start={A.goldBang2} color={C.gold} />
            <Exclaim x={DISCIPLES[3].x} y={HEAD_TOP - 34} frame={f} start={A.goldBang3} color={C.gold} />
          </>
        ) : null}
      </g>
    </g>
  );
};

// --- shots ------------------------------------------------------------------

const WIDE: Cam = {s: 1, x: 540, y: 1110};

interface Shot {
  from: number;
  to: number;
  cam: (f: number) => Cam;
  overlay?: (f: number, cam: Cam) => React.ReactNode;
}

const jesusHead = (f: number) => {
  const {rock, dy} = boatMotion(f);
  // lying head position (local ~ (318, -40)), rotated with the boat
  const r = (rock * Math.PI) / 180;
  const lx = 322;
  const ly = -66;
  return {x: BX + lx * Math.cos(r) - ly * Math.sin(r), y: BY + dy + lx * Math.sin(r) + ly * Math.cos(r)};
};

const SHOTS = (): Shot[] => [
  {
    // S4: wide storm
    from: A.storm,
    to: A.waves,
    cam: (f) => lerpCam(WIDE, {s: 1.06, x: 530, y: 1110}, progInOut(f, A.storm, A.waves - A.storm)),
    overlay: (f) => <Label x={540} y={400} text="MARK 4" tone="gold" scale={pop(f, A.storm + 8, 10)} />,
  },
  {
    // S5: the waves crash in — medium on the disciples
    from: A.waves,
    to: A.asleep,
    cam: (f) => lerpCam({s: 1.22, x: 470, y: 1090, y0: 1120}, {s: 1.3, x: 470, y: 1090, y0: 1120}, progInOut(f, A.waves, A.asleep - A.waves)),
  },
  {
    // S6: closer on the stern — Jesus asleep
    from: A.asleep,
    to: A.shake,
    cam: (f) => lerpCam({s: 1.55, x: 800, y: 1070, y0: 1110}, {s: 1.65, x: 805, y: 1070, y0: 1110}, progInOut(f, A.asleep, A.shake - A.asleep)),
    overlay: (f, cam) => {
      const h = toScreen(cam, jesusHead(f).x, jesusHead(f).y);
      return (
        <g opacity={fade(f, A.zzz - 6, 10)}>
          <Glow x={h.x - 60} y={h.y + 20} r={260} color="#FFD58A" opacity={0.55} />
          <Zzz x={h.x - 10} y={h.y - 70} frame={f} color={C.cream} />
        </g>
      );
    },
  },
  {
    // S7: the scared prayer
    from: A.shake,
    to: A.pureFear,
    cam: (f) => lerpCam({s: 1.32, x: 700, y: 1060, y0: 1110}, {s: 1.38, x: 700, y: 1060, y0: 1110}, progInOut(f, A.shake, A.pureFear - A.shake)),
    overlay: (f) => (
      <>
        <VerseRef x={540} y={400} text="MARK 4:38" opacity={fade(f, A.shake + 6, 10)} />
        <SpeechBubble
          x={470}
          y={600}
          lines={['MASTER,', 'CAREST THOU NOT', 'THAT WE PERISH?']}
          tone="red"
          size={40}
          tail={{x: 110, y: 150}}
          scale={pop(f, A.prayerBubble, 10)}
        />
      </>
    ),
  },
  {
    // S8: pure fear — tight on the disciples
    from: A.pureFear,
    to: A.notice,
    cam: (f) => lerpCam({s: 1.5, x: 380, y: 1040, y0: 1120}, {s: 1.6, x: 380, y: 1040, y0: 1120}, progInOut(f, A.pureFear, A.notice - A.pureFear)),
    overlay: (f) => <Label x={540} y={430} text="PURE FEAR" tone="red" size={84} scale={pop(f, A.pureFearLabel, 10)} />,
  },
  {
    // S9–S10: Peace, be still → the calm
    from: A.notice,
    to: A.whyShot,
    cam: (f) => lerpCam(WIDE, {s: 1.06, x: 560, y: 1110}, progInOut(f, A.notice, A.whyShot - A.notice)),
    overlay: (f) => (
      <>
        <VerseRef x={540} y={400} text="MARK 4:39" opacity={fade(f, A.peaceBubble, 10, A.answered - 8)} />
        <SpeechBubble
          x={700}
          y={600}
          lines={['PEACE,', 'BE STILL.']}
          tone="gold"
          size={44}
          tail={{x: 70, y: 130}}
          scale={pop(f, A.peaceBubble, 10)}
          opacity={1 - prog(f, A.answered - 8, 10)}
        />
        <Label x={540} y={395} text="HE ANSWERED" tone="gold" size={60} scale={pop(f, A.answered, 10)} />
        <Label x={540} y={465} text="A SCARED PRAYER" tone="gold" size={60} scale={pop(f, A.answered + 5, 10)} />
      </>
    ),
  },
  {
    // S11: why are ye so fearful?
    from: A.whyShot,
    to: A.dawn,
    cam: (f) => lerpCam({s: 1.22, x: 610, y: 1090, y0: 1120}, {s: 1.28, x: 620, y: 1090, y0: 1120}, progInOut(f, A.whyShot, A.dawn - A.whyShot)),
    overlay: (f) => (
      <>
        <VerseRef x={540} y={400} text="MARK 4:40" opacity={fade(f, A.whyShot + 4, 10)} />
        <SpeechBubble x={640} y={590} lines={['WHY ARE YE', 'SO FEARFUL?']} tone="gold" size={44} tail={{x: 110, y: 140}} scale={pop(f, A.whyBubble, 10)} />
      </>
    ),
  },
];

/** Screen-space rain: clears from the top down as the storm calms. */
const RainLayer: React.FC<{f: number}> = ({f}) => {
  const s = stormAmount(f);
  if (s <= 0) return null;
  return <Rain frame={f} opacity={clamp(s * 1.6)} clearFromTop={1 - s} />;
};

export const StormSequence: React.FC<{f: number}> = ({f}) => {
  const shots = SHOTS();
  const active = shots.filter((sh) => shotActive(f, sh.from, sh.to));
  return (
    <g>
      {active.map((sh, i) => {
        const cam = sh.cam(f);
        const o = i === 0 ? 1 : shotIn(f, sh.from);
        return (
          <g key={sh.from} opacity={o}>
            <g transform={camTransform(cam)}>
              <StormWorld f={f} />
            </g>
            <RainLayer f={f} />
            <LightningFlash frame={f} at={[A.lightning1, A.lightning2]} />
            {sh.overlay ? sh.overlay(f, cam) : null}
          </g>
        );
      })}
    </g>
  );
};

