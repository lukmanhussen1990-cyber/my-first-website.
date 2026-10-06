import type { ScreenProps } from '../app/screens';
import { Screen } from '../components/ui/Screen';
import { TopBar } from '../components/ui/TopBar';

/** PLACEHOLDER — replaced by the screen implementation task. */
export default function WelcomeScreen(_props: ScreenProps) {
  return (
    <Screen header={<TopBar title="WelcomeScreen" />}>
      <p className="t-dim">WelcomeScreen</p>
    </Screen>
  );
}
