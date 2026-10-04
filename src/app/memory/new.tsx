import { ComingSoon } from '@/components/ComingSoon';

export default function NewMemoryScreen() {
  return (
    <ComingSoon
      title={"New memory"}
      illustration="memory-journal"
      script={"Save this moment ✨"}
      message={"Adding photo, note and voice memories arrives in the next update."}
      features={["Photos from your camera or library", "Notes and voice recordings", "Seal a letter to your future self"]}
    />
  );
}
