import { CamPose, orbit, withDrift } from "../../../lib/camera";
import { clamp, keyNum, lerp, prog, smoothstep, Vec3 } from "../../../lib/math";
import { blendMood, Mood, MOODS } from "../../../lib/moods";
import { ABRAHAM, figure, ISAAC } from "../../../people/cast";
import { FigureSpec } from "../../../people/draw";
import { figurePoint, PaperPerson, Pose } from "../../../people/Paper";
import { GoldDust, GoldRing, LightBeam, Ram, SkyBody } from "../../../world/props";
import { SceneDef } from "../../../world/Stage";
import { ABRAHAM_TOP, ISAAC_TOP, SEAT, SummitTerrain, summitSet, THICKET } from "../sets/summit";
import { CUES } from "../timing";
import { figureTint, sunOf } from "./common";

// S7: the top. Isaac sits calm beside the altar; Abraham lifts an EMPTY hand to the sky;
// a soft beam of light bursts down (God is shown only as light); gold dust; everything slows.
// S8: the camera turns behind them: a ram caught in a thicket, a glowing gold ring.
// Then JEHOVAH-JIREH, and two thousand years pass in the sky.

const ABRAHAM_TOP_SPEC: FigureSpec = { ...ABRAHAM, id: "abraham_top", props: {} };
const g = (x: number, z: number) => summitSet().terrain.heightAt(x, z);
const ALTAR_Y = () => g(0, 0);

/** Slow motion after the beam bursts: animation time runs at 40%. */
function slow(t: number) {
  const b = CUES.beam.burst;
  return t < b ? t : b + (t - b) * 0.4;
}

function people(t: number, cam: CamPose) {
  const ts = slow(t);
  const raise = keyNum([
    { t: CUES.handRaise.start, v: 0.12 },
    { t: CUES.handRaise.top + 0.2, v: 2.55, e: "inOutSine" },
    { t: CUES.scene("S8").start + 1.0, v: 2.55 },
    { t: CUES.scene("S8").start + 2.6, v: 0.35, e: "inOutSine" },
  ], t);
  const abraham: Pose = {
    pos: [ABRAHAM_TOP[0], g(ABRAHAM_TOP[0], ABRAHAM_TOP[2]), ABRAHAM_TOP[2]],
    face: -1,
    t: ts,
    seed: 11,
    armFront: raise,
    armBack: 0.05,
    headTilt: 0.12 + 0.22 * smoothstep(CUES.handRaise.start, CUES.handRaise.top, t) - 0.25 * smoothstep(CUES.goldRing.start - 0.6, CUES.goldRing.start + 0.4, t),
    headTurn: 0.02,
  };
  const isaac: Pose = {
    pos: [SEAT[0], g(SEAT[0], SEAT[2]) + 0.07 - 0.07 * smoothstep(CUES.scene("S8").start + 0.1, CUES.scene("S8").start + 1.2, t), SEAT[2] + 0.05],
    face: 1,
    t: ts,
    seed: 23,
    // after the light, Isaac stands up as the camera turns
    sit: 1 - smoothstep(CUES.scene("S8").start + 0.1, CUES.scene("S8").start + 1.2, t),
    armFront: 0.75 * (1 - smoothstep(CUES.scene("S8").start + 0.1, CUES.scene("S8").start + 1.2, t)),
    armBack: 0.55 * (1 - smoothstep(CUES.scene("S8").start + 0.1, CUES.scene("S8").start + 1.2, t)),
    headTilt: 0.05 + 0.3 * smoothstep(CUES.beam.burst - 0.2, CUES.beam.burst + 1.2, t),
    headTurn: 0.015,
  };
  void cam;
  return { abraham, isaac };
}

function camera(t: number): CamPose {
  const s7 = CUES.scene("S7");
  const s8 = CUES.scene("S8");
  const target: Vec3 = [-0.05, ALTAR_Y() + 0.9, 0.2];
  if (t < s8.start) {
    // slow push-in; it nearly stops once the light comes ("everything slows")
    const k = prog(slow(t), s7.start, slow(s7.end + 1.5), "outCubic");
    return withDrift({ pos: orbit(target, lerp(17.5, 14.6, k), lerp(14, 20, k), lerp(37, 40, k)), target, fov: 25 }, slow(t), 707, 0.03);
  }
  // S8: orbit behind them to reveal the ram, push in, then crane up as the years pass
  // turn behind them and pull back: the ram on its gold ring in front, the altar and the pair beyond
  const turn = prog(t, s8.start, s8.start + 2.3, "inOutCubic");
  const lift = prog(t, CUES.title.start, s8.end, "inOutSine");
  const ram: Vec3 = [THICKET[0] + 0.3, ALTAR_Y() + 0.5, THICKET[2] - 1.15];
  const mid: Vec3 = [lerp(ram[0], -0.3, 0.42), ALTAR_Y() + 0.9, lerp(ram[2], 0.3, 0.42)];
  const aim: Vec3 = [lerp(target[0], mid[0], turn), lerp(target[1], mid[1], turn), lerp(target[2], mid[2], turn)];
  const az = lerp(20, 176, turn);
  const r = lerp(14.6, 19, turn) + lift * 8;
  const el = lerp(40, 40, turn) + Math.sin(Math.PI * turn) * 14 + lift * 10; // rise over Abraham mid-turn
  return withDrift({ pos: orbit(aim, r, az, el), target: [aim[0], aim[1] + lift * 2, aim[2]], fov: 25 }, t, 808, 0.03);
}

function mood(t: number): Mood {
  const burst = smoothstep(CUES.beam.burst - 0.15, CUES.beam.burst + 0.6, t);
  const before = { ...MOODS.climb, sunAz: 62, sunEl: 26, fogNear: 30, fogFar: 170 };
  const hush = { ...before, sunIntensity: 2.2, exposure: 0.9, hemiIntensity: 0.85 };
  const m0 = blendMood(before, hush, smoothstep(CUES.handRaise.start, CUES.beam.start, t));
  let m = blendMood(m0, { ...MOODS.glory, fogNear: 30, fogFar: 170, exposure: 0.94, fog: "#f4dcae", skyHorizon: "#fbe7c0" }, burst);
  // two thousand years: the sky turns over and cools towards Golgotha grey
  const years = prog(t, CUES.timeLapse.start, CUES.scene("S8").end, "inOutSine");
  if (years > 0) {
    const cyc = Math.max(0, t - CUES.timeLapse.start) / 0.7;
    m = blendMood(m, MOODS.night, ((1 - Math.cos(cyc * Math.PI * 2)) / 2) * 0.45 * (1 - years * 0.5));
    m = blendMood(m, { ...MOODS.golgotha, fogNear: 30, fogFar: 170 }, years * 0.85);
    m = { ...m, sunAz: m.sunAz - cyc * 360 };
  }
  return m;
}

const World: SceneDef["World"] = ({ t, cam, mood: m }) => {
  const p = people(t, cam);
  const sun = sunOf(m);
  const tint = figureTint(m, 0.18, 1.02);
  const burst = smoothstep(CUES.beam.burst - 0.15, CUES.beam.burst + 0.5, t);
  const beamK = burst * (1.15 - 0.25 * smoothstep(CUES.beam.burst + 0.5, CUES.beam.burst + 2.5, t)) * (1 - smoothstep(CUES.title.start, CUES.timeLapse.start + 0.8, t));
  const ramK = smoothstep(CUES.goldRing.start - 0.2, CUES.goldRing.start + 0.9, t);
  const yr = Math.max(0, t - CUES.timeLapse.start) / 0.7 * Math.PI * 2;
  const lapse = t > CUES.timeLapse.start;
  return (
    <>
      <SummitTerrain />
      <LightBeam pos={[0.2, ALTAR_Y(), 0.4]} strength={beamK * 0.9} radius={2.4} height={38} />
      <GoldDust center={[0.2, ALTAR_Y(), 0.4]} radius={2.6} height={7} t={slow(t)} amount={burst * (1 - smoothstep(CUES.title.start, CUES.timeLapse.start + 0.8, t))} count={160} />
      <Ram pos={[THICKET[0] + 0.3, g(THICKET[0], THICKET[2]) + 0.05, THICKET[2] - 1.15]} heading={2.6} t={t} struggle={0.4} />
      <GoldRing pos={[THICKET[0] + 0.3, g(THICKET[0], THICKET[2]) + 0.06, THICKET[2] - 1.15]} k={ramK} radius={1.2} />
      {lapse ? <SkyBody kind="sun" pos={[Math.sin(yr) * 300, 30 + Math.cos(yr) * 180, -220]} size={10} /> : null}
      <PaperPerson fig={figure(ISAAC)} pose={{ ...p.isaac, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={figure(ABRAHAM_TOP_SPEC)} pose={{ ...p.abraham, tint }} cam={cam.pos} sun={sun} />
    </>
  );
};

const anchors = (t: number) => {
  const cam = camera(t);
  const p = people(t, cam);
  const fig = figure(ABRAHAM_TOP_SPEC);
  // the raised hand: shoulder + arm length rotated by the arm angle (figure space)
  const L = fig.parts.armFront!.pivot[1] - fig.anchors.hand[1];
  const a = p.abraham.armFront ?? 0;
  const sh = fig.parts.armFront!.pivot[1];
  const hand: [number, number] = [0.02 + Math.sin(a) * L, sh - Math.cos(a) * L];
  return {
    "abraham.hand": figurePoint(p.abraham, cam.pos, hand),
    "abraham.head": figurePoint(p.abraham, cam.pos, fig.anchors.head),
    "isaac.head": figurePoint(p.isaac, cam.pos, [0.01, 1.2]),
    "ram.head": [THICKET[0] - 0.05, g(THICKET[0], THICKET[2]) + 1.05, THICKET[2] - 1.4] as Vec3,
  };
};

export const S7: SceneDef = { id: "S7", camera, mood, World, anchors, shadow: () => ({ center: [0, ALTAR_Y(), -1.5], radius: 15 }) };
export const S8: SceneDef = { id: "S8", camera, mood, World, anchors, shadow: () => ({ center: [-0.5, ALTAR_Y(), -2.5], radius: 15 }) };

export const _clamp = clamp;
