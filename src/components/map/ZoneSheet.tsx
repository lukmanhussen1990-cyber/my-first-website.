import { ChevronRight, Crosshair, Lock, Radar, Swords } from 'lucide-react';
import { navigate } from '../../app/router';
import { SUITS } from '../../data/suits';
import { RankChip } from '../core/RankChip';
import type { Challenge, PlayerProgress, Zone } from '../../data/types';
import { ZONES } from '../../data/zones';
import { audio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import { challengeStatus, formatNumber, levelInfo, type ChallengeStatus } from '../../state/selectors';
import { Pill, ProgressBar, Stars } from '../ui/Bits';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { PIN_LABEL, PIN_TONE, pinKind, zoneChallenges } from './mapModel';
import { PinMarker } from './PinMarker';
import s from './ZoneSheet.module.css';

interface Props {
  zone: Zone | null;
  open: boolean;
  onClose: () => void;
  progress: PlayerProgress;
  hereId: string;
}

/** Map grid reference matching the tactical grid printed over the art (12 × 16). */
function gridRef(z: Zone): string {
  const col = String.fromCharCode(65 + Math.min(11, Math.floor((z.x / 100) * 12)));
  const row = Math.min(16, Math.floor((z.y / 100) * 16) + 1);
  return `${col}-${String(row).padStart(2, '0')}`;
}

const STATUS_PILL: Record<ChallengeStatus, { tone: 'green' | 'amber' | 'neutral'; text: string }> = {
  completed: { tone: 'green', text: 'Cleared' },
  available: { tone: 'amber', text: 'Open' },
  locked: { tone: 'neutral', text: 'Locked' },
};

function TrialRow({ c, status }: { c: Challenge; status: ChallengeStatus }) {
  const suit = SUITS[c.suit];
  const pill = STATUS_PILL[status];
  return (
    <button
      type="button"
      className={[s.trial, status === 'locked' && s.trialLocked].filter(Boolean).join(' ')}
      onClick={() => {
        audio.play('select');
        haptic('light');
        navigate(`/challenge/${c.id}`);
      }}
      aria-label={`${c.rank} of ${suit.name}s: ${c.title}. Difficulty ${c.difficulty} of 5. ${status === 'locked' ? `Locked until level ${c.unlockLevel}` : pill.text}`}
    >
      <span className={s.card} aria-hidden>
        <RankChip suit={c.suit} rank={c.rank} state={status === 'locked' ? 'locked' : status === 'completed' ? 'cleared' : 'normal'} />
      </span>
      <span className={s.trialBody}>
        <span className={s.trialTitle}>{c.title}</span>
        <span className={s.trialMeta}>
          <Stars value={c.difficulty} size={11} />
          <span className={s.dot} />
          <span>{suit.category}</span>
        </span>
      </span>
      <Pill tone={pill.tone} className={s.trialPill}>
        {status === 'locked' ? (
          <>
            <Lock size={10} strokeWidth={2.4} />
            Lv {c.unlockLevel}
          </>
        ) : (
          pill.text
        )}
      </Pill>
      <ChevronRight size={16} className={s.chev} aria-hidden />
    </button>
  );
}

function ZoneBody({ zone, progress, hereId }: { zone: Zone; progress: PlayerProgress; hereId: string }) {
  const kind = pinKind(zone, progress) ?? 'locked';
  const trials = zoneChallenges(zone);
  const statuses = trials.map((c) => challengeStatus(c, progress));
  const cleared = statuses.filter((st) => st === 'completed').length;
  const next = trials.find((_, i) => statuses[i] === 'available');
  const lvl = levelInfo(progress.xp);
  const zoneNo = String(ZONES.findIndex((z) => z.id === zone.id) + 1).padStart(2, '0');
  const here = zone.id === hereId;

  return (
    <div className={[s.body, s[kind]].join(' ')}>
      <header className={s.head}>
        <span className={s.emblem}>
          <PinMarker kind={kind} />
        </span>
        <div className={s.headText}>
          <div className={s.kickerRow}>
            <p className={s.kicker}>
              Zone {zoneNo} <span className={s.sep}>/</span> Grid {gridRef(zone)}
            </p>
            <Pill tone={PIN_TONE[kind]} className={s.statusPill}>
              {kind === 'locked' && <Lock size={10} strokeWidth={2.4} />}
              {PIN_LABEL[kind]}
            </Pill>
          </div>
          <h2 className={s.title}>{zone.name}</h2>
        </div>
      </header>

      {here && (
        <p className={s.here}>
          <Crosshair size={13} strokeWidth={2} /> Your last known position
        </p>
      )}

      <p className={s.desc}>{zone.description}</p>

      {kind === 'locked' && (
        <div className={s.lock}>
          <span className={s.lockIcon}>
            <Lock size={18} strokeWidth={2} />
          </span>
          <div className={s.lockText}>
            <strong>Reach level {zone.unlockLevel}</strong>
            <span>
              You are level {lvl.level}. Clear trials to earn XP and open this zone.
            </span>
            {lvl.level === zone.unlockLevel - 1 && (
              <ProgressBar value={lvl.pct} tone="red" height={4} className={s.lockBar} label="Progress to the next level" />
            )}
          </div>
        </div>
      )}

      {zone.hidden && zone.revealBonus ? (
        <p className={s.bonus}>
          <Radar size={14} strokeWidth={2} /> Hidden zone · signal bonus +{formatNumber(zone.revealBonus)} collected
        </p>
      ) : null}

      <h3 className={`section-title ${s.sectionTitle}`}>
        Trials
        <small>
          {cleared} / {trials.length} cleared
        </small>
      </h3>
      <ul className={s.trials}>
        {trials.map((c, i) => (
          <li key={c.id}>
            <TrialRow c={c} status={statuses[i]} />
          </li>
        ))}
      </ul>

      {next && (
        <Button block size="lg" className={s.cta} icon={<Swords size={18} />} onClick={() => navigate(`/challenge/${next.id}`)}>
          Enter zone
        </Button>
      )}
    </div>
  );
}

/** Bottom sheet for a tapped zone: status, briefing and its trials. */
export function ZoneSheet({ zone, open, onClose, progress, hereId }: Props) {
  return (
    <Sheet open={open} onClose={onClose} label={zone ? `${zone.name} zone` : 'Zone'}>
      {zone && <ZoneBody zone={zone} progress={progress} hereId={hereId} />}
    </Sheet>
  );
}
