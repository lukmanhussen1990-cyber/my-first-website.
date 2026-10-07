import type { CardRank, SuitId } from '../../data/types';
import { SUITS } from '../../data/suits';
import { SuitIcon } from '../ui/SuitIcon';
import s from './RankChip.module.css';

interface Props {
  suit: SuitId;
  rank: CardRank;
  /** card: a tiny playing card (list rows) · inline: a compact "6 ♦" badge */
  variant?: 'card' | 'inline';
  state?: 'normal' | 'locked' | 'cleared';
  className?: string;
}

/** Miniature rank + suit marker, e.g. the "6♦" on mission rows and trial lists. */
export function RankChip({ suit, rank, variant = 'card', state = 'normal', className }: Props) {
  const red = SUITS[suit].tone === 'red';
  return (
    <span
      className={[s.chip, s[variant], red ? s.red : s.silver, state !== 'normal' && s[state], className]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${rank} of ${SUITS[suit].name}s`}
      role="img"
    >
      <b className={s.rank}>{rank}</b>
      <SuitIcon
        suit={suit}
        finish={variant === 'card' && state === 'normal' ? (red ? 'ruby' : 'chrome') : 'solid'}
        className={s.pip}
        size="100%"
      />
    </span>
  );
}
