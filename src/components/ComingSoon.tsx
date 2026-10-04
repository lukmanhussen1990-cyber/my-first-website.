import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FadeInView } from '@/components/ui/FadeInView';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { illustrations } from '@/data/illustrations';
import { spacing } from '@/theme';
import type { IllustrationKey } from '@/types';

export interface ComingSoonProps {
  title: string;
  illustration: IllustrationKey;
  script: string;
  message: string;
  features: string[];
  /** Tab screens have no back button and need tab-bar clearance. */
  tab?: boolean;
}

/** Placeholder for features that ship in the next update. */
export function ComingSoon({ title, illustration, script, message, features, tab = false }: ComingSoonProps) {
  return (
    <Screen tabBar={tab}>
      {tab ? (
        <AppText variant="h1" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
      ) : (
        <ScreenHeader title={title} />
      )}
      <View style={styles.stack}>
        <FadeInView>
          <HeroBanner source={illustrations[illustration]} height={220} script={script} />
        </FadeInView>
        <FadeInView delay={80}>
          <GlassCard style={styles.card}>
            <AppText variant="overline" color="accent">
              Coming in the next update
            </AppText>
            <AppText variant="body" color="textSecondary">
              {message}
            </AppText>
            <View style={styles.list}>
              {features.map((feature) => (
                <AppText key={feature} variant="bodySm">
                  ✦ {feature}
                </AppText>
              ))}
            </View>
          </GlassCard>
        </FadeInView>
        {!tab ? (
          <FadeInView delay={140}>
            <GradientButton
              label="Back to dashboard"
              icon="home-variant"
              fullWidth
              onPress={() => router.replace('/')}
            />
          </FadeInView>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.sm },
  stack: { gap: spacing.xl, marginTop: spacing.lg },
  card: { gap: spacing.md },
  list: { gap: spacing.sm },
});
