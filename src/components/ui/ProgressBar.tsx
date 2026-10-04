import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { gradients, useTheme, type Gradient } from '@/theme';

export interface ProgressBarProps {
  /** Fraction complete, 0–1 (clamped). */
  progress: number;
  gradient?: Gradient;
  height?: number;
  trackColor?: string;
  animated?: boolean;
  /** Animation length in ms. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Rounded track with a gradient fill whose width animates to `progress`. */
export function ProgressBar({
  progress,
  gradient = gradients.primary,
  height = 8,
  trackColor,
  animated = true,
  duration = 900,
  style,
  accessibilityLabel,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const target = clamp01(progress);
  const shouldAnimate = animated && !reduceMotion;
  const fill = useSharedValue(shouldAnimate ? 0 : target);

  useEffect(() => {
    if (shouldAnimate) {
      fill.set(withTiming(target, { duration, easing: Easing.out(Easing.cubic) }));
    } else {
      fill.set(target);
    }
  }, [target, shouldAnimate, duration, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.get() * 100}%`,
    opacity: fill.get() > 0.001 ? 1 : 0,
  }));

  const radius = height / 2;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[
        styles.track,
        { height, borderRadius: radius, backgroundColor: trackColor ?? colors.track },
        style,
      ]}
    >
      <Animated.View style={[styles.fill, { borderRadius: radius, minWidth: height }, fillStyle]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    overflow: 'hidden',
  },
});
