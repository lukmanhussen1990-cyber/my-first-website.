import { Image, type ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { gradients, radii, shadow, spacing, useTheme, type Gradient } from '@/theme';

export type HeroOverlayPosition = 'top-left' | 'bottom-left' | 'center';

export interface HeroBannerProps {
  source: ImageSourcePropType;
  height?: number;
  /** Handwritten (Caveat) lines; `\n` breaks lines. */
  script?: string;
  /** `scriptLg` for short, single-thought lines. */
  scriptVariant?: 'script' | 'scriptLg';
  title?: string;
  subtitle?: string;
  /** Rendered inside the overlay, below the text (e.g. a Badge or button). */
  children?: ReactNode;
  overlayPosition?: HeroOverlayPosition;
  /** Which part of the image stays in frame when cropped. */
  contentPosition?: ImageContentPosition;
  radius?: number;
  onPress?: () => void;
  /** Defaults to the banner's text. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

interface ScrimSpec {
  colors: Gradient;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

// The scrim darkens the side the copy sits on so white text stays legible on bright skies.
const SCRIMS: Record<HeroOverlayPosition, ScrimSpec> = {
  'bottom-left': { colors: gradients.imageScrim, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  // Lighter than `imageScrim`: the copy sits on sky, which shouldn't turn muddy.
  'top-left': {
    colors: ['rgba(5,7,15,0.55)', 'rgba(5,7,15,0.2)', 'rgba(5,7,15,0)'],
    start: { x: 0, y: 0 },
    end: { x: 0.85, y: 0.75 },
  },
  center: {
    colors: ['rgba(5,7,15,0.15)', 'rgba(5,7,15,0.35)', 'rgba(5,7,15,0.7)'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
};

/**
 * Rounded illustration card with a legibility scrim and emotional copy on top,
 * e.g. "Good things are coming… 12th October and then Home! 🏠".
 */
export function HeroBanner({
  source,
  height = 200,
  script,
  scriptVariant = 'script',
  title,
  subtitle,
  children,
  overlayPosition = 'top-left',
  contentPosition,
  radius = radii.xl,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: HeroBannerProps) {
  const { colors } = useTheme();
  const scrim = SCRIMS[overlayPosition];
  const centered = overlayPosition === 'center';
  const align = centered ? 'center' : 'left';
  const label =
    accessibilityLabel ??
    [script?.replace(/\s*\n\s*/g, ' '), title, subtitle].filter(Boolean).join('. ');

  const card = (
    <View
      style={[
        styles.card,
        { height, borderRadius: radius, backgroundColor: colors.surface },
        shadow('md', colors.shadow),
      ]}
    >
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
        <Image
          source={source}
          contentFit="cover"
          contentPosition={contentPosition}
          transition={250}
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={scrim.colors}
          start={scrim.start}
          end={scrim.end}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        style={[
          styles.overlay,
          overlayPosition === 'top-left' && styles.topLeft,
          overlayPosition === 'bottom-left' && styles.bottomLeft,
          centered && styles.center,
        ]}
      >
        {script ? (
          <AppText variant={scriptVariant} color="textOnAccent" align={align} style={styles.shadowed}>
            {script}
          </AppText>
        ) : null}
        {title ? (
          <AppText variant="h2" color="textOnAccent" align={align} style={styles.shadowed}>
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText
            variant="bodySm"
            color="textOnAccent"
            align={align}
            style={[styles.shadowed, styles.subtitle]}
          >
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
      {/* Hairline edge, drawn over the image. */}
      <View style={[StyleSheet.absoluteFill, styles.edge, { borderRadius: radius }]} />
    </View>
  );

  if (!onPress) {
    // Group the copy into one readable element, unless children may be interactive.
    return (
      <View accessible={!children} accessibilityLabel={children ? undefined : label} style={style}>
        {card}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={style}
    >
      {card}
    </PressableScale>
  );
}

const textShadow: TextStyle = {
  textShadowColor: 'rgba(0, 0, 0, 0.45)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
};

const styles = StyleSheet.create({
  card: { width: '100%' },
  clip: { overflow: 'hidden' },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  topLeft: { justifyContent: 'flex-start', alignItems: 'flex-start', paddingRight: '30%' },
  bottomLeft: { justifyContent: 'flex-end', alignItems: 'flex-start', paddingRight: '20%' },
  center: { justifyContent: 'center', alignItems: 'center' },
  shadowed: textShadow,
  subtitle: { opacity: 0.9 },
  // Over imagery in both themes, so a fixed translucent white reads as a glass edge.
  edge: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', pointerEvents: 'none' },
});
