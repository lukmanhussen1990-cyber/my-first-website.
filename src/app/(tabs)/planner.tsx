import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ExamScheduleList } from '@/components/exam/ExamScheduleList';
import { MissionList } from '@/components/planner/MissionList';
import { StreakCard, SubjectProgressCard } from '@/components/planner/PlannerCards';
import { buildDayMarkers } from '@/components/planner/plannerMarkers';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeInView } from '@/components/ui/FadeInView';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconButton } from '@/components/ui/IconButton';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { WeekStrip } from '@/components/ui/WeekStrip';
import { illustrations } from '@/data/illustrations';
import { useNow } from '@/hooks/useNow';
import { usePreparation } from '@/hooks/usePreparation';
import { useAppStore } from '@/store/app';
import { usePlannerStore } from '@/store/planner';
import { motion, spacing } from '@/theme';
import type { DayKey } from '@/types';
import { addDays, fromDayKey, toDayKey } from '@/utils/date';

export default function PlannerScreen() {
  const today = toDayKey(useNow(60_000));
  const [selected, setSelected] = useState<DayKey>(today);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [month, setMonth] = useState(() => fromDayKey(today));

  const tasks = usePlannerStore((s) => s.tasks);
  const subjects = usePlannerStore((s) => s.subjects);
  const examDate = useAppStore((s) => s.examDate);
  const travelDate = useAppStore((s) => s.travelDate);
  const prep = usePreparation();

  const markers = useMemo(
    () => buildDayMarkers(tasks, subjects, examDate, travelDate),
    [tasks, subjects, examDate, travelDate],
  );

  const selectDay = (day: DayKey) => {
    setSelected(day);
    setMonth(fromDayKey(day));
  };

  return (
    <Screen tabBar>
      <View style={styles.stack}>
        <FadeInView style={styles.titleRow}>
          <View style={styles.flex}>
            <AppText variant="overline" color="accent">
              Plan · Focus · Finish
            </AppText>
            <AppText variant="h1" accessibilityRole="header">
              Study Planner
            </AppText>
          </View>
          <IconButton
            icon={view === 'week' ? 'calendar-month' : 'calendar-week'}
            accessibilityLabel={view === 'week' ? 'Show month calendar' : 'Show week strip'}
            onPress={() => setView(view === 'week' ? 'month' : 'week')}
          />
        </FadeInView>

        <FadeInView delay={motion.stagger}>
          {view === 'week' ? (
            <Animated.View key="week" entering={FadeIn} exiting={FadeOut}>
              <WeekStrip
                selected={selected}
                onSelect={selectDay}
                markers={markers}
                today={today}
                onWeekChange={(delta) => selectDay(toDayKey(addDays(fromDayKey(selected), delta * 7)))}
              />
            </Animated.View>
          ) : (
            <Animated.View key="month" entering={FadeIn} exiting={FadeOut}>
              <MonthCalendar
                month={month}
                selected={selected}
                onSelect={selectDay}
                onMonthChange={setMonth}
                markers={markers}
                today={today}
              />
            </Animated.View>
          )}
        </FadeInView>

        <FadeInView delay={motion.stagger * 2}>
          <MissionList day={selected} today={today} />
        </FadeInView>

        <FadeInView delay={motion.stagger * 3}>
          <StreakCard />
        </FadeInView>

        <FadeInView delay={motion.stagger * 4}>
          <SectionHeader
            title="Subject Progress"
            caption={prep.total ? `${Math.round(prep.progress * 100)}%` : undefined}
            actionLabel="Add"
            onAction={() => router.push('/subject/new')}
          />
          {subjects.length ? (
            <View style={styles.list}>
              {subjects.map((subject) => (
                <SubjectProgressCard key={subject.id} subject={subject} />
              ))}
              <GradientButton
                label="Add subject"
                icon="plus"
                variant="secondary"
                fullWidth
                onPress={() => router.push('/subject/new')}
              />
            </View>
          ) : (
            <EmptyState
              illustration={illustrations['study-planner']}
              title="Build your plan"
              message="Add your subjects and chapters — Last Mile tracks your progress and streak from there."
              actionLabel="Add your first subject"
              actionIcon="plus"
              onAction={() => router.push('/subject/new')}
            />
          )}
        </FadeInView>

        {subjects.length ? (
          <FadeInView delay={motion.stagger * 5}>
            <SectionHeader title="Exam schedule" />
            <ExamScheduleList compact />
          </FadeInView>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
});
