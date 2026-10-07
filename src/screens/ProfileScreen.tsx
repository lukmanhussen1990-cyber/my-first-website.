import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Crown,
  Flame,
  Gem,
  HandHeart,
  MousePointerClick,
  Pencil,
  Settings,
  ShieldAlert,
  Timer,
  TrendingUp,
  Waypoints,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { navigate } from '../app/router';
import type { ScreenProps } from '../app/screens';
import { AVATAR_NAMES, AVATARS } from '../assets/art';
import { AppSheet, SheetActions, SheetField, SheetHead, SheetInput } from '../components/meta/AppSheet';
import { formatDate, relativeTime } from '../components/meta/time';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Divider, Glass, Pill, ProgressBar, StatRow } from '../components/ui/Bits';
import { Button, IconButton } from '../components/ui/Button';
import { Screen } from '../components/ui/Screen';
import { SuitIcon } from '../components/ui/SuitIcon';
import { TopBar } from '../components/ui/TopBar';
import { ACHIEVEMENTS } from '../data/achievements';
import { getChallenge } from '../data/challenges';
import { SUIT_ORDER, SUITS } from '../data/suits';
import type { Achievement, BadgeTier } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useGame, useProgress } from '../state/game';
import { formatNumber, globalRank, levelInfo, suitProgress, winRate } from '../state/selectors';
import { useSession } from '../state/session';
import s from './ProfileScreen.module.css';

const TIER_LABEL: Record<BadgeTier, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  emerald: 'Emerald',
  crimson: 'Crimson',
};

const NAME_RE = /^[\p{L}\p{N} _.-]+$/u;

/** achievements shown before "View all" (two rows of four) */
const BADGES_COLLAPSED = 8;

function validateName(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 3) return 'At least 3 characters.';
  if (v.length > 16) return 'At most 16 characters.';
  if (!NAME_RE.test(v)) return 'Letters, numbers, spaces, - _ . only.';
  return null;
}

function Stat({ icon, value, label, tone }: { icon: ReactNode; value: ReactNode; label: string; tone?: 'gold' | 'red' }) {
  return (
    <div className={s.statTile}>
      <span className={[s.statIcon, tone && s[`statIcon_${tone}`]].filter(Boolean).join(' ')} aria-hidden>
        {icon}
      </span>
      <span className={s.statText}>
        <b className="tabular">{value}</b>
        <small>{label}</small>
      </span>
    </div>
  );
}

export default function ProfileScreen(_props: ScreenProps) {
  const p = useProgress();
  const status = useSession((st) => st.status);
  const user = useSession((st) => st.user);
  const setAvatar = useGame((st) => st.setAvatar);
  const setPlayerName = useGame((st) => st.setPlayerName);

  const [sheet, setSheet] = useState<'avatar' | 'name' | null>(null);
  // the last badge opened stays mounted so the sheet keeps its content while closing
  const [badge, setBadge] = useState<Achievement | null>(null);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [allBadges, setAllBadges] = useState(false);
  const [draft, setDraft] = useState('');
  const [touched, setTouched] = useState(false);

  const guest = status === 'guest';
  const lv = levelInfo(p.xp);
  const rank = globalRank(p.points);
  const earnedCount = ACHIEVEMENTS.filter((a) => a.id in p.achievements).length;
  // earned badges first (oldest unlock first), then the locked ones in catalogue order
  const badgeOrder = [...ACHIEVEMENTS].sort((a, b) => {
    const ta = p.achievements[a.id] ?? Infinity;
    const tb = p.achievements[b.id] ?? Infinity;
    return ta === tb ? 0 : ta < tb ? -1 : 1;
  });
  const shownBadges = allBadges ? badgeOrder : badgeOrder.slice(0, BADGES_COLLAPSED);
  const nameError = validateName(draft);

  const openName = () => {
    setDraft(p.playerName);
    setTouched(false);
    setSheet('name');
  };

  const saveName = () => {
    setTouched(true);
    if (nameError) {
      audio.play('error');
      haptic('warning');
      return;
    }
    setPlayerName(draft.trim());
    setSheet(null);
  };

  const recent = p.history.slice(0, 5);

  return (
    <Screen
      nav
      header={
        <TopBar
          title="Player Profile"
          showBack={false}
          right={
            <IconButton label="Settings" onClick={() => navigate('/settings')}>
              <Settings size={22} strokeWidth={1.75} />
            </IconButton>
          }
        />
      }
    >
      {/* ── Identity ─────────────────────────────────────────── */}
      <section className={s.hero}>
        <button type="button" className={s.avatarBtn} aria-label="Change avatar" onClick={() => {
          audio.unlock();
          audio.play('tap');
          haptic('light');
          setSheet('avatar');
        }}>
          <span className={s.halo} aria-hidden />
          <Avatar id={p.avatarId} size={124} ring="red" alt={AVATAR_NAMES[p.avatarId] ?? 'Avatar'} />
          <span className={s.avatarEdit} aria-hidden>
            <Camera size={15} strokeWidth={2} />
          </span>
        </button>

        <div className={s.nameRow}>
          <h2 className={s.name}>{p.playerName}</h2>
          <IconButton label="Edit player name" className={s.nameEdit} onClick={openName}>
            <Pencil size={16} strokeWidth={2} />
          </IconButton>
        </div>
        <div className={s.idRow}>
          <Pill tone={guest ? 'amber' : 'red'} className={guest ? undefined : s.handle}>
            {guest ? 'Guest' : `@${user?.username ?? p.playerName}`}
          </Pill>
          <span className={s.archetype}>{AVATAR_NAMES[p.avatarId]}</span>
        </div>
      </section>

      {/* ── Level + headline stats ───────────────────────────── */}
      <Glass className={s.card}>
        <div className={s.levelRow}>
          <Avatar id={p.avatarId} size={46} />
          <div className={s.levelInfo}>
            <div className={s.levelTop}>
              <b>Level {lv.level}</b>
              <span className="tabular">
                {formatNumber(lv.into)} / {formatNumber(lv.cap)} XP
              </span>
            </div>
            <ProgressBar value={lv.pct} tone="xp" height={5} spark label={`Level ${lv.level} progress`} />
            <span className={s.levelNext}>
              {formatNumber(lv.cap - lv.into)} XP to level {lv.level + 1}
            </span>
          </div>
        </div>
        <Divider className={s.cardDivider} />
        <StatRow
          stats={[
            { value: p.gamesPlayed, label: 'Games' },
            { value: p.wins, label: 'Wins' },
            { value: `${winRate(p)}%`, label: 'Win Rate' },
            { value: `#${formatNumber(rank)}`, label: 'Rank', accent: rank <= 50 },
          ]}
        />
      </Glass>

      {guest && (
        <button
          type="button"
          className={s.guestBanner}
          onClick={() => {
            audio.unlock();
            audio.play('tap');
            haptic('light');
            navigate('/register');
          }}
        >
          <span className={s.guestIcon} aria-hidden>
            <ShieldAlert size={20} />
          </span>
          <span className={s.guestText}>
            <b>Create an account to secure your progress</b>
            <small>Guest data lives only on this device.</small>
          </span>
          <ChevronRight size={18} className={s.guestChev} aria-hidden />
        </button>
      )}

      {/* ── Achievements ─────────────────────────────────────── */}
      <section className={s.section}>
        <h2 className="section-title">
          Achievements
          <small className="tabular">
            {earnedCount} / {ACHIEVEMENTS.length}
          </small>
        </h2>
        <div className={s.badgeGrid} id="profile-badges">
          {shownBadges.map((a) => {
            const unlocked = a.id in p.achievements;
            return (
              <button
                key={a.id}
                type="button"
                className={[s.badgeCell, !unlocked && s.badgeLocked].filter(Boolean).join(' ')}
                aria-label={`${a.name}${unlocked ? '' : ' (locked)'}`}
                onClick={() => {
                  audio.unlock();
                  audio.play('select');
                  haptic('light');
                  setBadge(a);
                  setBadgeOpen(true);
                }}
              >
                <Badge tier={a.tier} icon={a.icon} size={48} locked={!unlocked} />
                <span className={s.badgeName}>{a.name}</span>
              </button>
            );
          })}
        </div>
        {badgeOrder.length > BADGES_COLLAPSED && (
          <button
            type="button"
            className={[s.moreBtn, allBadges && s.moreOpen].filter(Boolean).join(' ')}
            aria-expanded={allBadges}
            aria-controls="profile-badges"
            onClick={() => {
              audio.unlock();
              audio.play('tap');
              haptic('light');
              setAllBadges((v) => !v);
            }}
          >
            <span>{allBadges ? 'Show fewer' : `View all ${ACHIEVEMENTS.length} achievements`}</span>
            <ChevronDown size={16} strokeWidth={2.2} aria-hidden />
          </button>
        )}
      </section>

      {/* ── Statistics ───────────────────────────────────────── */}
      <section className={s.section}>
        <h2 className="section-title">Statistics</h2>
        <Glass className={s.statGrid}>
          <Stat icon={<Crown size={17} fill="currentColor" strokeWidth={1.5} />} tone="gold" value={formatNumber(p.points)} label="Survival points" />
          <Stat icon={<Gem size={16} fill="currentColor" strokeWidth={1.5} />} tone="red" value={formatNumber(p.gems)} label="Gems" />
          <Stat icon={<Flame size={17} />} value={p.bestStreak} label="Best streak" />
          <Stat icon={<TrendingUp size={17} />} value={p.streak} label="Current streak" />
          <Stat
            icon={<Timer size={17} />}
            value={p.bests.reactionMs ? <>{Math.round(p.bests.reactionMs)}<i>ms</i></> : '—'}
            label="Best reaction"
          />
          <Stat icon={<Waypoints size={17} />} value={p.bests.patternLength ?? '—'} label="Longest pattern" />
          <Stat
            icon={<MousePointerClick size={17} />}
            value={p.bests.tapsPerSec ? <>{p.bests.tapsPerSec.toFixed(1)}<i>/s</i></> : '—'}
            label="Taps per second"
          />
          <Stat icon={<HandHeart size={17} />} value={p.empathy > 0 ? `+${p.empathy}` : p.empathy} label="Empathy" />
        </Glass>
      </section>

      {/* ── Suit mastery ─────────────────────────────────────── */}
      <section className={s.section}>
        <h2 className="section-title">Suit Mastery</h2>
        <Glass className={s.suitList}>
          {SUIT_ORDER.map((id) => {
            const suit = SUITS[id];
            const { cleared, total } = suitProgress(id, p);
            const done = cleared === total && total > 0;
            return (
              <button
                key={id}
                type="button"
                className={s.suitRow}
                onClick={() => {
                  audio.unlock();
                  audio.play('tap');
                  haptic('light');
                  navigate(`/cards/${id}`);
                }}
                aria-label={`${suit.name}: ${cleared} of ${total} trials cleared`}
              >
                <span className={[s.suitGlyph, suit.tone === 'red' && s.suitGlyphRed].filter(Boolean).join(' ')} aria-hidden>
                  <SuitIcon suit={id} size={24} finish={suit.tone === 'red' ? 'ruby' : 'chrome'} />
                </span>
                <span className={s.suitBody}>
                  <span className={s.suitTop}>
                    <b>{suit.name}</b>
                    <small>{suit.category}</small>
                    <span className={[s.suitCount, done && s.suitDone].filter(Boolean).join(' ')}>
                      <span className="tabular">{cleared}</span>/{total}
                    </span>
                  </span>
                  <ProgressBar value={total ? cleared / total : 0} tone={done ? 'gold' : 'red'} height={4} />
                </span>
              </button>
            );
          })}
        </Glass>
      </section>

      {/* ── Recent trials ────────────────────────────────────── */}
      <section className={s.section}>
        <h2 className="section-title">
          Recent Trials
          {p.history.length > 0 && <small>{p.history.length} played</small>}
        </h2>
        {recent.length === 0 ? (
          <Glass className={s.empty}>
            <p>No trials yet. The city is waiting.</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/cards')}>
              Choose your card
            </Button>
          </Glass>
        ) : (
          <Glass as="ul" className={s.historyList}>
            {recent.map((h, i) => {
              const c = getChallenge(h.challengeId);
              const won = h.outcome === 'win';
              return (
                <li key={`${h.challengeId}-${h.at}-${i}`} className={s.historyRow}>
                  <span
                    className={[s.historyGlyph, won ? s.historyWon : s.historyLost, c && SUITS[c.suit].tone === 'red' && s.historyRed]
                      .filter(Boolean)
                      .join(' ')}
                    aria-hidden
                  >
                    {c ? <SuitIcon suit={c.suit} size={18} /> : null}
                    {c && <em>{c.rank}</em>}
                  </span>
                  <span className={s.historyBody}>
                    <b>{c?.title ?? 'Unknown trial'}</b>
                    <small>
                      {relativeTime(h.at)} · Score {h.score}
                    </small>
                  </span>
                  <span className={s.historyRight}>
                    <Pill tone={won ? 'green' : 'red'}>{won ? 'Won' : 'Lost'}</Pill>
                    <span className={[s.historyPts, 'tabular'].join(' ')}>
                      {h.points > 0 ? `+${formatNumber(h.points)}` : '0'} pts
                    </span>
                  </span>
                </li>
              );
            })}
          </Glass>
        )}
      </section>

      {/* ── Sheets ───────────────────────────────────────────── */}
      <AppSheet open={sheet === 'avatar'} onClose={() => setSheet(null)} label="Choose your avatar">
        <SheetHead kicker="Identity" title="Choose your survivor" />
        <div className={s.avatarGrid}>
          {AVATARS.map((_, i) => {
            const current = i === p.avatarId;
            return (
              <button
                key={i}
                type="button"
                className={[s.avatarPick, current && s.avatarCurrent].filter(Boolean).join(' ')}
                aria-pressed={current}
                aria-label={AVATAR_NAMES[i]}
                onClick={() => {
                  audio.play('select');
                  haptic('light');
                  if (!current) setAvatar(i);
                  setSheet(null);
                }}
              >
                <span className={s.avatarPickImg}>
                  <Avatar id={i} size={62} ring={current ? 'red' : 'none'} />
                  {current && (
                    <span className={s.avatarCheck} aria-hidden>
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className={s.avatarPickName}>{AVATAR_NAMES[i]?.replace(/^The /, '')}</span>
              </button>
            );
          })}
        </div>
      </AppSheet>

      <AppSheet open={sheet === 'name'} onClose={() => setSheet(null)} label="Edit player name" focusInput>
        <SheetHead kicker="Identity" title="Player name">
          This is how other survivors see you on the leaderboard.
        </SheetHead>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <SheetField
            label="Display name"
            error={touched ? nameError : null}
            hint={
              <>
                <span>3–16 characters</span>
                <span className="tabular">{draft.trim().length} / 16</span>
              </>
            }
          >
            <SheetInput
              value={draft}
              maxLength={16}
              autoComplete="nickname"
              autoCapitalize="words"
              spellCheck={false}
              aria-invalid={touched && !!nameError}
              onChange={(e) => {
                setDraft(e.target.value);
              }}
              onBlur={() => setTouched(true)}
            />
          </SheetField>
          <SheetActions>
            <Button type="submit" block disabled={touched && !!nameError}>
              Save name
            </Button>
            <Button variant="ghost" block sfx="back" onClick={() => setSheet(null)}>
              Cancel
            </Button>
          </SheetActions>
        </form>
      </AppSheet>

      <AppSheet open={badgeOpen} onClose={() => setBadgeOpen(false)} label={badge ? `${badge.name} achievement` : 'Achievement'}>
        {badge && (
          <div className={s.badgeSheet}>
            <span className={s.badgeSheetArt}>
              <Badge tier={badge.tier} icon={badge.icon} size={104} locked={!(badge.id in p.achievements)} />
            </span>
            <SheetHead
              kicker={`${TIER_LABEL[badge.tier]} badge${badge.id in p.achievements ? '' : ' · Locked'}`}
              title={badge.name}
            >
              {badge.description}
            </SheetHead>
            <p className={s.badgeSheetDate}>
              {badge.id in p.achievements ? (
                <>
                  <Check size={14} strokeWidth={2.5} /> Unlocked {formatDate(p.achievements[badge.id])}
                </>
              ) : (
                'Not yet earned'
              )}
            </p>
            <Button variant="secondary" block onClick={() => setBadgeOpen(false)} sfx="back">
              Close
            </Button>
          </div>
        )}
      </AppSheet>
    </Screen>
  );
}
