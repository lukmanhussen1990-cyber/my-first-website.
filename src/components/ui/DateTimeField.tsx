import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { GradientButton } from '@/components/ui/GradientButton';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { PressableScale } from '@/components/ui/PressableScale';
import { motion, radii, shadow, spacing, useTheme } from '@/theme';
import type { IconName } from '@/types';
import {
  formatDateTime,
  formatLongDate,
  formatTime,
  fromDayKey,
  pad2,
  startOfMonth,
  toDayKey,
  withTime,
} from '@/utils/date';

export type DateTimeFieldMode = 'date' | 'time' | 'datetime';

export interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode?: DateTimeFieldMode;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ICONS: Record<DateTimeFieldMode, IconName> = {
  date: 'calendar-month-outline',
  time: 'clock-outline',
  datetime: 'calendar-clock',
};

const FORMATTERS: Record<DateTimeFieldMode, (date: Date) => string> = {
  date: formatLongDate,
  time: formatTime,
  datetime: formatDateTime,
};

const MINUTE_STEP = 5;

function clampDate(date: Date, min?: Date, max?: Date): Date {
  if (min && date.getTime() < min.getTime()) return new Date(min);
  if (max && date.getTime() > max.getTime()) return new Date(max);
  return date;
}

/** Android: system dialogs, date first and then time for `datetime`. */
function openAndroidPicker({
  value,
  mode,
  minimumDate,
  maximumDate,
  commit,
}: {
  value: Date;
  mode: DateTimeFieldMode;
  minimumDate?: Date;
  maximumDate?: Date;
  commit: (date: Date) => void;
}) {
  const openTime = (base: Date) =>
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      onValueChange: (_event, picked) => commit(withTime(base, picked.getHours(), picked.getMinutes())),
    });

  if (mode === 'time') {
    openTime(value);
    return;
  }
  DateTimePickerAndroid.open({
    value,
    mode: 'date',
    minimumDate,
    maximumDate,
    onValueChange: (_event, picked) => {
      const day = withTime(picked, value.getHours(), value.getMinutes());
      if (mode === 'datetime') openTime(day);
      else commit(day);
    },
  });
}

/**
 * Glass field showing a formatted date/time. Tapping opens the platform
 * picker: an inline/spinner picker in a bottom sheet on iOS, system dialogs on
 * Android, and an in-app calendar + time steppers on web.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  minimumDate,
  maximumDate,
  disabled = false,
  style,
}: DateTimeFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const formatted = FORMATTERS[mode](value);
  const commit = (date: Date) => onChange(clampDate(date, minimumDate, maximumDate));

  const show = () => {
    if (Platform.OS === 'android') {
      openAndroidPicker({ value, mode, minimumDate, maximumDate, commit });
      return;
    }
    setDraft(value);
    setOpen(true);
  };
  const cancel = () => setOpen(false);
  const done = () => {
    commit(draft);
    setOpen(false);
  };
  const updateDraft = (next: Date) => setDraft(clampDate(next, minimumDate, maximumDate));

  const sheetProps: PickerSheetProps = {
    open,
    title: label,
    mode,
    draft,
    minimumDate,
    maximumDate,
    onDraft: updateDraft,
    onCancel: cancel,
    onDone: done,
  };

  return (
    <View style={[styles.wrapper, style]}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <PressableScale
        onPress={show}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatted}`}
        accessibilityHint="Opens a picker to change it"
        accessibilityState={{ disabled, expanded: open }}
        style={[
          styles.field,
          { backgroundColor: colors.surfaceMuted, borderColor: open ? colors.primary : colors.border },
          disabled ? styles.disabled : null,
        ]}
      >
        <Icon name={ICONS[mode]} size={20} color="primary" />
        <AppText variant="body" numberOfLines={1} style={styles.value}>
          {formatted}
        </AppText>
        <Icon name="chevron-down" size={18} color="textMuted" />
      </PressableScale>
      {Platform.OS === 'ios' ? <IOSPickerSheet {...sheetProps} /> : null}
      {Platform.OS === 'web' ? <WebPickerModal {...sheetProps} /> : null}
    </View>
  );
}

interface PickerSheetProps {
  open: boolean;
  title: string;
  mode: DateTimeFieldMode;
  draft: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onDraft: (date: Date) => void;
  onCancel: () => void;
  onDone: () => void;
}

function Backdrop({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Close picker"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
    />
  );
}

/** iOS: native picker (inline calendar or time spinner) inside a bottom sheet. */
function IOSPickerSheet({
  open,
  title,
  mode,
  draft,
  minimumDate,
  maximumDate,
  onDraft,
  onCancel,
  onDone,
}: PickerSheetProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.sheetRoot}>
        <Backdrop onPress={onCancel} />
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(180)}
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.track }]} />
          <View style={styles.sheetHeader}>
            <AppText variant="h3" accessibilityRole="header" style={styles.flex}>
              {title}
            </AppText>
            <GradientButton label="Done" size="md" onPress={onDone} />
          </View>
          <DateTimePicker
            value={draft}
            mode={mode}
            display={mode === 'time' ? 'spinner' : 'inline'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant={isDark ? 'dark' : 'light'}
            accentColor={colors.primary}
            textColor={colors.text}
            onValueChange={(_event, date) => onDraft(date)}
            style={styles.iosPicker}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Web: the native picker isn't available, so use MonthCalendar + time steppers. */
function WebPickerModal({ open, title, mode, draft, minimumDate, onDraft, onCancel, onDone }: PickerSheetProps) {
  const { colors } = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(draft));
  // Follow the draft when the modal (re)opens on a different month.
  const [shownFor, setShownFor] = useState(open);
  if (open !== shownFor) {
    setShownFor(open);
    if (open) setMonth(startOfMonth(draft));
  }

  const hasDate = mode !== 'time';
  const hasTime = mode !== 'date';

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.webRoot}>
        <Backdrop onPress={onCancel} />
        <Animated.View
          entering={FadeInDown.duration(motion.base)}
          accessibilityViewIsModal
          style={[
            styles.webCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadow('lg', colors.shadow),
          ]}
        >
          <View style={styles.sheetHeader}>
            <AppText variant="h3" accessibilityRole="header" style={styles.flex}>
              {title}
            </AppText>
            <IconButton icon="close" size="sm" accessibilityLabel="Cancel" onPress={onCancel} />
          </View>
          {hasDate ? (
            <MonthCalendar
              month={month}
              selected={toDayKey(draft)}
              onMonthChange={setMonth}
              onSelect={(day) => onDraft(withTime(fromDayKey(day), draft.getHours(), draft.getMinutes()))}
              minDay={minimumDate ? toDayKey(minimumDate) : undefined}
            />
          ) : null}
          {hasTime ? <TimeSteppers value={draft} onChange={onDraft} /> : null}
          <View style={styles.actions}>
            <GradientButton label="Cancel" variant="secondary" size="md" onPress={onCancel} style={styles.flex} />
            <GradientButton label="Done" size="md" onPress={onDone} style={styles.flex} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Stepper({
  label,
  display,
  onStep,
}: {
  label: string;
  display: string;
  onStep: (delta: -1 | 1) => void;
}) {
  return (
    <View style={styles.stepper}>
      <IconButton icon="minus" size="sm" accessibilityLabel={`Earlier ${label.toLowerCase()}`} onPress={() => onStep(-1)} />
      <AppText
        variant="h2"
        tabular
        align="center"
        style={styles.stepperValue}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: display }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        {display}
      </AppText>
      <IconButton icon="plus" size="sm" accessibilityLabel={`Later ${label.toLowerCase()}`} onPress={() => onStep(1)} />
    </View>
  );
}

/** Hour / minute steppers (12-hour, minutes in 5s) plus an AM/PM toggle. */
function TimeSteppers({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const hours = value.getHours();
  const minutes = value.getMinutes();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const isPm = hours >= 12;

  const stepHour = (delta: -1 | 1) => onChange(withTime(value, (hours + delta + 24) % 24, minutes));
  const stepMinute = (delta: -1 | 1) => {
    const offset = minutes % MINUTE_STEP;
    // Snap to the 5-minute grid first, then step; wraps within the hour.
    const next = delta > 0 ? minutes - offset + MINUTE_STEP : offset ? minutes - offset : minutes - MINUTE_STEP;
    onChange(withTime(value, hours, (next + 60) % 60));
  };
  const setMeridiem = (pm: boolean) => {
    if (pm !== isPm) onChange(withTime(value, (hours + 12) % 24, minutes));
  };

  return (
    <View style={styles.time}>
      <Stepper label="Hour" display={String(hour12)} onStep={stepHour} />
      <AppText variant="h2" color="textMuted">
        :
      </AppText>
      <Stepper label="Minute" display={pad2(minutes)} onStep={stepMinute} />
      <View style={styles.meridiem}>
        <Chip label="AM" selected={!isPm} onPress={() => setMeridiem(false)} />
        <Chip label="PM" selected={isPm} onPress={() => setMeridiem(true)} />
      </View>
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
  value: { flex: 1 },
  disabled: { opacity: 0.5 },
  flex: { flex: 1 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iosPicker: { alignSelf: 'center' },
  webRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  webCard: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.lg,
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepperValue: { minWidth: 36 },
  meridiem: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
