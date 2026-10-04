import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconTile } from '@/components/ui/IconTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useStreak } from '@/hooks/useStreak';
import { subjectProgress } from '@/store/selectors';
import { accents, gradients, radii, spacing, useTheme } from '@/theme';
import type { Subject } from '@/types';
import { fromDayKey, weekdayName } from '@/utils/date';

export function StreakCard() {
  const { colors } = useTheme();
  const streak = useStreak();

  return (
    <GlassCard tint={gradients.sunset} accessibilityLabel={`Study streak ${streak.current} days, best ${streak.best}`}>
      <View style={styles.row}>
        <IconTile icon="fire" gradient={gradients.sunset} glow />
        <View style={styles.flex}>
          <AppText variant="h3">
            {streak.current > 0 ? `${streak.current}-day streak` : 'Start your streak'}
          </AppText>
          <AppText variant="bodySm" color="textSecondary">
            {streak.current > 0 ? `Best: ${streak.best} days · keep the flame alive` : 'Finish one task today to light it'}
          </AppText>
        </View>
      </View>
      <View style={styles.week}>
        {streak.last7.map((entry) => (
          <View key={entry.day} style={styles.dayCol}>
            <View
              style={[
                styles.dayDot,
                entry.active
                  ? { backgroundColor: colors.highlight, borderColor: colors.highlight }
                  : { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
              ]}
            >
              {entry.active ? <AppText variant="caption" color="textOnAccent">✓</AppText> : null}
            </View>
            <AppText variant="caption" color="textMuted">
              {weekdayName(fromDayKey(entry.day), true).slice(0, 1)}
            </AppText>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

export function SubjectProgressCard({ subject }: { subject: Subject }) {
  const progress = subjectProgress(subject);
  const percent = Math.round(progress * 100);
  const accent = accents[subject.color];
  const done = subject.chapters.filter((chapter) => chapter.done).length;

  return (
    <GlassCard
      padding={spacing.md}
      onPress={() => router.push({ pathname: '/subject/[id]', params: { id: subject.id } })}
      accessibilityLabel={`${subject.name}, ${percent} percent complete`}
      accessibilityHint="Opens subject details"
    >
      <View style={styles.row}>
        <IconTile icon={subject.icon} gradient={accent.gradient} />
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <AppText variant="subtitle" numberOfLines={1} style={styles.flex}>
              {subject.name}
            </AppText>
            <AppText variant="label" tabular>
              {percent}%
            </AppText>
          </View>
          <ProgressBar progress={progress} gradient={accent.gradient} height={7} />
          <AppText variant="caption" color="textMuted">
            {done}/{subject.chapters.length} chapters
          </AppText>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  dayCol: { alignItems: 'center', gap: spacing.xs },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
