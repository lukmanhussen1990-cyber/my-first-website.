import type { ReactNode } from 'react';
import { Platform, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { IconTile } from '@/components/ui/IconTile';
import { PressableScale } from '@/components/ui/PressableScale';
import { haptic } from '@/services/haptics';
import { spacing, useTheme, type Gradient } from '@/theme';
import type { IconName } from '@/types';

/**
 * On web the Switch's native `click` would bubble to the row's press handler and
 * toggle twice, so there only the Switch itself is interactive.
 */
const ROW_TOGGLES = Platform.OS !== 'web';

export interface SettingRowProps {
  icon: IconName;
  gradient: Gradient;
  label: string;
  detail?: string;
  /** When a boolean, the row renders a Switch (tapping the row toggles it too). Takes precedence over `onPress`. */
  value?: boolean;
  onValueChange?: (next: boolean) => void;
  /** Makes the row pressable and shows a chevron (unless it renders a Switch). */
  onPress?: () => void;
  /** Custom trailing content, e.g. a value label ("9:00 AM") or a Badge. */
  right?: ReactNode;
  /** Danger-coloured label, e.g. "Reset app". */
  destructive?: boolean;
  disabled?: boolean;
  /** Hairline below the row, for stacked rows inside one card. */
  divider?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Settings / checklist-category row: gradient icon tile, label + detail, and a
 * Switch, chevron or custom trailing slot.
 */
export function SettingRow({
  icon,
  gradient,
  label,
  detail,
  value,
  onValueChange,
  onPress,
  right,
  destructive = false,
  disabled = false,
  divider = false,
  accessibilityHint,
  style,
}: SettingRowProps) {
  const { colors } = useTheme();
  const isSwitch = typeof value === 'boolean';
  const switchEnabled = !disabled && Boolean(onValueChange);

  const toggle = (next: boolean) => {
    haptic('selection');
    onValueChange?.(next);
  };

  const rowStyle = [
    styles.row,
    divider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
    disabled ? styles.disabled : null,
    style,
  ];

  const switchControl = (
    <Switch
      value={value}
      onValueChange={toggle}
      disabled={!switchEnabled}
      trackColor={{ false: colors.track, true: colors.primary }}
      thumbColor={Platform.OS === 'android' ? colors.textOnAccent : undefined}
      ios_backgroundColor={colors.track}
      accessibilityLabel={label}
    />
  );

  const content = (
    <>
      <IconTile icon={icon} gradient={gradient} size="sm" />
      <View style={styles.text}>
        <AppText variant="subtitle" color={destructive ? 'danger' : 'text'} numberOfLines={1}>
          {label}
        </AppText>
        {detail ? (
          <AppText variant="bodySm" color="textSecondary" numberOfLines={2}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {right}
      {isSwitch ? (
        ROW_TOGGLES ? (
          // The row carries the switch semantics; hide the control itself from screen readers.
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {switchControl}
          </View>
        ) : (
          switchControl
        )
      ) : onPress ? (
        <Icon name="chevron-right" size={22} color="textMuted" />
      ) : null}
    </>
  );

  if (isSwitch && ROW_TOGGLES) {
    return (
      <PressableScale
        onPress={() => toggle(!value)}
        disabled={!switchEnabled}
        haptic={false}
        scaleTo={0.99}
        accessibilityRole="switch"
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ checked: value, disabled: !switchEnabled }}
        style={rowStyle}
      >
        {content}
      </PressableScale>
    );
  }

  if (!isSwitch && onPress) {
    return (
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={rowStyle}
      >
        {content}
      </PressableScale>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm + 2,
  },
  text: { flex: 1, gap: 2 },
  disabled: { opacity: 0.5 },
});
