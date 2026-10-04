import { useEffect } from 'react';

import { initNotifications, syncNotifications } from '@/services/notifications';
import { useAppStore } from '@/store/app';

/** How long to wait for edits to settle before rescheduling (e.g. dragging a time picker). */
const SYNC_DEBOUNCE_MS = 1500;

/**
 * Keeps the scheduled local notifications in step with the app state.
 * Mounted once in the root layout. Re-syncing on launch also tops up the
 * rolling seven-day window of daily motivation notifications.
 */
export function useNotificationSync(): void {
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const notifications = useAppStore((s) => s.settings.notifications);
  const examDate = useAppStore((s) => s.examDate);
  const travelDate = useAppStore((s) => s.travelDate);
  const examCompletedAt = useAppStore((s) => s.examCompletedAt);
  const ticket = useAppStore((s) => s.ticket);
  const profile = useAppStore((s) => s.profile);

  useEffect(() => {
    initNotifications();
  }, []);

  useEffect(() => {
    if (!hasOnboarded) return;
    const timer = setTimeout(() => {
      void syncNotifications();
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hasOnboarded, notifications, examDate, travelDate, examCompletedAt, ticket, profile]);
}
