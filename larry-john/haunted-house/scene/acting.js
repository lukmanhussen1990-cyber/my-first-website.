// Reusable acting moves: every function poses a character for a given local time, statelessly.
import * as THREE from 'three';
import { Character, POSES, ZERO_POSE, mergePose, blendPose } from '../../engine/toon/rig.js';
import { clamp, smooth, easeOutBack, spring, wobble, lerp, track, easeInOut, easeOutCubic } from '../../engine/toon/anim.js';

export const P = (over = {}) => mergePose(ZERO_POSE, over);
export const pose = (name, over = {}) => mergePose(mergePose(ZERO_POSE, POSES[name] || {}), over);

// place a character on the ground facing a world point
export function place(ch, pos, faceTo = null, rotY = null) {
  ch.visible = true;
  ch.position.set(pos[0], pos[1] ?? 0, pos[2]);
  if (rotY !== null) ch.rotation.y = rotY;
  else if (faceTo) ch.rotation.y = Math.atan2(faceTo[0] - pos[0], faceTo[2] - pos[2]);
  return ch;
}

// walk from a to b over [t0, t1]; returns the walk pose fragment (or idle stand after arrival)
export function walk(ch, a, b, t, t0, t1, { stride = 0.42, run = false, faceTravel = true, extra = {} } = {}) {
  const u = clamp((t - t0) / (t1 - t0));
  const p = new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), u);
  ch.position.copy(p); ch.visible = true;
  if (faceTravel) ch.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2]);
  const dist = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const moving = t > t0 && t < t1;
  const phase = (u * dist) / (stride * 2);
  const amt = moving ? Math.min(1, Math.min(t - t0, t1 - t) / 0.18) : 0;
  return mergePose(P(extra), Character.walk(phase, amt, run));
}

// tired facepalm: hand comes up to the face, head drops, slow shake
export function facepalm(ch, t, { start = 0.0, sigh = true } = {}) {
  const k = easeOutBack(clamp((t - start) / 0.22), 1.2);
  const p = blendPose(P(), pose('facepalm'), k);
  p.head.turn = Math.sin((t - start) * 7) * 6 * clamp((t - start - 0.25) / 0.2);
  if (sigh) p.spine.fwd += Math.sin(clamp((t - start) / 0.6) * Math.PI) * 4;
  ch.applyPose(p);
  ch.setFace('facepalm');
  return p;
}

// excited little hop (anticipation squash → stretch → land squash)
export function hop(t, t0, height = 0.25, dur = 0.45) {
  const u = (t - t0) / dur;
  if (u < -0.25 || u > 1.35) return { y: 0, squash: 1 };
  if (u < 0) return { y: 0, squash: 1 - 0.18 * Math.sin(((u + 0.25) / 0.25) * Math.PI / 2) };
  if (u <= 1) return { y: Math.sin(u * Math.PI) * height, squash: 1 + 0.15 * Math.sin(u * Math.PI) * (1 - u) };
  return { y: 0, squash: 1 - 0.2 * Math.sin(((u - 1) / 0.35) * Math.PI) };
}

// pop-in scale with overshoot (objects appearing)
export function popScale(t, t0, dur = 0.35) {
  if (t <= t0) return 0.0001;
  return Math.max(0.0001, spring((t - t0) / dur * 0.55, 1.5, 0.3));
}

// chewing: mouth alternates, cheeks bob
export function chewFace(t) { return Math.sin(t * 18) > 0 ? { mouth: 'chew', mouthOpen: 0.4 } : { mouth: 'chew', mouthOpen: 0.1 }; }

export { smooth, clamp, lerp, track, easeOutBack, spring, wobble, easeInOut, easeOutCubic, mergePose, blendPose };
