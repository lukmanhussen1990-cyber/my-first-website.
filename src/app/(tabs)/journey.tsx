import { ComingSoon } from '@/components/ComingSoon';

export default function JourneyScreen() {
  return (
    <ComingSoon
      title={"Home Journey"}
      illustration="home-journey"
      script={"Almost there…\nYour home awaits! 🏠"}
      message={"Count down to the trip home and get everything ready."}
      features={["Going-home countdown", "Ticket details & booking reminder", "Packing progress", "Pre-travel checklist by category"]}
      tab
    />
  );
}
