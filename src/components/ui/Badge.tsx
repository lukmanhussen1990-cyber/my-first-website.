import { Brain, Compass, Crown, Eye, Flame, KeyRound, Layers, Shield, Star, Trophy, Zap } from 'lucide-react';
import { useId } from 'react';
import type { BadgeIcon, BadgeTier } from '../../data/types';
import { SuitIcon } from './SuitIcon';

/*
 * Achievement emblem: a bevelled metal hexagon in the tier's finish with an
 * engraved glyph. Locked badges render as dark, desaturated steel.
 */

const TIERS: Record<BadgeTier, { hi: string; mid: string; lo: string; glow: string; ink: string }> = {
  gold: { hi: '#ffe7a3', mid: '#e0a325', lo: '#6b4306', glow: 'rgba(246,185,43,.45)', ink: '#3b2503' },
  silver: { hi: '#ffffff', mid: '#b8bec9', lo: '#4a4e58', glow: 'rgba(200,206,216,.35)', ink: '#22252b' },
  bronze: { hi: '#ffc896', mid: '#c27236', lo: '#4f2508', glow: 'rgba(201,122,61,.4)', ink: '#2c1404' },
  emerald: { hi: '#b6ffd6', mid: '#2fb46c', lo: '#0b3d22', glow: 'rgba(53,208,127,.4)', ink: '#06261a' },
  crimson: { hi: '#ff9aa0', mid: '#e3121f', lo: '#4a0207', glow: 'rgba(227,18,31,.5)', ink: '#2a0104' },
};

const LOCKED = { hi: '#4a4a52', mid: '#26262c', lo: '#121215', glow: 'transparent', ink: '#5a5a63' };

function Glyph({ icon, color, size }: { icon: BadgeIcon; color: string; size: number }) {
  const p = { size, color, strokeWidth: 2.2 };
  switch (icon) {
    case 'trophy':
      return <Trophy {...p} />;
    case 'cards':
      return <Layers {...p} />;
    case 'bolt':
      return <Zap {...p} />;
    case 'shield':
      return <Shield {...p} />;
    case 'crown':
      return <Crown {...p} />;
    case 'eye':
      return <Eye {...p} />;
    case 'brain':
      return <Brain {...p} />;
    case 'key':
      return <KeyRound {...p} />;
    case 'flame':
      return <Flame {...p} />;
    case 'compass':
      return <Compass {...p} />;
    case 'star':
      return <Star {...p} />;
    case 'heart':
    case 'spade':
    case 'diamond':
    case 'club':
      return (
        <span style={{ color, display: 'grid' }}>
          <SuitIcon suit={icon} size={size} />
        </span>
      );
  }
}

interface Props {
  tier: BadgeTier;
  icon: BadgeIcon;
  size?: number;
  locked?: boolean;
  className?: string;
  title?: string;
}

export function Badge({ tier, icon, size = 56, locked, className, title }: Props) {
  const uid = useId().replace(/:/g, '');
  const c = locked ? LOCKED : TIERS[tier];
  const hex = 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z';
  const inner = 'M50 15 L80.5 32.5 L80.5 67.5 L50 85 L19.5 67.5 L19.5 32.5 Z';
  return (
    <span
      className={className}
      title={title}
      role={title ? 'img' : undefined}
      aria-label={title}
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        filter: locked ? undefined : `drop-shadow(0 0 ${size / 7}px ${c.glow})`,
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <defs>
          <linearGradient id={`o${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor={c.hi} />
            <stop offset="0.45" stopColor={c.mid} />
            <stop offset="1" stopColor={c.lo} />
          </linearGradient>
          <linearGradient id={`i${uid}`} x1="0.8" y1="0" x2="0.2" y2="1">
            <stop offset="0" stopColor={c.lo} />
            <stop offset="0.6" stopColor={c.mid} />
            <stop offset="1" stopColor={c.hi} />
          </linearGradient>
          <radialGradient id={`s${uid}`} cx="0.35" cy="0.25" r="0.6">
            <stop offset="0" stopColor="#fff" stopOpacity={locked ? 0.05 : 0.45} />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={hex} fill={`url(#o${uid})`} />
        <path d={inner} fill={`url(#i${uid})`} />
        <path d={inner} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1.5" />
        <path d={hex} fill={`url(#s${uid})`} />
      </svg>
      <span style={{ position: 'relative', display: 'grid', opacity: locked ? 0.6 : 0.92 }}>
        <Glyph icon={icon} color={c.ink} size={Math.round(size * 0.36)} />
      </span>
    </span>
  );
}
