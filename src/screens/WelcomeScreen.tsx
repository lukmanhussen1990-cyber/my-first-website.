/*
 * Title screen for signed-out players (reference screen 2).
 * City key art + rain, the wordmark in the upper third, and the entry stack:
 * create account · log in · continue as guest. The city ambience starts on
 * the first press (browsers only allow audio after a gesture).
 */
import { motion, type Variants } from 'motion/react';
import { useRef, useState } from 'react';
import { getRouter, navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { ART } from '../assets/art';
import { AuthorCredit } from '../components/AuthorCredit';
import { Rain } from '../components/fx/Rain';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useSession } from '../state/session';
import { useSettings } from '../state/settings';
import { toast } from '../state/toasts';
import s from './WelcomeScreen.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

const stack: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.55 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/**
 * Navigate home the instant the session flips to signed-in, inside the store
 * update — before the shell's auth guard can redirect with its plain fade.
 */
function homeOnSignIn(): () => void {
  const unsub = useSession.subscribe((st, prev) => {
    if (st.status === prev.status || (st.status !== 'guest' && st.status !== 'user')) return;
    unsub();
    navigate('/home', { replace: true, transition: 'glitch' });
  });
  return unsub;
}

export default function WelcomeScreen(_props: ScreenProps) {
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const [busy, setBusy] = useState(false);
  const ambience = useRef(false);

  const wake = () => {
    if (ambience.current) return;
    ambience.current = true;
    audio.startAmbience('city');
  };

  const playAsGuest = async () => {
    if (busy) return;
    wake();
    setBusy(true);
    const unsub = homeOnSignIn();
    try {
      await useSession.getState().playAsGuest();
      unsub();
      if (getRouter().route.name !== 'home') navigate('/home', { replace: true, transition: 'glitch' });
    } catch (err) {
      unsub();
      setBusy(false);
      console.error('[border-trials] guest start failed', err);
      haptic('error');
      toast({ kind: 'error', title: 'Could not start a guest run', body: 'Storage is unavailable on this device.' });
    }
  };

  const link = (to: string) => () => {
    audio.unlock(); // keyboard activation never fires the shell's pointerdown unlock
    wake();
    audio.play('tap');
    haptic('light');
    navigate(to);
  };

  return (
    <Screen bg={ART.welcomeCity} shade="cinematic" className={s.root} contentClassName={s.content}>
      <Rain intensity={0.7} angle={8} />

      <div className={s.stage}>
        <div className={s.growTop} />

        <motion.div
          className={s.brand}
          initial={{ opacity: 0, y: 12 }}
          animate={
            reduceMotion ? { opacity: 1, y: 0 } : { opacity: [0, 1, 0.2, 1, 0.6, 1], y: 0, x: [0, -6, 4, -2, 1, 0] }
          }
          transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut', times: [0, 0.2, 0.32, 0.48, 0.64, 1] }}
        >
          <span className={s.halo} aria-hidden />
          <Logo size="xl" />
        </motion.div>

        <div className={s.growMid} />

        <motion.div className={s.actions} variants={stack} initial="hidden" animate="show">
          <motion.div variants={item}>
            <Button
              variant="primary"
              size="lg"
              block
              onClick={() => {
                wake();
                navigate('/register');
              }}
            >
              Create account
            </Button>
          </motion.div>
          <motion.div variants={item}>
            <Button
              variant="secondary"
              size="lg"
              block
              onClick={() => {
                wake();
                navigate('/login');
              }}
            >
              Log in
            </Button>
          </motion.div>
          <motion.div variants={item}>
            <Button variant="ghost" block loading={busy} className={s.guest} onClick={playAsGuest}>
              {busy ? 'Entering…' : 'Continue as guest'}
            </Button>
          </motion.div>
        </motion.div>

        <motion.footer
          className={s.foot}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <nav className={s.links} aria-label="Information">
            <button type="button" className={s.link} onClick={link('/about')}>
              About
            </button>
            <span className={s.dot} aria-hidden>
              ·
            </span>
            <button type="button" className={s.link} onClick={link('/info')}>
              App info
            </button>
          </nav>
          <AuthorCredit variant="compact" className={s.credit} />
        </motion.footer>
      </div>
    </Screen>
  );
}
