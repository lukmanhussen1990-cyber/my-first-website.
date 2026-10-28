import React from 'react';
import {random, useCurrentFrame} from 'remotion';
import {alpha, GOLD_GRADIENT, PALETTE} from '../brand/brand';
import {bump, prog} from '../brand/motion';
import {GLASS} from './CounterPill';
import {Layout} from './layout';

const N_AVATARS = 8;

const Silhouette: React.FC<{variant: number}> = ({variant}) => {
	const bg = [
		`radial-gradient(circle at 35% 30%, ${PALETTE.amberGlow}, ${PALETTE.gold} 45%, ${PALETTE.deepGold})`,
		`radial-gradient(circle at 35% 30%, #C98A3A, ${PALETTE.deepGold} 55%, ${PALETTE.ink})`,
		`radial-gradient(circle at 35% 30%, ${PALETTE.cream}, #E8C98E 55%, ${PALETTE.gold})`,
	][variant % 3];
	const fg = variant % 3 === 2 ? alpha(PALETTE.deepGold, 0.85) : alpha(PALETTE.cream, 0.9);
	return (
		<div style={{position: 'absolute', inset: '12%', borderRadius: '50%', overflow: 'hidden', background: bg}}>
			<svg viewBox="0 0 100 100" width="100%" height="100%">
				<circle cx="50" cy="40" r="16" fill={fg} />
				<path d="M18 100 C20 72 36 62 50 62 C64 62 80 72 82 100 Z" fill={fg} />
			</svg>
		</div>
	);
};

/** Generic follower avatars float in from depth and orbit gently around THANK YOU. */
export const Avatars: React.FC<{L: Layout; push: number}> = ({L, push}) => {
	const f = useCurrentFrame();
	if (f < 102) return null;
	return (
		<>
			{new Array(N_AVATARS).fill(0).map((_, i) => {
				const start = 104 + i * 1.7;
				const p = prog(f, start, start + 18);
				if (p <= 0) return null;
				const depth = 0.55 + 0.45 * random(`depth-${i}`);
				const ring = [1, 0.9, 1.08][i % 3];
				const theta = (i / N_AVATARS) * Math.PI * 2 + 0.35 + random(`th-${i}`) * 0.25 + ((f - 104) / 30) * 0.42;
				const rx = L.orbit.rx * ring * p;
				const ry = L.orbit.ry * ring * p;
				const x = L.orbit.cx + Math.cos(theta) * rx;
				const y = L.orbit.cy + Math.sin(theta) * ry;
				const d = (92 + 46 * random(`size-${i}`)) * L.s * depth;
				const scale = (0.2 + 0.8 * p) * push;
				const blur = (1 - p) * 12 + (1 - depth) * 3;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x - d / 2,
							top: y - d / 2,
							width: d,
							height: d,
							opacity: p * (0.6 + 0.4 * depth),
							transform: `scale(${scale})`,
							filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
						}}
					>
						<div style={{position: 'absolute', inset: 0, borderRadius: '50%', ...GLASS}} />
						<Silhouette variant={i} />
					</div>
				);
			})}
		</>
	);
};

const HEART = 'M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z';

/** Tiny gold hearts drifting upward + twinkling dust. */
export const HeartsAndDust: React.FC<{L: Layout}> = ({L}) => {
	const f = useCurrentFrame();
	if (f < 100) return null;
	const hearts = new Array(13).fill(0).map((_, i) => {
		const start = 108 + random(`hs-${i}`) * 16;
		const life = 26 + random(`hl-${i}`) * 10;
		const t = (f - start) / life;
		if (t <= 0 || t >= 1.2) return null;
		const x0 = L.cx + (random(`hx-${i}`) - 0.5) * 760 * L.s;
		const y0 = L.orbit.cy + (0.25 + random(`hy-${i}`) * 0.4) * L.orbit.ry;
		const rise = t * (240 + 160 * random(`hr-${i}`)) * L.s;
		const sway = Math.sin(t * 5 + i) * 18 * L.s;
		const size = (22 + 20 * random(`hz-${i}`)) * L.s;
		const op = Math.min(1, t * 5) * (1 - Math.max(0, (t - 0.7) / 0.5));
		return (
			<svg
				key={`h${i}`}
				width={size}
				height={size}
				viewBox="0 0 24 24"
				style={{
					position: 'absolute',
					left: x0 + sway - size / 2,
					top: y0 - rise - size / 2,
					opacity: op,
					transform: `rotate(${(random(`hrot-${i}`) - 0.5) * 30}deg)`,
					filter: `drop-shadow(0 0 ${6 * L.s}px ${alpha(PALETTE.gold, 0.7)})`,
				}}
			>
				<defs>
					<linearGradient id={`hg${i}`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor={PALETTE.amberGlow} />
						<stop offset="1" stopColor={PALETTE.gold} />
					</linearGradient>
				</defs>
				<path d={HEART} fill={`url(#hg${i})`} />
			</svg>
		);
	});
	const dust = new Array(34).fill(0).map((_, i) => {
		const start = 100 + random(`ds-${i}`) * 20;
		const p = prog(f, start, start + 8);
		if (p <= 0) return null;
		const x = L.cx + (random(`dx-${i}`) - 0.5) * 900 * L.s;
		const y = L.orbit.cy + (random(`dy-${i}`) - 0.5) * 2.1 * L.orbit.ry - (f - start) * 1.2;
		const tw = 0.35 + 0.65 * bump((f + random(`dp-${i}`) * 20) % 20, 10, 10);
		const sz = (3 + 5 * random(`dz-${i}`)) * L.s;
		return (
			<div
				key={`d${i}`}
				style={{
					position: 'absolute',
					left: x - sz / 2,
					top: y - sz / 2,
					width: sz,
					height: sz,
					borderRadius: '50%',
					background: i % 4 === 0 ? GOLD_GRADIENT : PALETTE.amberGlow,
					opacity: p * tw * 0.85,
					boxShadow: `0 0 ${sz * 2.5}px ${alpha(PALETTE.amberGlow, 0.8)}`,
				}}
			/>
		);
	});
	return (
		<>
			{dust}
			{hearts}
		</>
	);
};
