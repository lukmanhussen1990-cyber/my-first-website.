import {CameraMotionBlur} from '@remotion/motion-blur';
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {alpha, FONT, GOLD_GRADIENT, PALETTE} from '../brand/brand';
import {bump, EASE_IN, EASE_IN_OUT, monotoneCurve, prog, tween} from '../brand/motion';
import {Layout} from './layout';

export const GLASS: React.CSSProperties = {
	background: `linear-gradient(180deg, rgba(255,242,222,0.22) 0%, rgba(60,42,26,0.30) 100%)`,
	backdropFilter: 'blur(26px) saturate(1.35)',
	WebkitBackdropFilter: 'blur(26px) saturate(1.35)',
	boxShadow: [
		'inset 0 1.5px 0 rgba(255,250,240,0.7)',
		'inset 0 0 0 1px rgba(255,236,200,0.30)',
		'inset 0 -16px 34px rgba(255,210,122,0.12)',
		'0 26px 60px rgba(14,11,9,0.42)',
	].join(', '),
};

// 0 → 250 → 640 → 912 → 999 → 1,000: fast in the middle, a slow last roll.
const countAt = monotoneCurve([
	[46, 0],
	[49.5, 250],
	[53, 640],
	[56.5, 912],
	[60, 999],
	[67, 1000],
]);
export const COUNT_LANDS = 67;

const DIGIT_W = 0.62; // em, tabular figures
const CELL_H = 1.16; // em

/** Odometer roll with carry: a digit only turns while everything to its right rolls over. */
const digitPos = (v: number, d: number) => {
	if (d === 0) return v % 10;
	const p = 10 ** d;
	const base = Math.floor(v / p) % 10;
	const roll = Math.min(1, Math.max(0, (v % p) - (p - 1)));
	return base + roll;
};
const presence = (v: number, d: number) => (d === 0 ? 1 : Math.min(1, Math.max(0, v - (10 ** d - 1))));

const Odometer: React.FC<{size: number}> = ({size}) => {
	const f = useCurrentFrame();
	const v = countAt(f);
	const sweep = tween(f, [COUNT_LANDS - 1, COUNT_LANDS + 8], [-0.4, 1.4], EASE_IN_OUT);
	const cols: {kind: 'digit' | 'comma'; d: number}[] = [
		{kind: 'digit', d: 3},
		{kind: 'comma', d: 3},
		{kind: 'digit', d: 2},
		{kind: 'digit', d: 1},
		{kind: 'digit', d: 0},
	];
	const widths = cols.map((c) => presence(v, c.d) * (c.kind === 'comma' ? 0.28 : DIGIT_W) * size);
	const total = widths.reduce((a, b) => a + b, 0);
	let x = 0;
	return (
		<div style={{display: 'flex', height: CELL_H * size, overflow: 'hidden', width: total}}>
			{cols.map((c, i) => {
				const w = widths[i];
				const offset = x;
				x += w;
				const pr = presence(v, c.d);
				// shimmer band in number space: gold behind it, cream ahead of it
				const bx = sweep * total;
				const fill = {
					backgroundImage: `linear-gradient(90deg, ${PALETTE.gold} 0px, ${PALETTE.amberGlow} ${bx - 26}px, #FFF8EA ${bx}px, ${PALETTE.cream} ${bx + 30}px, ${PALETTE.cream} ${total + 60}px)`,
					backgroundSize: `${total + 60}px 100%`,
					backgroundPositionX: -offset,
					backgroundRepeat: 'no-repeat',
					WebkitBackgroundClip: 'text',
					backgroundClip: 'text',
					color: 'transparent',
				} as React.CSSProperties;
				if (c.kind === 'comma') {
					return (
						<div key={i} style={{width: w, opacity: pr, lineHeight: `${CELL_H * size}px`, ...fill}}>
							,
						</div>
					);
				}
				const pos = digitPos(v, c.d);
				return (
					<div key={i} style={{width: w, opacity: pr, position: 'relative'}}>
						<div style={{transform: `translateY(${-pos * CELL_H * size}px)`, ...fill}}>
							{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, k) => (
								<div key={k} style={{height: CELL_H * size, lineHeight: `${CELL_H * size}px`, textAlign: 'center', width: DIGIT_W * size}}>
									{n}
								</div>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
};

const Plus: React.FC<{size: number; rot: number}> = ({size, rot}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" style={{transform: `rotate(${rot}deg)`}}>
		<path d="M12 4 V20 M4 12 H20" stroke={PALETTE.cream} strokeWidth={1.8} strokeLinecap="round" />
	</svg>
);

const Heart: React.FC<{size: number; color?: string}> = ({size, color = PALETTE.warmBlack}) => (
	<svg width={size} height={size} viewBox="0 0 24 24">
		<path
			d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"
			fill={color}
		/>
	</svg>
);

/** Glass "+" circle rises, stretches into a pill, counts to 1,000, morphs into "1K", slides up. */
export const CounterPill: React.FC<{L: Layout; push: number}> = ({L, push}) => {
	const f = useCurrentFrame();
	if (f < 42) return null;
	const s = L.s;
	const H0 = 150 * s;
	const W1 = 700 * s;
	const W2 = 360 * s;
	const H2 = 196 * s;

	const appear = prog(f, 42, 53);
	const expand = prog(f, 50, 61);
	const morph = prog(f, 71, 84);
	const slide = prog(f, 80, 97, EASE_IN_OUT);

	const w = H0 + (W1 - H0) * expand + (W2 - W1) * morph;
	const h = H0 + (H2 - H0) * morph;
	const y = L.cy + (1 - appear) * 260 * s + (L.badgeY - L.cy) * slide;
	const scale = (0.6 + 0.4 * appear) * (1 - 0.18 * slide) * push;
	const blur = (1 - appear) * 10;

	const plusOpacity = 1 - prog(f, 69, 75);
	const numberIn = prog(f, 52, 58);
	const numberOut = prog(f, 70, 79, EASE_IN);
	const kIn = prog(f, 73, 86);
	const heartIn = prog(f, 55, 63) * (1 - prog(f, 69, 75));
	const heartPop = 1 + 0.22 * bump(f, COUNT_LANDS + 1, 3);
	const digitSize = 84 * s;
	const rollingFast = f >= 45 && f <= COUNT_LANDS + 2;

	const odo = (
		<div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'center', height: '100%', alignContent: 'center', flexWrap: 'wrap'}}>
			<div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: digitSize, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em'}}>
				<Odometer size={digitSize} />
			</div>
		</div>
	);

	return (
		<div
			style={{
				position: 'absolute',
				left: L.cx - w / 2,
				top: y - h / 2,
				width: w,
				height: h,
				transform: `scale(${scale})`,
				opacity: appear,
				filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
			}}
		>
			<div style={{position: 'absolute', inset: 0, borderRadius: h / 2, ...GLASS}} />
			{/* "+" — turns from × to + and rides to the left edge as the pill stretches */}
			<div
				style={{
					position: 'absolute',
					left: H0 / 2 - 26 * s,
					top: h / 2 - 26 * s,
					opacity: plusOpacity,
				}}
			>
				<Plus size={52 * s} rot={tween(f, [42, 55], [45, 0])} />
			</div>
			{/* counter + label */}
			<div
				style={{
					position: 'absolute',
					left: H0 * 0.8,
					right: H0 * 0.8,
					top: 0,
					bottom: 0,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 18 * s,
					opacity: numberIn * (1 - numberOut),
					filter: numberOut > 0.01 ? `blur(${numberOut * 14}px)` : undefined,
					transform: `scale(${1 - 0.12 * numberOut})`,
				}}
			>
				<div style={{position: 'relative', height: CELL_H * digitSize, minWidth: 10}}>
					{rollingFast ? (
						<div style={{position: 'relative', height: '100%'}}>
							{/* sized ghost so the motion-blur layer has a footprint */}
							<div style={{visibility: 'hidden'}}>{odo}</div>
							<CameraMotionBlur shutterAngle={200} samples={8}>
								{odo}
							</CameraMotionBlur>
						</div>
					) : (
						odo
					)}
				</div>
				<div style={{fontFamily: FONT.sans, fontWeight: 500, fontSize: 32 * s, color: alpha(PALETTE.cream, 0.78), paddingTop: 10 * s, opacity: 1 - prog(f, 66, 71), maxWidth: (1 - prog(f, 66, 72)) * 200 * s, overflow: 'hidden'}}>
					followers
				</div>
			</div>
			{/* gold heart button on the right */}
			<div
				style={{
					position: 'absolute',
					right: 14 * s,
					top: h / 2 - (H0 - 28 * s) / 2,
					width: H0 - 28 * s,
					height: H0 - 28 * s,
					borderRadius: '50%',
					background: GOLD_GRADIENT,
					boxShadow: `0 0 ${30 * s}px ${alpha(PALETTE.gold, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.6)`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					transform: `scale(${heartIn * heartPop})`,
					opacity: heartIn,
				}}
			>
				<Heart size={48 * s} />
			</div>
			{/* the big 1K */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					opacity: kIn,
					transform: `scale(${1.22 - 0.22 * kIn})`,
					filter: `blur(${(1 - kIn) * 24}px) drop-shadow(0 0 ${22 * s}px ${alpha(PALETTE.amberGlow, 0.45)})`,
				}}
			>
				<div
					style={{
						fontFamily: FONT.serif,
						fontWeight: 700,
						fontSize: 170 * s,
						lineHeight: 1,
						paddingTop: 14 * s,
						letterSpacing: '0.02em',
						fontFeatureSettings: '"lnum" 1',
						fontVariantNumeric: 'lining-nums',
						backgroundImage: GOLD_GRADIENT,
						WebkitBackgroundClip: 'text',
						backgroundClip: 'text',
						color: 'transparent',
					}}
				>
					1K
				</div>
			</div>
		</div>
	);
};
