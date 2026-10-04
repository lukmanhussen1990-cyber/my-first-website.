import { ACHIEVEMENT_RULES, achievementById, achievementDefs } from '@/data/achievements';
import { breathingPatternById, breathingPatterns, cycleSeconds } from '@/data/breathing';
import {
  categoriesForFilter,
  checklistCategories,
  checklistCategoryOrder,
  checklistItemIcon,
  defaultChecklist,
  filterForCategory,
} from '@/data/checklist';
import { quoteForDay, quotes } from '@/data/quotes';
import {
  createDefaultChecklist,
  createDefaultDates,
  createSampleMemories,
  createSamplePlanner,
  defaultExamDate,
} from '@/data/seed';
import { suggestSubjectCode, subjectIconOptions } from '@/data/subjects';
import { examStressTips, sleepTips, studyTechniques, tipSections } from '@/data/tips';
import { travelModeOrder, travelModes } from '@/data/travel';
import { greetingForHour } from '@/hooks/useGreeting';
import { computeStreak, subjectProgress, tasksForDay } from '@/store/selectors';
import type { AchievementId } from '@/types';
import { addDays, toDayKey } from '@/utils/date';

describe('quotes', () => {
  const normalize = (text: string) => text.replace(/’/g, "'");

  it('has at least 40 unique lines including the signature ones', () => {
    expect(quotes.length).toBeGreaterThanOrEqual(40);
    const texts = quotes.map((q) => normalize(q.text));
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts).toEqual(
      expect.arrayContaining([
        "Discipline now gives you the freedom you're waiting for.",
        'Soon this struggle will be a beautiful memory.',
        'A calm mind can achieve anything.',
        'Good things are coming…',
        'One final push before freedom.',
      ]),
    );
  });

  it('is deterministic per day and differs on consecutive days', () => {
    expect(quoteForDay('2026-10-12')).toBe(quoteForDay('2026-10-12'));
    let day = new Date(2026, 0, 1);
    for (let i = 0; i < 400; i += 1) {
      const next = addDays(day, 1);
      expect(quoteForDay(toDayKey(next))).not.toBe(quoteForDay(toDayKey(day)));
      day = next;
    }
  });

  it('cycles through every quote before repeating', () => {
    const start = new Date(2026, 9, 1);
    const seen = new Set(quotes.map((_, i) => quoteForDay(toDayKey(addDays(start, i)))));
    expect(seen.size).toBe(quotes.length);
  });

  it('supports offsets and tolerates malformed keys', () => {
    expect(quoteForDay('2026-10-12', 1)).not.toBe(quoteForDay('2026-10-12'));
    expect(quoteForDay('2026-10-12', -1)).toBeDefined();
    expect(quoteForDay('garbage')).toBe(quoteForDay('garbage'));
  });
});

describe('achievements', () => {
  const ids: AchievementId[] = [
    'first-step',
    'streak-3',
    'streak-7',
    'chapter-10',
    'subject-master',
    'prepared-80',
    'zen-mode',
    'ai-curious',
    'memory-keeper',
    'time-capsule',
    'packed',
    'exam-conqueror',
    'homebound',
  ];

  it('defines every achievement exactly once with copy and a hint', () => {
    expect(achievementDefs.map((d) => d.id).sort()).toEqual([...ids].sort());
    for (const def of achievementDefs) {
      expect(def.title).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.hint).toBeTruthy();
      expect(def.gradient.length).toBeGreaterThanOrEqual(2);
      expect(achievementById[def.id]).toBe(def);
    }
    expect(achievementById['zen-mode'].hint).toBe(`Complete ${ACHIEVEMENT_RULES.breathingSessions} breathing sessions`);
  });
});

describe('breathing', () => {
  it('defines Box 4-4-4-4, Relax 4-7-8 and Calm 4-6', () => {
    const timings = (id: keyof typeof breathingPatternById) =>
      breathingPatternById[id].phases.map((p) => `${p.label}:${p.seconds}`);
    expect(timings('box')).toEqual(['Breathe In:4', 'Hold:4', 'Breathe Out:4', 'Hold:4']);
    expect(timings('relax')).toEqual(['Breathe In:4', 'Hold:7', 'Breathe Out:8']);
    expect(timings('calm')).toEqual(['Breathe In:4', 'Breathe Out:6']);
    expect(breathingPatterns.map(cycleSeconds)).toEqual([16, 19, 10]);
  });
});

describe('tips', () => {
  it('has enough tips in each section', () => {
    expect(examStressTips.length).toBeGreaterThanOrEqual(8);
    expect(sleepTips.length).toBeGreaterThanOrEqual(6);
    expect(studyTechniques.length).toBeGreaterThanOrEqual(6);
    expect(tipSections.map((s) => s.key)).toEqual(['stress', 'sleep', 'study']);
  });
});

describe('checklist data', () => {
  it('describes every category and groups filters', () => {
    expect(Object.keys(checklistCategories).sort()).toEqual([...checklistCategoryOrder].sort());
    expect(checklistCategories.tickets.icon).toBe('ticket');
    expect(categoriesForFilter('others')).toEqual(['tickets', 'essentials']);
    expect(categoriesForFilter('all')).toHaveLength(5);
    expect(filterForCategory('essentials')).toBe('others');
    expect(filterForCategory('gifts')).toBe('gifts');
  });

  it('picks row icons from titles with a category fallback', () => {
    expect(checklistItemIcon({ title: 'Laptop & Charger', category: 'essentials' })).toBe('laptop');
    expect(checklistItemIcon({ title: 'ID Card & Hall Ticket', category: 'documents' })).toBe('card-account-details');
    expect(checklistItemIcon({ title: 'Book Train/Bus/Flight Tickets', category: 'tickets' })).toBe('ticket');
    expect(checklistItemIcon({ title: 'Other Essentials', category: 'essentials' })).toBe('power-plug');
  });

  it('ships the default pre-travel list', () => {
    expect(defaultChecklist.map((i) => i.title)).toEqual([
      'Book Train/Bus/Flight Tickets',
      'Pack Clothes',
      'ID Card & Hall Ticket',
      'Laptop & Charger',
      'Phone Charger',
      'Gifts for Family',
      'Medicines',
      'Other Essentials',
      'Snacks for the Journey',
      'Toiletries',
    ]);
  });
});

describe('subjects & travel data', () => {
  it('offers the subject icon set and suggests codes', () => {
    expect(subjectIconOptions).toHaveLength(12);
    expect(suggestSubjectCode('Computer Networks')).toBe('CN');
    expect(suggestSubjectCode('Operating System')).toBe('OS');
    expect(suggestSubjectCode('Theory of Computation')).toBe('TC');
    expect(suggestSubjectCode('Aptitude')).toBe('APT');
    expect(suggestSubjectCode('  ')).toBe('');
  });

  it('describes every travel mode', () => {
    expect(travelModeOrder.map((mode) => travelModes[mode].label)).toEqual(['Bus', 'Train', 'Flight', 'Car']);
  });
});

describe('greetingForHour', () => {
  it('maps hours to greetings', () => {
    expect([0, 4, 5, 11, 12, 16, 17, 22, 23].map(greetingForHour)).toEqual([
      'Burning the midnight oil',
      'Burning the midnight oil',
      'Good morning',
      'Good morning',
      'Good afternoon',
      'Good afternoon',
      'Good evening',
      'Good evening',
      'Burning the midnight oil',
    ]);
  });
});

describe('seed', () => {
  const now = new Date(2026, 9, 4, 19, 30); // 4 Oct, 19:30 local
  const examDate = defaultExamDate(now);

  it('defaults to the next 12 October 09:00, travel at 18:00 that day', () => {
    expect(examDate).toEqual(new Date(2026, 9, 12, 9, 0));
    expect(defaultExamDate(new Date(2026, 9, 12, 9, 1))).toEqual(new Date(2027, 9, 12, 9, 0));
    const dates = createDefaultDates(now);
    expect(dates.examDate).toBe(examDate.toISOString());
    expect(dates.travelDate).toBe(new Date(2026, 9, 12, 18, 0).toISOString());
  });

  describe('sample planner', () => {
    const { subjects, tasks } = createSamplePlanner(now, examDate);
    const percent = (code: string) => Math.round(subjectProgress(subjects.find((s) => s.code === code)!) * 100);

    it('matches the reference progress per subject', () => {
      expect(subjects.map((s) => [s.name, s.icon, s.color])).toEqual([
        ['Database Management System', 'database', 'purple'],
        ['Computer Networks', 'lan', 'blue'],
        ['Operating System', 'monitor', 'cyan'],
        ['Aptitude', 'calculator-variant', 'pink'],
        ['Theory of Computation', 'book-open-variant', 'green'],
      ]);
      expect(['DBMS', 'CN', 'OS', 'APT', 'TOC'].map(percent)).toEqual([85, 70, 75, 60, 90]);
      expect(subjects[0].chapters.slice(0, 7).map((c) => [c.title, c.done])).toEqual([
        ['Introduction to DBMS', true],
        ['ER Model', true],
        ['Relational Algebra', true],
        ['SQL Queries', true],
        ['Normalization', true],
        ['Transaction Management', false],
        ['Indexing & Hashing', true],
      ]);
    });

    it('schedules papers in the days before the exam, the last on the exam itself', () => {
      const dates = subjects.map((s) => new Date(s.examDate!).getTime()).sort((a, b) => a - b);
      expect(dates.at(-1)).toBe(examDate.getTime());
      expect(new Set(dates).size).toBe(5);
      expect(dates.every((d) => d > now.getTime())).toBe(true);
      expect(subjects.every((s) => s.papers.length >= 2 && s.notes.length > 100)).toBe(true);
    });

    it("has today's three missions with two done", () => {
      const today = tasksForDay(tasks, toDayKey(now));
      expect(today.map((t) => [t.title, t.detail, t.done])).toEqual([
        ['Complete Notes', '(Computer Networks)', false],
        ['Revise Chapter 5', '(Databases)', true],
        ['Solve Previous Papers', undefined, true],
      ]);
      expect(tasks.some((t) => t.day > toDayKey(now))).toBe(true);
      expect(tasks.every((t) => t.day <= toDayKey(examDate))).toBe(true);
    });

    it('produces a ~5 day streak and never completes anything in the future', () => {
      const streak = computeStreak(subjects, tasks, now);
      expect(streak.current).toBe(5);
      expect(streak.last7.filter((d) => d.active)).toHaveLength(6);
      const completions = [
        ...subjects.flatMap((s) => s.chapters.map((c) => c.doneAt)),
        ...tasks.map((t) => t.doneAt),
      ].filter(Boolean) as string[];
      expect(completions.every((iso) => new Date(iso).getTime() <= now.getTime())).toBe(true);
      expect(tasks.every((t) => !t.doneAt || t.createdAt <= t.doneAt)).toBe(true);
    });

    it('keeps future tasks on or before the exam day when the exam is close', () => {
      const close = createSamplePlanner(now, new Date(2026, 9, 5, 9));
      expect(close.tasks.every((t) => t.day <= '2026-10-05')).toBe(true);
      expect(close.subjects.every((s) => new Date(s.examDate!).getTime() > now.getTime())).toBe(true);
    });

    it('works shortly after midnight', () => {
      const earlyNow = new Date(2026, 9, 4, 0, 5);
      const early = createSamplePlanner(earlyNow, examDate);
      const today = tasksForDay(early.tasks, '2026-10-04');
      expect(today.filter((t) => t.done)).toHaveLength(2);
      expect(today.every((t) => !t.doneAt || new Date(t.doneAt) <= earlyNow)).toBe(true);
    });
  });

  it('creates sample memories newest first with a sealed Future-Me letter', () => {
    const memories = createSampleMemories(now);
    const photos = memories.filter((m) => m.kind === 'photo');
    expect(photos.map((m) => [m.illustration, m.title])).toEqual([
      ['home-hero', 'Almost There'],
      ['study-planner', 'Late Night Study'],
      ['home-journey', 'Current Journey'],
    ]);
    expect(memories.filter((m) => m.kind === 'note')).toHaveLength(2);
    const sealed = memories.filter((m) => m.sealedUntil);
    expect(sealed).toHaveLength(1);
    expect(sealed[0].sealedUntil).toBe(new Date(2027, 9, 4, 19, 30).toISOString());
    const created = memories.map((m) => m.createdAt);
    expect([...created].sort().reverse()).toEqual(created);
  });

  it('creates the default checklist in order, all unchecked', () => {
    const items = createDefaultChecklist(now);
    expect(items.map((i) => i.title)).toEqual(defaultChecklist.map((i) => i.title));
    expect(items.every((i) => !i.done)).toBe(true);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
});
