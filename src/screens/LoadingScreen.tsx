import { useEffect } from 'react';
import { finishBoot } from '../app/boot';
import type { ScreenProps } from '../app/screens';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';
import { useSession } from '../state/session';

/** PLACEHOLDER — replaced by the screen implementation task. */
export default function LoadingScreen(_props: ScreenProps) {
  const status = useSession((s) => s.status);
  useEffect(() => {
    if (status === 'booting') return;
    const t = setTimeout(() => finishBoot(status === 'user' || status === 'guest'), 800);
    return () => clearTimeout(t);
  }, [status]);
  return (
    <Screen>
      <Logo />
    </Screen>
  );
}
