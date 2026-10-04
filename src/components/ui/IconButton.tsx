import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { gradients, shadow, useTheme, type Gradient } from '@/theme';
import type { HapticKind } from '@/services/haptics';
import type { IconName } from '@/types';

import { Icon, type IconColor } from './Icon';
import { PressableScale } from './PressableScale';

export type IconButtonSize = 'sm' | 'md' | 'lg';
/** `overlay` is a translucent dark circle for use over imagery. */
export type IconButtonVariant = 'glass' | 'solid' | 'gradient' | 'overlay';

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /** Glyph colour (token or raw). Defaults per variant. */
  color?: IconColor;
  /** Fill for the `gradient` variant. */
  gradient?: Gradient;
  disabled?: boolean;
  haptic?: HapticKind | false;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<IconButtonSize, { box: number; glyph: number }> = {
  sm: { box: 36, glyph: 18 },
  md: { box: 44, glyph: 22 },
  lg: { box: 56, glyph: 26 },
};

/** Circular icon-only button. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 'md',
  variant = 'glass',
  color,
  gradient = gradients.violet,
  disabled,
  haptic,
  accessibilityHint,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const spec = SIZES[size];
  // Keep the touch target at least 44pt.
  const slop = Math.max(0, (44 - spec.box) / 2);
  const circle = { width: spec.box, height: spec.box, borderRadius: spec.box / 2 };

  const surface: ViewStyle =
    variant === 'glass'
      ? { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
      : variant === 'solid'
        ? { backgroundColor: colors.primary }
        : variant === 'overlay'
          ? styles.overlay
          : // Solid backing under the gradient so Android elevation has a shape to shadow.
            { backgroundColor: gradient[gradient.length - 1] };
  const glow =
    variant === 'solid'
      ? shadow('glow', colors.primary)
      : variant === 'gradient'
        ? shadow('glow', gradient[0])
        : null;
  const glyphColor: IconColor = color ?? (variant === 'glass' ? 'text' : 'textOnAccent');

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      scaleTo={0.92}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[circle, disabled ? styles.disabled : null, style]}
    >
      <View style={[styles.center, circle, surface, glow]}>
        {variant === 'gradient' ? (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, circle]}
          />
        ) : null}
        <Icon name={icon} size={spec.glyph} color={glyphColor} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  // Sits on photography, so it is intentionally theme-independent.
  overlay: {
    backgroundColor: 'rgba(5, 7, 15, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
  },
  disabled: { opacity: 0.45 },
});
