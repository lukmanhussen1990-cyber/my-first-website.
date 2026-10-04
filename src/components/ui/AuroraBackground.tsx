import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme, type Gradient } from '@/theme';

export type AuroraVariant = 'default' | 'sunset' | 'night';

export interface AuroraBackgroundProps {
  variant?: AuroraVariant;
}

interface BlobSpec {
  color: string;
  /** Centre as a fraction of the window. */
  cx: number;
  cy: number;
  /** Diameter as a fraction of the window width (capped on large screens). */
  size: number;
  /** Drift amplitude in px. */
  driftX: number;
  driftY: number;
  /** One leg of the reversing loop, in ms. */
  duration: number;
}

/** Upper bound (px) for the width blobs are sized against. */
const MAX_BLOB_BASE = 720;

interface AuroraPalette {
  background: Gradient;
  blobs: readonly [string, string, string];
}

/**
 * Variant palettes. `default` is the theme's own canvas; `sunset` warms the
 * blobs toward orange/pink (going-home moments); `night` deepens the canvas to
 * indigo (breathing, sleep).
 */
function paletteFor(variant: AuroraVariant, isDark: boolean, base: AuroraPalette): AuroraPalette {
  if (variant === 'sunset') {
    return isDark
      ? {
          background: ['#1A1233', '#120C24', '#07070F'],
          blobs: ['rgba(255, 94, 138, 0.26)', 'rgba(124, 92, 255, 0.18)', 'rgba(255, 138, 61, 0.26)'],
        }
      : {
          background: ['#FFF6F1', '#FCEFF4', '#F3ECFB'],
          blobs: ['rgba(255, 94, 138, 0.16)', 'rgba(124, 92, 255, 0.12)', 'rgba(255, 138, 61, 0.18)'],
        };
  }
  if (variant === 'night') {
    return isDark
      ? {
          background: ['#16123F', '#0B0B26', '#04050D'],
          blobs: ['rgba(99, 102, 241, 0.30)', 'rgba(34, 211, 238, 0.10)', 'rgba(124, 92, 255, 0.16)'],
        }
      : {
          background: ['#EEEBFF', '#E6E6FA', '#DFE3F6'],
          blobs: ['rgba(99, 102, 241, 0.18)', 'rgba(34, 211, 238, 0.10)', 'rgba(124, 92, 255, 0.14)'],
        };
  }
  return base;
}

/** Splits `rgba(r, g, b, a)` into an opaque colour + opacity for SVG stops. */
function toStop(color: string): { color: string; opacity: number } {
  const match = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(color);
  if (!match) return { color, opacity: 1 };
  return { color: `rgb(${match[1]}, ${match[2]}, ${match[3]})`, opacity: Number(match[4]) };
}

/**
 * Full-bleed canvas behind every screen: the theme's background gradient plus
 * three large, very soft colour blobs (purple top-left, cyan right, sunset
 * bottom-left) that drift slowly. Static when reduced motion is enabled.
 */
export function AuroraBackground({ variant = 'default' }: AuroraBackgroundProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const palette = paletteFor(variant, isDark, {
    background: colors.backgroundGradient,
    blobs: colors.aurora,
  });

  const blobs: BlobSpec[] = [
    { color: palette.blobs[0], cx: 0.12, cy: 0.1, size: 1.25, driftX: 28, driftY: 22, duration: 16000 },
    { color: palette.blobs[1], cx: 0.95, cy: 0.48, size: 1.1, driftX: -24, driftY: 30, duration: 19000 },
    { color: palette.blobs[2], cx: 0.08, cy: 0.92, size: 1.2, driftX: 26, driftY: -20, duration: 14000 },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      <LinearGradient colors={palette.background} style={StyleSheet.absoluteFill} />
      {blobs.map((blob, i) => (
        <AuroraBlob key={i} spec={blob} windowWidth={width} windowHeight={height} />
      ))}
    </View>
  );
}

function AuroraBlob({
  spec,
  windowWidth,
  windowHeight,
}: {
  spec: BlobSpec;
  windowWidth: number;
  windowHeight: number;
}) {
  const reducedMotion = useReducedMotion();
  // useId() can contain characters that are invalid inside an SVG `url(#…)` reference.
  const gradientId = `aurora-${useId().replace(/[^\w-]/g, '')}`;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.set(0);
      return;
    }
    progress.set(
      withRepeat(
        withTiming(1, { duration: spec.duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion, spec.duration]);

  const { driftX, driftY } = spec;
  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.get();
    return {
      transform: [
        { translateX: (t - 0.5) * 2 * driftX },
        { translateY: (t - 0.5) * 2 * driftY },
        { scale: 1 + t * 0.06 },
      ],
    };
  });

  // Capped so blobs stay soft (not giant flat washes) on tablets and desktop web.
  const size = spec.size * Math.min(windowWidth, MAX_BLOB_BASE);
  const stop = toStop(spec.color);

  return (
    <Animated.View
      style={[
        styles.blob,
        {
          width: size,
          height: size,
          left: spec.cx * windowWidth - size / 2,
          top: spec.cy * windowHeight - size / 2,
        },
        animatedStyle,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={stop.color} stopOpacity={stop.opacity} />
            <Stop offset="0.45" stopColor={stop.color} stopOpacity={stop.opacity * 0.55} />
            <Stop offset="1" stopColor={stop.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
  blob: { position: 'absolute' },
});
