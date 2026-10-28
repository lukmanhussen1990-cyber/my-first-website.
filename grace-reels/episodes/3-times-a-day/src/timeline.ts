import data from './timeline.json';

export type Word = {i: number; tok: string; key: boolean; page: number; sentence: number; scene: string; start: number; end: number};
export type Card = {say: string; text: string; ref: string};
export type Page = {id: number; scene: string; kind: 'open' | 'title' | 'caption' | 'card'; words: number[]; start: number; end: number; text?: string; card?: Card};
export type SceneSpan = {id: string; start: number; end: number};

export const TL = data as unknown as {
	fps: number;
	duration: number;
	durationInFrames: number;
	storyEnd: number;
	endCard: number;
	loop: number;
	scenes: SceneSpan[];
	pages: Page[];
	words: Word[];
	voice: {file: string; end: number};
};

export const FPS = TL.fps;

export const sceneAt = (T: number) => {
	let s = TL.scenes[0];
	for (const sc of TL.scenes) if (T >= sc.start) s = sc;
	return s;
};
export const scene = (id: string) => TL.scenes.find((s) => s.id === id)!;
export const wordsOf = (p: Page) => p.words.map((i) => TL.words[i]);

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
// the nth word in a scene that starts with tok (e.g. wordAt('S1', 'three'))
export const wordAt = (sceneId: string, tok: string, nth = 0) => {
	const ws = TL.words.filter((w) => w.scene === sceneId && norm(w.tok).startsWith(norm(tok)));
	if (!ws.length) throw new Error(`no word "${tok}" in ${sceneId}`);
	return ws[Math.min(nth, ws.length - 1)];
};
// scene-local time of a word's start
export const tOf = (sceneId: string, tok: string, nth = 0) => wordAt(sceneId, tok, nth).start - scene(sceneId).start;
