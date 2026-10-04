import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import {
  DEFAULT_SUBJECT_COLOR,
  DEFAULT_SUBJECT_ICON,
  subjectColorOptions,
  subjectIconOptions,
  suggestSubjectCode,
} from '@/data/subjects';
import { confirmAction } from '@/services/dialog';
import { haptic } from '@/services/haptics';
import { useAppStore } from '@/store/app';
import { usePlannerStore } from '@/store/planner';
import { accents, radii, spacing, useTheme } from '@/theme';
import type { AccentKey, IconName } from '@/types';
import { addDays, parseIso, withTime } from '@/utils/date';

/** Add a subject, or edit one with `?id=`. Presented as a modal. */
export default function SubjectFormScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = usePlannerStore((s) => (id ? s.subjects.find((subject) => subject.id === id) : undefined));
  const mainExam = useAppStore((s) => s.examDate);
  const editing = Boolean(existing);

  const [name, setName] = useState(existing?.name ?? '');
  const [code, setCode] = useState(existing?.code ?? '');
  const [icon, setIcon] = useState<IconName>(existing?.icon ?? DEFAULT_SUBJECT_ICON);
  const [color, setColor] = useState<AccentKey>(existing?.color ?? DEFAULT_SUBJECT_COLOR);
  const [hasPaperDate, setHasPaperDate] = useState(Boolean(existing?.examDate));
  const [paperDate, setPaperDate] = useState(() =>
    existing?.examDate ? parseIso(existing.examDate) : withTime(addDays(parseIso(mainExam), -1), 9, 0),
  );
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [chapters, setChapters] = useState('');

  const accent = accents[color];
  const valid = name.trim().length > 0;
  const chapterList = chapters.split('\n').map((line) => line.trim()).filter(Boolean);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/planner'));

  const save = () => {
    if (!valid) return;
    const planner = usePlannerStore.getState();
    const fields = {
      name: name.trim(),
      code: code.trim() || undefined,
      icon,
      color,
      examDate: hasPaperDate ? paperDate.toISOString() : undefined,
      venue: venue.trim() || undefined,
    };
    if (existing) {
      planner.updateSubject(existing.id, fields);
      haptic('success');
      close();
      return;
    }
    const newId = planner.addSubject({ ...fields, chapters: chapterList });
    haptic('success');
    router.replace({ pathname: '/subject/[id]', params: { id: newId } });
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAction({
      title: `Delete ${existing.name}?`,
      message: 'Its chapters, notes and past papers will be removed. Tasks stay in your planner.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    usePlannerStore.getState().removeSubject(existing.id);
    haptic('warning');
    router.dismissTo('/planner');
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <ScreenHeader
        title={editing ? 'Edit subject' : 'New subject'}
        back={false}
        right={<IconButton icon="close" accessibilityLabel="Close" onPress={close} />}
      />
      <View style={styles.stack}>
        <GlassCard tint={accent.gradient}>
          <View style={styles.row}>
            <IconTile icon={icon} gradient={accent.gradient} size="lg" glow />
            <View style={styles.flex}>
              <AppText variant="overline" color="textSecondary">
                {code.trim() || suggestSubjectCode(name) || 'Preview'}
              </AppText>
              <AppText variant="h3" numberOfLines={2}>
                {name.trim() || 'Your subject'}
              </AppText>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.form}>
          <TextField
            label="Subject name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Database Management System"
            autoFocus={!editing}
            autoCapitalize="words"
            maxLength={60}
          />
          <TextField
            label="Short code (optional)"
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase())}
            placeholder={suggestSubjectCode(name) || 'DBMS'}
            autoCapitalize="characters"
            maxLength={8}
          />

          <View style={styles.group}>
            <AppText variant="label" color="textSecondary">
              Icon
            </AppText>
            <View style={styles.grid}>
              {subjectIconOptions.map((option) => {
                const selected = option === icon;
                return (
                  <PressableScale
                    key={option}
                    onPress={() => setIcon(option)}
                    haptic="selection"
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.replace(/-/g, ' ')}
                    style={[
                      styles.iconOption,
                      {
                        borderColor: selected ? accent.solid : colors.border,
                        backgroundColor: selected ? `${accent.solid}22` : colors.surfaceMuted,
                      },
                    ]}
                  >
                    <Icon name={option} size={24} color={selected ? accent.solid : 'textSecondary'} />
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={styles.group}>
            <AppText variant="label" color="textSecondary">
              Colour
            </AppText>
            <View style={styles.swatches}>
              {subjectColorOptions.map((option) => {
                const selected = option === color;
                return (
                  <PressableScale
                    key={option}
                    onPress={() => setColor(option)}
                    haptic="selection"
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option} colour`}
                    style={[styles.swatchRing, { borderColor: selected ? colors.text : 'transparent' }]}
                  >
                    <View style={[styles.swatch, { backgroundColor: accents[option].solid }]}>
                      {selected ? <Icon name="check-bold" size={16} color="#FFFFFF" /> : null}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.form}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="subtitle">Paper date</AppText>
              <AppText variant="caption" color="textSecondary">
                {hasPaperDate ? 'When you sit this paper' : 'Uses your final exam date'}
              </AppText>
            </View>
            <Switch
              value={hasPaperDate}
              onValueChange={setHasPaperDate}
              trackColor={{ false: colors.track, true: colors.primary }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Set a paper date"
            />
          </View>
          {hasPaperDate ? <DateTimeField label="Date & time" value={paperDate} onChange={setPaperDate} /> : null}
          <TextField label="Venue (optional)" value={venue} onChangeText={setVenue} placeholder="e.g. Main Block, Hall 3" icon="map-marker-outline" />
          {!editing ? (
            <TextField
              label="Chapters (one per line)"
              value={chapters}
              onChangeText={setChapters}
              multiline
              placeholder={'Introduction\nER Model\nNormalization'}
              inputStyle={styles.chapters}
              textAlignVertical="top"
            />
          ) : null}
          {!editing && chapterList.length ? (
            <AppText variant="caption" color="textSecondary">
              {chapterList.length} {chapterList.length === 1 ? 'chapter' : 'chapters'} will be added
            </AppText>
          ) : null}
        </GlassCard>

        <GradientButton
          label={editing ? 'Save changes' : 'Add subject'}
          icon="check"
          gradient={accent.gradient}
          fullWidth
          disabled={!valid}
          onPress={save}
        />
        {editing ? (
          <GradientButton label="Delete subject" variant="danger" icon="trash-can-outline" fullWidth onPress={() => void remove()} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg, marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  form: { gap: spacing.lg },
  group: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatchRing: { padding: 3, borderRadius: radii.pill, borderWidth: 2 },
  swatch: { width: 32, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  chapters: { minHeight: 120 },
});
