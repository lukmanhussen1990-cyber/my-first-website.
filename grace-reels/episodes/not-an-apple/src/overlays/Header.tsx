import {SANS} from '../lib/fonts';
import {Logo} from './Logo';

export const Header: React.FC<{opacity: number}> = ({opacity}) => (
  <div style={{position: 'absolute', top: 132, left: 72, right: 72, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: opacity * 0.75,
    fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: '0.18em', color: '#FFF8EC', textShadow: '0 1px 8px rgba(0,0,0,0.5)'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
      <Logo size={34} />
      <span>GRACE IN MOTION</span>
    </div>
    <span>NOT AN APPLE</span>
  </div>
);
