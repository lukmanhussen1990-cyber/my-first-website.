import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui/AppText';
import { GradientButton } from '@/components/ui/GradientButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { illustrations } from '@/data/illustrations';
import { gradients, palette, radii, SCREEN_GUTTER, spacing, useTheme } from '@/theme';

interface Slide {
  key: string;
  image: ImageSourcePropType;
  step: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'prepare',
    image: illustrations['onboarding-prepare'],
    step: 'Prepare',
    title: 'One final push',
    body: 'Plan every chapter, track every mission, and make these last days count.',
  },
  {
    key: 'complete',
    image: illustrations['onboarding-complete'],
    step: 'Complete',
    title: 'Finish strong',
    body: 'Live countdowns, streaks and an AI study buddy keep you calm, focused and on track.',
  },
  {
    key: 'go-home',
    image: illustrations['onboarding-go-home'],
    step: 'Go home',
    title: 'Then… home.',
    body: "Pack, book and count down the hours to the journey you've been dreaming of.",
  },
];

const PARALLAX = 0.18;

/** Full-bleed, swipeable story that opens the app: Prepare → Complete → Go home. */
export function StorySlides({ onFinish }: { onFinish: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  useAnimatedReaction(
    () => Math.round(scrollX.value / Math.max(width, 1)),
    (page, previous) => {
      if (page !== previous) scheduleOnRN(setIndex, page);
    },
    [width],
  );

  const isLast = index >= SLIDES.length - 1;
  const goNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  return (
    <View style={styles.flex}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, i) => (
          <SlidePage key={slide.key} slide={slide} index={i} width={width} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <AppText variant="overline" color="textOnAccent" style={styles.brand}>
          Last Mile
        </AppText>
        {!isLast ? (
          <PressableScale
            onPress={onFinish}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction"
            style={styles.skip}
          >
            <AppText variant="label" color="textOnAccent">
              Skip
            </AppText>
          </PressableScale>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <Dot key={slide.key} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>
        <GradientButton
          label={isLast ? "Let's begin" : 'Next'}
          icon="arrow-right"
          iconPosition="right"
          gradient={isLast ? gradients.sunset : gradients.violet}
          onPress={goNext}
          fullWidth
        />
      </View>
    </View>
  );
}

function SlidePage({
  slide,
  index,
  width,
  scrollX,
}: {
  slide: Slide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollX.value, range, [-width * PARALLAX, 0, width * PARALLAX], Extrapolation.CLAMP) },
      { scale: interpolate(scrollX.value, range, [1.08, 1, 1.08], Extrapolation.CLAMP) },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollX.value, range, [24, 0, 24], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={[styles.imageWrap, { width: width * (1 + PARALLAX * 2), left: -width * PARALLAX }, imageStyle]}>
        <Image source={slide.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      </Animated.View>
      <LinearGradient
        colors={['rgba(5,7,15,0.35)', 'rgba(5,7,15,0)', 'rgba(5,7,15,0.55)', palette.navy900]}
        locations={[0, 0.25, 0.6, 0.92]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.copy, { paddingBottom: insets.bottom + 150 }, textStyle]}>
        <AppText variant="overline" color={colors.textOnAccent} style={styles.step}>
          {`${index + 1} / ${SLIDES.length} · ${slide.step}`}
        </AppText>
        <AppText variant="display" color="textOnAccent" style={styles.title}>
          {slide.title}
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.82)">
          {slide.body}
        </AppText>
      </Animated.View>
    </View>
  );
}

function Dot({ index, width, scrollX }: { index: number; width: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value / Math.max(width, 1) - index);
    const t = Math.max(0, 1 - distance);
    return { width: 8 + 18 * t, opacity: 0.4 + 0.6 * t };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, overflow: 'hidden', justifyContent: 'flex-end' },
  imageWrap: { position: 'absolute', top: 0, bottom: 0 },
  copy: { paddingHorizontal: SCREEN_GUTTER + spacing.xs, gap: spacing.sm },
  step: { opacity: 0.9 },
  title: { marginTop: spacing.xs },
  topBar: {
    position: 'absolute',
    left: SCREEN_GUTTER,
    right: SCREEN_GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { letterSpacing: 3 },
  skip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(5,7,15,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    minHeight: 40,
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: SCREEN_GUTTER,
    right: SCREEN_GUTTER,
    bottom: 0,
    gap: spacing.xl,
  },
  dots: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
});
