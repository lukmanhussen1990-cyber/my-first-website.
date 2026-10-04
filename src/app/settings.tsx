import { ComingSoon } from '@/components/ComingSoon';

export default function SettingsScreen() {
  return (
    <ComingSoon
      title={"Settings"}
      illustration="study-planner"
      script={"Make Last Mile\nyours ⚙️"}
      message={"Personalise your finish line and reminders."}
      features={["Edit your name, exam and travel dates", "Dark / light / system theme", "Reminders: daily motivation, study, sleep, exam & travel", "Add your exam and trip to your calendar"]}
    />
  );
}
