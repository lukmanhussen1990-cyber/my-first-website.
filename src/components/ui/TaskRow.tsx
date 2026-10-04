import type { ReactNode } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Checkbox } from '@/components/ui/Checkbox';
import { PressableScale } from '@/components/ui/PressableScale';
import { radii, spacing, useTheme } from '@/theme';

export interface TaskRowProps {
  title: string;
  detail?: string;
  checked: boolean;
  onToggle: () => void;
  /** Enables long-press → confirm → delete. */
  onDelete?: () => void;
  /** Row tap action (e.g. open details). Without it, tapping the row toggles. */
  onPress?: () => void;
  /** Leading adornment, e.g. an `IconTile`. */
  left?: ReactNode;
  shape?: 'circle' | 'square';
  trailing?: ReactNode;
  /** Where the checkbox sits. Defaults to `trailing` when `left` is set, else `leading`. */
  checkboxPosition?: 'leading' | 'trailing';
  /** Checkbox fill colour override. */
  checkColor?: string;
  style?: StyleProp<ViewStyle>;
}

function confirmDelete(title: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    // RN-web's Alert is a no-op; fall back to the browser dialog.
    if (typeof globalThis.confirm === 'function' && globalThis.confirm(`Delete “${title}”?`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert('Delete this item?', `“${title}” will be removed.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Checklist / mission row: checkbox, title + optional detail, trailing slot.
 * Checked rows dim and strike through; long-press asks to delete.
 */
export function TaskRow({
  title,
  detail,
  checked,
  onToggle,
  onDelete,
  onPress,
  left,
  shape = 'circle',
  trailing,
  checkboxPosition = left ? 'trailing' : 'leading',
  checkColor,
  style,
}: TaskRowProps) {
  const { colors } = useTheme();

  // PressableScale already fires a medium haptic on long-press.
  const handleLongPress = onDelete ? () => confirmDelete(title, onDelete) : undefined;

  const actions: AccessibilityActionInfo[] = [];
  if (onPress) actions.push({ name: 'toggle', label: checked ? 'Mark as not done' : 'Mark as done' });
  if (onDelete) actions.push({ name: 'delete', label: 'Delete' });

  const handleAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'toggle') onToggle();
    else if (e.nativeEvent.actionName === 'delete') onDelete?.();
  };

  const checkbox = (
    // The row itself carries the accessible checkbox semantics.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Checkbox
        checked={checked}
        onChange={() => onToggle()}
        shape={shape}
        color={checkColor}
        size={shape === 'circle' ? 24 : 22}
      />
    </View>
  );

  return (
    <PressableScale
      onPress={onPress ?? onToggle}
      onLongPress={handleLongPress}
      delayLongPress={450}
      scaleTo={0.98}
      haptic={onPress ? 'light' : 'selection'}
      accessibilityRole={onPress ? 'button' : 'checkbox'}
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      accessibilityState={onPress ? undefined : { checked }}
      accessibilityHint={onDelete ? 'Long press to delete' : undefined}
      accessibilityActions={actions.length ? actions : undefined}
      onAccessibilityAction={actions.length ? handleAction : undefined}
      style={[styles.row, { backgroundColor: colors.surfaceMuted }, style]}
    >
      {checkboxPosition === 'leading' ? checkbox : null}
      {left}
      <View style={styles.text}>
        <AppText
          variant="subtitle"
          color={checked ? 'textMuted' : 'text'}
          numberOfLines={2}
          style={checked ? styles.done : null}
        >
          {title}
        </AppText>
        {detail ? (
          <AppText variant="bodySm" color={checked ? 'textMuted' : 'textSecondary'} numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {checkboxPosition === 'trailing' ? checkbox : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  text: { flex: 1, gap: 2 },
  done: { textDecorationLine: 'line-through' },
});
