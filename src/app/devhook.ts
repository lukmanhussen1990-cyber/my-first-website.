/*
 * DEV ONLY — scripting hook used by tools/shoot.mjs to drive the app from a
 * headless browser (navigate, fake progress). Never imported in production.
 */
import { CHALLENGES } from '../data/challenges';
import { useGame } from '../state/game';
import { challengeStatus } from '../state/selectors';
import { useSession } from '../state/session';
import { useToasts } from '../state/toasts';
import { getRouter, navigate } from './router';

export function installDevHook() {
  (window as unknown as { __bt: unknown }).__bt = {
    navigate,
    getRouter,
    useGame,
    useSession,
    /** true once boot finished and the loading screen has handed off */
    ready: () => useSession.getState().status !== 'booting' && getRouter().route.name !== 'loading',
    /** Record `n` wins on the easiest available trials (plus one loss) to populate the UI. */
    simulateWins: (n: number) => {
      const g = useGame.getState();
      if (!g.progress) return;
      // Clear trials in a realistic order: always the easiest one that is
      // currently unlocked, so seeded screenshots respect level gates.
      for (let i = 0; i < n; i++) {
        const p = useGame.getState().progress!;
        const next = [...CHALLENGES]
          .sort((a, b) => a.difficulty - b.difficulty)
          .find((c) => challengeStatus(c, p) === 'available');
        if (!next) break;
        g.recordResult(next, { outcome: 'win', score: 70 + ((i * 13) % 30), summary: 'simulated', stats: {} });
      }
      g.recordResult(CHALLENGES[1], { outcome: 'loss', score: 20, summary: 'simulated' });
      setTimeout(() => useToasts.setState({ toasts: [] }), 50);
    },
  };
}
