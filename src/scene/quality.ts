export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: QualityTier;
  /** Upper bound for the device pixel ratio. */
  maxDpr: number;
  /** MSAA samples for the HDR scene buffer (0 = off). */
  msaa: number;
  /** Ray-march steps across the beam for volumetric scattering. */
  beamSteps: number;
  shadowMapSize: number;
  dust: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { tier: 'high', maxDpr: 2, msaa: 4, beamSteps: 36, shadowMapSize: 2048, dust: 2600 },
  medium: { tier: 'medium', maxDpr: 1.5, msaa: 2, beamSteps: 24, shadowMapSize: 1024, dust: 1700 },
  low: { tier: 'low', maxDpr: 1, msaa: 0, beamSteps: 14, shadowMapSize: 1024, dust: 900 },
};

export const TIERS: QualityTier[] = ['low', 'medium', 'high'];

/** A tier pinned with ?q=low|medium|high (disables adaptive switching). */
export function forcedTier(): QualityTier | null {
  if (typeof window === 'undefined') return null;
  const forced = new URLSearchParams(window.location.search).get('q');
  return forced === 'low' || forced === 'medium' || forced === 'high' ? forced : null;
}

/** Conservative first guess; the PerformanceMonitor refines it from real frame times. */
export function initialTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium';
  const forced = forcedTier();
  if (forced) return forced;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const minSide = Math.min(window.screen?.width ?? 1280, window.screen?.height ?? 800);
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || minSide < 600) return cores >= 8 ? 'medium' : 'low';
  return cores >= 4 ? 'high' : 'medium';
}
