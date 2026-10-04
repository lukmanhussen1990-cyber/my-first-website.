/**
 * TEMPORARY visual-QA route — remove before release.
 *
 * Renders every ui/brand component with realistic content so both themes can be
 * screenshotted on web: /dev-gallery?theme=dark | /dev-gallery?theme=light.
 * It loads fonts and provides its own theme, so it works without the root layout.
 */
import { useFonts } from 'expo-font';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/LogoMark';
import {
  AchievementToast,
  AppText,
  Avatar,
  Badge,
  Checkbox,
  Chip,
  Confetti,
  CountdownBlocks,
  CountdownRing,
  DateTimeField,
  EmptyState,
  FadeInView,
  FeatureTile,
  GlassCard,
  GradientButton,
  HeroBanner,
  Icon,
  IconButton,
  IconTile,
  MonthCalendar,
  ProgressBar,
  ProgressRing,
  QuoteCard,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedTabs,
  SettingRow,
  TaskRow,
  TextField,
  TypingDots,
  WeekStrip,
  type DayMarkers,
} from '@/components/ui';
import { illustrations } from '@/data/illustrations';
import {
  accents,
  AppThemeProvider,
  fontAssets,
  gradients,
  motion,
  spacing,
  useTheme,
  type ThemePreference,
} from '@/theme';
import type { DayKey } from '@/types';
import type { CountdownParts } from '@/utils/date';

const SAMPLE_PARTS: CountdownParts = { days: 5, hours: 14, minutes: 32, seconds: 18 };
const TODAY: DayKey = '2026-10-07';
const EXAM_DAY: DayKey = '2026-10-12';

export default function DevGalleryScreen() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { theme } = useLocalSearchParams<{ theme?: string }>();
  const preference: ThemePreference = theme === 'light' ? 'light' : 'dark';

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AppThemeProvider preference={preference}>
          <Gallery />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Gallery() {
  const { isDark } = useTheme();
  const [toastVisible, setToastVisible] = useState(true);

  return (
    <View style={styles.flex}>
      <Screen
        header={
          <ScreenHeader
            title="Component Gallery"
            subtitle={isDark ? 'Dark theme' : 'Light theme'}
            right={
              <IconButton
                icon={isDark ? 'weather-sunny' : 'weather-night'}
                accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                onPress={() => router.setParams({ theme: isDark ? 'light' : 'dark' })}
              />
            }
          />
        }
      >
        <BrandSection />
        <HeadersSection />
        <CountdownSection />
        <ProgressSection />
        <CalendarSection />
        <TabsSection />
        <TasksSection />
        <ButtonsSection />
        <TilesSection />
        <ImagerySection />
        <SettingsSection />
        <FormSection />
        <MiscSection />
      </Screen>
      {/* Long duration so particles are still falling when the QA screenshot is taken. */}
      <Confetti active duration={8000} />
      <AchievementToast
        visible={toastVisible}
        title="Zen Mode"
        message="Completed 3 breathing sessions. Calm mind, sharp focus."
        icon="meditation"
        duration={0}
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
}

function Section({
  title,
  caption,
  index,
  children,
}: {
  title: string;
  caption?: string;
  index: number;
  children: ReactNode;
}) {
  return (
    <FadeInView delay={index * motion.stagger} style={styles.section}>
      <SectionHeader title={title} caption={caption} />
      {children}
    </FadeInView>
  );
}

function BrandSection() {
  return (
    <Section title="Brand & type" index={0}>
      <GlassCard>
        <View style={styles.row}>
          <LogoMark size={72} accessibilityLabel="Last Mile logo" />
          <LogoMark size={48} variant="glyph" />
          <View style={styles.flex}>
            <AppText variant="h2">Last Mile</AppText>
            <AppText variant="bodySm" color="textSecondary">
              One final push before freedom.
            </AppText>
          </View>
        </View>
        <View style={styles.stack}>
          <AppText variant="hero" tabular>
            12
          </AppText>
          <AppText variant="display">Display</AppText>
          <AppText variant="h1">Hi! You’re in the Last Mile</AppText>
          <AppText variant="h3">Heading 3 · Today’s Mission</AppText>
          <AppText variant="body" color="textSecondary">
            Body — Study now, freedom soon! 💙
          </AppText>
          <AppText variant="overline" color="textMuted">
            Overline label
          </AppText>
          <AppText variant="scriptLg" color="primary">
            Good things are coming…
          </AppText>
        </View>
      </GlassCard>
    </Section>
  );
}

function HeadersSection() {
  return (
    <Section title="Headers" index={1}>
      <ScreenHeader
        title="Subject Details"
        subtitle="Database Management System"
        onBack={() => undefined}
        right={
          <IconButton icon="dots-vertical" accessibilityLabel="More options" onPress={() => undefined} />
        }
      />
      <SectionHeader title="Today’s Mission" caption="2/3" actionLabel="See all" onAction={() => undefined} />
    </Section>
  );
}

function CountdownSection() {
  return (
    <Section title="Countdowns" index={2}>
      <View style={styles.stack}>
        <GlassCard>
          <CountdownRing
            parts={SAMPLE_PARTS}
            progress={0.8}
            title="Final Exam Countdown"
            subtitle="12 October 2026"
          />
        </GlassCard>
        <GlassCard>
          <AppText variant="title" style={styles.cardTitle}>
            Going Home Countdown
          </AppText>
          <CountdownBlocks parts={{ days: 12, hours: 8, minutes: 25, seconds: 40 }} />
        </GlassCard>
        <GlassCard tint={gradients.sunset}>
          <View style={styles.rowBetween}>
            <AppText variant="label" color="textSecondary">
              Compact
            </AppText>
            <CountdownBlocks parts={SAMPLE_PARTS} variant="compact" />
          </View>
        </GlassCard>
      </View>
    </Section>
  );
}

function ProgressSection() {
  return (
    <Section title="Subject Progress" caption="80%" index={3}>
      <GlassCard>
        <View style={styles.row}>
          <ProgressRing progress={0.8} size={112} accessibilityLabel="Overall preparation 80 percent">
            <AppText variant="h2" tabular>
              80%
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Prepared
            </AppText>
          </ProgressRing>
          <View style={[styles.flex, styles.stack]}>
            {SUBJECTS.map((subject) => (
              <View key={subject.name} style={styles.stackTight}>
                <View style={styles.rowBetween}>
                  <AppText variant="label">{subject.name}</AppText>
                  <AppText variant="caption" color="textSecondary" tabular>
                    {Math.round(subject.progress * 100)}%
                  </AppText>
                </View>
                <ProgressBar
                  progress={subject.progress}
                  gradient={accents[subject.accent].gradient}
                  height={6}
                />
              </View>
            ))}
          </View>
        </View>
      </GlassCard>
    </Section>
  );
}

const SUBJECTS = [
  { name: 'Database', progress: 0.85, accent: 'blue' },
  { name: 'Networking', progress: 0.7, accent: 'pink' },
  { name: 'Operating System', progress: 0.75, accent: 'cyan' },
  { name: 'Theory', progress: 0.9, accent: 'green' },
] as const;

const MARKERS: DayMarkers = {
  '2026-10-05': { dots: [accents.blue.solid] },
  '2026-10-06': { dots: [accents.pink.solid, accents.cyan.solid] },
  '2026-10-07': { dots: [accents.green.solid] },
  '2026-10-09': { dots: [accents.purple.solid, accents.orange.solid, accents.blue.solid] },
  [EXAM_DAY]: { exam: true, travel: true, label: 'Final exam' },
};

function CalendarSection() {
  const [selected, setSelected] = useState<DayKey>('2026-10-08');
  const [month, setMonth] = useState(() => new Date(2026, 9, 1));
  const [weekOffset, setWeekOffset] = useState(0);
  const startDay = weekOffset === 0 ? '2026-10-07' : undefined;

  return (
    <Section title="Planner calendar" index={4}>
      <View style={styles.stack}>
        <WeekStrip
          selected={selected}
          onSelect={setSelected}
          startDay={startDay}
          days={6}
          markers={MARKERS}
          today={TODAY}
          onWeekChange={(delta) => setWeekOffset((offset) => offset + delta)}
        />
        <GlassCard>
          <MonthCalendar
            month={month}
            selected={selected}
            onSelect={setSelected}
            onMonthChange={setMonth}
            markers={MARKERS}
            today={TODAY}
          />
        </GlassCard>
      </View>
    </Section>
  );
}

type JournalTab = 'photos' | 'notes' | 'voice' | 'future';
type StressTab = 'breathing' | 'motivation' | 'sleep' | 'tips';
type BuddyTab = 'chat' | 'quiz' | 'plan';
type SubjectTab = 'topics' | 'notes' | 'quizzes' | 'pyqs';

function TabsSection() {
  const [journal, setJournal] = useState<JournalTab>('photos');
  const [stress, setStress] = useState<StressTab>('motivation');
  const [buddy, setBuddy] = useState<BuddyTab>('chat');
  const [subject, setSubject] = useState<SubjectTab>('topics');
  const [chip, setChip] = useState('Explain this topic');

  return (
    <Section title="Tabs & chips" index={5}>
      <View style={styles.stack}>
        <SegmentedTabs
          options={[
            { value: 'photos', label: 'Photos' },
            { value: 'notes', label: 'Notes' },
            { value: 'voice', label: 'Voice' },
            { value: 'future', label: 'Future Me' },
          ]}
          value={journal}
          onChange={setJournal}
        />
        <SegmentedTabs
          options={[
            { value: 'breathing', label: 'Breathing' },
            { value: 'motivation', label: 'Motivation' },
            { value: 'sleep', label: 'Sleep' },
            { value: 'tips', label: 'Tips' },
          ]}
          value={stress}
          onChange={setStress}
        />
        <SegmentedTabs
          options={[
            { value: 'chat', label: 'Chat', icon: 'chat-processing' },
            { value: 'quiz', label: 'Quiz', icon: 'help-circle' },
            { value: 'plan', label: 'Plan', icon: 'calendar-check' },
          ]}
          value={buddy}
          onChange={setBuddy}
          gradient={gradients.sunset}
        />
        <SegmentedTabs
          size="sm"
          scrollable
          options={[
            { value: 'topics', label: 'Topics' },
            { value: 'notes', label: 'Notes' },
            { value: 'quizzes', label: 'Quizzes' },
            { value: 'pyqs', label: 'PYQs' },
          ]}
          value={subject}
          onChange={setSubject}
        />
        <View style={styles.wrap}>
          {['Explain this topic', 'Give me MCQs', 'Summarize this', 'Make a revision plan'].map((label) => (
            <Chip key={label} label={label} selected={chip === label} onPress={() => setChip(label)} />
          ))}
        </View>
        <View style={styles.wrap}>
          <Chip label="Primary" tone="primary" selected icon="star" />
          <Chip label="Sunset" tone="sunset" selected icon="weather-sunset" />
          <Chip label="Success" tone="success" selected icon="check" />
          <Chip label="Unselected" tone="sunset" icon="filter-variant" />
        </View>
      </View>
    </Section>
  );
}

function TasksSection() {
  const [done, setDone] = useState<Record<string, boolean>>({
    a: true,
    b: false,
    c: true,
    d: false,
    e: true,
  });
  const toggle = (key: string) => setDone((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Section title="Today’s Mission" caption="2/3" index={6}>
      <View style={styles.stackTight}>
        <TaskRow
          title="Revise Chapter 5"
          detail="Databases"
          checked={done.a}
          onToggle={() => toggle('a')}
          onDelete={() => undefined}
        />
        <TaskRow
          title="Complete Notes"
          detail="Computer Networks"
          checked={done.b}
          onToggle={() => toggle('b')}
          shape="square"
        />
        <TaskRow
          title="Book Train/Bus/Flight Tickets"
          checked={done.c}
          onToggle={() => toggle('c')}
          left={<IconTile icon="ticket" gradient={accents.orange.gradient} size="sm" />}
          shape="square"
          checkColor={accents.indigo.solid}
        />
        <TaskRow
          title="Pack Clothes"
          checked={done.d}
          onToggle={() => toggle('d')}
          left={<IconTile icon="tshirt-crew" gradient={accents.purple.gradient} size="sm" />}
          shape="square"
        />
        <TaskRow
          title="Introduction to DBMS"
          checked={done.e}
          onToggle={() => toggle('e')}
          onPress={() => undefined}
          trailing={<Icon name="chevron-right" color="textMuted" />}
        />
        <View style={styles.row}>
          <Checkbox checked onChange={() => undefined} accessibilityLabel="Circle checked" />
          <Checkbox checked={false} onChange={() => undefined} accessibilityLabel="Circle unchecked" />
          <Checkbox checked shape="square" onChange={() => undefined} accessibilityLabel="Square checked" />
          <Checkbox
            checked={false}
            shape="square"
            onChange={() => undefined}
            accessibilityLabel="Square unchecked"
          />
          <Checkbox checked disabled onChange={() => undefined} accessibilityLabel="Disabled" />
        </View>
      </View>
    </Section>
  );
}

function ButtonsSection() {
  return (
    <Section title="Buttons" index={7}>
      <View style={styles.stack}>
        <GradientButton label="Start my journey home" icon="bus-side" fullWidth onPress={() => undefined} />
        <View style={styles.wrap}>
          <GradientButton label="Primary" size="md" onPress={() => undefined} />
          <GradientButton
            label="Secondary"
            variant="secondary"
            size="md"
            icon="pencil"
            onPress={() => undefined}
          />
          <GradientButton label="Ghost" variant="ghost" size="md" onPress={() => undefined} />
          <GradientButton
            label="Delete"
            variant="danger"
            size="md"
            icon="trash-can-outline"
            onPress={() => undefined}
          />
        </View>
        <View style={styles.wrap}>
          <GradientButton
            label="Sunset"
            gradient={gradients.sunset}
            size="md"
            icon="arrow-right"
            iconPosition="right"
            onPress={() => undefined}
          />
          <GradientButton label="Loading" loading size="md" onPress={() => undefined} />
          <GradientButton label="Disabled" disabled size="md" onPress={() => undefined} />
        </View>
        <View style={styles.wrap}>
          <IconButton
            icon="arrow-left"
            accessibilityLabel="Glass small"
            size="sm"
            onPress={() => undefined}
          />
          <IconButton icon="calendar-month" accessibilityLabel="Glass" onPress={() => undefined} />
          <IconButton icon="plus" accessibilityLabel="Solid" variant="solid" onPress={() => undefined} />
          <IconButton
            icon="send"
            accessibilityLabel="Gradient"
            variant="gradient"
            onPress={() => undefined}
          />
          <IconButton
            icon="pause"
            accessibilityLabel="Gradient large"
            variant="gradient"
            size="lg"
            onPress={() => undefined}
          />
          <IconButton icon="close" accessibilityLabel="Disabled" disabled onPress={() => undefined} />
        </View>
      </View>
    </Section>
  );
}

const FEATURES = [
  { icon: 'book-open-page-variant', label: 'Study Plan', accent: 'blue' },
  { icon: 'bookshelf', label: 'Subjects', accent: 'purple' },
  { icon: 'robot-happy', label: 'AI Assistant', accent: 'indigo', badge: 'New' },
  { icon: 'map-marker-path', label: 'Travel Plan', accent: 'green' },
  { icon: 'clipboard-check', label: 'Checklist', accent: 'orange', badge: '3' },
  { icon: 'book-heart', label: 'Journal', accent: 'pink' },
] as const;

function TilesSection() {
  return (
    <Section title="Tiles" index={8}>
      <View style={styles.stack}>
        <View style={styles.grid}>
          {FEATURES.map((feature) => (
            <FeatureTile
              key={feature.label}
              icon={feature.icon}
              label={feature.label}
              gradient={accents[feature.accent].gradient}
              badge={'badge' in feature ? feature.badge : undefined}
              onPress={() => undefined}
              style={styles.gridItem}
            />
          ))}
        </View>
        <GlassCard>
          <View style={styles.rowBetween}>
            <IconTile icon="database" gradient={accents.blue.gradient} size="xs" />
            <IconTile icon="lan" gradient={accents.pink.gradient} size="sm" />
            <IconTile icon="monitor" gradient={accents.cyan.gradient} size="md" />
            <IconTile icon="calculator-variant" gradient={accents.amber.gradient} size="lg" glow />
            <IconTile icon="trophy" gradient={gradients.gold} size="xl" glow />
          </View>
        </GlassCard>
      </View>
    </Section>
  );
}

function ImagerySection() {
  return (
    <Section title="Imagery" index={9}>
      <View style={styles.stack}>
        <HeroBanner
          source={illustrations['home-hero']}
          script={'Good things are coming…\n12th October and then Home! 🏠'}
          onPress={() => undefined}
        />
        <HeroBanner
          source={illustrations['home-journey']}
          height={180}
          overlayPosition="bottom-left"
          title="Almost there…"
          subtitle="Your home awaits"
        >
          <Badge label="5 days left" tone="sunset" icon="bus-side" />
        </HeroBanner>
        <HeroBanner
          source={illustrations['stress-relief']}
          height={160}
          overlayPosition="center"
          script="Breathe in…"
          scriptVariant="scriptLg"
        />
        <QuoteCard quote="Discipline now gives you the freedom you’re waiting for." />
        <QuoteCard
          quote="Soon this struggle will be a beautiful memory."
          icon="heart"
          tone="sunset"
          author="Future you"
        />
      </View>
    </Section>
  );
}

function SettingsSection() {
  const [reminders, setReminders] = useState(true);
  const [haptics, setHaptics] = useState(false);

  return (
    <Section title="Pre-Travel Checklist" index={10}>
      <GlassCard padding={spacing.sm}>
        <SettingRow
          icon="ticket"
          gradient={accents.orange.gradient}
          label="Book Tickets"
          detail="Bus · not booked yet"
          onPress={() => undefined}
          divider
        />
        <SettingRow
          icon="bell-ring"
          gradient={accents.purple.gradient}
          label="Daily reminders"
          detail="Motivation at 8:00 AM"
          value={reminders}
          onValueChange={setReminders}
          divider
        />
        <SettingRow
          icon="vibrate"
          gradient={accents.cyan.gradient}
          label="Haptics"
          value={haptics}
          onValueChange={setHaptics}
          divider
        />
        <SettingRow
          icon="palette"
          gradient={accents.blue.gradient}
          label="Theme"
          right={<Badge label="Dark" tone="muted" size="sm" />}
          onPress={() => undefined}
          divider
        />
        <SettingRow
          icon="delete"
          gradient={gradients.danger}
          label="Reset all data"
          destructive
          onPress={() => undefined}
        />
      </GlassCard>
    </Section>
  );
}

function FormSection() {
  const [question, setQuestion] = useState('');
  const [city, setCity] = useState('Kochi');
  const [examDate, setExamDate] = useState(() => new Date(2026, 9, 12, 9, 0));

  return (
    <Section title="Forms" index={11}>
      <View style={styles.stack}>
        <TextField
          value={question}
          onChangeText={setQuestion}
          placeholder="Type your question here…"
          icon="robot-happy"
          right={
            <IconButton
              icon="send"
              variant="gradient"
              size="sm"
              accessibilityLabel="Send"
              onPress={() => undefined}
            />
          }
        />
        <TextField value={city} onChangeText={setCity} label="Home city" icon="home-heart" />
        <TextField
          value=""
          onChangeText={() => undefined}
          label="Your name"
          placeholder="Aisha"
          error="Please tell us your name"
        />
        <DateTimeField label="Exam date & time" value={examDate} onChange={setExamDate} />
        <DateTimeField label="Travel date" mode="date" value={examDate} onChange={setExamDate} />
        <DateTimeField label="Departure time" mode="time" value={examDate} onChange={setExamDate} />
      </View>
    </Section>
  );
}

function MiscSection() {
  return (
    <Section title="Badges, avatars & states" index={12}>
      <View style={styles.stack}>
        <View style={styles.wrap}>
          <Badge label="Primary" />
          <Badge label="On track" tone="success" icon="check-circle" />
          <Badge label="3 days left" tone="warning" icon="clock-outline" />
          <Badge label="Overdue" tone="danger" />
          <Badge label="Offline mode" tone="muted" icon="wifi-off" />
          <Badge label="Going home" tone="sunset" icon="home-heart" />
          <Badge label="Small" size="sm" />
        </View>
        <View style={styles.row}>
          <Avatar name="Aisha Khan" size={56} onPress={() => undefined} />
          <Avatar name="Rahul" />
          <Avatar name="Meera Nair" size={32} gradient={gradients.sunset} />
          <GlassCard padding={spacing.md} radius={20}>
            <TypingDots />
          </GlassCard>
        </View>
        <GlassCard>
          <EmptyState
            icon="image-plus"
            title="No memories yet"
            message="Capture the late nights and small wins — you’ll want to remember them."
            actionLabel="Add Memory"
            actionIcon="plus"
            onAction={() => undefined}
          />
        </GlassCard>
        <EmptyState
          illustration={illustrations['memory-journal']}
          title="Your journal awaits"
          message="Photos, notes and voice memos from the last mile."
        />
        <GlassCard
          blur
          tint={gradients.primary}
          onPress={() => undefined}
          accessibilityLabel="Tinted glass card"
        >
          <AppText variant="title">Tinted glass card</AppText>
          <AppText variant="bodySm" color="textSecondary">
            Pressable, with primary tint and blur.
          </AppText>
        </GlassCard>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: spacing.xxl },
  cardTitle: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stack: { gap: spacing.md },
  stackTight: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { flexBasis: '30%', flexGrow: 1 },
});
