/*
 * ♠ Reaction — tap the instant the core burns red; ignore the cold-blue decoys.
 * Config: challenge.game.reaction { rounds, targetMs, minDelayMs, maxDelayMs, decoys }
 *
 * Timing uses pointerdown event timestamps against the first animation frame
 * after the signal is committed. Pausing cancels a pending or live signal and
 * re-arms it (with a fresh random delay) on resume.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { SuitIcon } from '../components/ui/SuitIcon';
import type { ReactionConfig } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { eventTime, isKeyboardClick, isPrimaryPointer, useFinish } from './kit/hooks';
import { Hud, HudStat } from './kit/Hud';
import { clamp, mulberry32, randomSeed } from './kit/rng';
import k from './kit/kit.module.css';
import s from './ReactionGame.module.css';
import type { GameProps } from './types';

type Ev = 'go' | 'decoy';
type Signal = 'wait' | 'go' | 'decoy' | 'result';

type LogEntry =
  | { kind: 'hit'; ms: number }
  | { kind: 'false' }
  | { kind: 'slow' }
  | { kind: 'decoy' };

type Shown = LogEntry | { kind: 'dodged' };

const DEFAULTS: ReactionConfig = { rounds: 5, targetMs: 450, minDelayMs: 1200, maxDelayMs: 3200, decoys: 0 };
const DECOY_MS = 900;
const RESULT_MS = 950;

function makePlan(rounds: number, decoys: number, rand: () => number): Ev[] {
  const plan: Ev[] = Array.from({ length: rounds }, () => 'go');
  for (let d = 0; d < decoys; d++) {
    // never first, never two decoys back to back
    for (let tries = 0; tries < 20; tries++) {
      const at = 1 + Math.floor(rand() * plan.length);
      if (plan[at - 1] === 'decoy' || plan[at] === 'decoy') continue;
      plan.splice(at, 0, 'decoy');
      break;
    }
  }
  return plan;
}

function chipText(e: LogEntry): string {
  switch (e.kind) {
    case 'hit':
      return String(Math.round(e.ms));
    case 'false':
      return 'False start';
    case 'slow':
      return 'Too slow';
    case 'decoy':
      return 'Decoy hit';
  }
}

export default function ReactionGame({ challenge, paused, onFinish }: GameProps) {
  const cfg = challenge.game.type === 'reaction' ? challenge.game.reaction : DEFAULTS;
  const { rounds, targetMs, minDelayMs, maxDelayMs, decoys } = cfg;
  const allowedMisses = Math.floor(rounds / 3);
  const tooSlowMs = Math.max(1100, Math.round(targetMs * 2.6));

  const { finish } = useFinish(onFinish);
  const [rand] = useState(() => mulberry32(randomSeed()));
  const [plan] = useState(() => makePlan(rounds, decoys, rand));

  const [idx, setIdx] = useState(0);
  const [signal, setSignal] = useState<Signal>('wait');
  const [shown, setShown] = useState<Shown | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const goAt = useRef(0);

  const hits = log.flatMap((e) => (e.kind === 'hit' ? [e.ms] : []));
  const misses = log.length - hits.length;
  const avg = hits.length ? Math.round(hits.reduce((a, b) => a + b, 0) / hits.length) : 0;
  const best = hits.length ? Math.round(Math.min(...hits)) : 0;
  const roundsDone = plan.slice(0, signal === 'result' ? idx + 1 : idx).filter((e) => e === 'go').length;
  const currentRound = Math.min(rounds, roundsDone + (signal === 'result' ? 0 : 1));

  /* pausing kills a live signal; the wait effect re-arms it on resume */
  if (paused && (signal === 'go' || signal === 'decoy')) setSignal('wait');

  /* wait → fire the next planned event after a random delay */
  useEffect(() => {
    if (paused || signal !== 'wait' || idx >= plan.length) return;
    const delay = minDelayMs + rand() * Math.max(0, maxDelayMs - minDelayMs);
    const id = window.setTimeout(() => {
      if (plan[idx] === 'go') {
        goAt.current = 0;
        audio.play('go');
        setSignal('go');
      } else {
        audio.play('glitch', { volume: 0.6 });
        setSignal('decoy');
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [paused, signal, idx, plan, rand, minDelayMs, maxDelayMs]);

  /* stamp the first frame the red core is on screen */
  useLayoutEffect(() => {
    if (signal !== 'go') return;
    goAt.current = performance.now();
    const raf = requestAnimationFrame(() => {
      goAt.current = performance.now();
    });
    return () => cancelAnimationFrame(raf);
  }, [signal]);

  /* live go → too slow */
  useEffect(() => {
    if (paused || signal !== 'go') return;
    const id = window.setTimeout(() => {
      audio.play('error');
      haptic('warning');
      const e: LogEntry = { kind: 'slow' };
      setLog((l) => [...l, e]);
      setShown(e);
      setSignal('result');
    }, tooSlowMs);
    return () => window.clearTimeout(id);
  }, [paused, signal, tooSlowMs]);

  /* decoy survived */
  useEffect(() => {
    if (paused || signal !== 'decoy') return;
    const id = window.setTimeout(() => {
      setShown({ kind: 'dodged' });
      setSignal('result');
    }, DECOY_MS);
    return () => window.clearTimeout(id);
  }, [paused, signal]);

  /* result → next event, or the verdict */
  useEffect(() => {
    if (paused || signal !== 'result') return;
    const id = window.setTimeout(() => {
      const next = idx + 1;
      if (next < plan.length) {
        setIdx(next);
        setShown(null);
        setSignal('wait');
        return;
      }
      const ok = hits.length > 0 && misses <= allowedMisses && avg <= targetMs;
      let score: number;
      if (ok) {
        // 100 at ≤ 60 % of target, linearly down to 50 at the target
        const t = clamp((avg - 0.6 * targetMs) / (0.4 * targetMs), 0, 1);
        score = Math.round(100 - 50 * t);
      } else {
        const speed = hits.length ? clamp(45 - (45 * (avg - targetMs)) / targetMs, 5, 45) : 5;
        score = Math.round(clamp(speed - 6 * Math.max(0, misses - allowedMisses), 0, 45));
      }
      const parts = hits.length ? [`Avg ${avg} ms`, `best ${best} ms`] : ['No clean reactions'];
      if (misses) parts.push(`${misses} miss${misses === 1 ? '' : 'es'}`);
      finish({
        outcome: ok ? 'win' : 'loss',
        score,
        summary: parts.join(' · '),
        stats: { avgReactionMs: avg, bestReactionMs: best, misses, rounds },
      });
    }, RESULT_MS);
    return () => window.clearTimeout(id);
  }, [paused, signal, idx, plan.length, hits.length, misses, allowedMisses, avg, best, targetMs, rounds, finish]);

  const tap = (t: number) => {
    if (paused) return;
    if (signal === 'go') {
      const ms = Math.max(1, t - (goAt.current || t));
      const e: LogEntry = { kind: 'hit', ms };
      audio.play('select', { pitch: 1.6 });
      haptic('light');
      setLog((l) => [...l, e]);
      setShown(e);
      setSignal('result');
    } else if (signal === 'wait' || signal === 'decoy') {
      const e: LogEntry = { kind: signal === 'wait' ? 'false' : 'decoy' };
      audio.play('error');
      haptic('error');
      setLog((l) => [...l, e]);
      setShown(e);
      setSignal('result');
    }
  };

  const state = signal === 'result' && shown ? `r_${shown.kind}` : `s_${signal}`;
  const placeholders = Math.max(0, rounds - roundsDone);
  const avgTone = !hits.length ? 'dim' : avg <= targetMs ? 'default' : 'red';

  return (
    <div className={[k.root, paused && k.paused].filter(Boolean).join(' ')}>
      <Hud>
        <HudStat label="Round" value={currentRound} of={rounds} />
        <HudStat label="Average" value={hits.length ? avg : '—'} unit={hits.length ? 'ms' : undefined} tone={avgTone} />
        <HudStat label="Misses" value={misses} of={allowedMisses} tone={misses > allowedMisses ? 'red' : 'default'} />
      </Hud>

      <p className={s.brief}>
        Target <b>≤ {targetMs} ms</b>
        {decoys > 0 && (
          <>
            <span className={s.sep} aria-hidden />
            <span className={s.blueDot} aria-hidden /> Blue is a decoy
          </>
        )}
      </p>

      <button
        type="button"
        className={[s.signal, s[state]].filter(Boolean).join(' ')}
        onPointerDown={(e) => isPrimaryPointer(e) && tap(eventTime(e))}
        onClick={(e) => isKeyboardClick(e) && tap(performance.now())}
        aria-label={
          signal === 'go' ? 'Tap now' : signal === 'decoy' ? 'Decoy — do not tap' : 'Signal: wait for red, then tap'
        }
      >
        <span className={s.bloom} aria-hidden />
        <span className={s.disc} aria-hidden>
          <span className={s.dial} />
          <span className={s.breath} />
          <span className={s.core} />
          <span className={s.watermark}>
            <SuitIcon suit="spade" size="100%" />
          </span>
          <span className={s.readout}>
            {signal === 'wait' && (
              <>
                <b className={s.big}>Wait for red</b>
                <small>Tap the instant it fires</small>
              </>
            )}
            {signal === 'go' && <b className={s.huge}>Tap</b>}
            {signal === 'decoy' && <b className={s.big}>Wait for red</b>}
            {signal === 'result' && shown?.kind === 'hit' && (
              <>
                <b className={s.ms}>{Math.round(shown.ms)}</b>
                <small>milliseconds</small>
              </>
            )}
            {signal === 'result' && shown && shown.kind !== 'hit' && (
              <b className={s.big}>
                {shown.kind === 'dodged' ? 'Decoy dodged' : chipText(shown)}
              </b>
            )}
          </span>
        </span>
      </button>

      <ol className={s.chips} style={{ '--cols': Math.min(5, Math.max(rounds, 3)) } as CSSProperties} aria-label="Round results">
        {log.map((e, i) => (
          <li key={i} className={[s.chip, e.kind === 'hit' ? s.chipHit : s.chipMiss, e.kind === 'decoy' && s.chipDecoy].filter(Boolean).join(' ')}>
            {chipText(e)}
            {e.kind === 'hit' && <small>ms</small>}
          </li>
        ))}
        {Array.from({ length: placeholders }, (_, i) => (
          <li key={`p${i}`} className={[s.chip, s.chipEmpty].join(' ')}>
            {String(roundsDone + i + 1).padStart(2, '0')}
          </li>
        ))}
      </ol>
    </div>
  );
}
