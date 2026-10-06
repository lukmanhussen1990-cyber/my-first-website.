import { GlitchText } from './GlitchText';
import s from './Logo.module.css';

interface Props {
  size?: 'xl' | 'lg' | 'md' | 'sm';
  tagline?: boolean;
  glitch?: boolean;
  className?: string;
}

/** BORDER / TRIALS wordmark with the "SURVIVE · SOLVE · ESCAPE" tagline. */
export function Logo({ size = 'xl', tagline = true, glitch = true, className }: Props) {
  return (
    <div className={[s.logo, s[size], className].filter(Boolean).join(' ')} role="img" aria-label="Border Trials">
      <div className={s.top} aria-hidden>
        {glitch ? <GlitchText text="BORDER" every={5200} /> : 'BORDER'}
      </div>
      <div className={s.bottom} aria-hidden>
        {glitch ? <GlitchText text="TRIALS" every={3900} /> : 'TRIALS'}
      </div>
      {tagline && (
        <div className={s.tagline} aria-hidden>
          <span>Survive</span>
          <i>·</i>
          <span>Solve</span>
          <i>·</i>
          <span>Escape</span>
        </div>
      )}
    </div>
  );
}
