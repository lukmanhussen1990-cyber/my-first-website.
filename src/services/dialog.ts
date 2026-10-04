import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alerts. React Native Web's `Alert` is a no-op, so the web
 * build falls back to the browser's own dialogs.
 */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** Resolves `true` when the user confirms. */
export function confirmAction({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(message ? `${title}\n\n${message}` : title) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  destructive?: boolean;
}

/**
 * A small action sheet (native Alert with up to three choices). On web it falls
 * back to sequential confirms. Resolves `null` when dismissed.
 */
export function chooseAction<T extends string>(
  title: string,
  options: ChoiceOption<T>[],
  message?: string,
): Promise<T | null> {
  if (Platform.OS === 'web') {
    for (const option of options) {
      if (globalThis.confirm?.(`${title}\n\n${option.label}?`)) return Promise.resolve(option.value);
    }
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        ...options.map((option) => ({
          text: option.label,
          style: option.destructive ? ('destructive' as const) : ('default' as const),
          onPress: () => resolve(option.value),
        })),
        { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
