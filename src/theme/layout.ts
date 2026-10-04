import { Platform, type ViewStyle } from 'react-native';

/** 4-pt spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const;

/** Horizontal page gutter used by every screen. */
export const SCREEN_GUTTER = spacing.xl;

/** Height of the floating tab bar (excluding the bottom safe-area inset). */
export const TAB_BAR_HEIGHT = 68;

/** Extra bottom padding a tab screen needs so content clears the floating tab bar. */
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + spacing.xxxl;

/** Max content width so the layout stays phone-shaped on tablets / web. */
export const MAX_CONTENT_WIDTH = 560;

type Elevation = 'none' | 'sm' | 'md' | 'lg' | 'glow';

/**
 * Cross-platform shadows. `color` lets glow shadows pick up an accent colour.
 */
export function shadow(level: Elevation, color = '#000000'): ViewStyle {
  if (level === 'none') return {};
  const presets = {
    sm: { opacity: 0.18, radius: 8, y: 4, elevation: 3 },
    md: { opacity: 0.24, radius: 16, y: 8, elevation: 6 },
    lg: { opacity: 0.32, radius: 28, y: 14, elevation: 12 },
    glow: { opacity: 0.55, radius: 22, y: 8, elevation: 10 },
  } as const;
  const p = presets[level];
  if (Platform.OS === 'web') {
    return { boxShadow: `0px ${p.y}px ${p.radius}px ${hexToRgba(color, p.opacity)}` } as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOpacity: p.opacity,
    shadowRadius: p.radius,
    shadowOffset: { width: 0, height: p.y },
    elevation: p.elevation,
  };
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Standard animation timings (ms). */
export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  stagger: 60,
  spring: { damping: 16, stiffness: 180, mass: 0.9 },
  springSoft: { damping: 20, stiffness: 120, mass: 1 },
} as const;
