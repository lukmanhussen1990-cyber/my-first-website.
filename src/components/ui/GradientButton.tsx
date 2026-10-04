import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, type TextColor } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import type { HapticKind } from '@/services/haptics';
import { gradients, radii, shadow, spacing, useTheme, type Gradient } from '@/theme';
import type { IconName } from '@/types';

export type GradientButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type GradientButtonSize = 'md' | 'lg';

export interface GradientButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** Fill for the `primary` variant. */
  gradient?: Gradient;
  variant?: GradientButtonVariant;
  size?: GradientButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width (otherwise sizes to content). */
  fullWidth?: boolean;
  /** Put the icon after the label (e.g. arrow-right). */
  iconPosition?: 'left' | 'right';
  haptic?: HapticKind | false;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHTS: Record<GradientButtonSize, number> = { md: 44, lg: 52 };

/** Pill-shaped call-to-action with a gradient fill and soft glow. */
export function GradientButton({
  label,
  onPress,
  icon,
  gradient = gradients.violet,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = false,
  iconPosition = 'left',
  haptic = 'light',
  accessibilityLabel,
  accessibilityHint,
  style,
}: GradientButtonProps) {
  const { colors } = useTheme();
  const height = HEIGHTS[size];
  const fill: Gradient | null =
    variant === 'primary' ? gradient : variant === 'danger' ? gradients.danger : null;
  const inactive = disabled || loading;

  const textColor: TextColor =
    variant === 'secondary' ? 'text' : variant === 'ghost' ? 'primary' : 'textOnAccent';
  const spinnerColor =
    variant === 'secondary' ? colors.text : variant === 'ghost' ? colors.primary : colors.textOnAccent;

  const surface: ViewStyle =
    variant === 'secondary'
      ? { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
      : fill
        ? // Opaque backing so the glow (Android elevation) has a shape to shadow.
          { backgroundColor: fill[fill.length - 1], ...shadow('glow', fill[0]) }
        : {};

  const iconNode = loading ? (
    <ActivityIndicator size="small" color={spinnerColor} />
  ) : icon ? (
    <Icon name={icon} size={size === 'lg' ? 20 : 18} color={textColor} />
  ) : null;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        { alignSelf: fullWidth ? 'stretch' : 'flex-start' },
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <View
        style={[
          styles.surface,
          {
            height,
            paddingHorizontal: variant === 'ghost' ? spacing.md : size === 'lg' ? spacing.xxl : spacing.lg + 2,
          },
          surface,
        ]}
      >
        {fill ? (
          <LinearGradient
            colors={fill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.pill]}
          />
        ) : null}
        {fill ? <View style={styles.sheen} /> : null}
        {iconPosition === 'left' ? iconNode : null}
        <AppText variant={size === 'lg' ? 'title' : 'subtitle'} color={textColor} numberOfLines={1}>
          {label}
        </AppText>
        {iconPosition === 'right' ? iconNode : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
  },
  pill: { borderRadius: radii.pill },
  // Hairline sheen along the top edge of gradient fills.
  sheen: {
    position: 'absolute',
    pointerEvents: 'none',
    top: 1,
    left: radii.xl,
    right: radii.xl,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 1,
  },
  disabled: { opacity: 0.5 },
});
