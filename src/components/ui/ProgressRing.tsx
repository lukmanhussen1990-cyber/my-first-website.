import { useEffect, useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { gradients, useTheme, type Gradient } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** Fraction complete, 0–1 (clamped). */
  progress: number;
  size?: number;
  strokeWidth?: number;
  gradient?: Gradient;
  trackColor?: string;
  /** Rendered centred inside the ring. */
  children?: ReactNode;
  animated?: boolean;
  /** Animation length in ms. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * Circular progress arc with a gradient stroke and rounded caps. Starts at
 * 12 o'clock, runs clockwise and animates on mount and whenever `progress` changes.
 */
export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  gradient = gradients.aurora,
  trackColor,
  children,
  animated = true,
  duration = 900,
  style,
  accessibilityLabel,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  // useId output may contain characters that are invalid inside `url(#…)`.
  const gradientId = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const target = clamp01(progress);
  const shouldAnimate = animated && !reduceMotion;
  const value = useSharedValue(shouldAnimate ? 0 : target);

  useEffect(() => {
    if (shouldAnimate) {
      value.set(withTiming(target, { duration, easing: Easing.out(Easing.cubic) }));
    } else {
      value.set(target);
    }
  }, [target, shouldAnimate, duration, value]);

  const center = size / 2;
  const radius = Math.max(0, (size - strokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.get()),
    // Round caps would otherwise draw a dot at 0 %.
    strokeOpacity: value.get() > 0.002 ? 1 : 0,
  }));

  const lastStop = gradient.length - 1;

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {gradient.map((color, index) => (
              <Stop key={`${color}-${index}`} offset={lastStop ? index / lastStop : 0} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor ?? colors.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
          animatedProps={arcProps}
        />
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
});
