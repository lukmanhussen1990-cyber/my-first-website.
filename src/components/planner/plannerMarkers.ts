import type { DayMarkers } from '@/components/ui/MonthCalendar';
import { accents } from '@/theme/colors';
import type { IsoDateTime, StudyTask, Subject } from '@/types';
import { parseIso, toDayKey } from '@/utils/date';

const MAX_DOTS = 3;
const UNASSIGNED_DOT = accents.indigo.solid;

/**
 * Calendar markers for the planner: one dot per subject with work planned that
 * day (in the subject's accent colour), exam flags for every paper plus the main
 * exam, and the travel day.
 */
export function buildDayMarkers(
  tasks: readonly StudyTask[],
  subjects: readonly Subject[],
  examDate: IsoDateTime,
  travelDate: IsoDateTime,
): DayMarkers {
  const markers: DayMarkers = {};
  const colorOf = new Map(subjects.map((subject) => [subject.id, accents[subject.color].solid]));
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const marker = (markers[task.day] ??= {});
    const color = (task.subjectId && colorOf.get(task.subjectId)) || UNASSIGNED_DOT;
    const dots = (marker.dots ??= []);
    if (!dots.includes(color) && dots.length < MAX_DOTS) dots.push(color);
    counts.set(task.day, (counts.get(task.day) ?? 0) + 1);
  }
  for (const [day, count] of counts) {
    markers[day].label = `${count} ${count === 1 ? 'task' : 'tasks'}`;
  }

  const examDays = [examDate, ...subjects.map((subject) => subject.examDate)].filter(
    (iso): iso is IsoDateTime => Boolean(iso),
  );
  for (const iso of examDays) {
    const day = toDayKey(parseIso(iso));
    markers[day] = { ...markers[day], exam: true };
  }

  const travelDay = toDayKey(parseIso(travelDate));
  markers[travelDay] = { ...markers[travelDay], travel: true };
  return markers;
}
