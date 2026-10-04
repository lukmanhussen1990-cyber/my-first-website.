import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BadgeCard } from '@/components/achievements/BadgeCard';
import { AppText } from '@/components/ui/AppText';
import { FadeInView } from '@/components/ui/FadeInView';
import { GlassCard } from '@/components/ui/GlassCard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { IconTile } from '@/components/ui/IconTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { achievementDefs } from '@/data/achievements';
import { illustrations } from '@/data/illustrations';
import { usePreparation } from '@/hooks/usePreparation';
import { useStreak } from '@/hooks/useStreak';
import { useAppStore } from '@/store/app';
import { useJournalStore } from '@/store/journal';
import { accents, gradients, motion, spacing, type Gradient } from '@/theme';
import type { IconName } from '@/types';

function StatTile({ icon, gradient, value, label }: { icon: IconName; gradient: Gradient; value: string; label: string }) {
  return (
    <GlassCard style={styles.stat} padding={spacing.sm} accessibilityLabel={`${label}: ${value}`}>
      <IconTile icon={icon} gradient={gradient} size="sm" />
      <AppText variant="h3" tabular>
        {value}
      </AppText>
      <AppText variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </AppText>
    </GlassCard>
  );
}

export default function AchievementsScreen() {
  const unlocked = useAppStore((s) => s.unlockedAchievements);
  const stats = useAppStore((s) => s.stats);
  const memories = useJournalStore((s) => s.memories);
  const streak = useStreak();
  const prep = usePreparation();

  const ordered = useMemo(
    () => [...achievementDefs].sort((a, b) => Number(Boolean(unlocked[b.id])) - Number(Boolean(unlocked[a.id]))),
    [unlocked],
  );
  const earned = achievementDefs.filter((def) => unlocked[def.id]).length;

  const rows: (typeof ordered)[] = [];
  for (let i = 0; i < ordered.length; i += 2) rows.push(ordered.slice(i, i + 2));

  return (
    <Screen>
      <ScreenHeader title="Achievements" />
      <View style={styles.stack}>
        <FadeInView>
          <HeroBanner
            source={illustrations.achievement}
            height={200}
            script="Your wins so far ✨"
            scriptVariant="scriptLg"
            overlayPosition="bottom-left"
          >
            <View style={styles.heroBody}>
              <AppText variant="label" color="textOnAccent">
                {earned} of {achievementDefs.length} badges unlocked
              </AppText>
              <ProgressBar progress={earned / achievementDefs.length} gradient={gradients.gold} height={6} />
            </View>
          </HeroBanner>
        </FadeInView>

        <FadeInView delay={60} style={styles.stats}>
          <StatTile icon="fire" gradient={gradients.sunset} value={`${streak.current}`} label="Streak" />
          <StatTile icon="book-check" gradient={accents.purple.gradient} value={`${prep.done}`} label="Chapters" />
          <StatTile icon="meditation" gradient={accents.cyan.gradient} value={`${stats.breathingSessions}`} label="Calm" />
          <StatTile icon="image-multiple" gradient={accents.pink.gradient} value={`${memories.length}`} label="Memories" />
        </FadeInView>

        <View>
          <SectionHeader title="Badges" caption={`${earned}/${achievementDefs.length}`} />
          <View style={styles.grid}>
            {rows.map((row, index) => (
              <FadeInView key={row[0].id} delay={Math.min(index + 2, 8) * motion.stagger} style={styles.row}>
                {row.map((def) => (
                  <BadgeCard key={def.id} def={def} unlockedAt={unlocked[def.id]} />
                ))}
                {row.length === 1 ? <View style={styles.spacer} /> : null}
              </FadeInView>
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xxl, marginTop: spacing.lg },
  heroBody: { gap: spacing.sm, marginTop: spacing.sm, width: 220 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs },
  grid: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  spacer: { flex: 1 },
});
