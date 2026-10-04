import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { gradients, spacing, useTheme, type Gradient, type ThemeColors } from '@/theme';
import type { IconName } from '@/types';

export type QuoteTone = 'success' | 'sunset' | 'primary';

export interface QuoteCardProps {
  quote: string;
  author?: string;
  icon?: IconName;
  tone?: QuoteTone;
  /** e.g. show another quote. */
  onPress?: () => void;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

function toneStyle(colors: ThemeColors, tone: QuoteTone): { tint: Gradient; fg: string; soft: string } {
  switch (tone) {
    case 'sunset':
      return { tint: gradients.sunset, fg: colors.highlight, soft: colors.highlightSoft };
    case 'primary':
      return { tint: gradients.primary, fg: colors.primary, soft: colors.primarySoft };
    default:
      return { tint: gradients.success, fg: colors.success, soft: colors.successSoft };
  }
}

/** Wraps the text in curly quotes unless it already carries its own. */
function quoted(text: string): string {
  const trimmed = text.trim();
  return /^["“‘']/.test(trimmed) ? trimmed : `“${trimmed}”`;
}

/** Motivational quote on tinted glass with a toned icon disc on the right. */
export function QuoteCard({
  quote,
  author,
  icon = 'sprout',
  tone = 'success',
  onPress,
  accessibilityHint,
  style,
}: QuoteCardProps) {
  const { colors } = useTheme();
  const { tint, fg, soft } = toneStyle(colors, tone);
  const text = quoted(quote);

  return (
    <GlassCard
      tint={tint}
      onPress={onPress}
      accessibilityLabel={author ? `${text} — ${author}` : text}
      accessibilityHint={accessibilityHint}
      style={style}
    >
      <View style={styles.row}>
        <View style={styles.text}>
          <AppText variant="body" color="text">
            {text}
          </AppText>
          {author ? (
            <AppText variant="caption" color="textSecondary">
              — {author}
            </AppText>
          ) : null}
        </View>
        <View style={[styles.disc, { backgroundColor: soft }]}>
          <Icon name={icon} size={24} color={fg} />
        </View>
      </View>
    </GlassCard>
  );
}

const DISC = 44;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
