/*
 * ♣ Pattern relay (Simon) — watch the signal sequence, repeat it exactly.
 * Config: challenge.game.pattern { pads, targetLength, stepMs, lives }
 */
import { Eye, Hand } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SuitIcon } from '../components/ui/SuitIcon';
import type { PatternConfig, SuitId } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useClock } from './kit/clock';
import { isKeyboardClick, isPrimaryPointer, useElementSize, useFinish } from './kit/hooks';
import { Hud, HudStat, Phase, Pips } from './kit/Hud';
import { clamp, mulberry32, randomSeed } from './kit/rng';
import k from './kit/kit.module.css';
import s from './PatternGame.module.css';
import type { GameProps } from './types';

interface Pad {
  name: string;
  glyph: ReactNode;
  /** light colour when the pad fires */
  tone: 'red' | 'white';
  /** frequency multiplier for the pad's tone */
  pitch: number;
}

const suitGlyph = (suit: SuitId) => <SuitIcon suit={suit} size="100%" />;

/* Two original geometric glyphs for the 6-pad relay. */
const SPARK = (
  <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
    <path d="M50 4 L59 41 L96 50 L59 59 L50 96 L41 59 L4 50 L41 41 Z" fill="currentColor" />
  </svg>
);
const HEX = (
  <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
    <path
      d="M50 6 L88 28 L88 72 L50 94 L12 72 L12 28 Z M50 30 L31 41 L31 59 L50 70 L69 59 L69 41 Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

/* minor-pentatonic-ish ladder so any sequence sounds musical */
const PADS: Pad[] = [
  { name: 'Spade', glyph: suitGlyph('spade'), tone: 'white', pitch: 0.84 },
  { name: 'Heart', glyph: suitGlyph('heart'), tone: 'red', pitch: 1 },
  { name: 'Diamond', glyph: suitGlyph('diamond'), tone: 'red', pitch: 1.19 },
  { name: 'Club', glyph: suitGlyph('club'), tone: 'white', pitch: 1.34 },
  { name: 'Spark', glyph: SPARK, tone: 'red', pitch: 1.5 },
  { name: 'Hex', glyph: HEX, tone: 'white', pitch: 1.78 },
];

type Step = 'ready' | 'watch' | 'repeat' | 'good' | 'miss' | 'won' | 'lost';

const DEFAULTS: PatternConfig = { pads: 4, targetLength: 5, stepMs: 620, lives: 2 };
const START_LEN = 2;
const GAP = 12;

function makeSequence(len: number, pads: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  while (out.length < len) {
    const p = Math.floor(rand() * pads);
    // never three of the same pad in a row
    if (out.length >= 2 && out[out.length - 1] === p && out[out.length - 2] === p) continue;
    out.push(p);
  }
  return out;
}

export default function PatternGame({ challenge, paused, onFinish }: GameProps) {
  const cfg = challenge.game.type === 'pattern' ? challenge.game.pattern : DEFAULTS;
  const padCount = cfg.pads === 6 ? 6 : 4;
  const target = Math.max(START_LEN, cfg.targetLength);
  const lives = Math.max(0, cfg.lives);

  const clock = useClock(paused);
  const { finish } = useFinish(onFinish);
  const [seed] = useState(randomSeed);
  const [seq] = useState(() => makeSequence(target, padCount, seed));

  const [step, setStep] = useState<Step>('ready');
  const [len, setLen] = useState(START_LEN);
  const [input, setInput] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const [pressed, setPressed] = useState<{ pad: number; key: number; wrong?: boolean } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [best, setBest] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const pressSeq = useRef(0);

  const stepDur = Math.round(cfg.stepMs * Math.pow(0.96, len - START_LEN));

  const stageRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(stageRef);
  const rows = padCount / 2;
  // the arena also holds the status line (~52px) and a 22px gap above the pads
  const padW = Math.max(84, Math.floor(Math.min((size.width - GAP) / 2, 190)));
  const rowSpace = (size.height - 74 - GAP * (rows - 1)) / rows;
  const padH = Math.max(84, Math.floor(Math.min(rowSpace, padW * 1.22)));

  /* ready → watch */
  useEffect(() => {
    if (step !== 'ready') return;
    const id = clock.after(700, () => setStep('watch'));
    return () => clock.cancel(id);
  }, [step, clock]);

  /* playback */
  useEffect(() => {
    if (step !== 'watch') return;
    const ids: number[] = [];
    const lead = 650;
    const on = Math.round(stepDur * 0.62);
    for (let i = 0; i < len; i++) {
      const pad = seq[i];
      ids.push(
        clock.after(lead + i * stepDur, () => {
          setLit(pad);
          audio.play('select', { pitch: PADS[pad].pitch });
        }),
      );
      ids.push(clock.after(lead + i * stepDur + on, () => setLit(null)));
    }
    ids.push(
      clock.after(lead + len * stepDur, () => {
        setLit(null);
        setInput(0);
        setStep('repeat');
      }),
    );
    return () => ids.forEach((id) => clock.cancel(id));
  }, [step, len, stepDur, seq, clock]);

  const flashPad = (pad: number, wrong = false) => {
    const key = ++pressSeq.current;
    setPressed({ pad, key, wrong });
    clock.after(wrong ? 420 : 200, () => setPressed((p) => (p && p.key === key ? null : p)));
  };

  const press = (pad: number) => {
    if (paused || step !== 'repeat') return;
    if (seq[input] === pad) {
      flashPad(pad);
      audio.play('select', { pitch: PADS[pad].pitch });
      haptic('light');
      const next = input + 1;
      if (next < len) {
        setInput(next);
        return;
      }
      // sequence complete
      setInput(next);
      setBest(len);
      if (len >= target) {
        setStep('won');
        clock.after(260, () => audio.play('unlock'));
        const score = Math.max(40, 100 - 15 * mistakes);
        clock.after(1100, () =>
          finish({
            outcome: 'win',
            score,
            summary: `Relayed a ${len}-signal sequence · ${mistakes} mistake${mistakes === 1 ? '' : 's'}`,
            stats: { patternLength: len, mistakes },
          }),
        );
      } else {
        setStep('good');
        clock.after(220, () => haptic('success'));
        clock.after(850, () => {
          setLen(len + 1);
          setStep('watch');
        });
      }
      return;
    }

    // wrong pad
    const m = mistakes + 1;
    setMistakes(m);
    flashPad(pad, true);
    setFlashKey((v) => v + 1);
    audio.play('error');
    haptic('error');
    if (lives - m < 0) {
      setStep('lost');
      const done = best;
      const score = clamp(Math.round(35 * (done / target)), 0, 35);
      clock.after(1200, () =>
        finish({
          outcome: 'loss',
          score,
          summary: `Signal lost at ${len} / ${target}`,
          stats: { patternLength: done, mistakes: m },
        }),
      );
      return;
    }
    setStep('miss');
    clock.after(1050, () => setStep('watch'));
  };

  const livesLeft = Math.max(0, lives - mistakes);

  let phase: ReactNode;
  switch (step) {
    case 'ready':
      phase = <Phase tone="dim">Stand by</Phase>;
      break;
    case 'watch':
      phase = (
        <Phase tone="red" icon={<Eye size={17} strokeWidth={2.2} />}>
          Watch
        </Phase>
      );
      break;
    case 'repeat':
      phase = (
        <Phase tone="white" icon={<Hand size={17} strokeWidth={2.2} />}>
          Repeat
        </Phase>
      );
      break;
    case 'good':
      phase = <Phase tone="green">Relayed</Phase>;
      break;
    case 'miss':
      phase = <Phase tone="red">Wrong signal · replay</Phase>;
      break;
    case 'won':
      phase = <Phase tone="green">Handshake complete</Phase>;
      break;
    case 'lost':
      phase = <Phase tone="red">Signal lost</Phase>;
      break;
  }

  return (
    <div className={[k.root, paused && k.paused].filter(Boolean).join(' ')}>
      <Hud>
        <HudStat label="Sequence" value={len} of={target} tone={step === 'won' ? 'green' : 'default'} />
        <Pips total={lives} left={livesLeft} />
        <HudStat label="Tempo" value={stepDur} unit="ms" tone="dim" />
      </Hud>

      <div ref={stageRef} className={s.arena}>
        <div className={s.status}>
          {phase}
          <div className={s.progress} aria-hidden>
            {Array.from({ length: len }, (_, i) => (
              <span
                key={i}
                className={[
                  s.tick,
                  (step === 'repeat' || step === 'good' || step === 'won') && i < input && s.tickOn,
                  step === 'miss' && s.tickMiss,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </div>
        </div>

        <div
          className={[s.pads, step === 'won' && s.allLit].filter(Boolean).join(' ')}
          style={{ gridTemplateColumns: `repeat(2, ${padW}px)`, '--pw': `${padW}px`, '--ph': `${padH}px` } as CSSProperties}
          role="group"
          aria-label="Signal pads"
        >
          {PADS.slice(0, padCount).map((p, i) => {
            const isLit = lit === i || (pressed?.pad === i && !pressed.wrong);
            const isWrong = pressed?.pad === i && pressed.wrong;
            return (
              <button
                key={p.name}
                type="button"
                className={[
                  s.pad,
                  p.tone === 'red' ? s.toneRed : s.toneWhite,
                  isLit && s.lit,
                  isWrong && s.wrong,
                  step !== 'repeat' && s.locked,
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`${p.name} pad`}
                aria-disabled={step !== 'repeat'}
                onPointerDown={(e) => isPrimaryPointer(e) && press(i)}
                onClick={(e) => isKeyboardClick(e) && press(i)}
              >
                <span className={s.face} aria-hidden />
                <span className={s.glyph} aria-hidden>
                  {p.glyph}
                </span>
                <span className={s.corner} aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {flashKey > 0 && <span key={flashKey} className={k.flash} aria-hidden />}
    </div>
  );
}
