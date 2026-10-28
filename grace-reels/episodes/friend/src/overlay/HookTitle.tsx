// The opening punch: "HE ANSWERED WITH ONE WORD", then it flies up into the caption spot as the
// first caption arrives.
import {easeInOut, easeOutBack, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {C, SAFE, SERIF} from './theme';

export const HookTitle: React.FC<{t: number}> = ({t}) => {
	const inP = seg(t, B.hookTitleIn, B.hookTitleIn + 0.38);
	const fly = seg(t, B.hookTitleFly, B.hookTitleFly + 0.42, easeInOut);
	if (inP <= 0 || fly >= 1) return null;
	const punch = 1.2 - 0.2 * easeOutBack(inP, 2.2);
	// a slow grow while it holds (kept small so both lines stay inside the safe area, x 72–960)
	const drift = 1 + 0.008 * seg(t, B.hookTitleIn + 0.4, B.hookTitleFly);
	// fly toward the caption block (top-left), shrinking
	const cx = (SAFE.left + SAFE.right) / 2;
	const cy = 1240;
	const tx = (SAFE.left + 300 - cx) * fly;
	const ty = (330 - cy) * fly;
	const scale = punch * drift * (1 - 0.5 * fly);
	const blur = 8 * (1 - smooth(inP / 0.6)) + 4 * fly;
	const opacity = smooth(inP / 0.4) * (1 - smooth((fly - 0.35) / 0.65));
	return (
		<div
			style={{
				position: 'absolute',
				left: cx,
				top: cy,
				transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`,
				textAlign: 'center',
				fontFamily: SERIF,
				fontWeight: 700,
				lineHeight: 0.98,
				letterSpacing: '-0.005em',
				whiteSpace: 'nowrap',
				opacity,
				filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
				textShadow: '0 6px 30px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.55)',
			}}
		>
			<div style={{fontSize: 120, color: C.cream}}>HE ANSWERED</div>
			<div style={{fontSize: 110, color: C.gold, letterSpacing: '-0.025em'}}>WITH ONE WORD</div>
		</div>
	);
};
