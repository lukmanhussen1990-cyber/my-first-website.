import { ComingSoon } from '@/components/ComingSoon';

export default function MemoryScreen() {
  return (
    <ComingSoon
      title={"Memory"}
      illustration="memory-journal"
      script={"Some moments\nare worth keeping ✨"}
      message={"Viewing memories arrives in the next update."}
      features={["Full-screen photos and notes", "Voice playback", "Time capsules that unlock after a year"]}
    />
  );
}
