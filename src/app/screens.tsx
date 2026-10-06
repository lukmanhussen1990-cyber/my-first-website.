/*
 * Screen registry. Every route maps to a lazily-loaded screen module so the
 * first paint only ships the loading screen; the loading screen then calls
 * preloadAllScreens() so later navigation never shows a spinner.
 */
import { lazy, type ComponentType } from 'react';
import type { RouteName } from './router';

export interface ScreenProps {
  params: Record<string, string>;
}

type Loader = () => Promise<{ default: ComponentType<ScreenProps> }>;

type LazyScreen = ((props: ScreenProps) => React.JSX.Element) & {
  preload: () => Promise<void>;
};

function lazyScreen(loader: Loader): LazyScreen {
  let Comp: ComponentType<ScreenProps> | null = null;
  let promise: Promise<void> | null = null;
  const load = () =>
    (promise ??= loader().then((m) => {
      Comp = m.default;
    }));
  const Lazy = lazy(() => load().then(() => ({ default: Comp! })));
  const Screen = (props: ScreenProps) => (Comp ? <Comp {...props} /> : <Lazy {...props} />);
  return Object.assign(Screen, { preload: load });
}

export const SCREENS: Record<RouteName, LazyScreen> = {
  loading: lazyScreen(() => import('../screens/LoadingScreen')),
  welcome: lazyScreen(() => import('../screens/WelcomeScreen')),
  login: lazyScreen(() => import('../screens/AuthScreen')),
  register: lazyScreen(() => import('../screens/AuthScreen')),
  home: lazyScreen(() => import('../screens/DashboardScreen')),
  cards: lazyScreen(() => import('../screens/CardSelectScreen')),
  suit: lazyScreen(() => import('../screens/SuitDetailScreen')),
  challenge: lazyScreen(() => import('../screens/ChallengeDetailScreen')),
  play: lazyScreen(() => import('../screens/PlayScreen')),
  games: lazyScreen(() => import('../screens/GamesScreen')),
  map: lazyScreen(() => import('../screens/MapScreen')),
  rankings: lazyScreen(() => import('../screens/LeaderboardScreen')),
  profile: lazyScreen(() => import('../screens/ProfileScreen')),
  settings: lazyScreen(() => import('../screens/SettingsScreen')),
  about: lazyScreen(() => import('../screens/AboutScreen')),
  info: lazyScreen(() => import('../screens/AppInfoScreen')),
  notFound: lazyScreen(() => import('../screens/NotFoundScreen')),
};

export function preloadAllScreens(): Promise<void> {
  return Promise.all(Object.values(SCREENS).map((s) => s.preload())).then(() => undefined);
}
