import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ExamScheduleList } from '@/components/exam/ExamScheduleList';
import { completeExamsAndCelebrate } from '@/components/home/CountdownCards';
import { AppText } from '@/components/ui/AppText';
import { CountdownBlocks } from '@/components/ui/CountdownBlocks';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { FadeInView } from '@/components/ui/FadeInView';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SettingRow } from '@/components/ui/SettingRow';
import { defaultTravelDate } from '@/data/seed';
import { illustrations } from '@/data/illustrations';
import { useCountdown } from '@/hooks/useCountdown';
import { useJourneyPhase } from '@/hooks/useJourneyPhase';
import { addToCalendarWithFeedback } from '@/services/calendarActions';
import { useAppStore } from '@/store/app';
import { countdownStartIso } from '@/store/selectors';
import { gradients, spacing } from '@/theme';
import { describeCountdown, formatLongDate, pad2, parseIso } from '@/utils/date';

function BigCountdown() {
  const examDate = useAppStore((s) => s.examDate);
  const journeyStartedAt = useAppStore((s) => s.journeyStartedAt);
  const countdown = useCountdown(examDate, { startIso: countdownStartIso(examDate, journeyStartedAt) });

  return (
    <GlassCard style={styles.centerCard} accessibilityLabel={`Exam countdown, ${describeCountdown(countdown)}`}>
      <ProgressRing progress={countdown.progress} size={224} strokeWidth={14} gradient={gradients.aurora}>
        <AppText variant="hero" tabular>
          {countdown.days}
        </AppText>
        <AppText variant="label" color="textSecondary">
          {countdown.days === 1 ? 'day to go' : 'days to go'}
        </AppText>
        <AppText variant="caption" color="textMuted" tabular style={styles.clock}>
          {pad2(countdown.hours)}:{pad2(countdown.minutes)}:{pad2(countdown.seconds)}
        </AppText>
      </ProgressRing>
      <CountdownBlocks parts={countdown} variant="boxes" style={styles.blocks} />
      <AppText variant="caption" color="textMuted" align="center">
        {Math.round(countdown.progress * 100)}% of your final stretch is behind you
      </AppText>
    </GlassCard>
  );
}

export default function ExamScreen() {
  const phase = useJourneyPhase();
  const examDate = useAppStore((s) => s.examDate);
  const travelDate = useAppStore((s) => s.travelDate);
  const examCompletedAt = useAppStore((s) => s.examCompletedAt);
  const notifications = useAppStore((s) => s.settings.notifications);
  const exam = parseIso(examDate);

  const changeExamDate = (next: Date) => {
    const app = useAppStore.getState();
    app.setExamDate(next.toISOString());
    // The trip home always follows the exam.
    if (parseIso(travelDate).getTime() <= next.getTime()) {
      app.setTravelDate(defaultTravelDate(next).toISOString());
    }
  };

  const canComplete = phase === 'exam-day';

  return (
    <Screen>
      <ScreenHeader
        title="Exam Countdown"
        right={
          <IconButton
            icon="calendar-plus"
            accessibilityLabel="Add exam to calendar"
            onPress={() => void addToCalendarWithFeedback()}
          />
        }
      />
      <View style={styles.stack}>
        <FadeInView>
          <HeroBanner
            source={illustrations['exam-countdown']}
            height={210}
            script={'Every hour counts.\nYou’ve got this ✍️'}
            overlayPosition="bottom-left"
          />
        </FadeInView>

        <FadeInView delay={60}>
          <BigCountdown />
        </FadeInView>

        <FadeInView delay={120}>
          <SectionHeader title="Final exam" />
          <GlassCard style={styles.gap}>
            <DateTimeField label="Date & time" value={exam} onChange={changeExamDate} mode="datetime" />
            <SettingRow
              icon="bell-ring-outline"
              gradient={gradients.sunset}
              label="Exam alerts"
              detail={
                notifications.enabled
                  ? 'The evening before and 2 hours before'
                  : 'Turn on reminders in Settings to get these'
              }
              value={notifications.examAlerts}
              onValueChange={(examAlerts) => useAppStore.getState().updateNotificationSettings({ examAlerts })}
            />
          </GlassCard>
        </FadeInView>

        <FadeInView delay={180}>
          <SectionHeader title="Exam schedule" />
          <ExamScheduleList />
        </FadeInView>

        <FadeInView delay={240} style={styles.gap}>
          {examCompletedAt ? (
            <GlassCard tint={gradients.success} style={styles.gap}>
              <AppText variant="title">Exams completed 🎓</AppText>
              <AppText variant="bodySm" color="textSecondary">
                Finished on {formatLongDate(parseIso(examCompletedAt))}. Time to head home.
              </AppText>
              <View style={styles.row}>
                <GradientButton
                  label="Celebrate again"
                  icon="party-popper"
                  size="md"
                  gradient={gradients.success}
                  onPress={() => router.push('/celebration')}
                />
                <GradientButton
                  label="Undo"
                  variant="ghost"
                  size="md"
                  onPress={() => useAppStore.getState().undoExamCompleted()}
                />
              </View>
            </GlassCard>
          ) : (
            <>
              <GradientButton
                label="I've finished my exams 🎉"
                gradient={gradients.sunset}
                size="lg"
                fullWidth
                disabled={!canComplete}
                onPress={completeExamsAndCelebrate}
              />
              {!canComplete ? (
                <AppText variant="caption" color="textMuted" align="center">
                  Unlocks on exam day — one step at a time.
                </AppText>
              ) : null}
            </>
          )}
        </FadeInView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xxl, marginTop: spacing.lg },
  centerCard: { alignItems: 'center', gap: spacing.lg },
  clock: { marginTop: spacing.xs },
  blocks: { alignSelf: 'stretch' },
  gap: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
