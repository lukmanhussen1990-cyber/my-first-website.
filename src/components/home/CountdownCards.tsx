import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { CountdownBlocks } from '@/components/ui/CountdownBlocks';
import { CountdownRing } from '@/components/ui/CountdownRing';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconTile } from '@/components/ui/IconTile';
import { useCountdown } from '@/hooks/useCountdown';
import { haptic } from '@/services/haptics';
import { useAppStore } from '@/store/app';
import { countdownStartIso } from '@/store/selectors';
import { gradients, spacing } from '@/theme';
import type { JourneyPhase } from '@/types';
import { describeCountdown, formatLongDate, formatTime, parseIso } from '@/utils/date';

/** Marks the exams as done and opens the celebration. */
export function completeExamsAndCelebrate() {
  useAppStore.getState().markExamCompleted();
  haptic('success');
  router.push('/celebration');
}

export function ExamCountdownCard({ phase }: { phase: JourneyPhase }) {
  const examDate = useAppStore((s) => s.examDate);
  const journeyStartedAt = useAppStore((s) => s.journeyStartedAt);
  const examCompletedAt = useAppStore((s) => s.examCompletedAt);
  const countdown = useCountdown(examDate, { startIso: countdownStartIso(examDate, journeyStartedAt) });
  const exam = parseIso(examDate);

  if (phase === 'completed' || phase === 'home') {
    return (
      <GlassCard tint={gradients.success} onPress={() => router.push('/celebration')} accessibilityLabel="Exams completed">
        <View style={styles.row}>
          <IconTile icon="check-decagram" gradient={gradients.success} />
          <View style={styles.flex}>
            <AppText variant="title">Exams completed ✓</AppText>
            <AppText variant="bodySm" color="textSecondary">
              {examCompletedAt ? `Finished on ${formatLongDate(parseIso(examCompletedAt))}` : 'Every paper, done.'}
            </AppText>
          </View>
          <Badge label="🎉 Replay" tone="success" style={styles.center} />
        </View>
      </GlassCard>
    );
  }

  if (phase === 'exam-day') {
    return (
      <GlassCard tint={gradients.sunset}>
        <View style={styles.row}>
          <IconTile icon="party-popper" gradient={gradients.sunset} glow />
          <View style={styles.flex}>
            <AppText variant="title">{countdown.isPast ? 'Finished your last exam? 🎉' : 'Exam day is here 💪'}</AppText>
            <AppText variant="bodySm" color="textSecondary">
              {countdown.isPast
                ? "Tap when you walk out of the hall — let's celebrate."
                : `Starts at ${formatTime(exam)}. Breathe — you're ready.`}
            </AppText>
          </View>
        </View>
        {!countdown.isPast ? (
          <CountdownBlocks parts={countdown} variant="compact" tint={gradients.sunset} style={styles.blocks} />
        ) : null}
        <GradientButton
          label="Yes — I'm done with my exams!"
          icon="flag-checkered"
          gradient={gradients.sunset}
          fullWidth
          onPress={completeExamsAndCelebrate}
          style={styles.cta}
        />
      </GlassCard>
    );
  }

  return (
    <GlassCard
      onPress={() => router.push('/exam')}
      accessibilityLabel={`Final exam countdown, ${describeCountdown(countdown)}`}
      accessibilityHint="Opens the exam countdown and schedule"
    >
      <CountdownRing
        title="Final Exam Countdown"
        subtitle={`${formatLongDate(exam)} · ${formatTime(exam)}`}
        parts={countdown}
        progress={countdown.progress}
      />
    </GlassCard>
  );
}

export function GoingHomeCard({ phase }: { phase: JourneyPhase }) {
  const travelDate = useAppStore((s) => s.travelDate);
  const countdown = useCountdown(travelDate);
  const travel = parseIso(travelDate);
  const home = phase === 'home' || countdown.isPast;

  return (
    <GlassCard
      tint={gradients.sunset}
      onPress={() => router.push('/journey')}
      accessibilityLabel={home ? 'You are home' : `Going home countdown, ${describeCountdown(countdown)}`}
      accessibilityHint="Opens your home journey"
    >
      <View style={styles.row}>
        <IconTile icon="home-heart" gradient={gradients.sunset} />
        <View style={styles.flex}>
          <AppText variant="overline" color="highlight">
            Going home countdown
          </AppText>
          <AppText variant="title">{home ? 'Time to go home! 🚌' : 'Freedom Journey Begins'}</AppText>
          <AppText variant="bodySm" color="textSecondary">
            {`${formatLongDate(travel)} · ${formatTime(travel)}`}
          </AppText>
        </View>
      </View>
      {!home ? <CountdownBlocks parts={countdown} variant="boxes" tint={gradients.sunset} style={styles.blocks} /> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  center: { alignSelf: 'center' },
  blocks: { marginTop: spacing.lg },
  cta: { marginTop: spacing.lg },
});
