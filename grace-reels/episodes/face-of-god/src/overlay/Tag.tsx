// The small time tag of the rewind: "A FEW HOURS EARLIER" with a rewind mark.
import {easeOut, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {C, SANS} from './theme';

export const Tag: React.FC<{t: number}> = ({t}) => {
	const inP = seg(t, B.tagIn, B.tagIn + 0.35, easeOut);
	const out = smooth((t - (B.tagOut - 0.3)) / 0.3);
	if (inP <= 0 || out >= 1) return null;
	// the two arrowheads spin backwards a little as it appears
	const spin = -360 * (1 - easeOut(seg(t, B.tagIn, B.tagIn + 0.6)));
	return (
		<div
			style={{
				position: 'absolute',
				left: 540,
				top: 1235,
				transform: `translate(-50%, -50%) translateY(${12 * (1 - inP)}px) scale(${0.92 + 0.08 * inP})`,
				opacity: smooth(inP / 0.6) * (1 - out),
				display: 'flex',
				alignItems: 'center',
				gap: 14,
				height: 52,
				padding: '0 22px 0 16px',
				borderRadius: 26,
				background: C.tag,
				boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
			}}
		>
			<svg width={26} height={26} viewBox="0 0 24 24" style={{transform: `rotate(${spin}deg)`}}>
				<path d="M11 6 L3 12 L11 18 Z M21 6 L13 12 L21 18 Z" fill={C.gold} />
			</svg>
			<span style={{fontFamily: SANS, fontWeight: 600, fontSize: 24, letterSpacing: '0.16em', color: '#FFFFFF', whiteSpace: 'nowrap'}}>A FEW HOURS EARLIER</span>
		</div>
	);
};
