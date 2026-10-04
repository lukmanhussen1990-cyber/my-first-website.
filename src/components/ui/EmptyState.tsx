import { Image } from 'expo-image';
import { StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconTile } from '@/components/ui/IconTile';
import { gradients, radii, spacing, useTheme, type Gradient } from '@/theme';
import type { IconName } from '@/types';

export interface EmptyStateProps {
  icon?: IconName;
  illustration?: ImageSourcePropType;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Icon on the action button. */
  actionIcon?: IconName;
  /** Fill of the icon tile (when no illustration is given). */
  gradient?: Gradient;
  style?: StyleProp<ViewStyle>;
}

/** Centred placeholder for empty lists: illustration or icon tile, copy and an optional CTA. */
export function EmptyState({
  icon = 'creation',
  illustration,
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  gradient = gradients.primary,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {illustration ? (
        <Image
          source={illustration}
          contentFit="cover"
          transition={250}
          accessible={false}
          style={[styles.illustration, { borderColor: colors.border }]}
        />
      ) : (
        <IconTile icon={icon} gradient={gradient} size="xl" glow />
      )}
      <View style={styles.copy}>
        <AppText variant="h3" align="center" accessibilityRole="header">
          {title}
        </AppText>
        {message ? (
          <AppText variant="bodySm" color="textSecondary" align="center">
            {message}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <GradientButton
          label={actionLabel}
          onPress={onAction}
          icon={actionIcon}
          size="md"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  illustration: {
    width: '100%',
    maxWidth: 260,
    aspectRatio: 4 / 3,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  copy: { gap: spacing.xs + 2, maxWidth: 320, alignItems: 'center' },
  action: { alignSelf: 'center', marginTop: spacing.xs },
});
