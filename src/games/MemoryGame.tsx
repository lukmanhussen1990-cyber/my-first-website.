/*
 * ♥ Memory — memorise the spread, then match every pair.
 * Config: challenge.game.memory { pairs, previewSec, maxMistakes }
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ART } from '../assets/art';
import { SuitIcon } from '../components/ui/SuitIcon';
import { SUIT_ORDER } from '../data/suits';
import type { CardRank, MemoryConfig, SuitId } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useClock } from './kit/clock';
import { useElementSize, useFinish } from './kit/hooks';
import { Hud, HudStat, Phase } from './kit/Hud';
import { clamp, mulberry32, randomSeed, shuffle } from './kit/rng';
import k from './kit/kit.module.css';
import s from './MemoryGame.module.css';
import type { GameProps } from './types';

const RANKS: CardRank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const RANK_NAME: Record<CardRank, string> = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
  '10': 'Ten',
  '9': 'Nine',
  '8': 'Eight',
  '7': 'Seven',
  '6': 'Six',
  '5': 'Five',
  '4': 'Four',
  '3': 'Three',
  '2': 'Two',
};
const RED: Record<SuitId, boolean> = { heart: true, diamond: true, spade: false, club: false };

interface Card {
  pair: number;
  rank: CardRank;
  suit: SuitId;
}

type Step = 'deal' | 'preview' | 'play' | 'won' | 'lost';

const DEFAULTS: MemoryConfig = { pairs: 6, previewSec: 3, maxMistakes: 8 };
const GAP = 9;
const FLIP_BACK_MS = 700;
const MISMATCH_FEEDBACK_MS = 330;

function deal(pairs: number, seed: number): Card[] {
  const rand = mulberry32(seed);
  const ranks = shuffle(RANKS, rand);
  const suits = shuffle(SUIT_ORDER, rand);
  const faces = Array.from({ length: pairs }, (_, i) => ({
    pair: i,
    rank: ranks[i % ranks.length],
    suit: suits[i % 4],
  }));
  return shuffle([...faces, ...faces], rand);
}

/** Pick the column count that gives the largest 2:3 cards inside the stage. */
function layout(n: number, w: number, h: number) {
  let best = { cols: n <= 12 ? 3 : 4, cw: 60 };
  let bestScore = -Infinity;
  for (const cols of [3, 4, 5]) {
    const rows = Math.ceil(n / cols);
    const cw = Math.min((w - GAP * (cols - 1)) / cols, ((h - GAP * (rows - 1)) / rows) * (2 / 3), 112);
    const score = cw - (n % cols ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { cols, cw: Math.max(36, Math.floor(cw)) };
    }
  }
  return best;
}

export default function MemoryGame({ challenge, paused, onFinish }: GameProps) {
  const cfg = challenge.game.type === 'memory' ? challenge.game.memory : DEFAULTS;
  const { pairs, previewSec, maxMistakes } = cfg;

  const clock = useClock(paused);
  const { finish } = useFinish(onFinish);
  const [seed] = useState(randomSeed);
  const cards = useMemo(() => deal(pairs, seed), [pairs, seed]);

  const [step, setStep] = useState<Step>('deal');
  const [previewLeft, setPreviewLeft] = useState(Math.max(1, Math.round(previewSec)));
  const [up, setUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<ReadonlySet<number>>(() => new Set());
  const [mistakes, setMistakes] = useState(0);
  const [shaking, setShaking] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const playStart = useRef(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(stageRef);
  const { cols, cw } = layout(cards.length, size.width || 320, size.height || 420);

  /* deal → preview */
  useEffect(() => {
    if (step !== 'deal') return;
    const a = clock.after(60, () => audio.play('deal'));
    const b = clock.after(640, () => {
      audio.play('flip');
      setStep('preview');
    });
    return () => {
      clock.cancel(a);
      clock.cancel(b);
    };
  }, [step, clock]);

  /* preview countdown → play */
  useEffect(() => {
    if (step !== 'preview') return;
    const id = clock.after(1000, () => {
      if (previewLeft <= 1) {
        audio.play('flip');
        haptic('light');
        playStart.current = clock.now();
        setStep('play');
      } else {
        audio.play('tick');
        setPreviewLeft(previewLeft - 1);
      }
    });
    return () => clock.cancel(id);
  }, [step, previewLeft, clock]);

  const end = (outcome: 'win' | 'loss', mistakesNow: number, matchedNow: number) => {
    const seconds = Math.max(1, Math.round((clock.now() - playStart.current) / 1000));
    let score: number;
    if (outcome === 'win') {
      // small speed bonus: up to +8 for clearing in well under ~7 s per pair
      const speedBonus = clamp(Math.round(8 * (1 - seconds / (pairs * 7))), 0, 8);
      score = clamp(Math.max(35, 100 - 8 * mistakesNow) + speedBonus, 35, 100);
    } else {
      score = clamp(Math.round((matchedNow / pairs) * 30), 0, 30);
    }
    const summary =
      outcome === 'win'
        ? `All ${pairs} pairs in ${seconds} s · ${mistakesNow} mistake${mistakesNow === 1 ? '' : 's'}`
        : `${matchedNow} / ${pairs} pairs found · too many mistakes`;
    clock.after(outcome === 'win' ? 1150 : 1500, () =>
      finish({ outcome, score, summary, stats: { mistakes: mistakesNow, pairs: matchedNow, seconds } }),
    );
  };

  const flip = (i: number) => {
    if (paused || step !== 'play' || busy) return;
    const card = cards[i];
    if (up.includes(i) || matched.has(card.pair)) return;
    audio.play('flip');
    haptic('light');

    if (up.length === 0) {
      setUp([i]);
      return;
    }

    const j = up[0];
    if (cards[j].pair === card.pair) {
      const next = new Set(matched);
      next.add(card.pair);
      setMatched(next);
      setUp([]);
      clock.after(260, () => {
        audio.play('select', { pitch: 1.7 });
        haptic('medium');
      });
      if (next.size === pairs) {
        setStep('won');
        clock.after(520, () => audio.play('unlock'));
        end('win', mistakes, next.size);
      }
      return;
    }

    // mismatch: let the second card land face-up, then shake and flip both back
    const m = mistakes + 1;
    setUp([j, i]);
    setBusy(true);
    setMistakes(m);
    clock.after(MISMATCH_FEEDBACK_MS, () => {
      audio.play('error');
      haptic('error');
      setShaking([j, i]);
      setFlashKey((v) => v + 1);
    });
    if (m > maxMistakes) {
      clock.after(MISMATCH_FEEDBACK_MS + 260, () => setStep('lost'));
      end('loss', m, matched.size);
      return;
    }
    clock.after(MISMATCH_FEEDBACK_MS + FLIP_BACK_MS, () => {
      setUp([]);
      setShaking([]);
      setBusy(false);
    });
  };

  const faceUp = (i: number) => step === 'preview' || step === 'lost' || matched.has(cards[i].pair) || up.includes(i);

  const danger = mistakes >= maxMistakes;

  return (
    <div className={[k.root, paused && k.paused].filter(Boolean).join(' ')}>
      <Hud>
        <HudStat label="Pairs" value={matched.size} of={pairs} tone={matched.size === pairs ? 'green' : 'default'} />
        <HudStat label="Mistakes" value={mistakes} of={maxMistakes} tone={danger ? 'red' : 'default'} />
      </Hud>

      {step === 'deal' && <Phase tone="dim">Shuffling the deck</Phase>}
      {step === 'preview' && (
        <Phase tone="red">
          Memorise <b className={s.count}>{previewLeft}</b>
        </Phase>
      )}
      {step === 'play' && <Phase tone={danger ? 'red' : 'white'}>{danger ? 'No mistakes left' : 'Find the pairs'}</Phase>}
      {step === 'won' && <Phase tone="green">All pairs found</Phase>}
      {step === 'lost' && <Phase tone="red">Eliminated</Phase>}

      <div ref={stageRef} className={s.stage}>
        <div
          className={[s.grid, step === 'deal' && s.dealing].filter(Boolean).join(' ')}
          style={{ gridTemplateColumns: `repeat(${cols}, ${cw}px)`, '--cw': `${cw}px` } as CSSProperties}
        >
          {cards.map((c, i) => {
            const isUp = faceUp(i);
            const isMatched = matched.has(c.pair);
            const red = RED[c.suit];
            return (
              <button
                key={i}
                type="button"
                className={[
                  s.card,
                  isMatched && s.matched,
                  shaking.includes(i) && s.shaking,
                  step === 'lost' && !isMatched && s.lostCard,
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--i': i } as CSSProperties}
                aria-label={
                  isUp
                    ? `${RANK_NAME[c.rank]} of ${c.suit}s${isMatched ? ', matched' : ''}`
                    : `Card ${i + 1}, face down`
                }
                disabled={step !== 'play' || isMatched}
                onClick={() => flip(i)}
              >
                <span className={[s.inner, isUp && s.up].filter(Boolean).join(' ')}>
                  <span className={s.back} aria-hidden>
                    <img src={ART.cardBack} alt="" draggable={false} />
                  </span>
                  <span className={[s.face, red ? s.red : s.silver].join(' ')} aria-hidden>
                    <span className={s.corner}>
                      <b>{c.rank}</b>
                      <SuitIcon suit={c.suit} size="1em" />
                    </span>
                    <span className={s.pip}>
                      <SuitIcon suit={c.suit} size="100%" finish={red ? 'ruby' : 'chrome'} />
                    </span>
                    <span className={[s.corner, s.cornerBr].join(' ')}>
                      <b>{c.rank}</b>
                      <SuitIcon suit={c.suit} size="1em" />
                    </span>
                  </span>
                </span>
                <span className={s.glow} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
      {flashKey > 0 && <span key={flashKey} className={k.flash} aria-hidden />}
    </div>
  );
}
