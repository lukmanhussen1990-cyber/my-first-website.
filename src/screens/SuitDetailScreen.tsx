/*
 * Card Details (reference screen 5): the suit's ace floats above its name and
 * description, the recommended trial's vitals, START CHALLENGE, and every
 * trial in the suit with its lock / available / cleared state.
 */
import { Check, ChevronRight, EyeOff, Lock, Timer, Trophy, Star as StarIcon, Users } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import { useState } from 'react';
import { getRouter, navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { SUIT_SCENE } from '../assets/art';
import { PlayingCard } from '../components/PlayingCard';
import { HeaderVeil, ScrollSentinel } from '../components/core/HeaderVeil';
import { useScrolledPast } from '../components/core/useScrolledPast';
import { NotFoundPanel } from '../components/core/NotFoundPanel';
import { RankChip } from '../components/core/RankChip';
import { Stars } from '../components/ui/Bits';
import { Button } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { TopBar } from '../components/ui/TopBar';
import { challengesForSuit } from '../data/challenges';
import { isSuitId, SUITS } from '../data/suits';
import type { Challenge, PlayerProgress } from '../data/types';
import { getZone } from '../data/zones';
import { useProgress } from '../state/game';
import {
  challengeStatus,
  formatDuration,
  formatNumber,
  levelInfo,
  nextChallengeForSuit,
  suitProgress,
} from '../state/selectors';
import { useSettings } from '../state/settings';
import { toast } from '../state/toasts';
import s from './SuitDetailScreen.module.css';

const EASE = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Why a locked trial is locked: level gate first, then an unrevealed hidden zone. */
function lockReason(c: Challenge, p: PlayerProgress): 'level' | 'hidden' | null {
  if (challengeStatus(c, p) !== 'locked') return null;
  return levelInfo(p.xp).level < c.unlockLevel ? 'level' : 'hidden';
}

/** A hidden zone's name stays secret until the map scan reveals it — whatever else locks the trial. */
function zoneLabel(c: Challenge, p: PlayerProgress): string {
  const zone = getZone(c.zoneId);
  if (!zone) return '';
  return zone.hidden && !p.revealedZones.includes(zone.id) ? 'Unknown location' : zone.name;
}

export default function SuitDetailScreen({ params }: ScreenProps) {
  const progress = useProgress();
  const reduceMotion = useSettings((st) => st.reduceMotion);
  const [animate] = useState(() => !reduceMotion && getRouter().transition !== 'pop');
  const { sentinelRef, past } = useScrolledPast();
  const suitId = params.suit;

  if (!isSuitId(suitId)) {
    return (
      <Screen header={<TopBar backTo="/cards" />}>
        <NotFoundPanel
          title="Unknown card"
          body="That suit is not part of this deck. Four paths exist — choose one of them."
          action="Choose your card"
          onAction={() => navigate('/cards', { replace: true, transition: 'pop' })}
        />
      </Screen>
    );
  }

  const suit = SUITS[suitId];
  const trials = challengesForSuit(suitId);
  const next = nextChallengeForSuit(suitId, progress);
  const nextStatus = challengeStatus(next, progress);
  const prog = suitProgress(suitId, progress);

  const openTrial = (c: Challenge) => {
    const reason = lockReason(c, progress);
    if (reason === 'level') {
      toast({
        kind: 'info',
        title: `Reach level ${c.unlockLevel} to unlock`,
        body: `${c.rank} ${suit.symbol} · ${c.title}`,
      });
      return;
    }
    navigate(`/challenge/${c.id}`);
  };

  return (
    <Screen
      bg={SUIT_SCENE[suitId]}
      bgPosition="center top"
      shade="heavy"
      header={
        <>
          <HeaderVeil show={past} />
          <TopBar
            backTo="/cards"
            right={
              <span className={s.progress} aria-label={`${prog.cleared} of ${prog.total} trials cleared`}>
                <b>{prog.cleared}</b>/{prog.total}
              </span>
            }
          />
        </>
      }
      contentClassName={s.content}
    >
      <ScrollSentinel sentinelRef={sentinelRef} />
      {/* ── Hero card ─────────────────────────────── */}
      <motion.div
        className={s.hero}
        initial={animate ? { opacity: 0, y: 26, scale: 0.92 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <span className={[s.halo, suit.tone === 'red' ? s.haloRed : s.haloSilver].join(' ')} aria-hidden />
        <div className={s.float}>
          <PlayingCard suit={suitId} rank="A" size="lg" glintDelay={animate ? 520 : undefined} />
        </div>
        <span className={s.floor} aria-hidden />
      </motion.div>

      <motion.div variants={stagger} initial={animate ? 'hidden' : false} animate="show" className={s.body}>
        <motion.h1 variants={rise} className={s.name}>
          {suit.name}
        </motion.h1>
        <motion.p
          variants={rise}
          className={[s.category, suit.tone === 'red' && s.categoryRed].filter(Boolean).join(' ')}
        >
          {suit.categoryLong}
        </motion.p>
        <motion.p variants={rise} className={s.desc}>
          {suit.description}
        </motion.p>

        {/* ── Recommended trial vitals ─────────────── */}
        <motion.section variants={rise} className={['glass', s.info].join(' ')} aria-labelledby="suit-next-title">
          <div className={s.infoHead}>
            <span className={s.infoKicker}>
              {nextStatus === 'completed' ? 'Replay' : nextStatus === 'locked' ? 'Next trial · locked' : 'Next trial'}
            </span>
            <span id="suit-next-title" className={s.infoTitle}>
              <RankChip suit={suitId} rank={next.rank} variant="inline" />
              <span className={s.infoName}>{next.title}</span>
            </span>
          </div>
          <dl className={s.rows}>
            <div className={s.row}>
              <dt>
                <StarIcon size={17} strokeWidth={1.75} aria-hidden />
                Difficulty
              </dt>
              <dd>
                <Stars value={next.difficulty} size={14} />
              </dd>
            </div>
            <div className={s.row}>
              <dt>
                <Timer size={17} strokeWidth={1.75} aria-hidden />
                Time Limit
              </dt>
              <dd>{formatDuration(next.timeLimitSec)}</dd>
            </div>
            <div className={s.row}>
              <dt>
                <Trophy size={17} strokeWidth={1.75} aria-hidden />
                Reward Points
              </dt>
              <dd>{formatNumber(next.rewardPoints)} Points</dd>
            </div>
            <div className={s.row}>
              <dt>
                <Users size={17} strokeWidth={1.75} aria-hidden />
                Players
              </dt>
              <dd>{next.players}</dd>
            </div>
          </dl>
        </motion.section>

        <motion.div variants={rise}>
          <Button
            size="lg"
            block
            variant={nextStatus === 'locked' ? 'secondary' : 'primary'}
            onClick={() => navigate(`/challenge/${next.id}`)}
          >
            {nextStatus === 'completed'
              ? 'Replay challenge'
              : nextStatus === 'locked'
                ? 'View briefing'
                : 'Start challenge'}
          </Button>
        </motion.div>

        {/* ── All trials ───────────────────────────── */}
        <motion.section variants={rise} className={s.all} aria-labelledby="suit-all-title">
          <div className="section-title">
            <h2 id="suit-all-title" className={s.sectionH}>
              All trials
            </h2>
            <small>
              {prog.cleared} of {prog.total} cleared
            </small>
          </div>
          <ul className={s.list}>
            {trials.map((c) => {
              const status = challengeStatus(c, progress);
              const reason = lockReason(c, progress);
              const record = progress.challenges[c.id];
              const isNext = c.id === next.id && status === 'available';
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={[s.trial, s[status], isNext && s.isNext].filter(Boolean).join(' ')}
                    onClick={() => openTrial(c)}
                    aria-label={`${c.rank} of ${suit.name}s, ${c.title}. ${
                      status === 'locked'
                        ? reason === 'level'
                          ? `Locked until level ${c.unlockLevel}`
                          : 'Hidden location'
                        : status === 'completed'
                          ? `Cleared, ${record?.stars ?? 0} of 3 stars`
                          : 'Available'
                    }`}
                  >
                    <RankChip
                      suit={suitId}
                      rank={c.rank}
                      state={status === 'locked' ? 'locked' : status === 'completed' ? 'cleared' : 'normal'}
                    />
                    <span className={s.trialMain}>
                      <span className={s.trialTitle}>{c.title}</span>
                      <span className={s.trialMeta}>
                        <Stars value={c.difficulty} size={10} />
                        <span className={s.trialZone}>{zoneLabel(c, progress)}</span>
                      </span>
                    </span>
                    <span className={s.trialStatus}>
                      {status === 'locked' && reason === 'level' && (
                        <span className={s.lock}>
                          <Lock size={13} strokeWidth={2} aria-hidden />
                          LV {c.unlockLevel}
                        </span>
                      )}
                      {status === 'locked' && reason === 'hidden' && (
                        <span className={s.lock}>
                          <EyeOff size={13} strokeWidth={2} aria-hidden />
                          Hidden
                        </span>
                      )}
                      {status === 'available' && <span className={s.open}>{isNext ? 'Next' : 'Open'}</span>}
                      {status === 'completed' && (
                        <span className={s.cleared}>
                          <span className={s.earned} aria-hidden>
                            {[0, 1, 2].map((i) => (
                              <StarIcon
                                key={i}
                                size={11}
                                strokeWidth={1.5}
                                fill={i < (record?.stars ?? 0) ? 'currentColor' : 'transparent'}
                                className={i < (record?.stars ?? 0) ? s.starOn : s.starOff}
                              />
                            ))}
                          </span>
                          <Check size={14} strokeWidth={2.5} className={s.check} aria-hidden />
                        </span>
                      )}
                    </span>
                    <ChevronRight size={16} className={s.chev} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>
      </motion.div>
    </Screen>
  );
}
