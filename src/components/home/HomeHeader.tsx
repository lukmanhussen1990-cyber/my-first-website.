import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { IconButton } from '@/components/ui/IconButton';
import { illustrations } from '@/data/illustrations';
import { useGreeting } from '@/hooks/useGreeting';
import { useAppStore } from '@/store/app';
import { spacing } from '@/theme';
import type { IllustrationKey, JourneyPhase } from '@/types';
import { formatOrdinalDate, parseIso } from '@/utils/date';

const PHASE_COPY: Record<JourneyPhase, { title: string; subtitle: string }> = {
  preparing: { title: "You're in the Last Mile", subtitle: 'Study now, freedom soon! 💙' },
  'exam-day': { title: "It's exam day. You've got this 💪", subtitle: 'Breathe, trust your preparation, give it everything.' },
  completed: { title: 'Exams done. Home is calling 🏠', subtitle: 'You earned this. Time to pack, rest and smile.' },
  home: { title: 'Welcome home ❤️', subtitle: 'You made it. Enjoy every moment of it.' },
};

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export function HomeHeader({ phase }: { phase: JourneyPhase }) {
  const name = useAppStore((s) => s.profile.name);
  const greeting = useGreeting();
  const copy = PHASE_COPY[phase];
  const first = firstName(name);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <IconButton icon="menu" accessibilityLabel="Open settings" onPress={() => router.push('/settings')} />
        <Avatar
          name={name || 'You'}
          onPress={() => router.push('/achievements')}
          accessibilityLabel="Your achievements"
        />
      </View>
      <AppText variant="label" color="textSecondary" accessibilityLabel={`${greeting}, ${first}`}>
        {first ? `Hi ${first} 👋` : 'Hi 👋'} · {greeting}
      </AppText>
      <AppText variant="h1" accessibilityRole="header">
        {copy.title}
      </AppText>
      <AppText variant="body" color="textSecondary">
        {copy.subtitle}
      </AppText>
    </View>
  );
}

const HERO: Record<JourneyPhase, { image: IllustrationKey; script: (exam: Date) => string }> = {
  preparing: {
    image: 'home-hero',
    script: (exam) => `Good things are coming…\n${formatOrdinalDate(exam)} and then Home! 🏠`,
  },
  'exam-day': { image: 'home-hero', script: () => 'Today is the day.\nThen… home! 🏠' },
  completed: { image: 'achievement', script: () => 'You did it!\nNext stop: home 🏠' },
  home: { image: 'home-journey', script: () => 'Home, sweet home ❤️' },
};

export function HomeHero({ phase }: { phase: JourneyPhase }) {
  const examDate = useAppStore((s) => s.examDate);
  const hero = HERO[phase];
  return (
    <HeroBanner
      source={illustrations[hero.image]}
      height={196}
      script={hero.script(parseIso(examDate))}
      accessibilityLabel="Your journey so far"
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});
