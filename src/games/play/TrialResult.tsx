import { ChevronsUp, Crown, Gem, RotateCcw, Star, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pill } from '../../components/ui/Bits';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { GlitchText } from '../../components/ui/GlitchText';
import { SuitIcon } from '../../components/ui/SuitIcon';
import { getAchievement } from '../../data/achievements';
import { SUITS } from '../../data/suits';
import type { Achievement, Challenge, GameResult, RewardSummary } from '../../data/types';
import { audio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { formatNumber } from '../../state/selectors';
import { useCountUp, useReduceMotion } from './hooks';
import { rankName } from './format';
import s from './TrialResult.module.css';

interface Props {
  challenge: Challenge;
  result: GameResult;
  summary: RewardSummary | null;
  onContinue: () => void;
  onRetry: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/* reveal timeline (ms after mount) */
const T_STARS = [520, 760, 1000];
const T_REWARDS = 1180;
const T_LEVEL = 2250;
const T_BADGES = 2550;

function Counter({ icon, value, label, tone, run, instant }: { icon: ReactNode; value: number; label: string; tone: 'gold' | 'red' | 'white'; run: boolean; instant: boolean }) {
  const shown = useCountUp(value, run, 1000, instant);
  return (
    <div className={[s.counter, value === 0 && s.counterZero].filter(Boolean).join(' ')}>
      <span className={[s.counterIcon, s[`tone_${tone}`]].join(' ')}>{icon}</span>
      <b className="tabular">+{formatNumber(shown)}</b>
      <small>{label}</small>
    </div>
  );
}

/** Full-screen trial result: SURVIVED / ELIMINATED, stars, rewards, unlocks. */
export function TrialResult({ challenge, result, summary, onContinue, onRetry }: Props) {
  const reduce = useReduceMotion();
  const win = result.outcome === 'win';
  const stars = summary?.stars ?? 0;
  const practice = !!challenge.practice;
  const [stage, setStage] = useState(reduce ? 99 : 0);
  const achievements = (summary?.newAchievements ?? []).map(getAchievement).filter((a): a is Achievement => !!a);
  const actionsRef = useRef<HTMLDivElement>(null);

  /* move focus into the dialog so keyboard and screen-reader users land on CONTINUE */
  useEffect(() => {
    actionsRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (reduce) return;
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => ids.push(window.setTimeout(fn, ms));
    T_STARS.forEach((ms, i) =>
      at(ms, () => {
        setStage(i + 1);
        if (i < stars) {
          audio.play('select', { pitch: 1 + i * 0.16 });
          haptic('light');
        }
      }),
    );
    at(T_REWARDS, () => setStage(4));
    at(T_LEVEL, () => {
      setStage(5);
      if (summary?.leveledUp) {
        audio.play('levelup');
        haptic('success');
      }
    });
    at(T_BADGES, () => {
      setStage(6);
      if (summary && summary.newAchievements.length > 0) audio.play('unlock');
    });
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [reduce, stars, summary]);

  const fade = (delay: number, y = 14) =>
    reduce
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay: delay / 1000, ease: EASE },
        };

  const suit = SUITS[challenge.suit];

  return (
    <motion.div
      className={[s.root, win ? s.win : s.loss].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.3 }}
    >
      <div className={s.glow} aria-hidden />
      <div className={s.scan} aria-hidden />
      {!reduce && <div className={s.flash} aria-hidden />}
      <SuitIcon suit={challenge.suit} finish="outline" size={340} className={s.ghostSuit} />

      <div className={s.scroll}>
        <motion.p className={s.kicker} {...fade(80, -8)}>
          <SuitIcon suit={challenge.suit} size={12} />
          <span>{practice ? challenge.title : `${rankName(challenge.rank)} of ${suit.name}s · ${challenge.title}`}</span>
        </motion.p>

        <motion.div
          className={s.headline}
          initial={reduce ? false : { opacity: 0, scale: 1.35 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
        >
          <span className={s.rule} aria-hidden />
          <h2 id="result-title" className={s.title}>
            {win ? 'Survived' : <GlitchText text="ELIMINATED" every={2600} trigger={1} />}
          </h2>
          <span className={s.rule} aria-hidden />
        </motion.div>

        <motion.p className={s.summary} {...fade(320)}>
          {result.summary}
        </motion.p>

        {(practice || summary?.firstClear) && (
          <motion.div className={s.pills} {...fade(400)}>
            {practice && <Pill>Practice — XP only</Pill>}
            {summary?.firstClear && <Pill tone="red">First clear</Pill>}
          </motion.div>
        )}

        <div className={s.stars} role="img" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => {
            const shown = stage > i;
            const earned = i < stars;
            return (
              <motion.span
                key={i}
                className={[s.star, i === 1 && s.starMid, earned ? s.starOn : s.starOff].filter(Boolean).join(' ')}
                initial={reduce ? false : { opacity: 0, scale: 0.2, rotate: -40 }}
                animate={shown ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.2, rotate: -40 }}
                transition={earned ? { type: 'spring', stiffness: 520, damping: 16 } : { duration: 0.3, ease: EASE }}
              >
                <Star size={i === 1 ? 58 : 44} strokeWidth={1.3} fill="currentColor" />
              </motion.span>
            );
          })}
        </div>

        <motion.div className={['glass', s.rewards].join(' ')} {...fade(T_REWARDS - 120)}>
          {!practice && (
            <Counter
              icon={<Crown size={18} fill="currentColor" strokeWidth={1.5} />}
              value={summary?.points ?? 0}
              label="Points"
              tone="gold"
              run={stage >= 4}
              instant={reduce}
            />
          )}
          <Counter
            icon={<Zap size={18} fill="currentColor" strokeWidth={1.5} />}
            value={summary?.xp ?? 0}
            label="XP"
            tone="white"
            run={stage >= 4}
            instant={reduce}
          />
          {!practice && (
            <Counter
              icon={<Gem size={17} fill="currentColor" strokeWidth={1.5} />}
              value={summary?.gems ?? 0}
              label="Gems"
              tone="red"
              run={stage >= 4}
              instant={reduce}
            />
          )}
        </motion.div>

        {summary?.leveledUp && stage >= 5 && (
          <motion.div
            className={s.levelUp}
            initial={reduce ? false : { opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          >
            <span className={s.levelIcon}>
              <ChevronsUp size={22} strokeWidth={2.4} />
            </span>
            <span className={s.levelText}>
              <b>Level up</b>
              <small>You reached level {summary.newLevel}</small>
            </span>
            <span className={s.levelNum}>{summary.newLevel}</span>
          </motion.div>
        )}

        {achievements.length > 0 && stage >= 6 && (
          <div className={s.badges}>
            <p className={s.badgesTitle}>New achievement{achievements.length > 1 ? 's' : ''}</p>
            {achievements.map((a, i) => (
              <motion.div
                key={a.id}
                className={['glass', s.badge].join(' ')}
                initial={reduce ? false : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: i * 0.12, ease: EASE }}
              >
                <Badge tier={a.tier} icon={a.icon} size={46} />
                <span>
                  <b>{a.name}</b>
                  <small>{a.description}</small>
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <motion.div className={s.actions} ref={actionsRef} {...fade(700, 20)}>
        <Button block size="lg" onClick={onContinue}>
          Continue
        </Button>
        <Button block variant="secondary" icon={<RotateCcw size={17} />} onClick={onRetry} sfx="whoosh">
          Retry
        </Button>
      </motion.div>
    </motion.div>
  );
}
