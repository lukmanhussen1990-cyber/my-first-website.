import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { TextField } from '@/components/ui/TextField';
import { spacing, useTheme } from '@/theme';

/** Cross-platform text prompt (Alert.prompt is iOS-only). Mount it only while open. */
export function RenameModal({
  title,
  initialValue,
  onSave,
  onClose,
}: {
  title: string;
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [value, setValue] = useState(initialValue);
  const save = () => {
    if (!value.trim()) return;
    onSave(value.trim());
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.center}>
          <GlassCard style={[styles.card, { backgroundColor: colors.surface }]}>
            <AppText variant="h3">{title}</AppText>
            <TextField value={value} onChangeText={setValue} autoFocus onSubmitEditing={save} returnKeyType="done" />
            <View style={styles.actions}>
              <GradientButton label="Cancel" variant="ghost" size="md" onPress={onClose} />
              <GradientButton label="Save" size="md" disabled={!value.trim()} onPress={save} />
            </View>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl, pointerEvents: 'box-none' },
  card: { gap: spacing.lg, maxWidth: 480, width: '100%', alignSelf: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
