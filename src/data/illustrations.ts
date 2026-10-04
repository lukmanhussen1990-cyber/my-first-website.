import type { ImageSourcePropType } from 'react-native';

import type { IllustrationKey } from '@/types';

/**
 * Bundled cinematic illustrations. Replace any file in
 * `assets/images/illustrations/` with a higher-resolution export of the same
 * name and it will be picked up automatically.
 */
export const illustrations: Record<IllustrationKey, ImageSourcePropType> = {
  'home-hero': require('@/assets/images/illustrations/home-hero.jpg'),
  'exam-countdown': require('@/assets/images/illustrations/exam-countdown.jpg'),
  'study-planner': require('@/assets/images/illustrations/study-planner.jpg'),
  'ai-assistant': require('@/assets/images/illustrations/ai-assistant.jpg'),
  'home-journey': require('@/assets/images/illustrations/home-journey.jpg'),
  'travel-checklist': require('@/assets/images/illustrations/travel-checklist.jpg'),
  'stress-relief': require('@/assets/images/illustrations/stress-relief.jpg'),
  'memory-journal': require('@/assets/images/illustrations/memory-journal.jpg'),
  achievement: require('@/assets/images/illustrations/achievement.jpg'),
  'onboarding-prepare': require('@/assets/images/illustrations/onboarding-prepare.jpg'),
  'onboarding-complete': require('@/assets/images/illustrations/onboarding-complete.jpg'),
  'onboarding-go-home': require('@/assets/images/illustrations/onboarding-go-home.jpg'),
};
