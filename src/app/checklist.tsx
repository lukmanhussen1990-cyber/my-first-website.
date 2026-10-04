import { ComingSoon } from '@/components/ComingSoon';

export default function ChecklistScreen() {
  return (
    <ComingSoon
      title={"Travel Checklist"}
      illustration="travel-checklist"
      script={"Pack light,\ngo home happy 🎒"}
      message={"Everything you need for the trip home in one list."}
      features={["Tickets, packing, documents, gifts and essentials", "Filters and progress", "A little celebration when you're all packed"]}
    />
  );
}
