import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { FeatureTile } from '@/components/ui/FeatureTile';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { IconTile } from '@/components/ui/IconTile';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { QuoteCard } from '@/components/ui/QuoteCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TaskRow } from '@/components/ui/TaskRow';
import { achievementDefs } from '@/data/achievements';
import { illustrations } from '@/data/illustrations';
import { useDailyQuote } from '@/hooks/useDailyQuote';
import { useNow } from '@/hooks/useNow';
import { usePreparation } from '@/hooks/usePreparation';
import { useStreak } from '@/hooks/useStreak';
import { useAppStore } from '@/store/app';
import { usePlannerStore } from '@/store/planner';
import { subjectById, tasksForDay } from '@/store/selectors';
import { accents, gradients, spacing, type Gradient } from '@/theme';
import type { IconName } from '@/types';
import { toDayKey } from '@/utils/date';

export function PreparationCard() {
  const prep = usePreparation();
  const streak = useStreak();
  const percent = Math.round(prep.progress * 100);

  return (
    <GlassCard
      onPress={() => router.push('/planner')}
      accessibilityLabel={`Preparation level ${percent} percent`}
      accessibilityHint="Opens the study planner"
    >
      <View style={styles.row}>
        <ProgressRing progress={prep.progress} size={88} strokeWidth={9} gradient={gradients.primary}>
          <AppText variant="h3" tabular>
            {percent}%
          </AppText>
        </ProgressRing>
        <View style={styles.flex}>
          <AppText variant="overline" color="accent">
            Progress
          </AppText>
          <AppText variant="title">Preparation Level</AppText>
          <AppText variant="bodySm" color="textSecondary">
            {prep.total > 0
              ? `${prep.done} of ${prep.total} chapters complete`
              : 'Add your subjects to start tracking'}
          </AppText>
          <View style={styles.badges}>
            <Badge
              label={streak.current > 0 ? `🔥 ${streak.current}-day streak` : 'Start a streak today'}
              tone="sunset"
              size="sm"
            />
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

export function DailyMission() {
  const tasks = usePlannerStore((s) => s.tasks);
  const subjects = usePlannerStore((s) => s.subjects);
  const toggleTask = usePlannerStore((s) => s.toggleTask);
  const today = toDayKey(useNow(60_000));
  const todays = useMemo(() => tasksForDay(tasks, today), [tasks, today]);
  const done = todays.filter((task) => task.done).length;

  return (
    <View>
      <SectionHeader
        title="Daily Mission"
        caption={todays.length ? `${done}/${todays.length}` : undefined}
        actionLabel="Planner"
        onAction={() => router.push('/planner')}
      />
      {todays.length ? (
        <View style={styles.list}>
          {todays.map((task) => (
            <TaskRow
              key={task.id}
              title={task.title}
              detail={task.detail ?? subjectById(subjects, task.subjectId)?.name}
              checked={task.done}
              onToggle={() => toggleTask(task.id)}
            />
          ))}
          {done === todays.length ? (
            <AppText variant="bodySm" color="success" align="center" style={styles.allDone}>
              Every mission done today — proud of you ✨
            </AppText>
          ) : null}
        </View>
      ) : (
        <GlassCard style={styles.emptyCard}>
          <AppText variant="subtitle">No missions planned for today</AppText>
          <AppText variant="bodySm" color="textSecondary">
            Pick 2–3 small, concrete goals. Small wins build momentum.
          </AppText>
          <GradientButton label="Plan today" icon="plus" size="md" onPress={() => router.push('/planner')} />
        </GlassCard>
      )}
    </View>
  );
}

export function DailyQuote() {
  const quote = useDailyQuote();
  return <QuoteCard quote={quote.text} author={quote.author} />;
}

interface Feature {
  label: string;
  icon: IconName;
  gradient: Gradient;
  href: Href;
}

const FEATURES: Feature[] = [
  { label: 'Study Plan', icon: 'calendar-check', gradient: accents.blue.gradient, href: '/planner' },
  { label: 'Subjects', icon: 'bookshelf', gradient: accents.purple.gradient, href: '/planner' },
  { label: 'AI Assistant', icon: 'robot-happy', gradient: accents.indigo.gradient, href: '/assistant' },
  { label: 'Travel Plan', icon: 'bus-side', gradient: accents.green.gradient, href: '/journey' },
  { label: 'Checklist', icon: 'clipboard-check-outline', gradient: accents.orange.gradient, href: '/checklist' },
  { label: 'Journal', icon: 'book-heart', gradient: accents.pink.gradient, href: '/journal' },
];

export function FeatureGrid() {
  return (
    <View style={styles.grid}>
      {FEATURES.map((feature) => (
        <FeatureTile
          key={feature.label}
          icon={feature.icon}
          label={feature.label}
          gradient={feature.gradient}
          onPress={() => router.push(feature.href)}
          style={styles.tile}
        />
      ))}
    </View>
  );
}

export function CalmBanner() {
  return (
    <HeroBanner
      source={illustrations['stress-relief']}
      height={132}
      script={'Feeling the pressure?\nTake a 1-minute breath 🌿'}
      overlayPosition="center"
      onPress={() => router.push('/stress')}
      accessibilityLabel="Open stress control"
      accessibilityHint="Breathing exercises, motivation and sleep reminders"
    />
  );
}

export function WinsStrip() {
  const unlocked = useAppStore((s) => s.unlockedAchievements);
  const earned = useMemo(
    () =>
      achievementDefs
        .filter((def) => unlocked[def.id])
        .sort((a, b) => (unlocked[b.id] ?? '').localeCompare(unlocked[a.id] ?? '')),
    [unlocked],
  );
  const next = achievementDefs.find((def) => !unlocked[def.id]);

  return (
    <View>
      <SectionHeader
        title="Your wins"
        caption={`${earned.length}/${achievementDefs.length}`}
        actionLabel="See all"
        onAction={() => router.push('/achievements')}
      />
      <GlassCard onPress={() => router.push('/achievements')} accessibilityLabel="Your achievements">
        {earned.length ? (
          <View style={styles.wins}>
            {earned.slice(0, 4).map((def) => (
              <View key={def.id} style={styles.win}>
                <IconTile icon={def.icon} gradient={def.gradient} size="md" glow />
                <AppText variant="caption" color="textSecondary" align="center" numberOfLines={2}>
                  {def.title}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {next ? (
          <View style={[styles.row, earned.length ? styles.nextDivider : null]}>
            <IconTile icon="lock-outline" gradient={gradients.night} size="sm" />
            <View style={styles.flex}>
              <AppText variant="label">Next: {next.title}</AppText>
              <AppText variant="caption" color="textMuted">
                {next.hint}
              </AppText>
            </View>
          </View>
        ) : null}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', marginTop: spacing.xs },
  list: { gap: spacing.sm },
  allDone: { marginTop: spacing.xs },
  emptyCard: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexBasis: '30%', flexGrow: 1 },
  wins: { flexDirection: 'row', gap: spacing.md },
  win: { flex: 1, alignItems: 'center', gap: spacing.xs },
  nextDivider: { marginTop: spacing.lg },
});
