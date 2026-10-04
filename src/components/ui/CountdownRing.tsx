import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { formatCountdownUnit, TickingNumber } from '@/components/ui/CountdownBlocks';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { spacing, useTheme, type Gradient } from '@/theme';
import { describeCountdown, type CountdownParts } from '@/utils/date';

/** Purple → pink → orange, as on the reference "Final Exam Countdown" card. */
const RING_GRADIENT: Gradient = ['#7C5CFF', '#FF5E8A', '#FF8A3D'];

const ROWS = [
  { unit: 'hours', singular: 'Hour', plural: 'Hours' },
  { unit: 'minutes', singular: 'Minute', plural: 'Minutes' },
  { unit: 'seconds', singular: 'Second', plural: 'Seconds' },
] as const;

export interface CountdownRingProps {
  parts: CountdownParts;
  /** Elapsed fraction of the countdown (0–1) drawn as the ring. */
  progress: number;
  title?: string;
  /** Secondary line under the title, e.g. "12 October 2026". */
  subtitle?: string;
  size?: number;
  gradient?: Gradient;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hero countdown: a gradient ring with the remaining days in the centre and a
 * column of hours / minutes / seconds beside it.
 */
export function CountdownRing({
  parts,
  progress,
  title,
  subtitle,
  size = 132,
  gradient = RING_GRADIENT,
  style,
}: CountdownRingProps) {
  const { colors } = useTheme();
  const daysVariant = size >= 120 && parts.days < 100 ? 'hero' : parts.days < 1000 ? 'display' : 'h1';
  const countdown = describeCountdown(parts);

  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={title ? `${title}: ${countdown}` : countdown}
      style={style}
    >
      {title || subtitle ? (
        <View style={styles.header}>
          {title ? <AppText variant="h3">{title}</AppText> : null}
          {subtitle ? (
            <AppText variant="bodySm" color="textSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <LayoutAnimationConfig skipEntering>
        <View style={styles.body}>
          <ProgressRing
            progress={progress}
            size={size}
            strokeWidth={Math.max(6, Math.round(size * 0.075))}
            gradient={gradient}
          >
            <TickingNumber value={formatCountdownUnit('days', parts.days)} variant={daysVariant} />
            <AppText variant="label" color="textSecondary" style={styles.daysLabel}>
              {parts.days === 1 ? 'Day' : 'Days'}
            </AppText>
          </ProgressRing>
          <View style={styles.column}>
            {ROWS.map(({ unit, singular, plural }, index) => (
              <View
                key={unit}
                style={[styles.row, index > 0 && [styles.divider, { borderTopColor: colors.border }]]}
              >
                <TickingNumber
                  value={formatCountdownUnit(unit, parts[unit])}
                  variant="h3"
                  style={styles.rowNumber}
                />
                <AppText variant="body" color="textSecondary" numberOfLines={1}>
                  {parts[unit] === 1 ? singular : plural}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </LayoutAnimationConfig>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xxs,
    marginBottom: spacing.lg,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  daysLabel: {
    marginTop: -spacing.xs,
  },
  column: {
    flex: 1,
    marginLeft: spacing.xl,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowNumber: {
    width: 30,
    alignItems: 'flex-start',
  },
});
