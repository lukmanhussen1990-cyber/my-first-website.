import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { radii, spacing, useTheme, withAlpha, type ThemeColors } from '@/theme';
import type { IconName } from '@/types';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'muted' | 'sunset';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  /** `sm` for dense rows, `md` (default) for headers and cards. */
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

function toneColors(colors: ThemeColors, tone: BadgeTone): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: colors.successSoft, fg: colors.success };
    case 'warning':
      // No `warningSoft` token — derive it the same way as the other soft tints.
      return { bg: withAlpha(colors.warning, 0.16), fg: colors.warning };
    case 'danger':
      return { bg: colors.dangerSoft, fg: colors.danger };
    case 'muted':
      return { bg: colors.surfaceMuted, fg: colors.textSecondary };
    case 'sunset':
      return { bg: colors.highlightSoft, fg: colors.highlight };
    default:
      return { bg: colors.primarySoft, fg: colors.primary };
  }
}

/** Small tinted status pill, e.g. "3 days left" or "Offline mode". */
export function Badge({ label, tone = 'primary', icon, size = 'md', style }: BadgeProps) {
  const { colors } = useTheme();
  const { bg, fg } = toneColors(colors, tone);
  const small = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        small ? styles.sm : styles.md,
        { backgroundColor: bg },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 12 : 14} color={fg} /> : null}
      <AppText variant="caption" color={fg} numberOfLines={1} style={small ? styles.smText : null}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
  },
  md: { gap: spacing.xs, height: 26, paddingHorizontal: spacing.md - 2 },
  sm: { gap: 3, height: 20, paddingHorizontal: spacing.sm },
  smText: { fontSize: 11, lineHeight: 14 },
});
