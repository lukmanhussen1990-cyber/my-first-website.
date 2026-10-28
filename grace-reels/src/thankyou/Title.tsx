import React from 'react';
import {useCurrentFrame} from 'remotion';
import {alpha, FONT, PALETTE} from '../brand/brand';
import {EASE_IN_OUT, prog, tween} from '../brand/motion';
import {Layout} from './layout';

/** One word: 30 px blur → sharp, tracking settles, a light sweep crosses the letters. */
const Word: React.FC<{text: string; start: number; y: number; size: number; keyword?: boolean}> = ({
	text,
	start,
	y,
	size,
	keyword,
}) => {
	const f = useCurrentFrame();
	const p = prog(f, start, start + 16);
	const band = tween(f, [start + 5, start + 24], [-30, 130], EASE_IN_OUT);
	const base = keyword
		? `linear-gradient(100deg, ${PALETTE.gold} ${band - 40}%, ${PALETTE.amberGlow} ${band - 8}%, #FFFDF6 ${band}%, ${PALETTE.cream} ${band + 14}%)`
		: `linear-gradient(100deg, ${PALETTE.cream} ${band - 22}%, #FFFDF6 ${band - 4}%, ${PALETTE.amberGlow} ${band}%, #FFFDF6 ${band + 4}%, ${PALETTE.cream} ${band + 22}%)`;
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: y - size * 0.5,
				height: size,
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				opacity: p,
				transform: `translateY(${(1 - p) * 40}px) scale(${1.08 - 0.08 * p})`,
				filter: `blur(${(1 - p) * 30}px) drop-shadow(0 0 ${size * 0.12}px ${alpha(PALETTE.amberGlow, 0.32)})`,
			}}
		>
			<div
				style={{
					fontFamily: FONT.serif,
					fontWeight: 700,
					fontSize: size,
					lineHeight: 1,
					paddingTop: size * 0.1,
					letterSpacing: `${0.16 - 0.1 * p}em`,
					marginRight: `-${0.16 - 0.1 * p}em`,
					backgroundImage: base,
					WebkitBackgroundClip: 'text',
					backgroundClip: 'text',
					color: 'transparent',
				}}
			>
				{text}
			</div>
		</div>
	);
};

export const Title: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f < 78) return null;
	const sub = prog(f, 96, 109);
	return (
		<>
			{/* soft dark scrim behind the words for phone readability */}
			<div
				style={{
					position: 'absolute',
					left: L.cx - 560 * L.s,
					top: (L.thankY + L.youY) / 2 - 420 * L.s,
					width: 1120 * L.s,
					height: 840 * L.s,
					borderRadius: '50%',
					opacity: prog(f, 78, 96),
					background: 'radial-gradient(ellipse, rgba(14,11,9,0.55) 0%, rgba(14,11,9,0.25) 45%, transparent 70%)',
				}}
			/>
			<Word text="THANK" start={80} y={L.thankY} size={L.titleSize} />
			<Word text="YOU" start={88} y={L.youY} size={L.titleSize} keyword />
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: L.subY - 30 * L.s,
					textAlign: 'center',
					fontFamily: FONT.sans,
					fontWeight: 500,
					fontSize: 46 * L.s,
					letterSpacing: '0.01em',
					color: alpha(PALETTE.cream, 0.9),
					opacity: sub,
					transform: `translateY(${(1 - sub) * 22}px)`,
					filter: `blur(${(1 - sub) * 12}px)`,
					textShadow: '0 2px 18px rgba(14,11,9,0.6)',
				}}
			>
				for <span style={{color: PALETTE.gold, fontWeight: 600}}>1,000</span> followers
			</div>
		</>
	);
};
