import data from './timeline.json';
import {monotone} from '../../../src/shared/math';

export type Word = {i: number; tok: string; page: number; scene: string; start: number; end: number};
export type Card = {say: string; text: string; ref: string; full?: boolean};
export type Page = {id: number; scene: string; kind: 'hook' | 'caption' | 'card'; words: number[]; start: number; end: number; text?: string; card?: Card};
export type SceneSpan = {id: string; start: number; end: number; sun: number};

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
	voice: {file: string; lead: number; inserts: [number, number][]; end: number};
};

export const FPS = TL.fps;

export const sceneAt = (T: number) => {
	let s = TL.scenes[0];
	for (const sc of TL.scenes) if (T >= sc.start) s = sc;
	return s;
};
export const scene = (id: string) => TL.scenes.find((s) => s.id === id)!;

// global sunTime: smooth through each scene's start key, 1.0 when the story ends
const sunCurve = (() => {
	const xs = TL.scenes.filter((s) => s.id !== 'S16').map((s) => s.start);
	const ys = TL.scenes.filter((s) => s.id !== 'S16').map((s) => s.sun);
	xs.push(TL.storyEnd);
	ys.push(1);
	return monotone(xs, ys);
})();
export const sunTime = (T: number) => sunCurve(T);

export const wordsOf = (p: Page) => p.words.map((i) => TL.words[i]);
export const pagesOf = (sceneId: string) => TL.pages.filter((p) => p.scene === sceneId);
export const firstWord = (sceneId: string) => TL.words.find((w) => w.scene === sceneId)!;
export const wordTime = (sceneId: string, tok: string, nth = 0) => {
	const ws = TL.words.filter((w) => w.scene === sceneId && w.tok.toLowerCase().replace(/[^a-z']/g, '').startsWith(tok.toLowerCase()));
	return ws[Math.min(nth, ws.length - 1)];
};
