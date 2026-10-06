import { getSettings } from '../state/settings';

export type Haptic = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<Haptic, number | number[]> = {
  light: 8,
  medium: 16,
  heavy: 32,
  success: [12, 40, 18],
  warning: [24, 60, 24],
  error: [40, 50, 40, 50, 60],
};

/** Vibrate (Android/Chrome; silently ignored where unsupported, e.g. iOS Safari). */
export function haptic(kind: Haptic = 'light'): void {
  if (!getSettings().haptics) return;
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    /* unsupported */
  }
}
