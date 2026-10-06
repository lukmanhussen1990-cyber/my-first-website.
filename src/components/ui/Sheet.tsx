import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { audio } from '../../services/audio';
import s from './Sheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** accessible name */
  label: string;
}

/** Glass bottom sheet with backdrop; drag down or tap outside to dismiss. */
export function Sheet({ open, onClose, children, label }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={s.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={s.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) {
                audio.play('back');
                onClose();
              }
            }}
          >
            <span className={s.grip} aria-hidden />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
