import { ComingSoon } from '@/components/ComingSoon';

export default function JournalScreen() {
  return (
    <ComingSoon
      title={"Memory Journal"}
      illustration="memory-journal"
      script={"Every late night is a story\nyou'll tell one day ✨"}
      message={"Capture the moments of your final stretch."}
      features={["Photo, note and voice memories", "Favourites", "“Future Me” time capsules that open in a year"]}
      tab
    />
  );
}
