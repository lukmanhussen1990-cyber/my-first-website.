import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { audio } from '../../services/audio';
import s from './Sheet.module.css';

/** id of the app container (see App.tsx) — sheets portal here so they layer above the tab bar. */
export const APP_ROOT_ID = 'bt-app';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** accessible name */
  label: string;
}

/**
 * Glass bottom sheet with backdrop. Rendered into the app container (above the
 * bottom tab bar). Drag the handle down, tap outside or press Escape to dismiss;
 * the body scrolls when the content is taller than the sheet.
 */
export function Sheet({ open, onClose, children, label }: Props) {
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className={s.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className={s.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) {
                audio.play('back');
                onClose();
              }
            }}
          >
            <div className={s.handle} onPointerDown={(e) => drag.start(e)} aria-hidden>
              <span className={s.grip} />
            </div>
            <div className={s.body}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const host = typeof document !== 'undefined' ? document.getElementById(APP_ROOT_ID) : null;
  return host ? createPortal(content, host) : content;
}
