import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SetupForm, type SetupValues } from '@/components/onboarding/SetupForm';
import { StorySlides } from '@/components/onboarding/StorySlides';
import { haptic } from '@/services/haptics';
import { requestNotificationPermission } from '@/services/notifications';
import { useAppStore } from '@/store/app';
import { palette } from '@/theme';

/**
 * First-run flow: a three-part story, then the finish-line setup. Completing it
 * flips `hasOnboarded`, and the root Stack.Protected guard swaps in the tabs.
 */
export default function OnboardingScreen() {
  const [step, setStep] = useState<'story' | 'setup'>('story');

  const finish = async (values: SetupValues) => {
    // Ask while this screen is still mounted, before the guard swaps screens.
    const notificationsAllowed = values.reminders ? await requestNotificationPermission() : false;
    const app = useAppStore.getState();
    app.completeOnboarding({
      name: values.name,
      examDate: values.examDate.toISOString(),
      travelDate: values.travelDate.toISOString(),
      homeCity: values.homeCity || undefined,
      travelMode: values.travelMode,
      useSamplePlan: values.useSamplePlan,
    });
    app.updateNotificationSettings({ enabled: notificationsAllowed });
    haptic('success');
  };

  return (
    <View style={styles.root}>
      {step === 'story' ? (
        <StorySlides onFinish={() => setStep('setup')} />
      ) : (
        <SetupForm onSubmit={finish} onBack={() => setStep('story')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.navy900 },
});
