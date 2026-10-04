import { useEffect, useEffectEvent, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { palette, spacing, useTheme } from '@/theme';

export interface BrandSplashOverlayProps {
  /** Called once the overlay has fully faded out; unmount it then. */
  onDone: () => void;
}

const LOGO_SIZE = 112;
const GLOW_SIZE = 420;
/** Time from mount until the fade-out starts. */
const HOLD_MS = 1100;
const FADE_OUT_MS = 350;
const REDUCED_HOLD_MS = 900;
const REDUCED_FADE_OUT_MS = 220;
const TEXT_IN_MS = 420;
const TEXT_STAGGER_MS = 130;
// Ease-out-quint: quick lift, long soft settle.
const SETTLE = Easing.bezier(0.22, 1, 0.36, 1);
const LOGO_SPRING = { damping: 13, stiffness: 160, mass: 0.9 } as const;

/**
 * Cold-start brand moment shown over the first screen right after the native
 * splash hides: the mark springs in, the name and tagline rise in with a short
 * stagger, then everything fades away. Reduced motion → static content and a
 * quick fade. Touches pass through while it fades out.
 */
export function BrandSplashOverlay({ onDone }: BrandSplashOverlayProps) {
  const { colors, isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const [fading, setFading] = useState(false);

  const overlay = useSharedValue(1);
  const logo = useSharedValue(reducedMotion ? 1 : 0);
  const title = useSharedValue(reducedMotion ? 1 : 0);
  const tagline = useSharedValue(reducedMotion ? 1 : 0);

  const finish = useEffectEvent(() => onDone());

  useEffect(() => {
    if (!reducedMotion) {
      logo.set(withSpring(1, LOGO_SPRING));
      title.set(withDelay(TEXT_STAGGER_MS, withTiming(1, { duration: TEXT_IN_MS, easing: SETTLE })));
      tagline.set(withDelay(TEXT_STAGGER_MS * 2, withTiming(1, { duration: TEXT_IN_MS, easing: SETTLE })));
    }

    const timer = setTimeout(
      () => {
        setFading(true);
        overlay.set(
          withTiming(
            0,
            { duration: reducedMotion ? REDUCED_FADE_OUT_MS : FADE_OUT_MS, easing: Easing.out(Easing.quad) },
            (finished) => {
              if (finished) scheduleOnRN(finish);
            },
          ),
        );
      },
      reducedMotion ? REDUCED_HOLD_MS : HOLD_MS,
    );

    return () => {
      clearTimeout(timer);
      [overlay, logo, title, tagline].forEach(cancelAnimation);
    };
  }, [reducedMotion, overlay, logo, title, tagline]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.get() }));
  const logoStyle = useAnimatedStyle(() => {
    const p = logo.get();
    return {
      opacity: interpolate(p, [0, 0.6], [0, 1], 'clamp'),
      transform: [{ scale: interpolate(p, [0, 1], [0.8, 1]) }],
    };
  });

  return (
    <Animated.View
      aria-hidden
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: colors.background, pointerEvents: fading ? 'none' : 'auto' },
        overlayStyle,
      ]}
    >
      <BackdropGlow isDark={isDark} />

      <View style={styles.content}>
        <Animated.View style={[styles.logo, logoStyle]}>
          <LogoGlow isDark={isDark} />
          <LogoMark size={LOGO_SIZE} />
        </Animated.View>

        <RiseIn progress={title}>
          <AppText variant="display" align="center">
            Last Mile
          </AppText>
        </RiseIn>
        <RiseIn progress={tagline}>
          <AppText variant="script" color="textSecondary" align="center" style={styles.tagline}>
            One final push before freedom.
          </AppText>
        </RiseIn>
      </View>
    </Animated.View>
  );
}

function RiseIn({ progress, children }: { progress: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: p, transform: [{ translateY: interpolate(p, [0, 1], [12, 0]) }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Soft violet glow sitting directly behind the mark. */
function LogoGlow({ isDark }: { isDark: boolean }) {
  const gradientId = `splash-logo-glow-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <Svg width={GLOW_SIZE} height={GLOW_SIZE} style={styles.logoGlow}>
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={palette.purple} stopOpacity={isDark ? 0.5 : 0.28} />
          <Stop offset="0.45" stopColor={palette.sunsetPink} stopOpacity={isDark ? 0.14 : 0.08} />
          <Stop offset="1" stopColor={palette.purple} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={GLOW_SIZE} height={GLOW_SIZE} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

/** Faint aurora wash across the whole overlay: violet from the top, sunset from the bottom. */
function BackdropGlow({ isDark }: { isDark: boolean }) {
  const uid = useId().replace(/[^\w-]/g, '');
  const top = `splash-aurora-top-${uid}`;
  const bottom = `splash-aurora-bottom-${uid}`;
  const strength = isDark ? 1 : 0.6;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={top} cx="30%" cy="18%" r="75%">
          <Stop offset="0" stopColor={palette.purple} stopOpacity={0.26 * strength} />
          <Stop offset="1" stopColor={palette.purple} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={bottom} cx="70%" cy="100%" r="70%">
          <Stop offset="0" stopColor={palette.sunset} stopOpacity={0.16 * strength} />
          <Stop offset="0.5" stopColor={palette.sunsetPink} stopOpacity={0.06 * strength} />
          <Stop offset="1" stopColor={palette.sunsetPink} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${top})`} />
      <Rect width="100%" height="100%" fill={`url(#${bottom})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1000,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    left: (LOGO_SIZE - GLOW_SIZE) / 2,
    top: (LOGO_SIZE - GLOW_SIZE) / 2,
  },
  tagline: {
    marginTop: spacing.xs,
  },
});
