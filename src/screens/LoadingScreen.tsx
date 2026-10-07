/*
 * Cold-start splash (reference screen 1).
 *
 * Real work happens here: key art, fonts, every screen chunk and every game
 * chunk are warmed while the player watches the key art. Progress shown is
 * honest (completed / total) but eased and never faster than MIN_MS so the
 * splash always plays as a cinematic beat. When everything is loaded and the
 * session is known, the screen glitches out and hands over to finishBoot().
 */
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { finishBoot } from '../app/boot';
import { useRouter } from '../app/router';
import { preloadAllScreens, type ScreenProps } from '../app/screens';
import { ART, PRELOAD } from '../assets/art';
import { APP_VERSION, AuthorCredit } from '../components/AuthorCredit';
import { Embers } from '../components/fx/Embers';
import { Rain } from '../components/fx/Rain';
import { GlitchText } from '../components/ui/GlitchText';
import { Logo } from '../components/ui/Logo';
import { Screen } from '../components/ui/Screen';
import { preloadGames } from '../games';
import { audio } from '../services/audio';
import { useSession } from '../state/session';
import { useSettings } from '../state/settings';
import s from './LoadingScreen.module.css';

const MIN_MS = 2800;
const TASK_TIMEOUT_MS = 8000;
const LINE_MS = 950;
const OUT_MS = 620;
/** after the bar fills, how long to wait on a session restore that never settles */
const BOOT_GRACE_MS = 6000;
const LINES = ['Another game begins', 'Synchronising signal', 'Loading the city', 'Dealing the cards'];

/** Resolve after `task` settles or after `ms` — a slow or failed asset never blocks boot. */
function settle(task: () => Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = window.setTimeout(resolve, ms);
    const done = () => {
      window.clearTimeout(t);
      resolve();
    };
    try {
      task().then(done, done);
    } catch {
      done();
    }
  });
}

function warmImage(src: string): Promise<void> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode();
}

const TASKS: Array<() => Promise<unknown>> = [
  ...PRELOAD.map((src) => () => warmImage(src)),
  () => document.fonts?.ready ?? Promise.resolve(),
  () => preloadAllScreens(),
  () => preloadGames(),
];

export default function LoadingScreen(_props: ScreenProps) {
  const status = useSession((st) => st.status);
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const { route, seq } = useRouter();

  const [run, setRun] = useState(0);
  const [pct, setPct] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [out, setOut] = useState(false);
  const [line, setLine] = useState(0);
  const [stalled, setStalled] = useState(false);

  const fillRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const handedOff = useRef(false);
  const exitTimer = useRef<number | undefined>(undefined);

  /* Preload everything and drive the bar (DOM transforms per frame, React state per whole percent). */
  useEffect(() => {
    let alive = true;
    let completed = 0;
    for (const task of TASKS) {
      void settle(task, TASK_TIMEOUT_MS).then(() => {
        completed += 1;
      });
    }

    const t0 = performance.now();
    let last = t0;
    let shown = 0;
    let raf = 0;
    const tick = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
      last = now;
      // rAF timestamps can precede t0 (frame start vs. effect time): clamp at 0
      const target = Math.max(0, Math.min(completed / TASKS.length, (now - t0) / MIN_MS));
      shown += (target - shown) * (1 - Math.exp(-dt * 5.5));
      if (target >= 1 && shown > 0.996) shown = 1;
      fillRef.current?.style.setProperty('transform', `scaleX(${shown})`);
      headRef.current?.style.setProperty('transform', `translate3d(${shown * 100}%, 0, 0)`);
      setPct(Math.floor(shown * 100));
      if (shown >= 1) {
        setLoaded(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [run]);

  /* Re-entered while still on screen (e.g. navigated back to '/' during the exit
   * animation, so the same instance is revived): reset and play again. */
  useEffect(() => {
    if (route.name !== 'loading' || !handedOff.current) return;
    window.clearTimeout(exitTimer.current);
    handedOff.current = false;
    fillRef.current?.style.setProperty('transform', 'scaleX(0)');
    headRef.current?.style.setProperty('transform', 'translate3d(0, 0, 0)');
    setOut(false);
    setLoaded(false);
    setStalled(false);
    setPct(0);
    setLine(0);
    setRun((r) => r + 1);
  }, [route.name, seq]);

  /* Cycle the lore status line with a glitch swap until the hand-off (it keeps
   * going at 100% while the session is still being restored). */
  useEffect(() => {
    if (out) return;
    const id = window.setInterval(() => setLine((i) => (i + 1) % LINES.length), LINE_MS);
    return () => window.clearInterval(id);
  }, [out]);

  /* Session restore normally settles long before the bar fills. If it never
   * does (storage blocked, IndexedDB failure) don't strand the player on the
   * splash: hand off as signed out; the shell's guard still redirects home if
   * the session turns up later. */
  useEffect(() => {
    if (!loaded || status !== 'booting') return;
    const id = window.setTimeout(() => setStalled(true), BOOT_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [loaded, status]);

  /* Release the hand-off timer only on a real unmount. */
  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  /* 100% and the session is known → glitch out, then finishBoot exactly once. */
  useEffect(() => {
    if (!loaded || (status === 'booting' && !stalled) || handedOff.current) return;
    handedOff.current = true;
    setOut(true);
    audio.play('glitch');
    exitTimer.current = window.setTimeout(
      () => {
        const st = useSession.getState().status;
        finishBoot(st === 'user' || st === 'guest');
      },
      reduceMotion ? 180 : OUT_MS,
    );
  }, [loaded, status, stalled, reduceMotion]);

  // the hand-off always lands on the title line (derived, so a late interval tick can't race it)
  const text = out ? LINES[0] : LINES[line];

  return (
    <Screen
      bg={ART.loadingHero}
      shade="cinematic"
      scroll={false}
      className={[s.root, out && s.out].filter(Boolean).join(' ')}
    >
      <Rain intensity={0.55} angle={9} />
      <Embers count={11} rise={0.55} seed={3} />

      <div className={s.stage}>
        <div className={s.growTop} />

        <div className={s.brand}>
          <motion.div
            className={s.logoWrap}
            initial={{ opacity: 0, y: 10 }}
            animate={
              reduceMotion
                ? { opacity: 1, y: 0 }
                : { opacity: [0, 1, 0.15, 1, 0.55, 1], y: 0, x: [0, -7, 5, -2, 1, 0] }
            }
            transition={{ duration: 0.75, delay: 0.35, ease: 'easeOut', times: [0, 0.18, 0.3, 0.46, 0.62, 1] }}
          >
            <Logo size="xl" tagline={false} />
            <div className={s.ghosts} aria-hidden>
              <Logo size="xl" tagline={false} glitch={false} className={s.ghostR} />
              <Logo size="xl" tagline={false} glitch={false} className={s.ghostC} />
            </div>
          </motion.div>

          <motion.p
            className={s.tagline}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <span>Survive</span>
            <i aria-hidden>·</i>
            <span>Solve</span>
            <i aria-hidden>·</i>
            <span>Escape</span>
          </motion.p>
        </div>

        <motion.div
          className={s.meter}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className={s.pct}>
            {pct}
            <small>%</small>
          </span>
          <div
            className={s.track}
            role="progressbar"
            aria-label="Loading Border Trials"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div ref={fillRef} className={s.fill} />
            <div ref={headRef} className={s.headLane}>
              <span className={s.head} />
            </div>
          </div>
          <p className={s.status} aria-hidden>
            <motion.span
              key={text}
              className={s.statusText}
              initial={{ opacity: 0.2 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <GlitchText text={text.toUpperCase()} every={0} trigger={text} />
            </motion.span>
          </p>
        </motion.div>

        <div className={s.growBottom} />

        <motion.footer
          className={s.foot}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <AuthorCredit variant="compact" className={s.credit} />
          <span className={s.version}>v{APP_VERSION}</span>
        </motion.footer>
      </div>

      <div className={s.fx} aria-hidden>
        <span className={s.flashWhite} />
        <span className={s.flashRed} />
        <span className={s.slices}>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className={s.blackout} />
      </div>
    </Screen>
  );
}
