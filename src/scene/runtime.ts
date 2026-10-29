import { Color, Vector3, type Object3D, type SpotLight } from 'three';

/**
 * Mutable per-frame state shared between scene components. It lives outside
 * React so 60 fps animation never triggers re-renders. The torch rig writes
 * it early in the frame (negative useFrame priority); the light, effects and
 * dust read it afterwards.
 */
export const runtime = {
  /** Smoothed light output 0..1 relative to the 1800 lm maximum (includes the on/off ramp). */
  output: 0,
  /** Smoothed on/off envelope 0..1 (independent of brightness), used for glows and the indicator. */
  envelope: 0,
  /** Smoothed beam half-angle (radians). */
  halfAngle: (28 / 2) * (Math.PI / 180),
  /** Smoothed beam profile. */
  hotspot: 0.5,
  spill: 0.16,
  softness: 0.42,
  rings: 0.55,
  /** Render-scaled peak intensity (arbitrary units, tuned for the scene). */
  intensity: 0,
  /** Cool-white beam colour (linear). */
  color: new Color('#eef4ff'),

  /** World-space lens centre, beam axis and the virtual apex of the volumetric cone. */
  lens: new Vector3(),
  axis: new Vector3(0, 0, -1),
  apex: new Vector3(),
  lensRadius: 0.17,

  /** The torch's spotlight once mounted (for its shadow map). */
  light: null as SpotLight | null,
  /** The pose group the interaction controller rotates. */
  torch: null as Object3D | null,
  /** Hit proxies for raycasting (cheap stand-ins for the detailed meshes). */
  hitBody: null as Object3D | null,
  hitButton: null as Object3D | null,

  /** Button press animation 0..1 and whether the pointer hovers the button. */
  press: 0,
  hoverButton: false,
  hoverBody: false,

  /** Torch orientation (radians). Interaction writes targets, the rig springs toward them. */
  pose: {
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    velocityYaw: 0,
    velocityPitch: 0,
    dragging: false,
  },
};

export type Runtime = typeof runtime;

/** Default aim: pointing left and away from the camera, slightly down toward the floor. */
export const DEFAULT_POSE = { yaw: -1.66, pitch: -0.14 };
export const PITCH_LIMIT = 1.25;
