import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import {
  DAY_PILL_GRADIENT,
  DayDots,
  describeDay,
  markerDotColors,
  type DayMarkers,
} from '@/components/ui/MonthCalendar';
import { PressableScale } from '@/components/ui/PressableScale';
import { haptic } from '@/services/haptics';
import { motion, radii, shadow, spacing, useTheme } from '@/theme';
import type { DayKey } from '@/types';
import { addDays, fromDayKey, startOfWeek, toDayKey, weekdayName } from '@/utils/date';

export interface WeekStripProps {
  selected: DayKey;
  onSelect: (day: DayKey) => void;
  /** Number of day columns. */
  days?: number;
  /** First column; defaults to the Monday of the selected week. */
  startDay?: DayKey;
  markers?: DayMarkers;
  /** Enables chevrons and horizontal swipes to page by week. */
  onWeekChange?: (delta: -1 | 1) => void;
  /** Overrides "today" (defaults to the device date when mounted). */
  today?: DayKey;
  style?: StyleProp<ViewStyle>;
}

const TRACK_PADDING = 4;
const PILL_INSET = 2;
/** Horizontal travel (px) or speed (px/s) that counts as a week swipe. */
const SWIPE_DISTANCE = 40;
const SWIPE_VELOCITY = 500;

function WeekChevron({ delta, onPress }: { delta: -1 | 1; onPress: (delta: -1 | 1) => void }) {
  return (
    <PressableScale
      onPress={() => onPress(delta)}
      haptic="selection"
      scaleTo={0.85}
      hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? 'Previous week' : 'Next week'}
      style={styles.chevron}
    >
      <Icon name={delta < 0 ? 'chevron-left' : 'chevron-right'} size={18} color="textMuted" />
    </PressableScale>
  );
}

/**
 * Planner header strip ("Mon 7 · Tue 8 … Sat 12"): a glass track of day
 * columns with a spring-animated gradient pill behind the selected day.
 */
export function WeekStrip({
  selected,
  onSelect,
  days = 7,
  startDay,
  markers,
  onWeekChange,
  today,
  style,
}: WeekStripProps) {
  const { colors } = useTheme();
  const [mountedToday] = useState(() => toDayKey(new Date()));
  const todayKey = today ?? mountedToday;

  const count = Math.max(1, Math.round(days));
  const start = startDay ? fromDayKey(startDay) : startOfWeek(fromDayKey(selected));
  const dates = Array.from({ length: count }, (_, i) => addDays(start, i));
  const keys = dates.map(toDayKey);
  const selectedIndex = keys.indexOf(selected);

  const [rowWidth, setRowWidth] = useState(0);
  const columnWidth = rowWidth / count;

  const pillX = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const drag = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!columnWidth) return;
    if (selectedIndex < 0) {
      pillOpacity.set(0);
      placed.current = false;
      return;
    }
    const x = selectedIndex * columnWidth;
    if (placed.current) {
      pillX.set(withSpring(x, motion.spring));
    } else {
      // First placement (or re-entering the range): jump, don't fly in from 0.
      placed.current = true;
      pillX.set(x);
      pillOpacity.set(1);
    }
  }, [selectedIndex, columnWidth, pillX, pillOpacity]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.get(),
    transform: [{ translateX: pillX.get() }],
  }));
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drag.get() }] }));

  const onRowLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width !== rowWidth) setRowWidth(width);
  };

  const changeWeek = (delta: -1 | 1) => onWeekChange?.(delta);
  const swipeWeek = (delta: -1 | 1) => {
    haptic('selection');
    changeWeek(delta);
  };

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      // Light rubber-band so the strip acknowledges the drag.
      drag.set(event.translationX * 0.2);
    })
    .onEnd((event) => {
      const far = Math.abs(event.translationX) > SWIPE_DISTANCE;
      const fast = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      if (far || fast) scheduleOnRN(swipeWeek, event.translationX < 0 ? 1 : -1);
    })
    .onFinalize(() => {
      drag.set(withSpring(0, motion.spring));
    });

  const strip = (
    <View style={[styles.track, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {onWeekChange ? <WeekChevron delta={-1} onPress={changeWeek} /> : null}
      <Animated.View style={[styles.row, dragStyle]} onLayout={onRowLayout}>
        <Animated.View
          style={[
            styles.pill,
            { width: Math.max(0, columnWidth - PILL_INSET * 2) },
            shadow('glow', DAY_PILL_GRADIENT[1]),
            pillStyle,
          ]}
        >
          <LinearGradient
            colors={DAY_PILL_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pillFill}
          />
        </Animated.View>
        <LayoutAnimationConfig skipEntering>
          <Animated.View key={keys[0]} entering={FadeIn.duration(motion.base)} style={styles.columns}>
            {dates.map((date, index) => {
              const key = keys[index];
              const isSelected = index === selectedIndex;
              const isToday = key === todayKey;
              const marker = markers?.[key];
              const dots = [...(isToday ? [colors.primary] : []), ...markerDotColors(colors, marker)];
              return (
                <PressableScale
                  key={key}
                  haptic="selection"
                  scaleTo={0.92}
                  onPress={() => {
                    if (!isSelected) onSelect(key);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={describeDay(date, { today: isToday, marker })}
                  accessibilityState={{ selected: isSelected }}
                  style={styles.column}
                >
                  <DayColumn
                    weekday={weekdayName(date, true)}
                    day={date.getDate()}
                    selected={isSelected}
                    today={isToday}
                    dots={
                      <DayDots
                        colors={dots.slice(0, 3)}
                        tint={isSelected ? colors.textOnAccent : undefined}
                      />
                    }
                  />
                </PressableScale>
              );
            })}
          </Animated.View>
        </LayoutAnimationConfig>
      </Animated.View>
      {onWeekChange ? <WeekChevron delta={1} onPress={changeWeek} /> : null}
    </View>
  );

  if (!onWeekChange) return strip;
  return <GestureDetector gesture={swipe}>{strip}</GestureDetector>;
}

function DayColumn({
  weekday,
  day,
  selected,
  today,
  dots,
}: {
  weekday: string;
  day: number;
  selected: boolean;
  today: boolean;
  dots: ReactNode;
}) {
  const numberColor = selected ? 'textOnAccent' : today ? 'primary' : 'text';
  return (
    <View style={styles.dayContent}>
      <AppText
        variant="caption"
        color={selected ? 'textOnAccent' : 'textSecondary'}
        style={selected ? styles.selectedWeekday : null}
        numberOfLines={1}
      >
        {weekday}
      </AppText>
      <AppText variant="h3" color={numberColor} tabular numberOfLines={1}>
        {day}
      </AppText>
      {dots}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: TRACK_PADDING,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  row: { flex: 1 },
  columns: { flexDirection: 'row' },
  column: { flex: 1 },
  pill: {
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    bottom: 0,
    left: PILL_INSET,
    borderRadius: radii.md,
    backgroundColor: DAY_PILL_GRADIENT[1],
  },
  pillFill: {
    flex: 1,
    borderRadius: radii.md,
  },
  dayContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  selectedWeekday: { opacity: 0.85 },
  chevron: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
