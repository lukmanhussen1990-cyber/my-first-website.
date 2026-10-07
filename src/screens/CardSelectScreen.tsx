/*
 * Choose Your Card (reference screen 4). The four aces are dealt face-down from
 * the top of the table, then turned one by one. Tapping a card lifts it with a
 * crimson glow and opens that suit's trials.
 */
import { Crown, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { getRouter, navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { PlayingCard } from '../components/PlayingCard';
import { ProgressBar } from '../components/ui/Bits';
import { Screen } from '../components/ui/Screen';
import { TopBar } from '../components/ui/TopBar';
import { challengesForSuit } from '../data/challenges';
import { SUIT_ORDER, SUITS } from '../data/suits';
import type { SuitId } from '../data/types';
import { audio } from '../services/audio';
import { useProgress } from '../state/game';
import { formatNumber, suitProgress } from '../state/selectors';
import { useSettings } from '../state/settings';
import s from './CardSelectScreen.module.css';

const CAPTION: Record<SuitId, string> = {
  spade: 'Physical Challenges',
  heart: 'Psychological / Social',
  diamond: 'Logic & Intelligence',
  club: 'Team Strategy',
};

/* Deal choreography (seconds) — the whole ceremony settles in about 2.5 s */
const DEAL_START = 0.26;
const DEAL_STEP = 0.11;
const DEAL_DUR = 0.52;
const FLIP_GAP = 0.18;
const FIRST_FLIP = DEAL_START + DEAL_STEP * 3 + DEAL_DUR + 0.08;
const EASE = [0.16, 1, 0.3, 1] as const;

function suitMeta(suit: SuitId) {
  const list = challengesForSuit(suit);
  const diffs = list.map((c) => c.difficulty);
  return {
    minDiff: Math.min(...diffs),
    maxDiff: Math.max(...diffs),
    best: Math.max(...list.map((c) => c.rewardPoints)),
  };
}

export default function CardSelectScreen(_props: ScreenProps) {
  const progress = useProgress();
  const reduceMotion = useSettings((st) => st.reduceMotion);
  // Coming back from a suit (pop) or with reduced motion: no ceremony, cards are already on the table.
  const [instant] = useState(() => reduceMotion || getRouter().transition === 'pop');
  const [selected, setSelected] = useState<SuitId | null>(null);

  // Deal + reveal sound design.
  useEffect(() => {
    if (instant) return;
    const timers = SUIT_ORDER.map((_, i) =>
      window.setTimeout(() => audio.play('deal', { pitch: 1 + i * 0.04 }), (DEAL_START + i * DEAL_STEP) * 1000),
    );
    timers.push(window.setTimeout(() => audio.play('reveal'), (FIRST_FLIP + FLIP_GAP * 3 + 0.35) * 1000));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [instant]);

  // Navigate shortly after the selection glow lands.
  useEffect(() => {
    if (!selected) return;
    const t = window.setTimeout(() => navigate(`/cards/${selected}`), 300);
    return () => window.clearTimeout(t);
  }, [selected]);

  const cleared = SUIT_ORDER.reduce((n, id) => n + suitProgress(id, progress).cleared, 0);
  const total = SUIT_ORDER.reduce((n, id) => n + suitProgress(id, progress).total, 0);

  return (
    <Screen
      header={<TopBar title="Choose your card" subtitle="Four paths. One destiny." backTo="/home" />}
      contentClassName={s.content}
    >
      <div className={s.table} aria-hidden />
      <div className={s.center}>
        <div className={s.grid} role="list">
          {SUIT_ORDER.map((id, i) => {
            const suit = SUITS[id];
            const meta = suitMeta(id);
            const prog = suitProgress(id, progress);
            const col = i % 2;
            const row = Math.floor(i / 2);
            return (
              <motion.div
                key={id}
                role="listitem"
                className={s.slot}
                initial={
                  instant
                    ? false
                    : {
                        x: col === 0 ? '53.5%' : '-53.5%',
                        y: row === 0 ? '-108%' : '-214%',
                        rotate: col === 0 ? -9 + row * 4 : 9 - row * 4,
                        scale: 0.86,
                        opacity: 0,
                      }
                }
                animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
                transition={{
                  delay: DEAL_START + i * DEAL_STEP,
                  duration: DEAL_DUR,
                  ease: EASE,
                  opacity: { delay: DEAL_START + i * DEAL_STEP, duration: 0.18 },
                }}
                // the chosen card rises above its neighbours so its glow is never overlapped
                style={{ zIndex: selected === id ? 10 : 4 - i }}
              >
                {/* motion owns the slot's inline opacity, so the dim lives on an inner layer */}
                <div className={[s.dim, selected && selected !== id && s.dimmed].filter(Boolean).join(' ')}>
                  <PlayingCard
                    suit={id}
                    rank="A"
                    size="md"
                    revealDelay={instant ? undefined : (FIRST_FLIP + i * FLIP_GAP) * 1000}
                    title={suit.name}
                    caption={CAPTION[id]}
                    selected={selected === id}
                    label={`${suit.name}: ${suit.categoryLong}. ${prog.cleared} of ${prog.total} trials cleared, up to ${formatNumber(meta.best)} points`}
                    onClick={() => {
                      if (selected) return;
                      setSelected(id);
                    }}
                    footer={
                      <span className={s.strip}>
                        <span className={s.stripRow}>
                          <span className={s.diff}>
                            <Star className={s.star} fill="currentColor" strokeWidth={0} />
                            {meta.minDiff}–{meta.maxDiff}
                          </span>
                          <span className={s.count}>
                            <b>{prog.cleared}</b>/{prog.total}
                          </span>
                        </span>
                        <span className={s.bar}>
                          <span style={{ width: `${(prog.cleared / prog.total) * 100}%` }} />
                        </span>
                        <span className={s.reward}>
                          <Crown className={s.crown} fill="currentColor" strokeWidth={1.5} />
                          Up to {formatNumber(meta.best)} pts
                        </span>
                      </span>
                    }
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className={s.foot}
          initial={instant ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: instant ? 0 : FIRST_FLIP + FLIP_GAP * 3 + 0.5, duration: 0.5, ease: EASE }}
        >
          <div className={s.footRow}>
            <span className={s.footLabel}>Trials cleared</span>
            <span className={s.footValue}>
              <b>{cleared}</b> / {total}
            </span>
          </div>
          <ProgressBar value={total ? cleared / total : 0} tone="red" height={4} label="Trials cleared" />
          <p className={s.hint}>Tap a card. Five trials per suit, ranked 3 to King.</p>
        </motion.div>
      </div>
    </Screen>
  );
}
