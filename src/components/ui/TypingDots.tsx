import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

export interface TypingDotsProps {
  /** Dot colour; defaults to `colors.textSecondary`. */
  color?: string;
  /** Dot diameter in px. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const DOTS = [0, 1, 2] as const;
/** One full cycle: three staggered hops followed by a short rest. */
const CYCLE_MS = 1200;
/** Phase offset between neighbouring dots (fraction of the cycle). */
const STAGGER = 0.16;
/** Portion of the cycle each dot spends in the air. */
const HOP = 0.36;
/** Static opacities used when reduced motion is on. */
const STILL_OPACITY = [0.45, 0.7, 1] as const;

function Dot({
  index,
  clock,
  size,
  color,
  still,
}: {
  index: number;
  clock: SharedValue<number>;
  size: number;
  color: string;
  still: boolean;
}) {
  const lift = size * 0.9;
  const hop = useAnimatedStyle(() => {
    if (still) return { opacity: STILL_OPACITY[index], transform: [{ translateY: 0 }] };
    const phase = (clock.get() - index * STAGGER + 1) % 1;
    const air = phase < HOP ? Math.sin((phase / HOP) * Math.PI) : 0;
    return { opacity: 0.45 + air * 0.55, transform: [{ translateY: -air * lift }] };
  });

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, hop]}
    />
  );
}

/**
 * Three dots hopping in sequence — the "assistant is typing" indicator. A
 * single looping clock drives all dots on the UI thread.
 */
export function TypingDots({ color, size = 7, style, accessibilityLabel = 'Typing' }: TypingDotsProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    clock.set(0);
    clock.set(withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [reduceMotion, clock]);

  const fill = color ?? colors.textSecondary;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { gap: size * 0.7, height: size * 2.6, paddingBottom: size * 0.3 }, style]}
    >
      {DOTS.map((index) => (
        <Dot key={index} index={index} clock={clock} size={size} color={fill} still={reduceMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
  },
});
