import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, spacing, useTheme, type ThemeColors } from '@/theme';
import type { IconName } from '@/types';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type ChipTone = 'default' | 'primary' | 'sunset' | 'success';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: ChipTone;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

function toneColors(colors: ThemeColors, tone: ChipTone): { solid: string; soft: string } {
  switch (tone) {
    case 'sunset':
      return { solid: colors.highlight, soft: colors.highlightSoft };
    case 'success':
      return { solid: colors.success, soft: colors.successSoft };
    default:
      return { solid: colors.primary, soft: colors.primarySoft };
  }
}

/**
 * Pill used for quick prompts and filters. Unselected chips are neutral glass
 * (or softly tinted for a non-default tone); selected chips fill with the tone.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  tone = 'default',
  accessibilityHint,
  style,
}: ChipProps) {
  const { colors } = useTheme();
  const { solid, soft } = toneColors(colors, tone);

  const surface: ViewStyle = selected
    ? { backgroundColor: solid, borderColor: solid }
    : tone === 'default'
      ? { backgroundColor: colors.surfaceMuted, borderColor: colors.border }
      : { backgroundColor: soft, borderColor: soft };
  const fg = selected ? colors.textOnAccent : tone === 'default' ? colors.textSecondary : solid;

  const content = (
    <>
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <AppText variant="label" color={fg} numberOfLines={1}>
        {label}
      </AppText>
    </>
  );

  if (!onPress) {
    return <View style={[styles.chip, surface, style]}>{content}</View>;
  }

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.95}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={[styles.chip, surface, style]}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
