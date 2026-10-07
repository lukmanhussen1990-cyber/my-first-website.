/*
 * Games hub (tab): today's featured trial plus a practice tile for every
 * mini-game engine. Practice runs grant XP only.
 */
import { Activity, Brain, ChevronRight, Crown, DoorOpen, Gem, Grid3x3, Heart, Play, Puzzle, Radar, Zap, type LucideIcon } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { SUIT_SCENE } from '../assets/art';
import { RankChip } from '../components/core/RankChip';
import { Pill, Stars } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { GlitchText } from '../components/ui/GlitchText';
import { Screen } from '../components/ui/Screen';
import { SuitIcon } from '../components/ui/SuitIcon';
import { TopBar } from '../components/ui/TopBar';
import { CHALLENGES, GAME_TYPES } from '../data/challenges';
import { SUITS } from '../data/suits';
import type { Challenge, GameType, PlayerProgress } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useProgress } from '../state/game';
import { challengeStatus, formatNumber } from '../state/selectors';
import { useSettings } from '../state/settings';
import s from './GamesScreen.module.css';

const ICONS: Record<GameType, LucideIcon> = {
  memory: Brain,
  logic: Puzzle,
  pattern: Radar,
  escape: DoorOpen,
  reaction: Zap,
  numberOrder: Grid3x3,
  choice: Heart,
  stamina: Activity,
};

/** Full staggered entrance only on the first visit of a session. */
let enteredOnce = false;

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic daily pick among the trials the player can attempt right now. */
function dailyTrial(p: PlayerProgress, day: string): { challenge: Challenge; cleared: boolean } {
  const available = CHALLENGES.filter((c) => challengeStatus(c, p) === 'available');
  const pool = available.length ? available : CHALLENGES.filter((c) => challengeStatus(c, p) === 'completed');
  const list = pool.length ? pool : CHALLENGES;
  const challenge = list[hash(`daily:${day}`) % list.length];
  return { challenge, cleared: challengeStatus(challenge, p) === 'completed' };
}

/**
 * Personal best for a game type, formatted for the tile footer. Uses the
 * engine-specific bests (which practice runs also update) and otherwise the
 * best cleared score across the ranked trials of that type.
 */
function bestFor(type: GameType, p: PlayerProgress): { best: string | null; played: boolean } {
  const b = p.bests;
  let best: string | null = null;
  switch (type) {
    case 'reaction':
      if (b.reactionMs) best = `${Math.round(b.reactionMs)} ms`;
      break;
    case 'memory':
      if (b.memoryMistakesMin !== undefined && Number.isFinite(b.memoryMistakesMin))
        best = b.memoryMistakesMin === 0 ? 'Flawless' : `${b.memoryMistakesMin} miss${b.memoryMistakesMin === 1 ? '' : 'es'}`;
      break;
    case 'pattern':
      if (b.patternLength) best = `${b.patternLength} signals`;
      break;
    case 'stamina':
      if (b.tapsPerSec) best = `${b.tapsPerSec.toFixed(1)} taps/s`;
      break;
  }
  let played = best !== null;
  let score = -1;
  for (const c of CHALLENGES) {
    if (c.game.type !== type) continue;
    const rec = p.challenges[c.id];
    if (!rec || rec.attempts === 0) continue;
    played = true;
    if (rec.wins > 0) score = Math.max(score, rec.bestScore);
  }
  if (!best && score >= 0) best = `Score ${score}`;
  return { best, played };
}

function msToMidnight(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - now;
}

function ResetCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor(msToMidnight(now) / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const sec = left % 60;
  const text = [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
  return (
    <span className={s.reset} aria-label={`New daily trial in ${h} hours ${m} minutes`}>
      <span className={s.resetLabel}>New in</span>
      <span className={s.resetClock}>{text}</span>
    </span>
  );
}

export default function GamesScreen(_props: ScreenProps) {
  const progress = useProgress();
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const [animate] = useState(() => {
    const first = !enteredOnce && !reduceMotion;
    enteredOnce = true;
    return first;
  });
  const [day] = useState(() => dayKey(new Date()));
  const daily = useMemo(() => dailyTrial(progress, day), [progress, day]);
  const c = daily.challenge;
  const suit = SUITS[c.suit];

  const open = (type: GameType) => {
    audio.play('select');
    haptic('light');
    navigate(`/challenge/practice-${type}`);
  };

  return (
    <Screen nav header={<TopBar title="Mini Games" showBack={false} />} contentClassName={s.content}>
      <motion.div className={s.stack} variants={list} initial={animate ? 'hidden' : false} animate="show">
        <motion.p variants={item} className={s.lead}>
          Practice every trial type. <span className={s.leadAccent}>XP only — no points.</span>
        </motion.p>

        {/* ── Daily trial ─────────────────────────────── */}
        <motion.section variants={item} className={s.daily} aria-labelledby="daily-title">
          <img className={s.dailyArt} src={SUIT_SCENE[c.suit]} alt="" decoding="async" />
          <span className={s.dailyShade} aria-hidden />
          <span className={[s.dailyScan, 'scanlines'].join(' ')} aria-hidden />
          <div className={s.dailyTop}>
            <GlitchText text="DAILY TRIAL" className={s.kicker} every={4600} />
            <ResetCountdown />
          </div>
          <div className={s.dailyBody}>
            <RankChip suit={c.suit} rank={c.rank} className={s.dailyRank} />
            <div className={s.dailyInfo}>
              <span className={s.dailySuit}>
                <SuitIcon suit={c.suit} size={11} /> {suit.name} · {suit.category}
                {daily.cleared && (
                  <Pill tone="green" className={s.clearedPill}>
                    Cleared
                  </Pill>
                )}
              </span>
              <h2 id="daily-title" className={s.dailyTitle}>
                {c.title}
              </h2>
              <p className={s.dailyHook}>{c.hook}</p>
            </div>
          </div>
          <div className={s.dailyFoot}>
            <div className={s.dailyMeta}>
              <Stars value={c.difficulty} size={12} />
              <span className={s.rewards}>
                <span className={s.reward} aria-label={`${c.rewardPoints} points`}>
                  <Crown size={13} className={s.crown} fill="currentColor" strokeWidth={1.5} aria-hidden />
                  {formatNumber(c.rewardPoints)}
                </span>
                <span className={s.reward}>+{formatNumber(c.rewardXp)} XP</span>
                <span className={s.reward} aria-label={`${c.rewardGems} gems`}>
                  <Gem size={12} className={s.gem} fill="currentColor" strokeWidth={1.5} aria-hidden />
                  {c.rewardGems}
                </span>
              </span>
            </div>
            <Button
              size="sm"
              className={s.play}
              icon={<Play size={14} fill="currentColor" strokeWidth={0} />}
              onClick={() => navigate(`/challenge/${c.id}`)}
              aria-label={`Play daily trial: ${c.title}`}
            >
              Play
            </Button>
          </div>
        </motion.section>

        {/* ── Practice grid ───────────────────────────── */}
        <motion.div variants={item} className="section-title">
          <h2 className={s.sectionH}>Training ground</h2>
          <small>{GAME_TYPES.length} games</small>
        </motion.div>

        <div className={s.grid}>
          {GAME_TYPES.map((g) => {
            const Icon = ICONS[g.type];
            const { best, played } = bestFor(g.type, progress);
            const red = SUITS[g.suit].tone === 'red';
            return (
              <motion.button
                key={g.type}
                variants={item}
                type="button"
                className={s.tile}
                onClick={() => open(g.type)}
                aria-label={`${g.title} practice. ${g.blurb}${best ? ` Best: ${best}.` : ''}`}
              >
                <span className={s.tileTop}>
                  <span className={s.icon}>
                    <Icon size={20} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className={[s.suit, red ? s.suitRed : s.suitSilver].join(' ')} aria-hidden>
                    <SuitIcon suit={g.suit} size={16} finish={red ? 'ruby' : 'chrome'} />
                  </span>
                </span>
                <span className={s.name}>{g.name}</span>
                <span className={s.blurb}>{g.blurb}</span>
                <span className={s.tileFoot}>
                  {best ? (
                    <span className={s.best}>
                      <small>Best</small>
                      <b>{best}</b>
                    </span>
                  ) : (
                    <span className={s.fresh}>{played ? 'Not cleared' : 'Not played'}</span>
                  )}
                  <ChevronRight size={16} className={s.chev} aria-hidden />
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </Screen>
  );
}
