// The opening title, up from the first frame: "HE ASKED TO SEE" / "GOD'S FACE" (gold, glowing), centred
// around y = 1150. After "face" it flies up into the caption spot as the first caption arrives.
import {easeInOut, easeOutBack, seg, smooth} from '../lib/ease';
import {B} from '../lib/timeline';
import {C, SAFE, SERIF} from './theme';

export const HookTitle: React.FC<{t: number}> = ({t}) => {
	// a quick punch-in over the first frames (it is already readable on frame 1: no fade from black)
	const inP = seg(t, B.hookTitleIn, B.hookTitleIn + 0.32);
	const fly = seg(t, B.hookTitleFly, B.hookTitleFly + 0.42, easeInOut);
	if (fly >= 1) return null;
	const punch = 1.14 - 0.14 * easeOutBack(inP, 2.2);
	// a slow grow while it holds (small, so both lines stay inside the safe area, x 72–960)
	const drift = 1 + 0.012 * seg(t, B.hookTitleIn + 0.3, B.hookTitleFly);
	const cx = (SAFE.left + SAFE.right) / 2;
	const cy = 1150;
	const tx = (SAFE.left + 300 - cx) * fly;
	const ty = (330 - cy) * fly;
	const scale = punch * drift * (1 - 0.5 * fly);
	const blur = 1.2 * (1 - smooth(inP / 0.4)) + 4 * fly;
	const opacity = (0.85 + 0.15 * smooth(inP / 0.25)) * (1 - smooth((fly - 0.35) / 0.65));
	// the gold line breathes with the light
	const glow = 0.75 + 0.25 * Math.sin(t * 5.2);
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
				lineHeight: 1.0,
				whiteSpace: 'nowrap',
				opacity,
				filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
			}}
		>
			<div style={{fontSize: 96, color: '#FFFFFF', letterSpacing: '0.01em', textShadow: '0 6px 30px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.6)'}}>HE ASKED TO SEE</div>
			<div
				style={{
					fontSize: 120,
					color: C.gold,
					letterSpacing: '0.005em',
					textShadow: `0 0 ${26 * glow}px rgba(255,214,120,${0.75 * glow}), 0 0 ${60 * glow}px rgba(242,181,68,${0.45 * glow}), 0 4px 18px rgba(0,0,0,0.6)`,
				}}
			>
				GOD’S FACE
			</div>
		</div>
	);
};
