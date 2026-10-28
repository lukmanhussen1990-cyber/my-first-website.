import React from 'react';
import {useCurrentFrame} from 'remotion';
import {alpha, PALETTE} from '../brand/brand';
import {bump, EASE_IN, EASE_IN_OUT, prog, tween} from '../brand/motion';
import {Layout} from './layout';

// Four-point star with concave sides, in a -1..1 box.
const STAR = 'M0 -1 Q0.13 -0.13 1 0 Q0.13 0.13 0 1 Q-0.13 0.13 -1 0 Q-0.13 -0.13 0 -1 Z';

/** Gold sparkle: fades in, quarter turn, two pulses, bursts into the mask, turns ink and sinks away. */
export const Sparkle: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f > 44) return null;
	const pulses = bump(f, 8, 3.2) + bump(f, 14, 3.2);
	const burst = bump(f, 20, 4);
	const grow = prog(f, 0, 10);
	const shrink = 1 - prog(f, 28, 42, EASE_IN);
	const scale = grow * (1 + 0.24 * pulses + 0.45 * burst) * shrink;
	const rot = tween(f, [0, 18], [0, 90]) + tween(f, [18, 44], [0, 120], EASE_IN_OUT);
	const toInk = prog(f, 20, 27);
	const r = 46 * L.s;
	const glow = (0.55 + 0.45 * pulses + burst) * (1 - toInk * 0.8) * grow;

	return (
		<div style={{position: 'absolute', left: L.cx, top: L.cy, width: 0, height: 0}}>
			<div
				style={{
					position: 'absolute',
					left: -r * 5,
					top: -r * 5,
					width: r * 10,
					height: r * 10,
					borderRadius: '50%',
					opacity: glow,
					background: `radial-gradient(circle, ${alpha(PALETTE.amberGlow, 0.55)} 0%, ${alpha(PALETTE.gold, 0.18)} 22%, transparent 60%)`,
				}}
			/>
			<svg
				width={r * 2}
				height={r * 2}
				viewBox="-1 -1 2 2"
				style={{
					position: 'absolute',
					left: -r,
					top: -r,
					overflow: 'visible',
					transform: `rotate(${rot}deg) scale(${scale})`,
				}}
			>
				<defs>
					<radialGradient id="sparkle-gold" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse">
						<stop offset="0" stopColor="#FFF6E0" />
						<stop offset="0.35" stopColor={PALETTE.amberGlow} />
						<stop offset="1" stopColor={PALETTE.gold} />
					</radialGradient>
				</defs>
				<path d={STAR} fill="url(#sparkle-gold)" opacity={1 - toInk} />
				<path d={STAR} fill={PALETTE.ink} opacity={toInk * 0.92} />
			</svg>
		</div>
	);
};
