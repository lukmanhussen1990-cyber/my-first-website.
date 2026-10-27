// S11: the one word. Huge gold capitals that glow softly and keep growing a little while the line is said.
import {easeOut, seg, smooth} from '../lib/ease';
import {hash} from '../lib/random';
import {B} from '../lib/timeline';
import {SAFE, SERIF} from './theme';

export const FRIEND_Y = 1180;
// a warm gold, brighter at the top of each letter (set per letter: a clipped background does not reach
// into transformed children)
const GOLD: React.CSSProperties = {
	background: 'linear-gradient(180deg, #fff1c6 0%, #f7cd6a 38%, #F2B544 60%, #c98a2a 100%)',
	WebkitBackgroundClip: 'text',
	backgroundClip: 'text',
	color: 'transparent',
};
const OUT = B.cardMatthewIn - 0.05;

export const FriendWord: React.FC<{t: number}> = ({t}) => {
	const x = t - B.friendWord;
	const inP = seg(t, B.friendWord - 0.04, B.friendWord + 0.5, easeOut);
	const out = seg(t, OUT - 0.35, OUT + 0.15);
	if (inP <= 0 || out >= 1) return null;
	// a slow, steady grow (never stops), a soft bloom at the start that settles into a gentle breathing glow
	const scale = 0.9 + 0.1 * inP + 0.025 * Math.max(0, x) - 0.04 * out;
	const bloom = Math.exp(-Math.max(0, x) * 1.6);
	const breathe = 0.5 + 0.5 * Math.sin(x * 2.4);
	const glowR = 26 + 30 * bloom + 8 * breathe;
	const glowA = 0.45 + 0.4 * bloom + 0.1 * breathe;
	const letters = 'FRIEND'.split('');
	return (
		<div
			style={{
				position: 'absolute',
				left: (SAFE.left + SAFE.right) / 2,
				top: FRIEND_Y,
				transform: `translate(-50%, -50%) translateY(${-30 * out}px) scale(${scale})`,
				opacity: smooth(inP / 0.7) * (1 - out),
				fontFamily: SERIF,
				fontWeight: 700,
				fontSize: 228,
				lineHeight: 1,
				letterSpacing: '0.06em',
				whiteSpace: 'nowrap',
				filter: `drop-shadow(0 0 ${glowR}px rgba(242,181,68,${glowA})) drop-shadow(0 6px 18px rgba(0,0,0,0.55))`,
			}}
		>
			{letters.map((ch, i) => {
				// each letter settles from a little lower, one after another
				const p = seg(t, B.friendWord - 0.04 + i * 0.035, B.friendWord + 0.4 + i * 0.035, easeOut);
				return (
					<span key={i} style={{...GOLD, display: 'inline-block', transform: `translateY(${18 * (1 - p) * (0.6 + 0.4 * hash(611, i))}px)`, opacity: 0.25 + 0.75 * p}}>
						{ch}
					</span>
				);
			})}
		</div>
	);
};
