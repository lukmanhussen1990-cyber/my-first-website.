import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme, type ThemeColors } from '@/theme';
import type { IconName } from '@/types';

/** Any colour token name, or a raw colour string. */
export type IconColor = keyof ThemeColors | (string & {});

export interface IconProps
  extends Omit<ComponentProps<typeof MaterialCommunityIcons>, 'name' | 'size' | 'color'> {
  name: IconName;
  size?: number;
  /** Theme token (e.g. `textSecondary`, `primary`) or a raw colour. Defaults to `text`. */
  color?: IconColor;
}

/** Resolves a theme token name to its colour, passing raw colours through. */
export function resolveColor(colors: ThemeColors, color: IconColor): string {
  return color in colors ? (colors[color as keyof ThemeColors] as string) : color;
}

/**
 * MaterialCommunityIcons wrapper — the only icon set used in the app. Icons are
 * decorative by default (hidden from screen readers); label the pressable that
 * contains them instead.
 */
export function Icon({ name, size = 22, color = 'text', ...rest }: IconProps) {
  const { colors } = useTheme();
  return (
    <MaterialCommunityIcons
      accessibilityElementsHidden
      importantForAccessibility="no"
      {...rest}
      name={name}
      size={size}
      color={resolveColor(colors, color)}
    />
  );
}
