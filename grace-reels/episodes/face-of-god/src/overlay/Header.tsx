// Top bar: our logo + GRACE IN MOTION on the left, the episode title on the right.
import {Logo} from './Logo';
import {C, SAFE, SANS} from './theme';

const text: React.CSSProperties = {
	fontFamily: SANS,
	fontWeight: 600,
	fontSize: 22,
	letterSpacing: '0.18em',
	textTransform: 'uppercase',
	color: C.cream,
	opacity: 0.75,
	textShadow: '0 1px 6px rgba(0,0,0,0.45)',
	whiteSpace: 'nowrap',
};

export const Header: React.FC<{opacity: number}> = ({opacity}) => {
	if (opacity <= 0.001) return null;
	return (
		<>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 260, opacity, background: 'linear-gradient(to bottom, rgba(40,22,8,0.22), rgba(40,22,8,0))'}} />
			<div style={{position: 'absolute', left: SAFE.left, top: 150, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 14, opacity}}>
				<Logo size={34} style={{filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.4))'}} />
				<span style={text}>Grace in Motion</span>
			</div>
			<div style={{position: 'absolute', right: 1080 - SAFE.right, top: 150, transform: 'translateY(-50%)', opacity}}>
				<span style={text}>The Face of God</span>
			</div>
		</>
	);
};
