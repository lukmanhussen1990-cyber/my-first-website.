import { Crown } from 'lucide-react';
import { motion } from 'motion/react';
import type { Ref } from 'react';
import { getAchievement } from '../../data/achievements';
import type { LeaderboardEntry } from '../../data/types';
import { formatNumber } from '../../state/selectors';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import s from './LeaderRow.module.css';

const MEDAL = ['gold', 'silver', 'bronze'] as const;

interface Props {
  entry: LeaderboardEntry;
  rank: number;
  /** what the right column shows */
  metric: 'points' | 'wins';
  /** position in the list, drives the entrance stagger */
  index?: number;
  animate?: boolean;
  /** detached "your position" bar pinned above the tab bar */
  pinned?: boolean;
  className?: string;
  ref?: Ref<HTMLLIElement>;
}

function RankMark({ rank, pinned }: { rank: number; pinned?: boolean }) {
  if (rank <= 3 && !pinned) {
    const medal = MEDAL[rank - 1];
    return (
      <span className={[s.rank, s.crown, s[`crown_${medal}`]].join(' ')}>
        <Crown size={rank === 1 ? 22 : 20} strokeWidth={1.6} fill="currentColor" fillOpacity={0.9} aria-hidden />
        <span className="sr-only">Rank {rank}</span>
      </span>
    );
  }
  const label = rank > 9999 ? `${Math.round(rank / 1000)}k` : formatNumber(rank);
  return (
    <span className={[s.rank, pinned && s.rankPinned].filter(Boolean).join(' ')}>
      <span className="sr-only">Rank </span>
      {pinned ? `#${label}` : label}
    </span>
  );
}

export function LeaderRow({ entry, rank, metric, index = 0, animate = true, pinned, className, ref }: Props) {
  const medal = rank <= 3 ? MEDAL[rank - 1] : null;
  const ring = entry.isYou ? 'red' : medal && !pinned ? medal : 'none';
  const badges = entry.badges
    .map((id) => getAchievement(id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .slice(0, 3);
  const value = metric === 'wins' ? entry.wins : entry.points;

  const cls = [s.row, medal && !pinned && s[`podium_${medal}`], entry.isYou && s.you, pinned && s.pinned, className]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <RankMark rank={rank} pinned={pinned} />
      <Avatar id={entry.avatarId} size={40} ring={ring} alt="" />
      <span className={s.who}>
        <span className={s.name}>
          <span className={s.nameText}>{entry.isYou ? 'You' : entry.name}</span>
          {entry.online && !entry.isYou && (
            <>
              <i className={s.dot} aria-hidden />
              <span className="sr-only">, online</span>
            </>
          )}
        </span>
        <span className={s.meta}>
          <span className={s.level}>LV {entry.level}</span>
          {badges.length > 0 && (
            <span className={s.badges}>
              {badges.map((a) => (
                <Badge key={a.id} tier={a.tier} icon={a.icon} size={18} title={a.name} />
              ))}
            </span>
          )}
        </span>
      </span>
      <span className={s.score}>
        <b className="tabular">{formatNumber(value)}</b>
        <small>{metric === 'wins' ? (value === 1 ? 'win' : 'wins') : 'pts'}</small>
      </span>
    </>
  );

  if (pinned) return <div className={cls}>{inner}</div>;

  return (
    <motion.li
      ref={ref}
      className={cls}
      aria-current={entry.isYou ? 'true' : undefined}
      initial={animate ? { opacity: 0, x: -14 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.38, delay: animate ? Math.min(index, 11) * 0.035 : 0, ease: [0.16, 1, 0.3, 1] }}
    >
      {inner}
    </motion.li>
  );
}
