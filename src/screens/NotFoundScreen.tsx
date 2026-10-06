import type { ScreenProps } from '../app/screens';
import { Screen } from '../components/ui/Screen';
import { TopBar } from '../components/ui/TopBar';

/** PLACEHOLDER — replaced by the screen implementation task. */
export default function NotFoundScreen(_props: ScreenProps) {
  return (
    <Screen header={<TopBar title="NotFoundScreen" />}>
      <p className="t-dim">NotFoundScreen</p>
    </Screen>
  );
}
