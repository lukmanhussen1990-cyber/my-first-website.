/*
 * ♥ Choice Scenario — a branching moral dilemma. The narrative types on, the
 * options appear, and a per-decision clock runs; hesitate and fate picks the
 * default. Empathy and survival weights accumulate across the story.
 */
import { HeartPulse, Shield } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SUIT_SCENE } from '../assets/art';
import type { ChoiceConfig, ChoiceNode, ChoiceOption } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useCountdown, usePausableTimeout, useReduceMotion, useTypewriter } from './play/hooks';
import { clamp } from './play/rng';
import type { GameProps } from './types';
import s from './ChoiceGame.module.css';

const FALLBACK: ChoiceConfig = { start: '', nodes: [], surviveScore: 0 };
const EASE = [0.16, 1, 0.3, 1] as const;

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

export default function ChoiceGame({ challenge, paused, onFinish }: GameProps) {
  const cfg = challenge.game.type === 'choice' ? challenge.game.choice : FALLBACK;
  const nodes = useMemo(() => new Map(cfg.nodes.map((n) => [n.id, n])), [cfg.nodes]);
  const [nodeId, setNodeId] = useState(cfg.start);
  const [step, setStep] = useState(1);
  const totals = useRef({ empathy: 0, survival: 0 });
  const done = useRef(false);
  const node = nodes.get(nodeId) ?? cfg.nodes[0];

  const chosen = (opt: ChoiceOption) => {
    totals.current = {
      empathy: totals.current.empathy + opt.empathy,
      survival: totals.current.survival + opt.survival,
    };
  };

  const advance = (opt: ChoiceOption) => {
    if (done.current) return;
    if (!opt.ends && opt.next && nodes.has(opt.next)) {
      setNodeId(opt.next);
      setStep((n) => n + 1);
      audio.play('whoosh', { volume: 0.6 });
      return;
    }
    done.current = true;
    const { empathy, survival } = totals.current;
    const total = empathy + survival;
    const win = opt.ends !== 'loss' && total >= cfg.surviveScore;
    onFinish({
      outcome: win ? 'win' : 'loss',
      score: win ? clamp(65 + 8 * (total - cfg.surviveScore), 60, 100) : clamp(30 + 8 * total, 0, 50),
      summary: `Empathy ${signed(empathy)} · Survival ${signed(survival)}`,
      stats: { empathy, survival },
    });
  };

  if (!node) return null;

  return (
    <div className={s.root}>
      <div className={s.scene}>
        <img src={SUIT_SCENE[challenge.suit]} alt="" decoding="async" />
        <span className={s.sceneShade} aria-hidden />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={node.id}
            className={s.caption}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <span className={s.step}>
              <span className={s.rec} aria-hidden />
              Decision {String(step).padStart(2, '0')}
            </span>
            <span className={s.captionText}>{node.caption ?? 'Unknown location'}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      <NodeView key={node.id} node={node} paused={paused} onChosen={chosen} onDone={advance} />
    </div>
  );
}

/* ── One decision ─────────────────────────────────────────────── */

interface NodeProps {
  node: ChoiceNode;
  paused: boolean;
  onChosen: (opt: ChoiceOption) => void;
  onDone: (opt: ChoiceOption) => void;
}

function NodeView({ node, paused, onChosen, onDone }: NodeProps) {
  const reduce = useReduceMotion();
  const type = useTypewriter(node.text, 28, paused, reduce);
  const [pick, setPick] = useState<{ opt: ChoiceOption; fate: boolean } | null>(null);
  const deciding = type.done && !pick;
  const limitMs = node.decideSec * 1000;
  const fallback = node.options.find((o) => o.id === node.defaultOption) ?? node.options[0];
  const consequenceRef = useRef<HTMLButtonElement>(null);

  const left = useCountdown(limitMs, deciding && !paused, () => choose(fallback, true), 100);
  const secLeft = Math.ceil(left / 1000);
  const urgent = deciding && secLeft <= 5;

  function choose(opt: ChoiceOption, fate = false) {
    if (pick || (!fate && paused)) return;
    setPick({ opt, fate });
    onChosen(opt);
    audio.play(fate ? 'glitch' : 'confirm');
    haptic(fate ? 'warning' : 'medium');
  }

  /* heartbeat for the last five seconds of a decision */
  const lastBeat = useRef(0);
  useEffect(() => {
    if (!deciding || paused || secLeft > 5 || secLeft <= 0 || lastBeat.current === secLeft) return;
    lastBeat.current = secLeft;
    audio.play('heartbeat');
    haptic('light');
  }, [secLeft, deciding, paused]);

  useEffect(() => {
    if (pick) consequenceRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [pick, reduce]);

  const moved = useRef(false);
  const next = () => {
    if (!pick || moved.current) return;
    moved.current = true;
    onDone(pick.opt);
  };
  usePausableTimeout(next, clamp(1600 + (pick?.opt.consequence.length ?? 0) * 12, 2000, 3000), !!pick, paused);

  return (
    <div className={s.node}>
      <button
        type="button"
        className={s.text}
        onClick={() => !type.done && type.complete()}
        aria-label={node.text}
        tabIndex={type.done ? -1 : 0}
      >
        {/* untyped text stays in place (transparent) so centred lines never reflow */}
        <span aria-hidden>
          {type.shown}
          {!type.done && <i className={s.caret} />}
          <span className={s.rest}>{node.text.slice(type.shown.length)}</span>
        </span>
      </button>

      <AnimatePresence>
        {type.done && (
          <motion.div
            className={[s.decide, urgent && s.urgent].filter(Boolean).join(' ')}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: pick ? 0.4 : 1 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
          >
            <span className={s.decideLabel}>{pick ? 'Decision locked' : 'Decide'}</span>
            <span className={s.decideBar} aria-hidden>
              <i style={{ transform: `scaleX(${Math.max(0, left / limitMs)})` }} />
            </span>
            <span className={s.decideTime} role="timer" aria-label={`${secLeft} seconds to decide`}>
              {String(secLeft).padStart(2, '0')}s
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {type.done && (
        <div className={s.options} role="group" aria-label="Choices">
          <AnimatePresence initial={!reduce}>
            {node.options.map((o, i) => {
              if (pick && pick.opt.id !== o.id) return null;
              const chosenOne = pick?.opt.id === o.id;
              return (
                <motion.button
                  key={o.id}
                  layout={!reduce}
                  type="button"
                  className={[s.option, i === 0 && s.lead, chosenOne && s.chosen].filter(Boolean).join(' ')}
                  onClick={() => choose(o)}
                  disabled={!!pick}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.2 } }}
                  transition={{ duration: reduce ? 0 : 0.45, delay: reduce || pick ? 0 : 0.08 + i * 0.09, ease: EASE }}
                >
                  <span className={s.optLabel}>{o.label}</span>
                  <span className={s.optHint}>{o.hint}</span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {pick && (
          <motion.button
            ref={consequenceRef}
            type="button"
            className={s.consequence}
            onClick={next}
            aria-live="polite"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.15, ease: EASE }}
          >
            {pick.fate && <span className={s.fate}>Time's up — fate decides.</span>}
            <span className={s.consText}>{pick.opt.consequence}</span>
            <span className={s.deltas}>
              <span className={pick.opt.empathy >= 0 ? s.up : s.down}>
                <HeartPulse size={13} strokeWidth={2.2} /> Empathy {signed(pick.opt.empathy)}
              </span>
              <span className={pick.opt.survival >= 0 ? s.up : s.down}>
                <Shield size={13} strokeWidth={2.2} /> Survival {signed(pick.opt.survival)}
              </span>
              <small>Tap to continue</small>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
