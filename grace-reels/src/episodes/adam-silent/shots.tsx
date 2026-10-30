// Every shot of "Why Didn't Adam Stop Her?". Each shot gets its global start frame
// (`at`) and length (`dur`); cue times come from the voice timeline.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Cam, CameraRig, Layer } from '../../kit-storybook/core/Camera';
import { EdenSet, GethSet, RoomSet, VoidSet } from '../../kit-storybook/sets/Sets';
import { EDEN_DUSK, EDEN_EVENING, ROOM_WINDOW } from '../../kit-storybook/paint/sets';
import { Character, Look } from '../../kit-storybook/gl/Character';
import { Bokeh, Dust } from '../../kit-storybook/fx/Particles';
import { GodRays, Orb, Wash, LightBeam } from '../../kit-storybook/fx/Light';
import { Threads, ThreadSpec } from '../../kit-storybook/fx/Threads';
import { GlowFruit, Ghost, Torch, flicker } from '../../kit-storybook/fx/Props';
import { clamp01, easeInOut, lerp, ramp } from '../../kit-storybook/core/time';
import { ADAM_CU, EVE_CU, JESUS_CU, JESUS_KNEEL, PAIR_REACH, PAIR_BLAME, MAN, manArm, LOOK } from './chars';
import { F, imgToWorld } from './data';
import { Disciples, GhostTag, Guards, MessageBubble, Serpent, SnakeEyes, Tear } from './props';

export type ShotProps = { at: number; dur: number };

// ---------- helpers
const camOn = (wx: number, wy: number, zoom: number, extra: Partial<Cam> = {}): Cam => ({ x: wx - 540, y: wy - 960, zoom, ...extra });
const camLerp = (a: Cam, b: Cam, t: number): Cam => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), zoom: lerp(a.zoom, b.zoom, t),
  rot: lerp(a.rot ?? 0, b.rot ?? 0, t), focus: lerp(a.focus ?? 1, b.focus ?? 1, t), aperture: lerp(a.aperture ?? 0, b.aperture ?? 0, t),
});
function useShot({ at, dur }: ShotProps) {
  const f = useCurrentFrame();
  return { f, p: clamp01(f / Math.max(1, dur)), L: (cue: string) => F(cue) - at };
}
const mixLook = (a: Look, b: Look, t: number): Look => {
  const m3 = (x?: number[], y?: number[]) => (x && y ? (x.map((v, i) => lerp(v, y[i], t)) as [number, number, number]) : y ?? x) as [number, number, number] | undefined;
  return {
    tint: m3(a.tint, b.tint), lift: m3(a.lift, b.lift), rim: m3(a.rim, b.rim),
    sat: lerp(a.sat ?? 1, b.sat ?? 1, t), exposure: lerp(a.exposure ?? 1, b.exposure ?? 1, t),
    rimStrength: lerp(a.rimStrength ?? 0, b.rimStrength ?? 0, t), rimWidth: lerp(a.rimWidth ?? 7, b.rimWidth ?? 7, t),
    rimDir: (t < 0.5 ? a.rimDir : b.rimDir) ?? [1, 0],
  };
};
const dim = (l: Look, k: number): Look => ({ ...l, tint: (l.tint ?? [1, 1, 1]).map((v) => v * k) as [number, number, number], rimStrength: (l.rimStrength ?? 0) * k });

// ---------- shared placements
const PAIR_PLACE = { x: 440, y: 1900, h: 1450 };
const FRUIT: [number, number] = [915, 640];
const BRANCH: [number, number] = [915, 605];
const BLAME_PLACE = { x: -170, y: 1800, h: 950, anchor: [0, 1] as [number, number] };
const bw = (p: [number, number]) => imgToWorld(PAIR_BLAME, BLAME_PLACE, p);
const ADAM_TIP = bw([892, 208]);
const EVE_SHOULDER = bw([1105, 290]);
const EVE_HAND = bw([1150, 350]);
const GOD_LIGHT: [number, number] = [235, 330];
const SNAKE: [number, number] = [1010, 540];
const MAN_PLACE = { x: 743, y: 1860, h: 1352, anchor: [0.5, 0.955] as [number, number] };
function manTip(angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  const [px, py] = [372, 372];
  const [dx, dy] = [30 - px, 197 - py];
  const p: [number, number] = [px + Math.cos(a) * dx - Math.sin(a) * dy, py + Math.sin(a) * dx + Math.cos(a) * dy];
  return imgToWorld(MAN, MAN_PLACE, p);
}
// arm angle over S10/S18 (degrees, <0 lowers)
function armAngle(g: number) {
  const keys: [number, number][] = [
    [F('modern'), -46], [F('T4') - 7, -46], [F('T4'), -27], [F('T5') - 5, -27], [F('T5'), 6], [F('T6') - 5, 6], [F('T6'), -40],
    [F('T7') - 6, -40], [F('T7'), 18], [F('stopPassing') + 8, 18], [F('stopPassing') + 40, -72],
  ];
  if (g <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (g <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], easeInOut(clamp01((g - keys[i - 1][0]) / Math.max(1, keys[i][0] - keys[i - 1][0]))));
  return keys[keys.length - 1][1];
}
const MAN_GHOSTS = {
  parents: [{ kind: 'woman' as const, x: 110, y: 1190, h: 470 }, { kind: 'man' as const, x: 265, y: 1205, h: 510 }],
  friends: [{ kind: 'man' as const, x: 95, y: 800, h: 350, mirror: true }, { kind: 'woman' as const, x: 230, y: 795, h: 330 }],
  past: [{ kind: 'boy' as const, x: 455, y: 1200, h: 420 }],
};
const GHOST_TARGET = { T4: [190, 900], T5: [165, 590], T6: [455, 1020], T7: [720, -220] } as Record<string, [number, number]>;
// the web of threads in empty space (S9 onward), in screen px
const WEB: Record<string, [[number, number], [number, number]]> = {
  T1: [[300, 1010], [720, 1090]], T2: [[300, 1010], [170, 430]], T3: [[760, 1160], [930, 610]],
  T4: [[640, 1320], [190, 1240]], T5: [[640, 1320], [120, 1520]], T6: [[640, 1320], [380, 1660]], T7: [[640, 1320], [700, 260]],
};
const webThreads = (start: number, opts: Partial<ThreadSpec> = {}): ThreadSpec[] =>
  Object.entries(WEB).map(([id, [a, b]], i) => ({ id, from: a, to: b, start: start - 30 - i, shoot: 1, ...opts }));

// ================================================================ S1
export const S1a: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  const cam = camLerp(camOn(860, 640, 2.3, { focus: 1, aperture: 14 }), camOn(872, 652, 2.45, { focus: 1, aperture: 14 }), easeInOut(p));
  return (
    <CameraRig cam={cam}>
      <EdenSet p={EDEN_DUSK} name="dusk" branchTip={BRANCH} grass={1340} grassDepth={1}>
        <Layer depth={1}>
          <Character spec={PAIR_REACH} {...PAIR_PLACE} look={LOOK.dusk} blur={6} blink={0} seed={2} />
          <GlowFruit x={FRUIT[0]} y={FRUIT[1]} r={22} intensity={1.15} />
        </Layer>
      </EdenSet>
      <Bokeh seed={4} count={12} opacity={0.8} />
      <Dust seed={5} count={40} />
    </CameraRig>
  );
};

export const S1b: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const cam = camLerp(camOn(872, 652, 2.45, { aperture: 14 }), camOn(560, 930, 1.12, { aperture: 9 }), easeInOut(p));
  return (
    <CameraRig cam={cam}>
      <EdenSet p={EDEN_DUSK} name="dusk" branchTip={BRANCH} grass={1340} grassDepth={1}>
        <Layer depth={1}>
          <Character spec={PAIR_REACH} {...PAIR_PLACE} look={LOOK.dusk} blur={6 * (1 - ramp(f, 2, 26))} blink={0} seed={2} />
          <GlowFruit x={FRUIT[0]} y={FRUIT[1]} r={22} />
        </Layer>
      </EdenSet>
      <GodRays id="s1" x={1180} y={860} angle={Math.PI * 0.88} spread={0.5} opacity={0.3} />
      <Dust seed={5} count={40} />
    </CameraRig>
  );
};

const CloseUp: React.FC<{ spec: typeof ADAM_CU; place: { x: number; y: number; h: number }; look: Look; cam: Cam; set: React.ReactNode; seed?: number; children?: React.ReactNode; front?: React.ReactNode; blink?: number | 'auto' }> = ({ spec, place, look, cam, set, seed = 1, children, front, blink = 'auto' }) => (
  <CameraRig cam={cam}>
    {set}
    <Layer depth={1}>
      {children}
      <Character spec={spec} {...place} look={look} seed={seed} blink={blink} />
    </Layer>
    {front}
  </CameraRig>
);

const duskBg = (name = 'dusk') => <EdenSet p={EDEN_DUSK} name={name} branchTip={BRANCH} foreground={false} />;
const eveningBg = (name = 'evening') => <EdenSet p={EDEN_EVENING} name={name} branchTip={BRANCH} foreground={false} />;

export const S1c: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CloseUp spec={ADAM_CU} place={{ x: 470, y: 1990, h: 1950 }} look={LOOK.dusk} seed={11}
      cam={camLerp(camOn(560, 900, 1.0, { focus: 1, aperture: 40 }), camOn(590, 860, 1.06, { focus: 1, aperture: 40 }), easeInOut(p))}
      set={duskBg()}
      front={<><Bokeh seed={7} count={10} opacity={0.7} /><Dust seed={8} count={30} /></>}
    />
  );
};

export const S1d: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CloseUp spec={EVE_CU} place={{ x: 600, y: 1990, h: 1950 }} look={LOOK.duskSoft} seed={21}
      cam={camLerp(camOn(540, 900, 1.0, { aperture: 40 }), camOn(520, 860, 1.07, { aperture: 40 }), easeInOut(p))}
      set={duskBg()}
      front={<><Bokeh seed={9} count={12} opacity={0.75} /><Dust seed={10} count={30} /></>}
    />
  );
};

// ================================================================ S2 quote over Eden at dusk
export const S2a: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  const cam = camLerp(camOn(540, 330, 1.12, { aperture: 3 }), camOn(600, 880, 1.0, { aperture: 3 }), easeInOut(p));
  return (
    <CameraRig cam={cam}>
      <EdenSet p={EDEN_DUSK} name="dusk" branchTip={BRANCH} foreground={1} />
      <GodRays id="s2a" x={760} y={1060} angle={-Math.PI * 0.62} spread={1.1} count={9} opacity={0.22} />
      <Dust seed={12} count={45} />
    </CameraRig>
  );
};

const SMALL_PAIR = { x: 690, y: 1560, h: 620 };
const SMALL_FRUIT = imgToWorld(PAIR_REACH, SMALL_PAIR, [1002, 222]);
export const S2b: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  const cam = camLerp(camOn(600, 1000, 1.0, { aperture: 6 }), camOn(690, 1080, 1.2, { aperture: 6 }), easeInOut(p));
  return (
    <CameraRig cam={cam}>
      <EdenSet p={EDEN_DUSK} name="dusk-wide" branchTip={[SMALL_FRUIT[0] + 8, SMALL_FRUIT[1] - 30]} grass={1300} grassDepth={1} foreground={0}>
        <Layer depth={1}>
          <Character spec={PAIR_REACH} {...SMALL_PAIR} look={LOOK.dusk} seed={3} blink={0} res={1.2} />
          <GlowFruit x={SMALL_FRUIT[0]} y={SMALL_FRUIT[1]} r={10} />
        </Layer>
      </EdenSet>
      <Dust seed={13} count={40} />
    </CameraRig>
  );
};

// ================================================================ S3 with her
export const S3a: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  const cam = camLerp(camOn(760, 760, 1.6, { aperture: 10 }), camOn(440, 720, 1.75, { aperture: 10 }), easeInOut(p));
  return (
    <CameraRig cam={cam}>
      <EdenSet p={EDEN_DUSK} name="dusk" branchTip={BRANCH} grass={1340} grassDepth={1} foreground={false}>
        <Layer depth={1}>
          <Character spec={PAIR_REACH} {...PAIR_PLACE} look={LOOK.dusk} seed={2} blink={0} />
          <GlowFruit x={FRUIT[0] - 10} y={FRUIT[1] + 30} r={22} />
        </Layer>
      </EdenSet>
      <Dust seed={14} count={35} />
    </CameraRig>
  );
};

export const S3b: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const warm = ramp(f, 0, 40);
  return (
    <CloseUp spec={ADAM_CU} place={{ x: 420, y: 2050, h: 2150 }} seed={12}
      look={mixLook(LOOK.duskSoft, LOOK.dusk, warm)}
      cam={camLerp(camOn(560, 860, 1.0, { aperture: 40 }), camOn(585, 800, 1.08, { aperture: 40 }), easeInOut(p))}
      set={duskBg()}
      front={<><Orb x={1140} y={760} r={70} intensity={0.55 + 0.45 * warm} /><Bokeh seed={15} count={10} opacity={0.7} /><Dust seed={16} count={28} /></>}
    />
  );
};

// ================================================================ S4 silent
export const S4a: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CloseUp spec={ADAM_CU} place={{ x: 380, y: 1990, h: 1900 }} seed={13} look={dim(LOOK.dusk, 0.92)}
      cam={camLerp(camOn(560, 900, 1.02, { aperture: 34 }), camOn(565, 880, 1.07, { aperture: 34 }), easeInOut(p))}
      set={<>{duskBg()}<Wash color="#0d0812" opacity={0.42} /><Layer depth={0.6}><div style={{ filter: 'blur(3px)' }}><SnakeEyes x={890} y={430} size={1.3} /></div></Layer></>}
      front={<Dust seed={17} count={20} opacity={0.7} />}
    />
  );
};

export const S4b: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  const cam = camLerp(camOn(880, 700, 2.0, { rot: -3, aperture: 14 }), camOn(898, 668, 2.18, { rot: -3, aperture: 14 }), easeInOut(p));
  return (
    <CameraRig cam={cam}>
      <EdenSet p={EDEN_DUSK} name="dusk" branchTip={BRANCH} grass={1340} grassDepth={1} foreground={false}>
        <Layer depth={1}>
          <Character spec={PAIR_REACH} {...PAIR_PLACE} look={LOOK.dusk} seed={2} blink={0} />
          <GlowFruit x={FRUIT[0]} y={FRUIT[1]} r={22} intensity={1.2} />
        </Layer>
      </EdenSet>
      <Wash color="#0d0812" opacity={0.2} />
      <Bokeh seed={18} count={10} opacity={0.7} />
    </CameraRig>
  );
};

export const S4c: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CloseUp spec={ADAM_CU} place={{ x: 323, y: 2569, h: 2600 }} seed={14} look={dim(LOOK.dusk, 0.85)}
      cam={camLerp(camOn(540, 900, 1.0, { aperture: 40 }), camOn(545, 925, 1.1, { aperture: 40 }), easeInOut(p))}
      set={<>{duskBg()}<Wash color="#0b0710" opacity={0.5} /></>}
    />
  );
};

// ================================================================ S5 they hid (cool blue evening)
const godPath = (g: number): [number, number] => {
  const t = clamp01((g - F('hideScene')) / (F('godCalled') - F('hideScene')));
  return [lerp(1250, -160, easeInOut(t)), 1130 - Math.sin(t * Math.PI) * 60];
};
export const S5a: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const [gx, gy] = godPath(sp.at + f);
  return (
    <CameraRig cam={camLerp(camOn(540, 1000, 1.0, { aperture: 4 }), camOn(500, 985, 1.06, { aperture: 4 }), easeInOut(p))}>
      <EdenSet p={EDEN_EVENING} name="evening" branchTip={BRANCH} foreground={1}>
        <Layer depth={0.6}>
          <Orb x={gx} y={gy} r={46} core="255,244,214" glow="255,206,140" intensity={1.1} pulse={0.12} />
          <div style={{ position: 'absolute', left: gx - 500, top: gy - 400, width: 1000, height: 800, background: 'radial-gradient(ellipse, rgba(255,210,150,0.22), rgba(255,210,150,0) 65%)', mixBlendMode: 'screen' }} />
        </Layer>
      </EdenSet>
      <Dust seed={19} count={30} color="200,215,255" opacity={0.7} />
    </CameraRig>
  );
};

const HideScene: React.FC<{ g: number; cam: Cam; threads?: ThreadSpec[] }> = ({ g, cam, threads }) => {
  const [gx] = godPath(g);
  const sweep = clamp01((g - (F('hid') - 20)) / 40);
  return (
    <CameraRig cam={cam}>
      <EdenSet p={EDEN_EVENING} name="evening" branchTip={BRANCH} foreground={false} hideLeaves>
        <Layer depth={1}>
          <Character spec={ADAM_CU} x={250} y={1480} h={1060} look={LOOK.evening} seed={31} />
          <Character spec={EVE_CU} x={850} y={1500} h={1060} look={LOOK.evening} seed={32} />
        </Layer>
        <Layer depth={0.7}>
          {threads ? null : <Orb x={gx} y={1000} r={40} core="255,240,210" glow="255,200,130" intensity={0.9} />}
        </Layer>
      </EdenSet>
      {!threads && sweep > 0 && sweep < 1 && (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 40% 30% at ${lerp(110, -10, sweep)}% 72%, rgba(255,214,150,0.35), rgba(255,214,150,0) 70%)`, mixBlendMode: 'screen' }} />
      )}
      {threads && <Threads threads={threads} />}
      <Dust seed={20} count={25} color="200,215,255" opacity={0.6} />
    </CameraRig>
  );
};
export const S5b: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  return <HideScene g={sp.at + f} cam={camLerp(camOn(540, 900, 1.0, { aperture: 18 }), camOn(540, 935, 1.05, { aperture: 18 }), easeInOut(p))} />;
};

// ================================================================ S6 where art thou
export const S6: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const stop = ramp(f, 0, 20);
  return (
    <CloseUp spec={ADAM_CU} place={{ x: 430, y: 2010, h: 2000 }} seed={15} look={mixLook(LOOK.evening, LOOK.godLight, stop)}
      cam={camLerp(camOn(560, 880, 1.0, { aperture: 36 }), camOn(572, 830, 1.08, { aperture: 36 }), easeInOut(p))}
      set={<>{eveningBg()}<Layer depth={0.5}><Orb x={560} y={-80} r={120} core="255,246,224" glow="255,210,150" intensity={0.4 + 0.6 * stop} /></Layer></>}
      front={<><GodRays id="s6" x={560} y={-120} angle={Math.PI / 2} spread={0.6} count={8} opacity={0.45 * stop} /><Dust seed={22} count={25} /></>}
    />
  );
};

// ================================================================ S7 the blame
const T1: ThreadSpec = { id: 'T1', from: ADAM_TIP, to: EVE_SHOULDER, start: F('T1'), shoot: 8 };
const T2: ThreadSpec = { id: 'T2', from: ADAM_TIP, to: GOD_LIGHT, start: F('T2'), shoot: 10, sag: 40 };
const T3: ThreadSpec = { id: 'T3', from: EVE_HAND, to: [SNAKE[0] - 90, SNAKE[1] - 40], start: F('T3'), shoot: 10, sag: 50 };
const rel = (t: ThreadSpec, at: number): ThreadSpec => ({ ...t, start: t.start - at });

const BlameWorld: React.FC<{ at: number; cam: Cam; threads: ThreadSpec[]; look?: Look; snake?: { slide: number; glint: number } | null; dark?: number; ghost?: number; lightOn?: number }> = ({ at, cam, threads, look = LOOK.evening, snake = { slide: 0, glint: 1 }, dark = 0, ghost = 0, lightOn = 1 }) => (
  <CameraRig cam={cam}>
    <EdenSet p={EDEN_EVENING} name="evening-blame" branchTip={[1080, 470]} grass={1410} grassDepth={1} foreground={false}>
      <Layer depth={1}>
        <Orb x={GOD_LIGHT[0]} y={GOD_LIGHT[1]} r={44} core="255,244,214" glow="255,206,140" intensity={0.85 * lightOn} />
        {snake && <Serpent x={SNAKE[0]} y={SNAKE[1]} scale={0.85} slide={snake.slide} glint={snake.glint} />}
        <Character spec={PAIR_BLAME} {...BLAME_PLACE} look={look} seed={41} lineMix={ghost} ghost={ghost > 0} opacity={1} />
      </Layer>
    </EdenSet>
    <Wash color="#05040a" opacity={dark} />
    <Layer depth={1}><Threads threads={threads.map((t) => rel(t, at))} /></Layer>
    <Dust seed={23} count={22} color="200,215,255" opacity={0.6} />
  </CameraRig>
);

export const S7a: React.FC<ShotProps> = (sp) => {
  const { f, p, L } = useShot(sp);
  const fire = L('T1');
  const a = camOn(330, 1060, 1.7, { aperture: 8 });
  const b = camOn(380, 1060, 1.75, { aperture: 8 });
  const c = camOn(640, 1090, 1.45, { aperture: 8 });
  const cam = f < fire ? camLerp(a, b, easeInOut(f / fire)) : camLerp(b, c, easeInOut(clamp01((f - fire) / (sp.dur - fire))));
  return <BlameWorld at={sp.at} cam={cam} threads={[T1]} look={mixLook(LOOK.evening, LOOK.godLight, 0.3)} snake={null} />;
};
export const S7b: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return <BlameWorld at={sp.at} cam={camLerp(camOn(500, 900, 1.05, { aperture: 6 }), camOn(480, 860, 1.12, { aperture: 6 }), easeInOut(p))} threads={[T1, T2]} look={mixLook(LOOK.evening, LOOK.godLight, 0.3)} snake={null} />;
};
export const S7c: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  const eye = imgToWorld(EVE_CU, { x: 600, y: 1990, h: 1950 }, [520, 492]);
  return (
    <CloseUp spec={EVE_CU} place={{ x: 600, y: 1990, h: 1950 }} seed={22} look={LOOK.hurt}
      cam={camLerp(camOn(540, 880, 1.0, { aperture: 36 }), camOn(560, 845, 1.07, { aperture: 36 }), easeInOut(p))}
      set={eveningBg()}
      front={<>
        <Layer depth={1}>
          <Tear x={eye[0]} y={eye[1]} from={28} len={56} size={1.3} />
          <Threads threads={[{ id: 't1cu', from: [-120, 980], to: [300, 1360], start: -40, shoot: 1 }]} />
        </Layer>
        <Dust seed={24} count={18} color="200,215,255" opacity={0.6} />
      </>}
    />
  );
};
export const S7d: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return <BlameWorld at={sp.at} cam={camLerp(camOn(380, 980, 1.35, { aperture: 6 }), camOn(640, 920, 1.25, { aperture: 6 }), easeInOut(p))} threads={[T1, T2]} look={dim(LOOK.evening, 0.8)} dark={0.25} snake={null} />;
};

// ================================================================ S8 Eve points at the serpent
export const S8a: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return <BlameWorld at={sp.at} cam={camLerp(camOn(860, 1080, 1.6, { aperture: 8 }), camOn(890, 1010, 1.5, { aperture: 8 }), easeInOut(p))} threads={[T1, T2, T3]} look={LOOK.hurt} />;
};
export const S8b: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const slide = ramp(f, 10, 42);
  return <BlameWorld at={sp.at} cam={camLerp(camOn(900, 900, 1.4, { aperture: 8 }), camOn(960, 660, 1.55, { aperture: 8 }), easeInOut(p))} threads={[T1, T2, T3]} look={LOOK.hurt} snake={{ slide, glint: 1 - slide }} dark={0.15 * slide} />;
};

// ================================================================ S9 the web: the garden fades, the threads remain
export const S9: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const fade = ramp(f, 0, 26);
  const ghost = ramp(f, 4, 26);
  return (
    <BlameWorld at={sp.at} cam={camLerp(camOn(520, 900, 1.12, { aperture: 4 }), camOn(600, 880, 1.28, { aperture: 4 }), easeInOut(p))}
      threads={[T1, T2, T3].map((t) => ({ ...t, width: 3 + fade * 1.5 }))} look={dim(LOOK.evening, 1 - 0.5 * fade)} snake={null} dark={0.93 * fade} ghost={ghost} lightOn={1 - fade} />
  );
};

// ================================================================ S10 us today
const Bedroom: React.FC<{ g: number; cam: Cam; dawn?: number; ghosts?: number; ghostWarm?: number; threads?: ThreadSpec[]; at: number; bubble?: boolean; backlit?: number }> = ({ g, cam, dawn = 0, ghosts = 1, ghostWarm = 0, threads = [], at, bubble, backlit = 0 }) => {
  const angle = armAngle(g);
  const lookMan = mixLook(mixLook(LOOK.night, { ...LOOK.dusk, tint: [0.95, 0.85, 0.78], rimDir: [1, -0.3] }, dawn), LOOK.dawnBack, backlit);
  const show = (cue: string) => ramp(g, F(cue) - 2, F(cue) + 10);
  const dimFor = (next?: string) => (next ? 1 - 0.55 * ramp(g, F(next), F(next) + 12) : 1);
  const groups: [keyof typeof MAN_GHOSTS, string, string | undefined, [number, number], string][] = [
    ['parents', 'T4', 'T5', [190, 650], 'MY PARENTS'],
    ['friends', 'T5', 'T6', [165, 400], 'MY FRIENDS'],
    ['past', 'T6', 'T7', [470, 845], 'MY PAST'],
  ];
  return (
    <CameraRig cam={cam}>
      <RoomSet time="night" />
      {dawn > 0 && <AbsoluteFill style={{ opacity: dawn }}><RoomSet time="dawn" /></AbsoluteFill>}
      <Layer depth={0.92}>
        {groups.map(([k, cue, next], gi) => {
          const o = show(cue) * dimFor(next) * ghosts;
          return o <= 0 ? null : (
            <div key={gi} style={{ filter: ghostWarm > 0 ? `sepia(${ghostWarm}) saturate(${1 + ghostWarm * 2}) brightness(${1 + ghostWarm * 0.6})` : undefined }}>
              {MAN_GHOSTS[k].map((gh, i) => <Ghost key={i} {...gh} opacity={o} seed={gi * 3 + i} />)}
            </div>
          );
        })}
      </Layer>
      <Layer depth={1}>
        <Character spec={MAN} {...MAN_PLACE} look={lookMan} bones={[manArm(angle)]} seed={51} blink={0} />
        <div style={{ position: 'absolute', left: 760, top: 1170, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, rgba(150,190,255,${0.35 * (1 - dawn)}), rgba(150,190,255,0))`, mixBlendMode: 'screen' }} />
        <Threads threads={threads.map((t) => ({ ...rel(t, at), from: manTip(angle) }))} globalOpacity={ghosts} />
        {groups.map(([, cue, next, pos, label], gi) => (
          <GhostTag key={gi} text={label} x={pos[0]} y={pos[1]} from={F(cue) - at} dim={dimFor(next) * ghosts} />
        ))}
        {ghosts > 0 && <GhostTag text="EVEN GOD" x={720} y={330} from={F('T7') - at} dim={ghosts} />}
      </Layer>
      {dawn > 0 && <LightBeam id="dawn" points={[[ROOM_WINDOW.x0, ROOM_WINDOW.y0], [ROOM_WINDOW.x1, ROOM_WINDOW.y0], [260, 1920], [-300, 1920]]} opacity={0.45 * dawn} />}
      {dawn > 0 && <Dust seed={60} count={45} opacity={dawn} region={[100, 400, 900, 1400]} />}
      {bubble && <MessageBubble x={420} y={600} text="I'm sorry. It was me." typeFrom={F('stopPassing') + 18 - at} typeTo={F('bringIt') - at} sentAt={F('sent') - at} />}
    </CameraRig>
  );
};
const modernThreads = (): ThreadSpec[] =>
  (['T4', 'T5', 'T6', 'T7'] as const).map((id) => ({ id, from: [0, 0], to: GHOST_TARGET[id], start: F(id), shoot: id === 'T7' ? 10 : 8, sag: id === 'T7' ? 30 : undefined }));
export const S10: React.FC<ShotProps> = (sp) => {
  const { f } = useShot(sp);
  const g = sp.at + f;
  const beats: [number, Cam][] = [
    [F('modern'), camOn(660, 1080, 1.0, { aperture: 3 })],
    [F('T4') - 4, camOn(620, 1060, 1.05, { aperture: 3 })],
    [F('T4') + 10, camOn(470, 1060, 1.08, { aperture: 3, rot: -0.6 })],
    [F('T5') + 10, camOn(450, 860, 1.1, { aperture: 3, rot: -0.4 })],
    [F('T6') + 10, camOn(520, 1040, 1.08, { aperture: 3, rot: 0.3 })],
    [F('T7') + 12, camOn(600, 860, 1.0, { aperture: 3 })],
    [F('butNotice'), camOn(620, 840, 1.02, { aperture: 3 })],
  ];
  let cam = beats[0][1];
  for (let i = 1; i < beats.length; i++) if (g >= beats[i - 1][0]) cam = camLerp(beats[i - 1][1], beats[i][1], easeInOut(clamp01((g - beats[i - 1][0]) / (beats[i][0] - beats[i - 1][0]))));
  return <Bedroom g={g} at={sp.at} cam={cam} threads={modernThreads()} />;
};

// ================================================================ S11 God called Adam
export const S11a: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CloseUp spec={ADAM_CU} place={{ x: 470, y: 1960, h: 1500 }} seed={16} look={LOOK.godLight}
      cam={camLerp(camOn(540, 980, 1.0, { aperture: 30 }), camOn(540, 955, 1.05, { aperture: 30 }), easeInOut(p))}
      set={<>{eveningBg()}<Wash color="#04050c" opacity={0.55} /></>}
      front={<><GodRays id="s11" x={600} y={-150} angle={Math.PI / 2 + 0.06} spread={0.35} count={7} opacity={0.55} /><Dust seed={25} count={30} /></>}
    />
  );
};
export const S11b: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CloseUp spec={ADAM_CU} place={{ x: 430, y: 2050, h: 2100 }} seed={17} look={LOOK.godLight}
      cam={camLerp(camOn(560, 880, 1.0, { aperture: 36 }), camOn(580, 840, 1.08, { aperture: 36 }), easeInOut(p))}
      set={<>{eveningBg()}<Wash color="#04050c" opacity={0.5} /></>}
      front={<><GodRays id="s11b" x={560} y={-150} angle={Math.PI / 2} spread={0.5} count={7} opacity={0.45} /><Dust seed={26} count={24} /></>}
    />
  );
};

// ================================================================ S12 one man (quote over the web)
export const S12: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CameraRig cam={camLerp(camOn(540, 960, 1.0, { rot: -1 }), camOn(540, 980, 1.08, { rot: 1 }), easeInOut(p))}>
      <VoidSet />
      <Layer depth={1}><Threads threads={webThreads(0)} globalOpacity={0.85} /></Layer>
      <Dust seed={27} count={40} opacity={0.8} />
    </CameraRig>
  );
};

// ================================================================ S13 Gethsemane
export const S13a: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CameraRig cam={camLerp(camOn(540, 900, 1.0, { aperture: 3 }), camOn(560, 965, 1.06, { aperture: 3 }), easeInOut(p))}>
      <GethSet />
      <Dust seed={28} count={30} color="190,205,255" opacity={0.7} />
    </CameraRig>
  );
};
export const S13b: React.FC<ShotProps> = (sp) => {
  const { p } = useShot(sp);
  return (
    <CameraRig cam={camLerp(camOn(560, 1260, 1.0, { focus: 0.95, aperture: 10 }), camOn(565, 1250, 1.12, { focus: 0.95, aperture: 10 }), easeInOut(p))}>
      <GethSet>
        <Layer depth={0.95}><Character spec={JESUS_KNEEL} x={580} y={1700} h={980} look={LOOK.moon} seed={61} blink={0} /></Layer>
      </GethSet>
      <Dust seed={29} count={26} color="190,205,255" opacity={0.7} />
    </CameraRig>
  );
};

// ================================================================ S14 torches
export const S14a: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const gx = lerp(900, 330, p);
  const H = 660;
  const s = H / 420;
  const torchLight = flicker(f, 3);
  return (
    <CameraRig cam={camLerp(camOn(760, 1250, 1.12, { aperture: 4 }), camOn(560, 1250, 1.12, { aperture: 4 }), easeInOut(p))}>
      <GethSet foreground={false}>
        <Layer depth={0.92}>
          <div style={{ position: 'absolute', left: gx - 400, top: 800, width: 1700, height: 1100, background: `radial-gradient(ellipse, rgba(255,150,70,${0.26 * torchLight}), rgba(255,150,70,0) 65%)`, mixBlendMode: 'screen' }} />
          <Guards x={gx} y={1720} h={H} count={5} spacing={170} walk={1} light={torchLight} />
          {[0, 1, 2, 3, 4].map((i) => {
            const sc = s * (1 - (i % 2) * 0.12);
            const bx = gx + i * 170 + (i % 2) * 30;
            const by = 1720 + (i % 2) * 40 - Math.abs(Math.sin((f + i * 7) * 0.21)) * 6;
            return <Torch key={i} x={bx + 62 * sc} y={by - 420 * sc + 22 * sc} scale={0.7} seed={i + 1} handle />;
          })}
        </Layer>
      </GethSet>
      <Layer depth={1.5}>
        {[-260, 1180].map((x, i) => (
          <div key={i} style={{ position: 'absolute', left: x, top: -200, width: 70, height: 2400, background: 'linear-gradient(90deg,#030407,#0b0d14 60%,#030407)', filter: 'blur(5px)', borderRadius: 40 }} />
        ))}
      </Layer>
      <Dust seed={30} count={30} color="255,190,120" opacity={0.6} />
    </CameraRig>
  );
};
export const S14b: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const warm = ramp(f, 2, 26) * flicker(f, 5);
  return (
    <CameraRig cam={camLerp(camOn(560, 1150, 1.0, { focus: 0.95, aperture: 12 }), camOn(565, 1110, 1.06, { focus: 0.95, aperture: 12 }), easeInOut(p))}>
      <GethSet>
        <Layer depth={0.95}><Character spec={JESUS_KNEEL} x={570} y={1920} h={1300} look={mixLook(LOOK.moon, LOOK.torch, warm * 0.8)} seed={62} blink={0} /></Layer>
      </GethSet>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 50% at 110% 60%, rgba(255,150,70,${0.4 * warm}), rgba(255,150,70,0) 70%)`, mixBlendMode: 'screen' }} />
      <Dust seed={31} count={22} color="255,190,120" opacity={0.6} />
    </CameraRig>
  );
};

// ================================================================ S15 I am he
const torchCU = (f: number, retreat = 0) => (
  <Layer depth={1.3}>
    <div style={{ filter: 'blur(5px)' }}>
      <Torch x={lerp(1020, 1180, retreat)} y={lerp(1560, 1660, retreat)} scale={lerp(1.5, 1.0, retreat)} seed={7} handle />
      <Torch x={lerp(-40, -160, retreat)} y={lerp(1700, 1780, retreat)} scale={lerp(1.2, 0.8, retreat)} seed={8} handle />
    </div>
    <div style={{ position: 'absolute', left: 300, top: 600, width: 1300, height: 1400, background: `radial-gradient(ellipse, rgba(255,150,70,${0.3 * flicker(f, 7) * (1 - 0.4 * retreat)}), rgba(255,150,70,0) 65%)`, mixBlendMode: 'screen' }} />
  </Layer>
);
export const S15a: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const step = ramp(f, 0, sp.dur);
  return (
    <CloseUp spec={JESUS_CU} place={{ x: 540, y: 2350, h: 2200 }} seed={71} blink={0}
      look={mixLook(LOOK.moon, LOOK.torch, 0.3 + 0.6 * step)}
      cam={camLerp(camOn(560, 1180, 1.0, { aperture: 30, rot: 2 }), camOn(610, 900, 1.06, { aperture: 30, rot: 1 }), easeInOut(p))}
      set={<GethSet foreground={false} />}
      front={<>{torchCU(f)}<Dust seed={32} count={24} color="255,190,120" opacity={0.6} /></>}
    />
  );
};
export const S15b: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  return (
    <CloseUp spec={JESUS_CU} place={{ x: 470, y: 2050, h: 2000 }} seed={72} look={mixLook(LOOK.moon, LOOK.torch, 0.85)}
      cam={camLerp(camOn(560, 880, 1.0, { aperture: 34 }), camOn(575, 840, 1.06, { aperture: 34 }), easeInOut(p))}
      set={<GethSet foreground={false} />}
      front={<>{torchCU(f, ramp(f, 10, 32))}<Dust seed={33} count={20} color="255,190,120" opacity={0.6} /></>}
    />
  );
};

// ================================================================ S16 let these go
export const S16a: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  return (
    <CloseUp spec={JESUS_CU} place={{ x: 430, y: 2000, h: 1750 }} seed={73} look={mixLook(LOOK.moon, LOOK.torch, 0.75)}
      cam={camLerp(camOn(540, 960, 1.0, { aperture: 16 }), camOn(520, 940, 1.05, { aperture: 16 }), easeInOut(p))}
      set={<GethSet foreground={false}><Layer depth={0.85}><div style={{ filter: 'blur(2px)' }}><Disciples x={-150} y={1530} h={430} /></div></Layer></GethSet>}
      front={<>{torchCU(f, 0.6)}<Dust seed={34} count={20} color="255,190,120" opacity={0.6} /></>}
    />
  );
};
export const S16b: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  return (
    <CloseUp spec={JESUS_CU} place={{ x: 420, y: 2120, h: 2150 }} seed={74} look={mixLook(LOOK.moon, LOOK.torch, 0.7)}
      cam={camLerp(camOn(560, 860, 1.0, { aperture: 36 }), camOn(580, 820, 1.08, { aperture: 36 }), easeInOut(p))}
      set={<GethSet foreground={false} />}
      front={<>{torchCU(f, 0.7)}<Dust seed={35} count={18} color="255,190,120" opacity={0.5} /></>}
    />
  );
};

// ================================================================ S17 he took it
export const S17a: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const threads: ThreadSpec[] = [
    { id: 'h1', from: [260, 760], to: [760, 820], start: -40, shoot: 1 },
    { id: 'h2', from: [260, 760], to: [120, 260], start: -40, shoot: 1 },
    { id: 'h3', from: [700, 860], to: [940, 380], start: -40, shoot: 1 },
  ];
  return <HideScene g={F('hid') + 60 + f} threads={threads} cam={camLerp(camOn(540, 900, 1.04, { aperture: 18 }), camOn(540, 930, 1.1, { aperture: 18 }), easeInOut(p))} />;
};

const JESUS_VOID = { x: 540, y: 2150, h: 1800 };
export const S17b: React.FC<ShotProps> = (sp) => {
  const { f, p, L } = useShot(sp);
  const fly = L('tookIt') - 6;
  const heart: [number, number] = [560, 1420];
  return (
    <CameraRig cam={camLerp(camOn(540, 960, 1.0), camOn(545, 930, 1.06), easeInOut(p))}>
      <VoidSet />
      <Layer depth={1}>
        <Character spec={JESUS_CU} {...JESUS_VOID} look={LOOK.void} seed={75} />
        <Threads threads={webThreads(0, { flyTo: heart, flyStart: fly, flyLen: 18, meltLen: 14 })} />
        <Orb x={heart[0]} y={heart[1]} r={30} intensity={ramp(f, fly + 12, fly + 26)} />
      </Layer>
      <Dust seed={36} count={36} opacity={0.8} />
    </CameraRig>
  );
};

export const S17c: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const line = ramp(f, 0, 30);
  const reveal = lerp(0, 1.5, ramp(f, 0, 44));
  return (
    <CameraRig cam={camLerp(camOn(540, 960, 1.0), camOn(540, 985, 1.06), easeInOut(p))}>
      <VoidSet />
      <Layer depth={1}>
        <Character spec={JESUS_CU} x={540} y={2350} h={1800} look={LOOK.void} seed={76} lineMix={line} reveal={reveal} revealCenter={[0.6, 0.3]} blink={0} />
      </Layer>
      <Dust seed={37} count={70} color="255,214,140" rise={26} opacity={1} />
    </CameraRig>
  );
};

// ================================================================ S18 bring it to Him
export const S18: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  const g = sp.at + f;
  const dawn = ramp(g, F('bringIt'), F('cta') + 6);
  return (
    <Bedroom g={g} at={sp.at} dawn={dawn} ghosts={1 - 0.6 * ramp(g, F('stopPassing'), F('stopPassing') + 20) - 0.4 * ramp(g, F('sent'), F('cta'))} ghostWarm={dawn}
      threads={modernThreads().map((t) => ({ ...t, opacity: 0.6 }))} bubble
      cam={camLerp(camOn(640, 1080, 1.05, { aperture: 3 }), camOn(700, 960, 1.12, { aperture: 3 }), easeInOut(p))} />
  );
};

// ================================================================ S19 call to action
export const S19: React.FC<ShotProps> = (sp) => {
  const { f, p } = useShot(sp);
  return (
    <Bedroom g={sp.at + f} at={sp.at} dawn={1} ghosts={0} backlit={0.55 + 0.45 * ramp(f, 0, 30)}
      cam={camLerp(camOn(720, 920, 1.12, { aperture: 3 }), camOn(790, 830, 1.24, { aperture: 3 }), easeInOut(p))} />
  );
};
