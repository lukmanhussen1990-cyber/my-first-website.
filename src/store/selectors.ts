/**
 * Pure derived state. No React, no stores — everything takes plain data (and an
 * explicit `now`) so it is trivially unit-testable and reusable from services.
 */
import { ACHIEVEMENT_RULES, achievementDefs } from '@/data/achievements';
import type {
  AchievementId,
  ChecklistCategory,
  ChecklistItem,
  DayKey,
  IsoDateTime,
  JourneyPhase,
  Memory,
  Profile,
  Stats,
  StudyContext,
  StudyTask,
  Subject,
} from '@/types';
import {
  addDays,
  calendarDaysBetween,
  countdownParts,
  fromDayKey,
  isSameDay,
  startOfDay,
  toDayKey,
  type CountdownParts,
} from '@/utils/date';

/** Epoch ms for an ISO string, NaN when missing or malformed. */
const timeOf = (iso: IsoDateTime | undefined | null): number => (iso ? new Date(iso).getTime() : Number.NaN);

/** Local day key of an ISO timestamp, or null when malformed. */
function dayKeyOf(iso: IsoDateTime | undefined): DayKey | null {
  const time = timeOf(iso);
  return Number.isNaN(time) ? null : toDayKey(new Date(time));
}

/* ------------------------------------------------------------------ */
/* Study progress                                                      */
/* ------------------------------------------------------------------ */

export interface ProgressSummary {
  /** 0–1 */
  progress: number;
  done: number;
  total: number;
}

/** Done / total chapters (0 when the subject has none). */
export function subjectProgress(subject: Pick<Subject, 'chapters'>): number {
  const total = subject.chapters.length;
  if (total === 0) return 0;
  return subject.chapters.filter((chapter) => chapter.done).length / total;
}

/** Chapter-weighted progress across every subject. */
export function overallProgress(subjects: readonly Pick<Subject, 'chapters'>[]): ProgressSummary {
  let done = 0;
  let total = 0;
  for (const subject of subjects) {
    total += subject.chapters.length;
    done += subject.chapters.filter((chapter) => chapter.done).length;
  }
  return { progress: total === 0 ? 0 : done / total, done, total };
}

const compareIso = (a: IsoDateTime, b: IsoDateTime) => (a < b ? -1 : a > b ? 1 : 0);

/** Tasks planned for `day`: undone first, then done — each group in creation order. */
export function tasksForDay(tasks: readonly StudyTask[], day: DayKey): StudyTask[] {
  return tasks
    .filter((task) => task.day === day)
    .sort((a, b) => Number(a.done) - Number(b.done) || compareIso(a.createdAt, b.createdAt));
}

export interface ExamScheduleEntry {
  subjectId: string;
  name: string;
  code?: string;
  color: Subject['color'];
  icon: Subject['icon'];
  venue?: string;
  /** The subject's paper, or the main exam date when it has none. */
  date: IsoDateTime;
}

/** Every subject's paper in chronological order (ties keep subject order). */
export function examSchedule(subjects: readonly Subject[], mainExamDate: IsoDateTime): ExamScheduleEntry[] {
  return subjects
    .map((subject) => ({
      subjectId: subject.id,
      name: subject.name,
      code: subject.code,
      color: subject.color,
      icon: subject.icon,
      venue: subject.venue,
      date: subject.examDate ?? mainExamDate,
    }))
    .sort((a, b) => (timeOf(a.date) || 0) - (timeOf(b.date) || 0));
}

/* ------------------------------------------------------------------ */
/* Streaks                                                             */
/* ------------------------------------------------------------------ */

/** Local days with at least one completed task or chapter. */
export function activityDays(
  subjects: readonly Pick<Subject, 'chapters'>[],
  tasks: readonly StudyTask[],
): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const subject of subjects) {
    for (const chapter of subject.chapters) {
      const day = chapter.done ? dayKeyOf(chapter.doneAt) : null;
      if (day) days.add(day);
    }
  }
  for (const task of tasks) {
    if (!task.done) continue;
    // Tasks completed before `doneAt` existed fall back to the day they were planned for.
    days.add(dayKeyOf(task.doneAt) ?? task.day);
  }
  return days;
}

export interface StreakDay {
  day: DayKey;
  active: boolean;
}

export interface StreakSummary {
  /** Consecutive active days ending today — or yesterday while today has no activity yet. */
  current: number;
  /** Longest run of consecutive active days up to today. */
  best: number;
  /** The last seven local days, oldest first, ending today. */
  last7: StreakDay[];
}

export function computeStreak(
  subjects: readonly Pick<Subject, 'chapters'>[],
  tasks: readonly StudyTask[],
  now: Date,
): StreakSummary {
  const days = activityDays(subjects, tasks);
  const today = startOfDay(now);
  const todayKey = toDayKey(today);

  let current = 0;
  let cursor = days.has(todayKey) ? today : addDays(today, -1);
  while (days.has(toDayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of [...days].filter((day) => day <= todayKey).sort()) {
    const date = fromDayKey(key);
    run = previous && calendarDaysBetween(previous, date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  const last7 = Array.from({ length: 7 }, (_, index) => {
    const day = toDayKey(addDays(today, index - 6));
    return { day, active: days.has(day) };
  });

  return { current, best: Math.max(best, current), last7 };
}

/* ------------------------------------------------------------------ */
/* Travel checklist                                                    */
/* ------------------------------------------------------------------ */

export interface ChecklistProgress {
  done: number;
  total: number;
  /** 0–1 (0 when there are no items). */
  ratio: number;
}

/** Progress for all items, one category, or a group of categories (e.g. the "Others" filter). */
export function checklistProgress(
  items: readonly ChecklistItem[],
  category?: ChecklistCategory | readonly ChecklistCategory[],
): ChecklistProgress {
  const categories = category === undefined ? null : typeof category === 'string' ? [category] : category;
  const scoped = categories ? items.filter((item) => categories.includes(item.category)) : items;
  const done = scoped.filter((item) => item.done).length;
  return { done, total: scoped.length, ratio: scoped.length === 0 ? 0 : done / scoped.length };
}

/* ------------------------------------------------------------------ */
/* Assistant context                                                   */
/* ------------------------------------------------------------------ */

export interface StudyContextSource {
  profile: Pick<Profile, 'name'>;
  examDate: IsoDateTime;
}

/** Snapshot of the plan sent to the AI assistant (cloud or offline). */
export function buildStudyContext(
  app: StudyContextSource,
  subjects: readonly Subject[],
  now: Date,
): StudyContext {
  const name = app.profile.name.trim();
  return {
    studentName: name || undefined,
    today: toDayKey(now),
    examDate: app.examDate,
    subjects: subjects.map((subject) => ({
      name: subject.name,
      progress: subjectProgress(subject),
      examDate: subject.examDate,
      remainingChapters: subject.chapters.filter((chapter) => !chapter.done).map((chapter) => chapter.title),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Journey & countdowns                                                */
/* ------------------------------------------------------------------ */

export interface JourneyPhaseInput {
  examDate: IsoDateTime;
  travelDate: IsoDateTime;
  examCompletedAt?: IsoDateTime;
  now: Date;
}

/**
 * preparing → exam-day → completed → home.
 *  - `home` once travel time has passed and the exam is done (marked, or its time has passed);
 *  - `completed` when the exam is marked done;
 *  - `exam-day` on the exam's local day, or after the exam time if not marked done;
 *  - otherwise `preparing`.
 */
export function getJourneyPhase({ examDate, travelDate, examCompletedAt, now }: JourneyPhaseInput): JourneyPhase {
  const nowMs = now.getTime();
  const examMs = timeOf(examDate);
  const completed = Boolean(examCompletedAt);
  if (nowMs >= timeOf(travelDate) && (completed || nowMs > examMs)) return 'home';
  if (completed) return 'completed';
  if (nowMs > examMs || (!Number.isNaN(examMs) && isSameDay(now, new Date(examMs)))) return 'exam-day';
  return 'preparing';
}

export interface CountdownState extends CountdownParts {
  /** Milliseconds left (0 once the target has passed). */
  totalMs: number;
  isPast: boolean;
  /** Elapsed fraction between `start` and the target, clamped 0–1 (0/1 by isPast without a start). */
  progress: number;
}

/** Countdown to `targetIso` at `now`; malformed targets count as already past. */
export function getCountdown(targetIso: IsoDateTime, now: Date, startIso?: IsoDateTime): CountdownState {
  const nowMs = now.getTime();
  const target = timeOf(targetIso);
  const isPast = Number.isNaN(target) || target <= nowMs;
  const totalMs = isPast ? 0 : target - nowMs;

  let progress = isPast ? 1 : 0;
  const start = timeOf(startIso);
  if (!isPast && !Number.isNaN(start) && target > start) {
    progress = Math.min(1, Math.max(0, (nowMs - start) / (target - start)));
  }

  return { ...countdownParts(totalMs), totalMs, isPast, progress };
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

/** A time-capsule memory stays locked until `sealedUntil`. */
export function isMemorySealed(memory: Pick<Memory, 'sealedUntil'>, now: Date): boolean {
  const until = timeOf(memory.sealedUntil);
  return !Number.isNaN(until) && until > now.getTime();
}

/* ------------------------------------------------------------------ */
/* Achievements                                                        */
/* ------------------------------------------------------------------ */

/** Everything achievement conditions depend on, gathered from the stores. */
export interface AchievementSnapshot {
  now: Date;
  subjects: readonly Subject[];
  tasks: readonly StudyTask[];
  checklist: readonly ChecklistItem[];
  memories: readonly Memory[];
  stats: Stats;
  examDate: IsoDateTime;
  travelDate: IsoDateTime;
  examCompletedAt?: IsoDateTime;
}

/** Ids whose condition currently holds, in `achievementDefs` order. */
export function evaluateAchievements(snapshot: AchievementSnapshot): AchievementId[] {
  const rules = ACHIEVEMENT_RULES;
  const { subjects, tasks, checklist, memories, stats } = snapshot;
  const streak = computeStreak(subjects, tasks, snapshot.now);
  const overall = overallProgress(subjects);
  const checklistState = checklistProgress(checklist);

  const holds: Record<AchievementId, boolean> = {
    'first-step': tasks.some((task) => task.done),
    'streak-3': streak.best >= rules.shortStreakDays,
    'streak-7': streak.best >= rules.longStreakDays,
    'chapter-10': overall.done >= rules.chaptersDone,
    'subject-master': subjects.some((subject) => subject.chapters.length > 0 && subjectProgress(subject) === 1),
    'prepared-80': overall.total > 0 && overall.progress >= rules.preparedRatio,
    'zen-mode': stats.breathingSessions >= rules.breathingSessions,
    'ai-curious': stats.aiQuestions >= rules.aiQuestions,
    'memory-keeper': memories.length >= rules.memories,
    'time-capsule': memories.some((memory) => Boolean(memory.sealedUntil)),
    packed: checklistState.total >= rules.packedMinItems && checklistState.done === checklistState.total,
    'exam-conqueror': Boolean(snapshot.examCompletedAt),
    homebound:
      getJourneyPhase({
        examDate: snapshot.examDate,
        travelDate: snapshot.travelDate,
        examCompletedAt: snapshot.examCompletedAt,
        now: snapshot.now,
      }) === 'home',
  };

  return achievementDefs.map((def) => def.id).filter((id) => holds[id]);
}
