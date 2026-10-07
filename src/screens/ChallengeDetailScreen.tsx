/*
 * Challenge / trial briefing: scene art header, title + rank badge, mission
 * briefing, rules, vitals grid, location and personal record, with a sticky
 * START CHALLENGE that glitches into the game (or explains why it is locked).
 */
import { Check, ChevronRight, Clock, Crown, Gem, Gauge, Lock, MapPin, Radar, Sparkles, Users } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { useState } from 'react';
import { getRouter, navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { SUIT_SCENE } from '../assets/art';
import { HeaderVeil, ScrollSentinel } from '../components/core/HeaderVeil';
import { useScrolledPast } from '../components/core/useScrolledPast';
import { NotFoundPanel } from '../components/core/NotFoundPanel';
import { RankChip } from '../components/core/RankChip';
import { Pill, Stars } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { SuitIcon } from '../components/ui/SuitIcon';
import { TopBar } from '../components/ui/TopBar';
import { getChallenge } from '../data/challenges';
import { SUITS } from '../data/suits';
import { getZone } from '../data/zones';
import { useProgress } from '../state/game';
import { challengeStatus, formatClock, formatNumber, levelInfo } from '../state/selectors';
import { useSettings } from '../state/settings';
import s from './ChallengeDetailScreen.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export default function ChallengeDetailScreen({ params }: ScreenProps) {
  const progress = useProgress();
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const [animate] = useState(() => !reduceMotion && getRouter().transition !== 'pop');
  const { sentinelRef, past } = useScrolledPast();
  const c = getChallenge(params.id);

  if (!c) {
    return (
      <Screen header={<TopBar backTo="/home" />}>
        <NotFoundPanel
          title="Trial not found"
          body="This game no longer exists in the city, or the link is broken."
          action="Back to the cards"
          onAction={() => navigate('/cards', { replace: true, transition: 'pop' })}
        />
      </Screen>
    );
  }

  const suit = SUITS[c.suit];
  const zone = getZone(c.zoneId);
  const level = levelInfo(progress.xp).level;
  const status = challengeStatus(c, progress);
  const hiddenZone = !!zone?.hidden && !progress.revealedZones.includes(zone.id);
  const levelLocked = level < c.unlockLevel;
  const record = c.practice ? undefined : progress.challenges[c.id];
  const backTo = c.practice ? '/games' : `/cards/${c.suit}`;
  // practice runs carry a "· Practice" suffix in data; the PRACTICE pill already says so
  const displayTitle = c.practice ? c.title.replace(/\s*·\s*practice$/i, '') : c.title;

  const title = (
    <span className={s.barTitle}>
      <SuitIcon suit={c.suit} size={15} className={suit.tone === 'red' ? s.barGlyphRed : s.barGlyph} />
      <span className={s.barRed}>{c.practice ? 'Practice' : suit.name}</span>
      <span>{c.practice ? 'Run' : 'Trial'}</span>
    </span>
  );

  const footer =
    status === 'locked' ? (
      <div className={s.lockedFoot}>
        <p className={s.lockedNote}>
          {levelLocked
            ? `You are level ${level}. This trial opens at level ${c.unlockLevel}.`
            : 'This trial is staged somewhere the map has not revealed yet.'}
        </p>
        <Button
          size="lg"
          variant="secondary"
          block
          disabled
          icon={<Lock size={18} strokeWidth={2.25} />}
          className={s.lockedBtn}
        >
          {levelLocked ? `Reach level ${c.unlockLevel}` : 'Hidden location — scan the map'}
        </Button>
      </div>
    ) : (
      <Button size="lg" block sfx="reveal" onClick={() => navigate(`/play/${c.id}`, { transition: 'glitch' })}>
        {status === 'completed' ? 'Replay challenge' : 'Start challenge'}
      </Button>
    );

  return (
    <Screen
      bg={SUIT_SCENE[c.suit]}
      bgPosition="center top"
      shade="top"
      header={
        <>
          <HeaderVeil show={past} />
          <TopBar title={title} backTo={backTo} />
        </>
      }
      footer={footer}
      className={s.screen}
      contentClassName={s.content}
    >
      <ScrollSentinel sentinelRef={sentinelRef} />
      <motion.div variants={stagger} initial={animate ? 'hidden' : false} animate="show" className={s.stack}>
        {/* ── Title block ─────────────────────────── */}
        <motion.div variants={rise} className={s.heading}>
          <div className={s.badges}>
            <RankChip suit={c.suit} rank={c.rank} variant="inline" />
            {c.practice ? (
              <Pill tone="red" className={s.pill}>
                Practice · XP only
              </Pill>
            ) : status === 'completed' ? (
              <Pill tone="green" className={s.pill}>
                <Check size={12} strokeWidth={3} aria-hidden /> Cleared
              </Pill>
            ) : status === 'locked' ? (
              <Pill className={s.pill}>
                <Lock size={11} strokeWidth={2.5} aria-hidden /> Locked
              </Pill>
            ) : (
              <Pill tone="amber" className={s.pill}>
                Available
              </Pill>
            )}
          </div>
          <h1 className={s.title}>{displayTitle}</h1>
          <p className={s.hook}>{c.hook}</p>
        </motion.div>

        {/* ── Briefing ────────────────────────────── */}
        <motion.section variants={rise} className={['glass', s.panel].join(' ')} aria-labelledby="ch-brief">
          <h2 id="ch-brief" className={s.panelTitle}>
            <span className={s.tick} aria-hidden />
            Mission briefing
          </h2>
          <p className={s.briefing}>{c.briefing}</p>
        </motion.section>

        {/* ── Rules ───────────────────────────────── */}
        <motion.section variants={rise} className={['glass', s.panel].join(' ')} aria-labelledby="ch-rules">
          <h2 id="ch-rules" className={s.panelTitle}>
            <span className={s.tick} aria-hidden />
            Rules
          </h2>
          <ul className={s.rules}>
            {c.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </motion.section>

        {/* ── Vitals ──────────────────────────────── */}
        <motion.div variants={rise} className={s.grid}>
          <div className={['glass', s.tile].join(' ')}>
            <span className={s.tileLabel}>
              <Clock size={14} aria-hidden /> Timer
            </span>
            <span className={[s.tileValue, s.clock].join(' ')}>{formatClock(c.timeLimitSec)}</span>
          </div>
          <div className={['glass', s.tile].join(' ')}>
            <span className={s.tileLabel}>
              <Gauge size={14} aria-hidden /> Difficulty
            </span>
            <span className={s.tileValue}>
              <Stars value={c.difficulty} size={15} />
            </span>
          </div>
          <div className={['glass', s.tile].join(' ')}>
            <span className={s.tileLabel}>
              <Sparkles size={14} aria-hidden /> Rewards
            </span>
            <span className={s.rewards}>
              {c.rewardPoints > 0 && (
                <span className={s.rewardPts}>
                  <Crown size={15} fill="currentColor" strokeWidth={1.5} aria-hidden />
                  {formatNumber(c.rewardPoints)}
                </span>
              )}
              <span className={s.rewardSub}>
                <span>+{formatNumber(c.rewardXp)} XP</span>
                {c.rewardGems > 0 && (
                  <span className={s.rewardGems}>
                    <Gem size={13} fill="currentColor" strokeWidth={1.5} aria-hidden />+{c.rewardGems}
                  </span>
                )}
              </span>
            </span>
          </div>
          <div className={['glass', s.tile].join(' ')}>
            <span className={s.tileLabel}>
              <Users size={14} aria-hidden /> Players
            </span>
            <span className={s.tileValue}>{c.players}</span>
          </div>
        </motion.div>

        {/* ── Location ────────────────────────────── */}
        <motion.div variants={rise}>
          <button
            type="button"
            className={['glass', s.location, hiddenZone && s.locationHidden].filter(Boolean).join(' ')}
            onClick={() => navigate('/map')}
            aria-label={
              hiddenZone ? 'Unknown location. Open the map to scan for it' : `Location: ${zone?.name}. Open the map`
            }
          >
            <span className={s.pin} aria-hidden>
              {hiddenZone ? <Radar size={18} /> : <MapPin size={18} />}
            </span>
            <span className={s.locText}>
              <span className={s.locLabel}>Location</span>
              <span className={s.locName}>{hiddenZone ? 'Unknown — scan the map' : (zone?.name ?? 'Unknown')}</span>
            </span>
            <span className={s.locMap}>
              Map <ChevronRight size={16} aria-hidden />
            </span>
          </button>
        </motion.div>

        {/* ── Personal record ─────────────────────── */}
        {record && (
          <motion.section variants={rise} className={['glass', s.panel].join(' ')} aria-labelledby="ch-record">
            <h2 id="ch-record" className={s.panelTitle}>
              <span className={s.tick} aria-hidden />
              Personal record
            </h2>
            <dl className={s.record}>
              <div>
                <dt>Best score</dt>
                <dd className="tabular">{record.bestScore}%</dd>
              </div>
              <div>
                <dt>Stars</dt>
                <dd>
                  <span className={s.earned} role="img" aria-label={`${record.stars} of 3 stars`}>
                    {[0, 1, 2].map((i) => (
                      <svg key={i} viewBox="0 0 24 24" className={i < record.stars ? s.starOn : s.starOff} aria-hidden>
                        <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
                      </svg>
                    ))}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Attempts</dt>
                <dd className="tabular">{record.attempts}</dd>
              </div>
              <div>
                <dt>Wins</dt>
                <dd className="tabular">{record.wins}</dd>
              </div>
            </dl>
          </motion.section>
        )}
      </motion.div>
      {/* content dissolves into the sticky CTA instead of being sliced by it */}
      <div className={s.fadeOut} aria-hidden />
    </Screen>
  );
}
