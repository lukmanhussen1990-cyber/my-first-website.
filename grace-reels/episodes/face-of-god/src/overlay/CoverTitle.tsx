// Title treatment for the cover image (the reel's thumbnail). Everything stays inside y 240–1680 and
// x 72–960.
import {Logo} from './Logo';
import {C, SAFE, SANS, SERIF, useFontsReady} from './theme';

export const CoverTitle: React.FC = () => {
	useFontsReady();
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 900, background: 'linear-gradient(to bottom, rgba(10,8,14,0.7) 0%, rgba(10,8,14,0.45) 55%, rgba(10,8,14,0) 100%)'}} />
			<div style={{position: 'absolute', left: 0, top: 1380, width: 1080, height: 540, background: 'linear-gradient(to top, rgba(10,8,14,0.7) 0%, rgba(10,8,14,0) 100%)'}} />
			<div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: 270, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14}}>
				<Logo size={40} />
				<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.18em', color: C.cream, opacity: 0.85}}>GRACE IN MOTION</span>
			</div>
			<div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: 350, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, lineHeight: 1.0}}>
				<div style={{fontSize: 90, color: C.cream, letterSpacing: '0.02em', textShadow: '0 8px 36px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.6)'}}>HE ASKED TO SEE</div>
				<div style={{fontSize: 120, color: C.gold, letterSpacing: '0.01em', textShadow: '0 0 28px rgba(255,214,120,0.7), 0 0 64px rgba(242,181,68,0.4), 0 4px 18px rgba(0,0,0,0.6)'}}>GOD’S FACE</div>
			</div>
			<div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: 1600, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: '0.28em', color: C.cream, opacity: 0.92, textShadow: '0 2px 12px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.7)'}}>
				EXODUS 33:20
			</div>
		</div>
	);
};
