import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, splitLayoutStyle } from '@/components/ui/PressableScale';
import { radii, shadow, spacing, useTheme, withAlpha, type Gradient } from '@/theme';

export interface GlassCardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
  /** Subtle tinted overlay (drawn at ~0.18 opacity). */
  tint?: Gradient;
  /** Real backdrop blur — use only over imagery (Android falls back to a translucent fill). */
  blur?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Faint highlight line along the top edge. */
  highlight?: boolean;
}

const TINT_OPACITY = 0.18;

/**
 * Elevation for translucent surfaces. Android's `elevation` paints the shadow
 * underneath the view (it shows through glass as a grey smudge); `boxShadow`
 * is clipped to outside the border box, so use it there instead.
 */
function glassShadow(color: string): ViewStyle {
  if (Platform.OS === 'android') return { boxShadow: `0px 8px 16px ${withAlpha(color, 0.24)}` };
  return shadow('md', color);
}

/**
 * Glassmorphism card: translucent fill, hairline border, faint top highlight and
 * an optional tinted gradient overlay. Becomes a `PressableScale` when `onPress`
 * or `onLongPress` is set.
 */
export function GlassCard({
  children,
  style,
  padding = spacing.lg,
  radius = radii.xl,
  tint,
  blur,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  highlight = true,
}: GlassCardProps) {
  const { colors, isDark } = useTheme();
  const pressable = Boolean(onPress || onLongPress);
  const [outer, inner] = pressable ? splitLayoutStyle(style) : [undefined, style];

  const surface = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: blur ? withAlpha(colors.surface, isDark ? 0.35 : 0.45) : colors.card,
          borderColor: colors.border,
          borderRadius: radius,
          padding,
        },
        glassShadow(colors.shadow),
        pressable && styles.fill,
        inner,
      ]}
    >
      {blur || tint ? (
        <View
          // Children sit inside the 1px border, so clip to the inner radius.
          style={[StyleSheet.absoluteFill, styles.overlay, { borderRadius: Math.max(0, radius - 1) }]}
        >
          {blur ? (
            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null}
          {tint ? (
            <LinearGradient
              colors={tint}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { opacity: TINT_OPACITY }]}
            />
          ) : null}
        </View>
      ) : null}
      {highlight ? (
        <LinearGradient
          colors={['transparent', colors.borderHighlight, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.highlight, { left: radius * 0.75, right: radius * 0.75 }]}
        />
      ) : null}
      {children}
    </View>
  );

  if (!pressable) return surface;

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={outer}
    >
      {surface}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  fill: { flexGrow: 1 },
  overlay: { overflow: 'hidden', pointerEvents: 'none' },
  highlight: { position: 'absolute', top: 0, height: 1, pointerEvents: 'none' },
});
