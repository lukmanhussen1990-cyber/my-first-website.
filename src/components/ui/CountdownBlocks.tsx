import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LayoutAnimationConfig } from 'react-native-reanimated';

import { AppText, type TextColor } from '@/components/ui/AppText';
import { radii, spacing, textVariants, useTheme, type Gradient, type TextVariant } from '@/theme';
import { describeCountdown, pad2, type CountdownParts } from '@/utils/date';

type Unit = keyof CountdownParts;
type LabelStyle = 'long' | 'short';

const UNITS: readonly Unit[] = ['days', 'hours', 'minutes', 'seconds'];

/** [singular, plural] per unit, per variant and label length. */
type LabelSet = Record<Unit, readonly [singular: string, plural: string]>;

const LABELS: Record<'boxes' | 'compact', Record<LabelStyle, LabelSet>> = {
  boxes: {
    long: {
      days: ['Day', 'Days'],
      hours: ['Hour', 'Hours'],
      minutes: ['Minute', 'Minutes'],
      seconds: ['Second', 'Seconds'],
    },
    short: {
      days: ['Day', 'Days'],
      hours: ['Hr', 'Hrs'],
      minutes: ['Min', 'Min'],
      seconds: ['Sec', 'Sec'],
    },
  },
  compact: {
    long: {
      days: ['day', 'days'],
      hours: ['hr', 'hrs'],
      minutes: ['min', 'min'],
      seconds: ['sec', 'sec'],
    },
    short: {
      days: ['d', 'd'],
      hours: ['h', 'h'],
      minutes: ['m', 'm'],
      seconds: ['s', 's'],
    },
  },
};

// The new value rises in from just below while the old one drifts up and out.
const ENTERING = FadeInDown.duration(220).withInitialValues({
  opacity: 0,
  transform: [{ translateY: 10 }],
});
const EXITING = FadeOutUp.duration(180);

/** Days are shown as-is; every other unit is zero-padded ("08"). */
export function formatCountdownUnit(unit: Unit, value: number): string {
  return unit === 'days' ? String(Math.max(0, Math.trunc(value))) : pad2(value);
}

export interface TickingNumberProps {
  /** Already-formatted value; a change of value plays the tick animation. */
  value: string;
  variant?: TextVariant;
  color?: TextColor;
  style?: StyleProp<ViewStyle>;
}

/**
 * A number that slides/fades to its new value. Fixed line height + tabular
 * numerals keep neighbours from shifting while the digits change. Wrap a group
 * of these in `LayoutAnimationConfig skipEntering` to avoid animating on mount.
 */
export function TickingNumber({
  value,
  variant = 'number',
  color = 'text',
  style,
}: TickingNumberProps) {
  const { lineHeight } = textVariants[variant];
  return (
    <View style={[styles.ticker, { height: lineHeight }, style]}>
      <Animated.View key={value} entering={ENTERING} exiting={EXITING}>
        <AppText variant={variant} color={color} tabular numberOfLines={1}>
          {value}
        </AppText>
      </Animated.View>
    </View>
  );
}

export interface CountdownBlocksProps {
  parts: CountdownParts;
  variant?: 'boxes' | 'compact';
  /** Defaults to 'long' for boxes ("Minutes") and 'short' for compact ("25m"). */
  labels?: LabelStyle;
  /** Optional subtle gradient wash over each block. */
  tint?: Gradient;
  style?: StyleProp<ViewStyle>;
  /** Overrides the generated "5 days 14 hours left" label. */
  accessibilityLabel?: string;
}

/**
 * Countdown split into days / hours / minutes / seconds — either four equal
 * boxes ("12 Days · 08 Hours · 25 Minutes · 40 Seconds") or compact inline chips.
 */
export function CountdownBlocks({
  parts,
  variant = 'boxes',
  labels,
  tint,
  style,
  accessibilityLabel,
}: CountdownBlocksProps) {
  const { colors } = useTheme();
  const isBoxes = variant === 'boxes';
  const labelStyle = labels ?? (isBoxes ? 'long' : 'short');
  const labelSet = LABELS[variant][labelStyle];

  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={accessibilityLabel ?? describeCountdown(parts)}
      style={[isBoxes ? styles.boxesRow : styles.compactRow, style]}
    >
      <LayoutAnimationConfig skipEntering>
        {UNITS.map((unit) => {
          const value = parts[unit];
          const [singular, plural] = labelSet[unit];
          const label = value === 1 ? singular : plural;
          const shell = [
            isBoxes ? styles.box : styles.chip,
            !isBoxes && { gap: labelStyle === 'long' ? spacing.xs : spacing.xxs },
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ];
          return (
            <View key={unit} style={shell}>
              {tint ? (
                <LinearGradient
                  colors={tint}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, styles.tint]}
                />
              ) : null}
              <TickingNumber
                value={formatCountdownUnit(unit, value)}
                variant={isBoxes ? 'h2' : 'title'}
              />
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {label}
              </AppText>
            </View>
          );
        })}
      </LayoutAnimationConfig>
    </View>
  );
}

const styles = StyleSheet.create({
  ticker: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    gap: spacing.xxs,
  },
  compactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.xs,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tint: {
    opacity: 0.18,
  },
});
