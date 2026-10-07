/*
 * ♦ Logic Test — sequences and riddles against a per-question clock.
 * Correct answers glow green; wrong ones shake red and the right answer is
 * revealed with a short explanation before the next question.
 */
import { Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { LogicConfig, LogicQuestion } from '../data/types';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useCountdown, usePausableTimeout, useReduceMotion } from './play/hooks';
import { clamp } from './play/rng';
import type { GameProps } from './types';
import s from './LogicGame.module.css';

const FALLBACK: LogicConfig = { questions: [], passMark: 0, perQuestionSec: 20 };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const EASE = [0.16, 1, 0.3, 1] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function LogicGame({ challenge, paused, onFinish }: GameProps) {
  const cfg = challenge.game.type === 'logic' ? challenge.game.logic : FALLBACK;
  const total = cfg.questions.length;
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<boolean[]>([]);
  const speed = useRef(0);
  const done = useRef(false);

  const finish = (correct: number) => {
    if (done.current) return;
    done.current = true;
    const score = Math.round((correct / Math.max(1, total)) * 85 + (15 * speed.current) / Math.max(1, total));
    onFinish({
      outcome: correct >= cfg.passMark ? 'win' : 'loss',
      score: clamp(score, 0, 100),
      summary: `${correct} / ${total} correct`,
      stats: { correct, total },
    });
  };

  const answer = (ok: boolean, timeFrac: number) => {
    setMarks((m) => [...m, ok]);
    if (ok) speed.current += timeFrac;
  };

  const next = () => {
    const correct = marks.filter(Boolean).length;
    const answered = marks.length;
    // a ranked trial eliminates as soon as the pass mark is out of reach; practice plays every question
    const hopeless = !challenge.practice && correct + (total - answered) < cfg.passMark;
    if (answered >= total || hopeless) finish(correct);
    else setIndex(answered);
  };

  const q = cfg.questions[index];
  if (!q) return null;

  return (
    <div className={s.root}>
      <QuestionView
        key={q.id}
        q={q}
        number={index + 1}
        total={total}
        passMark={cfg.passMark}
        marks={marks}
        perQuestionMs={cfg.perQuestionSec * 1000}
        paused={paused}
        onAnswer={answer}
        onNext={next}
      />
    </div>
  );
}

/* ── One question ─────────────────────────────────────────────── */

interface QuestionProps {
  q: LogicQuestion;
  number: number;
  total: number;
  passMark: number;
  marks: boolean[];
  perQuestionMs: number;
  paused: boolean;
  onAnswer: (ok: boolean, timeFrac: number) => void;
  onNext: () => void;
}

function QuestionView({ q, number, total, passMark, marks, perQuestionMs, paused, onAnswer, onNext }: QuestionProps) {
  const reduce = useReduceMotion();
  /** index picked, -1 = ran out of time, null = still thinking */
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const ok = picked === q.answer;
  const explainRef = useRef<HTMLButtonElement>(null);

  const left = useCountdown(perQuestionMs, !paused && !answered, () => choose(-1), 100);
  const secLeft = Math.ceil(left / 1000);
  const urgent = !answered && secLeft <= 5;

  function choose(i: number) {
    if (picked !== null) return;
    if (i >= 0 && paused) return;
    setPicked(i);
    const right = i === q.answer;
    audio.play(right ? 'confirm' : 'error');
    haptic(right ? 'success' : 'error');
    onAnswer(right, right ? left / perQuestionMs : 0);
  }

  /* soft tick for the last five seconds of a question */
  const lastTick = useRef(0);
  useEffect(() => {
    if (answered || paused || secLeft > 5 || secLeft <= 0 || lastTick.current === secLeft) return;
    lastTick.current = secLeft;
    audio.play('tick', { volume: 0.45, pitch: 1.3 });
  }, [secLeft, answered, paused]);

  /* keep the explanation in view on short screens */
  useEffect(() => {
    if (answered) explainRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [answered, reduce]);

  const explainMs = clamp(1800 + Math.max(0, q.explain.length - 50) * 22, 1800, 3400);
  const advanced = useRef(false);
  const advance = () => {
    if (advanced.current) return;
    advanced.current = true;
    onNext();
  };
  usePausableTimeout(advance, explainMs, answered, paused);

  const short = q.options.every((o) => o.length <= 8);
  const R = 19;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, left / perQuestionMs);

  return (
    <div className={s.stage}>
      <div className={s.top}>
        <div className={s.progress}>
          <div className={s.dots} role="img" aria-label={`Question ${number} of ${total}`}>
            {Array.from({ length: total }, (_, i) => {
              const mark = marks[i];
              const cls = mark === true ? s.dotRight : mark === false ? s.dotWrong : i === number - 1 ? s.dotNow : '';
              return <span key={i} className={[s.dot, cls].filter(Boolean).join(' ')} />;
            })}
          </div>
          <p className={s.qLabel}>
            Question <b className="tabular">{pad2(number)}</b> / {pad2(total)}
            <span className={s.need}>Need {passMark}</span>
          </p>
        </div>
        <div className={[s.ring, urgent && s.ringUrgent, answered && s.ringDone].filter(Boolean).join(' ')} role="timer" aria-label={`${secLeft} seconds for this question`}>
          <svg viewBox="0 0 44 44" width="46" height="46" aria-hidden>
            <circle cx="22" cy="22" r={R} className={s.ringTrack} />
            <circle
              cx="22"
              cy="22"
              r={R}
              className={s.ringFill}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span className="tabular">{secLeft}</span>
        </div>
      </div>

      <motion.div
        className={['glass', s.card, q.sequence ? s.cardSeq : s.cardRiddle].join(' ')}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {q.sequence ? (
          <>
            <p className={s.prompt}>{q.prompt}</p>
            <div className={s.seq} aria-label={q.sequence.join(', ')}>
              {q.sequence.map((v, i) => {
                const unknown = v === '?';
                return (
                  <span
                    key={i}
                    className={[s.seqTile, unknown && s.seqQ, unknown && answered && s.seqSolved].filter(Boolean).join(' ')}
                  >
                    {unknown && answered ? q.options[q.answer] : v}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className={s.kicker}>Terminal query</p>
            <p className={s.riddle}>{q.prompt}</p>
          </>
        )}
      </motion.div>

      <div className={short ? s.grid : s.list} role="group" aria-label="Answers">
        {q.options.map((o, i) => {
          const isAnswer = answered && i === q.answer;
          const isWrong = answered && picked === i && !ok;
          // opacity lives in the motion target (an inline style would beat any class)
          const opacity = answered && !isAnswer && !isWrong ? 0.36 : 1;
          return (
            <motion.button
              key={i}
              type="button"
              className={[s.option, isAnswer && s.right, isWrong && s.wrong].filter(Boolean).join(' ')}
              onClick={() => choose(i)}
              disabled={answered}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={isWrong && !reduce ? { opacity, y: 0, x: [0, -9, 8, -5, 3, 0] } : { opacity, y: 0, x: 0 }}
              transition={
                isWrong ? { duration: 0.42 } : { duration: 0.4, delay: reduce || answered ? 0 : 0.12 + i * 0.05, ease: EASE }
              }
            >
              <span className={s.letter} aria-hidden>
                {LETTERS[i]}
              </span>
              <span className={s.optText}>{o}</span>
              {isAnswer && <Check className={s.optIcon} size={18} strokeWidth={2.6} aria-label="Correct answer" />}
              {isWrong && <X className={s.optIcon} size={18} strokeWidth={2.6} aria-label="Your answer" />}
            </motion.button>
          );
        })}
      </div>

      {/* the slot is reserved up front so the board never jumps when the explanation lands */}
      <div className={s.explainSlot} aria-live="polite">
        <AnimatePresence>
          {answered && (
            <motion.button
              ref={explainRef}
              type="button"
              className={[s.explain, ok ? s.explainOk : s.explainBad].join(' ')}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              onClick={advance}
            >
              <span className={s.explainHead}>
                {ok ? <Check size={15} strokeWidth={2.8} /> : <X size={15} strokeWidth={2.8} />}
                {ok ? 'Correct' : picked === -1 ? "Time's up" : 'Wrong'}
                <small>Tap to continue</small>
              </span>
              <span className={s.explainText}>{q.explain}</span>
              <span
                className={s.explainBar}
                style={{ animationDuration: `${explainMs}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                aria-hidden
              />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
