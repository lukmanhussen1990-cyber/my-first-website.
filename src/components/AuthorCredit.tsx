import s from './AuthorCredit.module.css';

export const AUTHOR = 'IMRAN';
export const APP_NAME = 'Border Trials';
export const APP_VERSION = '1.0.0';

interface Props {
  /**
   * compact — one line for the splash screen ("A GAME CREATED BY IMRAN")
   * stacked — studio-style credit block for About / App info
   */
  variant?: 'compact' | 'stacked';
  className?: string;
}

/** The creator credit, styled like a studio title card. */
export function AuthorCredit({ variant = 'compact', className }: Props) {
  if (variant === 'compact') {
    return (
      <p className={[s.compact, className].filter(Boolean).join(' ')}>
        <span className={s.rule} aria-hidden />
        <span className={s.by}>Created by</span>
        <span className={s.name}>{AUTHOR}</span>
        <span className={s.rule} aria-hidden />
      </p>
    );
  }
  return (
    <div className={[s.stacked, className].filter(Boolean).join(' ')}>
      <span className={s.kicker}>Created by</span>
      <span className={s.big} data-text={AUTHOR}>
        {AUTHOR}
      </span>
      <span className={s.role}>Creator · Game Director</span>
    </div>
  );
}
