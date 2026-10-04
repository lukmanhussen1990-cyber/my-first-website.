/**
 * Date helpers. Everything here works in the device's *local* time zone —
 * a "day" is a local calendar day, keyed as "YYYY-MM-DD" (`DayKey`).
 *
 * Intl is avoided for month/weekday names so output is identical on Hermes,
 * JSC and web regardless of locale data.
 */
import type { DayKey } from '@/types';

export const MS_SECOND = 1000;
export const MS_MINUTE = 60 * MS_SECOND;
export const MS_HOUR = 60 * MS_MINUTE;
export const MS_DAY = 24 * MS_HOUR;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export const pad2 = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');

/** Local calendar day key, e.g. "2026-10-12". */
export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Parses a day key into local midnight of that day. */
export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Adds whole calendar days (DST-safe: keeps the local wall-clock time). */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(date.getDate(), lastDay));
  next.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return next;
}

export function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12);
}

/** Start of the week containing `date` (default Monday). */
export function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const day = startOfDay(date);
  const diff = (day.getDay() - weekStartsOn + 7) % 7;
  return addDays(day, -diff);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDayKey(a) === toDayKey(b);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Whole calendar days from `from` to `to` (local days, DST-safe).
 * e.g. 23:59 today → 00:01 tomorrow = 1.
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / MS_DAY);
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Splits a duration into d/h/m/s. Negative durations clamp to zero. */
export function countdownParts(ms: number): CountdownParts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** "5 days 14 hours left" — for accessibility labels and notifications. */
export function describeCountdown(parts: CountdownParts): string {
  const bits: string[] = [];
  if (parts.days) bits.push(`${parts.days} ${parts.days === 1 ? 'day' : 'days'}`);
  if (parts.hours) bits.push(`${parts.hours} ${parts.hours === 1 ? 'hour' : 'hours'}`);
  if (!parts.days && parts.minutes) {
    bits.push(`${parts.minutes} ${parts.minutes === 1 ? 'minute' : 'minutes'}`);
  }
  if (!bits.length) return 'less than a minute left';
  return `${bits.join(' ')} left`;
}

export function monthName(date: Date, short = false): string {
  const name = MONTHS[date.getMonth()];
  return short ? name.slice(0, 3) : name;
}

export function weekdayName(date: Date, short = false): string {
  const name = WEEKDAYS[date.getDay()];
  return short ? name.slice(0, 3) : name;
}

/** "12 October 2026" */
export function formatLongDate(date: Date): string {
  return `${date.getDate()} ${monthName(date)} ${date.getFullYear()}`;
}

/** "12 Oct" */
export function formatShortDate(date: Date): string {
  return `${date.getDate()} ${monthName(date, true)}`;
}

/** "Mon, 12 Oct" */
export function formatDayLabel(date: Date): string {
  return `${weekdayName(date, true)}, ${formatShortDate(date)}`;
}

/** "9:00 AM" */
export function formatTime(date: Date): string {
  const h = date.getHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(date.getMinutes())} ${suffix}`;
}

/** "12 October 2026 · 9:00 AM" */
export function formatDateTime(date: Date): string {
  return `${formatLongDate(date)} · ${formatTime(date)}`;
}

/** "12th" */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "12th October" — used in emotional hero copy. */
export function formatOrdinalDate(date: Date): string {
  return `${ordinal(date.getDate())} ${monthName(date)}`;
}

/** "Today", "Tomorrow", "Yesterday", "in 3 days", "2 days ago" (calendar days). */
export function formatRelativeDay(target: Date, now: Date = new Date()): string {
  const diff = calendarDaysBetween(now, target);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

/** Sets the local wall-clock time on a copy of `date`. */
export function withTime(date: Date, hour: number, minute = 0): Date {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

/**
 * The next local date matching month/day at the given time that is still in
 * the future relative to `from` (this year, otherwise next year).
 * `month` is 1-based (10 = October).
 */
export function nextOccurrence(month: number, day: number, hour = 9, minute = 0, from: Date = new Date()): Date {
  const candidate = new Date(from.getFullYear(), month - 1, day, hour, minute, 0, 0);
  if (candidate.getTime() > from.getTime()) return candidate;
  return new Date(from.getFullYear() + 1, month - 1, day, hour, minute, 0, 0);
}

/**
 * 6×7 grid of dates covering `month` (local), starting on `weekStartsOn`.
 * Always 42 cells so the calendar height never jumps.
 */
export function getMonthGrid(month: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const first = startOfWeek(startOfMonth(month), weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** Safe ISO parse → Date (invalid input returns `fallback`). */
export function parseIso(iso: string | undefined | null, fallback: Date = new Date()): Date {
  if (!iso) return fallback;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : d;
}
