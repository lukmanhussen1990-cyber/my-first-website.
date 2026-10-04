import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic as triggerHaptic, type HapticKind } from '@/services/haptics';
import { motion } from '@/theme';

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  /** Scale applied while pressed. */
  scaleTo?: number;
  /** Haptic fired on press; `false` disables it. Long-press always uses `medium`. */
  haptic?: HapticKind | false;
  /**
   * Layout keys (flex, margins, size, position…) are applied to the touch target;
   * everything else (background, padding, radius…) to the scaling surface.
   */
  style?: StyleProp<ViewStyle>;
}

/** Style keys that position/size the pressable itself rather than its visual surface. */
const OUTER_KEYS = new Set<string>([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
  'inset',
  'insetBlock',
  'insetBlockEnd',
  'insetBlockStart',
  'insetInline',
  'insetInlineEnd',
  'insetInlineStart',
  'zIndex',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'marginBlock',
  'marginBlockEnd',
  'marginBlockStart',
  'marginInline',
  'marginInlineEnd',
  'marginInlineStart',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'aspectRatio',
  'transform',
  'display',
]);

/**
 * Splits a style into `[outer, inner]`: layout keys for a wrapper and visual
 * keys for the surface it wraps. Used by components that put a scaling
 * surface inside a touch target.
 */
export function splitLayoutStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const flat = StyleSheet.flatten(style) ?? {};
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (OUTER_KEYS.has(key)) outer[key] = value;
    else inner[key] = value;
  }
  return [outer as ViewStyle, inner as ViewStyle];
}

/**
 * Pressable with a springy press-scale and a light haptic. Accessibility props
 * are forwarded to the underlying `Pressable`.
 */
export function PressableScale({
  children,
  scaleTo = 0.97,
  haptic = 'light',
  style,
  disabled,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const [outer, inner] = splitLayoutStyle(style);

  const handlePressIn = (e: GestureResponderEvent) => {
    scale.set(withSpring(scaleTo, motion.spring));
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    scale.set(withSpring(1, motion.spring));
    onPressOut?.(e);
  };

  const handlePress = onPress
    ? (e: GestureResponderEvent) => {
        if (haptic) triggerHaptic(haptic);
        onPress(e);
      }
    : undefined;

  const handleLongPress = onLongPress
    ? (e: GestureResponderEvent) => {
        if (haptic) triggerHaptic('medium');
        onLongPress(e);
      }
    : undefined;

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={outer}
    >
      {(state) => (
        <Animated.View style={[styles.surface, inner, animatedStyle]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Fill the touch target when it has an explicit size (flex, height, aspectRatio…).
  surface: { flexGrow: 1 },
});
