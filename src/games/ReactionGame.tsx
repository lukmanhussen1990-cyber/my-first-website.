import type { GameProps } from './types';

/** PLACEHOLDER — replaced by the mini-game implementation task. */
export default function ReactionGame({ onFinish }: GameProps) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', flex: 1, gap: 12 }}>
      <p className="t-dim">ReactionGame</p>
      <button className="t-label" onClick={() => onFinish({ outcome: 'win', score: 80, summary: 'placeholder' })}>
        Finish (win)
      </button>
    </div>
  );
}
