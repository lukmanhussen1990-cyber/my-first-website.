import { useMemo } from "react";
import { CamPose, orbit, withDrift } from "../../../lib/camera";
import { lerp, prog, smoothstep, Vec3 } from "../../../lib/math";
import { blendMood, Mood, MOODS } from "../../../lib/moods";
import { hash1, rngFrom } from "../../../lib/random";
import { crowdSpecs, figure } from "../../../people/cast";
import { faceFor, phaseFromDistance, walkAmount, walkDistance } from "../../../people/motion";
import { PaperPerson, Pose } from "../../../people/Paper";
import { GoldDust, LightBeam } from "../../../world/props";
import { SceneDef } from "../../../world/Stage";
import { CROSS, GolgothaTerrain, golgothaSet } from "../sets/golgotha";
import { CUES } from "../timing";
import { figureTint, sunOf } from "./common";

// S10: no ram, no stopping light: a cross on a hill under a dark sky (the cross stands empty;
// nothing violent is shown). S11: light breaks through the clouds onto the cross, warm glory gold,
// and people come and gather in the light.

const g = (x: number, z: number) => golgothaSet().terrain.heightAt(x, z);
const CROSS_TOP = (): Vec3 => [CROSS[0], g(CROSS[0], CROSS[2]) + 3.2, CROSS[2]];

function camera(t: number): CamPose {
  const s10 = CUES.scene("S10");
  const s11 = CUES.scene("S11");
  const base: Vec3 = [0, g(0, 0) + 1.6, 1.5];
  if (t < s11.start) {
    // slow pull-back from the cross
    const k = prog(t, s10.start, s10.end + 1.5, "outCubic");
    return withDrift({ pos: orbit(base, lerp(15, 34, k), lerp(-8, 6, k), lerp(26, 33, k)), target: base, fov: 26 }, t, 1010, 0.05);
  }
  const k = prog(t, s11.start, s11.end, "inOutSine");
  const target: Vec3 = [0, lerp(base[1], base[1] - 1.2, k), lerp(1.5, 4, k)];
  return withDrift({ pos: orbit(target, lerp(30, 23, k), lerp(6.5, 12, k), lerp(33, 38, k)), target, fov: 26 }, t, 1111, 0.05);
}

/** A soft, single thunder flash (no strobing). */
function flash(t: number) {
  const f = (t0: number, w: number) => Math.exp(-Math.pow((t - t0) / w, 2));
  return f(CUES.scene("S10").start + 0.12, 0.1) * 0.8 + f(CUES.scene("S10").start + 2.1, 0.14) * 0.35;
}

function mood(t: number): Mood {
  const dark: Mood = { ...MOODS.golgotha, sunAz: -30, sunEl: 28, fogNear: 25, fogFar: 150 };
  let m = blendMood(dark, { ...dark, exposure: dark.exposure + 0.55, skyTop: "#8a93a3", skyHorizon: "#b9c0c9" }, flash(t));
  const light = smoothstep(CUES.lightBreak.start, CUES.lightBreak.start + 2.6, t);
  m = blendMood(m, { ...MOODS.lamb, sunAz: 20, sunEl: 52, fogNear: 30, fogFar: 170 }, light);
  return m;
}

type Walker = { pose: Pose };
function crowd(t: number, cam: CamPose): Walker[] {
  const s11 = CUES.scene("S11");
  const r = rngFrom(64);
  const out: Walker[] = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    // destination: an arc in front of the cross, facing it
    const a = lerp(-1.05, 1.05, i / (n - 1)) + r.range(-0.05, 0.05);
    const rr = 5.2 + (i % 3) * 1.3 + r.range(-0.3, 0.3);
    const dest: Vec3 = [Math.sin(a) * rr, 0, 1.2 + Math.cos(a) * rr * 0.75];
    const side = Math.sign(dest[0] || 1);
    const start: Vec3 = [dest[0] + side * r.range(11, 17), 0, dest[2] + r.range(3, 9)];
    const dx = dest[0] - start[0];
    const dz = dest[2] - start[2];
    const L = Math.hypot(dx, dz);
    const t0 = s11.start + 0.4 + hash1(i * 13 + 5) * 2.2;
    const speed = L / r.range(3.2, 4.4);
    const d = walkDistance(t, t0, t0 + L / speed + 0.6, speed, 0.5);
    const k = Math.min(1, d / L);
    const x = start[0] + dx * k;
    const z = start[2] + dz * k;
    const moving = walkAmount(t, t0, t0 + L / speed + 0.6, 0.5);
    const dir: Vec3 = [dx / L, 0, dz / L];
    // once arrived, everyone turns towards the cross
    const toCross: Vec3 = [CROSS[0] - x, 0, CROSS[2] - z];
    const face = moving > 0.05 ? faceFor(dir, cam.pos, cam.target) : faceFor(toCross, cam.pos, cam.target);
    out.push({
      pose: { pos: [x, g(x, z), z], face, walk: phaseFromDistance(d, 1.0), walkAmt: moving, t, seed: 100 + i, headTilt: moving > 0.05 ? 0 : 0.18 },
    });
  }
  return out;
}

const World: SceneDef["World"] = ({ t, cam, mood: m }) => {
  const specs = useMemo(() => crowdSpecs(18, 33), []);
  const figs = useMemo(() => specs.map((s) => figure(s, 420)), [specs]);
  const light = smoothstep(CUES.lightBreak.start, CUES.lightBreak.start + 2.0, t);
  const inS11 = t >= CUES.scene("S11").start;
  const people = inS11 ? crowd(t, cam) : [];
  const sun = sunOf(m);
  const tint = figureTint(m, 0.2, 1.0);
  const top = CROSS_TOP();
  return (
    <>
      <GolgothaTerrain cloudShift={light * 26} cloudTint={light > 0.5 ? "#f3e2c4" : "#8e949c"} />
      <LightBeam pos={[CROSS[0], g(0, 0) - 0.2, CROSS[2]]} strength={light * 0.9} radius={3.2} height={46} color="#ffe6b5" />
      <GoldDust center={[0, g(0, 0), 0.5]} radius={4} height={9} t={t} amount={light} count={170} seed={8} />
      {people.map((w, i) => (
        <PaperPerson key={i} fig={figs[i]} pose={{ ...w.pose, tint }} cam={cam.pos} sun={sun} />
      ))}
      <mesh position={top} visible={false}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
      </mesh>
    </>
  );
};

export const S10: SceneDef = {
  id: "S10",
  camera,
  mood,
  World,
  anchors: () => ({ "cross.top": CROSS_TOP() }),
  shadow: () => ({ center: [0, g(0, 0), 3], radius: 24 }),
};
export const S11: SceneDef = { ...S10, id: "S11" };
