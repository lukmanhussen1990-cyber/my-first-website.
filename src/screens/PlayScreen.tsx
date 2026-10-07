/*
 * Trial runner — route /play/:id
 *
 * Owns the trial chrome around a mini-game: title bar, overall countdown,
 * intro (card flip + 3-2-1), pause menu, abandon confirm and the result
 * overlay. The game itself is loaded from the GAMES registry and receives
 * `paused`, `timeLeftMs` and `onFinish` (see src/games/types.ts).
 *
 * A restart re-keys <TrialRun>, so the timer, the game and every guard start
 * from scratch.
 */
import { AlertTriangle, Lock, Pause, SearchX } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { back } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { ART, SUIT_SCENE } from '../assets/art';
import { Button, IconButton } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { TopBar } from '../components/ui/TopBar';
import { getChallenge } from '../data/challenges';
import { SUITS } from '../data/suits';
import { ZONES } from '../data/zones';
import type { Challenge, GameResult, RewardSummary } from '../data/types';
import { GAMES } from '../games';
import { useCountdown, useLatest, useReduceMotion } from '../games/play/hooks';
import { TrialIntro } from '../games/play/TrialIntro';
import { TrialPause } from '../games/play/TrialPause';
import { TrialResult } from '../games/play/TrialResult';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useGame, useProgress } from '../state/game';
import { challengeStatus, formatClock, levelInfo } from '../state/selectors';
import s from './PlayScreen.module.css';

type Phase = 'intro' | 'playing' | 'result';

const ABANDONED: GameResult = { outcome: 'loss', score: 0, summary: 'Abandoned', abandoned: true };
const EXPIRED: GameResult = { outcome: 'loss', score: 0, summary: 'Time expired' };

export default function PlayScreen({ params }: ScreenProps) {
  const progress = useProgress();
  const challenge = getChallenge(params.id);
  const [run, setRun] = useState(0);
  // Evaluated once on entry so clearing the trial here never flips the view.
  const [locked] = useState(
    () => !!challenge && !challenge.practice && challengeStatus(challenge, progress) === 'locked',
  );

  if (!challenge) return <Blocked kind="missing" />;
  if (locked) return <Blocked kind="locked" challenge={challenge} />;
  return <TrialRun key={run} challenge={challenge} onRestart={() => setRun((n) => n + 1)} />;
}

/* ── One run of a trial ───────────────────────────────────────── */

interface RunProps {
  challenge: Challenge;
  /** remount a fresh run: new game key, full timer, intro again */
  onRestart: () => void;
}

function TrialRun({ challenge, onRestart }: RunProps) {
  const Game = GAMES[challenge.game.type];
  const suit = SUITS[challenge.suit];
  const limitMs = challenge.timeLimitSec * 1000;

  const [phase, setPhase] = useState<Phase>('intro');
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [outcome, setOutcome] = useState<{ result: GameResult; summary: RewardSummary | null } | null>(null);
  const settled = useRef(false);
  const phaseRef = useLatest(phase);
  const outcomeRef = useLatest(outcome);
  const reduce = useReduceMotion();

  const running = phase === 'playing' && !menu && !confirm;

  /** Persist a result — at most once per run (StrictMode / double-call safe). */
  const record = useCallback(
    (result: GameResult): RewardSummary | null => {
      if (settled.current) return null;
      settled.current = true;
      try {
        return useGame.getState().recordResult(challenge, result);
      } catch (err) {
        console.error('[border-trials] recordResult failed', err);
        return null;
      }
    },
    [challenge],
  );

  const finish = useCallback(
    (result: GameResult) => {
      if (settled.current) return;
      const summary = record(result);
      const win = result.outcome === 'win';
      audio.play(win ? 'success' : 'fail');
      haptic(win ? 'success' : 'error');
      setOutcome({ result, summary });
      setMenu(false);
      setConfirm(false);
      setPhase('result');
    },
    [record],
  );

  const timeLeft = useCountdown(limitMs, running, () => finish(EXPIRED), 250);
  const secLeft = Math.ceil(timeLeft / 1000);
  const critical = phase === 'playing' && secLeft <= 10;

  /* pressure: a tick every second under 10 s, one alarm at 5 s */
  const alarmed = useRef(false);
  useEffect(() => {
    if (phaseRef.current !== 'playing' || secLeft > 10 || secLeft <= 0) return;
    audio.play('tick', { pitch: secLeft <= 5 ? 1.15 : 1 });
    if (secLeft <= 5 && !alarmed.current) {
      alarmed.current = true;
      audio.play('alarm');
      haptic('warning');
    }
  }, [secLeft, phaseRef]);

  /* ambience follows the phase */
  useEffect(() => {
    if (phase !== 'playing') return;
    audio.startAmbience('tension');
    return () => audio.startAmbience('city');
  }, [phase]);

  /* backgrounding the app opens the pause menu (unless the abandon sheet already holds the clock) */
  const confirmRef = useLatest(confirm);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phaseRef.current === 'playing' && !confirmRef.current) setMenu(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phaseRef, confirmRef]);

  /*
   * Leaving mid-trial by any other route (system back, deep link) is abandoning.
   * The check is deferred so an effect re-run (StrictMode, Fast Refresh) that
   * immediately re-mounts is not mistaken for leaving.
   */
  const alive = useRef(false);
  const leftMidTrial = useCallback(() => !alive.current && phaseRef.current === 'playing', [phaseRef]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.setTimeout(() => {
        if (leftMidTrial()) record(ABANDONED);
      }, 0);
    };
  }, [leftMidTrial, record]);

  /* hold the frozen final board for a beat before the result overlay */
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (phase !== 'result') return;
    const id = window.setTimeout(() => {
      setReveal(true);
      if (outcomeRef.current?.result.outcome === 'loss') audio.play('glitch');
    }, reduce ? 250 : 900);
    return () => window.clearTimeout(id);
  }, [phase, reduce, outcomeRef]);

  const startPlaying = useCallback(() => {
    setPhase('playing');
    // the intro timeline keeps running in a background tab — never start the clock unseen
    if (document.hidden) setMenu(true);
  }, []);
  const resume = useCallback(() => setMenu(false), []);
  const closeConfirm = useCallback(() => setConfirm(false), []);

  const onBack = () => {
    if (phase === 'playing') setConfirm(true);
    else back('/home');
  };

  /* keyboard / screen-reader focus lands on the safe choice when the abandon sheet opens */
  const confirmBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirm) return;
    const id = window.setTimeout(() => {
      confirmBox.current?.querySelector<HTMLButtonElement>('button:last-of-type')?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [confirm]);

  const abandon = () => {
    record(ABANDONED);
    setConfirm(false);
    back('/home');
  };

  const restart = () => {
    settled.current = true; // restarting from the pause menu is not a result
    onRestart();
  };

  const clock = formatClock(timeLeft / 1000);

  const header = (
    <>
      <TopBar
        title={
          <>
            <span className={s.suitWord}>{suit.name}</span> {challenge.practice ? 'Practice' : 'Trial'}
          </>
        }
        onBack={onBack}
        right={
          <IconButton label="Pause" onClick={() => setMenu(true)} disabled={phase !== 'playing'} className={s.pauseBtn}>
            <Pause size={21} strokeWidth={2.2} fill="currentColor" />
          </IconButton>
        }
      />
      <div className={[s.hud, critical && s.critical].filter(Boolean).join(' ')}>
        <span className={s.hudLabel}>Time left</span>
        <span className={s.clock} role="timer" aria-label={`Time left ${clock}`}>
          {clock}
        </span>
        <span className={s.line} aria-hidden>
          <i style={{ transform: `scaleX(${Math.max(0, timeLeft / limitMs)})` }} />
        </span>
      </div>
    </>
  );

  return (
    <div className={s.root}>
      {/* everything behind an overlay is inert, so focus can't wander under a dialog */}
      <div className={s.stage} inert={phase !== 'playing' || menu || confirm}>
        <Screen bg={SUIT_SCENE[challenge.suit]} shade="heavy" header={header} contentClassName={s.body}>
          {!reveal && (
            <Suspense fallback={<GameLoading />}>
              <div className={s.game} inert={!running}>
                <Game challenge={challenge} paused={!running} timeLeftMs={timeLeft} onFinish={finish} />
              </div>
            </Suspense>
          )}
        </Screen>
      </div>

      <div className={[s.vignette, critical && running && s.vignetteOn].filter(Boolean).join(' ')} aria-hidden />

      <AnimatePresence>
        {phase === 'intro' && (
          <TrialIntro key="intro" challenge={challenge} onDone={startPlaying} onLeave={() => back('/home')} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menu && phase === 'playing' && (
          <TrialPause
            key="pause"
            challenge={challenge}
            timeLeftMs={timeLeft}
            onResume={resume}
            onRestart={restart}
            onQuit={() => {
              setMenu(false);
              setConfirm(true);
            }}
          />
        )}
      </AnimatePresence>

      {reveal && outcome && (
        <TrialResult
          challenge={challenge}
          result={outcome.result}
          summary={outcome.summary}
          onContinue={() => back('/home')}
          onRetry={onRestart}
        />
      )}

      <Sheet open={confirm} onClose={closeConfirm} label="Abandon trial">
        <div className={s.confirm} ref={confirmBox}>
          <span className={s.confirmIcon} aria-hidden>
            <AlertTriangle size={24} strokeWidth={2} />
          </span>
          <h2 className={s.confirmTitle}>Abandon trial?</h2>
          <p className={s.confirmBody}>
            {challenge.practice
              ? 'This practice run ends now and counts as a loss.'
              : 'Walking away counts as elimination. Your survival streak resets and no points are awarded.'}
          </p>
          <div className={s.confirmActions}>
            <Button block variant="danger" size="lg" onClick={abandon} sfx="fail">
              Abandon
            </Button>
            <Button block variant="secondary" onClick={closeConfirm}>
              Keep playing
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function GameLoading() {
  return (
    <div className={s.loading} role="status">
      <span className={s.spinner} aria-hidden />
      <span>Loading trial</span>
    </div>
  );
}

/* ── Missing / locked ─────────────────────────────────────────── */

function Blocked({ kind, challenge }: { kind: 'missing' | 'locked'; challenge?: Challenge }) {
  const progress = useProgress();
  const level = levelInfo(progress.xp).level;
  const zone = challenge ? ZONES.find((z) => z.id === challenge.zoneId) : undefined;
  const hiddenZone = !!zone?.hidden && !progress.revealedZones.includes(zone.id);

  let heading = 'Trial not found';
  let body = 'This trial does not exist — or the Dealer has erased it. Head back and choose another card.';
  if (kind === 'locked' && challenge) {
    heading = 'Trial locked';
    body =
      level < challenge.unlockLevel
        ? `${challenge.title} opens at level ${challenge.unlockLevel}. Survive easier trials to rise.`
        : hiddenZone
          ? `${challenge.title} is staged in a hidden zone. Scan the Border Map to reveal it first.`
          : `${challenge.title} is not open to you yet.`;
  }

  return (
    <Screen
      bg={challenge ? SUIT_SCENE[challenge.suit] : ART.welcomeCity}
      shade="heavy"
      header={<TopBar title={kind === 'locked' ? 'Locked' : 'Not found'} backTo="/home" />}
      contentClassName={s.blockedBody}
    >
      <div className={['glass', s.blocked].join(' ')}>
        <span className={s.blockedIcon} aria-hidden>
          {kind === 'locked' ? <Lock size={26} strokeWidth={2} /> : <SearchX size={26} strokeWidth={2} />}
        </span>
        <p className={s.blockedKicker}>{kind === 'locked' ? 'Access denied' : 'Signal lost · 404'}</p>
        <h2 className={s.blockedTitle}>{heading}</h2>
        <p className={s.blockedText}>{body}</p>
        {kind === 'locked' && challenge && level < challenge.unlockLevel && (
          <p className={s.blockedReq}>
            <span>Level {level}</span>
            <i aria-hidden />
            <b>Level {challenge.unlockLevel} required</b>
          </p>
        )}
        <Button block variant="secondary" onClick={() => back('/home')}>
          Go back
        </Button>
      </div>
    </Screen>
  );
}
