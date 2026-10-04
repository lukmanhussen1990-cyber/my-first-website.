import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { fonts, gradients, useTheme, type Gradient } from '@/theme';

export interface AvatarProps {
  name: string;
  size?: number;
  onPress?: () => void;
  gradient?: Gradient;
  /** Defaults to the name ("Profile, <name>" when pressable). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const RING = 2;
const GAP = 2;

/** "Lukman Hussen" → "LH", "aisha" → "A", "" → "?". Grapheme-safe for emoji / accents. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase();
}

/** Initials on a gradient disc, framed by a thin ring. */
export function Avatar({
  name,
  size = 44,
  onPress,
  gradient = gradients.primary,
  accessibilityLabel,
  accessibilityHint,
  style,
}: AvatarProps) {
  const { colors } = useTheme();
  const inner = size - 2 * (RING + GAP);
  const initials = initialsOf(name);
  const fontSize = Math.round(inner * (initials.length > 1 ? 0.38 : 0.44));

  const disc = (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: colors.border },
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.disc, { width: inner, height: inner, borderRadius: inner / 2 }]}
      >
        <AppText
          color="textOnAccent"
          style={{ fontFamily: fonts.bold, fontSize, lineHeight: Math.round(fontSize * 1.2) }}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {initials}
        </AppText>
      </LinearGradient>
    </View>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel ?? name}
        style={style}
      >
        {disc}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      hitSlop={Math.max(0, (44 - size) / 2)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Profile, ${name}`}
      accessibilityHint={accessibilityHint}
      style={[{ width: size, height: size }, style]}
    >
      {disc}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: RING, padding: GAP, alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
});
