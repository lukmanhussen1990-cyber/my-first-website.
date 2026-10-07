import { ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stars } from '../../components/ui/Bits';
import { IconButton } from '../../components/ui/Button';
import { GlitchText } from '../../components/ui/GlitchText';
import { SuitIcon } from '../../components/ui/SuitIcon';
import { SUITS } from '../../data/suits';
import type { Challenge } from '../../data/types';
import { audio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { rankName } from './format';
import { useLatest, useReduceMotion } from './hooks';
import { TrialCardBack, TrialCardFace } from './TrialCard';
import s from './TrialIntro.module.css';

type Step = 'reveal' | 3 | 2 | 1 | 'go';

const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  challenge: Challenge;
  /** called once when the countdown completes or the player skips */
  onDone: () => void;
  /** leave before the trial starts (nothing is recorded) */
  onLeave: () => void;
}

/**
 * Trial intro: the challenge card flips in, the briefing line types in, then
 * a 3-2-1 glitch countdown. Tap anywhere to skip.
 */
export function TrialIntro({ challenge, onDone, onLeave }: Props) {
  const reduce = useReduceMotion();
  const [step, setStep] = useState<Step>('reveal');
  const done = useLatest(onDone);
  const finished = useRef(false);
  const suit = SUITS[challenge.suit];

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    done.current();
  }, [done]);

  useEffect(() => {
    const count = (n: 3 | 2 | 1) => () => {
      setStep(n);
      audio.play('countdown', { pitch: n === 1 ? 1.12 : 1 });
      haptic('light');
    };
    const seq: [number, () => void][] = [
      [60, () => audio.play('deal')],
      [reduce ? 80 : 420, () => audio.play('flip')],
      [1750, count(3)],
      [2500, count(2)],
      [3250, count(1)],
      [
        4000,
        () => {
          setStep('go');
          audio.play('go');
          haptic('medium');
        },
      ],
      [4500, finish],
    ];
    const ids = seq.map(([ms, fn]) => window.setTimeout(fn, ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [finish, reduce]);

  const skip = () => {
    if (finished.current) return;
    if (step !== 'go') audio.play('go');
    haptic('medium');
    finish();
  };

  const counting = step !== 'reveal';

  return (
    <motion.div
      className={s.root}
      role="dialog"
      aria-modal="true"
      aria-label={`${challenge.title} — starting`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.35 } }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      onClick={skip}
    >
      <div className={s.scan} aria-hidden />

      <div className={s.leave}>
        <IconButton
          label="Leave trial"
          sfx="back"
          onClick={(e) => {
            e.stopPropagation();
            finished.current = true;
            onLeave();
          }}
        >
          <ChevronLeft size={26} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div className={s.inner}>
        <motion.p
          className={s.kicker}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.15, ease: EASE }}
        >
          <SuitIcon suit={challenge.suit} size={12} />
          {challenge.practice ? 'Practice run' : suit.categoryLong}
        </motion.p>

        <div className={s.stage}>
          <motion.div
            className={s.flipper}
            initial={reduce ? false : { rotateY: 180, y: 46, scale: 0.78, opacity: 0 }}
            animate={{ rotateY: 0, y: 0, scale: counting ? 0.86 : 1, opacity: 1 }}
            transition={{
              rotateY: { duration: 0.95, delay: 0.25, ease: EASE },
              y: { duration: 0.7, ease: EASE },
              opacity: { duration: 0.3 },
              scale: { duration: 0.6, ease: EASE },
            }}
          >
            <TrialCardFace suit={challenge.suit} rank={challenge.rank} width={132} className={s.front} />
            <TrialCardBack width={132} className={s.back} />
          </motion.div>
          <span className={s.floor} aria-hidden />
        </div>

        <motion.div
          className={s.meta}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.85, ease: EASE }}
        >
          <p className={s.rank}>{challenge.practice ? `${suit.name} · Practice` : `${rankName(challenge.rank)} of ${suit.name}s`}</p>
          <h2 className={s.title}>{challenge.title}</h2>
          <p className={s.hook}>{challenge.hook}</p>
          <Stars value={challenge.difficulty} size={13} className={s.stars} />
        </motion.div>

        <div className={s.count} aria-live="assertive">
          <AnimatePresence mode="popLayout" initial={false}>
            {counting ? (
              <motion.div
                key={String(step)}
                className={[s.numeral, step === 'go' && s.go].filter(Boolean).join(' ')}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={{ duration: reduce ? 0 : 0.32, ease: EASE }}
              >
                <GlitchText text={step === 'go' ? 'GO' : String(step)} every={0} trigger={step} />
              </motion.div>
            ) : (
              <motion.p
                key="ready"
                className={s.ready}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
                transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : 1.1 }}
              >
                <span />
                Get ready
                <span />
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <button
        type="button"
        className={s.skip}
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
      >
        Tap to skip
      </button>
    </motion.div>
  );
}
