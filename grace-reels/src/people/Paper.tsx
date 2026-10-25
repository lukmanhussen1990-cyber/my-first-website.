import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { Vec3 } from "../lib/math";
import { hash1, noise1 } from "../lib/random";
import { FigureParts, PartName } from "./draw";

// A paper figure standing in the 3D world.
// - The visible copy always turns to face the camera (Y billboard), can flip left/right,
//   and leans back a little so it reads well from the high diorama camera.
// - An invisible copy faces the sun, so the shadow is always the full silhouette.

export type Pose = {
  pos: Vec3; // feet
  face: 1 | -1; // 1 = facing screen-right
  walk?: number; // walk phase (radians); legs/arms swing with it
  walkAmt?: number; // 0..1
  armFront?: number; // extra rotation of the front arm (radians, + = forward/up)
  armBack?: number;
  headTilt?: number; // + = look up
  headTurn?: number; // small extra tilt noise amount
  lean?: number; // body lean (radians, + = forward)
  sit?: number; // 0..1 seated: hips drop, legs swing forward, robe folds into a lap
  scale?: number;
  t: number; // time, for breathing / blinking / sway
  seed: number;
  tint?: string;
  visible?: boolean;
};

const Z: Record<PartName, number> = {
  legBack: -0.014,
  legFront: -0.007,
  body: 0,
  beam: -0.034,
  wood: -0.03,
  armBack: -0.021,
  head: 0.009,
  headBlink: 0.0095,
  armFront: 0.017,
  staff: 0.024,
};

type Built = {
  root: THREE.Group; // positioned + billboarded
  inner: THREE.Group; // flip / tilt / bob
  joints: Partial<Record<PartName, THREE.Group>>;
  meshes: Partial<Record<PartName, THREE.Mesh>>;
  robe: THREE.BufferGeometry | null;
  robeBase: Float32Array | null;
};

const textureCache = new WeakMap<HTMLCanvasElement, THREE.CanvasTexture>();
function tex(c: HTMLCanvasElement) {
  let t = textureCache.get(c);
  if (!t) {
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    textureCache.set(c, t);
  }
  return t;
}

function build(fig: FigureParts, shadow: boolean): Built {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const joints: Built["joints"] = {};
  const meshes: Built["meshes"] = {};
  const P = fig.parts;
  const hipY = P.body!.pivot[1];
  const shoulderY = P.armFront!.pivot[1];
  const neckY = P.head!.pivot[1];
  let robe: THREE.BufferGeometry | null = null;
  let robeBase: Float32Array | null = null;

  const makeMesh = (name: PartName, segY = 1) => {
    const part = P[name]!;
    const [x0, y0, x1, y1] = part.box;
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 1, segY);
    g.translate((x0 + x1) / 2 - part.pivot[0], (y0 + y1) / 2 - part.pivot[1], Z[name]);
    const map = tex(part.canvas);
    let mesh: THREE.Mesh;
    if (shadow) {
      // draws nothing in the main pass (no colour, no depth) but casts the silhouette shadow;
      // three.js tests casters against the main camera's layers, so it must stay on layer 0
      mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, colorWrite: false, depthWrite: false }));
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5, side: THREE.DoubleSide });
      mesh.castShadow = true;
    } else {
      mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map, alphaTest: 0.04, alphaToCoverage: true, side: THREE.DoubleSide }));
      mesh.castShadow = false;
    }
    mesh.frustumCulled = false;
    meshes[name] = mesh;
    if (name === "body") {
      robe = g;
      robeBase = (g.getAttribute("position").array as Float32Array).slice();
    }
    return mesh;
  };
  const joint = (name: PartName, parent: THREE.Object3D, x: number, y: number) => {
    const j = new THREE.Group();
    j.position.set(x, y, 0);
    parent.add(j);
    joints[name] = j;
    return j;
  };

  joint("legBack", inner, -0.012, hipY).add(makeMesh("legBack"));
  joint("legFront", inner, 0.012, hipY).add(makeMesh("legFront"));
  const body = joint("body", inner, 0, hipY);
  body.add(makeMesh("body", 6));
  if (P.wood) joint("wood", body, 0, 0).add(makeMesh("wood"));
  if (P.beam) joint("beam", body, 0, 0).add(makeMesh("beam"));
  joint("armBack", body, -0.025, shoulderY - hipY).add(makeMesh("armBack"));
  const head = joint("head", body, 0, neckY - hipY);
  head.add(makeMesh("head"));
  head.add(makeMesh("headBlink"));
  joint("armFront", body, 0.02, shoulderY - hipY).add(makeMesh("armFront"));
  if (P.staff) joint("staff", body, 0.2 * (fig.height / 1.72), 0).add(makeMesh("staff"));
  return { root, inner, joints, meshes, robe, robeBase };
}

/** Blink: closed for ~0.13 s every 3-5 s (seeded). */
export function isBlinking(t: number, seed: number) {
  let bt = 0.6 + hash1(seed * 31) * 2.5;
  for (let i = 0; i < 200 && bt < t + 1; i++) {
    if (t >= bt && t < bt + 0.13) return true;
    bt += 3 + hash1(seed * 97 + i) * 2;
  }
  return false;
}

function applyPose(b: Built, fig: FigureParts, pose: Pose, faceTowards: Vec3, tiltBack: number, isShadow: boolean) {
  const { root, inner, joints, meshes } = b;
  root.visible = pose.visible !== false;
  root.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  const yaw = Math.atan2(faceTowards[0], faceTowards[2]);
  root.rotation.set(0, yaw, 0);
  const s = pose.scale ?? 1;
  const walk = pose.walk ?? 0;
  const amt = pose.walkAmt ?? 0;
  const breath = Math.sin((pose.t / 3.6) * Math.PI * 2 + pose.seed) * 0.5 + 0.5;
  inner.scale.set(pose.face * s, s * (1 + breath * 0.012), s);
  inner.rotation.set(isShadow ? 0 : -tiltBack, 0, 0);
  inner.position.y = (1 - Math.cos(walk * 2)) * 0.012 * amt;

  const swing = Math.sin(walk) * amt;
  const sit = pose.sit ?? 0;
  const hipY = fig.parts.body!.pivot[1];
  const drop = hipY * 0.52 * sit;
  joints.body!.position.y = hipY - drop;
  joints.legFront!.position.y = hipY - drop;
  joints.legBack!.position.y = hipY - drop;
  joints.legFront!.rotation.z = swing * 0.34 + sit * 0.9;
  joints.legBack!.rotation.z = -swing * 0.34 + sit * 0.82;
  joints.body!.rotation.z = -(pose.lean ?? 0) - amt * 0.035;
  joints.armFront!.rotation.z = (pose.armFront ?? -swing * 0.32) + 0.04;
  joints.armBack!.rotation.z = (pose.armBack ?? swing * 0.32) - 0.02;
  const headNoise = noise1(pose.t * 0.35, pose.seed) * (pose.headTurn ?? 0.05);
  joints.head!.rotation.z = (pose.headTilt ?? 0) + headNoise + amt * 0.03;
  if (joints.staff) joints.staff.rotation.z = -swing * 0.06 * amt;

  const blink = isBlinking(pose.t, pose.seed);
  meshes.head!.visible = !blink;
  meshes.headBlink!.visible = blink;

  // cloth sway: bend the robe's lower vertices with the walk and a slow breeze
  if (b.robe && b.robeBase) {
    const pos = b.robe.getAttribute("position") as THREE.BufferAttribute;
    const base = b.robeBase;
    const part = fig.parts.body!;
    const top = part.box[3] - part.pivot[1];
    const bottom = part.box[1] - part.pivot[1];
    const sway = Math.sin(walk + 0.6) * 0.035 * amt + noise1(pose.t * 0.5, pose.seed + 3) * 0.012;
    for (let i = 0; i < pos.count; i++) {
      const y = base[i * 3 + 1];
      const k = Math.pow((top - y) / (top - bottom), 2);
      let x = base[i * 3] - sway * k;
      let yy = y;
      if (sit > 0 && y < 0) {
        // fold the robe below the hips forward into a lap
        yy = y * (1 - 0.62 * sit);
        x += -y * 0.95 * sit;
      }
      pos.setXY(i, x, yy);
    }
    pos.needsUpdate = true;
  }
  if (!isShadow) {
    const col = new THREE.Color(pose.tint ?? "#ffffff");
    for (const m of Object.values(meshes)) (m!.material as THREE.MeshBasicMaterial).color.copy(col);
  }
}

export const PaperPerson: React.FC<{
  fig: FigureParts;
  pose: Pose;
  cam: Vec3; // camera position (billboard target)
  sun: Vec3; // sun direction (shadow proxy faces it)
  tiltBack?: number;
  castShadow?: boolean;
}> = ({ fig, pose, cam, sun, tiltBack = 0.22, castShadow = true }) => {
  const vis = useMemo(() => build(fig, false), [fig]);
  const shd = useMemo(() => (castShadow ? build(fig, true) : null), [fig, castShadow]);
  useLayoutEffect(() => {
    applyPose(vis, fig, pose, [cam[0] - pose.pos[0], 0, cam[2] - pose.pos[2]], tiltBack, false);
    if (shd) applyPose(shd, fig, pose, [sun[0], 0, sun[2]], 0, true);
  });
  useLayoutEffect(
    () => () => {
      for (const b of [vis, shd]) {
        if (!b) continue;
        for (const m of Object.values(b.meshes)) {
          m!.geometry.dispose();
          (m!.material as THREE.Material).dispose();
        }
      }
    },
    [vis, shd],
  );
  return (
    <>
      <primitive object={vis.root} />
      {shd ? <primitive object={shd.root} /> : null}
    </>
  );
};

/** World position of a point given in figure space (metres, facing +x), for labels and props. */
export function figurePoint(pose: Pose, cam: Vec3, local: [number, number], tiltBack = 0.22): Vec3 {
  const yaw = Math.atan2(cam[0] - pose.pos[0], cam[2] - pose.pos[2]);
  const s = pose.scale ?? 1;
  const x = local[0] * pose.face * s;
  const y = local[1] * s;
  // leaning back (rotation.x = -tiltBack) moves the top away from the camera (-z local)
  const yy = y * Math.cos(tiltBack);
  const zz = -y * Math.sin(tiltBack);
  // rotate (x, zz) by yaw around Y
  const wx = x * Math.cos(yaw) + zz * Math.sin(yaw);
  const wz = -x * Math.sin(yaw) + zz * Math.cos(yaw);
  return [pose.pos[0] + wx, pose.pos[1] + yy, pose.pos[2] + wz];
}
