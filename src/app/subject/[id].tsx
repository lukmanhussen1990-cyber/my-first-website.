import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NotesTab, PapersTab, QuizzesTab, TopicsTab } from '@/components/subject/SubjectTabs';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Confetti } from '@/components/ui/Confetti';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeInView } from '@/components/ui/FadeInView';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { useNow } from '@/hooks/useNow';
import { haptic } from '@/services/haptics';
import { useAppStore } from '@/store/app';
import { usePlannerStore } from '@/store/planner';
import { subjectProgress } from '@/store/selectors';
import { accents, gradients, spacing } from '@/theme';
import { formatDateTime, formatRelativeDay, parseIso } from '@/utils/date';

type Tab = 'topics' | 'notes' | 'quizzes' | 'papers';

const TABS = [
  { value: 'topics', label: 'Topics' },
  { value: 'notes', label: 'Notes' },
  { value: 'quizzes', label: 'Quizzes' },
  { value: 'papers', label: 'PYQs' },
] as const;

export default function SubjectDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subject = usePlannerStore((s) => s.subjects.find((item) => item.id === id));
  const mainExam = useAppStore((s) => s.examDate);
  const now = useNow(60_000);
  const [tab, setTab] = useState<Tab>('topics');
  const [celebrate, setCelebrate] = useState(false);

  if (!subject) {
    return (
      <Screen>
        <ScreenHeader title="Subject Details" />
        <EmptyState
          icon="book-off-outline"
          title="Subject not found"
          message="It may have been deleted."
          actionLabel="Back to planner"
          onAction={() => router.back()}
          style={styles.empty}
        />
      </Screen>
    );
  }

  const progress = subjectProgress(subject);
  const percent = Math.round(progress * 100);
  const accent = accents[subject.color];
  const paper = parseIso(subject.examDate ?? mainExam);

  const onMastered = () => {
    setCelebrate(true);
    haptic('success');
  };

  return (
    <View style={styles.flex}>
      <Screen keyboard>
        <ScreenHeader
          title="Subject Details"
          right={
            <IconButton
              icon="pencil-outline"
              accessibilityLabel="Edit subject"
              onPress={() => router.push({ pathname: '/subject/new', params: { id: subject.id } })}
            />
          }
        />
        <View style={styles.stack}>
          <FadeInView>
            <GlassCard tint={accent.gradient} style={styles.headerCard}>
              <View style={styles.row}>
                <IconTile icon={subject.icon} gradient={accent.gradient} size="lg" glow />
                <View style={styles.flex}>
                  {subject.code ? (
                    <AppText variant="overline" color="textSecondary">
                      {subject.code}
                    </AppText>
                  ) : null}
                  <AppText variant="h2">{subject.name}</AppText>
                  <AppText variant="bodySm" color="textSecondary">
                    {percent}% Completed
                  </AppText>
                </View>
              </View>
              <ProgressBar progress={progress} gradient={gradients.success} height={9} />
              <View style={styles.metaRow}>
                <Icon name="calendar-clock" size={18} color="textSecondary" />
                <AppText variant="bodySm" color="textSecondary" style={styles.flex}>
                  {formatDateTime(paper)}
                  {subject.venue ? ` · ${subject.venue}` : ''}
                </AppText>
                <Badge label={formatRelativeDay(paper, now)} tone="primary" size="sm" />
              </View>
              {percent === 100 ? <Badge label="Subject mastered 🏆" tone="success" /> : null}
            </GlassCard>
          </FadeInView>

          <FadeInView delay={60}>
            <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
          </FadeInView>

          <FadeInView delay={120} key={tab}>
            {tab === 'topics' ? <TopicsTab subject={subject} onMastered={onMastered} /> : null}
            {tab === 'notes' ? <NotesTab subject={subject} /> : null}
            {tab === 'quizzes' ? <QuizzesTab subject={subject} /> : null}
            {tab === 'papers' ? <PapersTab subject={subject} /> : null}
          </FadeInView>
        </View>
      </Screen>
      <Confetti active={celebrate} onDone={() => setCelebrate(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: spacing.xl, marginTop: spacing.lg },
  headerCard: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  empty: { marginTop: spacing.huge },
});
