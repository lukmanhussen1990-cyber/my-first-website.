import React, {useMemo} from 'react';
import {AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {EndCard} from '../brand/EndCard';
import {EASE_IN, EASE_IN_OUT, EASE_SOFT, prog, tween} from '../brand/motion';
import {GlowBlobs, GrainVignette} from './Atmosphere';
import {CloudSky} from './CloudSky';
import {CounterPill} from './CounterPill';
import {Avatars, HeartsAndDust} from './Followers';
import {getLayout, T} from './layout';
import {Sparkle} from './Sparkle';
import {Title} from './Title';

/** Parallax layer: shares one slow camera push, scaled by depth factor `k`. */
const Layer: React.FC<{push: number; k: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
	push,
	k,
	children,
	style,
}) => <AbsoluteFill style={{transform: `scale(${1 + (push - 1) * k})`, ...style}}>{children}</AbsoluteFill>;

export const ThankYou1K: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const L = getLayout(width, height);

	// Slow, constant camera push 1.00 → 1.06, frozen for the clean final hold.
	const push = 1 + 0.06 * EASE_SOFT(Math.min(frame, T.hold) / T.hold);

	// Cloud mask grows out of the sparkle and overshoots the frame.
	const maskR = frame < T.sparkleEnd ? 0 : tween(frame, [T.sparkleEnd, T.revealEnd + 2], [8, 1750], (t) => 1 - Math.pow(1 - t, 1.7));
	const rim = 1 - prog(frame, 30, 44);
	const dim =
		tween(frame, [T.revealEnd, 60], [0, 0.18]) +
		tween(frame, [76, 92], [0, 0.4], EASE_IN_OUT) +
		tween(frame, [T.youEnd, T.hold], [0, 0.42], EASE_IN);
	const defocus = tween(frame, [76, 96], [0, 0.65], EASE_IN_OUT);
	const cloudsOut = prog(frame, T.youEnd, T.hold, EASE_IN_OUT);

	const uniforms = useMemo(
		() => ({
			time: frame / 30,
			fwd: (push - 1) * 6,
			horizon: L.horizon,
			maskX: L.cx,
			maskY: L.cy,
			maskR,
			rim,
			defocus,
			dim: Math.min(dim, 1),
		}),
		[frame, push, L.horizon, L.cx, L.cy, maskR, rim, defocus, dim],
	);

	// Everything but the end card blurs out at 4.4 s.
	const out = prog(frame, T.youEnd, T.youEnd + 8, EASE_IN);
	const outStyle: React.CSSProperties = {
		opacity: 1 - prog(frame, T.youEnd, T.youEnd + 9),
		filter: out > 0.01 ? `blur(${out * 22}px)` : undefined,
		transform: `scale(${1 + out * 0.04})`,
	};

	return (
		<AbsoluteFill style={{background: '#0E0B09'}}>
			<Html5Audio src={staticFile('audio/thank-you-1k.wav')} />
			<Layer push={push} k={0.4}>
				<GlowBlobs intensity={0.55 + 0.45 * prog(frame, T.youEnd, T.hold)} />
			</Layer>
			{maskR > 0 && cloudsOut < 1 ? (
				<Layer push={push} k={1} style={{opacity: 1 - cloudsOut}}>
					<CloudSky u={uniforms} renderScale={1} />
				</Layer>
			) : null}
			{frame < T.hold ? (
				<AbsoluteFill style={outStyle}>
					<Layer push={push} k={1.25}>
						<HeartsAndDust L={L} />
					</Layer>
					<Layer push={push} k={1.15}>
						<Title L={L} />
					</Layer>
					<Layer push={push} k={1.3}>
						<Avatars L={L} push={1} />
					</Layer>
					<Layer push={push} k={1.3}>
						<CounterPill L={L} push={1} />
					</Layer>
				</AbsoluteFill>
			) : null}
			<Sparkle L={L} />
			<EndCard start={T.youEnd} logoY={L.logoY} scale={L.endScale} />
			<GrainVignette />
		</AbsoluteFill>
	);
};
