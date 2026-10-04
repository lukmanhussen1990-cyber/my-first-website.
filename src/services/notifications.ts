import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { quoteForDay } from '@/data/quotes';
import { useAppStore } from '@/store/app';
import { palette } from '@/theme/colors';
import type { NotificationSettings, TicketInfo, TravelMode } from '@/types';
import {
  addDays,
  calendarDaysBetween,
  formatTime,
  MS_HOUR,
  parseIso,
  startOfDay,
  toDayKey,
  withTime,
} from '@/utils/date';

/** Android channels. Users can tune each one separately in system settings. */
const CHANNEL_REMINDERS = 'reminders';
const CHANNEL_COUNTDOWN = 'countdown';

const MOTIVATION_DAYS = 7;
const ID_PREFIX = 'lastmile.';

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

let initialised = false;
let channelsReady: Promise<void> | null = null;
/** Serialises syncs so overlapping calls can't interleave cancel/schedule and leave duplicates. */
let syncQueue: Promise<unknown> = Promise.resolve();

type NotificationKind = 'motivation' | 'study' | 'sleep' | 'exam' | 'travel' | 'ticket' | 'test';

const TRAVEL_COPY: Record<TravelMode, { emoji: string; leaves: (time: string) => string }> = {
  bus: { emoji: '🚌', leaves: (time) => `Your bus leaves at ${time}.` },
  train: { emoji: '🚆', leaves: (time) => `Your train leaves at ${time}.` },
  flight: { emoji: '✈️', leaves: (time) => `Your flight is at ${time} — check in early.` },
  car: { emoji: '🚗', leaves: (time) => `You're hitting the road at ${time}.` },
};

function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelsReady ??= Promise.all([
    Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: 'Study reminders',
      description: 'Daily motivation, study sessions and bedtime nudges.',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: palette.purple,
      vibrationPattern: [0, 180, 120, 180],
    }),
    Notifications.setNotificationChannelAsync(CHANNEL_COUNTDOWN, {
      name: 'Exam & journey alerts',
      description: 'Exam countdown, packing and time-to-leave alerts.',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: palette.sunset,
      vibrationPattern: [0, 250, 150, 250],
    }),
  ])
    .then(() => undefined)
    .catch(() => {
      channelsReady = null;
    });
  return channelsReady;
}

function isGranted(status: Notifications.NotificationPermissionsStatus): boolean {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Foreground presentation + Android channels. Call once at startup; safe to call again. */
export function initNotifications(): void {
  if (!isSupported || initialised) return;
  initialised = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    initialised = false;
  }
  void ensureAndroidChannels();
}

/** Asks for permission (if it can still be asked). Resolves `true` when notifications may be shown. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    // Android 13+ only shows the system prompt once a channel exists.
    await ensureAndroidChannels();
    const current = await Notifications.getPermissionsAsync();
    if (isGranted(current)) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return isGranted(next);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Scheduling plan (pure)                                              */
/* ------------------------------------------------------------------ */

interface PlanInput {
  firstName: string;
  destination?: string;
  examDate: Date;
  travelDate: Date;
  examCompleted: boolean;
  ticket: TicketInfo;
  settings: NotificationSettings;
}

type Content = Notifications.NotificationContentInput;

function content(kind: NotificationKind, title: string, body: string, url: string): Content {
  return { title, body, sound: true, data: { kind, url } };
}

function withName(text: string, name: string, separator = ', '): string {
  return name ? `${text}${separator}${name}` : text;
}

function dateRequest(id: string, date: Date, body: Content, channelId: string): Notifications.NotificationRequestInput {
  return {
    identifier: `${ID_PREFIX}${id}`,
    content: body,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
  };
}

function motivationTitle(at: Date, input: PlanInput): string {
  const { examDate, travelDate, examCompleted, firstName } = input;
  const examDone = examCompleted || at.getTime() > examDate.getTime();
  if (!examDone) {
    const days = calendarDaysBetween(at, examDate);
    if (days > 1) return withName(`☀️ ${days} days to go`, firstName);
    if (days === 1) return withName('🌟 Exam tomorrow — you’ve got this', firstName);
    return withName('🍀 Exam day! Breathe, you’re ready', firstName);
  }
  if (at.getTime() < travelDate.getTime()) return withName('🏠 Almost home', firstName);
  return withName('❤️ Good morning', firstName);
}

function buildMotivation(input: PlanInput, now: Date): Notifications.NotificationRequestInput[] {
  const { hour, minute } = input.settings.dailyMotivationTime;
  const used = new Set<string>();
  const requests: Notifications.NotificationRequestInput[] = [];
  // The next 7 mornings (today's is skipped if its time has already passed).
  for (let i = 0; requests.length < MOTIVATION_DAYS && i <= MOTIVATION_DAYS; i++) {
    const at = withTime(addDays(startOfDay(now), i), hour, minute);
    if (at.getTime() <= now.getTime()) continue;
    const day = toDayKey(at);
    // Guarantee a different quote each day even if the daily rotation collides.
    let quote = quoteForDay(day);
    for (let offset = 1; used.has(quote.text) && offset < 10; offset++) quote = quoteForDay(day, offset);
    used.add(quote.text);
    const body = quote.author ? `“${quote.text}” — ${quote.author}` : `“${quote.text}”`;
    requests.push(
      dateRequest(`motivation.${day}`, at, content('motivation', motivationTitle(at, input), body, '/'), CHANNEL_REMINDERS),
    );
  }
  return requests;
}

function buildDailyReminders(input: PlanInput): Notifications.NotificationRequestInput[] {
  const { settings, firstName } = input;
  const requests: Notifications.NotificationRequestInput[] = [];
  if (settings.studyReminder) {
    requests.push({
      identifier: `${ID_PREFIX}study`,
      content: content(
        'study',
        withName('📚 Study time', firstName),
        'One focused 25-minute block moves you closer to freedom. Today’s mission is waiting.',
        '/planner',
      ),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.studyReminderTime.hour,
        minute: settings.studyReminderTime.minute,
        channelId: CHANNEL_REMINDERS,
      },
    });
  }
  if (settings.sleepReminder) {
    requests.push({
      identifier: `${ID_PREFIX}sleep`,
      content: content(
        'sleep',
        withName('🌙 Time to wind down', firstName),
        'Sleep is when memory sticks. Put the notes away — tomorrow-you will thank you 💤',
        '/stress',
      ),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.sleepReminderTime.hour,
        minute: settings.sleepReminderTime.minute,
        channelId: CHANNEL_REMINDERS,
      },
    });
  }
  return requests;
}

function buildExamAlerts(input: PlanInput): Notifications.NotificationRequestInput[] {
  const { examDate, firstName } = input;
  const eve = withTime(addDays(startOfDay(examDate), -1), 20, 0);
  const twoHoursBefore = new Date(examDate.getTime() - 2 * MS_HOUR);
  return [
    dateRequest(
      'exam.eve',
      eve,
      content(
        'exam',
        `📝 Exam tomorrow at ${formatTime(examDate)}`,
        withName(
          'Lay out your hall ticket, ID and pens tonight, then get a full night’s sleep. You’re more ready than you think',
          firstName,
        ) + ' 💪',
        '/exam',
      ),
      CHANNEL_COUNTDOWN,
    ),
    dateRequest(
      'exam.soon',
      twoHoursBefore,
      content(
        'exam',
        '⏰ 2 hours to your exam',
        withName('Eat something light, double-check your hall ticket and walk in calm. Good luck', firstName) + '! 🍀',
        '/exam',
      ),
      CHANNEL_COUNTDOWN,
    ),
  ];
}

function buildTravelAlerts(input: PlanInput, now: Date): Notifications.NotificationRequestInput[] {
  const { travelDate, examDate, ticket, destination, firstName } = input;
  const toPlace = destination ? ` to ${destination}` : '';
  const copy = TRAVEL_COPY[ticket.mode] ?? TRAVEL_COPY.bus;
  const eve = withTime(addDays(startOfDay(travelDate), -1), 19, 0);
  const sameDayAsExam = calendarDaysBetween(examDate, travelDate) === 0 && !input.examCompleted;
  const requests = [
    dateRequest(
      'travel.eve',
      eve,
      content(
        'travel',
        '🎒 Pack your bag tonight',
        sameDayAsExam
          ? `Tomorrow: last paper, then home${toPlace}! Pack tonight so you can head straight out after your exam.`
          : `Tomorrow you’re going home${toPlace}! Tick off your travel checklist so nothing gets left behind.`,
        '/checklist',
      ),
      CHANNEL_COUNTDOWN,
    ),
    dateRequest(
      'travel.leave',
      new Date(travelDate.getTime() - 3 * MS_HOUR),
      content(
        'travel',
        withName(`${copy.emoji} Time to get moving`, firstName),
        `${copy.leaves(formatTime(travelDate))} Ticket, charger, ID — home is waiting ❤️`,
        '/journey',
      ),
      CHANNEL_COUNTDOWN,
    ),
  ];

  if (!ticket.booked) {
    const tomorrowMorning = withTime(addDays(startOfDay(now), 1), 10, 0);
    if (tomorrowMorning.getTime() < travelDate.getTime()) {
      requests.push(
        dateRequest(
          'ticket',
          tomorrowMorning,
          content(
            'ticket',
            withName('🎟️ Ticket booked yet', firstName) + '?',
            `Seats go fast before the holidays. Book your ${ticket.mode} home${toPlace} and tick it off in Last Mile.`,
            '/journey',
          ),
          CHANNEL_COUNTDOWN,
        ),
      );
    }
  }
  return requests;
}

function buildPlan(input: PlanInput, now: Date): Notifications.NotificationRequestInput[] {
  const { settings, examDate, travelDate, examCompleted } = input;
  const examOver = examCompleted || examDate.getTime() <= now.getTime();
  const requests: Notifications.NotificationRequestInput[] = [];

  if (settings.dailyMotivation) requests.push(...buildMotivation(input, now));
  // Study / sleep nudges only make sense while there's still an exam to prepare for.
  if (!examOver) requests.push(...buildDailyReminders(input));
  if (settings.examAlerts && !examOver) requests.push(...buildExamAlerts(input));
  if (settings.travelAlerts && travelDate.getTime() > now.getTime()) requests.push(...buildTravelAlerts(input, now));

  // Never schedule anything in the past.
  return requests.filter((request) => {
    const trigger = request.trigger;
    if (trigger && 'type' in trigger && trigger.type === Notifications.SchedulableTriggerInputTypes.DATE) {
      return new Date(trigger.date).getTime() > now.getTime();
    }
    return true;
  });
}

function readPlanInput(now: Date): PlanInput {
  const state = useAppStore.getState();
  const examDate = parseIso(state.examDate, addDays(now, 7));
  return {
    firstName: state.profile.name.trim().split(/\s+/)[0] ?? '',
    destination: state.ticket.to?.trim() || state.profile.homeCity?.trim() || undefined,
    examDate,
    travelDate: parseIso(state.travelDate, examDate),
    examCompleted: Boolean(state.examCompletedAt),
    ticket: state.ticket,
    settings: state.settings.notifications,
  };
}

async function runSync(): Promise<{ scheduled: number }> {
  if (!isSupported) return { scheduled: 0 };
  try {
    // Everything this app schedules comes from here, so a full reset is the simplest correct sync —
    // it also clears old reminders when the user switches notifications off.
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = new Date();
    const input = readPlanInput(now);
    if (!input.settings.enabled) return { scheduled: 0 };
    if (!isGranted(await Notifications.getPermissionsAsync())) return { scheduled: 0 };
    await ensureAndroidChannels();

    let scheduled = 0;
    for (const request of buildPlan(input, now)) {
      try {
        await Notifications.scheduleNotificationAsync(request);
        scheduled += 1;
      } catch {
        // One bad trigger (e.g. a date that slipped into the past) shouldn't block the rest.
      }
    }
    return { scheduled };
  } catch {
    return { scheduled: 0 };
  }
}

/**
 * Cancels every notification this app scheduled and rebuilds them from the
 * current store state. Schedules nothing unless `settings.notifications.enabled`
 * and permission is granted. Never throws.
 */
export function syncNotifications(): Promise<{ scheduled: number }> {
  const run = syncQueue.then(runSync, runSync);
  syncQueue = run.catch(() => undefined);
  return run;
}

/** Shows a sample notification right away (asks for permission first if needed). */
export async function sendTestNotification(): Promise<void> {
  if (!isSupported) return;
  try {
    initNotifications();
    if (!(await requestNotificationPermission())) return;
    const name = useAppStore.getState().profile.name.trim().split(/\s+/)[0] ?? '';
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}test`,
      content: content(
        'test',
        withName('🎉 Notifications are on', name) + '!',
        'This is how Last Mile will cheer you on. One final push before freedom.',
        '/settings',
      ),
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_REMINDERS } : null,
    });
  } catch {
    // Best effort — the settings screen doesn't need to surface a failure here.
  }
}
