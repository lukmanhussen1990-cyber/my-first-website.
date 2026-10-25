import { CamPose, orbit, withDrift } from "../../../lib/camera";
import { clamp, lerp, prog, smoothstep, Vec3 } from "../../../lib/math";
import { blendMood, Mood, MOODS } from "../../../lib/moods";
import { ABRAHAM, figure, ISAAC, SERVANT_A, SERVANT_B } from "../../../people/cast";
import { along, faceFor, phaseFromDistance } from "../../../people/motion";
import { figurePoint, PaperPerson, Pose } from "../../../people/Paper";
import { Donkey, GoldDust, LightBeam, SkyBody, Stars } from "../../../world/props";
import { SceneDef } from "../../../world/Stage";
import { DesertTerrain, desertSet, MORIAH, MORIAH_PEAK } from "../sets/desert";
import { figureTint, orbitCam, sunOf } from "./common";
import { CUES } from "../timing";

// S2: night, Abraham outside his tent under a soft beam of light (God's voice, never a person).
// S3: the far mountains, softly blurred behind the search bar.
// S4: the three-day journey across the desert, with a sun-and-moon time-lapse.

// ------------------------------------------------------------------ S2

const S2_ABRAHAM: Vec3 = [3.4, 0, 2.6];

function s2Camera(t: number): CamPose {
  const s = CUES.scene("S2");
  const target: Vec3 = [1.6, 1.4, 1.0];
  return orbitCam(t, s.start, s.end, target, target, { r: 24, az: 34, el: 35, fov: 26 }, { r: 21, az: 28, el: 38, fov: 25 }, 202);
}

const S2World: SceneDef["World"] = ({ t, cam, mood }) => {
  const set = desertSet();
  const y = set.terrain.heightAt(S2_ABRAHAM[0], S2_ABRAHAM[2]);
  const pose: Pose = { pos: [S2_ABRAHAM[0], y, S2_ABRAHAM[2]], face: -1, t, seed: 11, headTilt: 0.32, armFront: 0.48, tint: figureTint(mood, 0.5, 0.92) };
  return (
    <>
      <DesertTerrain />
      <Stars amount={0.9} />
      <SkyBody kind="moon" pos={[-120, 160, -260]} size={7} glow={0.9} />
      <LightBeam pos={[S2_ABRAHAM[0], y, S2_ABRAHAM[2]]} strength={0.8} radius={1.4} height={40} />
      <GoldDust center={[S2_ABRAHAM[0], y, S2_ABRAHAM[2]]} radius={1.3} height={8} t={t} amount={0.8} count={70} />
      <PaperPerson fig={figure(ABRAHAM)} pose={pose} cam={cam.pos} sun={sunOf(mood)} />
    </>
  );
};

export const S2: SceneDef = {
  id: "S2",
  camera: s2Camera,
  mood: () => ({ ...MOODS.night, sunAz: -30, sunEl: 40 }),
  World: S2World,
  shadow: () => ({ center: [1, 0, 1], radius: 14 }),
};

// ------------------------------------------------------------------ S3

export const S3: SceneDef = {
  id: "S3",
  camera: (t) => {
    const s = CUES.scene("S3");
    const k = prog(t, s.start, s.end, "linear");
    const pos: Vec3 = [lerp(-6, -4, k), 9, lerp(34, 30, k)];
    return withDrift({ pos, target: [MORIAH[0] * 0.35, 18, MORIAH[2] * 0.35], fov: 24 }, t, 303, 0.08);
  },
  mood: (t) => blendMood(MOODS.night, MOODS.dawnCool, prog(t, CUES.scene("S3").start, CUES.scene("S3").start + 3.5, "inOutSine")),
  World: ({ mood }) => <DesertTerrain haze={mood.fog} />,
  post: () => ({ blurAll: 1, tilt: 1, bloom: 0.3 }),
  shadow: () => ({ center: [0, 0, 0], radius: 40 }),
};

// ------------------------------------------------------------------ S4

const DAY = 0.6; // seconds per day in the time-lapse

function dayPhase(t: number) {
  const s = CUES.scene("S4");
  const lapseEnd = CUES.days.marks[2];
  return { s, lapse: clamp((t - s.start) / (lapseEnd - s.start)), lapseEnd };
}

/** Distance along the road for the caravan leader: fast during the time-lapse, then walking pace. */
function caravanDist(t: number) {
  const { s, lapseEnd } = dayPhase(t);
  const fast = 7.5;
  const slow = 1.15;
  const d0 = 40;
  if (t <= lapseEnd) return d0 + (t - s.start) * fast;
  return d0 + (lapseEnd - s.start) * fast + (t - lapseEnd) * slow;
}

function s4People(t: number, cam: CamPose) {
  const set = desertSet();
  const lead = caravanDist(t);
  const { lapseEnd } = dayPhase(t);
  const speedUp = t < lapseEnd ? 2.4 : 1;
  const mk = (offset: number, seed: number, extra: Partial<Pose> = {}): Pose => {
    const d = lead - offset;
    const { pos, dir } = along(set.road, d);
    return {
      pos: [pos[0], set.terrain.heightAt(pos[0], pos[2]), pos[2]],
      face: faceFor(dir, cam.pos, cam.target),
      walk: phaseFromDistance(d, 1.1) * speedUp * 0.42,
      walkAmt: 1,
      t,
      seed,
      ...extra,
    };
  };
  const donkeyAt = along(set.road, lead - 4.2);
  return {
    abraham: mk(0, 11, { armFront: 0.48 }),
    isaac: mk(1.7, 23),
    servantA: mk(5.6, 31),
    servantB: mk(7.6, 37),
    donkey: {
      pos: [donkeyAt.pos[0], set.terrain.heightAt(donkeyAt.pos[0], donkeyAt.pos[2]), donkeyAt.pos[2]] as Vec3,
      heading: Math.atan2(-donkeyAt.dir[2], donkeyAt.dir[0]),
      walk: phaseFromDistance(lead - 4.2, 0.9) * speedUp * 0.42,
      walkAmt: 1,
      t,
    },
  };
}

function s4Camera(t: number): CamPose {
  const s = CUES.scene("S4");
  const set = desertSet();
  // a low tracking shot behind the caravan, looking across the plain to the ridge of Moriah
  // ("Abraham lifted up his eyes, and saw the place afar off"); a slow push-in when he sees it
  const { pos: c } = along(set.road, caravanDist(t) - 2.5);
  const cy = set.terrain.heightAt(c[0], c[2]);
  const toM = [MORIAH[0] - c[0], MORIAH[2] - c[2]];
  const L = Math.hypot(toM[0], toM[1]);
  const dir = [toM[0] / L, toM[1] / L];
  const push = smoothstep(CUES.at("b05", "abraham") - 0.3, s.end, t);
  const back = lerp(25, 21, push);
  const pos: Vec3 = [c[0] - dir[0] * back, cy + lerp(3.6, 3.9, push), c[2] - dir[1] * back];
  const far = 240;
  const pitch = (lerp(2.7, 2.1, push) * Math.PI) / 180;
  const target: Vec3 = [c[0] + dir[0] * far, pos[1] - Math.tan(pitch) * (far + back), c[2] + dir[1] * far];
  return withDrift({ pos, target, fov: lerp(25, 23.5, push) }, t, 404, 0.035);
}

function s4Mood(t: number): Mood {
  const { s, lapseEnd } = dayPhase(t);
  const p = t < lapseEnd ? (t - s.start) / DAY : 0; // 0 = noon, 0.5 = midnight, 1 = noon again
  const night = (1 - Math.cos(p * Math.PI * 2)) / 2;
  const m = blendMood({ ...MOODS.journey, fogNear: 60, fogFar: 520 }, { ...MOODS.night, fogNear: 60, fogFar: 520 }, night * 0.75);
  // the sun crosses from left to right, so shadows sweep with it
  const az = 180 + (((p + 0.25) % 1) * 2 - 1) * 70;
  return { ...m, sunAz: t < lapseEnd ? az : 150, sunEl: t < lapseEnd ? Math.max(8, Math.cos(p * Math.PI * 2) * 40) : 34 };
}

const S4World: SceneDef["World"] = ({ t, cam, mood }) => {
  const p = s4People(t, cam);
  const sun = sunOf(mood);
  const tint = figureTint(mood, 0.22);
  const { s, lapseEnd } = dayPhase(t);
  const lapse = t < lapseEnd;
  const ph = (t - s.start) / DAY;
  // sky arcs placed across the view, ~300 m out
  const fwd = [cam.target[0] - cam.pos[0], cam.target[2] - cam.pos[2]];
  const fl = Math.hypot(fwd[0], fwd[1]);
  const f = [fwd[0] / fl, fwd[1] / fl];
  const right = [-f[1], f[0]];
  const arc = (u: number, h: number): Vec3 => [
    cam.pos[0] + f[0] * 300 + right[0] * lerp(-46, 46, u),
    cam.pos[1] + Math.sin(Math.PI * u) * h - 3,
    cam.pos[2] + f[1] * 300 + right[1] * lerp(-46, 46, u),
  ];
  const sp = (((ph + 0.25) % 1) + 1) % 1; // sun visible while sp < 0.5
  const mp = (((ph - 0.25) % 1) + 1) % 1; // moon visible while mp < 0.5
  return (
    <>
      <DesertTerrain haze={mood.fog} tent={false} />
      <Stars amount={lapse ? ((1 - Math.cos(ph * Math.PI * 2)) / 2) * 0.85 : 0} />
      {lapse && sp < 0.5 ? <SkyBody kind="sun" pos={arc(sp / 0.5, 44)} size={4.5} /> : null}
      {lapse && mp < 0.5 ? <SkyBody kind="moon" pos={arc(mp / 0.5, 36)} size={3.4} /> : null}
      <Donkey pose={p.donkey} />
      <PaperPerson fig={figure(SERVANT_B)} pose={{ ...p.servantB, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={figure(SERVANT_A)} pose={{ ...p.servantA, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={figure(ISAAC)} pose={{ ...p.isaac, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={figure(ABRAHAM)} pose={{ ...p.abraham, tint }} cam={cam.pos} sun={sun} />
    </>
  );
};

export const S4: SceneDef = {
  id: "S4",
  camera: s4Camera,
  mood: s4Mood,
  World: S4World,
  anchors: () => {
    desertSet();
    return { "moriah.peak": [MORIAH_PEAK[0], MORIAH_PEAK[1], MORIAH_PEAK[2]] as Vec3 };
  },
  shadow: (t) => {
    const set = desertSet();
    const { pos } = along(set.road, caravanDist(t) - 2.5);
    return { center: [pos[0], set.terrain.heightAt(pos[0], pos[2]), pos[2]], radius: 22 };
  },
};
