import { ComingSoon } from '@/components/ComingSoon';

export default function StressScreen() {
  return (
    <ComingSoon
      title={"Stress Control"}
      illustration="stress-relief"
      script={"A calm mind\ncan achieve anything 🌿"}
      message={"A quiet corner for the stressful nights."}
      features={["Guided breathing (Box, 4-7-8, Calm)", "Meditation scenes", "Motivational quotes", "Sleep reminder & wind-down tips"]}
    />
  );
}
