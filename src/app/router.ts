/*
 * Minimal hash router built for app-style navigation:
 *   - hash URLs work on any static host, GitHub Pages and inside Capacitor
 *   - every navigation carries a transition kind so screens animate the way a
 *     native stack does (push / pop / tab / fade / glitch)
 *   - history index tracking makes the browser / Android back button animate
 *     as a "pop"
 */
import { useSyncExternalStore } from 'react';

export type Transition = 'push' | 'pop' | 'tab' | 'fade' | 'glitch' | 'none';

export type RouteName =
  | 'loading'
  | 'welcome'
  | 'login'
  | 'register'
  | 'home'
  | 'cards'
  | 'suit'
  | 'challenge'
  | 'play'
  | 'games'
  | 'map'
  | 'rankings'
  | 'profile'
  | 'settings'
  | 'about'
  | 'info'
  | 'notFound';

interface RouteDef {
  name: RouteName;
  pattern: string; // "/cards/:suit"
  /** requires a signed-in player or guest */
  auth: boolean;
  /** shows the bottom tab bar */
  tab?: boolean;
}

export const ROUTES: RouteDef[] = [
  { name: 'loading', pattern: '/', auth: false },
  { name: 'welcome', pattern: '/welcome', auth: false },
  { name: 'login', pattern: '/login', auth: false },
  { name: 'register', pattern: '/register', auth: false },
  { name: 'home', pattern: '/home', auth: true, tab: true },
  { name: 'games', pattern: '/games', auth: true, tab: true },
  { name: 'map', pattern: '/map', auth: true, tab: true },
  { name: 'rankings', pattern: '/rankings', auth: true, tab: true },
  { name: 'profile', pattern: '/profile', auth: true, tab: true },
  { name: 'cards', pattern: '/cards', auth: true },
  { name: 'suit', pattern: '/cards/:suit', auth: true },
  { name: 'challenge', pattern: '/challenge/:id', auth: true },
  { name: 'play', pattern: '/play/:id', auth: true },
  { name: 'settings', pattern: '/settings', auth: true },
  { name: 'about', pattern: '/about', auth: false },
  { name: 'info', pattern: '/info', auth: false },
];

export interface Route {
  name: RouteName;
  path: string;
  params: Record<string, string>;
  auth: boolean;
  tab: boolean;
}

export interface RouterState {
  route: Route;
  transition: Transition;
  /** monotonically increasing per navigation; use as a React key salt if needed */
  seq: number;
}

function match(path: string): Route {
  const parts = path.split('/').filter(Boolean);
  for (const def of ROUTES) {
    const pp = def.pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (pp[i] !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { name: def.name, path, params, auth: def.auth, tab: !!def.tab };
  }
  return { name: 'notFound', path, params: {}, auth: false, tab: false };
}

function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

function currentIdx(): number {
  const s = window.history.state as { btIdx?: number } | null;
  return typeof s?.btIdx === 'number' ? s.btIdx : 0;
}

let idx = currentIdx();
let state: RouterState = { route: match(currentPath()), transition: 'none', seq: 0 };
const listeners = new Set<() => void>();
/** false once the History API refuses us (some sandboxed frames); routing then runs in memory */
let historyOk = true;
const memStack: string[] = [];

function writeHistory(mode: 'push' | 'replace', url: string): boolean {
  if (!historyOk) return false;
  try {
    if (mode === 'push') window.history.pushState({ btIdx: idx }, '', url);
    else window.history.replaceState({ btIdx: idx }, '', url);
    return true;
  } catch {
    historyOk = false;
    return false;
  }
}

function emit(next: Omit<RouterState, 'seq'>) {
  state = { ...next, seq: state.seq + 1 };
  listeners.forEach((l) => l());
}

window.addEventListener('popstate', () => {
  const nextIdx = currentIdx();
  const transition: Transition = nextIdx < idx ? 'pop' : 'push';
  idx = nextIdx;
  emit({ route: match(currentPath()), transition });
});

// Ensure the initial entry carries an index so back-navigation is detectable.
if (window.history.state?.btIdx === undefined) writeHistory('replace', window.location.href);

export interface NavigateOptions {
  replace?: boolean;
  transition?: Transition;
}

export function navigate(to: string, opts: NavigateOptions = {}): void {
  const path = to.startsWith('/') ? to : `/${to}`;
  if (path === state.route.path && !opts.replace) return;
  const url = `${window.location.pathname}${window.location.search}#${path}`;
  if (opts.replace) {
    writeHistory('replace', url);
  } else {
    const from = state.route.path;
    idx += 1;
    if (!writeHistory('push', url)) memStack.push(from);
  }
  emit({ route: match(path), transition: opts.transition ?? 'push' });
}

/** Go back one screen; if there is no in-app history, replace with `fallback`. */
export function back(fallback = '/home'): void {
  if (historyOk && idx > 0) {
    window.history.back();
    return;
  }
  const prev = memStack.pop();
  if (prev) {
    idx = Math.max(0, idx - 1);
    emit({ route: match(prev), transition: 'pop' });
  } else navigate(fallback, { replace: true, transition: 'pop' });
}

export function getRouter(): RouterState {
  return state;
}

export function useRouter(): RouterState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function useRoute(): Route {
  return useRouter().route;
}
