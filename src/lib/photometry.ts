/**
 * Photometric + electrical model of the NYXEN TX-1.
 *
 * Every number shown in the UI (lumens, candela, throw, runtime) comes from
 * here. The renderer reads the same values, so the light you see and the
 * figures you read stay consistent.
 */

export const MAX_LUMENS = 1800;
/** Fraction of LED flux that leaves the head through the lens. */
const OPTICAL_EFFICIENCY = 0.86;
/** Share of emitted flux that the reflector shapes into hotspot + corona. */
const BEAM_FRACTION = 0.62;

export const BEAM_MIN_DEG = 6;
export const BEAM_MAX_DEG = 70;

/** 21700 Li-ion cell: 5000 mAh × 3.6 V nominal. */
export const BATTERY_WH = 18;
/** Below this charge the driver steps output down to protect the cell. */
export const LOW_VOLTAGE_THRESHOLD = 0.08;
export const LOW_VOLTAGE_OUTPUT_CAP = 0.28;

export type BeamMode = 'focused' | 'standard' | 'wide';

export interface BeamProfile {
  id: BeamMode;
  label: string;
  /** Default full cone angle (degrees) that the mode snaps to. */
  defaultAngle: number;
  /** Hotspot half-angle as a fraction of the beam half-angle. */
  hotspot: number;
  /** Relative brightness of the corona/spill around the hotspot. */
  spill: number;
  /** 0 = crisp beam edge, 1 = very soft flood edge. */
  softness: number;
  /** Visible "reflector rings" in the beam pattern. */
  rings: number;
}

export const BEAM_PROFILES: Record<BeamMode, BeamProfile> = {
  focused: { id: 'focused', label: 'Focused', defaultAngle: 12, hotspot: 0.46, spill: 0.07, softness: 0.18, rings: 0.9 },
  standard: { id: 'standard', label: 'Standard', defaultAngle: 28, hotspot: 0.5, spill: 0.16, softness: 0.42, rings: 0.55 },
  wide: { id: 'wide', label: 'Wide', defaultAngle: 56, hotspot: 0.68, spill: 0.34, softness: 0.78, rings: 0.25 },
};

export const BEAM_MODES: BeamMode[] = ['focused', 'standard', 'wide'];

const DEG = Math.PI / 180;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Solid angle (sr) of a cone with the given half-angle (radians). */
export function coneSolidAngle(halfAngle: number): number {
  return 2 * Math.PI * (1 - Math.cos(halfAngle));
}

/** Perceptual brightness curve: slider % → fraction of max flux. */
export function outputFraction(brightness: number): number {
  const b = clamp01(brightness);
  return b * b;
}

/** Output cap applied by the driver when the battery is nearly flat. */
export function batteryOutputCap(battery: number): number {
  if (battery <= 0) return 0;
  if (battery >= LOW_VOLTAGE_THRESHOLD) return 1;
  const t = battery / LOW_VOLTAGE_THRESHOLD;
  return LOW_VOLTAGE_OUTPUT_CAP + (1 - LOW_VOLTAGE_OUTPUT_CAP) * 0.35 * t;
}

export function emittedLumens(brightness: number, battery: number): number {
  return MAX_LUMENS * Math.min(outputFraction(brightness), batteryOutputCap(battery));
}

/**
 * Effective solid angle of the shaped beam, weighting the spill region by its
 * relative intensity. Peak candela = beam flux / effective solid angle.
 */
export function effectiveSolidAngle(fullAngleDeg: number, profile: BeamProfile): number {
  const half = (fullAngleDeg / 2) * DEG;
  const hot = half * profile.hotspot;
  const hotFalloff = Math.min(half, hot * (1 + 0.6 * profile.softness));
  const omegaHot = coneSolidAngle(hot);
  const omegaFalloff = coneSolidAngle(hotFalloff);
  const omegaAll = coneSolidAngle(half);
  // Hotspot at full weight, its soft shoulder at ~half weight, spill at its own level.
  return omegaHot + 0.5 * (1 - profile.spill) * (omegaFalloff - omegaHot) + profile.spill * (omegaAll - omegaHot);
}

export function peakCandela(lumens: number, fullAngleDeg: number, profile: BeamProfile): number {
  return (lumens * OPTICAL_EFFICIENCY * BEAM_FRACTION) / effectiveSolidAngle(fullAngleDeg, profile);
}

/** ANSI/PLATO FL1 throw: distance (m) at which illuminance drops to 0.25 lx. */
export function throwMeters(candela: number): number {
  return 2 * Math.sqrt(candela);
}

/** Electrical draw (W) for a given flux, including LED droop and driver losses. */
export function powerDrawWatts(lumens: number): number {
  if (lumens <= 0) return 0.02; // driver + indicator standby while switched on
  const efficacy = 165 - 55 * (lumens / MAX_LUMENS); // lm/W, falls at high drive
  return lumens / efficacy / 0.9 + 0.02;
}

/** Remaining runtime in seconds at the current draw. */
export function runtimeSeconds(battery: number, lumens: number): number {
  const watts = powerDrawWatts(lumens);
  return ((battery * BATTERY_WH) / watts) * 3600;
}

export function formatRuntime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds > 99 * 3600) return '> 99 h';
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, '0')} m`;
}

export function formatCandela(cd: number): string {
  if (cd >= 1000) return `${(cd / 1000).toFixed(cd >= 100000 ? 0 : 1)}k cd`;
  return `${Math.round(cd)} cd`;
}

/** Closest named mode for a beam angle; used to describe custom angles. */
export function nearestMode(angleDeg: number): BeamMode {
  let best: BeamMode = 'standard';
  let bestDist = Infinity;
  for (const id of BEAM_MODES) {
    const d = Math.abs(Math.log(angleDeg / BEAM_PROFILES[id].defaultAngle));
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}
