import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { motion, radii, shadow, spacing, useTheme, type Gradient, type ThemeColors } from '@/theme';
import type { DayKey } from '@/types';
import {
  addDays,
  addMonths,
  getMonthGrid,
  isSameMonth,
  monthName,
  startOfMonth,
  toDayKey,
  weekdayName,
} from '@/utils/date';

export interface DayMarker {
  /** Custom dot colours (e.g. subject accents for planned tasks). */
  dots?: string[];
  /** Exam day — drawn as a sunset dot. */
  exam?: boolean;
  /** Travel day — drawn as a cyan dot. */
  travel?: boolean;
  /** Extra screen-reader context, e.g. "3 tasks". */
  label?: string;
}

export type DayMarkers = Record<DayKey, DayMarker>;

/** Violet → blue fill of the selected day (matches the planner week strip). */
export const DAY_PILL_GRADIENT: Gradient = ['#6D5BFF', '#3B82F6'];

const MAX_DOTS = 3;
const DOT_SIZE = 4;
const ROW_HEIGHT = 48;
const PILL_HEIGHT = 44;
const PILL_BORDER = 1.5;

/** Dot colours for a day: exam first, then travel, then custom dots (max 3). */
export function markerDotColors(colors: ThemeColors, marker: DayMarker | undefined): string[] {
  if (!marker) return [];
  const dots: string[] = [];
  if (marker.exam) dots.push(colors.highlight);
  if (marker.travel) dots.push(colors.accent);
  if (marker.dots) dots.push(...marker.dots);
  return dots.slice(0, MAX_DOTS);
}

/** "Monday 12 October, today, exam day" */
export function describeDay(date: Date, options: { today?: boolean; marker?: DayMarker } = {}): string {
  const bits = [`${weekdayName(date)} ${date.getDate()} ${monthName(date)}`];
  if (options.today) bits.push('today');
  if (options.marker?.exam) bits.push('exam day');
  if (options.marker?.travel) bits.push('travel day');
  if (options.marker?.label) bits.push(options.marker.label);
  return bits.join(', ');
}

/** Fixed-height row of up to three tiny marker dots (reserves space even when empty). */
export function DayDots({ colors: dotColors, tint }: { colors: string[]; tint?: string }) {
  return (
    <View style={styles.dots}>
      {dotColors.map((color, index) => (
        <View key={index} style={[styles.dot, { backgroundColor: tint ?? color }]} />
      ))}
    </View>
  );
}

export interface MonthCalendarProps {
  /** Any date inside the month to show. */
  month: Date;
  selected?: DayKey;
  onSelect: (day: DayKey) => void;
  /** Called with the first day of the month to show next. */
  onMonthChange: (month: Date) => void;
  markers?: DayMarkers;
  /** Days before this one are disabled. */
  minDay?: DayKey;
  /** Overrides "today" (defaults to the device date when mounted). */
  today?: DayKey;
  style?: StyleProp<ViewStyle>;
}

/**
 * Monday-first month grid: 6×7 fixed cells (height never jumps), dimmed
 * out-of-month days, outlined today, gradient pill on the selected day and up
 * to three marker dots per day.
 */
export function MonthCalendar({
  month,
  selected,
  onSelect,
  onMonthChange,
  markers,
  minDay,
  today,
  style,
}: MonthCalendarProps) {
  const { colors } = useTheme();
  const [mountedToday] = useState(() => toDayKey(new Date()));
  const todayKey = today ?? mountedToday;

  const first = startOfMonth(month);
  const grid = getMonthGrid(first);
  const weeks = Array.from({ length: 6 }, (_, row) => grid.slice(row * 7, row * 7 + 7));
  const monthKey = toDayKey(first);
  const prevDisabled = minDay ? toDayKey(addDays(first, -1)) < minDay : false;

  const select = (date: Date) => {
    onSelect(toDayKey(date));
    if (!isSameMonth(date, first)) onMonthChange(startOfMonth(date));
  };

  return (
    <View style={style}>
      <View style={styles.header}>
        <AppText variant="h3" accessibilityRole="header" style={styles.title}>
          {`${monthName(first)} ${first.getFullYear()}`}
        </AppText>
        <IconButton
          icon="chevron-left"
          size="sm"
          disabled={prevDisabled}
          accessibilityLabel="Previous month"
          onPress={() => onMonthChange(addMonths(first, -1))}
        />
        <IconButton
          icon="chevron-right"
          size="sm"
          accessibilityLabel="Next month"
          onPress={() => onMonthChange(addMonths(first, 1))}
        />
      </View>

      <View style={styles.weekdays}>
        {grid.slice(0, 7).map((date) => (
          <AppText
            key={date.getDay()}
            variant="caption"
            color="textMuted"
            align="center"
            style={styles.cell}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {weekdayName(date, true)}
          </AppText>
        ))}
      </View>

      <LayoutAnimationConfig skipEntering>
        <Animated.View key={monthKey} entering={FadeIn.duration(motion.base)}>
          {weeks.map((week) => (
            <View key={toDayKey(week[0])} style={styles.week}>
              {week.map((date) => {
                const key = toDayKey(date);
                const inMonth = isSameMonth(date, first);
                const isSelected = key === selected;
                const isToday = key === todayKey;
                const disabled = minDay ? key < minDay : false;
                const marker = markers?.[key];
                const dotColors = markerDotColors(colors, marker);
                const textColor = isSelected
                  ? colors.textOnAccent
                  : isToday
                    ? colors.primary
                    : inMonth
                      ? colors.text
                      : colors.textMuted;

                return (
                  <PressableScale
                    key={key}
                    haptic="selection"
                    scaleTo={0.9}
                    disabled={disabled}
                    onPress={() => select(date)}
                    accessibilityRole="button"
                    accessibilityLabel={describeDay(date, { today: isToday, marker })}
                    accessibilityState={{ selected: isSelected, disabled }}
                    style={[styles.cell, styles.dayCell]}
                  >
                    <View
                      style={[
                        styles.pill,
                        isToday && !isSelected ? { borderColor: colors.primary } : null,
                        !inMonth && !isSelected ? styles.outside : null,
                        disabled ? styles.disabled : null,
                      ]}
                    >
                      {isSelected ? (
                        <Animated.View
                          entering={ZoomIn.duration(motion.fast)}
                          style={[styles.selectedFill, shadow('sm', DAY_PILL_GRADIENT[1])]}
                        >
                          <LinearGradient
                            colors={DAY_PILL_GRADIENT}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.gradient}
                          />
                        </Animated.View>
                      ) : null}
                      <AppText variant="subtitle" color={textColor} tabular>
                        {date.getDate()}
                      </AppText>
                      <DayDots colors={dotColors} tint={isSelected ? colors.textOnAccent : undefined} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </LayoutAnimationConfig>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { flex: 1 },
  weekdays: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  week: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
  },
  cell: { flex: 1 },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    width: '88%',
    maxWidth: 42,
    height: PILL_HEIGHT,
    borderRadius: radii.sm,
    borderWidth: PILL_BORDER,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: DOT_SIZE,
  },
  // Covers the pill's (transparent) border too; the solid backing gives Android elevation a shape.
  selectedFill: {
    position: 'absolute',
    top: -PILL_BORDER,
    left: -PILL_BORDER,
    right: -PILL_BORDER,
    bottom: -PILL_BORDER,
    borderRadius: radii.sm,
    backgroundColor: DAY_PILL_GRADIENT[1],
  },
  gradient: {
    flex: 1,
    borderRadius: radii.sm,
  },
  outside: { opacity: 0.45 },
  disabled: { opacity: 0.3 },
  dots: {
    flexDirection: 'row',
    gap: 3,
    height: DOT_SIZE,
    marginTop: 3,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
