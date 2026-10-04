import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TaskRow } from '@/components/ui/TaskRow';
import { TextField } from '@/components/ui/TextField';
import { haptic } from '@/services/haptics';
import { usePlannerStore } from '@/store/planner';
import { subjectById, tasksForDay } from '@/store/selectors';
import { radii, spacing, useTheme } from '@/theme';
import type { DayKey } from '@/types';
import { formatDayLabel, fromDayKey } from '@/utils/date';

/** The selected day's missions with an inline "Add Task" composer. */
export function MissionList({ day, today }: { day: DayKey; today: DayKey }) {
  const { colors } = useTheme();
  const tasks = usePlannerStore((s) => s.tasks);
  const subjects = usePlannerStore((s) => s.subjects);
  const toggleTask = usePlannerStore((s) => s.toggleTask);
  const removeTask = usePlannerStore((s) => s.removeTask);
  const addTask = usePlannerStore((s) => s.addTask);

  const dayTasks = useMemo(() => tasksForDay(tasks, day), [tasks, day]);
  const done = dayTasks.filter((task) => task.done).length;

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string | undefined>();

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const subject = subjectById(subjects, subjectId);
    addTask({ title: trimmed, subjectId, detail: subject ? `(${subject.name})` : undefined, day });
    haptic('success');
    setTitle('');
  };

  const heading = day === today ? "Today's Mission" : `Mission · ${formatDayLabel(fromDayKey(day))}`;

  return (
    <View>
      <SectionHeader title={heading} caption={dayTasks.length ? `${done}/${dayTasks.length}` : undefined} />
      <View style={styles.list}>
        {dayTasks.map((task) => (
          <Animated.View key={task.id} layout={LinearTransition} entering={FadeIn} exiting={FadeOut}>
            <TaskRow
              title={task.title}
              detail={task.detail ?? subjectById(subjects, task.subjectId)?.name}
              checked={task.done}
              onToggle={() => toggleTask(task.id)}
              onDelete={() => removeTask(task.id)}
            />
          </Animated.View>
        ))}
        {!dayTasks.length && !composing ? (
          <AppText variant="bodySm" color="textMuted" style={styles.empty}>
            Nothing planned yet. Add one small, concrete goal.
          </AppText>
        ) : null}

        {composing ? (
          <Animated.View entering={FadeIn} layout={LinearTransition}>
            <GlassCard style={styles.composer} padding={spacing.md}>
              <TextField
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Revise Chapter 6 — Normalization"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submit}
                icon="pencil-outline"
              />
              {subjects.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <Chip label="No subject" selected={!subjectId} onPress={() => setSubjectId(undefined)} />
                  {subjects.map((subject) => (
                    <Chip
                      key={subject.id}
                      label={subject.code ?? subject.name}
                      selected={subjectId === subject.id}
                      onPress={() => setSubjectId(subject.id)}
                    />
                  ))}
                </ScrollView>
              ) : null}
              <View style={styles.actions}>
                <GradientButton label="Done" variant="ghost" size="md" onPress={() => setComposing(false)} />
                <GradientButton label="Add task" icon="plus" size="md" disabled={!title.trim()} onPress={submit} />
              </View>
            </GlassCard>
          </Animated.View>
        ) : (
          <PressableScale
            onPress={() => setComposing(true)}
            accessibilityRole="button"
            accessibilityLabel="Add a task"
            style={[styles.addRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
          >
            <Icon name="plus" size={22} color="textSecondary" />
            <AppText variant="subtitle" color="textSecondary">
              Add Task
            </AppText>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  empty: { paddingVertical: spacing.sm },
  composer: { gap: spacing.md },
  chips: { gap: spacing.sm, paddingRight: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
