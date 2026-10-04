import { isRunningInExpoGo } from 'expo';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { useAppStore } from '@/store/app';
import { palette } from '@/theme/colors';
import type { TravelMode } from '@/types';
import { addDays, MS_HOUR, parseIso } from '@/utils/date';

/**
 * Uses the SDK 57 object API from 'expo-calendar' (ExpoCalendar / ExpoCalendarEvent).
 * Everything needed here — permissions, calendar lookup/creation, event get/create/update —
 * exists in the new API, so 'expo-calendar/legacy' is not used.
 */

export type CalendarSyncResult =
  | { ok: true; created: number; updated: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'error'; message?: string };

const CALENDAR_TITLE = 'Last Mile';
const EXAM_DURATION_MS = 3 * MS_HOUR;
const TRAVEL_DURATION_MS = MS_HOUR;

const TRAVEL_LABEL: Record<TravelMode, string> = {
  bus: 'By bus',
  train: 'By train',
  flight: 'By flight',
  car: 'By car',
};

interface EventSpec {
  title: string;
  startDate: Date;
  endDate: Date;
  notes: string;
  location: string | null;
  alarms: Calendar.Alarm[];
}

/** Device calendars exist on iOS/Android dev & production builds (expo-calendar isn't in Expo Go). */
export function isCalendarSupported(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    return !isRunningInExpoGo();
  } catch {
    return false;
  }
}

function alarm(minutesBefore: number): Calendar.Alarm {
  return Platform.OS === 'android'
    ? { relativeOffset: -minutesBefore, method: Calendar.AlarmMethod.ALERT }
    : { relativeOffset: -minutesBefore };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function ensurePermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissions();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  // Full access (not write-only): creating our own calendar requires it on iOS 17+.
  const next = await Calendar.requestCalendarPermissions();
  return next.granted;
}

async function getCalendarById(id: string): Promise<Calendar.ExpoCalendar | null> {
  try {
    // Android resolves `null` for unknown ids; iOS rejects.
    const calendar = (await Calendar.ExpoCalendar.get(id)) as Calendar.ExpoCalendar | null;
    return calendar?.allowsModifications ? calendar : null;
  } catch {
    return null;
  }
}

async function getEventById(id: string): Promise<Calendar.ExpoCalendarEvent | null> {
  try {
    return ((await Calendar.ExpoCalendarEvent.get(id)) as Calendar.ExpoCalendarEvent | null) ?? null;
  } catch {
    return null;
  }
}

async function createOwnCalendar(): Promise<Calendar.ExpoCalendar> {
  if (Platform.OS === 'ios') {
    // Without a sourceId iOS uses the source of the default calendar (iCloud/local), so it stays visible.
    return Calendar.createCalendar({
      title: CALENDAR_TITLE,
      color: palette.purple,
      entityType: Calendar.EntityTypes.EVENT,
    });
  }
  return Calendar.createCalendar({
    title: CALENDAR_TITLE,
    name: 'lastmile',
    color: palette.purple,
    source: { isLocalAccount: true, name: CALENDAR_TITLE, type: Calendar.SourceType.LOCAL },
    ownerAccount: CALENDAR_TITLE,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

function defaultCalendar(calendars: Calendar.ExpoCalendar[]): Calendar.ExpoCalendar | null {
  if (Platform.OS === 'ios') {
    try {
      return Calendar.getDefaultCalendarSync();
    } catch {
      // fall through to the first writable calendar
    }
  }
  const writable = calendars.filter((calendar) => calendar.allowsModifications);
  return writable.find((calendar) => calendar.isPrimary) ?? writable[0] ?? null;
}

/** Stored calendar → existing "Last Mile" calendar → newly created one → the device default. */
async function resolveCalendar(storedId?: string): Promise<Calendar.ExpoCalendar | null> {
  if (storedId) {
    const stored = await getCalendarById(storedId);
    if (stored) return stored;
  }
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const own = calendars.find((calendar) => calendar.title === CALENDAR_TITLE && calendar.allowsModifications);
  if (own) return own;
  try {
    return await createOwnCalendar();
  } catch {
    return defaultCalendar(calendars);
  }
}

async function upsertEvent(
  calendar: Calendar.ExpoCalendar,
  storedId: string | undefined,
  spec: EventSpec,
): Promise<{ id: string; created: boolean }> {
  const existing = storedId ? await getEventById(storedId) : null;
  if (existing) {
    await existing.update({
      title: spec.title,
      startDate: spec.startDate,
      endDate: spec.endDate,
      notes: spec.notes,
      location: spec.location,
      alarms: spec.alarms,
    });
    return { id: existing.id, created: false };
  }
  const event = await calendar.createEvent({
    title: spec.title,
    startDate: spec.startDate,
    endDate: spec.endDate,
    notes: spec.notes,
    location: spec.location,
    alarms: spec.alarms,
  });
  return { id: event.id, created: true };
}

function buildSpecs(): { exam: EventSpec; travel: EventSpec } {
  const { examDate, travelDate, profile, ticket } = useAppStore.getState();
  const now = new Date();
  const exam = parseIso(examDate, addDays(now, 7));
  const travel = parseIso(travelDate, exam);
  const firstName = profile.name.trim().split(/\s+/)[0] ?? '';
  const destination = ticket.to?.trim() || profile.homeCity?.trim() || '';

  const ticketLine = [
    TRAVEL_LABEL[ticket.mode] ?? 'Going home',
    ticket.from && ticket.to ? `${ticket.from} → ${ticket.to}` : null,
    ticket.seat ? `Seat ${ticket.seat}` : null,
    ticket.reference ? `Booking ref ${ticket.reference}` : null,
    ticket.booked ? null : 'Ticket not booked yet!',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    exam: {
      title: '📝 Final Exam',
      startDate: exam,
      endDate: new Date(exam.getTime() + EXAM_DURATION_MS),
      notes: [
        `${firstName ? `${firstName}, you've` : "You've"} prepared for this. Hall ticket, ID, pens — then breathe.`,
        'One final push before freedom.',
        '',
        'Added by Last Mile',
      ].join('\n'),
      location: null,
      alarms: [alarm(24 * 60), alarm(60)],
    },
    travel: {
      title: destination ? `🏠 Going home to ${destination}` : '🏠 Going home',
      startDate: travel,
      endDate: new Date(travel.getTime() + TRAVEL_DURATION_MS),
      notes: [ticketLine, 'Soon this struggle will be a beautiful memory ❤️', '', 'Added by Last Mile'].join('\n'),
      location: ticket.from?.trim() || null,
      alarms: [alarm(180)],
    },
  };
}

/**
 * Creates or updates the "Final Exam" and "Going Home" events (with alarms) in a
 * dedicated "Last Mile" calendar (falling back to the default calendar) and
 * persists their ids via `setCalendarSync`. Never throws.
 */
export async function syncCalendarEvents(): Promise<CalendarSyncResult> {
  if (!isCalendarSupported()) return { ok: false, reason: 'unsupported' };
  try {
    if (!(await ensurePermission())) return { ok: false, reason: 'denied' };

    const { settings, setCalendarSync } = useAppStore.getState();
    const stored = settings.calendar;
    const calendar = await resolveCalendar(stored.calendarId);
    if (!calendar) {
      return { ok: false, reason: 'error', message: 'No writable calendar was found on this device.' };
    }

    const specs = buildSpecs();
    let created = 0;
    let updated = 0;

    // Persist each id as soon as it exists so a later failure never leads to duplicates.
    const exam = await upsertEvent(calendar, stored.examEventId, specs.exam);
    setCalendarSync({ calendarId: calendar.id, examEventId: exam.id });
    if (exam.created) created += 1;
    else updated += 1;

    const travel = await upsertEvent(calendar, stored.travelEventId, specs.travel);
    setCalendarSync({ travelEventId: travel.id, lastSyncedAt: new Date().toISOString() });
    if (travel.created) created += 1;
    else updated += 1;

    return { ok: true, created, updated };
  } catch (error) {
    return { ok: false, reason: 'error', message: errorMessage(error) };
  }
}
