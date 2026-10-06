import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { back } from '../../app/router';
import { IconButton } from './Button';
import s from './TopBar.module.css';

interface Props {
  title?: ReactNode;
  /** small caption under the title */
  subtitle?: ReactNode;
  /** show the back chevron (default true) */
  showBack?: boolean;
  /** where to go if there is no history to pop */
  backTo?: string;
  onBack?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  /** transparent over art (default) or solid glass */
  variant?: 'clear' | 'glass';
}

/** Screen header: back chevron · centred uppercase title · right action slot. */
export function TopBar({ title, subtitle, showBack = true, backTo, onBack, left, right, variant = 'clear' }: Props) {
  return (
    <header className={[s.bar, variant === 'glass' && s.glass].filter(Boolean).join(' ')}>
      <div className={s.side}>
        {left ??
          (showBack && (
            <IconButton label="Back" sfx="back" onClick={() => (onBack ? onBack() : back(backTo))}>
              <ChevronLeft size={26} strokeWidth={1.75} />
            </IconButton>
          ))}
      </div>
      <div className={s.center}>
        {title && <h1 className={s.title}>{title}</h1>}
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      </div>
      <div className={[s.side, s.right].join(' ')}>{right}</div>
    </header>
  );
}
