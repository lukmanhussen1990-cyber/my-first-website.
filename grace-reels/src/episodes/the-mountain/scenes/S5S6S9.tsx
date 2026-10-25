import { CamPose, track, withDrift } from "../../../lib/camera";
import { lerp, prog, smoothstep, Vec3 } from "../../../lib/math";
import { blendMood, Mood, MOODS } from "../../../lib/moods";
import { ABRAHAM, figure, ISAAC, JESUS, SERVANT_A, SERVANT_B } from "../../../people/cast";
import { FigureSpec } from "../../../people/draw";
import { along, faceFor, phaseFromDistance, walkAmount, walkDistance } from "../../../people/motion";
import { figurePoint, PaperPerson, Pose } from "../../../people/Paper";
import { Donkey, FirePot } from "../../../world/props";
import { SceneDef } from "../../../world/Stage";
import { MountainTerrain, mountainSet } from "../sets/mountain";
import { CUES } from "../timing";
import { figureTint, orbitCam, sunOf } from "./common";

// S5: the foot of the mountain. The servants and the donkey stay; Abraham and Isaac walk on.
// S6: the climb. Isaac carries the wood, Abraham the fire pot; Isaac stops and looks up.
// S9: the match cut. Same camera as S6, but now Jesus carries the wooden beam. Cold grey sky.

const ABRAHAM_POT: FigureSpec = { ...ABRAHAM, id: "abraham_pot", props: {} };
const ground = (x: number, z: number) => mountainSet().terrain.heightAt(x, z);

function onPath(d: number, cam: CamPose, t: number, seed: number, walk: { start: number; stop: number }): Pose {
  const set = mountainSet();
  const { pos, dir } = along(set.path, d);
  return {
    pos: [pos[0], ground(pos[0], pos[2]), pos[2]],
    face: faceFor(dir, cam.pos, cam.target),
    walk: phaseFromDistance(d, 1.05),
    walkAmt: walkAmount(t, walk.start, walk.stop),
    t,
    seed,
  };
}

// ------------------------------------------------------------------ S5

const S5_DONKEY: Vec3 = [-13.2, 0, 30.2];
const S5_SERV_A: Vec3 = [-11.6, 0, 31.8];
const S5_SERV_B: Vec3 = [-14.8, 0, 32.4];

function s5People(t: number, cam: CamPose) {
  const s = CUES.scene("S5");
  const set = mountainSet();
  const base = 2.2; // metres along the path where they leave the servants
  const walk = { start: s.start + 0.6, stop: s.end + 3 };
  const dA = base + 1.6 + walkDistance(t, walk.start, walk.stop, 0.95);
  const dI = base + walkDistance(t, walk.start + 0.15, walk.stop, 0.95);
  return {
    abraham: { ...onPath(dA, cam, t, 11, walk), armFront: 0.48 },
    isaac: { ...onPath(dI, cam, t, 23, { start: walk.start + 0.15, stop: walk.stop }), armFront: -0.25 },
    servantA: { pos: [S5_SERV_A[0], ground(S5_SERV_A[0], S5_SERV_A[2]), S5_SERV_A[2]] as Vec3, face: 1 as const, t, seed: 31, armFront: 0.15 + Math.sin(t * 2.2) * 0.04 * smoothstep(s.start, s.start + 3, t) },
    servantB: { pos: [S5_SERV_B[0], ground(S5_SERV_B[0], S5_SERV_B[2]), S5_SERV_B[2]] as Vec3, face: 1 as const, t, seed: 37 },
    donkey: { pos: [S5_DONKEY[0], ground(S5_DONKEY[0], S5_DONKEY[2]), S5_DONKEY[2]] as Vec3, heading: -0.5, walk: 0, walkAmt: 0, t },
    set,
  };
}

function s5Camera(t: number): CamPose {
  const s = CUES.scene("S5");
  const set = mountainSet();
  const dummy: CamPose = { pos: [0, 40, 60], target: [0, 0, 0], fov: 25 };
  const p0 = s5People(s.start, dummy);
  const p1 = s5People(s.end, dummy);
  const pair = (p: ReturnType<typeof s5People>): Vec3 => [(p.abraham.pos[0] + p.isaac.pos[0]) / 2, (p.abraham.pos[1] + p.isaac.pos[1]) / 2 + 1.3, (p.abraham.pos[2] + p.isaac.pos[2]) / 2];
  const a = pair(p0);
  const b = pair(p1);
  const t0: Vec3 = [lerp(a[0], S5_DONKEY[0], 0.4), lerp(a[1], ground(S5_DONKEY[0], S5_DONKEY[2]) + 1.2, 0.4), lerp(a[2], S5_DONKEY[2], 0.4)];
  return orbitCam(t, s.start, s.end, t0, [lerp(b[0], S5_DONKEY[0], 0.12), b[1], lerp(b[2], S5_DONKEY[2], 0.12)], { r: 20, az: -10, el: 33, fov: 26 }, { r: 23, az: 6, el: 40, fov: 25 }, 505);
}

const S5World: SceneDef["World"] = ({ t, cam, mood }) => {
  const p = s5People(t, cam);
  const sun = sunOf(mood);
  const tint = figureTint(mood, 0.22);
  return (
    <>
      <MountainTerrain />
      <Donkey pose={p.donkey} />
      <PaperPerson fig={figure(SERVANT_A)} pose={{ ...p.servantA, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={figure(SERVANT_B)} pose={{ ...p.servantB, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={figure(ISAAC)} pose={{ ...p.isaac, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={figure(ABRAHAM)} pose={{ ...p.abraham, tint }} cam={cam.pos} sun={sun} />
    </>
  );
};

const climbMood = (): Mood => ({ ...MOODS.climb, sunAz: 62, sunEl: 21, fogNear: 24, fogFar: 140 });

export const S5: SceneDef = {
  id: "S5",
  camera: s5Camera,
  mood: climbMood,
  World: S5World,
  anchors: (t) => {
    const cam = s5Camera(t);
    const p = s5People(t, cam);
    return {
      "abraham.head": figurePoint(p.abraham, cam.pos, figure(ABRAHAM).anchors.head),
      "isaac.head": figurePoint(p.isaac, cam.pos, figure(ISAAC).anchors.head),
    };
  },
  shadow: (t) => ({ center: s5Camera(t).target, radius: 26 }),
};

// ------------------------------------------------------------------ S6 (and S9 shares its camera)

const S6_BASE = () => mountainSet().path.lengths[6] + 1.5; // the traverse between path points 6 and 8

function s6People(t: number, cam: CamPose) {
  const s = CUES.scene("S6");
  const stopAt = CUES.headTurn.start; // Isaac stops on "asked"
  const goAgain = CUES.at("b09", "provide") + 0.3;
  const base = S6_BASE();
  const walk1 = { start: s.start - 2, stop: stopAt + 0.25 };
  const walk2 = { start: goAgain, stop: s.end + 4 };
  const dist = (offset: number, lag: number) =>
    base + offset + walkDistance(t, walk1.start, walk1.stop + lag, 0.9) + walkDistance(t, walk2.start + lag, walk2.stop, 0.9);
  const amt = (lag: number) => Math.max(walkAmount(t, walk1.start, walk1.stop + lag), walkAmount(t, walk2.start + lag, walk2.stop));
  const dA = dist(1.9, 0.35);
  const dI = dist(0, 0);
  const ab = onPath(dA, cam, t, 11, walk1);
  const is = onPath(dI, cam, t, 23, walk1);
  ab.walkAmt = amt(0.35);
  is.walkAmt = amt(0);
  // Abraham turns back to his son while he answers, then they walk on together
  const turned = t > CUES.at("b09", "my") - 0.25 && t < goAgain;
  const look = smoothstep(CUES.headTurn.start, CUES.headTurn.start + 0.5, t) * (1 - smoothstep(goAgain - 0.2, goAgain + 0.3, t));
  return {
    abraham: { ...ab, face: (turned ? -ab.face : ab.face) as 1 | -1, armFront: 0.12, armBack: 0.05 },
    isaac: { ...is, headTilt: 0.32 * look, armFront: -0.25 },
  };
}

/** S6 camera; S9 reuses it with the same clock offset so the frames match exactly. */
function s6Camera(t: number): CamPose {
  const s = CUES.scene("S6");
  // aim at the pair's midpoint (positions don't depend on the camera, only facing does)
  const dummy: CamPose = { pos: [0, 40, 60], target: [0, 0, 0], fov: 25 };
  const p = s6People(t, dummy);
  const mid: Vec3 = [(p.abraham.pos[0] + p.isaac.pos[0]) / 2, (p.abraham.pos[1] + p.isaac.pos[1]) / 2 + 1.25, (p.abraham.pos[2] + p.isaac.pos[2]) / 2];
  return orbitCam(t, s.start, s.end, mid, mid, { r: 16.5, az: 20, el: 38, fov: 25 }, { r: 13.8, az: 25, el: 37, fov: 25 }, 606, "linear", 0.04);
}

const S6World: SceneDef["World"] = ({ t, cam, mood }) => {
  const p = s6People(t, cam);
  const sun = sunOf(mood);
  const tint = figureTint(mood, 0.22);
  const potFig = figure(ABRAHAM_POT);
  const hand = figurePoint(p.abraham, cam.pos, [potFig.anchors.hand[0] + 0.18, potFig.anchors.hand[1] - 0.06]);
  return (
    <>
      <MountainTerrain />
      <PaperPerson fig={figure(ISAAC)} pose={{ ...p.isaac, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={potFig} pose={{ ...p.abraham, tint }} cam={cam.pos} sun={sun} />
      <FirePot pos={[hand[0], hand[1] - 0.22, hand[2]]} t={t} />
    </>
  );
};

export const S6: SceneDef = {
  id: "S6",
  camera: s6Camera,
  mood: (t) => blendMood(climbMood(), { ...climbMood(), sunEl: 16, sunIntensity: 3.4 }, prog(t, CUES.scene("S6").start, CUES.scene("S6").end)),
  World: S6World,
  anchors: (t) => {
    const cam = s6Camera(t);
    const p = s6People(t, cam);
    return {
      "isaac.wood": figurePoint(p.isaac, cam.pos, figure(ISAAC).anchors.wood),
      "isaac.head": figurePoint(p.isaac, cam.pos, figure(ISAAC).anchors.head),
      "abraham.head": figurePoint(p.abraham, cam.pos, figure(ABRAHAM_POT).anchors.head),
    };
  },
  shadow: (t) => ({ center: s6Camera(t).target, radius: 22 }),
};

// ------------------------------------------------------------------ S9

/** Map S9 time onto the S6 clock, starting from the S6 moment "Isaac carried the wood". */
const s9Clock = (t: number) => CUES.at("b08", "isaac") - 0.3 + (t - CUES.scene("S9").start);

function s9Camera(t: number): CamPose {
  return s6Camera(s9Clock(t));
}

function s9Jesus(t: number, cam: CamPose): Pose {
  const s = CUES.scene("S9");
  const base = S6_BASE();
  // Jesus walks the same stretch Isaac walked, a little slower, bent under the beam
  const isaacAtMatch = base + walkDistance(s9Clock(s.start), CUES.scene("S6").start - 2, CUES.headTurn.start + 0.25, 0.9);
  const d = isaacAtMatch + walkDistance(t, s.start - 1, s.end + 3, 0.72);
  const p = onPath(d, cam, t, 47, { start: s.start - 1, stop: s.end + 3 });
  return { ...p, walk: phaseFromDistance(d, 0.95), lean: 0.08, armFront: -0.55, armBack: -0.4, headTilt: -0.05 };
}

const golgothaPath = (): Mood => ({ ...MOODS.golgotha, sunAz: 40, sunEl: 35, fogNear: 18, fogFar: 110 });

const S9World: SceneDef["World"] = ({ t, cam, mood }) => {
  const pose = s9Jesus(t, cam);
  return (
    <>
      <MountainTerrain />
      <PaperPerson fig={figure(JESUS)} pose={{ ...pose, tint: figureTint(mood, 0.15, 0.95) }} cam={cam.pos} sun={sunOf(mood)} />
    </>
  );
};

export const S9: SceneDef = {
  id: "S9",
  camera: s9Camera,
  mood: (t) => blendMood(golgothaPath(), { ...golgothaPath(), skyTop: "#262b33", fog: "#4d5158", exposure: 0.9 }, prog(t, CUES.scene("S9").start, CUES.scene("S9").end)),
  World: S9World,
  anchors: (t) => {
    const cam = s9Camera(t);
    return { "jesus.head": figurePoint(s9Jesus(t, cam), cam.pos, figure(JESUS).anchors.head) };
  },
  shadow: (t) => ({ center: s9Camera(t).target, radius: 22 }),
};

export { track, withDrift };
