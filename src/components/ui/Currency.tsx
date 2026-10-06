import { Crown, Gem } from 'lucide-react';
import { formatNumber } from '../../state/selectors';
import s from './Currency.module.css';

/** Survival points (crown, gold) and gems (crimson) — the dashboard header counters. */
export function Currency({ points, gems, className }: { points: number; gems: number; className?: string }) {
  return (
    <div className={[s.row, className].filter(Boolean).join(' ')}>
      <span className={s.item} aria-label={`${formatNumber(points)} survival points`}>
        <Crown size={17} className={s.crown} fill="currentColor" strokeWidth={1.5} />
        <b className="tabular">{formatNumber(points)}</b>
      </span>
      <span className={s.item} aria-label={`${formatNumber(gems)} gems`}>
        <Gem size={16} className={s.gem} fill="currentColor" strokeWidth={1.5} />
        <b className="tabular">{formatNumber(gems)}</b>
      </span>
    </div>
  );
}
