import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { RenameModal } from '@/components/subject/RenameModal';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { TaskRow } from '@/components/ui/TaskRow';
import { TextField } from '@/components/ui/TextField';
import { chooseAction, confirmAction } from '@/services/dialog';
import { haptic } from '@/services/haptics';
import { usePlannerStore } from '@/store/planner';
import { accents, gradients, spacing, type Gradient } from '@/theme';
import type { AssistantMode, Chapter, IconName, Subject } from '@/types';

/* ------------------------------------------------------------------ */
/* Topics                                                               */
/* ------------------------------------------------------------------ */

export function TopicsTab({ subject, onMastered }: { subject: Subject; onMastered: () => void }) {
  const toggleChapter = usePlannerStore((s) => s.toggleChapter);
  const addChapter = usePlannerStore((s) => s.addChapter);
  const renameChapter = usePlannerStore((s) => s.renameChapter);
  const removeChapter = usePlannerStore((s) => s.removeChapter);
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState<Chapter | null>(null);

  const toggle = (chapter: Chapter) => {
    const remaining = subject.chapters.filter((c) => !c.done).length;
    toggleChapter(subject.id, chapter.id);
    // Completing the last open chapter masters the subject.
    if (!chapter.done && remaining === 1) onMastered();
  };

  const openActions = async (chapter: Chapter) => {
    const choice = await chooseAction(chapter.title, [
      { value: 'rename', label: 'Rename' },
      { value: 'delete', label: 'Delete', destructive: true },
    ]);
    if (choice === 'rename') setRenaming(chapter);
    if (choice === 'delete') {
      const ok = await confirmAction({ title: 'Delete this chapter?', message: chapter.title, confirmLabel: 'Delete', destructive: true });
      if (ok) removeChapter(subject.id, chapter.id);
    }
  };

  const add = () => {
    if (!draft.trim()) return;
    addChapter(subject.id, draft.trim());
    haptic('light');
    setDraft('');
  };

  return (
    <View style={styles.list}>
      {subject.chapters.map((chapter) => (
        <Animated.View key={chapter.id} layout={LinearTransition}>
          <TaskRow
            title={chapter.title}
            checked={chapter.done}
            onToggle={() => toggle(chapter)}
            onPress={() => void openActions(chapter)}
            trailing={<IconButton icon="dots-horizontal" size="sm" variant="glass" accessibilityLabel={`Edit ${chapter.title}`} onPress={() => void openActions(chapter)} />}
          />
        </Animated.View>
      ))}
      {!subject.chapters.length ? (
        <AppText variant="bodySm" color="textMuted">
          No chapters yet — add the topics you need to cover.
        </AppText>
      ) : null}
      <TextField
        value={draft}
        onChangeText={setDraft}
        placeholder="Add a chapter or topic"
        icon="plus"
        returnKeyType="done"
        onSubmitEditing={add}
        right={<IconButton icon="arrow-up" variant="gradient" size="sm" accessibilityLabel="Add chapter" disabled={!draft.trim()} onPress={add} />}
      />
      {renaming ? (
        <RenameModal
          title="Rename chapter"
          initialValue={renaming.title}
          onSave={(title) => renameChapter(subject.id, renaming.id, title)}
          onClose={() => setRenaming(null)}
        />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Notes                                                                */
/* ------------------------------------------------------------------ */

const NOTES_DEBOUNCE_MS = 600;

export function NotesTab({ subject }: { subject: Subject }) {
  const setNotes = usePlannerStore((s) => s.setNotes);
  const [draft, setDraft] = useState(subject.notes);
  const latest = useRef(draft);

  useEffect(() => {
    latest.current = draft;
    if (draft === usePlannerStore.getState().subjects.find((s) => s.id === subject.id)?.notes) return;
    const timer = setTimeout(() => setNotes(subject.id, draft), NOTES_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, subject.id, setNotes]);

  // Never lose the last keystrokes when leaving the screen.
  useEffect(
    () => () => {
      const stored = usePlannerStore.getState().subjects.find((s) => s.id === subject.id);
      if (stored && stored.notes !== latest.current) setNotes(subject.id, latest.current);
    },
    [subject.id, setNotes],
  );

  const saved = draft === subject.notes;
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <View style={styles.list}>
      <TextField
        value={draft}
        onChangeText={setDraft}
        multiline
        placeholder="Key definitions, formulas, examples… Your notes power the AI quizzes and summaries."
        inputStyle={styles.notes}
        textAlignVertical="top"
        accessibilityLabel={`${subject.name} notes`}
      />
      <View style={styles.metaRow}>
        <AppText variant="caption" color="textMuted">
          {words} {words === 1 ? 'word' : 'words'}
        </AppText>
        <AppText variant="caption" color={saved ? 'success' : 'textMuted'}>
          {saved ? 'Saved ✓' : 'Saving…'}
        </AppText>
      </View>
      <View style={styles.row}>
        <GradientButton
          label="Summarize"
          icon="text-box-check-outline"
          size="md"
          gradient={accents.green.gradient}
          disabled={words < 12}
          onPress={() => askBuddy('summarize', draft)}
        />
        <GradientButton
          label="Quiz me"
          icon="help-circle-outline"
          size="md"
          gradient={accents.blue.gradient}
          disabled={words < 12}
          onPress={() => askBuddy('mcq', draft)}
        />
      </View>
      {words < 12 ? (
        <AppText variant="caption" color="textMuted">
          Write a few sentences to unlock AI summaries and quizzes.
        </AppText>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Quizzes                                                              */
/* ------------------------------------------------------------------ */

export function askBuddy(mode: AssistantMode, prompt: string) {
  router.push({ pathname: '/assistant', params: { mode, prompt, send: '1' } });
}

function QuizCard({
  icon,
  gradient,
  title,
  detail,
  onPress,
  disabled,
}: {
  icon: IconName;
  gradient: Gradient;
  title: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <GlassCard tint={gradient} onPress={disabled ? undefined : onPress} accessibilityLabel={title} style={disabled && styles.dim}>
      <View style={styles.row}>
        <IconTile icon={icon} gradient={gradient} />
        <View style={styles.flex}>
          <AppText variant="subtitle">{title}</AppText>
          <AppText variant="caption" color="textSecondary">
            {detail}
          </AppText>
        </View>
      </View>
    </GlassCard>
  );
}

export function QuizzesTab({ subject }: { subject: Subject }) {
  const next = subject.chapters.find((chapter) => !chapter.done)?.title;
  const hasNotes = subject.notes.trim().split(/\s+/).length >= 12;
  return (
    <View style={styles.list}>
      <QuizCard
        icon="notebook-check-outline"
        gradient={accents.blue.gradient}
        title="Practice quiz from my notes"
        detail={hasNotes ? 'Questions built from what you wrote' : 'Add notes in the Notes tab first'}
        disabled={!hasNotes}
        onPress={() => askBuddy('mcq', subject.notes)}
      />
      {next ? (
        <QuizCard
          icon="help-circle-outline"
          gradient={accents.purple.gradient}
          title={`MCQs on ${next}`}
          detail="Five exam-style questions with explanations"
          onPress={() => askBuddy('mcq', `Give me 5 MCQs on ${next} (${subject.name}).`)}
        />
      ) : null}
      {next ? (
        <QuizCard
          icon="lightbulb-on-outline"
          gradient={accents.amber.gradient}
          title={`Explain ${next}`}
          detail="Simple first, then the exam-level detail"
          onPress={() => askBuddy('explain', `Explain ${next} in ${subject.name}, simply and then in exam-level detail.`)}
        />
      ) : null}
      <QuizCard
        icon="calendar-star"
        gradient={gradients.sunset}
        title="Revision plan for this subject"
        detail="Spread the remaining chapters before the paper"
        onPress={() => askBuddy('plan', `Make a revision plan for ${subject.name}.`)}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Past papers                                                          */
/* ------------------------------------------------------------------ */

export function PapersTab({ subject }: { subject: Subject }) {
  const togglePaper = usePlannerStore((s) => s.togglePaper);
  const removePaper = usePlannerStore((s) => s.removePaper);
  const addPaper = usePlannerStore((s) => s.addPaper);
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const done = subject.papers.filter((paper) => paper.done).length;

  const add = () => {
    if (!title.trim()) return;
    addPaper(subject.id, title.trim(), year.trim() || undefined);
    haptic('light');
    setTitle('');
    setYear('');
  };

  return (
    <View style={styles.list}>
      {subject.papers.length ? (
        <AppText variant="caption" color="textSecondary">
          {done} of {subject.papers.length} papers solved
        </AppText>
      ) : null}
      {subject.papers.map((paper) => (
        <Animated.View key={paper.id} entering={FadeIn} layout={LinearTransition}>
          <TaskRow
            title={paper.title}
            checked={paper.done}
            shape="square"
            onToggle={() => togglePaper(subject.id, paper.id)}
            onDelete={() => removePaper(subject.id, paper.id)}
            trailing={paper.year ? <Badge label={paper.year} tone="muted" size="sm" style={styles.center} /> : undefined}
          />
        </Animated.View>
      ))}
      {!subject.papers.length ? (
        <AppText variant="bodySm" color="textMuted">
          Track the previous-year papers you solve. They are the best predictor of the real exam.
        </AppText>
      ) : null}
      <GlassCard padding={spacing.md} style={styles.list}>
        <TextField value={title} onChangeText={setTitle} placeholder="Paper, e.g. Semester exam" icon="file-document-outline" />
        <View style={styles.row}>
          <TextField
            value={year}
            onChangeText={setYear}
            placeholder="Year"
            keyboardType="number-pad"
            maxLength={9}
            style={styles.flex}
          />
          <GradientButton label="Add paper" icon="plus" size="md" disabled={!title.trim()} onPress={add} />
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  center: { alignSelf: 'center' },
  notes: { minHeight: 220 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dim: { opacity: 0.55 },
});
