import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { FadeInView } from '@/components/ui/FadeInView';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { Screen } from '@/components/ui/Screen';
import { SettingRow } from '@/components/ui/SettingRow';
import { TextField } from '@/components/ui/TextField';
import { defaultExamDate, defaultTravelDate } from '@/data/seed';
import { travelModeOrder, travelModes } from '@/data/travel';
import { gradients, spacing } from '@/theme';
import type { TravelMode } from '@/types';

export interface SetupValues {
  name: string;
  examDate: Date;
  travelDate: Date;
  travelMode: TravelMode;
  homeCity: string;
  useSamplePlan: boolean;
  reminders: boolean;
}

/** Final onboarding step: name, finish-line dates and a few preferences. */
export function SetupForm({
  onSubmit,
  onBack,
}: {
  onSubmit: (values: SetupValues) => Promise<void> | void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState(() => defaultExamDate());
  const [travelDate, setTravelDate] = useState(() => defaultTravelDate(defaultExamDate()));
  const [travelMode, setTravelMode] = useState<TravelMode>('bus');
  const [homeCity, setHomeCity] = useState('');
  const [useSamplePlan, setUseSamplePlan] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const travelBeforeExam = travelDate.getTime() <= examDate.getTime();
  const valid = name.trim().length > 0 && !travelBeforeExam;

  const changeExam = (next: Date) => {
    setExamDate(next);
    // Keep the trip after the exam: default to the evening of exam day.
    if (travelDate.getTime() <= next.getTime()) setTravelDate(defaultTravelDate(next));
  };

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), examDate, travelDate, travelMode, homeCity: homeCity.trim(), useSamplePlan, reminders });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard aurora="sunset" edges={['top', 'bottom']}>
      <FadeInView style={styles.hero}>
        <LogoMark size={64} />
        <AppText variant="overline" color="textSecondary" style={styles.overline}>
          Step 4 of 4
        </AppText>
        <AppText variant="h1" align="center">
          Let&apos;s set your finish line
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Two dates matter right now: your last exam, and the moment you head home.
        </AppText>
      </FadeInView>

      <FadeInView delay={80}>
        <GlassCard style={styles.card}>
          <TextField
            label="What should we call you?"
            icon="account-outline"
            value={name}
            onChangeText={setName}
            placeholder="Your first name"
            autoCapitalize="words"
            autoComplete="given-name"
            returnKeyType="done"
            maxLength={40}
          />
          <DateTimeField label="Final exam" value={examDate} onChange={changeExam} mode="datetime" />
          <DateTimeField
            label="Going home"
            value={travelDate}
            onChange={setTravelDate}
            mode="datetime"
            minimumDate={examDate}
          />
          {travelBeforeExam ? (
            <AppText variant="caption" color="danger">
              Your trip home should come after the exam.
            </AppText>
          ) : null}

          <View style={styles.group}>
            <AppText variant="label" color="textSecondary">
              How are you travelling home?
            </AppText>
            <View style={styles.chips}>
              {travelModeOrder.map((mode) => (
                <Chip
                  key={mode}
                  label={travelModes[mode].label}
                  icon={travelModes[mode].icon}
                  selected={travelMode === mode}
                  onPress={() => setTravelMode(mode)}
                />
              ))}
            </View>
          </View>

          <TextField
            label="Home city (optional)"
            icon="home-city-outline"
            value={homeCity}
            onChangeText={setHomeCity}
            placeholder="Where is home?"
            autoCapitalize="words"
            maxLength={40}
          />
        </GlassCard>
      </FadeInView>

      <FadeInView delay={160}>
        <GlassCard style={styles.card} padding={spacing.sm}>
          <SettingRow
            icon="book-education-outline"
            gradient={gradients.primary}
            label="Start with a sample study plan"
            detail="5 subjects, today's missions — edit or reset any time"
            value={useSamplePlan}
            onValueChange={setUseSamplePlan}
            divider
          />
          <SettingRow
            icon="bell-ring-outline"
            gradient={gradients.sunset}
            label="Reminders & countdown alerts"
            detail="Daily motivation, study & sleep nudges, exam and travel alerts"
            value={reminders}
            onValueChange={setReminders}
          />
        </GlassCard>
      </FadeInView>

      <FadeInView delay={240} style={styles.actions}>
        <GradientButton
          label="Start my last mile 🚀"
          gradient={gradients.sunset}
          size="lg"
          fullWidth
          disabled={!valid}
          loading={submitting}
          onPress={submit}
          accessibilityHint="Saves your dates and opens your dashboard"
        />
        {!name.trim() ? (
          <AppText variant="caption" color="textMuted" align="center">
            Add your name to continue
          </AppText>
        ) : null}
        <GradientButton label="Back to the story" variant="ghost" onPress={onBack} style={styles.back} />
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  overline: { marginTop: spacing.sm },
  card: { gap: spacing.lg, marginBottom: spacing.lg },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.sm },
  back: { alignSelf: 'center' },
});
