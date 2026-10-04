import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { gradients, radii, spacing, useTheme, type Gradient, type ThemeColors } from '@/theme';
import type { IconName } from '@/types';

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

/** Violet → blue, matching the selected pill of `SegmentedTabs`. */
const SELECTED_DEFAULT: Gradient = ['#6D5BFF', '#3B82F6'];

function toneColors(
  colors: ThemeColors,
  tone: ChipTone,
): { solid: string; soft: string; fill: Gradient } {
  switch (tone) {
    case 'sunset':
      return { solid: colors.highlight, soft: colors.highlightSoft, fill: gradients.sunset };
    case 'success':
      return { solid: colors.success, soft: colors.successSoft, fill: gradients.success };
    case 'primary':
      return { solid: colors.primary, soft: colors.primarySoft, fill: gradients.violet };
    default:
      return { solid: colors.primary, soft: colors.primarySoft, fill: SELECTED_DEFAULT };
  }
}

/**
 * Pill used for quick prompts and filters. Unselected chips are neutral glass
 * (or softly tinted for a non-default tone); selected chips fill with the
 * tone's gradient and a white label.
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
  const { solid, soft, fill } = toneColors(colors, tone);

  const surface: ViewStyle = selected
    ? { backgroundColor: 'transparent', borderColor: 'transparent' }
    : tone === 'default'
      ? { backgroundColor: colors.surfaceMuted, borderColor: colors.border }
      : { backgroundColor: soft, borderColor: soft };
  const fg = selected ? colors.textOnAccent : tone === 'default' ? colors.textSecondary : solid;

  const content = (
    <>
      {selected ? (
        <LinearGradient
          colors={fill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        />
      ) : null}
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
  // Extends under the 1px border so the gradient reaches the pill's edge.
  fill: { position: 'absolute', top: -1, right: -1, bottom: -1, left: -1, borderRadius: radii.pill },
});
