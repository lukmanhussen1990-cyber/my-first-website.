import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconTile } from '@/components/ui/IconTile';
import { haptic } from '@/services/haptics';
import {
  gradients,
  MAX_CONTENT_WIDTH,
  motion,
  radii,
  SCREEN_GUTTER,
  spacing,
  useTheme,
  withAlpha,
  type Gradient,
} from '@/theme';
import type { IconName } from '@/types';

export interface ToastProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: IconName;
  gradient?: Gradient;
  /** Called once per showing: on tap, swipe-up or after `duration`. Set `visible` false in response. */
  onHide: () => void;
  /** Auto-hide delay in ms; 0 keeps the toast until it is dismissed. */
  duration?: number;
}

const AUTO_HIDE_MS = 3500;
const OFFSCREEN = 160;
const ENTER_SPRING = { damping: 15, stiffness: 170, mass: 0.9 } as const;
/** Upward travel (px) or speed (px/s) that dismisses the toast. */
const SWIPE_DISTANCE = 24;
const SWIPE_VELOCITY = 400;

/**
 * Keeps the last content shown while `visible` so the toast doesn't blank out
 * during its exit animation when the parent clears its props.
 */
function useHeldContent<T>(visible: boolean, key: string, value: T): T {
  const [held, setHeld] = useState({ key, value });
  if (visible && held.key !== key) setHeld({ key, value });
  return visible ? value : held.value;
}

interface ToastShellProps {
  visible: boolean;
  /** Identifies the content; a new key while visible replays the entrance and restarts the timer. */
  contentKey: string;
  onHide: () => void;
  duration: number;
  accessibilityLabel: string;
  tint?: Gradient;
  onShow?: () => void;
  children: ReactNode;
}

/** Positioning, spring/fade animation, auto-hide, tap and swipe-up dismissal. */
function ToastShell({
  visible,
  contentKey,
  onHide,
  duration,
  accessibilityLabel,
  tint,
  onShow,
  children,
}: ToastShellProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  // Guards against calling `onHide` twice for one showing (e.g. tap during the auto-hide).
  const dismissed = useSharedValue(false);

  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) setRendered(true);

  const dismiss = () => {
    if (dismissed.get()) return;
    dismissed.set(true);
    onHide();
  };
  const unmount = () => setRendered(false);

  const shown = useEffectEvent(() => {
    onShow?.();
    AccessibilityInfo.announceForAccessibility(accessibilityLabel);
  });
  const autoHide = useEffectEvent(() => dismiss());

  useEffect(() => {
    if (!visible) {
      progress.set(
        withTiming(0, { duration: motion.base, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(unmount);
        }),
      );
      return;
    }
    dismissed.set(false);
    drag.set(0);
    progress.set(0);
    progress.set(reduceMotion ? withTiming(1, { duration: motion.fast }) : withSpring(1, ENTER_SPRING));
    shown();
    if (!duration) return;
    const timer = setTimeout(autoHide, duration);
    return () => clearTimeout(timer);
  }, [visible, contentKey, duration, reduceMotion, progress, drag, dismissed]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const travel = reduceMotion ? 0 : -OFFSCREEN * (1 - p);
    return {
      opacity: interpolate(p, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: travel + drag.get() },
        { scale: reduceMotion ? 1 : interpolate(p, [0, 1], [0.94, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const swipe = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      // Follows the finger upwards; resists pulling down.
      drag.set(event.translationY < 0 ? event.translationY : event.translationY * 0.15);
    })
    .onEnd((event) => {
      if (event.translationY < -SWIPE_DISTANCE || event.velocityY < -SWIPE_VELOCITY) {
        scheduleOnRN(dismiss);
      } else {
        drag.set(withSpring(0, motion.spring));
      }
    });

  if (!rendered) return null;

  // Android has no live backdrop blur, so the glass needs to be nearly opaque to stay legible.
  const fillAlpha = Platform.OS === 'android' ? 0.97 : isDark ? 0.8 : 0.88;

  return (
    <View style={[styles.host, { top: insets.top + spacing.sm }]}>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.toast, animatedStyle]}>
          <GlassCard
            blur
            tint={tint}
            padding={spacing.md}
            radius={radii.lg}
            onPress={dismiss}
            accessibilityLabel={`${accessibilityLabel}. Tap to dismiss.`}
            style={{ backgroundColor: withAlpha(colors.surface, fillAlpha) }}
          >
            {children}
          </GlassCard>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function ToastText({ overline, title, message }: { overline?: string; title: string; message?: string }) {
  return (
    <View style={styles.text}>
      {overline ? (
        <AppText variant="overline" color="warning" numberOfLines={1}>
          {overline}
        </AppText>
      ) : null}
      <AppText variant="title" numberOfLines={2}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="bodySm" color="textSecondary" numberOfLines={3}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Transient notice that springs down from the top safe area, auto-hides after
 * 3.5 s and dismisses on tap or swipe-up. Render it once over the screen
 * content (it positions itself absolutely at the top of its parent).
 */
export function Toast({
  visible,
  title,
  message,
  icon,
  gradient = gradients.primary,
  onHide,
  duration = AUTO_HIDE_MS,
}: ToastProps) {
  const key = [title, message, icon, gradient.join()].join('|');
  const content = useHeldContent(visible, key, { title, message, icon, gradient });

  return (
    <ToastShell
      visible={visible}
      contentKey={key}
      onHide={onHide}
      duration={duration}
      accessibilityLabel={content.message ? `${content.title}. ${content.message}` : content.title}
    >
      <View style={styles.row}>
        {content.icon ? <IconTile icon={content.icon} gradient={content.gradient} size="sm" /> : null}
        <ToastText title={content.title} message={content.message} />
      </View>
    </ToastShell>
  );
}

const ACHIEVEMENT_OVERLINE = 'Achievement unlocked';

/** Gold celebratory toast for a newly unlocked badge; fires a success haptic when shown. */
export function AchievementToast({
  visible,
  title,
  message,
  icon = 'trophy',
  gradient = gradients.gold,
  onHide,
  duration = AUTO_HIDE_MS,
}: ToastProps) {
  const key = [title, message, icon, gradient.join()].join('|');
  const content = useHeldContent(visible, key, { title, message, icon, gradient });
  const label = [ACHIEVEMENT_OVERLINE, content.title, content.message].filter(Boolean).join('. ');

  return (
    <ToastShell
      visible={visible}
      contentKey={key}
      onHide={onHide}
      duration={duration}
      accessibilityLabel={label}
      tint={content.gradient}
      onShow={() => haptic('success')}
    >
      <View style={styles.row}>
        <IconTile icon={content.icon} gradient={content.gradient} size="md" glow />
        <ToastText overline={ACHIEVEMENT_OVERLINE} title={content.title} message={content.message} />
      </View>
    </ToastShell>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: SCREEN_GUTTER,
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: 'box-none',
  },
  toast: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH - SCREEN_GUTTER * 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
});
