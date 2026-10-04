export type BreathPhaseKind = 'inhale' | 'hold' | 'exhale' | 'rest';

export interface BreathPhase {
  kind: BreathPhaseKind;
  label: string;
  seconds: number;
}

export type BreathingPatternId = 'box' | 'relax' | 'calm';

export interface BreathingPattern {
  id: BreathingPatternId;
  name: string;
  /** Short timing summary for chips, e.g. "4-4-4-4". */
  rhythm: string;
  description: string;
  phases: BreathPhase[];
}

const inhale = (seconds: number): BreathPhase => ({ kind: 'inhale', label: 'Breathe In', seconds });
const hold = (seconds: number): BreathPhase => ({ kind: 'hold', label: 'Hold', seconds });
const exhale = (seconds: number): BreathPhase => ({ kind: 'exhale', label: 'Breathe Out', seconds });

export const breathingPatterns: readonly BreathingPattern[] = [
  {
    id: 'box',
    name: 'Box Breathing',
    rhythm: '4-4-4-4',
    description: 'Four equal counts — in, hold, out, hold. Steadies the nerves right before a paper.',
    phases: [inhale(4), hold(4), exhale(4), hold(4)],
  },
  {
    id: 'relax',
    name: 'Relax 4-7-8',
    rhythm: '4-7-8',
    description: 'A long, slow exhale that tells your body it is safe to switch off. Ideal before sleep.',
    phases: [inhale(4), hold(7), exhale(8)],
  },
  {
    id: 'calm',
    name: 'Calm Breathing',
    rhythm: '4-6',
    description: 'About six easy breaths a minute, exhale longer than inhale, to settle a racing mind.',
    phases: [inhale(4), exhale(6)],
  },
];

export const DEFAULT_BREATHING_PATTERN: BreathingPatternId = 'box';

export const breathingPatternById = Object.fromEntries(
  breathingPatterns.map((pattern) => [pattern.id, pattern]),
) as Record<BreathingPatternId, BreathingPattern>;

/** Length of one full cycle in seconds. */
export function cycleSeconds(pattern: BreathingPattern): number {
  return pattern.phases.reduce((sum, phase) => sum + phase.seconds, 0);
}
