import type { ReactNode, Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type BlurEvent,
  type FocusEvent,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { fonts, motion, radii, spacing, useTheme } from '@/theme';
import type { IconName } from '@/types';

import { AppText } from './AppText';
import { Icon } from './Icon';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  /** Leading icon. */
  icon?: IconName;
  /** Trailing slot, e.g. a send `IconButton`. */
  right?: ReactNode;
  /** Validation message shown below the field (also turns the border red). */
  error?: string;
  /** Container style. */
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  ref?: Ref<TextInput>;
}

/** Glass text input with a focus-animated border, optional label, icon and trailing slot. */
export function TextField({
  value,
  onChangeText,
  label,
  icon,
  right,
  error,
  multiline,
  placeholder,
  style,
  inputStyle,
  onFocus,
  onBlur,
  accessibilityLabel,
  ref,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const focus = useSharedValue(0);

  const restColor = error ? colors.danger : colors.border;
  const activeColor = error ? colors.danger : colors.primary;
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.get(), [0, 1], [restColor, activeColor]),
  }));

  const handleFocus = (e: FocusEvent) => {
    focus.set(withTiming(1, { duration: motion.fast }));
    onFocus?.(e);
  };
  const handleBlur = (e: BlurEvent) => {
    focus.set(withTiming(0, { duration: motion.fast }));
    onBlur?.(e);
  };

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <AppText variant="label" color="textSecondary">
          {label}
        </AppText>
      ) : null}
      <Animated.View
        style={[
          styles.field,
          { backgroundColor: colors.surfaceMuted },
          multiline ? styles.multilineField : null,
          borderStyle,
        ]}
      >
        {icon ? (
          <Icon name={icon} size={20} color="textMuted" style={multiline ? styles.topIcon : null} />
        ) : null}
        <TextInput
          {...rest}
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            { color: colors.text },
            multiline ? styles.multilineInput : null,
            inputStyle,
          ]}
        />
        {right}
      </Animated.View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  multilineField: { alignItems: 'flex-start', paddingVertical: spacing.md },
  topIcon: { marginTop: 1 },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: fonts.medium,
    fontSize: 15,
    paddingVertical: spacing.sm,
    // Removes the browser focus ring; the animated border is the focus indicator.
    outlineWidth: 0,
  },
  multilineInput: { minHeight: 96, paddingVertical: 0 },
});
