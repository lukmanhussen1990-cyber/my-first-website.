import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, spacing, type Gradient } from '@/theme';
import type { IconName } from '@/types';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { IconTile } from './IconTile';

export interface FeatureTileProps {
  icon: IconName;
  label: string;
  gradient: Gradient;
  onPress: () => void;
  /** Small count/status pill in the top-right corner, e.g. "3". */
  badge?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Dashboard grid tile: tinted glass, centred gradient icon, label below. */
export function FeatureTile({
  icon,
  label,
  gradient,
  onPress,
  badge,
  accessibilityHint,
  style,
}: FeatureTileProps) {
  return (
    <GlassCard
      onPress={onPress}
      tint={gradient}
      padding={spacing.md}
      radius={radii.lg}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      accessibilityHint={accessibilityHint}
      style={[styles.tile, style]}
    >
      <IconTile icon={icon} gradient={gradient} size="sm" />
      <AppText variant="caption" color="text" align="center" numberOfLines={1}>
        {label}
      </AppText>
      {badge ? (
        <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no">
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.badgeFill]}
          />
          <AppText variant="caption" color="textOnAccent" style={styles.badgeText} tabular>
            {badge}
          </AppText>
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFill: { borderRadius: radii.pill },
  badgeText: { fontSize: 11, lineHeight: 14 },
});
