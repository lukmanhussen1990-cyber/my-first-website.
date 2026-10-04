import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { IconTile } from '@/components/ui/IconTile';
import type { AchievementDef } from '@/data/achievements';
import { radii, spacing, useTheme } from '@/theme';
import type { IsoDateTime } from '@/types';
import { formatShortDate, parseIso } from '@/utils/date';

/** One achievement medallion: glowing when earned, muted with a hint when locked. */
export function BadgeCard({ def, unlockedAt }: { def: AchievementDef; unlockedAt?: IsoDateTime }) {
  const { colors } = useTheme();
  const unlocked = Boolean(unlockedAt);

  return (
    <GlassCard
      style={styles.card}
      tint={unlocked ? def.gradient : undefined}
      accessibilityLabel={
        unlocked ? `${def.title}, unlocked. ${def.description}` : `${def.title}, locked. ${def.hint}`
      }
    >
      <View style={styles.medal}>
        {unlocked ? (
          <IconTile icon={def.icon} gradient={def.gradient} size="xl" radius={36} glow />
        ) : (
          <View style={[styles.locked, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Icon name={def.icon} size={30} color="textMuted" />
            <View style={[styles.lock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="lock" size={12} color="textMuted" />
            </View>
          </View>
        )}
      </View>
      <AppText variant="subtitle" align="center" color={unlocked ? 'text' : 'textSecondary'} numberOfLines={1}>
        {def.title}
      </AppText>
      <AppText variant="caption" align="center" color="textMuted" numberOfLines={3}>
        {unlocked ? def.description : def.hint}
      </AppText>
      {unlocked && unlockedAt ? (
        <AppText variant="caption" align="center" color="success" style={styles.date}>
          Unlocked {formatShortDate(parseIso(unlockedAt))}
        </AppText>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', gap: spacing.xs, minHeight: 196 },
  medal: { marginBottom: spacing.sm, marginTop: spacing.xs },
  locked: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lock: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: { marginTop: 'auto' },
});
