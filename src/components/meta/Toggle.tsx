import { audio } from '../../services/audio';
import { haptic } from '../../services/haptics';
import s from './Toggle.module.css';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** accessible name (the visible row label) */
  label: string;
  /** id of an element describing the setting */
  describedBy?: string;
  disabled?: boolean;
}

/** Crimson neon switch. role="switch" + aria-checked for assistive tech. */
export function Toggle({ checked, onChange, label, describedBy, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      className={[s.toggle, checked && s.on].filter(Boolean).join(' ')}
      onClick={() => {
        audio.unlock();
        audio.play('select');
        haptic('light');
        onChange(!checked);
      }}
    >
      <span className={s.track} aria-hidden>
        <span className={s.ticks} />
      </span>
      <span className={s.knob} aria-hidden />
    </button>
  );
}
