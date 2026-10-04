import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAppStore } from '@/store/app';

function deepLinkOf(response: Notifications.NotificationResponse | null): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}

/**
 * Opens the screen a tapped notification points at (`content.data.url`), both
 * while the app is running and when a tap cold-starts the app.
 */
export function useNotificationNavigation(): void {
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);

  useEffect(() => {
    if (Platform.OS === 'web' || !hasOnboarded) return;
    let active = true;

    const open = (response: Notifications.NotificationResponse | null) => {
      const url = deepLinkOf(response);
      if (active && url) router.push(url as Href);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        open(response);
        // Don't replay the same cold-start tap on the next launch.
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [hasOnboarded]);
}
