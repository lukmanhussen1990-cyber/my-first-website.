/*
 * ♦ Number Order — tap a tile, tap another to swap; restore 1…n in reading
 * order. The shuffle is seeded per challenge, and the optimal (minimum) swap
 * count is known, so the trial can demand a near-perfect solve.
 */
import { RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState, type CSSProperties } from 'react';
import { Button } from '../components/ui/Button';
import type { NumberOrderConfig } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useReduceMotion } from './play/hooks';
import { isSolved, minSwaps, placedCount, scramble } from './play/numberOrder';
import { clamp } from './play/rng';
import type { GameProps } from './types';
import s from './NumberOrderGame.module.css';

const FALLBACK: NumberOrderConfig = { size: 3, slackMoves: null, seed: 1 };

type Status = 'play' | 'solved' | 'failed';

export default function NumberOrderGame({ challenge, paused, timeLeftMs, onFinish }: GameProps) {
  const cfg = challenge.game.type === 'numberOrder' ? challenge.game.numberOrder : FALLBACK;
  const reduce = useReduceMotion();
  const initial = useMemo(() => scramble(cfg.size, cfg.seed), [cfg.size, cfg.seed]);
  const optimal = useMemo(() => minSwaps(initial), [initial]);
  const limit = cfg.slackMoves === null ? null : optimal + cfg.slackMoves;

  const [board, setBoard] = useState(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState<Status>('play');

  const movesLeft = limit === null ? null : Math.max(0, limit - moves);
  const locked = paused || status !== 'play';

  const end = (next: number[], m: number) => {
    if (isSolved(next)) {
      setStatus('solved');
      haptic('success');
      const extra = m - optimal;
      const base = Math.max(40, 100 - 8 * extra);
      const bonus = Math.round(8 * (timeLeftMs / (challenge.timeLimitSec * 1000)));
      onFinish({
        outcome: 'win',
        score: clamp(base + bonus, 0, 100),
        summary: extra === 0 ? `Perfect solve — ${m} moves` : `Solved in ${m} moves (optimal ${optimal})`,
        stats: { moves: m, optimal },
      });
    } else if (limit !== null && m >= limit) {
      setStatus('failed');
      audio.play('error');
      haptic('error');
      const placed = placedCount(next);
      onFinish({
        outcome: 'loss',
        score: Math.round((placed / next.length) * 35),
        summary: `Out of moves — ${placed} of ${next.length} in place`,
        stats: { moves: m, optimal },
      });
    }
  };

  const tap = (pos: number) => {
    if (locked) return;
    if (selected === null) {
      setSelected(pos);
      audio.play('select');
      haptic('light');
      return;
    }
    if (selected === pos) {
      setSelected(null);
      audio.play('tap', { volume: 0.6 });
      return;
    }
    const next = board.slice();
    [next[selected], next[pos]] = [next[pos], next[selected]];
    const m = moves + 1;
    setBoard(next);
    setMoves(m);
    setSelected(null);
    audio.play('flip');
    haptic('medium');
    end(next, m);
  };

  const reset = () => {
    if (locked) return;
    setBoard(initial);
    setMoves(0);
    setSelected(null);
  };

  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 560, damping: 38, mass: 0.9 };

  return (
    <div className={[s.root, s[status]].join(' ')}>
      <p className={s.instruction}>Arrange the numbers in the correct order.</p>

      <div className={s.stats} aria-live="polite">
        <span className={s.stat}>
          <small>Moves</small>
          <b className="tabular">{String(moves).padStart(2, '0')}</b>
        </span>
        {movesLeft !== null ? (
          <span className={[s.stat, movesLeft <= 2 && s.statWarn].filter(Boolean).join(' ')}>
            <small>Moves left</small>
            <b className="tabular">{String(movesLeft).padStart(2, '0')}</b>
          </span>
        ) : (
          <span className={s.stat}>
            <small>Optimal</small>
            <b className="tabular">{String(optimal).padStart(2, '0')}</b>
          </span>
        )}
      </div>

      <div
        className={[s.grid, cfg.size === 4 && s.grid4].filter(Boolean).join(' ')}
        style={{ '--n': cfg.size } as CSSProperties}
        role="group"
        aria-label={`Number grid, ${cfg.size} by ${cfg.size}`}
      >
        {board.map((value, pos) => {
          const inPlace = value === pos + 1;
          const isSel = selected === pos;
          return (
            <motion.button
              key={value}
              layout
              transition={spring}
              type="button"
              className={[s.tile, inPlace && s.inPlace, isSel && s.selected].filter(Boolean).join(' ')}
              style={{ '--i': pos } as CSSProperties}
              onClick={() => tap(pos)}
              aria-pressed={isSel}
              aria-label={`${value}${inPlace ? ', in place' : ''}`}
              disabled={status !== 'play'}
            >
              <span className={s.num}>{value}</span>
              {inPlace && <span className={s.marker} aria-hidden />}
            </motion.button>
          );
        })}
      </div>

      <Button
        variant="secondary"
        icon={<RotateCcw size={18} strokeWidth={2.2} />}
        onClick={reset}
        disabled={status !== 'play'}
        sfx="whoosh"
        className={s.reset}
      >
        Reset
      </Button>
    </div>
  );
}
