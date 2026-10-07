import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { audio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import s from './RowGroup.module.css';

/* Settings-style grouped list: SECTION TITLE over a glass panel of rows. */

export function Group({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={[s.group, className].filter(Boolean).join(' ')}>
      <h2 className={s.title}>
        <span className={s.titleText}>{title}</span>
        {aside && <small>{aside}</small>}
      </h2>
      <div className={['glass', s.panel].join(' ')}>{children}</div>
    </section>
  );
}

interface RowProps {
  icon?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  /** id applied to the sub text (for aria-describedby) */
  subId?: string;
  /** right-hand content: a value, a control, a pill */
  right?: ReactNode;
  /** makes the whole row a button with a chevron */
  onClick?: () => void;
  tone?: 'default' | 'danger' | 'accent';
  /** stack the right content under the label (e.g. a slider) */
  stacked?: ReactNode;
  className?: string;
}

export function Row({ icon, label, sub, subId, right, onClick, tone = 'default', stacked, className }: RowProps) {
  const cls = [s.row, onClick && s.action, tone !== 'default' && s[`tone_${tone}`], className].filter(Boolean).join(' ');
  const body = (
    <>
      {icon && (
        <span className={s.icon} aria-hidden>
          {icon}
        </span>
      )}
      <span className={s.text}>
        <span className={s.label}>{label}</span>
        {sub && (
          <span className={s.sub} id={subId}>
            {sub}
          </span>
        )}
      </span>
      {right !== undefined && <span className={s.right}>{right}</span>}
      {onClick && <ChevronRight size={18} className={s.chev} aria-hidden />}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={() => {
          audio.unlock();
          audio.play('tap');
          haptic('light');
          onClick();
        }}
      >
        <span className={s.line}>{body}</span>
      </button>
    );
  }
  return (
    <div className={cls}>
      <span className={s.line}>{body}</span>
      {stacked !== undefined && <div className={s.stack}>{stacked}</div>}
    </div>
  );
}
