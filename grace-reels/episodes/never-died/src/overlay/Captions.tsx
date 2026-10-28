// Word-timed captions: one sentence (or clause) per block, words fade and rise in with the voice,
// the next word shows early as a faint ghost, keywords pop in gold capitals.
import {clamp, easeOut, lerp, smooth} from '../lib/ease';
import {B, TL, Word} from '../lib/timeline';
import {C, SAFE, SERIF} from './theme';

export type Block = {id: number; words: Word[]; from: number; to: number};

const SPLIT_AFTER = /[,;:…”]$/;
const MAX_CHARS = 52; // longer sentences split at their best pause so a block never passes 3 lines
const HOLD = 1.4; // seconds a block stays after its last word
const GHOST = 0.15; // the next word shows this early at 25%
const REVEAL = 0.12; // fade + 8 px rise

const textOf = (ws: Word[]) => ws.map((w) => w.text).join(' ');

const buildBlocks = (): Block[] => {
	const bySentence = new Map<number, Word[]>();
	for (const w of TL.words) {
		if (!bySentence.has(w.sentence)) bySentence.set(w.sentence, []);
		bySentence.get(w.sentence)!.push(w);
	}
	const groups: Word[][] = [];
	for (const words of bySentence.values()) {
		const text = textOf(words);
		if (text.length <= MAX_CHARS) {
			groups.push(words);
			continue;
		}
		let best = -1;
		let bestScore = -Infinity;
		for (let i = 0; i < words.length - 1; i++) {
			if (!SPLIT_AFTER.test(words[i].text)) continue;
			const a = textOf(words.slice(0, i + 1)).length;
			const b = text.length - a - 1;
			if (a < 12 || b < 12) continue;
			const pause = words[i + 1].start - words[i].end;
			const score = pause * 4 - Math.abs(a - b) / text.length;
			if (score > bestScore) {
				bestScore = score;
				best = i;
			}
		}
		if (best < 0) groups.push(words);
		else groups.push(words.slice(0, best + 1), words.slice(best + 1));
	}
	groups.sort((a, b) => a[0].start - b[0].start);
	return groups.map((words, i) => {
		const next = groups[i + 1];
		// The first block is revealed by the hook title flying into the caption spot.
		const from = i === 0 ? B.hookTitleFly + 0.05 : words[0].start - GHOST;
		const to = Math.min(words[words.length - 1].end + HOLD, next ? next[0].start - GHOST - 0.02 : Infinity);
		return {id: i, words, from, to};
	});
};

export const BLOCKS = buildBlocks();

// How visible the caption area is (drives the scrim).
export const captionPresence = (t: number) => {
	for (const b of BLOCKS) {
		if (t >= b.from - 0.25 && t < b.to + 0.35) {
			return Math.min(smooth((t - (b.from - 0.25)) / 0.25), 1 - smooth((t - b.to) / 0.35));
		}
	}
	return 0;
};

const split = (text: string) => {
	const m = text.match(/^([“"‘(]*)(.*?)([.,;:!?…”"’)]*)$/u);
	return m ? {lead: m[1], core: m[2], tail: m[3]} : {lead: '', core: text, tail: ''};
};

const keyPop = (x: number) => (x <= 0 ? 1 : x < 0.07 ? 1 + 0.2 * smooth(x / 0.07) : 1 + 0.2 * Math.exp(-(x - 0.07) * 9));

const WordView: React.FC<{w: Word; t: number; instant: boolean}> = ({w, t, instant}) => {
	let opacity = 0;
	let rise = 8;
	if (instant || t >= w.start) {
		const p = instant ? 1 : easeOut(clamp((t - w.start) / REVEAL));
		opacity = lerp(0.25, 1, p);
		rise = 8 * (1 - p);
	} else if (t >= w.start - GHOST) {
		opacity = 0.25 * smooth((t - (w.start - GHOST)) / 0.06);
	}
	const base: React.CSSProperties = {display: 'inline-block', opacity, transform: `translateY(${rise}px)`, whiteSpace: 'pre'};
	if (!w.keyword) return <span style={base}>{w.text}</span>;
	const {lead, core, tail} = split(w.text);
	const x = t - w.start;
	const glow = x > 0 ? Math.exp(-x * 2.2) : 0;
	return (
		<span style={base}>
			{lead}
			<span
				style={{
					display: 'inline-block',
					fontStyle: 'normal',
					fontWeight: 700,
					color: C.gold,
					letterSpacing: '0.02em',
					transform: `scale(${keyPop(x)})`,
					transformOrigin: '50% 70%',
					textShadow: `0 2px 10px rgba(10,6,3,0.6), 0 0 ${18 * glow}px rgba(242,181,68,${0.75 * glow})`,
				}}
			>
				{core.toUpperCase()}
			</span>
			{tail}
		</span>
	);
};

export const Captions: React.FC<{t: number}> = ({t}) => {
	const block = BLOCKS.find((b) => t >= b.from && t < b.to);
	if (!block) return null;
	const fadeIn = smooth((t - block.from) / 0.1);
	const fadeOut = 1 - smooth((t - (block.to - 0.15)) / 0.15);
	return (
		<div
			style={{
				position: 'absolute',
				left: SAFE.left,
				top: 240,
				width: SAFE.right - SAFE.left,
				fontFamily: SERIF,
				fontStyle: 'italic',
				fontWeight: 500,
				fontSize: 66,
				lineHeight: 1.15,
				color: C.cream,
				textShadow: '0 2px 14px rgba(30,15,4,0.6), 0 0 3px rgba(30,15,4,0.45), 0 1px 1px rgba(30,15,4,0.35)',
				opacity: Math.min(fadeIn, fadeOut),
			}}
		>
			{block.words.map((w, i) => (
				<span key={w.i}>
					<WordView w={w} t={t} instant={block.id === 0 && w.start < B.hookTitleFly + 0.2} />
					{i < block.words.length - 1 ? ' ' : ''}
				</span>
			))}
		</div>
	);
};

// Soft warm haze band behind the captions (like the reference), following caption presence.
export const CaptionScrim: React.FC<{t: number; strength?: number}> = ({t, strength = 1}) => {
	const a = captionPresence(t) * strength;
	if (a <= 0.001) return null;
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 150,
				width: 1080,
				height: 560,
				opacity: a,
				background:
					'radial-gradient(ellipse 72% 50% at 40% 46%, rgba(52,26,6,0.26) 0%, rgba(52,26,6,0.16) 50%, rgba(52,26,6,0) 100%)',
			}}
		/>
	);
};
