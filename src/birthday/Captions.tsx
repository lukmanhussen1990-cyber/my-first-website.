// One word at a time, straight from words.json. Poppins ExtraBold, white with a dark soft outline,
// a little below the middle. Each word pops in gently: scale 0.85 -> 1.03 -> 1 over 5 frames.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from 'remotion';
import {WORDS, FPS} from './timing';
import {POPPINS} from '../lib/fonts';

/** index of the word on screen at this frame, or -1 (shown from its start, held until the next word, hidden in long pauses) */
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
	const holdUntil = Math.min(next ? next.start : Infinity, w.end + 0.55);
	return t <= holdUntil ? idx : -1;
}

export const BirthdayCaptions: React.FC = () => {
	const frame = useCurrentFrame();
	const idx = captionIndexAt(frame);
	if (idx < 0) return null;
	const w = WORDS[idx];
	const f = frame - Math.round(w.start * FPS);
	const scale = interpolate(f, [0, 3, 5], [0.85, 1.03, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
	const opacity = interpolate(f, [0, 2], [0.55, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const text = w.word;
	const common: React.CSSProperties = {
		fontFamily: POPPINS,
		fontWeight: 800,
		fontSize: 100,
		lineHeight: 1,
		letterSpacing: '-0.005em',
		whiteSpace: 'nowrap',
	};
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{position: 'absolute', left: 0, right: 0, top: '59%', display: 'flex', justifyContent: 'center', transform: `translateY(-50%) scale(${scale})`, opacity}}>
				<div style={{position: 'relative'}}>
					<div style={{...common, position: 'absolute', inset: 0, color: 'rgba(20,10,8,0.6)', filter: 'blur(12px)', transform: 'translateY(7px)'}}>{text}</div>
					<div style={{...common, position: 'absolute', inset: 0, color: '#1c1216', WebkitTextStroke: '15px #1c1216'}}>{text}</div>
					<div style={{...common, position: 'relative', color: '#ffffff'}}>{text}</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};
