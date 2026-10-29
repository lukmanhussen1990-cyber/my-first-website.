/**
 * Master dimensions of the NYXEN TX-1, in scene units (1 unit ≈ 85 mm).
 * Lathe space: the torch axis is +Y, the tail sits at y = 0 and the
 * crenellated bezel at the front. After the model is laid down the axis
 * becomes +Z (the beam direction).
 */
const DEG = Math.PI / 180;

export const SPEC = {
  /** Rotation pivot along the axis (roughly the centre of mass). */
  pivot: 0.96,

  bodyR: 0.1385,
  knurl: { y0: 0.3355, y1: 0.8245, radius: 0.1282, depth: 0.0088, count: 36, flat: 0.15 },

  headR: 0.19,
  finR: 0.205,
  bezel: { outer: 0.2125, inner: 0.1785, face: 1.6995, teeth: 6, toothHeight: 0.022, toothInner: 0.1805 },

  lens: { y: 1.6905, radius: 0.1785 },
  reflector: { mouthY: 1.6835, mouthR: 0.1695, baseR: 0.0305, focal: 0.038 },

  led: { pedestalY: 1.515, packageSize: 0.034, packageHeight: 0.0065, dieSize: 0.0105, dieGap: 0.0012, domeR: 0.0165 },

  switch: { y: 1.275, phi: 118 * DEG, bossR: 0.05, travel: 0.0045 },

  clip: { phi: 197 * DEG, thickness: 0.0105 },

  engraving: { y0: 0.858, y1: 1.034, halfWidth: 0.034 },
} as const;

/** Lathe-space front of the light (tips of the bezel teeth). */
export const FRONT_Y = SPEC.bezel.face + SPEC.bezel.toothHeight;

/** Torch-local (after lay-down) z of the lens surface. */
export const LENS_Z = SPEC.lens.y - SPEC.pivot;

/** Convert a lathe-space point (r, y, φ) into torch-local coordinates. */
export function latheToLocal(r: number, y: number, phi: number): [number, number, number] {
  // Lathe vertex = (r sinφ, y, r cosφ); lay-down rotation (+90° about X) maps (x, y, z) → (x, −z, y).
  return [r * Math.sin(phi), -r * Math.cos(phi), y - SPEC.pivot];
}
