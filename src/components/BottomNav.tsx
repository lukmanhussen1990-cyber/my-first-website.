import { ChartNoAxesColumn, Gamepad2, House, Map as MapIcon, User } from 'lucide-react';
import { motion } from 'motion/react';
import { navigate, useRoute, type RouteName } from '../app/router';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import s from './BottomNav.module.css';

const ITEMS: { name: RouteName; path: string; label: string; Icon: typeof House }[] = [
  { name: 'home', path: '/home', label: 'Home', Icon: House },
  { name: 'games', path: '/games', label: 'Games', Icon: Gamepad2 },
  { name: 'map', path: '/map', label: 'Map', Icon: MapIcon },
  { name: 'rankings', path: '/rankings', label: 'Rankings', Icon: ChartNoAxesColumn },
  { name: 'profile', path: '/profile', label: 'Profile', Icon: User },
];

export function BottomNav() {
  const route = useRoute();
  return (
    <nav className={s.nav} aria-label="Main">
      {ITEMS.map(({ name, path, label, Icon }) => {
        const active = route.name === name;
        return (
          <button
            key={name}
            className={[s.item, active && s.active].filter(Boolean).join(' ')}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (active) return;
              audio.unlock();
              audio.play('select');
              haptic('light');
              navigate(path, { replace: true, transition: 'tab' });
            }}
          >
            {active && (
              <motion.span
                layoutId="nav-glow"
                className={s.glow}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <Icon size={22} strokeWidth={active ? 2.2 : 1.7} className={s.icon} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0} />
            <span className={s.label}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
