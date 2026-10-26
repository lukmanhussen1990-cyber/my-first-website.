// Title treatment for the cover image (the reel's thumbnail).
import {Logo} from './Logo';
import {C, SANS, SERIF, useFontsReady} from './theme';

export const CoverTitle: React.FC = () => {
	useFontsReady();
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 900, background: 'linear-gradient(to bottom, rgba(20,12,6,0.6) 0%, rgba(20,12,6,0.4) 55%, rgba(20,12,6,0) 100%)'}} />
			<div style={{position: 'absolute', left: 0, width: 1080, top: 300, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14}}>
				<Logo size={40} />
				<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.18em', color: C.cream, opacity: 0.85}}>GRACE IN MOTION</span>
			</div>
			<div style={{position: 'absolute', left: 0, width: 1080, top: 360, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, lineHeight: 0.92, letterSpacing: '0.03em', textShadow: '0 8px 36px rgba(0,0,0,0.65), 0 2px 6px rgba(0,0,0,0.55)'}}>
				<div style={{fontSize: 210, color: C.gold}}>2 MEN</div>
				<div style={{fontSize: 150, color: C.cream}}>NEVER DIED</div>
			</div>
		</div>
	);
};
