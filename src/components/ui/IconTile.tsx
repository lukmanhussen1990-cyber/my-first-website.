import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { shadow, useTheme, type Gradient } from '@/theme';
import type { IconName } from '@/types';

export type IconTileSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconTileProps {
  icon: IconName;
  gradient: Gradient;
  size?: IconTileSize;
  /** Corner radius; defaults scale with size (8–20). */
  radius?: number;
  /** Soft coloured glow picked up from the gradient's first stop. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<IconTileSize, { box: number; radius: number; glyph: number }> = {
  xs: { box: 28, radius: 8, glyph: 16 },
  sm: { box: 36, radius: 10, glyph: 19 },
  md: { box: 44, radius: 12, glyph: 23 },
  lg: { box: 56, radius: 14, glyph: 28 },
  xl: { box: 72, radius: 20, glyph: 36 },
};

// Light sheen over the top of the tile (drawn on the gradient, so not theme-dependent).
const SHEEN = ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0)'] as const;

/** Rounded-square gradient tile with a white glyph — the app's feature/list icon. */
export function IconTile({ icon, gradient, size = 'md', radius, glow, style }: IconTileProps) {
  const { colors } = useTheme();
  const spec = SIZES[size];
  const r = radius ?? spec.radius;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: spec.box, height: spec.box, borderRadius: r },
        // Opaque backing gives Android's elevation a shape to cast the glow from.
        glow ? [shadow('glow', gradient[0]), { backgroundColor: gradient[gradient.length - 1] }] : null,
        style,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, { borderRadius: r }]}
      >
        <LinearGradient
          colors={SHEEN}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={[StyleSheet.absoluteFill, styles.sheen, { borderRadius: r }]}
        />
        <Icon name={icon} size={spec.glyph} color={colors.textOnAccent} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sheen: {
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});
