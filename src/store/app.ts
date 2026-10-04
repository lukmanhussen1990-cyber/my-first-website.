import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createDefaultDates } from '@/data/seed';
import type {
  AchievementId,
  CalendarSyncState,
  IsoDateTime,
  NotificationSettings,
  Profile,
  Settings,
  Stats,
  ThemePreference,
  TicketInfo,
  TravelMode,
} from '@/types';

import { useChatStore } from './chat';
import { useJournalStore } from './journal';
import { usePlannerStore } from './planner';
import { persistOptions, recordOr } from './storage';
import { useTravelStore } from './travel';

export const defaultNotificationSettings: NotificationSettings = {
  enabled: false,
  dailyMotivation: true,
  dailyMotivationTime: { hour: 8, minute: 0 },
  studyReminder: true,
  studyReminderTime: { hour: 19, minute: 0 },
  sleepReminder: true,
  sleepReminderTime: { hour: 23, minute: 0 },
  examAlerts: true,
  travelAlerts: true,
};

export const defaultSettings: Settings = {
  theme: 'dark',
  haptics: true,
  notifications: defaultNotificationSettings,
  calendar: {},
};

export const defaultStats: Stats = { breathingSessions: 0, aiQuestions: 0, calmSeconds: 0 };

export interface OnboardingInput {
  name: string;
  examDate: IsoDateTime;
  travelDate: IsoDateTime;
  homeCity?: string;
  travelMode?: TravelMode;
  useSamplePlan: boolean;
}

/** The persisted part of the app store. */
interface AppData {
  hasOnboarded: boolean;
  profile: Profile;
  examDate: IsoDateTime;
  travelDate: IsoDateTime;
  /** Set at onboarding; baseline for countdown ring progress. */
  journeyStartedAt: IsoDateTime;
  examCompletedAt?: IsoDateTime;
  ticket: TicketInfo;
  settings: Settings;
  stats: Stats;
  unlockedAchievements: Partial<Record<AchievementId, IsoDateTime>>;
}

export interface AppStore extends AppData {
  /** True once persisted state has been rehydrated (not persisted). */
  hydrated: boolean;

  /**
   * Finishes onboarding. Seeds the sample plan + journal + default checklist when
   * `useSamplePlan`, otherwise only the default travel checklist.
   */
  completeOnboarding(input: OnboardingInput): void;
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
  /** Returns true only when the achievement was newly unlocked. */
  unlockAchievement(id: AchievementId): boolean;
  /** Resets every store to its initial state (back to onboarding). */
  resetApp(): void;
}

function createInitialAppData(now: Date = new Date()): AppData {
  return {
    hasOnboarded: false,
    profile: { name: '' },
    ...createDefaultDates(now),
    journeyStartedAt: now.toISOString(),
    // Explicit so a shallow `set` clears it on reset.
    examCompletedAt: undefined,
    ticket: { mode: 'bus', booked: false },
    settings: defaultSettings,
    stats: defaultStats,
    unlockedAchievements: {},
  };
}

const pickAppData = (state: AppStore): AppData => ({
  hasOnboarded: state.hasOnboarded,
  profile: state.profile,
  examDate: state.examDate,
  travelDate: state.travelDate,
  journeyStartedAt: state.journeyStartedAt,
  examCompletedAt: state.examCompletedAt,
  ticket: state.ticket,
  settings: state.settings,
  stats: state.stats,
  unlockedAchievements: state.unlockedAchievements,
});

/** Deep-merges nested objects so fields added in later versions keep their defaults. */
function mergeAppData(persisted: unknown, current: AppStore): AppStore {
  const stored = recordOr<AppData>(persisted);
  const settings = recordOr<Settings>(stored.settings);
  return {
    ...current,
    ...stored,
    profile: { ...current.profile, ...recordOr<Profile>(stored.profile) },
    ticket: { ...current.ticket, ...recordOr<TicketInfo>(stored.ticket) },
    stats: { ...current.stats, ...recordOr<Stats>(stored.stats) },
    settings: {
      ...current.settings,
      ...settings,
      notifications: {
        ...current.settings.notifications,
        ...recordOr<NotificationSettings>(settings.notifications),
      },
      calendar: { ...current.settings.calendar, ...recordOr<CalendarSyncState>(settings.calendar) },
    },
    unlockedAchievements: recordOr<AppData['unlockedAchievements']>(stored.unlockedAchievements),
    hydrated: current.hydrated,
  };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...createInitialAppData(),
      hydrated: false,

      completeOnboarding({ name, examDate, travelDate, homeCity, travelMode, useSamplePlan }) {
        const now = new Date();
        // Seed first so the onboarding gate flips with the data already in place.
        if (useSamplePlan) {
          usePlannerStore.getState().seedSample(now, examDate);
          useJournalStore.getState().seedSample(now);
        }
        useTravelStore.getState().seedDefaults();

        set((state) => ({
          hasOnboarded: true,
          profile: { ...state.profile, name: name.trim(), homeCity: homeCity?.trim() || undefined },
          examDate,
          travelDate,
          journeyStartedAt: now.toISOString(),
          examCompletedAt: undefined,
          ticket: { ...state.ticket, mode: travelMode ?? state.ticket.mode },
        }));
      },

      updateProfile(patch) {
        set((state) => ({ profile: { ...state.profile, ...patch } }));
      },

      setExamDate(iso) {
        set({ examDate: iso });
      },

      setTravelDate(iso) {
        set({ travelDate: iso });
      },

      markExamCompleted() {
        set({ examCompletedAt: new Date().toISOString() });
      },

      undoExamCompleted() {
        set({ examCompletedAt: undefined });
      },

      updateTicket(patch) {
        set((state) => ({ ticket: { ...state.ticket, ...patch } }));
      },

      setTheme(theme) {
        set((state) => ({ settings: { ...state.settings, theme } }));
      },

      setHaptics(haptics) {
        set((state) => ({ settings: { ...state.settings, haptics } }));
      },

      updateNotificationSettings(patch) {
        set((state) => ({
          settings: { ...state.settings, notifications: { ...state.settings.notifications, ...patch } },
        }));
      },

      setCalendarSync(patch) {
        set((state) => ({
          settings: { ...state.settings, calendar: { ...state.settings.calendar, ...patch } },
        }));
      },

      incrementStat(key, by = 1) {
        set((state) => ({ stats: { ...state.stats, [key]: state.stats[key] + by } }));
      },

      unlockAchievement(id) {
        if (get().unlockedAchievements[id]) return false;
        set((state) => ({
          unlockedAchievements: { ...state.unlockedAchievements, [id]: new Date().toISOString() },
        }));
        return true;
      },

      resetApp() {
        usePlannerStore.getState().reset();
        useTravelStore.getState().reset();
        useJournalStore.getState().reset();
        useChatStore.getState().clear();
        set({ ...createInitialAppData(), hydrated: true });
      },
    }),
    persistOptions<AppStore, AppData>('app', {
      partialize: pickAppData,
      merge: mergeAppData,
      onHydrated: () => useAppStore.setState({ hydrated: true }),
    }),
  ),
);
