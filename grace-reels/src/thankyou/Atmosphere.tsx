import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {alpha, PALETTE} from '../brand/brand';
import {T} from './layout';

/** Warm black with 3 slowly drifting gold glow blobs. Freezes for the final hold. */
export const GlowBlobs: React.FC<{intensity: number}> = ({intensity}) => {
	const frame = Math.min(useCurrentFrame(), T.hold);
	const {width, height} = useVideoConfig();
	const t = frame / 30;
	const blobs = [
		{x: 0.25 + 0.06 * Math.sin(t * 0.7), y: 0.78 + 0.03 * Math.cos(t * 0.5), r: 0.75, c: PALETTE.deepGold, a: 0.55},
		{x: 0.78 + 0.05 * Math.cos(t * 0.6), y: 0.88 + 0.03 * Math.sin(t * 0.8), r: 0.7, c: PALETTE.gold, a: 0.28},
		{x: 0.55 + 0.07 * Math.sin(t * 0.45 + 1), y: 0.3 + 0.04 * Math.cos(t * 0.55), r: 0.6, c: PALETTE.amberGlow, a: 0.14},
	];
	const m = Math.max(width, height);
	return (
		<AbsoluteFill style={{background: PALETTE.warmBlack}}>
			{blobs.map((b, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: b.x * width - (b.r * m) / 2,
						top: b.y * height - (b.r * m) / 2,
						width: b.r * m,
						height: b.r * m,
						borderRadius: '50%',
						background: `radial-gradient(circle, ${alpha(b.c, b.a * intensity)} 0%, ${alpha(b.c, b.a * intensity * 0.35)} 35%, transparent 70%)`,
					}}
				/>
			))}
		</AbsoluteFill>
	);
};

/** Subtle film grain (seeded per frame, frozen for the final hold) + soft vignette. */
export const GrainVignette: React.FC = () => {
	const frame = Math.min(useCurrentFrame(), T.hold);
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<AbsoluteFill
				style={{
					background: 'radial-gradient(ellipse 75% 65% at 50% 46%, transparent 55%, rgba(8,6,4,0.62) 100%)',
				}}
			/>
			<svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: 0.09, mixBlendMode: 'overlay'}}>
				<filter id="grain">
					<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={(frame % 97) + 1} stitchTiles="stitch" />
					<feColorMatrix type="saturate" values="0" />
				</filter>
				<rect width="100%" height="100%" filter="url(#grain)" />
			</svg>
		</AbsoluteFill>
	);
};
