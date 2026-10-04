import {
  activityDays,
  buildStudyContext,
  checklistProgress,
  computeStreak,
  evaluateAchievements,
  examSchedule,
  getCountdown,
  getJourneyPhase,
  isMemorySealed,
  overallProgress,
  subjectProgress,
  tasksForDay,
  type AchievementSnapshot,
} from '@/store/selectors';

import { at, chapter, doneTask, item, memory, subject, task } from './fixtures';

describe('subjectProgress / overallProgress', () => {
  it('is 0 for a subject without chapters', () => {
    expect(subjectProgress(subject([]))).toBe(0);
  });

  it('is the done / total chapter ratio', () => {
    expect(subjectProgress(subject([chapter(true), chapter(false), chapter(true), chapter(true)]))).toBe(0.75);
  });

  it('weights overall progress by chapters, not by subject', () => {
    const small = subject([chapter(true)]); // 100 %
    const large = subject([chapter(false), chapter(false), chapter(false)]); // 0 %
    expect(overallProgress([small, large])).toEqual({ progress: 0.25, done: 1, total: 4 });
  });

  it('is 0 with no subjects or no chapters', () => {
    expect(overallProgress([])).toEqual({ progress: 0, done: 0, total: 0 });
    expect(overallProgress([subject([])])).toEqual({ progress: 0, done: 0, total: 0 });
  });
});

describe('tasksForDay', () => {
  const day = '2026-10-08';
  const created = (minute: number) => at(2026, 10, 7, 21, minute).toISOString();

  it('returns only that day, undone first then done, each in creation order', () => {
    const tasks = [
      task({ id: 'done-late', day, done: true, createdAt: created(5) }),
      task({ id: 'open-late', day, createdAt: created(4) }),
      task({ id: 'other-day', day: '2026-10-09', createdAt: created(0) }),
      task({ id: 'done-early', day, done: true, createdAt: created(1) }),
      task({ id: 'open-early', day, createdAt: created(2) }),
    ];
    expect(tasksForDay(tasks, day).map((t) => t.id)).toEqual(['open-early', 'open-late', 'done-early', 'done-late']);
  });

  it('does not mutate the input', () => {
    const tasks = [task({ day, done: true, createdAt: created(1) }), task({ day, createdAt: created(2) })];
    const before = tasks.map((t) => t.id);
    tasksForDay(tasks, day);
    expect(tasks.map((t) => t.id)).toEqual(before);
  });

  it('returns an empty list for a day without tasks', () => {
    expect(tasksForDay([task({ day })], '2026-10-01')).toEqual([]);
  });
});

describe('activityDays', () => {
  it('collects local days of completed chapters and tasks', () => {
    const days = activityDays(
      [subject([chapter(true, at(2026, 10, 5, 23, 59)), chapter(false), chapter(true, at(2026, 10, 6, 0, 1))])],
      [doneTask(at(2026, 10, 7, 9)), task({ day: '2026-10-08' })],
    );
    expect([...days].sort()).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
  });

  it('falls back to the planned day for done tasks without doneAt, and skips chapters without it', () => {
    const days = activityDays([subject([chapter(true)])], [task({ day: '2026-10-03', done: true })]);
    expect([...days]).toEqual(['2026-10-03']);
  });
});

describe('computeStreak', () => {
  const now = at(2026, 10, 8, 15);
  const daysAgo = (n: number, hour = 12) => at(2026, 10, 8 - n, hour);
  const tasksOn = (...offsets: number[]) => offsets.map((n) => doneTask(daysAgo(n)));

  it('counts back from today when today is active', () => {
    expect(computeStreak([], tasksOn(0, 1, 2), now).current).toBe(3);
  });

  it('continues from yesterday when today has no activity yet', () => {
    expect(computeStreak([], tasksOn(1, 2), now).current).toBe(2);
  });

  it('resets after a missed day', () => {
    expect(computeStreak([], tasksOn(2, 3, 4), now).current).toBe(0);
    expect(computeStreak([], tasksOn(0, 2, 3), now).current).toBe(1);
  });

  it('is 0 with no activity at all', () => {
    const streak = computeStreak([], [], now);
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(0);
    expect(streak.last7.every((day) => !day.active)).toBe(true);
  });

  it('tracks the best streak separately from the current one', () => {
    const streak = computeStreak([], tasksOn(0, 1, 5, 6, 7, 8), now);
    expect(streak.current).toBe(2);
    expect(streak.best).toBe(4);
  });

  it('combines chapters and tasks', () => {
    const subjects = [subject([chapter(true, daysAgo(1)), chapter(true, daysAgo(2))])];
    expect(computeStreak(subjects, tasksOn(0), now).current).toBe(3);
  });

  it('uses local-day boundaries (23:59 and 00:01 are different days)', () => {
    const lateNight = at(2026, 10, 7, 23, 59);
    const justAfterMidnight = at(2026, 10, 8, 0, 1);
    const streak = computeStreak([], [doneTask(lateNight), doneTask(justAfterMidnight)], at(2026, 10, 8, 0, 2));
    expect(streak.current).toBe(2);
  });

  it('counts several completions on one day once', () => {
    expect(computeStreak([], [doneTask(daysAgo(0, 9)), doneTask(daysAgo(0, 22))], now).current).toBe(1);
  });

  it('crosses month boundaries', () => {
    const tasks = [doneTask(at(2026, 9, 30)), doneTask(at(2026, 10, 1))];
    expect(computeStreak([], tasks, at(2026, 10, 1, 20)).current).toBe(2);
  });

  it('ignores future activity for the best streak', () => {
    const streak = computeStreak([], [doneTask(at(2026, 10, 9)), doneTask(at(2026, 10, 10))], now);
    expect(streak.best).toBe(0);
  });

  it('reports the last 7 days, oldest first, ending today', () => {
    const { last7 } = computeStreak([], tasksOn(0, 2, 6, 7), now);
    expect(last7.map((d) => d.day)).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ]);
    expect(last7.map((d) => d.active)).toEqual([true, false, false, false, true, false, true]);
  });
});

describe('checklistProgress', () => {
  it('returns ratio 0 when there are no items', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, ratio: 0 });
    expect(checklistProgress([item('packing', true)], 'gifts')).toEqual({ done: 0, total: 0, ratio: 0 });
  });

  it('counts all items, one category or a group of categories', () => {
    const items = [item('packing', true), item('packing', false), item('tickets', true), item('essentials', false)];
    expect(checklistProgress(items)).toEqual({ done: 2, total: 4, ratio: 0.5 });
    expect(checklistProgress(items, 'packing')).toEqual({ done: 1, total: 2, ratio: 0.5 });
    expect(checklistProgress(items, ['tickets', 'essentials'])).toEqual({ done: 1, total: 2, ratio: 0.5 });
  });
});

describe('buildStudyContext', () => {
  it('summarises subjects with remaining chapters', () => {
    const now = at(2026, 10, 8, 10);
    const dbms = subject([chapter(true, undefined, 'ER Model'), chapter(false, undefined, 'Indexing')], {
      name: 'DBMS',
      examDate: '2026-10-12T03:30:00.000Z',
    });
    expect(buildStudyContext({ profile: { name: '  Arjun ' }, examDate: 'exam-iso' }, [dbms], now)).toEqual({
      studentName: 'Arjun',
      today: '2026-10-08',
      examDate: 'exam-iso',
      subjects: [
        { name: 'DBMS', progress: 0.5, examDate: '2026-10-12T03:30:00.000Z', remainingChapters: ['Indexing'] },
      ],
    });
  });

  it('omits a blank student name', () => {
    expect(buildStudyContext({ profile: { name: '  ' }, examDate: 'x' }, [], new Date()).studentName).toBeUndefined();
  });
});

describe('getJourneyPhase', () => {
  const examDate = at(2026, 10, 12, 9).toISOString();
  const travelDate = at(2026, 10, 12, 18).toISOString();
  const phaseAt = (now: Date, examCompletedAt?: string) =>
    getJourneyPhase({ examDate, travelDate, examCompletedAt, now });

  it('is preparing before the exam day', () => {
    expect(phaseAt(at(2026, 10, 7, 12))).toBe('preparing');
    expect(phaseAt(at(2026, 10, 11, 23, 59))).toBe('preparing');
  });

  it('is exam-day from local midnight of the exam day', () => {
    expect(phaseAt(at(2026, 10, 12, 0, 0))).toBe('exam-day');
    expect(phaseAt(at(2026, 10, 12, 12))).toBe('exam-day');
  });

  it('stays exam-day after the exam time until it is marked done (before travel)', () => {
    expect(phaseAt(at(2026, 10, 12, 17, 59))).toBe('exam-day');
  });

  it('is completed once the exam is marked done, until travel time', () => {
    const done = at(2026, 10, 12, 12).toISOString();
    expect(phaseAt(at(2026, 10, 12, 12, 30), done)).toBe('completed');
    expect(phaseAt(at(2026, 10, 12, 17, 59), done)).toBe('completed');
  });

  it('is home at/after travel time when the exam is done or over', () => {
    const done = at(2026, 10, 12, 12).toISOString();
    expect(phaseAt(at(2026, 10, 12, 18, 0), done)).toBe('home');
    expect(phaseAt(at(2026, 10, 13, 9))).toBe('home');
  });

  it('is not home when travel is before an exam that has not happened', () => {
    const phase = getJourneyPhase({
      examDate,
      travelDate: at(2026, 10, 10, 18).toISOString(),
      now: at(2026, 10, 11, 9),
    });
    expect(phase).toBe('preparing');
  });

  it('marks completed early (e.g. a student finishing before the scheduled date)', () => {
    expect(phaseAt(at(2026, 10, 10, 12), at(2026, 10, 10, 11).toISOString())).toBe('completed');
  });
});

describe('getCountdown', () => {
  const now = at(2026, 10, 7, 18, 27);

  it('splits the remaining time and reports progress from the start', () => {
    const target = at(2026, 10, 12, 9).toISOString();
    const start = at(2026, 10, 2, 9).toISOString();
    const countdown = getCountdown(target, new Date(now.getTime() + 42_000), start);
    expect(countdown).toMatchObject({ days: 4, hours: 14, minutes: 32, seconds: 18, isPast: false });
    expect(countdown.totalMs).toBe(at(2026, 10, 12, 9).getTime() - now.getTime() - 42_000);
    expect(countdown.progress).toBeGreaterThan(0.5);
    expect(countdown.progress).toBeLessThan(0.6);
  });

  it('clamps at zero once the target has passed', () => {
    const countdown = getCountdown(at(2026, 10, 1).toISOString(), now, at(2026, 9, 1).toISOString());
    expect(countdown).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPast: true, progress: 1 });
  });

  it('reports 0 progress without a start, and clamps a start in the future', () => {
    const target = at(2026, 10, 12, 9).toISOString();
    expect(getCountdown(target, now).progress).toBe(0);
    expect(getCountdown(target, now, at(2026, 10, 9).toISOString()).progress).toBe(0);
  });

  it('treats a malformed target as past', () => {
    expect(getCountdown('not-a-date', now).isPast).toBe(true);
  });
});

describe('examSchedule', () => {
  it('sorts papers chronologically and falls back to the main exam date', () => {
    const main = at(2026, 10, 12, 9).toISOString();
    const schedule = examSchedule(
      [
        subject([], { id: 'a', name: 'Main' }),
        subject([], { id: 'b', name: 'Early', examDate: at(2026, 10, 9, 9).toISOString() }),
      ],
      main,
    );
    expect(schedule.map((entry) => [entry.subjectId, entry.date])).toEqual([
      ['b', at(2026, 10, 9, 9).toISOString()],
      ['a', main],
    ]);
  });
});

describe('isMemorySealed', () => {
  it('is sealed only until the sealedUntil moment', () => {
    const until = at(2027, 10, 8).toISOString();
    expect(isMemorySealed({ sealedUntil: until }, at(2026, 10, 8))).toBe(true);
    expect(isMemorySealed({ sealedUntil: until }, at(2027, 10, 8, 12, 1))).toBe(false);
    expect(isMemorySealed({}, at(2026, 10, 8))).toBe(false);
  });
});

describe('evaluateAchievements', () => {
  const now = at(2026, 10, 8, 20);
  const base: AchievementSnapshot = {
    now,
    subjects: [],
    tasks: [],
    checklist: [],
    memories: [],
    stats: { breathingSessions: 0, aiQuestions: 0, calmSeconds: 0 },
    examDate: at(2026, 10, 12, 9).toISOString(),
    travelDate: at(2026, 10, 12, 18).toISOString(),
  };
  const evaluate = (patch: Partial<AchievementSnapshot>) => evaluateAchievements({ ...base, ...patch });

  it('returns nothing for a fresh start', () => {
    expect(evaluate({})).toEqual([]);
  });

  it('unlocks study badges', () => {
    const tasks = [0, 1, 2].map((n) => doneTask(at(2026, 10, 8 - n, 10)));
    const ids = evaluate({ tasks });
    expect(ids).toEqual(expect.arrayContaining(['first-step', 'streak-3']));
    expect(ids).not.toContain('streak-7');

    const week = [0, 1, 2, 3, 4, 5, 6].map((n) => doneTask(at(2026, 10, 8 - n, 10)));
    expect(evaluate({ tasks: week })).toContain('streak-7');
  });

  it('unlocks chapter, mastery and preparation badges at their thresholds', () => {
    const ten = Array.from({ length: 10 }, () => chapter(true, at(2026, 10, 1)));
    const ids = evaluate({ subjects: [subject(ten.slice(0, 8)), subject([...ten.slice(8), chapter(false)])] });
    expect(ids).toEqual(expect.arrayContaining(['chapter-10', 'subject-master', 'prepared-80']));

    const threeOfFive = [chapter(true), chapter(true), chapter(true), chapter(false), chapter(false)];
    const below = evaluate({ subjects: [subject(threeOfFive)] });
    expect(below).not.toContain('prepared-80');
    expect(below).not.toContain('subject-master');
    expect(evaluate({ subjects: [subject([])] })).not.toContain('subject-master');
  });

  it('unlocks stats-based badges', () => {
    expect(evaluate({ stats: { breathingSessions: 3, aiQuestions: 4, calmSeconds: 0 } })).toEqual(['zen-mode']);
    expect(evaluate({ stats: { breathingSessions: 2, aiQuestions: 5, calmSeconds: 0 } })).toEqual(['ai-curious']);
  });

  it('unlocks journal badges', () => {
    expect(evaluate({ memories: [memory(), memory(), memory()] })).toEqual(['memory-keeper']);
    expect(evaluate({ memories: [memory({ sealedUntil: at(2027, 10, 8).toISOString() })] })).toEqual(['time-capsule']);
  });

  it('needs at least 5 checklist items, all done, for packed', () => {
    const four = [1, 2, 3, 4].map(() => item('packing', true));
    expect(evaluate({ checklist: four })).not.toContain('packed');
    expect(evaluate({ checklist: [...four, item('gifts', true)] })).toContain('packed');
    expect(evaluate({ checklist: [...four, item('gifts', false)] })).not.toContain('packed');
  });

  it('unlocks exam-conqueror and homebound along the journey', () => {
    const examCompletedAt = at(2026, 10, 12, 12).toISOString();
    expect(evaluate({ examCompletedAt, now: at(2026, 10, 12, 13) })).toEqual(['exam-conqueror']);
    expect(evaluate({ examCompletedAt, now: at(2026, 10, 12, 19) })).toEqual(['exam-conqueror', 'homebound']);
  });
});
