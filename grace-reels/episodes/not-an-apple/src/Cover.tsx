import {AbsoluteFill} from 'remotion';
import {Apple, RedX} from './scenes/Early';
import {Serpent} from './characters/People';
import {SERIF, SANS} from './lib/fonts';

// Profile-grid safe cover: all text and the main image inside y 240-1680.
export const Cover: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 55%, #3A1C0E 0%, #140A05 55%, #000 90%)'}}>
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <path d="M-40,760 Q300,700 600,740 Q900,780 1120,700" stroke="#5E381F" strokeWidth={46} strokeLinecap="round" fill="none" />
      <Serpent track={[[1100, 690], [900, 760], [700, 720], [520, 760], [380, 860], [300, 980], [330, 1140], [470, 1250], [700, 1240], [820, 1130], [820, 990], [760, 900]]} head={1} length={1} t={0.4} w={42} tongue={0.8} wave={6} />
      <Apple t={0.6} size={560} x={540} y={1080} />
    </svg>
    <RedX t={10} at={0} x={540} y={1080} size={560} />
    <div style={{position: 'absolute', left: 0, right: 0, top: 290, textAlign: 'center', fontFamily: SERIF, fontWeight: 700}}>
      <div style={{fontSize: 100, color: '#F3ECDF', letterSpacing: '0.04em', lineHeight: 1}}>IT WASN'T</div>
      <div style={{fontSize: 130, color: '#F2B544', letterSpacing: '0.03em', lineHeight: 1.05, textShadow: '0 0 40px rgba(242,181,68,0.55)'}}>AN APPLE.</div>
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 1610, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: '0.3em', color: '#F3ECDF'}}>GENESIS 3:6</div>
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)'}} />
  </AbsoluteFill>
);
