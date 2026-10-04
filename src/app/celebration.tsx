import { ComingSoon } from '@/components/ComingSoon';

export default function CelebrationScreen() {
  return (
    <ComingSoon
      title={"You did it! 🎓"}
      illustration="achievement"
      script={"Every late night\nwas worth it 🎉"}
      message={"Exams complete — congratulations! The full celebration (with confetti) arrives in the next update."}
      features={["Confetti celebration", "Your stats from the final stretch", "Your journey home countdown"]}
    />
  );
}
