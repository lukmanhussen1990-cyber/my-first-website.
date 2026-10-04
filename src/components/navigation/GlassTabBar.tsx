import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { gradients, motion, radii, shadow, TAB_BAR_HEIGHT, useTheme, withAlpha } from '@/theme';
import type { IconName } from '@/types';

interface TabMeta {
  label: string;
  icon: IconName;
  activeIcon: IconName;
}

/** Tab metadata keyed by route name inside the (tabs) group. */
const TABS: Record<string, TabMeta> = {
  index: { label: 'Home', icon: 'home-variant-outline', activeIcon: 'home-variant' },
  planner: { label: 'Planner', icon: 'calendar-check-outline', activeIcon: 'calendar-check' },
  assistant: { label: 'Buddy', icon: 'robot-happy-outline', activeIcon: 'robot-happy' },
  journey: { label: 'Journey', icon: 'bus-side', activeIcon: 'bus-side' },
  journal: { label: 'Journal', icon: 'book-heart-outline', activeIcon: 'book-heart' },
};

const CENTER_ROUTE = 'assistant';
const INDICATOR_WIDTH = 46;
const CENTER_SIZE = 58;

/**
 * Floating glass tab bar: a blurred pill hovering above the home indicator,
 * with a sliding gradient highlight and a raised "Buddy" button in the centre.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const keyboardOpen = useKeyboardOpen();

  const count = state.routes.length;
  const itemWidth = count > 0 ? barWidth / count : 0;
  const activeRoute = state.routes[state.index]?.name;
  const centerActive = activeRoute === CENTER_ROUTE;

  const indicatorX = useSharedValue(0);
  useEffect(() => {
    if (!itemWidth) return;
    indicatorX.value = withSpring(state.index * itemWidth + (itemWidth - INDICATOR_WIDTH) / 2, motion.spring);
  }, [state.index, itemWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  // Android resizes the window for the keyboard, which would float the bar above it.
  if (Platform.OS === 'android' && keyboardOpen) return null;

  const onLayout = (event: LayoutChangeEvent) => setBarWidth(event.nativeEvent.layout.width);

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 10 }]}>
      <View
        onLayout={onLayout}
        style={[
          styles.bar,
          { borderColor: colors.border, backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.tabBar },
          shadow('lg', colors.shadow),
        ]}
      >
        {Platform.OS === 'ios' || Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, styles.clip]}>
            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
          </View>
        ) : null}

        {itemWidth > 0 ? (
          <Animated.View style={[styles.indicator, indicatorStyle, { opacity: centerActive ? 0 : 1 }]}>
            <LinearGradient
              colors={[withAlpha(colors.primary, 0.25), withAlpha(colors.accent, 0.18)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}

        {state.routes.map((route, index) => {
          const meta = TABS[route.name] ?? { label: route.name, icon: 'circle-outline', activeIcon: 'circle' };
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label = typeof options?.title === 'string' ? options.title : meta.label;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          if (route.name === CENTER_ROUTE) {
            return (
              <PressableScale
                key={route.key}
                onPress={onPress}
                haptic="selection"
                scaleTo={0.92}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={`${label}, AI study assistant`}
                style={styles.item}
              >
                <View style={[styles.centerLift, shadow('glow', gradients.primary[0])]}>
                  <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.centerButton, focused && styles.centerFocused]}
                  >
                    <Icon name={focused ? meta.activeIcon : meta.icon} size={28} color={colors.textOnAccent} />
                  </LinearGradient>
                </View>
                <AppText variant="caption" color={focused ? 'text' : 'textMuted'} style={styles.centerLabel}>
                  {label}
                </AppText>
              </PressableScale>
            );
          }

          return (
            <PressableScale
              key={route.key}
              onPress={onPress}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.item}
            >
              <View style={styles.iconSlot}>
                <Icon name={focused ? meta.activeIcon : meta.icon} size={24} color={focused ? 'text' : 'textMuted'} />
              </View>
              <AppText variant="caption" color={focused ? 'text' : 'textMuted'} numberOfLines={1}>
                {label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    pointerEvents: 'box-none',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 520,
    height: TAB_BAR_HEIGHT,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clip: { borderRadius: 30, overflow: 'hidden' },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 9,
    width: INDICATOR_WIDTH,
    height: 32,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconSlot: { height: 32, justifyContent: 'center', alignItems: 'center' },
  centerLift: {
    marginTop: -30,
    borderRadius: CENTER_SIZE / 2,
  },
  centerButton: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  centerFocused: { borderColor: 'rgba(255,255,255,0.45)' },
  centerLabel: { marginTop: 2 },
});
