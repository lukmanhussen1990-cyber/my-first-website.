/**
 * Keyframed orbit camera + hook sway + decaying shake impulses.
 * `cameraState(t)` is a pure function so other components (mist, lights)
 * can query the camera too.
 */
import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { CAMERA, CamKey, EVENTS, PRESSURE_RUMBLE, SHAKES } from '../timeline';
import { DEG, EASE, lerp, smoothstep, wobble } from '../lib/math';
import { HOOK_ORIGIN } from './HookCharacter';
import { HOOK } from '../timeline';
import { carOffset, CAR_ORIGIN } from './CarSet';

export type CamState = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  roll: number;
  right: THREE.Vector3;
  up: THREE.Vector3;
  forward: THREE.Vector3;
};

const resolveTarget = (k: CamKey, t: number) => {
  const v = new THREE.Vector3(...k.target);
  if (k.set === 'car') v.add(CAR_ORIGIN);
  if (k.set === 'hook') v.add(HOOK_ORIGIN);
  if (k.follow) v.add(carOffset(t));
  return v;
};

function keyPair(t: number): [CamKey, CamKey, number] {
  const ks = CAMERA;
  if (t <= ks[0].t) return [ks[0], ks[0], 0];
  for (let i = ks.length - 1; i >= 0; i--) {
    if (ks[i].t <= t) {
      const a = ks[i];
      const b = ks[Math.min(ks.length - 1, i + 1)];
      if (b === a || b.t <= a.t) return [a, a, 0];
      const p = (t - a.t) / (b.t - a.t);
      return [a, b, EASE[b.ease ?? 'inOutSine'](p)];
    }
  }
  return [ks[0], ks[0], 0];
}

export function cameraState(t: number): CamState {
  const [a, b, p] = keyPair(t);
  const target = resolveTarget(a, t).lerp(resolveTarget(b, t), p);
  let dist = lerp(a.dist, b.dist, p);
  let az = lerp(a.az, b.az, p);
  let el = lerp(a.el, b.el, p);
  const fov = lerp(a.fov, b.fov, p);
  let roll = lerp(a.roll ?? 0, b.roll ?? 0, p);

  const pos = new THREE.Vector3(
    Math.sin(az * DEG) * Math.cos(el * DEG),
    Math.sin(el * DEG),
    Math.cos(az * DEG) * Math.cos(el * DEG),
  )
    .multiplyScalar(dist)
    .add(target);

  // camera basis (before roll)
  const forward = target.clone().sub(pos).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  // apply roll to the basis
  const rq = new THREE.Quaternion().setFromAxisAngle(forward, roll * DEG);
  right.applyQuaternion(rq);
  up.applyQuaternion(rq);

  // shakes (screen-space offsets of both eye and target → whole frame jolts)
  let sx = 0;
  let sy = 0;
  let sr = 0;
  for (const s of SHAKES) {
    const dt = t - s.t;
    if (dt < 0 || dt > 2.5) continue;
    const env = s.amp * Math.exp(-s.decay * dt) * smoothstep(0, 0.02, dt);
    const w = Math.PI * 2 * s.freq * dt;
    sx += env * Math.sin(w + 0.3);
    sy += env * Math.sin(w * 1.27 + 1.1);
    sr += env * 6 * Math.sin(w * 0.83 + 2.0);
  }
  // hook: tiny nervous hand-held jitters that grow as we creep in on his face
  if (t < HOOK.cut) {
    const A = 0.003 + 0.009 * smoothstep(0, HOOK.cut, t);
    sx += A * wobble(t * 9.0, 1.3);
    sy += A * wobble(t * 11.0, 2.7);
    sr += 0.5 * wobble(t * 7.0, 4.1) * (0.5 + smoothstep(0, HOOK.cut, t));
  }
  const R = PRESSURE_RUMBLE;
  if (t > R.start && t < R.end) {
    const env = R.amp * smoothstep(R.start, R.start + 0.8, t) * (1 - smoothstep(R.end - 0.3, R.end, t));
    sx += env * Math.sin(t * 2 * Math.PI * 23);
    sy += env * Math.sin(t * 2 * Math.PI * 31 + 1);
  }
  const off = right.clone().multiplyScalar(sx).addScaledVector(up, sy);
  pos.add(off);
  target.add(off);
  return { pos, target, fov, roll: roll + sr, right, up, forward };
}

export const CameraRig: React.FC<{ t: number }> = ({ t }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const s = cameraState(t);
    camera.position.copy(s.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(s.target);
    camera.rotateZ(-s.roll * DEG);
    camera.fov = s.fov;
    camera.near = 0.05;
    camera.far = 600;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [t, camera]);
  return null;
};
