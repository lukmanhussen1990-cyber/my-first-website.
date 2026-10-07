import { LogOut, Pause, Play, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { SuitIcon } from '../../components/ui/SuitIcon';
import type { Challenge } from '../../data/types';
import { formatClock } from '../../state/selectors';
import { useReduceMotion } from './hooks';
import { rankName } from './format';
import s from './TrialPause.module.css';

interface Props {
  challenge: Challenge;
  timeLeftMs: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** Pause menu: the clock is frozen until RESUME. */
export function TrialPause({ challenge, timeLeftMs, onResume, onRestart, onQuit }: Props) {
  const reduce = useReduceMotion();
  const resumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resumeRef.current?.querySelector('button')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onResume();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onResume]);

  return (
    <motion.div
      className={s.root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.22 }}
    >
      <motion.div
        className={['glass', s.panel].join(' ')}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        <span className={s.cornerTl} aria-hidden />
        <span className={s.cornerBr} aria-hidden />
        <div className={s.icon} aria-hidden>
          <Pause size={22} strokeWidth={2.2} fill="currentColor" />
        </div>
        <p className={s.kicker}>Trial suspended</p>
        <h2 id="pause-title" className={s.title}>
          Paused
        </h2>
        <p className={s.trial}>
          <SuitIcon suit={challenge.suit} size={12} />
          <span>{challenge.practice ? challenge.title : `${rankName(challenge.rank)} · ${challenge.title}`}</span>
        </p>
        <div className={s.clock}>
          <span>Time left</span>
          <b className="tabular">{formatClock(timeLeftMs / 1000)}</b>
        </div>
        <div className={s.actions} ref={resumeRef}>
          <Button block size="lg" icon={<Play size={18} fill="currentColor" />} onClick={onResume}>
            Resume
          </Button>
          <Button block variant="secondary" icon={<RotateCcw size={17} />} onClick={onRestart} sfx="whoosh">
            Restart
          </Button>
          <Button block variant="ghost" icon={<LogOut size={16} />} onClick={onQuit} className={s.quit}>
            Quit trial
          </Button>
        </div>
        <p className={s.note}>The clock is frozen while paused.</p>
      </motion.div>
    </motion.div>
  );
}
