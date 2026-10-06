import { avatarUrl } from '../../assets/art';
import s from './Avatar.module.css';

interface Props {
  id: number;
  size?: number;
  /** ring colour: red neon (player), gold/silver/bronze (podium), none */
  ring?: 'red' | 'gold' | 'silver' | 'bronze' | 'none';
  online?: boolean;
  className?: string;
  alt?: string;
}

export function Avatar({ id, size = 48, ring = 'none', online, className, alt = '' }: Props) {
  return (
    <span
      className={[s.avatar, s[`ring_${ring}`], className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    >
      <img src={avatarUrl(id)} alt={alt} width={size} height={size} loading="lazy" decoding="async" />
      {online && <span className={s.online} aria-label="Online" />}
    </span>
  );
}
