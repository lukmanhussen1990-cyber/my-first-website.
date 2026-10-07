import { AnimatePresence, motion, type Variants } from 'motion/react';
import { Suspense, useEffect } from 'react';
import { ART } from '../assets/art';
import { BottomNav } from '../components/BottomNav';
import { Toaster } from '../components/Toaster';
import { APP_ROOT_ID } from '../components/ui/Sheet';
import { audio } from '../services/audio';
import { useGame } from '../state/game';
import { useSession } from '../state/session';
import { useSettings } from '../state/settings';
import './boot';
import { navigate, useRouter, type Transition } from './router';
import { SCREENS } from './screens';
import s from './App.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

/* Native-feeling stack transitions keyed by navigation kind. */
const variants: Variants = {
  enter: (t: Transition) => {
    switch (t) {
      case 'push':
        return { x: '32%', opacity: 0, zIndex: 2 };
      case 'pop':
        return { x: '-14%', opacity: 0, zIndex: 1 };
      case 'tab':
        return { opacity: 0, scale: 1.015, zIndex: 2 };
      case 'glitch':
        return { opacity: 0, x: 0, zIndex: 2, filter: 'brightness(2) saturate(0)' };
      case 'fade':
        return { opacity: 0, zIndex: 2 };
      default:
        return { opacity: 1, zIndex: 2 };
    }
  },
  center: (t: Transition) => ({
    x: t === 'glitch' ? [0, -7, 5, -2, 0] : 0,
    opacity: t === 'glitch' ? [0, 1, 0.3, 1, 1] : 1,
    scale: 1,
    filter: 'brightness(1) saturate(1)',
    zIndex: t === 'pop' ? 1 : 2,
    transition:
      t === 'glitch'
        ? { duration: 0.55, ease: 'easeOut', times: [0, 0.2, 0.3, 0.45, 1] }
        : t === 'tab'
          ? { duration: 0.28, ease: EASE }
          : t === 'fade'
            ? { duration: 0.5, ease: 'easeOut' }
            : t === 'none'
              ? { duration: 0 }
              : { duration: 0.42, ease: EASE },
  }),
  exit: (t: Transition) => {
    switch (t) {
      case 'push':
        return { x: '-14%', opacity: 0.0, zIndex: 1, transition: { duration: 0.42, ease: EASE } };
      case 'pop':
        return { x: '32%', opacity: 0, zIndex: 2, transition: { duration: 0.36, ease: EASE } };
      case 'tab':
        return { opacity: 0, zIndex: 1, transition: { duration: 0.18 } };
      case 'glitch':
        return { opacity: 0, zIndex: 1, filter: 'brightness(0.2)', transition: { duration: 0.3 } };
      case 'fade':
        return { opacity: 0, zIndex: 1, transition: { duration: 0.4 } };
      default:
        return { opacity: 0, transition: { duration: 0 } };
    }
  },
};

export function App() {
  const { route, transition } = useRouter();
  const status = useSession((st) => st.status);
  const hasProgress = useGame((st) => st.progress !== null);
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const music = useSettings((st) => st.music);
  const sound = useSettings((st) => st.sound);
  const volume = useSettings((st) => st.volume);

  useEffect(() => {
    void useSession.getState().boot();
  }, []);

  useEffect(() => {
    audio.sync();
  }, [music, sound, volume]);

  // Unlock audio on the first interaction anywhere (browser autoplay policy).
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Auth guard (the loading screen handles cold start itself).
  const signedIn = status === 'user' || status === 'guest';
  useEffect(() => {
    if (status === 'booting' || route.name === 'loading') return;
    if (route.auth && !signedIn) navigate('/welcome', { replace: true, transition: 'fade' });
    // Signed-in players skip the entry screens; guests may still open
    // /login and /register to upgrade (their progress carries over).
    else if (
      (status === 'user' && (route.name === 'welcome' || route.name === 'login' || route.name === 'register')) ||
      (status === 'guest' && route.name === 'welcome')
    )
      navigate('/home', { replace: true, transition: 'fade' });
  }, [route, status, signedIn]);

  const blocked = route.auth && (!signedIn || !hasProgress);
  const Screen = SCREENS[route.name];
  const t: Transition = reduceMotion ? (transition === 'none' ? 'none' : 'fade') : transition;

  return (
    <div className={s.device}>
      <div className={s.backdrop} style={{ backgroundImage: `url(${ART.welcomeCity})` }} aria-hidden />
      <div id={APP_ROOT_ID} className={[s.app, reduceMotion && 'reduce-motion'].filter(Boolean).join(' ')}>
        <AnimatePresence initial={false} custom={t}>
          <motion.div
            key={route.path}
            className={s.layer}
            custom={t}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {!blocked && (
              <Suspense fallback={<div className={s.fallback} />}>
                <Screen params={route.params} />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {route.tab && !blocked && (
            <motion.div
              className={s.navWrap}
              initial={{ y: 90 }}
              animate={{ y: 0 }}
              exit={{ y: 90 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <BottomNav />
            </motion.div>
          )}
        </AnimatePresence>

        <Toaster />
        <div className={s.grain} style={{ backgroundImage: `url(${ART.noise})` }} aria-hidden />
        <div className={s.vignette} aria-hidden />
      </div>
    </div>
  );
}
