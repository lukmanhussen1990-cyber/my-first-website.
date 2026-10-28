// The opening title, readable from the first frame: "WHY DOESN'T GOD" / "STOP EVIL?" (gold, glowing),
// centred around y = 1150. It lifts away and fades just before "Right now?".
import {easeInOut, easeOutBack, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {C, SAFE, SERIF} from './theme';

export const HookTitle: React.FC<{t: number}> = ({t}) => {
	// a quick punch-in over the first frames (no fade from black: frame 1 already reads)
	const inP = seg(t, 0, 0.32);
	const out = seg(t, B.titleOut - 0.3, B.titleOut + 0.25, easeInOut);
	if (out >= 1) return null;
	const punch = 1.12 - 0.12 * easeOutBack(inP, 2.2);
	// a slow grow while it holds (small, so both lines stay inside the safe area, x 72–960)
	const drift = 1 + 0.015 * seg(t, 0.3, B.titleOut);
	const cx = (SAFE.left + SAFE.right) / 2;
	const cy = 1150;
	const scale = punch * drift * (1 + 0.06 * out);
	const blur = 1.0 * (1 - smooth(inP / 0.4)) + 5 * out;
	const opacity = (0.88 + 0.12 * smooth(inP / 0.25)) * (1 - out);
	// the gold line breathes like the moonlit wheat
	const glow = 0.75 + 0.25 * Math.sin(t * 4.6);
	return (
		<div
			style={{
				position: 'absolute',
				left: cx,
				top: cy,
				transform: `translate(-50%, -50%) translateY(${-40 * out}px) scale(${scale})`,
				textAlign: 'center',
				fontFamily: SERIF,
				fontWeight: 700,
				lineHeight: 1.0,
				whiteSpace: 'nowrap',
				opacity,
				filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
			}}
		>
			<div style={{fontSize: 96, color: '#FFFFFF', letterSpacing: '0.01em', textShadow: '0 6px 30px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.65)'}}>WHY DOESN’T GOD</div>
			<div
				style={{
					fontSize: 120,
					color: C.gold,
					letterSpacing: '0.005em',
					textShadow: `0 0 ${26 * glow}px rgba(255,214,120,${0.75 * glow}), 0 0 ${60 * glow}px rgba(242,181,68,${0.45 * glow}), 0 4px 18px rgba(0,0,0,0.65)`,
				}}
			>
				STOP EVIL?
			</div>
		</div>
	);
};
