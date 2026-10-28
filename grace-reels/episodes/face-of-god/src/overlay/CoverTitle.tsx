// Title treatment for the cover image (the reel's thumbnail).
import {Logo} from './Logo';
import {C, SAFE, SANS, SERIF, useFontsReady} from './theme';

export const CoverTitle: React.FC = () => {
	useFontsReady();
	return (
		<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1000, background: 'linear-gradient(to bottom, rgba(16,10,5,0.72) 0%, rgba(16,10,5,0.5) 50%, rgba(16,10,5,0) 100%)'}} />
			<div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: 290, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14}}>
				<Logo size={40} />
				<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.18em', color: C.cream, opacity: 0.85}}>GRACE IN MOTION</span>
			</div>
			{/* kept inside the safe area (x 72–960) like the reel's own text */}
			<div style={{position: 'absolute', left: SAFE.left, width: SAFE.right - SAFE.left, top: 360, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, lineHeight: 0.95, letterSpacing: '0.03em', textShadow: '0 8px 36px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.6)'}}>
				<div style={{fontSize: 174, color: C.gold}}>HE KNEW…</div>
				<div style={{fontSize: 92, color: C.cream, marginTop: 18}}>AND WASHED</div>
				<div style={{fontSize: 92, color: C.cream}}>HIS FEET ANYWAY</div>
			</div>
		</div>
	);
};
