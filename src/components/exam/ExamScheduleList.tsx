import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconTile } from '@/components/ui/IconTile';
import { PressableScale } from '@/components/ui/PressableScale';
import { useNow } from '@/hooks/useNow';
import { useAppStore } from '@/store/app';
import { usePlannerStore } from '@/store/planner';
import { examSchedule, type ExamScheduleEntry } from '@/store/selectors';
import { accents, radii, spacing, useTheme } from '@/theme';
import { calendarDaysBetween, formatDayLabel, formatRelativeDay, formatTime, parseIso } from '@/utils/date';

function statusOf(entry: ExamScheduleEntry, now: Date) {
  const date = parseIso(entry.date);
  const days = calendarDaysBetween(now, date);
  if (date.getTime() < now.getTime() && days <= 0) {
    return days === 0 ? { label: 'Today ✓', tone: 'success' as const } : { label: 'Done ✓', tone: 'success' as const };
  }
  if (days === 0) return { label: 'Today', tone: 'sunset' as const };
  if (days === 1) return { label: 'Tomorrow', tone: 'warning' as const };
  return { label: formatRelativeDay(date, now), tone: 'primary' as const };
}

/** Every subject's paper in date order, with a relative-time badge. */
export function ExamScheduleList({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const subjects = usePlannerStore((s) => s.subjects);
  const examDate = useAppStore((s) => s.examDate);
  const now = useNow(60_000);
  const schedule = useMemo(() => examSchedule(subjects, examDate), [subjects, examDate]);

  if (!schedule.length) {
    return (
      <GlassCard>
        <AppText variant="bodySm" color="textSecondary">
          Add subjects with paper dates to see your exam schedule here.
        </AppText>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding={spacing.sm}>
      {schedule.map((entry, index) => {
        const date = parseIso(entry.date);
        const status = statusOf(entry, now);
        const last = index === schedule.length - 1;
        return (
          <PressableScale
            key={entry.subjectId}
            onPress={() => router.push({ pathname: '/subject/[id]', params: { id: entry.subjectId } })}
            accessibilityRole="button"
            accessibilityLabel={`${entry.name}, ${formatDayLabel(date)} at ${formatTime(date)}, ${status.label}`}
            style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
          >
            <IconTile icon={entry.icon} gradient={accents[entry.color].gradient} size={compact ? 'sm' : 'md'} />
            <View style={styles.flex}>
              <AppText variant="subtitle" numberOfLines={1}>
                {entry.name}
              </AppText>
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {formatDayLabel(date)} · {formatTime(date)}
                {entry.venue && !compact ? ` · ${entry.venue}` : ''}
              </AppText>
            </View>
            <Badge label={status.label} tone={status.tone} size="sm" style={styles.badge} />
          </PressableScale>
        );
      })}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  flex: { flex: 1, gap: 2 },
  badge: { alignSelf: 'center' },
});
