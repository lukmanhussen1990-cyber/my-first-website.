import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useAppStore } from '@/store/app';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

function hapticsEnabled(): boolean {
  try {
    return useAppStore.getState().settings.haptics !== false;
  } catch {
    // Store not initialised yet — default to the app's default (on).
    return true;
  }
}

function trigger(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'selection':
      return Haptics.selectionAsync();
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'heavy':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    case 'light':
    default:
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/**
 * Fire-and-forget haptic feedback. Never throws; a no-op on web or when the
 * user has turned haptics off in Settings.
 */
export function haptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web' || !hapticsEnabled()) return;
  try {
    trigger(kind).catch(() => undefined);
  } catch {
    // Some devices/emulators have no haptic engine — feedback is optional.
  }
}
