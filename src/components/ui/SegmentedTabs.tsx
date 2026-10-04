import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { haptic } from '@/services/haptics';
import { motion, radii, shadow, spacing, useTheme, type Gradient } from '@/theme';
import type { IconName } from '@/types';

export interface SegmentedTabOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedTabsProps<T extends string> {
  options: readonly SegmentedTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Horizontal scrolling with content-sized items (for many / long labels). */
  scrollable?: boolean;
  size?: 'sm' | 'md';
  /** Fill of the selected pill. */
  gradient?: Gradient;
  style?: StyleProp<ViewStyle>;
}

interface ItemLayout {
  x: number;
  width: number;
}

const DEFAULT_PILL: Gradient = ['#6D5BFF', '#3B82F6'];
const TRACK_PADDING = 4;
const ITEM_HEIGHT = { sm: 32, md: 38 } as const;
// Fixed (non-scrolling) tracks share spare width, so items need less padding of their own.
const PADDING = {
  scroll: { sm: spacing.md, md: spacing.lg },
  fixed: { sm: spacing.sm, md: spacing.md },
} as const;

/** Segmented control with a spring-animated gradient pill behind the selected item. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  scrollable = false,
  size = 'md',
  gradient = DEFAULT_PILL,
  style,
}: SegmentedTabsProps<T>) {
  const { colors } = useTheme();
  const [layouts, setLayouts] = useState<Partial<Record<T, ItemLayout>>>({});
  const scrollRef = useRef<ScrollView>(null);
  const placed = useRef(false);

  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillOpacity = useSharedValue(0);

  const selected = layouts[value];

  useEffect(() => {
    if (!selected) return;
    if (!placed.current) {
      // First measurement: jump into place instead of sliding in from 0.
      placed.current = true;
      pillX.set(selected.x);
      pillWidth.set(selected.width);
      pillOpacity.set(1);
    } else {
      pillX.set(withSpring(selected.x, motion.spring));
      pillWidth.set(withSpring(selected.width, motion.spring));
    }
    if (scrollable) {
      scrollRef.current?.scrollTo({ x: Math.max(0, selected.x - spacing.xxl), animated: true });
    }
  }, [selected, scrollable, pillX, pillWidth, pillOpacity]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.get(),
    width: pillWidth.get(),
    transform: [{ translateX: pillX.get() }],
  }));

  const handleLayout = (key: T) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const current = prev[key];
      if (current && current.x === x && current.width === width) return prev;
      return { ...prev, [key]: { x, width } };
    });
  };

  const select = (next: T) => {
    if (next === value) return;
    haptic('selection');
    onChange(next);
  };

  const height = ITEM_HEIGHT[size];
  const pillColor = gradient[gradient.length - 1];

  // The border lives on an outer shell so item `onLayout.x` and the absolutely
  // positioned pill share the same origin.
  const track = (
    <View
      style={[
        styles.shell,
        { backgroundColor: colors.card, borderColor: colors.border },
        scrollable ? null : styles.fullWidth,
      ]}
    >
      <View accessibilityRole="tablist" style={styles.track}>
        <Animated.View
          style={[
            styles.pill,
            { height, top: TRACK_PADDING, backgroundColor: pillColor },
            shadow('sm', pillColor),
            pillStyle,
          ]}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.pillFill]}
          />
        </Animated.View>
        {options.map((option) => {
          const active = option.value === value;
          const tint = active ? colors.textOnAccent : colors.textSecondary;
          return (
            <Pressable
              key={option.value}
              onPress={() => select(option.value)}
              onLayout={handleLayout(option.value)}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: active }}
              hitSlop={{ top: 6, bottom: 6 }}
              style={[
                styles.item,
                { height, paddingHorizontal: PADDING[scrollable ? 'scroll' : 'fixed'][size] },
                scrollable ? null : styles.grow,
              ]}
            >
              {option.icon ? (
                <Icon name={option.icon} size={size === 'sm' ? 14 : 16} color={tint} />
              ) : null}
              <AppText variant={size === 'sm' ? 'caption' : 'label'} color={tint} numberOfLines={1}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (!scrollable) return <View style={style}>{track}</View>;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={styles.scrollContent}
    >
      {track}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: radii.pill, borderWidth: 1 },
  track: { flexDirection: 'row', alignItems: 'center', padding: TRACK_PADDING },
  fullWidth: { alignSelf: 'stretch' },
  scrollContent: { flexGrow: 1 },
  pill: { position: 'absolute', left: 0, borderRadius: radii.pill, pointerEvents: 'none' },
  pillFill: { borderRadius: radii.pill },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    borderRadius: radii.pill,
  },
  // Share spare width evenly while letting longer labels ("Motivation") keep their size.
  grow: { flexGrow: 1, flexShrink: 1 },
});
