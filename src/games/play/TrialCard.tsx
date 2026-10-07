import type { CSSProperties } from 'react';
import { SuitIcon } from '../../components/ui/SuitIcon';
import type { CardRank, SuitId } from '../../data/types';
import s from './TrialCard.module.css';

const RED: Record<SuitId, boolean> = { heart: true, diamond: true, spade: false, club: false };

interface Props {
  suit: SuitId;
  rank: CardRank;
  /** card width in px (height is 1.5×) */
  width?: number;
  className?: string;
  /** render the face dimmed (eliminated) */
  dim?: boolean;
}

/** A playing card face: corner indices, chrome / ruby suit emblem, inner frame. */
export function TrialCardFace({ suit, rank, width = 150, className, dim }: Props) {
  const red = RED[suit];
  return (
    <div
      className={[s.card, s.face, red ? s.red : s.silver, dim && s.dim, className].filter(Boolean).join(' ')}
      style={{ width, height: width * 1.5, '--u': String(width / 150) } as CSSProperties}
      aria-hidden
    >
      <span className={s.frame} />
      <span className={s.halo} />
      <span className={[s.index, s.tl].join(' ')}>
        <b>{rank}</b>
        <SuitIcon suit={suit} size="1em" className={s.pip} />
      </span>
      <span className={[s.index, s.br].join(' ')}>
        <b>{rank}</b>
        <SuitIcon suit={suit} size="1em" className={s.pip} />
      </span>
      <SuitIcon suit={suit} finish={red ? 'ruby' : 'chrome'} size="46%" className={s.emblem} />
      <span className={s.sheen} />
    </div>
  );
}

/** The card back: crimson lattice with a centred emblem ring. */
export function TrialCardBack({ width = 150, className }: { width?: number; className?: string }) {
  return (
    <div className={[s.card, s.back, className].filter(Boolean).join(' ')} style={{ width, height: width * 1.5, '--u': String(width / 150) } as CSSProperties} aria-hidden>
      <span className={s.backFrame} />
      <span className={s.backRing}>
        <span>BT</span>
      </span>
    </div>
  );
}
