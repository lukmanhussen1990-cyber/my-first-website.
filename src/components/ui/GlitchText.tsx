import { useEffect, useRef, useState, type ElementType } from 'react';
import { useSettings } from '../../state/settings';

interface Props {
  text: string;
  as?: ElementType;
  className?: string;
  /** average ms between glitch bursts; 0 = only when `trigger` changes */
  every?: number;
  /** change this value to fire a burst immediately */
  trigger?: unknown;
}

/** Text with an RGB-split slice glitch that fires periodically. */
export function GlitchText({ text, as: Tag = 'span', className, every = 4200, trigger }: Props) {
  const [on, setOn] = useState(false);
  const reduce = useSettings((s) => s.reduceMotion);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduce) return;
    const burst = () => {
      setOn(true);
      window.setTimeout(() => setOn(false), 440);
    };
    if (trigger !== undefined) burst();
    if (!every) return;
    const loop = () => {
      timer.current = window.setTimeout(() => {
        burst();
        loop();
      }, every * (0.6 + Math.random() * 0.8));
    };
    loop();
    return () => window.clearTimeout(timer.current);
  }, [every, reduce, trigger]);

  return (
    <Tag className={['glitch', on && 'is-glitching', className].filter(Boolean).join(' ')} data-text={text}>
      {text}
    </Tag>
  );
}
