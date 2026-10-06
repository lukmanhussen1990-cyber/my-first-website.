import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { audio, type Sfx } from '../../services/audio';
import { haptic } from '../../services/haptics';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  /** sound to play on press; false for silent */
  sfx?: Sfx | false;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  icon,
  iconRight,
  sfx,
  className,
  children,
  onClick,
  disabled,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={[s.btn, s[variant], s[size], block && s.block, loading && s.loading, className]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        audio.unlock();
        if (sfx !== false) audio.play(sfx ?? (variant === 'primary' ? 'confirm' : 'tap'));
        haptic(variant === 'primary' ? 'medium' : 'light');
        onClick?.(e);
      }}
      {...rest}
    >
      {loading ? <span className={s.spinner} aria-hidden /> : icon}
      <span className={s.label}>{children}</span>
      {!loading && iconRight}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  sfx?: Sfx | false;
  badge?: number | boolean;
}

/** Square, borderless icon button used in top bars. */
export function IconButton({ label, sfx = 'tap', badge, className, children, onClick, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[s.iconBtn, className].filter(Boolean).join(' ')}
      onClick={(e) => {
        audio.unlock();
        if (sfx) audio.play(sfx);
        haptic('light');
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
      {badge ? <span className={s.badge}>{typeof badge === 'number' ? badge : ''}</span> : null}
    </button>
  );
}
