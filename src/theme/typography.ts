import { Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import type { TextStyle } from 'react-native';

/**
 * Font assets loaded once in the root layout via `useFonts(fontAssets)`.
 * Keys are the family names used in styles below.
 */
export const fontAssets = {
  'Jakarta-Regular': PlusJakartaSans_400Regular,
  'Jakarta-Medium': PlusJakartaSans_500Medium,
  'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
  'Jakarta-Bold': PlusJakartaSans_700Bold,
  'Jakarta-ExtraBold': PlusJakartaSans_800ExtraBold,
  'Caveat-SemiBold': Caveat_600SemiBold,
  'Caveat-Bold': Caveat_700Bold,
} as const;

export const fonts = {
  regular: 'Jakarta-Regular',
  medium: 'Jakarta-Medium',
  semibold: 'Jakarta-SemiBold',
  bold: 'Jakarta-Bold',
  extrabold: 'Jakarta-ExtraBold',
  /** Handwritten accent used for emotional hero copy ("Good things are coming…"). */
  script: 'Caveat-SemiBold',
  scriptBold: 'Caveat-Bold',
} as const;

/**
 * Text variants. Custom font families already encode weight, so never combine
 * them with `fontWeight` (Android would fall back to the system font).
 */
export const textVariants = {
  /** Huge countdown numerals. */
  hero: { fontFamily: fonts.extrabold, fontSize: 52, lineHeight: 58, letterSpacing: -1.5 },
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  /** Tabular numerals for counters (pair with `fontVariant: ['tabular-nums']`). */
  number: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
  script: { fontFamily: fonts.script, fontSize: 26, lineHeight: 30 },
  scriptLg: { fontFamily: fonts.scriptBold, fontSize: 34, lineHeight: 38 },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
