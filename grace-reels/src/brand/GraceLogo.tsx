import React from 'react';
import {PALETTE} from './brand';

type Props = {
	/** Rendered height in px (width is 200/240 of it). */
	size: number;
	/** 0→1: the cross strokes draw themselves (upright first, then the crossbar). */
	draw?: number;
	/** 0→1: the three motion lines draw in, staggered, right to left. */
	lines?: number;
	/** 0→1: soft amber glow around the strokes. */
	glow?: number;
	id?: string;
};

// viewBox 0 0 200 240 — slim cross, three motion lines on its left, each shorter than the last.
const UPRIGHT = 'M120 18 L120 222';
const CROSSBAR = 'M82 80 L158 80';
const MOTION = [
	{d: 'M96 112 L40 112', len: 56},
	{d: 'M96 136 L56 136', len: 40},
	{d: 'M96 160 L72 160', len: 24},
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export const GraceLogo: React.FC<Props> = ({size, draw = 1, lines = 1, glow = 1, id = 'grace-logo'}) => {
	const upright = clamp01(draw / 0.7);
	const crossbar = clamp01((draw - 0.3) / 0.7);
	const strokes = (
		<>
			<path d={UPRIGHT} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - upright} strokeWidth={7} />
			<path d={CROSSBAR} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - crossbar} strokeWidth={7} />
			{MOTION.map((m, i) => {
				const p = clamp01((lines - i * 0.18) / 0.64);
				return (
					<path
						key={m.d}
						d={m.d}
						pathLength={1}
						strokeDasharray="1 1"
						strokeDashoffset={1 - p}
						strokeWidth={5.5}
						opacity={0.35 + 0.65 * p}
					/>
				);
			})}
		</>
	);
	return (
		<svg width={(size * 200) / 240} height={size} viewBox="0 0 200 240" style={{overflow: 'visible'}}>
			<defs>
				<linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="240" gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor={PALETTE.amberGlow} />
					<stop offset="0.5" stopColor={PALETTE.gold} />
					<stop offset="1" stopColor={PALETTE.deepGold} />
				</linearGradient>
				<filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
					<feGaussianBlur stdDeviation="9" />
				</filter>
			</defs>
			<g fill="none" strokeLinecap="round" stroke={PALETTE.amberGlow} opacity={0.75 * glow} filter={`url(#${id}-glow)`}>
				{strokes}
			</g>
			<g fill="none" strokeLinecap="round" stroke={`url(#${id}-gold)`}>
				{strokes}
			</g>
		</svg>
	);
};
