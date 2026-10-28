import timelineJson from '../../timeline.json';
// Plain JS module shared with the Node audio synth.
import {computeBeats, WALKS} from '../beats.mjs';

export type Word = {
	i: number;
	text: string;
	keyword: boolean;
	start: number;
	end: number;
	line: number;
	sentence: number;
	sid: string;
	scene: string;
};
export type Scene = {id: string; name: string; start: number; end: number};
export type Timeline = {
	fps: number;
	durationInSeconds: number;
	durationInFrames: number;
	sentences: {id: number; sid: string; line: number; scene: string; words: number[]; text: string; start: number; end: number}[];
	words: Word[];
	scenes: Scene[];
	cues: Record<string, number>;
};

export const TL = timelineJson as unknown as Timeline;
export const FPS = TL.fps;
export const DURATION_FRAMES = TL.durationInFrames;

const RAW = computeBeats(TL) as Record<string, unknown>;
// Every beat time in seconds (see src/beats.mjs).
export const B = RAW as unknown as Record<string, number> & {
	dots: number[];
	coins: number[];
	coinLand: number[];
	heart: number[];
	steps: {judas: number[]};
};
export const COMMENT_TEXT = RAW.commentText as string;
export const WALK: Record<'judas', {period: number; phase: number}> = WALKS;

export const SCENE = Object.fromEntries(TL.scenes.map((s) => [s.id, s])) as Record<string, Scene>;

const norm = (s: string) => s.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
// Start time of a word in a sentence (e.g. word('09', 'garden')).
export const word = (sid: string, text: string, nth = 0) => TL.words.filter((w) => w.sid === sid && norm(w.text) === text)[nth];
