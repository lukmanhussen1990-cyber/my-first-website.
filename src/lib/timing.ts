import words from '../../words.json';

export const FPS = 30;
export const VO_DURATION = words.duration; // seconds (107.546)
export const TOTAL_SECONDS = VO_DURATION + 1; // video = voiceover + 1 s
export const TOTAL_FRAMES = Math.ceil(TOTAL_SECONDS * FPS);

export type CapWord = {text: string; start: number; end: number};

/** Words for captions, straight from words.json (Whisper). Number pieces like "4" + ",000" are joined. */
export const CAPTION_WORDS: CapWord[] = (() => {
	const out: CapWord[] = [];
	for (const w of words.words) {
		const raw = w.word.trim();
		if (out.length && /^[,.]\d/.test(raw)) {
			const prev = out[out.length - 1];
			prev.text += raw;
			prev.end = w.end;
			continue;
		}
		out.push({text: raw, start: w.start, end: w.end});
	}
	return out.map((w) => {
		// Strip punctuation at the ends (keep apostrophes and commas inside numbers like 4,000).
		let text = w.text.replace(/^[^\w']+|[^\w']+$/g, '');
		if (!/^(Biscuit|I)$/.test(text)) text = text.toLowerCase();
		return {...w, text};
	});
})();
