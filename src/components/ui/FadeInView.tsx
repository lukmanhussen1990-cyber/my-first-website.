import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/theme';

export interface FadeInViewProps {
  /** Entrance delay in ms — pass `index * motion.stagger` for staggered lists. */
  delay?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Ease-out-quint: fast start, long soft settle — reads as a gentle spring without overshoot.
const SETTLE = Easing.bezier(0.22, 1, 0.36, 1);

/** Fades and lifts its children into place on mount; static when reduced motion is on. */
export function FadeInView({ delay = 0, children, style }: FadeInViewProps) {
  const reducedMotion = useReducedMotion();
  const entering = reducedMotion
    ? undefined
    : FadeInDown.duration(motion.slow).delay(delay).easing(SETTLE);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
