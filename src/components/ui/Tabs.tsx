import { motion } from 'motion/react';
import { useId } from 'react';
import { audio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import s from './Tabs.module.css';

interface Props<T extends string> {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

/** Segmented control with a sliding crimson indicator (Global · Friends · Top). */
export function Tabs<T extends string>({ tabs, value, onChange, className }: Props<T>) {
  const group = useId();
  return (
    <div className={[s.tabs, className].filter(Boolean).join(' ')} role="tablist">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            className={[s.tab, active && s.active].filter(Boolean).join(' ')}
            onClick={() => {
              if (active) return;
              audio.play('select');
              haptic('light');
              onChange(t.id);
            }}
          >
            {active && (
              <motion.span
                layoutId={`tab-ind-${group}`}
                className={s.indicator}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className={s.label}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
