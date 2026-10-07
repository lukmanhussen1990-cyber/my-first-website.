import { SuitIcon } from '../ui/SuitIcon';
import s from './AppEmblem.module.css';

/** The app icon: a black glass tile holding a crimson-edged card with a ruby heart. */
export function AppEmblem({ size = 88, className }: { size?: number; className?: string }) {
  return (
    <span
      className={[s.tile, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, borderRadius: size * 0.24, fontSize: Math.round(size * 0.13) }}
      role="img"
      aria-label="Border Trials app icon"
    >
      <span className={s.glow} aria-hidden />
      <span className={s.card} aria-hidden>
        <span className={s.pip}>A</span>
        <SuitIcon suit="heart" finish="ruby" size="58%" />
        <span className={[s.pip, s.pipBottom].join(' ')}>A</span>
      </span>
    </span>
  );
}
