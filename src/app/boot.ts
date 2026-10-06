/*
 * Cold-start handling. Whatever URL the app is opened at, it always plays the
 * loading screen first; the originally requested path is remembered here and
 * restored once the session is known.
 */
import { getRouter, navigate } from './router';

const initial = getRouter().route;
let target: string | null = initial.name === 'loading' || initial.name === 'notFound' ? null : initial.path;

if (initial.name !== 'loading') {
  navigate('/', { replace: true, transition: 'none' });
}

const PUBLIC_ONLY = new Set(['/welcome', '/login', '/register']);

/** Leave the loading screen for the right destination. */
export function finishBoot(signedIn: boolean): void {
  let dest = target;
  target = null;
  if (signedIn) {
    if (!dest || PUBLIC_ONLY.has(dest)) dest = '/home';
  } else if (!dest || !(dest === '/about' || dest === '/info' || PUBLIC_ONLY.has(dest))) {
    dest = '/welcome';
  }
  navigate(dest, { replace: true, transition: 'glitch' });
}
