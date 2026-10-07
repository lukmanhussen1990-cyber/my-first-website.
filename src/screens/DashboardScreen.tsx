/*
 * Home / Dashboard (reference screen 3): player header, stats, the "new game"
 * banner, the four suit cards, current missions and recent trials.
 */
import { Bell, ChevronRight, Crown, MapPin, Swords, Trophy } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';
import { navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { ART } from '../assets/art';
import { PlayingCard } from '../components/PlayingCard';
import { RankChip } from '../components/core/RankChip';
import { AppSheet } from '../components/meta/AppSheet';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { ProgressBar, Stars, StatRow } from '../components/ui/Bits';
import { Button, IconButton } from '../components/ui/Button';
import { Currency } from '../components/ui/Currency';
import { GlitchText } from '../components/ui/GlitchText';
import { Screen } from '../components/ui/Screen';
import { getAchievement } from '../data/achievements';
import { getChallenge } from '../data/challenges';
import { SUIT_ORDER, SUITS } from '../data/suits';
import type { Achievement, Challenge, HistoryEntry } from '../data/types';
import { getZone } from '../data/zones';
import { useProgress } from '../state/game';
import { currentMissions, formatNumber, globalRank, levelInfo, winRate } from '../state/selectors';
import { useSettings } from '../state/settings';
import s from './DashboardScreen.module.css';

const DAY = 24 * 60 * 60 * 1000;

/** Full staggered entrance only on the first visit of a session; later tab switches are instant. */
let enteredOnce = false;

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

type Activity =
  | { kind: 'trial'; at: number; entry: HistoryEntry; challenge: Challenge }
  | { kind: 'achievement'; at: number; achievement: Achievement };

function timeAgo(at: number, now: number): string {
  const m = Math.max(0, Math.round((now - at) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default function DashboardScreen(_props: ScreenProps) {
  const progress = useProgress();
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const [animate] = useState(() => {
    const first = !enteredOnce && !reduceMotion;
    enteredOnce = true;
    return first;
  });
  const [now] = useState(() => Date.now());
  const [activityOpen, setActivityOpen] = useState(false);
  // stable so the sheet's Escape listener is not re-bound on every render
  const closeActivity = useCallback(() => setActivityOpen(false), []);

  const lv = levelInfo(progress.xp);
  const missions = currentMissions(progress);
  const recent = progress.history.slice(0, 8);

  const activity = useMemo<Activity[]>(() => {
    const out: Activity[] = [];
    for (const entry of progress.history.slice(0, 12)) {
      const challenge = getChallenge(entry.challengeId);
      if (challenge) out.push({ kind: 'trial', at: entry.at, entry, challenge });
    }
    for (const [id, at] of Object.entries(progress.achievements)) {
      const achievement = getAchievement(id);
      if (achievement) out.push({ kind: 'achievement', at, achievement });
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [progress.history, progress.achievements]);

  const freshAchievement = Object.values(progress.achievements).some((at) => now - at < DAY);

  const stats = [
    { label: 'Games', value: formatNumber(progress.gamesPlayed) },
    { label: 'Wins', value: formatNumber(progress.wins) },
    { label: 'Win Rate', value: `${winRate(progress)}%` },
    { label: 'Rank', value: `#${formatNumber(globalRank(progress.points))}` },
  ];

  const header = (
    <header className={s.top}>
      <div className={s.mark} aria-label="Border Trials" role="img">
        <span className={s.monogram} aria-hidden>
          <span>BT</span>
        </span>
        <span className={s.wordmark} aria-hidden>
          <span>BORDER</span>
          <span className={s.wordRed}>TRIALS</span>
        </span>
      </div>
      <div className={s.topRight}>
        <Currency points={progress.points} gems={progress.gems} className={s.currency} />
        <IconButton label="Recent activity" badge={freshAchievement} onClick={() => setActivityOpen(true)}>
          <Bell size={21} strokeWidth={1.75} />
        </IconButton>
      </div>
    </header>
  );

  return (
    <>
      <Screen nav header={header} contentClassName={s.content}>
        <h1 className="sr-only">Border Trials dashboard</h1>
        <motion.div className={s.stack} variants={list} initial={animate ? 'hidden' : false} animate="show">
          {/* ── Player ─────────────────────────────────── */}
          <motion.div variants={item}>
            <button
              type="button"
              className={s.player}
              onClick={() => navigate('/profile', { transition: 'tab', replace: true })}
              aria-label={`${progress.playerName}, level ${lv.level}. Open profile`}
            >
              <Avatar id={progress.avatarId} ring="red" size={72} />
              <span className={s.playerInfo}>
                <span className={s.playerName}>{progress.playerName}</span>
                <span className={s.playerLevel}>Level {lv.level}</span>
                <ProgressBar value={lv.pct} tone="xp" spark height={5} className={s.xpBar} label="Experience" />
                <span className={s.xpCaption}>
                  <span className={s.xpInto}>{Math.round(lv.pct * 100)}%</span>
                  <span className="tabular">
                    {formatNumber(lv.into)} / {formatNumber(lv.cap)} XP
                  </span>
                </span>
              </span>
              <ChevronRight size={18} className={s.playerChevron} aria-hidden />
            </button>
          </motion.div>

          {/* ── Stats ──────────────────────────────────── */}
          <motion.div variants={item} className={s.stats}>
            <StatRow stats={stats} />
          </motion.div>

          {/* ── Banner ─────────────────────────────────── */}
          <motion.section variants={item} className={s.banner} aria-labelledby="dash-banner-title">
            <img className={s.bannerArt} src={ART.bannerFerris} alt="" decoding="async" />
            <span className={s.bannerShade} aria-hidden />
            <span className={[s.bannerScan, 'scanlines'].join(' ')} aria-hidden />
            <div className={s.bannerBody}>
              <GlitchText text={`ROUND ${String(lv.level).padStart(2, '0')}`} className={s.kicker} every={3800} />
              <h2 id="dash-banner-title" className={s.bannerTitle}>
                A New Game Awaits
              </h2>
              <Button size="sm" className={s.enter} onClick={() => navigate('/cards')}>
                Enter
              </Button>
            </div>
          </motion.section>

          {/* ── Choose your card ───────────────────────── */}
          <motion.section variants={item} aria-labelledby="dash-cards-title">
            <div className="section-title">
              <h2 id="dash-cards-title" className={s.sectionH}>
                Choose your card
              </h2>
              <button type="button" className={s.more} onClick={() => navigate('/cards')}>
                All suits <ChevronRight size={14} aria-hidden />
              </button>
            </div>
            <div className={s.cards}>
              {SUIT_ORDER.map((id) => (
                <PlayingCard
                  key={id}
                  suit={id}
                  size="mini"
                  title={SUITS[id].name}
                  caption={SUITS[id].short}
                  label={`${SUITS[id].name}: ${SUITS[id].categoryLong}`}
                  onClick={() => navigate(`/cards/${id}`)}
                />
              ))}
            </div>
          </motion.section>

          {/* ── Current missions ───────────────────────── */}
          <motion.section variants={item} aria-labelledby="dash-missions-title">
            <div className="section-title">
              <h2 id="dash-missions-title" className={s.sectionH}>
                Current missions
              </h2>
              {missions.length > 0 && <small>{missions.length} open</small>}
            </div>
            {missions.length > 0 ? (
              <ul className={s.missions}>
                {missions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={['glass', s.mission].join(' ')}
                      onClick={() => navigate(`/challenge/${c.id}`)}
                    >
                      <RankChip suit={c.suit} rank={c.rank} />
                      <span className={s.missionMain}>
                        <span className={s.missionTitle}>{c.title}</span>
                        <span className={s.missionZone}>
                          <MapPin size={12} aria-hidden />
                          {getZone(c.zoneId)?.name ?? 'Unknown'}
                        </span>
                        <Stars value={c.difficulty} size={11} />
                      </span>
                      <span className={s.missionReward}>
                        <span className={s.missionPts}>
                          <Crown size={14} className={s.crown} fill="currentColor" strokeWidth={1.5} aria-hidden />
                          <b className="tabular">{formatNumber(c.rewardPoints)}</b>
                        </span>
                        <small>Points</small>
                      </span>
                      <ChevronRight size={18} className={s.chev} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={['glass', s.empty].join(' ')}>
                <Trophy size={22} className={s.emptyIcon} aria-hidden />
                <div className={s.emptyText}>
                  <p className={s.emptyTitle}>Every open trial cleared</p>
                  <p className={s.emptyBody}>Level up or scan the map to uncover new games.</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('/map', { transition: 'tab', replace: true })}
                >
                  Map
                </Button>
              </div>
            )}
          </motion.section>

          {/* ── Last trials ────────────────────────────── */}
          {recent.length > 0 && (
            <motion.section variants={item} aria-labelledby="dash-last-title">
              <div className="section-title">
                <h2 id="dash-last-title" className={s.sectionH}>
                  Last trials
                </h2>
                <small>{progress.streak > 1 ? `${progress.streak} win streak` : `${recent.length} recent`}</small>
              </div>
              <ul className={s.strip}>
                {recent.map((h, i) => {
                  const c = getChallenge(h.challengeId);
                  if (!c) return null;
                  const won = h.outcome === 'win';
                  return (
                    <li key={`${h.challengeId}-${h.at}-${i}`}>
                      <button
                        type="button"
                        className={[s.trial, won ? s.trialWon : s.trialLost].join(' ')}
                        onClick={() => navigate(`/challenge/${c.id}`)}
                        aria-label={`${c.title}: ${won ? 'survived' : 'eliminated'}${h.points ? `, ${h.points} points` : ''}`}
                      >
                        <RankChip suit={c.suit} rank={c.rank} variant="inline" />
                        <span className={s.trialText}>
                          <span className={s.trialOutcome}>{won ? 'Won' : 'Lost'}</span>
                          <span className={s.trialPts}>
                            {won && h.points > 0 ? `+${formatNumber(h.points)}` : `${h.score}%`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          )}
        </motion.div>
      </Screen>

      {/* portalled into the app root so the sheet and its backdrop layer above the tab bar */}
      <AppSheet open={activityOpen} onClose={closeActivity} label="Recent activity">
        <div className={s.sheetBody}>
          <div className={s.sheetHead}>
            <h2 className={s.sheetTitle}>Recent activity</h2>
            <span className={s.sheetSub}>{activity.length > 0 ? `${activity.length} events` : 'Nothing yet'}</span>
          </div>
          {activity.length === 0 ? (
            <div className={s.sheetEmpty}>
              <Swords size={26} aria-hidden />
              <p>No trials yet. Enter your first game and the city will remember it.</p>
            </div>
          ) : (
            <ul className={s.feed}>
              {activity.map((a, i) =>
                a.kind === 'trial' ? (
                  <li key={`t-${a.entry.challengeId}-${a.at}-${i}`} className={s.feedRow}>
                    <RankChip suit={a.challenge.suit} rank={a.challenge.rank} />
                    <span className={s.feedMain}>
                      <span className={s.feedTitle}>{a.challenge.title}</span>
                      <span className={s.feedMeta}>
                        <span className={a.entry.outcome === 'win' ? s.won : s.lost}>
                          {a.entry.outcome === 'win' ? 'Survived' : 'Eliminated'}
                        </span>
                        {' · '}
                        {timeAgo(a.at, now)}
                      </span>
                    </span>
                    {a.entry.points > 0 && (
                      <span className={s.feedPts}>
                        <Crown size={13} fill="currentColor" strokeWidth={1.5} aria-hidden />+
                        {formatNumber(a.entry.points)}
                      </span>
                    )}
                  </li>
                ) : (
                  <li
                    key={`a-${a.achievement.id}`}
                    className={[s.feedRow, now - a.at < DAY && s.feedFresh].filter(Boolean).join(' ')}
                  >
                    <span className={s.feedBadge}>
                      <Badge tier={a.achievement.tier} icon={a.achievement.icon} size={40} />
                    </span>
                    <span className={s.feedMain}>
                      <span className={s.feedTitle}>{a.achievement.name}</span>
                      <span className={s.feedMeta}>Achievement · {timeAgo(a.at, now)}</span>
                    </span>
                    {now - a.at < DAY && <span className={s.newTag}>New</span>}
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </AppSheet>
    </>
  );
}
