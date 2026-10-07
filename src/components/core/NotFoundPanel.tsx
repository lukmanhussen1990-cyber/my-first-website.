import { SearchX } from 'lucide-react';
import { Button } from '../ui/Button';
import s from './NotFoundPanel.module.css';

interface Props {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}

/** Centered glass message for an unknown suit / trial id, with a way back. */
export function NotFoundPanel({ title, body, action, onAction }: Props) {
  return (
    <div className={s.wrap}>
      <div className={['glass', s.panel].join(' ')} role="alert">
        <span className={s.icon} aria-hidden>
          <SearchX size={26} strokeWidth={1.75} />
        </span>
        <h1 className={s.title}>{title}</h1>
        <p className={s.body}>{body}</p>
        <Button variant="secondary" block onClick={onAction} sfx="back">
          {action}
        </Button>
      </div>
    </div>
  );
}
