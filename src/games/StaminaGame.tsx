/*
 * ♠ Stamina — rapid-tap to hold the meter above the kill line until time runs out.
 * Config: challenge.game.stamina { durationSec, drainPerSec, gainPerTap, killLine }
 *
 * The simulation runs in a rAF loop (frozen while paused) and writes the meter
 * straight to the DOM; React state only refreshes the readouts ~10×/s.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { StaminaConfig } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useClock } from './kit/clock';
import { isKeyboardClick, isPrimaryPointer, pulse, useFinish, useReducedMotion } from './kit/hooks';
import { Hud, HudStat, Phase } from './kit/Hud';
import { clamp } from './kit/rng';
import k from './kit/kit.module.css';
import s from './StaminaGame.module.css';
import type { GameProps } from './types';

type Step = 'run' | 'won' | 'lost';

const DEFAULTS: StaminaConfig = { durationSec: 15, drainPerSec: 0.3, gainPerTap: 0.05, killLine: 0.2 };
const START = 0.6;
const DANGER_BAND = 0.1;
/** draining starts on the first tap, or automatically after this grace */
const GRACE_SEC = 2;

interface Sim {
  started: boolean;
  grace: number;
  meter: number;
  elapsed: number;
  integral: number;
  min: number;
  taps: number;
  recent: number[];
  lastHaptic: number;
  lastBeat: number;
}

export default function StaminaGame({ challenge, paused, onFinish }: GameProps) {
  const cfg = challenge.game.type === 'stamina' ? challenge.game.stamina : DEFAULTS;
  const { durationSec, drainPerSec, gainPerTap, killLine } = cfg;

  const clock = useClock(paused);
  const { finish } = useFinish(onFinish);
  const reduce = useReducedMotion();
  const sim = useRef<Sim>({
    started: false,
    grace: 0,
    meter: START,
    elapsed: 0,
    integral: 0,
    min: START,
    taps: 0,
    recent: [],
    lastHaptic: 0,
    lastBeat: 0,
  });

  const [step, setStep] = useState<Step>('run');
  const [view, setView] = useState({
    left: durationSec,
    tps: 0,
    taps: 0,
    pct: Math.round(START * 100),
    danger: false,
    started: false,
  });

  const fillRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);
  const padRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);

  const paint = (m: number) => {
    if (fillRef.current) fillRef.current.style.transform = `scaleY(${m})`;
    if (capRef.current) capRef.current.style.transform = `translateY(${(1 - m) * 100}%)`;
  };

  /* simulation loop */
  useEffect(() => {
    if (paused || step !== 'run') return;
    let raf = 0;
    let last = performance.now();
    let lastView = 0;
    const st = sim.current;

    const frame = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (!st.started) {
        st.grace += dt;
        if (st.grace < GRACE_SEC) {
          raf = requestAnimationFrame(frame);
          return;
        }
        st.started = true;
        setView((v) => ({ ...v, started: true }));
      }
      st.elapsed += dt;
      const rate = drainPerSec * (1 + (0.5 * st.elapsed) / durationSec);
      st.meter = Math.max(0, st.meter - rate * dt);
      st.integral += st.meter * dt;
      st.min = Math.min(st.min, st.meter);
      paint(st.meter);

      const t = performance.now();
      st.recent = st.recent.filter((x) => t - x < 1500);
      const danger = st.meter < killLine + DANGER_BAND;
      if (danger && t - st.lastBeat > 760) {
        st.lastBeat = t;
        audio.play('heartbeat', { volume: 0.7 });
      }

      if (st.meter <= killLine) {
        paint(killLine);
        const seconds = Math.min(durationSec, st.elapsed);
        const tps = Math.round((st.taps / Math.max(1, seconds)) * 10) / 10;
        setView({
          left: Math.max(0, durationSec - seconds),
          tps,
          taps: st.taps,
          pct: Math.round(killLine * 100),
          danger: true,
          started: true,
        });
        setStep('lost');
        audio.play('fail');
        haptic('error');
        clock.after(
          1200,
          () =>
            finish({
              outcome: 'loss',
              score: Math.round(clamp((45 * seconds) / durationSec, 0, 45)),
              summary: `Fell below the kill line at ${seconds.toFixed(1)} s · ${tps} taps/s`,
              stats: { tapsPerSec: tps, taps: st.taps, minMeter: Math.round(killLine * 100) },
            }),
        );
        return;
      }

      if (st.elapsed >= durationSec) {
        const avg = st.integral / durationSec;
        const tps = Math.round((st.taps / durationSec) * 10) / 10;
        const score = Math.round(clamp(50 + (50 * (avg - killLine)) / (1 - killLine), 50, 100));
        setView({ left: 0, tps, taps: st.taps, pct: Math.round(st.meter * 100), danger: false, started: true });
        setStep('won');
        audio.play('success');
        haptic('success');
        clock.after(
          1100,
          () =>
            finish({
              outcome: 'win',
              score,
              summary: `Held the line for ${durationSec} s · ${tps} taps/s`,
              stats: { tapsPerSec: tps, taps: st.taps, minMeter: Math.round(st.min * 100) },
            }),
        );
        return;
      }

      if (now - lastView > 100) {
        lastView = now;
        setView({
          left: durationSec - st.elapsed,
          tps: Math.round((st.recent.length / 1.5) * 10) / 10,
          taps: st.taps,
          pct: Math.round(st.meter * 100),
          danger,
          started: true,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [paused, step, drainPerSec, durationSec, killLine, finish, clock]);

  const tap = () => {
    if (paused || step !== 'run') return;
    const st = sim.current;
    const t = performance.now();
    if (!st.started) {
      st.started = true;
      setView((v) => ({ ...v, started: true }));
    }
    st.meter = Math.min(1, st.meter + gainPerTap);
    st.taps += 1;
    st.recent.push(t);
    paint(st.meter);
    if (t - st.lastHaptic >= 60) {
      st.lastHaptic = t;
      haptic('light');
      audio.play('tap', { volume: 0.55, pitch: 0.9 + st.meter * 0.5 });
    }
    pulse(padRef.current, [{ transform: 'scale(0.93)' }, { transform: 'scale(1)' }], {
      duration: 180,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    });
    if (!reduce) {
      pulse(
        rippleRef.current,
        [
          { transform: 'scale(0.82)', opacity: 0.9 },
          { transform: 'scale(1.32)', opacity: 0 },
        ],
        { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
  };

  const secs = Math.max(0, view.left);
  const timeText = secs >= 10 ? secs.toFixed(0) : secs.toFixed(1);

  return (
    <div className={[k.root, s.root, view.danger && step === 'run' && s.danger, paused && k.paused].filter(Boolean).join(' ')}>
      <Hud>
        <HudStat label="Survive" value={timeText} unit="s" tone={step === 'won' ? 'green' : secs < 3 ? 'red' : 'default'} />
        <HudStat label="Taps / sec" value={view.tps.toFixed(1)} />
        <HudStat label="Taps" value={view.taps} tone="dim" />
      </Hud>

      {step === 'run' && !view.started && <Phase tone="red">Tap to start</Phase>}
      {step === 'run' && view.started && (
        <Phase tone={view.danger ? 'red' : 'white'}>{view.danger ? 'Danger — tap!' : 'Stay above the line'}</Phase>
      )}
      {step === 'won' && <Phase tone="green">You held the line</Phase>}
      {step === 'lost' && <Phase tone="red">Eliminated</Phase>}

      <div className={s.arena}>
        {/* ── Meter ─────────────────────────────── */}
        <div
          className={s.meter}
          role="meter"
          aria-label="Stamina"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.pct}
          style={{ '--kill': killLine } as CSSProperties}
        >
          <span className={s.pct}>{view.pct}%</span>
          <span className={s.gauge}>
          <span className={s.track}>
            <span className={s.dangerZone} />
            <span ref={fillRef} className={s.fill} style={{ transform: `scaleY(${START})` }} />
            <span ref={capRef} className={s.capWrap} style={{ transform: `translateY(${(1 - START) * 100}%)` }}>
              <span className={s.cap} />
            </span>
            <span className={s.ticks} />
          </span>
          <span className={s.kill}>
            <span className={s.killTag}>Kill</span>
          </span>
          </span>
        </div>

        {/* ── Tap pad ───────────────────────────── */}
        <div className={s.padWrap}>
          <button
            type="button"
            className={[s.pad, step !== 'run' && s.padDone, step === 'lost' && s.padLost].filter(Boolean).join(' ')}
            onPointerDown={(e) => isPrimaryPointer(e) && tap()}
            onClick={(e) => isKeyboardClick(e) && tap()}
            aria-label="Tap to hold the meter up"
          >
            <span ref={rippleRef} className={s.ripple} aria-hidden />
            <span ref={padRef} className={s.padFace} aria-hidden>
              <span className={s.padRing} />
              <span className={s.padCore}>
                <b>Tap</b>
                <small>Hold the line</small>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
