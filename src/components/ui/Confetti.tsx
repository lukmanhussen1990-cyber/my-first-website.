import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DEFAULT_COLORS = ['#7C5CFF', '#22D3EE', '#FF8A3D', '#FF5E8A', '#FFC857', '#34D399'];

/** Linear air drag (1/s): particles burst fast, then flutter down at terminal velocity. */
const DRAG = 1.7;
/** Fraction of the timeline over which particles fade out at the end. */
const FADE_PORTION = 0.22;
/** Max stagger between particles, as a fraction of the timeline. */
const MAX_DELAY = 0.12;

export interface ConfettiProps {
  /** A rising edge (false → true) fires one burst. */
  active: boolean;
  count?: number;
  /** Burst length in ms. */
  duration?: number;
  /** Called once the burst finishes (immediately when reduced motion is on). */
  onDone?: () => void;
  colors?: string[];
}

interface Particle {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  /** Terminal fall speed (px/s). */
  fall: number;
  sway: number;
  swayFreq: number;
  phase: number;
  spin: number;
  flip: number;
  delay: number;
  width: number;
  height: number;
  round: boolean;
  color: string;
}

/** Deterministic pseudo-random in [0, 1) for a particle index + salt. */
function rand(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Launch parameters for every particle. Velocities are in px/s and scale with
 * the container so the burst fills phones and tablets alike; the terminal fall
 * speed scales with `seconds` so each piece crosses the screen within the burst.
 */
function createParticles(
  count: number,
  width: number,
  height: number,
  seconds: number,
  palette: readonly string[],
): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const r = (salt: number) => rand(i, salt);
    const emitter = i % 3; // 0 = top centre, 1 = left edge, 2 = right edge
    const round = r(1) < 0.35;
    const size = 6 + r(2) * 5;

    let x0: number;
    let y0: number;
    let vx: number;
    let vy: number;
    if (emitter === 0) {
      // Pop from just below the top centre, spraying outwards in every direction.
      const angle = r(3) * Math.PI * 2;
      const speed = 0.35 + r(4) * 0.75;
      x0 = width / 2;
      y0 = height * 0.16;
      vx = Math.cos(angle) * speed * width * 1.6;
      vy = Math.sin(angle) * speed * height * 0.55;
    } else {
      // Side cannons aimed up and inwards.
      const dir = emitter === 1 ? 1 : -1;
      x0 = emitter === 1 ? -8 : width + 8;
      y0 = height * (0.32 + r(3) * 0.16);
      vx = dir * (0.55 + r(4) * 0.9) * width;
      vy = -(0.45 + r(5) * 0.55) * height;
    }

    return {
      x0,
      y0,
      vx,
      vy,
      fall: (height * (0.95 + r(6) * 0.55)) / seconds,
      sway: 8 + r(7) * 22,
      swayFreq: 2 + r(8) * 4,
      phase: r(9) * Math.PI * 2,
      spin: (r(10) - 0.5) * 900,
      flip: 4 + r(11) * 8,
      delay: r(12) * MAX_DELAY,
      width: round ? size * 0.85 : size,
      height: round ? size * 0.85 : size * (1.4 + r(13) * 0.6),
      round,
      color: palette[i % palette.length] ?? DEFAULT_COLORS[0],
    };
  });
}

function ConfettiParticle({
  particle: p,
  progress,
  seconds,
}: {
  particle: Particle;
  progress: SharedValue<number>;
  seconds: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    const local = Math.max(0, t - p.delay);
    const tau = local * seconds;
    // Closed-form motion under gravity with linear drag (terminal velocity = p.fall).
    const decay = (1 - Math.exp(-DRAG * tau)) / DRAG;
    const x = p.x0 + p.vx * decay + p.sway * Math.sin(p.swayFreq * tau + p.phase) * Math.min(1, tau);
    const y = p.y0 + (p.vy - p.fall) * decay + p.fall * tau;
    const fadeStart = 1 - FADE_PORTION;
    const opacity = t <= p.delay ? 0 : t < fadeStart ? 1 : Math.max(0, (1 - t) / FADE_PORTION);
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${p.spin * tau}deg` },
        // Squash on one axis to fake a paper flip without 3D transforms.
        { scaleY: Math.cos(p.flip * tau + p.phase) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: p.width,
          height: p.height,
          marginLeft: -p.width / 2,
          marginTop: -p.height / 2,
          borderRadius: p.round ? p.width / 2 : 2,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
}

/**
 * Full-screen confetti burst. One shared progress value drives every particle
 * on the UI thread. Renders nothing with reduced motion (but still calls `onDone`).
 */
export function Confetti({ active, count = 80, duration = 3200, onDone, colors }: ConfettiProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Tracks the current burst so particles unmount once it has finished.
  const [burst, setBurst] = useState({ active, finished: !active });
  if (burst.active !== active) {
    setBurst({ active, finished: !active });
  }

  const seconds = Math.max(0.5, duration / 1000);
  const palette = colors?.length ? colors : DEFAULT_COLORS;
  const particles = useMemo(
    () =>
      size.width
        ? createParticles(Math.max(0, Math.round(count)), size.width, size.height, seconds, palette)
        : [],
    [count, size.width, size.height, seconds, palette],
  );

  const notifyDone = useEffectEvent(() => onDone?.());
  const finish = useEffectEvent(() => {
    setBurst((current) => ({ ...current, finished: true }));
    onDone?.();
  });

  useEffect(() => {
    if (!active) return;
    if (reduceMotion) {
      // Nothing is drawn, but callers still chain on completion (e.g. navigate on).
      notifyDone();
      return;
    }
    progress.set(0);
    progress.set(
      withTiming(1, { duration, easing: Easing.linear }, (completed) => {
        if (completed) scheduleOnRN(finish);
      }),
    );
    return () => cancelAnimation(progress);
  }, [active, duration, reduceMotion, progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  const showParticles = active && !reduceMotion && !burst.finished;

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {showParticles
        ? particles.map((particle, index) => (
            <ConfettiParticle key={index} particle={particle} progress={progress} seconds={seconds} />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
