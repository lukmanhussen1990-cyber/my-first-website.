import type { Chapter, ChecklistItem, Memory, StudyTask, Subject } from '@/types';
import { toDayKey } from '@/utils/date';

/** Local date helper: month is 1-based. */
export const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute);

let seq = 0;
const nextId = (prefix: string) => `${prefix}${++seq}`;

export function chapter(done: boolean, doneAt?: Date, title = 'Chapter'): Chapter {
  return { id: nextId('ch'), title, done, doneAt: doneAt?.toISOString() };
}

export function subject(chapters: Chapter[], extra: Partial<Subject> = {}): Subject {
  return {
    id: nextId('sub'),
    name: 'Subject',
    color: 'purple',
    icon: 'database',
    chapters,
    papers: [],
    notes: '',
    createdAt: at(2026, 9, 1).toISOString(),
    ...extra,
  };
}

export function task(extra: Partial<StudyTask> & Pick<StudyTask, 'day'>): StudyTask {
  return {
    id: nextId('task'),
    title: 'Task',
    done: false,
    createdAt: at(2026, 9, 1).toISOString(),
    ...extra,
  };
}

export function doneTask(doneAt: Date, extra: Partial<StudyTask> = {}): StudyTask {
  return task({ day: toDayKey(doneAt), done: true, doneAt: doneAt.toISOString(), ...extra });
}

export function item(category: ChecklistItem['category'], done: boolean): ChecklistItem {
  return { id: nextId('item'), title: 'Item', category, done, createdAt: at(2026, 9, 1).toISOString() };
}

export function memory(extra: Partial<Memory> = {}): Memory {
  const date = at(2026, 10, 1).toISOString();
  return { id: nextId('mem'), kind: 'note', title: 'Memory', date, createdAt: date, favorite: false, ...extra };
}
