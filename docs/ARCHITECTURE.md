# Last Mile — Architecture & Build Spec

> "One final push before freedom."
> A personal exam countdown, study planner and home-journey companion for the
> last stretch before a student's final exam (default: **12 October**) and the
> trip home.

This document is the contract every part of the app is built against. If code
and this doc disagree, fix one of them; don't leave them drifting.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Runtime | Expo SDK **57** (React Native 0.86, React 19.2, New Architecture, React Compiler on) |
| Language | TypeScript (strict) |
| Navigation | Expo Router (file-based; routes in `src/app/`) — native `Stack` + JS tabs with a custom floating glass tab bar |
| State | Zustand v5 + `persist` → `@react-native-async-storage/async-storage` (fully offline) |
| Animation | `react-native-reanimated` 4 (+ `react-native-worklets`), layout animations (`FadeInDown`, …) |
| Graphics | `react-native-svg` (rings, aurora blobs, logo), `expo-linear-gradient`, `expo-blur` |
| Images | `expo-image` |
| Icons | `@expo/vector-icons` **MaterialCommunityIcons only** (type `IconName` in `src/types`) |
| Fonts | Plus Jakarta Sans (UI) + Caveat (handwritten emotional accents) via `@expo-google-fonts/*` |
| Device | `expo-notifications`, `expo-calendar`, `expo-image-picker`, `expo-audio`, `expo-file-system`, `expo-haptics`, `@react-native-community/datetimepicker` |
| AI | Optional cloud proxy (`server/`, Claude via `@anthropic-ai/sdk`) + on-device offline study buddy |
| Tests | `jest-expo` — `src/**/__tests__/**/*.test.ts(x)` |

### ⚠️ Expo SDK 57 API drift — read before writing native-module code

Expo changes APIs every SDK. **Never write expo-* code from memory.** Check the
installed type definitions in `node_modules/<pkg>/build/*.d.ts` and/or fetch the
versioned docs: `https://docs.expo.dev/versions/v57.0.0/sdk/<module>.md`
(index: `https://docs.expo.dev/llms.txt`). Known gotchas already confirmed:

- `Tabs` from `'expo-router'` is **deprecated** → `import { Tabs } from 'expo-router/js-tabs'`.
- `Stack`, `router`, `Link`, `useLocalSearchParams`, `Redirect`, `ThemeProvider`, `DarkTheme`, `DefaultTheme` come from `'expo-router'`. `Stack.Protected` exists (used for the onboarding gate).
- `expo-file-system` default export is the **new object API** (`File`, `Directory`, `Paths`). The old function API is under `expo-file-system/legacy`. Use the new API.
- `expo-calendar` default export is the **new object API** (`getDefaultCalendarSync()`, `ExpoCalendar`, `createCalendar`, …); the old one is `expo-calendar/legacy`. Read `node_modules/expo-calendar/build/Calendar.d.ts` + `ExpoCalendar.types.d.ts`.
- `expo-audio` (not `expo-av`) — hooks such as `useAudioRecorder`, `useAudioPlayer`, `RecordingPresets`.
- Notification triggers use `SchedulableTriggerInputTypes` (`DAILY`, `DATE`, …).
- Reanimated 4: worklets come from `react-native-worklets`; layout animations (`FadeIn`, `FadeInDown`, `ZoomIn`, …) from `react-native-reanimated`.
- React Compiler is enabled: write idiomatic hooks, avoid mutating props/state, don't read refs during render.

### Platform support

iOS and Android are the targets. **Web must also render** every screen (used for
visual QA screenshots), so every native-only call is guarded:
`Platform.OS === 'web'` → no-op / graceful fallback (notifications, calendar,
haptics, file-system copy, datetimepicker, audio recording).

---

## 2. Directory layout

```
src/
  app/                         Expo Router routes (screens only)
    _layout.tsx                Root: fonts, splash, providers, Stack, onboarding gate
    onboarding.tsx             3-page story onboarding + setup form
    (tabs)/_layout.tsx         Floating glass tab bar (Home · Planner · Buddy · Journey · Journal)
    (tabs)/index.tsx           Home dashboard
    (tabs)/planner.tsx         Study planner (week strip, calendar, tasks, subjects, streak, schedule)
    (tabs)/assistant.tsx       AI study assistant
    (tabs)/journey.tsx         Home journey (travel countdown, ticket, checklist summary)
    (tabs)/journal.tsx         Memory journal (Photos / Notes / Voice / Future Me)
    exam.tsx                   Exam countdown detail + exam schedule + "I'm done!"
    subject/[id].tsx           Subject details (Topics / Notes / Quizzes / PYQs)
    subject/new.tsx            Add / edit subject (modal; `?id=` to edit)
    checklist.tsx              Travel checklist (`?category=` to pre-filter)
    memory/new.tsx             Add memory (modal; `?kind=photo|note|voice&capsule=1`)
    memory/[id].tsx            Memory detail / sealed time-capsule view
    stress.tsx                 Stress control (Breathing / Motivation / Sleep / Tips)
    achievements.tsx           Badges + stats
    celebration.tsx            Full-screen confetti "Exams complete!" (modal)
    settings.tsx               Profile, dates, theme, notifications, calendar, AI, data
    dev-gallery.tsx            TEMPORARY visual-QA gallery of every ui/brand component
                               (`?theme=light|dark`) — delete before release
  components/
    ui/                        Design-system primitives (see §4)
    brand/                     LogoMark, BrandSplashOverlay
    <feature>/                 Feature-specific components (home/, planner/, assistant/, …)
  theme/                       colors.ts, typography.ts, layout.ts, ThemeProvider.tsx
  store/                       Zustand stores + pure selectors
  services/                    notifications, calendar, haptics, media, ai/
  hooks/                       useNow, useCountdown, useJourneyPhase, …
  data/                        quotes, seed data, achievements, breathing patterns, tips, illustrations
  utils/                       date, id, text helpers
  types/                       Domain model (src/types/index.ts)
  config.ts                    Public runtime config (EXPO_PUBLIC_* env)
server/                        Optional AI proxy (Node + @anthropic-ai/sdk) — separate package
assets/images/illustrations/   12 cinematic illustrations (see data/illustrations.ts)
```

Imports use the `@/` alias (`@/components/ui/GlassCard`, `@/theme`, `@/store/planner`).
Assets use `@/assets/...`.

---

## 3. Design language

Match the reference mockups: **dark premium, cinematic, emotional**.

- **Canvas**: every screen sits on `<Screen>` which paints `colors.backgroundGradient`
  plus soft aurora blobs (purple top-left, cyan right, sunset bottom) that drift slowly.
- **Cards**: glassmorphism — translucent `colors.card` fill, 1px `colors.border`,
  a faint top highlight line, radius `radii.xl` (24). Inner rows use `colors.surfaceMuted`
  with radius `radii.md`.
- **Accents**: purple→cyan (`gradients.primary`) for progress & primary actions;
  sunset orange→pink (`gradients.sunset`) for "going home" / emotional highlights;
  gold for achievements; green for completion.
- **Icon tiles**: rounded-square (radius 12–14) gradient tiles with a white glyph —
  exactly like the reference's feature grid and list rows.
- **Typography**: Plus Jakarta Sans. Big bold headings (`h1`), tabular numerals for
  counters. Emotional lines ("Good things are coming… 12th October and then Home! 🏠")
  use the **Caveat** script variant over imagery.
- **Imagery**: illustrations are full-bleed inside rounded cards with a bottom
  `gradients.imageScrim` so overlaid text is legible.
- **Motion**: staggered `FadeInDown` entrances (60 ms stagger), springy press-scale
  (0.97) with light haptics, animated progress rings/bars on mount, ticking countdown
  digits, breathing circle, confetti on completion. Keep it subtle — 60 fps, no
  layout thrash. Respect reduced-motion (`useReducedMotion` from reanimated) for
  looping/decorative animation.
- **Light mode**: same layout; tokens swap automatically via `useTheme()`. Never
  hard-code `#fff`/`#000` for text or surfaces — use tokens. Text on imagery or
  gradients uses `colors.textOnAccent`.
- **Layout**: page gutter `SCREEN_GUTTER` (20), section gaps 24, content capped at
  `MAX_CONTENT_WIDTH` and centred. Tab screens add `TAB_BAR_CLEARANCE` bottom padding
  (handled by `<Screen tabBar>`).
- **Accessibility**: every pressable has `accessibilityRole` + `accessibilityLabel`;
  hit targets ≥ 44pt; countdowns expose a readable label ("5 days 14 hours left").

Theme tokens live in `src/theme` (`colors.ts`, `typography.ts`, `layout.ts`) and are
read with `const { colors, isDark } = useTheme()`.

---

## 4. UI component contracts (`src/components/ui/`)

One component per file, named export, file name = component name. Screens import
from the individual files (e.g. `import { GlassCard } from '@/components/ui/GlassCard'`).
An `index.ts` barrel (`@/components/ui`) re-exports all of them.

| Component | Props (summary) | Notes |
|---|---|---|
| `AppText` ✅ exists | `variant?: TextVariant; color?: token \| raw; align?; tabular?` + TextProps | All copy |
| `Icon` | `name: IconName; size?=22; color?: token \| raw` | MaterialCommunityIcons wrapper |
| `Screen` | `children; scroll?=true; tabBar?=false (adds clearance); header?: ReactNode (rendered above scroll, not scrolling); contentStyle?; refreshControl?; keyboard?=false (KeyboardAvoidingView); edges?: ('top'\|'bottom')[] = ['top']; background?: ReactNode (replaces aurora, e.g. full-bleed image)` | Safe-area aware, centred max width, aurora bg |
| `AuroraBackground` | `variant?: 'default' \| 'sunset' \| 'night'` | Absolute-fill gradient + slowly drifting SVG radial blobs |
| `GlassCard` | `children; style?; padding?: number = spacing.lg; radius?: number = radii.xl; tint?: Gradient (subtle tinted overlay at ~0.18 opacity); blur?: boolean (real BlurView — use on imagery only); onPress?; onLongPress?; accessibilityLabel?; highlight?: boolean = true` | If `onPress` → wraps in `PressableScale` |
| `PressableScale` | Pressable props + `scaleTo?=0.97; haptic?: HapticKind \| false = 'light'; style?` | Reanimated spring scale; calls `haptic()` |
| `ScreenHeader` | `title: string; subtitle?; back?: boolean = true; onBack?; right?: ReactNode; transparent?: boolean (for over-image headers)` | Glass circle back button (`router.back()`; falls back to `router.replace('/')` if can't go back) |
| `IconButton` | `icon: IconName; onPress; size?: 'sm'\|'md'\|'lg'; variant?: 'glass' \| 'solid' \| 'gradient'; color?; accessibilityLabel (required)` | Circle button |
| `GradientButton` | `label; onPress; icon?: IconName; gradient?: Gradient = gradients.violet; variant?: 'primary' \| 'secondary' (glass) \| 'ghost' \| 'danger'; size?: 'md' \| 'lg'; loading?; disabled?; fullWidth?; style?` | Primary CTAs |
| `IconTile` | `icon: IconName; gradient: Gradient; size?: 'xs'(28) \| 'sm'(36) \| 'md'(44) \| 'lg'(56) \| 'xl'(72); radius?; glow?: boolean` | Rounded gradient square + white glyph |
| `FeatureTile` | `icon; label; gradient; onPress; badge?: string` | Dashboard grid tile (glass, icon tile centred, label below) |
| `SectionHeader` | `title; caption?: string (right side, e.g. "2/3" or "80%"); actionLabel?; onAction?; style?` | |
| `SegmentedTabs<T extends string>` | `options: {value: T; label: string; icon?: IconName}[]; value: T; onChange(v: T); scrollable?: boolean; size?: 'sm' \| 'md'` | Animated sliding pill (Photos/Notes/Voice/Future Me, Topics/Notes/…) |
| `Chip` | `label; selected?; onPress?; icon?: IconName; tone?: 'default' \| 'primary' \| 'sunset' \| 'success'` | Quick prompts, filters |
| `Checkbox` | `checked: boolean; onChange(next: boolean); shape?: 'circle' \| 'square' = 'circle'; color?: string (fill when checked; default success green for circle, primary for square); size?=24; accessibilityLabel?` | Animated check, haptic `selection` |
| `TaskRow` | `title; detail?; checked; onToggle(); onDelete?; onPress?; left?: ReactNode (e.g. IconTile); shape?: 'circle'\|'square'; trailing?: ReactNode` | Row used by missions, chapters, checklist; strike-through + dim when checked; long-press → onDelete confirm |
| `ProgressBar` | `progress: number (0–1); gradient?: Gradient = gradients.primary; height?=8; trackColor?; animated?=true` | Animated width |
| `ProgressRing` | `progress: number (0–1); size?=120; strokeWidth?=10; gradient?: Gradient = gradients.aurora; trackColor?; children?: ReactNode (centre); animated?=true; duration?` | SVG arc with gradient stroke, rounded caps, animated on mount/change |
| `CountdownBlocks` | `parts: {days; hours; minutes; seconds}; variant?: 'boxes' \| 'compact'; labels?: 'long' \| 'short'; tint?: Gradient` | Four boxes "12 Days · 08 Hours · 25 Minutes · 40 Seconds" (2-digit pad except days); seconds digit animates on change |
| `CountdownRing` | `parts; progress: number; title?; size?=132` | Reference "Final Exam Countdown": ring with big days number + "Days", right column "14 Hours / 32 Minutes / 18 Seconds" |
| `TextField` | `value; onChangeText; label?; placeholder?; multiline?; icon?: IconName; right?: ReactNode; onSubmitEditing?; autoFocus?; style?; inputStyle?` + TextInputProps | Glass input |
| `DateTimeField` | `label; value: Date; onChange(d: Date); mode?: 'date' \| 'time' \| 'datetime' = 'datetime'; minimumDate?` | Native: `@react-native-community/datetimepicker` (iOS inline sheet, Android dialogs date→time). Web: in-app `MonthCalendar` + hour/minute steppers in a modal |
| `MonthCalendar` | `month: Date; selected?: DayKey; onSelect(day: DayKey); onMonthChange(d: Date); markers?: Record<DayKey, {dots?: string[]; exam?: boolean; travel?: boolean}>; minDay?: DayKey` | Month grid used by planner "calendar view" + web date picker |
| `WeekStrip` | `selected: DayKey; onSelect(day); days?: number = 7; startDay?: DayKey (default: Monday of selected week); markers?` | Reference planner header "Mon 7 · Tue 8 … Sat 12" with gradient pill on selected, exam flag |
| `HeroBanner` | `source: ImageSourcePropType; height?=200; script?: string (Caveat lines, `\n` allowed); title?; subtitle?; children?; overlayPosition?: 'top-left' \| 'bottom-left' \| 'center'; onPress?` | Rounded image card with scrim and emotional script text |
| `QuoteCard` | `quote: string; author?; icon?: IconName = 'sprout'; tone?: 'success' \| 'sunset' \| 'primary'` | "Discipline now gives you the freedom you're waiting for." |
| `EmptyState` | `icon?: IconName; illustration?: ImageSourcePropType; title; message?; actionLabel?; onAction?` | |
| `Avatar` | `name: string; size?=44; onPress?` | Initials on gradient circle with ring |
| `SettingRow` | `icon: IconName; gradient: Gradient; label; detail?; value?: boolean (renders Switch); onValueChange?; onPress? (renders chevron); right?: ReactNode; destructive?` | Settings & checklist category rows |
| `Badge` | `label; tone?: 'primary' \| 'success' \| 'warning' \| 'danger' \| 'muted' \| 'sunset'; icon?` | Small pill ("3 days left", "Offline mode") |
| `Confetti` | `active: boolean; count?=80; duration?=3200; onDone?; colors?: string[]` | Absolute-fill, pointerEvents none, Reanimated particles (no extra deps) |
| `TypingDots` | `color?` | Three bouncing dots for AI typing |
| `Toast` / `AchievementToast` | `visible; title; message?; icon?: IconName; gradient?; onHide()` | Slides from top, auto hides after 3.5 s |
| `FadeInView` | `delay?: number; children; style?` | `Animated.View` with `FadeInDown.springify()`-style entrance; respects reduced motion |

Brand (`src/components/brand/`): `LogoMark` (SVG mark — road converging to a rising
sun inside a rounded square, purple→cyan with sunset sun; props `size`), and
`BrandSplashOverlay` (animated logo + "Last Mile" + tagline "One final push before
freedom.", fades out after ~1.1 s on cold start; props `onDone`).

### 4.1 Implemented extras & usage notes (foundation integration)

The table above is the minimum contract; the implementation adds optional props
(all have defaults) and a few behaviours screens must know about:

- **Extra optional props**: `Screen.aurora` (`AuroraVariant`); `IconButton.variant: 'overlay'`
  (dark glass for use on imagery), `haptic`, `disabled`; `GradientButton.iconPosition`, `haptic`;
  `TaskRow.checkboxPosition` (`'leading' | 'trailing'`, default trailing when `left` is set) and
  `checkColor`; `HeroBanner.scriptVariant` (`'script' | 'scriptLg'`), `contentPosition`, `radius`;
  `ProgressBar/ProgressRing.duration`, `accessibilityLabel`; `CountdownRing.subtitle`, `gradient`;
  `CountdownBlocks.accessibilityLabel`; `Toast/AchievementToast.duration` (ms, `0` = sticky);
  `MonthCalendar/WeekStrip.today` (pass `toDayKey(useNow())` for midnight rollover);
  `WeekStrip.onWeekChange(delta)` (chevrons + swipe); `DayMarker.label`; `DateTimeField.maximumDate`,
  `disabled`; `EmptyState.actionIcon`, `gradient`; `SettingRow.disabled`, `divider`;
  `Avatar.gradient`; `Badge.size: 'sm' | 'md'`; most components accept `style` and `accessibilityHint`.
- **Hugging layout**: `GradientButton` (unless `fullWidth`), `Chip`, `Badge` and `TypingDots` use
  `alignSelf: 'flex-start'`. Inside a row, pass `style={{ alignSelf: 'center' }}` to centre them
  (`SettingRow.right` already does this).
- **SegmentedTabs**: fixed tracks share the width; four tabs fit at phone width only **without
  icons** (icons + 4 labels truncate). Use `scrollable` for more/longer options.
- **DateTimeField**: `mode="date"` shows "12 October 2026" — give it (close to) full width.
- **SectionHeader** carries its own `marginBottom` (`spacing.md`).
- **SettingRow**: a boolean `value` renders a Switch and wins over `onPress`; on native the whole row
  toggles, on web only the Switch does (avoids a double toggle). `destructive` only reddens the label.
- **Toast / AchievementToast**: render once near the root; `onHide` fires once per showing — set
  `visible` to `false` in response. `Toast` and `WeekStrip` (swipe gestures) need the root
  `GestureHandlerRootView`.
- **Screen** has no scroll-ref pass-through: chat-like screens use `scroll={false}` + their own list.
- **TaskRow** on web confirms deletes with `window.confirm` (RN-web's `Alert` is a no-op).

---

## 5. State (`src/store/`)

All stores: `create<State>()(persist((set, get) => ({...}), { name: 'lastmile.<store>', storage: createJSONStorage(() => AsyncStorage), version: 1, partialize: <exclude transient fields> }))`.
Implemented via `persistOptions(store, { partialize, merge?, onHydrated? })` from `store/storage.ts`, whose
`createPersistStorage()` is that JSON-over-AsyncStorage storage hardened so corrupt/unavailable storage
resolves to defaults instead of crashing. Hydration is tracked per store (`useStoresHydrated()`).
Store files export a hook named `use<Name>Store`. Pure derived logic lives in
`src/store/selectors.ts` (unit-tested). IDs come from `createId()` in `utils/id`.

### `useAppStore` — `src/store/app.ts`
```ts
interface AppStore {
  hydrated: boolean;                 // true once persist has rehydrated (not persisted)
  hasOnboarded: boolean;
  profile: Profile;                  // { name, university?, homeCity? }
  examDate: IsoDateTime;             // default: next 12 Oct 09:00 local
  travelDate: IsoDateTime;           // default: exam day 18:00 local
  journeyStartedAt: IsoDateTime;     // set at onboarding; baseline for ring progress
  examCompletedAt?: IsoDateTime;
  ticket: TicketInfo;                // { mode: 'bus', booked: false }
  settings: Settings;                // theme 'dark', haptics true, notifications defaults (see below), calendar {}
  stats: Stats;                      // { breathingSessions: 0, aiQuestions: 0, calmSeconds: 0 }
  unlockedAchievements: Partial<Record<AchievementId, IsoDateTime>>;

  completeOnboarding(input: { name: string; examDate: IsoDateTime; travelDate: IsoDateTime;
    homeCity?: string; travelMode?: TravelMode; useSamplePlan: boolean }): void;  // seeds planner/travel/journal when useSamplePlan, else seeds only the default travel checklist
  updateProfile(patch: Partial<Profile>): void;
  setExamDate(iso: IsoDateTime): void;
  setTravelDate(iso: IsoDateTime): void;
  markExamCompleted(): void;
  undoExamCompleted(): void;
  updateTicket(patch: Partial<TicketInfo>): void;
  setTheme(pref: ThemePreference): void;
  setHaptics(on: boolean): void;
  updateNotificationSettings(patch: Partial<NotificationSettings>): void;
  setCalendarSync(patch: Partial<CalendarSyncState>): void;
  incrementStat(key: keyof Stats, by?: number): void;
  unlockAchievement(id: AchievementId): boolean;   // true when newly unlocked
  resetApp(): void;                                // resets every store to initial state
}
```
Notification defaults: `enabled: false`, dailyMotivation 08:00 on, studyReminder 19:00 on,
sleepReminder 23:00 on, examAlerts on, travelAlerts on.

### `usePlannerStore` — `src/store/planner.ts`
```ts
interface PlannerStore {
  subjects: Subject[];
  tasks: StudyTask[];
  addSubject(input: { name: string; code?: string; color: AccentKey; icon: IconName;
    examDate?: IsoDateTime; venue?: string; chapters?: string[]; notes?: string }): string;
  updateSubject(id: string, patch: Partial<Omit<Subject, 'id' | 'createdAt'>>): void;
  removeSubject(id: string): void;               // also clears subjectId on its tasks
  addChapter(subjectId: string, title: string): void;
  toggleChapter(subjectId: string, chapterId: string): void;   // sets/clears doneAt
  renameChapter(subjectId: string, chapterId: string, title: string): void;
  removeChapter(subjectId: string, chapterId: string): void;
  addPaper(subjectId: string, title: string, year?: string): void;
  togglePaper(subjectId: string, paperId: string): void;
  removePaper(subjectId: string, paperId: string): void;
  setNotes(subjectId: string, notes: string): void;
  addTask(input: { title: string; detail?: string; subjectId?: string; day: DayKey }): string;
  toggleTask(id: string): void;                  // sets/clears doneAt
  updateTask(id: string, patch: Partial<Omit<StudyTask, 'id' | 'createdAt'>>): void;
  removeTask(id: string): void;
  seedSample(now?: Date): void;                  // sample subjects (DBMS, Networks, OS, Aptitude, Theory) + today's 3 missions
  reset(): void;
}
```

### `useTravelStore` — `src/store/travel.ts`
```ts
interface TravelStore {
  items: ChecklistItem[];
  addItem(input: { title: string; category: ChecklistCategory }): string;
  toggleItem(id: string): void;
  renameItem(id: string, title: string): void;
  removeItem(id: string): void;
  uncheckAll(): void;
  seedDefaults(): void;   // Book tickets, Pack clothes, ID card & hall ticket, Laptop & charger, Phone charger, Gifts for family, Medicines, Other essentials, …
  reset(): void;
}
```

### `useJournalStore` — `src/store/journal.ts`
```ts
interface JournalStore {
  memories: Memory[];                       // newest first
  addMemory(input: Omit<Memory, 'id' | 'createdAt' | 'favorite'> & { favorite?: boolean }): string;
  updateMemory(id: string, patch: Partial<Omit<Memory, 'id' | 'createdAt'>>): void;
  removeMemory(id: string): void;           // caller deletes files first via services/media
  toggleFavorite(id: string): void;
  seedSample(now?: Date): void;             // 3 illustrated memories + 1 note + 1 sealed "Future Me" letter
  reset(): void;
}
```

### `useChatStore` — `src/store/chat.ts`
```ts
interface ChatStore {
  messages: ChatMessage[];                  // oldest first, persisted (last 100)
  pending: boolean;                         // not persisted
  addMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): string;
  updateMessage(id: string, patch: Partial<ChatMessage>): void;
  setPending(p: boolean): void;
  clear(): void;
}
```

### Selectors — `src/store/selectors.ts` (pure, unit-tested)
- `subjectProgress(subject): number` — done/total chapters (0 when none).
- `overallProgress(subjects): { progress: number; done: number; total: number }` — chapter-weighted.
- `tasksForDay(tasks, day: DayKey): StudyTask[]` (stable order: undone first by createdAt, then done).
- `activityDays(subjects, tasks): Set<DayKey>` — local days with a completed task or chapter.
- `computeStreak(subjects, tasks, now: Date): { current: number; best: number; last7: { day: DayKey; active: boolean }[] }` — current counts back from today, or from yesterday if today has no activity yet.
- `checklistProgress(items, category?): { done: number; total: number; ratio: number }`.
- `buildStudyContext(app, subjects, now): StudyContext`.
- `getJourneyPhase(input: { examDate; travelDate; examCompletedAt?; now: Date }): JourneyPhase` —
  `home` if now ≥ travelDate and (examCompletedAt or now > examDate);
  `completed` if examCompletedAt;
  `exam-day` if now is on the exam's local day or after the exam time;
  else `preparing`.
- `evaluateAchievements(snapshot): AchievementId[]` — ids whose condition currently holds (see `data/achievements.ts`).

---

## 6. Hooks (`src/hooks/`)

| Hook | Returns |
|---|---|
| `useNow(intervalMs = 1000)` | `Date`, ticking; pauses while app is backgrounded (AppState) and refreshes on foreground |
| `useCountdown(targetIso, { startIso?, intervalMs? })` | `{ days, hours, minutes, seconds, totalMs, isPast, progress }` (`progress` = elapsed fraction between start and target, clamped 0–1) |
| `useJourneyPhase()` | `JourneyPhase` (uses `useNow(30_000)`) |
| `usePreparation()` | `{ progress, done, total }` |
| `useStreak()` | result of `computeStreak` (re-evaluated each minute) |
| `useDailyQuote(offset = 0)` | `Quote` — deterministic per local day |
| `useGreeting()` | `'Good morning' \| 'Good afternoon' \| 'Good evening' \| 'Burning the midnight oil'` |
| `useAchievementWatcher()` | `{ current: AchievementDef \| null; dismiss(): void }` — evaluates achievements whenever stores change, unlocks new ones, queues them for the toast (mounted once in root layout) |
| `useStoresHydrated()` | `boolean` — every persisted store has rehydrated |
| `useVoiceRecorder()` | `{ status: 'idle' \| 'recording' \| 'denied'; durationMs; level (0–1 metering for waveform); start(): Promise<void>; stop(): Promise<{ uri: string; durationMs: number } \| null>; cancel(): Promise<void> }` |
| `useVoicePlayback(uri?: string)` | `{ isPlaying; positionMs; durationMs; toggle(); stop() }` |

---

## 7. Services (`src/services/`)

All exported functions are safe to call on every platform (no-ops / `{ ok: false }` on web).

- `haptics.ts` — `type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error'`; `haptic(kind)` respects `settings.haptics`.
- `notifications.ts`
  - `initNotifications(): void` — foreground handler + Android channels (`reminders`, `countdown`). Call once at startup.
  - `requestNotificationPermission(): Promise<boolean>`
  - `syncNotifications(): Promise<{ scheduled: number }>` — cancels all app-scheduled notifications and reschedules from store state: next 7 days of daily motivation (DATE triggers, a different quote each day), DAILY study + sleep reminders, exam alerts (day before 20:00 and 2 h before), travel alerts (day before 19:00 "pack your bag", 3 h before "time to leave"), ticket reminder (tomorrow 10:00 if `!ticket.booked` and travel is in the future). Skips past dates. Does nothing unless `settings.notifications.enabled`.
  - `sendTestNotification(): Promise<void>`
- `calendar.ts`
  - `isCalendarSupported(): boolean`
  - `syncCalendarEvents(): Promise<{ ok: true; created: number; updated: number } | { ok: false; reason: 'unsupported' | 'denied' | 'error'; message?: string }>` — upserts "Final Exam" and "Going Home" events (with alarms) in a dedicated "Last Mile" calendar (fallback: default calendar), persisting ids via `setCalendarSync`.
- `media.ts`
  - `pickPhoto(source: 'library' | 'camera'): Promise<string | null>` — permissions, picker (quality 0.8, editing on), copies into `Paths.document/memories/`, returns persisted URI.
  - `persistFile(uri: string, folder: 'memories' | 'voice'): Promise<string>`
  - `deleteFile(uri?: string): Promise<void>`
- `ai/`
  - `ai/index.ts` — `askAssistant(input: { mode: AssistantMode; prompt: string; history: ChatMessage[]; context: StudyContext }): Promise<AssistantReply>`; uses the cloud proxy when `isCloudAIConfigured()`, falling back to offline on network/HTTP failure. `isCloudAIConfigured(): boolean`.
  - `ai/cloud.ts` — `fetch(`${AI_PROXY_URL}/v1/assistant`)` with `AssistantRequest` body, 45 s timeout (AbortController), optional `x-app-token` header.
  - `ai/offline.ts` — deterministic on-device study buddy (honestly labelled "Offline mode"):
    - `buildRevisionPlan(context, now)` → day-by-day plan distributing remaining chapters across days until each subject's exam (or main exam), last day = light revision + sleep.
    - `summarizeText(text, maxSentences = 5)` → extractive summary (sentence scoring by normalised term frequency, stop-words removed, original order kept) + key terms.
    - `generateClozeMCQs(text, count = 5)` → fill-in-the-blank MCQs from the user's own notes (key term blanked, 3 distractors from other key terms); returns `[]` when text is too short.
    - `explainTopic(topic)` → structured study scaffold (what/why/how, an example prompt, common exam questions, a memory hook) clearly stating that detailed explanations need cloud AI.
    - `offlineReply(input) : AssistantReply`.
- `config.ts` (src root): `AI_PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL ?? ''`, `AI_APP_TOKEN = process.env.EXPO_PUBLIC_AI_APP_TOKEN ?? ''`.

---

## 8. Data (`src/data/`)

- `illustrations.ts` ✅ exists — `illustrations[key]` → image source.
- `quotes.ts` — `interface Quote { text: string; author?: string }`, ≥ 40 original motivational lines incl.
  "Discipline now gives you the freedom you're waiting for.", "Soon this struggle will be a beautiful memory.",
  "A calm mind can achieve anything.", "Good things are coming…", "One final push before freedom.". `quoteForDay(day: DayKey, offset?)`.
- `achievements.ts` — `interface AchievementDef { id: AchievementId; title; description; icon: IconName; gradient: Gradient; hint: string }`, `achievementDefs: AchievementDef[]`, `achievementById`.
  first-step (complete a task), streak-3, streak-7, chapter-10 (10 chapters done), subject-master (a subject at 100%),
  prepared-80 (overall ≥ 80%), zen-mode (3 breathing sessions), ai-curious (5 AI questions), memory-keeper (3 memories),
  time-capsule (seal a Future-Me memory), packed (all checklist items done, ≥ 5 items), exam-conqueror (exam completed),
  homebound (journey phase `home`).
- `breathing.ts` — `interface BreathPhase { kind: 'inhale' | 'hold' | 'exhale' | 'rest'; label: string; seconds: number }`, `interface BreathingPattern { id; name; description; phases: BreathPhase[] }` — Box 4-4-4-4, Relax 4-7-8, Calm 4-6.
- `tips.ts` — exam-stress tips, sleep tips, study techniques (`{ title; body; icon }`).
- `checklist.ts` — `checklistCategories: Record<ChecklistCategory, { label; icon: IconName; accent: AccentKey }>` (tickets ✈ ticket, packing 👕 tshirt-crew, documents 🪪 card-account-details, gifts 🎁 gift, essentials 🔌 power-plug) + filter groups for the UI (All / Packing / Documents / Gifts / Others = tickets + essentials).
- `subjects.ts` — `subjectIconOptions: IconName[]` (database, lan, monitor, calculator-variant, book-open-variant, flask, code-braces, chart-line, atom, translate, brain, pencil-ruler), `accentKeys` reuse.
- `travel.ts` — `travelModes: Record<TravelMode, { label; icon: IconName }>`.
- `seed.ts` — factories used by `seedSample()` / `seedDefaults()`.

### Utils ✅ exist — `src/utils/`
- `date.ts` — local-time helpers (tested): `toDayKey`, `fromDayKey`, `startOfDay`, `addDays`, `addMonths`,
  `addYears`, `startOfWeek` (Monday), `startOfMonth`, `isSameDay`, `isSameMonth`, `calendarDaysBetween`,
  `countdownParts(ms)` → `CountdownParts`, `describeCountdown(parts)`, `monthName`, `weekdayName`,
  `formatLongDate` ("12 October 2026"), `formatShortDate` ("12 Oct"), `formatDayLabel` ("Mon, 12 Oct"),
  `formatTime` ("9:00 AM"), `formatDateTime`, `ordinal`, `formatOrdinalDate` ("12th October"),
  `formatRelativeDay`, `withTime`, `nextOccurrence(month1Based, day, h, m, from)`, `getMonthGrid` (42 cells),
  `parseIso`, `pad2`, `MS_*` constants. **Use these; don't re-implement date math.**
- `id.ts` — `createId(prefix?)`.

### App identity
Name **Last Mile**, slug `last-mile`, scheme `lastmile`, iOS bundle id / Android package `com.lastmile.app`,
version `1.0.0` (Android `versionCode` 1). Background colour `#070B1A`.

---

## 9. Navigation & flow

- Root `Stack` (headers hidden; custom `ScreenHeader` in screens). `Stack.Protected guard={!hasOnboarded}` → `onboarding`; `guard={hasOnboarded}` → `(tabs)` and every other screen. Modals: `subject/new`, `memory/new` use `presentation: 'modal'`; `celebration` uses `presentation: 'fullScreenModal'` + `animation: 'fade'`.
- Root layout: load fonts (`useFonts(fontAssets)`), wait for store hydration, keep native splash until both ready (`SplashScreen.preventAutoHideAsync()` / `hideAsync()`), then show `BrandSplashOverlay` once. Wrap in `GestureHandlerRootView`, `SafeAreaProvider`, `AppThemeProvider preference={settings.theme}`, router `ThemeProvider` (navigation colours from tokens), `StatusBar` style by scheme. Mount `useAchievementWatcher()` + `AchievementToast`. Call `initNotifications()` once and `syncNotifications()` when relevant settings/dates change.
- Tabs (`(tabs)/_layout.tsx`): `Tabs` from `expo-router/js-tabs` with `tabBar={(props) => <GlassTabBar {...props} />}`, `headerShown: false`. Tabs: **Home** (`home-variant`), **Planner** (`calendar-check`), **Buddy** (`robot-happy`, centre, raised gradient circle), **Journey** (`bus-side`), **Journal** (`book-heart`). Floating pill bar, blurred glass, animated active indicator, haptics.

### User flow
1. First launch → native splash → brand overlay → onboarding pages **Prepare / Complete / Go Home** (illustrations) → setup (name, exam date/time, travel date/time, travel mode, home city, "Start with a sample plan" toggle, "Enable reminders" → permission) → Home.
2. Home → countdowns tick live; daily missions toggle inline; tiles route to features.
3. Exam day → Home/Exam show "Finished your exam? 🎉" → `markExamCompleted()` → `/celebration` (confetti) → "Start my journey home" → Journey tab.
4. Journey phase flips to **completed** → Home hero switches to the achievement image and the going-home countdown becomes the primary card; then **home** after the travel time ("Welcome home ❤️").

---

## 10. AI proxy (`server/`)

Separate Node package (excluded from the app's tsconfig/eslint). `POST /v1/assistant` accepts
`AssistantRequest`, returns `AssistantResponse`. Uses `@anthropic-ai/sdk` with model
`claude-opus-5-5`, adaptive thinking (default for this model), `output_config.effort` tuned per
mode, server-side refusal fallback (`fallbacks: "default"`), and structured outputs (zod) for
MCQs. The Anthropic API key lives only in the server's environment — **never in the app**.
`GET /health`. Optional shared `APP_TOKEN` header check, per-IP rate limit, CORS, body size limit.

---

## 11. Quality gates

```
npx tsc --noEmit        # typecheck (app)
npx expo lint           # eslint-config-expo
npx jest                # unit tests (selectors, date utils, offline AI)
npx expo export -p web  # bundles; also used for screenshot QA
npx expo-doctor
(cd server && npm run typecheck)
```
