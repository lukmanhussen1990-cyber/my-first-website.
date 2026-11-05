import React from 'react';
import {useCurrentFrame} from 'remotion';
import {POPPINS} from '../lib/fonts';
import {CAPTION_WORDS, FPS} from '../lib/timing';

/* One word at a time, synced to words.json. Pops 0.8 → 1.05 → 1 over ~4 frames. */

const HOLD = 0.35; // keep a word up a little after it ends when a pause follows
const MAX_GAP = 0.6;

export const Captions: React.FC<{frame?: number}> = ({frame: f0}) => {
	const cf = useCurrentFrame();
	const frame = f0 ?? cf;
	const t = frame / FPS;
	let idx = -1;
	for (let i = 0; i < CAPTION_WORDS.length; i++) {
		const w = CAPTION_WORDS[i];
		const next = CAPTION_WORDS[i + 1];
		const until = next && next.start - w.end < MAX_GAP ? next.start : w.end + HOLD;
		if (t >= w.start && t < until) {
			idx = i;
			break;
		}
	}
	if (idx < 0) return null;
	const w = CAPTION_WORDS[idx];
	const f = frame - Math.round(w.start * FPS);
	const scale = f <= 0 ? 0.8 : f === 1 ? 0.93 : f === 2 ? 1.05 : f === 3 ? 1.02 : 1;
	const long = w.text.length > 9;
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: '62%',
				display: 'flex',
				justifyContent: 'center',
				transform: 'translateY(-50%)',
				pointerEvents: 'none',
			}}
		>
			<div
				style={{
					fontFamily: POPPINS,
					fontWeight: 800,
					fontSize: long ? 104 : 118,
					lineHeight: 1,
					color: '#ffffff',
					WebkitTextStroke: '15px #141414',
					paintOrder: 'stroke fill',
					textShadow: '0 8px 0 rgba(0,0,0,0.9), 0 12px 26px rgba(0,0,0,0.45)',
					transform: `scale(${scale})`,
					letterSpacing: -1,
					whiteSpace: 'nowrap',
				}}
			>
				{w.text}
			</div>
		</div>
	);
};
