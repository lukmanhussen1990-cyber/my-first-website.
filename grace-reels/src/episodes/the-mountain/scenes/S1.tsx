import { useMemo } from "react";
import { CamPose } from "../../../lib/camera";
import { prog, Vec3 } from "../../../lib/math";
import { blendMood, Mood, MOODS } from "../../../lib/moods";
import { ABRAHAM, figure, ISAAC } from "../../../people/cast";
import { figurePoint, PaperPerson, Pose } from "../../../people/Paper";
import { lambert, rockGeometry } from "../../../world/models";
import { Scatter } from "../../../world/Scatter";
import { SceneDef } from "../../../world/Stage";
import { MountainTerrain, mountainSet } from "../sets/mountain";
import { figureTint, orbitCam, sunOf, walker } from "./common";

// S1 HOOK: dawn on the mountain path. Abraham and Isaac climb; rocks pass close to the lens;
// cool blue dawn turns gold. (Also used for the very last frames, so the reel loops.)

const T0 = -1.0; // starts walking a little before frame 0 so frame 0 is already moving
const T1 = 7.2;

function people(t: number, cam: CamPose) {
  const set = mountainSet();
  const s0 = set.path.lengths[8] - 1.5;
  const ground = set.terrain.heightAt;
  const ab = walker(set.path, t, { s0: s0 + 1.7, start: T0 - 1, stop: 40, speed: 0.82, cam, seed: 11, ground });
  const is = walker(set.path, t, { s0, start: T0 - 1, stop: 40, speed: 0.82, cam, seed: 23, ground, stride: 1.0 });
  const abraham: Pose = { ...ab.pose, armFront: 0.48, tint: undefined };
  const isaac: Pose = { ...is.pose, armFront: -0.25 - Math.sin(is.pose.walk ?? 0) * 0.1, headTilt: 0.04 };
  return { abraham, isaac };
}

function camera(t: number): CamPose {
  const set = mountainSet();
  const at = (d: number): Vec3 => {
    const k = Math.min(set.path.total, d);
    let i = 1;
    while (i < set.path.lengths.length - 1 && set.path.lengths[i] < k) i++;
    const a = set.path.pts[i - 1];
    const b = set.path.pts[i];
    const f = (k - set.path.lengths[i - 1]) / (set.path.lengths[i] - set.path.lengths[i - 1]);
    const x = a[0] + (b[0] - a[0]) * f;
    const z = a[2] + (b[2] - a[2]) * f;
    return [x, set.terrain.heightAt(x, z) + 1.55, z];
  };
  // follow the pair (their midpoint + a little lead), aimed above them so they sit low under the title
  const mid0 = set.path.lengths[8] - 1.5 + 0.85 + 0.82 * (T0 + 1) + 0.5;
  const mid1 = set.path.lengths[8] - 1.5 + 0.85 + 0.82 * (T1 + 1) + 0.5;
  return orbitCam(t, T0, T1, at(mid0), at(mid1), { r: 12.5, az: 6, el: 28, fov: 27 }, { r: 19, az: 24, el: 38, fov: 25 }, 101, "linear");
}

function mood(t: number): Mood {
  const m = blendMood(MOODS.dawnCool, MOODS.dawnGold, prog(t, 0.2, 6.2, "inOutSine"));
  return { ...m, sunAz: 70, sunEl: 19 + prog(t, 0, 7, "linear") * 5, fogNear: 22, fogFar: 125 };
}

const World: SceneDef["World"] = ({ t, cam, mood: m }) => {
  const { abraham, isaac } = people(t, cam);
  const sun = sunOf(m);
  const tint = figureTint(m, 0.2);
  const ab = figure(ABRAHAM);
  const is = figure(ISAAC);
  const mat = useMemo(() => lambert(), []);
  const rockGeo = useMemo(() => rockGeometry(31, "#8a7b69"), []);
  // big rocks just in front of the lens at the lower corners; the dolly carries them past the camera
  const fg = useMemo(() => {
    const set = mountainSet();
    const at = (tt: number, ahead: number, side: number, s: number, rot: number) => {
      const c = camera(tt);
      const fx = c.target[0] - c.pos[0];
      const fz = c.target[2] - c.pos[2];
      const L = Math.hypot(fx, fz);
      const f = [fx / L, fz / L];
      const r = [-f[1], f[0]];
      const x = c.pos[0] + f[0] * ahead + r[0] * side;
      const z = c.pos[2] + f[1] * ahead + r[1] * side;
      return { pos: [x, set.terrain.heightAt(x, z) - s * 0.25, z] as [number, number, number], rotY: rot, scale: [s * 1.3, s, s * 1.1] as [number, number, number] };
    };
    return [at(-0.5, 6.0, -2.6, 1.1, 0.4), at(0.8, 7.2, 2.9, 1.3, 1.9), at(3.4, 6.5, -2.2, 0.9, 3.1), at(5.5, 7.4, 2.6, 1.2, 4.4)];
  }, []);
  return (
    <>
      <MountainTerrain />
      <Scatter geometry={rockGeo} material={mat} items={fg} />
      <PaperPerson fig={is} pose={{ ...isaac, tint }} cam={cam.pos} sun={sun} />
      <PaperPerson fig={ab} pose={{ ...abraham, tint }} cam={cam.pos} sun={sun} />
    </>
  );
};

export const S1: SceneDef = {
  id: "S1",
  camera,
  mood,
  World,
  anchors: (t) => {
    const cam = camera(t);
    const { abraham, isaac } = people(t, cam);
    return {
      "abraham.head": figurePoint(abraham, cam.pos, figure(ABRAHAM).anchors.head),
      "isaac.head": figurePoint(isaac, cam.pos, figure(ISAAC).anchors.head),
    };
  },
  shadow: (t) => ({ center: camera(t).target, radius: 22 }),
};
