import { AnimatePresence, motion } from 'motion/react';
import { Info, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { getAchievement } from '../data/achievements';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { useToasts, type Toast } from '../state/toasts';
import { Badge } from './ui/Badge';
import s from './Toaster.module.css';

function ToastIcon({ t }: { t: Toast }) {
  if (t.kind === 'achievement' && t.achievementId) {
    const a = getAchievement(t.achievementId);
    if (a) return <Badge tier={a.tier} icon={a.icon} size={42} />;
  }
  if (t.kind === 'error') return <TriangleAlert size={22} className={s.err} />;
  if (t.kind === 'info') return <Info size={22} />;
  return <Sparkles size={22} className={s.gold} />;
}

export function Toaster() {
  const toasts = useToasts((st) => st.toasts);
  const dismiss = useToasts((st) => st.dismiss);
  const latest = toasts[toasts.length - 1];

  useEffect(() => {
    if (!latest) return;
    if (latest.kind === 'achievement' || latest.kind === 'levelup') {
      audio.play('unlock');
      haptic('success');
    } else if (latest.kind === 'error') {
      haptic('error');
    }
  }, [latest]);

  return (
    <div className={s.stack} aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            className={[s.toast, s[t.kind]].join(' ')}
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={() => dismiss(t.id)}
          >
            <span className={s.icon}>
              <ToastIcon t={t} />
            </span>
            <span className={s.text}>
              <span className={s.kicker}>
                {t.kind === 'achievement' ? 'Achievement unlocked' : t.kind === 'levelup' ? 'Level up' : t.kind === 'reward' ? 'Reward' : t.kind === 'error' ? 'Error' : 'Notice'}
              </span>
              <span className={s.title}>{t.title}</span>
              {t.body && <span className={s.body}>{t.body}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
