import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {alpha, BRAND, FONT, PALETTE} from './brand';
import {GraceLogo} from './GraceLogo';
import {EASE_OUT, prog, tween} from './motion';

type Props = {
	/** First frame of the end card. Every animation lands by `start + 9`. */
	start: number;
	/** Vertical center of the logo, px. */
	logoY: number;
	/** 1 for 1080-wide vertical; smaller for tighter frames. */
	scale?: number;
};

/**
 * Logo draws itself, then wordmark + handle slide up, verse fades in.
 * Fast, front-loaded easing so a 0.3 s intro still feels smooth and leaves a clean hold.
 */
export const EndCard: React.FC<Props> = ({start, logoY, scale = 1}) => {
	const f = useCurrentFrame() - start;
	if (f < -1) return null;

	const draw = prog(f, 0, 8);
	const lines = prog(f, 2, 9);
	const glow = tween(f, [0, 9], [0, 1]);
	const logoScale = tween(f, [0, 9], [0.92, 1]);

	const rise = (a: number, b: number) => {
		const p = prog(f, a, b, EASE_OUT);
		return {
			opacity: p,
			transform: `translateY(${(1 - p) * 26 * scale}px)`,
			filter: `blur(${(1 - p) * 10 * scale}px)`,
		};
	};

	const logoSize = 236 * scale;
	const wordY = logoY + logoSize * 0.5 + 64 * scale;

	return (
		<AbsoluteFill>
			{/* soft amber halo behind the mark */}
			<div
				style={{
					position: 'absolute',
					left: '50%',
					top: logoY,
					width: 760 * scale,
					height: 760 * scale,
					transform: 'translate(-50%, -50%)',
					borderRadius: '50%',
					background: `radial-gradient(circle, ${alpha(PALETTE.amberGlow, 0.2 * glow)} 0%, ${alpha(PALETTE.gold, 0.08 * glow)} 35%, transparent 68%)`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: '50%',
					top: logoY,
					transform: `translate(-54%, -50%) scale(${logoScale})`,
				}}
			>
				<GraceLogo size={logoSize} draw={draw} lines={lines} glow={glow} id="endcard-logo" />
			</div>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: wordY,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					textAlign: 'center',
				}}
			>
				<div
					style={{
						...rise(2, 9),
						fontFamily: FONT.sans,
						fontWeight: 600,
						fontSize: 54 * scale,
						letterSpacing: '0.3em',
						marginRight: '-0.3em',
						color: PALETTE.cream,
						textShadow: `0 0 ${28 * scale}px ${alpha(PALETTE.amberGlow, 0.35)}`,
						lineHeight: 1.1,
					}}
				>
					{BRAND.name}
				</div>
				<div
					style={{
						...rise(3, 9),
						marginTop: 18 * scale,
						fontFamily: FONT.sans,
						fontWeight: 500,
						fontSize: 36 * scale,
						letterSpacing: '0.02em',
						color: PALETTE.gold,
						textShadow: `0 0 ${18 * scale}px ${alpha(PALETTE.gold, 0.4)}`,
					}}
				>
					{BRAND.handle}
				</div>
				<div style={{...rise(4, 9), marginTop: 46 * scale}}>
					<div
						style={{
							fontFamily: FONT.serif,
							fontStyle: 'italic',
							fontWeight: 500,
							fontSize: 40 * scale,
							color: alpha(PALETTE.cream, 0.85),
							lineHeight: 1.25,
							maxWidth: 760 * scale,
						}}
					>
						“{BRAND.verse}”
					</div>
					<div
						style={{
							marginTop: 12 * scale,
							fontFamily: FONT.sans,
							fontWeight: 500,
							fontSize: 22 * scale,
							letterSpacing: '0.28em',
							marginRight: '-0.28em',
							color: alpha(PALETTE.gold, 0.9),
						}}
					>
						{BRAND.verseRef}
					</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};
