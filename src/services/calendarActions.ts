import { Linking, Platform } from 'react-native';

import { syncCalendarEvents } from '@/services/calendar';
import { confirmAction, showAlert } from '@/services/dialog';
import { haptic } from '@/services/haptics';

/** Adds/updates the exam + trip events in the device calendar and tells the user how it went. */
export async function addToCalendarWithFeedback(): Promise<boolean> {
  const result = await syncCalendarEvents();
  if (result.ok) {
    haptic('success');
    const total = result.created + result.updated;
    showAlert(
      'Saved to your calendar 📅',
      `${total === 1 ? 'Your event is' : 'Your exam and trip home are'} in the "Last Mile" calendar, with reminders.`,
    );
    return true;
  }
  haptic('warning');
  if (result.reason === 'unsupported') {
    showAlert(
      'Calendar not available here',
      Platform.OS === 'web'
        ? 'Calendar sync works in the Last Mile mobile app.'
        : 'Calendar sync needs the installed app (it is not available in Expo Go).',
    );
  } else if (result.reason === 'denied') {
    const open = await confirmAction({
      title: 'Calendar access is off',
      message: 'Allow calendar access in Settings so Last Mile can add your exam and trip home.',
      confirmLabel: 'Open Settings',
    });
    if (open) Linking.openSettings().catch(() => undefined);
  } else {
    showAlert("Couldn't update your calendar", result.message ?? 'Please try again in a moment.');
  }
  return false;
}
