/**
 * Colour system for Last Mile.
 *
 * Dark mode is the primary, "cinematic" look: deep navy canvas, glass cards,
 * purple → cyan accents and sunset orange highlights. Light mode keeps the same
 * accents on a soft lavender-white canvas.
 */

export type Gradient = readonly [string, string, ...string[]];

/** Raw brand palette — prefer the semantic tokens below in components. */
export const palette = {
  navy950: '#05070F',
  navy900: '#070B1A',
  navy850: '#0A1024',
  navy800: '#0E1430',
  navy700: '#151D40',
  navy600: '#1E2852',

  purple: '#7C5CFF',
  purpleLight: '#A78BFA',
  violet: '#C084FC',
  cyan: '#22D3EE',
  blue: '#3B82F6',
  sunset: '#FF8A3D',
  sunsetPink: '#FF5E8A',
  gold: '#FFC857',
  green: '#34D399',
  red: '#F87171',
  amber: '#FBBF24',
  white: '#FFFFFF',
} as const;

export interface ThemeColors {
  /** Solid app background (also used for status/navigation bars). */
  background: string;
  /** Vertical background gradient painted behind every screen. */
  backgroundGradient: Gradient;
  /** Large, very soft colour blobs drawn on top of the background gradient. */
  aurora: readonly [string, string, string];

  /** Glass card fill (translucent). */
  card: string;
  /** Opaque elevated surface (sheets, inputs, popovers). */
  surface: string;
  /** Slightly raised surface inside cards (chips, inner rows, count boxes). */
  surfaceMuted: string;
  /** Hairline border used on glass cards. */
  border: string;
  /** Brighter top-edge highlight used on glass cards. */
  borderHighlight: string;
  /** Overlay for scrims over imagery. */
  scrim: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  /** Text drawn on top of gradients / imagery (always light). */
  textOnAccent: string;

  primary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  highlight: string;
  highlightSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  danger: string;
  dangerSoft: string;

  /** Inactive track for progress bars / rings. */
  track: string;
  tabBar: string;
  shadow: string;
}

export const darkColors: ThemeColors = {
  background: palette.navy900,
  backgroundGradient: ['#0B1230', '#080D22', '#05070F'],
  aurora: ['rgba(124, 92, 255, 0.28)', 'rgba(34, 211, 238, 0.14)', 'rgba(255, 138, 61, 0.12)'],

  card: 'rgba(22, 30, 64, 0.62)',
  surface: '#111936',
  surfaceMuted: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(148, 163, 255, 0.12)',
  borderHighlight: 'rgba(255, 255, 255, 0.10)',
  scrim: 'rgba(5, 7, 15, 0.55)',

  text: '#F5F7FF',
  textSecondary: '#A9B2D6',
  textMuted: '#6E789E',
  textOnAccent: '#FFFFFF',

  primary: palette.purple,
  primarySoft: 'rgba(124, 92, 255, 0.18)',
  accent: palette.cyan,
  accentSoft: 'rgba(34, 211, 238, 0.14)',
  highlight: palette.sunset,
  highlightSoft: 'rgba(255, 138, 61, 0.16)',
  success: palette.green,
  successSoft: 'rgba(52, 211, 153, 0.16)',
  warning: palette.amber,
  danger: palette.red,
  dangerSoft: 'rgba(248, 113, 113, 0.16)',

  track: 'rgba(255, 255, 255, 0.08)',
  tabBar: 'rgba(12, 18, 42, 0.78)',
  shadow: '#000000',
};

export const lightColors: ThemeColors = {
  background: '#F4F5FF',
  backgroundGradient: ['#F7F7FF', '#EEF0FF', '#E8ECFB'],
  aurora: ['rgba(124, 92, 255, 0.16)', 'rgba(34, 211, 238, 0.12)', 'rgba(255, 138, 61, 0.12)'],

  card: 'rgba(255, 255, 255, 0.78)',
  surface: '#FFFFFF',
  surfaceMuted: 'rgba(30, 40, 90, 0.05)',
  border: 'rgba(60, 72, 140, 0.12)',
  borderHighlight: 'rgba(255, 255, 255, 0.9)',
  scrim: 'rgba(10, 14, 35, 0.45)',

  text: '#0E1330',
  textSecondary: '#4A5378',
  textMuted: '#8A92B2',
  textOnAccent: '#FFFFFF',

  primary: '#6D4AFF',
  primarySoft: 'rgba(109, 74, 255, 0.12)',
  accent: '#0891B2',
  accentSoft: 'rgba(8, 145, 178, 0.12)',
  highlight: '#F97316',
  highlightSoft: 'rgba(249, 115, 22, 0.12)',
  success: '#10B981',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  warning: '#D97706',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',

  track: 'rgba(30, 40, 90, 0.08)',
  tabBar: 'rgba(255, 255, 255, 0.82)',
  shadow: '#1B2150',
};

/** Shared gradients (identical in both modes — they sit on imagery or glass). */
export const gradients = {
  /** Primary brand gradient: purple → cyan. */
  primary: ['#7C5CFF', '#22D3EE'],
  /** Deeper purple used for CTAs. */
  violet: ['#8B5CF6', '#6D4AFF'],
  /** Sunset highlight: orange → pink. */
  sunset: ['#FF8A3D', '#FF5E8A'],
  /** Gold → orange for achievements. */
  gold: ['#FFD166', '#FF8A3D'],
  /** Aurora: purple → violet → cyan for hero rings. */
  aurora: ['#7C5CFF', '#C084FC', '#22D3EE'],
  success: ['#34D399', '#22D3EE'],
  danger: ['#F87171', '#FB7185'],
  /** Night sky used behind breathing & sleep content. */
  night: ['#1E1B4B', '#0B1020'],
  /** Dark fade used over images so overlaid text stays readable. */
  imageScrim: ['rgba(5,7,15,0)', 'rgba(5,7,15,0.35)', 'rgba(5,7,15,0.85)'],
} as const satisfies Record<string, Gradient>;

export type GradientName = keyof typeof gradients;

/**
 * Accent colours for subjects, checklist categories and feature tiles.
 * Each entry is a two-stop gradient (top-left → bottom-right) plus a solid
 * colour for text / progress fills.
 */
export const accents = {
  purple: { solid: '#8B5CF6', gradient: ['#A78BFA', '#7C3AED'] },
  blue: { solid: '#3B82F6', gradient: ['#60A5FA', '#2563EB'] },
  cyan: { solid: '#06B6D4', gradient: ['#22D3EE', '#0891B2'] },
  green: { solid: '#10B981', gradient: ['#34D399', '#059669'] },
  orange: { solid: '#F97316', gradient: ['#FDBA74', '#EA580C'] },
  pink: { solid: '#EC4899', gradient: ['#F472B6', '#DB2777'] },
  red: { solid: '#EF4444', gradient: ['#F87171', '#DC2626'] },
  amber: { solid: '#F59E0B', gradient: ['#FCD34D', '#D97706'] },
  indigo: { solid: '#6366F1', gradient: ['#818CF8', '#4F46E5'] },
} as const satisfies Record<string, { solid: string; gradient: Gradient }>;

export type AccentKey = keyof typeof accents;
export const accentKeys = Object.keys(accents) as AccentKey[];

/** Adds an alpha channel to a #RRGGBB colour. `alpha` is 0–1. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${clean}${a}`;
}
