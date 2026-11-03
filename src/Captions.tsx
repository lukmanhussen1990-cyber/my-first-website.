// One word at a time, synced to words.json. Big bold rounded white font with a dark soft outline.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from 'remotion';
import {WORDS, FPS} from './timing';
import {POPPINS} from './lib/fonts';

const isShout = (w: string) => w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);

/** caption text as displayed: lowercase like the reference, shouted words stay in caps */
export const displayWord = (w: string) => {
	if (w === 'AM') return 'AM';
	if (isShout(w)) return w;
	return w.toLowerCase();
};

/** index of the word on screen at this frame, or -1 */
export function captionIndexAt(frame: number) {
	const t = frame / FPS;
	let idx = -1;
	for (let i = 0; i < WORDS.length; i++) {
		if (WORDS[i].start <= t + 0.5 / FPS) idx = i;
		else break;
	}
	if (idx < 0) return -1;
	const w = WORDS[idx];
	const next = WORDS[idx + 1];
	// hold the word until the next one starts, but hide it during long pauses
	const holdUntil = Math.min(next ? next.start : Infinity, w.end + 0.55);
	return t <= holdUntil ? idx : -1;
}

export const Captions: React.FC = () => {
	const frame = useCurrentFrame();
	const idx = captionIndexAt(frame);
	if (idx < 0) return null;
	const w = WORDS[idx];
	const startF = Math.round(w.start * FPS);
	const f = frame - startF;
	// pop in: 0.8 -> 1.05 -> 1 over ~4 frames
	const scale = interpolate(f, [0, 2, 4], [0.8, 1.05, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
	const opacity = interpolate(f, [0, 1], [0.6, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const text = displayWord(w.word);
	const shout = isShout(w.word);
	const size = shout ? 118 : 104;
	const common: React.CSSProperties = {
		fontFamily: POPPINS,
		fontWeight: 800,
		fontSize: size,
		lineHeight: 1,
		letterSpacing: '-0.01em',
		whiteSpace: 'nowrap',
	};
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: '61%',
					display: 'flex',
					justifyContent: 'center',
					transform: `translateY(-50%) scale(${scale})`,
					opacity,
				}}
			>
				<div style={{position: 'relative'}}>
					{/* soft dark shadow */}
					<div style={{...common, position: 'absolute', inset: 0, color: 'rgba(10,8,30,0.55)', filter: 'blur(10px)', transform: 'translateY(6px)'}}>{text}</div>
					{/* dark outline */}
					<div style={{...common, position: 'absolute', inset: 0, color: '#16122b', WebkitTextStroke: '16px #16122b'}}>{text}</div>
					{/* white fill */}
					<div style={{...common, position: 'relative', color: '#ffffff'}}>{text}</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};
