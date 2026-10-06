import type { GameProps } from './types';

/** PLACEHOLDER — replaced by the mini-game implementation task. */
export default function LogicGame({ onFinish }: GameProps) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', flex: 1, gap: 12 }}>
      <p className="t-dim">LogicGame</p>
      <button className="t-label" onClick={() => onFinish({ outcome: 'win', score: 80, summary: 'placeholder' })}>
        Finish (win)
      </button>
    </div>
  );
}
