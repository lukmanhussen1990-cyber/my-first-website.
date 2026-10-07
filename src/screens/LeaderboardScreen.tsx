import { ChevronRight, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { LeaderRow } from '../components/meta/LeaderRow';
import { Badge } from '../components/ui/Badge';
import { Screen } from '../components/ui/Screen';
import { Tabs } from '../components/ui/Tabs';
import { TopBar } from '../components/ui/TopBar';
import { ACHIEVEMENTS } from '../data/achievements';
import { FRIENDS, GLOBAL_POPULATION, GLOBAL_TOP } from '../data/rivals';
import type { LeaderboardEntry, PlayerProgress } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useProgress } from '../state/game';
import { formatNumber, globalRank, levelInfo } from '../state/selectors';
import { useSettings } from '../state/settings';
import s from './LeaderboardScreen.module.css';

type Board = 'global' | 'friends' | 'top';

const TABS: { id: Board; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'friends', label: 'Friends' },
  { id: 'top', label: 'Top Players' },
];

interface Ranked {
  entry: LeaderboardEntry;
  rank: number;
}

interface BoardData {
  rows: Ranked[];
  /** the player's rank on this board */
  youRank: number;
  /** whether the player's row is part of `rows` */
  youInList: boolean;
  metric: 'points' | 'wins';
  caption: string;
}

/** Earned achievement ids, newest first. */
function earnedIds(p: PlayerProgress): string[] {
  return Object.entries(p.achievements)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

function youEntry(p: PlayerProgress): LeaderboardEntry {
  return {
    id: 'you',
    name: p.playerName,
    avatarId: p.avatarId,
    points: p.points,
    level: levelInfo(p.xp).level,
    wins: p.wins,
    badges: earnedIds(p),
    isYou: true,
  };
}

/** Insert the player at a 1-based rank inside `list` and number everybody. */
function mergeAt(list: LeaderboardEntry[], you: LeaderboardEntry, rank: number): Ranked[] {
  const merged = [...list.slice(0, rank - 1), you, ...list.slice(rank - 1)];
  return merged.map((entry, i) => ({ entry, rank: i + 1 }));
}

/** Rank by wins among the seeded top players, estimated below them. */
function winsRank(wins: number, byWins: LeaderboardEntry[]): number {
  const above = byWins.filter((r) => r.wins > wins).length;
  if (above < byWins.length) return above + 1;
  const floor = byWins[byWins.length - 1].wins;
  const frac = Math.max(0, 1 - wins / floor);
  return byWins.length + 1 + Math.round((GLOBAL_POPULATION - byWins.length - 1) * Math.pow(frac, 4));
}

/** Nearest scrolling ancestor (the Screen's content column). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === 'auto' || oy === 'scroll') return p;
    p = p.parentElement;
  }
  return null;
}

function buildBoard(board: Board, p: PlayerProgress): BoardData {
  const you = youEntry(p);
  if (board === 'friends') {
    const rows = [...FRIENDS, you]
      .sort((a, b) => b.points - a.points || Number(!!b.isYou) - Number(!!a.isYou))
      .map((entry, i) => ({ entry, rank: i + 1 }));
    const youRank = rows.find((r) => r.entry.isYou)!.rank;
    return { rows, youRank, youInList: true, metric: 'points', caption: `${FRIENDS.length} friends` };
  }
  if (board === 'top') {
    const byWins = [...GLOBAL_TOP].sort((a, b) => b.wins - a.wins);
    const youRank = winsRank(p.wins, byWins);
    const inList = youRank <= byWins.length;
    return {
      rows: inList ? mergeAt(byWins, you, youRank) : byWins.map((entry, i) => ({ entry, rank: i + 1 })),
      youRank,
      youInList: inList,
      metric: 'wins',
      caption: 'Trials survived',
    };
  }
  const youRank = globalRank(p.points);
  const inList = youRank <= GLOBAL_TOP.length;
  return {
    rows: inList ? mergeAt(GLOBAL_TOP, you, youRank) : GLOBAL_TOP.map((entry, i) => ({ entry, rank: i + 1 })),
    youRank,
    youInList: inList,
    metric: 'points',
    caption: `${formatNumber(GLOBAL_POPULATION)} survivors`,
  };
}

export default function LeaderboardScreen(_props: ScreenProps) {
  const progress = useProgress();
  const reduce = useSettings((st) => st.reduceMotion);
  const [board, setBoard] = useState<Board>('global');
  const data = useMemo(() => buildBoard(board, progress), [board, progress]);
  const you = data.rows.find((r) => r.entry.isYou)?.entry ?? youEntry(progress);

  // Pin "your position" above the tab bar whenever your own row is off screen.
  const youRef = useRef<HTMLLIElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  // starts "visible" so the pinned bar doesn't flash before the first observation
  const [youVisible, setYouVisible] = useState(true);
  useEffect(() => {
    const el = youRef.current;
    if (!el || !data.youInList) return;
    // Observe against the screen's own scroller (not the browser viewport) so it
    // also works inside the desktop phone frame. The visible band excludes the
    // sticky tabs at the top and the tab bar + pinned slot at the bottom.
    const root = scrollParent(el);
    const top = dockRef.current?.offsetHeight ?? 0;
    const padBottom = root ? parseFloat(getComputedStyle(root).paddingBottom) || 0 : 0;
    const bottom = padBottom + (pinRef.current?.offsetHeight ?? 0) - 10;
    const io = new IntersectionObserver(([e]) => setYouVisible(e.isIntersecting), {
      root,
      rootMargin: `-${Math.round(top)}px 0px -${Math.max(0, Math.round(bottom))}px 0px`,
      threshold: 0.6,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [board, data.youInList]);

  // Switching boards while scrolled deep into a list: bring the new list's top
  // up under the sticky tabs instead of landing mid-way through it.
  const changeBoard = (next: Board) => {
    const head = headRef.current;
    const dock = dockRef.current;
    const root = head ? scrollParent(head) : null;
    if (head && dock && root) {
      const max = Math.max(0, head.offsetTop - dock.offsetHeight);
      if (root.scrollTop > max) root.scrollTop = max;
    }
    setBoard(next);
  };

  const earned = earnedIds(progress);
  const listTitle = board === 'top' ? 'Top 50 · by wins' : board === 'friends' ? 'Your circle' : 'Top 50 · survival points';
  const pinnedOn = !data.youInList || !youVisible;

  return (
    <Screen nav header={<TopBar title="Leaderboard" showBack={false} />} contentClassName={s.content}>
      {/* Your badges strip */}
      <button
        type="button"
        className={['glass', s.badgeStrip].join(' ')}
        aria-label={`Your badges: ${earned.length} of ${ACHIEVEMENTS.length}. Open profile`}
        onClick={() => {
          audio.unlock();
          audio.play('tap');
          haptic('light');
          navigate('/profile', { replace: true, transition: 'tab' });
        }}
      >
        <span className={s.stripLabel}>
          <span className={s.stripKicker}>Your badges</span>
          <span className={s.stripCount}>
            <b className="tabular">{earned.length}</b>
            <i>/ {ACHIEVEMENTS.length}</i>
          </span>
        </span>
        <span className={s.stripBadges} aria-hidden>
          {earned.length === 0 ? (
            <span className={s.stripEmpty}>Survive a trial to earn your first badge</span>
          ) : (
            earned.slice(0, 5).map((id) => {
              const a = ACHIEVEMENTS.find((x) => x.id === id);
              return a ? <Badge key={id} tier={a.tier} icon={a.icon} size={28} /> : null;
            })
          )}
          {earned.length > 5 && <span className={s.stripMore}>+{earned.length - 5}</span>}
        </span>
        <ChevronRight size={18} className={s.stripChev} aria-hidden />
      </button>

      <div ref={dockRef} className={s.tabsDock}>
        <Tabs tabs={TABS} value={board} onChange={changeBoard} />
      </div>

      <div ref={headRef} className={s.listHead}>
        <span>{listTitle}</span>
        <span className={s.listMeta}>
          <Users size={13} aria-hidden />
          {data.caption}
        </span>
      </div>

      <div className={s.listWrap}>
        <ol className={s.list} key={board} aria-label={`${TABS.find((t) => t.id === board)!.label} leaderboard`}>
          {data.rows.map(({ entry, rank }, i) => (
            <LeaderRow
              key={entry.id}
              ref={entry.isYou ? youRef : undefined}
              entry={entry}
              rank={rank}
              metric={data.metric}
              index={i}
              animate={!reduce}
            />
          ))}
        </ol>

        <div ref={pinRef} className={[s.pinned, pinnedOn && s.pinnedOn].filter(Boolean).join(' ')} aria-hidden={!pinnedOn}>
          <LeaderRow entry={you} rank={data.youRank} metric={data.metric} pinned />
        </div>
      </div>
    </Screen>
  );
}
