import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Show the back button. */
  back?: boolean;
  /** Overrides the default back behaviour. */
  onBack?: () => void;
  right?: ReactNode;
  /** For headers drawn over imagery: light text and translucent buttons. */
  transparent?: boolean;
  style?: StyleProp<ViewStyle>;
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Top bar for stack screens: glass back button, title, optional right slot. */
export function ScreenHeader({
  title,
  subtitle,
  back = true,
  onBack,
  right,
  transparent = false,
  style,
}: ScreenHeaderProps) {
  const textColor = transparent ? 'textOnAccent' : 'text';
  const subColor = transparent ? 'textOnAccent' : 'textSecondary';

  return (
    <View style={[styles.row, style]}>
      {back ? (
        <IconButton
          icon="arrow-left"
          onPress={onBack ?? goBack}
          variant={transparent ? 'overlay' : 'glass'}
          size="md"
          accessibilityLabel="Go back"
        />
      ) : null}
      <View style={styles.titles}>
        <AppText
          variant="h3"
          color={textColor}
          numberOfLines={1}
          accessibilityRole="header"
          style={transparent ? styles.shadowed : null}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="bodySm"
            color={subColor}
            numberOfLines={1}
            style={transparent ? [styles.shadowed, styles.dim] : null}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  titles: { flex: 1, justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Legibility over photography.
  shadowed: {
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  dim: { opacity: 0.85 },
});
