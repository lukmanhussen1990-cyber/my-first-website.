/**
 * Domain model for Last Mile. Every store, service and screen builds on these
 * types — change them deliberately.
 *
 * Date conventions:
 *  - `IsoDateTime`: full ISO-8601 timestamp from `Date#toISOString()` (UTC, e.g. "2026-10-12T03:30:00.000Z").
 *  - `DayKey`: a *local* calendar day "YYYY-MM-DD" (see `toDayKey` in utils/date).
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { AccentKey } from '@/theme/colors';
import type { ThemePreference } from '@/theme/ThemeProvider';

export type { AccentKey, ThemePreference };

export type IsoDateTime = string;
export type DayKey = string;

/** Icon names come from MaterialCommunityIcons — the single icon set used app-wide. */
export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/* ------------------------------------------------------------------ */
/* App / profile / settings                                            */
/* ------------------------------------------------------------------ */

export interface ClockTime {
  hour: number; // 0–23
  minute: number; // 0–59
}

export interface NotificationSettings {
  /** Master switch — set once the user grants permission. */
  enabled: boolean;
  dailyMotivation: boolean;
  dailyMotivationTime: ClockTime;
  studyReminder: boolean;
  studyReminderTime: ClockTime;
  sleepReminder: boolean;
  sleepReminderTime: ClockTime;
  /** Alerts the day before and the morning of the exam. */
  examAlerts: boolean;
  /** Packing reminder the day before departure + "time to leave" alert. */
  travelAlerts: boolean;
}

export interface CalendarSyncState {
  examEventId?: string;
  travelEventId?: string;
  calendarId?: string;
  lastSyncedAt?: IsoDateTime;
}

export interface Settings {
  theme: ThemePreference;
  haptics: boolean;
  notifications: NotificationSettings;
  calendar: CalendarSyncState;
}

export type TravelMode = 'bus' | 'train' | 'flight' | 'car';

export interface TicketInfo {
  mode: TravelMode;
  booked: boolean;
  /** PNR / booking reference. */
  reference?: string;
  from?: string;
  to?: string;
  seat?: string;
}

export interface Profile {
  name: string;
  university?: string;
  homeCity?: string;
}

/**
 * The emotional arc of the app:
 *  preparing → exam-day → completed (exams done, waiting to travel) → home.
 */
export type JourneyPhase = 'preparing' | 'exam-day' | 'completed' | 'home';

/* ------------------------------------------------------------------ */
/* Study planner                                                       */
/* ------------------------------------------------------------------ */

export interface Chapter {
  id: string;
  title: string;
  done: boolean;
  doneAt?: IsoDateTime;
}

export interface PastPaper {
  id: string;
  title: string;
  year?: string;
  done: boolean;
}

export interface Subject {
  id: string;
  name: string;
  /** Short code shown on chips, e.g. "DBMS". */
  code?: string;
  color: AccentKey;
  icon: IconName;
  /** Paper date/time for this subject (optional — falls back to the main exam date). */
  examDate?: IsoDateTime;
  venue?: string;
  chapters: Chapter[];
  papers: PastPaper[];
  notes: string;
  createdAt: IsoDateTime;
}

export interface StudyTask {
  id: string;
  title: string;
  /** Secondary line, e.g. "(Databases)". */
  detail?: string;
  subjectId?: string;
  /** Local day this task is planned for. */
  day: DayKey;
  done: boolean;
  doneAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

/* ------------------------------------------------------------------ */
/* Travel                                                              */
/* ------------------------------------------------------------------ */

export type ChecklistCategory = 'tickets' | 'packing' | 'documents' | 'gifts' | 'essentials';

export interface ChecklistItem {
  id: string;
  title: string;
  category: ChecklistCategory;
  done: boolean;
  createdAt: IsoDateTime;
}

/* ------------------------------------------------------------------ */
/* Memory journal                                                      */
/* ------------------------------------------------------------------ */

export type MemoryKind = 'photo' | 'note' | 'voice';

/** Keys of bundled illustrations (see data/illustrations). */
export type IllustrationKey =
  | 'home-hero'
  | 'exam-countdown'
  | 'study-planner'
  | 'ai-assistant'
  | 'home-journey'
  | 'travel-checklist'
  | 'stress-relief'
  | 'memory-journal'
  | 'achievement'
  | 'onboarding-prepare'
  | 'onboarding-complete'
  | 'onboarding-go-home';

export interface Memory {
  id: string;
  kind: MemoryKind;
  title: string;
  body?: string;
  /** Persisted local file URI (copied into the app's document directory). */
  photoUri?: string;
  /** Used by seeded sample memories instead of a file. */
  illustration?: IllustrationKey;
  audioUri?: string;
  audioDurationMs?: number;
  /** When the memory happened (defaults to creation time). */
  date: IsoDateTime;
  createdAt: IsoDateTime;
  favorite: boolean;
  /** Time capsule: content stays locked until this moment ("Open after 1 year"). */
  sealedUntil?: IsoDateTime;
}

/* ------------------------------------------------------------------ */
/* Achievements & stats                                                */
/* ------------------------------------------------------------------ */

export type AchievementId =
  | 'first-step'
  | 'streak-3'
  | 'streak-7'
  | 'chapter-10'
  | 'subject-master'
  | 'prepared-80'
  | 'zen-mode'
  | 'ai-curious'
  | 'memory-keeper'
  | 'time-capsule'
  | 'packed'
  | 'exam-conqueror'
  | 'homebound';

export interface Stats {
  breathingSessions: number;
  aiQuestions: number;
  /** Total completed breathing seconds. */
  calmSeconds: number;
}

/* ------------------------------------------------------------------ */
/* AI study assistant                                                  */
/* ------------------------------------------------------------------ */

export type AssistantMode = 'chat' | 'explain' | 'mcq' | 'summarize' | 'plan';

export interface MCQ {
  question: string;
  /** Exactly four options. */
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  mode: AssistantMode;
  createdAt: IsoDateTime;
  /** Present on assistant replies to `mcq` requests. */
  mcqs?: MCQ[];
  /** Where the reply came from: the cloud model or the on-device study buddy. */
  source?: 'cloud' | 'offline';
  error?: boolean;
}

/** Snapshot of the student's plan sent to the assistant for personalised answers. */
export interface StudyContext {
  studentName?: string;
  /** Local day key for "today". */
  today: DayKey;
  examDate: IsoDateTime;
  subjects: {
    name: string;
    progress: number; // 0–1
    examDate?: IsoDateTime;
    remainingChapters: string[];
  }[];
}

/** Request body for POST {AI_PROXY_URL}/v1/assistant — mirrored in server/src/types.ts. */
export interface AssistantRequest {
  mode: AssistantMode;
  /** Conversation so far, oldest first; the last item is the new user message. */
  messages: { role: 'user' | 'assistant'; content: string }[];
  context?: StudyContext;
}

/** Response body for POST /v1/assistant. */
export interface AssistantResponse {
  text: string;
  mcqs?: MCQ[];
}

export interface AssistantReply extends AssistantResponse {
  source: 'cloud' | 'offline';
}
