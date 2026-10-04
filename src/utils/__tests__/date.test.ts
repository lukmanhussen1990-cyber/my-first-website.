import {
  addDays,
  addMonths,
  calendarDaysBetween,
  countdownParts,
  describeCountdown,
  formatLongDate,
  formatOrdinalDate,
  formatRelativeDay,
  formatTime,
  fromDayKey,
  getMonthGrid,
  nextOccurrence,
  ordinal,
  parseIso,
  startOfWeek,
  toDayKey,
} from '../date';
import { createId } from '../id';

describe('day keys', () => {
  it('round-trips local days', () => {
    const d = new Date(2026, 9, 12, 23, 59);
    expect(toDayKey(d)).toBe('2026-10-12');
    expect(fromDayKey('2026-10-12').getTime()).toBe(new Date(2026, 9, 12).getTime());
  });

  it('pads single-digit months and days', () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('calendar arithmetic', () => {
  it('counts calendar days, not 24h blocks', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 4, 23, 59), new Date(2026, 9, 5, 0, 1))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 9, 12), new Date(2026, 9, 4))).toBe(-8);
  });

  it('adds days across month boundaries', () => {
    expect(toDayKey(addDays(new Date(2026, 9, 30), 3))).toBe('2026-11-02');
  });

  it('clamps addMonths to the end of shorter months', () => {
    expect(toDayKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
  });

  it('finds Monday as start of week', () => {
    // 4 Oct 2026 is a Sunday → week starts Mon 28 Sep.
    expect(toDayKey(startOfWeek(new Date(2026, 9, 4)))).toBe('2026-09-28');
    expect(toDayKey(startOfWeek(new Date(2026, 9, 12)))).toBe('2026-10-12');
  });

  it('builds a 42-cell month grid starting on Monday', () => {
    const grid = getMonthGrid(new Date(2026, 9, 15));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(grid.some((d) => toDayKey(d) === '2026-10-01')).toBe(true);
    expect(grid.some((d) => toDayKey(d) === '2026-10-31')).toBe(true);
  });
});

describe('countdown', () => {
  it('splits durations into parts', () => {
    const ms = ((5 * 24 + 14) * 3600 + 32 * 60 + 18) * 1000;
    expect(countdownParts(ms)).toEqual({ days: 5, hours: 14, minutes: 32, seconds: 18 });
  });

  it('clamps past targets to zero', () => {
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('describes countdowns for accessibility', () => {
    expect(describeCountdown({ days: 5, hours: 14, minutes: 32, seconds: 18 })).toBe('5 days 14 hours left');
    expect(describeCountdown({ days: 0, hours: 1, minutes: 1, seconds: 0 })).toBe('1 hour 1 minute left');
    expect(describeCountdown({ days: 0, hours: 0, minutes: 0, seconds: 30 })).toBe('less than a minute left');
  });
});

describe('formatting', () => {
  it('formats long dates and times', () => {
    const d = new Date(2026, 9, 12, 9, 5);
    expect(formatLongDate(d)).toBe('12 October 2026');
    expect(formatTime(d)).toBe('9:05 AM');
    expect(formatTime(new Date(2026, 9, 12, 0, 0))).toBe('12:00 AM');
    expect(formatTime(new Date(2026, 9, 12, 18, 30))).toBe('6:30 PM');
  });

  it('builds ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 112].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '112th',
    ]);
    expect(formatOrdinalDate(new Date(2026, 9, 12))).toBe('12th October');
  });

  it('describes relative days', () => {
    const now = new Date(2026, 9, 4, 10);
    expect(formatRelativeDay(new Date(2026, 9, 4, 22), now)).toBe('Today');
    expect(formatRelativeDay(new Date(2026, 9, 5, 1), now)).toBe('Tomorrow');
    expect(formatRelativeDay(new Date(2026, 9, 12), now)).toBe('in 8 days');
    expect(formatRelativeDay(new Date(2026, 9, 1), now)).toBe('3 days ago');
  });
});

describe('nextOccurrence', () => {
  it('returns this year when still ahead', () => {
    const d = nextOccurrence(10, 12, 9, 0, new Date(2026, 9, 4));
    expect(d.getFullYear()).toBe(2026);
    expect(toDayKey(d)).toBe('2026-10-12');
    expect(d.getHours()).toBe(9);
  });

  it('rolls over to next year once passed', () => {
    const d = nextOccurrence(10, 12, 9, 0, new Date(2026, 9, 12, 10));
    expect(toDayKey(d)).toBe('2027-10-12');
  });
});

describe('parseIso', () => {
  it('falls back on invalid input', () => {
    const fallback = new Date(2026, 0, 1);
    expect(parseIso('not a date', fallback)).toBe(fallback);
    expect(parseIso(undefined, fallback)).toBe(fallback);
    expect(parseIso('2026-10-12T03:30:00.000Z').toISOString()).toBe('2026-10-12T03:30:00.000Z');
  });
});

describe('createId', () => {
  it('creates unique ids', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => createId()));
    expect(ids.size).toBe(2000);
    expect(createId('m_').startsWith('m_')).toBe(true);
  });
});
