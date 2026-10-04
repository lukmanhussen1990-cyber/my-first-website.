import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/services/haptics';
import { motion, useTheme } from '@/theme';

import { Icon } from './Icon';

export interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  shape?: 'circle' | 'square';
  /** Fill when checked (default: success green for circle, primary for square). */
  color?: string;
  size?: number;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Animated check control: green disc (circle) or purple rounded square. */
export function Checkbox({
  checked,
  onChange,
  shape = 'circle',
  color,
  size = 24,
  accessibilityLabel,
  disabled,
  style,
}: CheckboxProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const fill = color ?? (shape === 'circle' ? colors.success : colors.primary);
  const radius = shape === 'circle' ? size / 2 : Math.round(size * 0.28);
  const slop = Math.max(0, (44 - size) / 2);

  // Pop whenever the value flips (tap, row tap or external change), not on mount.
  const previous = useRef(checked);
  useEffect(() => {
    if (previous.current === checked) return;
    previous.current = checked;
    scale.set(
      withSequence(withTiming(0.8, { duration: motion.fast / 2 }), withSpring(1, motion.spring)),
    );
  }, [checked, scale]);

  const toggle = () => {
    haptic('selection');
    onChange(!checked);
  };

  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      style={style}
    >
      <Animated.View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: checked ? fill : 'transparent',
            borderColor: checked ? fill : colors.textMuted,
          },
          disabled ? styles.disabled : null,
          popStyle,
        ]}
      >
        {checked ? (
          <Icon name="check-bold" size={Math.round(size * 0.62)} color={colors.textOnAccent} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  disabled: { opacity: 0.5 },
});
