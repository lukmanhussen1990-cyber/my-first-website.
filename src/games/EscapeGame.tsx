/*
 * ♣ Escape room — search the room, collect evidence, crack the keypad code.
 * Config: challenge.game.escape { room, intro, code, clues, decoySpots, maxAttempts }
 */
import {
  Anchor,
  Archive,
  BatteryCharging,
  CalendarDays,
  ClipboardList,
  CupSoda,
  Delete,
  DoorClosed,
  FileText,
  Grid3x3,
  Inbox,
  Lock,
  LockOpen,
  Package,
  Presentation,
  Radio,
  Refrigerator,
  ScanSearch,
  Snowflake,
  Thermometer,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { SUIT_SCENE } from '../assets/art';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import type { EscapeConfig } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useClock } from './kit/clock';
import { useFinish } from './kit/hooks';
import { Typed } from './kit/Hud';
import { hashString, mulberry32, shuffle } from './kit/rng';
import k from './kit/kit.module.css';
import s from './EscapeGame.module.css';
import type { GameProps } from './types';

const ICONS: [RegExp, LucideIcon][] = [
  [/clipboard|log|ledger/, ClipboardList],
  [/white ?board|board|notice/, Presentation],
  [/locker|cabinet/, Archive],
  [/calendar|date/, CalendarDays],
  [/drawer|desk/, Inbox],
  [/vending|soda|coffee/, CupSoda],
  [/fuse|breaker|switch/, Zap],
  [/thermostat|thermo|temperature/, Thermometer],
  [/freezer|fridge|cooler/, Refrigerator],
  [/door|hatch/, DoorClosed],
  [/radio|speaker|intercom/, Radio],
  [/hook/, Anchor],
  [/generator|battery|power/, BatteryCharging],
  [/drain|grate|vent/, Grid3x3],
  [/crate|box|supply|package/, Package],
  [/tool|wrench|bench/, Wrench],
  [/ice|frost|snow/, Snowflake],
];

function spotIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  return ICONS.find(([re]) => re.test(n))?.[1] ?? ScanSearch;
}

function SpotIcon({ name, size, className }: { name: string; size: number; className?: string }) {
  return createElement(spotIcon(name), { size, strokeWidth: 1.75, className, 'aria-hidden': true });
}

interface Spot {
  name: string;
  clueId: string | null;
  text: string | null;
}

type Step = 'search' | 'open' | 'locked';

const DEFAULTS: EscapeConfig = {
  room: 'Sealed Room',
  intro: 'The door locks behind you.',
  code: '000',
  clues: [],
  decoySpots: [],
  maxAttempts: 3,
};

export default function EscapeGame({ challenge, paused, onFinish }: GameProps) {
  const cfg = challenge.game.type === 'escape' ? challenge.game.escape : DEFAULTS;
  const codeLen = cfg.code.length;

  const clock = useClock(paused);
  const { finish } = useFinish(onFinish);

  const spots = useMemo<Spot[]>(() => {
    const all: Spot[] = [
      ...cfg.clues.map((c) => ({ name: c.spot, clueId: c.id, text: c.text })),
      ...cfg.decoySpots.map((d) => ({ name: d, clueId: null, text: null })),
    ];
    return shuffle(all, mulberry32(hashString(`${challenge.id}:${cfg.room}`)));
  }, [cfg, challenge.id]);

  const [searched, setSearched] = useState<ReadonlySet<string>>(() => new Set());
  const [evidence, setEvidence] = useState<string[]>([]); // spot names, in order found
  const [open, setOpen] = useState<{ spot: Spot; fresh: boolean } | null>(null);
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(0);
  const [step, setStep] = useState<Step>('search');
  const [denyKey, setDenyKey] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'red' | 'green' | 'dim' } | null>(null);

  const dense = spots.length % 4 === 0 && spots.length > 6;
  const decoysSearched = spots.filter((sp) => sp.clueId === null && searched.has(sp.name)).length;
  const attemptsLeft = cfg.maxAttempts - wrong;
  const live = step === 'search' && !paused;

  const inspect = (spot: Spot) => {
    if (!live) return;
    const first = !searched.has(spot.name);
    if (first) {
      setSearched((prev) => new Set(prev).add(spot.name));
      if (spot.clueId) {
        setEvidence((prev) => [...prev, spot.name]);
        audio.play('reveal');
        haptic('medium');
      } else {
        audio.play('flip');
        haptic('light');
      }
    } else {
      audio.play('tap');
      haptic('light');
    }
    setOpen({ spot, fresh: first });
  };

  const close = useCallback(() => setOpen(null), []);

  const typeDigit = (d: string) => {
    if (!live || entry.length >= codeLen) return;
    audio.play('tick', { pitch: 1 + Number(d) * 0.03 });
    haptic('light');
    setEntry(entry + d);
    setFeedback(null);
  };

  const clear = (all = true) => {
    if (!live || entry.length === 0) return;
    setEntry(all ? '' : entry.slice(0, -1));
    audio.play('back');
    haptic('light');
  };

  const submit = () => {
    if (!live || entry.length !== codeLen) return;
    const tries = wrong + 1;
    if (entry === cfg.code) {
      setStep('open');
      setFeedback({ text: 'Access granted', tone: 'green' });
      audio.play('unlock');
      haptic('success');
      const score = Math.max(40, 100 - 20 * wrong - 3 * decoysSearched);
      clock.after(1900, () =>
        finish({
          outcome: 'win',
          score,
          summary: `Code cracked in ${tries} attempt${tries === 1 ? '' : 's'} · ${evidence.length} / ${cfg.clues.length} clues`,
          stats: { attempts: tries, cluesFound: evidence.length },
        }),
      );
      return;
    }
    const w = wrong + 1;
    setWrong(w);
    setDenyKey((v) => v + 1);
    audio.play('error');
    haptic('error');
    const left = cfg.maxAttempts - w;
    if (left <= 0) {
      setStep('locked');
      setFeedback({ text: 'Keypad locked', tone: 'red' });
      clock.after(1500, () =>
        finish({
          outcome: 'loss',
          score: Math.min(30, 8 + 6 * evidence.length),
          summary: `Locked out after ${w} wrong code${w === 1 ? '' : 's'}`,
          stats: { attempts: w, cluesFound: evidence.length },
        }),
      );
      return;
    }
    setFeedback({ text: `Access denied · ${left} attempt${left === 1 ? '' : 's'} left`, tone: 'red' });
    clock.after(460, () => setEntry(''));
  };

  /* hardware keyboard: digits, Backspace, Enter (latest handlers via ref) */
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useLayoutEffect(() => {
    onKeyRef.current = (e: KeyboardEvent) => {
      if (!live || open || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) typeDigit(e.key);
      else if (e.key === 'Backspace') clear(false);
      else if (e.key === 'Enter') submit();
      else return;
      e.preventDefault();
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onKeyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={[k.root, s.root, paused && k.paused].filter(Boolean).join(' ')}>
      {/* ── Room ─────────────────────────────────────── */}
      <section className={s.room} aria-label={cfg.room}>
        <img className={s.roomArt} src={SUIT_SCENE.club} alt="" draggable={false} />
        <span className={[s.roomScan, 'scanlines'].join(' ')} aria-hidden />
        <div className={s.roomBody}>
          <div className={s.roomHead}>
            <span className={s.kicker}>Location</span>
            <span className={s.searchCount}>
              {searched.size} / {spots.length} searched
            </span>
          </div>
          <h2 className={s.roomName}>{cfg.room}</h2>
          <p className={s.intro}>
            <Typed text={cfg.intro.replace(/_ (?=_)/g, '_\u00a0')} cps={34} paused={paused} />
          </p>
        </div>
      </section>

      {/* ── Hotspots ─────────────────────────────────── */}
      <div
        className={[s.spots, dense && s.spotsDense].filter(Boolean).join(' ')}
        style={{ '--cols': dense ? 4 : 3 } as CSSProperties}
      >
        {spots.map((sp, i) => {
          const done = searched.has(sp.name);
          const clue = done && sp.clueId !== null;
          return (
            <button
              key={sp.name}
              type="button"
              className={[s.spot, done && s.spotDone, clue && s.spotClue].filter(Boolean).join(' ')}
              style={{ '--i': i } as CSSProperties}
              onClick={() => inspect(sp)}
              disabled={step !== 'search'}
              aria-label={`Search ${sp.name}${done ? (clue ? ' — evidence found' : ' — empty') : ''}`}
            >
              <SpotIcon name={sp.name} size={22} className={s.spotIcon} />
              <span className={s.spotName}>{sp.name}</span>
              {done && <span className={s.spotTag}>{clue ? 'Clue' : 'Empty'}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Evidence ─────────────────────────────────── */}
      <div className={s.evidence}>
        <span className={s.evLabel}>Evidence</span>
        <div className={s.evList}>
          {evidence.length === 0 ? (
            <span className={s.evEmpty}>Nothing found yet — search the room.</span>
          ) : (
            evidence.map((name) => {
              const sp = spots.find((x) => x.name === name)!;
              return (
                <button
                  key={name}
                  type="button"
                  className={s.chip}
                  onClick={() => {
                    if (!live) return;
                    audio.play('tap');
                    setOpen({ spot: sp, fresh: false });
                  }}
                  aria-label={`Re-read clue: ${name}`}
                >
                  <FileText size={13} strokeWidth={2} aria-hidden />
                  {name}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Keypad ───────────────────────────────────── */}
      <section
        className={[s.keypad, step === 'open' && s.keypadOpen, step === 'locked' && s.keypadLocked]
          .filter(Boolean)
          .join(' ')}
        aria-label="Door keypad"
      >
        <div className={s.display}>
          <span className={s.lock} aria-hidden>
            {step === 'open' ? <LockOpen size={20} strokeWidth={2} /> : <Lock size={20} strokeWidth={2} />}
          </span>
          <div
            key={denyKey}
            className={[s.slots, denyKey > 0 && step !== 'open' && k.shake].filter(Boolean).join(' ')}
            role="status"
            aria-label={`Code entered: ${entry.length} of ${codeLen} digits`}
          >
            {Array.from({ length: codeLen }, (_, i) => (
              <span
                key={i}
                className={[s.slot, i < entry.length && s.slotFilled, i === entry.length && step === 'search' && s.slotCaret]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--i': i } as CSSProperties}
              >
                {entry[i] ?? ''}
              </span>
            ))}
          </div>
          <div className={s.attempts} aria-label={`${attemptsLeft} attempts left`}>
            <span className={s.attLabel}>Tries</span>
            <span className={s.attPips}>
              {Array.from({ length: cfg.maxAttempts }, (_, i) => (
                <span key={i} className={[s.attPip, i < attemptsLeft && s.attPipOn].filter(Boolean).join(' ')} />
              ))}
            </span>
          </div>
        </div>
        <p className={[s.feedback, feedback && s[`fb_${feedback.tone}`]].filter(Boolean).join(' ')} aria-live="assertive">
          {feedback?.text ?? `Enter the ${codeLen}-digit code`}
        </p>
        <div className={s.keys}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
            <button
              key={d}
              type="button"
              className={s.key}
              onClick={() => typeDigit(d)}
              disabled={step !== 'search'}
              aria-label={`Digit ${d}`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className={s.actions}>
          <button
            type="button"
            className={[s.key, s.keyClear].join(' ')}
            onClick={() => clear(true)}
            disabled={step !== 'search' || entry.length === 0}
          >
            <Delete size={17} strokeWidth={2} aria-hidden />
            Clear
          </button>
          <button
            type="button"
            className={[s.key, s.keyEnter].join(' ')}
            onClick={submit}
            disabled={step !== 'search' || entry.length !== codeLen}
          >
            Enter
          </button>
        </div>
      </section>

      {denyKey > 0 && <span key={`f${denyKey}`} className={k.flash} aria-hidden />}

      {step === 'open' && (
        <div className={s.door} aria-hidden>
          <span className={s.doorLight} />
          <span className={[s.doorHalf, s.doorL].join(' ')} />
          <span className={[s.doorHalf, s.doorR].join(' ')} />
          <span className={s.doorText}>Door unlocked</span>
        </div>
      )}

      <Sheet open={open !== null} onClose={close} label={open ? open.spot.name : 'Search'}>
        {open && (
          <div className={s.sheet}>
            <div className={s.sheetHead}>
              <span className={[s.sheetIcon, open.spot.clueId && s.sheetIconClue].filter(Boolean).join(' ')}>
                <SpotIcon name={open.spot.name} size={24} />
              </span>
              <div>
                <span className={[s.sheetKicker, open.spot.clueId && s.sheetKickerClue].filter(Boolean).join(' ')}>
                  {open.spot.clueId ? 'Evidence' : 'Searched'}
                </span>
                <h3 className={s.sheetTitle}>{open.spot.name}</h3>
              </div>
            </div>
            <div className={[s.note, !open.spot.text && s.noteEmpty].filter(Boolean).join(' ')}>
              {open.fresh ? (
                <Typed key={open.spot.name} text={open.spot.text ?? 'Nothing useful here.'} cps={46} paused={paused} />
              ) : (
                <span className={s.noteText}>{open.spot.text ?? 'Nothing useful here.'}</span>
              )}
            </div>
            <Button variant="secondary" block onClick={close} sfx="back">
              Back to the room
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
