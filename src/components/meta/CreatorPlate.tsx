import { motion } from 'motion/react';
import { AuthorCredit } from '../AuthorCredit';
import { SuitIcon } from '../ui/SuitIcon';
import { useSettings } from '../../state/settings';
import s from './CreatorPlate.module.css';

interface Props {
  /** small mono line in the top-left corner */
  serial?: string;
  /** optional line above the credit */
  caption?: string;
  /** delay (s) before the reveal plays */
  delay?: number;
  className?: string;
}

/**
 * Studio title card framing <AuthorCredit variant="stacked" />: crimson
 * hairline frame with corner brackets, scanlines, a playing-card suit row and
 * a one-shot reveal (scan sweep + RGB glitch on the name).
 */
export function CreatorPlate({ serial = 'BT-01 // Original title', caption, delay = 0.15, className }: Props) {
  const reduce = useSettings((st) => st.reduceMotion);
  return (
    <motion.section
      className={[s.plate, !reduce && s.animated, className].filter(Boolean).join(' ')}
      aria-label="Creator credit"
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ ['--plate-delay' as string]: `${delay + 0.35}s` }}
    >
      <span className={[s.corner, s.tl].join(' ')} aria-hidden />
      <span className={[s.corner, s.tr].join(' ')} aria-hidden />
      <span className={[s.corner, s.bl].join(' ')} aria-hidden />
      <span className={[s.corner, s.br].join(' ')} aria-hidden />
      <span className={s.scan} aria-hidden />
      <span className={s.sweep} aria-hidden />

      <div className={s.top}>
        <span className={s.serial}>{serial}</span>
        <span className={s.suits} aria-hidden>
          <SuitIcon suit="spade" size={11} />
          <SuitIcon suit="heart" size={11} />
          <SuitIcon suit="diamond" size={11} />
          <SuitIcon suit="club" size={11} />
        </span>
      </div>

      {caption && <p className={s.caption}>{caption}</p>}
      <div className={[s.credit, !caption && s.creditSolo].filter(Boolean).join(' ')}>
        <AuthorCredit variant="stacked" />
      </div>

      <div className={s.bottom}>
        <span className={s.foot}>Original universe</span>
        <span className={s.est}>Est. 2026</span>
      </div>
    </motion.section>
  );
}
