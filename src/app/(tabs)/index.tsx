import { StyleSheet, View } from 'react-native';

import { ExamCountdownCard, GoingHomeCard } from '@/components/home/CountdownCards';
import { HomeHeader, HomeHero } from '@/components/home/HomeHeader';
import {
  CalmBanner,
  DailyMission,
  DailyQuote,
  FeatureGrid,
  PreparationCard,
  WinsStrip,
} from '@/components/home/HomeSections';
import { FadeInView } from '@/components/ui/FadeInView';
import { Screen } from '@/components/ui/Screen';
import { useJourneyPhase } from '@/hooks/useJourneyPhase';
import { motion, spacing } from '@/theme';

/** The dashboard: where the student is on their journey, at a glance. */
export default function HomeScreen() {
  const phase = useJourneyPhase();
  const examsDone = phase === 'completed' || phase === 'home';

  const sections = [
    <HomeHeader key="header" phase={phase} />,
    <HomeHero key="hero" phase={phase} />,
    ...(examsDone
      ? [<GoingHomeCard key="home" phase={phase} />, <ExamCountdownCard key="exam" phase={phase} />]
      : [<ExamCountdownCard key="exam" phase={phase} />, <GoingHomeCard key="home" phase={phase} />]),
    <PreparationCard key="prep" />,
    <DailyMission key="mission" />,
    <DailyQuote key="quote" />,
    <FeatureGrid key="features" />,
    <CalmBanner key="calm" />,
    <WinsStrip key="wins" />,
  ];

  return (
    <Screen tabBar>
      <View style={styles.stack}>
        {sections.map((section, index) => (
          <FadeInView key={section.key} delay={Math.min(index, 6) * motion.stagger}>
            {section}
          </FadeInView>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xxl },
});
