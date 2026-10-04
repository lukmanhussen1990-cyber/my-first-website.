import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { haptic } from '@/services/haptics';
import { spacing } from '@/theme';

export interface SectionHeaderProps {
  title: string;
  /** Right-aligned summary, e.g. "2/3" or "80%". */
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Section title row: "Today's Mission ……… 2/3" with an optional text action. */
export function SectionHeader({ title, caption, actionLabel, onAction, style }: SectionHeaderProps) {
  const handleAction = onAction
    ? () => {
        haptic('selection');
        onAction();
      }
    : undefined;

  return (
    <View style={[styles.row, style]}>
      <AppText variant="h3" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      {caption ? (
        <AppText variant="label" color="textSecondary" tabular>
          {caption}
        </AppText>
      ) : null}
      {actionLabel && handleAction ? (
        <Pressable
          onPress={handleAction}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          <AppText variant="label" color="primary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: { flex: 1 },
  pressed: { opacity: 0.6 },
});
