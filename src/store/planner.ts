import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createSamplePlanner, defaultExamDate } from '@/data/seed';
import type { AccentKey, Chapter, DayKey, IconName, IsoDateTime, StudyTask, Subject } from '@/types';
import { parseIso } from '@/utils/date';
import { createId } from '@/utils/id';

import { arrayOr, persistOptions, recordOr } from './storage';

export interface NewSubjectInput {
  name: string;
  code?: string;
  color: AccentKey;
  icon: IconName;
  examDate?: IsoDateTime;
  venue?: string;
  /** Chapter titles; blank lines are skipped. */
  chapters?: string[];
  notes?: string;
}

export interface NewTaskInput {
  title: string;
  detail?: string;
  subjectId?: string;
  day: DayKey;
}

interface PlannerData {
  subjects: Subject[];
  tasks: StudyTask[];
}

export interface PlannerStore extends PlannerData {
  addSubject(input: NewSubjectInput): string;
  updateSubject(id: string, patch: Partial<Omit<Subject, 'id' | 'createdAt'>>): void;
  /** Also clears `subjectId` on the subject's tasks. */
  removeSubject(id: string): void;
  addChapter(subjectId: string, title: string): void;
  /** Flips `done` and sets / clears `doneAt`. */
  toggleChapter(subjectId: string, chapterId: string): void;
  renameChapter(subjectId: string, chapterId: string, title: string): void;
  removeChapter(subjectId: string, chapterId: string): void;
  addPaper(subjectId: string, title: string, year?: string): void;
  togglePaper(subjectId: string, paperId: string): void;
  removePaper(subjectId: string, paperId: string): void;
  setNotes(subjectId: string, notes: string): void;
  addTask(input: NewTaskInput): string;
  /** Flips `done` and sets / clears `doneAt`. */
  toggleTask(id: string): void;
  updateTask(id: string, patch: Partial<Omit<StudyTask, 'id' | 'createdAt'>>): void;
  removeTask(id: string): void;
  /**
   * Replaces subjects and tasks with the sample plan (DBMS, Networks, OS, Aptitude,
   * Theory + today's 3 missions), dated relative to `now` and `examDate`
   * (default: the next 12 October 09:00).
   */
  seedSample(now?: Date, examDate?: IsoDateTime): void;
  reset(): void;
}

const initialPlanner = (): PlannerData => ({ subjects: [], tasks: [] });

const nowIso = () => new Date().toISOString();
const blankToUndefined = (value: string | undefined) => value?.trim() || undefined;

const newChapter = (title: string): Chapter => ({ id: createId('ch_'), title, done: false });

function updateSubjectIn(subjects: Subject[], id: string, update: (subject: Subject) => Subject): Subject[] {
  return subjects.map((subject) => (subject.id === id ? update(subject) : subject));
}

function updateChapterIn(
  subjects: Subject[],
  subjectId: string,
  chapterId: string,
  update: (chapter: Chapter) => Chapter,
): Subject[] {
  return updateSubjectIn(subjects, subjectId, (subject) => ({
    ...subject,
    chapters: subject.chapters.map((chapter) => (chapter.id === chapterId ? update(chapter) : chapter)),
  }));
}

function updateTaskIn(tasks: StudyTask[], id: string, update: (task: StudyTask) => StudyTask): StudyTask[] {
  return tasks.map((task) => (task.id === id ? update(task) : task));
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set) => ({
      ...initialPlanner(),

      addSubject(input) {
        const id = createId('sub_');
        const subject: Subject = {
          id,
          name: input.name.trim(),
          code: blankToUndefined(input.code),
          color: input.color,
          icon: input.icon,
          examDate: input.examDate,
          venue: blankToUndefined(input.venue),
          chapters: (input.chapters ?? [])
            .map((title) => title.trim())
            .filter(Boolean)
            .map(newChapter),
          papers: [],
          notes: input.notes ?? '',
          createdAt: nowIso(),
        };
        set((state) => ({ subjects: [...state.subjects, subject] }));
        return id;
      },

      updateSubject(id, patch) {
        set((state) => ({ subjects: updateSubjectIn(state.subjects, id, (subject) => ({ ...subject, ...patch })) }));
      },

      removeSubject(id) {
        set((state) => ({
          subjects: state.subjects.filter((subject) => subject.id !== id),
          tasks: state.tasks.map((task) => (task.subjectId === id ? { ...task, subjectId: undefined } : task)),
        }));
      },

      addChapter(subjectId, title) {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => ({
          subjects: updateSubjectIn(state.subjects, subjectId, (subject) => ({
            ...subject,
            chapters: [...subject.chapters, newChapter(trimmed)],
          })),
        }));
      },

      toggleChapter(subjectId, chapterId) {
        set((state) => ({
          subjects: updateChapterIn(state.subjects, subjectId, chapterId, (chapter) =>
            chapter.done
              ? { ...chapter, done: false, doneAt: undefined }
              : { ...chapter, done: true, doneAt: nowIso() },
          ),
        }));
      },

      renameChapter(subjectId, chapterId, title) {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => ({
          subjects: updateChapterIn(state.subjects, subjectId, chapterId, (chapter) => ({ ...chapter, title: trimmed })),
        }));
      },

      removeChapter(subjectId, chapterId) {
        set((state) => ({
          subjects: updateSubjectIn(state.subjects, subjectId, (subject) => ({
            ...subject,
            chapters: subject.chapters.filter((chapter) => chapter.id !== chapterId),
          })),
        }));
      },

      addPaper(subjectId, title, year) {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => ({
          subjects: updateSubjectIn(state.subjects, subjectId, (subject) => ({
            ...subject,
            papers: [
              ...subject.papers,
              { id: createId('pp_'), title: trimmed, year: blankToUndefined(year), done: false },
            ],
          })),
        }));
      },

      togglePaper(subjectId, paperId) {
        set((state) => ({
          subjects: updateSubjectIn(state.subjects, subjectId, (subject) => ({
            ...subject,
            papers: subject.papers.map((paper) => (paper.id === paperId ? { ...paper, done: !paper.done } : paper)),
          })),
        }));
      },

      removePaper(subjectId, paperId) {
        set((state) => ({
          subjects: updateSubjectIn(state.subjects, subjectId, (subject) => ({
            ...subject,
            papers: subject.papers.filter((paper) => paper.id !== paperId),
          })),
        }));
      },

      setNotes(subjectId, notes) {
        set((state) => ({ subjects: updateSubjectIn(state.subjects, subjectId, (subject) => ({ ...subject, notes })) }));
      },

      addTask(input) {
        const id = createId('task_');
        const task: StudyTask = {
          id,
          title: input.title.trim(),
          detail: blankToUndefined(input.detail),
          subjectId: input.subjectId,
          day: input.day,
          done: false,
          createdAt: nowIso(),
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
        return id;
      },

      toggleTask(id) {
        set((state) => ({
          tasks: updateTaskIn(state.tasks, id, (task) =>
            task.done ? { ...task, done: false, doneAt: undefined } : { ...task, done: true, doneAt: nowIso() },
          ),
        }));
      },

      updateTask(id, patch) {
        set((state) => ({ tasks: updateTaskIn(state.tasks, id, (task) => ({ ...task, ...patch })) }));
      },

      removeTask(id) {
        set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) }));
      },

      seedSample(now = new Date(), examDate) {
        const exam = parseIso(examDate, defaultExamDate(now));
        set(createSamplePlanner(now, exam));
      },

      reset() {
        set(initialPlanner());
      },
    }),
    persistOptions<PlannerStore, PlannerData>('planner', {
      partialize: ({ subjects, tasks }) => ({ subjects, tasks }),
      merge: (persisted, current) => {
        const stored = recordOr<PlannerData>(persisted);
        return {
          ...current,
          subjects: arrayOr(stored.subjects, current.subjects),
          tasks: arrayOr(stored.tasks, current.tasks),
        };
      },
    }),
  ),
);
