import { Text, type TextProps, type TextStyle } from 'react-native';

import { textVariants, useTheme, type TextVariant, type ThemeColors } from '@/theme';

/** Any colour token name, or a raw colour string. */
export type TextColor = keyof ThemeColors | (string & {});

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  /** Theme token (e.g. `textSecondary`, `primary`) or a raw colour. Defaults to `text`. */
  color?: TextColor;
  align?: TextStyle['textAlign'];
  /** Use tabular numerals so ticking counters don't jitter. */
  tabular?: boolean;
}

/**
 * Themed text. All copy in the app goes through this component so fonts,
 * sizes and colours stay consistent across light and dark mode.
 */
export function AppText({
  variant = 'body',
  color = 'text',
  align,
  tabular,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const resolved = color in colors ? (colors[color as keyof ThemeColors] as string) : color;
  return (
    <Text
      {...rest}
      style={[
        textVariants[variant],
        { color: resolved },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
